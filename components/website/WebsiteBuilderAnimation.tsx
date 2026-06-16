'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * WebsiteBuilderAnimation
 * ------------------------------------------------------------------
 * Web Site Yöneticisi boş-durum (henüz site yokken) görseli.
 * Yazısız, salt görsel, sonsuz döngülü bir "web sitesi inşası" animasyonu:
 *   1) Masaüstü ekranında gri wireframe bloklar sırayla yerine oturur (build)
 *   2) İskelet markaya bürünür (colorize — YoAi yeşili)
 *   3) Tablet + telefon süzülerek girer, responsive uyum gösterir
 *   4) Yeşil "yayın" nabzı atar, kısa bir nefes payı, sonra yumuşakça baştan
 *
 * Marka renkleri globals.css'teki gerçek değerlerden alınmıştır (#2BB673 / #059669).
 * Sadece transform/opacity animasyonu kullanır; prefers-reduced-motion desteklidir.
 */

type Flags = {
  mounted: boolean
  building: boolean
  colorized: boolean
  responsive: boolean
  published: boolean
  leaving: boolean
}

const EMPTY_FLAGS: Flags = {
  mounted: false,
  building: false,
  colorized: false,
  responsive: false,
  published: false,
  leaving: false,
}

const BLOCK_COUNT = 6 // nav, hero, 3 kart, footer

export default function WebsiteBuilderAnimation() {
  const [flags, setFlags] = useState<Flags>(EMPTY_FLAGS)
  const [built, setBuilt] = useState(0) // kaç blok yerine oturdu (stagger)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const raf = useRef<number | null>(null)

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const at = (fn: () => void, ms: number) => {
      timers.current.push(setTimeout(fn, ms))
    }

    const cycle = () => {
      setFlags(EMPTY_FLAGS)
      setBuilt(0)

      if (reduce) {
        // Hareket azaltma: statik son kareyi göster, döngü kurma.
        setFlags({ ...EMPTY_FLAGS, mounted: true, colorized: true, responsive: true })
        setBuilt(BLOCK_COUNT)
        return
      }

      at(() => setFlags((f) => ({ ...f, mounted: true })), 120)
      at(() => setFlags((f) => ({ ...f, building: true })), 540)
      for (let i = 0; i < BLOCK_COUNT; i++) {
        at(() => setBuilt(i + 1), 540 + i * 255)
      }
      const buildEnd = 540 + BLOCK_COUNT * 255 // ~2070
      at(() => setFlags((f) => ({ ...f, colorized: true })), buildEnd + 420)
      at(() => setFlags((f) => ({ ...f, responsive: true })), buildEnd + 420 + 1150)
      at(() => setFlags((f) => ({ ...f, published: true })), buildEnd + 420 + 1150 + 1250)
      at(() => setFlags((f) => ({ ...f, leaving: true })), buildEnd + 420 + 1150 + 1250 + 2900)
      at(() => {
        raf.current = requestAnimationFrame(cycle)
      }, buildEnd + 420 + 1150 + 1250 + 2900 + 950)
    }

    cycle()

    return () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [])

  const stageClass = [
    'stage',
    flags.mounted && 'mounted',
    flags.building && 'building',
    flags.colorized && 'colorized',
    flags.responsive && 'responsive',
    flags.published && 'published',
    flags.leaving && 'leaving',
  ]
    .filter(Boolean)
    .join(' ')

  const blk = (i: number, extra: string) =>
    `blk ${extra} ${built > i ? 'in' : ''}`.trim()

  return (
    <div className={stageClass} aria-hidden="true">
      <div className="grid" />
      <span className="particle p1" />
      <span className="particle s p2" />
      <span className="particle p3" />
      <span className="particle s p4" />
      <span className="particle s p5" />

      <div className="devices">
        {/* TABLET */}
        <div className="rig tablet">
          <div className="device-shell">
            <div className="device-screen">
              <div className="mini-pad">
                <div className="mini-nav">
                  <span className="mini-logo" />
                  <span className="burger">
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
                <div className="mini-hero" />
                <div className="mini-bar" />
                <div className="mini-bar s" />
                <div className="mini-cta" />
                <div className="mini-row">
                  <span className="mc" />
                  <span className="mc" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MONİTÖR */}
        <div className="rig monitor">
          <div className="screen">
            <div className="browser-bar">
              <span className="dot r" />
              <span className="dot y" />
              <span className="dot g" />
              <span className="url">
                <span className="lock" />
                <span className="ul" />
              </span>
            </div>
            <div className="viewport">
              <div className={blk(0, 'v-nav')}>
                <span className="logo" />
                <span className="menu">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="nav-cta" />
              </div>
              <div className={blk(1, 'v-hero')}>
                <div className="hero-l">
                  <span className="bar lg" />
                  <span className="bar md" />
                  <span className="bar sm" />
                  <span className="hero-btn" />
                </div>
                <div className="hero-r" />
              </div>
              <div className="v-cards">
                <div className={blk(2, 'card')}>
                  <span className="ph" />
                  <span className="l1" />
                  <span className="l2" />
                </div>
                <div className={blk(3, 'card')}>
                  <span className="ph" />
                  <span className="l1" />
                  <span className="l2" />
                </div>
                <div className={blk(4, 'card')}>
                  <span className="ph" />
                  <span className="l1" />
                  <span className="l2" />
                </div>
              </div>
              <div className={blk(5, 'v-foot')}>
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="scan" />
          </div>
          <svg className="cursor" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 3l14 7-6 1.6L9.5 19 5 3z"
              fill="#0f172a"
              stroke="#fff"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
          <div className="publish-ring" />
        </div>

        {/* PHONE */}
        <div className="rig phone">
          <div className="device-shell phone">
            <div className="device-screen">
              <div className="notch" />
              <div className="mini-pad">
                <div className="mini-nav">
                  <span className="mini-logo" />
                  <span className="burger">
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
                <div className="mini-hero" />
                <div className="mini-bar" />
                <div className="mini-bar s" />
                <div className="mini-cta" />
                <div className="mini-row">
                  <span className="mc" />
                  <span className="mc" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .stage {
          --brand: #2bb673;
          --brand-600: #059669;
          --brand-500: #22c55e;
          --brand-400: #34d399;
          --brand-300: #6ee7b7;
          --frame: #1f2937;
          --wire: #e5e7eb;
          --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
          --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

          position: relative;
          width: 100%;
          min-height: clamp(460px, 64vh, 660px);
          border: 1px solid #e7ebe9;
          border-radius: 18px;
          overflow: hidden;
          background: radial-gradient(120% 90% at 50% -10%, #ffffff 0%, #f7fbf9 55%, #eef7f2 100%);
          box-shadow: 0 24px 60px -28px rgba(15, 23, 42, 0.28);
          isolation: isolate;
        }

        .stage::before,
        .stage::after {
          content: '';
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          z-index: 0;
          pointer-events: none;
        }
        .stage::before {
          width: 520px;
          height: 520px;
          left: -120px;
          top: -160px;
          background: radial-gradient(circle, rgba(43, 182, 115, 0.2), transparent 70%);
          animation: wbaGlowDrift 18s ease-in-out infinite;
        }
        .stage::after {
          width: 460px;
          height: 460px;
          right: -120px;
          bottom: -180px;
          background: radial-gradient(circle, rgba(52, 211, 153, 0.18), transparent 70%);
          animation: wbaGlowDrift 22s ease-in-out infinite reverse;
        }
        @keyframes wbaGlowDrift {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(34px, 26px) scale(1.08);
          }
        }

        .grid {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          opacity: 0.6;
          background-image: radial-gradient(rgba(15, 23, 42, 0.07) 1px, transparent 1.4px);
          background-size: 26px 26px;
          -webkit-mask-image: radial-gradient(120% 80% at 50% 40%, #000 35%, transparent 80%);
          mask-image: radial-gradient(120% 80% at 50% 40%, #000 35%, transparent 80%);
          animation: wbaGridDrift 24s linear infinite;
        }
        @keyframes wbaGridDrift {
          from {
            background-position: 0 0;
          }
          to {
            background-position: 26px 26px;
          }
        }

        .particle {
          position: absolute;
          z-index: 2;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--brand-400);
          opacity: 0.5;
          pointer-events: none;
          box-shadow: 0 0 10px rgba(52, 211, 153, 0.6);
        }
        .particle.s {
          width: 4px;
          height: 4px;
          background: var(--brand-300);
        }
        .p1 {
          left: 16%;
          top: 24%;
          animation: wbaFloatP 9s ease-in-out infinite;
        }
        .p2 {
          left: 80%;
          top: 30%;
          animation: wbaFloatP 11s ease-in-out infinite 0.8s;
        }
        .p3 {
          left: 30%;
          top: 74%;
          animation: wbaFloatP 10s ease-in-out infinite 1.6s;
        }
        .p4 {
          left: 67%;
          top: 78%;
          animation: wbaFloatP 12s ease-in-out infinite 0.4s;
        }
        .p5 {
          left: 50%;
          top: 14%;
          animation: wbaFloatP 8.5s ease-in-out infinite 1.2s;
        }
        @keyframes wbaFloatP {
          0%,
          100% {
            transform: translate(0, 0);
            opacity: 0.25;
          }
          50% {
            transform: translate(10px, -18px);
            opacity: 0.7;
          }
        }

        .devices {
          position: absolute;
          inset: 0;
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 34px;
          padding: 0 4%;
        }
        .rig {
          position: relative;
        }
        .screen,
        .device-shell {
          width: 100%;
        }

        /* ===== MONİTÖR ===== */
        .monitor {
          width: min(60%, 660px);
        }
        .screen {
          position: relative;
          background: #fff;
          border: 1px solid #dfe5e2;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 30px 50px -30px rgba(15, 23, 42, 0.45), 0 2px 0 rgba(255, 255, 255, 0.6) inset;
          aspect-ratio: 16 / 10;
          opacity: 0;
          transform: translateY(14px) scale(0.985);
          transition: opacity 0.6s var(--ease-out), transform 0.7s var(--ease-out);
        }
        .stage.mounted .screen {
          opacity: 1;
          transform: none;
        }

        .browser-bar {
          height: 34px;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 0 12px;
          background: linear-gradient(180deg, #fafcfb, #f1f5f3);
          border-bottom: 1px solid #eaeeec;
        }
        .dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #dfe3e6;
        }
        .dot.r {
          background: #ffbcb5;
        }
        .dot.y {
          background: #ffe39a;
        }
        .dot.g {
          background: #b7ecc8;
        }
        .url {
          flex: 1;
          height: 18px;
          border-radius: 6px;
          background: #fff;
          border: 1px solid #e9edec;
          margin-left: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 8px;
        }
        .url .lock {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--brand);
          box-shadow: 0 0 0 2px rgba(43, 182, 115, 0.18);
        }
        .url .ul {
          height: 5px;
          border-radius: 3px;
          background: #e7ebea;
          width: 42%;
        }

        .viewport {
          position: relative;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 13px;
          height: calc(100% - 34px);
        }
        .viewport > * {
          flex-shrink: 0;
        }

        .scan {
          position: absolute;
          left: 0;
          right: 0;
          top: 34px;
          height: 140px;
          z-index: 6;
          pointer-events: none;
          opacity: 0;
          background: linear-gradient(
            180deg,
            rgba(43, 182, 115, 0) 0%,
            rgba(43, 182, 115, 0.16) 55%,
            rgba(43, 182, 115, 0.5) 90%,
            rgba(43, 182, 115, 1) 100%
          );
          border-bottom: 2.5px solid var(--brand-600);
          box-shadow: 0 6px 30px rgba(43, 182, 115, 0.7);
          mix-blend-mode: multiply;
        }
        .stage.building .scan {
          animation: wbaScan 1.85s var(--ease-out) 2;
        }
        @keyframes wbaScan {
          0% {
            opacity: 0;
            transform: translateY(-150px);
          }
          8% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(420px);
          }
        }

        .blk {
          border-radius: 8px;
          background: var(--wire);
          position: relative;
          overflow: hidden;
          opacity: 0;
          transform: translateY(16px) scale(0.97);
          transform-origin: center;
          transition: background 0.6s var(--ease-out), box-shadow 0.6s var(--ease-out),
            border-color 0.6s var(--ease-out);
        }
        .blk.in {
          animation: wbaBlockIn 0.62s var(--ease-out) forwards;
        }
        @keyframes wbaBlockIn {
          to {
            opacity: 1;
            transform: none;
          }
        }

        .v-nav {
          display: flex;
          align-items: center;
          gap: 9px;
          height: 26px;
        }
        .logo {
          width: 30px;
          height: 14px;
          border-radius: 5px;
          background: var(--wire);
        }
        .menu {
          display: flex;
          gap: 7px;
          margin-left: 6px;
        }
        .menu i {
          display: block;
          width: 24px;
          height: 6px;
          border-radius: 3px;
          background: var(--wire);
        }
        .nav-cta {
          margin-left: auto;
          width: 46px;
          height: 18px;
          border-radius: 6px;
          background: var(--wire);
        }

        .v-hero {
          display: flex;
          gap: 12px;
        }
        .hero-l {
          flex: 1.05;
          display: flex;
          flex-direction: column;
          gap: 9px;
          justify-content: center;
        }
        .bar {
          height: 9px;
          border-radius: 5px;
          background: var(--wire);
        }
        .bar.lg {
          height: 13px;
          width: 86%;
        }
        .bar.md {
          width: 66%;
        }
        .bar.sm {
          height: 7px;
          width: 48%;
        }
        .hero-btn {
          margin-top: 5px;
          width: 96px;
          height: 24px;
          border-radius: 7px;
          background: var(--wire);
        }
        .hero-r {
          flex: 0.95;
          border-radius: 10px;
          background: var(--wire);
          min-height: 96px;
        }

        .v-cards {
          display: flex;
          gap: 11px;
        }
        .card {
          flex: 1;
          height: 74px;
          border-radius: 9px;
          background: var(--wire);
          padding: 9px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .card .ph {
          height: 30px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.6);
        }
        .card .l1 {
          height: 6px;
          width: 80%;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.7);
        }
        .card .l2 {
          height: 6px;
          width: 55%;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.7);
        }

        .v-foot {
          display: flex;
          gap: 8px;
          margin-top: auto;
        }
        .v-foot i {
          height: 6px;
          border-radius: 3px;
          background: var(--wire);
          flex: 1;
        }
        .v-foot i:nth-child(2) {
          flex: 0.6;
        }
        .v-foot i:nth-child(3) {
          flex: 0.8;
        }

        /* ===== COLORIZE ===== */
        .stage.colorized .logo {
          background: linear-gradient(135deg, var(--brand), var(--brand-600));
        }
        .stage.colorized .menu i {
          background: #d7dee6;
        }
        .stage.colorized .nav-cta {
          background: var(--brand);
          box-shadow: 0 4px 10px -4px rgba(43, 182, 115, 0.8);
        }
        .stage.colorized .hero-r {
          background: linear-gradient(135deg, var(--brand-400), var(--brand-600));
          box-shadow: 0 12px 22px -12px rgba(5, 150, 105, 0.6) inset,
            0 8px 18px -12px rgba(5, 150, 105, 0.5);
        }
        .stage.colorized .bar.lg {
          background: #cfd6de;
        }
        .stage.colorized .bar.md,
        .stage.colorized .bar.sm {
          background: #dde3ea;
        }
        .stage.colorized .hero-btn {
          background: var(--brand-600);
          box-shadow: 0 6px 14px -6px rgba(5, 150, 105, 0.7);
        }
        .stage.colorized .card {
          background: #fff;
          border: 1px solid #eef1f0;
          box-shadow: 0 8px 18px -14px rgba(15, 23, 42, 0.25);
        }
        .stage.colorized .card .ph {
          background: linear-gradient(135deg, #d6f5e4, #bfeecf);
        }
        .stage.colorized .v-cards .card:nth-child(2) .ph {
          background: linear-gradient(135deg, #e7f0fb, #d6e6fb);
        }
        .stage.colorized .v-cards .card:nth-child(3) .ph {
          background: linear-gradient(135deg, #fdf0db, #f8e4c2);
        }
        .stage.colorized .card .l1,
        .stage.colorized .card .l2 {
          background: #e9edf1;
        }
        .stage.colorized .card .l1 {
          width: 78%;
        }
        .stage.colorized .v-foot i {
          background: #e3e8ee;
        }
        .logo,
        .menu i,
        .nav-cta,
        .hero-r,
        .bar,
        .hero-btn,
        .card,
        .card .ph,
        .card .l1,
        .card .l2,
        .v-foot i {
          transition: background 0.6s var(--ease-out), box-shadow 0.6s var(--ease-out),
            border-color 0.6s var(--ease-out);
        }

        /* tasarımcı imleci */
        .cursor {
          position: absolute;
          z-index: 8;
          width: 18px;
          height: 18px;
          left: 0;
          top: 0;
          opacity: 0;
          filter: drop-shadow(0 2px 3px rgba(15, 23, 42, 0.3));
          pointer-events: none;
        }
        .stage.building .cursor {
          animation: wbaCursor 3.1s var(--ease-out) forwards;
        }
        @keyframes wbaCursor {
          0% {
            opacity: 0;
            left: 18%;
            top: 20%;
          }
          10% {
            opacity: 1;
          }
          30% {
            left: 70%;
            top: 24%;
          }
          55% {
            left: 30%;
            top: 52%;
          }
          80% {
            left: 64%;
            top: 70%;
          }
          92% {
            opacity: 1;
            left: 46%;
            top: 42%;
          }
          100% {
            opacity: 0;
            left: 46%;
            top: 42%;
          }
        }

        /* ===== TABLET ===== */
        .tablet {
          width: 178px;
          flex: 0 0 178px;
          opacity: 0;
          transform: translateX(46px) translateY(8px) rotate(4deg) scale(0.94);
          transition: opacity 0.7s var(--ease-out), transform 0.85s var(--ease-spring);
        }
        .stage.responsive .tablet {
          opacity: 1;
          transform: none;
        }
        .device-shell {
          background: var(--frame);
          border-radius: 20px;
          padding: 9px;
          box-shadow: 0 26px 44px -26px rgba(15, 23, 42, 0.6);
        }
        .device-shell.phone {
          border-radius: 24px;
          padding: 7px;
        }
        .device-screen {
          background: #fff;
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .tablet .device-screen {
          aspect-ratio: 3 / 4;
        }
        .mini-pad {
          padding: 9px;
          display: flex;
          flex-direction: column;
          gap: 7px;
          height: 100%;
        }
        .mini-nav {
          display: flex;
          align-items: center;
          gap: 5px;
          height: 16px;
        }
        .mini-logo {
          width: 18px;
          height: 9px;
          border-radius: 3px;
          background: linear-gradient(135deg, var(--brand), var(--brand-600));
        }
        .burger {
          margin-left: auto;
          display: flex;
          flex-direction: column;
          gap: 2.5px;
        }
        .burger span {
          width: 13px;
          height: 2px;
          border-radius: 2px;
          background: #cbd5e1;
          display: block;
        }
        .mini-hero {
          height: 42px;
          border-radius: 8px;
          background: linear-gradient(135deg, var(--brand-400), var(--brand-600));
        }
        .mini-bar {
          height: 6px;
          border-radius: 3px;
          background: #e2e8f0;
        }
        .mini-bar.s {
          width: 60%;
        }
        .mini-cta {
          height: 14px;
          width: 60px;
          border-radius: 5px;
          background: var(--brand-600);
        }
        .mini-row {
          display: flex;
          gap: 6px;
        }
        .mini-row .mc {
          flex: 1;
          height: 28px;
          border-radius: 6px;
          background: #eef2f6;
        }
        .mini-row .mc:nth-child(1) {
          background: #dbf4e7;
        }

        /* ===== PHONE ===== */
        .phone {
          width: 104px;
          flex: 0 0 104px;
          opacity: 0;
          transform: translateX(64px) translateY(14px) rotate(7deg) scale(0.9);
          transition: opacity 0.7s var(--ease-out) 0.12s, transform 0.9s var(--ease-spring) 0.12s;
        }
        .stage.responsive .phone {
          opacity: 1;
          transform: translateY(6px) rotate(-3deg);
        }
        .phone .device-screen {
          aspect-ratio: 9 / 19;
        }
        .phone .mini-hero {
          height: 30px;
        }
        .phone .mini-row {
          flex-direction: column;
        }
        .phone .mini-row .mc {
          height: 18px;
        }
        .phone .notch {
          height: 5px;
          width: 34%;
          margin: 3px auto 0;
          border-radius: 0 0 6px 6px;
          background: #0b1220;
          opacity: 0.85;
        }

        /* yayın anı */
        .publish-ring {
          position: absolute;
          z-index: 7;
          left: 50%;
          top: 50%;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          border: 2px solid var(--brand);
          opacity: 0;
          pointer-events: none;
        }
        .stage.published .publish-ring {
          animation: wbaRing 1.5s var(--ease-out) 1;
        }
        @keyframes wbaRing {
          0% {
            opacity: 0.8;
            transform: translate(-50%, -50%) scale(0.4);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(3.2);
          }
        }
        .stage.published .screen {
          box-shadow: 0 30px 50px -30px rgba(5, 150, 105, 0.5), 0 0 0 2px rgba(43, 182, 115, 0.35);
        }

        /* kurulduktan sonra hafif yaşam */
        .stage.responsive .monitor {
          animation: wbaIdleFloat 6s ease-in-out infinite;
        }
        .stage.responsive .tablet {
          animation: wbaIdleFloatB 7s ease-in-out infinite;
        }
        @keyframes wbaIdleFloat {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        @keyframes wbaIdleFloatB {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-9px);
          }
        }

        /* loop reset */
        .stage.leaving .devices {
          transition: opacity 0.8s var(--ease-out), transform 0.8s var(--ease-out);
          opacity: 0;
          transform: scale(0.97);
        }

        @media (prefers-reduced-motion: reduce) {
          .stage *,
          .stage::before,
          .stage::after {
            animation: none !important;
            transition: none !important;
          }
          .screen,
          .tablet,
          .phone {
            opacity: 1 !important;
            transform: none !important;
          }
          .blk {
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  )
}
