import crypto from 'node:crypto';

export class BalaryError extends Error {}

const h = (...parts) => {
  const hash = crypto.createHash('sha256');
  for (const part of parts) hash.update(String(part));
  return hash.digest('hex');
};

export const employeeKey = (secret) => h('balary:payroll:employee:v1', secret);
export const adminAuthority = (secret) => h('balary:institution:admin:v1', secret);
export const hrAuthority = (secret) => h('balary:institution:hr:v1', secret);
export const financeAuthority = (secret) => h('balary:institution:finance:v1', secret);

export const salaryIntentCommitment = ({ payrollId, employeeKey: eKey, salaryValue, allocationId, blind }) =>
  h('balary:salary:intent:v1', payrollId, eKey, salaryValue, allocationId, blind);

export const allocationCommitment = ({ payrollId, employeeKey: eKey, coin, blind }) =>
  h('allocation', payrollId, eKey, coin.nonce, coin.color, coin.value, blind);
export const claimNullifier = ({ payrollId, employeeSecret, coin }) =>
  h('balary:salary:nullifier:v1', payrollId, coin.nonce, employeeSecret);
export const recoveryNullifier = ({ payrollId, coin }) =>
  h('balary:salary:recovery:v1', payrollId, coin.nonce);

export class GatewayModel {
  constructor({ usdmColor = 'USDM', zUSDMColor = 'zUSDM' } = {}) {
    this.usdmColor = usdmColor;
    this.zUSDMColor = zUSDMColor;
    this.usdmReserve = 0n;
    this.totalLocked = 0n;
    this.totalOutstanding = 0n;
    this.depositCount = 0;
    this.redemptionCount = 0;
    this.serial = 0n;
  }

  assertInvariant() {
    if (this.totalLocked !== this.totalOutstanding) throw new BalaryError('accounting invariant broken');
    if (this.usdmReserve < this.totalLocked) throw new BalaryError('reserve below locked amount');
  }

  deposit(amount) {
    amount = BigInt(amount);
    if (amount <= 0n) throw new BalaryError('deposit amount must be non-zero');
    this.assertInvariant();
    this.usdmReserve += amount;
    this.totalLocked += amount;
    this.totalOutstanding += amount;
    this.depositCount++;
    const coin = { color: this.zUSDMColor, value: amount, nonce: `mint-${this.serial++}` };
    this.assertInvariant();
    return coin;
  }

  redeem(coin) {
    if (coin.color !== this.zUSDMColor) throw new BalaryError('wrong shielded token');
    if (coin.spent) throw new BalaryError('coin already spent');
    if (coin.value <= 0n) throw new BalaryError('redemption amount must be non-zero');
    this.assertInvariant();
    if (coin.value > this.totalOutstanding) throw new BalaryError('redemption exceeds outstanding');
    coin.spent = true;
    this.usdmReserve -= coin.value;
    this.totalLocked -= coin.value;
    this.totalOutstanding -= coin.value;
    this.redemptionCount++;
    this.assertInvariant();
    return coin.value;
  }
}

export class PayrollModel {
  constructor({
    payrollId,
    institutionId = 'INSTITUTION-1',
    gateway,
    expectedAllocations,
    deadline,
    adminSecret,
    hrSecret,
    financeSecret,
  }) {
    if (!payrollId) throw new BalaryError('payroll id required');
    if (!institutionId) throw new BalaryError('institution id required');
    if (!gateway) throw new BalaryError('gateway required');
    if (!Number.isInteger(expectedAllocations) || expectedAllocations <= 0) throw new BalaryError('expected allocations must be positive');
    this.payrollId = payrollId;
    this.institutionId = institutionId;
    this.gateway = gateway;
    this.expected = expectedAllocations;
    this.deadline = deadline;
    this.adminAuthority = adminAuthority(adminSecret);
    this.hrAuthority = hrAuthority(hrSecret);
    this.financeAuthority = financeAuthority(financeSecret);
    this.state = 'FUNDING';
    this.approvedIntents = new Map();
    this.fundedIntents = new Set();
    this.allocations = new Map();
    this.claimNullifiers = new Set();
    this.recoveryNullifiers = new Set();
    this.approved = 0;
    this.funded = 0;
    this.claimed = 0;
    this.recovered = 0;
    this.settled = 0;
  }

  assertAdmin(secret) {
    if (adminAuthority(secret) !== this.adminAuthority) throw new BalaryError('not authorized as institution admin');
  }

  assertHR(secret) {
    if (hrAuthority(secret) !== this.hrAuthority) throw new BalaryError('not authorized as institution HR');
  }

  assertFinance(secret) {
    if (financeAuthority(secret) !== this.financeAuthority) throw new BalaryError('not authorized as institution finance');
  }

  rotateAdmin({ adminSecret, newAdminSecret }) {
    this.assertAdmin(adminSecret);
    this.adminAuthority = adminAuthority(newAdminSecret);
  }

  rotateHR({ adminSecret, newHrSecret }) {
    this.assertAdmin(adminSecret);
    this.hrAuthority = hrAuthority(newHrSecret);
  }

  rotateFinance({ adminSecret, newFinanceSecret }) {
    this.assertAdmin(adminSecret);
    this.financeAuthority = financeAuthority(newFinanceSecret);
  }

  approveAllocation({ hrSecret, employeeKey: eKey, salaryValue, allocationId, intentBlind }) {
    this.assertHR(hrSecret);
    if (this.state !== 'FUNDING') throw new BalaryError('payroll not funding');
    if (this.approved >= this.expected) throw new BalaryError('all allocations approved');
    salaryValue = BigInt(salaryValue);
    if (salaryValue <= 0n) throw new BalaryError('salary must be non-zero');
    const intent = salaryIntentCommitment({
      payrollId: this.payrollId,
      employeeKey: eKey,
      salaryValue,
      allocationId,
      blind: intentBlind,
    });
    if (this.approvedIntents.has(intent)) throw new BalaryError('allocation intent already approved');
    this.approvedIntents.set(intent, { employeeKey: eKey, salaryValue, allocationId, intentBlind });
    this.approved++;
    return intent;
  }

  fund({ financeSecret, employeeKey: eKey, coin, allocationId, intentBlind, allocationBlind }) {
    this.assertFinance(financeSecret);
    if (this.state !== 'FUNDING') throw new BalaryError('payroll not funding');
    if (this.funded >= this.expected) throw new BalaryError('all allocations funded');
    if (coin.color !== this.gateway.zUSDMColor) throw new BalaryError('wrong salary token');
    if (coin.value <= 0n) throw new BalaryError('zero salary');
    if (coin.spent) throw new BalaryError('coin already spent');

    const intent = salaryIntentCommitment({
      payrollId: this.payrollId,
      employeeKey: eKey,
      salaryValue: coin.value,
      allocationId,
      blind: intentBlind,
    });
    if (!this.approvedIntents.has(intent)) throw new BalaryError('allocation was not approved by HR');
    if (this.fundedIntents.has(intent)) throw new BalaryError('approved allocation already funded');

    const commitment = allocationCommitment({ payrollId: this.payrollId, employeeKey: eKey, coin, blind: allocationBlind });
    this.allocations.set(commitment, {
      employeeKey: eKey,
      coin,
      allocationBlind,
      intent,
      claimed: false,
      recovered: false,
    });
    this.fundedIntents.add(intent);
    this.funded++;
    if (this.approved === this.expected && this.funded === this.expected) this.state = 'ACTIVE';
    return commitment;
  }

  claim({ employeeSecret, coin, blind, now }) {
    if (this.state !== 'ACTIVE') throw new BalaryError('payroll not active');
    if (now > this.deadline) throw new BalaryError('claim deadline passed');
    if (coin.color !== this.gateway.zUSDMColor) throw new BalaryError('wrong salary token');
    const eKey = employeeKey(employeeSecret);
    const commitment = allocationCommitment({ payrollId: this.payrollId, employeeKey: eKey, coin, blind });
    const allocation = this.allocations.get(commitment);
    if (!allocation) throw new BalaryError('allocation not in payroll');
    const nul = claimNullifier({ payrollId: this.payrollId, employeeSecret, coin });
    if (this.claimNullifiers.has(nul)) throw new BalaryError('already claimed');
    if (coin.spent) throw new BalaryError('coin already spent');
    this.claimNullifiers.add(nul);
    coin.spent = true;
    allocation.claimed = true;
    this.claimed++;
    this.settled++;
    if (this.claimed === this.expected) this.state = 'COMPLETED';
    return coin.value;
  }

  cancel(adminSecret) {
    this.assertAdmin(adminSecret);
    if (this.state !== 'FUNDING') throw new BalaryError('only funding payroll can cancel');
    this.state = this.funded === 0 ? 'CLOSED' : 'CANCELLED';
  }

  recoverCancelled({ financeSecret, employeeKey: eKey, coin, blind }) {
    this.assertFinance(financeSecret);
    if (this.state !== 'CANCELLED') throw new BalaryError('payroll not cancelled');
    return this.#recover({ employeeKey: eKey, coin, blind, cancelled: true });
  }

  recoverExpired({ financeSecret, employeeKey: eKey, coin, blind, now }) {
    this.assertFinance(financeSecret);
    if (!['ACTIVE', 'EXPIRED'].includes(this.state)) throw new BalaryError('payroll not recoverable');
    if (now <= this.deadline) throw new BalaryError('deadline not passed');
    if (this.state === 'ACTIVE') this.state = 'EXPIRED';
    return this.#recover({ employeeKey: eKey, coin, blind, cancelled: false });
  }

  #recover({ employeeKey: eKey, coin, blind, cancelled }) {
    const commitment = allocationCommitment({ payrollId: this.payrollId, employeeKey: eKey, coin, blind });
    const allocation = this.allocations.get(commitment);
    if (!allocation) throw new BalaryError('allocation not in payroll');
    const nul = recoveryNullifier({ payrollId: this.payrollId, coin });
    if (this.recoveryNullifiers.has(nul)) throw new BalaryError('already recovered');
    if (coin.spent) throw new BalaryError('coin already spent');
    this.recoveryNullifiers.add(nul);
    coin.spent = true;
    allocation.recovered = true;
    this.recovered++;
    if (cancelled) {
      if (this.recovered === this.funded) this.state = 'CLOSED';
    } else {
      this.settled++;
      if (this.settled === this.expected) this.state = 'CLOSED';
    }
    return coin.value;
  }
}
