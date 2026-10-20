import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

export interface ConfirmRow { label: string; value: string; mono?: boolean }

interface Props {
  open: boolean
  title: string
  rows: ConfirmRow[]
  warning?: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** "Check before you send" screen shown before any action that moves money. */
export function ConfirmDialog({ open, title, rows, warning, confirmLabel, danger, onConfirm, onCancel }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onCancel}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 16,
            background: 'rgba(27,26,25,0.5)',
          }}
        >
          <motion.div
            role="dialog" aria-modal="true" aria-label={title}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 440, maxHeight: '90dvh', overflowY: 'auto',
              background: 'var(--surface)', color: 'var(--ink)', border: '1.5px solid var(--ink)',
              borderRadius: 16, boxShadow: '4px 4px 0 var(--peach)', padding: 20,
              display: 'flex', flexDirection: 'column', gap: 14,
            }}
          >
            <h3 className="font-serif" style={{ fontSize: 20 }}>{title}</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{r.label}</span>
                  <span
                    className={r.mono ? 'font-mono' : ''}
                    style={{ textAlign: 'right', wordBreak: 'break-all', fontSize: r.mono ? 11 : 13, fontWeight: 500 }}
                  >
                    {r.value}
                  </span>
                </div>
              ))}
            </div>

            {warning && (
              <div style={{
                fontSize: 12, lineHeight: 1.5, padding: '10px 12px', borderRadius: 10,
                background: 'var(--amber-light)', border: '1px solid var(--amber-border)', color: 'var(--amber)',
              }}>
                {warning}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button" autoFocus onClick={onCancel}
                style={{
                  flex: 1, padding: '10px 12px', fontSize: 13, fontWeight: 500, borderRadius: 999,
                  background: 'var(--surface-muted)', color: 'var(--ink-2)', border: '1px solid var(--border)', cursor: 'pointer',
                }}
              >
                Go back
              </button>
              <button
                type="button" onClick={onConfirm}
                style={{
                  flex: 1, padding: '10px 12px', fontSize: 13, fontWeight: 600, borderRadius: 999, cursor: 'pointer',
                  background: danger ? 'var(--coral)' : 'var(--ink)', color: '#FFF', border: 'none',
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
