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
      return Response.json({ choices: [{ message: { content: '{"mode":"Safe","reason":"The prompt expresses caution."}' } }] });
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
      const returnUrl = new URL(body.payment_source.paypal.experience_context.return_url);
      assert.equal(returnUrl.origin, 'https://demo.example');
      assert.equal(returnUrl.searchParams.get('sandbox'), 'returned');
      assert.ok(returnUrl.searchParams.get('state').startsWith(body.purchase_units[0].custom_id + '.'));
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

test('strict AI route prefers Gemini and returns a reason from the provider', async () => {
  const integrations = createIntegrations({
    env: { GEMINI_API_KEY: 'test-gemini', OPENAI_API_KEY: 'test-openai' },
    request: async (url, options) => {
      assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
      assert.equal(options.headers.Authorization, 'Bearer test-gemini');
      assert.equal(JSON.parse(options.body).messages.at(-1).content, 'I feel bullish on AI');
      return Response.json({ choices: [{ message: { content: '{"mode":"Bold","reason":"The prompt expresses bullish sentiment."}' } }] });
    },
  });
  await withApp(integrations, async post => {
    const response = await post('vibe-ai', {});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      feeling: 'I feel bullish on AI',
      mode: 'Bold',
      reason: 'The prompt expresses bullish sentiment.',
      provider: 'gemini',
      source: 'ai',
      portfolio: { US: 30, NSE: 30, Crypto: 40, PYUSD: 0 },
    });
  });
});

test('strict AI verification reports missing and failing providers', async () => {
  await withApp(createIntegrations({ env: {} }), async post => {
    const response = await post('vibe-ai', {});
    assert.equal(response.status, 503);
  });
  const integrations = createIntegrations({
    env: { OPENAI_API_KEY: 'test-openai', AI_BASE_URL: 'https://unused.example/v1' },
    request: async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/chat/completions');
      assert.equal(options.headers.Authorization, 'Bearer test-openai');
      return Response.json({}, { status: 403 });
    },
  });
  await withApp(integrations, async post => {
    assert.equal((await post('vibe-ai', {})).status, 502);
  });
});

test('PayPal verification route forwards the real provider status and enforces the fixed amount', async () => {
  let requests = 0;
  const integrations = createIntegrations({
    env: { PAYPAL_CLIENT_ID: 'test-id', PAYPAL_CLIENT_SECRET: 'test-secret' },
    request: async url => {
      requests++;
      return Response.json(url.endsWith('/token')
        ? { access_token: 'test-token' }
        : { id: 'TEST-ORDER', status: 'PAYER_ACTION_REQUIRED', links: [{ rel: 'payer-action', href: 'https://www.sandbox.paypal.com/checkoutnow?token=TEST-ORDER' }] });
    },
  });
  await withApp(integrations, async post => {
    assert.equal((await post('paypal/create-order', { amount: '5.00' })).status, 400);
    assert.equal(requests, 0);
    const response = await post('paypal/create-order', { amount: '1.00' });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      id: 'TEST-ORDER', status: 'PAYER_ACTION_REQUIRED', mode: 'sandbox',
      approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=TEST-ORDER',
    });
  });
});

test('PayPal return verifies the app order without authorizing or exposing buyer data', async () => {
  const orderId = 'SB1234';
  let returnState;
  let nonce;
  let reads = 0;
  let differentOrder = false;
  const integrations = createIntegrations({
    env: { PAYPAL_CLIENT_ID: 'test-id', PAYPAL_CLIENT_SECRET: 'test-secret', APP_URL: 'https://demo.example' },
    request: async (url, options) => {
      if (url.endsWith('/token')) return Response.json({ access_token: 'test-token' });
      if (options.method === 'POST') {
        const body = JSON.parse(options.body);
        nonce = body.purchase_units[0].custom_id;
        returnState = new URL(body.payment_source.paypal.experience_context.return_url).searchParams.get('state');
        return Response.json({ id: orderId, links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=SB1234' }] });
      }
      assert.equal(options.method, 'GET');
      assert.equal(url, 'https://api-m.sandbox.paypal.com/v2/checkout/orders/' + orderId);
      reads++;
      return Response.json({
        id: orderId,
        intent: 'AUTHORIZE',
        status: 'APPROVED',
        purchase_units: [{ custom_id: differentOrder ? 'different' : nonce, amount: { currency_code: 'USD', value: '1.00' } }],
        payer: { email_address: 'buyer@example.invalid' },
      });
    },
  });

  await withApp(integrations, async post => {
    assert.equal((await post('paypal/sandbox/order', {})).status, 201);
    assert.equal((await post('paypal/sandbox/verify', { orderId, state: 'tampered' })).status, 400);
    assert.equal((await post('paypal/sandbox/verify', { orderId: '../wrong', state: returnState })).status, 400);
    assert.equal(reads, 0);

    const verified = await post('paypal/sandbox/verify', { orderId, state: returnState });
    assert.equal(verified.status, 200);
    assert.deepEqual(await verified.json(), {
      mode: 'sandbox', orderId, status: 'APPROVED', amount: { currency_code: 'USD', value: '1.00' },
    });
    assert.equal(reads, 1);

    differentOrder = true;
    assert.equal((await post('paypal/sandbox/verify', { orderId, state: returnState })).status, 422);
  });
});
