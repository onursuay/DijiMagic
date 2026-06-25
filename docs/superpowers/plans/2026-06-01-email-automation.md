# Email Marketing — Otomasyon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Email Marketing modülündeki devre dışı "Otomasyon" sekmesini canlıya alıp, CRM aşama girişi ve yeni kişi eklenince anında otomatik e-posta gönderen kuralları çalıştırmak.

**Architecture:** Inline fire-and-forget tetik — CRM PATCH ve contacts POST route'ları, mevcut Meta-sync best-effort deseniyle `automationRunner`'ı çağırır. Eşleşen `email_automations` kayıtları mevcut `sender.ts` gönderim katmanını (refactor ile çıkarılan `buildDispatch`) yeniden kullanarak tek alıcıya e-posta gönderir. Yeni tablo yok (mevcut `email_automations` kullanılır); tek küçük migration `email_sends`'i otomasyon kayıtlarına açar.

**Tech Stack:** Next.js 14.2 (App Router, route handlers), Supabase (service-role), next-intl (tr/en), Resend/SMTP (mevcut `sender.ts`), WizardSelect. **Test runner yok** — doğrulama `npx tsc --noEmit` + `npm run lint` + manuel akış (proje konvansiyonu).

**Genel kurallar (her task'ta uy):**
- Hardcoded string YOK — tüm UI metni `tr.json` + `en.json` (aynı key path).
- Native `<select>` YOK — `WizardSelect`. Amber/sarı renk YOK.
- Ham enum YOK — aşama etiketleri `tc('stages.{s}')`'den.
- Her task sonunda `npx tsc --noEmit` 0 hata; sonra commit.
- Meta/Google entegrasyon koduna dokunma.

---

### Task 1: Migration — `email_sends` otomasyona açılır

**Files:**
- Create: `supabase/migrations/20260601000000_email_sends_automation.sql`

- [ ] **Step 1: Migration dosyasını yaz**

```sql
-- Otomasyon gönderimlerini email_sends'e yazabilmek için:
-- 1) automation_id kolonu (nullable, FK)
-- 2) campaign_id NOT NULL kısıtını kaldır (otomasyon gönderiminde campaign_id NULL olur)
-- Her ikisi de geriye dönük güvenli: kısıt gevşetme + nullable kolon, mevcut satır/sorguları bozmaz.

ALTER TABLE public.email_sends
  ADD COLUMN IF NOT EXISTS automation_id uuid REFERENCES public.email_automations(id) ON DELETE SET NULL;

ALTER TABLE public.email_sends
  ALTER COLUMN campaign_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_sends_automation ON public.email_sends(automation_id);
```

- [ ] **Step 2: SQL geçerliliğini gözle doğrula**

`ADD COLUMN IF NOT EXISTS` ve `DROP NOT NULL` idempotenttir (tekrar çalıştırılabilir). `email_automations` tablosunun aynı dosyada (`20260531010000_create_email_marketing.sql`) tanımlı olduğunu teyit et — FK referansı geçerli.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260601000000_email_sends_automation.sql
git commit -m "feat(email): email_sends otomasyon kayıtlarına açılır (automation_id + campaign_id nullable)"
```

> **PROD NOTU (deploy öncesi):** Bu migration omddq Supabase'e uygulanmalı. `email_automations` tablosunun omddq'da gerçekten var olduğunu (migration gaps riski) ve bu ALTER'ın uygulandığını deploy öncesi doğrula.

---

### Task 2: `sender.ts` refactor — `buildDispatch` extract + `buildHtml` export

**Files:**
- Modify: `lib/email/sender.ts`

- [ ] **Step 1: `buildHtml`'i export et ve `SendVia` + `Dispatch` tiplerini export et**

`lib/email/sender.ts` başında `buildHtml` ve `Dispatch`'i export edilebilir yap:

```ts
/** Kullanıcı içeriği + zorunlu KVKK abonelikten-çık footer'ı. */
export function buildHtml(body: string, unsubUrl: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6">
${body}
<hr style="margin-top:32px;border:none;border-top:1px solid #e5e7eb"/>
<p style="font-size:12px;color:#9ca3af;margin-top:12px">Bu e-postaları almak istemiyorsanız <a href="${unsubUrl}" style="color:#9ca3af;text-decoration:underline">abonelikten çıkabilirsiniz</a>.</p>
</body></html>`
}

export type SendVia = 'smtp' | 'domain' | 'shared'
export type Dispatch = (to: string, subject: string, html: string) => Promise<string | null>
```

- [ ] **Step 2: `buildDispatch` fonksiyonunu extract et**

`sendCampaign`'in içindeki gönderim-yolu seçim bloğunu (account → dispatch) ayrı fonksiyona taşı. Resend gerektiren ama resend yapılandırılmamışsa `null` döner:

```ts
/**
 * Kullanıcının varsayılan gönderim hesabına göre dispatch fonksiyonu üretir.
 * smtp/gmail için resend gerekmez; domain/platform/shared için resend gerekir —
 * resend yoksa null döner (çağıran 'resend_not_configured' olarak yorumlar).
 */
export async function buildDispatch(userId: string): Promise<{ dispatch: Dispatch; via: SendVia } | null> {
  const account = await getDefaultAccount(userId)

  if (account && account.type === 'smtp') {
    const transport = smtpTransport(account.config as unknown as SmtpConfig, decryptSmtpPass(account))
    const from = account.from_name ? `${account.from_name} <${account.from_email}>` : account.from_email
    return {
      via: 'smtp',
      dispatch: async (to, subject, html) => {
        try { const info = await transport.sendMail({ from, to, subject, html }); return info.messageId ?? 'smtp' } catch { return null }
      },
    }
  }
  if (account && account.type === 'gmail') {
    const transport = gmailOAuthTransport(account.from_email, decryptRefreshToken(account))
    const from = account.from_name ? `${account.from_name} <${account.from_email}>` : account.from_email
    return {
      via: 'smtp',
      dispatch: async (to, subject, html) => {
        try { const info = await transport.sendMail({ from, to, subject, html }); return info.messageId ?? 'gmail' } catch { return null }
      },
    }
  }
  if (account && account.type === 'domain') {
    if (!resend) return null
    const from = account.from_name ? `${account.from_name} <${account.from_email}>` : account.from_email
    const replyTo = account.reply_to || undefined
    return {
      via: 'domain',
      dispatch: async (to, subject, html) => {
        try { const r = await resend.emails.send({ from, to, subject, html, replyTo }); return r.data?.id ?? null } catch { return null }
      },
    }
  }
  if (account && account.type === 'platform') {
    if (!resend) return null
    const platformFrom = account.from_email || process.env.PLATFORM_FROM_ADDRESS || 'info@dijimagic.com'
    const from = `${account.from_name || 'DijiMagic'} <${platformFrom}>`
    const replyTo = account.reply_to || undefined
    return {
      via: 'shared',
      dispatch: async (to, subject, html) => {
        try { const r = await resend.emails.send({ from, to, subject, html, replyTo }); return r.data?.id ?? null } catch { return null }
      },
    }
  }
  // Hesap yok → paylaşımlı Resend (FROM_EMAIL)
  if (!resend) return null
  return {
    via: 'shared',
    dispatch: async (to, subject, html) => {
      try { const r = await resend.emails.send({ from: FROM_EMAIL, to, subject, html }); return r.data?.id ?? null } catch { return null }
    },
  }
}
```

- [ ] **Step 3: `sendCampaign`'i `buildDispatch` kullanacak şekilde sadeleştir**

`sendCampaign` içindeki eski account/dispatch/via bloğunu (mevcut satır ~45-87) şu üç satırla değiştir; geri kalan (markCampaign, resolveRecipients, döngü, upsert) AYNEN kalır:

```ts
export async function sendCampaign(userId: string, campaignId: string): Promise<SendResult> {
  const campaign = await getCampaign(campaignId, userId)
  if (!campaign) return { ok: false, reason: 'not_found', sent: 0, total: 0 }
  if (campaign.status === 'sent' || campaign.status === 'sending') {
    return { ok: false, reason: 'already', sent: 0, total: 0 }
  }

  const built = await buildDispatch(userId)
  if (!built) return { ok: false, reason: 'resend_not_configured', sent: 0, total: 0 }
  const { dispatch, via } = built

  await markCampaign(campaignId, { status: 'sending' })
  // ... (resolveRecipients, döngü, email_sends upsert, markCampaign sent — DEĞİŞMEZ)
}
```

`Dispatch` tipi artık üstte export edildiği için eski yerel `type Dispatch = ...` satırını sil.

- [ ] **Step 4: Type-check — davranış korundu mu**

Run: `npx tsc --noEmit`
Expected: 0 hata. `sendCampaign`'in dış davranışı birebir aynı (sadece dispatch seçimi fonksiyona taşındı).

- [ ] **Step 5: Commit**

```bash
git add lib/email/sender.ts
git commit -m "refactor(email): sender.ts buildDispatch/buildHtml extract (davranış korunur)"
```

---

### Task 3: `automationStore.ts` — `email_automations` CRUD

**Files:**
- Create: `lib/email/automationStore.ts`

- [ ] **Step 1: Store'u yaz (campaignStore deseninde)**

```ts
import 'server-only'
import { supabase } from '@/lib/supabase/client'

export type AutomationTrigger =
  | { type: 'crm_stage_enter'; stage: string }
  | { type: 'contact_added' }

export interface AutomationRow {
  id: string
  user_id: string
  name: string
  trigger: AutomationTrigger | Record<string, unknown>
  subject: string
  html: string
  enabled: boolean
  created_at: string
  updated_at: string
}

/** UI için: kullanıcının tüm otomasyonları (enabled + disabled). */
export async function listAutomations(userId: string): Promise<AutomationRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('email_automations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) { console.error('[EmailAutomation] LIST_FAIL', error.message); return [] }
  return (data ?? []) as AutomationRow[]
}

/** Runner için: yalnız enabled otomasyonlar. */
export async function listEnabledAutomations(userId: string): Promise<AutomationRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('email_automations')
    .select('*')
    .eq('user_id', userId)
    .eq('enabled', true)
  if (error) { console.error('[EmailAutomation] LIST_ENABLED_FAIL', error.message); return [] }
  return (data ?? []) as AutomationRow[]
}

export interface UpsertAutomationInput {
  id?: string
  name?: string
  trigger?: AutomationTrigger
  subject?: string
  html?: string
  enabled?: boolean
}

export async function upsertAutomation(userId: string, input: UpsertAutomationInput): Promise<AutomationRow | null> {
  if (!supabase) return null
  const now = new Date().toISOString()
  const payload: Record<string, unknown> = { user_id: userId, updated_at: now }
  if (input.name !== undefined) payload.name = input.name
  if (input.trigger !== undefined) payload.trigger = input.trigger
  if (input.subject !== undefined) payload.subject = input.subject
  if (input.html !== undefined) payload.html = input.html
  if (input.enabled !== undefined) payload.enabled = input.enabled

  if (input.id) {
    const { data, error } = await supabase.from('email_automations').update(payload).eq('id', input.id).eq('user_id', userId).select().single()
    if (error || !data) { console.error('[EmailAutomation] UPDATE_FAIL', error?.message); return null }
    return data as AutomationRow
  }
  payload.created_at = now
  const { data, error } = await supabase.from('email_automations').insert(payload).select().single()
  if (error || !data) { console.error('[EmailAutomation] INSERT_FAIL', error?.message); return null }
  return data as AutomationRow
}

export async function deleteAutomation(id: string, userId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('email_automations').delete().eq('id', id).eq('user_id', userId)
  return !error
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 hata.

- [ ] **Step 3: Commit**

```bash
git add lib/email/automationStore.ts
git commit -m "feat(email): email_automations CRUD store"
```

---

### Task 4: `automationRunner.ts` — eşleştirme + tek alıcıya gönderim

**Files:**
- Create: `lib/email/automationRunner.ts`

- [ ] **Step 1: Runner'ı yaz**

`buildDispatch` + `buildHtml` (Task 2'den export) + `unsubscribeUrl` yeniden kullanılır. Opt-out kontrolü KVKK için zorunlu. `email_sends`'e plain insert (campaign_id=NULL, automation_id dolu).

```ts
import 'server-only'
import { supabase } from '@/lib/supabase/client'
import { buildDispatch, buildHtml } from './sender'
import { unsubscribeUrl } from './unsubscribe'
import { listEnabledAutomations, type AutomationRow } from './automationStore'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://dijimagic.com'

/** email_contacts'te bu e-posta opt-out işaretliyse true (KVKK). Kayıt yoksa false. */
async function isOptedOut(userId: string, email: string): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase
    .from('email_contacts')
    .select('opt_out')
    .eq('user_id', userId)
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()
  return Boolean(data?.opt_out)
}

/** Eşleşen otomasyonların her birini tek alıcıya gönderir; her gönderim email_sends'e yazılır. */
async function sendToContact(userId: string, email: string, automations: AutomationRow[]): Promise<void> {
  if (!email || !automations.length) return
  if (await isOptedOut(userId, email)) return
  const built = await buildDispatch(userId)
  if (!built) return
  const { dispatch } = built

  const rows: Record<string, unknown>[] = []
  for (const a of automations) {
    const html = buildHtml(a.html, unsubscribeUrl(APP_URL, 'automation', email))
    const id = await dispatch(email, a.subject || '(konusuz)', html)
    rows.push({
      campaign_id: null,
      automation_id: a.id,
      user_id: userId,
      email,
      resend_id: id,
      status: id ? 'sent' : 'failed',
      sent_at: new Date().toISOString(),
    })
  }
  if (supabase && rows.length) {
    const { error } = await supabase.from('email_sends').insert(rows)
    if (error) console.error('[AutomationRunner] SEND_LOG_FAIL', error.message)
  }
}

/** CRM lead'i bir aşamaya girince — eşleşen crm_stage_enter otomasyonları. */
export async function runStageAutomations(
  userId: string,
  lead: { email: string | null; full_name?: string | null },
  stage: string,
): Promise<void> {
  if (!lead.email) return
  const autos = await listEnabledAutomations(userId)
  const matched = autos.filter((a) => {
    const tr = a.trigger as AutomationTrigger
    return tr?.type === 'crm_stage_enter' && tr.stage === stage
  })
  await sendToContact(userId, lead.email, matched)
}

/** Yeni kişi eklenince (tekil manuel) — eşleşen contact_added otomasyonları. */
export async function runContactAddedAutomations(
  userId: string,
  contact: { email: string },
): Promise<void> {
  if (!contact.email) return
  const autos = await listEnabledAutomations(userId)
  const matched = autos.filter((a) => (a.trigger as AutomationTrigger)?.type === 'contact_added')
  await sendToContact(userId, contact.email, matched)
}
```

> `AutomationTrigger` tipi `automationStore`'dan import edilmeli — dosya başına ekle: `import { listEnabledAutomations, type AutomationRow, type AutomationTrigger } from './automationStore'` ve store'da `AutomationTrigger`'ın export edildiğini doğrula (Task 3'te export edildi).

- [ ] **Step 2: Import satırını düzelt**

`automationStore`'dan `AutomationTrigger` de import edildiğinden emin ol:
```ts
import { listEnabledAutomations, type AutomationRow, type AutomationTrigger } from './automationStore'
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 hata.

- [ ] **Step 4: Commit**

```bash
git add lib/email/automationRunner.ts
git commit -m "feat(email): automationRunner — aşama/kişi tetikli tek alıcıya gönderim"
```

---

### Task 5: API routes — otomasyon CRUD

**Files:**
- Create: `app/api/email/automations/route.ts`
- Create: `app/api/email/automations/[id]/route.ts`

- [ ] **Step 1: Liste + oluşturma route'u**

```ts
// app/api/email/automations/route.ts
import { NextResponse } from 'next/server'
import { checkEmailAccess } from '@/lib/email/guard'
import { listAutomations, upsertAutomation, type AutomationTrigger } from '@/lib/email/automationStore'

export const dynamic = 'force-dynamic'

/** GET /api/email/automations — kullanıcının tüm otomasyonları. */
export async function GET() {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  const automations = await listAutomations(access.user.id)
  return NextResponse.json({
    ok: true,
    automations: automations.map((a) => ({
      id: a.id, name: a.name, trigger: a.trigger, subject: a.subject, html: a.html,
      enabled: a.enabled, createdAt: a.created_at,
    })),
  })
}

/** POST /api/email/automations — yeni otomasyon. */
export async function POST(request: Request) {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  let body: { name?: string; trigger?: AutomationTrigger; subject?: string; html?: string; enabled?: boolean }
  try { body = await request.json() } catch { return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 }) }
  const row = await upsertAutomation(access.user.id, {
    name: body.name ?? '', trigger: body.trigger, subject: body.subject ?? '', html: body.html ?? '',
    enabled: body.enabled ?? true,
  })
  if (!row) return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 500 })
  return NextResponse.json({ ok: true, id: row.id })
}
```

- [ ] **Step 2: Güncelle + sil route'u**

```ts
// app/api/email/automations/[id]/route.ts
import { NextResponse } from 'next/server'
import { checkEmailAccess } from '@/lib/email/guard'
import { upsertAutomation, deleteAutomation, type AutomationTrigger } from '@/lib/email/automationStore'

export const dynamic = 'force-dynamic'

/** PATCH /api/email/automations/[id] — alanları güncelle / enabled toggle. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  const { id } = await params
  let body: { name?: string; trigger?: AutomationTrigger; subject?: string; html?: string; enabled?: boolean }
  try { body = await request.json() } catch { return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 }) }
  const row = await upsertAutomation(access.user.id, { id, ...body })
  if (!row) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

/** DELETE /api/email/automations/[id]. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await checkEmailAccess()
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status })
  const { id } = await params
  const ok = await deleteAutomation(id, access.user.id)
  return NextResponse.json({ ok })
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 hata.

- [ ] **Step 4: Commit**

```bash
git add app/api/email/automations
git commit -m "feat(email): otomasyon CRUD API route'ları"
```

---

### Task 6: CRM PATCH tetik hook'u

**Files:**
- Modify: `app/api/crm/leads/[id]/route.ts`

- [ ] **Step 1: Runner import'unu ekle**

Dosya başındaki import'lara ekle:
```ts
import { runStageAutomations } from '@/lib/email/automationRunner'
```

- [ ] **Step 2: Meta sync ile paralel best-effort tetik**

Mevcut `metaSync` bloğunu (satır ~74-83), otomasyonu **paralel** çalıştıracak şekilde `Promise.all` ile sar. Otomasyon hatası/timeout PATCH yanıtını ETKİLEMEZ; meta sync davranışı korunur:

```ts
  // Faz 2 — Meta senkron + Email otomasyon tetiği (her ikisi de best-effort, paralel).
  // Lead durumu zaten kaydedildi; ikisinin de hatası/timeout'u PATCH'i bozmaz.
  const [metaSync] = await Promise.all([
    Promise.race([
      syncLeadToMeta(access.user.id, row, status).catch((e) => ({
        ok: false as const,
        reason: 'sync_failed' as const,
        error: e instanceof Error ? e.message : String(e),
      })),
      new Promise<{ ok: false; reason: 'sync_timeout' }>((resolve) =>
        setTimeout(() => resolve({ ok: false, reason: 'sync_timeout' }), 9000),
      ),
    ]),
    Promise.race([
      runStageAutomations(access.user.id, row, status).catch(() => {}),
      new Promise<void>((resolve) => setTimeout(resolve, 9000)),
    ]),
  ])

  return NextResponse.json({ ok: true, status: row.status, note: row.note, metaSync })
```

> `runStageAutomations`'ın imzası `(userId, { email, full_name? }, stage)`. `row` (updateLeadStatus dönüşü) `email` ve `full_name` alanlarını içerir — uyumlu.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 hata.

- [ ] **Step 4: Commit**

```bash
git add app/api/crm/leads/[id]/route.ts
git commit -m "feat(email): CRM aşama değişiminde otomasyon tetiği (best-effort, paralel)"
```

---

### Task 7: Contacts POST tetik hook'u

**Files:**
- Modify: `app/api/email/contacts/route.ts`

- [ ] **Step 1: Runner import'unu ekle**

```ts
import { runContactAddedAutomations } from '@/lib/email/automationRunner'
```

- [ ] **Step 2: Tekil manuel ekleme + gerçekten yeni → tetik**

POST'un sonundaki `upsertContacts` çağrısından sonra, `result` döndürülmeden önce ekle:

```ts
  const source = body.source ?? 'csv'
  const result = await upsertContacts(access.user.id, rows, source)

  // Yalnız TEKİL MANUEL ekleme + gerçekten yeni kişi (inserted===1) → contact_added otomasyonu.
  // Toplu CSV/CRM import tetiklemez (timeout/rate-limit/spam koruması). best-effort, hatası yutulur.
  if (rows.length === 1 && source === 'manual' && result.inserted === 1) {
    await Promise.race([
      runContactAddedAutomations(access.user.id, { email: rows[0].email }).catch(() => {}),
      new Promise<void>((resolve) => setTimeout(resolve, 9000)),
    ])
  }

  return NextResponse.json({ ok: true, ...result })
```

Eski `const result = await upsertContacts(access.user.id, rows, body.source ?? 'csv')` satırını yukarıdaki iki satırla (source değişkeni + result) değiştir.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 hata.

- [ ] **Step 4: Commit**

```bash
git add app/api/email/contacts/route.ts
git commit -m "feat(email): tekil manuel kişi eklemede contact_added otomasyon tetiği"
```

---

### Task 8: i18n — tr.json + en.json

**Files:**
- Modify: `locales/tr.json`
- Modify: `locales/en.json`

- [ ] **Step 1: `email.automations.*` + `email.contacts.add*` anahtarlarını tr.json'a ekle**

`email` namespace'i içinde, `sections.automation` zaten var. `email` altına `automations` objesi + `contacts` altına ekleme yap:

```jsonc
// locales/tr.json — email.automations
"automations": {
  "count": "otomasyon",
  "new": "Yeni Otomasyon",
  "empty": "Henüz otomasyon yok",
  "emptyHint": "Bir aşamaya girince veya yeni kişi eklenince otomatik e-posta gönderen kural oluşturun.",
  "back": "Geri",
  "name": "Otomasyon adı",
  "namePlaceholder": "Örn. Uygun aşamasına hoşgeldin",
  "triggerLabel": "Tetikleyici",
  "triggerStage": "Bir aşamaya girince",
  "triggerContact": "Yeni kişi eklenince",
  "stageLabel": "Aşama",
  "subject": "Konu",
  "content": "İçerik",
  "contentPlaceholder": "Merhaba,\n\nMesajınız buraya...",
  "contentHint": "Basit HTML kullanabilirsiniz. Abonelikten-çık linki otomatik eklenir.",
  "save": "Kaydet",
  "saved": "Otomasyon kaydedildi.",
  "needContent": "Konu ve içerik zorunlu.",
  "enabledOn": "Aktif",
  "enabledOff": "Pasif",
  "preview": "ÖNİZLEME",
  "previewEmpty": "İçerik önizlemesi burada görünür.",
  "triggerSummaryStage": "{stage} aşamasına girince",
  "triggerSummaryContact": "Yeni kişi eklenince"
},
```

Ayrıca `email.contacts` objesine ekle:
```jsonc
"addManual": "Kişi Ekle",
"addManualTitle": "Yeni kişi",
"addEmail": "E-posta",
"addName": "Ad soyad",
"addPhone": "Telefon",
"addSave": "Ekle",
"addSaved": "Kişi eklendi.",
"addNeedEmail": "Geçerli bir e-posta gerekli.",
"addCancel": "Vazgeç",
```

- [ ] **Step 2: Aynı anahtarları en.json'a ekle (İngilizce)**

```jsonc
// locales/en.json — email.automations
"automations": {
  "count": "automations",
  "new": "New Automation",
  "empty": "No automations yet",
  "emptyHint": "Create a rule that sends an automatic email when a lead enters a stage or a new contact is added.",
  "back": "Back",
  "name": "Automation name",
  "namePlaceholder": "e.g. Welcome on Qualified stage",
  "triggerLabel": "Trigger",
  "triggerStage": "When entering a stage",
  "triggerContact": "When a new contact is added",
  "stageLabel": "Stage",
  "subject": "Subject",
  "content": "Content",
  "contentPlaceholder": "Hello,\n\nYour message here...",
  "contentHint": "You can use simple HTML. An unsubscribe link is added automatically.",
  "save": "Save",
  "saved": "Automation saved.",
  "needContent": "Subject and content are required.",
  "enabledOn": "Active",
  "enabledOff": "Inactive",
  "preview": "PREVIEW",
  "previewEmpty": "Content preview appears here.",
  "triggerSummaryStage": "When entering {stage}",
  "triggerSummaryContact": "When a new contact is added"
},
```
```jsonc
// locales/en.json — email.contacts
"addManual": "Add Contact",
"addManualTitle": "New contact",
"addEmail": "Email",
"addName": "Full name",
"addPhone": "Phone",
"addSave": "Add",
"addSaved": "Contact added.",
"addNeedEmail": "A valid email is required.",
"addCancel": "Cancel",
```

- [ ] **Step 3: JSON geçerliliği + parity doğrula**

Run: `node -e "JSON.parse(require('fs').readFileSync('locales/tr.json','utf8')); JSON.parse(require('fs').readFileSync('locales/en.json','utf8')); console.log('JSON OK')"`
Expected: `JSON OK`. Yeni anahtarların ikisinde de aynı key path ile bulunduğunu gözle teyit et.

- [ ] **Step 4: Commit**

```bash
git add locales/tr.json locales/en.json
git commit -m "i18n(email): otomasyon + kişi ekle metinleri (tr/en)"
```

---

### Task 9: `AutomationsTab.tsx` — UI

**Files:**
- Create: `components/email/AutomationsTab.tsx`

CampaignsTab.tsx desenini birebir izle (liste + composer, sol form + sağ iframe önizleme, `flash` prop, `WizardSelect`, `STAGES` + `tc('stages.{s}')`).

- [ ] **Step 1: Component'i yaz**

```tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Loader2, Trash2, ArrowLeft, Zap, Workflow } from 'lucide-react'
import WizardSelect from '@/components/meta/wizard/WizardSelect'
import { STAGES } from '@/components/crm/stageMeta'

type Trigger = { type: 'crm_stage_enter'; stage: string } | { type: 'contact_added' }

interface AutomationItem {
  id: string
  name: string
  trigger: Trigger | Record<string, unknown>
  subject: string
  html: string
  enabled: boolean
  createdAt: string
}

// Trigger ↔ WizardSelect value kodlaması ('contact' | 'stage:giris' ...)
function encodeTrigger(t: Trigger): string {
  return t.type === 'crm_stage_enter' ? `stage:${t.stage}` : 'contact'
}
function decodeTrigger(v: string): Trigger {
  return v.startsWith('stage:') ? { type: 'crm_stage_enter', stage: v.slice(6) } : { type: 'contact_added' }
}

export default function AutomationsTab({ flash }: { flash: (k: 'ok' | 'err', m: string, ms?: number) => void }) {
  const t = useTranslations('email')
  const tc = useTranslations('crm')

  const [items, setItems] = useState<AutomationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)

  // composer state
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [trig, setTrig] = useState('stage:uygun')
  const [subject, setSubject] = useState('')
  const [html, setHtml] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/email/automations')
      const data = await res.json()
      if (data.ok) setItems(data.automations ?? [])
    } catch { /* sessiz */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const trigOptions = useMemo(() => [
    ...STAGES.map((s) => ({ value: `stage:${s}`, label: `${t('automations.triggerStage')}: ${tc(`stages.${s}`)}` })),
    { value: 'contact', label: t('automations.triggerContact') },
  ], [t, tc])

  const openNew = () => { setEditId(null); setName(''); setTrig('stage:uygun'); setSubject(''); setHtml(''); setComposing(true) }
  const openEdit = (a: AutomationItem) => {
    setEditId(a.id); setName(a.name)
    setTrig(encodeTrigger(a.trigger as Trigger)); setSubject(a.subject); setHtml(a.html); setComposing(true)
  }

  const handleSave = useCallback(async () => {
    if (!subject.trim() || !html.trim()) { flash('err', t('automations.needContent')); return }
    setSaving(true)
    try {
      const payload = { name: name || t('automations.namePlaceholder'), trigger: decodeTrigger(trig), subject, html, enabled: true }
      const url = editId ? `/api/email/automations/${editId}` : '/api/email/automations'
      const method = editId ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const d = await res.json()
      if (d.ok) { flash('ok', t('automations.saved')); setComposing(false); load() }
      else flash('err', t('contacts.error'))
    } finally { setSaving(false) }
  }, [editId, name, trig, subject, html, flash, t, load])

  const toggleEnabled = useCallback(async (a: AutomationItem) => {
    await fetch(`/api/email/automations/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !a.enabled }) })
    load()
  }, [load])

  const handleDelete = useCallback(async (id: string) => {
    await fetch(`/api/email/automations/${id}`, { method: 'DELETE' })
    load()
  }, [load])

  const triggerSummary = (tr: Trigger | Record<string, unknown>) => {
    const tt = tr as Trigger
    if (tt?.type === 'crm_stage_enter') return t('automations.triggerSummaryStage', { stage: tc(`stages.${tt.stage}`) })
    return t('automations.triggerSummaryContact')
  }

  // ── Composer (sol form + sağ önizleme) ── CampaignsTab composer'ı ile aynı layout
  if (composing) {
    return (
      <div>
        <button onClick={() => setComposing(false)} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> {t('automations.back')}
        </button>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('automations.name')}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('automations.namePlaceholder')} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('automations.triggerLabel')}</label>
              <WizardSelect value={trig} onChange={setTrig} options={trigOptions} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('automations.subject')}</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('automations.content')}</label>
              <textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={12} placeholder={t('automations.contentPlaceholder')} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-mono focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
              <p className="text-xs text-gray-400 mt-1">{t('automations.contentHint')}</p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 active:scale-[0.97] transition-all">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} {t('automations.save')}
              </button>
            </div>
          </div>
          <div className="lg:sticky lg:top-4 self-start">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{t('automations.preview')}</p>
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden animate-card-enter">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{subject || '—'}</p>
              </div>
              <iframe
                title="automation-preview"
                sandbox=""
                className="w-full min-h-[320px] border-0 block bg-white"
                srcDoc={`<!doctype html><html><head><meta charset="utf-8"><base target="_blank"></head><body style="margin:0;padding:20px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6;font-size:14px">${
                  html.trim() || `<p style="color:#d1d5db">${t('automations.previewEmpty')}</p>`
                }</body></html>`}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Liste ──
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">{items.length} {t('automations.count')}</p>
        <button onClick={openNew} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 active:scale-[0.97] transition-all">
          <Plus className="w-4 h-4" /> {t('automations.new')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-16 px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4"><Workflow className="w-6 h-6 text-gray-300" /></div>
          <p className="text-gray-700 font-medium">{t('automations.empty')}</p>
          <p className="text-sm text-gray-500 mt-1">{t('automations.emptyHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((a, i) => (
            <div
              key={a.id}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center justify-between gap-4 hover:shadow-md transition-all duration-300 animate-card-enter"
              style={{ ['--card-index' as string]: Math.min(i, 10) }}
            >
              <button onClick={() => openEdit(a)} className="min-w-0 text-left">
                <h3 className="text-base font-semibold text-gray-900 truncate">{a.name}</h3>
                <p className="text-sm text-gray-500 mt-0.5 truncate">{triggerSummary(a.trigger)} · {a.subject || '—'}</p>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleEnabled(a)}
                  className={`text-xs font-medium rounded-full px-2.5 py-1 transition ${a.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {a.enabled ? t('automations.enabledOn') : t('automations.enabledOff')}
                </button>
                <button onClick={() => handleDelete(a.id)} className="p-2 text-gray-300 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: 0 hata.

- [ ] **Step 3: Commit**

```bash
git add components/email/AutomationsTab.tsx
git commit -m "feat(email): AutomationsTab UI (liste + composer, WizardSelect tetikleyici)"
```

---

### Task 10: EmailDashboard — sekme aktivasyonu + "Kişi Ekle" formu

**Files:**
- Modify: `components/email/EmailDashboard.tsx`

- [ ] **Step 1: Import + sekmeyi aktive et**

Üstte AutomationsTab'ı import et:
```ts
import AutomationsTab from './AutomationsTab'
```
`tabs` dizisinde automation'ı aktive et (satır ~135):
```ts
    { key: 'automation', icon: Workflow, soon: false },
```
Alttaki `{tab === 'automation' && (...)}` placeholder bloğunu (satır ~266-272) şununla değiştir:
```tsx
      {tab === 'automation' && <AutomationsTab flash={flash} />}
```

- [ ] **Step 2: "Kişi Ekle" state + handler ekle**

Component üstündeki state tanımlarına ekle:
```ts
  const [adding, setAdding] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addName, setAddName] = useState('')
  const [addPhone, setAddPhone] = useState('')
  const [addSaving, setAddSaving] = useState(false)
```
Handler (mevcut `handleImportCrm` / `handleFile` yakınına):
```ts
  const handleAddManual = useCallback(async () => {
    const email = addEmail.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { flash('err', t('contacts.addNeedEmail')); return }
    setAddSaving(true)
    try {
      const res = await fetch('/api/email/contacts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: [{ email, fullName: addName.trim() || null, phone: addPhone.trim() || null }], source: 'manual' }),
      })
      const d = await res.json()
      if (d.ok) {
        flash('ok', t('contacts.addSaved'))
        setAdding(false); setAddEmail(''); setAddName(''); setAddPhone('')
        loadContacts(offset)
      } else flash('err', t('contacts.error'))
    } finally { setAddSaving(false) }
  }, [addEmail, addName, addPhone, flash, t, loadContacts, offset])
```
> `loadContacts` ve `offset`'in mevcut isimlerini doğrula (kişi listesini yenileyen fonksiyon). Farklıysa uyumla.

- [ ] **Step 3: "Kişi Ekle" butonu + satır içi formu ekle**

Kişiler sekmesi aksiyon barında (satır ~191-207, "CRM'den Aktar" butonunun yanına) ekle:
```tsx
              <button
                onClick={() => setAdding((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                <Plus className="w-4 h-4" /> {t('contacts.addManual')}
              </button>
```
(`Plus` lucide ikonunu import et.) Aksiyon barının hemen ALTINA, koşullu form:
```tsx
          {adding && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-4 animate-card-enter">
              <p className="text-base font-semibold text-gray-900 mb-3">{t('contacts.addManualTitle')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder={t('contacts.addEmail')} className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
                <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder={t('contacts.addName')} className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
                <input value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder={t('contacts.addPhone')} className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
              </div>
              <div className="flex items-center justify-end gap-2 mt-3">
                <button onClick={() => setAdding(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">{t('contacts.addCancel')}</button>
                <button onClick={handleAddManual} disabled={addSaving} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 active:scale-[0.97] transition-all">
                  {addSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('contacts.addSave')}
                </button>
              </div>
            </div>
          )}
```

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 hata.

- [ ] **Step 5: Commit**

```bash
git add components/email/EmailDashboard.tsx
git commit -m "feat(email): Otomasyon sekmesi aktif + Kişiler'e tekil Kişi Ekle formu"
```

---

### Task 11: CHANGELOG + final doğrulama + push

**Files:**
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: CHANGELOG'a en üste giriş ekle**

```markdown
## 2026-06-01 — Email Marketing: Otomasyon (aşama tetikli otomatik e-posta)
- **Sorun:** Email Marketing > Otomasyon sekmesi "Yakında" ile devre dışıydı.
- **Çözüm:** CRM aşama girişi ve tekil yeni kişi eklenince anında otomatik e-posta gönderen otomasyon motoru. Inline fire-and-forget tetik (CRM PATCH + contacts POST), mevcut `sender.ts` gönderim katmanı `buildDispatch` ile yeniden kullanıldı. Yeni `email_automations` CRUD + `automationRunner` + `AutomationsTab` UI. Kişiler sekmesine tekil "Kişi Ekle" formu. `email_sends` otomasyon kayıtlarına açıldı (automation_id + campaign_id nullable).
- **Dosyalar:** `lib/email/{sender,automationStore,automationRunner}.ts`, `app/api/email/automations/**`, `app/api/crm/leads/[id]/route.ts`, `app/api/email/contacts/route.ts`, `components/email/{AutomationsTab,EmailDashboard}.tsx`, `supabase/migrations/20260601000000_email_sends_automation.sql`, `locales/{tr,en}.json`
```

- [ ] **Step 2: Final type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 hata.

- [ ] **Step 3: Commit + push**

```bash
git add docs/CHANGELOG.md
git commit -m "docs(changelog): Email Marketing Otomasyon kaydı"
git push
```

---

## Manuel Doğrulama (deploy + migration sonrası)

1. Otomasyon oluştur: Otomasyon sekmesi → Yeni Otomasyon → "Uygun aşamasına girince" → konu + içerik → Kaydet. Listede görünür, toggle Aktif.
2. Tetik (aşama): CRM'de bir lead'i (e-postası olan) "Uygun" aşamasına çek → birkaç sn içinde e-posta gider. `email_sends`'te `automation_id` dolu, `campaign_id` NULL kayıt oluşur.
3. Tetik (kişi): "contact_added" otomasyonu aktifken Kişiler → Kişi Ekle → yeni bir e-posta → e-posta gider. Aynı e-postayı tekrar eklemeyi dene → `inserted=0`, e-posta gitmez.
4. Toplu import negatif: CSV ile çok kişi yükle → otomasyon TETİKLENMEZ.
5. Bozulmazlık: Otomasyonu aktifken gönderim hesabı sorunlu olsa bile CRM aşama değişimi ve kişi ekleme başarılı yanıt döner (best-effort, hatası yutulur).
6. Dil: NEXT_LOCALE=en → tüm yeni metinler İngilizce.
```
