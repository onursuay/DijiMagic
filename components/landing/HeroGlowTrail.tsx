'use client'

import { useEffect, useRef } from 'react'

/**
 * Grower (withgrower.com) tarzı yumuşak renkli hero ışığı.
 *
 * Grower'ın GERÇEK yapısı: statik, blur'lu yeşil (#3ded9a) + mor bloblar + animasyonlu
 * başlık. Biz buna ek olarak imleci NAZİKÇE takip eden yumuşak yeşil/mor glow ekliyoruz
 * (kullanıcı "mouse gezdikçe renk" istedi). ÖNEMLİ: additive blending YOK → beyaza
 * patlamaz; normal blend + düşük opacity + ağır blur → yumuşak RENKLİ his.
 *
 * - Statik ambient bloblar her zaman görünür (mobil/mouse yok → Grower tabanı).
 * - İmleci takip eden 2 glow (yeşil önde, mor hafif geride) lerp ile yumuşak izler;
 *   mouse durunca ~0.7s'de fade-out. `pointer-events:none` + `z-0`, içerik `z-10` üstte.
 * - `prefers-reduced-motion` / mobil: yalnız statik ambient (takip kapalı).
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

    let tx = 0, ty = 0
    let ax = 0, ay = 0, bx = 0, by = 0, init = false
    let active = false, lastMove = 0, raf = 0

    const onMove = (ev: PointerEvent) => {
      const x = ev.clientX - left, y = ev.clientY - top
      if (x < -60 || y < -60 || x > cw + 60 || y > ch + 60) { active = false; return } // yalnız hero çevresi
      tx = x; ty = y
      if (!init) { ax = bx = x; ay = by = y; init = true }
      active = true
      lastMove = performance.now()
    }
    const tick = () => {
      ax += (tx - ax) * 0.14; ay += (ty - ay) * 0.14 // yeşil — daha hızlı takip
      bx += (tx - bx) * 0.07; by += (ty - by) * 0.07 // mor — hafif geride (iz hissi)
      e1.style.transform = `translate(${ax.toFixed(1)}px, ${ay.toFixed(1)}px) translate(-50%, -50%)`
      e2.style.transform = `translate(${bx.toFixed(1)}px, ${by.toFixed(1)}px) translate(-50%, -50%)`
      if (active && performance.now() - lastMove > 600) active = false // mouse durdu → fade
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
      cancelAnimationFrame(raf)
      ro?.disconnect()
    }
  }, [])

  return (
    <div ref={wrap} aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/* Grower statik ambient — yumuşak yeşil/mor bloblar (mouse yokken/mobilde de görünür) */}
      <div className="absolute -top-20 right-[5%] w-[36vw] max-w-[480px] aspect-square rounded-full blur-[100px]" style={{ background: 'radial-gradient(circle, rgba(61,237,154,0.14), transparent 70%)' }} />
      <div className="absolute -bottom-28 left-[3%] w-[32vw] max-w-[430px] aspect-square rounded-full blur-[100px]" style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.13), transparent 70%)' }} />
      {/* İmleci takip eden yumuşak renkli glow — yeşil + mor (beyaz DEĞİL; normal blend, ağır blur) */}
      <div ref={a} className="absolute top-0 left-0 w-[26vw] max-w-[360px] aspect-square rounded-full blur-[80px] opacity-0 transition-opacity duration-700 ease-out" style={{ background: 'radial-gradient(circle, rgba(61,237,154,0.22), transparent 68%)', willChange: 'transform, opacity' }} />
      <div ref={b} className="absolute top-0 left-0 w-[24vw] max-w-[320px] aspect-square rounded-full blur-[80px] opacity-0 transition-opacity duration-700 ease-out" style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.20), transparent 68%)', willChange: 'transform, opacity' }} />
    </div>
  )
}
