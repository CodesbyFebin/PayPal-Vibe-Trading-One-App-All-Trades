# PayPal Vibe Trading

**One Vibe. Every Trade.** An AI-guided portfolio sandbox with an AgentPaL-style trust layer: model-assisted risk-style selection, signed paper-trading mandates, deterministic order policy, owner approvals, emergency freeze, and a tamper-evident audit journal. Braintree Sandbox provides the PayPal-ecosystem checkout path.

## Run locally

Requires Node.js 20 or later. The sample-data walkthrough runs without credentials. See the integration setup below for the Braintree Sandbox and AI paths.

```sh
npm ci
npm run dev
```

Open [the local demo](http://localhost:3000). Set `PORT` to use another port. The optional browser extension points to port 3000.

## Hosting

The GitHub Pages workflow publishes the static overview from `public/landing/index.html`. Set the repository Actions variable `WEB_APP_URL` to the hosted app's HTTPS origin to link the landing page to Vibe It, the Web App, and Mobile.

The repository also has a Vercel Express entry point. The service can run on Render as a Node web service with `npm ci` as the build command and `npm start` as the start command. Public demos can run with the sample-data flow and without keys. Paper balances are in memory and can reset when the hosting platform starts a new instance.

### Vercel Production credentials — judging verification

The Braintree Sandbox checkout is the primary payment demo. The Vercel project `paypal-vibe-trading` needs these variables in **Settings → Environment Variables**, targeted to **Production**:

- `BRAINTREE_ENV=sandbox`
- `BRAINTREE_MERCHANT_ID`
- `BRAINTREE_PUBLIC_KEY`
- `BRAINTREE_PRIVATE_KEY`
- Either `GEMINI_API_KEY` or `OPENAI_API_KEY` — for the AI provider check

Add the values directly in the Vercel dashboard. Do not put credentials in GitHub, source files, issue comments, logs, or ChatGPT. Mark private values as sensitive/encrypted where Vercel offers that option. Braintree production mode is deliberately rejected by this demo. PayPal REST remains optional and still requires separate PayPal Sandbox Client ID and Secret credentials.

After saving the variables, redeploy the Production environment so the running deployment receives them. Then verify:

1. Open `/api/demo/status` and confirm the server reports the expected provider configuration without exposing secret values.
2. Run the AI provider check through `POST /api/vibe-ai` with a sample prompt.
3. Create a fixed USD $1 PayPal Sandbox order through `POST /api/paypal/sandbox/order`, approve it with a Sandbox buyer, and verify the returned order status through the app.
4. Record the deployment URL, timestamp, provider, HTTP status, and sanitized response as judging evidence. Never record credentials or tokens.

Until those hosted checks pass, mark live provider verification **not yet verified**. Local mocked tests and a READY Vercel deployment do not prove that external credentials or provider calls work.

## Judge walkthrough

| Step | Open | Try |
| --- | --- | --- |
| Vibe It | [Home](http://localhost:3000/) | Submit “I feel bullish on AI” with **From prompt** selected. The Bold sample allocates 30% US equities, 30% Indian equities, and 40% crypto. Try Safe or Balanced to compare. |
| Backtest Lab | [Web App](http://localhost:3000/webapp/) | Run the prefilled BTC-USDT 20/50 moving-average example. The fixture shows Sharpe 1.72, max drawdown −11.2%, a 57% win rate, and a sample equity curve. |
| Guarded paper trading | [Web App](http://localhost:3000/webapp/#paper-heading) | Inspect the signed mandate, submit a small order, request approval for a larger order, approve the exact payload, and test the kill switch. |
| Wallet and SIP | [Mobile](http://localhost:3000/mobile/) | View the $1,084.22 sample wallet and simulate a ₹500 monthly UPI AutoPay contribution. |

For the optional browser companion, open `chrome://extensions` or `edge://extensions`, enable Developer mode, and load the `extension/` folder unpacked. The popup links to the local demo. It requests no browser permissions.

## Implementation

The demo uses HTML, CSS, JavaScript, and Node.js with Express. Vibe It uses the selected mode, a configured AI classifier, or keyword rules when the model is unavailable. The Chat Agent extracts a supported pair and moving-average window from the prompt and displays deterministic backtest fixtures. The server serves the overview, web app, mobile view, and [JSON API](docs/API.md) from one origin. The paper ledger, signed mandate, approval queue, and audit chain are process-local and reset when the server restarts.

```sh
npm test
```

The test suite checks served pages, AI/portfolio behavior, backtest fixtures, guarded paper fills, position accounting, simulated fees, Ed25519 mandate verification, prompt-injection denial, exact-payload approval, owner kill switch, audit-chain integrity, PayPal/Braintree mocked boundaries, SIP simulation, and invalid request handling. The [hackathon release](https://github.com/CodesbyFebin/PayPal-Vibe-Trading-One-App-All-Trades/releases/tag/v1.0-hackathon) preserves the original packaged submission build. See [Judge Readiness](docs/JUDGING.md), the [three-minute demo script](docs/DEMO-SCRIPT.md), and [API reference](docs/API.md) for verification steps.

## AgentPaL Guard — signed, risk-bounded paper execution

The strongest reusable part of the previous [AgentPaL repository](https://github.com/CodesbyFebin/PayPal-Vibe) is its trust model: **the AI may propose; deterministic policy decides; the owner approves; the execution boundary verifies**. This repository now adapts that pattern to paper trading instead of copying AgentPaL's Next.js finance engine into an incompatible Express application.

- **Ed25519-signed mandate:** a process-local paper-only mandate defines allowed symbols/actions, automatic-approval notional, hard per-order cap, daily cap, and expiry. The server verifies the signature before each policy decision.
- **Deterministic Guard:** kill switch, mandate integrity/expiry, symbol/action allowlists, finite positive quantity and price, prompt-injection pattern screening for untrusted context, per-order cap, daily cap, and owner approval threshold.
- **Exact-payload approvals:** larger orders return `202 REQUIRE_APPROVAL`; the owner authenticates with a server-side PIN and approves a SHA-256 hash of the exact trade payload. A changed or already-consumed approval cannot authorize another payload.
- **Emergency freeze:** owner-authenticated kill switch blocks all paper execution.
- **Tamper-evident journal:** each decision, approval, freeze transition, and paper fill is linked into a SHA-256 hash chain. The status endpoint verifies the chain.
- **Paper ledger:** BUY/SELL update cash and per-symbol positions, enforce sell inventory and available cash, mark positions to the fixed reference fixtures, and charge a clearly disclosed 10 bps simulated fee.

The UI exposes the Guard status, pending approvals, signature validity, daily notional, audit-chain status, and owner controls. Set `OWNER_PIN` to a private value of at least 12 characters in the server environment to enable approvals and kill-switch controls. The PIN is read from the `x-owner-pin` request header and is never shipped to the browser or stored by the page.

**Strict scope:** this is paper-only execution. It has no broker adapter, exchange API keys, live market feed, real order routing, or real-money trading. BTC-USDT and ETH-USDT prices are fixed fixtures. The mandate, approvals, paper ledger, and audit journal are in-memory and reset on process restart. The signature and hash chain are real cryptographic checks, but this is not durable production custody or an independently anchored audit log.

## Braintree Sandbox checkout (primary payment demo)

The checkout uses the official Braintree Node SDK and Braintree Drop-in UI (Drop-in Web 1.46.0). The browser collects payment details through Braintree-hosted Drop-in; this app receives only a tokenized payment-method nonce. The Drop-in also offers its PayPal wallet option when that feature is enabled for the Braintree Sandbox merchant. The server creates a Braintree client token and submits a fixed **USD $1.00 Sandbox transaction** for settlement. No card number, CVV, or expiry is accepted by this app's API.

1. Copy `.env.example` to `.env`.
2. Set `BRAINTREE_ENV=sandbox`, `BRAINTREE_MERCHANT_ID`, `BRAINTREE_PUBLIC_KEY`, and `BRAINTREE_PRIVATE_KEY` using the credentials from your Braintree Sandbox Control Panel.
3. Start with `npm ci && npm run dev`.
4. Open the home page, wait for the Braintree Drop-in form to initialize, and submit a Sandbox test payment method.
5. The app returns only the transaction ID, status, amount, currency, and type. Confirm the same transaction in the Braintree Sandbox Control Panel.

API:
- `POST /api/braintree/client-token` — returns a short-lived Braintree client token when Sandbox credentials are configured.
- `POST /api/braintree/checkout` — accepts `paymentMethodNonce` and optional `deviceData`; the amount is server-fixed at USD $1.00 and cannot be supplied by the browser.
- `GET /api/demo/status` — reports whether Braintree Sandbox credentials are present without exposing them.

The service is fail-closed: `BRAINTREE_ENV=production` is not supported. The checkout is a Sandbox-only test and does not move real money. Automated tests mock the SDK boundary; a real provider transaction remains **not yet verified** until a credentialed Sandbox run is observed in the Braintree Control Panel.

## PayPal Sandbox and AI setup

The PayPal Orders flow and OpenAI-compatible Chat Completions client are adapted from [PayPal-Vibe](https://github.com/CodesbyFebin/PayPal-Vibe/tree/e32bb2f5b9d81bed5111c1d6fb482848109b1780).

1. Copy `.env.example` to `.env`. Set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` from a PayPal **Sandbox** application and set either `GEMINI_API_KEY` or `OPENAI_API_KEY`. For a custom OpenAI-compatible provider, use `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL`. If both named keys are configured, Gemini takes priority. Keep credentials server-side.
2. Run `npm ci`, then `node --env-file=.env server/index.js`. On a hosted instance, set `APP_URL` to the application's HTTPS origin and supply credentials through the host's environment settings.
3. Open [Vibe It](http://localhost:3000/), keep **From prompt** selected, and preview a portfolio. **AI-selected mode** means the configured model returned a recognized mode. **Rule-based demo mode** means the fallback supplied it.
4. Use the Braintree Sandbox checkout on the home page. The separate PayPal REST Sandbox flow remains optional. The server creates a fixed USD $1 order against the Sandbox Orders API. Open PayPal Sandbox using a sandbox buyer account. On return, the app verifies the signed checkout state and reads the matching order status from PayPal. The app never authorizes or captures the order.

For direct live verification after loading the private `.env`:

```sh
curl -fsS http://localhost:3000/api/health
curl -fsS http://localhost:3000/api/paypal/create-order \
  -H 'Content-Type: application/json' -d '{"amount":"1.00"}'
curl -fsS http://localhost:3000/api/vibe-ai \
  -H 'Content-Type: application/json' -d '{"feeling":"I feel bullish on AI"}'
```

The order endpoint returns the status supplied by PayPal and an approval URL. The AI verification endpoint reports the provider and fails if the model is unavailable.

Automated tests exercise the app with simulated upstream responses and check the exact sandbox host, order amount, and AI output handling. Live provider requests require configured credentials. No production PayPal endpoint is used.

## Demo boundaries

PayPal Vibe Trading is an independent hackathon concept. Market data, backtests, balances, fills, and AutoPay approvals are illustrative. The optional PayPal connection creates Sandbox preview orders only. The demo uses no broker or live market feed and provides no real Buyer Protection coverage or financial advice.
