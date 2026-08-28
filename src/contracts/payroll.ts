import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import path from 'node:path';

export {
  Contract,
  ledger,
  pureCircuits,
  PayrollState,
  type Ledger,
} from '../../generated/payroll/contract/index.js';

import { Contract } from '../../generated/payroll/contract/index.js';

const projectRoot = path.resolve(
  new URL(import.meta.url).pathname,
  '../../..',
);

export const payrollZkConfigPath = path.resolve(
  projectRoot,
  'generated',
  'payroll',
);

export const CompiledPayroll = CompiledContract.make(
  'BalaryPayrollVault',
  Contract,
).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(payrollZkConfigPath),
);
