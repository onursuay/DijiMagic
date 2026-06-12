import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ön Bilgilendirme Formu — YoAi',
  description: 'Mesafeli satış öncesi ön bilgilendirme formu.',
}

const SEKME = 'text-[14px] text-[#8a8f98] leading-relaxed'

export default function OnBilgilendirmeFormuPage() {
  return (
    <div className="min-h-screen bg-[#060609] text-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <Link href="/" className="text-emerald-400 hover:text-emerald-300 transition-colors mb-6 inline-block text-sm">
          &larr; Ana Sayfa
        </Link>

        <div className="rounded-xl border border-gray-700 bg-white/[0.03] px-5 py-3 mb-6 text-sm text-gray-300">
          ⚠️ <strong>Taslak metindir.</strong> Yürürlüğe girmeden önce hukuk danışmanı tarafından gözden geçirilip onaylanmalıdır.
        </div>

        <div className="rounded-2xl border border-emerald-400/10 bg-white/[0.02] px-8 py-10">
          <h1 className="text-3xl font-bold mb-2">Ön Bilgilendirme Formu</h1>
          <p className="text-gray-500 mb-8">6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca.</p>

          <div className="space-y-7">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Satıcı Bilgileri</h2>
              <p className={SEKME}>
                Unvan: YO Dijital Medya Anonim Şirketi<br />
                Hizmet: YoAi — yapay zeka destekli dijital reklam ve pazarlama yönetim platformu (yoai.yodijital.com)<br />
                E-posta: info@yodijital.com<br />
                Adres: [Şirket açık adresi — eklenecek]<br />
                MERSİS No: [Eklenecek]
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Hizmetin Temel Nitelikleri</h2>
              <p className={SEKME}>
                YoAi; Meta ve Google reklam yönetimi, SEO, içerik/tasarım üretimi, strateji, optimizasyon, CRM ve e-posta pazarlama modüllerini tek panelden sunan, abonelik tabanlı bir yazılım hizmetidir (SaaS). Hizmet dijital ortamda, internet üzerinden sunulur; fiziksel teslimat yoktur.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Abonelik Planları ve Bedeli</h2>
              <p className={SEKME}>
                Plan bedelleri abonelik (aylık/yıllık) ve seçilen reklam hesabı sayısına göre değişir; güncel fiyatlar <Link href="/fiyatlandirma" className="text-emerald-400 hover:underline">fiyatlandırma sayfasında</Link> gösterilir. Fiyatlar ABD doları üzerinden gösterilir, tahsilat ödeme anındaki kur ile Türk Lirası olarak yapılır. Belirtilen bedellere KDV [dahildir/hariçtir — netleştirilecek]. Yeni kullanıcılar 14 günlük ücretsiz deneme süresinden yararlanır; deneme süresince ücret alınmaz.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Ödeme Şekli</h2>
              <p className={SEKME}>
                Ödemeler, anlaşmalı ödeme kuruluşu (iyzico) altyapısı üzerinden kredi/banka kartı ile 3D Secure doğrulamalı olarak tahsil edilir. Kart bilgileri Satıcı sunucularında saklanmaz.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Cayma Hakkı</h2>
              <p className={SEKME}>
                Tüketici, hizmetin ifasına başlanmadan önce 14 gün içinde herhangi bir gerekçe göstermeksizin ve cezai şart ödemeksizin sözleşmeden cayma hakkına sahiptir. Ancak Mesafeli Sözleşmeler Yönetmeliği m.15 uyarınca, tüketicinin onayı ile ifasına başlanan ve elektronik ortamda anında ifa edilen hizmetlere ilişkin cayma hakkı kullanılamaz. Aboneliğinizi dilediğiniz zaman panel üzerinden dönem sonunda sona erecek şekilde iptal edebilirsiniz; iptal sonrası mevcut dönem sonuna kadar erişiminiz devam eder. [Bu madde hukuk danışmanı onayına tabidir.]
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Şikâyet ve İtiraz</h2>
              <p className={SEKME}>
                Talep ve şikâyetlerinizi info@yodijital.com adresine iletebilirsiniz. Tüketici uyuşmazlıklarında, ilgili parasal sınırlar dâhilinde Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri yetkilidir.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
