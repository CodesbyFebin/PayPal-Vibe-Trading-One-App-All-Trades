const assert = require('node:assert/strict');
const { test } = require('node:test');
const market = require('../server/market');

test('Kraken ticker is parsed into a timestamped read-only quote', async () => {
  const originalFetch = global.fetch;
  global.fetch = async url => {
    assert.match(String(url), /api\.kraken\.com\/0\/public\/Ticker/);
    return { ok: true, json: async () => ({ error: [], result: { XBTUSDT: { c: ['50123.45'] } } }) };
  };
  try {
    const quote = await market.getPrice('BTC-USDT', { force: true });
    assert.equal(quote.price, 50123.45);
    assert.equal(quote.source, 'Kraken public market data');
    assert.equal(quote.stale, false);
    assert.ok(quote.fetchedAt);
  } finally {
    global.fetch = originalFetch;
  }
});

test('provider failure returns only an explicitly stale last-known quote', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error('offline'); };
  try {
    const quote = await market.getPrice('BTC-USDT', { force: true });
    assert.equal(quote.price, 50123.45);
    assert.equal(quote.stale, true);
    assert.match(quote.warning, /not a live price/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Kraken OHLC excludes the still-open final candle', async () => {
  const originalFetch = global.fetch;
  const rows = Array.from({ length: 70 }, (_, index) => [1700000000 + index * 86400, '100', '101', '99', String(100 + index), '1', '1', 1]);
  global.fetch = async url => {
    assert.match(String(url), /interval=1440/);
    return { ok: true, json: async () => ({ error: [], result: { XXBTZUSDT: rows, last: 123 } }) };
  };
  try {
    const candles = await market.getHistory('BTC-USDT');
    assert.equal(candles.length, 69);
    assert.equal(candles.at(-1).close, 168);
  } finally {
    global.fetch = originalFetch;
  }
});

test('moving-average backtest is deterministic for the same candle range', () => {
  const candles = Array.from({ length: 180 }, (_, index) => ({
    time: Date.UTC(2025, 0, index + 1),
    close: 100 + Math.sin(index / 5) * 10 + index * 0.2,
  }));
  const input = { symbol: 'BTC-USDT', strategy: '20/50 MA', capital: 1000, candles };
  const first = market.runMovingAverageBacktest(input);
  const second = market.runMovingAverageBacktest(input);
  assert.deepEqual(first, second);
  assert.equal(first.assumptions.openCandleExcluded, true);
  assert.equal(first.assumptions.feePerSideBps, 10);
});
