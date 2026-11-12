# Changelog

Notable changes to this project are recorded here. This file follows the structure of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions and release dates are only added when a release is actually published.

## [Unreleased]

### Added
- AgentPaL-inspired paper-trading Guard with an Ed25519-signed mandate, deterministic policy decisions, exact-payload owner approvals, emergency freeze, and a SHA-256 hash-chained in-memory journal.
- Braintree Sandbox Drop-in checkout and optional PayPal wallet capability.
- Judge-readiness guide, evidence checklist, and timed demo script.
- Repository security policy, contribution guidance, issue and pull-request templates, CodeQL workflow, Dependabot configuration, and container setup.

### Changed
- Paper trading now updates cash and positions instead of applying a fixed account-value increment.
- API hardening removes wildcard CORS and rate-limits paper-order submissions.
- README documents demo boundaries, provider setup, and verification requirements.

### Limitations
- Paper prices and backtest results remain fixtures.
- Guard state, paper balances, approvals, and audit events remain process-local.
- Braintree and PayPal integrations remain Sandbox-only; external provider success must be independently verified.
