import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GatewayModel,
  PayrollModel,
  employeeKey,
} from '../model/balary-model.mjs';

const ADMIN = 'admin-secret';
const HR = 'hr-secret';
const FINANCE = 'finance-secret';

const make = (expected = 2, deadline = 1000) => {
  const gateway = new GatewayModel();
  const payroll = new PayrollModel({
    payrollId: 'AUG-2026',
    institutionId: 'BALARY-DEMO-LTD',
    gateway,
    expectedAllocations: expected,
    deadline,
    adminSecret: ADMIN,
    hrSecret: HR,
    financeSecret: FINANCE,
  });
  return { gateway, payroll };
};

const approveFor = (payroll, secret, amount, suffix) => {
  const eKey = employeeKey(secret);
  const allocationId = `allocation-${suffix}`;
  const intentBlind = `intent-blind-${suffix}`;
  const allocationBlind = `allocation-blind-${suffix}`;
  payroll.approveAllocation({
    hrSecret: HR,
    employeeKey: eKey,
    salaryValue: BigInt(amount),
    allocationId,
    intentBlind,
  });
  return { eKey, allocationId, intentBlind, allocationBlind };
};

const fundFor = (gateway, payroll, secret, amount, suffix) => {
  const approved = approveFor(payroll, secret, amount, suffix);
  const coin = gateway.deposit(BigInt(amount));
  payroll.fund({
    financeSecret: FINANCE,
    employeeKey: approved.eKey,
    coin,
    allocationId: approved.allocationId,
    intentBlind: approved.intentBlind,
    allocationBlind: approved.allocationBlind,
  });
  return { coin, ...approved };
};

test('payroll starts in FUNDING', () => {
  const { payroll } = make();
  assert.equal(payroll.state, 'FUNDING');
});

test('HR can approve a salary allocation', () => {
  const { payroll } = make(1);
  approveFor(payroll, 'ada', 100, 'ada');
  assert.equal(payroll.approved, 1);
});

test('non-HR cannot approve salary allocation', () => {
  const { payroll } = make(1);
  assert.throws(() => payroll.approveAllocation({
    hrSecret: 'attacker',
    employeeKey: employeeKey('ada'),
    salaryValue: 100n,
    allocationId: 'a',
    intentBlind: 'b',
  }), /not authorized as institution HR/);
});

test('duplicate HR approval is rejected', () => {
  const { payroll } = make(2);
  const eKey = employeeKey('ada');
  const input = { hrSecret: HR, employeeKey: eKey, salaryValue: 100n, allocationId: 'a', intentBlind: 'b' };
  payroll.approveAllocation(input);
  assert.throws(() => payroll.approveAllocation(input), /already approved/);
});

test('Finance cannot fund an allocation HR did not approve', () => {
  const { gateway, payroll } = make(1);
  const coin = gateway.deposit(100n);
  assert.throws(() => payroll.fund({
    financeSecret: FINANCE,
    employeeKey: employeeKey('ada'),
    coin,
    allocationId: 'not-approved',
    intentBlind: 'x',
    allocationBlind: 'a',
  }), /not approved by HR/);
});

test('non-Finance cannot fund approved allocation', () => {
  const { gateway, payroll } = make(1);
  const approved = approveFor(payroll, 'ada', 100, 'ada');
  const coin = gateway.deposit(100n);
  assert.throws(() => payroll.fund({
    financeSecret: 'attacker',
    employeeKey: approved.eKey,
    coin,
    allocationId: approved.allocationId,
    intentBlind: approved.intentBlind,
    allocationBlind: approved.allocationBlind,
  }), /not authorized as institution finance/);
});

test('Finance cannot fund a different amount than HR approved', () => {
  const { gateway, payroll } = make(1);
  const approved = approveFor(payroll, 'ada', 100, 'ada');
  const coin = gateway.deposit(101n);
  assert.throws(() => payroll.fund({
    financeSecret: FINANCE,
    employeeKey: approved.eKey,
    coin,
    allocationId: approved.allocationId,
    intentBlind: approved.intentBlind,
    allocationBlind: approved.allocationBlind,
  }), /not approved by HR/);
});

test('partial payroll never activates', () => {
  const { gateway, payroll } = make(2);
  fundFor(gateway, payroll, 'ada', 100, 'ada');
  assert.equal(payroll.state, 'FUNDING');
});

test('payroll activates only after all HR-approved allocations are funded', () => {
  const { gateway, payroll } = make(2);
  fundFor(gateway, payroll, 'ada', 100, 'ada');
  fundFor(gateway, payroll, 'tunde', 200, 'tunde');
  assert.equal(payroll.approved, 2);
  assert.equal(payroll.funded, 2);
  assert.equal(payroll.state, 'ACTIVE');
});

test('same HR-approved intent cannot be funded twice', () => {
  const { gateway, payroll } = make(2);
  const approved = approveFor(payroll, 'ada', 100, 'ada');
  const firstCoin = gateway.deposit(100n);
  payroll.fund({ financeSecret: FINANCE, employeeKey: approved.eKey, coin: firstCoin, allocationId: approved.allocationId, intentBlind: approved.intentBlind, allocationBlind: approved.allocationBlind });
  const secondCoin = gateway.deposit(100n);
  assert.throws(() => payroll.fund({ financeSecret: FINANCE, employeeKey: approved.eKey, coin: secondCoin, allocationId: approved.allocationId, intentBlind: approved.intentBlind, allocationBlind: 'another' }), /already funded/);
});

test('wrong employee secret cannot claim another employee salary', () => {
  const { gateway, payroll } = make(1);
  const { coin, allocationBlind } = fundFor(gateway, payroll, 'ada', 100, 'ada');
  assert.throws(() => payroll.claim({ employeeSecret: 'tunde', coin, blind: allocationBlind, now: 10 }), /allocation not in payroll/);
});

test('wrong blinding value cannot open allocation', () => {
  const { gateway, payroll } = make(1);
  const { coin } = fundFor(gateway, payroll, 'ada', 100, 'ada');
  assert.throws(() => payroll.claim({ employeeSecret: 'ada', coin, blind: 'wrong', now: 10 }), /allocation not in payroll/);
});

test('employee can claim exact salary coin', () => {
  const { gateway, payroll } = make(1);
  const { coin, allocationBlind } = fundFor(gateway, payroll, 'ada', 100, 'ada');
  const received = payroll.claim({ employeeSecret: 'ada', coin, blind: allocationBlind, now: 10 });
  assert.equal(received, 100n);
  assert.equal(payroll.claimed, 1);
  assert.equal(payroll.state, 'COMPLETED');
});

test('salary cannot be claimed twice', () => {
  const { gateway, payroll } = make(1);
  const { coin, allocationBlind } = fundFor(gateway, payroll, 'ada', 100, 'ada');
  payroll.claim({ employeeSecret: 'ada', coin, blind: allocationBlind, now: 10 });
  assert.throws(() => payroll.claim({ employeeSecret: 'ada', coin, blind: allocationBlind, now: 11 }), /not active|already claimed|already spent/);
});

test('claim after deadline fails', () => {
  const { gateway, payroll } = make(1, 100);
  const { coin, allocationBlind } = fundFor(gateway, payroll, 'ada', 100, 'ada');
  assert.throws(() => payroll.claim({ employeeSecret: 'ada', coin, blind: allocationBlind, now: 101 }), /deadline passed/);
});

test('claim at deadline is allowed', () => {
  const { gateway, payroll } = make(1, 100);
  const { coin, allocationBlind } = fundFor(gateway, payroll, 'ada', 100, 'ada');
  assert.equal(payroll.claim({ employeeSecret: 'ada', coin, blind: allocationBlind, now: 100 }), 100n);
});

test('only Admin can cancel a funding payroll', () => {
  const { payroll } = make(2);
  assert.throws(() => payroll.cancel('attacker'), /not authorized as institution admin/);
});

test('Admin cannot cancel active payroll', () => {
  const { gateway, payroll } = make(1);
  fundFor(gateway, payroll, 'ada', 100, 'ada');
  assert.throws(() => payroll.cancel(ADMIN), /only funding payroll/);
});

test('Admin can cancel partially funded payroll', () => {
  const { gateway, payroll } = make(2);
  fundFor(gateway, payroll, 'ada', 100, 'ada');
  payroll.cancel(ADMIN);
  assert.equal(payroll.state, 'CANCELLED');
});

test('cancel with zero funded closes immediately', () => {
  const { payroll } = make(2);
  payroll.cancel(ADMIN);
  assert.equal(payroll.state, 'CLOSED');
});

test('Finance can recover cancelled funded allocation', () => {
  const { gateway, payroll } = make(2);
  const ada = fundFor(gateway, payroll, 'ada', 100, 'ada');
  payroll.cancel(ADMIN);
  assert.equal(payroll.recoverCancelled({ financeSecret: FINANCE, employeeKey: ada.eKey, coin: ada.coin, blind: ada.allocationBlind }), 100n);
  assert.equal(payroll.state, 'CLOSED');
});

test('non-Finance cannot recover cancelled allocation', () => {
  const { gateway, payroll } = make(2);
  const ada = fundFor(gateway, payroll, 'ada', 100, 'ada');
  payroll.cancel(ADMIN);
  assert.throws(() => payroll.recoverCancelled({ financeSecret: 'attacker', employeeKey: ada.eKey, coin: ada.coin, blind: ada.allocationBlind }), /not authorized as institution finance/);
});

test('cannot recover active allocation before deadline', () => {
  const { gateway, payroll } = make(1, 100);
  const ada = fundFor(gateway, payroll, 'ada', 100, 'ada');
  assert.throws(() => payroll.recoverExpired({ financeSecret: FINANCE, employeeKey: ada.eKey, coin: ada.coin, blind: ada.allocationBlind, now: 100 }), /deadline not passed/);
});

test('unclaimed allocation can be recovered by Finance after deadline', () => {
  const { gateway, payroll } = make(1, 100);
  const ada = fundFor(gateway, payroll, 'ada', 100, 'ada');
  const recovered = payroll.recoverExpired({ financeSecret: FINANCE, employeeKey: ada.eKey, coin: ada.coin, blind: ada.allocationBlind, now: 101 });
  assert.equal(recovered, 100n);
  assert.equal(payroll.state, 'CLOSED');
});

test('claimed coin cannot be recovered after deadline', () => {
  const { gateway, payroll } = make(2, 100);
  const ada = fundFor(gateway, payroll, 'ada', 100, 'ada');
  const tunde = fundFor(gateway, payroll, 'tunde', 200, 'tunde');
  payroll.claim({ employeeSecret: 'ada', coin: ada.coin, blind: ada.allocationBlind, now: 50 });
  assert.throws(() => payroll.recoverExpired({ financeSecret: FINANCE, employeeKey: ada.eKey, coin: ada.coin, blind: ada.allocationBlind, now: 101 }), /already spent/);
  assert.equal(payroll.recoverExpired({ financeSecret: FINANCE, employeeKey: tunde.eKey, coin: tunde.coin, blind: tunde.allocationBlind, now: 101 }), 200n);
});

test('mixed claim and expiry recovery closes payroll when every allocation settles', () => {
  const { gateway, payroll } = make(2, 100);
  const ada = fundFor(gateway, payroll, 'ada', 100, 'ada');
  const tunde = fundFor(gateway, payroll, 'tunde', 200, 'tunde');
  payroll.claim({ employeeSecret: 'ada', coin: ada.coin, blind: ada.allocationBlind, now: 50 });
  payroll.recoverExpired({ financeSecret: FINANCE, employeeKey: tunde.eKey, coin: tunde.coin, blind: tunde.allocationBlind, now: 101 });
  assert.equal(payroll.settled, 2);
  assert.equal(payroll.state, 'CLOSED');
});

test('same recovery cannot run twice', () => {
  const { gateway, payroll } = make(1, 100);
  const ada = fundFor(gateway, payroll, 'ada', 100, 'ada');
  payroll.recoverExpired({ financeSecret: FINANCE, employeeKey: ada.eKey, coin: ada.coin, blind: ada.allocationBlind, now: 101 });
  assert.throws(() => payroll.recoverExpired({ financeSecret: FINANCE, employeeKey: ada.eKey, coin: ada.coin, blind: ada.allocationBlind, now: 102 }), /not recoverable|already recovered|already spent/);
});

test('salary coin must be zUSDM', () => {
  const { payroll } = make(1);
  const approved = approveFor(payroll, 'ada', 100, 'ada');
  const fake = { color: 'FAKE', value: 100n, nonce: 'fake' };
  assert.throws(() => payroll.fund({ financeSecret: FINANCE, employeeKey: approved.eKey, coin: fake, allocationId: approved.allocationId, intentBlind: approved.intentBlind, allocationBlind: approved.allocationBlind }), /wrong salary token/);
});

test('Admin can rotate HR authority', () => {
  const { payroll } = make(1);
  payroll.rotateHR({ adminSecret: ADMIN, newHrSecret: 'new-hr' });
  assert.throws(() => payroll.approveAllocation({ hrSecret: HR, employeeKey: employeeKey('ada'), salaryValue: 100n, allocationId: 'a', intentBlind: 'b' }), /not authorized as institution HR/);
  payroll.approveAllocation({ hrSecret: 'new-hr', employeeKey: employeeKey('ada'), salaryValue: 100n, allocationId: 'a', intentBlind: 'b' });
  assert.equal(payroll.approved, 1);
});

test('non-Admin cannot rotate HR authority', () => {
  const { payroll } = make(1);
  assert.throws(() => payroll.rotateHR({ adminSecret: 'attacker', newHrSecret: 'new-hr' }), /not authorized as institution admin/);
});

test('Admin can rotate Finance authority', () => {
  const { gateway, payroll } = make(1);
  const approved = approveFor(payroll, 'ada', 100, 'ada');
  payroll.rotateFinance({ adminSecret: ADMIN, newFinanceSecret: 'new-finance' });
  const coin = gateway.deposit(100n);
  assert.throws(() => payroll.fund({ financeSecret: FINANCE, employeeKey: approved.eKey, coin, allocationId: approved.allocationId, intentBlind: approved.intentBlind, allocationBlind: approved.allocationBlind }), /not authorized as institution finance/);
  payroll.fund({ financeSecret: 'new-finance', employeeKey: approved.eKey, coin, allocationId: approved.allocationId, intentBlind: approved.intentBlind, allocationBlind: approved.allocationBlind });
  assert.equal(payroll.state, 'ACTIVE');
});

test('Admin can rotate Admin authority without creating an admin-less institution', () => {
  const { payroll } = make(1);
  payroll.rotateAdmin({ adminSecret: ADMIN, newAdminSecret: 'new-admin' });
  assert.throws(() => payroll.rotateHR({ adminSecret: ADMIN, newHrSecret: 'x' }), /not authorized as institution admin/);
  payroll.rotateHR({ adminSecret: 'new-admin', newHrSecret: 'x' });
});
