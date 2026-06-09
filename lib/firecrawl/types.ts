/* YoAi — Firecrawl tip tanımları */

/** map endpoint'inden dönen tek bir bağlantı */
export interface MapLink {
  url: string
  title?: string | null
  description?: string | null
}

/** scrape endpoint'inden dönen tek bir sayfa (normalize edilmiş) */
export interface FirecrawlPage {
  url: string
  title: string | null
  description: string | null
  markdown: string
}

/** scrapeSite() birleşik çıktısı */
export interface SiteScrapeResult {
  /** Tüm seçili sayfaların birleşik temiz markdown'ı */
  markdown: string
  /** İlk başarılı sayfanın başlığı (genelde anasayfa) */
  title: string | null
  /** İlk başarılı sayfanın meta açıklaması */
  description: string | null
  /** Başarıyla taranan sayfa sayısı */
  pagesScanned: number
  /** Süre/limit nedeniyle erken kesildi mi */
  truncated: boolean
}
