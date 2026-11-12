'use strict';

const PAIRS = Object.freeze({ 'BTC-USDT': 'XBTUSDT', 'ETH-USDT': 'ETHUSDT' });
const cache = new Map();
const CACHE_TTL_MS = 15_000;

async function getJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error('Market provider returned HTTP ' + response.status);
  const body = await response.json();
  if (body.error?.length) throw new Error('Market provider: ' + body.error.join(', '));
  return body;
}

async function getPrice(symbol, { force = false } = {}) {
  const pair = PAIRS[symbol];
  if (!pair) throw new Error('Unsupported market symbol.');
  const cached = cache.get(symbol);
  if (!force && cached && Date.now() - cached.fetchedAtMs < CACHE_TTL_MS) {
    return { ...cached, stale: false, cacheAgeMs: Date.now() - cached.fetchedAtMs };
  }
  try {
    const body = await getJson('https://api.kraken.com/0/public/Ticker?pair=' + encodeURIComponent(pair));
    const ticker = Object.values(body.result || {})[0];
    const price = Number(ticker?.c?.[0]);
    if (!Number.isFinite(price) || price <= 0) throw new Error('Market provider returned an invalid price.');
    const quote = {
      symbol, price, currency: 'USDT', source: 'Kraken public market data',
      fetchedAt: new Date().toISOString(), fetchedAtMs: Date.now(),
    };
    cache.set(symbol, quote);
    return { ...quote, stale: false, cacheAgeMs: 0 };
  } catch (error) {
    if (!cached) throw new Error('Live market feed unavailable and no cached quote exists.');
    return {
      ...cached, stale: true, cacheAgeMs: Date.now() - cached.fetchedAtMs,
      warning: 'Provider unavailable; showing the last cached quote, not a live price.',
    };
  }
}

async function getPrices() {
  const symbols = Object.keys(PAIRS);
  const results = await Promise.allSettled(symbols.map(symbol => getPrice(symbol)));
  return results.map((result, index) => result.status === 'fulfilled'
    ? result.value
    : { symbol: symbols[index], unavailable: true, error: result.reason.message, source: 'Kraken public market data' });
}

async function getHistory(symbol) {
  const pair = PAIRS[symbol];
  if (!pair) throw new Error('Unsupported market symbol.');
  const body = await getJson('https://api.kraken.com/0/public/OHLC?pair=' + encodeURIComponent(pair) + '&interval=1440');
  const rows = Object.values(body.result || {}).find(Array.isArray);
  if (!rows || rows.length < 60) throw new Error('Not enough daily market history to calculate this backtest.');
  // Kraken's final candle is still open; exclude it to avoid look-ahead and unstable results.
  return rows.slice(0, -1).map(row => ({ time: Number(row[0]) * 1000, close: Number(row[4]) }))
    .filter(row => Number.isFinite(row.close) && row.close > 0);
}

function sma(values, end, period) {
  let sum = 0;
  for (let i = end - period + 1; i <= end; i++) sum += values[i];
  return sum / period;
}

function runMovingAverageBacktest({ symbol, strategy, capital, candles }) {
  const match = strategy.match(/^(\d{1,3})\s*\/\s*(\d{1,3})\s*MA$/i);
  if (!match) throw new Error('Strategy must use the fast/slow moving-average format, such as 20/50 MA.');
  const fast = Number(match[1]);
  const slow = Number(match[2]);
  if (fast < 2 || slow <= fast || slow > 200) throw new Error('Use a fast window below the slow window (maximum 200 days).');
  if (candles.length <= slow + 2) throw new Error('Not enough history for the selected moving-average windows.');
  const closes = candles.map(item => item.close);
  const equity = [capital];
  const dailyReturns = [];
  const closedTrades = [];
  let position = false;
  let entryEquity = 0;
  let currentEquity = capital;
  let previousPeak = capital;
  let maxDrawdown = 0;
  let wins = 0;
  let trades = 0;
  for (let i = slow; i < closes.length; i++) {
    const fastNow = sma(closes, i, fast);
    const slowNow = sma(closes, i, slow);
    const fastPrev = sma(closes, i - 1, fast);
    const slowPrev = sma(closes, i - 1, slow);
    const shouldHold = fastNow > slowNow;
    const previousPosition = position;
    if (!previousPosition && shouldHold) {
      position = true;
      entryEquity = currentEquity * (1 - 0.001);
      currentEquity *= (1 - 0.001);
    }
    const marketReturn = closes[i] / closes[i - 1] - 1;
    const periodReturn = previousPosition ? marketReturn : 0;
    currentEquity *= 1 + periodReturn;
    if (previousPosition && !shouldHold) {
      currentEquity *= (1 - 0.001);
      const tradeReturn = currentEquity / entryEquity - 1;
      trades++;
      if (tradeReturn > 0) wins++;
      closedTrades.push(tradeReturn);
    }
    position = shouldHold;
    const dailyReturn = currentEquity / equity[equity.length - 1] - 1;
    dailyReturns.push(dailyReturn);
    equity.push(Number(currentEquity.toFixed(2)));
    previousPeak = Math.max(previousPeak, currentEquity);
    maxDrawdown = Math.min(maxDrawdown, currentEquity / previousPeak - 1);
  }
  if (position) {
    currentEquity *= (1 - 0.001);
    trades++;
    if (currentEquity > entryEquity) wins++;
    equity[equity.length - 1] = Number(currentEquity.toFixed(2));
  }
  const mean = dailyReturns.reduce((sum, value) => sum + value, 0) / Math.max(1, dailyReturns.length);
  const variance = dailyReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, dailyReturns.length);
  const deviation = Math.sqrt(variance);
  const sharpe = deviation ? mean / deviation * Math.sqrt(365) : 0;
  const sample = equity.length > 60
    ? Array.from({ length: 60 }, (_, index) => equity[Math.round(index * (equity.length - 1) / 59)])
    : equity;
  return {
    symbol, strategy: fast + '/' + slow + ' MA', source: 'Kraken daily OHLC',
    period: { from: new Date(candles[candles.length - dailyReturns.length].time).toISOString(), to: new Date(candles[candles.length - 1].time).toISOString(), candles: dailyReturns.length },
    returnPct: Number(((currentEquity / capital - 1) * 100).toFixed(2)),
    sharpe: Number(sharpe.toFixed(2)), maxDD: Number((maxDrawdown * 100).toFixed(2)),
    winRate: trades ? Number((wins / trades * 100).toFixed(1)) : 0,
    trades, equity: sample, finalEquity: Number(currentEquity.toFixed(2)),
    assumptions: { position: '100% long or cash', feePerSideBps: 10, candleInterval: '1 day', openCandleExcluded: true },
  };
}

module.exports = { getPrice, getPrices, getHistory, runMovingAverageBacktest };
