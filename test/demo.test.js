const assert = require('node:assert/strict');
const { once } = require('node:events');
const { after, before, test } = require('node:test');
const { createApp } = require('../server');

let server;
let origin;

before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = 'http://127.0.0.1:' + server.address().port;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

async function post(route, body) {
  return fetch(origin + '/api/' + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('all demo entry points and shared assets are served', async () => {
  for (const [route, marker] of [
    ['/', 'id="vibe"'],
    ['/landing/', 'One App. All Trades.'],
    ['/webapp/', 'id="backtest"'],
    ['/mobile/', 'id="sip"'],
    ['/assets/app.css', '.site-header'],
    ['/assets/app.js', "demoForm('vibe'"],
  ]) {
    const response = await fetch(origin + route);
    assert.equal(response.status, 200, route);
    assert.ok((await response.text()).includes(marker), route);
  }
});

test('health, holdings, and alpha endpoints return demo data', async () => {
  assert.deepEqual(await (await fetch(origin + '/api/health')).json(), { ok: true, service: 'paypal-vibe' });
  const portfolio = await (await fetch(origin + '/api/portfolio')).json();
  assert.equal(portfolio.holdings.reduce((total, holding) => total + holding.w, 0), 100);
  assert.equal((await (await fetch(origin + '/api/alphas')).json()).length, 2);
});

test('Vibe It infers and accepts explicit allocation modes', async () => {
  const response = await post('vibe', { feeling: 'I feel bullish on AI' });
  assert.deepEqual(await response.json(), {
    feeling: 'I feel bullish on AI',
    mode: 'Bold',
    portfolio: { US: 30, NSE: 30, Crypto: 40, PYUSD: 0 },
  });

  for (const [body, mode] of [
    [{ feeling: 'I want to be safe but feel bullish' }, 'Safe'],
    [{ feeling: 'I am curious' }, 'Balanced'],
    [{ feeling: 'I feel bullish', mode: 'Safe' }, 'Safe'],
    [{}, 'Bold'],
  ]) {
    const result = await (await post('vibe', body)).json();
    assert.equal(result.mode, mode);
    assert.equal(Object.values(result.portfolio).reduce((total, weight) => total + weight, 0), 100);
  }
});

test('backtest preserves the default fixture and scales equity for other capital', async () => {
  const baseline = await (await post('backtest', {})).json();
  assert.equal(baseline.sharpe, 1.72);
  assert.equal(baseline.maxDD, -11.2);
  assert.deepEqual(baseline.equity, [1000, 1184, 1120, 1340, 1280]);
  const scaled = await (await post('backtest', { symbol: 'ETH-USDT', strategy: '10/30 MA', capital: 2000 })).json();
  assert.equal(scaled.symbol, 'ETH-USDT');
  assert.equal(scaled.strategy, '10/30 MA');
  assert.deepEqual(scaled.equity, baseline.equity.map(value => value * 2));
});

test('paper fills and recurring contributions return simulated results', async () => {
  const first = await (await post('paper', {})).json();
  assert.equal(first.nav, 1096.4);
  const second = await (await post('paper', { action: 'sell', qty: 0.02 })).json();
  assert.equal(second.fill.action, 'SELL');
  assert.equal(second.fill.qty, 0.02);
  assert.equal(second.nav, 1108.58);
  assert.deepEqual(await (await post('sip', { amount: 500 })).json(), {
    ok: true, amount: 500, frequency: 'monthly', method: 'UPI AutoPay', status: 'Approved',
  });
});

test('invalid input and malformed JSON receive structured errors', async () => {
  for (const [route, body] of [
    ['vibe', { feeling: 42 }], ['vibe', { mode: ['Safe'] }], ['vibe', []],
    ['backtest', { capital: 0 }], ['paper', { qty: true }], ['sip', { amount: -1 }],
  ]) {
    const response = await post(route, body);
    assert.equal(response.status, 400, route);
    assert.equal(typeof (await response.json()).error, 'string');
  }

  const malformed = await fetch(origin + '/api/vibe', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { error: 'Invalid JSON.' });

  const oversized = await post('vibe', { feeling: 'x'.repeat(17_000) });
  assert.equal(oversized.status, 413);
  const missing = await fetch(origin + '/api/not-found');
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: 'API route not found.' });
});
