import { useEffect, useState } from 'react'
import { useReadContracts } from 'wagmi'
import { ARKROW_ADDRESS, ARKROW_ABI, ARKROW_CHAIN_ID } from './arkrow'

export const DEFAULT_MAX_JOB_USDC = 100

/** Live protocol settings read from the contract: paused flag, per-job limit, fee. */
export function useProtocolInfo() {
  const base = { address: ARKROW_ADDRESS, abi: ARKROW_ABI, chainId: ARKROW_CHAIN_ID } as const
  const { data } = useReadContracts({
    contracts: [
      { ...base, functionName: 'paused' },
      { ...base, functionName: 'maxJobAmount' },
      { ...base, functionName: 'feeBps' },
    ],
    query: { refetchInterval: 30_000 },
  })

  const paused = data?.[0]?.status === 'success' ? Boolean(data[0].result) : false
  const maxWei = data?.[1]?.status === 'success' ? (data[1].result as bigint) : null
  const feeBps = data?.[2]?.status === 'success' ? Number(data[2].result as bigint) : null

  return {
    paused,
    maxJobUsdc: maxWei !== null ? Number(maxWei / 10n ** 14n) / 10000 : DEFAULT_MAX_JOB_USDC,
    feeBps,
    feePct: feeBps !== null ? feeBps / 100 : null,
  }
}

/** Current time in seconds, ticking every second (for live countdowns). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

/** 93784 -> "1d 2h", 3700 -> "1h 1m", 75 -> "1m 15s", 20 -> "20s" */
export function formatDuration(secs: number): string {
  if (secs <= 0) return 'now'
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
