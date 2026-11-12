'use strict';

const {
  createHash,
  generateKeyPairSync,
  sign,
  verify,
  timingSafeEqual,
  randomUUID,
} = require('node:crypto');

const INJECTION_PATTERNS = [
  /ignore\\s+(all\\s+)?(previous\\s+)?(instructions|limits|rules)/i,
  /system\\s+override/i,
  /disregard\\s+(the\\s+)?mandate/i,
  /bypass\\s+(the\\s+)?(policy|budget|limit)/i,
  /auto[- ]approve\\s+(this|the)/i,
  /pay\\s+immediately/i,
];

function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function createTradingGuard({ ownerPin = process.env.OWNER_PIN, now = () => new Date() } = {}) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const issuedAt = now().toISOString();
  const mandateBody = {
    id: 'paper-mandate-v1',
    version: 1,
    mode: 'paper-only',
    currency: 'USD',
    allowedSymbols: ['BTC-USDT', 'ETH-USDT'],
    allowedActions: ['BUY', 'SELL'],
    autoApproveNotional: 2500,
    maxOrderNotional: 10000,
    maxDailyNotional: 10000,
    issuedAt,
    expiresAt: new Date(now().getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
  const mandateSignature = sign(null, Buffer.from(canonicalJson(mandateBody)), privateKey).toString('base64');
  let killSwitch = false;
  let day = now().toISOString().slice(0, 10);
  let dailyNotional = 0;
  const approvals = new Map();
  const events = [];
  let lastHash = '0'.repeat(64);

  function appendEvent(type, details) {
    const body = { id: randomUUID(), at: now().toISOString(), type, details };
    const hash = sha256(lastHash + '\\n' + canonicalJson(body));
    const event = { ...body, previousHash: lastHash, hash };
    events.push(event);
    lastHash = hash;
    return event;
  }

  function verifyMandate() {
    return verify(
      null,
      Buffer.from(canonicalJson(mandateBody)),
      publicKey,
      Buffer.from(mandateSignature, 'base64'),
    );
  }

  function verifyAudit() {
    let previous = '0'.repeat(64);
    for (const event of events) {
      const { previousHash, hash, ...body } = event;
      if (previousHash !== previous || sha256(previous + '\\n' + canonicalJson(body)) !== hash) return false;
      previous = hash;
    }
    return previous === lastHash;
  }

  function normalizeTrade(input = {}) {
    const action = typeof input.action === 'string' ? input.action.toUpperCase() : '';
    const symbol = typeof input.symbol === 'string' ? input.symbol.toUpperCase() : '';
    const qty = Number(input.qty);
    const price = Number(input.price);
    const context = typeof input.context === 'string' ? input.context.slice(0, 500) : '';
    return { action, symbol, qty, price, context };
  }

  function payloadHash(trade) {
    return sha256(canonicalJson(trade));
  }

  function approve({ approvalId, payloadHash: suppliedHash }, pin) {
    if (!ownerPin || ownerPin.length < 12) return { ok: false, status: 503, error: 'Owner approval is disabled until OWNER_PIN is configured (minimum 12 characters).' };
    if (!safeEqual(pin, ownerPin)) return { ok: false, status: 401, error: 'Owner authentication failed.' };
    const item = approvals.get(approvalId);
    if (!item || item.status !== 'pending') return { ok: false, status: 404, error: 'Pending approval not found.' };
    if (!safeEqual(suppliedHash, item.payloadHash)) {
      appendEvent('approval.rejected', { approvalId, reason: 'payload_hash_mismatch' });
      return { ok: false, status: 409, error: 'Approval payload hash does not match the pending trade.' };
    }
    item.status = 'approved';
    item.approvedAt = now().toISOString();
    appendEvent('approval.approved', { approvalId, payloadHash: item.payloadHash });
    return { ok: true, approval: { approvalId, status: item.status, payloadHash: item.payloadHash } };
  }

  function setKillSwitch(enabled, pin) {
    if (!ownerPin || ownerPin.length < 12) return { ok: false, status: 503, error: 'Owner control is disabled until OWNER_PIN is configured (minimum 12 characters).' };
    if (!safeEqual(pin, ownerPin)) return { ok: false, status: 401, error: 'Owner authentication failed.' };
    if (typeof enabled !== 'boolean') return { ok: false, status: 400, error: 'enabled must be a boolean.' };
    killSwitch = enabled;
    appendEvent(enabled ? 'guard.kill_switch.enabled' : 'guard.kill_switch.disabled', { enabled });
    return { ok: true, enabled: killSwitch };
  }

  function evaluate(input = {}) {
    const trade = normalizeTrade(input);
    const notional = trade.qty * trade.price;
    const reasons = [];
    let decision = 'ALLOW';
    const deny = reason => { decision = 'DENY'; reasons.push(reason); };
    const approval = reason => { if (decision !== 'DENY') decision = 'REQUIRE_APPROVAL'; reasons.push(reason); };

    if (killSwitch) deny('Kill switch is enabled; paper execution is frozen.');
    if (!verifyMandate()) deny('Signed mandate verification failed.');
    const current = now();
    const expiry = Date.parse(mandateBody.expiresAt);
    if (!Number.isFinite(expiry) || expiry <= current.getTime()) deny('Signed mandate is expired or invalid.');
    if (!mandateBody.allowedActions.includes(trade.action)) deny('Trade action is not allowed.');
    if (!mandateBody.allowedSymbols.includes(trade.symbol)) deny('Symbol is not on the signed mandate allowlist.');
    if (!Number.isFinite(trade.qty) || trade.qty <= 0) deny('Quantity must be finite and greater than zero.');
    if (!Number.isFinite(trade.price) || trade.price <= 0) deny('Reference price must be finite and greater than zero.');
    if (INJECTION_PATTERNS.some(pattern => pattern.test(trade.context))) deny('Untrusted prompt/context contains an instruction override pattern.');
    if (Number.isFinite(notional) && notional > mandateBody.maxOrderNotional) deny('Order notional exceeds the hard mandate limit.');
    if (Number.isFinite(notional) && dailyNotional + notional > mandateBody.maxDailyNotional) deny('Daily paper-trading notional limit would be exceeded.');

    if (decision !== 'DENY' && Number.isFinite(notional) && notional > mandateBody.autoApproveNotional) {
      approval('Order exceeds the automatic approval threshold and requires owner approval.');
    }

    if (decision === 'REQUIRE_APPROVAL') {
      const tradeHash = payloadHash(trade);
      const existing = input.approvalId && approvals.get(input.approvalId);
      if (existing && existing.status === 'approved' && !existing.consumed && safeEqual(existing.payloadHash, tradeHash)) {
        existing.consumed = true;
        appendEvent('approval.consumed', { approvalId: existing.id, payloadHash: tradeHash });
        decision = 'ALLOW';
        reasons.push('Exact trade payload was approved by the owner.');
      } else if (!existing) {
        const id = randomUUID();
        approvals.set(id, { id, status: 'pending', payloadHash: tradeHash, trade, createdAt: now().toISOString(), consumed: false });
        appendEvent('approval.requested', { approvalId: id, payloadHash: tradeHash, notional });
        return {
          decision,
          reasons,
          approval: { approvalId: id, payloadHash: tradeHash, status: 'pending' },
          trade: { ...trade, notional: Number.isFinite(notional) ? Number(notional.toFixed(2)) : null },
        };
      } else {
        return { decision: 'DENY', reasons: ['Approval is missing, consumed, or does not match this exact trade payload.'] };
      }
    }

    appendEvent(decision === 'ALLOW' ? 'trade.policy.allowed' : 'trade.policy.denied', {
      action: trade.action, symbol: trade.symbol, qty: trade.qty,
      notional: Number.isFinite(notional) ? Number(notional.toFixed(2)) : null,
      decision, reasons,
    });
    return {
      decision,
      reasons,
      trade: { ...trade, notional: Number.isFinite(notional) ? Number(notional.toFixed(2)) : null },
    };
  }

  function recordFill(trade) {
    const today = now().toISOString().slice(0, 10);
    if (today !== day) { day = today; dailyNotional = 0; }
    dailyNotional += trade.notional;
    appendEvent('paper.fill.recorded', { action: trade.action, symbol: trade.symbol, qty: trade.qty, notional: trade.notional });
  }

  function getStatus() {
    const today = now().toISOString().slice(0, 10);
    if (today !== day) { day = today; dailyNotional = 0; }
    return {
      mode: 'paper-only',
      killSwitch,
      mandate: { ...mandateBody, signature: mandateSignature, publicKey: publicKeyPem, signatureValid: verifyMandate() },
      limits: {
        autoApproveNotional: mandateBody.autoApproveNotional,
        maxOrderNotional: mandateBody.maxOrderNotional,
        maxDailyNotional: mandateBody.maxDailyNotional,
        dailyNotional: Number(dailyNotional.toFixed(2)),
        remainingDailyNotional: Number(Math.max(0, mandateBody.maxDailyNotional - dailyNotional).toFixed(2)),
      },
      pendingApprovals: [...approvals.values()].filter(item => item.status === 'pending').map(item => ({
        approvalId: item.id, status: item.status, payloadHash: item.payloadHash,
        trade: item.trade, createdAt: item.createdAt,
      })),
      audit: { events: events.length, head: lastHash, chainValid: verifyAudit() },
    };
  }

  return { evaluate, approve, setKillSwitch, getStatus, recordFill };
}

module.exports = { createTradingGuard, canonicalJson };
