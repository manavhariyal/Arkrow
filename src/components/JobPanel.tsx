import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import { keccak256, toBytes } from 'viem'
import {
  ARKROW_ADDRESS, ARKROW_ABI, ARKROW_CHAIN_ID,
  formatNativeUsdc, shortenAddr, buildExplorerTx, NETWORK_NAME,
  JobStatus,
} from '../arkrow'
import { useNow, formatDuration } from '../protocol'
import { ConfirmDialog } from './ConfirmDialog'
import { payoutSplit } from '../jobmath'
import { buildJobLink, buildReceiptLink, copyLink } from '../links'
import { StatusBadge } from './StatusBadge'

const ZERO_HASH = `0x${'0'.repeat(64)}`

interface Props {
  jobId: bigint
  onClose: () => void
  onAction?: () => void
}

export function JobPanel({ jobId, onClose, onAction }: Props) {
  const { address, isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const onWrongChain = isConnected && chainId !== ARKROW_CHAIN_ID

  const { data: job, refetch } = useReadContract({
    address: ARKROW_ADDRESS,
    abi: ARKROW_ABI,
    functionName: 'getJob',
    args: [jobId],
    chainId: ARKROW_CHAIN_ID,
    query: { refetchInterval: 8_000 },
  })

  const { writeContract, data: hash, isPending, isError, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const [proofText, setProofText]   = useState('')
  const [checkText, setCheckText]   = useState('')
  const [confirm, setConfirm]       = useState<null | 'approve' | 'dispute' | 'refund'>(null)
  const now = useNow()
  const [actionError, setActionError] = useState('')

  // Proof text the worker attached (stored in the contract, read with a plain call).
  const { data: proofTextData } = useReadContract({
    address: ARKROW_ADDRESS,
    abi: ARKROW_ABI,
    functionName: 'proofText',
    args: [jobId],
    chainId: ARKROW_CHAIN_ID,
    query: { enabled: !!job && job.proofHash !== ZERO_HASH },
  })
  const proofContent = typeof proofTextData === 'string' && proofTextData.length > 0 ? proofTextData : null

  function refetchAndNotify() {
    void refetch()
    onAction?.()
  }

  type CallFn = 'approve' | 'dispute' | 'refund' | 'release' | 'expireDispute' | 'submitProof' | 'submitProofWithText'

  function call(functionName: CallFn, args: readonly [bigint] | readonly [bigint, `0x${string}`] | readonly [bigint, string]) {
    setActionError('')
    writeContract({
      address: ARKROW_ADDRESS,
      abi: ARKROW_ABI,
      functionName,
      args,
      chainId: ARKROW_CHAIN_ID,
    }, {
      onSuccess() { refetchAndNotify() },
      onError(e) { setActionError(e.message) },
    })
  }

  function submitProof() {
    if (!proofText.trim()) { setActionError('Paste a proof string or URL.'); return }
    const text = proofText.trim()
    if (new TextEncoder().encode(text).length > 280) { setActionError('Proof is too long. Keep it under 280 characters (a link is best).'); return }
    call('submitProofWithText', [jobId, text] as const)
  }

  if (!job) {
    return (
      <div className="card p-6 flex items-center justify-center min-h-[160px]">
        <div
          className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--border-strong)', borderTopColor: 'var(--green)' }}
        />
      </div>
    )
  }

  const st     = job.status as JobStatus

  const isBuyer  = address?.toLowerCase() === job.buyer.toLowerCase()
  const isWorker = address?.toLowerCase() === job.worker.toLowerCase()
  const isBusy   = isPending || isConfirming

  const reviewDeadline  = Number(job.proofTime) + 3 * 24 * 3600
  const reviewOpen      = st === JobStatus.PROOF_SUBMITTED && now < reviewDeadline
  const reviewExpired   = st === JobStatus.PROOF_SUBMITTED && now >= reviewDeadline

  const disputeDeadline  = Number(job.disputeTime) + 14 * 24 * 3600
  const disputeCanExpire = st === JobStatus.DISPUTED && now >= disputeDeadline

  const deadlineSecs     = Number(job.deadline)
  const noProofYet       = st === JobStatus.OPEN
  const canApprove       = isBuyer  && reviewOpen
  const canDispute       = isBuyer  && reviewOpen
  // The contract only allows a refund AFTER the deadline, when no proof was submitted.
  const canRefund        = isBuyer  && noProofYet && now > deadlineSecs
  const canSubmit        = isWorker && st === JobStatus.OPEN            && now < Number(job.deadline)
  const canExpireDispute = disputeCanExpire

  const split = payoutSplit(job)
  const workerNet = split.worker
  const workerFee = split.fee

  const ZERO_ADDR  = '0x0000000000000000000000000000000000000000'
  const ZERO_BYTES = ZERO_HASH

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1.0] }}
        className="card overflow-hidden"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-muted)' }}
        >
          <div className="flex items-center gap-2.5">
            <span className="font-medium text-sm" style={{ color: 'var(--ink)' }}>
              Job #{jobId.toString()}
            </span>
            <StatusBadge status={job.status} />
          </div>
          <div className="flex items-center gap-1.5">
          <button
            onClick={() => void copyLink(buildJobLink(jobId), 'Job link copied')}
            className="text-sm px-2.5 py-1 rounded-lg transition-all hover:opacity-70"
            style={{ color: 'var(--ink-2)', background: 'var(--border)', border: 'none' }}
          >
            Copy link
          </button>
          <a
            href={buildReceiptLink(jobId)} target="_blank" rel="noopener noreferrer"
            className="text-sm px-2.5 py-1 rounded-lg transition-all hover:opacity-70"
            style={{ color: 'var(--ink-2)', background: 'var(--border)', textDecoration: 'none' }}
          >
            Receipt
          </a>
          <button
            onClick={onClose}
            className="text-sm px-2.5 py-1 rounded-lg transition-all hover:opacity-70"
            style={{ color: 'var(--muted)', background: 'var(--border)', border: 'none' }}
          >
            Close
          </button>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Amount row */}
          <div
            className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: 'var(--green-light)', border: '1px solid var(--green-border)' }}
          >
            <span className="text-sm" style={{ color: 'var(--green)' }}>Escrowed</span>
            <div className="text-right">
              <div className="font-mono tabular text-lg font-bold" style={{ color: 'var(--green)' }}>
                ${formatNativeUsdc(job.amount, 4)} USDC
              </div>
              <div className="text-[13px]" style={{ color: 'var(--muted)' }}>
                Worker gets ~${formatNativeUsdc(workerNet, 4)} after {Number(job.feeBps) / 100}% fee{job.referrer !== ZERO_ADDR && job.referrerBps > 0n ? ' and referrer share' : ''}
              </div>
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Kv label="Buyer"    value={shortenAddr(job.buyer)}  mono copyable={job.buyer}  highlight={isBuyer  ? 'var(--green)'  : undefined} />
            <Kv label="Worker"   value={shortenAddr(job.worker)} mono copyable={job.worker} highlight={isWorker ? 'var(--green)' : undefined} />
            {job.referrer !== ZERO_ADDR && (
              <Kv label="Referrer" value={shortenAddr(job.referrer)} mono copyable={job.referrer} />
            )}
            <Kv label="Deadline" value={new Date(Number(job.deadline) * 1000).toLocaleDateString()} />
          </div>

          {/* Proof hash */}
          {job.proofHash !== ZERO_BYTES && (
            <div
              className="rounded-xl px-4 py-3"
              style={{ background: 'var(--amber-light)', border: '1px solid var(--amber-border)' }}
            >
              <div className="text-[13px] mb-1" style={{ color: 'var(--muted)' }}>Proof hash (keccak256)</div>
              <div className="font-mono text-[13px] break-all" style={{ color: 'var(--amber)' }}>
                {job.proofHash}
              </div>
              {proofContent ? (
                <div className="mt-2 rounded-lg px-3 py-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="text-[13px] mb-1" style={{ color: 'var(--muted)' }}>Proof from the worker</div>
                  <ProofView text={proofContent} />
                  <div className="text-[13px] mt-1.5 font-medium" style={{ color: 'var(--green)' }}>✓ Verified. This text matches the fingerprint stored on-chain.</div>
                </div>
              ) : (
              <>
              <div className="text-[13px] mt-2" style={{ color: 'var(--muted)' }}>
                This job has a proof fingerprint only (no readable text). Ask the worker for the link or text and paste it below to confirm it is the exact one they submitted.
              </div>
              <input
                type="text"
                value={checkText}
                onChange={e => setCheckText(e.target.value)}
                placeholder="Paste the proof the worker sent you"
                className="w-full text-sm px-3 py-2 rounded-lg outline-none mt-2"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
              />
              {checkText.trim() && (
                keccak256(toBytes(checkText.trim())) === job.proofHash
                  ? <div className="text-[13px] mt-1.5 font-medium" style={{ color: 'var(--green)' }}>✓ Match — this is the proof the worker submitted.</div>
                  : <div className="text-[13px] mt-1.5 font-medium" style={{ color: 'var(--rose)' }}>✗ No match — this is not what the worker submitted. Check for extra spaces or a different link.</div>
              )}
              </>
              )}
            </div>
          )}

          {/* Notices with live countdowns */}
          {noProofYet && now <= deadlineSecs && (isBuyer || isWorker) && (
            <Notice color="amber">
              {isWorker
                ? `You have ${formatDuration(deadlineSecs - now)} left to submit proof (deadline ${new Date(deadlineSecs * 1000).toLocaleString()}).`
                : `Waiting for the worker. They have ${formatDuration(deadlineSecs - now)} left to submit proof. If they do not, you can claim a full refund after ${new Date(deadlineSecs * 1000).toLocaleString()}.`}
            </Notice>
          )}
          {noProofYet && now > deadlineSecs && isBuyer && (
            <Notice color="green">
              The deadline passed and no proof was submitted. You can claim a full refund.
            </Notice>
          )}
          {noProofYet && now > deadlineSecs && !isBuyer && (
            <Notice color="rose">
              The deadline passed and no proof was submitted. The buyer can claim a refund.
            </Notice>
          )}
          {reviewOpen && (
            <Notice color="amber">
              Review window: {formatDuration(reviewDeadline - now)} left (ends {new Date(reviewDeadline * 1000).toLocaleString()}).
              {' '}Buyer: approve or dispute before then. After that, anyone can release the payment to the worker.
            </Notice>
          )}
          {reviewExpired && (
            <Notice color="green">
              The review window has ended. Anyone can now release the payment to the worker.
            </Notice>
          )}
          {st === JobStatus.DISPUTED && !disputeCanExpire && (
            <Notice color="rose">
              Dispute open. The owner can resolve it. If nobody resolves it, the buyer can reclaim the funds in {formatDuration(disputeDeadline - now)}.
            </Notice>
          )}
          {disputeCanExpire && (
            <Notice color="rose">
              The dispute window (14 days) has ended. The buyer's funds can now be returned.
            </Notice>
          )}

          {/* Success tx link */}
          {isSuccess && hash && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <a
                href={buildExplorerTx(hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline"
                style={{ color: 'var(--green)' }}
              >
                Confirmed — view on explorer
              </a>
            </motion.div>
          )}

          {/* Errors */}
          {(actionError || isError) && (
            <p
              className="text-sm rounded-lg px-3 py-2"
              style={{ background: 'var(--rose-light)', color: 'var(--rose)', border: '1px solid var(--rose-border)' }}
            >
              {parseErr(actionError || error?.message)}
            </p>
          )}

          {/* Worker: submit proof */}
          {canSubmit && (
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-medium" style={{ color: 'var(--ink-2)' }}>
                Submit proof (a link or short text). The buyer will see it in their dashboard. It is public on-chain, so never paste secrets.
              </label>
              <input
                type="text"
                value={proofText}
                onChange={e => setProofText(e.target.value)}
                placeholder="https://…"
                className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
                style={{
                  background: 'var(--surface-muted)',
                  border: '1px solid var(--border)',
                  color: 'var(--ink)',
                }}
              />
              <ActionBtn
                label="Submit proof" variant="amber" onClick={submitProof}
                busy={isBusy} onWrongChain={onWrongChain}
                onSwitch={() => switchChain({ chainId: ARKROW_CHAIN_ID })}
              />
            </div>
          )}

          {/* Buyer: approve */}
          {canApprove && (
            <ActionBtn
              label="Approve & release payment" variant="green"
              onClick={() => setConfirm('approve')}
              busy={isBusy} onWrongChain={onWrongChain}
              onSwitch={() => switchChain({ chainId: ARKROW_CHAIN_ID })}
            />
          )}

          {/* Buyer: dispute */}
          {canDispute && (
            <ActionBtn
              label="Raise dispute" variant="rose"
              onClick={() => setConfirm('dispute')}
              busy={isBusy} onWrongChain={onWrongChain}
              onSwitch={() => switchChain({ chainId: ARKROW_CHAIN_ID })}
            />
          )}

          {/* Anyone: release after review window */}
          {reviewExpired && st === JobStatus.PROOF_SUBMITTED && (
            <ActionBtn
              label="Release (review window expired)" variant="green"
              onClick={() => call('release', [jobId] as const)}
              busy={isBusy} onWrongChain={onWrongChain}
              onSwitch={() => switchChain({ chainId: ARKROW_CHAIN_ID })}
            />
          )}

          {/* Buyer: refund (only after the deadline, when no proof was submitted) */}
          {canRefund && (
            <ActionBtn
              label="Claim refund (deadline passed)" variant="green"
              onClick={() => setConfirm('refund')}
              busy={isBusy} onWrongChain={onWrongChain}
              onSwitch={() => switchChain({ chainId: ARKROW_CHAIN_ID })}
            />
          )}

          {/* Expire dispute */}
          {canExpireDispute && (
            <ActionBtn
              label="Expire dispute (14 days passed)" variant="rose"
              onClick={() => call('expireDispute', [jobId] as const)}
              busy={isBusy} onWrongChain={onWrongChain}
              onSwitch={() => switchChain({ chainId: ARKROW_CHAIN_ID })}
            />
          )}
        </div>

        <ConfirmDialog
          open={confirm === 'approve'}
          title="Approve and pay the worker?"
          rows={[
            { label: 'Worker receives', value: `${formatNativeUsdc(workerNet, 4)} USDC` },
            { label: 'Arkrow fee', value: `${formatNativeUsdc(workerFee, 4)} USDC` },
            ...(split.referrer > 0n ? [{ label: 'Referrer receives', value: `${formatNativeUsdc(split.referrer, 4)} USDC` }] : []),
            { label: 'Worker address', value: job.worker, mono: true },
          ]}
          warning="This pays the worker now and cannot be undone. Only approve after you have checked the proof."
          confirmLabel="Approve & pay"
          onConfirm={() => { setConfirm(null); call('approve', [jobId] as const) }}
          onCancel={() => setConfirm(null)}
        />
        <ConfirmDialog
          open={confirm === 'dispute'}
          title="Raise a dispute?"
          rows={[
            { label: 'Amount in escrow', value: `${formatNativeUsdc(job.amount, 4)} USDC` },
            { label: 'Worker address', value: job.worker, mono: true },
          ]}
          warning="The funds stay locked while the owner reviews the case. If nobody resolves it within 14 days, you can reclaim them."
          confirmLabel="Raise dispute"
          danger
          onConfirm={() => { setConfirm(null); call('dispute', [jobId] as const) }}
          onCancel={() => setConfirm(null)}
        />
        <ConfirmDialog
          open={confirm === 'refund'}
          title="Claim your refund?"
          rows={[{ label: 'You get back', value: `${formatNativeUsdc(job.amount, 4)} USDC` }]}
          warning="This closes the job. The worker will not be paid."
          confirmLabel="Claim refund"
          onConfirm={() => { setConfirm(null); call('refund', [jobId] as const) }}
          onCancel={() => setConfirm(null)}
        />
      </motion.div>
    </AnimatePresence>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Kv({ label, value, mono, copyable, highlight }: {
  label: string; value: string; mono?: boolean; copyable?: string; highlight?: string
}) {
  function copy() {
    if (copyable) navigator.clipboard.writeText(copyable).catch(() => {})
  }
  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
    >
      <div className="text-xs mb-0.5" style={{ color: 'var(--muted)' }}>{label}</div>
      <div
        className={`text-sm truncate ${mono ? 'font-mono' : ''} ${copyable ? 'cursor-pointer' : ''}`}
        style={{ color: highlight ?? 'var(--ink-2)' }}
        title={copyable}
        onClick={copy}
      >
        {value}
      </div>
    </div>
  )
}

type NoticeVariant = 'green' | 'amber' | 'rose'

function Notice({ color, children }: { color: NoticeVariant; children: React.ReactNode }) {
  const styles: Record<NoticeVariant, { bg: string; border: string; text: string }> = {
    green: { bg: 'var(--green-light)', border: 'var(--green-border)', text: 'var(--green)' },
    amber: { bg: 'var(--amber-light)', border: 'var(--amber-border)', text: 'var(--amber)' },
    rose:  { bg: 'var(--rose-light)',  border: 'var(--rose-border)',  text: 'var(--rose)'  },
  }
  const s = styles[color]
  return (
    <div
      className="rounded-xl px-4 py-3 text-sm font-medium"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.text }}
    >
      {children}
    </div>
  )
}

type ActionVariant = 'green' | 'amber' | 'rose' | 'neutral'

function ActionBtn({ label, variant, onClick, busy, onWrongChain, onSwitch }: {
  label: string; variant: ActionVariant; onClick: () => void
  busy: boolean; onWrongChain: boolean; onSwitch: () => void
}) {
  if (onWrongChain) {
    return (
      <button
        onClick={onSwitch}
        className="w-full py-2.5 rounded-lg text-base font-medium transition-all"
        style={{ background: 'var(--rose-light)', color: 'var(--rose)', border: '1px solid var(--rose-border)' }}
      >
        Switch to {NETWORK_NAME}
      </button>
    )
  }

  const styles: Record<ActionVariant, { bg: string; border: string; color: string; busyBg: string; busyColor: string }> = {
    green:   { bg: 'var(--ink)',        border: 'var(--ink)',         color: '#FFF',           busyBg: 'var(--border)',      busyColor: 'var(--muted)' },
    amber:   { bg: 'var(--amber-light)', border: 'var(--amber-border)', color: 'var(--amber)',  busyBg: 'var(--amber-light)', busyColor: 'var(--amber)' },
    rose:    { bg: 'var(--rose-light)',  border: 'var(--rose-border)',  color: 'var(--rose)',   busyBg: 'var(--rose-light)',  busyColor: 'var(--rose)'  },
    neutral: { bg: 'var(--surface-muted)', border: 'var(--border)',   color: 'var(--ink-2)',   busyBg: 'var(--surface-muted)', busyColor: 'var(--muted)' },
  }
  const s = styles[variant]

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="w-full py-2.5 rounded-lg text-base font-medium transition-all active:scale-[0.98]"
      style={{
        background: busy ? s.busyBg  : s.bg,
        border: `1px solid ${s.border}`,
        color: busy ? s.busyColor : s.color,
        cursor: busy ? 'not-allowed' : 'pointer',
        opacity: busy ? 0.7 : 1,
      }}
    >
      {busy ? 'Confirming…' : label}
    </button>
  )
}

function parseErr(msg?: string): string {
  if (!msg) return 'Transaction failed.'
  const m = msg.toLowerCase()
  if (m.includes('user rejected') || m.includes('rejected the request')) return 'Transaction cancelled.'
  if (m.includes('wrongstatus'))         return 'Job is not in the right status.'
  if (m.includes('notbuyer'))            return 'Only the buyer can do this.'
  if (m.includes('notworker'))           return 'Only the worker can do this.'
  if (m.includes('reviewwindowopen'))    return 'Review window is still open.'
  if (m.includes('reviewwindowexpired')) return 'Review window has already expired.'
  if (m.includes('deadlinenotpassed'))   return 'Deadline has not passed yet.'
  if (m.includes('deadlinealreadypassed')) return 'Deadline has already passed.'
  if (m.includes('disputenotexpired'))   return 'Dispute expiry has not passed yet.'
  if (m.includes('disputealreadyexpired')) return 'Dispute has already expired.'
  if (m.includes('prooftextempty'))      return 'Write the proof (a link or short text) first.'
  if (m.includes('prooftexttoolong'))    return 'Proof is too long. Keep it under 280 characters.'
  return 'Transaction failed. Try again.'
}


function ProofView({ text }: { text: string }) {
  let href: string | null = null
  try {
    const u = new URL(text)
    if (u.protocol === 'http:' || u.protocol === 'https:') href = u.toString()
  } catch { /* not a link */ }
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm underline break-all" style={{ color: 'var(--ink)' }}>
      {text}
    </a>
  ) : (
    <div className="text-sm break-words whitespace-pre-wrap" style={{ color: 'var(--ink)' }}>{text}</div>
  )
}
