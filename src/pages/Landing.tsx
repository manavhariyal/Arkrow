import { useEffect } from 'react'
import '../landing.css'
import html from '../landing.html?raw'
import { initLanding } from '../landingInit'

/** Marketing page shown at "/" . The app lives at "/#/app". */
export default function Landing() {
  useEffect(() => {
    window.scrollTo(0, 0)
    document.documentElement.style.scrollBehavior = 'smooth'
    const dispose = initLanding()
    return () => {
      dispose()
      document.documentElement.style.scrollBehavior = ''
    }
  }, [])

  return <div className="lp" dangerouslySetInnerHTML={{ __html: html }} />
}
