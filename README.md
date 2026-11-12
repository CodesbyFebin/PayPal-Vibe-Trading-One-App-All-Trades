# PayPal Vibe Trading

**One Vibe. Every Trade.** A PayPal AI Hackathon concept that turns a plain-language market idea into an illustrative portfolio, then lets users explore a sample backtest and monthly contribution.

## Run locally

Requires Node.js 20 or later. The sample-data walkthrough runs without credentials. See the integration setup below for the PayPal Sandbox and AI paths.

```sh
npm ci
npm run dev
```

Open [the local demo](http://localhost:3000). Set `PORT` to use another port. The optional browser extension points to port 3000.

## Hosting

The GitHub Pages workflow publishes the static overview from `public/landing/index.html`. Set the repository Actions variable `WEB_APP_URL` to the hosted app's HTTPS origin to link the landing page to Vibe It, the Web App, and Mobile.

The repository also has a Vercel Express entry point. The service can run on Render as a Node web service with `npm ci` as the build command and `npm start` as the start command. Public demos can run with the sample-data flow and without keys. Paper balances are in memory and can reset when the hosting platform starts a new instance.

### Vercel Production credentials — judging verification

The main remaining judging gap is a live, hosted provider verification run. The Vercel project `paypal-vibe-trading` needs these variables in **Settings → Environment Variables**, targeted to **Production**:

- `PAYPAL_CLIENT_ID` — from a PayPal **Sandbox** app
- `PAYPAL_CLIENT_SECRET` — from the same PayPal Sandbox app
- Either `GEMINI_API_KEY` or `OPENAI_API_KEY` — for the AI provider check

Add the values directly in the Vercel dashboard. Do not put credentials in GitHub, source files, issue comments, logs, or ChatGPT. Mark the values as sensitive/encrypted where Vercel offers that option. Keep PayPal credentials in Sandbox; this project does not use the PayPal production API.

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
| Paper trading | [Web App](http://localhost:3000/webapp/#paper-heading) | Simulate a fixed-size BTC-USDT fill and see the demo account value change. |
| Wallet and SIP | [Mobile](http://localhost:3000/mobile/) | View the $1,084.22 sample wallet and simulate a ₹500 monthly UPI AutoPay contribution. |

For the optional browser companion, open `chrome://extensions` or `edge://extensions`, enable Developer mode, and load the `extension/` folder unpacked. The popup links to the local demo. It requests no browser permissions.

## Implementation

The demo uses HTML, CSS, JavaScript, and Node.js with Express. Vibe It uses the selected mode, a configured AI classifier, or keyword rules when the model is unavailable. The Chat Agent extracts a supported pair and moving-average window from the prompt and displays deterministic backtest fixtures. The server serves the overview, web app, mobile view, and [JSON API](docs/API.md) from one origin. The paper balance resets when the server restarts.

```sh
npm test
```

The test suite checks the served pages, portfolio choices, backtest values, paper fills, SIP simulation, and invalid request handling. The [hackathon release](https://github.com/CodesbyFebin/PayPal-Vibe-Trading-One-App-All-Trades/releases/tag/v1.0-hackathon) preserves the original packaged submission build.

## PayPal Sandbox and AI setup

The PayPal Orders flow and OpenAI-compatible Chat Completions client are adapted from [PayPal-Vibe](https://github.com/CodesbyFebin/PayPal-Vibe/tree/e32bb2f5b9d81bed5111c1d6fb482848109b1780).

1. Copy `.env.example` to `.env`. Set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` from a PayPal **Sandbox** application and set either `GEMINI_API_KEY` or `OPENAI_API_KEY`. For a custom OpenAI-compatible provider, use `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL`. If both named keys are configured, Gemini takes priority. Keep credentials server-side.
2. Run `npm ci`, then `node --env-file=.env server/index.js`. On a hosted instance, set `APP_URL` to the application's HTTPS origin and supply credentials through the host's environment settings.
3. Open [Vibe It](http://localhost:3000/), keep **From prompt** selected, and preview a portfolio. **AI-selected mode** means the configured model returned a recognized mode. **Rule-based demo mode** means the fallback supplied it.
4. Choose **Try the $1 PayPal Sandbox checkout**, then **Create sandbox order**. The server creates a fixed USD $1 order against the Sandbox Orders API. Open PayPal Sandbox using a sandbox buyer account. On return, the app verifies the signed checkout state and reads the matching order status from PayPal. The app never authorizes or captures the order.

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
