# Demo API

Base URL: `http://localhost:3000/api`. Send JSON objects for POST requests. Optional fields use the defaults below. The API uses sample data throughout.

| Method and route | Optional input | Response |
| --- | --- | --- |
| `GET /health` | — | `{"ok":true,"service":"paypal-vibe"}` |
| `POST /vibe` | `feeling` (default `I feel bullish on AI`), `mode` (Safe, Balanced, or Bold) | Prompt, selected or inferred mode, and sample portfolio percentages |
| `POST /backtest` | `symbol` (BTC-USDT), `strategy` (20/50 MA), `capital` (1000) | Fixture metrics and an equity curve scaled to starting capital |
| `GET /portfolio` | — | Sample holdings and risk metrics |
| `POST /paper` | `action` (BUY or SELL), `symbol` (BTC-USDT), `qty` (0.01) | Illustrative fill and updated in-memory demo account value |
| `POST /sip` | `amount` in INR (500) | Simulated monthly UPI AutoPay result |
| `GET /alphas` | — | Two example signal summaries |

Invalid requests return a JSON `error` and HTTP 400. Oversized JSON returns 413. Unknown API routes return 404. The backtest and SIP demo inputs are capped at 1,000,000 in their respective currencies.

```sh
curl -fsS http://localhost:3000/api/health
curl -fsS http://localhost:3000/api/vibe \
  -H 'Content-Type: application/json' \
  -d '{"feeling":"I feel bullish on AI"}'
```
