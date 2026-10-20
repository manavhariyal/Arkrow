import { useEffect, useRef, useState } from 'react'
import { useReadContract } from 'wagmi'
import { motion } from 'framer-motion'
import {
  ARKROW_ADDRESS, ARKROW_ABI, ARKROW_CHAIN_ID,
  formatNativeUsdc, shortenAddr,
} from '../arkrow'
import { StatusBadge } from './StatusBadge'
import { JobPanel } from './JobPanel'
import { useHashParams, parseJobParam } from '../links'

export function JobsTable({ refreshKey }: { refreshKey: number }) {
  const [selectedId, setSelectedId] = useState<bigint | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const jobParam = parseJobParam(useHashParams().get('job'))
  const jobParamKey = jobParam ? jobParam.toString() : ''

  // A link like #/app?job=7 opens that job.
  useEffect(() => {
    if (!jobParamKey) return
    setSelectedId(BigInt(jobParamKey))
    const t = window.setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150)
    return () => window.clearTimeout(t)
  }, [jobParamKey])

  const { data: jobCounter } = useReadContract({
    address: ARKROW_ADDRESS,
    abi: ARKROW_ABI,
    functionName: 'jobCounter',
    chainId: ARKROW_CHAIN_ID,
    query: { refetchInterval: 8_000 },
  })

  const total = jobCounter ? Number(jobCounter) : 0
  const ids   = Array.from({ length: Math.min(total, 20) }, (_, i) => BigInt(total - i))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl" style={{ color: 'var(--ink)' }}>
          Recent jobs
        </h2>
        {total > 0 && (
          <span className="text-sm tabular font-mono" style={{ color: 'var(--muted)' }}>
            {total} total
          </span>
        )}
      </div>

      {/* Selected job panel */}
      {selectedId !== null && (
        <div ref={panelRef}>
          <JobPanel
            key={selectedId.toString()}
            jobId={selectedId}
            onClose={() => setSelectedId(null)}
            onAction={() => {/* refreshKey already handles refetch */}}
          />
        </div>
      )}

      {total === 0 && <Empty />}

      {ids.map((id, i) => (
        <JobRow
          key={id.toString()}
          jobId={id}
          delay={i * 0.035}
          selected={selectedId === id}
          onSelect={() => setSelectedId(selectedId === id ? null : id)}
          refreshKey={refreshKey}
        />
      ))}
    </div>
  )
}

function JobRow({
  jobId, delay, selected, onSelect, refreshKey: _refreshKey,
}: {
  jobId: bigint; delay: number; selected: boolean; onSelect: () => void; refreshKey: number
}) {
  const { data: job } = useReadContract({
    address: ARKROW_ADDRESS,
    abi: ARKROW_ABI,
    functionName: 'getJob',
    args: [jobId],
    chainId: ARKROW_CHAIN_ID,
    query: { refetchInterval: 10_000 },
  })

  if (!job) {
    return (
      <div
        className="rounded-xl animate-pulse"
        style={{ height: 62, background: 'var(--border)', opacity: 0.5 }}
      />
    )
  }

  const deadline = new Date(Number(job.deadline) * 1000)

  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.22, ease: [0.25, 0.1, 0.25, 1.0] }}
      onClick={onSelect}
      className="w-full text-left rounded-xl px-4 py-3 transition-all"
      style={{
        background: selected ? 'var(--green-light)' : 'var(--surface)',
        border: `1px solid ${selected ? 'var(--green-border)' : 'var(--border)'}`,
        boxShadow: selected ? 'none' : undefined,
      }}
      whileHover={{ y: -1, boxShadow: '0 2px 8px rgba(23,24,27,0.06)' }}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="font-mono text-sm shrink-0 tabular"
            style={{ color: 'var(--muted)', minWidth: 28 }}
          >
            #{jobId.toString()}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>
              {shortenAddr(job.buyer)} → {shortenAddr(job.worker)}
            </div>
            <div className="text-[13px] tabular" style={{ color: 'var(--muted)' }}>
              Due {deadline.toLocaleDateString()}
            </div>
          </div>
        </div>
        {/* Right */}
        <div className="flex items-center gap-3 shrink-0">
          <span
            className="font-mono tabular text-sm font-semibold"
            style={{ color: 'var(--green)' }}
          >
            ${formatNativeUsdc(job.amount, 2)}
          </span>
          <StatusBadge status={job.status} />
        </div>
      </div>
    </motion.button>
  )
}

function Empty() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="card flex flex-col items-center justify-center py-14 gap-3"
    >
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center text-xl"
        style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
      >
        <span style={{ color: 'var(--muted)' }}>≡</span>
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>No jobs yet</p>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>Post the first job to get started.</p>
    </motion.div>
  )
}
