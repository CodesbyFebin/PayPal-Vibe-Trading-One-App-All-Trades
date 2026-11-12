# Contributing

Thanks for considering a contribution to PayPal Vibe Trading.

## Project boundaries

This repository is an independent demo and paper-trading sandbox. It is not a broker, exchange, financial adviser, payment custodian, or production trading platform.

- Do not add live-money trading or production payment behavior without a separately reviewed design and explicit authorization.
- Keep Braintree and PayPal integrations Sandbox-only.
- Keep all secrets server-side and out of commits, logs, screenshots, and test fixtures.
- Label fixture prices, backtest examples, balances, and simulated payments accurately.
- Do not describe an untested integration or security control as verified.

## Development setup

Requirements: Node.js 20 or later and npm.

```bash
git clone https://github.com/CodesbyFebin/PayPal-Vibe-Trading-One-App-All-Trades.git
cd PayPal-Vibe-Trading-One-App-All-Trades
npm ci
npm test
npm run dev
```

The sample-data flow works without provider credentials. Copy `.env.example` to `.env` only when testing an integration locally. Never commit the resulting `.env` file.

## Contribution workflow

1. Search existing issues and pull requests.
2. Open an issue before substantial changes so scope and safety boundaries can be agreed.
3. Create a focused branch, for example `fix/paper-ledger-rounding`.
4. Add or update tests for behavior changes.
5. Run `npm test` and the relevant syntax checks.
6. Update the README or API documentation when behavior changes.
7. Open a pull request using the repository template.

## Style and commits

Use clear JavaScript, small functions, explicit validation, and fail-closed behavior at payment and trading boundaries. The repository includes Prettier and ESLint configuration; install the respective tools locally if you want to run them.

Use Conventional Commit-style messages such as:

- `feat: add a feature`
- `fix: correct a defect`
- `docs: clarify an integration`
- `chore: update dependencies`
- `test: cover a regression`

## Pull request checklist

- Tests pass and new behavior has regression coverage.
- Documentation describes limitations and configuration.
- No credentials, tokens, personal data, or real payment details are included.
- No sample data is presented as live market data or real performance.
- No production payment or broker execution path is introduced inadvertently.

By participating, contributors agree to follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
