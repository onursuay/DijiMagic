/* Kullanıcı yorumları — gerçekçi, SADECE isim-soyisim (marka/şirket adı yok). Statik grid. */

function Stars() {
  return (
    <div className="flex gap-0.5 text-emerald-400" aria-label="5/5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 20.4l1.4-6.8L2.2 9l6.9-.7z" /></svg>
      ))}
    </div>
  )
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

type R = { name: string; title: string; body: string }

const TR: R[] = [
  { name: 'Mehmet Akif Taşpınar', title: 'Süreç çok hızlı', body: 'Reklamlarım gerçekten iyi gidiyor. İsteklerim doğrultusunda hemen düzenleme yapılıyor, süreç hızlı ilerliyor. İlgi ve destekten çok memnunum.' },
  { name: 'Ayşe Yıldız', title: 'Satışlar ikiye katlandı', body: 'Yapay zeka kampanyalarımı benim yerime optimize ediyor; iki ayda satışlarım neredeyse iki katına çıktı.' },
  { name: 'Emre Koç', title: 'Saatlerimi geri aldım', body: 'Eskiden raporlara saatler harcıyordum, artık her şey otomatik. Ben sadece büyümeye odaklanıyorum.' },
  { name: 'Zeynep Arslan', title: 'Ajansa gerek kalmadı', body: 'Yüksek ajans maliyetleri ödemeden, çok daha uygun bütçeyle benzer dönüşümleri tek panelden yakalıyorum.' },
  { name: 'Burak Demir', title: 'Tek tıkla her şey', body: 'Görseli seçiyorum, bütçeyi giriyorum, gerisini DijiMagic yapıyor. Reklam açmak hiç bu kadar kolay olmamıştı.' },
  { name: 'Selin Yılmaz', title: 'Dönüşüm belirgin arttı', body: 'Hedef kitle önerileri çok isabetli; ROAS\'ım ilk aydan itibaren gözle görülür şekilde yükseldi.' },
  { name: 'Kerem Aydın', title: 'Her şey tek panelde', body: 'Meta ve Google reklamlarımı, raporlarımı ve içeriğimi tek yerden yönetmek inanılmaz zaman kazandırıyor.' },
  { name: 'Elif Şahin', title: 'Basit ve anlaşılır', body: 'Teknik bilgim olmadan bile rahatça kullanıyorum. Panel çok sade, her şey elimin altında.' },
  { name: 'Onur Çelik', title: 'Bütçemi boşa harcamıyorum', body: 'Düşük performanslı reklamları otomatik kısıyor, iyi gidenlere bütçe ekliyor. Param artık boşa gitmiyor.' },
]

const EN: R[] = [
  { name: 'Mehmet Akif Taşpınar', title: 'The process is fast', body: 'My ads are running really well. Changes I request happen right away and the whole process moves quickly. Very happy with the care and support.' },
  { name: 'Ayşe Yıldız', title: 'Sales doubled', body: 'The AI optimizes my campaigns for me; in two months my sales nearly doubled.' },
  { name: 'Emre Koç', title: 'Got my hours back', body: 'I used to spend hours on reports — now everything is automated. I just focus on growth.' },
  { name: 'Zeynep Arslan', title: 'No agency needed', body: 'Without paying high agency fees, I capture similar conversions from one panel on a far smaller budget.' },
  { name: 'Burak Demir', title: 'Everything in one click', body: 'I pick the creative, set the budget, and DijiMagic does the rest. Launching ads has never been this easy.' },
  { name: 'Selin Yılmaz', title: 'Conversions clearly up', body: 'The audience suggestions are spot on; my ROAS rose visibly from the first month.' },
  { name: 'Kerem Aydın', title: 'All in one panel', body: 'Managing my Meta and Google ads, reports and content from one place saves incredible time.' },
  { name: 'Elif Şahin', title: 'Simple and clear', body: 'I use it comfortably without any technical background. The panel is clean and everything is at hand.' },
  { name: 'Onur Çelik', title: 'No wasted budget', body: 'It automatically trims low performers and adds budget to the winners. My money no longer goes to waste.' },
]

export default function Testimonials({ isEn }: { isEn: boolean }) {
  const items = isEn ? EN : TR
  const c = isEn
    ? { eyebrow: 'Reviews', title: 'What our users say', sub: 'Real experiences from people using DijiMagic.' }
    : { eyebrow: 'Yorumlar', title: 'Gerçek Kullanıcı Yorumları', sub: 'DijiMagic kullananların deneyimleri.' }

  return (
    <section className="relative w-full px-6 py-10 md:py-12 bg-white/[0.012]">
      <div className="relative max-w-6xl mx-auto">
        <div className="text-center mb-9 md:mb-11">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-emerald-400/80 mb-2.5">{c.eyebrow}</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{c.title}</h2>
          <p className="text-base text-gray-400 mt-3 max-w-xl mx-auto leading-relaxed">{c.sub}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {items.map((r, i) => (
            <div key={i} className="flex flex-col rounded-2xl border border-white/[0.09] bg-white/[0.045] p-6">
              <Stars />
              <h3 className="text-base font-semibold text-white mt-3 mb-2">{r.title}</h3>
              <p className="text-[14.5px] text-gray-300/90 leading-relaxed flex-1">{r.body}</p>
              <div className="flex items-center gap-3 mt-5 pt-4 border-t border-white/[0.06]">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400/25 to-teal-400/15 border border-emerald-400/25 flex items-center justify-center text-[12px] font-bold text-emerald-300">{initials(r.name)}</div>
                <span className="text-sm font-medium text-white/90">{r.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
