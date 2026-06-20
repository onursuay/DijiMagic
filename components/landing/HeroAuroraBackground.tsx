'use client'

import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'

/**
 * Hero arka planı — imleci takip eden çok-renkli "aurora" ışık efekti.
 * withgrower.com tarzı: mouse hero üzerinde gezdikçe marka tonundaki
 * (emerald / cyan / teal / sky) yumuşak ışıklar imlecin altında belirir ve
 * yumuşak gecikmeyle (lerp) takip eder → "renkler mouse ile hareket ediyor".
 * Koordinatlar hero'ya GÖRELİ (getBoundingClientRect) → ışık tam imlecin altında.
 * Ek olarak her zaman hafifçe süzülen üç ortam ışığı derinlik katar.
 * prefers-reduced-motion açıkken hareket durur. pointer-events-none + aria-hidden.
 */
export default function HeroAuroraBackground() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    let tx = 50, ty = 40 // hedef konum (% hero), mouse
    let cx = 50, cy = 40 // mevcut (eased) konum

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      tx = ((e.clientX - r.left) / r.width) * 100
      ty = ((e.clientY - r.top) / r.height) * 100
    }
    const tick = () => {
      cx += (tx - cx) * 0.09
      cy += (ty - cy) * 0.09
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

  const base = { ['--mx']: '50%', ['--my']: '40%' } as CSSProperties

  return (
    <div ref={ref} aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden" style={base}>
      {/* Ortam ışıkları — her zaman hafifçe süzülür */}
      <div
        className="aurora-drift-a absolute -top-1/3 left-[2%] w-[60vw] h-[60vw] max-w-[820px] max-h-[820px] rounded-full blur-[130px]"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.18), transparent 62%)' }}
      />
      <div
        className="aurora-drift-b absolute -top-[10%] right-0 w-[52vw] h-[52vw] max-w-[720px] max-h-[720px] rounded-full blur-[140px]"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.15), transparent 62%)' }}
      />
      <div
        className="aurora-drift-c absolute bottom-[-25%] left-[28%] w-[46vw] h-[46vw] max-w-[640px] max-h-[640px] rounded-full blur-[140px]"
        style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.13), transparent 64%)' }}
      />
      {/* İmleci takip eden ışıklar — renkler mouse ile belirgin hareket eder */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(560px circle at var(--mx) var(--my), rgba(16,185,129,0.30), transparent 60%)' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(680px circle at calc(100% - var(--mx)) calc(100% - var(--my)), rgba(34,211,238,0.20), transparent 62%)' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(420px circle at var(--mx) var(--my), rgba(125,211,252,0.13), transparent 55%)' }} />
    </div>
  )
}
