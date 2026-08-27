import test from 'node:test';
import assert from 'node:assert/strict';
import { GatewayModel } from '../model/balary-model.mjs';

test('deposit locks USDM and issues equal zUSDM', () => {
  const g = new GatewayModel();
  const coin = g.deposit(1_000n);
  assert.equal(coin.value, 1_000n);
  assert.equal(g.usdmReserve, 1_000n);
  assert.equal(g.totalLocked, 1_000n);
  assert.equal(g.totalOutstanding, 1_000n);
});

test('multiple deposits preserve 1:1 invariant', () => {
  const g = new GatewayModel();
  g.deposit(100n); g.deposit(250n); g.deposit(650n);
  assert.equal(g.totalLocked, 1_000n);
  assert.equal(g.totalOutstanding, 1_000n);
  assert.equal(g.usdmReserve, 1_000n);
});

test('zero deposit fails', () => {
  const g = new GatewayModel();
  assert.throws(() => g.deposit(0n), /non-zero/);
});

test('negative deposit fails', () => {
  const g = new GatewayModel();
  assert.throws(() => g.deposit(-1n), /non-zero/);
});

test('redeem burns zUSDM and releases equal USDM', () => {
  const g = new GatewayModel();
  const coin = g.deposit(500n);
  const released = g.redeem(coin);
  assert.equal(released, 500n);
  assert.equal(g.usdmReserve, 0n);
  assert.equal(g.totalOutstanding, 0n);
});

test('wrong shielded token cannot redeem', () => {
  const g = new GatewayModel();
  g.deposit(500n);
  assert.throws(() => g.redeem({ color: 'FAKE', value: 100n, nonce: 'x' }), /wrong shielded token/);
});

test('same coin cannot redeem twice', () => {
  const g = new GatewayModel();
  const coin = g.deposit(500n);
  g.redeem(coin);
  assert.throws(() => g.redeem(coin), /already spent/);
});

test('cannot redeem more zUSDM than outstanding', () => {
  const g = new GatewayModel();
  g.deposit(100n);
  assert.throws(() => g.redeem({ color: 'zUSDM', value: 101n, nonce: 'fake' }), /exceeds outstanding/);
});

test('reserve shortfall is detected before operations', () => {
  const g = new GatewayModel();
  g.deposit(100n);
  g.usdmReserve = 99n;
  assert.throws(() => g.deposit(1n), /reserve below locked/);
});

test('accounting divergence is detected', () => {
  const g = new GatewayModel();
  g.deposit(100n);
  g.totalOutstanding = 99n;
  assert.throws(() => g.assertInvariant(), /accounting invariant/);
});
