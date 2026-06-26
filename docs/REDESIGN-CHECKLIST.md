# DijiMagic — Rebrand + Landing Yeniden Tasarım · Kontrol Checklist
> Tarih: 2026-06-26 · Owner kontrolü için. Her madde canlıda; **dijimagic.com**'da doğrula.

## ✅ TAMAMLANDI — canlıda (kontrol et)

### A. Rebrand (YoAi → DijiMagic)
- [ ] Site genelinde "DijiMagic" adı (logo, başlıklar, footer)
- [ ] Tarayıcı sekmesi başlığı (ana sayfa): **DijiMagic | Yeni Nesil Dijital Pazarlama Ajansı**
- [ ] Dashboard başlığı sadece **DijiMagic** (eski "DijiMagic Dashboard" düzeltildi)
- [ ] Vercel ortam değişkenlerinde yoai izleri temizlendi (isim + değer)
- [ ] Meta Developer: webhook + OAuth (#3) DijiMagic'e geçti

### B. Landing yeniden tasarım (iyzads ilhamlı, birebir kopya değil)
- [ ] Zemin açıldı (#161d28) — eski boğucu karanlık gitti
- [ ] **Mor renk tamamen kaldırıldı** (emerald/teal palet)
- [ ] Hero başlığı büyük + emerald gradient akış animasyonu
- [ ] **/ozellikler** sayfası: 15 modül, gruplu toggle, her gruba özel layout
- [ ] Header "Ürün" mega-menü: 15 modül / 4 grup → ilgili özellik bölümüne gider
- [ ] **Nasıl Çalışır** sekmeleri: Strateji / Optimizasyon / Tasarım (sağda video alanı — gerçek video sonra)
- [ ] **İstatistik şeridi:** 500+ kullanıcı · %97 memnuniyet · 150K+ reklam · 40M+ erişim
- [ ] **Partner rozetleri:** Meta Business Partner + Google Partner
- [ ] **Kimler Kullanabilir:** 6 segment (Yerel İşletme, E-Ticaret, Ajans, Girişimci, Danışman, Kurumsal)
- [ ] **Gerçek Kullanıcı Yorumları:** 9 yorum, sadece isim-soyisim (marka adı yok), 5 yıldız

### C. URL yapısı (/tr/ — Faz 1c)
- [ ] /tr/ozellikler ve /tr/fiyatlandirma → Türkçe açılıyor
- [ ] /en/ozellikler → İngilizce açılıyor
- [ ] Eski bare yollar (/ozellikler) + dashboard (/login vb.) bozulmadı

### D. Deneme süresi 14 → 7 gün
- [ ] Tüm altyapı (planlar, fatura, abonelik) 7 gün
- [ ] Site içi tüm metinler "7 gün ücretsiz"
- [ ] NOT: Yasal **cayma hakkı 14 gün** ayrıdır ve zorunludur (deneme ≠ cayma) — korundu

### E. Yasal yapı (Story77 — geçici, minimal)
- [ ] Mesafeli satış + Ön bilgilendirme: Satıcı = **Story 77 Creative ... Ltd. Şti.** (VKN 7811085924, Beytepe/Çankaya)
- [ ] İletişim / Footer / Hakkımızda = **sadece DijiMagic** (Story77 karışmıyor)

---

## ✅ ÇÖZÜLDÜ (gece içinde — sende iş yok)
- [x] **Resend** dijimagic.com **VERIFIED** → production gönderen mail `FROM_EMAIL` = "DijiMagic <info@dijimagic.com>" yapıldı (eski "YO Dijital ... <info@yodijital.com>" değişti). Redeploy ile canlı. *(yodijital.com Resend'den silinmedi — başka projeler kullanıyor olabilir.)*

---

## 🌙 GECE OTONOM DOĞRULAMA (ben yaptım — bilgi)
- [x] **TypeScript tip kontrolü** (`tsc --noEmit`) → 0 hata, tüm değişiklikler tip-güvenli
- [x] **Mobil QA** (gerçek cihaz emülasyonu / Chrome DevTools Protocol, 390px) → ana sayfa + /ozellikler `scrollWidth=390`, yatay taşma YOK, kırpılma YOK. *(Not: ilk `--window-size` screenshot'ları sahte "kırpık" gösterdi; CDP ile kesin doğrulandı — mobil sorunsuz.)*
- [x] **Rebrand kalıntı taraması** → kullanıcı-yüzlü **0 yoai/yodijital izi** (temiz). .env backup'ları git-DIŞI (sızıntı yok).
- [x] **EN/TR parite** → TrustStats partner etiketleri TR'ye lokalize (Meta/Google "İş Ortağı"). Amber/sarı renk YOK.

## 🙋 SADECE SEN YAPABİLİRSİN (bende teknik olarak imkânsız)
- [ ] **Cloudflare Turnstile** *(kayıt doğrulaması bug'ı — #2 sorunun; KÖK NEDEN bulundu)* → site key eski domaine kilitli. Yapılacak: Cloudflare paneli → **Turnstile** → site key `0x4AAAAAACvDYQEwzjn9xWLF` → **Allowed Domains** → `dijimagic.com` + `www.dijimagic.com` ekle (eski `yoai.yodijital.com`'u sil) → Kaydet. *(Kod doğru; Cloudflare API token olmadığı için bende yapılamaz.)*
- [ ] **Müşteri logoları** → gerçek marka adı + web sitelerini ver, logo şeridini eklerim.
- [ ] **#3 Kart doğrulama ücreti** → KARAR gerek. **Önerim: Pre-Auth (provizyon)** — kayıtta 1 TL bloke edilir, hemen serbest bırakılır (24s içinde iz bırakmadan iptal). En güvenli + müşteri-dostu; iyzico destekliyor; **gerçek tahsilat olmadığı için cayma hakkıyla çelişmez.** Alternatifler: tahsil+iade veya tahsil-iade-yok (iyzads gibi ama net ToS + yasal risk). Karar: hangi yöntem + tutar? Karar gelince kurarım (lib/billing + iyzico preauth + signup akışı).
- [ ] **Videolar** → en son beraber (nasıl çekeceğimizi konuşacağız).
