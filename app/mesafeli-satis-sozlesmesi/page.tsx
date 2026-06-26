import Link from 'next/link'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mesafeli Satış Sözleşmesi — DijiMagic',
  description: 'DijiMagic abonelik hizmeti mesafeli satış sözleşmesi.',
}

const SEKME = 'text-[14px] text-[#8a8f98] leading-relaxed'
type Section = { h: string; body: React.ReactNode }

export default async function MesafeliSatisSozlesmesiPage() {
  const store = await cookies()
  const isEn = store.get('NEXT_LOCALE')?.value === 'en'

  const c = isEn
    ? {
        back: '← Home',
        draft: <><strong>This is a draft.</strong> It must be reviewed and approved by legal counsel before taking effect. The Turkish version of this document is legally binding.</>,
        title: 'Distance Sales Agreement',
        intro: 'Drawn up pursuant to Law No. 6502 and the Regulation on Distance Contracts.',
        sections: [
          { h: '1. Parties', body: <><strong>Seller:</strong> Story 77 Creative Tasarım Organizasyon Gıda Ticaret Sanayi Ltd. Şti. (operator of the “DijiMagic” brand), Tax No: 7811085924, Beytepe Mah. 5360 Sk. No: 2 İç Kapı No: 11, Çankaya / Ankara, Turkey. info@dijimagic.com, dijimagic.com.<br /><strong>Buyer (Consumer):</strong> The natural/legal person who subscribes to the service and creates an account. The Buyer’s details are those provided during registration and payment.</> },
          { h: '2. Subject of the Agreement', body: 'The subject of this agreement is to determine the rights and obligations of the parties regarding the provision of the DijiMagic subscription service ordered electronically by the Buyer via dijimagic.com, the characteristics and sale price of which are stated below. The Pre-Information Form is an integral part of this agreement.' },
          { h: '3. Service and Price', body: 'The service is subscription-based access to the DijiMagic software platform. The selected plan, subscription period (monthly/yearly), number of ad accounts and total price are shown on the payment screen and order summary. The price is collected in Turkish Lira at the prevailing exchange rate at the time of payment.' },
          { h: '4. Payment and Performance', body: 'Payment is collected via the iyzico payment infrastructure from a credit/debit card with 3D Secure. Upon approval of the payment, service access is provided immediately in electronic form. No charge is made during the 7-day free trial.' },
          { h: '5. Right of Withdrawal and Its Exception', body: 'The Buyer has the right to withdraw within 14 days without giving a reason. However, pursuant to Article 15/(ğ) of the Regulation, the right of withdrawal cannot be exercised for services performed instantly in electronic form with the consumer’s consent. The Buyer acknowledges that the service is an instantly performed digital service and consents to performance beginning upon payment. The subscription can be cancelled at any time from the panel to take effect at the end of the period. [Subject to legal counsel approval.]' },
          { h: '6. Renewal and Cancellation', body: 'The subscription is valid for the selected period. Automatic renewal takes effect only with the Buyer’s explicit consent; otherwise access ends at the end of the period. The Buyer can cancel the subscription from the panel at any time.' },
          { h: '7. Resolution of Disputes', body: 'For disputes arising from this agreement, Consumer Arbitration Committees and Consumer Courts have jurisdiction within the monetary limits announced by the Ministry of Trade.' },
          { h: '8. Entry into Force', body: 'By checking the box on the payment screen, the Buyer declares that they have read, understood and accepted all provisions of this agreement and the Pre-Information Form. The agreement enters into force upon completion of the order.' },
        ],
      }
    : {
        back: '← Ana Sayfa',
        draft: <><strong>Taslak metindir.</strong> Yürürlüğe girmeden önce hukuk danışmanı tarafından gözden geçirilip onaylanmalıdır.</>,
        title: 'Mesafeli Satış Sözleşmesi',
        intro: '6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca düzenlenmiştir.',
        sections: [
          { h: '1. Taraflar', body: <><strong>Satıcı:</strong> Story 77 Creative Tasarım Organizasyon Gıda Ticaret Sanayi Ltd. Şti. (“DijiMagic” markasının işletmecisi), VKN: 7811085924, Beytepe Mah. 5360 Sk. No: 2 İç Kapı No: 11, Çankaya / Ankara. info@dijimagic.com, dijimagic.com.<br /><strong>Alıcı (Tüketici):</strong> Hizmete abone olan ve hesap oluşturan gerçek/tüzel kişi. Alıcının bilgileri kayıt ve ödeme sırasında verdiği bilgilerdir.</> },
          { h: '2. Sözleşmenin Konusu', body: 'İşbu sözleşmenin konusu, Alıcının dijimagic.com üzerinden elektronik ortamda siparişini verdiği, nitelikleri ve satış bedeli aşağıda belirtilen DijiMagic abonelik hizmetinin sunulmasına ilişkin tarafların hak ve yükümlülüklerinin belirlenmesidir. Ön Bilgilendirme Formu bu sözleşmenin ayrılmaz parçasıdır.' },
          { h: '3. Hizmet ve Bedel', body: 'Hizmet, DijiMagic yazılım platformuna abonelik tabanlı erişimdir. Seçilen plan, abonelik dönemi (aylık/yıllık), reklam hesabı sayısı ve toplam bedel ödeme ekranında ve sipariş özetinde gösterilir. Bedel, ödeme anında yürürlükteki kur ile Türk Lirası olarak tahsil edilir.' },
          { h: '4. Ödeme ve İfa', body: 'Ödeme, iyzico ödeme altyapısı ile kredi/banka kartından 3D Secure ile tahsil edilir. Ödemenin onaylanmasının ardından hizmet erişimi elektronik ortamda derhal sağlanır. 7 günlük ücretsiz deneme süresince ücret tahsil edilmez.' },
          { h: '5. Cayma Hakkı ve İstisnası', body: 'Alıcı, 14 gün içinde gerekçe göstermeksizin cayma hakkına sahiptir. Ancak Yönetmelik m.15/(ğ) uyarınca, tüketicinin onayı ile ifasına başlanan ve elektronik ortamda anında ifa edilen hizmetler bakımından cayma hakkı kullanılamaz. Alıcı, hizmetin anında ifa edilen dijital bir hizmet olduğunu ve ödemeyle birlikte ifaya başlanmasına onay verdiğini kabul eder. Abonelik, panel üzerinden dönem sonunda sona erecek şekilde her zaman iptal edilebilir. [Madde hukuk danışmanı onayına tabidir.]' },
          { h: '6. Yenileme ve İptal', body: 'Abonelik, seçilen dönem boyunca geçerlidir. Otomatik yenileme yalnızca Alıcının açık onayı ile devreye girer; aksi halde dönem sonunda erişim sona erer. Alıcı aboneliğini istediği zaman panelden iptal edebilir.' },
          { h: '7. Uyuşmazlıkların Çözümü', body: 'İşbu sözleşmeden doğan uyuşmazlıklarda, Ticaret Bakanlığınca ilan edilen parasal sınırlar dâhilinde Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri yetkilidir.' },
          { h: '8. Yürürlük', body: 'Alıcı, ödeme ekranındaki onay kutusunu işaretleyerek işbu sözleşmenin ve Ön Bilgilendirme Formunun tüm hükümlerini okuduğunu, anladığını ve kabul ettiğini beyan eder. Sözleşme, siparişin tamamlanmasıyla yürürlüğe girer.' },
        ],
      }

  return (
    <div className="min-h-screen bg-[#161d28] text-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <Link href="/" className="text-emerald-400 hover:text-emerald-300 transition-colors mb-6 inline-block text-sm">{c.back}</Link>
        <div className="rounded-xl border border-gray-700 bg-white/[0.03] px-5 py-3 mb-6 text-sm text-gray-300">⚠️ {c.draft}</div>
        <div className="rounded-2xl border border-emerald-400/10 bg-white/[0.02] px-8 py-10">
          <h1 className="text-3xl font-bold mb-2">{c.title}</h1>
          <p className="text-gray-500 mb-8">{c.intro}</p>
          <div className="space-y-7">
            {c.sections.map((s: Section, i: number) => (
              <section key={i}>
                <h2 className="text-xl font-semibold mb-3">{s.h}</h2>
                <p className={SEKME}>{s.body}</p>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
