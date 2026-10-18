/**
 * Arkrow contract config — ABI extracted from compiled artifact.
 * Deployed on Arc Testnet.
 */

export const ARKROW_ADDRESS = '0x0b285c66b8a97f3457b18333200d6b2d8761cfe5' as const

export const ARKROW_CHAIN_ID = 5042002 // Arc Testnet

export const REVIEW_WINDOW_SECS = 3 * 24 * 60 * 60   // 3 days
export const DISPUTE_EXPIRY_SECS = 14 * 24 * 60 * 60  // 14 days

// Status enum values (must match Solidity order)
export enum JobStatus {
  OPEN = 0,
  PROOF_SUBMITTED = 1,
  RELEASED = 2,
  REFUNDED = 3,
  DISPUTED = 4,
}

export const STATUS_LABEL: Record<number, string> = {
  0: 'Open',
  1: 'Proof submitted',
  2: 'Released',
  3: 'Refunded',
  4: 'Disputed',
}

// On Arc, native USDC has 18 decimals (gas token view)
export const NATIVE_USDC_DECIMALS = 18

export const ARKROW_ABI = [
  // read
  {
    "type": "function", "name": "jobCounter",
    "inputs": [], "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function", "name": "getJob",
    "inputs": [{ "name": "jobId", "type": "uint256" }],
    "outputs": [{
      "name": "", "type": "tuple",
      "components": [
        { "name": "buyer",       "type": "address" },
        { "name": "worker",      "type": "address" },
        { "name": "referrer",    "type": "address" },
        { "name": "treasury",    "type": "address" },
        { "name": "amount",      "type": "uint256" },
        { "name": "feeBps",      "type": "uint256" },
        { "name": "referrerBps", "type": "uint256" },
        { "name": "deadline",    "type": "uint64"  },
        { "name": "proofTime",   "type": "uint64"  },
        { "name": "disputeTime", "type": "uint64"  },
        { "name": "status",      "type": "uint8"   },
        { "name": "proofHash",   "type": "bytes32" }
      ]
    }],
    "stateMutability": "view"
  },
  {
    "type": "function", "name": "totalLocked",
    "inputs": [], "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function", "name": "jobsCompleted",
    "inputs": [{ "name": "", "type": "address" }],
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function", "name": "totalEarned",
    "inputs": [{ "name": "", "type": "address" }],
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function", "name": "pendingWithdrawals",
    "inputs": [{ "name": "", "type": "address" }],
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view"
  },
  // write
  {
    "type": "function", "name": "createJob",
    "inputs": [
      { "name": "worker",      "type": "address" },
      { "name": "deadline",    "type": "uint64"  },
      { "name": "referrer",    "type": "address" },
      { "name": "referrerBps", "type": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function", "name": "submitProof",
    "inputs": [
      { "name": "jobId",     "type": "uint256" },
      { "name": "proofHash", "type": "bytes32" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function", "name": "approve",
    "inputs": [{ "name": "jobId", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function", "name": "release",
    "inputs": [{ "name": "jobId", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function", "name": "refund",
    "inputs": [{ "name": "jobId", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function", "name": "dispute",
    "inputs": [{ "name": "jobId", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function", "name": "expireDispute",
    "inputs": [{ "name": "jobId", "type": "uint256" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function", "name": "withdrawPending",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  // events
  {
    "type": "event", "name": "JobCreated",
    "inputs": [
      { "name": "jobId",    "type": "uint256", "indexed": true  },
      { "name": "buyer",    "type": "address", "indexed": true  },
      { "name": "worker",   "type": "address", "indexed": true  },
      { "name": "amount",   "type": "uint256", "indexed": false },
      { "name": "deadline", "type": "uint64",  "indexed": false }
    ]
  },
  {
    "type": "event", "name": "ProofSubmitted",
    "inputs": [
      { "name": "jobId",     "type": "uint256", "indexed": true  },
      { "name": "proofHash", "type": "bytes32", "indexed": false }
    ]
  },
  {
    "type": "event", "name": "JobApproved",
    "inputs": [
      { "name": "jobId",  "type": "uint256", "indexed": true },
      { "name": "buyer",  "type": "address", "indexed": true }
    ]
  },
  {
    "type": "event", "name": "JobReleased",
    "inputs": [
      { "name": "jobId",          "type": "uint256", "indexed": true  },
      { "name": "worker",         "type": "address", "indexed": true  },
      { "name": "workerAmount",   "type": "uint256", "indexed": false },
      { "name": "referrerAmount", "type": "uint256", "indexed": false },
      { "name": "feeAmount",      "type": "uint256", "indexed": false }
    ]
  },
  {
    "type": "event", "name": "JobRefunded",
    "inputs": [
      { "name": "jobId",  "type": "uint256", "indexed": true  },
      { "name": "buyer",  "type": "address", "indexed": true  },
      { "name": "amount", "type": "uint256", "indexed": false }
    ]
  },
  {
    "type": "event", "name": "JobDisputed",
    "inputs": [
      { "name": "jobId",  "type": "uint256", "indexed": true },
      { "name": "buyer",  "type": "address", "indexed": true }
    ]
  },
  {
    "type": "event", "name": "DisputeResolved",
    "inputs": [
      { "name": "jobId",     "type": "uint256",  "indexed": true  },
      { "name": "payWorker", "type": "bool",     "indexed": false }
    ]
  },
  {
    "type": "event", "name": "DisputeExpired",
    "inputs": [
      { "name": "jobId",  "type": "uint256", "indexed": true  },
      { "name": "buyer",  "type": "address", "indexed": true  },
      { "name": "amount", "type": "uint256", "indexed": false }
    ]
  },
] as const

export type ArkrowJob = {
  buyer:       `0x${string}`
  worker:      `0x${string}`
  referrer:    `0x${string}`
  treasury:    `0x${string}`
  amount:      bigint
  feeBps:      bigint
  referrerBps: bigint
  deadline:    bigint
  proofTime:   bigint
  disputeTime: bigint
  status:      number
  proofHash:   `0x${string}`
}

/** Format a bigint native-USDC amount (18 dec) to a human-readable string */
export function formatNativeUsdc(raw: bigint, decimals = 4): string {
  const divisor = 10n ** 18n
  const whole = raw / divisor
  const frac = raw % divisor
  const fracStr = frac.toString().padStart(18, '0').slice(0, decimals)
  return `${whole}.${fracStr}`
}

/** Parse a decimal string to native-USDC bigint (18 dec) */
export function parseNativeUsdc(value: string): bigint {
  const [whole = '0', frac = ''] = value.split('.')
  const fracPadded = frac.slice(0, 18).padEnd(18, '0')
  return BigInt(whole) * 10n ** 18n + BigInt(fracPadded)
}

export function shortenAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function buildExplorerTx(tx: string): string {
  return `https://explorer.testnet.arc.io/tx/${tx}`
}

export function buildExplorerAddr(addr: string): string {
  return `https://explorer.testnet.arc.io/address/${addr}`
}
