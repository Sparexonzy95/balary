import { randomBytes } from 'node:crypto';
import { strict as assert } from 'node:assert';
import {
  mkdirSync,
  writeFileSync,
} from 'node:fs';

import { WebSocket } from 'ws';
import { firstValueFrom } from 'rxjs';
import pino from 'pino';

import {
  setNetworkId,
} from '@midnight-ntwrk/midnight-js-network-id';

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

import {
  UnshieldedAddress,
} from '@midnight-ntwrk/wallet-sdk';

import {
  buildPreviewWallet,
  type PreviewWallet,
} from './wallet-provider.js';

import {
  getPreviewConfig,
} from '../config.js';

import {
  buildProviders,
} from '../providers.js';

import {
  CompiledGateway,
  gatewayZkConfigPath,
  ledger as gatewayLedger,
} from '../contracts/gateway.js';

(globalThis as any).WebSocket =
  WebSocket;

/*
 * Keep wallet internals quiet on Preview.
 * In particular, do not print wallet
 * secrets into terminal logs.
 */
const logger = pino({
  level: 'warn',
});

const PREVIEW_USDM_COLOR_HEX =
  '003bacd9a361ba0d425e408776020e40271375e8b8de42d73eec046a44947d73';

const USDM_DECIMALS =
  1_000_000n;

/*
 * First live Balary Preview deposit:
 * 10 USDM.
 */
const DEPOSIT_USDM =
  10n;

const DEPOSIT_RAW =
  DEPOSIT_USDM *
  USDM_DECIMALS;

function formatUSDM(
  raw: bigint,
): string {
  const whole =
    raw / USDM_DECIMALS;

  const fractional =
    raw % USDM_DECIMALS;

  if (fractional === 0n) {
    return whole.toString();
  }

  return (
    `${whole}.` +
    fractional
      .toString()
      .padStart(6, '0')
      .replace(/0+$/, '')
  );
}

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
    await providers
      .publicDataProvider
      .queryContractState(
        address,
      );

  if (!state) {
    throw new Error(
      `Contract state not found: ${address}`,
    );
  }

  return decode(
    state.data,
  );
}

async function waitForExactUnshieldedBalance(
  wallet: PreviewWallet,
  colorHex: string,
  expected: bigint,
  timeoutMs = 300_000,
): Promise<any> {
  const deadline =
    Date.now() + timeoutMs;

  while (
    Date.now() < deadline
  ) {
    const state =
      await walletState(
        wallet,
      );

    const balance =
      state.unshielded
        .balances[
          colorHex
        ] ?? 0n;

    if (
      balance === expected
    ) {
      return state;
    }

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          2_000,
        ),
    );
  }

  throw new Error(
    `Timed out waiting for Preview USDM balance ${expected}`,
  );
}

async function waitForShieldedIncrease(
  wallet: PreviewWallet,
  before:
    Record<string, bigint>,
  expectedIncrease: bigint,
  timeoutMs = 300_000,
): Promise<{
  color: string;
  before: bigint;
  after: bigint;
}> {
  const deadline =
    Date.now() + timeoutMs;

  while (
    Date.now() < deadline
  ) {
    const state =
      await walletState(
        wallet,
      );

    const balances =
      state.shielded
        .balances as Record<
          string,
          bigint
        >;

    for (
      const [
        color,
        balance,
      ]
      of Object.entries(
        balances,
      )
    ) {
      const previous =
        before[color] ??
        0n;

      if (
        balance -
          previous ===
        expectedIncrease
      ) {
        return {
          color,
          before:
            previous,
          after:
            balance,
        };
      }
    }

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          2_000,
        ),
    );
  }

  throw new Error(
    `Timed out waiting for shielded increase of ${expectedIncrease}`,
  );
}

async function main(): Promise<void> {
  const mnemonic =
    process.env[
      'MIDNIGHT_MNEMONIC_PREVIEW'
    ];

  if (!mnemonic) {
    throw new Error(
      'MIDNIGHT_MNEMONIC_PREVIEW is required.',
    );
  }

  const dryRun =
    process.env[
      'BALARY_PREVIEW_DRY_RUN'
    ] === '1';

  const config =
    getPreviewConfig();

  setNetworkId(
    config.networkId,
  );

  const env:
    EnvironmentConfiguration = {
      walletNetworkId:
        config.networkId,

      networkId:
        config.networkId,

      indexer:
        config.indexer,

      indexerWS:
        config.indexerWS,

      node:
        config.node,

      nodeWS:
        config.nodeWS,

      faucet:
        config.faucet,

      proofServer:
        config.proofServer,
    };

  const wallet =
    await buildPreviewWallet(
      mnemonic,
    );

  try {
    console.log(
      '\nConnecting to Midnight Preview...',
    );

    const initialState =
      await walletState(
        wallet,
      );

    const previewAddress =
      UnshieldedAddress.codec
        .encode(
          config.networkId,
          initialState
            .unshielded
            .address,
        )
        .asString();

    const usdmBefore =
      initialState
        .unshielded
        .balances[
          PREVIEW_USDM_COLOR_HEX
        ] ?? 0n;

    let dust = 0n;

    try {
      dust =
        initialState.dust
          .balance(
            new Date(),
          );
    } catch {
      dust = 0n;
    }

    console.log(
      '\n====================================',
    );

    console.log(
      'BALARY PREVIEW PREFLIGHT',
    );

    console.log(
      '====================================',
    );

    console.log(
      `Network:            ${config.networkId}`,
    );

    console.log(
      `Wallet address:     ${previewAddress}`,
    );

    console.log(
      `USDM token color:   ${PREVIEW_USDM_COLOR_HEX}`,
    );

    console.log(
      `USDM raw balance:   ${usdmBefore}`,
    );

    console.log(
      `USDM balance:       ${formatUSDM(usdmBefore)} USDM`,
    );

    console.log(
      `DUST capacity:      ${dust}`,
    );

    assert(
      usdmBefore >=
        DEPOSIT_RAW,
      `Preview wallet needs at least ${DEPOSIT_USDM} USDM`,
    );

    if (dryRun) {
      console.log(
        '\nDRY RUN: PASS',
      );

      console.log(
        'No contract deployed.',
      );

      console.log(
        'No USDM moved.',
      );

      return;
    }

    if (dust <= 0n) {
      throw new Error(
        'Preview wallet has no spendable DUST capacity.',
      );
    }

    const usdmColor =
      fromHex(
        PREVIEW_USDM_COLOR_HEX,
      );

    const gatewayProviders =
      buildProviders(
        wallet,
        gatewayZkConfigPath,
        `balary-preview-gateway-${Date.now()}`,
        config,
      );

    console.log(
      '\nDeploying Balary Stablecoin Gateway on Preview...',
    );

    const deployment =
      await deployContract(
        gatewayProviders,
        {
          compiledContract:
            CompiledGateway,

          privateStateId:
            'balary-gateway',

          initialPrivateState:
            {},

          args: [
            usdmColor,
          ],
        },
      );

    const gatewayAddress =
      deployment
        .deployTxData
        .public
        .contractAddress;

    console.log(
      `Gateway deployed:   ${gatewayAddress}`,
    );

    const deployedLedger:
      any =
      await readLedger(
        gatewayProviders,
        gatewayAddress,
        gatewayLedger,
      );

    assert.equal(
      toHex(
        deployedLedger
          .usdmColor,
      ),
      PREVIEW_USDM_COLOR_HEX,
      'Gateway was deployed with the wrong USDM color',
    );

    assert.equal(
      deployedLedger
        .totalLocked,
      0n,
    );

    assert.equal(
      deployedLedger
        .totalOutstanding,
      0n,
    );

    const beforeDeposit =
      await walletState(
        wallet,
      );

    const beforeShielded = {
      ...(
        beforeDeposit
          .shielded
          .balances as Record<
            string,
            bigint
          >
      ),
    };

    console.log(
      `\nDepositing ${DEPOSIT_USDM} real Preview USDM...`,
    );

    const depositTx =
      await submitCallTx(
        gatewayProviders,
        {
          compiledContract:
            CompiledGateway,

          contractAddress:
            gatewayAddress,

          privateStateId:
            'balary-gateway',

          circuitId:
            'depositUSDM',

          args: [
            DEPOSIT_RAW,
            randomBytes(32),
          ],
        },
      );

    const expectedUSDM =
      usdmBefore -
      DEPOSIT_RAW;

    await waitForExactUnshieldedBalance(
      wallet,
      PREVIEW_USDM_COLOR_HEX,
      expectedUSDM,
    );

    const zUSDM =
      await waitForShieldedIncrease(
        wallet,
        beforeShielded,
        DEPOSIT_RAW,
      );

    const afterLedger:
      any =
      await readLedger(
        gatewayProviders,
        gatewayAddress,
        gatewayLedger,
      );

    assert.equal(
      afterLedger
        .totalLocked,
      DEPOSIT_RAW,
      'Gateway locked amount mismatch',
    );

    assert.equal(
      afterLedger
        .totalOutstanding,
      DEPOSIT_RAW,
      'Gateway outstanding amount mismatch',
    );

    assert.equal(
      afterLedger
        .totalLocked,
      afterLedger
        .totalOutstanding,
      'Gateway 1:1 invariant broken',
    );

    mkdirSync(
      '.cache',
      {
        recursive:
          true,
      },
    );

    const result = {
      network:
        'preview',

      gatewayAddress,

      usdmColor:
        PREVIEW_USDM_COLOR_HEX,

      zUSDMColor:
        zUSDM.color,

      depositUSDM:
        DEPOSIT_USDM
          .toString(),

      depositRaw:
        DEPOSIT_RAW
          .toString(),

      walletUSDMBefore:
        usdmBefore
          .toString(),

      walletUSDMAfter:
        expectedUSDM
          .toString(),

      depositTxHash:
        depositTx
          .public
          .txHash,
    };

    writeFileSync(
      '.cache/preview-gateway.json',
      JSON.stringify(
        result,
        null,
        2,
      ) + '\n',
    );

    console.log(
      '\n====================================',
    );

    console.log(
      'BALARY PREVIEW GATEWAY: SUCCESS',
    );

    console.log(
      '====================================',
    );

    console.log(
      `Gateway:             ${gatewayAddress}`,
    );

    console.log(
      `Real USDM deposited: ${DEPOSIT_USDM} USDM`,
    );

    console.log(
      `USDM raw deposited:  ${DEPOSIT_RAW}`,
    );

    console.log(
      `USDM before:         ${formatUSDM(usdmBefore)} USDM`,
    );

    console.log(
      `USDM after:          ${formatUSDM(expectedUSDM)} USDM`,
    );

    console.log(
      `zUSDM color:         ${zUSDM.color}`,
    );

    console.log(
      `zUSDM received:      ${formatUSDM(DEPOSIT_RAW)} zUSDM`,
    );

    console.log(
      `Gateway locked:      ${afterLedger.totalLocked}`,
    );

    console.log(
      `Outstanding zUSDM:   ${afterLedger.totalOutstanding}`,
    );

    console.log(
      `Deposit tx:          ${depositTx.public.txHash}`,
    );

    console.log(
      '\nSaved deployment data to:',
    );

    console.log(
      '.cache/preview-gateway.json',
    );
  } finally {
    await wallet.stop();
  }
}

main().catch(
  (error) => {
    console.error(
      '\nBALARY PREVIEW GATEWAY FAILED',
    );

    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);
