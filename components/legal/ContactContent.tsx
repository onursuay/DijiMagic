import Link from 'next/link'
import LandingHeader from '@/components/landing/LandingHeader'

const C = {
  tr: {
    back: 'Ana sayfaya dön',
    title: 'İletişim',
    intro: 'Sorularınız, talepleriniz veya iş birliği için bize ulaşın. En kısa sürede dönüş yaparız.',
    emailLabel: 'E-posta',
    addressLabel: 'Adres',
    address: 'Çankaya / Ankara, Türkiye',
    emailCta: 'E-posta Gönder',
    schedCta: 'Toplantı Planla',
    supportNote: 'Destek ve veri talepleriniz için de bu adresi kullanabilirsiniz.',
  },
  en: {
    back: 'Back to home',
    title: 'Contact',
    intro: 'Reach out for questions, requests or partnership. We get back to you as soon as possible.',
    emailLabel: 'Email',
    addressLabel: 'Address',
    address: 'Çankaya / Ankara, Turkey',
    emailCta: 'Send Email',
    schedCta: 'Book a Call',
    supportNote: 'You can also use this address for support and data requests.',
  },
}

export default function ContactContent({ locale = 'tr' }: { locale?: 'tr' | 'en' }) {
  const c = C[locale]
  const isEn = locale === 'en'
  return (
    <div className="min-h-screen bg-[#060609] text-white">
      <LandingHeader
        locale={locale}
        ctaSchedule={isEn ? 'Book a Call' : 'Toplantı Planla'}
        ctaTrial={isEn ? '7-Day Free Trial' : '7 Günlük Ücretsiz Deneme'}
      />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-emerald-400 hover:text-emerald-300 transition-colors mb-6 inline-block text-sm">
          &larr; {c.back}
        </Link>
        <div className="relative rounded-2xl border border-emerald-400/10 bg-white/[0.02] px-8 py-10 shadow-[0_0_60px_rgba(16,185,129,0.07),inset_0_0_40px_rgba(16,185,129,0.03)]">
          <h1 className="text-3xl font-bold mb-3 text-white">{c.title}</h1>
          <p className="text-[15px] text-[#8a8f98] leading-relaxed mb-8">{c.intro}</p>

          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4">
              <div className="text-[12px] uppercase tracking-wide text-[#6b7280] mb-1">{c.emailLabel}</div>
              <a href="mailto:info@dijimagic.com" className="text-emerald-400 hover:text-emerald-300 transition-colors text-[15px] font-medium">info@dijimagic.com</a>
              <p className="text-[13px] text-[#6b7280] mt-1">{c.supportNote}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4">
              <div className="text-[12px] uppercase tracking-wide text-[#6b7280] mb-1">{c.addressLabel}</div>
              <div className="text-[15px] text-white/90 leading-relaxed">{c.address}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-8">
            <a href="mailto:info@dijimagic.com" className="inline-flex items-center justify-center rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-6 py-3 transition-all active:scale-[0.97]">
              {c.emailCta}
            </a>
            <Link href="/" className="inline-flex items-center justify-center rounded-xl border border-white/15 hover:border-white/30 text-white/90 font-semibold px-6 py-3 transition-colors">
              {c.schedCta}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
