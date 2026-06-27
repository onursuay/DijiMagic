'use client'

/* Her modüle özel, GERÇEĞİNİ TEMSİL EDEN hareketli (CSS animasyonlu) mockup'lar.
   Temsilîdir — gerçek veri/hesap adı yok. Palet: emerald/teal (mor YOK). */

const KF = `
@keyframes fv-sweep { 0% { transform: translateX(-160%) } 55%,100% { transform: translateX(420%) } }
@keyframes fv-pop { 0%,18% { opacity:0; transform: translateY(7px) scale(.97) } 40%,100% { opacity:1; transform:none } }
@keyframes fv-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
@keyframes fv-twinkle { 0%,100% { opacity:.35; transform: scale(.85) } 50% { opacity:1; transform: scale(1.1) } }
@keyframes fv-cycle { 0%,26% { transform: translateY(0) } 34%,60% { transform: translateY(-76px) } 68%,94% { transform: translateY(-152px) } 100% { transform: translateY(0) } }
@keyframes fv-climb { 0%,12% { transform: translateY(108px) } 44%,64% { transform: translateY(54px) } 90%,100% { transform: translateY(0) } }
@keyframes fv-build { 0%,8% { opacity:0; transform: scaleY(.3) } 26%,100% { opacity:1; transform: none } }
@keyframes fv-bar { 0%,10% { height: 14% } 45%,100% { height: var(--h) } }
@keyframes fv-dot { 0%,100% { opacity:.25; transform: translateY(0) } 50% { opacity:1; transform: translateY(-3px) } }
@keyframes fv-pulse { 0%,100% { opacity:.45; transform: scale(.92) } 50% { opacity:1; transform: scale(1.06) } }
@keyframes fv-ring { 0% { transform: scale(.7); opacity:.5 } 100% { transform: scale(1.5); opacity:0 } }
@keyframes fv-slide { 0%,16% { transform: translateX(0); opacity:.5 } 50%,100% { transform: translateX(96px); opacity:1 } }
@keyframes fv-line { 0%,100% { opacity:.2 } 50% { opacity:.9 } }
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
function Body({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`absolute inset-x-6 top-9 bottom-6 ${className}`}>{children}</div>
}

/* STRATEJI — AI plan satırları beliriyor + platform bütçe dağılımı */
function Strateji() {
  const rows = ['Hedef kitle belirlendi', 'Platform: Meta + Google', 'Mesaj planı hazır']
  return (
    <Frame>
      <Body className="flex flex-col">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/70 mb-2.5">Strateji oluşturuluyor</div>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2" style={{ animation: `fv-pop 4s ${i * 0.5}s ease-in-out infinite` }}>
              <span className="w-4 h-4 rounded-full bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgb(110,231,183)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12" /></svg>
              </span>
              <span className="h-2 rounded-full bg-white/15" style={{ width: `${55 + i * 12}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-auto">
          <div className="flex justify-between text-[9px] text-gray-500 mb-1"><span>Bütçe dağılımı</span><span className="text-emerald-300/70">Meta 60 · Google 40</span></div>
          <div className="h-2.5 rounded-full overflow-hidden flex bg-white/[0.05]">
            <div className="h-full bg-emerald-400/55" style={{ width: '60%', animation: 'fv-build 4s .3s ease-in-out infinite', transformOrigin: 'left' }} />
            <div className="h-full bg-teal-300/40" style={{ width: '40%', animation: 'fv-build 4s .55s ease-in-out infinite', transformOrigin: 'left' }} />
          </div>
        </div>
      </Body>
    </Frame>
  )
}

/* OPTIMIZASYON — ROAS çubukları yükseliyor + artış rozeti */
function Optimizasyon() {
  const bars = [38, 52, 44, 66, 58, 80, 92]
  return (
    <Frame>
      <Body className="flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/70">ROAS optimizasyonu</span>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-400/12 border border-emerald-400/25 rounded-full px-2 py-0.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6,15 12,9 18,15" /></svg>
            +%24
          </span>
        </div>
        <div className="flex-1 flex items-end gap-2">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 rounded-t-md" style={{ ['--h' as string]: `${h}%`, height: `${h}%`, background: `linear-gradient(to top, rgba(16,185,129,0.18), rgba(45,212,191,${0.4 + h * 0.004}))`, animation: `fv-bar 3.6s ${i * 0.12}s ease-in-out infinite` }} />
          ))}
        </div>
      </Body>
    </Frame>
  )
}

/* DIJIALGORITMA — AI sohbet asistanı (soru + yanıt yazıyor) */
function DijiAlgoritma() {
  return (
    <Frame>
      <Body className="flex flex-col justify-center gap-2.5">
        <div className="self-end max-w-[72%] rounded-2xl rounded-br-sm bg-white/[0.06] border border-white/[0.08] px-3 py-2" style={{ animation: 'fv-pop 5s 0s ease-in-out infinite' }}>
          <div className="h-2 rounded-full bg-white/20 w-32 mb-1.5" /><div className="h-2 rounded-full bg-white/10 w-20" />
        </div>
        <div className="self-start max-w-[78%] rounded-2xl rounded-bl-sm bg-emerald-400/[0.10] border border-emerald-400/25 px-3 py-2" style={{ animation: 'fv-pop 5s 1.1s ease-in-out infinite' }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="rgb(110,231,183)"><path d="M12 3l1.6 5L19 9.6 14 11l-1.4 5L11 11 6 9.6 11 8z" /></svg>
            <span className="text-[9px] font-semibold text-emerald-300/80">DijiAlgoritma</span>
          </div>
          <div className="h-2 rounded-full bg-emerald-300/30 w-36 mb-1.5" /><div className="h-2 rounded-full bg-emerald-300/20 w-24" />
        </div>
        <div className="self-start flex gap-1 px-3">
          {[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-300/70" style={{ animation: `fv-dot 1.2s ${i * 0.2}s ease-in-out infinite` }} />)}
        </div>
      </Body>
    </Frame>
  )
}

/* HEDEF KITLE — kitle noktaları segmentlere kümeleniyor + lookalike halkası */
function HedefKitle() {
  const dots = [[18, 30], [30, 22], [24, 46], [40, 36], [12, 52], [70, 28], [80, 44], [62, 50], [74, 62], [88, 32], [50, 70], [38, 64]]
  return (
    <Frame>
      <Body>
        <div className="absolute inset-0">
          {/* lookalike halka */}
          <div className="absolute rounded-full border border-emerald-400/30" style={{ left: '64%', top: '30%', width: 88, height: 88, transform: 'translate(-50%,-50%)' }} />
          <div className="absolute rounded-full border border-emerald-400/40" style={{ left: '64%', top: '30%', width: 88, height: 88, transform: 'translate(-50%,-50%)', animation: 'fv-ring 3s ease-out infinite' }} />
          {dots.map(([x, y], i) => {
            const hot = i >= 5
            return <span key={i} className="absolute rounded-full" style={{ left: `${x}%`, top: `${y}%`, width: hot ? 11 : 8, height: hot ? 11 : 8, background: hot ? 'rgba(52,211,153,0.85)' : 'rgba(255,255,255,0.18)', boxShadow: hot ? '0 0 10px rgba(16,185,129,0.5)' : 'none', animation: hot ? `fv-twinkle 2.2s ${i * 0.18}s ease-in-out infinite` : undefined }} />
          })}
        </div>
        <div className="absolute left-0 bottom-0 text-[10px] font-semibold text-emerald-300/70">Yüksek değerli segment</div>
      </Body>
    </Frame>
  )
}

/* META — Facebook/Instagram/WhatsApp tek kampanya */
function Meta() {
  const plats = [
    { c: 'rgba(56,189,248,0.5)', d: '<path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" fill="rgba(96,165,250,0.8)" stroke="none"/>' },
    { c: 'rgba(236,72,153,0.4)', d: '<rect x="3" y="3" width="18" height="18" rx="5" stroke="rgba(244,114,182,0.85)"/><circle cx="12" cy="12" r="4" stroke="rgba(244,114,182,0.85)"/><circle cx="17.5" cy="6.5" r="1" fill="rgba(244,114,182,0.85)" stroke="none"/>' },
    { c: 'rgba(16,185,129,0.45)', d: '<path d="M3 21l1.6-5A8 8 0 1112 20a8 8 0 01-4.4-1.3z" stroke="rgba(52,211,153,0.9)"/>' },
  ]
  return (
    <Frame>
      <Body className="flex flex-col">
        <div className="flex gap-2.5 mb-3">
          {plats.map((p, i) => (
            <div key={i} className="flex-1 aspect-square max-h-12 rounded-xl border border-white/[0.1] bg-white/[0.04] flex items-center justify-center" style={{ animation: `fv-pop 4s ${i * 0.25}s ease-in-out infinite` }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.6" dangerouslySetInnerHTML={{ __html: p.d }} />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-white/[0.09] bg-white/[0.03] p-2.5 flex-1 flex flex-col justify-center gap-2">
          <div className="h-2.5 rounded-full bg-white/15 w-2/3" />
          <div className="h-2 rounded-full bg-white/[0.08] w-2/5" />
          <div className="mt-1 inline-flex items-center gap-1.5 self-start rounded-full bg-emerald-400/12 border border-emerald-400/25 px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ animation: 'fv-twinkle 1.6s ease-in-out infinite' }} />
            <span className="text-[10px] font-semibold text-emerald-300">Yayında</span>
          </div>
        </div>
      </Body>
    </Frame>
  )
}

/* GOOGLE — arama sonucu + kampanya türleri */
function Google() {
  return (
    <Frame>
      <Body className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          <div className="h-2 rounded-full bg-white/15 w-2/5" />
        </div>
        <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/[0.08] p-2.5" style={{ animation: 'fv-pop 4s .2s ease-in-out infinite' }}>
          <span className="text-[9px] font-bold text-emerald-300 border border-emerald-400/40 rounded px-1 py-0.5">Reklam</span>
          <div className="h-2 rounded-full bg-emerald-300/35 w-3/4 mt-2" /><div className="h-1.5 rounded-full bg-emerald-300/20 w-1/2 mt-1.5" />
        </div>
        <div className="flex gap-1.5 mt-auto">
          {['Arama', 'Görüntülü', 'PMax'].map((t, i) => (
            <span key={i} className="flex-1 text-center text-[9px] text-gray-400 rounded-md border border-white/[0.08] bg-white/[0.03] py-1.5" style={{ animation: `fv-line 3s ${i * 0.3}s ease-in-out infinite` }}>{t}</span>
          ))}
        </div>
      </Body>
    </Frame>
  )
}

/* TIKTOK — çok yakında */
function TikTok() {
  return (
    <Frame>
      <Body className="flex flex-col items-center justify-center gap-3">
        <div className="relative">
          <span className="absolute inset-0 rounded-2xl border border-emerald-400/40" style={{ animation: 'fv-ring 2.6s ease-out infinite' }} />
          <div className="relative w-16 h-16 rounded-2xl bg-white/[0.05] border border-white/[0.12] flex items-center justify-center" style={{ animation: 'fv-float 3s ease-in-out infinite' }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V8.5a5.5 5.5 0 005.5 5.5V10a4 4 0 01-2.5-3.7V3h-3z" /><circle cx="6" cy="18" r="3" /></svg>
          </div>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300/80 bg-emerald-400/10 border border-emerald-400/20 px-3 py-1 rounded-full" style={{ animation: 'fv-twinkle 2s ease-in-out infinite' }}>Çok yakında</span>
        <div className="h-1.5 w-32 rounded-full bg-white/[0.06] overflow-hidden relative">
          <div className="absolute inset-y-0 w-1/3" style={{ background: 'linear-gradient(90deg,transparent,rgba(16,185,129,0.6),transparent)', animation: 'fv-sweep 2.4s ease-in-out infinite' }} />
        </div>
      </Body>
    </Frame>
  )
}

/* RAPORLAR — birleşik pano: KPI + grafik */
function Raporlar() {
  const bars = [40, 60, 48, 72, 64, 88]
  return (
    <Frame>
      <Body className="flex flex-col gap-2.5">
        <div className="flex gap-2.5">
          {[{ l: 'ROAS', v: '4.2x' }, { l: 'Dönüşüm', v: '1.248' }].map((k, i) => (
            <div key={i} className="flex-1 rounded-xl border border-white/[0.09] bg-white/[0.03] p-2.5" style={{ animation: `fv-pop 4s ${i * 0.2}s ease-in-out infinite` }}>
              <div className="text-[9px] text-gray-500">{k.l}</div><div className="text-base font-bold text-white">{k.v}</div>
            </div>
          ))}
        </div>
        <div className="flex-1 rounded-xl border border-white/[0.09] bg-white/[0.03] p-2.5 flex items-end gap-1.5">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 rounded-t" style={{ ['--h' as string]: `${h}%`, height: `${h}%`, background: 'linear-gradient(to top, rgba(16,185,129,0.15), rgba(45,212,191,0.5))', animation: `fv-bar 3.6s ${i * 0.12}s ease-in-out infinite` }} />
          ))}
        </div>
      </Body>
    </Frame>
  )
}

/* CRM — satış hattı (pipeline), kart ilerliyor */
function Crm() {
  const cols = ['Yeni', 'Görüşme', 'Kazanıldı']
  return (
    <Frame>
      <Body className="flex gap-2">
        {cols.map((c, ci) => (
          <div key={ci} className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.025] p-1.5">
            <div className="text-[8.5px] font-semibold text-gray-500 mb-1.5 text-center">{c}</div>
            <div className="space-y-1.5">
              {Array.from({ length: ci === 2 ? 2 : 2 }).map((_, i) => (
                <div key={i} className="rounded-md border border-white/[0.08] bg-white/[0.04] p-1.5 space-y-1">
                  <div className="h-1.5 rounded-full bg-white/15 w-3/4" /><div className="h-1.5 rounded-full bg-white/[0.08] w-1/2" />
                </div>
              ))}
            </div>
          </div>
        ))}
        {/* ilerleyen kart */}
        <div className="absolute top-9 left-[6%] w-[24%] rounded-md border border-emerald-400/35 bg-emerald-400/[0.12] p-1.5 space-y-1 shadow-[0_0_18px_rgba(16,185,129,0.25)]" style={{ animation: 'fv-slide 4.5s ease-in-out infinite' }}>
          <div className="h-1.5 rounded-full bg-emerald-300/40 w-3/4" /><div className="h-1.5 rounded-full bg-emerald-300/20 w-1/2" />
        </div>
      </Body>
    </Frame>
  )
}

/* EMAIL MARKETING — e-posta + otomasyon akışı */
function Email() {
  return (
    <Frame>
      <Body className="flex flex-col gap-2.5">
        <div className="rounded-xl border border-white/[0.09] bg-white/[0.03] p-2.5" style={{ animation: 'fv-pop 4s 0s ease-in-out infinite' }}>
          <div className="flex items-center gap-2 mb-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(52,211,153,0.8)" strokeWidth="1.6"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 6l-10 7L2 6" /></svg>
            <div className="h-2 rounded-full bg-white/15 w-1/2" />
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.08] w-full mb-1.5" /><div className="h-1.5 rounded-full bg-white/[0.06] w-2/3" />
        </div>
        <div className="flex items-center justify-between mt-auto">
          {['Gönder', 'Bekle', 'Takip'].map((t, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="flex flex-col items-center gap-1">
                <span className="w-7 h-7 rounded-full bg-emerald-400/12 border border-emerald-400/30 flex items-center justify-center text-[8px] font-bold text-emerald-300" style={{ animation: `fv-pulse 2.4s ${i * 0.4}s ease-in-out infinite` }}>{i + 1}</span>
                <span className="text-[8px] text-gray-500">{t}</span>
              </div>
              {i < 2 && <span className="w-7 h-px bg-emerald-400/30 mb-3.5" style={{ animation: `fv-line 2.4s ${i * 0.4}s ease-in-out infinite` }} />}
            </div>
          ))}
        </div>
      </Body>
    </Frame>
  )
}

/* ENTEGRASYON — merkez hub + bağlanan platformlar */
function Entegrasyon() {
  const nodes = [[14, 22], [86, 22], [14, 74], [86, 74]]
  return (
    <Frame>
      <Body>
        <svg className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }}>
          {nodes.map(([x, y], i) => (
            <line key={i} x1="50%" y1="48%" x2={`${x}%`} y2={`${y}%`} stroke="rgba(16,185,129,0.35)" strokeWidth="1.5" strokeDasharray="3 3" style={{ animation: `fv-line 2.4s ${i * 0.3}s ease-in-out infinite` }} />
          ))}
        </svg>
        <div className="absolute" style={{ left: '50%', top: '48%', transform: 'translate(-50%,-50%)' }}>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400/25 to-teal-400/10 border border-emerald-400/40 flex items-center justify-center shadow-[0_0_24px_rgba(16,185,129,0.3)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgb(110,231,183)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.07 0l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.07 0l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>
          </div>
        </div>
        {nodes.map(([x, y], i) => (
          <span key={i} className="absolute w-8 h-8 rounded-xl bg-white/[0.05] border border-white/[0.12]" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', animation: `fv-twinkle 2.6s ${i * 0.3}s ease-in-out infinite` }} />
        ))}
      </Body>
    </Frame>
  )
}

/* TASARIM — AI görsel üretiliyor (shimmer sweep + öğeler beliriyor + sparkle) */
function Tasarim() {
  return (
    <Frame>
      <Body className="flex flex-col">
        <div className="relative flex-1 rounded-xl bg-white/[0.04] border border-white/[0.09] overflow-hidden">
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
      </Body>
    </Frame>
  )
}

/* SOSYAL MEDYA — gönderiler döngüde kayar + takvim noktaları (mor YOK) */
function Sosyal() {
  const posts = ['rgba(16,185,129,0.18)', 'rgba(56,189,248,0.16)', 'rgba(45,212,191,0.16)']
  return (
    <Frame>
      <Body className="flex gap-3">
        <div className="w-1/2 rounded-xl border border-white/[0.09] bg-white/[0.03] overflow-hidden relative">
          <div style={{ animation: 'fv-cycle 7.5s ease-in-out infinite' }}>
            {[...posts, posts[0]].map((c, i) => (
              <div key={i} className="h-[72px] m-2 rounded-lg flex items-center gap-2 px-3" style={{ background: c }}>
                <div className="w-8 h-8 rounded-full bg-white/15 shrink-0" />
                <div className="flex-1 space-y-1.5"><div className="h-2 rounded-full bg-white/20 w-3/4" /><div className="h-2 rounded-full bg-white/10 w-1/2" /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="w-1/2 rounded-xl border border-white/[0.09] bg-white/[0.03] p-3">
          <div className="grid grid-cols-4 gap-1.5">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-[5px] bg-white/[0.05]" style={[2, 6, 9, 13].includes(i) ? { background: 'rgba(16,185,129,0.4)', animation: `fv-twinkle 2s ${i * 0.2}s ease-in-out infinite` } : undefined} />
            ))}
          </div>
        </div>
      </Body>
    </Frame>
  )
}

/* SEO PLUS — arama sıralaması yukarı tırmanır */
function Seo() {
  return (
    <Frame>
      <Body className="flex flex-col gap-2 justify-end overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[44px] rounded-lg border border-white/[0.09] bg-white/[0.03] flex items-center gap-2.5 px-3">
            <span className="text-[11px] font-bold text-gray-600 w-4">{i + 4}</span>
            <div className="flex-1 space-y-1.5"><div className="h-2 rounded-full bg-white/12 w-2/3" /><div className="h-1.5 rounded-full bg-white/[0.07] w-2/5" /></div>
          </div>
        ))}
        <div className="absolute left-0 right-0 h-[44px] rounded-lg border border-emerald-400/35 bg-emerald-400/[0.12] flex items-center gap-2.5 px-3 shadow-[0_0_24px_rgba(16,185,129,0.22)]" style={{ bottom: 0, animation: 'fv-climb 4.5s ease-in-out infinite' }}>
          <span className="text-[12px] font-black text-emerald-300 w-4">1</span>
          <div className="flex-1 space-y-1.5"><div className="h-2 rounded-full bg-emerald-300/40 w-2/3" /><div className="h-1.5 rounded-full bg-emerald-300/20 w-1/2" /></div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(110,231,183)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18,15 12,9 6,15" /></svg>
        </div>
      </Body>
    </Frame>
  )
}

/* WEB SİTE — bloklar sırayla kurulur */
function Web() {
  return (
    <Frame>
      <Body className="rounded-xl border border-white/[0.09] bg-white/[0.045] p-2.5 flex flex-col gap-2">
        <div className="h-5 w-full rounded-md bg-white/[0.10]" style={{ animation: 'fv-build 4.2s 0s ease-in-out infinite', transformOrigin: 'top' }} />
        <div className="h-14 w-full rounded-md bg-gradient-to-br from-emerald-400/[0.16] to-teal-400/[0.06] border border-emerald-400/15" style={{ animation: 'fv-build 4.2s .25s ease-in-out infinite', transformOrigin: 'top' }} />
        <div className="flex gap-2 flex-1">
          <div className="w-1/2 rounded-md bg-emerald-400/[0.08] border border-emerald-400/15" style={{ animation: 'fv-build 4.2s .5s ease-in-out infinite', transformOrigin: 'top' }} />
          <div className="w-1/2 rounded-md bg-emerald-400/[0.08] border border-emerald-400/15" style={{ animation: 'fv-build 4.2s .65s ease-in-out infinite', transformOrigin: 'top' }} />
        </div>
      </Body>
    </Frame>
  )
}

const MAP: Record<string, () => React.ReactElement> = {
  strateji: Strateji, optimizasyon: Optimizasyon, dijialgoritma: DijiAlgoritma, 'hedef-kitle': HedefKitle,
  meta: Meta, google: Google, tiktok: TikTok, raporlar: Raporlar, 'crm-sistemi': Crm, 'email-marketing': Email,
  entegrasyon: Entegrasyon, tasarim: Tasarim, 'sosyal-medya': Sosyal, 'seo-plus': Seo, 'web-site-yoneticisi': Web,
}

export default function FeatureVisual({ slug }: { slug: string }) {
  const V = MAP[slug]
  if (V) return <V />
  return <Frame><div className="absolute inset-0 flex items-center justify-center text-emerald-400/40 text-sm">DijiMagic</div></Frame>
}
