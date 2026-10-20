import { ConnectKitButton } from 'connectkit'
import { useAccount, useSwitchChain } from 'wagmi'
import { ARKROW_CHAIN_ID, NETWORK_NAME } from '../arkrow'
import { ArkMark } from './ArkMark'

export function Topbar() {
  const { chainId, isConnected } = useAccount()
  const { switchChain, isPending } = useSwitchChain()
  const onWrongChain = isConnected && chainId !== ARKROW_CHAIN_ID

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-4 sm:px-6 h-14"
      style={{
        background: 'rgba(251,246,236,0.92)',
        borderBottom: '1.5px solid rgba(27,26,25,0.14)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Brand: logo links back to the landing page */}
      <div className="flex items-center gap-3">
        <a href="#/" className="flex items-center gap-2" style={{ color: 'var(--ink)', textDecoration: 'none' }} aria-label="Arkrow home">
          <ArkMark size={26} />
          <span className="font-serif text-xl tracking-tight">Arkrow</span>
        </a>
        <span className="hidden sm:block text-xs border-l pl-3" style={{ color: 'var(--muted)', borderColor: 'var(--border)' }}>
          Escrow for AI agents
        </span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Network pill */}
        <span
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
          style={{
            background: 'rgba(255,253,248,0.8)',
            border: '1.5px solid var(--ink)',
            color: 'var(--ink)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--coral)' }} />
          {NETWORK_NAME}
        </span>

        {/* Wrong chain warning */}
        {onWrongChain && (
          <button
            onClick={() => switchChain({ chainId: ARKROW_CHAIN_ID })}
            disabled={isPending}
            className="text-[11px] px-2.5 py-1 rounded-full font-medium transition-all"
            style={{
              background: 'var(--rose-light)',
              border: '1px solid var(--rose-border)',
              color: 'var(--rose)',
            }}
          >
            {isPending ? 'Switching…' : 'Switch to Arc'}
          </button>
        )}

        <ConnectKitButton.Custom>
          {({ isConnected: conn, show, address, truncatedAddress }) => (
            <button
              onClick={show}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-95"
              style={{
                background: conn ? 'var(--surface)' : 'var(--ink)',
                border: conn ? '1.5px solid var(--ink)' : '1.5px solid var(--ink)',
                color: conn ? 'var(--ink)' : '#FFFCF5',
                fontFamily: conn ? "'JetBrains Mono', monospace" : 'inherit',
              }}
            >
              {conn ? (truncatedAddress ?? address?.slice(0, 10)) : 'Connect wallet'}
            </button>
          )}
        </ConnectKitButton.Custom>
      </div>
    </header>
  )
}
