import Link from 'next/link'
import Image from 'next/image'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import LandingHeader from '@/components/landing/LandingHeader'
import FooterLangSwitcher from '@/components/landing/FooterLangSwitcher'
import { FEATURE_PAGES, GROUP_LABEL, type FeaturePage } from '@/components/landing/featurePagesData'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Özellikler — DijiMagic',
  description: 'DijiMagic\'in tüm modülleri: reklam yönetimi, yapay zekâ strateji, tasarım, SEO, CRM, e-posta ve daha fazlası, tek panelde.',
  alternates: {
    canonical: 'https://dijimagic.com/tr/ozellikler',
    languages: { tr: 'https://dijimagic.com/tr/ozellikler', en: 'https://dijimagic.com/en/ozellikler' },
  },
}

const ICONS: Record<string, string> = {
  meta: '<path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>',
  google: '<text x="3.5" y="18" font-size="19" font-weight="700" font-family="Arial,sans-serif" fill="currentColor" stroke="none">G</text>',
  tiktok: '<path d="M9 18V8.5a5.5 5.5 0 005.5 5.5V10a4 4 0 01-2.5-3.7V3h-3z"/><circle cx="6" cy="18" r="3"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  trending: '<polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/>',
  sparkle: '<path d="M11 3l1.6 4.4L17 9l-4.4 1.6L11 15l-1.6-4.4L5 9l4.4-1.6z"/><path d="M18.5 13l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"/>',
  users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98"/><path d="M15.41 6.51l-6.82 3.98"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>',
  chart: '<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>',
  crm: '<rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M13 9h6M13 13h6M5 16c.4-1.2 1.6-2 3-2s2.6.8 3 2"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>',
  plug: '<path d="M10 13a5 5 0 007.07 0l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.07 0l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>',
}
function Icon({ name }: { name: string }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[name] || '' }} />
}

const GROUP_ORDER: FeaturePage['group'][] = ['reklam', 'ai', 'icerik', 'yonetim']

export default async function OzelliklerPage() {
  const store = await cookies()
  const isEn = store.get('NEXT_LOCALE')?.value === 'en'
  const locale = isEn ? 'en' : 'tr'

  const t = isEn
    ? { badge: 'Everything in one platform', h1a: 'One platform,', h1b: 'every marketing module', sub1: 'DijiMagic unifies ad management, AI strategy, content creation, SEO, CRM, email marketing and website design in one intelligent panel.', sub2: 'With the power of an agency working for your brand, it runs all your digital processes from a single hub.', soon: 'Soon', ctaTrial: '7-Day Free Trial', ctaSchedule: 'Book a Call', explore: 'Explore', bottomTitle: 'Ready to run all of it from one place?', bottomSub: 'Start your 7-day free trial. No credit card required.', footer: '2026 DijiMagic. All rights reserved.' }
    : { badge: 'Her şey tek platformda', h1a: 'Tek platform,', h1b: 'tüm pazarlama modülleri', sub1: 'DijiMagic; reklam yönetimi, yapay zekâ stratejileri, içerik üretimi, SEO, CRM, e-mail marketing ve web sitesi tasarımını tek bir akıllı panelde birleştirir.', sub2: 'Markanız için çalışan bir ajans gücüyle tüm dijital süreçlerinizi tek merkezden yönetir.', soon: 'Yakında', ctaTrial: '7 Gün Ücretsiz Dene', ctaSchedule: 'Görüşme Planla', explore: 'İncele', bottomTitle: 'Hepsini tek yerden yönetmeye hazır mısın?', bottomSub: '7 günlük ücretsiz denemeni başlat. Kredi kartı gerekmez.', footer: '2026 DijiMagic. Tüm hakları saklıdır.' }

  return (
    <div className="min-h-screen bg-[#161d28] text-white flex flex-col overflow-x-hidden" style={{ fontSize: '16px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .feat-hero-flow { background-image: linear-gradient(90deg,#34d399,#2dd4bf,#22d3ee,#2dd4bf,#34d399); background-size: 250% auto; -webkit-background-clip: text; background-clip: text; animation: feat-hero-flow 6s linear infinite; }
        @keyframes feat-hero-flow { to { background-position: 250% center; } }
        .btn-shimmer { position: relative; overflow: hidden; }
      ` }} />

      <LandingHeader locale={locale} ctaSchedule={t.ctaSchedule} ctaTrial={t.ctaTrial} />

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
            <p>{t.sub2}</p>
          </div>
        </div>
      </section>

      {/* ── MODÜL GRID (gruplu) ── */}
      <section className="relative w-full px-6 pt-4 pb-10 md:pb-14">
        <div className="max-w-6xl mx-auto space-y-12 md:space-y-14">
          {GROUP_ORDER.map((g) => {
            const items = FEATURE_PAGES.filter((p) => p.group === g)
            if (!items.length) return null
            const gl = GROUP_LABEL[g]
            return (
              <div key={g}>
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-emerald-400/80 mb-5">{isEn ? gl.en : gl.tr}</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                  {items.map((p) => (
                    <Link
                      key={p.slug}
                      href={`/${locale}/ozellikler/${p.slug}`}
                      className="group relative rounded-2xl border border-white/[0.09] bg-white/[0.045] p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-400/25 hover:bg-white/[0.06] hover:shadow-[0_10px_40px_-14px_rgba(16,185,129,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <span className="shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400/[0.14] to-teal-400/[0.06] border border-emerald-400/20 flex items-center justify-center text-emerald-400"><Icon name={p.icon} /></span>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-white">{isEn ? p.name.en : p.name.tr}</h3>
                          {p.soon && <span className="text-[10px] font-semibold uppercase text-emerald-300/80 bg-emerald-400/10 px-2 py-0.5 rounded-full">{t.soon}</span>}
                        </div>
                      </div>
                      <p className="text-[14.5px] text-gray-300/85 leading-relaxed">{isEn ? p.en.sub : p.tr.sub}</p>
                      <span className="inline-flex items-center gap-1 text-[13px] font-medium text-emerald-400/90 mt-4 group-hover:gap-2 transition-all">
                        {t.explore}
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="relative w-full px-6 py-12 md:py-16">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[360px] rounded-full blur-[150px]" style={{ background: 'radial-gradient(ellipse, rgba(16,185,129,0.09), transparent 70%)' }} />
        </div>
        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">{t.bottomTitle}</h2>
          <p className="text-base text-gray-400 mb-6 max-w-md mx-auto leading-relaxed">{t.bottomSub}</p>
          <Link href="/signup" className="btn-shimmer inline-flex items-center gap-2 text-[15px] font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 text-black hover:from-emerald-400 hover:to-teal-400 px-8 py-3.5 rounded-full transition-all shadow-[0_0_30px_rgba(16,185,129,0.22)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60">
            {t.ctaTrial}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="w-full border-t border-white/[0.05] py-6 px-6 bg-[#161d28] mt-auto">
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
