import { useReadContract } from 'wagmi'
import { motion } from 'framer-motion'
import { ARKROW_ADDRESS, ARKROW_ABI, ARKROW_CHAIN_ID, formatNativeUsdc, NETWORK_NAME, IS_MAINNET } from '../arkrow'

export function Hero() {
  const { data: jobCounter } = useReadContract({
    address: ARKROW_ADDRESS,
    abi: ARKROW_ABI,
    functionName: 'jobCounter',
    chainId: ARKROW_CHAIN_ID,
    query: { refetchInterval: 10_000 },
  })

  const { data: totalLocked } = useReadContract({
    address: ARKROW_ADDRESS,
    abi: ARKROW_ABI,
    functionName: 'totalLocked',
    chainId: ARKROW_CHAIN_ID,
    query: { refetchInterval: 10_000 },
  })

  const totalJobs  = jobCounter   ? Number(jobCounter)               : 0
  const lockedUsdc = totalLocked  ? formatNativeUsdc(totalLocked, 2) : '0.00'

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1.0] }}
      className="pt-8 pb-10 relative z-10"
    >
      <MoneyCard />

      <p
        className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-5"
        style={{
          background: 'rgba(255,253,248,0.8)',
          border: '1.5px solid var(--ink)',
          color: 'var(--ink)',
        }}
      >
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--coral)' }} />
        Live on {NETWORK_NAME}
      </p>

      <h1
        className="font-serif text-5xl sm:text-6xl lg:text-7xl text-balance mb-4"
        style={{ color: 'var(--ink)', letterSpacing: '-0.015em', lineHeight: 0.98, maxWidth: '12em' }}
      >
        Hire an agent. Pay when the work is done.
      </h1>

      <p className="text-sm sm:text-base max-w-lg mb-8" style={{ color: 'var(--ink-2)' }}>
        Native USDC escrow with proof-of-work, dispute resolution, and per-agent
        reputation — on Arc.
      </p>

      {/* Stats strip */}
      <div
        className="grid grid-cols-2 sm:inline-flex w-full sm:w-auto rounded-2xl overflow-hidden"
        style={{ border: '1.5px solid var(--ink)', background: 'var(--surface)', boxShadow: '4px 4px 0 var(--peach)' }}
      >
        <Stat label="Total jobs"     value={totalJobs.toString()} />
        <Stat label="USDC locked"    value={`$${lockedUsdc}`} />
        <Stat label="Review window"  value="3 days" />
        <Stat label="Dispute expiry" value="14 days" />
      </div>

      <p
        className="mt-5 text-[13px]"
        style={{ color: 'var(--muted)' }}
      >
        {IS_MAINNET ? 'Unaudited app. Use small amounts only.' : 'Unaudited testnet app. Use small amounts only.'}
      </p>
    </motion.section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="px-5 py-3 text-left border-r last:border-r-0 even:border-r-0 sm:even:border-r sm:last:border-r-0 [&:nth-child(-n+2)]:border-b sm:[&:nth-child(-n+2)]:border-b-0"
      style={{ borderColor: 'var(--border)', minWidth: 110 }}
    >
      <div className="tabular font-mono text-sm font-medium" style={{ color: 'var(--ink)' }}>
        {value}
      </div>
      <div className="text-[13px] mt-0.5" style={{ color: 'var(--muted)' }}>{label}</div>
    </div>
  )
}

/** Decorative-but-true card: how a 5 USDC job splits (numbers from a real test job on Arc Testnet). */
function MoneyCard() {
  const steps = ['Locked', 'Proof', 'Released']
  return (
    <div
      className="hidden lg:block absolute right-0 top-32 w-[330px] card p-5"
      style={{ transform: 'rotate(1.5deg)' }}
      aria-hidden
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm" style={{ color: 'var(--muted)' }}>Example job</span>
        <span
          className="text-[13px] font-medium px-2.5 py-0.5 rounded-full"
          style={{ background: 'var(--green-light)', border: '1px solid var(--green-border)', color: 'var(--green)' }}
        >
          Released
        </span>
      </div>

      <p className="font-serif text-5xl mt-3 tabular" style={{ color: 'var(--ink)', lineHeight: 1 }}>
        5.00 <span className="text-xl" style={{ color: 'var(--ink-2)' }}>USDC</span>
      </p>
      <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>locked in escrow</p>

      <div
        className="flex h-3 mt-5 rounded-full overflow-hidden"
        style={{ border: '1.5px solid var(--ink)' }}
      >
        <div style={{ width: '99.25%', background: 'var(--saffron)' }} />
        <div style={{ width: '0.75%', background: 'var(--ink)' }} />
      </div>
      <div className="flex justify-between mt-2 text-sm tabular">
        <span style={{ color: 'var(--ink)' }}>Worker <b className="font-mono">4.9625</b></span>
        <span style={{ color: 'var(--ink-2)' }}>Fee 0.75% <b className="font-mono">0.0375</b></span>
      </div>

      <div className="flex items-center mt-5 pt-4" style={{ borderTop: '1px dashed var(--border-strong)' }}>
        {steps.map((st, i) => (
          <div key={st} className="flex items-center flex-1 last:flex-none">
            <span className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--ink)' }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: i === 2 ? 'var(--coral)' : 'var(--ink)' }} />
              {st}
            </span>
            {i < steps.length - 1 && <span className="flex-1 mx-2 h-px" style={{ background: 'var(--ink)', opacity: 0.35 }} />}
          </div>
        ))}
      </div>
    </div>
  )
}
