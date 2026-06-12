import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mesafeli Satış Sözleşmesi — YoAi',
  description: 'YoAi abonelik hizmeti mesafeli satış sözleşmesi.',
}

const SEKME = 'text-[14px] text-[#8a8f98] leading-relaxed'

export default function MesafeliSatisSozlesmesiPage() {
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
          <h1 className="text-3xl font-bold mb-2">Mesafeli Satış Sözleşmesi</h1>
          <p className="text-gray-500 mb-8">6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca düzenlenmiştir.</p>

          <div className="space-y-7">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Taraflar</h2>
              <p className={SEKME}>
                <strong>Satıcı:</strong> YO Dijital Medya Anonim Şirketi (info@yodijital.com, yoai.yodijital.com).<br />
                <strong>Alıcı (Tüketici):</strong> Hizmete abone olan ve hesap oluşturan gerçek/tüzel kişi. Alıcının bilgileri kayıt ve ödeme sırasında verdiği bilgilerdir.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Sözleşmenin Konusu</h2>
              <p className={SEKME}>
                İşbu sözleşmenin konusu, Alıcının yoai.yodijital.com üzerinden elektronik ortamda siparişini verdiği, nitelikleri ve satış bedeli aşağıda belirtilen YoAi abonelik hizmetinin sunulmasına ilişkin tarafların hak ve yükümlülüklerinin belirlenmesidir. Ön Bilgilendirme Formu bu sözleşmenin ayrılmaz parçasıdır.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Hizmet ve Bedel</h2>
              <p className={SEKME}>
                Hizmet, YoAi yazılım platformuna abonelik tabanlı erişimdir. Seçilen plan, abonelik dönemi (aylık/yıllık), reklam hesabı sayısı ve toplam bedel ödeme ekranında ve sipariş özetinde gösterilir. Bedel, ödeme anında yürürlükteki kur ile Türk Lirası olarak tahsil edilir.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Ödeme ve İfa</h2>
              <p className={SEKME}>
                Ödeme, iyzico ödeme altyapısı ile kredi/banka kartından 3D Secure ile tahsil edilir. Ödemenin onaylanmasının ardından hizmet erişimi elektronik ortamda derhal sağlanır. 14 günlük ücretsiz deneme süresince ücret tahsil edilmez.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Cayma Hakkı ve İstisnası</h2>
              <p className={SEKME}>
                Alıcı, 14 gün içinde gerekçe göstermeksizin cayma hakkına sahiptir. Ancak Yönetmelik m.15/(ğ) uyarınca, tüketicinin onayı ile ifasına başlanan ve elektronik ortamda anında ifa edilen hizmetler bakımından cayma hakkı kullanılamaz. Alıcı, hizmetin anında ifa edilen dijital bir hizmet olduğunu ve ödemeyle birlikte ifaya başlanmasına onay verdiğini kabul eder. Abonelik, panel üzerinden dönem sonunda sona erecek şekilde her zaman iptal edilebilir. [Madde hukuk danışmanı onayına tabidir.]
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Yenileme ve İptal</h2>
              <p className={SEKME}>
                Abonelik, seçilen dönem boyunca geçerlidir. Otomatik yenileme yalnızca Alıcının açık onayı ile devreye girer; aksi halde dönem sonunda erişim sona erer. Alıcı aboneliğini istediği zaman panelden iptal edebilir.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Uyuşmazlıkların Çözümü</h2>
              <p className={SEKME}>
                İşbu sözleşmeden doğan uyuşmazlıklarda, Ticaret Bakanlığınca ilan edilen parasal sınırlar dâhilinde Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri yetkilidir.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Yürürlük</h2>
              <p className={SEKME}>
                Alıcı, ödeme ekranındaki onay kutusunu işaretleyerek işbu sözleşmenin ve Ön Bilgilendirme Formunun tüm hükümlerini okuduğunu, anladığını ve kabul ettiğini beyan eder. Sözleşme, siparişin tamamlanmasıyla yürürlüğe girer.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
