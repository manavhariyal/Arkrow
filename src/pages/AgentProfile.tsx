import { useReadContract, useReadContracts } from 'wagmi'
import { ARKROW_ADDRESS, ARKROW_ABI, ARKROW_CHAIN_ID, JobStatus, NETWORK_NAME, formatNativeUsdc, buildExplorerAddr } from '../arkrow'
import { PageHeader } from '../components/PageHeader'
import { StatusBadge } from '../components/StatusBadge'
import { buildAgentLink, buildReceiptLink, copyLink } from '../links'

const SCAN = 60 // latest jobs checked for history

interface JobLike { buyer: string; worker: string; amount: bigint; status: number }

/** Public track record for one wallet address, read live from the chain. */
export default function AgentProfile({ address }: { address: `0x${string}` }) {
  const me = address.toLowerCase()

  const { data: completed } = useReadContract({
    address: ARKROW_ADDRESS, abi: ARKROW_ABI, functionName: 'jobsCompleted', args: [address], chainId: ARKROW_CHAIN_ID,
  })
  const { data: earned } = useReadContract({
    address: ARKROW_ADDRESS, abi: ARKROW_ABI, functionName: 'totalEarned', args: [address], chainId: ARKROW_CHAIN_ID,
  })
  const { data: counter } = useReadContract({
    address: ARKROW_ADDRESS, abi: ARKROW_ABI, functionName: 'jobCounter', chainId: ARKROW_CHAIN_ID,
  })

  const total = counter ? Number(counter) : 0
  const ids = Array.from({ length: Math.min(total, SCAN) }, (_, i) => BigInt(total - i))
  const { data: rows, isLoading } = useReadContracts({
    contracts: ids.map(id => ({
      address: ARKROW_ADDRESS, abi: ARKROW_ABI, functionName: 'getJob' as const, args: [id] as const, chainId: ARKROW_CHAIN_ID,
    })),
    query: { enabled: ids.length > 0 },
  })

  const mine = ids.flatMap((id, i) => {
    const r = rows?.[i]
    if (!r || r.status !== 'success') return []
    const j = r.result as unknown as JobLike
    const asWorker = j.worker.toLowerCase() === me
    const asBuyer = j.buyer.toLowerCase() === me
    return asWorker || asBuyer ? [{ id, job: j, role: asWorker ? 'Worker' : 'Buyer' }] : []
  })

  const asWorker = mine.filter(m => m.role === 'Worker')
  const disputed = asWorker.filter(m => m.job.status === JobStatus.DISPUTED).length
  const refunded = asWorker.filter(m => m.job.status === JobStatus.REFUNDED).length
  const done = completed ? Number(completed) : 0

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg)' }}>
      <PageHeader />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pb-16 pt-4 flex flex-col gap-5">
        <section className="card p-5 sm:p-7 flex flex-col gap-4">
          <div>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Agent profile · {NETWORK_NAME}</p>
            <h1 className="font-mono text-sm sm:text-base break-all mt-1" style={{ color: 'var(--ink)' }}>{address}</h1>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Jobs completed" value={String(done)} />
            <Stat label="Total earned" value={`${earned ? formatNativeUsdc(earned, 2) : '0.00'} USDC`} />
            <Stat label="Disputed (recent)" value={String(disputed)} />
            <Stat label="Refunded (recent)" value={String(refunded)} />
          </div>

          <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
            Jobs completed and total earned are counted by the contract itself and cannot be edited. Disputed and refunded counts only cover the latest {SCAN} jobs.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyLink(buildAgentLink(address), 'Profile link copied')}
              className="text-sm px-4 py-2 font-medium"
              style={{ background: 'var(--ink)', color: '#FFF', border: 'none' }}
            >
              Copy profile link
            </button>
            <a
              href={buildExplorerAddr(address)} target="_blank" rel="noopener noreferrer"
              className="text-sm px-4 py-2 font-medium"
              style={{ border: '1px solid var(--border)', color: 'var(--ink)', borderRadius: 999, textDecoration: 'none' }}
            >
              View wallet on the explorer
            </a>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-serif text-xl" style={{ color: 'var(--ink)' }}>Recent jobs</h2>
          {isLoading && <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>}
          {!isLoading && mine.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>No recent jobs for this address.</p>
          )}
          {mine.map(m => (
            <a
              key={m.id.toString()}
              href={buildReceiptLink(m.id)}
              className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--ink)' }}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">Job #{m.id.toString()} · as {m.role.toLowerCase()}</span>
                <span className="block text-[13px] font-mono" style={{ color: 'var(--muted)' }}>{formatNativeUsdc(m.job.amount, 2)} USDC</span>
              </span>
              <StatusBadge status={m.job.status} />
            </a>
          ))}
        </section>
      </main>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
      <div className="font-mono tabular text-lg font-semibold" style={{ color: 'var(--ink)' }}>{value}</div>
      <div className="text-[13px]" style={{ color: 'var(--muted)' }}>{label}</div>
    </div>
  )
}
