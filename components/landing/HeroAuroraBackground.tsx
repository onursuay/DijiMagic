'use client'

import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'

/**
 * Cursor-following blurred radial aurora gradient background effect.
 *
 * - Mouse hero üzerinde gezdikçe `--mouse-x` / `--mouse-y` CSS değişkenleri güncellenir
 *   (requestAnimationFrame + yumuşak lerp ile optimize — her mousemove'da reflow yok).
 * - 3 renkli (MAVİ / YEŞİL / MOR) cursor-takipli radial-gradient katmanı, konumu
 *   doğrudan `radial-gradient(circle … at var(--mouse-x) var(--mouse-y))` ile sürülür.
 * - 3 süzülen, blur'lu ortam (ambient) katmanı → mobil/statik yumuşak aurora tabanı.
 * - `pointer-events:none` + `aria-hidden` → tıklamayı/erişilebilirliği ETKİLEMEZ.
 * - `z-0` arka planda; içerik `z-10` ile üstte kalır. Hero `overflow-hidden` ile kırpılır.
 * - `prefers-reduced-motion` veya mobil (mouse yok): efekt statik yumuşak aurora kalır.
 */
export default function HeroAuroraBackground() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    let tx = 50, ty = 38 // hedef (mouse) konumu, % hero
    let cx = 50, cy = 38 // mevcut (eased) konum

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return
      tx = ((e.clientX - r.left) / r.width) * 100
      ty = ((e.clientY - r.top) / r.height) * 100
    }
    const tick = () => {
      cx += (tx - cx) * 0.08
      cy += (ty - cy) * 0.08
      el.style.setProperty('--mouse-x', cx.toFixed(2) + '%')
      el.style.setProperty('--mouse-y', cy.toFixed(2) + '%')
      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  const base = { ['--mouse-x']: '50%', ['--mouse-y']: '38%' } as CSSProperties

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="hero-aurora pointer-events-none absolute inset-0 z-0 overflow-hidden"
      style={base}
    >
      {/* Süzülen ortam katmanları — mobil/statik aurora tabanı (mavi / yeşil / mor) */}
      <div className="hero-aurora-amb hero-aurora-amb-1" />
      <div className="hero-aurora-amb hero-aurora-amb-2" />
      <div className="hero-aurora-amb hero-aurora-amb-3" />
      {/* İmleci takip eden katmanlar — renkler mouse ile hareket eder */}
      <div className="hero-aurora-cur hero-aurora-cur-blue" />
      <div className="hero-aurora-cur hero-aurora-cur-green" />
      <div className="hero-aurora-cur hero-aurora-cur-pink" />
    </div>
  )
}
