import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { motion } from 'framer-motion'
import { ARKROW_ADDRESS, ARKROW_ABI, ARKROW_CHAIN_ID, JobStatus, formatNativeUsdc } from '../arkrow'
import { useNow, formatDuration } from '../protocol'

const REVIEW = 3 * 24 * 3600
const DISPUTE = 14 * 24 * 3600
const SCAN = 30 // how many of the latest jobs are checked

interface JobLike {
  buyer: string
  worker: string
  amount: bigint
  deadline: bigint
  proofTime: bigint
  disputeTime: bigint
  status: number
}

interface Item { id: bigint; title: string; detail: string; urgent: boolean }

/** A short list of jobs that need something from the connected wallet right now. */
export function ActionInbox() {
  const { address, isConnected } = useAccount()
  const now = useNow(15_000)

  const { data: counter } = useReadContract({
    address: ARKROW_ADDRESS, abi: ARKROW_ABI, functionName: 'jobCounter', chainId: ARKROW_CHAIN_ID,
    query: { enabled: isConnected, refetchInterval: 15_000 },
  })
  const total = counter ? Number(counter) : 0
  const ids = Array.from({ length: Math.min(total, SCAN) }, (_, i) => BigInt(total - i))

  const { data } = useReadContracts({
    contracts: ids.map(id => ({
      address: ARKROW_ADDRESS, abi: ARKROW_ABI, functionName: 'getJob' as const, args: [id] as const, chainId: ARKROW_CHAIN_ID,
    })),
    query: { enabled: isConnected && ids.length > 0, refetchInterval: 15_000 },
  })

  if (!isConnected || !address) return null
  const me = address.toLowerCase()
  const items: Item[] = []

  ids.forEach((id, i) => {
    const r = data?.[i]
    if (!r || r.status !== 'success') return
    const job = r.result as unknown as JobLike
    const isBuyer = job.buyer.toLowerCase() === me
    const isWorker = job.worker.toLowerCase() === me
    if (!isBuyer && !isWorker) return

    const amount = `${formatNativeUsdc(job.amount, 2)} USDC`
    const deadline = Number(job.deadline)
    const reviewEnd = Number(job.proofTime) + REVIEW
    const disputeEnd = Number(job.disputeTime) + DISPUTE

    if (job.status === JobStatus.OPEN) {
      if (isWorker && now <= deadline) {
        items.push({ id, urgent: deadline - now < 86400, title: `Submit proof for job #${id}`, detail: `${amount}. ${formatDuration(deadline - now)} left.` })
      } else if (isBuyer && now > deadline) {
        items.push({ id, urgent: true, title: `Claim your refund for job #${id}`, detail: `${amount}. The deadline passed with no proof.` })
      }
    } else if (job.status === JobStatus.PROOF_SUBMITTED) {
      if (now < reviewEnd) {
        if (isBuyer) items.push({ id, urgent: true, title: `Review the proof for job #${id}`, detail: `${amount}. Approve or dispute within ${formatDuration(reviewEnd - now)}.` })
      } else {
        items.push({ id, urgent: false, title: `Release the payment for job #${id}`, detail: `${amount}. The review window ended, so anyone can release it.` })
      }
    } else if (job.status === JobStatus.DISPUTED && now >= disputeEnd) {
      items.push({ id, urgent: false, title: `Finish the expired dispute on job #${id}`, detail: `${amount}. The buyer's funds can now be returned.` })
    }
  })

  function open(id: bigint) {
    window.location.hash = `#/app?job=${id.toString()}`
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="card p-4 sm:p-5 mb-6 flex flex-col gap-3" aria-label="Jobs that need your action"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-serif text-lg" style={{ color: 'var(--ink)' }}>
          {items.length > 0 ? `Needs your action (${items.length})` : 'You are all caught up'}
        </h2>
        <span className="text-[11px]" style={{ color: 'var(--muted)' }}>Checks your latest {SCAN} jobs</span>
      </div>

      {items.length === 0 && (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Nothing is waiting for you. New tasks, such as a proof to review, will show up here.
        </p>
      )}

      {items.map(it => (
        <button
          key={it.id.toString()}
          type="button"
          onClick={() => open(it.id)}
          className="w-full text-left rounded-xl px-4 py-3 flex items-center justify-between gap-3"
          style={{
            background: it.urgent ? 'var(--amber-light)' : 'var(--surface-muted)',
            border: `1px solid ${it.urgent ? 'var(--amber-border)' : 'var(--border)'}`,
            color: 'var(--ink)',
          }}
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium">{it.title}</span>
            <span className="block text-[11px]" style={{ color: 'var(--muted)' }}>{it.detail}</span>
          </span>
          <span className="text-xs font-medium shrink-0">Open</span>
        </button>
      ))}
    </motion.section>
  )
}
