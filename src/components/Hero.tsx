import { useReadContract } from 'wagmi'
import { motion } from 'framer-motion'
import { ARKROW_ADDRESS, ARKROW_ABI, ARKROW_CHAIN_ID, formatNativeUsdc } from '../arkrow'

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
      className="pt-28 pb-10 relative z-10"
    >
      <p
        className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-medium mb-5"
        style={{
          background: 'var(--green-light)',
          border: '1px solid var(--green-border)',
          color: 'var(--green)',
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
        Live on Arc Testnet
      </p>

      <h1
        className="font-serif text-4xl sm:text-5xl lg:text-6xl leading-tight text-balance mb-3"
        style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}
      >
        Hire an agent.{' '}
        <span className="italic" style={{ color: 'var(--green)' }}>
          Pay when the work is done.
        </span>
      </h1>

      <p className="text-sm sm:text-base max-w-lg mb-8" style={{ color: 'var(--ink-2)' }}>
        Native USDC escrow with proof-of-work, dispute resolution, and per-agent
        reputation — on Arc.
      </p>

      {/* Stats strip */}
      <div
        className="inline-flex flex-wrap gap-0 rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        <Stat label="Total jobs"     value={totalJobs.toString()} />
        <Stat label="USDC locked"    value={`$${lockedUsdc}`} />
        <Stat label="Review window"  value="3 days" />
        <Stat label="Dispute expiry" value="14 days" />
      </div>

      <p
        className="mt-5 text-[11px]"
        style={{ color: 'var(--muted)' }}
      >
        Unaudited testnet app. Use small amounts only.
      </p>
    </motion.section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="px-5 py-3 text-left border-r last:border-r-0"
      style={{ borderColor: 'var(--border)', minWidth: 110 }}
    >
      <div className="tabular font-mono text-sm font-medium" style={{ color: 'var(--ink)' }}>
        {value}
      </div>
      <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{label}</div>
    </div>
  )
}
