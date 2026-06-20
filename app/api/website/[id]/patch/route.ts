import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { chargeFeature } from '@/lib/billing/featureGuard'
import { getWebsite, replacePages, createVersion, getPages, listVersions } from '@/lib/website/store'
import { isWebsiteAiReady } from '@/lib/website/ai/generate'
import { WEBSITE_REVISION_COST, WEBSITE_FREE_REVISIONS } from '@/lib/website/credits'
import { applyTargetedBlockPatch, applyImageReplacePatch } from '@/lib/website/codegen/applyBlockPatch'
import type { Website, WebsitePageInput, WebsiteSnapshot } from '@/lib/website/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/website/[id]/patch
 *
 * MANUAL CLICK-SELECT edit (önizleme "Düzenle" overlay). The owner selects ONE
 * block in the sandboxed preview iframe; the parent panel sends a single targeted
 * op here. This reuses the EXISTING block-patch engine (applyTargetedBlockPatch →
 * regenerate/merge/re-gate) — only the SELECTED block changes, every other block
 * (and page, and locale) stays BYTE-IDENTICAL.
 *
 * Security mirrors /generate's revise flow:
 *   - Owner-gated: getCurrentUser + getWebsite(user.id, id) → 404 if not theirs.
 *   - op + targetId validated; targetId must match ^b\d+$ (a real block id).
 *   - The merged body is re-sanitized + re-gated INSIDE the engine; gate-fail →
 *     ok:false → we refund + 422 and do NOT persist (no injection ever persists).
 *   - Charge = the SAME revision policy as /generate (first WEBSITE_FREE_REVISIONS
 *     free, then WEBSITE_REVISION_COST; owner bypass via chargeFeature). NO double-
 *     charge: one chargeFeature per request, refunded on any failure.
 *
 * Body: { op:'edit'|'ai_rewrite'|'delete'|'replace_image', targetId, content?,
 *         instruction?, imageIndex?, newUrl?, targetSlug, targetLocale }
 *   - 'edit'          → `content` is the literal new text for the block.
 *   - 'ai_rewrite'    → `instruction` is a natural-language change request.
 *   - 'delete'        → remove the block (no model call).
 *   - 'replace_image' → swap the <img> at `imageIndex` for `newUrl` (DETERMINISTIC,
 *                       no model call). `newUrl` MUST be an absolute https URL — our
 *                       own stored uploads + stock-provider URLs are https; anything
 *                       else (javascript:/data:/relative) is REJECTED. The merged body
 *                       is re-sanitized + re-gated so an unsafe src can never persist.
 *                       Same revision charge policy (first-3-free) — a cheap op, NOT
 *                       double-charged.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isWebsiteAiReady()) {
    return NextResponse.json({ ok: false, error: 'AI servisi yapılandırılmamış.' }, { status: 503 })
  }

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    op?: string
    targetId?: string
    content?: string
    instruction?: string
    imageIndex?: number
    newUrl?: string
    targetSlug?: string
    targetLocale?: string
  }

  const op =
    body.op === 'edit' || body.op === 'ai_rewrite' || body.op === 'delete' || body.op === 'replace_image'
      ? body.op
      : undefined
  if (!op) return NextResponse.json({ ok: false, error: 'Geçersiz işlem' }, { status: 400 })

  const targetId = typeof body.targetId === 'string' ? body.targetId.trim() : ''
  if (!/^b\d+$/.test(targetId)) {
    return NextResponse.json({ ok: false, error: 'Geçersiz hedef' }, { status: 400 })
  }

  const targetSlug = (typeof body.targetSlug === 'string' ? body.targetSlug.trim() : '') || 'home'
  const targetLocale = typeof body.targetLocale === 'string' ? body.targetLocale.trim() : ''

  // 'replace_image' carries imageIndex + newUrl (https-only, validated in the engine).
  const imageIndex = Number.isInteger(body.imageIndex) ? (body.imageIndex as number) : -1
  const newUrl = typeof body.newUrl === 'string' ? body.newUrl.trim() : ''
  if (op === 'replace_image') {
    if (imageIndex < 0) return NextResponse.json({ ok: false, error: 'Geçersiz görsel' }, { status: 400 })
    // Absolute https only — a hard wall against javascript:/data:/relative at the edge
    // (the engine + sanitizer re-check; this is the first of three gates).
    if (!/^https:\/\/[^\s"'<>]+$/i.test(newUrl)) {
      return NextResponse.json({ ok: false, error: 'Geçersiz görsel adresi' }, { status: 400 })
    }
  }

  // 'edit' uses the literal new text (content); 'ai_rewrite' a free instruction.
  // 'delete'/'replace_image' need neither.
  const instruction =
    op === 'edit'
      ? (typeof body.content === 'string' ? body.content.trim() : '')
      : op === 'ai_rewrite'
        ? (typeof body.instruction === 'string' ? body.instruction.trim() : '')
        : ''
  if (op !== 'delete' && op !== 'replace_image' && !instruction) {
    return NextResponse.json({ ok: false, error: 'İçerik gerekli' }, { status: 400 })
  }

  const site = await getWebsite(user.id, params.id)
  if (!site) return NextResponse.json({ ok: false, error: 'Bulunamadı' }, { status: 404 })

  // Manual edit is a REVISION → same "first-3-free, then cost" policy as /generate.
  const versions = await listVersions(user.id, site.id)
  const usedRevisions = versions.filter((v) => v.reason === 'revision').length
  const cost = usedRevisions < WEBSITE_FREE_REVISIONS ? 0 : WEBSITE_REVISION_COST

  // Charge BEFORE the work (owner bypass + insufficient → 402 inside featureGuard).
  const access = await chargeFeature({ featureKey: 'website_generation', creditCost: cost })
  if (!access.ok) return NextResponse.json(access.body, { status: access.status })

  try {
    // 'replace_image' is a DETERMINISTIC image-src swap (no model call); every other
    // op goes through the targeted block-patch engine (model rewrite / splice).
    const patch =
      op === 'replace_image'
        ? await applyImageReplacePatch(user.id, site, {
            targetSlug,
            targetLocale,
            targetId,
            imageIndex,
            newUrl,
          })
        : await applyTargetedBlockPatch(user.id, site, {
            targetSlug,
            targetLocale,
            targetId,
            // Narrowed by the ternary guard (op !== 'replace_image' here).
            op: op as 'edit' | 'ai_rewrite' | 'delete',
            instruction,
          })

    if (patch.ok !== true) {
      // Engine soft-failed (gate fail / regen fail / target missing) → refund + 422.
      // Nothing is persisted; the preview is unchanged.
      await access.refund()
      console.warn('[website:patch] block-patch failed:', patch.reason)
      return NextResponse.json(
        { ok: false, error: 'Düzenleme uygulanamadı, lütfen tekrar deneyin.' },
        { status: 422 },
      )
    }

    const persisted = await persistTargetedPatch(user.id, site, patch.page, access.spent)
    if (!persisted) {
      await access.refund()
      return NextResponse.json({ ok: false, error: 'Düzenleme kaydedilemedi.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, pages: persisted, creditCharged: access.spent })
  } catch (e) {
    await access.refund()
    const message = e instanceof Error ? e.message : 'Düzenlenemedi'
    console.error('[website:patch]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

/**
 * Persist ONLY the target page (slug + locale) with its new html; every other page
 * and locale is written BYTE-IDENTICAL. theme/designVars untouched. A new 'revision'
 * version is recorded so "Geri Al" (rollback) works. Returns the page list or null.
 */
async function persistTargetedPatch(
  userId: string,
  site: Website,
  patchedPage: WebsitePageInput,
  creditCharged: number,
): Promise<Awaited<ReturnType<typeof replacePages>> | null> {
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
        theme: site.theme,
      },
      pages,
    }
    await createVersion(site.id, snapshot, 'revision', creditCharged)
    return pages
  } catch (e) {
    console.error('[website:patch] persist failed:', e instanceof Error ? e.message : e)
    return null
  }
}
