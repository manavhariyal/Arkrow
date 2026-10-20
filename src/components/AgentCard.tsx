import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { motion } from 'framer-motion'
import {
  ARKROW_ADDRESS, ARKROW_ABI, ARKROW_CHAIN_ID,
  formatNativeUsdc, shortenAddr, buildExplorerTx, NETWORK_NAME,
} from '../arkrow'

export function AgentCard() {
  const { address, isConnected } = useAccount()

  const { data: completed } = useReadContract({
    address: ARKROW_ADDRESS,
    abi: ARKROW_ABI,
    functionName: 'jobsCompleted',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
    chainId: ARKROW_CHAIN_ID,
    query: { enabled: !!address, refetchInterval: 10_000 },
  })

  const { data: earned } = useReadContract({
    address: ARKROW_ADDRESS,
    abi: ARKROW_ABI,
    functionName: 'totalEarned',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
    chainId: ARKROW_CHAIN_ID,
    query: { enabled: !!address, refetchInterval: 10_000 },
  })

  const { data: pending } = useReadContract({
    address: ARKROW_ADDRESS,
    abi: ARKROW_ABI,
    functionName: 'pendingWithdrawals',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
    chainId: ARKROW_CHAIN_ID,
    query: { enabled: !!address, refetchInterval: 8_000 },
  })

  const { switchChain } = useSwitchChain()
  const { writeContract, data: hash, isPending, isError, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  function withdraw() {
    writeContract({
      address: ARKROW_ADDRESS,
      abi: ARKROW_ABI,
      functionName: 'withdrawPending',
      args: [],
      chainId: ARKROW_CHAIN_ID,
    })
  }

  if (!isConnected) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-5 flex flex-col items-center gap-2 py-8 text-center"
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
        >
          <span style={{ color: 'var(--muted)' }}>◎</span>
        </div>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Connect your wallet to see your agent profile.
        </p>
      </motion.div>
    )
  }

  const isBusy    = isPending || isConfirming
  const hasPending = pending != null && pending > 0n

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.3, ease: [0.25, 0.1, 0.25, 1.0] }}
      className="card overflow-hidden"
    >
      {/* Header strip */}
      <div
        className="px-5 py-4 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-muted)' }}
      >
        <div className="text-[11px] mb-1" style={{ color: 'var(--muted)' }}>Your agent profile</div>
        <div className="font-mono text-sm font-medium" style={{ color: 'var(--ink)' }}>
          {address ? shortenAddr(address) : '–'}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 divide-x divide-[var(--border)]" style={{ borderBottom: '1px solid var(--border)' }}>
        <Stat label="Jobs completed" value={completed ? completed.toString() : '0'} />
        <Stat label="Total earned"   value={earned ? `$${formatNativeUsdc(earned, 2)}` : '$0.00'} />
      </div>

      {/* Pending withdrawals */}
      <div className="p-5 flex flex-col gap-3">
        <div>
          <div className="text-[11px] mb-1" style={{ color: 'var(--muted)' }}>Pending withdrawals</div>
          <div
            className="tabular font-mono text-xl font-medium"
            style={{ color: hasPending ? 'var(--green)' : 'var(--muted)' }}
          >
            ${pending ? formatNativeUsdc(pending, 4) : '0.0000'}
          </div>
          {hasPending && (
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--green)' }}>
              Ready to withdraw
            </div>
          )}
        </div>

        {isSuccess && hash && (
          <a
            href={buildExplorerTx(hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline"
            style={{ color: 'var(--green)' }}
          >
            Withdrawn — view on explorer
          </a>
        )}
        {isError && (
          <p className="text-xs rounded-lg px-3 py-2"
            style={{ background: 'var(--rose-light)', color: 'var(--rose)', border: '1px solid var(--rose-border)' }}>
            {error?.message?.includes('user rejected') ? 'Cancelled.' : 'Withdrawal failed.'}
          </p>
        )}

        <button
          onClick={hasPending ? withdraw : undefined}
          disabled={!hasPending || isBusy}
          className="w-full py-2.5 rounded-lg text-xs font-medium transition-all active:scale-[0.98]"
          style={{
            background: hasPending && !isBusy ? 'var(--ink)' : 'var(--surface-muted)',
            border: `1px solid ${hasPending && !isBusy ? 'var(--ink)' : 'var(--border)'}`,
            color: hasPending && !isBusy ? '#FFF' : 'var(--muted)',
            cursor: hasPending && !isBusy ? 'pointer' : 'not-allowed',
          }}
        >
          {isPending ? 'Confirm in wallet…' : isConfirming ? 'Confirming…' : 'Withdraw USDC'}
        </button>

        <button
          onClick={() => switchChain({ chainId: ARKROW_CHAIN_ID })}
          className="text-[11px] text-center transition-all hover:underline"
          style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Make sure you are on {NETWORK_NAME}
        </button>
      </div>
    </motion.div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-3" style={{ borderColor: 'var(--border)' }}>
      <div className="font-mono tabular text-base font-semibold" style={{ color: 'var(--ink)' }}>{value}</div>
      <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{label}</div>
    </div>
  )
}
