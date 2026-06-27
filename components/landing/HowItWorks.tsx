'use client'

import { useState } from 'react'
import FeatureVisual from './FeatureVisual'

/* "Nasıl Çalışır" — Strateji / Optimizasyon / Tasarım sekmeleri.
   Sağdaki video-poster şimdilik placeholder; gerçek 45sn demo videoları 2. adımda eklenecek. */

type Tab = {
  id: string
  tr: { name: string; desc: string; steps: string[] }
  en: { name: string; desc: string; steps: string[] }
}

const TABS: Tab[] = [
  {
    id: 'strateji',
    tr: { name: 'Strateji', desc: 'Yapay zeka siteni, sosyal medyanı ve ürünlerini inceler; doğru hedef kitleyi bulur ve sana özel reklam stratejini kurar.', steps: ['Siteni ve sosyal medyanı analiz eder', 'Ürünlerini ve rakiplerini inceler', 'Hedef kitleni belirler', 'Stratejini ve kampanya planını oluşturur'] },
    en: { name: 'Strategy', desc: 'AI reviews your site, social media and products; finds the right audience and builds an ad strategy tailored to you.', steps: ['Analyzes your site and social media', 'Reviews your products and competitors', 'Defines your target audience', 'Builds your strategy and campaign plan'] },
  },
  {
    id: 'optimizasyon',
    tr: { name: 'Optimizasyon', desc: 'Yayındaki her reklamın getirisini anlık izler; düşük performanslıya bütçeyi kısar, yüksek dönüşümlüyü otomatik büyütür.', steps: ['ROAS ve maliyeti anlık izler', 'Düşük performanslıyı kısar veya durdurur', 'Yüksek dönüşümlüye bütçe ekler', 'Gece gündüz otomatik optimize eder'] },
    en: { name: 'Optimization', desc: 'Tracks every live ad\'s return in real time; cuts budget on low performers and automatically scales high converters.', steps: ['Tracks ROAS and cost in real time', 'Trims or pauses low performers', 'Adds budget to high converters', 'Optimizes around the clock'] },
  },
  {
    id: 'tasarim',
    tr: { name: 'Tasarım', desc: 'Markana uygun reklam görsellerini saniyeler içinde üretir; arka planı temizler, metni yazar, her platforma göre dışa aktarır.', steps: ['Marka rengini ve tonunu öğrenir', 'Reklama hazır görseller üretir', 'Arka planı temizler, başlığı yazar', 'Her platform ölçüsüne dışa aktarır'] },
    en: { name: 'Design', desc: 'Generates on-brand ad creatives in seconds; cleans up backgrounds, writes the copy and exports for every platform.', steps: ['Learns your brand color and tone', 'Generates ad-ready visuals', 'Removes background, writes the headline', 'Exports to every platform size'] },
  },
]

export default function HowItWorks({ isEn }: { isEn: boolean }) {
  const [active, setActive] = useState(0)
  const tab = TABS[active]
  const c = isEn
    ? { eyebrow: 'How it works', title: 'Set up in 30 seconds, AI handles the rest', demo: 'Demo · see it in 45 seconds', soon: 'Video coming soon' }
    : { eyebrow: 'Nasıl Çalışır', title: '30 saniyede kur, gerisini yapay zeka halletsin', demo: 'Demo · 45 saniyede gör', soon: 'Video çok yakında' }

  return (
    <section className="relative w-full px-6 py-14 md:py-20">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes hiw-pulse { 0%,100% { transform: scale(1); opacity: 1 } 50% { transform: scale(1.06); opacity: .88 } }
        @keyframes hiw-ring { 0% { transform: scale(.8); opacity: .5 } 100% { transform: scale(1.8); opacity: 0 } }
        @keyframes hiw-enter { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
        @media (prefers-reduced-motion: reduce) { .hiw-pulse, .hiw-ring, .hiw-enter { animation: none !important } }
      ` }} />
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/3 left-1/4 w-[460px] h-[460px] bg-emerald-500/[0.04] rounded-full blur-[130px]" />
      </div>

      <div className="relative max-w-6xl mx-auto">
        <div className="text-center mb-8 md:mb-10">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-emerald-400/80 mb-2.5">{c.eyebrow}</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{c.title}</h2>
        </div>

        {/* Sekme pill */}
        <div className="flex justify-center mb-8 md:mb-10">
          <div className="inline-flex gap-1 p-1.5 rounded-full border border-white/[0.08] bg-white/[0.03]">
            {TABS.map((tb, i) => (
              <button
                key={tb.id}
                onClick={() => setActive(i)}
                aria-pressed={active === i}
                className={`px-5 py-2 rounded-full text-[14px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${active === i
                  ? 'bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-400/30 shadow-[0_0_18px_-6px_rgba(16,185,129,0.5)]'
                  : 'text-gray-400 hover:text-white font-medium border border-transparent'}`}
              >
                {isEn ? tb.en.name : tb.tr.name}
              </button>
            ))}
          </div>
        </div>

        {/* İçerik: sol metin + sağ video poster */}
        <div key={active} className="hiw-enter grid md:grid-cols-2 gap-8 md:gap-12 items-center" style={{ animation: 'hiw-enter .35s ease both' }}>
          <div>
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">{isEn ? tab.en.name : tab.tr.name}</h3>
            <p className="text-[15px] md:text-base text-gray-300/90 leading-relaxed max-w-md mb-6">{isEn ? tab.en.desc : tab.tr.desc}</p>
            <ul className="space-y-3 max-w-md">
              {(isEn ? tab.en.steps : tab.tr.steps).map((s, i) => (
                <li key={i} className="flex items-start gap-3 text-[15px] text-gray-300/90">
                  <span className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-emerald-400/12 border border-emerald-400/25 flex items-center justify-center text-[12px] font-bold text-emerald-300">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>

          {/* Modüle özel animasyonlu temsilî mockup (Strateji/Optimizasyon/Tasarım) */}
          <FeatureVisual slug={tab.id} />
        </div>
      </div>
    </section>
  )
}
