async function request(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
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
      await onSubmit(new FormData(form), result);
      status.textContent = 'Demo result ready.';
      result.hidden = false;
    } catch (error) {
      status.dataset.error = '';
      status.textContent = error instanceof TypeError ? 'The demo server is unavailable. Start it with npm run dev and retry.' : error.message;
    } finally {
      button.disabled = false;
    }
  });
}

function setValues(container, values) {
  for (const [key, value] of Object.entries(values)) {
    container.querySelector('[data-value="' + key + '"]').textContent = value;
  }
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

demoForm('vibe', async (fields, result) => {
  const mode = fields.get('mode');
  const body = { feeling: fields.get('feeling') };
  if (mode) body.mode = mode;
  else body.useAI = true;
  const data = await request('/api/vibe', body);

  const source = mode ? 'Manually selected mode' : data.source === 'ai' ? 'AI-selected mode' : 'Rule-based demo mode';
  setValues(result, { mode: data.mode, feeling: data.feeling, source });
  for (const [asset, percent] of Object.entries(data.portfolio)) {
    setValues(result, { [asset]: percent + '%' });
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
});

demoForm('paper', async (fields, result) => {
  const data = await request('/api/paper', { action: fields.get('action') });
  setValues(result, {
    fill: data.fill.action + ' ' + data.fill.qty + ' ' + data.fill.symbol,
    nav: usd.format(data.nav),
  });
});

demoForm('sip', async (fields, result) => {
  const data = await request('/api/sip', { amount: Number(fields.get('amount')) });
  setValues(result, { status: data.status + ' (simulation)', amount: inr.format(data.amount) + ' / month' });
});

demoForm('sandbox', async (fields, result) => {
  const data = await request('/api/paypal/sandbox/order', {});
  setValues(result, { orderId: data.orderId });
  result.querySelector('#sandbox-approval').href = data.approvalUrl;
});

const sandboxReturn = document.getElementById('sandbox-return');
if (sandboxReturn) {
  const sandbox = new URLSearchParams(location.search).get('sandbox');
  if (sandbox === 'returned' || sandbox === 'cancelled') {
    sandboxReturn.textContent = sandbox === 'returned'
      ? 'Returned from PayPal Sandbox. This demo does not authorize or capture payments.'
      : 'The PayPal Sandbox preview was cancelled.';
    sandboxReturn.hidden = false;
  }
}
