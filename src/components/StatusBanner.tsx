import { IS_MAINNET } from '../arkrow'
import { useProtocolInfo } from '../protocol'

/** Thin bars under the top bar: which network you are on, and whether new jobs are paused. */
export function StatusBanner() {
  const { paused, maxJobUsdc } = useProtocolInfo()

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-[4.25rem] flex flex-col gap-2" aria-live="polite">
      {paused && (
        <div
          className="rounded-xl px-4 py-2.5 text-sm font-medium"
          style={{ background: 'var(--rose-light)', border: '1px solid var(--rose-border)', color: 'var(--rose)' }}
        >
          New jobs are paused for now. Existing jobs are safe and can still be approved, refunded and released.
        </div>
      )}
      {IS_MAINNET ? (
        <div
          className="rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1"
          style={{ background: 'var(--green-light)', border: '1.5px solid var(--ink)', color: 'var(--ink)', boxShadow: '3px 3px 0 var(--peach)' }}
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" style={{ background: 'var(--green)' }} />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: 'var(--green)' }} />
            </span>
            Live on Arc Mainnet
          </span>
          <span className="text-sm" style={{ color: 'var(--ink-2)' }}>
            Real USDC, settled onchain. Early access: up to {maxJobUsdc} USDC per job, so start small.
          </span>
        </div>
      ) : (
        <div
          className="rounded-xl px-4 py-2 text-sm"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}
        >
          Test network. No real money is used here.
        </div>
      )}
    </div>
  )
}
