# Web Site Yöneticisi — Kod-Üretim Motoru: Bölüm 9–15 (Teknik Plan)

- **Tarih:** 2026-06-18
- **Durum:** Tasarım eki (2026-06-17 codegen-design.md'nin devamı)
- **Kapsam:** State machine'ler, kredi sistemi, domain/publish, visual editing, kod-hatası onarımı, responsive header/footer kalite, güvenlik
- **Önkoşul:** Mevcut DB-servis modeli (`app/(sites)/s/[subdomain]`), `WEBSITE_CODEGEN_V2`, `chargeFeature`, `credit_transactions` ledger, `applyBlockPatch`/`patchPlanner`/`blockMap`, Vercel Domains/Edge Config altyapısı korunur. Meta/Google entegrasyonuna (`lib/meta/*`, `lib/google/*`) dokunulmaz.

> **Kilit kararlar (değişmez):** Kullanıcı Vercel/GitHub görmez; `.vercel.app` gizlenir; dashboard'a sıkışmış dar önizleme yok (yeni sekmede markalı preview URL); kredi tahmini create-modal'da gösterilmez (tüketim işlem sırasında adım-adım); AI her şeyi sıfırdan kodlamaz (template/component library ana yapı) ama siteler birbirinin kopyası değil (dynamic composition + anti-clone); visual editing MVP'de; seçili-alan PATCH (her revizede tüm site yeniden üretilmez); domain satın alma MVP sonrası; Türkiye için manuel DNS ana akış; mobil header/hamburger şeffaf değil + okunabilir + açılıp-kapanır + kapat-iconu + açık-kalma-bug'ı yok; header/footer başlıkları PC/tablet/mobilde alt satıra kaymaz; footer yılı current.

---

## BÖLÜM 9 — State Machine Planı (8 Makine)

Her makine bir TS union tipi + geçiş tablosu olarak `lib/website/state/` altında tanımlanır. State değerleri DB'de ilgili tabloda kolon/jsonb olarak persist edilir; geçişler tek noktadan (`transition(machine, from, event)`) doğrulanır — geçersiz geçiş atılır (invariant koruma).

### 9.1 Domain Status (`websites.theme.domainStatus` / `website_domains.status`)

Dosya: `lib/website/state/domainStatus.ts`

States: `not_started | adding_to_project | dns_required | pending_verification | verification_failed | ssl_pending | active | redirect_active | error`

| From | Event | To |
|------|-------|-----|
| not_started | USER_ADDS_DOMAIN | adding_to_project |
| adding_to_project | VERCEL_ATTACH_OK (DNS gerekli) | dns_required |
| adding_to_project | VERCEL_ATTACH_FAIL | error |
| dns_required | USER_CLICKS_CHECK | pending_verification |
| pending_verification | VERCEL_CONFIG_VERIFIED | ssl_pending |
| pending_verification | VERCEL_CONFIG_MISCONFIGURED | verification_failed |
| verification_failed | USER_CLICKS_CHECK (retry) | pending_verification |
| ssl_pending | CERT_ISSUED (apex) | active |
| ssl_pending | CERT_ISSUED (www + apex redirect) | redirect_active |
| ssl_pending | CERT_FAIL | error |
| active / redirect_active | DNS_DROPPED (periyodik kontrol) | verification_failed |
| active / redirect_active | USER_REMOVES_DOMAIN | not_started |
| error | USER_RETRY | adding_to_project |

- `redirect_active` = apex→www 308 redirect kuralı kuruldu + www prod sertifikası aktif.
- `not_started` dışındaki her state UI'da Türkçe etiketle gösterilir (ham enum yasak): "DNS kayıtları bekleniyor", "Doğrulanıyor…", "Doğrulama başarısız", "SSL sertifikası hazırlanıyor", "Yayında", "Yönlendirme aktif", "Hata".

### 9.2 Deploy Status (`website_deployments.status`)

Dosya: `lib/website/state/deployStatus.ts`

States: `queued | building | ready | failed | canceled | redeploying`

| From | Event | To |
|------|-------|-----|
| (init) | PUBLISH_REQUESTED | queued |
| queued | BUILD_STARTED | building |
| queued | USER_CANCEL | canceled |
| building | BUILD_OK + GATE_OK | ready |
| building | BUILD_FAIL / GATE_FAIL | failed |
| building | USER_CANCEL | canceled |
| ready | REPAIR_OR_REVISION_PUBLISH | redeploying |
| failed | RETRY | queued |
| redeploying | BUILD_OK | ready |
| redeploying | BUILD_FAIL | failed |

- DB-servis modelinde "build" = renderGate + assembleDocument + ISR purge; `failed` → canlıya çıkmaz, son `ready` snapshot servis edilmeye devam eder.
- `redeploying` boyunca eski `published_version_id` canlı kalır (zero-downtime); yeni snapshot hazır olunca atomik pointer swap.

### 9.3 Publish Popup (`Yayınla` modal — client state, persist edilmez)

Dosya: `components/website/publish/usePublishFlow.ts`

States: `select_option | search_domain | bring_existing_domain | temporary_publish | dns_instructions | checking_dns | success | failed`

| From | Event | To |
|------|-------|-----|
| (open) | — | select_option |
| select_option | CHOOSE_SEARCH_DOMAIN (MVP sonrası) | search_domain |
| select_option | CHOOSE_BRING_DOMAIN | bring_existing_domain |
| select_option | CHOOSE_TEMPORARY | temporary_publish |
| bring_existing_domain | DOMAIN_SUBMIT_OK | dns_instructions |
| bring_existing_domain | DOMAIN_SUBMIT_FAIL | failed |
| dns_instructions | CLICK_CHECK_RECORDS | checking_dns |
| checking_dns | DNS_VERIFIED | success |
| checking_dns | DNS_NOT_READY | dns_instructions (uyarı ile geri) |
| temporary_publish | TEMP_PUBLISH_OK | success |
| temporary_publish | TEMP_PUBLISH_FAIL | failed |
| search_domain | (MVP'de disabled — "Yakında") | select_option |
| failed | RETRY | select_option |
| success | CLOSE | (kapanır) |

- `temporary_publish` = markalı preview URL ile anında yayın (`*.preview.dijimagic-domain.com` veya alt adres). `success` ekranında yeni sekmede açılan markalı URL gösterilir, `.vercel.app` asla görünmez.
- `search_domain` MVP'de görünür ama disabled "Yakında" rozetiyle.

### 9.4 Credit Charging (per-generation; ledger = `credit_transactions`)

Dosya: `lib/website/state/creditCharge.ts`

States: `estimate_internal_only | reserve | consume_step | completed | refunded | failed | no_credit_platform_repair`

| From | Event | To |
|------|-------|-----|
| (start) | COMPUTE_COST (sadece backend, UI'a gönderilmez) | estimate_internal_only |
| estimate_internal_only | RESERVE_OK (`spend_credits` atomik) | reserve |
| estimate_internal_only | RESERVE_INSUFFICIENT | failed (402 → AccessRequiredModal credit) |
| reserve | STEP_CONSUMED (adım-adım ilerleme) | consume_step |
| consume_step | NEXT_STEP | consume_step |
| consume_step | ALL_STEPS_DONE + GATE_OK | completed |
| consume_step | GENERATION_ERROR | refunded (`refund_credits`) |
| reserve | PLATFORM_ERROR (Vercel/GitHub/deploy hatası) | no_credit_platform_repair |
| no_credit_platform_repair | REFUND_FULL | refunded |
| completed | — | (terminal) |
| refunded | — | (terminal) |

- **`no_credit_platform_repair`** = platform/altyapı kaynaklı hata (kullanıcı kusuru değil) → kredi DÜŞMEZ, tam iade + "Kod Hatası"/onarım akışı tetiklenir. Kod-hatası onarımı (Bölüm 13) her zaman bu yola girer.
- `estimate_internal_only`: create-modal'da hiçbir rakam gösterilmez; tahmin yalnız backend reserve için kullanılır. Tüketim, generation pipeline adımlarıyla senkron (adım-adım) UI'da gösterilir.

### 9.5 Site Generation (pipeline; UI step bar)

Dosya: `lib/website/state/generation.ts` (mevcut codegen pipeline'a 1:1 map)

States: `analyzing_prompt | analyzing_reference_sites | extracting_design_dna | selecting_template | selecting_section_variants | creating_blueprint | generating_content | preparing_assets | creating_pages | rendering_components | committing_to_github | deploying_to_vercel | preview_ready`

Doğrusal akış (her adım `consume_step` ile kredi tüketim göstergesi tetikler):

```
analyzing_prompt            → buildCodegenContext (prompt + karantina)
analyzing_reference_sites   → scanReferences()
extracting_design_dna       → designSystem.ts (Opus)
selecting_template          → template/component library seçimi (anti-clone seed)
selecting_section_variants  → multipagePlan section variant ataması
creating_blueprint          → multipagePlan.ts (sitemap)
generating_content          → htmlGenerate.ts (Opus, sayfa başına)
preparing_assets            → görsel çözümleme (stock/Magnific)
creating_pages              → replacePages (DB)
rendering_components        → sanitizeHtml + renderGate + assembleDocument
committing_to_github        → DB-servis modelinde NO-OP (UI'da gösterilmez) / per-site modelde git push
deploying_to_vercel         → ISR purge / deploy (UI'da "Yayına hazırlanıyor")
preview_ready               → markalı preview URL hazır
```

- `committing_to_github` ve `deploying_to_vercel` adımları kullanıcıya GitHub/Vercel ismiyle GÖSTERİLMEZ — UI etiketleri "Sayfalar hazırlanıyor", "Yayına hazırlanıyor". DB-servis modelinde GitHub adımı atlanır (state geçilir ama anlık).
- Herhangi bir adım hatası → generation `refunded`, son geçerli state `failed` raporlanır.

### 9.6 Visual Edit (canvas seçim + inline edit)

Dosya: `lib/website/state/visualEdit.ts`

States: `idle | selecting_element | element_selected | editing_inline | ai_patch_requested | patching_block | verifying_patch | patch_done | patch_failed`

| From | Event | To |
|------|-------|-----|
| idle | ENTER_EDIT_MODE | selecting_element |
| selecting_element | HOVER+CLICK_ELEMENT | element_selected |
| element_selected | START_INLINE_TEXT | editing_inline |
| element_selected | REQUEST_AI_ACTION | ai_patch_requested |
| editing_inline | COMMIT_TEXT | patching_block |
| ai_patch_requested | PLANNER_OK (`patchPlanner`) | patching_block |
| ai_patch_requested | PLANNER_FAIL | patch_failed |
| patching_block | APPLY_OK (`applyBlockPatch`) | verifying_patch |
| patching_block | APPLY_FAIL | patch_failed |
| verifying_patch | GATE_OK + RENDER_OK | patch_done |
| verifying_patch | GATE_FAIL | patch_failed |
| patch_done | NEXT_EDIT | selecting_element |
| patch_failed | RETRY | element_selected |
| patch_failed | FALLBACK_FULL_REGEN_DECLINED | element_selected |
| any | EXIT_EDIT_MODE | idle |

- Yalnızca seçili blok yamalanır (`data-dijimagic-block` / `data-dijimagic-id` hedefli) — full regenerate yok.
- `verifying_patch` = renderGate + sanitize geçer; başarısızsa patch uygulanmaz (canlı/taslak bozulmaz), versiyon snapshot atılmaz.

### 9.7 Code Error Repair ("Kod Hatası" butonu → AI onarım, KREDİ DÜŞMEZ)

Dosya: `lib/website/state/codeRepair.ts` + `website_repair_attempts` tablosu

States: `idle | user_clicked_kod_hatasi | collecting_logs | analyzing_error | repairing_attempt_1 | deploying_attempt_1 | verifying_attempt_1 | repairing_attempt_2 | deploying_attempt_2 | verifying_attempt_2 | repaired_success | failed_escalate_to_report | converted_to_hata_bildir`

| From | Event | To |
|------|-------|-----|
| idle | CLICK_KOD_HATASI | user_clicked_kod_hatasi |
| user_clicked_kod_hatasi | START | collecting_logs |
| collecting_logs | LOGS_READY (build+deploy+runtime+console) | analyzing_error |
| analyzing_error | DIAGNOSIS_READY | repairing_attempt_1 |
| repairing_attempt_1 | FIX_APPLIED | deploying_attempt_1 |
| deploying_attempt_1 | DEPLOY_OK | verifying_attempt_1 |
| deploying_attempt_1 | DEPLOY_FAIL | repairing_attempt_2 |
| verifying_attempt_1 | VERIFY_OK (site açılır + temel etkileşimler) | repaired_success |
| verifying_attempt_1 | VERIFY_FAIL | repairing_attempt_2 |
| repairing_attempt_2 | FIX_APPLIED | deploying_attempt_2 |
| deploying_attempt_2 | DEPLOY_OK | verifying_attempt_2 |
| deploying_attempt_2 | DEPLOY_FAIL | failed_escalate_to_report |
| verifying_attempt_2 | VERIFY_OK | repaired_success |
| verifying_attempt_2 | VERIFY_FAIL | failed_escalate_to_report |
| failed_escalate_to_report | SHOW_RED_HATA_BILDIR + USER_CLICKS | converted_to_hata_bildir |
| repaired_success | — | (terminal — başarı popup'ı) |
| converted_to_hata_bildir | REPORT_CREATED | (Bölüm 13 → admin_error_report.open) |

- **Verify kapsamı (her iki denemede):** site açılıyor mu + menü/header linkleri + sayfa geçişleri + mobil hamburger aç/kapa + butonlar + form gönderimi + (varsa) sepet. Bu kontroller headless smoke-check ile yapılır.
- `repaired_success` → AYNEN metin: "Harika sorun düzeltilmiştir. Üstelik bu düzenleme için sizden ekstra kredi bakiyesi düşülmemiştir."
- 2 deneme de başarısız → "Kod Hatası" butonu kırmızı "Hata Bildir"e döner.
- Bu makinenin TÜM adımlarında kredi düşmez (credit makinesi `no_credit_platform_repair` yolunda).

### 9.8 Admin Error Report (Gözetim Merkezi)

Dosya: `lib/website/state/errorReport.ts` + `website_error_reports.status`

States: `open | reviewing | ai_analysis_started | fix_prepared | fix_applied | redeployed | verified | customer_notified | closed`

| From | Event | To |
|------|-------|-----|
| (created from 9.7) | — | open |
| open | ADMIN_OPENS | reviewing |
| reviewing | START_AI_QUERY | ai_analysis_started |
| ai_analysis_started | FIX_DRAFTED | fix_prepared |
| fix_prepared | APPLY_TO_CUSTOMER_PANEL | fix_applied |
| fix_applied | REDEPLOY | redeployed |
| redeployed | VERIFY_OK | verified |
| redeployed | VERIFY_FAIL | reviewing (tekrar) |
| verified | NOTIFY_CUSTOMER (kayıtlı mail) | customer_notified |
| customer_notified | CLOSE | closed |

- `customer_notified` → kayıtlı maile (signups.email) bildirim: "Sitenizde bildirilen teknik sorun giderildi…" (Bölüm 13 metni).
- `closed` terminal; rapor Gözetim Merkezi arşivinde kalır.

---

## BÖLÜM 10 — Kredi Sistemi Planı

Mevcut altyapı: `chargeFeature({featureKey, creditCost, requireSubscription})` → `spend_credits` (atomik) / `refund_credits`; `computeGenerationCost({siteType, pageCount, localeCount})`; `WEBSITE_FREE_REVISIONS=3`; `WEBSITE_REVISION_COST=10`; owner bypass (`isSuperAdminEmail` → spent=0). Ledger = `credit_transactions(id, user_id, delta, reason, balance_after, created_at)`.

### 10.1 Kalibre edilmiş kredi değerleri

Prompt'taki referans aralık, mevcut `WEBSITE_CREDITS` (base 40, perExtraPage 15) tabanına ve `FREE_CREDITS=100` ekonomisine kalibre edildi. **Mevcut sabitler değiştirilir** (`lib/website/credits.ts`), kademeli yapı eklenir:

| İşlem | Prompt referansı | Kalibre edilmiş kredi | featureKey / reason |
|-------|-----------------|----------------------|---------------------|
| Free aylık tahsisat | 250 | **250** (free tier'a özel; `FREE_CREDITS` web modülü için 250'ye çıkar) | `bundled` |
| Metin revizesi | 20–50 | **20** (kısa) / **40** (çok bloklu) | `website_text_revision` |
| Tasarım/renk değişimi | 50–100 | **60** | `website_style_revision` |
| Bölüm ekle/yeniden oluştur | 100–150 | **120** | `website_section_revision` |
| Yeni sayfa | 150–300 | **180** (sayfa) + dil çarpanı | `website_new_page` |
| Görsel değiştir/üret | 50–150 | **80** (stock) / **140** (AI üretim) | `website_image` |
| Özel component | 300+ | **320** | `website_custom_component` |
| Tüm site (standart) | 500–900 | `computeGenerationCost`: (40 + 15×(page−1)) × locale → kademeli; tipik 4 sayfa 2 dil ≈ **600** | `website_generation` |
| Sıfırdan tam özel | 1000+ | **1000** taban + sayfa/dil ek | `website_generation_custom` |

- **İlk 3 revize ücretsiz** (`WEBSITE_FREE_REVISIONS=3`) korunur; serbest revizeler tüketildikten sonra yukarıdaki revize-türü kredileri uygulanır (sabit 10 yerine scope-bazlı).
- `revision_scope` alanı (aşağıda) hangi revize türünün uygulandığını belirler → doğru kredi seçilir.
- Owner bypass tüm bu kalemlerde geçerli (spent=0).

### 10.2 Adım-adım düşüm gösterimi (UI)

Generation pipeline state'leri (9.5) ile senkron, her adım kredi tüketim "ledger satırı" gibi gösterilir (örnek 4 sayfa / 2 dil tam site):

```
Talimat analiz ediliyor……………………  −0
Tasarım DNA çıkarılıyor……………………  −80
Sayfa planı oluşturuluyor…………………  −40
İçerik üretiliyor (4 sayfa × 2 dil)…  −360
Görseller hazırlanıyor……………………  −80
Yayına hazırlanıyor………………………  −40
────────────────────────────────────────
Toplam tüketim………………………………  600 kredi
Kalan bakiye………………………………… 1.640 kredi
```

- Bu döküm yalnızca işlem sırasında (consume_step) gösterilir; **create-modal'da hiçbir tahmin/rakam gösterilmez.**

### 10.3 credit_events log alanları

`credit_transactions` ledger'a ek olarak web-modülü için zengin telemetri tablosu: **`website_credit_events`** (mevcut ledger'ı bozmadan, paralel detay log).

Alanlar:
```
id, user_id, website_id, version_id,
operation_type   (website_generation | website_text_revision | website_style_revision |
                  website_section_revision | website_new_page | website_image |
                  website_custom_component | website_generation_custom),
model_used       (opus-4.8 | sonnet | magnific | none),
input_tokens, output_tokens,
page_count, image_count,
revision_scope   (text | style | section | page | image | component | full | null),
estimated_cost_usd  (model token × rate),
charged_credits,
balance_before, balance_after,
created_at
```

- `credit_transactions` (kanonik ledger) yine `spend_credits`/`refund_credits` ile yazılır; `website_credit_events` denetim/maliyet-analiz amaçlı ek satır (her charge'da 1 satır). İkisi `version_id`/zaman ile eşleşir.

### 10.4 reserve → consume → refund mantığı

1. **reserve:** Generation başında `computeGenerationCost` (internal) → `spend_credits(user, cost)` atomik düşülür (rezerve). Yetersiz → 402, hiç başlamaz.
2. **consume_step:** Pipeline adımları ilerledikçe UI'da adım-adım gösterilir (gerçek düşüm zaten reserve'de tek seferde yapıldı; consume_step yalnız görsel ilerleme + `website_credit_events` parça-log).
3. **refund:** Pipeline hatası / gate fail → `refund_credits(user, cost)` (tam iade). `credit_transactions.reason = '{operation_type}_refund'`.
4. **PLATFORM-HATASI-KREDİ-DÜŞMEZ:** Vercel/GitHub/deploy/altyapı hatası → `no_credit_platform_repair` state → her zaman tam refund; kullanıcı hiçbir kredi kaybetmez. Kod-hatası onarım akışı (Bölüm 13) baştan kredisiz çalışır (reserve yapılmaz).

### 10.5 Paket/abonelik tier map

Mevcut planlar (`lib/subscription/plans.ts`: free/basic/starter/premium/enterprise) prompt'taki paket isimlerine map edilir (yeni plan tanımı YARATILMAZ — mevcut tier'lara bağlanır):

| Prompt paketi | Mevcut tier | Web modülü hakları |
|---------------|-------------|--------------------|
| **Free** | `free` | 250 kredi/ay (web), 1 site, geçici/preview yayın, manuel DNS yok |
| **Starter** | `starter` (150 kredi/ay) | + custom domain bağlama, 3 site, ilk 3 revize ücretsiz |
| **Premium** | `premium` (500 kredi/ay) | + sınırsız site, AI görsel üretim, öncelikli onarım |
| **Pro-Ajans** | `enterprise` | + çoklu işletme/whitelabel, ajans paneli, sınırsız domain |

- Web-modülü kredi tahsisatı abonelik kredisinin bir parçasıdır (ayrı cüzdan değil); `credit_balances.balance` tek havuz.
- Abonelik gerektiren web özellikleri (custom domain, AI görsel) `requireSubscription` guard ile; yetersizse `AccessRequiredModal type="subscription"`.

---

## BÖLÜM 11 — Domain / Publish Planı

Mevcut: `lib/website/vercelDomain.ts` (attachDomain/checkDomainConfig), `lib/website/edgeConfig.ts` (custom domain → subdomain mapping), `middleware.ts` (custom domain rewrite, flag `WEBSITE_CUSTOM_DOMAINS`). DB-servis modeli korunur.

### 11.1 Yayınla popup akışı (4 seçenek)

`select_option` ekranı (Bölüm 9.3 ile bağlı):

1. **Önerilen domain** (`search_domain`, MVP'de "Yakında" disabled) — domain satın alma MVP sonrası.
2. **Başka domain ara** — aynı satın-alma akışı (MVP sonrası).
3. **Kendi domainini getir** (`bring_existing_domain`) — **ana MVP akışı.** Kullanıcı sahip olduğu domaini girer → manuel DNS rehberi.
4. **Ücretsiz geçici yayın** (`temporary_publish`) — markalı preview URL ile anında yayın, DNS gerekmez.

### 11.2 Türkiye-öncelikli manuel DNS akışı

`bring_existing_domain` → `dns_instructions`:

1. **Vercel API:** `attachDomain(projectId, domain)` → domain projeye eklenir (DB-servis modelinde tek Vercel projesi); Edge Config'e `cd_<host>` → subdomain mapping yazılır.
2. **Kayıt yapısı:** `www` production (CNAME → `cname.vercel-dns.com`) + apex (`@`) A kaydı (`76.76.21.21`) **308 redirect** apex→www.
3. **Required DNS records** Vercel'den `checkDomainConfig` ile çekilir, panelde **Türkçe** gösterilir.
4. **"Kayıtları Kontrol Et"** butonu → `checking_dns` → `checkDomainConfig` verify. Hazırsa `success`, değilse uyarıyla `dns_instructions`'a döner.

### 11.3 Sağlayıcı rehberleri

Panelde sağlayıcı seçimi → o sağlayıcının DNS panel ekran-akışı Türkçe adım adım:

`Natro | Turhost | İsimtescil | İHS Telekom | Güzel Hosting | Veridyen | Cloudflare | GoDaddy | Diğer`

- Her rehber: "DNS Yönetimi'ne gir → Kayıt ekle → Tür seç → Host/Value yapıştır → Kaydet" şablonu, sağlayıcıya özgü menü adlarıyla.
- "Diğer" = jenerik rehber (Type/Host/Value açıklamalı).
- Rehber içerikleri `lib/website/dnsProviders.ts` + i18n (`tr.json`/`en.json`).

### 11.4 DNS ekranı alanları

Her gerekli kayıt için satır:

| Type | Host | Value | Copy | Status | Last checked |
|------|------|-------|------|--------|--------------|
| CNAME | www | cname.vercel-dns.com | ⧉ | ● Bekleniyor | 14:32 |
| A | @ | 76.76.21.21 | ⧉ | ● Doğrulandı | 14:32 |

- `Copy` = tek tık panoya kopyalama.
- `Status` = per-record (Bekleniyor / Doğrulandı / Yanlış) — Türkçe, ham enum yok.
- `Last checked` = son `checkDomainConfig` zamanı.

### 11.5 Markalı preview domain

- **Wildcard:** `*.preview.dijimagic-domain.com` → Vercel'e wildcard DNS + sertifika (kurulum görevi, ~1-2 saat).
- **Middleware:** preview host → `/s/<subdomain>` rewrite (mevcut custom domain rewrite bloğuna paralel kural).
- **`.vercel.app` gizleme:** Hiçbir UI/preview/yayın yerinde `*.vercel.app` gösterilmez; her zaman `<site>.preview.dijimagic-domain.com` veya bağlı custom domain. Dashboard'a gömülü dar iframe önizleme yok — "Önizle/Yayınla" yeni sekmede markalı URL açar (iframe yalnız düzenleme canvas'ında, preview-id sandbox).

### 11.6 Entri (Faz 2 — opsiyonel)

- Entri (entri.com) tek-tık DNS otomasyonu Faz 2 opsiyonel; MVP tamamen manuel DNS. Entri SDK eklenirse `dns_instructions` ekranına "Tek Tıkla Bağla" butonu eklenir (manuel akış default kalır).

---

## BÖLÜM 12 — Visual Editing Planı

Mevcut blok-patch altyapısı (`data-dijimagic-block` / `data-dijimagic-id`, `patchPlanner.ts`, `blockMap.mjs`, `applyBlockPatch.ts`) ÜZERİNE kurulur. Seçili-blok PATCH; full regenerate yok.

### 12.1 Canvas element seçimi

Edit modunda (state 9.6 `selecting_element`) iframe canvas'ta imleçle hover → outline + element tipi rozeti; tıkla → seç.

Seçilebilir element tipleri (her birine `data-editable` + tip):
`metin | başlık | görsel | buton | ürün kartı | menü | form | bölüm | footer | hero`

### 12.2 Inline action menu + sağ inspector

- **Inline action menu** (seçili elementin üstünde yüzen): hızlı aksiyonlar (Metni değiştir / AI yeniden yaz / Görseli değiştir / Sil).
- **Sağ inspector paneli:** elementin tüm düzenlenebilir alanları (metin, renk, stil, link, görünürlük) form olarak.

### 12.3 Aksiyonlar

`Metni değiştir | AI ile yeniden yaz | Görseli değiştir | Stili değiştir | Bölümü yeniden oluştur | Ekle | Sil | Ürün düzenle | Fiyat | Buton link | Mobilde/masaüstünde gizle | Renk | CTA`

- Her aksiyon → seçili bloğun `data-dijimagic-id`'sine targeted patch (`patchPlanner` → `applyBlockPatch`).
- "AI ile yeniden yaz" / "Bölümü yeniden oluştur" → Sonnet patch, yalnız o blok regen (komşu bloklar dokunulmaz).
- "Mobilde/masaüstünde gizle" → responsive utility class toggle (declarative, runtime script yok).

### 12.4 Görünmez editable metadata

Üretim sırasında her blok/element'e enjekte edilir (sanitize allowlist'e eklenir, render'da görünmez):

```
data-block-id     (kanonik blok kimliği — patch hedefi)
data-component    (template/component library bileşen tipi)
data-editable     (true/false — seçilebilir mi)
data-field        (alan adı: heading | body | img-src | href | price …)
data-page         (sayfa slug)
data-section      (bölüm rolü: hero | services | footer …)
```

- Bu metadata `sanitizeAllowlist.mjs` SAFE_ATTRS'e eklenir; yayın HTML'inde kalır ama görsel etkisi yok.

### 12.5 Seçili-blok PATCH (full regenerate yok)

- Her revize → yalnız hedef blok haritalanır (`blockMap`), patch ops üretilir (`planPatchOps`), doğrulanır (`validateOps`), uygulanır (`applyBlockPatch` edit/insert/delete/move).
- Patch başarısız → o blok için fallback full-block regen (sayfa değil, blok); yine başarısızsa kullanıcıya bildirilir, snapshot atılmaz.
- Tüm site asla yeniden üretilmez.

### 12.6 Versiyon geçmişi

- Her başarılı visual edit → `website_versions` snapshot (`reason='revision'`) + `website_edit_events` (kim/ne zaman/hangi blok/delta).
- Geri al = önceki versiyona rollback (`reason='rollback'`); mevcut versiyon altyapısı kullanılır.

---

## BÖLÜM 13 — Kod Hatası / Hata Bildir / Gözetim Merkezi Planı

### 13.1 "Kod Hatası" butonu

- Yeri: önizleme/yayın ekranında **Reddet / Düzenle / Yayınla** butonlarının yanında.
- **Kredi DÜŞMEZ** (credit makinesi hiç reserve yapmaz).
- Tıklama → state 9.7 `user_clicked_kod_hatasi` → AI onarım akışı.

### 13.2 AI onarım akışı

1. **Log topla** (`collecting_logs`): build log + deploy log + runtime hata + console error → maskelenmiş (Bölüm 15) `website_repair_attempts.logs`.
2. **Analiz** (`analyzing_error`): Sonnet/Opus ile kök neden.
3. **Düzelt → redeploy → doğrula** (deneme 1): patch uygula → ISR purge/deploy → **doğrula:** site açılıyor mu + menü/header linkleri + sayfa geçişleri + mobil hamburger aç/kapa + butonlar + form + (varsa) sepet.
4. Başarısızsa **deneme 2** (aynı döngü).
5. **Başarı** → `repaired_success` popup AYNEN:
   > "Harika sorun düzeltilmiştir. Üstelik bu düzenleme için sizden ekstra kredi bakiyesi düşülmemiştir."

### 13.3 2 deneme sınırı → "Hata Bildir"

- 2. deneme de başarısız → "Kod Hatası" butonu **kırmızı "Hata Bildir"** olur.
- Tıklama → `website_error_reports` kaydı oluşturulur, içerik:
  - ekran görüntüsü (preview smoke-check'ten)
  - log (build/deploy/runtime/console — maskelenmiş)
  - site ID + user ID
  - preview URL (markalı)
  - AI deneme geçmişi (`website_repair_attempts` 2 satır)
- **Hata Bildir popup** AYNEN:
  > "Sorunu teknik ekibimize ilettik en kısa sürede gerekli düzenlemeleri yapıp, kayıt olduğunuz mail adresi üzerinden size geri bildirimde bulunulacaktır."

### 13.4 Gözetim Merkezi alanları

`/gozetim-merkezi` (mevcut admin panel, super-admin guard) içinde **"Web Site Hata Raporları"** sekmesi. `website_error_reports` listesi:

```
id, website_id, user_id, status (Bölüm 9.8 enum),
screenshot_url, logs (jsonb), preview_url,
repair_attempts (jsonb — AI deneme geçmişi),
error_type, customer_email (maskeli görünüm),
created_at, resolved_at, admin_note
```

UI: KPI kartları (`animate-card-enter`, `max-w-7xl`, `text-base font-semibold`), filtre WizardSelect (status), satır → detay drawer.

### 13.5 Admin çözüm akışı

1. Admin raporu açar (`reviewing`).
2. **AI sorgu** (`ai_analysis_started`) → fix taslağı (`fix_prepared`).
3. **Müşteri paneline entegre** (`fix_applied`): düzeltme müşterinin site versiyonuna uygulanır (yeni `website_versions` snapshot).
4. **Redeploy/verify** (`redeployed` → `verified`): smoke-check.
5. **Kayıtlı maile bildirim** (`customer_notified`): `lib/website/contactNotify` pattern (Resend, `signups.email`):
   > "Sitenizde bildirilen teknik sorun giderildi. Sitenizi kontrol edebilirsiniz…"
6. **Kapat** (`closed`).

---

## BÖLÜM 14 — Responsive Header/Footer Kalite Planı

Mevcut mobil-menü runtime (`data-dijimagic-mobile-nav` + anim, `dijimagic-site-runtime.js`) ÜZERİNE. Üretim prompt'una (htmlGenerate) + renderGate kontrol listesine bağlanır.

### 14.1 Mobil header

- **Solid/semi-opaque** zorunlu — şeffaf header YASAK. `background: rgba(...,0.92)` + `backdrop-filter: blur()` (logo/menü her zaman okunur).
- Scroll'da arka plan opaklığı korunur (içerik üstünden okunmaz hale gelmez).

### 14.2 Hamburger menü

- **Opak kart** panel (yarı saydam değil) + animasyonlu açılış (transform/opacity).
- **Dışarı tıklayınca kapanır** (runtime `mousedown` + `contains` kontrolü — açık-kalma bug'ı YOK).
- **Kapat (X) ikonu** her zaman görünür.
- Toggle idempotent (çift tıklama state bozmaz); ESC kapatır.
- Bu davranışlar `dijimagic-site-runtime.js`'de tek noktadan (declarative `data-dijimagic-mobile-nav`), AI keyfi script yazmaz.

### 14.3 Header/footer başlık taşması

- Başlıklar PC/tablet/mobilde **alt satıra kaymaz:** responsive font (`clamp()`), uygun spacing, breakpoint'te hamburger'a geçiş (nav linkleri sığmazsa hamburger).
- renderGate kontrol listesine kural: header nav overflow → otomatik hamburger eşiği; footer kolon `flex-wrap` ile düzenli sarmalama.

### 14.4 Footer yılı

- Footer telif yılı **current** (üretim/render anında dinamik — `2026` sabit gömme yerine render-time yıl). `assembleDocument` veya runtime ile güncel yıl basılır.

### 14.5 renderGate doğrulama

renderGate'e eklenen kalite kapıları:
- Header `background` opaklık ≥ 0.85 (mobil) — şeffaf header reddedilir.
- `data-dijimagic-mobile-nav` mevcut + kapat ikonu + dış-tık handler bağlı.
- Header/footer başlık elemanlarında `clamp()` veya responsive sınıf zorunlu.
- Footer yıl token'ı dinamik.

---

## BÖLÜM 15 — Güvenlik Planı

### 15.1 Token & env güvenliği

- **GitHub App / Vercel / payment / AI token'ları yalnız sunucuda** (`process.env`), client'a asla sızmaz. UI'da GitHub/Vercel ismi bile geçmez.
- Tek Vercel token (DB-servis modeli) → blast-radius minimal; token rotation prosedürü dokümante.
- Tüm sırlar Vercel env + `.env.local`; repo'ya asla commit edilmez (secret-scan zorunlu).

### 15.2 Tenant izolasyon / RLS

- Tüm `website_*` tabloları `user_id` ile RLS (mevcut pattern: `websites_own`, FK üzerinden `website_pages_own`).
- Yeni tablolar (`website_domains`, `website_deployments`, `website_credit_events`, `website_error_reports`, `website_repair_attempts`, `website_edit_events`) aynı RLS deseni — `user_id = auth.uid()::text` veya FK→websites guard.
- Cross-business sızıntı: `buildCodegenContext` site-scoped kaynak önceliği (mevcut koruma korunur).

### 15.3 Preview URL tahmin-edilemezliği

- Preview subdomain/owner-preview-id tahmin edilemez (uuid/rastgele slug); owner-only önizleme auth-gated (`website-preview/[id]` force-dynamic + auth).
- Public site servisi (`/s/<subdomain>`) yayın durumu `published` değilse 404.

### 15.4 Domain ownership verify

- Custom domain bağlama → Vercel `checkDomainConfig` DNS doğrulaması zorunlu (sahteleme önleme); doğrulanmadan `active`/`redirect_active`'e geçilmez.
- Edge Config mapping yalnız doğrulanmış domain için yazılır.

### 15.5 Payment API key saklama

- İyzico anahtarları sunucu env; `payment_transactions` tablosunda raw callback saklanır ama anahtar saklanmaz.
- Grant idempotency (mevcut `markTransactionSucceeded` atomik) korunur.

### 15.6 AI output sanitization

- Mevcut deny-by-default `sanitizeHtml.ts` + `sanitizeAllowlist.mjs` (SAFE_TAGS/SAFE_ATTRS/transformTags) + renderGate + sıkı CSP korunur.
- Yeni `data-*` editable metadata allowlist'e eklenir (script enjeksiyonu değil — sadece attribute).
- AI keyfi `<script>` yazamaz; yalnız sürümlü `dijimagic-site-runtime.js` (declarative `data-dijimagic-*`).

### 15.7 File / screenshot upload güvenliği

- Logo / hata-raporu screenshot upload: MIME + boyut doğrulama (PNG/JPEG/WebP), Supabase Storage signed path, public_url yalnız sahibe.
- Screenshot smoke-check tarafından üretilir (kullanıcı yüklemesi değil) → güvenli kaynak.

### 15.8 Rate limit & abuse önleme

- Public lead form: mevcut honeypot + IP rate-limit (5/60s) korunur.
- Generation/revision: kredi sistemi doğal rate-limit; ek olarak per-user concurrent generation 1 (Inngest concurrency).
- "Kod Hatası" onarım: per-site cooldown (spam onarım çağrısı engeli).

### 15.9 Credit / free-trial abuse önleme

- Atomik `spend_credits` (WHERE balance>=amount) → negatif bakiye imkansız.
- Free tier: hesap başına 250 kredi/ay; çoklu-hesap abuse → signup approval guard + email-unique.
- Refund yalnız gerçek hata/platform-hatası yolunda (manuel refund admin-only).

### 15.10 .vercel.app gizleme & build-log secret sızıntısı

- `.vercel.app` hiçbir kullanıcı-yüzlü yerde görünmez (UI/preview/yayın/hata-raporu — hepsi markalı URL).
- Build/deploy log'ları hata-raporuna eklenirken **secret-scan + maskeleme** (token/anahtar/env değerleri redakte).

### 15.11 Hata raporlarında kişisel-veri maskeleme

- `website_error_reports.customer_email` admin UI'da maskeli gösterilir (`o***@hotmail.com`); tam değer yalnız bildirim gönderiminde sunucuda.
- Log'lardan PII (email/telefon/IP) maskeleme regex'i.

### 15.12 Admin repair yetkisi

- Gözetim Merkezi web-hata sekmesi + repair aksiyonları super-admin guard (`getIsCurrentUserSuperAdmin` / `SUPER_ADMIN_EMAILS`); normal kullanıcıya varlığı sızmaz (404).

### 15.13 ENV listesi

```
# GitHub (per-site model — MVP'de DB-servis, opsiyonel)
GITHUB_APP_ID
GITHUB_APP_PRIVATE_KEY
GITHUB_APP_INSTALLATION_ID

# Vercel
VERCEL_API_TOKEN
VERCEL_TEAM_ID
EDGE_CONFIG                       # ecfg_* bağlantı URL'i

# Preview domain
WEBSITE_PREVIEW_WILDCARD_DOMAIN   # preview.dijimagic-domain.com
WEBSITE_CUSTOM_DOMAINS            # flag ('1' açık)

# Payment
IYZICO_API_KEY
IYZICO_SECRET
IYZICO_BASE_URL

# AI
ANTHROPIC_API_KEY

# Storage
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY

# Webhook
META_WEBHOOK_VERIFY_TOKEN

# Email (bildirim)
RESEND_API_KEY
FROM_EMAIL

# Admin notify
SUPER_ADMIN_EMAILS
OWNER_NOTIFICATION_RECIPIENTS

# Feature flags
WEBSITE_CODEGEN_V2
WEBSITE_ISR
```

---

## Yeni DB Tabloları Özeti (mevcut pattern'e uyumlu)

| Tablo | Anahtar alanlar | İlişki |
|-------|----------------|--------|
| `website_domains` | website_id FK, host, status (9.1), required_records jsonb, last_checked_at | websites CASCADE, RLS FK-guard |
| `website_deployments` | website_id FK, status (9.2), version_id, started_at, deployed_at | websites CASCADE |
| `website_credit_events` | user_id, website_id, version_id, operation_type, model_used, tokens, revision_scope, charged_credits, balance_before/after | credit_transactions ile eşleşir |
| `website_edit_events` | website_id FK, version_id, block_id, delta jsonb, user_id, created_at | websites CASCADE |
| `website_error_reports` | website_id FK, user_id, status (9.8), screenshot_url, logs jsonb, preview_url, repair_attempts jsonb, error_type | websites CASCADE |
| `website_repair_attempts` | error_report_id FK / website_id, attempt_no, logs jsonb, diagnosis, result, created_at | website_error_reports CASCADE |

- Migration adlandırma: `YYYYMMDDHHMMSS_website_state_machines.sql` (additive, IF NOT EXISTS, RLS idempotent).
- `credit_transactions.reason` enum yeni değerlerle genişler (additive): `website_text_revision`, `website_style_revision`, `website_section_revision`, `website_new_page`, `website_image`, `website_custom_component`, `website_generation_custom` + `_refund` varyantları.
