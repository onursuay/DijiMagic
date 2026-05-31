/**
 * Unified Meta configuration
 * Centralizes Graph API version and related constants
 */

export const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v24.0";

export const META_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
export const META_OAUTH_BASE_URL = `https://www.facebook.com/${META_GRAPH_VERSION}`;

/** Single source for Meta OAuth scopes
 *  Only request scopes that have a real, demonstrable feature in the app.
 *  Each scope must have Advanced Access approval via Meta App Review.
 *
 *  pages_manage_metadata: CRM Lead Ads webhook aboneliği (POST
 *  /{page_id}/subscribed_apps?subscribed_fields=leadgen) BU izni zorunlu kılar.
 *  Olmadan "Sayfa Bağla" sayfayı leadgen webhook'una abone edemez (#200). App
 *  admin (owner) review beklemeden alır; diğer kullanıcılar App Review sonrası.
 *  Pull akışı (leads_retrieval) bu izinden bağımsız çalışır (fallback).
 *
 *  Removed (no active feature / review risk):
 *  - instagram_manage_messages → IG Direct ads use ads_management; no DM read/reply feature exists
 */
export const META_SCOPES = [
  "ads_read",
  "ads_management",
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_ads",
  "pages_manage_posts",
  "pages_manage_metadata",
  "leads_retrieval",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
  "whatsapp_business_management",
  "whatsapp_business_messaging",
].join(",");
