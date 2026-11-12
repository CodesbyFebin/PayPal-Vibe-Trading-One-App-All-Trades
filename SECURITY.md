# Security Policy

## Scope and supported versions

This project is a hackathon/demo application, not a production brokerage, payment processor, or custody service. Security fixes are applied to the current default branch. No older release is currently covered by a formal security maintenance commitment.

| Version | Support |
| --- | --- |
| Current `main` branch | Security reports accepted; fixes assessed |
| Older snapshots and demo releases | Upgrade to the current source before requesting a fix |

## Reporting a vulnerability

**Do not publish exploitable vulnerability details in a public GitHub issue or pull request.**

If private vulnerability reporting is enabled for this repository, use [GitHub's private vulnerability reporting form](https://github.com/CodesbyFebin/PayPal-Vibe-Trading-One-App-All-Trades/security/advisories/new). Otherwise, contact the repository owner privately through GitHub.

Include:
- A concise description and potential impact.
- Affected commit, release, endpoint, or component.
- Reproduction steps or a minimal proof of concept.
- Any prerequisites and suggested mitigation.

Please allow maintainers reasonable time to investigate and coordinate a fix before public disclosure. Do not include real credentials, payment details, personal data, or production secrets in a report.

## Security boundaries

- Keep all API keys, Braintree private keys, PayPal secrets, and `OWNER_PIN` in the deployment's secret environment configuration.
- Use Braintree and PayPal Sandbox credentials only.
- Never use real payment card data in issues, screenshots, tests, or recordings.
- Paper trading is simulated. It is not a broker connection or real-money trading system.
- The paper mandate, approvals, balances, and audit journal are process-local and reset on restart. They are not durable production controls.
