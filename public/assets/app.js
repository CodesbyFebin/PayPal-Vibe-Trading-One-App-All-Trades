async function request(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'The request could not be completed.');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function demoForm(id, onSubmit) {
  const form = document.getElementById(id);
  if (!form) return;

  const button = form.querySelector('button[type="submit"]');
  const status = document.getElementById(id + '-status');
  const result = document.getElementById(id + '-result');

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled) return;
    button.disabled = true;
    result.hidden = true;
    delete status.dataset.error;
    status.textContent = 'Loading demo result…';
    try {
      const message = await onSubmit(new FormData(form), result);
      status.textContent = typeof message === 'string' ? message : 'Demo result ready.';
      result.hidden = false;
    } catch (error) {
      status.dataset.error = '';
      status.textContent = error instanceof TypeError ? 'The demo server is unavailable. Start it with npm run dev and retry.' : error.message;
    } finally {
      button.disabled = false;
    }
  });
  button.disabled = false;
}

function setValues(container, values) {
  for (const [key, value] of Object.entries(values)) {
    container.querySelector('[data-value="' + key + '"]').textContent = value;
  }
}

async function getData(path) {
  const response = await fetch(path, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

demoForm('vibe', async (fields, result) => {
  const mode = fields.get('mode');
  const body = { feeling: fields.get('feeling') };
  if (mode) body.mode = mode;
  else body.useAI = true;
  const data = await request('/api/vibe', body);

  const source = mode ? 'Manually selected mode'
    : data.source === 'ai' ? 'AI-selected mode (' + data.provider + ')' : 'Rule-based demo mode';
  setValues(result, { mode: data.mode, feeling: data.feeling, source, reason: data.reason || '' });
  const marketLine = result.querySelector('[data-value="market"]');
  if (marketLine) marketLine.textContent = (data.market || []).filter(item => item.price).map(item => item.symbol + ' ' + usd.format(item.price) + (item.stale ? ' · cached' : ' · live')).join(' | ');
  for (const [asset, percent] of Object.entries(data.portfolio)) {
    setValues(result, { [asset]: percent + '%' });
    result.querySelector('[data-meter="' + asset + '"]').value = percent;
  }
});

function drawEquity(canvas, equity) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const padding = 28;
  const min = Math.min(...equity);
  const range = Math.max(...equity) - min || 1;
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = '#ced9eb';
  ctx.lineWidth = 1;
  for (let line = 0; line < 4; line++) {
    const y = padding + line * (height - 2 * padding) / 3;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  ctx.beginPath();
  equity.forEach((value, index) => {
    const x = padding + index * (width - 2 * padding) / (equity.length - 1);
    const y = height - padding - (value - min) * (height - 2 * padding) / range;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#003087';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

demoForm('backtest', async (fields, result) => {
  const prompt = fields.get('prompt').trim();
  const symbol = prompt.match(/\b[A-Z0-9]{2,10}-(?:USDT|USD|INR)\b/i)?.[0].toUpperCase();
  const strategy = prompt.match(/\b\d{1,3}\s*\/\s*\d{1,3}\s*(?:MA|moving averages?)\b/i)?.[0];
  const data = await request('/api/backtest', { symbol, strategy, capital: Number(fields.get('capital')) });

  setValues(result, {
    symbol: data.symbol + ' · ' + data.strategy,
    sharpe: data.sharpe.toFixed(2),
    drawdown: data.maxDD + '%',
    winRate: data.winRate + '%',
    equity: data.equity.map(value => usd.format(value)).join(' → '),
  });
  drawEquity(result.querySelector('canvas'), data.equity);
  const source = result.querySelector('[data-value="backtest-source"]');
  if (source) source.textContent = data.source + ' · ' + data.period.candles + ' daily candles · ' + data.period.from.slice(0, 10) + ' to ' + data.period.to.slice(0, 10) + ' · 10 bps per side';
});

demoForm('paper', async (fields, result) => {
  const data = await request('/api/paper', {
    action: fields.get('action'),
    symbol: fields.get('symbol'),
    qty: Number(fields.get('qty')),
    context: fields.get('context'),
  });
  if (data.guard && data.guard.decision === 'REQUIRE_APPROVAL') {
    setValues(result, {
      fill: 'Awaiting owner approval · ' + data.guard.trade.action + ' ' + data.guard.trade.qty + ' ' + data.guard.trade.symbol,
      cost: usd.format(data.guard.trade.notional) + ' · not executed',
      cash: 'Unchanged',
      nav: 'Unchanged',
      decision: 'REQUIRE_APPROVAL',
    });
    await refreshGuardStatus();
    return 'Owner approval required. No paper fill was created.';
  }
  setValues(result, {
    fill: data.fill.action + ' ' + data.fill.qty + ' ' + data.fill.symbol + ' @ ' + usd.format(data.fill.price),
    cost: usd.format(data.fill.notional) + ' notional · ' + usd.format(data.fill.fee) + ' fee',
    cash: usd.format(data.account.cash),
    nav: usd.format(data.nav),
    decision: data.guard.decision,
  });
  await refreshGuardStatus();
  return 'Guard ALLOW · paper fill recorded. Read-only market quote: ' + data.fill.priceSource + (data.fill.priceStale ? ' (cached)' : ' (live)') + '.';
});

async function refreshGuardStatus() {
  const status = document.getElementById('guard-status');
  if (!status) return;
  try {
    const response = await fetch('/api/guard/status', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Guard status unavailable.');
    document.getElementById('guard-signature').textContent = data.mandate.signatureValid ? 'VALID · Ed25519' : 'INVALID';
    document.getElementById('guard-kill-switch').textContent = data.killSwitch ? 'FROZEN' : 'OFF';
    document.getElementById('guard-daily').textContent = usd.format(data.limits.dailyNotional) + ' / ' + usd.format(data.limits.maxDailyNotional);
    document.getElementById('guard-audit').textContent = data.audit.chainValid ? 'VALID · ' + data.audit.events + ' events' : 'CHAIN INVALID';
    status.textContent = 'Paper-only mandate · expires ' + new Date(data.mandate.expiresAt).toLocaleString();
    const container = document.getElementById('guard-approvals');
    container.replaceChildren();
    if (!data.pendingApprovals.length) {
      container.textContent = 'No pending approvals.';
    } else {
      for (const approval of data.pendingApprovals) {
        const card = document.createElement('div');
        const detail = document.createElement('p');
        detail.textContent = approval.trade.action + ' ' + approval.trade.qty + ' ' + approval.trade.symbol
          + ' · ' + usd.format(approval.trade.notional) + ' · ' + approval.status;
        const hash = document.createElement('code');
        hash.textContent = approval.payloadHash;
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Approve exact trade payload';
        button.addEventListener('click', async () => {
          const pin = document.getElementById('owner-pin').value;
          button.disabled = true;
          try {
            const response = await fetch('/api/guard/approve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-owner-pin': pin },
              body: JSON.stringify({ approvalId: approval.approvalId, payloadHash: approval.payloadHash }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Approval failed.');
            const executionResponse = await fetch('/api/paper', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: approval.trade.action,
                symbol: approval.trade.symbol,
                qty: approval.trade.qty,
                context: approval.trade.context,
                approvalId: approval.approvalId,
              }),
            });
            const execution = await executionResponse.json();
            if (!executionResponse.ok) throw new Error(execution.error || 'Approved paper trade could not execute.');
            status.textContent = 'Owner approved the exact payload. Paper fill recorded: '
              + execution.fill.action + ' ' + execution.fill.qty + ' ' + execution.fill.symbol
              + ' · NAV ' + usd.format(execution.nav) + '.';
            const paperStatus = document.getElementById('paper-status');
            if (paperStatus) paperStatus.textContent = status.textContent;
          } catch (error) {
            status.textContent = error.message;
          } finally {
            button.disabled = false;
            await refreshGuardStatus();
          }
        });
        card.append(detail, hash, button);
        container.append(card);
      }
    }
  } catch (error) {
    status.textContent = error.message;
  }
}

async function changeGuardFreeze(enabled) {
  const status = document.getElementById('guard-status');
  const pin = document.getElementById('owner-pin').value;
  try {
    const response = await fetch('/api/guard/kill-switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-owner-pin': pin },
      body: JSON.stringify({ enabled }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Owner control failed.');
    status.textContent = enabled ? 'Kill switch enabled. Paper execution is frozen.' : 'Kill switch disabled by owner.';
  } catch (error) {
    status.textContent = error.message;
  }
  await refreshGuardStatus();
}

const guardFreeze = document.getElementById('guard-freeze');
if (guardFreeze) {
  guardFreeze.addEventListener('click', () => changeGuardFreeze(true));
  document.getElementById('guard-resume').addEventListener('click', () => changeGuardFreeze(false));
  document.getElementById('guard-refresh').addEventListener('click', refreshGuardStatus);
  refreshGuardStatus();
}

demoForm('sip', async (fields, result) => {
  const data = await request('/api/sip', { amount: Number(fields.get('amount')) });
  setValues(result, { status: data.status, amount: inr.format(data.amount) + ' / month' });
});

demoForm('sandbox', async (fields, result) => {
  const data = await request('/api/paypal/sandbox/order', {});
  setValues(result, { orderId: data.orderId });
  result.querySelector('#sandbox-approval').href = data.approvalUrl;
});

const BRAINTREE_DROPIN_SRC = 'https://js.braintreegateway.com/web/dropin/1.46.0/js/dropin.min.js';
let braintreeScriptPromise;

function loadBraintreeDropin() {
  if (window.braintree && window.braintree.dropin) return Promise.resolve();
  if (braintreeScriptPromise) return braintreeScriptPromise;
  braintreeScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-braintree-dropin]');
    const script = existing || document.createElement('script');
    script.src = BRAINTREE_DROPIN_SRC;
    script.async = true;
    script.dataset.braintreeDropin = 'true';
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => {
      braintreeScriptPromise = null;
      reject(new Error('Braintree secure checkout library did not load. Reload the page and retry.'));
    }, { once: true });
    if (!existing) document.head.appendChild(script);
  });
  return braintreeScriptPromise;
}

const braintreeForm = document.getElementById('braintree-checkout');
if (braintreeForm) {
  const braintreeButton = document.getElementById('braintree-submit');
  const braintreeStatus = document.getElementById('braintree-status');
  const braintreeResult = document.getElementById('braintree-result');
  let braintreeDropin;

  async function initializeBraintree() {
    try {
      const tokenResponse = await request('/api/braintree/client-token', {});
      await loadBraintreeDropin();
      if (!window.braintree || !window.braintree.dropin) {
        throw new Error('Braintree secure checkout library did not initialize.');
      }
      if (tokenResponse.mode !== 'sandbox' || typeof tokenResponse.clientToken !== 'string') {
        throw new Error('Braintree Sandbox did not return a valid client token.');
      }
      braintreeDropin = await window.braintree.dropin.create({
        authorization: tokenResponse.clientToken,
        container: '#braintree-dropin',
        paypal: {
          flow: 'checkout',
          amount: '1.00',
          currency: 'USD',
        },
      });
      braintreeButton.disabled = false;
      braintreeButton.textContent = 'Submit USD $1.00 Sandbox transaction';
      braintreeStatus.textContent = 'Braintree Sandbox is ready. Use a Sandbox test payment method.';
    } catch (error) {
      braintreeStatus.dataset.error = '';
      braintreeStatus.textContent = error instanceof TypeError
        ? 'The demo server is unavailable. Start the app and retry.'
        : error.message;
      braintreeButton.disabled = true;
      braintreeButton.textContent = 'Sandbox checkout unavailable';
    }
  }

  braintreeForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!braintreeDropin || braintreeButton.disabled) return;
    braintreeButton.disabled = true;
    braintreeResult.hidden = true;
    delete braintreeStatus.dataset.error;
    braintreeStatus.textContent = 'Tokenizing payment details with Braintree…';
    try {
      const payment = await braintreeDropin.requestPaymentMethod();
      const transaction = await request('/api/braintree/checkout', {
        paymentMethodNonce: payment.nonce,
        deviceData: payment.deviceData,
      });
      document.getElementById('braintree-transaction-id').textContent = transaction.id;
      document.getElementById('braintree-transaction-status').textContent = transaction.status;
      document.getElementById('braintree-transaction-amount').textContent = transaction.amount;
      document.getElementById('braintree-transaction-currency').textContent = transaction.currencyIsoCode;
      braintreeResult.hidden = false;
      braintreeStatus.textContent = 'Braintree Sandbox transaction submitted. Confirm its final state in the Sandbox Control Panel.';
      braintreeButton.textContent = 'Sandbox transaction submitted';
      await braintreeDropin.teardown();
      braintreeDropin = null;
    } catch (error) {
      braintreeStatus.dataset.error = '';
      braintreeStatus.textContent = error instanceof TypeError
        ? 'The demo server is unavailable. Check the server and retry.'
        : error.message;
      braintreeButton.disabled = false;
    }
  });

  initializeBraintree();
  window.addEventListener('pagehide', () => {
    if (braintreeDropin) braintreeDropin.teardown().catch(() => undefined);
  }, { once: true });
}

const idea = document.getElementById('feeling');
for (const button of document.querySelectorAll('[data-prompt]')) {
  button.addEventListener('click', () => {
    idea.value = button.dataset.prompt;
    idea.focus();
  });
}

const integrationStatus = document.getElementById('integration-status');
if (integrationStatus) {
  fetch('/api/demo/status').then(response => {
    if (!response.ok) throw new Error('Demo status unavailable');
    return response.json();
  }).then(status => {
    const ai = status.runtimeAi ? 'AI provider configured' : 'Rule-based portfolio demo';
    const braintree = status.braintreeSandbox ? 'Braintree Sandbox configured' : 'Braintree Sandbox setup required';
    integrationStatus.textContent = ai + ' · ' + braintree;
    integrationStatus.hidden = false;
  }).catch(() => {});
}

const sandboxReturn = document.getElementById('sandbox-return');
if (sandboxReturn) {
  const params = new URLSearchParams(location.search);
  const sandbox = params.get('sandbox');
  if (sandbox === 'returned' || sandbox === 'cancelled') {
    history.replaceState(null, '', '/#sandbox-checkout');
    document.getElementById('sandbox-checkout').scrollIntoView();
    sandboxReturn.hidden = false;
    if (sandbox === 'cancelled') {
      sandboxReturn.textContent = 'The PayPal Sandbox preview was cancelled.';
    } else {
      sandboxReturn.textContent = 'Checking the returned order with PayPal Sandbox…';
      request('/api/paypal/sandbox/verify', { orderId: params.get('token'), state: params.get('state') })
        .then(order => {
          sandboxReturn.textContent = 'PayPal Sandbox verified order ' + order.orderId + ' · '
            + order.status + ' · USD $' + order.amount.value + '.';
        })
        .catch(error => {
          sandboxReturn.dataset.error = '';
          sandboxReturn.textContent = error.message;
        });
    }
  }
}


async function refreshMarketPanel() {
  const panel = document.getElementById('market-prices');
  if (!panel) return;
  const status = document.getElementById('market-prices-status');
  try {
    const data = await getData('/api/market/prices');
    const container = document.getElementById('market-price-cards');
    container.replaceChildren();
    for (const quote of data.prices) {
      const card = document.createElement('div');
      card.className = 'market-quote';
      const heading = document.createElement('strong');
      heading.textContent = quote.symbol;
      const value = document.createElement('p');
      value.textContent = quote.price ? usd.format(quote.price) : 'Unavailable';
      const meta = document.createElement('small');
      meta.textContent = quote.price
        ? quote.source + ' · ' + new Date(quote.fetchedAt).toLocaleTimeString() + (quote.stale ? ' · CACHED, NOT LIVE' : ' · LIVE')
        : quote.error;
      card.append(heading, value, meta);
      container.append(card);
    }
    status.textContent = 'Read-only feed · refreshed ' + new Date(data.fetchedAt).toLocaleTimeString() + ' · cached quotes are labelled.';
  } catch (error) {
    status.textContent = 'Market feed unavailable: ' + error.message;
  }
}

if (document.getElementById('market-prices')) {
  refreshMarketPanel();
  window.setInterval(refreshMarketPanel, 15000);
}
