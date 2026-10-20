const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export interface PayoutInput {
  amount: bigint
  feeBps: bigint
  referrer: string
  referrerBps: bigint
}

/** Exactly how the contract splits a released job: fee and referrer come out of the amount. */
export function payoutSplit(j: PayoutInput) {
  const fee = (j.amount * j.feeBps) / 10000n
  const referrer =
    j.referrer !== ZERO_ADDRESS && j.referrerBps > 0n ? (j.amount * j.referrerBps) / 10000n : 0n
  return { fee, referrer, worker: j.amount - fee - referrer }
}
