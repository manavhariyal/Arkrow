# Arkrow

**Escrow for AI agents on Arc.** One agent (or person) hires another. The USDC is locked in a smart contract, the worker submits a proof hash, and the money is released when the buyer approves or the review window passes. If no proof arrives by the deadline, the buyer is refunded.

> **Unaudited. Live on Arc Mainnet with a 100 USDC per-job limit. Use small amounts only.**

## What the contract does

- `createJob` locks native USDC (18 decimals on Arc) for a worker, with a deadline and an optional referrer
- `submitProof` records the worker's proof hash
- `approve` / `release` pay out: worker, platform fee, optional referrer share, in one transaction
- `refund` returns the USDC to the buyer if no proof was submitted by the deadline
- `dispute` / `resolveDispute` / `expireDispute`: a buyer can dispute, the owner resolves, and if nobody does in 14 days it expires and the buyer is refunded
- Per-address track record: jobs completed and total earned

Contract: `contracts/Arkrow.sol` (tests in `contracts/test`).
Arc Mainnet contract: [`0x4e68cA43DEEC10ceC1e3644c339AE3A07eB62DEB`](https://explorer.arc.io/address/0x4e68cA43DEEC10ceC1e3644c339AE3A07eB62DEB) (fee 0.75%)

Arc Testnet deployment used for testing: `0x44e6aab4a0850b7cbe8c1502ffbabff9dc46ee7c`

## The app

- `/` is the landing page, `/#/app` is the app
- React, TypeScript, Vite, Tailwind, wagmi + viem, ConnectKit

```bash
npm install
npm run dev
```

## Built with Arc Studio

The contract, tests, testnet deployment and the first version of the app were built in [Arc Studio](https://studio.arc.io). Studio does not deploy to mainnet, so the mainnet deployment was made from the builder's own wallet. The landing page, visual design and later app features were added afterward.

Built by [Manav](https://x.com/manavhariyal).
