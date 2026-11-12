# PayPal Vibe Trading

**One Vibe. Every Trade.** A PayPal AI Hackathon concept that turns a plain-language market idea into an illustrative portfolio, then lets users explore a sample backtest and monthly contribution.

## Run locally

Requires Node.js 20 or later. No API keys or accounts are required.

```sh
npm ci
npm run dev
```

Open [the local demo](http://localhost:3000). Set `PORT` to use another port. The optional browser extension points to port 3000.

## Judge walkthrough

| Step | Open | Try |
| --- | --- | --- |
| Vibe It | [Home](http://localhost:3000/) | Submit “I feel bullish on AI” with **From prompt** selected. The Bold sample allocates 30% US equities, 30% Indian equities, and 40% crypto. Try Safe or Balanced to compare. |
| Backtest Lab | [Web App](http://localhost:3000/webapp/) | Run the prefilled BTC-USDT 20/50 moving-average example. The fixture shows Sharpe 1.72, max drawdown −11.2%, a 57% win rate, and a sample equity curve. |
| Paper trading | [Web App](http://localhost:3000/webapp/#paper-heading) | Simulate a fixed-size BTC-USDT fill and see the demo account value change. |
| Wallet and SIP | [Mobile](http://localhost:3000/mobile/) | View the $1,084.22 sample wallet and simulate a ₹500 monthly UPI AutoPay contribution. |

For the optional browser companion, open `chrome://extensions` or `edge://extensions`, enable Developer mode, and load the `extension/` folder unpacked. The popup links to the local demo. It requests no browser permissions.

## Implementation

The demo uses HTML, CSS, JavaScript, and Node.js with Express. Vibe It uses keyword rules or the selected mode. The Chat Agent extracts a supported pair and moving-average window from the prompt and displays deterministic backtest fixtures. The server serves the overview, web app, mobile view, and [JSON API](docs/API.md) from one origin. The paper balance resets when the server restarts.

```sh
npm test
```

The test suite checks the served pages, portfolio choices, backtest values, paper fills, SIP simulation, and invalid request handling. The [hackathon release](https://github.com/CodesbyFebin/PayPal-Vibe-Trading-One-App-All-Trades/releases/tag/v1.0-hackathon) preserves the original packaged submission build.

## Demo boundaries

PayPal Vibe Trading is an independent hackathon concept. Market data, backtests, balances, fills, and AutoPay approvals are illustrative. The demo connects to no payment provider, broker, or live market feed and provides no real Buyer Protection coverage or financial advice.
