import 'server-only'
import { updateWebsite, replacePages, createVersion } from '@/lib/website/store'
import type { Website, WebsitePage, WebsiteSnapshot, ThemeTokens } from '@/lib/website/types'
import type { GenerateHtmlSiteResult } from '@/lib/website/codegen/generateHtmlSite'

type OkResult = Extract<GenerateHtmlSiteResult, { ok: true }>

/**
 * Idempotent persist block for the Codegen v2 (free-HTML) pipeline.
 *
 * Extracted from `app/api/website/[id]/generate/route.ts` (lines 255-280) so
 * that both the synchronous route (Task 1.2) and the upcoming Inngest
 * orchestrator (Task 1.3) share the exact same persist logic without duplication.
 *
 * Steps (byte-identical to the original inline block):
 *   1. Write designVars + compiledCssVersion bump onto website.theme
 *      (theme service reads these as CSS custom properties).
 *   2. replacePages — persist all pages from result.pages (already full
 *      WebsitePageInput[] with sections + html + format='html').
 *   3. createVersion — snapshot (website meta + pages) as 'initial' or 'revision'.
 *
 * @returns { pages } — the persisted WebsitePage[] (route returns this to the client).
 */
export async function persistGeneratedSite(
  userId: string,
  site: Website,
  result: OkResult,
  isRevision: boolean,
  creditSpent: number,
): Promise<{ pages: WebsitePage[] }> {
  // Stage-1 designVars'ı temaya yaz — servis themeToDesignVars ile okur.
  const theme: ThemeTokens = {
    ...site.theme,
    designVars: result.designVars,
    compiledCssVersion: new Date().toISOString(),
  }
  await updateWebsite(userId, site.id, { theme })

  // result.pages = tam WebsitePageInput[] (sections + html + format='html' taşır).
  const pages = await replacePages(userId, site.id, result.pages)

  const snapshot: WebsiteSnapshot = {
    website: {
      label: site.label,
      siteType: site.siteType,
      defaultLocale: site.defaultLocale,
      locales: site.locales,
      category: site.category,
      theme,
    },
    pages,
  }
  await createVersion(site.id, snapshot, isRevision ? 'revision' : 'initial', creditSpent)
  return { pages }
}
