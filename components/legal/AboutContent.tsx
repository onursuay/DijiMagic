import Link from 'next/link'
import LandingHeader from '@/components/landing/LandingHeader'

const A = {
  tr: {
    back: 'Ana sayfaya dön',
    title: 'Hakkımızda',
    p1: 'DijiMagic, reklam kampanyalarınızı oluşturmanızı, kreatiflerinizi üretmenizi ve SEO süreçlerinizi tek merkezden yönetmenizi sağlayan yapay zeka destekli hepsi bir arada pazarlama platformudur.',
    p2: 'Meta ve Google reklam yönetimi, AI tabanlı optimizasyon, SEO, sosyal medya, tasarım üretimi ve işletme zekâsını tek panelde birleştirir. Ajanslar, markalar ve dijital uzmanlar için geliştirilmiştir; operasyonel yükü azaltır, performans odağını güçlendirir.',
    cta: 'Ücretsiz Dene',
    contact: 'İletişim',
  },
  en: {
    back: 'Back to home',
    title: 'About',
    p1: 'DijiMagic is an AI-powered all-in-one marketing platform that lets you create ad campaigns, generate creatives and manage your SEO from a single hub.',
    p2: 'It unifies Meta and Google ad management, AI-based optimization, SEO, social media, design generation and business intelligence in one panel. Built for agencies, brands and digital experts; it reduces operational load and sharpens performance focus.',
    cta: 'Start Free',
    contact: 'Contact',
  },
}

export default function AboutContent({ locale = 'tr' }: { locale?: 'tr' | 'en' }) {
  const a = A[locale]
  const isEn = locale === 'en'
  return (
    <div className="min-h-screen bg-[#161d28] text-white">
      <LandingHeader
        locale={locale}
        ctaSchedule={isEn ? 'Book a Call' : 'Toplantı Planla'}
        ctaTrial={isEn ? '7-Day Free Trial' : '7 Günlük Ücretsiz Deneme'}
      />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-emerald-400 hover:text-emerald-300 transition-colors mb-6 inline-block text-sm">
          &larr; {a.back}
        </Link>
        <div className="relative rounded-2xl border border-emerald-400/10 bg-white/[0.02] px-8 py-10 shadow-[0_0_60px_rgba(16,185,129,0.07),inset_0_0_40px_rgba(16,185,129,0.03)]">
          <h1 className="text-3xl font-bold mb-6 text-white">{a.title}</h1>
          <div className="space-y-5 text-[15px] text-[#8a8f98] leading-relaxed">
            <p>{a.p1}</p>
            <p>{a.p2}</p>
          </div>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link href="/" className="inline-flex items-center justify-center rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-6 py-3 transition-all active:scale-[0.97]">
              {a.cta}
            </Link>
            <Link href={isEn ? '/contact' : '/iletisim'} className="inline-flex items-center justify-center rounded-xl border border-white/15 hover:border-white/30 text-white/90 font-semibold px-6 py-3 transition-colors">
              {a.contact}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
