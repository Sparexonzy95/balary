import { randomBytes } from 'node:crypto';
import { strict as assert } from 'node:assert';
import { WebSocket } from 'ws';
import { firstValueFrom } from 'rxjs';
import pino from 'pino';

import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import {
  deployContract,
  submitCallTx,
} from '@midnight-ntwrk/midnight-js-contracts';

import {
  toHex,
  fromHex,
} from '@midnight-ntwrk/midnight-js-utils';

import {
  MidnightWalletProvider,
  type EnvironmentConfiguration,
} from '@midnight-ntwrk/testkit-js';

import { getLocalConfig } from '../config.js';
import { buildProviders } from '../providers.js';

import {
  CompiledMockUSDM,
  ledger as mockLedger,
  mockUSDMZkConfigPath,
} from '../contracts/mock-usdm.js';

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

const GENESIS_SEED =
  '0000000000000000000000000000000000000000000000000000000000000001';

const MOCK_SUPPLY = 10_000n;
const EMPLOYER_FUNDS = 1_000n;
const DEPOSIT = 250n;

function toUserAddressBytes(unshielded: any): Uint8Array {
  const pk =
    unshielded?.state?.publicKey ??
    unshielded?.publicKey;

  if (pk?.address instanceof Uint8Array) {
    return pk.address;
  }

  if (typeof pk?.addressHex === 'string') {
    return fromHex(pk.addressHex);
  }

  const addr = unshielded?.address;

  if (addr?.bytes instanceof Uint8Array) {
    return addr.bytes;
  }

  if (addr?.data instanceof Uint8Array) {
    return addr.data;
  }

  if (typeof addr?.addressHex === 'string') {
    return fromHex(addr.addressHex);
  }

  throw new Error(
    'Could not find raw unshielded address bytes in wallet state.',
  );
}

async function walletState(
  wallet: MidnightWalletProvider,
): Promise<any> {
  return firstValueFrom(wallet.wallet.state());
}

async function waitForExactUnshieldedBalance(
  wallet: MidnightWalletProvider,
  colorHex: string,
  expected: bigint,
  timeoutMs = 180_000,
): Promise<any> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const state = await walletState(wallet);
    const balance =
      state.unshielded.balances[colorHex] ?? 0n;

    if (balance === expected) {
      return state;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 1_000),
    );
  }

  throw new Error(
    `Timed out waiting for exact unshielded balance ${expected} of ${colorHex}`,
  );
}

async function waitForShieldedIncrease(
  wallet: MidnightWalletProvider,
  before: Record<string, bigint>,
  expectedIncrease: bigint,
  timeoutMs = 180_000,
): Promise<{
  color: string;
  balance: bigint;
}> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const state = await walletState(wallet);

    const balances =
      state.shielded.balances as Record<string, bigint>;

    for (const [color, balance] of Object.entries(balances)) {
      const previous = before[color] ?? 0n;

      if (balance - previous >= expectedIncrease) {
        return {
          color,
          balance,
        };
      }
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 1_000),
    );
  }

  throw new Error(
    `Timed out waiting for shielded increase of ${expectedIncrease}`,
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

async function main(): Promise<void> {
  const config = getLocalConfig();

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

  const seed =
    process.env['MIDNIGHT_SEED'] ??
    GENESIS_SEED;

  const wallet =
    await MidnightWalletProvider.build(
      logger,
      env,
      seed,
    );

  try {
    logger.info('Starting Balary employer wallet');

    await wallet.start();

    const initialState =
      await walletState(wallet);

    logger.info(
      'Employer wallet connected to local Midnight network',
    );

    /*
     * ------------------------------------------------
     * MOCK USDM
     * ------------------------------------------------
     */

    const mockProviders = buildProviders(
      wallet,
      mockUSDMZkConfigPath,
      `balary-mock-usdm-${Date.now()}`,
      config,
    );

    const ownerSecret =
      randomBytes(32);

    logger.info(
      'Deploying development-only MockUSDM',
    );

    const mockDeployment =
      await deployContract(
        mockProviders,
        {
          compiledContract:
            CompiledMockUSDM,

          privateStateId:
            'balary-mock-usdm',

          initialPrivateState: {},

          args: [
            ownerSecret,
          ],
        },
      );

    const mockAddress =
      mockDeployment
        .deployTxData
        .public
        .contractAddress;

    logger.info(
      {
        contractAddress:
          mockAddress,
      },
      'MockUSDM deployed',
    );

    logger.info(
      {
        amount:
          MOCK_SUPPLY.toString(),
      },
      'Minting MockUSDM supply',
    );

    await submitCallTx(
      mockProviders,
      {
        compiledContract:
          CompiledMockUSDM,

        contractAddress:
          mockAddress,

        privateStateId:
          'balary-mock-usdm',

        circuitId:
          'mint',

        args: [
          ownerSecret,
          MOCK_SUPPLY,
        ],
      },
    );

    const mockAfterMint: any =
      await readLedger(
        mockProviders,
        mockAddress,
        mockLedger,
      );

    assert.equal(
      mockAfterMint.initialized,
      true,
    );

    const usdmColor =
      mockAfterMint.tokenColor;

    const usdmColorHex =
      toHex(usdmColor);

    logger.info(
      {
        tokenColor:
          usdmColorHex,
      },
      'MockUSDM token created',
    );

    const recipient = {
      bytes:
        toUserAddressBytes(
          initialState.unshielded,
        ),
    };

    logger.info(
      {
        amount:
          EMPLOYER_FUNDS.toString(),
      },
      'Sending MockUSDM to employer',
    );

    await submitCallTx(
      mockProviders,
      {
        compiledContract:
          CompiledMockUSDM,

        contractAddress:
          mockAddress,

        privateStateId:
          'balary-mock-usdm',

        circuitId:
          'transfer',

        args: [
          ownerSecret,
          recipient,
          EMPLOYER_FUNDS,
        ],
      },
    );

    await waitForExactUnshieldedBalance(
      wallet,
      usdmColorHex,
      EMPLOYER_FUNDS,
    );

    logger.info(
      'Employer received public MockUSDM',
    );

    /*
     * ------------------------------------------------
     * BALARY STABLECOIN GATEWAY
     * ------------------------------------------------
     */

    const gatewayProviders =
      buildProviders(
        wallet,
        gatewayZkConfigPath,
        `balary-gateway-${Date.now()}`,
        config,
      );

    logger.info(
      'Deploying Balary Stablecoin Gateway',
    );

    const gatewayDeployment =
      await deployContract(
        gatewayProviders,
        {
          compiledContract:
            CompiledGateway,

          privateStateId:
            'balary-gateway',

          initialPrivateState: {},

          args: [
            usdmColor,
          ],
        },
      );

    const gatewayAddress =
      gatewayDeployment
        .deployTxData
        .public
        .contractAddress;

    logger.info(
      {
        contractAddress:
          gatewayAddress,
      },
      'Balary Gateway deployed',
    );

    const beforeDeposit =
      await walletState(wallet);

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

    logger.info(
      {
        amount:
          DEPOSIT.toString(),
      },
      'Depositing MockUSDM into Gateway',
    );

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
          DEPOSIT,
          randomBytes(32),
        ],
      },
    );

    const gatewayAfterDeposit: any =
      await readLedger(
        gatewayProviders,
        gatewayAddress,
        gatewayLedger,
      );

    assert.equal(
      gatewayAfterDeposit.totalLocked,
      DEPOSIT,
      'Gateway totalLocked mismatch',
    );

    assert.equal(
      gatewayAfterDeposit.totalOutstanding,
      DEPOSIT,
      'Gateway totalOutstanding mismatch',
    );

    assert.equal(
      gatewayAfterDeposit.totalLocked,
      gatewayAfterDeposit.totalOutstanding,
      '1:1 reserve invariant failed',
    );

    const expectedPublicBalance =
      EMPLOYER_FUNDS -
      DEPOSIT;

    const afterPublic =
      await waitForExactUnshieldedBalance(
        wallet,
        usdmColorHex,
        expectedPublicBalance,
      );

    const publicBalance =
      afterPublic
        .unshielded
        .balances[usdmColorHex] ??
      0n;

    const shielded =
      await waitForShieldedIncrease(
        wallet,
        beforeShielded,
        DEPOSIT,
      );

    logger.info(
      {
        gateway:
          gatewayAddress,

        mockUSDMColor:
          usdmColorHex,

        zUSDMColor:
          shielded.color,

        lockedUSDM:
          gatewayAfterDeposit
            .totalLocked
            .toString(),

        outstandingZUSDM:
          gatewayAfterDeposit
            .totalOutstanding
            .toString(),

        employerPublicUSDM:
          publicBalance
            .toString(),

        employerShieldedZUSDM:
          shielded.balance
            .toString(),
      },
      'Balary local Gateway flow succeeded',
    );

    console.log(
      '\n====================================',
    );

    console.log(
      'BALARY LOCAL GATEWAY FLOW: SUCCESS',
    );

    console.log(
      '====================================',
    );

    console.log(
      `MockUSDM funded:           ${EMPLOYER_FUNDS}`,
    );

    console.log(
      `MockUSDM deposited:        ${DEPOSIT}`,
    );

    console.log(
      `Gateway totalLocked:       ${gatewayAfterDeposit.totalLocked}`,
    );

    console.log(
      `Gateway outstanding zUSDM: ${gatewayAfterDeposit.totalOutstanding}`,
    );

    console.log(
      `Employer MockUSDM left:    ${publicBalance}`,
    );

    console.log(
      `Employer shielded zUSDM:   ${shielded.balance}`,
    );

    console.log(
      `zUSDM color:               ${shielded.color}`,
    );
  } finally {
    await wallet.stop();
  }
}

main().catch((error) => {
  logger.error(
    error,
    'Balary local Gateway flow failed',
  );

  process.exitCode = 1;
});
