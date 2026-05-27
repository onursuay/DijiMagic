import { INTENT_DETECTION_PROMPT } from '@/lib/yoai/prompts'
import type { ContentCategory } from '@/lib/yoai/types'
import { claudeText, isClaudeReady } from '@/lib/anthropic/text'

export const runtime = 'edge'

const VALID_INTENTS: ContentCategory[] = [
  'seo_article',
  'ad_copy',
  'social_media',
  'email_marketing',
  'product_description',
  'landing_page',
  'slogan',
  'off_topic',
]

export async function POST(req: Request) {
  try {
    const { message } = (await req.json()) as { message: string }

    if (!message) {
      return Response.json({ error: 'Mesaj gerekli' }, { status: 400 })
    }

    if (!isClaudeReady()) {
      return Response.json({ error: 'AI servisi yapılandırılmamış' }, { status: 500 })
    }

    const text = await claudeText({
      system: INTENT_DETECTION_PROMPT,
      user: message,
      maxTokens: 30,
      temperature: 0,
    })

    if (text == null) {
      console.error('[YoAi Intent] Claude error')
      return Response.json({ error: 'AI yanıt veremedi' }, { status: 502 })
    }

    const raw = text.trim().toLowerCase()

    // Extract valid intent from response
    const intent: ContentCategory = VALID_INTENTS.find((i) => raw.includes(i)) || 'off_topic'

    return Response.json({ intent })
  } catch (err) {
    console.error('[YoAi Intent] Unexpected error:', err)
    return Response.json({ error: 'Beklenmeyen bir hata oluştu' }, { status: 500 })
  }
}
