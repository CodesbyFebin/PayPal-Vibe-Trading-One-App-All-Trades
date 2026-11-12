# Reuse from the previous AgentPaL repository

Source: https://github.com/CodesbyFebin/PayPal-Vibe

The previous AgentPaL codebase was inspected for reusable payment integration work. The current Express app is not a Next.js app and does not have AgentPaL's mandate, approval, JSON-store, or payment lifecycle modules. Those files were therefore not copied wholesale.

## Reused in this repository

- `src/components/BraintreeCheckout.tsx`: the lazy-loaded Braintree Drop-in script pattern, client lifecycle cleanup, and optional PayPal wallet configuration were adapted to `public/assets/app.js`.
- `src/lib/security.ts`: the PayPal/Braintree hosted checkout origin allowlist was adapted to the existing Express Content Security Policy.
- `src/lib/braintree.ts`: reviewed for its SDK boundary and transaction lifecycle. The existing Express service remains a smaller Sandbox-only fixed-price checkout and does not claim authorize/capture/refund support.

## Deliberately not imported

- `src/lib/payment-provider.ts`, `src/lib/payment-mode.ts`, `src/lib/engine.ts`, `src/lib/mandates.ts`, `src/lib/refunds.ts`, `src/lib/settlement.ts`, and AgentPaL API routes depend on AgentPaL's own data model, mandate policy, persistent store, and approval workflow. Copying them into this Express trading demo without their full dependencies would create a misleading or unsafe partial payment system.
- PayPal Agent Toolkit and the Next.js app shell are not required for this repository's current judging scope.

## Verification boundary

The changes here only enable the PayPal wallet option inside Braintree Drop-in when the Braintree Sandbox merchant account supports and has enabled it. They do not create PayPal REST credentials and do not verify a real Braintree or PayPal Sandbox transaction. That remains a credentialed external test.
