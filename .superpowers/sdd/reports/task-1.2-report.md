# Task 1.2 Report — `persistGeneratedSite.ts`

**Status:** DONE  
**Commit:** `24c279b`

---

## Files Changed

| Action | Path |
|--------|------|
| Created | `lib/website/persistGeneratedSite.ts` |
| Modified | `app/api/website/[id]/generate/route.ts` |

---

## `persistGeneratedSite` — Full Signature

```typescript
import 'server-only'

export async function persistGeneratedSite(
  userId: string,
  site: Website,
  result: OkResult,       // Extract<GenerateHtmlSiteResult, { ok: true }>
  isRevision: boolean,
  creditSpent: number,
): Promise<{ pages: WebsitePage[] }>
```

**Imports consumed:**
- `updateWebsite, replacePages, createVersion` from `@/lib/website/store`
- Types: `Website`, `WebsitePage`, `WebsiteSnapshot`, `ThemeTokens` from `@/lib/website/types`
- `GenerateHtmlSiteResult` from `@/lib/website/codegen/generateHtmlSite`

**Internal type alias:**
```typescript
type OkResult = Extract<GenerateHtmlSiteResult, { ok: true }>
```

---

## What Was Done

1. **Created** `lib/website/persistGeneratedSite.ts` — byte-identical extraction of the
   `generateWithCodegenV2` inline persist block (original lines 255–280 of the route).
   Steps: `updateWebsite(theme w/ designVars + compiledCssVersion)` →
   `replacePages(result.pages)` → `createVersion(snapshot, 'initial'|'revision', creditSpent)`.

2. **Modified** `app/api/website/[id]/generate/route.ts`:
   - Added `import { persistGeneratedSite } from '@/lib/website/persistGeneratedSite'`
   - Replaced the 26-line inline try-block with a single
     `const { pages } = await persistGeneratedSite(user.id, site, result, isRevision, access.spent)`
     call. The surrounding catch/refund logic is **preserved byte-identical**.

---

## Verification

### `npx tsc --noEmit`
```
(no output — 0 errors)
```

### `node scripts/verify-website-codegen.mjs`
```
sanitize OK
tailwind OK
edit-overlay OK
assemble OK
gate OK
source-priority OK
context OK
designsystem OK
htmlgen OK
orchestrator OK
multipage OK
multilang OK
replace-image OK
block-patch OK
contact-form OK
```
All 15 checks passed. Synchronous (legacy + v2) paths unaffected.

---

## Interface for Task 1.3 (Inngest Orchestrator)

Task 1.3 calls `persistGeneratedSite` after `generateHtmlSite` resolves `ok: true`:

```typescript
import { persistGeneratedSite } from '@/lib/website/persistGeneratedSite'
import type { GenerateHtmlSiteResult } from '@/lib/website/codegen/generateHtmlSite'

// result must be the ok:true branch
const result = ...; // GenerateHtmlSiteResult & { ok: true }
const { pages } = await persistGeneratedSite(userId, site, result, isRevision, creditSpent)
```

`result.pages` (already full `WebsitePageInput[]` with `sections` + `html` + `format='html'`)
is passed directly — no extra object construction needed.

---

## Concerns

None. Pure refactor: no new logic, no schema changes, no new DB tables. The `WEBSITE_CODEGEN_V2`
flag remains off in prod — zero prod impact.
