import { randomBytes } from 'node:crypto';
import { strict as assert } from 'node:assert';
import { WebSocket } from 'ws';
import { readFileSync } from 'node:fs';
import { firstValueFrom } from 'rxjs';
import pino from 'pino';

import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';

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
  CompiledGateway,
  gatewayZkConfigPath,
  ledger as gatewayLedger,
} from '../contracts/gateway.js';

(globalThis as any).WebSocket = WebSocket;

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
  },
});



const REDEEM_AMOUNT = 5_000_000n;

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

function toUserAddressBytes(
  unshielded: any,
): Uint8Array {
  const pk =
    unshielded?.state?.publicKey ??
    unshielded?.publicKey;

  if (
    pk?.address instanceof
    Uint8Array
  ) {
    return pk.address;
  }

  if (
    typeof pk?.addressHex ===
    'string'
  ) {
    return fromHex(
      pk.addressHex,
    );
  }

  const addr =
    unshielded?.address;

  if (
    addr?.bytes instanceof
    Uint8Array
  ) {
    return addr.bytes;
  }

  if (
    addr?.data instanceof
    Uint8Array
  ) {
    return addr.data;
  }

  if (
    typeof addr?.addressHex ===
    'string'
  ) {
    return fromHex(
      addr.addressHex,
    );
  }

  throw new Error(
    'Could not find raw employee unshielded address bytes.',
  );
}

async function waitForBalances(
  wallet: PreviewWallet,
  zUSDMColor: string,
  usdmColor: string,
  expectedShielded: bigint,
  expectedPublic: bigint,
  timeoutMs = 180_000,
): Promise<{
  shielded: bigint;
  publicUSDM: bigint;
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

    const shielded =
      state.shielded.balances[
        zUSDMColor
      ] ?? 0n;

    const publicUSDM =
      state.unshielded.balances[
        usdmColor
      ] ?? 0n;

    if (
      shielded ===
        expectedShielded &&
      publicUSDM ===
        expectedPublic
    ) {
      return {
        shielded,
        publicUSDM,
      };
    }

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          1_000,
        ),
    );
  }

  throw new Error(
    `Timed out waiting for redemption balances. Expected zUSDM=${expectedShielded}, public USDM=${expectedPublic}`,
  );
}

async function main(): Promise<void> {
  const deploymentData =
    JSON.parse(
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

  const config =
    getPreviewConfig();

  setNetworkId(
    config.networkId,
  );

  const mnemonic =
    process.env['MIDNIGHT_MNEMONIC_PREVIEW'] ??
    process.env['MIDNIGHT_MNEMONIC'];

  if (!mnemonic) {
    throw new Error(
      'MIDNIGHT_MNEMONIC_PREVIEW is required.',
    );
  }

  process.env['WALLET_STATE_FILE'] =
    `${process.cwd()}/wallet-state.json`;

  const wallet =
    await buildPreviewWallet(
      mnemonic,
    );

  try {
    logger.info(
      'Using Balary native Preview wallet for redemption',
    );

    const beforeWallet =
      await walletState(
        wallet,
      );

    const employeeZUSDMBefore =
      beforeWallet
        .shielded
        .balances[
          zUSDMColorHex
        ] ?? 0n;

    assert(
      employeeZUSDMBefore >=
        REDEEM_AMOUNT,
      `Employee requires at least ${REDEEM_AMOUNT} zUSDM`,
    );

    const providers =
      buildProviders(
        wallet,
        gatewayZkConfigPath,
        'balary-gateway-private-state',
        config,
      );

    /*
     * Gateway has no application private state,
     * but Midnight.js still expects a scoped
     * private-state record when submitting a call.
     */
    providers.privateStateProvider
      .setContractAddress(
        gatewayAddress,
      );

    const privateStateId =
      'balary-gateway';

    const existingPrivateState =
      await providers
        .privateStateProvider
        .get(
          privateStateId,
        );

    if (
      existingPrivateState ===
      null
    ) {
      await providers
        .privateStateProvider
        .set(
          privateStateId,
          {},
        );

      logger.info(
        'Initialized empty Gateway private state',
      );
    }

    const beforeGateway: any =
      await readLedger(
        providers,
        gatewayAddress,
        gatewayLedger,
      );

    const usdmColorHex =
      toHex(
        beforeGateway.usdmColor,
      );

    const publicUSDMBefore =
      beforeWallet
        .unshielded
        .balances[
          usdmColorHex
        ] ?? 0n;

    logger.info(
      {
        gateway:
          gatewayAddress,

        zUSDM:
          employeeZUSDMBefore
            .toString(),

        publicUSDM:
          publicUSDMBefore
            .toString(),

        totalLocked:
          beforeGateway
            .totalLocked
            .toString(),

        totalOutstanding:
          beforeGateway
            .totalOutstanding
            .toString(),
      },
      'Redemption starting state',
    );

    assert.equal(
      beforeGateway
        .totalLocked,
      beforeGateway
        .totalOutstanding,
      'Gateway 1:1 invariant broken before redemption',
    );

    assert(
      beforeGateway
        .totalOutstanding >=
        REDEEM_AMOUNT,
      'Gateway outstanding zUSDM is below redemption amount',
    );

    const redemptionCoin = {
      nonce:
        randomBytes(32),

      color:
        fromHex(
          zUSDMColorHex,
        ),

      value:
        REDEEM_AMOUNT,
    };

    const recipient = {
      bytes:
        toUserAddressBytes(
          beforeWallet
            .unshielded,
        ),
    };

    logger.info(
      {
        amount:
          REDEEM_AMOUNT
            .toString(),
      },
      'Submitting zUSDM redemption',
    );

    const redemptionTx =
      await submitCallTx(
        providers,
        {
          compiledContract:
            CompiledGateway,

          contractAddress:
            gatewayAddress,

          privateStateId,

          circuitId:
            'redeemZUSDM',

          args: [
            redemptionCoin,
            recipient,
          ],
        },
      );

    const afterGateway: any =
      await readLedger(
        providers,
        gatewayAddress,
        gatewayLedger,
      );

    const expectedLocked =
      beforeGateway
        .totalLocked -
      REDEEM_AMOUNT;

    const expectedOutstanding =
      beforeGateway
        .totalOutstanding -
      REDEEM_AMOUNT;

    assert.equal(
      afterGateway
        .totalLocked,
      expectedLocked,
      'Gateway locked USDM did not decrease by redemption amount',
    );

    assert.equal(
      afterGateway
        .totalOutstanding,
      expectedOutstanding,
      'Gateway outstanding zUSDM did not decrease by redemption amount',
    );

    assert.equal(
      afterGateway
        .totalLocked,
      afterGateway
        .totalOutstanding,
      'Gateway 1:1 invariant broken after redemption',
    );

    const expectedShielded =
      employeeZUSDMBefore -
      REDEEM_AMOUNT;

    const expectedPublic =
      publicUSDMBefore +
      REDEEM_AMOUNT;

    const balances =
      await waitForBalances(
        wallet,
        zUSDMColorHex,
        usdmColorHex,
        expectedShielded,
        expectedPublic,
      );

    console.log(
      '\n====================================',
    );

    console.log(
      'BALARY ZUSDM REDEMPTION: SUCCESS',
    );

    console.log(
      '====================================',
    );

    console.log(
      `Gateway:                    ${gatewayAddress}`,
    );

    console.log(
      `Redeemed zUSDM:             ${REDEEM_AMOUNT}`,
    );

    console.log(
      `Employee zUSDM before:      ${employeeZUSDMBefore}`,
    );

    console.log(
      `Employee zUSDM after:       ${balances.shielded}`,
    );

    console.log(
      `Employee public USDM before:${publicUSDMBefore}`,
    );

    console.log(
      `Employee public USDM after: ${balances.publicUSDM}`,
    );

    console.log(
      `Gateway locked before:      ${beforeGateway.totalLocked}`,
    );

    console.log(
      `Gateway locked after:       ${afterGateway.totalLocked}`,
    );

    console.log(
      `Outstanding before:         ${beforeGateway.totalOutstanding}`,
    );

    console.log(
      `Outstanding after:          ${afterGateway.totalOutstanding}`,
    );

    console.log(
      `Redemption transaction:     ${redemptionTx.public.txHash}`,
    );
  } finally {
    await wallet.stop();
  }
}

main().catch(
  (error) => {
    logger.error(
      error,
      'Balary Preview zUSDM redemption failed',
    );

    process.exitCode = 1;
  },
);
