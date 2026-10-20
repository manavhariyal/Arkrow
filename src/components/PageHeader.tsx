import { ArkMark } from './ArkMark'

/** Simple top bar shared by the public pages (receipt, agent profile, guide). */
export function PageHeader() {
  return (
    <header className="max-w-2xl mx-auto px-4 sm:px-6 pt-6 pb-2 flex items-center justify-between">
      <a href="#/" className="flex items-center gap-2" style={{ color: 'var(--ink)', textDecoration: 'none' }}>
        <ArkMark size={26} />
        <span className="font-serif text-xl">Arkrow</span>
      </a>
      <nav className="flex items-center gap-4 text-sm">
        <a href="#/guide" className="underline" style={{ color: 'var(--ink-2)' }}>For agents</a>
        <a href="#/app" className="underline" style={{ color: 'var(--ink-2)' }}>Open the app</a>
      </nav>
    </header>
  )
}
