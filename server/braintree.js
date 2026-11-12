const AMOUNT = '1.00';

function createBraintree({ env, gatewayFactory }) {
  const sandboxOnly = (env.BRAINTREE_ENV || 'sandbox').toLowerCase() === 'sandbox';
  const braintreeConfigured = Boolean(
    sandboxOnly && env.BRAINTREE_MERCHANT_ID && env.BRAINTREE_PUBLIC_KEY && env.BRAINTREE_PRIVATE_KEY
  );

  let gateway;
  function getGateway() {
    if (!braintreeConfigured) throw new Error('Braintree Sandbox is not configured.');
    if (!gateway) {
      if (gatewayFactory) {
        gateway = gatewayFactory({
          environment: 'sandbox',
          merchantId: env.BRAINTREE_MERCHANT_ID,
          publicKey: env.BRAINTREE_PUBLIC_KEY,
          privateKey: env.BRAINTREE_PRIVATE_KEY,
        });
      } else {
        const braintree = require('braintree');
        gateway = new braintree.BraintreeGateway({
          environment: braintree.Environment.Sandbox,
          merchantId: env.BRAINTREE_MERCHANT_ID,
          publicKey: env.BRAINTREE_PUBLIC_KEY,
          privateKey: env.BRAINTREE_PRIVATE_KEY,
        });
      }
    }
    return gateway;
  }

  async function createClientToken() {
    const response = await getGateway().clientToken.generate({});
    if (!response || typeof response.clientToken !== 'string' || !response.clientToken) {
      throw new Error('Braintree did not return a client token.');
    }
    return response.clientToken;
  }

  async function createSandboxTransaction(paymentMethodNonce, deviceData) {
    const result = await getGateway().transaction.sale({
      amount: AMOUNT,
      paymentMethodNonce,
      ...(deviceData ? { deviceData } : {}),
      options: { submitForSettlement: true },
    });

    if (!result || result.success !== true || !result.transaction) {
      return { success: false };
    }

    const transaction = result.transaction;
    if (typeof transaction.id !== 'string' || !transaction.id || typeof transaction.status !== 'string') {
      return { success: false };
    }

    return {
      success: true,
      transaction: {
        id: transaction.id,
        status: transaction.status,
        amount: AMOUNT,
        currencyIsoCode: transaction.currencyIsoCode || 'USD',
        type: transaction.type || 'sale',
        createdAt: transaction.createdAt instanceof Date
          ? transaction.createdAt.toISOString()
          : undefined,
      },
    };
  }

  return { braintreeConfigured, createClientToken, createSandboxTransaction };
}

module.exports = { createBraintree };
