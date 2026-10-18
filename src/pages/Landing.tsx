import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import '../landing.css'
import html from '../landing.html?raw'
import { initLanding } from '../landingInit'
import { BuilderCard } from '../components/BuilderCard'

export default function Landing() {
  // The "Built by" card is placed at the top of the landing page footer
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    document.documentElement.style.scrollBehavior = 'smooth'
    const dispose = initLanding()

    let el: HTMLElement | null = null
    const foot = document.querySelector('.lp footer.foot')
    if (foot) {
      el = document.createElement('div')
      el.style.flexBasis = '100%'
      foot.prepend(el)
      setSlot(el)
    }

    return () => {
      dispose()
      el?.remove()
      document.documentElement.style.scrollBehavior = ''
    }
  }, [])

  return (
    <>
      <div className="lp" dangerouslySetInnerHTML={{ __html: html }} />
      {slot && createPortal(<BuilderCard variant="dark" />, slot)}
    </>
  )
}
