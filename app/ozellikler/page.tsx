import Link from 'next/link'
import Image from 'next/image'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import LandingHeader from '@/components/landing/LandingHeader'
import FooterLangSwitcher from '@/components/landing/FooterLangSwitcher'
import FeatureTabs from '@/components/landing/FeatureTabs'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Özellikler — DijiMagic',
  description: 'DijiMagic\'in tüm modülleri: reklam yönetimi, yapay zekâ strateji, tasarım, SEO, CRM, e-posta ve daha fazlası, tek panelde.',
  alternates: { canonical: 'https://dijimagic.com/ozellikler' },
}

export default async function OzelliklerPage() {
  const store = await cookies()
  const isEn = store.get('NEXT_LOCALE')?.value === 'en'

  const t = isEn
    ? { badge: 'Everything in one platform', h1a: 'One platform,', h1b: 'every marketing module', sub1: 'DijiMagic unifies ad management, AI strategy, content creation, SEO, CRM, email marketing and website design in one intelligent panel.', sub2: 'With the power of an agency working for your brand, it runs all your digital processes from a single hub.', soon: 'Soon', ctaTrial: '7-Day Free Trial', ctaSchedule: 'Book a Call', bottomTitle: 'Ready to run all of it from one place?', bottomSub: 'Start your 7-day free trial. No credit card required.', footer: '2026 DijiMagic. All rights reserved.' }
    : { badge: 'Her şey tek platformda', h1a: 'Tek platform,', h1b: 'tüm pazarlama modülleri', sub1: 'DijiMagic; reklam yönetimi, yapay zekâ stratejileri, içerik üretimi, SEO, CRM, e-mail marketing ve web sitesi tasarımını tek bir akıllı panelde birleştirir.', sub2: 'Markanız için çalışan bir ajans gücüyle tüm dijital süreçlerinizi tek merkezden yönetir.', soon: 'Yakında', ctaTrial: '7 Gün Ücretsiz Dene', ctaSchedule: 'Görüşme Planla', bottomTitle: 'Hepsini tek yerden yönetmeye hazır mısın?', bottomSub: '7 günlük ücretsiz denemeni başlat. Kredi kartı gerekmez.', footer: '2026 DijiMagic. Tüm hakları saklıdır.' }

  return (
    <div className="min-h-screen bg-[#0a0e13] text-white flex flex-col overflow-x-hidden" style={{ fontSize: '16px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .feat-hero-flow {
          background-image: linear-gradient(90deg,#34d399,#22d3ee,#38bdf8,#818cf8,#38bdf8,#22d3ee,#34d399);
          background-size: 250% auto;
          -webkit-background-clip: text; background-clip: text;
          animation: feat-flow 4s linear infinite;
        }
        @keyframes feat-flow { 0% { background-position: 0% center } 100% { background-position: 250% center } }
        .feat-tab-enter { animation: feat-tab-in .35s ease both }
        @keyframes feat-tab-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        .btn-shimmer { position: relative; overflow: hidden; }
        .btn-shimmer::after { content:''; position:absolute; top:0; left:-60%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(16,185,129,0.18),transparent); animation:shimmer-slide 6s ease-in-out infinite; opacity:0; }
        @keyframes shimmer-slide { 0%{left:-60%;opacity:0} 5%{opacity:1} 25%{left:100%;opacity:1} 30%{opacity:0} 100%{opacity:0;left:100%} }
        @keyframes feat-marquee { from { transform: translateX(-50%) } to { transform: translateX(0) } }
        .feat-marquee { animation: feat-marquee 32s linear infinite; will-change: transform }
        .feat-marquee-wrap { -webkit-mask-image: linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent); mask-image: linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent) }
        .feat-marquee-wrap:hover .feat-marquee { animation-play-state: paused }
        @media (prefers-reduced-motion: reduce) { .feat-hero-flow, .feat-tab-enter, .feat-marquee { animation: none !important } .btn-shimmer::after { animation: none !important } }
      ` }} />

      <LandingHeader locale={isEn ? 'en' : 'tr'} ctaSchedule={t.ctaSchedule} ctaTrial={t.ctaTrial} />

      {/* ── HERO ── */}
      <section className="relative w-full px-6 pt-10 pb-8 md:pt-12 md:pb-10 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-[-12%] left-1/2 -translate-x-1/2 w-[900px] h-[520px] rounded-full blur-[150px]" style={{ background: 'radial-gradient(ellipse, rgba(16,185,129,0.10) 0%, rgba(20,184,166,0.04) 50%, transparent 78%)' }} />
        </div>
        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2.5 text-[13px] font-medium text-emerald-400/90 border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-2 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
            {t.badge}
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black leading-[1.05] tracking-tight mb-5">
            {t.h1a}{' '}
            <span className="feat-hero-flow bg-clip-text text-transparent">{t.h1b}</span>
          </h1>
          <div className="text-lg md:text-xl text-gray-300/90 leading-relaxed max-w-5xl mx-auto space-y-1.5">
            <p>{t.sub1}</p>
            <p className="md:whitespace-nowrap">{t.sub2}</p>
          </div>
        </div>
      </section>

      {/* ── ÖZELLİK TOGGLE/SEKME ── */}
      <FeatureTabs isEn={isEn} soonLabel={t.soon} />

      {/* ── BOTTOM CTA ── */}
      <section className="relative w-full px-6 py-8 md:py-10">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[360px] rounded-full blur-[150px]" style={{ background: 'radial-gradient(ellipse, rgba(16,185,129,0.09), transparent 70%)' }} />
        </div>
        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">{t.bottomTitle}</h2>
          <p className="text-base text-gray-400 mb-6 max-w-md mx-auto leading-relaxed">{t.bottomSub}</p>
          <Link href="/signup" className="btn-shimmer inline-flex items-center gap-2 text-[15px] font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 text-black hover:from-emerald-400 hover:to-teal-400 px-8 py-3.5 rounded-full transition-all shadow-[0_0_30px_rgba(16,185,129,0.22)] active:scale-[0.97]">
            {t.ctaTrial}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="w-full border-t border-white/[0.05] py-6 px-6 bg-[#0a0e13] mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3 text-gray-500">
            <Image src="/logos/dijimagic-logo-light.png" alt="DijiMagic" width={88} height={28} className="object-contain opacity-40" />
            <span>{t.footer}</span>
          </div>
          <FooterLangSwitcher />
        </div>
      </footer>
    </div>
  )
}
