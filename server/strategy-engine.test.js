'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { runMovingAverageBacktest } = require('./strategy-engine');

test('computes a reproducible result from supplied closes', () => {
  const prices = Array.from({ length: 120 }, (_, i) => 100 + i * 0.8 + Math.sin(i / 4) * 3);
  const a = runMovingAverageBacktest({ prices, capital: 5000, fast: 5, slow: 20 });
  const b = runMovingAverageBacktest({ prices, capital: 5000, fast: 5, slow: 20 });
  assert.deepEqual(a, b);
  assert.equal(a.dataPoints, 120);
  assert.equal(a.initialCapital, 5000);
  assert.ok(Number.isFinite(a.sharpe));
  assert.ok(a.maxDD <= 0);
  assert.ok(a.equity.length > 1);
});

test('rejects short, invalid and non-positive price series', () => {
  assert.throws(() => runMovingAverageBacktest({ prices: [1, 2, 3] }), /between 60/);
  assert.throws(() => runMovingAverageBacktest({ prices: Array(60).fill(0) }), /positive/);
  assert.throws(() => runMovingAverageBacktest({ prices: Array(60).fill(10), fast: 50, slow: 20 }), /windows/);
});
