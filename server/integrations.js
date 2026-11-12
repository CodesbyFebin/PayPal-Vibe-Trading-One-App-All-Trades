const { createAi } = require('./ai');
const { createPayPal } = require('./paypal');
const { createBraintree } = require('./braintree');

function configuredOrigin(value) {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) {
    throw new Error('Integration URLs must use HTTPS or a local HTTP address.');
  }
  return url;
}

function createIntegrations({ env = process.env, request = fetch, gatewayFactory } = {}) {
  async function jsonRequest(url, init) {
    const result = await request(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(10_000) });
    if (!result.ok) throw new Error('Integration request failed.');
    return result.json();
  }

  const dependencies = { env, jsonRequest, configuredOrigin };
  return { ...createAi(dependencies), ...createPayPal(dependencies), ...createBraintree({ env, gatewayFactory }) };
}

module.exports = { createIntegrations };
