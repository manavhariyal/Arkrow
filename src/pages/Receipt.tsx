import { useReadContract } from 'wagmi'
import { ARKROW_ADDRESS, ARKROW_ABI, ARKROW_CHAIN_ID, JobStatus, NETWORK_NAME, formatNativeUsdc, buildExplorerAddr } from '../arkrow'
import { keccak256, toBytes } from 'viem'
import { payoutSplit } from '../jobmath'
import { buildReceiptLink, copyLink } from '../links'
import { StatusBadge } from '../components/StatusBadge'
import { PageHeader } from '../components/PageHeader'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const ZERO_HASH = `0x${'0'.repeat(64)}`

function when(secs: bigint): string {
  return secs > 0n ? new Date(Number(secs) * 1000).toLocaleString() : '—'
}

/** Public, read-only receipt for one job. Everything on it is read live from the chain. */
export default function Receipt({ jobId }: { jobId: bigint }) {
  const { data: job, isLoading, isError } = useReadContract({
    address: ARKROW_ADDRESS, abi: ARKROW_ABI, functionName: 'getJob', args: [jobId], chainId: ARKROW_CHAIN_ID,
  })
  const hasProof = !!job && job.proofHash !== ZERO_HASH
  const { data: proofTextData } = useReadContract({
    address: ARKROW_ADDRESS, abi: ARKROW_ABI, functionName: 'proofText', args: [jobId], chainId: ARKROW_CHAIN_ID,
    query: { enabled: hasProof },
  })
  const proofText = typeof proofTextData === 'string' && proofTextData.length > 0 ? proofTextData : null
  const proofVerified = !!job && !!proofText && keccak256(toBytes(proofText)) === job.proofHash

  const exists = !!job && job.buyer !== ZERO_ADDRESS
  const status = job?.status as JobStatus | undefined
  const split = job ? payoutSplit(job) : null

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg)' }}>
      <PageHeader />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 pb-16 pt-4">
        {isLoading && <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading receipt…</p>}

        {(isError || (!isLoading && !exists)) && (
          <div className="card p-6">
            <h1 className="font-serif text-2xl" style={{ color: 'var(--ink)' }}>Receipt not found</h1>
            <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
              There is no job #{jobId.toString()} on {NETWORK_NAME}. Check the link, and make sure it was made for this network.
            </p>
          </div>
        )}

        {exists && job && split && (
          <article className="card p-5 sm:p-7 flex flex-col gap-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Arkrow receipt · {NETWORK_NAME}</p>
                <h1 className="font-serif text-3xl" style={{ color: 'var(--ink)' }}>Job #{jobId.toString()}</h1>
              </div>
              <StatusBadge status={job.status} />
            </div>

            <div className="rounded-xl px-4 py-4" style={{ background: 'var(--green-light)', border: '1px solid var(--green-border)' }}>
              <p className="text-sm" style={{ color: 'var(--green)' }}>
                {status === JobStatus.RELEASED ? 'Paid out' : status === JobStatus.REFUNDED ? 'Returned to the buyer' : 'Locked in escrow'}
              </p>
              <p className="font-mono tabular text-3xl font-bold" style={{ color: 'var(--green)' }}>
                {formatNativeUsdc(status === JobStatus.RELEASED ? split.worker : job.amount, 4)} USDC
              </p>
              {status === JobStatus.RELEASED && (
                <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                  Received by the worker, from {formatNativeUsdc(job.amount, 4)} USDC escrowed.
                </p>
              )}
              {(status === JobStatus.OPEN || status === JobStatus.PROOF_SUBMITTED || status === JobStatus.DISPUTED) && (
                <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                  This job is not finished yet, so this receipt can still change.
                </p>
              )}
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Row label="Buyer" value={job.buyer} mono />
              <Row label="Worker" value={job.worker} mono />
              <Row label="Amount escrowed" value={`${formatNativeUsdc(job.amount, 4)} USDC`} />
              <Row label={`Arkrow fee (${Number(job.feeBps) / 100}%)`} value={`${formatNativeUsdc(split.fee, 4)} USDC`} />
              {split.referrer > 0n && <Row label="Referrer" value={`${formatNativeUsdc(split.referrer, 4)} USDC to ${job.referrer}`} />}
              <Row label="Deadline" value={when(job.deadline)} />
              <Row label="Proof submitted" value={when(job.proofTime)} />
              {job.disputeTime > 0n && <Row label="Dispute raised" value={when(job.disputeTime)} />}
            </dl>

            {hasProof && (
              <div className="rounded-xl px-4 py-3" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                <p className="text-sm mb-1" style={{ color: 'var(--muted)' }}>Proof from the worker</p>
                {proofText
                  ? <p className="text-sm break-words whitespace-pre-wrap" style={{ color: 'var(--ink)' }}>{proofText}</p>
                  : <p className="text-sm" style={{ color: 'var(--muted)' }}>Only a fingerprint was submitted for this job.</p>}
                {proofVerified && <p className="text-[13px] mt-1.5 font-medium" style={{ color: 'var(--green)' }}>✓ Matches the fingerprint stored on-chain.</p>}
                <p className="font-mono text-xs mt-2 break-all" style={{ color: 'var(--muted)' }}>{job.proofHash}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => void copyLink(buildReceiptLink(jobId), 'Receipt link copied')}
                className="text-sm px-4 py-2 font-medium"
                style={{ background: 'var(--ink)', color: '#FFF', border: 'none' }}
              >
                Copy receipt link
              </button>
              <a
                href={buildExplorerAddr(ARKROW_ADDRESS)} target="_blank" rel="noopener noreferrer"
                className="text-sm px-4 py-2 font-medium"
                style={{ border: '1px solid var(--border)', color: 'var(--ink)', borderRadius: 999, textDecoration: 'none' }}
              >
                View the contract on the explorer
              </a>
            </div>

            <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
              This page reads straight from the Arc blockchain. Nobody, including Arkrow, can edit what it shows.
            </p>
          </article>
        )}
      </main>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px]" style={{ color: 'var(--muted)' }}>{label}</dt>
      <dd className={`${mono ? 'font-mono text-sm' : 'text-sm'} break-all`} style={{ color: 'var(--ink)' }}>{value}</dd>
    </div>
  )
}
