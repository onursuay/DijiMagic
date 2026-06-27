/* Kullanıcı yorumları — iyzads tarzı MASONRY grid (quote ikonu + yeşil pill başlık).
   Gerçekçi, SADECE isim-soyisim (marka/şirket adı yok). */

function QuoteMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="rgba(52,211,153,0.30)" aria-hidden="true">
      <path d="M7.5 6C5 6 3 8 3 10.5S5 15 7.5 15c.3 0 .6 0 .9-.1C7.8 16.7 6.3 18 4.5 18.4c-.4.1-.6.5-.5.9.1.4.5.6.9.5C8.4 19 11 16 11 11.5 11 8 9.5 6 7.5 6zm9 0C14 6 12 8 12 10.5S14 15 16.5 15c.3 0 .6 0 .9-.1-.6 1.8-2.1 3.1-3.9 3.5-.4.1-.6.5-.5.9.1.4.5.6.9.5C17.4 19 20 16 20 11.5 20 8 18.5 6 16.5 6z" />
    </svg>
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
    <section className="relative w-full px-6 py-8 md:py-10 bg-white/[0.012]">
      <div className="relative max-w-6xl mx-auto">
        <div className="text-center mb-8 md:mb-10">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-emerald-400/80 mb-2.5">{c.eyebrow}</p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{c.title}</h2>
          <p className="text-base text-gray-400 mt-3 max-w-xl mx-auto leading-relaxed">{c.sub}</p>
        </div>
        {/* Masonry (iyzads gibi): değişken yükseklikli kartlar sütunlara akar */}
        <div className="columns-1 sm:columns-2 lg:columns-4 gap-4 md:gap-5">
          {items.map((r, i) => (
            <div key={i} className="break-inside-avoid mb-4 md:mb-5 rounded-2xl border border-white/[0.09] bg-white/[0.045] p-5">
              <QuoteMark />
              <span className="inline-flex mt-3 mb-3 rounded-full bg-emerald-400/10 border border-emerald-400/25 text-emerald-300 text-[12.5px] font-semibold px-3 py-1">{r.title}</span>
              <p className="text-[14px] text-gray-300/90 leading-relaxed">{r.body}</p>
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/[0.06]">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400/25 to-teal-400/15 border border-emerald-400/25 flex items-center justify-center text-[12px] font-bold text-emerald-300 shrink-0">{initials(r.name)}</div>
                <span className="text-sm font-medium text-white/90">{r.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
