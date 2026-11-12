const express = require('express');
const cors = require('cors');
const path = require('node:path');
const { createIntegrations } = require('./integrations');
const { createTradingGuard } = require('./guard');

const root = path.join(__dirname, '..');
const allocations = {
  Safe: { US: 30, NSE: 40, Crypto: 10, PYUSD: 20 },
  Balanced: { US: 30, NSE: 30, Crypto: 15, PYUSD: 25 },
  Bold: { US: 30, NSE: 30, Crypto: 40, PYUSD: 0 },
};

function textField(value, fallback, maxLength) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.length > maxLength) return null;
  return value.trim() || fallback;
}

function positiveNumber(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function requestBudget(max) {
  let resetAt = 0;
  let used = 0;
  return () => {
    const now = Date.now();
    if (now >= resetAt) {
      resetAt = now + 60_000;
      used = 0;
    }
    if (used >= max) return false;
    used++;
    return true;
  };
}

function createApp({ integrations = createIntegrations(), app = express(), ownerPin = process.env.OWNER_PIN } = {}) {
  const guard = createTradingGuard({ ownerPin });
  const paperAccount = { cashCents: 1_000_000, positions: Object.create(null) };
  const paperPrices = { 'BTC-USDT': 97240, 'ETH-USDT': 3450 }; // Fixed fixtures; no live market feed.
  const allowGuardControl = requestBudget(12);
  const allowAi = requestBudget(12);
  const allowOrder = requestBudget(6);
  const allowVerification = requestBudget(12);
  const allowBraintreeToken = requestBudget(12);
  const allowBraintreeCheckout = requestBudget(6);

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('Content-Security-Policy', "default-src 'self'; script-src 'self' https://js.braintreegateway.com https://www.paypal.com https://*.paypal.com https://*.paypalobjects.com https://*.braintreegateway.com https://*.braintree-api.com; style-src 'self' 'unsafe-inline' https://*.braintreegateway.com; img-src 'self' data: blob: https://*.paypal.com https://*.paypalobjects.com https://*.braintreegateway.com; font-src 'self' data: https://*.braintreegateway.com; connect-src 'self' https://*.paypal.com https://*.paypalobjects.com https://*.braintreegateway.com https://*.braintree-api.com; frame-src https://*.paypal.com https://*.braintreegateway.com https://*.cardinalcommerce.com; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self' https://*.paypal.com");
    next();
  });

  app.use('/api', cors(), express.json({ limit: '16kb' }));
  app.post('/api/*', (req, res, next) => {
    if (req.body == null || Array.isArray(req.body) || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Send a JSON object.' });
    }
    next();
  });

  app.get('/api/health', (req, res) => res.json({ ok: true, service: 'paypal-vibe' }));

  app.get('/api/demo/status', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
      paypalSandbox: integrations.paypalConfigured,
      braintreeSandbox: integrations.braintreeConfigured,
      runtimeAi: integrations.aiConfigured,
    });
  });

  app.post('/api/braintree/client-token', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!integrations.braintreeConfigured) return res.status(503).json({ error: 'Braintree Sandbox credentials are not configured.' });
    if (!allowBraintreeToken()) return res.status(429).json({ error: 'Braintree token service is busy. Try again in a minute.' });
    try {
      const clientToken = await integrations.createClientToken();
      res.json({ mode: 'sandbox', clientToken });
    } catch {
      res.status(502).json({ error: 'Braintree Sandbox could not create a client token.' });
    }
  });

  app.post('/api/braintree/checkout', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!integrations.braintreeConfigured) return res.status(503).json({ error: 'Braintree Sandbox credentials are not configured.' });
    const paymentMethodNonce = req.body.paymentMethodNonce;
    const deviceData = req.body.deviceData;
    if (typeof paymentMethodNonce !== 'string' || !paymentMethodNonce.trim() || paymentMethodNonce.length > 2048
      || /[\u0000-\u001f\u007f]/.test(paymentMethodNonce)
      || (deviceData !== undefined && (typeof deviceData !== 'string' || deviceData.length > 16000))) {
      return res.status(400).json({ error: 'A valid tokenized payment method nonce is required.' });
    }
    if (!allowBraintreeCheckout()) return res.status(429).json({ error: 'Braintree checkout is busy. Try again in a minute.' });
    try {
      const result = await integrations.createSandboxTransaction(paymentMethodNonce.trim(), deviceData);
      if (!result.success) return res.status(422).json({ error: 'Braintree Sandbox did not approve the test transaction.' });
      res.status(201).json({ mode: 'sandbox', ...result.transaction });
    } catch {
      res.status(502).json({ error: 'Braintree Sandbox could not process the test transaction.' });
    }
  });

  app.post('/api/vibe', async (req, res) => {
    const feeling = textField(req.body.feeling, 'I feel bullish on AI', 240);
    const selectedMode = req.body.mode;
    if (feeling === null) {
      return res.status(400).json({ error: 'Feeling must be text up to 240 characters.' });
    }
    if (selectedMode !== undefined && (typeof selectedMode !== 'string' || !Object.hasOwn(allocations, selectedMode))) {
      return res.status(400).json({ error: 'Choose Safe, Balanced, or Bold.' });
    }

    let mode = selectedMode ?? 'Balanced';
    if (selectedMode === undefined) {
      const prompt = feeling.toLowerCase();
      if (/scared|safe/.test(prompt)) mode = 'Safe';
      else if (/bullish|bold/.test(prompt)) mode = 'Bold';
    }

    let source = 'rules';
    let classification;
    const wantsAi = req.body.useAI === true && selectedMode === undefined;
    if (wantsAi && integrations.aiConfigured && allowAi()) {
      try {
        classification = await integrations.classifyVibe(feeling);
        mode = classification.mode;
        source = 'ai';
      } catch {
        // The existing rules remain available when the provider is unavailable.
      }
    }
    res.json({ feeling, mode, portfolio: allocations[mode], ...(wantsAi ? { source } : {}), ...(classification ? { reason: classification.reason, provider: classification.provider } : {}) });
  });

  app.post('/api/vibe-ai', async (req, res) => {
    const feeling = textField(req.body.feeling, 'I feel bullish on AI', 240);
    if (feeling === null) return res.status(400).json({ error: 'Feeling must be text up to 240 characters.' });
    if (!integrations.aiConfigured) return res.status(503).json({ error: 'AI credentials are not configured.' });
    if (!allowAi()) return res.status(429).json({ error: 'The AI demo is busy. Try again in a minute.' });
    try {
      const classification = await integrations.classifyVibe(feeling);
      res.json({ feeling, ...classification, source: 'ai', portfolio: allocations[classification.mode] });
    } catch {
      res.status(502).json({ error: 'The AI provider could not classify this prompt.' });
    }
  });

  app.post(['/api/paypal/sandbox/order', '/api/paypal/create-order'], async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const alias = req.path === '/api/paypal/create-order';
    if (alias && req.body.amount !== undefined && ![1, '1', '1.0', '1.00'].includes(req.body.amount)) {
      return res.status(400).json({ error: 'The sandbox preview amount is fixed at USD $1.00.' });
    }
    if (!integrations.paypalConfigured) {
      return res.status(503).json({ error: 'PayPal Sandbox credentials are not configured.' });
    }
    if (!allowOrder()) {
      return res.status(429).json({ error: 'The sandbox demo is busy. Try again in a minute.' });
    }
    try {
      const { mode, orderId, approvalUrl, status } = await integrations.createSandboxOrder();
      res.status(201).json(alias ? { id: orderId, status, mode, approvalUrl } : { mode, orderId, approvalUrl });
    } catch {
      res.status(502).json({ error: 'PayPal Sandbox could not create the preview order.' });
    }
  });

  app.post('/api/paypal/sandbox/verify', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!integrations.paypalConfigured) return res.status(503).json({ error: 'PayPal Sandbox credentials are not configured.' });

    const { orderId, state } = req.body;
    const nonce = integrations.parseReturnState(state);
    if (typeof orderId !== 'string' || !/^[A-Z0-9]{1,36}$/.test(orderId) || !nonce) {
      return res.status(400).json({ error: 'This checkout return is invalid or has expired. Start a new sandbox order.' });
    }
    if (!allowVerification()) return res.status(429).json({ error: 'Sandbox verification is busy. Try again in a minute.' });
    try {
      const order = await integrations.verifySandboxOrder(orderId, nonce);
      if (!order) return res.status(422).json({ error: 'PayPal did not return a matching USD $1 sandbox order.' });
      res.json(order);
    } catch {
      res.status(502).json({ error: 'PayPal Sandbox could not verify the order.' });
    }
  });

  app.post('/api/backtest', (req, res) => {
    const symbol = textField(req.body.symbol, 'BTC-USDT', 32);
    const strategy = textField(req.body.strategy, '20/50 MA', 80);
    const capital = positiveNumber(req.body.capital, 1000);
    if (symbol === null || strategy === null || capital === null || capital > 1_000_000) {
      return res.status(400).json({ error: 'Use a valid symbol, strategy, and starting capital up to 1,000,000.' });
    }

    // Scale the supplied sample curve. No market data is fetched.
    const equity = [1000, 1184, 1120, 1340, 1280].map(value => Math.round(value * capital / 10) / 100);
    res.json({ symbol, strategy, returnPct: 24.6, sharpe: 1.72, maxDD: -11.2, winRate: 57, trades: 42, equity });
  });

  app.get('/api/portfolio', (req, res) => {
    res.json({
      holdings: [{ name: 'NIFTY', w: 40 }, { name: 'US AI', w: 30 }, { name: 'Crypto', w: 15 }, { name: 'PYUSD', w: 15 }],
      var95: -2.1,
      sharpe: 1.62,
      maxDD: -8.2,
    });
  });

  app.get('/api/guard/status', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(guard.getStatus());
  });

  app.post('/api/guard/approve', (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!allowGuardControl()) return res.status(429).json({ error: 'Owner control is busy. Try again in a minute.' });
    const result = guard.approve({
      approvalId: req.body.approvalId,
      payloadHash: req.body.payloadHash,
    }, req.get('x-owner-pin'));
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json(result);
  });

  app.post('/api/guard/kill-switch', (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!allowGuardControl()) return res.status(429).json({ error: 'Owner control is busy. Try again in a minute.' });
    const result = guard.setKillSwitch(req.body.enabled, req.get('x-owner-pin'));
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json(result);
  });

  app.post('/api/paper', (req, res) => {
    const symbol = textField(req.body.symbol, 'BTC-USDT', 32)?.toUpperCase();
    const action = textField(req.body.action, 'BUY', 4)?.toUpperCase();
    const qty = positiveNumber(req.body.qty, 0.01);
    const context = textField(req.body.context, '', 500);
    const approvalId = textField(req.body.approvalId, '', 64);
    if (!symbol || !['BUY', 'SELL'].includes(action) || qty === null || context === null) {
      return res.status(400).json({ error: 'Enter an allowed symbol, BUY or SELL, and a positive quantity.' });
    }

    const price = paperPrices[symbol];
    const decision = guard.evaluate({ action, symbol, qty, price, context, ...(approvalId ? { approvalId } : {}) });
    if (decision.decision === 'DENY') {
      return res.status(403).json({ error: 'Trading Guard denied this paper trade.', guard: decision });
    }
    if (decision.decision === 'REQUIRE_APPROVAL') {
      return res.status(202).json({ message: 'Owner approval is required before this paper trade can execute.', guard: decision });
    }

    const notional = Number((qty * price).toFixed(2));
    const fee = Number((notional * 0.001).toFixed(2));
    const currentQty = paperAccount.positions[symbol] || 0;
    if (action === 'BUY') {
      const costCents = Math.round((notional + fee) * 100);
      if (costCents > paperAccount.cashCents) {
        return res.status(409).json({ error: 'Insufficient paper cash for this order including the simulated fee.' });
      }
      paperAccount.cashCents -= costCents;
      paperAccount.positions[symbol] = Number((currentQty + qty).toFixed(8));
    } else {
      if (currentQty + 1e-10 < qty) {
        return res.status(409).json({ error: 'Insufficient paper position to sell this quantity.' });
      }
      const proceedsCents = Math.round((notional - fee) * 100);
      paperAccount.cashCents += proceedsCents;
      paperAccount.positions[symbol] = Number(Math.max(0, currentQty - qty).toFixed(8));
    }

    const positionValue = Object.entries(paperAccount.positions).reduce((total, [asset, amount]) => {
      return total + amount * (paperPrices[asset] || 0);
    }, 0);
    const nav = Number((paperAccount.cashCents / 100 + positionValue).toFixed(2));
    guard.recordFill({ action, symbol, qty, notional });
    res.json({
      fill: { action, symbol, qty, price, notional, fee, feeRateBps: 10, priceSource: 'fixed-demo-fixture' },
      account: { cash: Number((paperAccount.cashCents / 100).toFixed(2)), positions: paperAccount.positions, nav },
      nav,
      guard: { decision: 'ALLOW', reasons: decision.reasons },
      disclaimer: 'Paper-only execution with a fixed demo price; not a live market order.',
    });
  });

  app.post('/api/sip', (req, res) => {
    const amount = positiveNumber(req.body.amount, 500);
    if (amount === null || amount > 1_000_000) {
      return res.status(400).json({ error: 'Enter a monthly contribution between ₹1 and ₹10,00,000.' });
    }
    if (amount < 1) {
      return res.status(400).json({ error: 'The minimum demo contribution is ₹1.' });
    }
    res.json({ ok: true, amount, frequency: 'monthly', method: 'UPI AutoPay', status: 'Approved' });
  });

  app.get('/api/alphas', (req, res) => res.json([
    { name: 'GTJA 001', ic: 0.052, sharpe: 1.82 },
    { name: 'Alpha101 004', ic: 0.041, sharpe: 1.44 },
  ]));
  app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));

  app.use(express.static(path.join(root, 'public')));

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON.' });
    console.error(error);
    res.status(500).json({ error: 'The demo could not process the request.' });
  });

  return app;
}

if (require.main === module) {
  const port = process.env.PORT || 3000;
  createApp().listen(port, () => console.log('PayPal Vibe demo listening on port ' + port));
}

module.exports = { createApp };
