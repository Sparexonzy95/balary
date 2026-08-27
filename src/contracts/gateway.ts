import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import path from 'node:path';

export {
  Contract,
  ledger,
  type Ledger,
} from '../../generated/gateway/contract/index.js';

import { Contract } from '../../generated/gateway/contract/index.js';

const projectRoot = path.resolve(
  new URL(import.meta.url).pathname,
  '../../..',
);

export const gatewayZkConfigPath = path.resolve(
  projectRoot,
  'generated',
  'gateway',
);

export const CompiledGateway = CompiledContract.make(
  'BalaryStablecoinGateway',
  Contract,
).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(gatewayZkConfigPath),
);
