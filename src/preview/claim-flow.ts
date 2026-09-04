import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { WebSocket } from 'ws';
import { firstValueFrom } from 'rxjs';
import pino from 'pino';

import * as compactRuntime from '@midnight-ntwrk/compact-runtime';
import { Event } from '@midnight-ntwrk/ledger-v8';

import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import {
  submitCallTx,
} from '@midnight-ntwrk/midnight-js-contracts';

import {
  fromHex,
  toHex,
} from '@midnight-ntwrk/midnight-js-utils';



import { getPreviewConfig } from '../config.js';

import {
  buildPreviewWallet,
  type PreviewWallet,
} from './wallet-provider.js';
import { buildProviders } from '../providers.js';

import {
  CompiledPayroll,
  ledger as payrollLedger,
  payrollZkConfigPath,
  PayrollState,
} from '../contracts/payroll.js';

(globalThis as any).WebSocket = WebSocket;

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
  },
});



/*
 * These descriptors reproduce exactly what Compact 0.31.1
 * generated for AllocationData in BalaryPayrollVault.
 */
const bytes32 =
  new compactRuntime.CompactTypeBytes(32);

const uint128 =
  new compactRuntime.CompactTypeUnsignedInteger(
    340282366920938463463374607431768211455n,
    16,
  );

class AllocationDataDescriptor {
  alignment() {
    return bytes32.alignment().concat(
      bytes32.alignment().concat(
        bytes32.alignment().concat(
          bytes32.alignment().concat(
            uint128.alignment(),
          ),
        ),
      ),
    );
  }

  fromValue(value: any) {
    return {
      payrollId:
        bytes32.fromValue(value),

      employeeKey:
        bytes32.fromValue(value),

      coinNonce:
        bytes32.fromValue(value),

      coinColor:
        bytes32.fromValue(value),

      coinValue:
        uint128.fromValue(value),
    };
  }

  toValue(value: {
    payrollId: Uint8Array;
    employeeKey: Uint8Array;
    coinNonce: Uint8Array;
    coinColor: Uint8Array;
    coinValue: bigint;
  }) {
    return bytes32
      .toValue(value.payrollId)
      .concat(
        bytes32
          .toValue(value.employeeKey)
          .concat(
            bytes32
              .toValue(value.coinNonce)
              .concat(
                bytes32
                  .toValue(value.coinColor)
                  .concat(
                    uint128.toValue(
                      value.coinValue,
                    ),
                  ),
              ),
          ),
      );
  }
}

const allocationDescriptor =
  new AllocationDataDescriptor();

async function walletState(
  wallet: PreviewWallet,
): Promise<any> {
  return firstValueFrom(
    wallet.wallet.state(),
  );
}

async function readLedger<T>(
  providers: any,
  address: string,
  decode: (data: any) => T,
): Promise<T> {
  const state =
    await providers.publicDataProvider.queryContractState(
      address,
    );

  if (!state) {
    throw new Error(
      `Contract state not found: ${address}`,
    );
  }

  return decode(state.data);
}

async function waitForShieldedBalance(
  wallet: PreviewWallet,
  color: string,
  expected: bigint,
  timeoutMs = 180_000,
): Promise<bigint> {
  const deadline =
    Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const state =
      await walletState(wallet);

    const balance =
      state.shielded.balances[color] ??
      0n;

    if (balance === expected) {
      return balance;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 1_000),
    );
  }

  throw new Error(
    `Timed out waiting for shielded balance ${expected} of ${color}`,
  );
}

async function findSalaryMtIndex(
  indexer: string,
  txHash: string,
  payrollAddress: string,
  commitment: string,
): Promise<bigint> {
  const response =
    await fetch(indexer, {
      method: 'POST',

      headers: {
        'content-type':
          'application/json',
      },

      body: JSON.stringify({
        query: `
          query BalaryFundTx($hash: HexEncoded!) {
            transactions(offset: { hash: $hash }) {
              __typename

              ... on RegularTransaction {
                hash

                zswapLedgerEvents {
                  id
                  raw
                  maxId
                  protocolVersion
                }
              }
            }
          }
        `,

        variables: {
          hash: txHash,
        },
      }),
    });

  const json: any =
    await response.json();

  if (json.errors) {
    throw new Error(
      JSON.stringify(
        json.errors,
      ),
    );
  }

  const tx =
    json.data?.transactions?.find(
      (item: any) =>
        item.__typename ===
        'RegularTransaction',
    );

  if (!tx) {
    throw new Error(
      'Funding transaction not found in indexer.',
    );
  }

  for (
    const item of tx.zswapLedgerEvents
  ) {
    const event =
      Event.deserialize(
        fromHex(item.raw),
      );

    const text =
      event.toString(false);

    if (
      text.includes(commitment) &&
      text.includes(payrollAddress)
    ) {
      const match =
        text.match(
          /mt_index:\s*(\d+)/,
        );

      if (!match) {
        throw new Error(
          'Salary output found but mt_index was not present.',
        );
      }

      return BigInt(match[1]);
    }
  }

  throw new Error(
    'Could not find contract-owned salary output.',
  );
}

async function main(): Promise<void> {
  const saved =
    JSON.parse(
      readFileSync(
        '.cache/preview-payroll-state.json',
        'utf8',
      ),
    );

  const config =
    getPreviewConfig();

  setNetworkId(
    config.networkId,
  );

  const employeeMnemonic =
    process.env['MIDNIGHT_MNEMONIC_PREVIEW'] ??
    process.env['MIDNIGHT_MNEMONIC'];

  if (!employeeMnemonic) {
    throw new Error(
      'MIDNIGHT_MNEMONIC_PREVIEW is required.',
    );
  }

  /*
   * Buildathon Preview demo:
   * employer and employee intentionally use
   * the same funded Preview wallet.
   */
  process.env['WALLET_STATE_FILE'] =
    `${process.cwd()}/wallet-state.json`;

  const wallet =
    await buildPreviewWallet(
      employeeMnemonic,
    );

  try {
    logger.info(
      'Using shared Balary Preview wallet for employee claim demo',
    );

    const providers =
      buildProviders(
        wallet,
        payrollZkConfigPath,
        'balary-payroll-private-state',
        config,
      );

    /*
     * Balary currently uses vacant witnesses and an empty
     * Midnight.js private-state object. The institutional
     * and employee secrets are explicit private circuit
     * arguments, not values stored here.
     *
     * This also lets this already-active local payroll
     * continue after the earlier runner used a different
     * LevelDB store name.
     */
    providers.privateStateProvider.setContractAddress(
      saved.payrollAddress,
    );

    const privateStateId = 'balary-payroll';

    const existingPrivateState =
      await providers.privateStateProvider.get(
        privateStateId,
      );

    if (existingPrivateState === null) {
      await providers.privateStateProvider.set(
        privateStateId,
        {},
      );

      logger.info(
        'Initialized empty Balary Payroll private state',
      );
    }

    /*
     * ----------------------------------------
     * READ ACTIVE PAYROLL
     * ----------------------------------------
     */

    const payroll: any =
      await readLedger(
        providers,
        saved.payrollAddress,
        payrollLedger,
      );

    assert.equal(
      payroll.payrollState,
      PayrollState.ACTIVE,
      'Payroll must be ACTIVE before claim',
    );

    logger.info(
      {
        payrollAddress:
          saved.payrollAddress,
      },
      'Active Payroll loaded',
    );

    /*
     * ----------------------------------------
     * REPRODUCE EXACT PRIVATE ALLOCATION LEAF
     * ----------------------------------------
     */

    const allocationData = {
      payrollId:
        payroll.payrollId,

      employeeKey:
        fromHex(
          saved.employeeKey,
        ),

      coinNonce:
        fromHex(
          saved.salaryNonce,
        ),

      coinColor:
        fromHex(
          saved.zUSDMColor,
        ),

      coinValue:
        BigInt(
          saved.salary,
        ),
    };

    const allocationBlind =
      fromHex(
        saved.allocationBlind,
      );

    const allocationLeaf =
      compactRuntime.persistentCommit(
        allocationDescriptor as any,
        allocationData,
        allocationBlind,
      );

    logger.info(
      {
        allocationLeaf:
          toHex(allocationLeaf),
      },
      'Reconstructed private allocation commitment',
    );

    /*
     * The decoded MerkleTree retains its private
     * underlying data even though it does not expose
     * the leaves as enumerable properties.
     */
    const allocationPath =
      payroll.allocations.findPathForLeaf(
        allocationLeaf,
      );

    assert(
      allocationPath,
      'Allocation leaf was not found in Payroll Merkle tree',
    );

    assert.equal(
      toHex(allocationPath.leaf),
      toHex(allocationLeaf),
      'Merkle path is not bound to reconstructed allocation',
    );

    logger.info(
      {
        pathDepth:
          allocationPath.path.length,
      },
      'Allocation Merkle proof reconstructed successfully',
    );

    /*
     * ----------------------------------------
     * FIND LIVE MIDNIGHT ZSWAP INDEX
     * ----------------------------------------
     */

    const payrollOutput =
      saved.payrollOutputs?.[0];

    assert(
      payrollOutput?.commitment,
      'Saved salary commitment missing',
    );

    const mtIndex =
      await findSalaryMtIndex(
        config.indexer,
        saved.fundTxHash,
        saved.payrollAddress,
        payrollOutput.commitment,
      );

    logger.info(
      {
        salaryCommitment:
          payrollOutput.commitment,

        mtIndex:
          mtIndex.toString(),
      },
      'Qualified contract-owned salary coin located',
    );

    const salaryCoin = {
      nonce:
        fromHex(
          saved.salaryNonce,
        ),

      color:
        fromHex(
          saved.zUSDMColor,
        ),

      value:
        BigInt(
          saved.salary,
        ),

      mt_index:
        mtIndex,
    };

    const employeeSecret =
      fromHex(
        saved.employeeSecret,
      );

    const before =
      await walletState(
        wallet,
      );

    const beforeBalance =
      before.shielded.balances[
        saved.zUSDMColor
      ] ?? 0n;

    /*
     * ----------------------------------------
     * EMPLOYEE PRIVATE CLAIM
     * ----------------------------------------
     */

    logger.info(
      {
        salary:
          saved.salary,

        mtIndex:
          mtIndex.toString(),
      },
      'Submitting private employee salary claim',
    );

    const claimTx =
      await submitCallTx(
        providers,
        {
          compiledContract:
            CompiledPayroll,

          contractAddress:
            saved.payrollAddress,

          privateStateId:
            'balary-payroll',

          circuitId:
            'claimSalary',

          args: [
            employeeSecret,
            allocationBlind,
            salaryCoin,
            allocationPath,
          ],
        },
      );

    /*
     * ----------------------------------------
     * VERIFY COMPLETION
     * ----------------------------------------
     */

    const afterPayroll: any =
      await readLedger(
        providers,
        saved.payrollAddress,
        payrollLedger,
      );

    assert.equal(
      afterPayroll.payrollState,
      PayrollState.COMPLETED,
      'Single-allocation payroll should be COMPLETED after claim',
    );

    const expectedBalance =
      beforeBalance +
      BigInt(saved.salary);

    const afterBalance =
      await waitForShieldedBalance(
        wallet,
        saved.zUSDMColor,
        expectedBalance,
      );

    console.log(
      '\n====================================',
    );

    console.log(
      'BALARY EMPLOYEE CLAIM: SUCCESS',
    );

    console.log(
      '====================================',
    );

    console.log(
      `Payroll address:          ${saved.payrollAddress}`,
    );

    console.log(
      `Salary claimed:           ${saved.salary}`,
    );

    console.log(
      `Allocation commitment:    ${toHex(allocationLeaf)}`,
    );

    console.log(
      `Salary mt_index:          ${mtIndex}`,
    );

    console.log(
      `Wallet zUSDM before:      ${beforeBalance}`,
    );

    console.log(
      `Wallet zUSDM after:       ${afterBalance}`,
    );

    console.log(
      `Payroll state:            COMPLETED`,
    );

    console.log(
      `Claim transaction hash:   ${claimTx.public.txHash}`,
    );
  } finally {
    await wallet.stop();
  }
}

main().catch((error) => {
  logger.error(
    error,
    'Balary employee claim failed',
  );

  process.exitCode = 1;
});
