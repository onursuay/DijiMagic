'use client'

import { useEffect, useRef } from 'react'

/**
 * Cursor-following colorful blurred glow trail effect.
 *
 * Mouse hero üzerinde gezdikçe, imlecin ARKASINDA renkli (cyan/blue/purple/green/pink),
 * blur verilmiş, yumuşak ışık/sis izleri (glow noktaları) üretilir; noktalar kısa sürede
 * opacity ile fade-out olur. Mouse durunca izler yavaşça kaybolur.
 *
 * - Ayrı bir OVERLAY canvas katmanı (hero background DEĞİL; border/çerçeve/kutu YOK).
 * - Mouse olmadan HİÇBİR şey boyanmaz (yalnız imlecin geçtiği noktalar).
 * - `pointer-events:none` + `aria-hidden` → içerik/buton/navbar etkilenmez; `z-0`, içerik `z-10` üstte.
 * - requestAnimationFrame ile çizim; nokta sayısı sınırlı; CSS `blur()` ile sis hissi.
 * - `prefers-reduced-motion` / mobil (mouse yok): efekt çalışmaz (statik kalır).
 */
const COLORS = [
  '34,211,238',  // cyan
  '59,130,246',  // blue
  '168,85,247',  // purple
  '16,185,129',  // green
  '236,72,153',  // pink
]

export default function HeroGlowTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!canvas || !parent || typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0, h = 0
    const resize = () => {
      const r = parent.getBoundingClientRect()
      w = r.width; h = r.height
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    ro?.observe(parent)

    type Pt = { x: number; y: number; life: number; color: string; r: number }
    const pts: Pt[] = []
    let ci = 0
    let lastX = 0, lastY = 0, hasLast = false
    let raf = 0

    const onMove = (e: PointerEvent) => {
      const r = parent.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      if (x < 0 || y < 0 || x > w || y > h) { hasLast = false; return } // yalnız hero içinde
      if (!hasLast) { lastX = x; lastY = y; hasLast = true; return }
      const dx = x - lastX, dy = y - lastY
      const dist = Math.hypot(dx, dy)
      const step = 16
      const n = Math.max(1, Math.min(5, Math.floor(dist / step)))
      for (let i = 1; i <= n; i++) {
        pts.push({
          x: lastX + (dx * i) / n,
          y: lastY + (dy * i) / n,
          life: 1,
          color: COLORS[ci % COLORS.length],
          r: 80 + Math.random() * 70,
        })
        ci++
      }
      lastX = x; lastY = y
      if (pts.length > 90) pts.splice(0, pts.length - 90)
    }

    const tick = () => {
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter' // additive → renkler birbirine karışır
      for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i]
        p.life -= 0.02 // ~0.8s'de fade-out
        if (p.life <= 0) { pts.splice(i, 1); continue }
        const a = p.life * 0.45
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r)
        g.addColorStop(0, `rgba(${p.color},${a})`)
        g.addColorStop(1, `rgba(${p.color},0)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'
      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(raf)
      ro?.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0"
      style={{ filter: 'blur(16px)' }}
    />
  )
}
