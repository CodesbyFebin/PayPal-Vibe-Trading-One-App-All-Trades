// Adapted from PayPal-Vibe (e32bb2f), src/lib/paypal.ts.
const { randomUUID } = require('node:crypto');

const SANDBOX_API = 'https://api-m.sandbox.paypal.com';
const APPROVAL_ORIGINS = new Set(['https://www.sandbox.paypal.com', 'https://sandbox.paypal.com']);

function createPayPal({ env, jsonRequest, configuredOrigin }) {
  const paypalConfigured = Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET);

  async function createSandboxOrder() {
    const app = configuredOrigin(env.APP_URL || 'http://localhost:' + (env.PORT || 3000));
    const basic = Buffer.from(env.PAYPAL_CLIENT_ID + ':' + env.PAYPAL_CLIENT_SECRET).toString('base64');
    const token = await jsonRequest(SANDBOX_API + '/v1/oauth2/token', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + basic, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    if (typeof token.access_token !== 'string' || !token.access_token) throw new Error('PayPal token missing.');

    const order = await jsonRequest(SANDBOX_API + '/v2/checkout/orders', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token.access_token,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': randomUUID(),
      },
      body: JSON.stringify({
        intent: 'AUTHORIZE',
        purchase_units: [{
          description: 'PayPal Vibe Trading sandbox preview',
          amount: { currency_code: 'USD', value: '1.00' },
        }],
        payment_source: {
          paypal: {
            experience_context: {
              user_action: 'CONTINUE',
              return_url: new URL('/?sandbox=returned#sandbox-checkout', app).href,
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


  return { paypalConfigured, createSandboxOrder };
}

module.exports = { createPayPal };
