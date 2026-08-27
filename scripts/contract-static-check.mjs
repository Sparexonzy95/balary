import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, 'contracts', name), 'utf8');
const mock = read('MockUSDM.compact');
const gateway = read('BalaryStablecoinGateway.compact');
const payroll = read('BalaryPayrollVault.compact');

const checks = [
  ['MockUSDM is explicitly development-only', mock.includes('Development-only public stablecoin')],
  ['MockUSDM mints an unshielded token', mock.includes('mintUnshieldedToken(')],
  ['MockUSDM transfers to UserAddress', mock.includes('sendUnshielded(')],
  ['MockUSDM authorization is secret-derived', mock.includes('deriveOwnerAuthority(') && !mock.includes('ownPublicKey()')],

  ['Gateway pins Compact language 0.23', gateway.includes('pragma language_version 0.23;')],
  ['Gateway receives unshielded USDM', gateway.includes('receiveUnshielded(')],
  ['Gateway mints shielded zUSDM', gateway.includes('mintShieldedToken(')],
  ['Gateway sends fresh shielded zUSDM', gateway.includes('sendImmediateShielded(')],
  ['Gateway burns zUSDM', gateway.includes('shieldedBurnAddress()')],
  ['Gateway releases USDM', gateway.includes('sendUnshielded(')],
  ['Gateway enforces 1:1 accounting equality', gateway.includes('totalLocked == totalOutstanding')],

  ['Payroll uses Institution Admin authority', payroll.includes('deriveAdminAuthority(') && payroll.includes('assertAdmin(')],
  ['Payroll uses HR authority', payroll.includes('deriveHrAuthority(') && payroll.includes('assertHr(')],
  ['Payroll uses Finance authority', payroll.includes('deriveFinanceAuthority(') && payroll.includes('assertFinance(')],
  ['Admin can rotate HR authority', payroll.includes('rotateHrAuthority(')],
  ['Admin can rotate Finance authority', payroll.includes('rotateFinanceAuthority(')],
  ['HR approves salary intent before funding', payroll.includes('approveAllocation(') && payroll.includes('approvedIntents')],
  ['Finance funds only HR-approved intent', payroll.includes('approvedIntents.member(disclose(intent))')],
  ['Approved intent cannot be funded twice', payroll.includes('fundedIntents.member(disclose(intent))')],
  ['Payroll uses MerkleTree for private allocations', payroll.includes('MerkleTree<20, Bytes<32>>')],
  ['Payroll uses persistentCommit for salary allocation', payroll.includes('persistentCommit<AllocationData>')],
  ['Payroll uses blinded HR salary intent', payroll.includes('persistentCommit<SalaryIntentData>')],
  ['Payroll uses claim nullifiers', payroll.includes('claimNullifiers')],
  ['Payroll discloses nullifier only at public Set boundary', payroll.includes('claimNullifiers.member(disclose(nul))')],
  ['Payroll keeps Merkle leaf private and discloses only root check', payroll.includes('checkRoot(disclose(merkleTreePathRoot')],
  ['Payroll uses Counter read/lessThan API', payroll.includes('fundedCount.lessThan(') && payroll.includes('fundedCount.read()')],
  ['Payroll uses domain-separated employee identity', payroll.includes('balary:payroll:employee:v1')],
  ['Payroll receives shielded salary coins', payroll.includes('receiveShielded(')],
  ['Payroll claims via committed shielded send', payroll.includes('sendShielded(')],
  ['Payroll has deadline enforcement', payroll.includes('blockTimeLte(claimDeadline)')],
  ['Payroll has post-expiry recovery', payroll.includes('recoverExpiredAllocation')],
  ['Admin/HR/Finance auth do not rely on ownPublicKey', ['assertAdmin', 'assertHr', 'assertFinance'].every((name) => { const body = payroll.match(new RegExp(`circuit ${name}\\([\\s\\S]*?\\n}`))?.[0] ?? ''; return body.length > 0 && !body.includes('ownPublicKey()'); })],
];

let failures = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failures++;
}
if (failures) process.exit(1);
