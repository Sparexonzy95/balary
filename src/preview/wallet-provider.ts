import type {
  MidnightProvider,
  WalletProvider,
} from '@midnight-ntwrk/midnight-js-types';

export type PreviewWallet =
  MidnightProvider &
  WalletProvider & {
    wallet: any;
    stop(): Promise<void>;
  };

export async function buildPreviewWallet(
  mnemonic: string,
): Promise<PreviewWallet> {
  process.env.NETWORK = 'testnet';
  process.env.MIDNIGHT_MNEMONIC = mnemonic;
  process.env.WALLET_STATE_FILE =
    `${process.cwd()}/wallet-state.json`;

  const moduleUrl = new URL(
    '../../node_modules/@via-labs-tech/usdm-bridge/dist/midnight/wallet.js',
    import.meta.url,
  ).href;

  const via: any =
    await import(moduleUrl);

  const context =
    await via.initWalletWithSeed(
      via.getSeed(),
    );

  const provider =
    await via.createWalletAndMidnightProvider(
      context,
    );

  return Object.assign(
    provider,
    {
      wallet: context.wallet,
      stop: () =>
        context.wallet.stop(),
    },
  ) as PreviewWallet;
}
