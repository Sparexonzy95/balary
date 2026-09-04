import { Buffer } from 'node:buffer';
import {
  readFileSync,
  writeFileSync,
} from 'node:fs';

import { mnemonicToSeedSync } from '@scure/bip39';

import * as ledger from '@midnight-ntwrk/ledger-v8';

import {
  DustWallet,
} from '@midnight-ntwrk/wallet-sdk-dust-wallet';

import {
  WalletFacade,
} from '@midnight-ntwrk/wallet-sdk-facade';

import {
  HDWallet,
  Roles,
  validateMnemonic,
} from '@midnight-ntwrk/wallet-sdk-hd';

import {
  ShieldedWallet,
} from '@midnight-ntwrk/wallet-sdk-shielded';

import {
  createKeystore,
  PublicKey as UnshieldedPublicKey,
  UnshieldedWallet,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';

import {
  InMemoryTransactionHistoryStorage,
} from '@midnight-ntwrk/wallet-sdk-abstractions';

import {
  WalletEntrySchema,
} from '@midnight-ntwrk/wallet-sdk';

import {
  setNetworkId,
} from '@midnight-ntwrk/midnight-js-network-id';

import type {
  MidnightProvider,
  UnboundTransaction,
  WalletProvider,
} from '@midnight-ntwrk/midnight-js-types';

import {
  getPreviewConfig,
} from '../config.js';

export type PreviewWallet =
  MidnightProvider &
  WalletProvider & {
    wallet: WalletFacade;
    stop(): Promise<void>;
  };

type CachedWalletState = {
  shielded: unknown;
  unshielded: unknown;
  dust: unknown;
};

function loadCache(
  path: string,
): CachedWalletState {
  let parsed: any;

  try {
    parsed = JSON.parse(
      readFileSync(
        path,
        'utf8',
      ),
    );
  } catch (error) {
    throw new Error(
      `Unable to load Preview wallet cache ${path}: ${String(error)}`,
    );
  }

  if (
    !parsed?.shielded ||
    !parsed?.unshielded ||
    !parsed?.dust
  ) {
    throw new Error(
      `Preview wallet cache ${path} is incomplete`,
    );
  }

  return parsed;
}

export async function buildPreviewWallet(
  mnemonic: string,
): Promise<PreviewWallet> {
  if (!validateMnemonic(mnemonic)) {
    throw new Error(
      'Invalid Midnight Preview mnemonic',
    );
  }

  const config =
    getPreviewConfig();

  setNetworkId(
    config.networkId,
  );

  const cachePath =
    process.env['WALLET_STATE_FILE'] ??
    `${process.cwd()}/wallet-state.json`;

  const savedState =
    loadCache(
      cachePath,
    );

  const hdWallet =
    HDWallet.fromSeed(
      Buffer.from(
        mnemonicToSeedSync(
          mnemonic,
        ),
      ),
    );

  if (
    hdWallet.type !==
    'seedOk'
  ) {
    throw new Error(
      'Failed to initialize Preview HD wallet',
    );
  }

  const account =
    hdWallet.hdWallet
      .selectAccount(0);

  const derivedShielded =
    account
      .selectRole(
        Roles.Zswap,
      )
      .deriveKeyAt(0);

  const derivedUnshielded =
    account
      .selectRole(
        Roles.NightExternal,
      )
      .deriveKeyAt(0);

  const derivedDust =
    account
      .selectRole(
        Roles.Dust,
      )
      .deriveKeyAt(0);

  if (
    derivedShielded.type ===
      'keyOutOfBounds' ||
    derivedUnshielded.type ===
      'keyOutOfBounds' ||
    derivedDust.type ===
      'keyOutOfBounds'
  ) {
    throw new Error(
      'Preview wallet key derivation failed',
    );
  }

  const shieldedSecretKeys =
    ledger.ZswapSecretKeys
      .fromSeed(
        derivedShielded.key,
      );

  const dustSecretKey =
    ledger.DustSecretKey
      .fromSeed(
        derivedDust.key,
      );

  const unshieldedKeystore =
    createKeystore(
      derivedUnshielded.key,
      config.networkId,
    );

  const unshieldedPublicKey =
    UnshieldedPublicKey
      .fromKeyStore(
        unshieldedKeystore,
      );

  const configuration = {
    networkId:
      config.networkId,

    costParameters: {
      additionalFeeOverhead:
        300_000_000_000_000n,
      feeBlocksMargin: 5,
    },

    relayURL:
      new URL(
        config.nodeWS,
      ),

    provingServerUrl:
      new URL(
        config.proofServer,
      ),

    indexerClientConnection: {
      indexerHttpUrl:
        config.indexer,
      indexerWsUrl:
        config.indexerWS,
    },

    txHistoryStorage:
      new InMemoryTransactionHistoryStorage(
      WalletEntrySchema,
    ),
  };

  console.log(
    'Restoring Preview wallet with Balary native wallet SDK...',
  );

  const wallet =
    await WalletFacade.init({
      configuration,

      shielded: (cfg) =>
        ShieldedWallet(cfg)
          .restore(
            savedState.shielded as any,
          ),

      unshielded: (cfg) =>
        UnshieldedWallet(cfg)
          .restore(
            savedState.unshielded as any,
          ),

      dust: (cfg) =>
        DustWallet(cfg)
          .restore(
            savedState.dust as any,
          ),
    });

  await wallet.start(
    shieldedSecretKeys,
    dustSecretKey,
  );

  const synced =
    await Promise.race([
      wallet.waitForSyncedState(),

      new Promise<never>(
        (_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  'Native Preview wallet cache restore timed out after 120 seconds',
                ),
              ),
            120_000,
          ),
      ),
    ]);

  console.log(
    'Balary native Preview wallet: SYNCED',
  );

  async function saveState(): Promise<void> {
    const [
      shielded,
      unshielded,
      dust,
    ] =
      await Promise.all([
        wallet.shielded
          .serializeState(),

        wallet.unshielded
          .serializeState(),

        wallet.dust
          .serializeState(),
      ]);

    writeFileSync(
      cachePath,
      JSON.stringify(
        {
          shielded,
          unshielded,
          dust,
        },
        null,
        2,
      ),
    );
  }

  const provider = {
    wallet,

    getCoinPublicKey(): string {
      return shieldedSecretKeys
        .coinPublicKey;
    },

    getEncryptionPublicKey(): string {
      return shieldedSecretKeys
        .encryptionPublicKey;
    },

    async balanceTx(
      tx: UnboundTransaction,
      ttl?: Date,
    ) {
      const recipe =
        await wallet
          .balanceUnboundTransaction(
            tx,
            {
              shieldedSecretKeys,
              dustSecretKey,
            },
            {
              ttl:
                ttl ??
                new Date(
                  Date.now() +
                    30 *
                      60 *
                      1000,
                ),
            },
          );

      const signedRecipe =
        await wallet.signRecipe(
          recipe,
          (payload) =>
            unshieldedKeystore
              .signData(
                payload,
              ),
        );

      return wallet
        .finalizeRecipe(
          signedRecipe,
        );
    },

    submitTx(tx: any) {
      return wallet
        .submitTransaction(
          tx,
        );
    },

    async stop(): Promise<void> {
      await saveState();
      await wallet.stop();
    },
  };

  // Sanity check that the restored wallet actually
  // produced a synced state before returning it.
  if (!synced) {
    throw new Error(
      'Preview wallet did not produce synced state',
    );
  }

  return provider;
}
