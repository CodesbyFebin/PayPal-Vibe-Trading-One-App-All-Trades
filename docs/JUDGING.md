# Judge Readiness — PayPal Vibe Trading

## Competition status

The PayPal AI Hackathon submission window closed on **12 November 2026 at 12:00 PM Pacific** (13 November 2026 at 1:30 AM IST). The official judging period is **1–15 December 2026** and winners are expected around **21 December 2026**.

The official rules state that a submitted Devpost entry cannot be changed after the submission period except for narrowly permitted corrections. Continue improving the public portfolio, repository, and hosted project, but do not assume a repository change edits the already-submitted Devpost entry. Confirm the submitted entry and demo URL are the ones judges can access.

## Product story

**PayPal Vibe Trading** helps a retail investor turn a plain-language market sentiment into an illustrative allocation, inspect a strategy fixture, and experiment with paper orders under a cryptographically signed risk mandate. The AI helps classify the user's stated risk mood; deterministic server policy—not the model—decides whether a paper order is allowed, needs owner approval, or is denied. Braintree Sandbox provides the PayPal-ecosystem checkout demonstration.

One-line pitch:

> An AI-guided trading sandbox where the model can suggest a risk style, but a signed mandate, deterministic Guard, human approval, and a verifiable audit trail control every paper order.

## Judging rubric mapped to evidence

| Official criterion | What judges should see | Evidence in this repository |
| --- | --- | --- |
| Technological Implementation | A real configured AI call; Braintree Sandbox SDK client-token and transaction path; signed mandate verification; exact-payload approval; kill switch; tamper-evident audit chain | `server/ai.js`, `server/braintree.js`, `server/guard.js`, `server/index.js`, tests |
| Design | A coherent flow from Vibe It to Backtest Lab to guarded paper execution and payment checkout | `public/index.html`, `public/webapp/index.html`, `public/mobile/index.html` |
| Potential Impact | A credible safe experimentation environment for retail users who need to understand risk before executing | Paper-only account, explicit demo-price labels, no broker or live order route |
| Innovation / Idea | AI classification separated from deterministic financial authority; cryptographically signed mandate and owner-bound approvals | Ed25519 mandate, SHA-256 payload binding, kill switch, audit chain |
| Presentation | A short, uninterrupted end-to-end walkthrough with real app footage and clearly visible evidence | `docs/DEMO-SCRIPT.md` |

## Judge setup

1. Clone this public repository and use Node.js 20+.
2. Run `npm ci` and `npm test`.
3. Copy `.env.example` to a private `.env`.
4. For the owner approval and kill-switch walkthrough, set `OWNER_PIN` to a private value of at least 12 characters. Never commit it or put it in the browser bundle.
5. For AI-provider verification, set either `GEMINI_API_KEY` or `OPENAI_API_KEY`.
6. For Braintree, use Sandbox merchant credentials only: `BRAINTREE_ENV=sandbox`, merchant ID, public key, private key.
7. Run `npm run dev` and open `/webapp/` for Guard and paper-trading controls.
8. Check `GET /api/guard/status` and `GET /api/demo/status`.

The hosted application can be used without secrets for its labelled sample-data path. External AI and Braintree transactions remain **not yet verified** until the configured provider calls succeed and the transaction is visible in the Braintree Sandbox Control Panel.

## Evidence capture checklist

- [ ] Commit SHA and repository URL.
- [ ] CI run URL and passing test summary.
- [ ] Hosted deployment URL, deployment ID, and READY state.
- [ ] AI provider name, timestamp, HTTP result, and sanitized model output.
- [ ] Braintree Sandbox transaction ID, status, amount, and matching Sandbox Control Panel view.
- [ ] Guard status showing valid Ed25519 mandate signature and valid audit chain.
- [ ] A policy DENY for an unlisted symbol or injected instruction.
- [ ] A large order returning REQUIRE_APPROVAL, then approval of the exact payload and successful paper fill.
- [ ] Kill switch freeze and authenticated resume.
- [ ] Screen recording with no secrets, personal data, real payment details, or misleading metrics.

Never use screenshots of mocks as proof of a real provider transaction. Do not publish secret values, client tokens, private keys, buyer details, or owner PINs.

## Scope and limitations judges must be told

- Portfolio allocations are illustrative, not investment advice.
- Backtest performance and equity curves are fixtures, not a historical replay or independently computed benchmark.
- Paper prices are fixed fixtures; there is no live market-data provider.
- Paper execution is local simulation only; there is no broker, exchange connection, or real-money trading route.
- The signed mandate, approval queue, paper ledger, and audit chain are process-local and reset on server restart. They are not durable production custody or independently anchored audit evidence.
- Braintree is configured for Sandbox only. A READY deployment or mocked test does not prove an external transaction.
- The optional PayPal REST integration requires separate PayPal Sandbox credentials. Braintree credentials are not PayPal REST credentials.
- The current Braintree demo transaction is a fixed USD $1.00 Sandbox sale, separate from the paper-trading Guard.

## Release gate

Do not label the project production-ready. The judging build is ready only when the hosted UI, CI, demo steps, and required external provider checks are repeatable. Report unknowns explicitly.
