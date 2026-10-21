import { useEffect, useState } from 'react'
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { motion } from 'framer-motion'
import { isAddress } from 'viem'
import {
  ARKROW_ADDRESS, ARKROW_ABI, ARKROW_CHAIN_ID,
  parseNativeUsdc, formatNativeUsdc, buildExplorerTx, NETWORK_NAME,
} from '../arkrow'
import { useProtocolInfo } from '../protocol'
import { ConfirmDialog } from './ConfirmDialog'
import { useHashParams, parsePrefill, buildRequestLink, copyLink } from '../links'

// Kept aside for the network fee so a job never uses the very last of the wallet's USDC.
const GAS_RESERVE = 20_000_000_000_000_000n // 0.02 USDC

export function PostJob({ onJobCreated }: { onJobCreated?: () => void }) {
  const { isConnected, chainId, address } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const onWrongChain = isConnected && chainId !== ARKROW_CHAIN_ID

  const [worker, setWorker]             = useState('')
  const [deadlineDays, setDeadlineDays] = useState('7')
  const [referrer, setReferrer]         = useState('')
  const [referrerBps, setReferrerBps]   = useState('')
  const [amount, setAmount]             = useState('')
  const [formError, setFormError]       = useState('')
  const [confirmOpen, setConfirmOpen]   = useState(false)

  const [fromLink, setFromLink] = useState(false)
  const hashParams = useHashParams()
  const prefillKey = hashParams.toString()

  // A link like #/app?worker=0x…&amount=1&days=7 fills in the form. The person still reviews and confirms.
  useEffect(() => {
    const p = parsePrefill(new URLSearchParams(prefillKey))
    if (!p) return
    setWorker(p.worker)
    if (p.amount) setAmount(p.amount)
    if (p.days) setDeadlineDays(p.days)
    if (p.referrer) setReferrer(p.referrer)
    if (p.bps) setReferrerBps(p.bps)
    setFromLink(true)
  }, [prefillKey])

  const info = useProtocolInfo()
  const { data: balance } = useBalance({
    address, chainId: ARKROW_CHAIN_ID,
    query: { enabled: !!address, refetchInterval: 15_000 },
  })

  const { writeContract, data: hash, isPending, isError, error, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  function validate(): string | null {
    if (!isAddress(worker)) return 'Worker address is not valid.'
    const days = parseFloat(deadlineDays)
    if (isNaN(days) || days < 1) return 'Deadline must be at least 1 day.'
    if (info.paused) return 'New jobs are paused for now. Please try again later.'
    if (!/^\d+(\.\d{1,18})?$/.test(amount.trim())) return 'Enter the amount as a plain number, like 1.50.'
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) return 'Amount must be greater than 0.'
    if (amt > info.maxJobUsdc) return `Launch limit: ${info.maxJobUsdc} USDC per job while Arkrow is new.`
    if (balance && parseNativeUsdc(amount.trim()) + GAS_RESERVE > balance.value) {
      return `Not enough USDC. You have ${formatNativeUsdc(balance.value, 4)}, and this job needs about ${formatNativeUsdc(parseNativeUsdc(amount.trim()) + GAS_RESERVE, 4)} (amount plus network fee).`
    }
    if (referrerBps && !referrer) return 'Referrer address is required when a share is set.'
    if (referrer && !isAddress(referrer)) return 'Referrer address is not valid.'
    const pct = referrerBps ? parseFloat(referrerBps) : 0
    if (isNaN(pct) || pct < 0 || pct > 10) return 'Referrer share must be between 0 and 10%.'
    if (worker.toLowerCase() === address?.toLowerCase()) return 'Worker cannot be your own address.'
    return null
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    const err = validate()
    if (err) { setFormError(err); return }
    setConfirmOpen(true)
  }

  function postJob() {
    setConfirmOpen(false)
    const deadlineTs = BigInt(Math.floor(Date.now() / 1000) + Math.floor(parseFloat(deadlineDays) * 86400))
    const amountRaw  = parseNativeUsdc(amount.trim())
    const bps        = referrerBps ? BigInt(Math.round(parseFloat(referrerBps) * 100)) : 0n
    const ref        = (referrer && isAddress(referrer)) ? referrer : '0x0000000000000000000000000000000000000000'

    writeContract({
      address: ARKROW_ADDRESS,
      abi: ARKROW_ABI,
      functionName: 'createJob',
      args: [worker as `0x${string}`, deadlineTs, ref, bps],
      value: amountRaw,
      chainId: ARKROW_CHAIN_ID,
    }, {
      onSuccess() { onJobCreated?.() },
    })
  }

  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card p-6 flex flex-col items-center gap-3 text-center"
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
          style={{ background: 'var(--green-light)', border: '1px solid var(--green-border)' }}
        >
          <span style={{ color: 'var(--green)' }}>✓</span>
        </div>
        <p className="font-medium text-sm" style={{ color: 'var(--ink)' }}>Job created</p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>USDC is now locked in escrow.</p>
        {hash && (
          <a
            href={buildExplorerTx(hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline"
            style={{ color: 'var(--green)' }}
          >
            View on explorer
          </a>
        )}
        <button
          onClick={() => {
            reset()
            setAmount('')
            setWorker('')
            setReferrer('')
            setReferrerBps('')
            setDeadlineDays('7')
          }}
          className="text-sm px-4 py-2 rounded-lg font-medium transition-all hover:opacity-80"
          style={{ background: 'var(--ink)', color: '#FFF', border: 'none' }}
        >
          Post another job
        </button>
      </motion.div>
    )
  }

  const isBusy = isPending || isConfirming || isSwitching

  const summaryAmount = /^\d+(\.\d{1,18})?$/.test(amount.trim()) ? parseNativeUsdc(amount.trim()) : 0n
  const summaryFee    = info.feeBps !== null ? (summaryAmount * BigInt(info.feeBps)) / 10000n : null
  const refBpsNum     = referrerBps ? Math.round(parseFloat(referrerBps) * 100) : 0
  const summaryRef    = referrer && refBpsNum > 0 ? (summaryAmount * BigInt(refBpsNum)) / 10000n : 0n
  const summaryWorker = summaryFee !== null ? summaryAmount - summaryFee - summaryRef : null
  const daysNum       = parseFloat(deadlineDays)
  const summaryDate   = !isNaN(daysNum) ? new Date(Date.now() + daysNum * 86_400_000).toLocaleString() : ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1.0] }}
      id="post-job"
      className="card p-5 sm:p-6 flex flex-col gap-4 scroll-mt-20"
    >
      <div>
        <h2 className="font-serif text-xl" style={{ color: 'var(--ink)' }}>Post a job</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Lock USDC in escrow and assign a worker agent.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Worker address" hint="The agent who will do the work">
          <input
            type="text"
            value={worker}
            onChange={e => setWorker(e.target.value)}
            placeholder="0x…"
            className="w-full font-mono text-sm px-3 py-2.5 rounded-lg outline-none transition-all"
            style={inputStyle}
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Amount (USDC)" hint="18-dec native">
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="1.00"
              min="0"
              step="0.01"
              className="w-full tabular text-sm px-3 py-2.5 rounded-lg outline-none transition-all"
              style={inputStyle}
            />
          </Field>
          <Field label="Deadline (days)">
            <input
              type="number"
              value={deadlineDays}
              onChange={e => setDeadlineDays(e.target.value)}
              placeholder="7"
              min="1"
              step="1"
              className="w-full tabular text-sm px-3 py-2.5 rounded-lg outline-none transition-all"
              style={inputStyle}
            />
          </Field>
        </div>

        <details className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <summary
            className="px-3 py-2 text-sm cursor-pointer select-none font-medium"
            style={{ color: 'var(--muted)', background: 'var(--surface-muted)' }}
          >
            Optional referrer
          </summary>
          <div className="flex flex-col gap-2 px-3 py-3" style={{ background: 'var(--surface)' }}>
            <Field label="Referrer address">
              <input
                type="text"
                value={referrer}
                onChange={e => setReferrer(e.target.value)}
                placeholder="0x… (optional)"
                className="w-full font-mono text-sm px-3 py-2.5 rounded-lg outline-none transition-all"
                style={inputStyle}
              />
            </Field>
            <Field label="Referrer share (0–10%)" hint="As a percentage">
              <input
                type="number"
                value={referrerBps}
                onChange={e => setReferrerBps(e.target.value)}
                placeholder="0"
                min="0"
                max="10"
                step="0.1"
                className="w-full tabular text-sm px-3 py-2.5 rounded-lg outline-none transition-all"
                style={inputStyle}
              />
            </Field>
          </div>
        </details>

        {fromLink && (
          <p className="text-sm rounded-lg px-3 py-2"
            style={{ background: 'var(--amber-light)', color: 'var(--amber)', border: '1px solid var(--amber-border)' }}>
            This form was filled in from a link. Check the worker address and amount carefully before you lock any funds.
          </p>
        )}

        {isAddress(worker) && (
          <button
            type="button"
            onClick={() => void copyLink(
              buildRequestLink({ worker, amount: amount.trim(), days: deadlineDays.trim(), referrer: isAddress(referrer) ? referrer : '', bps: referrerBps.trim() }),
              'Request link copied. Whoever opens it sees this form filled in.',
            )}
            className="text-[13px] underline self-start"
            style={{ color: 'var(--ink-2)', background: 'none', border: 'none', padding: 0 }}
          >
            Copy a link to this job request
          </button>
        )}

        <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
          {balance ? `Balance: ${formatNativeUsdc(balance.value, 2)} USDC · ` : ''}
          Limit: {info.maxJobUsdc} USDC per job
          {info.feePct !== null ? ` · Fee: ${info.feePct}% (only when the job is paid)` : ''}
        </p>

        {formError && (
          <p className="text-sm rounded-lg px-3 py-2"
            style={{ background: 'var(--rose-light)', color: 'var(--rose)', border: '1px solid var(--rose-border)' }}>
            {formError}
          </p>
        )}

        {isError && !formError && (
          <p className="text-sm rounded-lg px-3 py-2"
            style={{ background: 'var(--rose-light)', color: 'var(--rose)', border: '1px solid var(--rose-border)' }}>
            {parseContractError(error?.message)}
          </p>
        )}

        {!isConnected ? (
          <ConnectKitButton.Custom>
            {({ show }) => (
              <button
                type="button"
                onClick={show}
                className="w-full py-2.5 rounded-lg text-base font-medium transition-all hover:opacity-80"
                style={{ background: 'var(--ink)', color: '#FFF', border: 'none' }}
              >
                Connect wallet to post
              </button>
            )}
          </ConnectKitButton.Custom>
        ) : onWrongChain ? (
          <button
            type="button"
            onClick={() => switchChain({ chainId: ARKROW_CHAIN_ID })}
            disabled={isSwitching}
            className="w-full py-2.5 rounded-lg text-base font-medium transition-all hover:opacity-80"
            style={{ background: 'var(--rose-light)', color: 'var(--rose)', border: '1px solid var(--rose-border)' }}
          >
            {isSwitching ? 'Switching…' : `Switch to ${NETWORK_NAME}`}
          </button>
        ) : (
          <button
            type="submit"
            disabled={isBusy}
            className="w-full py-2.5 rounded-lg text-base font-medium transition-all active:scale-[0.98]"
            style={{
              background: isBusy ? 'var(--border)' : 'var(--ink)',
              color: isBusy ? 'var(--muted)' : '#FFF',
              border: 'none',
              cursor: isBusy ? 'not-allowed' : 'pointer',
            }}
          >
            {isPending ? 'Confirm in wallet…' : isConfirming ? 'Confirming on Arc…' : 'Lock USDC & post job'}
          </button>
        )}
      </form>

      <ConfirmDialog
        open={confirmOpen}
        title="Check before you lock funds"
        rows={[
          { label: 'You lock', value: `${amount.trim() || '0'} USDC` },
          { label: 'Worker address', value: worker, mono: true },
          { label: 'Deadline', value: summaryDate },
          ...(summaryFee !== null && summaryWorker !== null
            ? [
                { label: 'Worker receives', value: `${formatNativeUsdc(summaryWorker, 4)} USDC` },
                { label: `Arkrow fee (${info.feePct}%)`, value: `${formatNativeUsdc(summaryFee, 4)} USDC` },
              ]
            : []),
          ...(summaryRef > 0n ? [{ label: 'Referrer receives', value: `${formatNativeUsdc(summaryRef, 4)} USDC` }] : []),
        ]}
        warning="Your USDC is locked until you approve the work, the deadline passes with no proof (then you can claim a refund), or a dispute ends. The worker address cannot be changed afterwards, so check every character."
        confirmLabel="Lock USDC & post job"
        onConfirm={postJob}
        onCancel={() => setConfirmOpen(false)}
      />
    </motion.div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <label className="text-[13px] font-medium" style={{ color: 'var(--ink-2)' }}>{label}</label>
        {hint && <span className="text-xs" style={{ color: 'var(--muted)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-muted)',
  border: '1px solid var(--border)',
  color: 'var(--ink)',
}

function parseContractError(msg?: string): string {
  if (!msg) return 'Transaction failed.'
  if (msg.includes('user rejected') || msg.includes('User rejected')) return 'Transaction cancelled.'
  if (msg.includes('insufficient')) return 'Insufficient USDC balance.'
  if (msg.includes('ZeroAddress'))   return 'Worker address cannot be zero.'
  if (msg.includes('DeadlineInPast')) return 'Deadline must be in the future.'
  if (msg.includes('ReferrerBpsTooHigh')) return 'Referrer share cannot exceed 10%.'
  if (msg.includes('ZeroAmount'))    return 'Amount must be greater than zero.'
  if (msg.includes('ContractPaused')) return 'New jobs are paused for a moment. Your existing jobs are safe and can still be finished.'
  if (msg.includes('SelfJob'))        return 'Worker cannot be your own address.'
  if (msg.includes('DeadlineTooSoon')) return 'Deadline is too soon. Choose at least 1 day.'
  if (msg.includes('AmountTooHigh'))  return 'Amount is above the launch limit per job.'
  return 'Transaction failed. Check your inputs and try again.'
}
