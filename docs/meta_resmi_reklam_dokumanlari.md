# Meta Resmi Reklam Dokümanları

> Bu dosya `/Users/onursuay/Desktop/Onur Suay/Onur Şuay/Sponsorlu/Meta ve Google Ads Resmi Dökümanları/Meta_Ads_2026_Tum_Paket/` altındaki resmi Meta Ads eğitim dokümanlarından konsolide edilmiştir.
> Son güncelleme: 2026-05-20
> Kaynak dosyalar:
> - Meta_Ads_2026_Egitim_Dokumani.pdf (Temel/Orta seviye, 9 sayfa)
> - Meta_Ads_2026_Ileri_Seviye_Muhendislik_Egitimi_GENIS.pdf (İleri seviye, 21 sayfa)
> - Kaynak_Listesi.pdf + Kaynak_Listesi_*.txt (kaynakça)

## İçindekiler

- [Bölüm: Temel / Orta Seviye](#bölüm-temel--orta-seviye)
  - [1. Yönetici Özeti](#1-yönetici-özeti)
  - [2. Meta Ads Hiyerarşisi Nasıl Çalışır?](#2-meta-ads-hiyerarşisi-nasıl-çalışır)
  - [3. 2026 Kampanya Amaçları ve Ne İçin Kullanılır?](#3-2026-kampanya-amaçları-ve-ne-için-kullanılır)
  - [4. Amaç Bazlı Optimum Kurulum Rehberi](#4-amaç-bazlı-optimum-kurulum-rehberi)
  - [5. Reklam Seti Ayarları: Optimum Seviye](#5-reklam-seti-ayarları-optimum-seviye)
  - [6. Bütçe Stratejisi](#6-bütçe-stratejisi)
  - [7. Yerleşimler ve Kreatif Uyumu](#7-yerleşimler-ve-kreatif-uyumu)
  - [8. Reklam Seviyesi: Kreatif, Metin ve CTA](#8-reklam-seviyesi-kreatif-metin-ve-cta)
  - [9. Pixel, CAPI ve Ölçüm Altyapısı](#9-pixel-capi-ve-ölçüm-altyapısı)
  - [10. Kampanya Modeli Seçim Matrisi](#10-kampanya-modeli-seçim-matrisi)
  - [11. Ajans İçin Net Kurulum Standartları](#11-ajans-için-net-kurulum-standartları)
  - [12. Sektöre Göre Kısa Reçeteler](#12-sektöre-göre-kısa-reçeteler)
  - [13. Yayına Alma Öncesi Kontrol Listesi](#13-yayına-alma-öncesi-kontrol-listesi)
  - [14. Optimizasyon ve Müdahale Kuralları](#14-optimizasyon-ve-müdahale-kuralları)
  - [15. Sık Yapılan Hatalar](#15-sık-yapılan-hatalar)
  - [16. Örnek Kampanya Şablonları](#16-örnek-kampanya-şablonları)
  - [17. Kaynakça (Temel Doküman)](#17-kaynakça-temel-doküman)
  - [18. Sonuç](#18-sonuç)
- [Bölüm: İleri Seviye Mühendislik](#bölüm-i̇leri-seviye-mühendislik)
  - [Kullanım Notu](#kullanım-notu)
  - [Meta Ads Sistem Mantığı](#meta-ads-sistem-mantığı)
  - [Hiyerarşi: Campaign / Ad Set / Ad](#hiyerarşi-campaign--ad-set--ad)
  - [2026 Kampanya Amaçları: Ne İçin Kullanılır, Ne İçin Kullanılmaz](#2026-kampanya-amaçları-ne-için-kullanılır-ne-için-kullanılmaz)
  - [Objective Seçim Karar Ağacı](#objective-seçim-karar-ağacı)
  - [Reklam Seti Mühendisliği](#reklam-seti-mühendisliği)
  - [Hedefleme: 2026 Gerçeği](#hedefleme-2026-gerçeği)
  - [Bütçe ve Teklif Stratejileri](#bütçe-ve-teklif-stratejileri)
  - [Learning Phase ve Delivery Disiplini](#learning-phase-ve-delivery-disiplini)
  - [Pixel, CAPI, Dataset ve Event Mimarisi](#pixel-capi-dataset-ve-event-mimarisi-ileri)
  - [E-ticaret / Sales Kampanyaları](#e-ticaret--sales-kampanyaları)
  - [Lead Generation Mühendisliği](#lead-generation-mühendisliği)
  - [Kreatif Mühendisliği](#kreatif-mühendisliği)
  - [Raporlama, Attribution ve Gerçek Performans Okuma](#raporlama-attribution-ve-gerçek-performans-okuma)
  - [Troubleshooting Karar Ağacı](#troubleshooting-karar-ağacı)
  - [Ajans Operasyon Standardı: Kurulumdan Optimizasyona SOP](#ajans-operasyon-standardı-kurulumdan-optimizasyona-sop)
  - [Optimum Yapı Şablonları](#optimum-yapı-şablonları)
  - [Mühendislik Kontrol Listeleri](#mühendislik-kontrol-listeleri)
  - [İleri Seviye Notlar](#ileri-seviye-notlar)
  - [BÖLÜM 2 - İleri Seviye Meta Ads Mühendislik Referans Kitabı](#bölüm-2---ileri-seviye-meta-ads-mühendislik-referans-kitabı)
    - [1. Meta Ads Auction ve Delivery Motoru](#1-meta-ads-auction-ve-delivery-motoru)
    - [2. Hesap Altyapısı ve Business Manager Güvenliği](#2-hesap-altyapısı-ve-business-manager-güvenliği)
    - [3. Objective Mühendisliği: Yanlış Objective Seçiminin Maliyeti](#3-objective-mühendisliği-yanlış-objective-seçiminin-maliyeti)
    - [4. Kampanya Mimarisi Tasarım Desenleri](#4-kampanya-mimarisi-tasarım-desenleri)
    - [5. Reklam Seti Ayarları: En İnce Teknik Mantık](#5-reklam-seti-ayarları-en-ince-teknik-mantık)
    - [6. Audience Mühendisliği ve Segmentasyon](#6-audience-mühendisliği-ve-segmentasyon)
    - [7. Bütçe, Ölçekleme ve Kârlılık Matematiği](#7-bütçe-ölçekleme-ve-kârlılık-matematiği)
    - [8. Pixel + CAPI Teknik Kurulum Şeması](#8-pixel--capi-teknik-kurulum-şeması)
    - [9. CAPI Deduplication Hata Rehberi](#9-capi-deduplication-hata-rehberi)
    - [10. Landing Page ve Funnel Mühendisliği](#10-landing-page-ve-funnel-mühendisliği)
    - [11. Kreatif Test Sistemi: Angle, Hook, Format, Offer](#11-kreatif-test-sistemi-angle-hook-format-offer)
    - [12. Sector Playbook](#12-sector-playbook)
    - [13. Remarketing ve Incrementality](#13-remarketing-ve-incrementality)
    - [14. A/B Test ve Experiment Disiplini](#14-ab-test-ve-experiment-disiplini)
    - [15. Policy, Review ve Hesap Riski](#15-policy-review-ve-hesap-riski)
    - [16. Naming Convention ve Veri Modeli](#16-naming-convention-ve-veri-modeli)
    - [17. Günlük, Haftalık, Aylık Operasyon Ritimleri](#17-günlük-haftalık-aylık-operasyon-ritimleri)
    - [18. Advanced Troubleshooting Playbooks](#18-advanced-troubleshooting-playbooks)
    - [19. Meta Ads Engineer Karar Matrisi](#19-meta-ads-engineer-karar-matrisi)
    - [20. Final Uygulama Standardı](#20-final-uygulama-standardı)
- [Kaynakça](#kaynakça)

---

# Bölüm: Temel / Orta Seviye

**META ADS 2026 EĞİTİM DOKÜMANI**
*Kampanya - Reklam Seti - Reklam Yapısı, Amaçlar, Optimum Kurulum ve Ajans Kontrol Listeleri*

Hazırlanma tarihi: 19 Mayıs 2026 | Dil: Türkçe | Kaynak yaklaşımı: Meta Business Help resmi dokümanları ana referans alınmıştır.

## 1. Yönetici Özeti

Meta Ads 2026 yapısında reklam performansının ana belirleyicisi kampanya amacının doğru seçilmesi, sinyal altyapısının temiz kurulması, reklam seti seviyesinde gereksiz parçalanmanın azaltılması ve kreatif üretimin sürekli test edilmesidir. Sistem kampanya amacına göre teslimat yapar; bu yüzden satış beklenen bir işte Traffic kampanyası açmak stratejik hatadır. Traffic, satış değil trafik optimizasyonudur.

- **Kampanya seviyesi:** İş hedefini ve ana optimizasyon yönünü belirler.
- **Reklam seti seviyesi:** Kitle, konum, bütçe, zamanlama, yerleşim ve dönüşüm konumunu yönetir.
- **Reklam seviyesi:** Kreatif, başlık, açıklama, CTA, URL, form veya mesaj deneyimini taşır.
- **2026 optimum yaklaşım:** Daha sade hesap yapısı, geniş kitle, Advantage+ placements, doğru Pixel/CAPI, yeterli bütçe ve kreatif varyasyon disiplini.
- **Yanlış yaklaşım:** Her ilgi alanı için ayrı reklam seti, çok düşük bütçe, sık düzenleme, satış hedefinde Traffic kullanmak, kreatif üretmeden hedefleme ile mucize beklemek.

## 2. Meta Ads Hiyerarşisi Nasıl Çalışır?

| Seviye | Ne işe yarar? | Yanlış yapılırsa ne olur? |
|--------|---------------|----------------------------|
| Kampanya | Amaç, satın alma tipi, kampanya bütçesi ve strateji çerçevesi. | Algoritma yanlış sonuca optimize eder. Satış yerine tıklama, lead yerine etkileşim gelebilir. |
| Reklam seti | Kitle, lokasyon, yaş, cinsiyet, yerleşim, bütçe/zamanlama, optimizasyon olayı. | Öğrenme bölünür, bütçe yetersiz kalır, sonuç maliyeti artar. |
| Reklam | Görsel/video, metin, başlık, açıklama, CTA, URL/form/mesaj. | CTR düşer, kalite zayıflar, doğru kitleye bile satış yaptıramaz. |

Resmi Meta akışı kampanya oluştururken önce kampanya, sonra reklam seti, sonra reklam seviyesini yapılandırır. Teslimat sorunlarının önemli kısmı bu üç seviyenin birbiriyle çelişmesinden doğar.

## 3. 2026 Kampanya Amaçları ve Ne İçin Kullanılır?

Meta ODAX yapısında kampanya amaçları altı ana başlıkta ele alınır: Awareness, Traffic, Engagement, Leads, App promotion ve Sales. Amaç seçimi, sistemin hangi kullanıcı davranışını değerli sayacağını belirler.

| Amaç | Ne için kullanılır? | Ne zaman seçilmez? | Ajans yorumu |
|------|----------------------|---------------------|---------------|
| **Awareness** | Marka bilinirliği, erişim, hatırlanma, video görünürlüğü, üst funnel iletişim. | Satış, lead veya ölçülebilir dönüşüm bekleniyorsa ana kampanya olarak seçilmez. | Lansman, lokal duyuru, marka baskısı için mantıklı; performans kampanyası değildir. |
| **Traffic** | Web sitesi, uygulama veya mesaj alanına ziyaretçi göndermek. | Satın alma, form, rezervasyon gibi dönüşüm hedefleniyorsa tek başına doğru seçim değildir. | Ucuz tıklama getirir ama kaliteli müşteri garantisi vermez. |
| **Engagement** | Gönderi etkileşimi, video izlenmesi, mesaj başlatma, sayfa/Instagram etkileşimi. | Satış veya yüksek niyetli lead hedefinde ana amaç olmamalı. | Sosyal kanıt, mesaj hacmi veya içerik büyütme için kullanılabilir. |
| **Leads** | Instant form, web form, mesaj veya arama gibi lead toplama aksiyonları. | E-ticarette satın alma ana hedefse Sales daha doğru olur. | Hizmet, B2B, randevu, teklif, eğitim, sağlık/güzellik gibi alanlarda ana modeldir. |
| **App promotion** | Uygulama yükleme, uygulama içi aksiyon ve yeniden etkileşim. | Web satış veya klasik lead akışında kullanılmaz. | SDK/event altyapısı olmadan güçlü çalışmaz. |
| **Sales** | Web/app/mağaza/omnichannel satın alma, katalog satışları, rezervasyon, ödeme aksiyonları. | Sadece trafik veya marka görünürlüğü isteniyorsa maliyetli olabilir. | E-ticaret, bilet, rezervasyon, üyelik ve ödeme odaklı işlerde ana amaçtır. |

## 4. Amaç Bazlı Optimum Kurulum Rehberi

### Awareness
- **KPI:** reach, impressions, frequency, video thruplay/izlenme, marka arama hacmi.
- **Kitle:** mümkün olduğunca geniş; lokal işletmede şehir/ilçe net olmalı.
- **Bütçe:** erişim anlamlı olacak kadar; çok düşük bütçe frekansı ve veri kalitesini bozar.
- **Kreatif:** güçlü ilk 2 saniye, marka görünürlüğü, kısa mesaj, dikey video.
- **Not:** Satış kampanyası gibi değerlendirilmez; CPA beklentisiyle optimize edilmez.

### Traffic
- **KPI:** landing page views, outbound clicks, CTR, CPC, oturum kalitesi.
- **Optimizasyon:** mümkünse link click yerine landing page view daha anlamlıdır.
- **Kitle:** geniş veya sıcak kitleye yönlendirici olarak kullanılabilir.
- **Risk:** Trafik kampanyası ucuz ama düşük niyetli kullanıcı toplayabilir.
- **Kullanım:** blog, kampanya sayfası, ön bilgilendirme, yeniden pazarlama havuzu büyütme.

### Engagement
- **KPI:** mesaj, etkileşim, video izlenme, profil aksiyonu.
- Mesaj kampanyasında operasyon kapasitesi net olmalı; cevaplanmayan mesaj bütçeyi yakar.
- Sosyal kanıt toplamak için ayrı kullanılabilir.
- Satış hunisine destek olur ama satışın yerine geçmez.
- **Kreatif:** soru soran, yorum tetikleyen, kısa ve net CTA kullanan yapı.

### Leads
- **KPI:** cost per lead, qualified lead rate, form completion rate, CRM dönüşüm oranı.
- Instant Form hızlı lead getirir; kalite için form soruları ve CRM takip şarttır.
- Web lead seçilirse Pixel/CAPI event kalitesi kritik olur.
- **Kitle:** Advantage+ Audience + güçlü negatif/CRM takibi; çok daraltma genelde maliyeti artırır.
- Lead kalitesi düşükse amaç değil, teklif/form/kreatif/CRM problemi aranmalı.

### App promotion
- **KPI:** install, app event, ROAS, retention, registration, subscription.
- SDK ve app events doğru kurulmadan ölçeklenmez.
- iOS ölçüm kısıtları nedeniyle olay öncelikleri ve veri kaybı hesaba katılmalı.
- **Kreatif:** kullanım senaryosu, hızlı fayda, store güven unsuru.
- Yeniden etkileşim kampanyaları install kampanyalarından ayrı okunmalı.

### Sales
- **KPI:** purchase, ROAS, CPA, conversion value, add to cart, checkout initiated.
- Pixel + CAPI şart gibi düşünülmeli; sadece pixel ile eksik ölçüm olabilir.
- Katalog varsa Advantage+ catalog/product set mantığı değerlendirilmeli.
- Geniş kitle ve Advantage+ placements çoğu hesapta daha iyi öğrenme sağlar.
- Satış hedefinde Traffic değil Sales kullanılmalı; bu konuda netim.

## 5. Reklam Seti Ayarları: Optimum Seviye

| Ayar | Optimum öneri | Dikkat |
|------|----------------|--------|
| **Bütçe** | Yeterli sinyal toplayacak bütçe. Günlük bütçe, hedef CPA değerinin çok altında kalmamalı. | Çok düşük bütçe öğrenmeyi yavaşlatır ve algoritmayı kararsız bırakır. |
| **Kitle** | Geniş kitle / Advantage+ Audience ilk tercih. Net regülasyon veya lokal zorunluluk yoksa aşırı daraltma yapılmaz. | İlgi alanı mikro-parçalama 2026 yapısında çoğu hesapta verimsizdir. |
| **Konum** | İş modelinin gerçekten hizmet verdiği bölge. Turizm/bilet gibi işlerde yön net kurulmalı. | Yanlış ülke/şehir hedefleme bütçeyi boşa yakar. |
| **Yaş/cinsiyet** | Sadece iş modeli gerektiriyorsa daraltılır. | Gereksiz demografik kısıt algoritmanın fırsat alanını daraltır. |
| **Yerleşimler** | Advantage+ Placements varsayılan öneri. | Manuel placement yalnızca marka güvenliği, kreatif uyumsuzluğu veya net veri varsa. |
| **Optimizasyon olayı** | Hedef aksiyona en yakın event: Purchase, Lead, CompleteRegistration vb. | Event hacmi çok düşükse ara event geçici kullanılabilir ama nihai hedef unutulmaz. |
| **Zamanlama** | Kampanya en az birkaç gün stabil izlenmeli. | Sık aç/kapat öğrenmeyi bozar. |
| **Attribution** | İş modeline uygun okunmalı; kısa karar döngüsünde kısa pencere, pahalı ürünlerde daha uzun değerlendirme. | Attribution satışın gerçekliğini değil, raporlama modelini etkiler. |

## 6. Bütçe Stratejisi

Meta Advantage+ campaign budget, tek bir kampanya bütçesini reklam setleri arasında fırsata göre dağıtmak için tasarlanmıştır. Kampanya içinde benzer hedefe giden reklam setleri varsa çoğu senaryoda kampanya bütçesi daha temizdir. Reklam seti bütçesi ise belirli kitlelere zorunlu bütçe ayırmak, test kurgusunu eşit dağıtmak veya farklı teklif stratejileri kullanmak gerekiyorsa tercih edilir.

| Senaryo | Bütçe modeli | Net karar |
|---------|---------------|------------|
| Aynı hedefe çalışan 2-5 reklam seti | Advantage+ campaign budget | Meta bütçeyi en iyi fırsata dağıtsın. |
| Her kitleye eşit test zorunlu | Ad set budget | Test disiplini için manuel kontrol gerekir. |
| Çok küçük bütçe | Daha az reklam seti + kampanya bütçesi | Bütçeyi parçalama. |
| Farklı ülke/segment zorunlu ayrım | Ayrı kampanya veya ad set budget | Raporlama ve bütçe kontrolü için ayrıştır. |

## 7. Yerleşimler ve Kreatif Uyumu

Advantage+ placements, Meta'nın Facebook, Instagram, Messenger, Threads ve Audience Network gibi alanlarda en maliyet etkin fırsatları bulmasına izin verir. Bu ayarın çalışması için kreatiflerin placement uyumlu hazırlanması gerekir: 9:16 Reels/Stories, 1:1 feed, 4:5 feed ve kısa video varyasyonları ayrı düşünülmelidir.

| Format | Açıklama |
|--------|----------|
| **9:16 dikey video** | Reels ve Stories için ana format. |
| **4:5 görsel/video** | feed alanında daha fazla ekran alanı kaplar. |
| **1:1 kare** | genel uyumluluk sağlar ama her zaman en agresif format değildir. |

- Metinde ilk satır kritik; uzun metin çoğu placementta kesilir.
- CTA, teklif ve güven unsuru kreatifte açık olmalı.

## 8. Reklam Seviyesi: Kreatif, Metin ve CTA

| Bileşen | Doğru yaklaşım | Hatalı yaklaşım |
|---------|-----------------|------------------|
| **Primary text** | İlk cümlede teklif/fayda/acı nokta net. | Uzun, genel, kurumsal ama satışsız metin. |
| **Headline** | Kısa, aksiyonlu, teklif odaklı. | Marka sloganı ile boşa kullanılan başlık. |
| **Description** | Ek güven veya detay. | Başlıkla aynı metni tekrar etmek. |
| **CTA** | Hedef aksiyona birebir uygun: Shop Now, Learn More, Sign Up, Send Message. | Sırf estetik diye yanlış CTA kullanmak. |
| **URL/Form/Mesaj** | Hızlı açılan, mobil uyumlu, aynı vaatle devam eden deneyim. | Reklam vaadi ile sayfa/form uyumsuzluğu. |

## 9. Pixel, CAPI ve Ölçüm Altyapısı

2026'da Meta performans reklamcılığında veri sinyali kritik seviyededir. Pixel tarayıcı sinyali sağlar; Conversions API sunucu taraflı sinyal gönderir. En sağlıklı yapı Pixel + CAPI birlikte çalışan, deduplication doğru kurulu, event isimleri standart ve satın alma/lead değerleri temiz iletilen yapıdır.

- Purchase, Lead, CompleteRegistration, AddToCart, InitiateCheckout gibi eventler doğru yerde tetiklenmeli.
- Duplicate event problemi varsa raporlama şişer; event_id ile deduplication gerekir.
- Satış kampanyasında value ve currency doğru gönderilmeli.
- Lead kampanyasında CRM tarafında qualified/unqualified ayrımı yapılmalı.
- Landing page hızı ve mobil UX reklam performansının parçasıdır; medya satın alma problemi gibi görünse de çoğu zaman web problemi çıkar.

## 10. Kampanya Modeli Seçim Matrisi

| İş hedefi | Doğru kampanya amacı | Dönüşüm konumu | Ana KPI | Yorum |
|-----------|----------------------|-----------------|---------|-------|
| E-ticaret satışı | Sales | Website / App / Catalog | Purchase, CPA, ROAS | Ana kampanya modeli Sales olmalı. |
| Feribot/bilet/rezervasyon | Sales veya Leads | Website / Website lead | Purchase veya qualified lead | Ödeme başka sitedeyse ölçüm zinciri ayrıca çözülmeli. |
| Hizmet teklifi alma | Leads | Instant Form / Website / Messages | Qualified lead cost | Form kalitesi ve CRM takibi şart. |
| WhatsApp/Messenger talep | Engagement veya Leads | Messaging apps | Conversation started, qualified conversation | Operasyon cevap hızı belirleyicidir. |
| Yeni marka duyurusu | Awareness | On ad / Video | Reach, frequency | Performans değil bilinirlik. |
| Web sitesine trafik | Traffic | Website | Landing page view | Satış beklenmez; trafik toplar. |
| Mobil uygulama yükleme | App promotion | App | Install, app event | SDK/event olmadan eksik kalır. |

## 11. Ajans İçin Net Kurulum Standartları

1. Kampanya amacını iş hedefiyle birebir eşleştir. Satış için Sales, lead için Leads, mesaj için Engagement/Leads, bilinirlik için Awareness.
2. İlk kurulumda gereksiz reklam seti açma. Küçük/orta bütçede 1-3 reklam seti çoğu zaman yeterlidir.
3. Advantage+ Placements açık başla; placement kapatmayı veri olmadan yapma.
4. Kreatif havuzunu reklam setinden daha önemli gör. Zayıf kreatifi hedefleme kurtarmaz.
5. Pixel + CAPI + event kalite kontrolü yapılmadan satış kampanyasını ölçekleme.
6. İlk 48-72 saatte panik düzenleme yapma; bütçe, hedef, kreatif veya event değişikliği öğrenmeyi etkiler.
7. Raporu sadece CTR/CPC ile okuma. Nihai hedef Sales ise CPA/ROAS; Lead ise qualified lead cost esas alınır.
8. Remarketing'i ana satış makinesi gibi değil, sıcak talep yakalama katmanı olarak konumlandır.
9. Her kampanyada UTM standardı kullan; kaynak/medium/campaign/adset/ad ayrımı raporlamada şarttır.
10. Kazanan kreatifi sürekli yenile; kreatif yorgunluğu Meta tarafında hızlı maliyet artışı doğurur.

## 12. Sektöre Göre Kısa Reçeteler

| Sektör | Önerilen ana amaç | Kurulum yorumu |
|--------|--------------------|-----------------|
| E-ticaret | Sales | Catalog + purchase event + geniş kitle + kreatif varyasyon. |
| Turizm / bilet / feribot | Sales veya Leads | Satın alma başka domain ise cross-domain/event ölçümü kritik. |
| Eğitim / kurs | Leads | Instant form + CRM + arama takibi; lead kalitesi ölçülmeli. |
| Gayrimenkul | Leads | Form soruları ile kalite artır; sadece ucuz lead hedefleme. |
| Restoran / lokal | Awareness + Engagement + Sales/Traffic | Lokasyon ve teklif net; rezervasyon varsa lead/sales. |
| B2B | Leads | Daha uzun funnel; remarketing ve CRM geri bildirimi önemli. |
| Uygulama | App promotion | SDK/event/retention raporu olmadan karar verme. |

## 13. Yayına Alma Öncesi Kontrol Listesi

- [ ] İş hedefi ile kampanya amacı birebir uyumlu mu?
- [ ] Dönüşüm event'i doğru tetikleniyor mu?
- [ ] Pixel ve CAPI eventleri Events Manager'da görünüyor mu?
- [ ] Landing page mobilde hızlı açılıyor mu?
- [ ] Kampanya, reklam seti ve reklam isimlendirme standardı var mı?
- [ ] UTM parametreleri eklendi mi?
- [ ] Bütçe hedef CPA'ya göre mantıklı mı?
- [ ] Kreatif formatları placement uyumlu mu?
- [ ] Reklam metni, kreatif ve landing page aynı vaadi mi söylüyor?
- [ ] Yasal/özel kategori gerektiren sektörlerde uygun ayarlar kontrol edildi mi?

## 14. Optimizasyon ve Müdahale Kuralları

| Durum | Ne yapılır? | Ne yapılmaz? |
|-------|--------------|---------------|
| İlk gün sonuç zayıf | Event ve teslimat hatası yoksa beklenir. | Saatlik panikle kapatma. |
| CTR düşük | Kreatif/hook/teklif revize edilir. | Hedeflemeyi sürekli daraltmak. |
| CPC iyi ama dönüşüm yok | Landing page, teklif, güven, event ve ürün-fiyat kontrol edilir. | Traffic iyi diye bütçeyi büyütmek. |
| Lead çok ama kalitesiz | Form soruları, teklif, CRM ve satış ekibi geri bildirimi kontrol edilir. | Sadece CPL düşük diye başarılı saymak. |
| ROAS düşüyor | Kreatif yorgunluğu, frekans, stok/fiyat, web hızı kontrol edilir. | Kazanan kampanyayı çok sık düzenlemek. |

## 15. Sık Yapılan Hatalar

- Satış hedefinde Traffic kampanyası açmak.
- Her ilgi alanı için ayrı reklam seti kurup bütçeyi parçalamak.
- Event ölçümü bozukken algoritmayı suçlamak.
- Yeterli kreatif üretmeden sadece hedefleme ile performans beklemek.
- Kazanan kampanyaya sürekli küçük düzenleme yaparak öğrenmeyi bozmak.
- Remarketing'i çok erken veya çok küçük kitleyle açıp anlamlı sonuç beklemek.
- Lead kalitesini CRM'den ölçmeden sadece form maliyetine bakmak.
- Placement kapatmayı veriyle değil önyargıyla yapmak.

## 16. Örnek Kampanya Şablonları

### 16.1 E-ticaret Satış Şablonu
- **Amaç:** Sales
- **Dönüşüm konumu:** Website veya Catalog
- **Optimizasyon:** Purchase
- **Kitle:** Advantage+ Audience / geniş
- **Yerleşim:** Advantage+ Placements
- **Reklam:** 3-6 kreatif varyasyonu, video + statik + carousel
- **Rapor:** CPA, ROAS, conversion value, frequency, creative fatigue

### 16.2 Hizmet Lead Şablonu
- **Amaç:** Leads
- **Dönüşüm konumu:** Instant Form veya Website
- **Optimizasyon:** Lead
- **Form:** 1-2 kalite sorusu eklenmiş, gereksiz uzun değil
- **CRM:** Lead kaynağı, arama sonucu, satış durumu işlenir
- **Rapor:** qualified lead cost, appointment rate, sale rate

### 16.3 Mesaj Kampanyası Şablonu
- **Amaç:** Engagement veya Leads
- **Dönüşüm konumu:** Messaging apps
- **Kreatif:** soruya cevap veren, hızlı teklif açıklayan yapı
- **Operasyon:** cevap süresi takip edilir
- **Rapor:** conversation started değil qualified conversation esas alınır

## 17. Kaynakça (Temel Doküman)

- **Meta Business Help - Create ad campaigns in Meta Ads Manager** — Kampanya, reklam seti ve reklam oluşturma akışı. https://www.facebook.com/business/help/621956575422138
- **Meta Business Help - Choose the right ad objective** — Kampanya amacı seçimi ve hedefle uyum. https://www.facebook.com/business/help/1438417719786914
- **Meta Business Help - ODAX objective changes** — Altı ana amaç: Awareness, Traffic, Engagement, Leads, App promotion, Sales. https://en-gb.facebook.com/business/help/325793898950394
- **Meta Business Help - Available conversion locations and events** — Amaçlara göre dönüşüm konumu ve event seçenekleri. https://www.facebook.com/business/help/2035196646663270
- **Meta Business Help - Advantage+ campaign budget** — Bütçenin reklam setleri arasında otomatik dağıtılması. https://www.facebook.com/business/help/153514848493595
- **Meta Business Help - Set up Advantage+ campaign budget** — Kampanya bütçesi kurulum mantığı. https://www.facebook.com/business/help/343242619559352
- **Meta Business Help - Best practices for Advantage+ campaign budget** — ACB kullanımında en iyi uygulamalar. https://www.facebook.com/business/help/2177212182495139
- **Meta Business Help - Advantage+ placements** — Yerleşimlerin maliyet etkin fırsatlara göre genişletilmesi. https://www.facebook.com/business/help/196554084569964
- **Meta Business Help - Choose ad placements** — Advantage+ placements önerisi ve manuel yerleşim seçimi. https://www.facebook.com/business/help/175741192481247
- **Meta Business Help - Best practices for Meta Ads delivery** — Teslimat sistemi için iyi uygulamalar. https://www.facebook.com/business/help/950694752295474
- **Meta Business Help - Traffic objective** — Traffic amacının web/app hedeflerine trafik göndermesi. https://www.facebook.com/business/help/301780226847564
- **Meta Business Help - About ad formats** — Reklam formatları: görsel, video, carousel vb. https://www.facebook.com/business/help/1263626780415224
- **Meta Business Help - Campaign, ad set and ad limits** — Hesap limitleri ve yapı sınırları. https://www.facebook.com/business/help/652738434773716
- **Meta Business Help - About daily budgets** — Günlük bütçe çalışma mantığı. https://www.facebook.com/business/help/190490051321426
- **Meta Business Help - Advantage+ creative** — Kreatif varyasyonlarının otomatik optimize edilmesi. https://www.facebook.com/business/help/297506218282224

## 18. Sonuç

Meta Ads 2026'da başarı, eski tip mikro hedefleme becerisinden çok sistemin doğru sinyalle beslenmesine, sade kampanya mimarisine, yeterli bütçeye ve güçlü kreatif üretimine bağlıdır. Ajans tarafında ana disiplin şudur: Önce doğru amaç, sonra doğru event, sonra doğru kreatif. Hedef yanlışsa optimizasyon da yanlış çalışır.

---

# Bölüm: İleri Seviye Mühendislik

**Meta Ads 2026 — İleri Seviye Mühendislik Eğitim Dokümanı**
*Kampanya mimarisi, optimizasyon mühendisliği, ölçümleme, Pixel/CAPI, kreatif sistemleri, troubleshooting ve ajans operasyon standardı*

Hazırlanma tarihi: 19 Mayıs 2026 | Kaynak tipi: resmi Meta Business Help + uygulama mühendisliği çerçevesi
Hazırlayan: ChatGPT | Resmi Meta kaynakları baz alınmıştır | 2026

## Kullanım Notu

Bu doküman Meta Ads'i yüzeysel kullanmak için değil, kampanya sistemini mühendislik mantığıyla yönetmek için hazırlanmıştır. Meta arayüzü, ürün isimleri ve bazı otomasyon seçenekleri hesaplara göre değişebilir. Bu yüzden burada verilen yapı bir "ezber ayar listesi" değil; karar ağacı, teşhis mantığı ve güvenli optimizasyon standardıdır.

**Net ilke:** Meta Ads'te başarı, "hangi butona basıldığı" ile değil; kampanya amacının iş hedefiyle uyumu, veri kalitesi, sinyal yoğunluğu, kreatif çeşitliliği, bütçe mimarisi, öğrenme fazı disiplinleri ve ölçüm doğruluğu ile belirlenir.

**İçindekiler (orijinal):** 1. Meta Ads sistem mantığı · 2. Kampanya - reklam seti - reklam hiyerarşisi · 3. 2026 kampanya amaçları · 4. Reklam seti mühendisliği · 5. Hedefleme ve Advantage+ Audience · 6. Bütçe ve teklif stratejileri · 7. Öğrenme fazı ve delivery sistemi · 8. Pixel, CAPI, dataset ve event mimarisi · 9. Satış/e-ticaret yapısı · 10. Lead generation yapısı · 11. Traffic/engagement/awareness yapısı · 12. App kampanyaları · 13. Kreatif mühendisliği · 14. Raporlama, attribution ve UTM · 15. Troubleshooting karar ağacı · 16. Ajans hesap kurulum SOP · 17. Optimum yapı şablonları · 18. Kaynakça

## Meta Ads Sistem Mantığı

Meta Ads bir medya satın alma paneli değil, sinyal temelli tahmin ve açık artırma sistemidir. Reklamveren hedefi söyler; sistem eldeki kullanıcı davranışı, reklam kalitesi, tahmini aksiyon olasılığı ve teklif/bütçe limitleri üzerinden gösterimi dağıtır.

2026'da doğru kullanım geniş sinyal, güçlü kreatif, doğru dönüşüm olayı ve az parçalanmış yapı üzerine kuruludur. Gereksiz dar hedefleme, küçük bütçeyi çok ad setine bölmek, sürekli düzenleme yapmak ve yanlış objective seçmek delivery performansını bozar.

ODAX sonrası Meta kampanya amaçları sadeleşmiştir: Awareness, Traffic, Engagement, Leads, App promotion, Sales. Eski dönemdeki birçok alt amaç bu ana amaçların altına taşınmıştır.

## Hiyerarşi: Campaign / Ad Set / Ad

Campaign seviyesi iş hedefini ve çoğu durumda bütçe stratejisini belirler. Yanlış objective seçilirse reklam seti ve reklam seviyesi doğru olsa bile sistem yanlış insan tipine optimize olur.

Ad set seviyesi sinyal mühendisliği alanıdır: conversion location, event, audience, placements, budget/schedule, optimization & delivery, attribution setting ve bazı bid kontrolleri burada belirlenir.

Ad seviyesi tahmin skorunu etkileyen kreatif katmandır. Görsel/video, metin, başlık, açıklama, CTA, URL, ürün seti, form, mesaj şablonu ve kreatif varyasyonları burada yönetilir.

### Seviye Bazlı Karar Tablosu

| Seviye | Ana karar | Yanlış karar sonucu | Mühendislik kontrolü |
|--------|------------|----------------------|------------------------|
| Campaign | Objective ve campaign budget | Yanlış optimizasyon insanı | İş hedefi = objective mi? |
| Ad set | Event, audience, placement, attribution | Sinyal azlığı veya learning limited | 50+ event potansiyeli, geniş audience |
| Ad | Kreatif ve teklif mesajı | CTR/CVR düşer, CPM yükselir | Hook, angle, format, landing uyumu |
| Measurement | Pixel/CAPI/dataset/UTM | Yanlış performans okuması | Event dedup, EMQ, GA4/CRM karşılaştırma |

## 2026 Kampanya Amaçları: Ne İçin Kullanılır, Ne İçin Kullanılmaz

| Amaç | Sistem neye optimize olur? | Doğru kullanım | Kullanılmaması gereken durum | Ana KPI |
|------|-----------------------------|-----------------|-------------------------------|---------|
| **Awareness** | Erişim, marka bilinirliği, video/hatırlanma | Soğuk pazarda görünürlük, lansman, marka frekansı | Satış/lead bekleniyorsa ana kampanya olmamalı | Reach, impressions, frequency, ad recall |
| **Traffic** | Web/app/profil/mesaj trafiği | Ucuz ziyaretçi, içerik tüketimi, yönlendirme | Satış veya nitelikli lead için tek başına zayıf | LPV, outbound click, CTR, CPC |
| **Engagement** | Etkileşim, video izleme, mesaj başlatma, sayfa etkileşimi | Sosyal kanıt, mesaj odaklı başlangıç, içerik test | Purchase/lead amacı varsa yanıltıcı olabilir | Engagement rate, messaging conversations, ThruPlay |
| **Leads** | Form, website lead, CRM lead, messenger/WhatsApp lead | Teklif alma, danışmanlık, B2B/B2C lead | Satış yerine yalnız form doldurma optimize ederse kalite düşebilir | CPL, qualified lead rate, CRM close rate |
| **App promotion** | Install, app event, high-value app user | Mobil uygulama büyüme | Web satış için kullanılmaz | CPI, CPA event, ROAS |
| **Sales** | Purchase, catalog, website/app/in-store satış | E-ticaret, dönüşüm, değer optimizasyonu | Yeterli sinyal yoksa pahalı/öğrenme sınırlı olabilir | Purchase, CPA, ROAS, value, MER |

### Awareness
- Amaç marka temasını büyütmektir. Performans metriği satın alma değil; erişim, frekans, video izleme ve hatırlanabilirliktir.
- Frekans kontrolü önemlidir. Çok düşük bütçede geniş ülke hedefleme marka etkisi oluşturmaz; daha net coğrafya veya segment gerekir.
- Awareness kampanyasından direkt satış beklemek hatadır; satışa katkısı üst hunide ve uzun vadede okunmalıdır.

### Traffic
- Traffic kampanyası tıklama veya landing page view gibi ziyaret sinyallerine optimize olur. Meta satış ihtimali en yüksek kişiyi değil, tıklama ihtimali yüksek kişiyi bulur.
- Satış için Traffic yalnızca ön ısıtma, içerik dağıtımı veya ölçüm veri toplama amacıyla sınırlı kullanılmalıdır.
- Landing Page View optimizasyonu, link click'e göre daha temiz sinyal verir; fakat yine de satın alma optimizasyonu değildir.

### Engagement
- Etkileşim kampanyası sosyal kanıt, video izleme, mesaj başlatma veya gönderi etkileşimi üretir.
- Etkileşim yüksek olduğunda satış da iyi olacak diye düşünmek yanlıştır. Etkileşim kitlesi ile satın alma kitlesi farklı olabilir.
- Mesaj kampanyalarında otomasyon, hızlı yanıt, CRM tagging ve konuşma kalitesi lead maliyetinden daha kritik hale gelir.

### Leads
- Lead objective form, web sitesi formu, arama, mesaj veya CRM akışlarına göre kurgulanabilir.
- Instant Form düşük sürtünme nedeniyle çok lead getirir; fakat kalite filtresi zayıfsa düşük kaliteli lead üretir. Higher intent, koşullu sorular ve CRM doğrulama gerekir.
- Lead kalitesi sadece Meta panel CPL ile ölçülmez; MQL, SQL, randevu, satışa dönüşüm ve iptal oranı ile ölçülür.

### App promotion
- App promotion mobil uygulama kurulumları, app events veya yüksek değerli kullanıcılar için kullanılır. SDK/App Events kurulumu zayıfsa optimizasyon körleşir.
- Advantage+ app campaign hedefleme seçenekleri daha sınırlıdır; sistem geniş sinyal ile öğrenir.
- Install sonrası event kalitesi yoksa ucuz install gelir ama değerli kullanıcı gelmeyebilir.

### Sales
- Sales objective website/app/shop/catalog/in-store satış aksiyonlarına optimize olur. E-ticarette ana omurga budur.
- Purchase eventi yeterli hacme sahipse ana optimizasyon Purchase olmalıdır. AddToCart/InitiateCheckout alt eventleri geçici öğrenme çözümü olabilir; kalıcı hedef olmamalıdır.
- Catalog, Advantage+ Sales Campaigns, Pixel+CAPI, product feed kalitesi ve value data satış performansını belirleyen ana unsurlardır.

## Objective Seçim Karar Ağacı

1. Sonuç satış/purchase ise Sales seç. Traffic ile satış kovalamak stratejik hatadır.
2. Sonuç form, teklif, randevu veya müşteri adayı ise Leads seç. Lead kalitesini CRM ile ölç.
3. Sonuç mesaj başlatma ise hedefe göre Leads veya Engagement içinde messaging kurgusunu değerlendir; nihai KPI konuşma kalitesi ve satışa dönüşümdür.
4. Sonuç sadece web sitesi ziyareti ise Traffic seç; fakat bu kampanyayı dönüşüm kampanyasının yerine koyma.
5. Sonuç uygulama install veya app event ise App Promotion seç ve SDK/App Events doğruluğunu önce doğrula.
6. Sonuç marka erişimi ve frekans ise Awareness seç; satış raporunu bu kampanyadan bekleme.

## Reklam Seti Mühendisliği

### Conversion Location
- **Website:** Pixel/CAPI events ile çalışır; purchase/lead/view content gibi web davranışı gerekir.
- **App:** SDK/App Events gerekir.
- **Messaging:** WhatsApp/Messenger/Instagram DM konuşma aksiyonları için kullanılır.
- **Instant Forms:** Meta içinde form doldurur; sürtünme az, kalite kontrolü şarttır.
- **Website and in-store / offline:** fiziksel satış veya CRM olayları dataset/CAPI üzerinden bağlanır.

### Optimization Event
- Sistem hangi olayı optimize edeceğini burada öğrenir. Purchase seçersen satın alma ihtimali yüksek kişiyi, Lead seçersen lead bırakma ihtimali yüksek kişiyi arar.
- Event seçimi sinyal hacmi ile uyumlu olmalıdır. Çok az Purchase olan yeni hesapta sistem learning limited yaşayabilir; geçici olarak InitiateCheckout/Lead gibi daha üst event test edilebilir ama nihai hedefe dönülmelidir.
- Event adları, parametreler, deduplication ve attribution veri kalitesini doğrudan etkiler.

### Attribution Setting
- Attribution ayarı raporlamada dönüşümün hangi zaman penceresinde reklama yazılacağını belirler.
- Kısa karar döngüsünde kısa pencere daha net; pahalı ve uzun karar döngüsünde daha geniş pencere gerekebilir.
- GA4/CRM ile fark çıkması normaldir; Meta view-through ve modeled attribution kullanabilir, GA4 farklı kanal kuralları kullanır.

### Placements
- Meta genellikle Advantage+ placements önerir; sistem bütçeyi daha verimli inventory'ye dağıtır.
- Manuel placement yalnız marka güvenliği, format uyumsuzluğu veya kanıtlanmış kalite farkı varsa kullanılmalıdır.
- Placement dışlamak CPM'i artırabilir; önce raporda placement kırılımı analiz edilmelidir.

## Hedefleme: 2026 Gerçeği

Meta'nın modern delivery sistemi dar ilgi alanı hedeflemesinden çok geniş sinyal + kreatif + conversion data ile çalışır. "Kitleyi ben seçeyim" yaklaşımı çoğu hesapta ölçeği ve öğrenmeyi bozar. Advantage+ Audience bu yüzden birçok kampanya tipi için test edilmesi gereken ana yaklaşımdır.

| Kitle tipi | Ne zaman kullanılır? | Risk | İleri seviye not |
|-------------|------------------------|------|-------------------|
| Broad / Advantage+ Audience | Satış, lead, ölçek, yeni hesap testleri | Başlangıçta kontrol hissi düşük | Kreatif segmentleme işini yapar; sistem davranıştan öğrenir. |
| Custom Audience | Retargeting, CRM, video/view/cart segmentleri | Küçükse frekans şişer | Son 7/14/30/60/180 gün segmentleri ayrı mantıkla test edilir. |
| Lookalike | Kaynak liste kaliteli ve yeterli hacimli ise | Kirli kaynak kirli kitle üretir | Value-based LAL e-ticarette güçlüdür; ülke/bütçe uyumu şart. |
| Detailed interests | Niş B2B, regülasyon, başlangıç hipotezi | Audience fragmentation | Kanıt yoksa ana yapı broad olmalı; interests test hücresi olarak kalmalı. |
| Exclusions | Mevcut müşteri, çalışan, düşük kalite segmentleri | Aşırı exclusion delivery bozar | ASC gibi ürünlerde mevcut müşteri cap/kontrol seçenekleri hesaplara göre değişebilir. |

## Bütçe ve Teklif Stratejileri

- Advantage+ Campaign Budget kampanya bütçesini ad setleri arasında sonuç potansiyeline göre dağıtır. Küçük bütçede bütçeyi çok ad setine bölmek yerine konsolidasyon daha sağlıklıdır.
- Ad set budget, kontrollü test veya kesin bütçe izolasyonu gerektiğinde kullanılır. Ancak çok fazla ad seti learning fragmentation doğurur.
- Lowest cost / highest volume başlangıç için en stabil yaklaşımdır. Cost cap, bid cap veya ROAS hedefleri yeterli veri ve net ekonomi olmadan uygulanırsa delivery kısılır.
- Bütçe artışı kademeli yapılmalıdır. Çok agresif artış learning davranışını bozabilir. Büyük değişiklikler significant edit etkisi yaratabilir.

| Durum | Önerilen bütçe mantığı | Yapılmaması gereken | Kontrol metriği |
|-------|--------------------------|----------------------|------------------|
| Yeni hesap / az veri | Az kampanya, geniş kitle, yeterli günlük event potansiyeli | 10 küçük ad sete bölmek | Learning, CPM, CTR, CVR |
| E-ticaret ölçek | ASC + katalog + broad/prospecting + retargeting kontrollü | Her ürüne ayrı kampanya açmak | ROAS, CPA, MER, purchase volume |
| Lead gen | 1-2 ana lead kampanyası, form kalitesi ayrımı | Sadece en ucuz CPL'ye göre karar | Qualified lead rate, satışa dönüşüm |
| Remarketing | Küçük ama yeterli bütçe, frekans kontrolü | Küçük kitleye büyük bütçe basmak | Frequency, CPA, incremental lift |

## Learning Phase ve Delivery Disiplini

- Learning phase sistemin hangi kişilere, hangi placement ve kreatif kombinasyonu ile sonuç üreteceğini öğrendiği dönemdir.
- Sık edit, bütçe oynama, kreatif kapatma/açma, audience parçalama ve event değişimi öğrenmeyi bozar.
- Learning limited genellikle küçük audience, düşük bütçe, düşük bid/cost control, yüksek auction overlap veya yeterli conversion hacmi olmamasından oluşur.
- İleri seviye yaklaşım: Önce veri hacmini ve yapısal engeli çöz; sadece "kampanyayı yeniden aç" yaklaşımı sorunu çözmez.

| Significant edit örneği | Risk | Alternatif |
|--------------------------|------|------------|
| Objective değiştirmek | Kampanya mantığı sıfırlanır | Yeni kampanya kur |
| Optimization event değiştirmek | Learning reset riski | Önce event hacmi doğrula |
| Büyük bütçe değişimi | Delivery dalgalanır | Kademeli artır |
| Audience/placement büyük değişim | Sistem yeniden öğrenir | Test hücresi aç |
| Çok sayıda reklamı kapatıp açmak | Kreatif öğrenmesi bozulur | Yeni kreatifi ekle, eskiyi kontrollü söndür |

## Pixel, CAPI, Dataset ve Event Mimarisi {#pixel-capi-dataset-ve-event-mimarisi-ileri}

Meta Pixel tarayıcı taraflı sinyal, Conversions API sunucu/CRM/app/offline taraflı sinyal gönderir. Modern ölçümde en sağlam kurulum Pixel + CAPI birlikte, deduplication doğru, event parametreleri zengin ve Event Match Quality yüksek olacak şekilde yapılır.

| Katman | Görev | Kontrol | Kritik hata |
|--------|--------|----------|--------------|
| Pixel | Browser event yakalar | Events Manager Test Events, pixel helper | Yanlış event, duplicate, eksik value/currency |
| CAPI | Server/CRM event gönderir | Server event details, EMQ, dedup | event_id yok, geç event, secret loglama |
| Dataset | Web/app/offline/message eventlerini bağlar | Data source diagnostics | Eski offline set mantığına takılmak |
| AEM / event priority | Kısıtlı ölçüm ortamında event yönetimi | Domain verify, event listesi | Purchase yerine düşük değerli event önceliği |
| UTM | Platform dışı analiz | GA4/CRM kanal okuması | Tutarsız naming |

- **Deduplication:** Pixel ve CAPI aynı olayı gönderiyorsa event_name + event_id uyumu gerekir; aksi halde dönüşümler çift sayılabilir veya doğru eşleşmeyebilir.
- **Event Match Quality:** email, phone, external_id, fbp, fbc, IP, user agent gibi uygun müşteri bilgi parametreleri eşleşmeyi güçlendirir. KVKK/GDPR ve Meta şartları dikkate alınmalıdır.
- **Value ve currency:** Sales optimizasyonunda purchase value/currency gönderilmezse ROAS ve value optimization kalitesi düşer.
- **Test Events:** yayına almadan önce ViewContent, AddToCart, InitiateCheckout, Purchase/Lead zinciri test edilmelidir.
- **Diagnostics:** Events Manager uyarıları operasyonel backlog olarak takip edilmelidir; "sadece reklam paneli" ile yönetim eksiktir.

## E-ticaret / Sales Kampanyaları

- Ürün feed kalitesi, stok/fiyat/URL doğruluğu, ürün görsel kalitesi ve katalog eşleşmesi performansın temelidir.
- Advantage+ Sales Campaigns özellikle yeterli veri ve katalog olduğunda ana ölçekleme modeli olarak değerlendirilmelidir.
- Purchase optimizasyonu ana hedeftir. Yetersiz veri dönemlerinde geçici üst funnel event kullanılabilir; fakat sistem uzun süre ATC optimize edilirse satın alma değil sepete ekleme kitlesini öğrenir.
- Retargeting küçük kitlelerde frekans ve incremental katkı ile yönetilmelidir. Sepet terk, ürün görüntüleyen, checkout başlatan ve mevcut müşteri segmentleri ayrı strateji ister.
- ROAS tek başına karar değildir; MER, brüt kar, iade, kargo, stok, yeni müşteri oranı ve lifetime value dikkate alınmalıdır.

| Senaryo | Kampanya yapısı | Optimizasyon | Not |
|---------|------------------|---------------|-----|
| Yeni e-ticaret | Sales website purchase + broad/Advantage+ Audience | Purchase mümkünse; değilse geçici IC/ATC | Pixel/CAPI tam olmadan ölçekleme yapma |
| Katalog güçlü | Advantage+ Sales + catalog ads | Purchase/value | Feed health günlük kontrol |
| Yüksek SKU | Catalog product sets | Purchase/value | Ürün setleri marj/stok/kategoriye göre |
| Retargeting | 7/14/30 gün davranış segmenti | Purchase | Frequency ve overlap kontrol |
| Omnichannel | Website + in-store/offline events | Purchase/offline | CRM/CAPI veri gecikmesi izlenir |

## Lead Generation Mühendisliği

- Lead kampanyasında ana hata CPL'yi başarı sanmaktır. Meta ucuz form dolduran kişiyi bulabilir; satış ekibi nitelik kontrolü yapmıyorsa sonuç çöp olabilir.
- Instant Form'da higher intent, açık rıza, zorunlu nitelik soruları, conditional logic ve CRM entegrasyonu kaliteyi artırır.
- Website lead daha yüksek sürtünme ama daha niyetli sinyal verebilir. Site hızı, form UX ve tracking doğru olmalıdır.
- WhatsApp/Messenger lead kampanyalarında hızlı yanıt süresi, otomasyon, konuşma scripti ve etiketleme performans kadar kritiktir.
- CRM geri beslemesi olmadan algoritma sadece form lead optimize eder; qualified lead, randevu ve satış eventleri CAPI/CRM üzerinden geri beslenmelidir.

| Sorun | Muhtemel neden | Mühendislik çözümü |
|-------|-----------------|---------------------|
| CPL düşük ama satış yok | Form sürtünmesi az, kalite filtresi yok | Higher intent + nitelik soruları + CRM quality feedback |
| Lead az ve pahalı | Offer zayıf, audience dar, bütçe düşük | Teklif revizyonu + broad + kreatif test |
| Form terk yüksek | Soru çok veya güven düşük | İlk ekran teklif/güven unsuru, kısa form |
| WhatsApp lead cevap vermiyor | Düşük niyet / geç dönüş | Otomatik karşılama, ilk 5 dk yanıt SLA |

## Kreatif Mühendisliği

2026 Meta Ads'te kreatif yalnızca görsel değil, hedefleme sinyalidir. Geniş kitlede algoritma kreatif açısına tepki veren segmentleri ayırır. Bu yüzden kreatif çeşitliliği audience çeşitliliğinden daha değerlidir.

| Kreatif bileşeni | İleri seviye kontrol | Hata sinyali |
|-------------------|------------------------|---------------|
| Hook | İlk 1-3 saniye veya ilk satır net mi? | CTR düşük, video drop hızlı |
| Angle | Fiyat, problem, sosyal kanıt, karşılaştırma, acaliyet, fayda ayrı mı? | Tüm reklamlar aynı mesaj |
| Format | Reels/Stories/Feed oranları uygun mu? | Placement performansı düşük |
| UGC | Gerçek kullanım/güven unsuru var mı? | CPM iyi ama CVR düşük |
| Landing congruence | Reklam vaadi ile sayfa aynı mı? | CTR iyi, conversion düşük |
| Creative fatigue | Frequency/CTR/CPA bozuluyor mu? | İlk gün iyi, sonra düşük |

- Creative testing reklam setini parçalayarak değil, aynı öğrenme havuzunda yeterli varyasyonla yapılmalıdır; çok küçük bütçede çok fazla reklam da öğrenmeyi dağıtır.
- Primary text, headline ve CTA farklı niyet seviyelerini taşımalıdır. Aynı görsele sadece küçük metin değiştirerek "test yaptık" denmez.
- Video kreatifte ilk kare, altyazı, mobil dikey kurgu, ürün/sonuç gösterimi ve güven unsuru satış etkisini belirler.
- Advantage+ Creative otomasyonları test edilmelidir; fakat marka güvenliği, regülasyon ve hassas sektörlerde çıktılar kontrol edilmelidir.

## Raporlama, Attribution ve Gerçek Performans Okuma

- Meta Ads Manager sonucu platform attribution ile gösterir. GA4 last click/data-driven farklı olabilir. CRM nihai satış gerçekliğini gösterir. Üçü aynı rakamı vermek zorunda değildir.
- Karar alma sırası: önce tracking doğru mu, sonra conversion volume yeterli mi, sonra CPA/ROAS trendi, sonra kreatif ve audience ayrıştırması.
- İstatistiksel olarak anlamlı olmayan küçük veriyle kampanya kapatmak hatadır. Özellikle düşük bütçede günlük dalgalanma normaldir.
- UTM standardı olmadan kanal bazlı analiz yapılamaz. Her kampanya/adset/ad için tutarlı isimlendirme ve UTM gerekir.

| Metrik | Ne anlatır? | Tek başına karar olur mu? | Yanlış yorum |
|--------|--------------|----------------------------|---------------|
| CPM | Inventory ve rekabet maliyeti | Hayır | CPM yüksek diye kötü reklam sanmak |
| CTR | Mesaj/creative çekiciliği | Hayır | CTR yüksekse satış olur sanmak |
| CPC | Tıklama maliyeti | Hayır | Ucuz tıklamayı kaliteli trafik sanmak |
| CVR | Landing/offer/niyet uyumu | Kısmen | Düşük CVR'de sadece reklamı suçlamak |
| CPA/CPL | Sonuç maliyeti | Evet ama kaliteyle | Ucuz lead'i başarı saymak |
| ROAS | Gelir/reklam harcaması | Kısmen | Marj/iade/LTV yok saymak |
| Frequency | Aynı kişiye gösterim yoğunluğu | Kısmen | Her yüksek frekansı kötü sanmak |

## Troubleshooting Karar Ağacı

| Semptom | Muhtemel neden | İlk kontrol / çözüm |
|---------|-----------------|----------------------|
| Kampanya harcamıyor | Bütçe/teklif çok kısıtlı, audience küçük, policy review, learning limited, fatura/hesap sorunu | Delivery status, billing, audience size, bid/cost cap, policy, schedule |
| CPM çok yüksek | Dar kitle, yüksek rekabet, düşük kalite, placement kısıtı, sezonluk rekabet | Broad test, placement aç, kreatif kalite, auction overlap |
| CTR düşük | Hook zayıf, kreatif yanlış, teklif net değil, audience-message uyumsuz | Yeni angle, ilk 3 sn, fayda vaadi, sosyal kanıt |
| CPC yüksek | CPM yüksek veya CTR düşük | CPM/CTR ayrıştır, placement ve kreatif test |
| CVR düşük | Landing page yavaş, teklif uyumsuz, tracking yanlış, trafik düşük niyet | Sayfa hız, vaad uyumu, checkout/form UX, event test |
| Lead kalitesiz | Form çok kolay, yanlış offer, CRM feedback yok | Higher intent, kalite soruları, offline/CAPI qualified lead |
| Satış yok | Yanlış objective/event, zayıf teklif, tracking, site UX, bütçe az | Sales/Purchase, Pixel+CAPI test, funnel analiz |
| Learning limited | Sinyal az, bütçe düşük, audience küçük, overlap yüksek | Konsolide et, event hacmini artır, bütçeyi odakla |
| Frequency yükseldi | Kitle küçük veya kreatif tükendi | Kitle genişlet, yeni kreatif, remarketing bütçesi azalt |
| ROAS düştü | Creative fatigue, stok/fiyat, rekabet, attribution gecikmesi | Cohort trend, ürün seti, kreatif yenileme, MER kontrol |

## Ajans Operasyon Standardı: Kurulumdan Optimizasyona SOP

> Not: PDF kaynağında bu liste 7. maddeden başlıyor (1-6 numaraları kaynak dosyada görünmüyor). Orijinal numaralandırma korunmuştur.

7. Business Manager yetkileri, reklam hesabı, sayfa, Instagram, ödeme, domain ve dataset erişimleri doğrulanır.
8. Pixel + CAPI + domain verification + event priority + Test Events + Diagnostics tamamlanır.
9. Naming convention belirlenir: objective_country_funnel_offer_audience_date formatı gibi net yapı kullanılır.
10. UTM standardı uygulanır: utm_source=meta, utm_medium=paid_social, utm_campaign, utm_content, utm_term.
11. Campaign objective iş hedefiyle eşleştirilir; Traffic ile Sales işi yapılmaz.
12. Kreatif matrisi kurulur: en az 3 angle, 2 format, 2 hook, 2 CTA varyasyonu.
13. İlk 72 saat mikro müdahale yapılmaz; kritik tracking/policy hatası yoksa öğrenme izlenir.
14. Optimizasyon günlük değil eşiğiyle yapılır: yeterli impression/click/conversion olmadan karar verilmez.
15. Haftalık raporda yalnız panel metriği değil CRM/GA4/Shopify/site verisi ile birlikte karar verilir.
16. Her değişiklik changelog'a yazılır; aksi halde performans düşüşünün nedeni takip edilemez.

## Optimum Yapı Şablonları

### Yeni lead hesabı
- 1 Leads campaign, 1-2 ad set, Advantage+ Audience veya broad, Instant Form higher intent + website lead test, CRM nitelik takibi.
- Günlük bütçe tek ad sete çok az kalmayacak şekilde odaklanmalı. İlk hedef ucuz lead değil nitelikli lead verisi toplamak.

### Yeni e-ticaret hesabı
- 1 Sales campaign website purchase, Pixel+CAPI aktif, katalog varsa Advantage+ catalog/ASC test.
- Purchase hacmi yoksa geçici InitiateCheckout/ATC test ama nihai hedef Purchase.

### Kirli pixel / eski hesap
- Yeni dataset/pixel düşünülürse geçiş planı yapılır; eski veri tamamen bırakılmadan yeni sinyal kalitesi test edilir.
- CAPI ve event mapping düzeltilmeden büyük bütçe açılmaz.

### Lokal işletme
- Leads veya Sales hedefe göre; konum çok dar ise bütçe/öğrenme limiti dikkate alınır.
- Mesaj/arama/form dönüşleri CRM'e işlenir.

### B2B
- Lead objective + website/instant form; kalite soruları; LinkedIn benzeri dar unvan hedeflemesi yerine problem/offer kreatifi.
- Satış döngüsü uzun olduğu için MQL/SQL/offline event zorunludur.

### Remarketing
- Küçük bütçe, son 7/14/30 gün davranış, frekans kontrol, kreatif yenileme.
- Prospecting bütçesi remarketing tarafından boğulmamalıdır.

## Mühendislik Kontrol Listeleri

### Yayına almadan önce
- [ ] Objective doğru
- [ ] Pixel/CAPI test edildi
- [ ] Event dedup çalışıyor
- [ ] Value/currency doğru
- [ ] Domain doğrulandı
- [ ] UTM eklendi
- [ ] Kreatif oranları uygun
- [ ] Landing page mobil hızlı
- [ ] Form/checkout test edildi
- [ ] Policy riski kontrol edildi

### İlk 72 saat
- [ ] Delivery açık mı
- [ ] Harcamıyor mu
- [ ] Event geliyor mu
- [ ] CPM/CTR aşırı anomalisi var mı
- [ ] Yorum/geri bildirim var mı
- [ ] Policy/learning limited var mı
- [ ] Kritik hata dışında müdahale yapılmadı mı

### Haftalık optimizasyon
- [ ] Kreatif kazanan/kaybeden
- [ ] Audience/placement kırılımı
- [ ] CPA/ROAS trend
- [ ] CRM kalite
- [ ] Frequency/fatigue
- [ ] Landing CVR
- [ ] Budget reallocation
- [ ] Yeni test hipotezleri

## İleri Seviye Notlar

> Başlık: *İleri Seviye Notlar: Meta Ads Mühendislerinin Bildiği Ama Herkesin Uygulamadığı Noktalar*

- Kampanya yapısı sade değilse algoritma veri öğrenemez; sade yapı tembellik değil mühendislik tercihidir.
- Yanlış objective ile başarılı görünen metrik, çoğu zaman sahte başarıdır. Traffic kampanyasında ucuz CPC satış sinyali değildir.
- Lead kampanyasında asıl optimizasyon olayı qualified lead/sale geri beslemesi olmadığında algoritma ucuz form dolduranları öğrenir.
- Creative fatigue yalnız frekansla ölçülmez; CTR düşüşü, CPA artışı, ilk gün performansına göre decay ve yorum kalitesi birlikte okunur.
- Cost cap/ROAS target veri olmadan kullanılırsa sistem harcamayı kesebilir. Kontrol arzusu ölçeği öldürebilir.
- Audience overlap çoğu zaman çok fazla ad seti açmanın sonucudur; çözüm daha fazla exclusion değil konsolidasyondur.
- GA4 ile Meta farkı her zaman tracking hatası değildir; attribution modelleri farklıdır. Ancak event sayısı, timestamp, event_id ve UTM kontrolü yapılmadan "normal fark" denmez.
- Katalog feed sağlığı zayıfsa reklam optimizasyonu değil veri operasyonu sorunu vardır.
- Learning limited bir uyarıdır; her zaman kampanyayı kapatmak gerekmez. Ama kalıcıysa bütçe/sinyal/audience mimarisi düzeltilmelidir.
- Kreatif testlerinde hedef sadece en yüksek CTR değil; CTR + CVR + CPA/ROAS + kalite sinyali kombinasyonudur.
- Başarılı kampanya bir kez kurulan yapı değil, sinyal-kreatif-ölçüm geri besleme döngüsüdür.

---

## BÖLÜM 2 - İleri Seviye Meta Ads Mühendislik Referans Kitabı

Bu bölüm, kampanya kurulumunu bilen bir medya satın alma uzmanını ileri seviye Meta Ads mühendisi seviyesine taşımak için hazırlanmıştır. Amaç sadece ayarları bilmek değil; delivery sistemini, veri kalitesini, sinyal yoğunluğunu, kreatif ekonomisini ve ölçüm tutarlılığını birlikte yönetmektir.

### 1. Meta Ads Auction ve Delivery Motoru

#### Auction mekanizması
- Meta reklam gösterimini sadece en yüksek teklif verene satmaz. Tahmini aksiyon oranı, reklam kalitesi, kullanıcı deneyimi ve teklif/bütçe birlikte değerlendirilir.
- Reklam kalite sinyalleri düşükse aynı sonuca ulaşmak için daha fazla ödeme gerekir. Bu yüzden kreatif kalitesi medya satın alma maliyetinin doğrudan parçasıdır.
- Delivery motoru her gösterimde kime gösterileceğini yeniden hesaplar. Sabit bir "hedef kitle listesi" mantığıyla değil, olasılık dağılımı ve sinyal geri beslemesiyle çalışır.

#### Performance feedback loop
- Gösterim -> tıklama/izleme/etkileşim -> site/form/mesaj davranışı -> event -> attribution -> optimizasyon döngüsü kurulur. Zincirdeki bir kırık tüm sistemi yanlış eğitir.
- Sisteme yanlış event gönderilirse algoritma yanlış kişileri öğrenir. Örneğin teşekkür sayfası hatalı tetikleniyorsa Purchase sinyali kirlenir.
- Geri besleme gecikmesi özellikle pahalı ürünlerde ve offline satışta kararları geciktirir. Bu durumda günlük değil haftalık/cohort bazlı analiz gerekir.

#### Optimization horizon
- Sistem anlık en ucuz tıklamayı değil, seçilen objective/event için beklenen sonucu optimize eder. Bu yüzden doğru hedef seçimi matematiksel olarak en kritik karardır.
- Kısa vadeli dalgalanmalar normaldir. Meta delivery sistemi günlük bütçeyi fırsat günlerine göre farklı kullanabilir; tek günlük sapma yapısal hata anlamına gelmez.
- Uzman kararında trend, sample size, kreatif yorgunluğu, conversion delay ve attribution penceresi birlikte değerlendirilir.

| Kavram | Mühendislik anlamı | Yanlış yorum | Doğru aksiyon |
|--------|---------------------|---------------|----------------|
| CPM | Gösterim inventory maliyeti + kalite + rekabet | CPM yüksekse kampanya kötüdür | CTR/CVR/CPA ile birlikte oku |
| Estimated action rate | Kullanıcının hedef aksiyonu yapma olasılığı | Sadece audience ayarı belirler | Kreatif, landing, geçmiş event verisi etkiler |
| Ad quality | Kullanıcı geri bildirimi, engagement, deneyim | Görsel güzel görünüyorsa kalite yüksektir | Negatif feedback, hide, landing uyumu izle |
| Learning | Delivery modelinin veri toplama dönemi | Bozuk kampanya demektir | Yeterli event hacmi ve istikrar sağla |

### 2. Hesap Altyapısı ve Business Manager Güvenliği

- Reklam hesabı sağlığı kampanya performansından ayrıdır. Fatura, ödeme yöntemi, policy geçmişi, domain doğrulama, page/IG yetkileri ve dataset bağlantıları kampanya başlamadan doğrulanmalıdır.
- Ajans yapısında kişisel hesap şifresi paylaşımı yerine Business Manager yetki ataması, partner access ve iki faktörlü güvenlik kullanılmalıdır.
- Her varlık için minimum gerekli yetki prensibi uygulanır; ancak teknik kurulum yapacak kişi dataset, pixel, domain, catalog, page, ad account ve app/event kaynaklarında yeterli yetkiye sahip olmalıdır.

| Varlık | Gerekli kontrol | Neden kritik? | Hata sonucu |
|--------|------------------|----------------|--------------|
| Business Portfolio | Admin/employee/partner rolleri | Erişim ve sahiplik düzeni | Kurulum yarım kalır |
| Ad Account | Payment, spending limit, timezone, currency | Raporlama ve harcama doğruluğu | Yanlış para birimi/limit |
| Page + Instagram | Bağlantı ve reklam verme yetkisi | Reklam kimliği | IG placement/reklam hatası |
| Dataset / Pixel | Ad account ve domain bağlantısı | Optimizasyon sinyali | Event görünmez |
| Domain | Verification + event priority | Web event attribution | AEM/ölçüm sorunu |
| Catalog | Pixel/dataset ve ürün setleri | Dynamic/catalog ads | Ürün eşleşmez |
| CRM | Lead feedback / offline events | Kalite optimizasyonu | Algoritma düşük kalite lead öğrenir |

### 3. Objective Mühendisliği: Yanlış Objective Seçiminin Maliyeti

#### Awareness ileri seviye kullanım
- Büyük bütçeli marka kampanyalarında frekans, reach ve yaratıcı hatırlanma hedeflenir.
- Alt funnel kampanyalarla çakışması, remarketing havuzuna katkısı ve marka arama hacmine etkisi ayrı raporlanır.
- Küçük işletmelerde awareness ancak net lokal erişim, lansman veya güçlü video stratejisi varsa mantıklıdır.

#### Traffic ileri seviye kullanım
- Landing Page View optimizasyonu link click'e göre daha kaliteli trafik sinyali verir; fakat conversion niyeti garanti etmez.
- Traffic kampanyası SEO içerik, blog, bilgilendirme, kampanya ön ısıtma veya düşük maliyetli remarketing havuzu kurma için kullanılabilir.
- Satış beklenen hesapta Traffic sadece destekleyici rol oynar; ana bütçeyi yememelidir.

#### Engagement ileri seviye kullanım
- Video view ve engagement kampanyaları kreatif/mesaj ön testi için kullanılabilir; ancak kazanan engagement kreatifi conversion kampanyasında tekrar test edilmeden ölçeklenmez.
- Mesaj kampanyalarında conversion kalitesi operatör yanıt süresi ve satış scriptiyle belirlenir.
- Yorum kalitesi ve DM niyeti metrik kadar önemlidir.

#### Leads ileri seviye kullanım
- Instant Form, Website, Messenger/WhatsApp ve CRM lead yolları ayrı kalite profiline sahiptir.
- Lead scoring yoksa Meta sadece lead eventini optimize eder; satışa yakın leadleri ayıramaz.
- Offline event olarak qualified_lead, booked_appointment, sale gibi geri bildirimler gönderilmelidir.

#### App Promotion ileri seviye kullanım
- Install kampanyası app growth için başlangıç olabilir; ama asıl optimizasyon registration, purchase, subscribe, level_complete gibi app eventler olmalıdır.
- SKAN, Android/iOS attribution, app event dedup ve deep link doğruluğu kontrol edilmelidir.
- Advantage+ app yapılarında manuel hedefleme sınırlıdır; veri kalitesi daha fazla önem kazanır.

#### Sales ileri seviye kullanım
- Sales objective e-ticaret ve dönüşüm temelli web işlerinde ana omurgadır.
- Sadece Purchase değil value optimization, catalog, product set, new customer acquisition ve offline/in-store sinyaller beraber tasarlanır.
- Purchase event hacmi yetersizse alt event geçici kullanılabilir; kalıcı alt event optimizasyonu yanlış öğrenme riski taşır.

### 4. Kampanya Mimarisi Tasarım Desenleri

| Desen | Yapı | Ne zaman? | Kritik not |
|-------|------|------------|-------------|
| Konsolide satış mimarisi | 1 ASC veya Sales prospecting + 1 remarketing kontrollü yapı | Yeterli veri, katalog veya purchase event | Küçük bütçede en sağlıklı başlangıç |
| Kreatif test mimarisi | Aynı objective altında geniş kitle, farklı creative angle/ad varyasyonları | Yeni offer/angle testi | Audience değil creative değişkenini test eder |
| Lead kalite mimarisi | Leads campaign + CRM feedback + qualified offline event | CPL ucuz ama kalite düşükse | Algoritmayı kaliteye geri eğitir |
| Huni mimarisi | Awareness/Engagement destek + Sales/Leads ana conversion | Marka bilinirliği zayıf ve karar döngüsü uzunsa | Üst huni bütçesi ana performansı boğmamalı |
| Lokal işletme mimarisi | Leads/Sales + dar coğrafya + güçlü offer + mesaj/arama takip | Lokal servis/şube | Dar coğrafyada learning sınırlı olabilir |
| B2B mimarisi | Problem/role-based creative + Leads website/form + CRM stage feedback | Uzun satış döngüsü | Panel CPL yerine pipeline değeri izlenir |
| Kirli veri reset mimarisi | Yeni dataset/pixel veya temiz event mapping + kontrollü paralel test | Yanlış pixel, eski kirli purchase | Eski veri tamamen kesilmeden doğrulama yapılır |

### 5. Reklam Seti Ayarları: En İnce Teknik Mantık

#### Conversion Location
- Website seçildiğinde event kaynağı dataset/pixel olur. Site eventleri yanlışsa kampanya yanlış öğrenir.
- Instant form seçildiğinde sürtünme düşer; form kalitesi ve CRM kontrolü zorunludur.
- Messaging seçildiğinde konuşma akışı, bot/otomasyon ve satış temsilcisi davranışı performans parçasıdır.

#### Performance Goal / Optimization
- Maximize conversions, landing page views, link clicks, leads, value gibi hedefler farklı insan profili bulur.
- Value optimization için purchase value kalitesi ve yeterli hacim gerekir.
- Link click optimize edilmiş bir ad setinden purchase beklemek modelin amacına aykırıdır.

#### Cost per result goal / bid controls
- Cost control sistemin harcama iştahını kısabilir. Yetersiz veriyle agresif cap delivery durdurur.
- Bid cap teknik olarak auction teklifini sınırlar; uzman olmayan hesaplarda sık hata üretir.
- ROAS hedefi kâr/marj hesaplanmadan kullanılmaz.

#### Schedule
- Kampanya başlangıcında öğrenme için yeterli süre verilir. Saatlik aç/kapa çoğu durumda delivery kalitesini bozar.
- Dayparting sadece güçlü veri ve operasyonel gereklilik varsa uygulanır.
- Lead operasyonunda satış ekibi kapalıyken mesaj/arama kampanyası kalite kaybedebilir.

#### Audience controls
- Lokasyon, yaş, dil gibi kontroller iş zorunluluğu kadar dar tutulmalıdır.
- Advantage+ Audience sinyal genişliği sağlar; exclusions çok agresif kullanılmamalıdır.
- Retargeting hariç çoğu kampanyada geniş hedefleme test edilmelidir.

#### Placements
- Advantage+ placements varsayılan test olmalıdır.
- Sadece marka güvenliği, kreatif uyumsuzluğu veya kanıtlanmış negatif sonuç varsa placement kısıtlanır.
- Placement raporu CPA/ROAS ve volume ile birlikte okunur; düşük CTR tek başına placement kapatma nedeni değildir.

### 6. Audience Mühendisliği ve Segmentasyon

| Audience | Mantık | Kullanım | Risk |
|----------|--------|----------|------|
| Broad | Algoritmaya maksimum keşif alanı verir | Ölçek ve modern satış/lead kampanyaları | Kreatif segmentasyonu şart |
| Advantage+ Audience | Meta'nın öneri/otomasyon sinyalini kullanır | Çoğu prospecting kampanyası | Retargeting ve regülasyonlu senaryolarda dikkat |
| Custom audience | Kendi veri ve davranış segmentleri | Retargeting, exclusion, LAL source | Boyut ve tazelik kritik |
| Lookalike | Kaynak kitleye benzer kullanıcılar | Kaliteli müşteri listesi varsa | Kirli source kötü LAL üretir |
| Interest stack | Hipotez testi veya niş iş | B2B, özel nişler | Ana yapı değil test hücresi |
| Exclusion | Mevcut müşteri, çalışan, düşük kalite segment | Bütçe verimliliği | Aşırı exclusion delivery bozar |

- Segmentasyon artık çoğunlukla audience ayarıyla değil kreatif ve teklif açısıyla yapılır. Örneğin aynı broad kitlenin içinde fiyat odaklı, kalite odaklı, acaliyet odaklı kreatifler farklı alt segmentleri yakalar.
- Audience overlap raporu, çok parçalı yapılarda kontrol edilmelidir. Aynı kişiye farklı ad setleriyle kendi kendine rekabet etmek CPM'i artırabilir.
- Retargeting segmentlerinde zaman penceresi niyeti belirler: 1-7 gün yüksek niyet, 8-30 gün orta, 31-180 gün düşük/hatırlatma.

### 7. Bütçe, Ölçekleme ve Kârlılık Matematiği

- Bütçe stratejisi, hedef event hacmine göre belirlenir. Çok az bütçeyle çok fazla kampanya/ad seti açmak learning'i imkânsız hale getirir.
- Kademeli ölçekleme: performans stabilken bütçe artışı daha güvenlidir. Büyük sıçramalar delivery kompozisyonunu değiştirir.
- Horizontal scaling yeni offer/kreatif/ülke/segment ile yapılır; vertical scaling mevcut kazanan yapının bütçesini artırır.
- Kâr odaklı hesapta sadece ROAS değil katkı marjı, iade, operasyon maliyeti, yeni müşteri oranı, LTV ve nakit akışı değerlendirilir.

| Ölçekleme tipi | Ne yapılır? | Risk | Ne zaman? |
|-----------------|--------------|------|------------|
| Vertical | Kazanan kampanyanın bütçesi artırılır | Learning/delivery dalgalanması | Stabil CPA/ROAS varsa |
| Horizontal | Yeni kreatif/offer/audience/ülke açılır | Kontrol zorlaşır | Yeni büyüme alanı aranırken |
| Creative scaling | Kazanan angle'ın varyasyonları üretilir | Yorgunluk gecikebilir ama bitmez | Kreatif odaklı hesaplarda |
| Catalog scaling | Ürün setleri/marj/stok bazlı ayrılır | Feed operasyonu gerekir | SKU fazla e-ticarette |

### 8. Pixel + CAPI Teknik Kurulum Şeması

| Event | Zorunlu parametre | Önerilen parametre | Kontrol |
|-------|--------------------|---------------------|---------|
| PageView | event_id, fbp/fbc mümkünse | URL, referrer | Her sayfada bir kez |
| ViewContent | content_ids/content_type | value, currency, category | Ürün sayfasında doğru SKU |
| AddToCart | content_ids, value, currency | quantity | Sepet eventinin gerçek tıklamada tetiklenmesi |
| InitiateCheckout | value, currency, contents | num_items | Checkout başlangıcı doğru mu |
| Purchase | value, currency, order_id/event_id | contents, external_id | Teşekkür sayfası refresh duplicate önlenmeli |
| Lead | lead_id/event_id | email/phone hash, form type | CRM kaydıyla eşleşmeli |
| CompleteRegistration | event_id | registration method | App/site üyeliklerde |

- Server eventlerde müşteri bilgileri hashlenmiş ve Meta şartlarına uygun gönderilmelidir.
- event_id hem Pixel hem CAPI tarafında aynı olursa deduplication sağlanır.
- Purchase eventinde value/currency eksikse ROAS analizi sakatlanır.
- Order_id veya lead_id gibi harici ID, CRM/site reconciliation için kritik önemdedir.
- Geç gelen offline events için event_time doğru set edilmeli; çok gecikmiş eventler attribution/optimization kalitesini etkileyebilir.

### 9. CAPI Deduplication Hata Rehberi

| Belirti | Muhtemel hata | Kontrol | Çözüm |
|---------|----------------|---------|-------|
| Dönüşümler çift sayılıyor | Pixel ve CAPI farklı event_id | Server event details | Aynı event_id üret |
| CAPI events unmatched | Müşteri bilgisi zayıf | Event Match Quality | email/phone/external_id/fbp/fbc ekle |
| Purchase gelmiyor | Server route tetiklenmiyor | Test Events | Backend callback doğrula |
| Yanlış value | KDV/kargo/para birimi karışık | Order payload | Net/brüt standardını belirle |
| Event gecikiyor | Batch job geç çalışıyor | event_time farkı | Gerçek zamanlı veya düşük gecikme |
| Diagnostics uyarı | Parametre/format eksik | Events Manager Diagnostics | Uyarıyı backlog yap ve kapat |

### 10. Landing Page ve Funnel Mühendisliği

- Reklam performansı yalnız reklam panelinde çözülmez. CTR iyi, CVR düşükse sorun çoğu zaman landing page, teklif, form, checkout veya güven unsurlarındadır.
- Mobil hız, ilk ekran mesajı, reklam vaadiyle sayfa başlığı uyumu, sosyal kanıt, fiyat/teklif netliği ve CTA görünürlüğü conversion rate'i belirler.
- Lead formunda soru sayısı ile kalite arasında denge gerekir. Çok kısa form düşük kalite, çok uzun form düşük hacim getirir.
- E-ticarette ürün sayfası, sepet, ödeme adımı, kargo bilgisi, iade/güven unsurları ve stok/fiyat doğruluğu advertising ekonomisini belirler.

| Funnel aşaması | Meta metriği | Site/CRM metriği | Sorun teşhisi |
|-----------------|---------------|-------------------|----------------|
| Ad impression | CPM/Frequency | - | Inventory/quality |
| Click | CTR/CPC | Session count | Kreatif ve teklif |
| Landing | LPV rate | Bounce, speed | Sayfa hız/uyum |
| Form/Cart | Lead/ATC | Form completion/cart rate | UX/niyet |
| Checkout | IC/Purchase | Checkout CVR | Ödeme/kargo/güven |
| Post-sale | ROAS | Refund, LTV | Gerçek kârlılık |

### 11. Kreatif Test Sistemi: Angle, Hook, Format, Offer

| Angle | Test yapısı | Başarı metriği | Sonraki aksiyon |
|-------|--------------|-----------------|------------------|
| Problem çözümü | 3 hook + 2 format + 2 CTA | CTR + CVR + CPA/ROAS | Kazananı varyasyonla genişlet |
| Fiyat/teklif | 3 hook + 2 format + 2 CTA | CTR + CVR + CPA/ROAS | Kazananı varyasyonla genişlet |
| Sosyal kanıt | 3 hook + 2 format + 2 CTA | CTR + CVR + CPA/ROAS | Kazananı varyasyonla genişlet |
| Karşılaştırma | 3 hook + 2 format + 2 CTA | CTR + CVR + CPA/ROAS | Kazananı varyasyonla genişlet |
| Acaliyet | 3 hook + 2 format + 2 CTA | CTR + CVR + CPA/ROAS | Kazananı varyasyonla genişlet |
| Garanti/güven | 3 hook + 2 format + 2 CTA | CTR + CVR + CPA/ROAS | Kazananı varyasyonla genişlet |
| Demo/kullanım | 3 hook + 2 format + 2 CTA | CTR + CVR + CPA/ROAS | Kazananı varyasyonla genişlet |
| Önce-sonra | 3 hook + 2 format + 2 CTA | CTR + CVR + CPA/ROAS | Kazananı varyasyonla genişlet |

- Kreatif testinde tek değişken prensibi korunmalıdır. Hem kitle hem kreatif hem bütçe aynı anda değişirse öğrenme çıkarımı yapılamaz.
- UGC, demo, founder story, problem/solution, testimonial, comparison ve offer-led kreatifler ayrı hipotezlerdir.
- Kreatif yorgunluğu için sadece frequency değil, son 7 gün CTR decay, CPA artışı, comment sentiment ve conversion rate trendi izlenir.
- Meta Advantage+ creative özellikleri test edilebilir; ancak regülasyonlu sektörlerde otomatik metin/görsel değişiklikleri marka ve uyumluluk açısından kontrol edilmelidir.

### 12. Sector Playbook

| Sektör | Ana objective | Optimizasyon | Kritik unsur | Ana KPI |
|--------|----------------|---------------|---------------|---------|
| E-ticaret | Sales/ASC/Catalog | Purchase/value | Feed, Pixel+CAPI, marj, stok | ROAS + MER |
| Hizmet/teklif | Leads | Lead/Qualified Lead | Form kalite, hızlı dönüş | CPL + SQL rate |
| Gayrimenkul | Leads | Lead/Appointment | Nitelik soruları, lokasyon | Randevu/satış |
| Sağlık/estetik | Leads/Messaging | Qualified inquiry | Policy, güven, rıza | Kaliteli başvuru |
| Eğitim | Leads/Sales | Lead/Application/Purchase | Karar döngüsü, remarketing | Başvuru/kayıt |
| Mobil app | App promotion | Install/App event | SDK, SKAN, event kalitesi | CPA/LTV |
| B2B SaaS | Leads/Traffic destek | Demo/Trial/SQL | CRM feedback, uzun döngü | Pipeline value |
| Lokal restoran/etkinlik | Awareness/Engagement/Leads | Reservation/message | Coğrafya, frekans | Rezervasyon |

### 13. Remarketing ve Incrementality

- Remarketing her zaman kârlı görünür çünkü zaten niyetli kullanıcıları toplar. Gerçek katkı incremental lift ile sorgulanmalıdır.
- Küçük remarketing kitlesine fazla bütçe verilirse frekans şişer ve yeni müşteri büyümesi düşer.
- Sepet terk, ürün görüntüleyen, checkout başlatan, video izleyen ve mevcut müşteri segmentleri aynı niyette değildir.
- Mevcut müşteri satış ile yeni müşteri kazanımı ayrı raporlanmalıdır.

| Segment | Pencere | Mesaj | Risk |
|---------|---------|-------|------|
| ViewContent | 7-14 gün | Ürün faydası/sosyal kanıt | Düşük niyet olabilir |
| AddToCart | 1-14 gün | Sepet hatırlatma/teklif | Aşırı indirim alışkanlığı |
| InitiateCheckout | 1-7 gün | Güven/kargo/ödeme kolaylığı | Küçük kitle/frequency |
| Past buyers | 30-180 gün | Cross-sell/upsell | Yeni müşteri bütçesini yeme |
| Lead opened not submitted | 1-7 gün | Form tamamlama/itiraz giderme | Düşük hacim |

### 14. A/B Test ve Experiment Disiplini

- A/B testte hipotez net olmalıdır: objective mi, kreatif mi, audience mı, placement mı, landing page mi?
- Yeterli sample size olmadan kazanan ilan edilmez. Birkaç conversion ile karar almak hatalıdır.
- Test süresince dış müdahale azaltılır. Aynı anda kampanya bütçesi, kreatif, hedefleme ve landing değiştirilmez.
- Lift test veya holdout yaklaşımı büyük bütçelerde gerçek incremental katkıyı ölçmek için gerekir.

| Test konusu | Doğru kurgu | Yanlış kurgu |
|--------------|--------------|---------------|
| Kreatif | Aynı audience/bütçe, farklı creative angle | Aynı anda audience değiştirmek |
| Audience | Aynı kreatif/offer, farklı audience | Farklı kreatiflerle audience kıyaslamak |
| Landing | Aynı reklam, farklı landing | Farklı kampanyalarla kıyas |
| Offer | Aynı segment, farklı teklif | Sezon etkisini yok saymak |

### 15. Policy, Review ve Hesap Riski

- Policy riski medya satın alma riskidir. Reddedilen reklamlar, hassas iddialar, önce/sonra görselleri, kişisel özellik ima eden metinler ve yanıltıcı vaatler hesabı etkiler.
- Reklam metinlerinde "senin hastalığın", "kilolusun", "borçlusun" gibi kişisel özellik ima eden doğrudan hitaplar risklidir.
- Landing page de policy kontrolüne dahildir. Reklam uygun olsa bile sayfa iddiaları veya eksik bilgiler sorun yaratabilir.
- Hesap kapanma riskine karşı varlık sahipliği, domain, ödeme ve admin erişimleri düzenli tutulmalıdır.

| Risk alanı | Örnek | Güvenli yaklaşım |
|-------------|-------|-------------------|
| Kişisel özellik | "Kilo veremiyor musun?" | Genel problem dili |
| Abartılı vaat | "7 günde garanti sonuç" | Kanıtlanabilir, ölçülü vaat |
| Finans/sağlık | Hızlı kazanç/tedavi garantisi | Uyumlu bilgi ve disclaimer |
| Önce-sonra | Agresif görsel kıyas | Politika uyumlu kanıt/görsel |
| Yanıltıcı landing | Fiyat/gizli ücret | Şeffaf teklif ve koşullar |

### 16. Naming Convention ve Veri Modeli

- İsimlendirme analizin altyapısıdır. Kampanya isimleri okunamıyorsa rapor otomasyonu, dashboard ve geçmiş analiz bozulur.
- İsimlendirme; ülke, objective, funnel, offer, audience, creative angle ve tarih gibi karar değişkenlerini taşımalıdır.
- UTM ile Meta naming tutarlı olmalıdır; aksi halde GA4/CRM eşleştirmesi zorlaşır.

| Alan | Örnek | Açıklama |
|------|-------|----------|
| Campaign | TR_SALES_PURCHASE_BROAD_MAIN_2026Q2 | Ülke + objective + event + yapı + dönem |
| Ad set | BROAD_ADVPLUS_18-55_TR_AUTO | Audience ve kontrol bilgisi |
| Ad | UGC_PROBLEM_HOOK1_VIDEO9x16_CTA1 | Kreatif değişkenleri |
| UTM campaign | TR_SALES_PURCHASE_BROAD_MAIN_2026Q2 | Campaign ile aynı |
| UTM content | UGC_PROBLEM_HOOK1_VIDEO9x16 | Ad creative analizi |

### 17. Günlük, Haftalık, Aylık Operasyon Ritimleri

| Periyot | Kontrol | Yapılacak aksiyon | Yapılmayacak hata |
|---------|---------|--------------------|---------------------|
| Günlük | Delivery, spend, policy, tracking, büyük anomali | Kritik hata varsa müdahale | Veri azken kampanya kapatma |
| 2-3 günde bir | CTR, CPM, CPC, early CPA/CPL | Kreatif yorumları ve anomali notu | Her gün bütçe oynama |
| Haftalık | CPA/ROAS, CRM kalite, kreatif fatigue | Bütçe/kreatif/offer kararı | Tek metrikle karar |
| Aylık | MER, LTV, cohort, scaling | Strateji ve yapı revizyonu | Sadece Ads Manager raporu |

### 18. Advanced Troubleshooting Playbooks

> Not: Orijinal PDF'te alt başlıklar ayrı, madde numaralandırması (17-35) aralıksız devam etmektedir; aynen korunmuştur.

#### Harcamıyor
17. Delivery column kontrol edilir.
18. Fatura, spending limit, schedule, review ve account status kontrol edilir.
19. Audience çok küçük mü, bid/cost cap çok sert mi, optimization event çok az mı kontrol edilir.
20. Çözüm: cap gevşet, audience genişlet, campaign/adset konsolide et, policy/fatura sorununu çöz.

#### Çok harcıyor ama sonuç yok
21. Objective/event doğru mu kontrol edilir.
22. Pixel/CAPI event zinciri test edilir.
23. CTR iyi mi kötü mü ayrıştırılır. CTR iyi CVR kötü ise landing/offer sorunudur.
24. Kreatif vaadi ve sayfa vaadi eşleştirilir; funnel raporu çıkarılır.

#### Lead çok ama kalite kötü
25. Form sürtünmesi artırılır: higher intent, nitelik soruları, koşullu sorular.
26. CRM'de MQL/SQL/satış oranı ölçülür.
27. Qualified lead offline event veya CAPI geri bildirimi kurulur.
28. Ucuz CPL hedefinden kalite hedefine geçilir.

#### ROAS dalgalı
29. Conversion delay ve attribution penceresi kontrol edilir.
30. Ürün stok/fiyat/feed sorunları kontrol edilir.
31. Kreatif fatigue ve frequency incelenir.
32. MER ve Shopify/CRM gerçek ciro ile kıyaslanır.

#### CPM ani yükseldi
33. Sezon/rekabet, audience daralması, placement kısıtı, düşük kalite ve policy feedback kontrol edilir.
34. Kreatif yenilenir, placement açılır, audience genişletilir.
35. Sadece CPM sebebiyle kampanya kapatılmaz; CPA/ROAS trendiyle karar verilir.

### 19. Meta Ads Engineer Karar Matrisi

| Karar | Gerekli kanıt | Aksiyon | Aksi halde |
|-------|----------------|---------|-------------|
| Bütçe artır | Stabil CPA/ROAS, yeterli conversion, tracking temiz | Kademeli artır | Bekle/creative test |
| Kampanya kapat | Yeterli spend + kötü CPA/ROAS + tracking doğru | Kapat veya yapıyı revize et | Veri topla |
| Kreatif yenile | CTR decay, frequency, CPA artışı | Yeni angle/format üret | Audience ile oynamaya çalışma |
| Event değiştir | Purchase hacmi çok düşük, learning limited | Geçici üst event test | Yanlış eventte kalma |
| Audience daralt | Geniş kitlede kalite sorunu kanıtlı | Kontrollü test | Daraltma refleksi yapma |
| Placement kapat | Yeterli volume ile negatif CPA/ROAS kanıtı | Manuel exclusion test | CTR'ye bakıp kapatma |
| Cost cap uygula | Birim ekonomi net, hacim yeterli | Kademeli cap | Yeni hesapta sert cap koyma |

### 20. Final Uygulama Standardı

- Meta Ads mühendisliği reklam paneli uzmanlığı değil, veri sistemi yönetimidir.
- Her kampanya kararı; objective, event, audience, creative, budget, measurement ve funnel bağlamında alınmalıdır.
- En büyük hata: yanlış objective ile doğru ayar aramaktır. İkinci büyük hata: ölçüm bozukken optimizasyon yapmaktır. Üçüncü büyük hata: kreatif sorunu audience ayarıyla çözmeye çalışmaktır.
- Güçlü hesaplarda yapı sadedir, veri temizdir, kreatif üretimi süreklidir, CRM geri beslemesi vardır ve kararlar tek günlük metrikle değil trend ve kaliteyle alınır.

---

# Kaynakça

## Temel / Orta Seviye Kaynak Listesi

Bu liste eğitim dokümanını hazırlarken kullanılan ana resmi Meta Business Help kaynaklarını içerir. Facebook sayfaları zaman zaman giriş/erişim engeli gösterebilir; başlık ve URL kaynak referansı olarak bırakılmıştır.

- **Meta Business Help - Create ad campaigns in Meta Ads Manager** — Kampanya, reklam seti ve reklam oluşturma akışı. https://www.facebook.com/business/help/621956575422138
- **Meta Business Help - Choose the right ad objective** — Kampanya amacı seçimi ve hedefle uyum. https://www.facebook.com/business/help/1438417719786914
- **Meta Business Help - ODAX objective changes** — Altı ana amaç: Awareness, Traffic, Engagement, Leads, App promotion, Sales. https://en-gb.facebook.com/business/help/325793898950394
- **Meta Business Help - Available conversion locations and events** — Amaçlara göre dönüşüm konumu ve event seçenekleri. https://www.facebook.com/business/help/2035196646663270
- **Meta Business Help - Advantage+ campaign budget** — Bütçenin reklam setleri arasında otomatik dağıtılması. https://www.facebook.com/business/help/153514848493595
- **Meta Business Help - Set up Advantage+ campaign budget** — Kampanya bütçesi kurulum mantığı. https://www.facebook.com/business/help/343242619559352
- **Meta Business Help - Best practices for Advantage+ campaign budget** — ACB kullanımında en iyi uygulamalar. https://www.facebook.com/business/help/2177212182495139
- **Meta Business Help - Advantage+ placements** — Yerleşimlerin maliyet etkin fırsatlara göre genişletilmesi. https://www.facebook.com/business/help/196554084569964
- **Meta Business Help - Choose ad placements** — Advantage+ placements önerisi ve manuel yerleşim seçimi. https://www.facebook.com/business/help/175741192481247
- **Meta Business Help - Best practices for Meta Ads delivery** — Teslimat sistemi için iyi uygulamalar. https://www.facebook.com/business/help/950694752295474
- **Meta Business Help - Traffic objective** — Traffic amacının web/app hedeflerine trafik göndermesi. https://www.facebook.com/business/help/301780226847564
- **Meta Business Help - About ad formats** — Reklam formatları: görsel, video, carousel vb. https://www.facebook.com/business/help/1263626780415224
- **Meta Business Help - Campaign, ad set and ad limits** — Hesap limitleri ve yapı sınırları. https://www.facebook.com/business/help/652738434773716
- **Meta Business Help - About daily budgets** — Günlük bütçe çalışma mantığı. https://www.facebook.com/business/help/190490051321426
- **Meta Business Help - Advantage+ creative** — Kreatif varyasyonlarının otomatik optimize edilmesi. https://www.facebook.com/business/help/297506218282224

## İleri Seviye Resmi Kaynakça

1. Meta - How to choose the right ad objective in Meta Ads Manager — https://www.facebook.com/business/help/1438417719786914
2. Meta - Update and changes to ad objectives in Meta Ads Manager — https://en-gb.facebook.com/business/help/325793898950394
3. Meta - Create ad campaigns in Meta Ads Manager — https://www.facebook.com/business/help/621956575422138
4. Meta - Platforms supported by each ad objective — https://www.facebook.com/business/help/398040430994666
5. Meta - About the traffic objective — https://www.facebook.com/business/help/301780226847564
6. Meta - About the leads objective — https://www.facebook.com/business/help/387294348401675
7. Meta - About the app promotion objective — https://www.facebook.com/business/help/2083260191704068
8. Meta - Best practices for Meta Ads delivery — https://www.facebook.com/business/help/950694752295474
9. Meta - Best practices for Advantage+ campaign budget — https://www.facebook.com/business/help/2177212182495139
10. Meta - Significant edits and learning phase — https://www.facebook.com/business/help/316478108955072
11. Meta - About learning limited — https://www.facebook.com/business/help/269269737396981
12. Meta - Combine ad sets and campaigns to reduce audience fragmentation — https://www.facebook.com/business/help/2419480091640105
13. Meta - About Advantage+ Audience — https://www.facebook.com/business/help/273363992030035
14. Meta - Choose ad placements in Meta Ads Manager — https://www.facebook.com/business/help/175741192481247
15. Meta - Best practices to reduce cost per result — https://en-gb.facebook.com/business/help/321695409726523
16. Meta - About Conversions API — https://www.facebook.com/business/help/AboutConversionsAPI
17. Meta - Best practices for Conversions API — https://www.facebook.com/business/help/308855623839366
18. Meta - About Event Match Quality — https://www.facebook.com/business/help/765081237991954
19. Meta - Monitor and improve your Conversions API setup — https://www.facebook.com/business/help/586304118741779
20. Meta - Test server events using Test Events tool — https://www.facebook.com/business/help/ServerTestEventsTool
21. Meta - View diagnostics in Events Manager — https://www.facebook.com/business/help/440960283805830
22. Meta - About event parameters — https://www.facebook.com/business/help/308258403676519
23. Meta - About Advantage+ sales campaigns — https://www.facebook.com/business/help/1362234537597370
24. Meta - Best practices for Shops ads — https://www.facebook.com/business/help/6158069234251430
25. Meta - About Advantage+ catalog ads — https://www.facebook.com/business/help/397103717129942
26. Meta - Best practices for omnichannel ad campaigns — https://www.facebook.com/business/help/3616214995338148
27. Meta - About targeting and reporting for Advantage+ app campaigns — https://www.facebook.com/business/help/1153577308409919
28. Meta - Cross-platform traffic or conversion campaigns — https://www.facebook.com/business/help/1011620975524097
29. Meta - Troubleshoot ad delivery — https://www.facebook.com/business/help/844297793050478
30. Meta - Understand fluctuations in ad performance — https://www.facebook.com/business/help/1364841787225722
31. Meta - About Value Rules in Meta Ads Manager — https://www.facebook.com/business/help/535014515741813

## Kaynakların Dokümana Yansıması

- Objective yapısı, Meta'nın ODAX ve "choose objective" dokümanlarına göre hazırlanmıştır.
- Campaign/ad set/ad hiyerarşisi Meta Ads Manager kampanya oluşturma dokümanına göre açıklanmıştır.
- Learning phase, significant edits, learning limited ve delivery best practices bölümleri Meta Business Help kaynaklarından modellenmiştir.
- Pixel/CAPI/Event Match Quality/Dedup/Test Events bölümleri Meta Events Manager ve Conversions API resmi dokümanlarına göre hazırlanmıştır.
- Advantage+ Campaign Budget, Advantage+ Audience, Advantage+ Sales/Catalog bölümleri resmi Meta Advantage dokümanları ve uygulama standardı ile birleştirilmiştir.
