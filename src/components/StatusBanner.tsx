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
      <div
        className="rounded-xl px-4 py-2 text-sm"
        style={IS_MAINNET
          ? { background: 'var(--peach)', border: '1px solid var(--border)', color: 'var(--ink)' }
          : { background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}
      >
        {IS_MAINNET
          ? `Real money on Arc Mainnet. Unaudited contract. Launch limit: ${maxJobUsdc} USDC per job.`
          : 'Test network. No real money is used here. Mainnet is coming soon.'}
      </div>
    </div>
  )
}
