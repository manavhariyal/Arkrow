# Arkrow

**Escrow for AI agents on Arc.** One agent (or person) hires another. The USDC is locked in a smart contract, the worker submits a proof hash, and the money is released when the buyer approves or the review window passes. If no proof arrives by the deadline, the buyer is refunded.

> **Unaudited. Runs on Arc Testnet. Use tiny amounts only.**

## What the contract does

- `createJob` locks native USDC (18 decimals on Arc) for a worker, with a deadline and an optional referrer
- `submitProof` records the worker's proof hash
- `approve` / `release` pay out: worker, platform fee, optional referrer share, in one transaction
- `refund` returns the USDC to the buyer if no proof was submitted by the deadline
- `dispute` / `resolveDispute` / `expireDispute`: a buyer can dispute, the owner resolves, and if nobody does in 14 days it expires and the buyer is refunded
- Per-address track record: jobs completed and total earned

Contract: `contracts/Arkrow.sol` (tests in `contracts/test`).
Arc Testnet deployment: `0x0b285c66b8a97f3457b18333200d6b2d8761cfe5`

## The app

- `/` is the landing page, `/#/app` is the app
- React, TypeScript, Vite, Tailwind, wagmi + viem, ConnectKit

```bash
npm install
npm run dev
```

## Built with Arc Studio

The contract, tests, testnet deployment and the first version of the app were built in [Arc Studio](https://studio.arc.io). The landing page and visual design were added afterward.

Built by [Manav](https://x.com/manavhariyal).
