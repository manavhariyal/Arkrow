import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import { keccak256, toBytes } from 'viem'
import {
  ARKROW_ADDRESS, ARKROW_ABI, ARKROW_CHAIN_ID,
  formatNativeUsdc, shortenAddr, buildExplorerTx,
  JobStatus,
} from '../arkrow'
import { StatusBadge } from './StatusBadge'

// Snapshot at module load — stable for the session, avoids impure-in-render lint
const NOW_SECS = Math.floor(Date.now() / 1000)

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
  const [actionError, setActionError] = useState('')

  function refetchAndNotify() {
    void refetch()
    onAction?.()
  }

  type CallFn = 'approve' | 'dispute' | 'refund' | 'release' | 'expireDispute' | 'submitProof'

  function call(functionName: CallFn, args: readonly [bigint] | readonly [bigint, `0x${string}`]) {
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
    const proofHash32 = keccak256(toBytes(proofText.trim()))
    call('submitProof', [jobId, proofHash32] as const)
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

  const now    = NOW_SECS
  const st     = job.status as JobStatus

  const isBuyer  = address?.toLowerCase() === job.buyer.toLowerCase()
  const isWorker = address?.toLowerCase() === job.worker.toLowerCase()
  const isBusy   = isPending || isConfirming

  const reviewDeadline  = Number(job.proofTime) + 3 * 24 * 3600
  const reviewOpen      = st === JobStatus.PROOF_SUBMITTED && now < reviewDeadline
  const reviewExpired   = st === JobStatus.PROOF_SUBMITTED && now >= reviewDeadline

  const disputeDeadline  = Number(job.disputeTime) + 14 * 24 * 3600
  const disputeCanExpire = st === JobStatus.DISPUTED && now >= disputeDeadline

  const canRelease       = isBuyer  && st === JobStatus.OPEN            && now >= Number(job.deadline)
  const canApprove       = isBuyer  && reviewOpen
  const canDispute       = isBuyer  && reviewOpen
  const canRefund        = isBuyer  && st === JobStatus.OPEN            && now < Number(job.deadline)
  const canSubmit        = isWorker && st === JobStatus.OPEN            && now < Number(job.deadline)
  const canExpireDispute = disputeCanExpire

  const workerFee = (job.amount * job.feeBps) / 10000n
  const workerNet = job.amount - workerFee

  const ZERO_ADDR  = '0x0000000000000000000000000000000000000000'
  const ZERO_BYTES = '0x0000000000000000000000000000000000000000000000000000000000000000'

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
          <button
            onClick={onClose}
            className="text-xs px-2.5 py-1 rounded-lg transition-all hover:opacity-70"
            style={{ color: 'var(--muted)', background: 'var(--border)', border: 'none' }}
          >
            Close
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Amount row */}
          <div
            className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{ background: 'var(--green-light)', border: '1px solid var(--green-border)' }}
          >
            <span className="text-xs" style={{ color: 'var(--green)' }}>Escrowed</span>
            <div className="text-right">
              <div className="font-mono tabular text-lg font-bold" style={{ color: 'var(--green)' }}>
                ${formatNativeUsdc(job.amount, 4)} USDC
              </div>
              <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                Worker gets ~${formatNativeUsdc(workerNet, 4)} after {Number(job.feeBps) / 100}% fee
              </div>
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-2 text-xs">
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
              <div className="text-[11px] mb-1" style={{ color: 'var(--muted)' }}>Proof hash (keccak256)</div>
              <div className="font-mono text-[11px] break-all" style={{ color: 'var(--amber)' }}>
                {job.proofHash}
              </div>
              <div className="text-[11px] mt-2" style={{ color: 'var(--muted)' }}>
                Arkrow stores only a fingerprint of the proof, not the link itself. The worker sends you the link or text directly (chat, email). Paste it below to confirm it is the exact one they submitted.
              </div>
              <input
                type="text"
                value={checkText}
                onChange={e => setCheckText(e.target.value)}
                placeholder="Paste the proof the worker sent you"
                className="w-full text-xs px-3 py-2 rounded-lg outline-none mt-2"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
              />
              {checkText.trim() && (
                keccak256(toBytes(checkText.trim())) === job.proofHash
                  ? <div className="text-[11px] mt-1.5 font-medium" style={{ color: 'var(--green)' }}>✓ Match — this is the proof the worker submitted.</div>
                  : <div className="text-[11px] mt-1.5 font-medium" style={{ color: 'var(--rose)' }}>✗ No match — this is not what the worker submitted. Check for extra spaces or a different link.</div>
              )}
            </div>
          )}

          {/* Notices */}
          {reviewOpen && (
            <Notice color="amber">
              Review open until {new Date(reviewDeadline * 1000).toLocaleString()}. Buyer: approve or dispute before then. After that, anyone can release the payment to the worker.
            </Notice>
          )}
          {reviewExpired && (
            <Notice color="green">
              Review window has passed. Anyone can release payment to the worker.
            </Notice>
          )}
          {disputeCanExpire && (
            <Notice color="rose">
              Dispute expired (14 days). Buyer can reclaim funds.
            </Notice>
          )}

          {/* Success tx link */}
          {isSuccess && hash && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <a
                href={buildExplorerTx(hash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline"
                style={{ color: 'var(--green)' }}
              >
                Confirmed — view on explorer
              </a>
            </motion.div>
          )}

          {/* Errors */}
          {(actionError || isError) && (
            <p
              className="text-xs rounded-lg px-3 py-2"
              style={{ background: 'var(--rose-light)', color: 'var(--rose)', border: '1px solid var(--rose-border)' }}
            >
              {parseErr(actionError || error?.message)}
            </p>
          )}

          {/* Worker: submit proof */}
          {canSubmit && (
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-medium" style={{ color: 'var(--ink-2)' }}>
                Submit proof (URL or any text). Only its fingerprint is stored on-chain, so also send the same link or text to the buyer.
              </label>
              <input
                type="text"
                value={proofText}
                onChange={e => setProofText(e.target.value)}
                placeholder="https://…"
                className="w-full text-xs px-3 py-2.5 rounded-lg outline-none"
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
              onClick={() => call('approve', [jobId] as const)}
              busy={isBusy} onWrongChain={onWrongChain}
              onSwitch={() => switchChain({ chainId: ARKROW_CHAIN_ID })}
            />
          )}

          {/* Buyer: dispute */}
          {canDispute && (
            <ActionBtn
              label="Raise dispute" variant="rose"
              onClick={() => call('dispute', [jobId] as const)}
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

          {/* Buyer: refund */}
          {canRefund && (
            <ActionBtn
              label="Cancel & refund" variant="neutral"
              onClick={() => call('refund', [jobId] as const)}
              busy={isBusy} onWrongChain={onWrongChain}
              onSwitch={() => switchChain({ chainId: ARKROW_CHAIN_ID })}
            />
          )}

          {/* Buyer: release (deadline passed, no proof) */}
          {canRelease && (
            <ActionBtn
              label="Release (deadline passed)" variant="green"
              onClick={() => call('release', [jobId] as const)}
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
      <div className="text-[10px] mb-0.5" style={{ color: 'var(--muted)' }}>{label}</div>
      <div
        className={`text-xs truncate ${mono ? 'font-mono' : ''} ${copyable ? 'cursor-pointer' : ''}`}
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
      className="rounded-xl px-4 py-3 text-xs font-medium"
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
        className="w-full py-2.5 rounded-lg text-xs font-medium transition-all"
        style={{ background: 'var(--rose-light)', color: 'var(--rose)', border: '1px solid var(--rose-border)' }}
      >
        Switch to Arc Testnet
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
      className="w-full py-2.5 rounded-lg text-xs font-medium transition-all active:scale-[0.98]"
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
  return 'Transaction failed. Try again.'
}
