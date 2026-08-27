import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import path from 'node:path';

export {
  Contract,
  ledger,
  type Ledger,
} from '../../generated/mock-usdm/contract/index.js';

import { Contract } from '../../generated/mock-usdm/contract/index.js';

const projectRoot = path.resolve(
  new URL(import.meta.url).pathname,
  '../../..',
);

export const mockUSDMZkConfigPath = path.resolve(
  projectRoot,
  'generated',
  'mock-usdm',
);

export const CompiledMockUSDM = CompiledContract.make(
  'MockUSDM',
  Contract,
).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(mockUSDMZkConfigPath),
);
