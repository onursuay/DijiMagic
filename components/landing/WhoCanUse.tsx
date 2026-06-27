/* "Kimler Kullanabilir" — hedef segment kartları. Statik, server-render. */

const ICONS: Record<string, string> = {
  store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v10a1 1 0 001 1h14a1 1 0 001-1V9"/><path d="M3 9h18"/><path d="M9 20v-6h6v6"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h2l2.4 12.4a1 1 0 001 .8h9.7a1 1 0 001-.8L21 7H5.5"/>',
  agency: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M3 13h18"/>',
  rocket: '<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2"/><path d="M9 11a8 8 0 018-8c2 0 3 .5 3 .5s.5 1 .5 3a8 8 0 01-8 8l-3.5 1L8 14.5z"/><circle cx="15" cy="9" r="1.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h0M15 7h0M9 11h0M15 11h0M9 15h0M15 15h0"/><path d="M10 21v-3h4v3"/>',
}
function Icon({ name }: { name: string }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[name] || '' }} />
}

export default function WhoCanUse({ isEn }: { isEn: boolean }) {
  const c = isEn
    ? { eyebrow: 'Who it’s for', title: 'Built for everyone who runs ads' }
    : { eyebrow: 'Kimler Kullanabilir', title: 'Reklam veren herkes için tasarlandı' }

  const items = isEn
    ? [
        { icon: 'store', name: 'Local businesses', desc: 'Reach nearby customers with ease.' },
        { icon: 'cart', name: 'E-commerce brands', desc: 'Scale product sales and boost your ROAS.' },
        { icon: 'agency', name: 'Agencies', desc: 'Manage all client campaigns from one panel.' },
        { icon: 'rocket', name: 'Founders & startups', desc: 'Test fast on a small budget and grow.' },
        { icon: 'user', name: 'Consultants & freelancers', desc: 'Promote your services professionally.' },
        { icon: 'building', name: 'Enterprise brands', desc: 'Run multichannel ads from one hub.' },
      ]
    : [
        { icon: 'store', name: 'Yerel İşletmeler', desc: 'Çevrendeki müşterilere kolayca ulaş.' },
        { icon: 'cart', name: 'E-Ticaret Markaları', desc: 'Ürün satışlarını ölçeklendir, ROAS\'ını artır.' },
        { icon: 'agency', name: 'Ajanslar', desc: 'Tüm müşteri kampanyalarını tek panelden yönet.' },
        { icon: 'rocket', name: 'Girişimciler & Startuplar', desc: 'Düşük bütçeyle hızlı test et, hızlı büyü.' },
        { icon: 'user', name: 'Danışmanlar & Freelancerlar', desc: 'Hizmetlerini profesyonelce duyur.' },
        { icon: 'building', name: 'Kurumsal Markalar', desc: 'Çok kanallı reklamı tek merkezden yönet.' },
      ]

  return (
    <section className="relative w-full px-6 py-8 md:py-10">
      <div className="relative max-w-6xl mx-auto">
        <div className="text-center mb-9 md:mb-11">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-emerald-400/80 mb-2.5">{c.eyebrow}</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{c.title}</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {items.map((it, i) => (
            <div key={i} className="group rounded-2xl border border-white/[0.09] bg-white/[0.045] p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-400/25 hover:bg-white/[0.06] hover:shadow-[0_10px_40px_-14px_rgba(16,185,129,0.2)]">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400/[0.14] to-teal-400/[0.06] border border-emerald-400/20 flex items-center justify-center text-emerald-400 mb-4">
                <Icon name={it.icon} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1.5">{it.name}</h3>
              <p className="text-[15px] text-gray-300/90 leading-relaxed">{it.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
