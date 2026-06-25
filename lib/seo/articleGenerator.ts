import 'server-only'
import { buildStructuredSeoArticlePrompt, type StructuredSeoInput } from '@/lib/dijimagic/prompts'
import { claudeText, isClaudeReady } from '@/lib/anthropic/text'

/**
 * Yapılı (non-streaming) SEO makale üretimi.
 *
 * buildStructuredSeoArticlePrompt ile tek JSON objesi üretir:
 * title, metaDescription, slug, markdown, imageAltText, imagePrompt.
 * Otomatik akış (inngest/seoArticleRun) ve manuel "şimdi üret" akışında
 * kullanılır. Mevcut streaming /api/dijimagic/chat akışına dokunmaz.
 */

export interface GeneratedArticle {
  title: string
  metaDescription: string
  slug: string
  markdown: string
  imageAltText: string
  imagePrompt: string
  wordCount: number
}

function slugify(input: string): string {
  const map: Record<string, string> = {
    ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
    Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u',
  }
  return input
    .split('')
    .map((c) => map[c] ?? c)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

/** Modelden gelen metinden ilk JSON objesini ayıkla (kod bloğu vb. toleranslı). */
function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch {
    return null
  }
}

export async function generateArticle(input: StructuredSeoInput): Promise<GeneratedArticle> {
  if (!isClaudeReady()) throw new Error('ANTHROPIC_API_KEY not configured')

  const systemPrompt = buildStructuredSeoArticlePrompt(input)

  const content = await claudeText({
    system: systemPrompt,
    user: 'Makaleyi üret ve SADECE geçerli bir JSON objesi döndür (kod bloğu/açıklama ekleme).',
    maxTokens: 8000,
    temperature: 0.6,
    timeoutMs: 90000,
  })

  if (content == null) {
    throw new Error('article_generation_failed_claude')
  }

  const parsed = extractJson(content)
  if (!parsed) throw new Error('article_generation_invalid_json')

  const title = String(parsed.title || input.keyword).trim()
  const markdown = String(parsed.markdown || '').trim()
  if (!markdown) throw new Error('article_generation_empty_content')

  const metaDescription = String(parsed.metaDescription || '').trim().slice(0, 160)
  const slug = (String(parsed.slug || '').trim() && slugify(String(parsed.slug))) || slugify(title)
  const imageAltText = String(parsed.imageAltText || title).trim()
  const imagePrompt = String(parsed.imagePrompt || `Professional blog header image about ${input.keyword}, photorealistic, no text`).trim()

  return {
    title,
    metaDescription,
    slug,
    markdown,
    imageAltText,
    imagePrompt,
    wordCount: markdown.split(/\s+/).filter(Boolean).length,
  }
}
