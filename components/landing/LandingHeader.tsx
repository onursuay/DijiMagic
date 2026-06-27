'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import ScheduleModal from './ScheduleModal'
import { featureHref } from './featurePagesData'
interface Props {
  locale: string
  ctaSchedule: string
  ctaTrial: string
  ctaDemo?: string
}

const productGroups = [
  { tr: 'Reklam Yönetimi', en: 'Ad Management', items: [
    { icon: 'meta', tr: 'Meta', en: 'Meta', slug: 'meta' },
    { icon: 'google', tr: 'Google', en: 'Google', slug: 'google' },
    { icon: 'tiktok', tr: 'TikTok', en: 'TikTok', slug: 'tiktok', soon: true },
  ] },
  { tr: 'Yapay Zeka & Strateji', en: 'AI & Strategy', items: [
    { icon: 'target', tr: 'Strateji', en: 'Strategy', slug: 'strateji' },
    { icon: 'trending', tr: 'Optimizasyon', en: 'Optimization', slug: 'optimizasyon' },
    { icon: 'sparkle', tr: 'DijiAlgoritma', en: 'DijiAlgorithm', slug: 'dijialgoritma' },
    { icon: 'users', tr: 'Hedef Kitle', en: 'Audience', slug: 'hedef-kitle' },
  ] },
  { tr: 'İçerik & Üretim', en: 'Content & Creation', items: [
    { icon: 'image', tr: 'Tasarım', en: 'Design', slug: 'tasarim' },
    { icon: 'share', tr: 'Sosyal Medya', en: 'Social Media', slug: 'sosyal-medya' },
    { icon: 'search', tr: 'SEO Plus', en: 'SEO Plus', slug: 'seo-plus' },
    { icon: 'globe', tr: 'Web Site Yöneticisi', en: 'Website Manager', slug: 'web-site-yoneticisi' },
  ] },
  { tr: 'Yönetim & Büyüme', en: 'Management & Growth', items: [
    { icon: 'chart', tr: 'Raporlar', en: 'Reports', slug: 'raporlar' },
    { icon: 'crm', tr: 'CRM Sistemi', en: 'CRM', slug: 'crm-sistemi' },
    { icon: 'mail', tr: 'Email Marketing', en: 'Email Marketing', slug: 'email-marketing' },
    { icon: 'plug', tr: 'Entegrasyon', en: 'Integration', slug: 'entegrasyon' },
  ] },
]

const integrationItems = [
  { icon: 'meta', label: { tr: 'Meta', en: 'Meta' }, desc: { tr: 'Facebook, Instagram, WhatsApp reklamlarını kolayca yönet', en: 'Manage Facebook, Instagram, WhatsApp ads' }, href: '/#entegrasyonlar' },
  { icon: 'google', label: { tr: 'Google', en: 'Google' }, desc: { tr: 'Google Ads ve YouTube reklamları ile potansiyel müşterilere ulaş', en: 'Reach customers with Google Ads' }, href: '/#entegrasyonlar' },
  { icon: 'analytics', label: { tr: 'Google Analytics', en: 'Google Analytics' }, desc: { tr: 'İstediğin metriklere kolayca ulaş', en: 'Access the metrics you need' }, href: '/#entegrasyonlar' },
  { icon: 'console', label: { tr: 'Search Console', en: 'Search Console' }, desc: { tr: 'Site analizi, anahtar kelime takibi ve sıralama optimizasyonu', en: 'Site analysis and keyword tracking' }, href: '/#entegrasyonlar' },
]

const menuIcons: Record<string, string> = {
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  trending: '<polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/>',
  users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/>',
  sparkle: '<path d="M11 3l1.6 4.4L17 9l-4.4 1.6L11 15l-1.6-4.4L5 9l4.4-1.6z"/><path d="M18.5 13l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"/>',
  meta: '<path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>',
  google: '<text x="4" y="18" font-size="20" font-weight="bold" font-family="Arial,sans-serif" fill="currentColor" stroke="none">G</text>',
  analytics: '<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>',
  console: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 10l3 2-3 2"/><path d="M13 14h4"/>',
  tiktok: '<path d="M9 18V8.5a5.5 5.5 0 005.5 5.5V10a4 4 0 01-2.5-3.7V3h-3z"/><circle cx="6" cy="18" r="3"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98"/><path d="M15.41 6.51l-6.82 3.98"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>',
  chart: '<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>',
  crm: '<rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M13 9h6M13 13h6M5 16c.4-1.2 1.6-2 3-2s2.6.8 3 2"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>',
  plug: '<path d="M10 13a5 5 0 007.07 0l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.07 0l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>',
}

function MIcon({ name }: { name: string }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: menuIcons[name] || '' }} />
}

/* Shared pill style — same as "7 Gün Ücretsiz Dene" */
const pillBase = 'btn-shimmer text-[14px] font-medium border border-emerald-400/30 text-emerald-400 px-5 py-2 rounded-full transition-colors cursor-pointer'

export default function LandingHeader({ locale, ctaSchedule, ctaTrial }: Props) {
  const isEn = locale === 'en'
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const headerRef = useRef<HTMLDivElement>(null)

  const handleEnter = (menu: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setOpenMenu(menu)
  }
  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setOpenMenu(null), 200)
  }

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (headerRef.current && !headerRef.current.contains(e.target as Node)) setOpenMenu(null) }
    document.addEventListener('click', fn)
    return () => document.removeEventListener('click', fn)
  }, [])

  return (
    <header className="w-full sticky top-0 z-50 bg-[#161d28]/80 backdrop-blur-2xl" ref={headerRef}>
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">

        {/* Logo */}
        <Link href="/" className="shrink-0">
          <Image src="/logos/dijimagic-logo-light.png" alt="DijiMagic" width={140} height={46} className="object-contain" />
        </Link>

        {/* Center nav — all pills */}
        <nav className="hidden lg:flex items-center gap-2">
          {/* Ürün */}
          <div className="relative" onMouseEnter={() => handleEnter('product')} onMouseLeave={handleLeave}>
            <button className={`${pillBase} flex items-center gap-1.5 hover:bg-emerald-400/10`}>
              {isEn ? 'Product' : 'Ürün'}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            {openMenu === 'product' && (
              <div className="absolute top-full left-0 mt-2 w-[720px] bg-[#12171d] border border-white/[0.07] rounded-2xl p-5 shadow-2xl shadow-black/50" onMouseEnter={() => handleEnter('product')} onMouseLeave={handleLeave}>
                <div className="grid grid-cols-4 gap-x-4 gap-y-1">
                  {productGroups.map((g, gi) => (
                    <div key={gi}>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400/70 px-2 mb-1.5">{isEn ? g.en : g.tr}</p>
                      {g.items.map((item, i) => (
                        <Link key={i} href={featureHref(isEn ? 'en' : 'tr', item.slug)} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.05] transition-colors group" onClick={() => setOpenMenu(null)}>
                          <span className="text-gray-400 group-hover:text-emerald-400 transition-colors shrink-0"><MIcon name={item.icon} /></span>
                          <span className="text-[13px] font-medium text-gray-200 group-hover:text-white transition-colors truncate">{isEn ? item.en : item.tr}</span>
                          {('soon' in item && item.soon) && <span className="ml-auto text-[9px] font-semibold uppercase text-emerald-300/80 bg-emerald-400/10 px-1.5 py-0.5 rounded-full shrink-0">{isEn ? 'Soon' : 'Yakında'}</span>}
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Entegrasyonlar */}
          <div className="relative" onMouseEnter={() => handleEnter('integrations')} onMouseLeave={handleLeave}>
            <button className={`${pillBase} flex items-center gap-1.5 hover:bg-emerald-400/10`}>
              {isEn ? 'Integrations' : 'Entegrasyonlar'}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            {openMenu === 'integrations' && (
              <div className="absolute top-full left-0 mt-2 w-[480px] bg-[#1a1d21] border border-white/[0.06] rounded-2xl p-4 shadow-2xl shadow-black/50" onMouseEnter={() => handleEnter('integrations')} onMouseLeave={handleLeave}>
                <div className="grid grid-cols-2 gap-2">
                  {integrationItems.map((item, i) => (
                    <Link key={i} href={item.href} className="flex flex-col gap-1 p-3 rounded-xl hover:bg-white/[0.04] transition-colors group" onClick={() => setOpenMenu(null)}>
                      <div className="flex items-center gap-2 text-gray-200 group-hover:text-emerald-400 transition-colors">
                        <MIcon name={item.icon} />
                        <span className="text-[13px] font-semibold">{isEn ? item.label.en : item.label.tr}</span>
                      </div>
                      <p className="text-[12.5px] text-[#8a8f98] leading-relaxed">{isEn ? item.desc.en : item.desc.tr}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Fiyatlandırma */}
          <Link href={`/${isEn ? 'en' : 'tr'}/fiyatlandirma`} className={`${pillBase} hover:bg-emerald-400/10`}>
            {isEn ? 'Pricing' : 'Fiyatlandırma'}
          </Link>
        </nav>

        {/* Right CTAs */}
        <div className="flex items-center gap-2.5">
          <Link href="/login" className="hidden lg:inline-flex text-[14px] font-medium text-gray-400 hover:text-white px-3 py-2 transition-colors">
            {isEn ? 'Log In' : 'Giriş Yap'}
          </Link>
          <ScheduleModal label={ctaSchedule} locale={locale} />
          <Link href="/signup" className={`${pillBase} bg-emerald-400/10 hover:bg-emerald-400/15`}>
            {ctaTrial}
          </Link>
        </div>

      </div>
      <div className="h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
    </header>
  )
}
