/**
 * ActivityFeed — live event log for the Arkrow contract.
 * Watches the 7 key events and renders the latest 20 as feed rows.
 * New rows fade in at the top; an empty state is shown when no events exist yet.
 */

import { useEffect, useState } from 'react'
import { useWatchContractEvent } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ARKROW_ADDRESS, ARKROW_ABI, ARKROW_CHAIN_ID,
  formatNativeUsdc, shortenAddr, buildExplorerTx,
  JobStatus,
} from '../arkrow'
import { StatusBadge } from './StatusBadge'

// ── Types ────────────────────────────────────────────────────────────────────

type FeedEventKind =
  | 'JobCreated'
  | 'ProofSubmitted'
  | 'JobApproved'
  | 'JobReleased'
  | 'JobRefunded'
  | 'JobDisputed'
  | 'DisputeExpired'

interface FeedRow {
  id: string          // deterministic: txHash + logIndex
  kind: FeedEventKind
  jobId: bigint
  buyer?: `0x${string}`
  worker?: `0x${string}`
  amount?: bigint
  txHash: `0x${string}`
  ts: number          // Date.now() at receipt
}

// Map each event kind to a JobStatus badge
const KIND_STATUS: Record<FeedEventKind, number> = {
  JobCreated:      JobStatus.OPEN,
  ProofSubmitted:  JobStatus.PROOF_SUBMITTED,
  JobApproved:     JobStatus.RELEASED,
  JobReleased:     JobStatus.RELEASED,
  JobRefunded:     JobStatus.REFUNDED,
  JobDisputed:     JobStatus.DISPUTED,
  DisputeExpired:  JobStatus.REFUNDED,
}

// Labels kept for potential tooltip use
const _KIND_LABEL: Record<FeedEventKind, string> = {
  JobCreated:      'Job created',
  ProofSubmitted:  'Proof submitted',
  JobApproved:     'Approved',
  JobReleased:     'Released',
  JobRefunded:     'Refunded',
  JobDisputed:     'Disputed',
  DisputeExpired:  'Dispute expired',
}
void _KIND_LABEL

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeId(tx: `0x${string}`, extra: string | number): string {
  return `${tx}-${extra}`
}

function relativeTime(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000)
  if (secs < 5)   return 'just now'
  if (secs < 60)  return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  return `${Math.floor(secs / 3600)}h ago`
}

function prependUniq(prev: FeedRow[], next: FeedRow): FeedRow[] {
  if (prev.some(r => r.id === next.id)) return prev
  return [next, ...prev].slice(0, 20)
}

// ── Component ────────────────────────────────────────────────────────────────

export function ActivityFeed() {
  const [rows, setRows] = useState<FeedRow[]>([])
  const [, tick] = useState(0)

  // Re-render every 30s so relative times stay fresh
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // Stable push helper; useWatchContractEvent re-fires on mount with past events
  const pushRow = (row: FeedRow) => setRows(prev => prependUniq(prev, row))

  // ── Watchers ──────────────────────────────────────────────────────────────

  useWatchContractEvent({
    address: ARKROW_ADDRESS,
    abi: ARKROW_ABI,
    eventName: 'JobCreated',
    chainId: ARKROW_CHAIN_ID,
    onLogs(logs) {
      for (const log of logs) {
        const a = log.args as { jobId?: bigint; buyer?: `0x${string}`; worker?: `0x${string}`; amount?: bigint }
        if (a.jobId == null || !log.transactionHash) continue
        pushRow({
          id: makeId(log.transactionHash, log.logIndex ?? a.jobId.toString()),
          kind: 'JobCreated',
          jobId: a.jobId,
          buyer: a.buyer,
          worker: a.worker,
          amount: a.amount,
          txHash: log.transactionHash,
          ts: Date.now(),
        })
      }
    },
  })

  useWatchContractEvent({
    address: ARKROW_ADDRESS,
    abi: ARKROW_ABI,
    eventName: 'ProofSubmitted',
    chainId: ARKROW_CHAIN_ID,
    onLogs(logs) {
      for (const log of logs) {
        const a = log.args as { jobId?: bigint }
        if (a.jobId == null || !log.transactionHash) continue
        pushRow({
          id: makeId(log.transactionHash, log.logIndex ?? a.jobId.toString()),
          kind: 'ProofSubmitted',
          jobId: a.jobId,
          txHash: log.transactionHash,
          ts: Date.now(),
        })
      }
    },
  })

  useWatchContractEvent({
    address: ARKROW_ADDRESS,
    abi: ARKROW_ABI,
    eventName: 'JobApproved',
    chainId: ARKROW_CHAIN_ID,
    onLogs(logs) {
      for (const log of logs) {
        const a = log.args
        if (a.jobId == null || !log.transactionHash) continue
        pushRow({
          id: makeId(log.transactionHash, log.logIndex ?? a.jobId.toString()),
          kind: 'JobApproved',
          jobId: a.jobId,
          buyer: a.buyer,
          txHash: log.transactionHash,
          ts: Date.now(),
        })
      }
    },
  })

  useWatchContractEvent({
    address: ARKROW_ADDRESS,
    abi: ARKROW_ABI,
    eventName: 'JobReleased',
    chainId: ARKROW_CHAIN_ID,
    onLogs(logs) {
      for (const log of logs) {
        const a = log.args as { jobId?: bigint; worker?: `0x${string}`; workerAmount?: bigint }
        if (a.jobId == null || !log.transactionHash) continue
        pushRow({
          id: makeId(log.transactionHash, log.logIndex ?? a.jobId.toString()),
          kind: 'JobReleased',
          jobId: a.jobId,
          worker: a.worker,
          amount: a.workerAmount,
          txHash: log.transactionHash,
          ts: Date.now(),
        })
      }
    },
  })

  useWatchContractEvent({
    address: ARKROW_ADDRESS,
    abi: ARKROW_ABI,
    eventName: 'JobRefunded',
    chainId: ARKROW_CHAIN_ID,
    onLogs(logs) {
      for (const log of logs) {
        const a = log.args
        if (a.jobId == null || !log.transactionHash) continue
        pushRow({
          id: makeId(log.transactionHash, log.logIndex ?? a.jobId.toString()),
          kind: 'JobRefunded',
          jobId: a.jobId,
          buyer: a.buyer,
          amount: a.amount,
          txHash: log.transactionHash,
          ts: Date.now(),
        })
      }
    },
  })

  useWatchContractEvent({
    address: ARKROW_ADDRESS,
    abi: ARKROW_ABI,
    eventName: 'JobDisputed',
    chainId: ARKROW_CHAIN_ID,
    onLogs(logs) {
      for (const log of logs) {
        const a = log.args
        if (a.jobId == null || !log.transactionHash) continue
        pushRow({
          id: makeId(log.transactionHash, log.logIndex ?? a.jobId.toString()),
          kind: 'JobDisputed',
          jobId: a.jobId,
          buyer: a.buyer,
          txHash: log.transactionHash,
          ts: Date.now(),
        })
      }
    },
  })

  useWatchContractEvent({
    address: ARKROW_ADDRESS,
    abi: ARKROW_ABI,
    eventName: 'DisputeExpired',
    chainId: ARKROW_CHAIN_ID,
    onLogs(logs) {
      for (const log of logs) {
        const a = log.args
        if (a.jobId == null || !log.transactionHash) continue
        pushRow({
          id: makeId(log.transactionHash, log.logIndex ?? a.jobId.toString()),
          kind: 'DisputeExpired',
          jobId: a.jobId,
          buyer: a.buyer,
          amount: a.amount,
          txHash: log.transactionHash,
          ts: Date.now(),
        })
      }
    },
  })

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl" style={{ color: 'var(--ink)' }}>Live activity</h2>
        <span
          className="inline-flex items-center gap-1.5 text-[13px] font-medium px-2.5 py-1 rounded-full"
          style={{ background: 'var(--green-light)', border: '1px solid var(--green-border)', color: 'var(--green)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          Live
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyFeed />
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {rows.map(row => (
              <FeedRowItem key={row.id} row={row} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// ── Feed row ─────────────────────────────────────────────────────────────────

function FeedRowItem({ row }: { row: FeedRow }) {
  const participant = row.buyer ?? row.worker
  const counterpart = row.worker ?? row.buyer

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1.0] }}
      className="card px-4 py-3 flex items-center gap-3"
      style={{ transition: 'box-shadow 0.15s' }}
    >
      {/* Job number */}
      <span
        className="font-mono text-sm tabular shrink-0"
        style={{ color: 'var(--muted)', minWidth: 28 }}
      >
        #{row.jobId.toString()}
      </span>

      {/* Middle: addresses + label */}
      <div className="flex-1 min-w-0">
        {/* Addresses row */}
        {(participant || counterpart) && (
          <div className="font-mono text-[13px] truncate mb-0.5" style={{ color: 'var(--ink-2)' }}>
            {participant  ? shortenAddr(participant)  : '–'}
            {counterpart && participant !== counterpart
              ? ` → ${shortenAddr(counterpart)}`
              : ''}
          </div>
        )}
        {/* Amount if present */}
        {row.amount != null && row.amount > 0n && (
          <div className="font-mono tabular text-[13px]" style={{ color: 'var(--green)' }}>
            ${formatNativeUsdc(row.amount, 2)} USDC
          </div>
        )}
      </div>

      {/* Badge */}
      <StatusBadge status={KIND_STATUS[row.kind]} className="shrink-0 hidden sm:inline-flex" />

      {/* Relative time + explorer */}
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className="text-[13px]" style={{ color: 'var(--muted)' }}>
          {relativeTime(row.ts)}
        </span>
        <a
          href={buildExplorerTx(row.txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline"
          style={{ color: 'var(--green)' }}
          onClick={e => e.stopPropagation()}
        >
          tx ↗
        </a>
      </div>
    </motion.div>
  )
}

function EmptyFeed() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="card flex flex-col items-center justify-center py-12 gap-3"
    >
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center"
        style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
      >
        <span className="text-xl" style={{ color: 'var(--muted)' }}>◎</span>
      </div>
      <p className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>No activity yet</p>
      <p className="text-sm text-center max-w-[200px]" style={{ color: 'var(--muted)' }}>
        New events will appear here automatically as jobs are created and updated.
      </p>
    </motion.div>
  )
}


