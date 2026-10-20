import { useEffect, useState } from 'react'
import { isAddress } from 'viem'
import { toast } from 'sonner'

/** The query part of the address-bar hash, e.g. "#/app?worker=0x…&amount=1" -> worker, amount. */
export function readHashParams(): URLSearchParams {
  const h = window.location.hash
  const q = h.indexOf('?')
  return new URLSearchParams(q >= 0 ? h.slice(q + 1) : '')
}

/** Re-renders whenever the hash changes and returns the current hash parameters. */
export function useHashParams(): URLSearchParams {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const q = hash.indexOf('?')
  return new URLSearchParams(q >= 0 ? hash.slice(q + 1) : '')
}

function base(): string {
  return `${window.location.origin}${window.location.pathname}`
}

export interface Prefill {
  worker: string
  amount: string
  days: string
  referrer: string
  bps: string
}

/** Link that opens the app with the Post-a-job form already filled in. Nothing is sent until the person confirms. */
export function buildRequestLink(p: Partial<Prefill>): string {
  const qs = new URLSearchParams()
  if (p.worker) qs.set('worker', p.worker)
  if (p.amount) qs.set('amount', p.amount)
  if (p.days) qs.set('days', p.days)
  if (p.referrer) qs.set('ref', p.referrer)
  if (p.bps) qs.set('bps', p.bps)
  return `${base()}#/app?${qs.toString()}`
}

export function buildJobLink(id: bigint | string): string {
  return `${base()}#/app?job=${id.toString()}`
}

export function buildReceiptLink(id: bigint | string): string {
  return `${base()}#/receipt/${id.toString()}`
}

/** Only plain whole numbers are accepted as a job number. */
export function parseJobParam(v: string | null): bigint | null {
  if (!v || !/^[1-9]\d{0,11}$/.test(v)) return null
  return BigInt(v)
}

/** Reads and strictly validates form values from a link. Anything odd is ignored. */
export function parsePrefill(params: URLSearchParams): Prefill | null {
  const worker = params.get('worker') ?? ''
  if (!isAddress(worker)) return null
  const amountRaw = params.get('amount') ?? ''
  const daysRaw = params.get('days') ?? ''
  const refRaw = params.get('ref') ?? ''
  const bpsRaw = params.get('bps') ?? ''
  return {
    worker,
    amount: /^\d{1,9}(\.\d{1,6})?$/.test(amountRaw) ? amountRaw : '',
    days: /^\d{1,3}$/.test(daysRaw) && Number(daysRaw) >= 1 && Number(daysRaw) <= 365 ? daysRaw : '',
    referrer: isAddress(refRaw) ? refRaw : '',
    bps: /^\d{1,2}(\.\d)?$/.test(bpsRaw) && Number(bpsRaw) <= 10 ? bpsRaw : '',
  }
}

export async function copyLink(text: string, message: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(message)
  } catch {
    toast.error('Could not copy automatically. Select the link and copy it by hand.')
  }
}
