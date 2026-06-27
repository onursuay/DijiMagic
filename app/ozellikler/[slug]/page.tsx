import Link from 'next/link'
import Image from 'next/image'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import LandingHeader from '@/components/landing/LandingHeader'
import FooterLangSwitcher from '@/components/landing/FooterLangSwitcher'
import FeatureVisual from '@/components/landing/FeatureVisual'
import { FEATURE_PAGES, GROUP_LABEL } from '@/components/landing/featurePagesData'

export const dynamic = 'force-dynamic'

/* Icon set (FeatureTabs ile aynı) */
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
function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[name] || '' }} />
}

const VISUAL_SLUGS = new Set(['tasarim', 'sosyal-medya', 'seo-plus', 'web-site-yoneticisi'])

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const page = FEATURE_PAGES.find((p) => p.slug === slug)
  if (!page) return {}
  const store = await cookies()
  const isEn = store.get('NEXT_LOCALE')?.value === 'en'
  const c = isEn ? page.en : page.tr
  return {
    title: `${c.title} — DijiMagic`,
    description: c.sub,
    alternates: {
      canonical: `https://dijimagic.com/tr/ozellikler/${slug}`,
      languages: {
        tr: `https://dijimagic.com/tr/ozellikler/${slug}`,
        en: `https://dijimagic.com/en/ozellikler/${slug}`,
      },
    },
  }
}

export default async function FeaturePageView({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = FEATURE_PAGES.find((p) => p.slug === slug)
  if (!page) notFound()

  const store = await cookies()
  const isEn = store.get('NEXT_LOCALE')?.value === 'en'
  const c = isEn ? page.en : page.tr
  const locale = isEn ? 'en' : 'tr'
  const group = GROUP_LABEL[page.group]
  const related = FEATURE_PAGES.filter((p) => p.group === page.group && p.slug !== page.slug)

  const ui = isEn
    ? { home: 'Features', ctaTrial: '7-Day Free Trial', ctaAll: 'All features', benefitsEyebrow: 'Highlights', stepsEyebrow: 'How it works', soon: 'Soon', relatedTitle: 'Related modules', footer: '2026 DijiMagic. All rights reserved.', startNow: 'Start free' }
    : { home: 'Özellikler', ctaTrial: '7 Gün Ücretsiz Dene', ctaAll: 'Tüm özellikler', benefitsEyebrow: 'Öne çıkanlar', stepsEyebrow: 'Nasıl çalışır', soon: 'Yakında', relatedTitle: 'İlgili modüller', footer: '2026 DijiMagic. Tüm hakları saklıdır.', startNow: 'Ücretsiz başla' }

  return (
    <div className="min-h-screen bg-[#161d28] text-white flex flex-col overflow-x-hidden" style={{ fontSize: '16px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .fp-flow { background-image: linear-gradient(90deg,#34d399,#2dd4bf,#22d3ee,#2dd4bf,#34d399); background-size: 250% auto; -webkit-background-clip: text; background-clip: text; animation: fp-flow 6s linear infinite; }
        @keyframes fp-flow { to { background-position: 250% center; } }
        @keyframes fp-enter { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .fp-enter { animation: fp-enter .5s ease both; }
        .btn-shimmer { position: relative; overflow: hidden; }
        @media (prefers-reduced-motion: reduce) { .fp-flow, .fp-enter { animation: none !important; } }
      ` }} />

      <LandingHeader locale={locale} ctaSchedule={isEn ? 'Book a Call' : 'Görüşme Planla'} ctaTrial={ui.ctaTrial} />

      {/* ── HERO ── */}
      <section className="relative w-full px-6 pt-10 pb-10 md:pt-14 md:pb-12 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-[-14%] left-1/2 -translate-x-1/2 w-[900px] h-[520px] rounded-full blur-[150px]" style={{ background: 'radial-gradient(ellipse, rgba(16,185,129,0.10) 0%, rgba(20,184,166,0.04) 50%, transparent 78%)' }} />
        </div>
        <div className="relative z-10 max-w-6xl mx-auto">
          {/* breadcrumb */}
          <nav className="flex items-center gap-2 text-[13px] text-gray-500 mb-6">
            <Link href={`/${locale}/ozellikler`} className="hover:text-emerald-400 transition-colors">{ui.home}</Link>
            <span>/</span>
            <span className="text-emerald-400/80">{isEn ? group.en : group.tr}</span>
          </nav>

          <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center">
            <div className="fp-enter">
              <div className="inline-flex items-center gap-2.5 text-[13px] font-medium text-emerald-400/90 border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-2 rounded-full mb-5">
                <span className="text-emerald-400"><Icon name={page.icon} size={16} /></span>
                {isEn ? group.en : group.tr}
                {page.soon && <span className="ml-1 text-[10px] font-semibold uppercase text-emerald-300/80 bg-emerald-400/10 px-2 py-0.5 rounded-full">{ui.soon}</span>}
              </div>
              <h1 className="text-4xl md:text-5xl font-black leading-[1.08] tracking-tight mb-5">
                <span className="fp-flow text-transparent">{c.title}</span>
              </h1>
              <p className="text-lg text-gray-300/90 leading-relaxed mb-8 max-w-lg">{c.sub}</p>
              <div className="flex flex-wrap items-center gap-4">
                <Link href="/signup" className="btn-shimmer inline-flex items-center gap-2 text-[15px] font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 text-black hover:from-emerald-400 hover:to-teal-400 px-7 py-3.5 rounded-full transition-all shadow-[0_0_30px_rgba(16,185,129,0.22)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60">
                  {ui.ctaTrial}
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
                </Link>
                <Link href={`/${locale}/ozellikler`} className="text-[15px] font-medium text-gray-300 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 rounded-full px-3 py-2">
                  {ui.ctaAll}
                </Link>
              </div>
            </div>

            {/* görsel */}
            <div className="fp-enter" style={{ animationDelay: '.08s' }}>
              {VISUAL_SLUGS.has(page.slug) ? (
                <FeatureVisual slug={page.slug} />
              ) : (
                <div className="relative w-full aspect-[4/3] rounded-2xl border border-white/[0.09] bg-gradient-to-br from-white/[0.05] to-white/[0.012] overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(16,185,129,0.14), transparent 65%)' }} />
                  <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-400/20 to-teal-400/[0.08] border border-emerald-400/25 flex items-center justify-center text-emerald-300 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
                    <Icon name={page.icon} size={44} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── INTRO ── */}
      <section className="relative w-full px-6 py-4 md:py-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[17px] md:text-lg text-gray-300/90 leading-relaxed">{c.intro}</p>
        </div>
      </section>

      {/* ── ÖNE ÇIKANLAR ── */}
      <section className="relative w-full px-6 py-12 md:py-16">
        <div className="max-w-6xl mx-auto">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-emerald-400/80 mb-2.5 text-center">{ui.benefitsEyebrow}</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mt-8">
            {c.benefits.map((b, i) => (
              <div key={i} className="rounded-2xl border border-white/[0.09] bg-white/[0.045] p-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-400/12 border border-emerald-400/25 flex items-center justify-center text-emerald-300 mb-4 text-sm font-bold">{i + 1}</div>
                <h3 className="text-base font-semibold text-white mb-1.5">{b.title}</h3>
                <p className="text-[14.5px] text-gray-300/85 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NASIL ÇALIŞIR ── */}
      <section className="relative w-full px-6 py-12 md:py-16 bg-white/[0.012] border-y border-white/[0.05]">
        <div className="max-w-5xl mx-auto">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-emerald-400/80 mb-2.5 text-center">{ui.stepsEyebrow}</p>
          <div className="grid md:grid-cols-3 gap-6 md:gap-8 mt-8">
            {c.steps.map((s, i) => (
              <div key={i} className="relative">
                <div className="text-5xl font-black text-emerald-400/15 mb-2 leading-none">{String(i + 1).padStart(2, '0')}</div>
                <h3 className="text-lg font-semibold text-white mb-2">{s.title}</h3>
                <p className="text-[15px] text-gray-300/85 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── İLGİLİ MODÜLLER ── */}
      {related.length > 0 && (
        <section className="relative w-full px-6 py-12 md:py-14">
          <div className="max-w-6xl mx-auto">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-emerald-400/80 mb-6 text-center">{ui.relatedTitle}</p>
            <div className="flex flex-wrap justify-center gap-3">
              {related.map((r) => (
                <Link key={r.slug} href={`/${locale}/ozellikler/${r.slug}`} className="group inline-flex items-center gap-2.5 rounded-xl border border-white/[0.09] bg-white/[0.04] px-5 py-3 transition-all hover:border-emerald-400/25 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40">
                  <span className="text-emerald-400"><Icon name={r.icon} size={18} /></span>
                  <span className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">{isEn ? r.name.en : r.name.tr}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── BOTTOM CTA ── */}
      <section className="relative w-full px-6 py-14 md:py-20">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[360px] rounded-full blur-[150px]" style={{ background: 'radial-gradient(ellipse, rgba(16,185,129,0.09), transparent 70%)' }} />
        </div>
        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">{c.ctaTitle}</h2>
          <p className="text-base text-gray-400 mb-6">{isEn ? '7-day free trial. No credit card required.' : '7 günlük ücretsiz deneme. Kredi kartı gerekmez.'}</p>
          <Link href="/signup" className="btn-shimmer inline-flex items-center gap-2 text-[15px] font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 text-black hover:from-emerald-400 hover:to-teal-400 px-8 py-3.5 rounded-full transition-all shadow-[0_0_30px_rgba(16,185,129,0.22)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60">
            {ui.startNow}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="w-full border-t border-white/[0.05] py-6 px-6 bg-[#161d28] mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-3 text-gray-500">
            <Image src="/logos/dijimagic-logo-light.png" alt="DijiMagic" width={88} height={28} className="object-contain opacity-40" />
            <span>{ui.footer}</span>
          </div>
          <FooterLangSwitcher />
        </div>
      </footer>
    </div>
  )
}
