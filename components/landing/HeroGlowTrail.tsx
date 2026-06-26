'use client'

import { useEffect, useRef } from 'react'

/**
 * Grower (withgrower.com) tarzı RENKLİ hero ışığı — koyu zeminde NET görünür.
 *
 * - HER ZAMAN görünür statik renkli bloblar (yeşil #3ded9a / mor / mavi) → mouse
 *   olmasa da (ve mobilde) hero renkli; "renk yok" sorunu biter.
 * - Üstüne imleci takip eden parlak yeşil + mor glow (lerp ile yumuşak); mouse
 *   durunca ~0.7s'de fade. Normal blend → BEYAZ PATLAMA YOK; yumuşak/blur'lu → kutu/panel değil.
 * - `pointer-events:none` + `z-0`, içerik `z-10` üstte. reduced-motion: takip kapalı, statik kalır.
 */
export default function HeroGlowTrail() {
  const wrap = useRef<HTMLDivElement>(null)
  const a = useRef<HTMLDivElement>(null)
  const b = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const w = wrap.current, e1 = a.current, e2 = b.current
    if (!w || !e1 || !e2 || typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let cw = 0, ch = 0, left = 0, top = 0
    const measure = () => { const r = w.getBoundingClientRect(); cw = r.width; ch = r.height; left = r.left; top = r.top }
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(w)
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)

    let tx = 0, ty = 0, ax = 0, ay = 0, bx = 0, by = 0, init = false
    let active = false, lastMove = 0, raf = 0
    const onMove = (ev: PointerEvent) => {
      const x = ev.clientX - left, y = ev.clientY - top
      if (x < -80 || y < -80 || x > cw + 80 || y > ch + 80) { active = false; return }
      tx = x; ty = y
      if (!init) { ax = bx = x; ay = by = y; init = true }
      active = true; lastMove = performance.now()
    }
    const tick = () => {
      ax += (tx - ax) * 0.15; ay += (ty - ay) * 0.15
      bx += (tx - bx) * 0.08; by += (ty - by) * 0.08
      e1.style.transform = `translate(${ax.toFixed(1)}px, ${ay.toFixed(1)}px) translate(-50%, -50%)`
      e2.style.transform = `translate(${bx.toFixed(1)}px, ${by.toFixed(1)}px) translate(-50%, -50%)`
      if (active && performance.now() - lastMove > 600) active = false
      const o = active ? '1' : '0'
      if (e1.style.opacity !== o) { e1.style.opacity = o; e2.style.opacity = o }
      raf = requestAnimationFrame(tick)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      cancelAnimationFrame(raf); ro?.disconnect()
    }
  }, [])

  return (
    <div
      ref={wrap}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      style={{
        /* Glow'u merkeze toplayıp kenarlara doğru yumuşakça söndür: section'ın dikdörtgen
           sınırında keskin kesim ("ışıktan çerçeve / kutu" hissi) oluşmasın. */
        maskImage: 'radial-gradient(ellipse 88% 94% at 50% 36%, #000 40%, transparent 88%)',
        WebkitMaskImage: 'radial-gradient(ellipse 88% 94% at 50% 36%, #000 40%, transparent 88%)',
      }}
    >
      {/* HER ZAMAN görünür statik bloblar — emerald + teal (marka paleti; mor/mavi YOK) */}
      <div className="absolute -top-24 left-[6%] w-[42vw] max-w-[560px] aspect-square rounded-full blur-[100px]" style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.30), transparent 66%)' }} />
      <div className="absolute -top-16 right-[4%] w-[40vw] max-w-[540px] aspect-square rounded-full blur-[100px]" style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.26), transparent 66%)' }} />
      <div className="absolute bottom-[-35%] left-[32%] w-[44vw] max-w-[600px] aspect-square rounded-full blur-[110px]" style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.22), transparent 66%)' }} />
      {/* İmleci takip eden glow — emerald + teal (normal blend) */}
      <div ref={a} className="absolute top-0 left-0 w-[28vw] max-w-[400px] aspect-square rounded-full blur-[80px] opacity-0 transition-opacity duration-700 ease-out" style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.38), transparent 66%)', willChange: 'transform, opacity' }} />
      <div ref={b} className="absolute top-0 left-0 w-[26vw] max-w-[360px] aspect-square rounded-full blur-[80px] opacity-0 transition-opacity duration-700 ease-out" style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.32), transparent 66%)', willChange: 'transform, opacity' }} />
    </div>
  )
}
