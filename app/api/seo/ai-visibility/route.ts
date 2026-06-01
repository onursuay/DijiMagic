import { NextRequest, NextResponse } from 'next/server'

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions'

function extractDomain(raw: string): string {
  try {
    let url = raw.trim()
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return raw.trim().replace(/^www\./, '')
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

    const domain = extractDomain(url)

    const apiKey = process.env.PERPLEXITY_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        visible: false,
        excerpt: null,
        domain,
        error: 'not_configured',
      })
    }

    const prompt = `What is ${domain}? Briefly describe this website or business in 2-3 sentences.`

    const response = await fetch(PERPLEXITY_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(20000),
    })

    if (!response.ok) {
      const errText = await response.text()
      return NextResponse.json({ error: `Perplexity API error: ${response.status}`, detail: errText }, { status: 502 })
    }

    const data = await response.json()
    const content: string = data?.choices?.[0]?.message?.content ?? ''

    // Check if the response actually knows about this domain
    // (if it says "I don't know", "no information", "cannot find", it's not visible)
    const notKnownPhrases = [
      "i don't have", "i do not have", "no information", "cannot find",
      "no specific information", "i couldn't find", "i could not find",
      "not aware", "don't know", "do not know", "unable to find",
      "bilinmiyor", "bilgi yok", "bulunamadı",
    ]
    const lower = content.toLowerCase()
    const notVisible = notKnownPhrases.some(p => lower.includes(p))

    // Also check if domain name appears in response
    const domainBase = domain.split('.')[0] // e.g. "elysiumgardenhotel" from "elysiumgardenhotel.com"
    const domainMentioned = lower.includes(domainBase.toLowerCase()) || lower.includes(domain.toLowerCase())

    const visible = !notVisible && (domainMentioned || content.length > 50)

    return NextResponse.json({
      visible,
      excerpt: content.length > 0 ? content.substring(0, 300) : null,
      domain,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
