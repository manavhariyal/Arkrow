import { toast } from 'sonner'

const NETWORK = [
  { label: 'Network name', value: 'Arc Testnet' },
  { label: 'RPC URL', value: 'https://rpc.testnet.arc.io' },
  { label: 'Chain ID', value: '5042002' },
  { label: 'Currency symbol', value: 'USDC' },
  { label: 'Block explorer', value: 'https://explorer.testnet.arc.io' },
]

async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success('Copied')
  } catch {
    toast.message(value)
  }
}

export function TryIt() {
  return (
    <details className="card overflow-hidden group">
      <summary
        className="cursor-pointer select-none list-none flex items-center justify-between px-5 py-4"
        style={{ color: 'var(--ink)' }}
      >
        <span className="font-serif text-xl">New here? Try it in 2 minutes</span>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>Show steps</span>
      </summary>

      <div className="px-5 pb-5 flex flex-col gap-4 text-sm" style={{ color: 'var(--ink-2)' }}>
        <div>
          <p className="font-medium" style={{ color: 'var(--ink)' }}>1. Add Arc Testnet to your wallet</p>
          <p className="text-xs mt-1">Click any value to copy it.</p>
          <dl className="mt-2 flex flex-col gap-1.5">
            {NETWORK.map(n => (
              <div key={n.label} className="flex flex-col gap-0.5 text-xs">
                <dt style={{ color: 'var(--muted)' }}>{n.label}</dt>
                <dd className="m-0 min-w-0">
                  <button
                    type="button"
                    onClick={() => copy(n.value)}
                    className="font-mono text-left break-all underline underline-offset-4 decoration-1"
                    style={{ background: 'none', border: 0, padding: 0, color: 'var(--ink)' }}
                  >
                    {n.value}
                  </button>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <p className="font-medium" style={{ color: 'var(--ink)' }}>2. Get free testnet USDC</p>
          <p className="text-xs mt-1">
            Open the{' '}
            <a
              href="https://faucet.circle.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
              style={{ color: 'var(--ink)' }}
            >
              Circle faucet
            </a>
            , choose <b>Arc Testnet</b> and <b>USDC</b>, and paste your address.
          </p>
        </div>

        <div>
          <p className="font-medium" style={{ color: 'var(--ink)' }}>3. Post a job</p>
          <p className="text-xs mt-1">
            Use a second address you control as the worker, with a small amount like 1 USDC.
            The worker needs a little USDC too, because gas on Arc is paid in USDC.
          </p>
        </div>
      </div>
    </details>
  )
}
