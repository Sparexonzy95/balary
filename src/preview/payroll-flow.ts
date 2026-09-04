import { randomBytes } from 'node:crypto';
import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { WebSocket } from 'ws';
import { firstValueFrom } from 'rxjs';
import pino from 'pino';

import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import {
  deployContract,
  submitCallTx,
} from '@midnight-ntwrk/midnight-js-contracts';

import {
  fromHex,
  toHex,
} from '@midnight-ntwrk/midnight-js-utils';

import {
  type EnvironmentConfiguration,
} from '@midnight-ntwrk/testkit-js';

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
  pureCircuits,
  PayrollState,
} from '../contracts/payroll.js';

(globalThis as any).WebSocket = WebSocket;

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
  },
});



const SALARY = 5_000_000n;

async function walletState(
  wallet: PreviewWallet,
): Promise<any> {
  return firstValueFrom(wallet.wallet.state());
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
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const state = await walletState(wallet);

    const balance =
      state.shielded.balances[color] ?? 0n;

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

function collectZswapOutputs(tx: any): any[] {
  const outputs: any[] = [];

  if (tx?.guaranteedOffer?.outputs) {
    tx.guaranteedOffer.outputs.forEach(
      (output: any, index: number) => {
        outputs.push({
          section: 'guaranteed',
          segment: null,
          indexInOffer: index,
          commitment: output.commitment,
          contractAddress:
            output.contractAddress ?? null,
        });
      },
    );
  }

  if (tx?.fallibleOffer instanceof Map) {
    const entries = [
      ...tx.fallibleOffer.entries(),
    ].sort(
      ([a], [b]) =>
        Number(a) - Number(b),
    );

    for (const [segment, offer] of entries) {
      offer.outputs.forEach(
        (output: any, index: number) => {
          outputs.push({
            section: 'fallible',
            segment,
            indexInOffer: index,
            commitment: output.commitment,
            contractAddress:
              output.contractAddress ?? null,
          });
        },
      );
    }
  }

  return outputs;
}

async function queryTransactionIndexes(
  indexer: string,
  txHash: string,
): Promise<any | null> {
  const response = await fetch(indexer, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        query BalaryTransaction($hash: HexEncoded!) {
          transactions(offset: { hash: $hash }) {
            __typename
            ... on RegularTransaction {
              id
              hash
              startIndex
              endIndex
              block {
                height
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

  if (!response.ok) {
    throw new Error(
      `Indexer HTTP error ${response.status}`,
    );
  }

  const json: any = await response.json();

  if (json.errors) {
    throw new Error(
      `Indexer GraphQL error: ${JSON.stringify(
        json.errors,
      )}`,
    );
  }

  return (
    json.data?.transactions?.find(
      (tx: any) =>
        tx.__typename === 'RegularTransaction',
    ) ?? null
  );
}

async function main(): Promise<void> {
  const deploymentData = JSON.parse(
    readFileSync(
      '.cache/preview-gateway.json',
      'utf8',
    ),
  );

  const gatewayAddress =
    deploymentData.gateway ??
    deploymentData.gatewayAddress;

  const zUSDMColorHex =
    deploymentData.zUSDMColor ??
    deploymentData.zusdmColor;

  if (!gatewayAddress) {
    throw new Error(
      'Preview Gateway address missing from .cache/preview-gateway.json',
    );
  }

  if (!zUSDMColorHex) {
    throw new Error(
      'Preview zUSDM color missing from .cache/preview-gateway.json',
    );
  }

  const config = getPreviewConfig();

  setNetworkId(config.networkId);

  const env: EnvironmentConfiguration = {
    walletNetworkId: config.networkId,
    networkId: config.networkId,
    indexer: config.indexer,
    indexerWS: config.indexerWS,
    node: config.node,
    nodeWS: config.nodeWS,
    faucet: config.faucet,
    proofServer: config.proofServer,
  };

  const mnemonic =
    process.env['MIDNIGHT_MNEMONIC_PREVIEW'] ??
    process.env['MIDNIGHT_MNEMONIC'];

  if (!mnemonic) {
    throw new Error(
      'MIDNIGHT_MNEMONIC_PREVIEW is required.',
    );
  }

  let wallet =
    await buildPreviewWallet(
      mnemonic,
    );

  try {
    logger.info(
      'Using cached Balary Preview employer wallet',
    );

    const initialState =
      await walletState(wallet);

    const employerBalance =
      initialState.shielded.balances[
        zUSDMColorHex
      ] ?? 0n;

    logger.info(
      {
        zUSDMColor: zUSDMColorHex,
        employerZUSDM:
          employerBalance.toString(),
      },
      'Employer shielded balance loaded',
    );

    assert(
      employerBalance >= SALARY,
      `Employer needs at least ${SALARY} zUSDM`,
    );

    /*
     * Institutional secrets remain private.
     * Only derived authority commitments
     * enter contract ledger state.
     */
    const adminSecret = randomBytes(32);
    const hrSecret = randomBytes(32);
    const financeSecret = randomBytes(32);

    const employeeSecret = randomBytes(32);

    const institutionId = randomBytes(32);
    const payrollId = randomBytes(32);

    const allocationId = randomBytes(32);
    const allocationBlind = randomBytes(32);
    const intentBlind = randomBytes(32);

    const adminAuthority =
      pureCircuits.deriveAdminAuthority(
        adminSecret,
      );

    const hrAuthority =
      pureCircuits.deriveHrAuthority(
        hrSecret,
      );

    const financeAuthority =
      pureCircuits.deriveFinanceAuthority(
        financeSecret,
      );

    const employeeKey =
      pureCircuits.deriveEmployeeKey(
        employeeSecret,
      );

    const zUSDMColor =
      fromHex(zUSDMColorHex);

    const claimDeadline =
      BigInt(
        Math.floor(Date.now() / 1000) +
          60 * 60,
      );

    let providers = buildProviders(
      wallet,
      payrollZkConfigPath,
      'balary-payroll-private-state',
      config,
    );

    /*
     * ------------------------------------------------
     * DEPLOY PAYROLL VAULT
     * ------------------------------------------------
     */

    logger.info(
      'Deploying Balary Payroll Vault',
    );

    const deployment =
      await deployContract(
        providers,
        {
          compiledContract:
            CompiledPayroll,

          privateStateId:
            'balary-payroll',

          initialPrivateState: {},

          args: [
            institutionId,
            payrollId,
            { bytes: fromHex(gatewayAddress) },
            1n,
            claimDeadline,
            adminAuthority,
            hrAuthority,
            financeAuthority,
          ],
        },
      );

    const payrollAddress =
      deployment
        .deployTxData
        .public
        .contractAddress;

    logger.info(
      {
        payrollAddress,
      },
      'Balary Payroll Vault deployed',
    );

    const afterDeploy: any =
      await readLedger(
        providers,
        payrollAddress,
        payrollLedger,
      );

    assert.equal(
      afterDeploy.payrollState,
      PayrollState.FUNDING,
    );

    assert.equal(
      toHex(afterDeploy.zUSDMColor),
      zUSDMColorHex,
      'Payroll zUSDM color does not match Gateway',
    );

    /*
     * ------------------------------------------------
     * HR APPROVAL
     * ------------------------------------------------
     */

    logger.info(
      {
        salary: SALARY.toString(),
      },
      'HR approving private salary allocation',
    );

    await submitCallTx(
      providers,
      {
        compiledContract:
          CompiledPayroll,

        contractAddress:
          payrollAddress,

        privateStateId:
          'balary-payroll',

        circuitId:
          'approveAllocation',

        args: [
          hrSecret,
          employeeKey,
          SALARY,
          allocationId,
          allocationBlind,
          intentBlind,
        ],
      },
    );

    const afterApproval: any =
      await readLedger(
        providers,
        payrollAddress,
        payrollLedger,
      );

    assert.equal(
      afterApproval.payrollState,
      PayrollState.FUNDING,
      'Approval alone must not activate payroll',
    );

    logger.info(
      'HR salary approval accepted',
    );

    /*
     * Preview transactions consume live wallet state.
     * Refresh after HR approval so Finance does not
     * build against stale DUST / Zswap coin state.
     */
    logger.info(
      'Refreshing Preview wallet before Finance funding',
    );

    await wallet.stop();

    wallet =
      await buildPreviewWallet(
        mnemonic,
      );

    providers = {
      ...providers,
      walletProvider: wallet,
      midnightProvider: wallet,
    };

    const refreshedState =
      await walletState(
        wallet,
      );

    const refreshedEmployerBalance =
      refreshedState.shielded.balances[
        zUSDMColorHex
      ] ?? 0n;

    assert(
      refreshedEmployerBalance >= SALARY,
      `Refreshed employer wallet needs at least ${SALARY} zUSDM`,
    );

    logger.info(
      {
        employerZUSDM:
          refreshedEmployerBalance.toString(),
      },
      'Preview wallet refreshed for Finance',
    );

    /*
     * ------------------------------------------------
     * FINANCE FUNDING
     * ------------------------------------------------
     */

    const salaryNonce =
      randomBytes(32);

    const salaryCoin = {
      nonce: salaryNonce,
      color: zUSDMColor,
      value: SALARY,
    };

    logger.info(
      {
        salary: SALARY.toString(),
      },
      'Finance funding exact HR-approved salary',
    );

    const fundTx =
      await submitCallTx(
        providers,
        {
          compiledContract:
            CompiledPayroll,

          contractAddress:
            payrollAddress,

          privateStateId:
            'balary-payroll',

          circuitId:
            'fundAllocation',

          args: [
            financeSecret,
            employeeKey,
            salaryCoin,
            allocationId,
            allocationBlind,
            intentBlind,
          ],
        },
      );

    const afterFunding: any =
      await readLedger(
        providers,
        payrollAddress,
        payrollLedger,
      );

    assert.equal(
      afterFunding.payrollState,
      PayrollState.ACTIVE,
      'Fully funded payroll should become ACTIVE',
    );

    const expectedEmployerBalance =
      employerBalance - SALARY;

    const finalEmployerBalance =
      await waitForShieldedBalance(
        wallet,
        zUSDMColorHex,
        expectedEmployerBalance,
      );

    /*
     * Capture the actual Zswap output structure.
     * This is what we need to wire the committed
     * salary coin mt_index into claimSalary().
     */
    const zswapOutputs =
      collectZswapOutputs(
        fundTx.public.tx,
      );

    const payrollOutputs =
      zswapOutputs.filter(
        (output) =>
          output.contractAddress ===
          payrollAddress,
      );

    const indexedTx =
      await queryTransactionIndexes(
        config.indexer,
        fundTx.public.txHash,
      );

    const newCoins =
      fundTx.private.newCoins.map(
        (coin: any) => ({
          nonce: toHex(coin.nonce),
          color: toHex(coin.color),
          value: coin.value.toString(),
        }),
      );

    mkdirSync('.cache', {
      recursive: true,
    });

    const localState = {
      payrollAddress,
      gatewayAddress,
      zUSDMColor: zUSDMColorHex,

      salary: SALARY.toString(),

      employeeSecret:
        toHex(employeeSecret),

      allocationBlind:
        toHex(allocationBlind),

      allocationId:
        toHex(allocationId),

      intentBlind:
        toHex(intentBlind),

      employeeKey:
        toHex(employeeKey),

      salaryNonce:
        toHex(salaryNonce),

      fundTxHash:
        fundTx.public.txHash,

      fundTxId:
        fundTx.public.txId,

      indexerTransaction:
        indexedTx,

      zswapOutputs,

      payrollOutputs,

      newCoins,
    };

    writeFileSync(
      '.cache/preview-payroll-state.json',
      JSON.stringify(
        localState,
        null,
        2,
      ) + '\n',
    );

    console.log(
      '\n====================================',
    );

    console.log(
      'BALARY PAYROLL FUNDING FLOW: SUCCESS',
    );

    console.log(
      '====================================',
    );

    console.log(
      `Payroll address:          ${payrollAddress}`,
    );

    console.log(
      `Salary approved:          ${SALARY}`,
    );

    console.log(
      `Salary funded:            ${SALARY}`,
    );

    console.log(
      `Payroll state:            ACTIVE`,
    );

    console.log(
      `Employer zUSDM before:    ${employerBalance}`,
    );

    console.log(
      `Employer zUSDM after:     ${finalEmployerBalance}`,
    );

    console.log(
      `Fund transaction hash:    ${fundTx.public.txHash}`,
    );

    if (indexedTx) {
      console.log(
        `Zswap start index:        ${indexedTx.startIndex}`,
      );

      console.log(
        `Zswap end index:          ${indexedTx.endIndex}`,
      );
    }

    console.log(
      `Zswap outputs in tx:      ${zswapOutputs.length}`,
    );

    console.log(
      `Payroll-owned outputs:    ${payrollOutputs.length}`,
    );

    console.log(
      '\nPayroll-owned Zswap output(s):',
    );

    console.dir(
      payrollOutputs,
      {
        depth: null,
      },
    );

    console.log(
      '\nSaved local claim material to:',
    );

    console.log(
      '.cache/preview-payroll-state.json',
    );
  } finally {
    await wallet.stop();
  }
}

main().catch((error) => {
  logger.error(
    error,
    'Balary Preview Payroll flow failed',
  );

  process.exitCode = 1;
});
