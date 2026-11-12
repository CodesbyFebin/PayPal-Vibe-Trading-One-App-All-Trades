# Three-minute judge demo script

Target duration: **2:45**. Record the real application in a clean browser. Do not use a slide-only or mockup-only video.

## 0:00–0:20 — Problem

**Narration:** “AI can help people understand markets, but it should not become an unchecked trading authority. PayPal Vibe Trading separates AI guidance from execution authority. The model helps interpret the user's stated risk mood; a deterministic Guard controls every paper order.”

**Show:** Home page and Vibe It prompt.

## 0:20–0:45 — AI-guided allocation

**Narration:** “I describe my market sentiment in plain language. The configured AI provider classifies the risk style and returns a reason. If the provider is unavailable, the UI identifies the rule-based fallback rather than pretending an AI call succeeded.”

**Show:** Enter a bullish prompt, run AI selection, show provider and reason. Compare Safe, Balanced, and Bold allocations.

## 0:45–1:10 — Strategy preview, with honest data labels

**Narration:** “Backtest Lab lets users inspect a strategy example. These figures are clearly marked as fixtures; they are not live market data or a verified historical backtest.”

**Show:** Backtest page, strategy prompt, sample metrics and fixture disclaimer.

## 1:10–1:50 — Guarded paper order

**Narration:** “Paper execution is not controlled by the model. The server verifies an Ed25519-signed paper mandate, checks the symbol and risk limits, applies simulated fees, and updates cash and positions. The event journal is hash-chained.”

**Show:** Guard status with valid signature and audit chain. Execute a small BTC-USDT BUY and show quantity, fixture price, fee, cash, NAV, and ALLOW.

## 1:50–2:20 — Human approval and emergency freeze

**Narration:** “A larger order is not silently executed. It returns REQUIRE_APPROVAL. The owner PIN approves one exact payload hash; changing the quantity invalidates that approval. The kill switch freezes paper execution.”

**Show:** Submit a larger order, approve it, show the resulting paper fill. Freeze execution and show a subsequent order denied. Resume with the owner PIN.

## 2:20–2:45 — PayPal ecosystem and close

**Narration:** “Braintree Sandbox provides the PayPal-ecosystem payment integration. The checkout uses Braintree-hosted Drop-in and server-side credentials; this demo is Sandbox-only. The project does not claim real-money trading or live market performance. The core idea is simple: AI can advise, but policy and the user retain control.”

**Show:** Braintree Sandbox checkout UI, then the sanitized transaction result and matching Sandbox Control Panel transaction if a real credentialed run has been completed. If it has not, show the setup state and say it is not yet verified.

## Recording rules

- Keep the video under three minutes.
- Show the app functioning on its intended platform.
- Upload publicly to YouTube and add the URL to the Devpost entry only if the submission portal permits the relevant action.
- Do not show private keys, API keys, client tokens, owner PINs, buyer data, or unlicensed music/trademarks.
- Do not show fabricated AI output, market prices, backtest metrics, or payment success.
