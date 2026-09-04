import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import type { MidnightProvider, MidnightProviders, WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import type { NetworkConfig } from './config.js';

const LOCAL_PRIVATE_STATE_PASSWORD =
  'Balary-Local-Development-Only-2026!';

export function buildProviders(
  wallet: MidnightProvider & WalletProvider,
  zkConfigPath: string,
  storeName: string,
  config: NetworkConfig,
): MidnightProviders<any> {
  const zkConfigProvider =
    new NodeZkConfigProvider<any>(
      zkConfigPath,
    );

  const privateStatePassword =
    config.networkId === 'undeployed'
      ? LOCAL_PRIVATE_STATE_PASSWORD
      : process.env[
          'BALARY_PRIVATE_STATE_PASSWORD'
        ];

  if (!privateStatePassword) {
    throw new Error(
      'BALARY_PRIVATE_STATE_PASSWORD is required outside the local development network.',
    );
  }

  return {
    privateStateProvider:
      levelPrivateStateProvider({
        privateStateStoreName:
          storeName,

        privateStoragePasswordProvider:
          () =>
            privateStatePassword,

        accountId:
          wallet.getCoinPublicKey(),
      }),

    publicDataProvider:
      indexerPublicDataProvider(
        config.indexer,
        config.indexerWS,
      ),

    zkConfigProvider,

    proofProvider:
      httpClientProofProvider(
        config.proofServer,
        zkConfigProvider,
      ),

    walletProvider:
      wallet,

    midnightProvider:
      wallet,
  };
}
