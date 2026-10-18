import { JobStatus, STATUS_LABEL } from '../arkrow'

interface Props {
  status: number
  className?: string
}

// Soft pastel badges: mint=Released, butter=Proof submitted, sky=Open, rose=Disputed, gray=Refunded
const BADGE: Record<number, { bg: string; border: string; text: string }> = {
  [JobStatus.OPEN]: {
    bg: 'var(--sky-light)', border: 'var(--sky-border)', text: 'var(--sky)',
  },
  [JobStatus.PROOF_SUBMITTED]: {
    bg: 'var(--amber-light)', border: 'var(--amber-border)', text: 'var(--amber)',
  },
  [JobStatus.RELEASED]: {
    bg: 'var(--green-light)', border: 'var(--green-border)', text: 'var(--green)',
  },
  [JobStatus.DISPUTED]: {
    bg: 'var(--rose-light)', border: 'var(--rose-border)', text: 'var(--rose)',
  },
  [JobStatus.REFUNDED]: {
    bg: 'var(--gray-light)', border: 'var(--gray-border)', text: 'var(--muted)',
  },
}

export function StatusBadge({ status, className = '' }: Props) {
  const b = BADGE[status] ?? BADGE[0]
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium tabular ${className}`}
      style={{ background: b.bg, border: `1px solid ${b.border}`, color: b.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 shrink-0" />
      {STATUS_LABEL[status] ?? 'Unknown'}
    </span>
  )
}
