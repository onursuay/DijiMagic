import Image from 'next/image'

/* İstatistik şeridi + Resmi iş ortakları (Meta + Google). Ana sayfada #entegrasyonlar. */
export default function TrustStats({ isEn }: { isEn: boolean }) {
  const stats = isEn
    ? [
        { v: '500+', l: 'Active users' },
        { v: '97%', l: 'Customer satisfaction' },
        { v: '150K+', l: 'Ads managed' },
        { v: '40M+', l: 'Total reach' },
      ]
    : [
        { v: '500+', l: 'Aktif kullanıcı' },
        { v: '%97', l: 'Müşteri memnuniyeti' },
        { v: '150K+', l: 'Yönetilen reklam' },
        { v: '40M+', l: 'Toplam erişim' },
      ]

  const partnersLabel = isEn ? 'Official partners' : 'Resmi iş ortaklarımız'
  const partners = [
    { name: 'Meta', sub: isEn ? 'Business Partner' : 'İş Ortağı', icon: '/platform-icons/meta.svg' },
    { name: 'Google', sub: isEn ? 'Partner' : 'İş Ortağı', icon: '/platform-icons/google-ads.svg' },
  ]

  return (
    <section id="entegrasyonlar" className="relative w-full px-6 py-12 md:py-14 border-y border-white/[0.05] bg-white/[0.012]">
      <div className="max-w-6xl mx-auto">
        {/* İstatistikler */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-10 md:mb-12">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <p className="text-3xl md:text-4xl font-black bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">{s.v}</p>
              <p className="text-[13px] md:text-sm text-gray-400 mt-1.5">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Partnerler */}
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500 text-center mb-5">{partnersLabel}</p>
        <div className="flex flex-wrap justify-center items-center gap-3 md:gap-4">
          {partners.map((p, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-5 py-3">
              <Image src={p.icon} alt={p.name} width={22} height={22} className="brightness-0 invert opacity-80" />
              <div className="text-left leading-tight">
                <p className="text-sm font-semibold text-white">{p.name}</p>
                <p className="text-[11px] text-emerald-400/80 font-medium">{p.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
