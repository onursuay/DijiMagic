'use client'

import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'

/**
 * Hero arka planı — imleci takip eden "aurora" ışık efekti.
 * Mouse hareket ettikçe marka tonundaki (emerald/teal/cyan) yumuşak ışıklar
 * imleci yumuşak gecikmeyle (lerp) takip eder → "renkler hareket ediyor".
 * Ek olarak her zaman hafifçe süzülen iki ortam blobu hayat katar.
 * prefers-reduced-motion açıkken tüm hareket durur (statik parıltı kalır).
 * pointer-events-none + aria-hidden — tıklamayı/erişilebilirliği etkilemez.
 */
export default function HeroAuroraBackground() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    let tx = 50, ty = 36 // hedef (mouse) konumu, %
    let cx = 50, cy = 36 // mevcut (eased) konum, %

    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / Math.max(1, window.innerWidth)) * 100
      ty = (e.clientY / Math.max(1, window.innerHeight)) * 100
    }
    const tick = () => {
      cx += (tx - cx) * 0.07
      cy += (ty - cy) * 0.07
      el.style.setProperty('--mx', cx.toFixed(2) + '%')
      el.style.setProperty('--my', cy.toFixed(2) + '%')
      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  const base = { ['--mx']: '50%', ['--my']: '36%' } as CSSProperties

  return (
    <div ref={ref} aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden" style={base}>
      {/* Ortam blobları — her zaman hafifçe süzülür */}
      <div
        className="aurora-drift-a absolute -top-1/4 left-[8%] w-[55vw] h-[55vw] max-w-[760px] max-h-[760px] rounded-full blur-[140px]"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.13), transparent 65%)' }}
      />
      <div
        className="aurora-drift-b absolute top-[6%] right-[4%] w-[48vw] h-[48vw] max-w-[680px] max-h-[680px] rounded-full blur-[150px]"
        style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.11), transparent 65%)' }}
      />
      {/* İmleci takip eden ışıklar — renkler mouse ile hareket eder */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(720px circle at var(--mx) var(--my), rgba(16,185,129,0.22), transparent 62%)' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(600px circle at calc(100% - var(--mx)) var(--my), rgba(34,211,238,0.15), transparent 60%)' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(520px circle at var(--mx) calc(100% - var(--my)), rgba(20,184,166,0.12), transparent 60%)' }} />
    </div>
  )
}
