// Meta reklam URL yardımcıları (saf, yan etkisiz — test edilebilir).

export interface UtmParams {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
}

/**
 * url_tags: kanonik AdCreative alanı. Meta bunu teslimde tüm hedef URL'lere ekler ve
 * dinamik makroları ({{ad.id}}, {{placement}}...) gerçek değerle çözer. Link'e elle concat
 * edildiğinde makrolar literal kalıyordu — bu yüzden UTM'ler url_tags ile gönderilir.
 */
export function buildUrlTags(utmParams?: UtmParams): string {
  if (!utmParams) return ''
  const parts: string[] = []
  if (utmParams.utmSource) parts.push(`utm_source=${utmParams.utmSource}`)
  if (utmParams.utmMedium) parts.push(`utm_medium=${utmParams.utmMedium}`)
  if (utmParams.utmCampaign) parts.push(`utm_campaign=${utmParams.utmCampaign}`)
  if (utmParams.utmContent) parts.push(`utm_content=${utmParams.utmContent}`)
  return parts.join('&')
}

/** conversion_domain: pixel'li dönüşüm reklamlarında atıf için (yalnız 1.+2. düzey domain). */
export function extractConversionDomain(url?: string): string | undefined {
  if (!url || typeof url !== 'string') return undefined
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    const host = u.hostname.replace(/^www\./, '')
    if (!host || host.includes('facebook.com') || host.includes('fb.me') || host.includes('ig.me') || host.includes('m.me') || host.startsWith('tel:')) return undefined
    return host
  } catch {
    return undefined
  }
}
