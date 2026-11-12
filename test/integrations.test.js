const assert = require('node:assert/strict');
const { once } = require('node:events');
const { test } = require('node:test');
const { createApp } = require('../server');
const { createIntegrations } = require('../server/integrations');

async function withApp(integrations, run) {
  const server = createApp({ integrations }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port + '/api/';
  try {
    await run((route, body) => fetch(base + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }));
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('Vibe It uses a configured model only for opt-in prompts without a manual mode', async () => {
  let requests = 0;
  const integrations = createIntegrations({
    env: { AI_API_KEY: 'test-ai-key', AI_BASE_URL: 'https://provider.example/v1', AI_MODEL: 'test-model' },
    request: async (url, options) => {
      requests++;
      assert.equal(url, 'https://provider.example/v1/chat/completions');
      const body = JSON.parse(options.body);
      assert.equal(body.model, 'test-model');
      assert.equal(body.messages.at(-1).content, 'I feel curious');
      assert.equal(options.headers.Authorization, 'Bearer test-ai-key');
      return Response.json({ choices: [{ message: { content: '{"mode":"Safe"}' } }] });
    },
  });
  await withApp(integrations, async post => {
    const manual = await (await post('vibe', { feeling: 'I feel curious', mode: 'Bold', useAI: true })).json();
    assert.equal(manual.mode, 'Bold');
    const model = await (await post('vibe', { feeling: 'I feel curious', useAI: true })).json();
    assert.equal(model.mode, 'Safe');
    assert.equal(model.source, 'ai');
    assert.equal(model.portfolio.PYUSD, 20);
    assert.equal(requests, 1);
  });
});

test('missing integrations and invalid model output keep the offline path usable', async () => {
  const invalidModel = createIntegrations({
    env: { AI_API_KEY: 'test-ai-key' },
    request: async () => Response.json({ choices: [{ message: { content: '{"mode":"Unknown"}' } }] }),
  });
  await withApp(invalidModel, async post => {
    const result = await (await post('vibe', { feeling: 'I feel bullish on AI', useAI: true })).json();
    assert.equal(result.mode, 'Bold');
    assert.equal(result.source, 'rules');
    const missing = await post('paypal/sandbox/order', {});
    assert.equal(missing.status, 503);
  });
});

test('checkout creates a fixed $1 PayPal Sandbox order and performs no authorization or capture', async () => {
  const requests = [];
  const integrations = createIntegrations({
    env: { PAYPAL_CLIENT_ID: 'test-id', PAYPAL_CLIENT_SECRET: 'test-secret', APP_URL: 'https://demo.example' },
    request: async (url, options) => {
      requests.push(url);
      assert.equal(options.redirect, 'error');
      if (requests.length === 1) {
        assert.equal(options.body, 'grant_type=client_credentials');
        return Response.json({ access_token: 'test-token' });
      }
      const body = JSON.parse(options.body);
      assert.equal(body.intent, 'AUTHORIZE');
      assert.deepEqual(body.purchase_units[0].amount, { currency_code: 'USD', value: '1.00' });
      assert.match(options.headers['PayPal-Request-Id'], /^[0-9a-f-]{36}$/);
      assert.equal(body.payment_source.paypal.experience_context.return_url, 'https://demo.example/?sandbox=returned#sandbox-checkout');
      return Response.json({ id: 'TEST-ORDER', links: [{ rel: 'payer-action', href: 'https://www.sandbox.paypal.com/checkoutnow?token=TEST-ORDER' }] });
    },
  });
  await withApp(integrations, async post => {
    const response = await post('paypal/sandbox/order', { amount: 10000 });
    assert.equal(response.status, 201);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), {
      mode: 'sandbox', orderId: 'TEST-ORDER', approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=TEST-ORDER',
    });
  });
  assert.deepEqual(requests, [
    'https://api-m.sandbox.paypal.com/v1/oauth2/token',
    'https://api-m.sandbox.paypal.com/v2/checkout/orders',
  ]);
});

test('checkout rejects a non-sandbox approval URL without exposing provider data', async () => {
  const integrations = createIntegrations({
    env: { PAYPAL_CLIENT_ID: 'test-id', PAYPAL_CLIENT_SECRET: 'test-secret' },
    request: async url => Response.json(url.endsWith('/token')
      ? { access_token: 'test-token' }
      : { id: 'TEST-ORDER', links: [{ rel: 'approve', href: 'https://www.paypal.com/checkoutnow' }] }),
  });
  await withApp(integrations, async post => {
    const response = await post('paypal/sandbox/order', {});
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'PayPal Sandbox could not create the preview order.' });
  });
});
