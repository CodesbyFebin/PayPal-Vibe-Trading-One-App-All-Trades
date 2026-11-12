# Demo API

Base URL: `http://localhost:3000/api`. Send JSON objects for POST requests. Optional fields use the defaults below. The API uses sample data throughout.

| Method and route | Optional input | Response |
| --- | --- | --- |
| `GET /health` | — | `{"ok":true,"service":"paypal-vibe"}` |
| `GET /demo/status` | — | Indicates whether Braintree Sandbox, PayPal Sandbox, and AI credentials are configured, without contacting providers |
| `POST /vibe` | `feeling` (default `I feel bullish on AI`), `mode` (Safe, Balanced, or Bold), `useAI` (optional opt-in) | Prompt, selected or inferred mode, sample portfolio percentages, and the source when automatic AI selection was requested |
| `POST /vibe-ai` | `feeling` (same default as Vibe It) | AI mode, reason, provider, and allocation. Returns 503 if no AI provider is configured. |
| `POST /braintree/client-token` | None | Braintree Sandbox client token, or HTTP 503 when Sandbox credentials are absent |
| `POST /braintree/checkout` | `paymentMethodNonce`, optional `deviceData` | Fixed USD $1.00 Braintree Sandbox transaction result; amount is server-controlled. Hosted Drop-in can expose the PayPal wallet when enabled for the merchant |
| `POST /paypal/create-order` | `amount` (fixed at USD `1.00`) | Optional PayPal Sandbox order ID, provider status, and approval URL |
| `POST /paypal/sandbox/order` | None | Optional PayPal Sandbox order ID and approval URL, or HTTP 503 when credentials are absent |
| `POST /paypal/sandbox/verify` | Return `orderId` and signed `state` | Reads the status of a matching Sandbox order from PayPal |
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
