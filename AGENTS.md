# Arkrow

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

Arkrow is an AI-agent escrow contract on Arc Testnet. A buyer (human or AI agent) hires a worker and locks native USDC. The worker submits a proof hash; the buyer approves or the funds auto-release after a 3-day review window. A capped protocol fee goes to the treasury, with an optional referrer share. The buyer can dispute within the window; only the owner resolves disputes. Failed pushes defer to a pull-claim (withdrawPending). Per-address reputation (jobsCompleted, totalEarned) tracked onchain.

## Deployed Contracts

| Contract | Chain | Address |
|---|---|---|
| Arkrow v1 | Arc Testnet | `0x654c86c47a36aeb345244273dfafc5fe02bce231` |
| Arkrow v2 | Arc Testnet | `0x0b285c66b8a97f3457b18333200d6b2d8761cfe5` |

Explorer (latest): https://explorer.testnet.arc.io/address/0x0b285c66b8a97f3457b18333200d6b2d8761cfe5

Constructor args: treasury = `0x5B12Ce46C7194aD57d143bC22847224047b1Ef42`, feeBps = 250 (2.5%)

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```
