import { toast } from 'sonner'

const X_URL = 'https://x.com/manavhariyal'
const DISCORD = 'manavhariyal01'

async function copyDiscord() {
  try {
    await navigator.clipboard.writeText(DISCORD)
    toast.success(`Copied Discord username: ${DISCORD}`)
  } catch {
    toast.message(`Discord username: ${DISCORD}`)
  }
}

export function BuilderCard() {
  return (
    <section
      className="card mt-12 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-5 justify-between"
      aria-label="About the builder"
    >
      <div className="flex items-center gap-4 min-w-0">
        <img
          src="/avatar.png"
          alt="Manav Hariyal"
          width={56}
          height={56}
          className="shrink-0 w-14 h-14 rounded-full object-cover"
          style={{ border: '1.5px solid var(--ink)' }}
        />
        <div className="min-w-0">
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Built by</p>
          <p className="font-serif text-3xl leading-none mt-1" style={{ color: 'var(--ink)' }}>
            Manav Hariyal
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs" style={{ color: 'var(--ink-2)' }}>
            <a
              href={X_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 decoration-1 hover:opacity-70"
            >
              @manavhariyal on X
            </a>
            <button
              type="button"
              onClick={copyDiscord}
              className="underline underline-offset-4 decoration-1 hover:opacity-70"
              style={{ background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit' }}
              title="Click to copy"
            >
              Discord: {DISCORD} (click to copy)
            </button>
            <a
              href="https://arcagentpay.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 decoration-1 hover:opacity-70"
            >
              Arc Agent Pay
            </a>
            <a
              href="https://github.com/manavhariyal/Arkrow"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 decoration-1 hover:opacity-70"
            >
              Source on GitHub
            </a>
          </div>
        </div>
      </div>

      <a
        href={X_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium"
        style={{
          background: 'var(--ink)',
          color: '#FFFCF5',
          borderRadius: 999,
          boxShadow: '3px 3px 0 var(--saffron)',
          textDecoration: 'none',
        }}
      >
        Follow on X
      </a>
    </section>
  )
}
