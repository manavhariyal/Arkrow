/**
 * Arkrow — Escrow marketplace for AI agents on Arc
 * Built with Arc Studio
 *
 * Two pages, no router library needed:
 *   /          -> landing page
 *   /#/app     -> the app
 */
import { useEffect, useState } from 'react'
import { Topbar }       from './components/Topbar'
import { StatusBanner } from './components/StatusBanner'
import { IS_MAINNET }   from './arkrow'
import { Hero }         from './components/Hero'
import { PostJob }      from './components/PostJob'
import { ActivityFeed } from './components/ActivityFeed'
import { JobsTable }    from './components/JobsTable'
import { AgentCard }    from './components/AgentCard'
import { BuilderCard }  from './components/BuilderCard'
import { TryIt }        from './components/TryIt'
import Landing          from './pages/Landing'

function AppPage() {
  // Incrementing this key triggers re-reads across the jobs table
  const [refreshKey, setRefreshKey] = useState(0)

  function bump() {
    setRefreshKey(k => k + 1)
  }

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg)' }}>
      <Topbar />
      <StatusBanner />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
        <Hero />

        {/* Three-column grid on large screens, single column on mobile.
            Left col (1/3): Post a job + Agent card + Activity feed
            Right col (2/3): Recent jobs table                         */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">

          {/* Left column */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            <TryIt />
            <PostJob onJobCreated={bump} />
            <AgentCard />
          </div>

          {/* Right column: jobs table on desktop */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <ActivityFeed />
            <JobsTable refreshKey={refreshKey} />
          </div>

        </div>

        <BuilderCard />
      </main>

      {/* Subtle footer rule */}
      <footer
        className="border-t px-4 sm:px-6 py-4 text-center text-[11px]"
        style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
      >
        {IS_MAINNET
          ? 'Arkrow is unaudited. Use small amounts and double-check every address.'
          : 'Arkrow is unaudited and on testnet. Do not use with real funds.'}
      </footer>
    </div>
  )
}

/** Picks the page from the address bar: "#/app" is the app, anything else is the landing page. */
export default function App() {
  const [isApp, setIsApp] = useState(() => window.location.hash.startsWith('#/app'))

  useEffect(() => {
    const onHash = () => {
      const next = window.location.hash.startsWith('#/app')
      setIsApp(prev => {
        if (prev !== next) window.scrollTo(0, 0)
        return next
      })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return isApp ? <AppPage /> : <Landing />
}
