# Uzman Kampanya Planı — Tasarım (Alt-Proje A, Faz A1)

**Tarih:** 2026-06-10 · **Durum:** Onaylandı · **Sıra:** C ✅ → B ✅ → **A1 (bu)** → A2 (YoAlgoritma'ya taşıma)

## Amaç
Markadan (Strateji girdisi) **eksiksiz, gerekçeli** uzman kampanya planı üret: hedef kitle, lokasyon (akıl yürütmeli), demografi, amaç/dönüşüm, bütçe (günlük + ROI gerekçeli), CTA, ikna edici çoklu-varyant reklam metni. Mevcut **Strateji modülü genişletilir**; çıktı **advisory** (öneri+gerekçe), uygulama mevcut AdCreationWizard'dan.

## Kararlar (kilitli)
1. **Yapı:** Mevcut Strateji'yi genişlet (yeni motor değil).
2. **Davranış:** Advisory — plan + gerekçe üret/göster; publish'e dokunma.
3. **Kapsam (A1):** Akıl yürütme + metin birlikte. **Yalnız Strateji** (YoAlgoritma'ya taşıma = A2, sonra).
4. **Güvenlik:** Flag `EXPERT_PLAN_ENABLED` default-off; Strateji abonelik guard'ı yeniden kullanılır.

## Çekirdek tip: ExpertCampaignPlan (platform başına)
```
ExpertCampaignPlan {
  platform: 'meta' | 'google'
  audience      { summary, pains[], motivations[], reasoning }
  location      { countries[], cities[], reasoning }   // "kim, nerede alır"
  demographics  { ageMin, ageMax, genders: 'all'|'male'|'female', reasoning }
  objective     { value, label, reasoning }            // value deterministik (goal→objective)
  conversionGoal{ value, label, reasoning }
  budget        { dailyMin, dailyRecommended, currency:'TRY', reasoning }
  cta           { value, label, reasoning }            // allowed_values'a göre doğrulanmış
  copy          { variants:[{headline, primaryText, description}]×3-5, voiceNote, reasoning }
  warnings[]                                            // korkuluk notları
}
```
Tüm `reasoning` sade Türkçe; ham enum gerekçe metninde YASAK (yalnız `value`'da).

## Motor (`lib/strategy/expertPlan.ts` — yeni)
1. **Bağlam:** `InputPayload` (product, industry, geographies, goal_type, monthly_budget, avg_basket/margin/ltv) + onaylı bilgi (`getApprovedKnowledgeByPlatform`, B) + `sectorLocationIntelligence`.
2. **Claude** (`claudeJson`, temp 0.3, DI'li → test) → ham plan (audience/location/demographics/budget/cta/copy + reasoning).
3. **Deterministik korkuluklar:**
   - **Amaç** value'su `goal_type`→objective deterministik map'ten (AI yalnız reasoning); platforma göre.
   - **Bütçe** `dailyMin/dailyRecommended` platform/amaç **min'in altına inemez** (`minBudget` + onaylı bilgi `rules_json.minBudget`).
   - **CTA** onaylı bilgideki `allowed_values`'a göre doğrula; geçersizse güvenli varsayılan + warning.
   - **Lokasyon** Türkçe-bilinçli normalize (İstanbul/İ bug fix); bilinmeyen şehir → warning.
   - **Metin** karakter limitlerine göre doğrula/uyar (publish validator limitlerini OKUR, dokunmaz).
   - `isClaudeReady()` false → boş plan + warning (sahte veri yok).

## İstanbul/İ lokasyon bug fix
Yeni paylaşılan util `lib/yoai/turkishText.ts` (`normalizeTrLower`, `cityIncludes`). `businessSourceScanner.extractLocations` Türkçe-bilinçli eşlemeye geçer (büyük "İstanbul" artık yakalanır). Regresyon testi.

## API
`POST /api/strategy/instances/[id]/expert-plan` — abonelik/owner guard; instance `InputPayload` oku; aktif kanal(lar) (channels.meta/google) için plan üret; `{ plans: { meta?, google? }, generatedAt }` döner. Flag kapalıysa `{ disabled: true }`.

## UI
`components/strateji/ExpertPlanView.tsx` — detay sayfası `app/strateji/[id]/[[...tab]]/` içine yeni **"Uzman Plan"** sekmesi/paneli. Platform başına: her karar + gerekçe kartı + metin varyantları. Proje standardı (max-w-7xl, text-base başlık, animate-card-enter, hover, amber yok). **i18n tr+en zorunlu.**

## Güvenlik / dokunulmaz
- Flag default-off → kapalıyken Strateji bugünküyle aynı (sıfır regresyon).
- Meta/Google publish, AdCreationWizard, adCreator/publishValidator (yalnız limit okunur), Apify, sosyal **dokunulmaz**.
- Migration yok (plan on-demand üretilir; istenirse blueprint JSONB'ye cache — opsiyonel, şema değişmez).

## Test
Motor (claudeJson mock: alanlar + reasoning, boş-claude, guardrail'ler), bütçe clamp, CTA doğrulama, objective deterministik map, Türkçe normalize/İstanbul fix (+ extractLocations regresyon), platform seçimi. UI i18n.

## Kapsam dışı (A2 / sonra)
YoAlgoritma ad_spec'e taşıma, plan→wizard otomatik prefill, rakip-veri derin entegrasyonu, otomatik publish.
