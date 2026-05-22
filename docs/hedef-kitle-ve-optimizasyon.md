# Hedef Kitle & Optimizasyon — Modül Dokümantasyonu

> Son güncelleme: 2026-05-22
> Bu doküman iki modülün **final halini** açıklar: Hedef Kitle (Google entegrasyonu sonrası) ve Optimizasyon.

---

## 1) HEDEF KİTLE

### 1.1 Ne işe yarıyor? Amacı nedir?

Hedef Kitle, kullanıcının reklam **hedef kitlelerini tek panelden** oluşturup yönettiği modüldür. Amaç: kullanıcıyı Meta Ads Manager / Google Ads arayüzlerine girip elle kitle kurmaktan kurtarmak, kitle yönetimini YoAi içine taşımak ve işletme zekâsıyla beslemek.

Platform seçici ile **Meta** ve **Google** arasında geçiş yapılır.

### 1.2 Hangi problemi çözüyor?

- Kullanıcı normalde kitleleri reklam platformlarının kendi (karmaşık) arayüzlerinde kurmak zorunda kalır.
- Hedef Kitle bunu sadeleştirilmiş sihirbazlarla YoAi'ye taşır ve kitleleri kampanyalar arasında yeniden kullanılabilir kılar.
- İşletme profili zekâsı (sektör, lokasyon, hedef kitle acıları/motivasyonları) sihirbaza otomatik **ön-doldurma** olarak akar.

### 1.3 Ne fayda sağlıyor?

- Tüm kitleler tek yerde, sade arayüzle.
- Meta'da gerçek kitle nesneleri (Custom / Lookalike / Saved) doğrudan oluşturulur ve Meta'ya gönderilir.
- Strateji modülü → AI persona → otomatik kitle üretimi zinciri.
- Google'da hesabın gerçek kitleleri ve Google'ın segment kataloğu görüntülenebilir.

### 1.4 Meta tarafı (mevcut, dokunulmadı)

Dört sekme:

| Sekme | Tip | Açıklama |
|------|-----|----------|
| **AI Tabanlı Hedef Kitle** | — | Strateji modülünden onaylanan plana göre AI'ın ürettiği kitleler (`source=STRATEGY`). Abonelik gerektirir. |
| **Detaylı Kitle** | SAVED | Konum + yaş + cinsiyet + dil + ilgi alanı kriterli kayıtlı kitle (Meta Saved Audience). |
| **Benzer Kitle** | LOOKALIKE | Tohum kitleye benzeyen yeni kullanıcılar (Meta Lookalike). |
| **Retargeting** | CUSTOM | Pixel / IG etkileşimi / sayfa ziyareti kaynaklı yeniden pazarlama (Meta Custom Audience). |

**Akış:** Sihirbaz önce `DRAFT` kaydı atar (`POST /api/audiences`), ardından `POST /api/audiences/[id]/create` ile **gerçekten Meta hesabında** kitle oluşturur. Durum makinesi: `DRAFT → CREATING → POPULATING → READY / ERROR`. CREATING/POPULATING varken 30 sn'de bir otomatik poll yapılır. Yalnızca DRAFT kayıtlar düzenlenebilir.

İlgili dosyalar: `app/hedef-kitle/page.tsx`, `components/hedef-kitle/AudienceWizardModal.tsx`, `app/api/audiences/route.ts`, `app/api/audiences/[id]/create/route.ts`, `lib/meta/audiences/payloadBuilder.ts`.

### 1.5 Google tarafı (yeni — 2026-05-22)

**Neden Meta'dan farklı:** Google'da Meta'daki gibi kayıtlı, yeniden kullanılabilir "Detaylı / Benzer / Retargeting kitle nesnesi" sistemi **yoktur**.
- **Benzer Kitle (Similar Audiences):** Google bu nesneyi **1 Ağustos 2023'te tamamen kaldırdı.** Aynı iş artık kampanya seviyesinde otomatik yapılır (Optimized Targeting / PMax Audience Signals / AI Max) — bunlar YoAi kampanya sihirbazlarında zaten mevcuttur.
- **Detaylı / Saved:** Google'da demografi+ilgi'yi paketleyen bağımsız kayıtlı nesne yok; segmentler kampanya/reklam grubu seviyesinde **kriter** olarak uygulanır.
- **Retargeting:** Hesaptaki **user list** (remarketing / müşteri eşleştirme / kombine) nesneleri vardır.

**Sahte-veri kuralı gereği** Google'da çalışmayan bir oluşturma akışı sunulmaz. Bu yüzden Google sekmesi **salt-okunur gerçek veri** gösterir:

| Sekme | İçerik | Veri kaynağı (mevcut read API) |
|------|--------|-------------------------------|
| **Detaylı Kitle** | Google kitle segmenti kataloğu (Satın Alma Niyeti / İlgi Alanı / Detaylı Demografi / Yaşam Olayı) — arama + gözat | `GET /api/integrations/google-ads/tools/audience-segments` |
| **Retargeting** | Hesaptaki gerçek user list'ler (boyut, üyelik süresi, uygunluk) | `GET /api/integrations/google-ads/tools/audience-manager` |
| **Benzer Kitle** | **Gizli** (Google'da nesne yok) | — |
| **AI Tabanlı** | **Gizli** (Strateji → Meta kitleleri üretir) | — |

- Google'da **"+ Yeni Kitle" butonu yoktur** (kitle Google'da kampanya kurulumunda tanımlanır).
- Google Ads bağlı değilse veya veri hazır değilse zarif bir "bağlı değil" durumu gösterilir, çökme olmaz.
- **Entegrasyon koduna dokunulmadı** — yalnızca mevcut read endpoint'leri tüketildi.

**Yeni/değişen dosyalar:**
- `components/hedef-kitle/google/GoogleAudienceView.tsx` (yeni — salt-okunur Google görünümü)
- `components/hedef-kitle/PlatformTabs.tsx` (Google sekmesi aktifleştirildi, "Yakında" rozeti kaldırıldı)
- `app/hedef-kitle/page.tsx` (platform-bazlı sekme listesi, Google görünümü bağlandı, "Business Intelligence Memory bağlı" bandı kaldırıldı)

### 1.6 Kaldırılan: "Business Intelligence Memory bağlı" bandı

Sayfanın üstündeki teknik bilgi bandı (iç jargon) kullanıcıya gösterilmek üzere **kaldırıldı**. Arkasındaki business-context verisi sihirbaz ön-doldurması için **çalışmaya devam eder** (`AudienceWizardModal` içinde); sadece görsel band ve sayfadaki gereksiz `business-context` fetch'i temizlendi.

### 1.7 Hâlâ geliştirilebilecek noktalar

- `audiences` tablosu Meta-only (`platform` kolonu yok). Google kitlelerini YoAi'de **kalıcı** yönetmek istenirse migration gerekir (şu an salt-okunur olduğu için gerekmedi).
- Google Customer Match (CRM upload) arayüzü yok — istenirse ayrı, gerçek bir akış olarak eklenebilir.
- AI Tabanlı sekme yalnızca Strateji bir kitle üretince dolar.

---

## 2) OPTİMİZASYON

### 2.1 Ne işe yarıyor? Amacı nedir?

Optimizasyon, **yayında olan** Meta ve Google reklam kampanyalarının sağlığını ölçen, sorunları tespit eden ve **uygulanabilir öneriler** üreten reaktif bir analiz & öneri sistemidir. Amaç: "Bu kampanya neden kötü performans gösteriyor ve hemen ne yapmalıyım?" sorusunu cevaplamak.

İki sekme: **Meta** ve **Google** (Google burada zaten entegredir).

### 2.2 Hangi problemi çözüyor?

- Kampanya metriklerini elle Ads Manager'da takip edip yorumlamak zordur.
- Optimizasyon, ham metrikleri otomatik **skor + uyarı + öneri**ye çevirir; bazı düzeltmeleri tek tıkla uygular.

### 2.3 Ne fayda sağlıyor?

- Her kampanya için 0–100 sağlık skoru ve durum (excellent → critical).
- 20 sorun tipine karşı somut öneriler (kök neden + aksiyon + beklenen etki).
- Meta'da bazı öneriler **otomatik uygulanabilir** (duraklat / bütçe değiştir / reklam seti kopyala); Google'da uygula akışı (status/budget).

### 2.4 İki katmanlı işleyiş

1. **Skorlama + Uyarı (kredi gerektirmez, kural-tabanlı)**
   - `GET /api/meta/optimization/score` ve `GET /api/google/optimization/score`
   - Meta/Google insights'tan metrikler çekilir; 4 kapıdan skor hesaplanır:
     **Delivery · Efficiency · Quality · Saturation**
   - Composite skor = `0.40×northStar + 0.30×efficiency + 0.15×quality + 0.15×saturation`
   - KPI şablonları: kampanya (objective + optimizationGoal + destination) üçlüsüne göre özel KPI seti (`lib/meta/optimization/kpiRegistry.ts`).

2. **Magic Scan (Tarama)**
   - `POST /api/meta/optimization/magic-scan` / `POST /api/google/optimization/magic-scan`
   - **Deterministic (her zaman çalışır):** 20 sorun tipi (ProblemTagId) için şablon öneriler.
   - **AI (opsiyonel):** `useAI=true` + Claude API varsa, kampanya + metrikler Claude'a gönderilip zenginleştirilmiş öneri alınır. Claude yavaş/başarısızsa deterministic fallback'e düşer.

### 2.5 "AI ile Tara" vs "AI ile Tara Pro"

- **AI ile Tara:** Temel AI tarama — **abonelik** gerektirir.
- **AI ile Tara Pro:** Günlük AI scan limiti aşıldığında **kredi** tüketir (`consumeAiScan()` / `COST_PER_AI_SCAN`). Limit aşımında `402 + AI_SCAN_LIMIT` → kredi modalı (`AccessRequiredModal type="credit"`).
- Günlük limit `plan.aiScanDailyLimit` (0 = limitsiz Premium).

### 2.6 Sorun tipleri (ProblemTagId — 20 adet)

- **Teslimat:** NO_DELIVERY, INSUFFICIENT_DATA
- **Maliyet:** HIGH_CPC, HIGH_CPM, HIGH_CPL, HIGH_CPA
- **Getiri:** LOW_ROAS, NEGATIVE_ROAS
- **Doygunluk:** HIGH_FREQUENCY, CRITICAL_FREQUENCY
- **Kalite:** QUALITY_BELOW_AVERAGE, ENGAGEMENT_BELOW_AVERAGE, CONVERSION_BELOW_AVERAGE
- **Huni:** LPV_DROP, FUNNEL_BOTTLENECK
- **Yapı:** BUDGET_UNDERUTILIZED, ADSET_IMBALANCE, SINGLE_ADSET_RISK

### 2.7 Öneri kategorileri ve uygulama

| Kategori | Anlamı | Örnek |
|----------|--------|-------|
| **AUTO_APPLY_SAFE** | Düşük riskli, otomatik uygulanabilir | NO_DELIVERY → duraklat, NEGATIVE_ROAS → duraklat |
| **REVIEW_REQUIRED** | İnsan onayı gerekir | Bütçe %15–50 artır/azalt, hedefleme değişikliği |
| **TASK** | Manuel görev (changeSet yok) | Kreatif yenile, açılış sayfasını optimize et, formu sadeleştir |

- **Meta uygulama:** `executeChangeSet()` → `/api/meta/campaigns/status|budget`, `/api/meta/adsets/duplicate`. `rollbackChangeSet()` ile geri alma.
- **Google uygulama:** `POST /api/google/optimization/apply` (status/budget).
- **Geçmiş:** `POST/GET /api/yoai/optimization/recommendations` ile tarama sonucu (before snapshot) saklanır.

### 2.8 Erişim bariyeri

- **Abonelik gerekli:** Optimizasyon modülünün tamamı (`requireOptimizationAccess()`).
- **Kredi gerekli:** AI ile Tara Pro (günlük limit aşımı).
- **Owner bypass:** `SUPER_ADMIN_EMAILS` allowlist (default `onursuay@hotmail.com`).

### 2.9 Optimizasyon vs YoAlgoritma (çakışmaz, tamamlar)

| Özellik | Optimizasyon | YoAlgoritma |
|---------|--------------|-------------|
| Amaç | Kampanya sağlığını **tanı + hemen düzelt** (reaktif) | Hiyerarşik reklam **geliştirme kartları** (proaktif) |
| Kapsam | Kampanya seviyesi metrikler | hesap → kampanya → ad set → reklam (4 seviye) |
| Veri | Meta/Google insights (anlık) | Per-campaign Batch API tarama (haftalık cron) |
| Tetikleme | Kullanıcı "Tara" der | Otomatik (Pazar gece cron + admin event) |
| Uygulama | Meta: status/budget; Google: advisory | Reklam onayı → mevcut AdCreationWizard |

### 2.10 Kritik dosyalar

- Sayfa: `app/optimizasyon/page.tsx`, `app/optimizasyon/layout.tsx`
- API: `app/api/meta/optimization/{score,magic-scan}/route.ts`, `app/api/google/optimization/{score,magic-scan,apply}/route.ts`, `app/api/yoai/optimization/recommendations/route.ts`
- AI & kural: `lib/meta/optimization/aiRecommender.ts`, `lib/google/optimization/recommender.ts`, `lib/meta/optimization/ruleEngine.ts`, `lib/meta/optimization/scoring.ts`, `lib/meta/optimization/kpiRegistry.ts`
- UI: `components/optimization/` (CampaignCard, MagicScanResults, DetailPanel, RecommendationCard, GoogleCampaignCard, GoogleScanResults …)

---

## 3) Bu dokümanda kayıtlı değişiklikler (2026-05-22)

1. Hedef Kitle: Google sekmesi **aktifleştirildi** ve salt-okunur gerçek veri görünümü eklendi (segment kataloğu + user list'ler).
2. Hedef Kitle: Google'da **Benzer Kitle** ve **AI Tabanlı** sekmeleri gizlendi (Google'da karşılık gelen nesne yok).
3. Hedef Kitle: **"Business Intelligence Memory bağlı"** bandı kullanıcı arayüzünden kaldırıldı.
4. Meta ve Google **entegrasyon koduna dokunulmadı**; DB migration yapılmadı (Google salt-okunur).
