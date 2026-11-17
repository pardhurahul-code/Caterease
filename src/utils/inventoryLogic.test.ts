import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStockUpdate, isLowStock, getExpiryStatus } from './inventoryLogic';

test('computes stock-in, stock-out, and adjustment without negative stock', () => {
  const stockIn = computeStockUpdate(25, 'STOCK_IN', 15);
  assert.equal(stockIn.valid, true);
  assert.equal(stockIn.newQuantity, 40);

  const badOut = computeStockUpdate(10, 'STOCK_OUT', 12);
  assert.equal(badOut.valid, false);
  assert.equal(badOut.newQuantity, 10);

  const goodOut = computeStockUpdate(10, 'STOCK_OUT', 4);
  assert.equal(goodOut.valid, true);
  assert.equal(goodOut.newQuantity, 6);
  assert.equal(goodOut.quantityChange, -4);

  const adj = computeStockUpdate(6, 'ADJUSTMENT', 18);
  assert.equal(adj.valid, true);
  assert.equal(adj.newQuantity, 18);
  assert.equal(adj.quantityChange, 12);
});

test('detects low stock and expiry alerts accurately', () => {
  assert.equal(isLowStock(8, 10), true);
  assert.equal(isLowStock(15, 10), false);

  const ref = new Date('2026-11-17T10:00:00Z');
  assert.equal(getExpiryStatus('2026-11-10', ref), 'EXPIRED');
  assert.equal(getExpiryStatus('2026-11-20', ref), 'EXPIRING_SOON');
  assert.equal(getExpiryStatus('2026-12-30', ref), 'OK');
});
