-- ─────────────────────────────────────────────────────────────
-- YoAlgoritma — Platform Doctrine (Faz 1)
--
-- Platform + kampanya türü başına çalışma prensiplerinin DB-driven
-- bilgi tabanı. Daily-run / diagnosis / proposal pipeline bu
-- tablodan kuralları okuyup kampanya tipine sadık değerlendirme
-- ve öneri üretir.
--
-- Doctrine bir GLOBAL bilgi tabanıdır (tenant-bağımsız). RLS:
--   - Read: tüm authenticated kullanıcılar (defense-in-depth)
--   - Write: sadece service role (admin), public/anon kullanıcı
--     yazamaz.
-- Service role key uygulamada zaten kullanıldığı için tablo işlevsel
-- kalır.
--
-- Migration uygulanmazsa lib/yoai/platformDoctrineStore.ts içindeki
-- fallback hardcoded doctrine mirror'ı devreye girer; daily-run /
-- adCreator kırılmaz.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.yoai_platform_doctrine (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform                TEXT NOT NULL CHECK (platform IN ('meta', 'google')),
  campaign_type           TEXT NOT NULL,
  objective               TEXT,
  optimization_goal       TEXT,
  channel_type            TEXT,
  name                    TEXT NOT NULL,
  description             TEXT,
  success_metrics         JSONB NOT NULL DEFAULT '{}'::jsonb,
  failure_signals         JSONB NOT NULL DEFAULT '{}'::jsonb,
  required_assets         JSONB NOT NULL DEFAULT '{}'::jsonb,
  targeting_principles    JSONB NOT NULL DEFAULT '{}'::jsonb,
  bidding_principles      JSONB NOT NULL DEFAULT '{}'::jsonb,
  creative_principles     JSONB NOT NULL DEFAULT '{}'::jsonb,
  policy_notes            JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendation_rules    JSONB NOT NULL DEFAULT '[]'::jsonb,
  severity_rules          JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  version                 INTEGER NOT NULL DEFAULT 1,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_yoai_platform_doctrine_type_active
  ON public.yoai_platform_doctrine (platform, campaign_type)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_yoai_platform_doctrine_platform
  ON public.yoai_platform_doctrine (platform);

CREATE INDEX IF NOT EXISTS idx_yoai_platform_doctrine_campaign_type
  ON public.yoai_platform_doctrine (campaign_type);

CREATE INDEX IF NOT EXISTS idx_yoai_platform_doctrine_objective
  ON public.yoai_platform_doctrine (objective)
  WHERE objective IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_yoai_platform_doctrine_channel_type
  ON public.yoai_platform_doctrine (channel_type)
  WHERE channel_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_yoai_platform_doctrine_active
  ON public.yoai_platform_doctrine (platform, campaign_type, is_active);

ALTER TABLE public.yoai_platform_doctrine ENABLE ROW LEVEL SECURITY;

-- READ: tüm authenticated kullanıcılar (global knowledge base).
DROP POLICY IF EXISTS "yoai_platform_doctrine_select_authenticated"
  ON public.yoai_platform_doctrine;
CREATE POLICY "yoai_platform_doctrine_select_authenticated"
  ON public.yoai_platform_doctrine
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- WRITE: sadece service role (admin yazımı için). Anon/authenticated
-- kullanıcılar tablo içeriğini değiştiremez.
DROP POLICY IF EXISTS "yoai_platform_doctrine_write_service_role"
  ON public.yoai_platform_doctrine;
CREATE POLICY "yoai_platform_doctrine_write_service_role"
  ON public.yoai_platform_doctrine
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.yoai_platform_doctrine IS
  'Platform + kampanya türü başına çalışma prensiplerinin DB-driven knowledge base''i (Faz 1). Service role yazar, authenticated okur.';

-- ─────────────────────────────────────────────────────────────
-- SEED — başlangıç doctrine kayıtları
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.yoai_platform_doctrine
  (platform, campaign_type, objective, optimization_goal, channel_type, name, description,
   success_metrics, failure_signals, required_assets,
   targeting_principles, bidding_principles, creative_principles, policy_notes,
   recommendation_rules, severity_rules)
VALUES
-- ───────────────── META: TRAFFIC ─────────────────
('meta', 'meta_traffic', 'OUTCOME_TRAFFIC', 'LANDING_PAGE_VIEWS', NULL,
 'Meta Trafik',
 'Web sitesine veya uygulamaya nitelikli trafik çekmek için kullanılır. CTR, landing_page_view ve CPC ana sinyallerdir; satış değil ziyaret hedeflenir.',
 '{"primary": ["link_clicks", "landing_page_views", "ctr", "cpc"], "secondary": ["cpm", "reach", "frequency"], "benchmarks": {"ctr_min": 0.8, "ctr_good": 1.5, "cpc_max_try": 8, "lp_view_to_click_min": 0.7}}'::jsonb,
 '{"signals": ["spend_high_landing_view_low", "ctr_below_0_8", "frequency_above_3", "cpc_above_benchmark", "lp_view_click_ratio_below_0_5"], "common_mistakes": ["link_clicks_optimization_yerine_landing_page_views_kullanilmali", "trafik_kampanyasindan_satis_beklemek", "cok_dar_hedefleme_trafigi_bogar"]}'::jsonb,
 '{"required": ["website_url", "page_id", "primary_text", "headline"], "recommended": ["description", "image_or_video", "clear_cta"]}'::jsonb,
 '{"audience_size_min": 500000, "principles": ["genis_ilgi_alani_ve_lookalike", "performans_dusukse_dar_kitleyi_genislet", "geo_TR_default"], "anti_patterns": ["100k_alti_kitle_trafigi_bogar"]}'::jsonb,
 '{"preferred": "LANDING_PAGE_VIEWS", "alternatives": ["LINK_CLICKS"], "min_daily_budget_try": 35, "rules": ["LINK_CLICKS_se_LANDING_PAGE_VIEWS_e_gec_eger_ctr_dusuk"]}'::jsonb,
 '{"hook_first_3_sec": true, "clear_value_prop": true, "cta_examples": ["LEARN_MORE", "SHOP_NOW", "GET_OFFER"], "image_principles": ["yuksek_kontrast", "tek_odak_noktasi", "metin_orani_dusuk"]}'::jsonb,
 '{"avoid": ["yaniltici_iddialar", "tikla_kazan_dili"], "compliance": ["meta_advertising_policies"]}'::jsonb,
 '[
   {"id": "switch_to_landing_page_views", "if": {"optimization_goal": "LINK_CLICKS", "ctr": "<0.8"}, "action": "LANDING_PAGE_VIEWS optimizasyonuna geç", "priority": "high"},
   {"id": "expand_audience", "if": {"frequency": ">=3"}, "action": "Hedef kitleyi genişlet veya lookalike ekle", "priority": "medium"},
   {"id": "refresh_creative", "if": {"frequency": ">=3", "ctr_trend": "down"}, "action": "Kreatifi yenile (creative fatigue)", "priority": "high"}
 ]'::jsonb,
 '[
   {"id": "no_landing_page_views_with_high_spend", "condition": "spend>500 AND landing_page_views<10", "severity": "critical"},
   {"id": "ctr_collapse", "condition": "ctr<0.5", "severity": "high"},
   {"id": "cpc_spike", "condition": "cpc>15", "severity": "medium"}
 ]'::jsonb),

-- ───────────────── META: ENGAGEMENT ─────────────────
('meta', 'meta_engagement', 'OUTCOME_ENGAGEMENT', 'POST_ENGAGEMENT', NULL,
 'Meta Etkileşim',
 'Post engagement, beğeni, yorum, paylaşım ve mesaj üretmek için kullanılır. Trafik veya satış değil; topluluk ve sosyal kanıt hedeflenir.',
 '{"primary": ["post_engagement", "reactions", "comments", "shares"], "secondary": ["reach", "frequency", "video_views"], "benchmarks": {"engagement_rate_min": 1.5, "engagement_rate_good": 4, "frequency_max": 3}}'::jsonb,
 '{"signals": ["frequency_above_4", "engagement_rate_below_1", "comment_to_view_ratio_collapse", "creative_fatigue"], "common_mistakes": ["engagement_kampanyasindan_satis_beklemek", "engagement_objective_ile_conversion_optimizasyonu_yapamayiz", "yanlis_kitle_engagement_lige_uygun_degil"]}'::jsonb,
 '{"required": ["page_id", "primary_text", "image_or_video"], "recommended": ["question_in_text", "comment_pinned_response_plan"]}'::jsonb,
 '{"audience_size_min": 200000, "principles": ["topluluk_temasiyla_uyumlu_ilgi_alanlari", "saved_audience_kullan", "lookalike_engagement_seedi"], "anti_patterns": ["satis_odakli_lookalike_engagement_te_zayif"]}'::jsonb,
 '{"preferred": "POST_ENGAGEMENT", "alternatives": ["IMPRESSIONS", "REACH"], "min_daily_budget_try": 25}'::jsonb,
 '{"hook_with_question": true, "encourage_comments": true, "cta_examples": ["YORUM_YAP", "ETIKETLE", "PAYLAS"], "image_principles": ["duygu_uyandiran", "tartismaya_acik"]}'::jsonb,
 '{"avoid": ["click_bait", "yanlis_topluluk_normu"], "compliance": ["meta_community_standards"]}'::jsonb,
 '[
   {"id": "switch_to_sales_if_conversions", "if": {"conversions": ">=3"}, "action": "Satış sinyalleri var; OUTCOME_SALES kampanyasına yönlendir", "priority": "medium"},
   {"id": "refresh_creative_high_freq", "if": {"frequency": ">=4"}, "action": "Frekans yüksek; kreatifi yenile veya kitleyi genişlet", "priority": "high"}
 ]'::jsonb,
 '[
   {"id": "engagement_collapse", "condition": "engagement_rate<0.8 AND frequency>3", "severity": "high"},
   {"id": "no_engagement_with_spend", "condition": "spend>200 AND post_engagement<10", "severity": "critical"}
 ]'::jsonb),

-- ───────────────── META: LEAD ─────────────────
('meta', 'meta_lead', 'OUTCOME_LEADS', 'LEAD_GENERATION', NULL,
 'Meta Lead',
 'Lead form veya web form üzerinden iletişim bilgisi toplamak için kullanılır. Kalite (qualified lead) ve maliyet (CPL) ana metriklerdir.',
 '{"primary": ["leads", "cpl", "form_completion_rate"], "secondary": ["ctr", "cpc", "frequency"], "benchmarks": {"cpl_max_try": 80, "form_completion_rate_min": 0.6}}'::jsonb,
 '{"signals": ["spend_high_leads_low", "form_open_no_complete", "wrong_audience_low_quality_leads", "missing_followup_form_questions"], "common_mistakes": ["traffic_objective_ile_lead_toplamak", "cok_uzun_form_completion_rate_dusurur", "lead_form_quality_questions_eksikligi"]}'::jsonb,
 '{"required": ["lead_form_id", "page_id", "primary_text", "headline", "privacy_policy_url"], "recommended": ["custom_questions", "thank_you_message", "crm_integration"]}'::jsonb,
 '{"audience_size_min": 300000, "principles": ["intent_based_audience", "lookalike_existing_customers", "geo_TR_or_segment"], "anti_patterns": ["cok_genis_kitle_dusuk_kaliteli_lead"]}'::jsonb,
 '{"preferred": "LEAD_GENERATION", "min_daily_budget_try": 50, "rules": ["ilk_3_gun_ogrenme_fazi_bekle"]}'::jsonb,
 '{"value_prop_clear": true, "trust_signals": true, "cta_examples": ["FORMU_DOLDUR", "TEKLIF_AL", "ABONE_OL"], "image_principles": ["urun_veya_hizmet_acik", "guven_unsuru"]}'::jsonb,
 '{"avoid": ["spam_dili", "urun_ozellikleri_disinda_iddialar"], "compliance": ["KVKK", "meta_lead_ads_policy"]}'::jsonb,
 '[
   {"id": "shorten_form", "if": {"form_completion_rate": "<0.5"}, "action": "Lead form sorularını kısalt", "priority": "high"},
   {"id": "refine_audience", "if": {"low_quality_leads": true}, "action": "Hedef kitleyi daralt veya lookalike kullan", "priority": "medium"}
 ]'::jsonb,
 '[
   {"id": "no_leads_with_spend", "condition": "spend>500 AND leads=0", "severity": "critical"},
   {"id": "cpl_spike", "condition": "cpl>200", "severity": "high"}
 ]'::jsonb),

-- ───────────────── META: MESSAGE ─────────────────
('meta', 'meta_message', 'OUTCOME_ENGAGEMENT', 'CONVERSATIONS', NULL,
 'Meta Mesaj',
 'WhatsApp, Messenger veya Instagram DM üzerinden konuşma başlatmak için kullanılır. Reply rate ve conversation cost ana sinyaller.',
 '{"primary": ["messaging_conversations_started", "cost_per_messaging_conversation", "reply_rate"], "secondary": ["ctr", "frequency"], "benchmarks": {"reply_rate_min": 0.4, "cost_per_conversation_max_try": 30}}'::jsonb,
 '{"signals": ["high_message_open_low_reply", "wrong_destination_type", "automated_response_missing", "outside_messaging_window"], "common_mistakes": ["whatsapp_destination_te_CONVERSATIONS_yerine_REPLIES_kullanilabilir", "mesaj_yanit_planlamasinin_olmamasi"]}'::jsonb,
 '{"required": ["page_id", "destination_type", "primary_text", "auto_reply_template"], "recommended": ["whatsapp_business_account", "quick_replies"]}'::jsonb,
 '{"audience_size_min": 100000, "principles": ["destination_lokal_destek_saatleri", "musteri_segmenti_aktif"], "anti_patterns": ["mesaj_yanitlamayan_marka"]}'::jsonb,
 '{"preferred": "CONVERSATIONS", "alternatives": ["REPLIES"], "rules": ["destination_whatsapp_uyumu", "auto_reply_zorunlu"]}'::jsonb,
 '{"open_question": true, "service_focused": true, "cta_examples": ["MESAJ_GONDER", "BIZE_YAZ"]}'::jsonb,
 '{"avoid": ["aggressive_satis_dili"], "compliance": ["whatsapp_business_policy"]}'::jsonb,
 '[
   {"id": "use_replies_optimization", "if": {"destination_type": "WHATSAPP", "optimization_goal": "CONVERSATIONS"}, "action": "WhatsApp için REPLIES optimizasyonu daha verimli olabilir", "priority": "medium"},
   {"id": "add_auto_reply", "if": {"reply_rate": "<0.3"}, "action": "Otomatik karşılama mesajı ekle", "priority": "high"}
 ]'::jsonb,
 '[
   {"id": "no_conversations_with_spend", "condition": "spend>200 AND conversations=0", "severity": "critical"}
 ]'::jsonb),

-- ───────────────── META: SALES ─────────────────
('meta', 'meta_sales', 'OUTCOME_SALES', 'OFFSITE_CONVERSIONS', NULL,
 'Meta Satış',
 'Pixel veya Conversion API üzerinden ölçülen satış/dönüşüm üretmek için kullanılır. ROAS, conversion volume ve event quality ana sinyaller.',
 '{"primary": ["conversions", "roas", "cpa", "purchase_value"], "secondary": ["ctr", "cpc", "add_to_cart"], "benchmarks": {"roas_min": 2, "roas_good": 4, "cpa_max_try_default": 200}}'::jsonb,
 '{"signals": ["pixel_misfire", "spend_high_no_conversion", "event_quality_below_5", "wrong_optimization_goal_for_sales", "audience_too_broad"], "common_mistakes": ["traffic_objective_ile_satis_beklemek", "pixel_kurulu_degil_veya_yanlis_event", "engagement_dan_sales_e_gecis_olmadan_optimize"]}'::jsonb,
 '{"required": ["pixel_id", "conversion_event", "page_id", "primary_text", "headline", "image_or_video"], "recommended": ["conversion_api", "catalog_id", "product_set"]}'::jsonb,
 '{"audience_size_min": 300000, "principles": ["lookalike_purchasers", "retargeting_atc", "broad_with_dynamic_creative"], "anti_patterns": ["cold_audience_dar_satis_zayif"]}'::jsonb,
 '{"preferred": "OFFSITE_CONVERSIONS", "alternatives": ["VALUE", "MINIMUM_ROAS"], "min_daily_budget_try": 100, "rules": ["min_50_event_per_week_pixel_learning"]}'::jsonb,
 '{"value_prop_specific": true, "social_proof": true, "urgency_ok": true, "cta_examples": ["SHOP_NOW", "BUY_NOW", "GET_OFFER"]}'::jsonb,
 '{"avoid": ["yanilticı_indirim", "stok_yok_iddiasi"], "compliance": ["meta_commerce_policies", "tuketici_haklari"]}'::jsonb,
 '[
   {"id": "fix_pixel", "if": {"conversions": "0", "spend": ">500"}, "action": "Pixel/CAPI kurulumunu kontrol et", "priority": "critical"},
   {"id": "use_value_optimization", "if": {"roas_high_variance": true}, "action": "VALUE optimizasyonuna geç", "priority": "medium"},
   {"id": "expand_lookalike", "if": {"cpa": ">benchmark"}, "action": "Lookalike yüzde 1-3 yerine 5-10 dene", "priority": "low"}
 ]'::jsonb,
 '[
   {"id": "pixel_misfire", "condition": "spend>500 AND conversions=0 AND clicks>50", "severity": "critical"},
   {"id": "low_roas", "condition": "roas<1 AND spend>500", "severity": "high"},
   {"id": "event_quality_low", "condition": "event_quality_score<5", "severity": "medium"}
 ]'::jsonb),

-- ───────────────── META: AWARENESS ─────────────────
('meta', 'meta_awareness', 'OUTCOME_AWARENESS', 'REACH', NULL,
 'Meta Bilinirlik',
 'Marka bilinirliğini geniş kitleye ulaştırmak için kullanılır. Reach, frequency ve brand lift ana sinyaller; CTR/conversion ikincil.',
 '{"primary": ["reach", "impressions", "frequency", "brand_lift"], "secondary": ["video_views", "cpm"], "benchmarks": {"frequency_optimal": 2.5, "frequency_max": 4, "cpm_max_try": 80}}'::jsonb,
 '{"signals": ["frequency_above_5_creative_fatigue", "cpm_above_benchmark", "narrow_audience"], "common_mistakes": ["awareness_dan_dogrudan_satis_beklemek", "kucuk_kitle_awareness_te_yanlis"]}'::jsonb,
 '{"required": ["page_id", "primary_text", "image_or_video"], "recommended": ["video_15_30_sec", "brand_logo_visible"]}'::jsonb,
 '{"audience_size_min": 1000000, "principles": ["genis_ilgi_alani", "geo_TR_metropol", "yas_cinsiyet_geniş"], "anti_patterns": ["dar_lookalike_awareness_e_uygun_degil"]}'::jsonb,
 '{"preferred": "REACH", "alternatives": ["IMPRESSIONS", "AD_RECALL_LIFT"], "min_daily_budget_try": 50, "rules": ["frequency_cap_3_per_week"]}'::jsonb,
 '{"brand_present_first_3_sec": true, "memorable_hook": true, "cta_examples": ["LEARN_MORE", "WATCH_MORE"], "video_principles": ["15_30_saniye", "ses_olmadan_anlasilir"]}'::jsonb,
 '{"avoid": ["yaniltici_marka_iddialari"], "compliance": ["meta_brand_policies"]}'::jsonb,
 '[
   {"id": "cap_frequency", "if": {"frequency": ">5"}, "action": "Frekans tavanı belirle (haftalık 3)", "priority": "high"},
   {"id": "expand_audience", "if": {"audience_size": "<500000"}, "action": "Hedef kitleyi genişlet", "priority": "medium"}
 ]'::jsonb,
 '[
   {"id": "creative_fatigue", "condition": "frequency>5", "severity": "high"},
   {"id": "narrow_audience", "condition": "audience_size<500000", "severity": "medium"}
 ]'::jsonb),

-- ───────────────── GOOGLE: SEARCH ─────────────────
('google', 'google_search', NULL, 'MAXIMIZE_CONVERSIONS', 'SEARCH',
 'Google Arama',
 'Yüksek niyetli arama trafiğini yakalamak için kullanılır. CTR, conversion rate, quality score ve impression share ana sinyaller.',
 '{"primary": ["clicks", "ctr", "conversions", "conversion_rate", "quality_score"], "secondary": ["cpc", "impression_share"], "benchmarks": {"ctr_min": 2, "ctr_good": 5, "quality_score_min": 6, "conversion_rate_min": 2}}'::jsonb,
 '{"signals": ["low_ctr_below_2", "low_quality_score_below_5", "high_cpc_above_benchmark", "spend_high_no_conversion", "impression_share_lost_to_budget", "impression_share_lost_to_rank", "single_ad_group_risk"], "common_mistakes": ["broad_match_olmadan_negative_keyword_eksikligi", "rsa_5_baslik_eksikligi", "conversion_tracking_eksikligi"]}'::jsonb,
 '{"required": ["keywords", "rsa_headlines_min_5", "rsa_descriptions_min_2", "final_url", "conversion_tracking"], "recommended": ["sitelinks", "callouts", "structured_snippets", "negative_keywords"]}'::jsonb,
 '{"keyword_match_types": ["EXACT", "PHRASE", "BROAD_MODIFIED"], "principles": ["intent_based_keywords", "negative_keywords_zorunlu", "ad_group_per_intent"], "anti_patterns": ["tek_ad_group_tum_keywords"]}'::jsonb,
 '{"preferred": "MAXIMIZE_CONVERSIONS", "alternatives": ["TARGET_CPA", "TARGET_ROAS", "MAXIMIZE_CLICKS"], "min_daily_budget_try": 100, "rules": ["min_30_conversion_per_month_target_cpa_icin", "manual_cpc_disabled_konversiyon_yoksa"]}'::jsonb,
 '{"keyword_in_headline": true, "rsa_5_baslik_2_aciklama": true, "cta_in_description": true, "extension_kullanim": true}'::jsonb,
 '{"avoid": ["misleading_claims", "trademark_violations"], "compliance": ["google_ads_policies"]}'::jsonb,
 '[
   {"id": "add_negative_keywords", "if": {"ctr": "<2"}, "action": "Negative keyword listesi ekle ve broad match analizi yap", "priority": "high"},
   {"id": "expand_to_target_cpa", "if": {"conversions": ">30/month"}, "action": "TARGET_CPA bidding stratejisine geç", "priority": "medium"},
   {"id": "fix_quality_score", "if": {"quality_score": "<5"}, "action": "Anahtar kelime ve reklam metni uyumunu artır", "priority": "high"}
 ]'::jsonb,
 '[
   {"id": "no_conversions_with_spend", "condition": "spend>500 AND conversions=0", "severity": "critical"},
   {"id": "impression_share_budget_lost", "condition": "impression_share_lost_budget>50", "severity": "high"},
   {"id": "low_ctr_search", "condition": "ctr<1.5", "severity": "high"}
 ]'::jsonb),

-- ───────────────── GOOGLE: DISPLAY ─────────────────
('google', 'google_display', NULL, 'MAXIMIZE_CLICKS', 'DISPLAY',
 'Google Display',
 'Display Network''te görsel reklamlarla geniş kitlelere ulaşmak için kullanılır. Viewable impressions, CTR ve assisted conversions ana sinyaller.',
 '{"primary": ["viewable_impressions", "ctr", "cpc", "cpm", "assisted_conversions"], "secondary": ["clicks", "conversions"], "benchmarks": {"ctr_min": 0.3, "ctr_good": 0.7, "viewability_min": 50}}'::jsonb,
 '{"signals": ["low_viewability", "low_ctr_below_0_2", "weak_asset_diversity", "wrong_placement_or_audience", "impression_no_click"], "common_mistakes": ["search_keywords_display_de_kullanmak", "tek_image_size", "asset_eksikligi"]}'::jsonb,
 '{"required": ["images_min_3_sizes", "logo", "headline_short", "headline_long", "description", "cta_text", "final_url"], "recommended": ["video_asset", "responsive_display_assets", "audience_signals"]}'::jsonb,
 '{"audience_strategies": ["affinity", "in_market", "remarketing", "custom_intent"], "principles": ["audience_first_keyword_yedek", "remarketing_zorunlu_e_ticaret"], "anti_patterns": ["search_intent_based_keywords_display_de_zayif"]}'::jsonb,
 '{"preferred": "MAXIMIZE_CLICKS", "alternatives": ["TARGET_CPA", "VIEWABLE_CPM"], "min_daily_budget_try": 50, "rules": ["frequency_cap_3_per_week_per_user"]}'::jsonb,
 '{"image_clarity": true, "short_headline_under_30_char": true, "strong_cta": true, "logo_visible": true, "asset_diversity": "min_3_image_sizes"}'::jsonb,
 '{"avoid": ["clickbait", "zayif_landing_page"], "compliance": ["google_display_policies"]}'::jsonb,
 '[
   {"id": "diversify_assets", "if": {"asset_count": "<5"}, "action": "Daha fazla görsel/headline asset ekle (responsive)", "priority": "high"},
   {"id": "add_remarketing", "if": {"e_commerce": true, "remarketing_audience": false}, "action": "Remarketing audience ekle", "priority": "high"},
   {"id": "frequency_cap", "if": {"frequency": ">5"}, "action": "Haftalık frekans tavanı belirle", "priority": "medium"}
 ]'::jsonb,
 '[
   {"id": "no_viewability", "condition": "viewability<30", "severity": "high"},
   {"id": "weak_assets", "condition": "asset_count<3", "severity": "medium"}
 ]'::jsonb),

-- ───────────────── GOOGLE: VIDEO ─────────────────
('google', 'google_video', NULL, 'TARGET_CPV', 'VIDEO',
 'Google Video (YouTube)',
 'YouTube üzerinde video reklamlarla erişim, etkileşim veya dönüşüm üretmek için kullanılır. View rate, CPV ve ilk 5 saniye performansı kritik.',
 '{"primary": ["view_rate", "cpv", "video_views", "engagement"], "secondary": ["conversions_if_action", "watch_time"], "benchmarks": {"view_rate_min": 25, "view_rate_good": 40, "cpv_max_try": 0.5}}'::jsonb,
 '{"signals": ["low_view_rate_below_15", "drop_off_first_5_sec", "creative_mismatch_with_audience", "skippable_unskippable_yanlis_kullanim"], "common_mistakes": ["video_disabled_skip_15_sec_kacirma", "marka_logosu_geç_gosterilmesi", "mobile_landscape_optimization_eksikligi"]}'::jsonb,
 '{"required": ["video_url_youtube", "headline", "cta_text", "final_url"], "recommended": ["companion_banner", "card_overlays", "vertical_video_for_shorts"]}'::jsonb,
 '{"audience_strategies": ["affinity", "custom_intent", "in_market", "video_remarketing"], "principles": ["bumper_6_sec_brand", "trueview_skippable_15_30_sec", "outstream_brand_safe_placement"]}'::jsonb,
 '{"preferred": "TARGET_CPV", "alternatives": ["MAXIMIZE_CONVERSIONS", "TARGET_CPM"], "min_daily_budget_try": 75, "rules": ["format_fits_objective"]}'::jsonb,
 '{"hook_first_5_sec": true, "brand_logo_visible_early": true, "cta_overlay": true, "vertical_for_mobile_shorts": true}'::jsonb,
 '{"avoid": ["telif_haklari_ihlali", "yaniltici_thumbnail"], "compliance": ["youtube_advertising_policies"]}'::jsonb,
 '[
   {"id": "improve_hook", "if": {"view_rate": "<20"}, "action": "İlk 5 saniyeyi güçlendir, hook ekle", "priority": "high"},
   {"id": "add_cta_overlay", "if": {"cta_present": false}, "action": "Video üstüne CTA overlay ekle", "priority": "medium"},
   {"id": "shorten_for_shorts", "if": {"placement_shorts": true, "duration": ">60s"}, "action": "Shorts için 30 saniye altı dikey video hazırla", "priority": "medium"}
 ]'::jsonb,
 '[
   {"id": "view_rate_collapse", "condition": "view_rate<15", "severity": "high"},
   {"id": "cpv_spike", "condition": "cpv>1.5", "severity": "medium"}
 ]'::jsonb),

-- ───────────────── GOOGLE: PERFORMANCE MAX ─────────────────
('google', 'google_pmax', NULL, 'MAXIMIZE_CONVERSIONS', 'PERFORMANCE_MAX',
 'Google Performance Max',
 'Tüm Google envanterini (Search, Display, YouTube, Discover, Gmail, Maps) tek kampanyada otomasyonla kullanır. Asset variety, audience signals ve conversion tracking kritiktir.',
 '{"primary": ["conversions", "conversion_value", "roas", "asset_strength"], "secondary": ["clicks", "ctr", "audience_signal_quality"], "benchmarks": {"asset_strength": "GOOD", "conversion_min_per_month": 30, "roas_min": 2}}'::jsonb,
 '{"signals": ["asset_strength_poor", "missing_conversion_tracking", "weak_audience_signals", "budget_learning_phase_stuck", "asset_group_imbalance"], "common_mistakes": ["search_keywords_kullanmaya_calismak", "audience_signal_eksikligi", "asset_diversity_dusuk", "conversion_value_eksikligi"]}'::jsonb,
 '{"required": ["images_min_5_3_aspect_ratios", "logos_min_2", "headlines_min_5", "long_headlines_min_5", "descriptions_min_5", "video_min_1", "final_url", "conversion_goals"], "recommended": ["audience_signals", "negative_brand_keywords_via_support", "feed_for_ecommerce"]}'::jsonb,
 '{"audience_signals": "must_provide_first_party_data_seed", "principles": ["audience_signals_speed_up_learning", "asset_groups_per_theme", "feed_required_for_retail"], "anti_patterns": ["audience_signals_olmadan_dogrudan_pmax"]}'::jsonb,
 '{"preferred": "MAXIMIZE_CONVERSIONS", "alternatives": ["TARGET_CPA", "TARGET_ROAS", "MAXIMIZE_CONVERSION_VALUE"], "min_daily_budget_try": 200, "rules": ["min_50_conversion_per_month_target_roas_icin", "ilk_2_hafta_ogrenme_fazi_bekle"]}'::jsonb,
 '{"asset_diversity_critical": true, "video_required_or_auto_generated": true, "audience_signal_required": true, "headlines_focus_value_prop": true}'::jsonb,
 '{"avoid": ["yanlis_brand_safety_kategorileri"], "compliance": ["google_ads_policies", "trademark_handling"]}'::jsonb,
 '[
   {"id": "add_audience_signals", "if": {"audience_signals": false}, "action": "First-party audience signal ekle", "priority": "critical"},
   {"id": "improve_asset_strength", "if": {"asset_strength": "POOR"}, "action": "Asset diversity artır (5+ image, 1+ video)", "priority": "high"},
   {"id": "enable_value_tracking", "if": {"conversion_value_tracking": false}, "action": "Conversion value tracking ekle (TARGET_ROAS için zorunlu)", "priority": "high"}
 ]'::jsonb,
 '[
   {"id": "asset_strength_poor", "condition": "asset_strength=POOR", "severity": "critical"},
   {"id": "no_audience_signals", "condition": "audience_signals_count=0", "severity": "high"},
   {"id": "stuck_learning", "condition": "learning_phase>14_days", "severity": "medium"}
 ]'::jsonb)

ON CONFLICT DO NOTHING;
