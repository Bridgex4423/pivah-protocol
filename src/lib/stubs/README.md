# Why this folder exists

`@base-org/account` (part of the wallet connector stack) depends on
`@coinbase/cdp-sdk`, which declares `@x402/core`, `@x402/evm`,
`@x402/extensions` and `@x402/svm` as **optional** peer dependencies for
Coinbase's x402 payment-over-HTTP protocol — a feature Pivah never uses.

None of the `@x402/*` packages are actually installed. Vite auto-generates a
synthetic module for declared-but-missing optional peer deps, but that
synthetic shim is missing an export (`toClientEvmSigner`) that
`@coinbase/cdp-sdk`'s `account-signers.js` imports at the top level. That's
harmless at runtime (the code path is never reached), but it breaks
production builds targeting some presets (e.g. Vercel) because the bundler
statically resolves the import graph.

`x402-evm.ts` here is aliased to `@x402/evm` in `vite.config.ts` to satisfy
that import with a real, resolvable module instead of the broken synthetic
one. If `@coinbase/cdp-sdk` or `@base-org/account` is ever upgraded and this
starts failing differently (or stops failing), it's safe to delete this
folder and the alias in `vite.config.ts` and confirm `npm run build` still
succeeds.
