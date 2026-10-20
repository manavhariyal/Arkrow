/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 *
 * Wallets: browser extensions (MetaMask, Rabby, Phantom, Brave…), Coinbase Wallet,
 * and WalletConnect (phones, Rainbow, Trust, MetaMask mobile…).
 * WalletConnect needs a free project ID from https://cloud.reown.com, set as the
 * environment variable VITE_WALLETCONNECT_PROJECT_ID. Without it, that option is hidden.
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet } from 'viem/chains'
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors'
import { registerChain } from './tracing'

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])

const wcProjectId = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined)?.trim()

export const config = createConfig({
  chains: [arcTestnet, mainnet], // mainnet needed for ENS resolution
  connectors: [
    injected(),
    coinbaseWallet({ appName: 'Arkrow' }),
    ...(wcProjectId
      ? [walletConnect({ projectId: wcProjectId, metadata: {
          name: 'Arkrow',
          description: 'Escrow for AI agents on Arc',
          url: 'https://arkrow.vercel.app',
          icons: ['https://arkrow.vercel.app/avatar.png'],
        } })]
      : []),
  ],
  transports: {
    [arcTestnet.id]: http(),
    [mainnet.id]: http(), // ENS resolution uses mainnet
  },
})
