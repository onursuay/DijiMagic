import type {
  SiteConnector,
  SiteCredentials,
  PublishInput,
  PublishResult,
  MediaUploadResult,
  ConnectionTestResult,
} from './types'

/**
 * WordPress connector — XML-RPC (xmlrpc.php) fallback.
 *
 * NEDEN: Bazı (özellikle Türk paylaşımlı) hostlar `Authorization` başlığını PHP'ye
 * iletmeden düşürür. Bu durumda REST + Application Password yöntemi çalışmaz
 * (WordPress kimliği hiç görmez → `rest_not_logged_in`). XML-RPC ise kullanıcı
 * adı + parolayı istek GÖVDESİNDE taşır; `Authorization` başlığına ihtiyaç
 * duymaz, dolayısıyla başlık düşürmesinden etkilenmez.
 *
 * AYNI uygulama parolası kullanılır (WordPress core, XMLRPC_REQUEST için de
 * Application Passwords doğrulamasını kabul eder). Kullanıcı için hiçbir şey
 * değişmez — yalnız taşıma yolu farklıdır.
 *
 * Kullanılan metotlar:
 *  - wp.getUsersBlogs(user, pass)                         → doğrulama + blogId
 *  - wp.uploadFile(blogId, user, pass, {name,type,bits})  → öne çıkan görsel
 *  - wp.newPost(blogId, user, pass, content)              → makale yayını
 *  - wp.getPost(blogId, user, pass, postId, ['link'])     → gerçek permalink
 *
 * Bağımlılık yok: küçük bir XML-RPC istemci + parser elle yazılmıştır
 * (yalnız bu dört metodun ürettiği yanıt biçimleri için yeterli).
 *
 * NOT: Meta/Google reklam entegrasyonundan tamamen bağımsızdır.
 */

/* ── XML-RPC değer modeli ────────────────────────────────────── */

type XmlRpcValue = string | number | boolean | null | XmlRpcValue[] | { [k: string]: XmlRpcValue }

interface XmlNode {
  name: string
  children: XmlNode[]
  text: string
}

/* ── İstek (encode) ──────────────────────────────────────────── */

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function vString(s: string): string {
  return `<value><string>${xmlEscape(s)}</string></value>`
}
function vInt(n: number): string {
  return `<value><int>${Math.trunc(n)}</int></value>`
}
function vBool(b: boolean): string {
  return `<value><boolean>${b ? 1 : 0}</boolean></value>`
}
function vBase64(b64: string): string {
  return `<value><base64>${b64}</base64></value>`
}
function vStringArray(items: string[]): string {
  const inner = items.map((s) => vString(s)).join('')
  return `<value><array><data>${inner}</data></array></value>`
}
function vStruct(members: Record<string, string>): string {
  const inner = Object.entries(members)
    .map(([k, val]) => `<member><name>${xmlEscape(k)}</name>${val}</member>`)
    .join('')
  return `<value><struct>${inner}</struct></value>`
}
function buildMethodCall(method: string, paramValues: string[]): string {
  const params = paramValues.map((p) => `<param>${p}</param>`).join('')
  return `<?xml version="1.0"?><methodCall><methodName>${method}</methodName><params>${params}</params></methodCall>`
}

/* ── Yanıt (decode) ──────────────────────────────────────────── */

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&') // en son: yeni & üretmemek için
}

/** Minimal XML ağacı. XML-RPC iyi biçimlidir; string içi <,>,& zaten kaçışlanır. */
function parseXml(xml: string): XmlNode {
  const root: XmlNode = { name: '#root', children: [], text: '' }
  const stack: XmlNode[] = [root]
  const re = /<([^>]+)>|([^<]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    if (m[1] !== undefined) {
      const raw = m[1].trim()
      if (!raw || raw.startsWith('?') || raw.startsWith('!')) continue // bildirim/yorum
      if (raw.startsWith('/')) {
        if (stack.length > 1) stack.pop()
        continue
      }
      const selfClose = raw.endsWith('/')
      const name = (selfClose ? raw.slice(0, -1) : raw).trim().split(/\s+/)[0]
      const node: XmlNode = { name, children: [], text: '' }
      stack[stack.length - 1].children.push(node)
      if (!selfClose) stack.push(node)
    } else if (m[2] !== undefined) {
      stack[stack.length - 1].text += unescapeXml(m[2])
    }
  }
  return root
}

function findFirst(node: XmlNode, name: string): XmlNode | null {
  for (const c of node.children) {
    if (c.name === name) return c
    const deep = findFirst(c, name)
    if (deep) return deep
  }
  return null
}

function parseValue(valueNode: XmlNode): XmlRpcValue {
  const elem = valueNode.children[0]
  if (!elem) return valueNode.text // <value>text</value> → örtük string
  switch (elem.name) {
    case 'string':
      return elem.text
    case 'int':
    case 'i4':
      return parseInt(elem.text.trim(), 10)
    case 'boolean':
      return elem.text.trim() === '1'
    case 'double':
      return parseFloat(elem.text.trim())
    case 'base64':
    case 'dateTime.iso8601':
      return elem.text.trim()
    case 'nil':
      return null
    case 'array': {
      const dataNode = elem.children.find((c) => c.name === 'data')
      if (!dataNode) return []
      return dataNode.children.filter((c) => c.name === 'value').map(parseValue)
    }
    case 'struct': {
      const obj: Record<string, XmlRpcValue> = {}
      for (const member of elem.children.filter((c) => c.name === 'member')) {
        const nameNode = member.children.find((c) => c.name === 'name')
        const valNode = member.children.find((c) => c.name === 'value')
        if (nameNode && valNode) obj[nameNode.text.trim()] = parseValue(valNode)
      }
      return obj
    }
    default:
      return elem.text
  }
}

interface MethodResult {
  fault?: { code: number; str: string }
  value?: XmlRpcValue
}

function parseMethodResponse(xml: string): MethodResult {
  const root = parseXml(xml)
  const methodResponse = findFirst(root, 'methodResponse')
  if (!methodResponse) throw new Error('xmlrpc_no_method_response')

  const fault = methodResponse.children.find((c) => c.name === 'fault')
  if (fault) {
    const valNode = fault.children.find((c) => c.name === 'value')
    const v = valNode ? parseValue(valNode) : {}
    const obj = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, XmlRpcValue>) : {}
    return { fault: { code: Number(obj.faultCode ?? 0), str: String(obj.faultString ?? '') } }
  }

  const param = methodResponse
    .children.find((c) => c.name === 'params')
    ?.children.find((c) => c.name === 'param')
  const valNode = param?.children.find((c) => c.name === 'value')
  return { value: valNode ? parseValue(valNode) : undefined }
}

function asObject(v: XmlRpcValue | undefined): Record<string, XmlRpcValue> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, XmlRpcValue>) : {}
}

function cleanBase(url: string): string {
  return url.replace(/\/+$/, '')
}

/* ── Connector ───────────────────────────────────────────────── */

export class WordPressXmlRpcConnector implements SiteConnector {
  readonly platform = 'wordpress' as const
  private base: string
  private user: string
  private pass: string
  private blogId = '1'
  private blogIdResolved = false

  constructor(creds: SiteCredentials) {
    this.base = cleanBase(creds.baseUrl)
    this.user = creds.wpUsername || ''
    this.pass = creds.wpAppPassword || ''
  }

  private async call(method: string, params: string[], timeoutMs = 15_000): Promise<MethodResult> {
    const res = await fetch(`${this.base}/xmlrpc.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        Accept: 'text/xml, application/xml',
        'User-Agent': 'DijiMagic-SEO/1.0 (+https://dijimagic)',
      },
      body: buildMethodCall(method, params),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const text = await res.text()
    // Kimlik hatasında bile WP 200 + <fault> döner. XML değilse (HTML 403/404 →
    // xmlrpc kapalı/engelli) parse başarısız olur ve hata fırlatılır.
    return parseMethodResponse(text)
  }

  private async ensureBlogId(): Promise<void> {
    if (this.blogIdResolved) return
    try {
      const r = await this.call('wp.getUsersBlogs', [vString(this.user), vString(this.pass)])
      if (!r.fault && Array.isArray(r.value) && r.value.length > 0) {
        const first = asObject(r.value[0])
        if (first.blogid != null) this.blogId = String(first.blogid)
      }
    } catch {
      /* varsayılan blogId '1' ile devam */
    }
    this.blogIdResolved = true
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const r = await this.call('wp.getUsersBlogs', [vString(this.user), vString(this.pass)], 12_000)
      if (r.fault) {
        // 403 → kimlik gerçekten hatalı (gövdeden görüldü ve reddedildi)
        if (r.fault.code === 403) {
          return { ok: false, errorCode: 'auth', detail: 'Kullanıcı adı veya uygulama parolası hatalı.' }
        }
        // 405 vb. → xmlrpc bu sitede kapalı
        return { ok: false, errorCode: 'not_found', detail: 'XML-RPC bu sitede kapalı.' }
      }
      if (Array.isArray(r.value) && r.value.length > 0) {
        const first = asObject(r.value[0])
        if (first.blogid != null) this.blogId = String(first.blogid)
      }
      this.blogIdResolved = true
      return { ok: true, detail: 'Bağlantı doğrulandı (XML-RPC).' }
    } catch {
      // XML olmayan yanıt (xmlrpc kapalı/engelli) veya ağ/timeout
      return { ok: false, errorCode: 'network', detail: 'Siteye XML-RPC ile ulaşılamadı.' }
    }
  }

  async uploadMedia(imageUrl: string, _alt?: string): Promise<MediaUploadResult> {
    await this.ensureBlogId()
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(20_000) })
    if (!imgRes.ok) throw new Error(`image_fetch_failed_${imgRes.status}`)
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
    const b64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64')
    const filename = `featured-${Date.now()}.${ext}`

    const struct = vStruct({
      name: vString(filename),
      type: vString(contentType),
      bits: vBase64(b64),
      overwrite: vBool(true),
    })
    const r = await this.call(
      'wp.uploadFile',
      [vString(this.blogId), vString(this.user), vString(this.pass), struct],
      30_000,
    )
    if (r.fault) throw new Error(`media_upload_failed_${r.fault.code}_${r.fault.str.slice(0, 80)}`)
    const obj = asObject(r.value)
    const rawId = obj.id
    const mediaId =
      typeof rawId === 'number' ? rawId : rawId != null ? parseInt(String(rawId), 10) : undefined
    const url = obj.url != null ? String(obj.url) : imageUrl
    // XML-RPC wp.uploadFile alt_text desteklemez — best-effort atlanır (görsel yine de eklenir).
    return { mediaId, url }
  }

  async publishArticle(input: PublishInput): Promise<PublishResult> {
    try {
      await this.ensureBlogId()

      let featuredMediaId: number | undefined
      if (input.featuredImageUrl) {
        try {
          const media = await this.uploadMedia(input.featuredImageUrl, input.featuredImageAlt || input.title)
          featuredMediaId = typeof media.mediaId === 'number' && !Number.isNaN(media.mediaId) ? media.mediaId : undefined
        } catch (err) {
          // Görsel yüklenemese bile makaleyi görselsiz yayınla (kayıp olmasın).
          console.error('[WordPressXmlRpcConnector] media_upload_error', (err as Error).message)
        }
      }

      const members: Record<string, string> = {
        post_type: vString('post'),
        post_status: vString(input.status), // 'publish' | 'draft'
        post_title: vString(input.title),
        post_content: vString(input.contentHtml),
      }
      if (input.slug) members.post_name = vString(input.slug)
      if (input.metaDescription) members.post_excerpt = vString(input.metaDescription)
      if (featuredMediaId) members.post_thumbnail = vInt(featuredMediaId)

      const r = await this.call(
        'wp.newPost',
        [vString(this.blogId), vString(this.user), vString(this.pass), vStruct(members)],
        30_000,
      )
      if (r.fault) {
        return {
          ok: false,
          errorCode: r.fault.code === 403 ? 'auth' : 'unknown',
          error: r.fault.str || `WordPress XML-RPC hatası (${r.fault.code}).`,
        }
      }

      const postId = r.value != null ? String(r.value) : undefined
      let postUrl = postId ? `${this.base}/?p=${postId}` : this.base

      // Gerçek permalink'i al (best-effort).
      if (postId) {
        try {
          const g = await this.call(
            'wp.getPost',
            [vString(this.blogId), vString(this.user), vString(this.pass), vString(postId), vStringArray(['link'])],
            12_000,
          )
          if (!g.fault) {
            const link = asObject(g.value).link
            if (link) postUrl = String(link)
          }
        } catch {
          /* permalink best-effort — başarısız olursa ?p=id kalır */
        }
      }

      return { ok: true, postId, postUrl, mediaId: featuredMediaId }
    } catch {
      return { ok: false, errorCode: 'network', error: 'WordPress bağlantı hatası (XML-RPC).' }
    }
  }
}
