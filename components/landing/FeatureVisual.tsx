'use client'

/* Özelliğe özel, GERÇEK hareketli (CSS animasyonlu) mockup'lar.
   Faz 2'de bunların yerine/üstüne gerçek ürün demo videoları gelebilir. */

const KF = `
@keyframes fv-sweep { 0% { transform: translateX(-160%) } 55%,100% { transform: translateX(420%) } }
@keyframes fv-pop { 0%,22% { opacity:0; transform: translateY(7px) scale(.96) } 44%,100% { opacity:1; transform:none } }
@keyframes fv-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
@keyframes fv-twinkle { 0%,100% { opacity:.35; transform: scale(.85) } 50% { opacity:1; transform: scale(1.1) } }
@keyframes fv-cycle { 0%,26% { transform: translateY(0) } 34%,60% { transform: translateY(-76px) } 68%,94% { transform: translateY(-152px) } 100% { transform: translateY(0) } }
@keyframes fv-climb { 0%,12% { transform: translateY(108px) } 44%,64% { transform: translateY(54px) } 90%,100% { transform: translateY(0) } }
@keyframes fv-build { 0%,8% { opacity:0; transform: scaleY(.3) } 26%,100% { opacity:1; transform: none } }
@keyframes fv-bar { 0% { height: 18% } 100% { height: var(--h) } }
@media (prefers-reduced-motion: reduce) { .fv-anim *, .fv-anim { animation: none !important } }
`

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="fv-anim relative w-full aspect-[16/10] rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-white/[0.012] overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: KF }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 28% 16%, rgba(16,185,129,0.16), transparent 62%)' }} />
      <div className="absolute top-3.5 left-4 flex gap-1.5 z-10">
        <span className="w-2 h-2 rounded-full bg-white/15" /><span className="w-2 h-2 rounded-full bg-white/15" /><span className="w-2 h-2 rounded-full bg-emerald-400/45" />
      </div>
      {children}
    </div>
  )
}

/* TASARIM — AI görsel üretiliyor (shimmer sweep + öğeler beliriyor + sparkle) */
function Tasarim() {
  return (
    <Frame>
      <div className="absolute inset-x-7 top-9 bottom-7 flex flex-col">
        <div className="relative flex-1 rounded-xl bg-white/[0.04] border border-white/[0.06] overflow-hidden">
          <div className="absolute top-0 bottom-0 w-1/3" style={{ background: 'linear-gradient(90deg,transparent,rgba(16,185,129,0.28),transparent)', animation: 'fv-sweep 2.6s ease-in-out infinite' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="rgba(52,211,153,0.7)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21,15 16,10 5,21" /></svg>
          </div>
          <div className="absolute top-2 right-2 text-emerald-300" style={{ animation: 'fv-twinkle 1.8s ease-in-out infinite' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l1.6 5L19 9.6 14 11l-1.4 5L11 11 6 9.6 11 8z" /></svg>
          </div>
        </div>
        <div className="h-2.5 w-2/3 rounded-full bg-white/[0.14] mt-3.5" style={{ animation: 'fv-pop 3.4s ease-in-out infinite' }} />
        <div className="h-2.5 w-2/5 rounded-full bg-white/[0.07] mt-2" style={{ animation: 'fv-pop 3.4s .2s ease-in-out infinite' }} />
        <div className="h-7 w-28 rounded-full bg-gradient-to-r from-emerald-400/40 to-teal-400/30 border border-emerald-400/30 mt-3" style={{ animation: 'fv-pop 3.4s .45s ease-in-out infinite' }} />
      </div>
    </Frame>
  )
}

/* SOSYAL MEDYA — gönderiler döngüde kayar + takvim noktaları */
function Sosyal() {
  const posts = ['rgba(16,185,129,0.18)', 'rgba(56,189,248,0.16)', 'rgba(168,139,250,0.16)']
  return (
    <Frame>
      <div className="absolute inset-x-7 top-9 bottom-7 flex gap-3">
        <div className="w-1/2 rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden relative">
          <div style={{ animation: 'fv-cycle 7.5s ease-in-out infinite' }}>
            {[...posts, posts[0]].map((c, i) => (
              <div key={i} className="h-[72px] m-2 rounded-lg flex items-center gap-2 px-3" style={{ background: c }}>
                <div className="w-8 h-8 rounded-full bg-white/15 shrink-0" />
                <div className="flex-1 space-y-1.5"><div className="h-2 rounded-full bg-white/20 w-3/4" /><div className="h-2 rounded-full bg-white/10 w-1/2" /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="w-1/2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-[5px] bg-white/[0.05]" style={[2, 6, 9, 13].includes(i) ? { background: 'rgba(16,185,129,0.4)', animation: `fv-twinkle 2s ${i * 0.2}s ease-in-out infinite` } : undefined} />
            ))}
          </div>
        </div>
      </div>
    </Frame>
  )
}

/* SEO PLUS — arama sıralaması yukarı tırmanır */
function Seo() {
  return (
    <Frame>
      <div className="absolute inset-x-7 top-9 bottom-7 flex flex-col gap-2 justify-end overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[44px] rounded-lg border border-white/[0.06] bg-white/[0.03] flex items-center gap-2.5 px-3">
            <span className="text-[11px] font-bold text-gray-600 w-4">{i + 4}</span>
            <div className="flex-1 space-y-1.5"><div className="h-2 rounded-full bg-white/12 w-2/3" /><div className="h-1.5 rounded-full bg-white/[0.07] w-2/5" /></div>
          </div>
        ))}
        <div className="absolute left-0 right-0 h-[44px] rounded-lg border border-emerald-400/35 bg-emerald-400/[0.12] flex items-center gap-2.5 px-3 shadow-[0_0_24px_rgba(16,185,129,0.22)]" style={{ bottom: 0, animation: 'fv-climb 4.5s ease-in-out infinite' }}>
          <span className="text-[12px] font-black text-emerald-300 w-4">1</span>
          <div className="flex-1 space-y-1.5"><div className="h-2 rounded-full bg-emerald-300/40 w-2/3" /><div className="h-1.5 rounded-full bg-emerald-300/20 w-1/2" /></div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(110,231,183)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18,15 12,9 6,15" /></svg>
        </div>
      </div>
    </Frame>
  )
}

/* WEB SİTE — bloklar sırayla kurulur */
function Web() {
  const blocks = [
    { h: 'h-5', w: 'w-full', d: 0 },
    { h: 'h-12', w: 'w-full', d: 0.25 },
    { h: 'h-10', w: 'w-1/2', d: 0.5, row: true },
    { h: 'h-10', w: 'w-1/2', d: 0.65, row: true },
    { h: 'h-4', w: 'w-full', d: 0.9 },
  ]
  return (
    <Frame>
      <div className="absolute inset-x-7 top-9 bottom-7 rounded-xl border border-white/[0.06] bg-white/[0.025] p-2.5 flex flex-col gap-2">
        <div className="flex gap-2">
          {blocks.filter((b) => b.row).map((b, i) => (
            <div key={`r${i}`} className={`${b.h} ${b.w} rounded-md bg-emerald-400/[0.10] border border-emerald-400/15`} style={{ animation: `fv-build 4.2s ${b.d}s ease-in-out infinite`, transformOrigin: 'top' }} />
          ))}
        </div>
      </div>
      {/* Üst bloklar (nav + hero) ve alt blok ayrı sırada */}
      <div className="absolute inset-x-7 top-9 rounded-t-xl p-2.5 flex flex-col gap-2 pointer-events-none">
        <div className="h-5 w-full rounded-md bg-white/[0.10]" style={{ animation: 'fv-build 4.2s 0s ease-in-out infinite', transformOrigin: 'top' }} />
        <div className="h-14 w-full rounded-md bg-gradient-to-br from-emerald-400/[0.16] to-teal-400/[0.06] border border-emerald-400/15" style={{ animation: 'fv-build 4.2s .25s ease-in-out infinite', transformOrigin: 'top' }} />
      </div>
    </Frame>
  )
}

export default function FeatureVisual({ slug }: { slug: string }) {
  if (slug === 'tasarim') return <Tasarim />
  if (slug === 'sosyal-medya') return <Sosyal />
  if (slug === 'seo-plus') return <Seo />
  if (slug === 'web-site-yoneticisi') return <Web />
  return <Frame><div className="absolute inset-0 flex items-center justify-center text-emerald-400/40 text-sm">DijiMagic</div></Frame>
}
