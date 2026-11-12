'use strict';

function sma(values, end, window) {
  let total = 0;
  for (let i = end - window + 1; i <= end; i++) total += values[i];
  return total / window;
}

function runMovingAverageBacktest({ prices, capital = 1000, fast = 20, slow = 50, feeBps = 10 } = {}) {
  if (!Array.isArray(prices) || prices.length < 60 || prices.length > 2000) {
    throw new TypeError('Provide between 60 and 2,000 historical closing prices.');
  }
  if (!prices.every(value => typeof value === 'number' && Number.isFinite(value) && value > 0)) {
    throw new TypeError('Every closing price must be a finite positive number.');
  }
  if (!Number.isFinite(capital) || capital <= 0 || capital > 1_000_000) {
    throw new TypeError('Capital must be greater than zero and no more than 1,000,000.');
  }
  if (!Number.isInteger(fast) || !Number.isInteger(slow) || fast < 2 || slow <= fast || slow > 200 || slow >= prices.length) {
    throw new TypeError('Use integer moving-average windows where 2 <= fast < slow <= 200 and slow < price count.');
  }
  if (!Number.isFinite(feeBps) || feeBps < 0 || feeBps > 100) {
    throw new TypeError('Fee must be between 0 and 100 basis points per side.');
  }

  const fee = feeBps / 10_000;
  let equity = capital;
  let position = 0;
  let entryEquity = null;
  let wins = 0;
  let closedTrades = 0;
  let trades = 0;
  const curve = [capital];
  const returns = [];

  for (let i = slow - 1; i < prices.length - 1; i++) {
    const fastNow = sma(prices, i, fast);
    const slowNow = sma(prices, i, slow);
    const desired = fastNow > slowNow ? 1 : 0;

    if (desired !== position) {
      equity *= (1 - fee);
      trades++;
      if (desired === 1) {
        entryEquity = equity;
      } else if (entryEquity !== null) {
        closedTrades++;
        if (equity > entryEquity) wins++;
        entryEquity = null;
      }
      position = desired;
    }

    const before = equity;
    equity *= 1 + position * (prices[i + 1] / prices[i] - 1);
    returns.push(before > 0 ? equity / before - 1 : 0);
    curve.push(Number(equity.toFixed(2)));
  }

  if (position === 1) {
    equity *= (1 - fee);
    trades++;
    closedTrades++;
    if (entryEquity !== null && equity > entryEquity) wins++;
    curve[curve.length - 1] = Number(equity.toFixed(2));
  }

  const peakAndDrawdown = curve.reduce((state, value) => {
    const peak = Math.max(state.peak, value);
    return { peak, maxDrawdown: Math.min(state.maxDrawdown, peak ? (value / peak - 1) * 100 : 0) };
  }, { peak: capital, maxDrawdown: 0 });
  const mean = returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0;
  const variance = returns.length > 1
    ? returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1)
    : 0;
  const volatility = Math.sqrt(variance);
  const sharpe = volatility > 0 ? mean / volatility * Math.sqrt(252) : 0;

  return {
    method: 'long-only SMA crossover; signal at close, exposure applied to next bar',
    dataPoints: prices.length,
    fastWindow: fast,
    slowWindow: slow,
    feeBpsPerSide: feeBps,
    initialCapital: Number(capital.toFixed(2)),
    finalEquity: Number(equity.toFixed(2)),
    returnPct: Number(((equity / capital - 1) * 100).toFixed(2)),
    sharpe: Number(sharpe.toFixed(2)),
    maxDD: Number(peakAndDrawdown.maxDrawdown.toFixed(2)),
    winRate: closedTrades ? Number((wins / closedTrades * 100).toFixed(1)) : 0,
    trades,
    closedTrades,
    equity: curve,
    dataLabel: 'user-supplied historical closes; results are hypothetical and exclude slippage and taxes',
  };
}

module.exports = { runMovingAverageBacktest };
