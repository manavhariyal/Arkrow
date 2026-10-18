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
        className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-5"
        style={{
          background: 'rgba(255,253,248,0.8)',
          border: '1.5px solid var(--ink)',
          color: 'var(--ink)',
        }}
      >
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--coral)' }} />
        Live on Arc Testnet
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
      className="px-5 py-3 text-left border-r last:border-r-0 even:border-r-0 sm:even:border-r sm:last:border-r-0 [&:nth-child(-n+2)]:border-b sm:[&:nth-child(-n+2)]:border-b-0"
      style={{ borderColor: 'var(--border)', minWidth: 110 }}
    >
      <div className="tabular font-mono text-sm font-medium" style={{ color: 'var(--ink)' }}>
        {value}
      </div>
      <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{label}</div>
    </div>
  )
}
