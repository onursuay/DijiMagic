import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { chargeFeature } from '@/lib/billing/featureGuard'
import { getWebsite, getPages, replacePages, createVersion, listVersions } from '@/lib/website/store'
import { WEBSITE_REVISION_COST, WEBSITE_FREE_REVISIONS } from '@/lib/website/credits'
import { applyBlockPatch } from '@/lib/website/codegen/applyBlockPatch'
import { gateSiteHtml } from '@/lib/website/codegen/renderGate'
import { logEditEvent } from '@/lib/website/editEvents'
import { logGenerationBreakdown } from '@/lib/website/creditEvents'
import type {
  PageRole,
  Website,
  WebsitePage,
  WebsitePageInput,
  WebsiteSnapshot,
} from '@/lib/website/types'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .mjs imported from TS; Next.js bundler resolves it fine at runtime
import { extractBlocks as _extractBlocks, mergeBlocks as _mergeBlocks } from '@/lib/website/codegen/blockMap.mjs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Block = { id: string; role: string; html: string; start?: number; end?: number }
const extractBlocks = _extractBlocks as (bodyHtml: string) => Block[]
const mergeBlocks = _mergeBlocks as (
  originalBody: string,
  blocks: Block[],
  ops: { op: string; targetId: string; after?: string }[],
  newHtmlById: Record<string, string>,
) => string

/**
 * #builder-8b — VISUAL EDIT targeted PATCH endpoint.
 *
 * Tuvalde tıkla-seç ile seçilen bloğun CERRAHİ (block-level) düzenlemesi. Tam üretim
 * YASAK — yalnız hedef blok değişir, dokunulmayan bloklar BYTE-AYNI kalır. Mevcut
 * block-patch motoru ([applyBlockPatch] + [blockMap]/[patchPlanner]) YENİDEN KULLANILIR.
 *
 * Body: { op, targetId, content?, instruction?, after? }
 *   - 'edit'        → content (alan değerleri) → talimata çevrilir → applyBlockPatch (AI)
 *   - 'ai_rewrite'  → instruction (serbest komut) → applyBlockPatch (AI)
 *   - 'delete'      → blockMap mergeBlocks (deterministik, AI YOK) → gate → persist
 *   - 'move'        → blockMap mergeBlocks (deterministik, AI YOK) → gate → persist
 *
 * Güvenlik: applyBlockPatch sanitize + renderGate'i YENİDEN GEÇİRİR (kötü niyetli
 * düzenleme enjekte EDEMEZ); delete/move de gate'ten geçer. Önizlenen sayfa+dil
 * üzerinde çalışır; sahiplik getWebsite(userId, id) ile doğrulanır.
 *
 * Ücret: görsel düzenleme = REVİZYON (ilk WEBSITE_FREE_REVISIONS ücretsiz, sonrası
 * WEBSITE_REVISION_COST) — mevcut politikayla PARİTE, ÇİFT DÜŞÜM YOK (tek charge).
 * delete/move AI çağırmaz ama yine de bir revizyon sürümüdür (geri-al için snapshot).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    op?: string
    targetId?: string
    targetSlug?: string
    targetLocale?: string
    content?: Record<string, unknown>
    instruction?: string
    after?: string
  }

  const op = body.op
  const targetId = typeof body.targetId === 'string' ? body.targetId.trim() : ''
  const targetSlug = (typeof body.targetSlug === 'string' ? body.targetSlug.trim() : '') || 'home'
  const targetLocale = typeof body.targetLocale === 'string' ? body.targetLocale.trim() : ''
  const after = typeof body.after === 'string' ? body.after.trim() : ''
  const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : ''

  // ── Op validation (deterministic security gate) ───────────────────────────────
  // Only the four allowlisted ops; every op (except a front-insert/move) needs a target.
  if (op !== 'edit' && op !== 'ai_rewrite' && op !== 'delete' && op !== 'move') {
    return NextResponse.json({ ok: false, error: 'Geçersiz işlem' }, { status: 400 })
  }
  if (!targetId) {
    return NextResponse.json({ ok: false, error: 'Hedef blok belirtilmedi' }, { status: 400 })
  }
  // The block id contract is a simple "bN" — reject anything else (defense-in-depth;
  // mergeBlocks/applyBlockPatch also validate against the REAL block id set).
  if (!/^b\d+$/.test(targetId)) {
    return NextResponse.json({ ok: false, error: 'Geçersiz hedef' }, { status: 400 })
  }

  const site = await getWebsite(user.id, params.id)
  if (!site) return NextResponse.json({ ok: false, error: 'Bulunamadı' }, { status: 404 })

  // ── Revision charge (parity with the generate route's free-3 policy) ──────────
  // A visual edit IS a revision → first WEBSITE_FREE_REVISIONS free, then the flat
  // revision cost. ONE charge per patch (no double-charge). Owner bypass + 402 on
  // insufficient balance are handled inside chargeFeature.
  let cost: number
  try {
    const versions = await listVersions(user.id, site.id)
    const usedRevisions = versions.filter((v) => v.reason === 'revision').length
    cost = usedRevisions < WEBSITE_FREE_REVISIONS ? 0 : WEBSITE_REVISION_COST
  } catch {
    cost = WEBSITE_REVISION_COST
  }
  const access = await chargeFeature({ featureKey: 'website_generation', creditCost: cost })
  if (!access.ok) return NextResponse.json(access.body, { status: access.status })

  try {
    // ── edit / ai_rewrite → AI block-patch (REUSE applyBlockPatch) ──────────────
    if (op === 'edit' || op === 'ai_rewrite') {
      const editInstruction =
        op === 'ai_rewrite'
          ? buildRewriteInstruction(instruction)
          : buildEditInstruction(body.content)
      if (!editInstruction) {
        await access.refund()
        return NextResponse.json({ ok: false, error: 'Düzenleme içeriği boş' }, { status: 400 })
      }
      const patch = await applyBlockPatch(user.id, site, {
        targetSlug,
        targetLocale,
        instruction: editInstruction,
      })
      if (patch.ok !== true) {
        await access.refund()
        return NextResponse.json({ ok: false, error: 'Düzenleme uygulanamadı' }, { status: 422 })
      }
      const persisted = await persistTargetPage(user.id, site, patch.page, access.spent)
      if (!persisted) {
        await access.refund()
        return NextResponse.json({ ok: false, error: 'Kaydedilemedi' }, { status: 500 })
      }
      await logEditEvent({
        websiteId: site.id,
        userId: user.id,
        versionId: persisted.versionId,
        editKind: 'visual_edit',
        targetBlockId: targetId,
        delta: { op, slug: targetSlug, locale: targetLocale },
      })
      await logGenerationBreakdown({
        websiteId: site.id,
        userId: user.id,
        versionId: persisted.versionId,
        chargedTotal: access.spent,
        pageCount: 1,
        localeCount: 1,
        hasImages: false,
      })
      return NextResponse.json({ ok: true, pages: persisted.pages, creditCharged: access.spent })
    }

    // ── delete / move → DETERMINISTIC byte-splice (REUSE blockMap, NO AI) ───────
    const det = await applyDeterministicOp(user.id, site, {
      op,
      targetId,
      targetSlug,
      targetLocale,
      after,
    })
    if (det.ok !== true) {
      await access.refund()
      const status = det.reason === 'page_not_found' || det.reason === 'block_not_found' ? 404 : 422
      return NextResponse.json({ ok: false, error: 'İşlem uygulanamadı' }, { status })
    }
    const persisted = await persistTargetPage(user.id, site, det.page, access.spent)
    if (!persisted) {
      await access.refund()
      return NextResponse.json({ ok: false, error: 'Kaydedilemedi' }, { status: 500 })
    }
    await logEditEvent({
      websiteId: site.id,
      userId: user.id,
      versionId: persisted.versionId,
      editKind: 'visual_edit',
      targetBlockId: targetId,
      delta: { op, slug: targetSlug, locale: targetLocale, ...(op === 'move' ? { after } : {}) },
    })
    await logGenerationBreakdown({
      websiteId: site.id,
      userId: user.id,
      versionId: persisted.versionId,
      chargedTotal: access.spent,
      pageCount: 1,
      localeCount: 1,
      hasImages: false,
    })
    return NextResponse.json({ ok: true, pages: persisted.pages, creditCharged: access.spent })
  } catch (e) {
    await access.refund()
    const message = e instanceof Error ? e.message : 'Düzenlenemedi'
    console.error('[website:patch]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Instruction builders — turn inspector field values / free-form into a single
// natural-language instruction the EXISTING block regenerator understands.
// ---------------------------------------------------------------------------

/** Free-form AI rewrite → a bounded "rewrite this block" instruction. */
function buildRewriteInstruction(raw: string): string {
  const r = (raw || '').trim()
  if (r) return r
  // Empty instruction → a safe default: keep meaning, refresh the copy.
  return 'Bu bölümün metnini, aynı anlamı ve yapıyı koruyarak daha akıcı ve etkili biçimde yeniden yaz.'
}

/**
 * Inspector field values → a deterministic, low-ambiguity edit instruction. We pass
 * the user's NEW values as labelled key→value lines so the block regenerator updates
 * exactly those texts. Values are length-capped; the regenerator re-sanitizes + the
 * gate re-runs, so no markup can be injected through these strings.
 */
function buildEditInstruction(content: unknown): string {
  if (!content || typeof content !== 'object') return ''
  const lines: string[] = []
  for (const [key, value] of Object.entries(content as Record<string, unknown>)) {
    if (typeof value === 'string') {
      const v = value.trim()
      if (v) lines.push(`- "${key}" alanını şu metinle güncelle: ${clip(v, 600)}`)
    } else if (Array.isArray(value)) {
      // List field (e.g. menu links) → describe each item compactly.
      const items = value
        .filter((it) => it && typeof it === 'object')
        .map((it, i) => `  ${i + 1}. ${clip(JSON.stringify(it), 300)}`)
        .join('\n')
      if (items) lines.push(`- "${key}" listesini şu öğelerle güncelle:\n${items}`)
    }
  }
  if (lines.length === 0) return ''
  return `Bu bölümün içeriğini SADECE aşağıdaki alanlarla güncelle (tasarımı, düzeni ve diğer metinleri DEĞİŞTİRME):\n${lines.join('\n')}`
}

function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s
}

// ---------------------------------------------------------------------------
// Deterministic delete / move — byte-splice via blockMap, then re-gate.
// ---------------------------------------------------------------------------

type DetResult =
  | { ok: true; page: WebsitePageInput }
  | { ok: false; reason: string }

/**
 * Apply a delete/move op to ONE page deterministically (NO model call): extract the
 * blocks, validate the target id exists, splice via mergeBlocks (untouched blocks stay
 * byte-identical), then re-run the publish gate. Never throws — returns ok:false.
 */
async function applyDeterministicOp(
  userId: string,
  site: Website,
  input: { op: 'delete' | 'move'; targetId: string; targetSlug: string; targetLocale: string; after: string },
): Promise<DetResult> {
  try {
    const pages = await getPages(userId, site.id)
    const target = pickTargetPage(pages, input.targetSlug, input.targetLocale)
    if (!target) return { ok: false, reason: 'page_not_found' }
    const sourceBody = typeof target.html === 'string' ? target.html : ''
    if (target.format !== 'html' || !sourceBody) return { ok: false, reason: 'not_html_page' }

    const blocks = extractBlocks(sourceBody)
    if (blocks.length === 0) return { ok: false, reason: 'no_blocks' }
    const ids = new Set(blocks.map((b) => b.id))
    if (!ids.has(input.targetId)) return { ok: false, reason: 'block_not_found' }

    // Guard: never delete the LAST remaining block (would gut the page).
    if (input.op === 'delete' && blocks.length <= 1) return { ok: false, reason: 'cannot_delete_last' }

    // `after` (move anchor) must be a known block id, '' / '__start__' (front), or absent.
    const after =
      input.after === '' || input.after === '__start__'
        ? input.after
        : ids.has(input.after)
          ? input.after
          : undefined

    const ops =
      input.op === 'delete'
        ? [{ op: 'delete' as const, targetId: input.targetId }]
        : [{ op: 'move' as const, targetId: input.targetId, after }]

    const merged = mergeBlocks(sourceBody, blocks, ops, {})
    if (!merged || merged === sourceBody) return { ok: false, reason: 'no_change' }

    // Re-gate (sanitize → parse → structure → size) — same publish gate as every path.
    const gate = gateSiteHtml(merged)
    if (gate.ok === false) return { ok: false, reason: gate.reason }

    return {
      ok: true,
      page: {
        locale: target.locale,
        slug: target.slug,
        pageRole: target.pageRole as PageRole,
        sections: [],
        seo: target.seo,
        orderIndex: target.orderIndex,
        html: gate.html,
        format: 'html',
      },
    }
  } catch (e) {
    console.warn('[website:patch] deterministic op soft-fail:', e instanceof Error ? e.message : e)
    return { ok: false, reason: 'op_failed' }
  }
}

// ---------------------------------------------------------------------------
// Persist — ONLY the target page changes; all other pages/locales stay byte-exact.
// New 'revision' version (rollback snapshot). Mirrors generate route's persistBlockPatch.
// ---------------------------------------------------------------------------

async function persistTargetPage(
  userId: string,
  site: Website,
  patchedPage: WebsitePageInput,
  creditCharged: number,
): Promise<{ pages: Awaited<ReturnType<typeof replacePages>>; versionId: string } | null> {
  try {
    const current = await getPages(userId, site.id)
    if (current.length === 0) return null

    const inputs: WebsitePageInput[] = current.map((p) => {
      const isTarget = p.slug === patchedPage.slug && p.locale === patchedPage.locale
      return {
        locale: p.locale,
        slug: p.slug,
        pageRole: p.pageRole,
        sections: p.sections,
        seo: isTarget ? (patchedPage.seo ?? p.seo) : p.seo,
        orderIndex: p.orderIndex,
        html: isTarget ? patchedPage.html : p.html,
        format: p.format,
      }
    })

    const pages = await replacePages(userId, site.id, inputs)
    const snapshot: WebsiteSnapshot = {
      website: {
        label: site.label,
        siteType: site.siteType,
        defaultLocale: site.defaultLocale,
        locales: site.locales,
        category: site.category,
        theme: site.theme, // designVars/compiledCssVersion KORUNUR (patch temayı değiştirmez)
      },
      pages,
    }
    const versionId = await createVersion(site.id, snapshot, 'revision', creditCharged)
    return { pages, versionId }
  } catch (e) {
    console.error('[website:patch] persist failed:', e instanceof Error ? e.message : e)
    return null
  }
}

/** Find the page matching slug + locale (falls back to slug in any locale). */
function pickTargetPage(pages: WebsitePage[], slug: string, locale: string): WebsitePage | null {
  const s = (slug || '').trim() || 'home'
  const l = (locale || '').trim()
  return pages.find((p) => p.slug === s && p.locale === l) ?? pages.find((p) => p.slug === s) ?? null
}
