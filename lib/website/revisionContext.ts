import type { WebsitePage } from './types'

/**
 * 'edit' (cerrahi düzenleme) modunda AI'ın neyi değiştireceğini bilmesi için mevcut sitenin
 * kompakt içerik özetini üretir (bölüm tipi + başlık + kısa metin). Böylece AI "Hizmetler
 * bölümü" denince neyi kastettiğini bilir ve belirtilmeyen kısımları olduğu gibi korur.
 * Tek dil (locale) sayfaları beklenir.
 */
export function summarizeSiteForRevision(pages: WebsitePage[]): string {
  const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
  const items = (v: unknown): string[] =>
    (Array.isArray(v) ? (v as Record<string, unknown>[]) : [])
      .map((x) => str(x.title))
      .filter(Boolean)
      .slice(0, 6)

  const lines: string[] = []
  for (const page of pages) {
    lines.push(`## Sayfa: ${page.slug}`)
    for (const block of page.sections) {
      const c = (block.content ?? {}) as Record<string, unknown>
      switch (block.type) {
        case 'hero':
          lines.push(`- hero: başlık="${str(c.title)}" · alt="${str(c.subtitle).slice(0, 90)}"`)
          break
        case 'services':
          lines.push(`- services: "${str(c.heading)}" → ${items(c.items).join(', ') || '(öğe yok)'}`)
          break
        case 'features':
          lines.push(`- features: "${str(c.heading)}" → ${items(c.items).join(', ') || '(öğe yok)'}`)
          break
        case 'split':
          lines.push(`- split: "${str(c.heading)}" · ${str(c.body).slice(0, 90)}`)
          break
        case 'gallery':
          lines.push(`- gallery: görsel grid${str(c.heading) ? ` ("${str(c.heading)}")` : ''}`)
          break
        case 'about':
          lines.push(`- about: "${str(c.heading)}" · ${str(c.body).slice(0, 90)}`)
          break
        case 'cta':
          lines.push(`- cta: "${str(c.heading)}"`)
          break
        case 'contact':
          lines.push(`- contact: "${str(c.heading)}"`)
          break
        default:
          break
      }
    }
  }
  return lines.join('\n').slice(0, 2800)
}
