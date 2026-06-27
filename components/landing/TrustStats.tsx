import Image from 'next/image'

/* Resmi iş ortakları (büyük, ÜSTTE, gerçek renkli logolar) + makul istatistik şeridi.
   Ana sayfada #entegrasyonlar. */
export default function TrustStats({ isEn }: { isEn: boolean }) {
  const stats = isEn
    ? [
        { v: '120+', l: 'Active users' },
        { v: '97%', l: 'Customer satisfaction' },
        { v: '320+', l: 'Ad accounts managed' },
        { v: '6M+', l: 'Total reach' },
      ]
    : [
        { v: '120+', l: 'Aktif kullanıcı' },
        { v: '%97', l: 'Müşteri memnuniyeti' },
        { v: '320+', l: 'Yönetilen reklam hesabı' },
        { v: '6M+', l: 'Toplam erişim' },
      ]

  const partners = [
    { name: 'Meta', sub: isEn ? 'Business Partner' : 'İş Ortağı', icon: '/integration-icons/meta.svg' },
    { name: 'Google', sub: isEn ? 'Partner' : 'İş Ortağı', icon: '/integration-icons/google-ads.svg' },
  ]

  return (
    <section id="entegrasyonlar" className="relative w-full px-6 py-11 md:py-12 border-y border-white/[0.05] bg-white/[0.012]">
      <div className="max-w-5xl mx-auto">
        {/* Resmi iş ortakları — ÜSTTE, büyük */}
        <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-emerald-400/80 text-center mb-6">{isEn ? 'Official partners' : 'Resmi İş Ortaklarımız'}</p>
        <div className="flex flex-wrap justify-center items-stretch gap-4 md:gap-5 mb-10 md:mb-12">
          {partners.map((p, i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl border border-white/[0.1] bg-white/[0.04] px-6 py-4 md:px-8 md:py-5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)]">
              <span className="shrink-0 w-11 h-11 md:w-12 md:h-12 rounded-xl bg-white flex items-center justify-center p-2">
                <Image src={p.icon} alt={p.name} width={36} height={36} className="object-contain" />
              </span>
              <div className="text-left leading-tight">
                <p className="text-lg md:text-xl font-bold text-white">{p.name}</p>
                <p className="text-[13px] md:text-sm text-emerald-400/90 font-medium">{p.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* İstatistikler — altta */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <p className="text-3xl md:text-4xl font-black bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">{s.v}</p>
              <p className="text-[13px] md:text-sm text-gray-400 mt-1.5">{s.l}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
