import Link from 'next/link'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ön Bilgilendirme Formu — DijiMagic',
  description: 'Mesafeli satış öncesi ön bilgilendirme formu.',
}

const SEKME = 'text-[14px] text-[#8a8f98] leading-relaxed'

type Section = { h: string; body: React.ReactNode }

export default async function OnBilgilendirmeFormuPage() {
  const store = await cookies()
  const isEn = store.get('NEXT_LOCALE')?.value === 'en'

  const c = isEn
    ? {
        back: '← Home',
        draft: <><strong>This is a draft.</strong> It must be reviewed and approved by legal counsel before taking effect. The Turkish version of this document is legally binding.</>,
        title: 'Pre-Information Form',
        intro: 'Pursuant to Law No. 6502 on the Protection of Consumers and the Regulation on Distance Contracts.',
        sections: [
          { h: '1. Seller Information', body: <>Title: Story 77 Creative Tasarım Organizasyon Gıda Ticaret Sanayi Ltd. Şti.<br />Brand: DijiMagic (dijimagic.com)<br />Service: DijiMagic — AI-powered digital advertising and marketing management platform<br />Tax No: 7811085924<br />Email: info@dijimagic.com<br />Address: Beytepe Mah. 5360 Sk. No: 2 İç Kapı No: 11, Çankaya / Ankara, Turkey</> },
          { h: '2. Core Characteristics of the Service', body: 'DijiMagic is a subscription-based software service (SaaS) offering Meta and Google ad management, SEO, content/design generation, strategy, optimization, CRM and email marketing modules from a single panel. The service is delivered digitally over the internet; there is no physical delivery.' },
          { h: '3. Subscription Plans and Price', body: <>Plan prices vary by subscription (monthly/yearly) and the number of selected ad accounts; current prices are shown on the <Link href="/fiyatlandirma" className="text-emerald-400 hover:underline">pricing page</Link>. Prices are displayed in US dollars; collection is made in Turkish Lira at the exchange rate at the time of payment. VAT is [included/excluded — to be clarified]. New users benefit from a 7-day free trial during which no charge is made.</> },
          { h: '4. Payment Method', body: 'Payments are collected via the contracted payment institution (iyzico) using a credit/debit card with 3D Secure verification. Card details are not stored on the Seller’s servers.' },
          { h: '5. Right of Withdrawal', body: 'The consumer has the right to withdraw from the contract within 14 days without giving any reason and without penalty, before performance of the service begins. However, pursuant to Article 15 of the Regulation on Distance Contracts, the right of withdrawal cannot be exercised for services performed instantly in electronic form with the consumer’s consent. You can cancel your subscription at any time from the panel to take effect at the end of the period; access continues until the end of the current period after cancellation. [This clause is subject to legal counsel approval.]' },
          { h: '6. Complaints and Disputes', body: 'You may submit your requests and complaints to info@dijimagic.com. In consumer disputes, Consumer Arbitration Committees and Consumer Courts have jurisdiction within the relevant monetary limits.' },
        ],
      }
    : {
        back: '← Ana Sayfa',
        draft: <><strong>Taslak metindir.</strong> Yürürlüğe girmeden önce hukuk danışmanı tarafından gözden geçirilip onaylanmalıdır.</>,
        title: 'Ön Bilgilendirme Formu',
        intro: '6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca.',
        sections: [
          { h: '1. Satıcı Bilgileri', body: <>Unvan: Story 77 Creative Tasarım Organizasyon Gıda Ticaret Sanayi Ltd. Şti.<br />Marka: DijiMagic (dijimagic.com)<br />Hizmet: DijiMagic — yapay zeka destekli dijital reklam ve pazarlama yönetim platformu<br />VKN: 7811085924<br />E-posta: info@dijimagic.com<br />Adres: Beytepe Mah. 5360 Sk. No: 2 İç Kapı No: 11, Çankaya / Ankara</> },
          { h: '2. Hizmetin Temel Nitelikleri', body: 'DijiMagic; Meta ve Google reklam yönetimi, SEO, içerik/tasarım üretimi, strateji, optimizasyon, CRM ve e-posta pazarlama modüllerini tek panelden sunan, abonelik tabanlı bir yazılım hizmetidir (SaaS). Hizmet dijital ortamda, internet üzerinden sunulur; fiziksel teslimat yoktur.' },
          { h: '3. Abonelik Planları ve Bedeli', body: <>Plan bedelleri abonelik (aylık/yıllık) ve seçilen reklam hesabı sayısına göre değişir; güncel fiyatlar <Link href="/fiyatlandirma" className="text-emerald-400 hover:underline">fiyatlandırma sayfasında</Link> gösterilir. Fiyatlar ABD doları üzerinden gösterilir, tahsilat ödeme anındaki kur ile Türk Lirası olarak yapılır. Belirtilen bedellere KDV [dahildir/hariçtir — netleştirilecek]. Yeni kullanıcılar 7 günlük ücretsiz deneme süresinden yararlanır; deneme süresince ücret alınmaz.</> },
          { h: '4. Ödeme Şekli', body: 'Ödemeler, anlaşmalı ödeme kuruluşu (iyzico) altyapısı üzerinden kredi/banka kartı ile 3D Secure doğrulamalı olarak tahsil edilir. Kart bilgileri Satıcı sunucularında saklanmaz.' },
          { h: '5. Cayma Hakkı', body: 'Tüketici, hizmetin ifasına başlanmadan önce 14 gün içinde herhangi bir gerekçe göstermeksizin ve cezai şart ödemeksizin sözleşmeden cayma hakkına sahiptir. Ancak Mesafeli Sözleşmeler Yönetmeliği m.15 uyarınca, tüketicinin onayı ile ifasına başlanan ve elektronik ortamda anında ifa edilen hizmetlere ilişkin cayma hakkı kullanılamaz. Aboneliğinizi dilediğiniz zaman panel üzerinden dönem sonunda sona erecek şekilde iptal edebilirsiniz; iptal sonrası mevcut dönem sonuna kadar erişiminiz devam eder. [Bu madde hukuk danışmanı onayına tabidir.]' },
          { h: '6. Şikâyet ve İtiraz', body: 'Talep ve şikâyetlerinizi info@dijimagic.com adresine iletebilirsiniz. Tüketici uyuşmazlıklarında, ilgili parasal sınırlar dâhilinde Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri yetkilidir.' },
        ],
      }

  return (
    <div className="min-h-screen bg-[#13181f] text-white">
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
