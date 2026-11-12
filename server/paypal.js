// Adapted from PayPal-Vibe (e32bb2f), src/lib/paypal.ts.
const { createHmac, randomUUID, timingSafeEqual } = require('node:crypto');

const SANDBOX_API = 'https://api-m.sandbox.paypal.com';
const APPROVAL_ORIGINS = new Set(['https://www.sandbox.paypal.com', 'https://sandbox.paypal.com']);
const ORDER_STATUSES = new Set(['CREATED', 'SAVED', 'APPROVED', 'VOIDED', 'COMPLETED', 'PAYER_ACTION_REQUIRED']);
const ORDER_AMOUNT = { currency_code: 'USD', value: '1.00' };

function createPayPal({ env, jsonRequest, configuredOrigin }) {
  const paypalConfigured = Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET);

  function sign(payload) {
    return createHmac('sha256', env.PAYPAL_CLIENT_SECRET)
      .update('vibe-sandbox-order:' + payload).digest('base64url');
  }

  function parseReturnState(state) {
    if (typeof state !== 'string' || state.length > 110) return null;
    const [nonce, expires, signature, extra] = state.split('.');
    if (extra !== undefined || !/^[0-9a-f-]{36}$/.test(nonce) || !/^\d{13}$/.test(expires)
      || !/^[\w-]{43}$/.test(signature) || Number(expires) <= Date.now()) return null;
    const expected = sign(nonce + '.' + expires);
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? nonce : null;
  }

  async function accessToken() {
    const basic = Buffer.from(env.PAYPAL_CLIENT_ID + ':' + env.PAYPAL_CLIENT_SECRET).toString('base64');
    const token = await jsonRequest(SANDBOX_API + '/v1/oauth2/token', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + basic, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    if (typeof token.access_token !== 'string' || !token.access_token) throw new Error('PayPal token missing.');
    return token.access_token;
  }

  async function createSandboxOrder() {
    const host = env.VERCEL_ENV === 'production'
      ? env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL
      : env.VERCEL_URL || env.VERCEL_PROJECT_PRODUCTION_URL;
    const app = configuredOrigin(env.APP_URL || (host ? 'https://' + host : 'http://localhost:' + (env.PORT || 3000)));
    const nonce = randomUUID();
    const payload = nonce + '.' + (Date.now() + 30 * 60_000);
    const returnUrl = new URL('/?sandbox=returned', app);
    returnUrl.searchParams.set('state', payload + '.' + sign(payload));
    const token = await accessToken();

    const order = await jsonRequest(SANDBOX_API + '/v2/checkout/orders', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': nonce,
      },
      body: JSON.stringify({
        intent: 'AUTHORIZE',
        purchase_units: [{
          custom_id: nonce,
          description: 'PayPal Vibe Trading sandbox preview',
          amount: ORDER_AMOUNT,
        }],
        payment_source: {
          paypal: {
            experience_context: {
              user_action: 'CONTINUE',
              return_url: returnUrl.href,
              cancel_url: new URL('/?sandbox=cancelled#sandbox-checkout', app).href,
            },
          },
        },
      }),
    });

    const href = order.links?.find(link => link.rel === 'payer-action' || link.rel === 'approve')?.href;
    const approval = new URL(href);
    if (!APPROVAL_ORIGINS.has(approval.origin) || approval.username || approval.password || typeof order.id !== 'string' || !order.id) {
      throw new Error('PayPal returned an invalid sandbox order.');
    }
    return { mode: 'sandbox', orderId: order.id, approvalUrl: approval.href, status: order.status };
  }

  async function verifySandboxOrder(orderId, nonce) {
    const token = await accessToken();
    const order = await jsonRequest(SANDBOX_API + '/v2/checkout/orders/' + orderId, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token },
    });
    const unit = order.purchase_units?.[0];
    if (order.id !== orderId || order.intent !== 'AUTHORIZE' || order.purchase_units?.length !== 1
      || unit?.custom_id !== nonce || unit?.amount?.currency_code !== ORDER_AMOUNT.currency_code
      || unit?.amount?.value !== ORDER_AMOUNT.value || !ORDER_STATUSES.has(order.status)) {
      return null;
    }

    return { mode: 'sandbox', orderId, status: order.status, amount: ORDER_AMOUNT };
  }

  return { paypalConfigured, createSandboxOrder, parseReturnState, verifySandboxOrder };
}

module.exports = { createPayPal };
