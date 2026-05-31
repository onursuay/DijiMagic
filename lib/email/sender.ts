import 'server-only'
import { Resend } from 'resend'
import { supabase } from '@/lib/supabase/client'
import { getCampaign, markCampaign } from './campaignStore'
import { resolveRecipients, type Segment } from './segments'
import { unsubscribeUrl } from './unsubscribe'

const FROM_EMAIL = process.env.FROM_EMAIL || 'YO Dijital Medya Anonim Şirketi <info@yodijital.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://yoai.yodijital.com'
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

/** Kullanıcı içeriği + zorunlu KVKK abonelikten-çık footer'ı. */
function buildHtml(body: string, unsubUrl: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.6">
${body}
<hr style="margin-top:32px;border:none;border-top:1px solid #e5e7eb"/>
<p style="font-size:12px;color:#9ca3af;margin-top:12px">Bu e-postaları almak istemiyorsanız <a href="${unsubUrl}" style="color:#9ca3af;text-decoration:underline">abonelikten çıkabilirsiniz</a>.</p>
</body></html>`
}

export interface SendResult {
  ok: boolean
  reason?: 'not_found' | 'resend_not_configured' | 'already' | 'no_recipients'
  sent: number
  total: number
}

/** Bir kampanyayı segmentindeki tüm alıcılara gönderir (Resend batch). */
export async function sendCampaign(userId: string, campaignId: string): Promise<SendResult> {
  const campaign = await getCampaign(campaignId, userId)
  if (!campaign) return { ok: false, reason: 'not_found', sent: 0, total: 0 }
  if (!resend) return { ok: false, reason: 'resend_not_configured', sent: 0, total: 0 }
  if (campaign.status === 'sent' || campaign.status === 'sending') {
    return { ok: false, reason: 'already', sent: 0, total: 0 }
  }

  await markCampaign(campaignId, { status: 'sending' })

  const recipients = await resolveRecipients(userId, campaign.segment as Segment)
  if (recipients.length === 0) {
    await markCampaign(campaignId, { status: 'draft' })
    return { ok: false, reason: 'no_recipients', sent: 0, total: 0 }
  }

  const from =
    campaign.from_email && campaign.from_name
      ? `${campaign.from_name} <${campaign.from_email}>`
      : campaign.from_email || FROM_EMAIL
  const subject = campaign.subject || '(konusuz)'

  let sent = 0
  const sendRows: Record<string, unknown>[] = []

  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100)
    const batch = chunk.map((r) => ({
      from,
      to: r.email,
      subject,
      html: buildHtml(campaign.html, unsubscribeUrl(APP_URL, campaignId, r.email)),
    }))
    try {
      const res = await resend.batch.send(batch)
      // SDK: res.data?.data = [{ id }] (alıcı sırasıyla)
      const ids = (((res as { data?: { data?: Array<{ id?: string }> } }).data?.data) ?? []) as Array<{ id?: string }>
      chunk.forEach((r, idx) => {
        const rid = ids[idx]?.id ?? null
        sendRows.push({
          campaign_id: campaignId, user_id: userId, contact_id: r.contactId, email: r.email,
          resend_id: rid, status: rid ? 'sent' : 'failed', sent_at: new Date().toISOString(),
        })
        if (rid) sent++
      })
    } catch {
      chunk.forEach((r) => sendRows.push({
        campaign_id: campaignId, user_id: userId, contact_id: r.contactId, email: r.email, status: 'failed',
      }))
    }
  }

  if (supabase && sendRows.length) {
    for (let i = 0; i < sendRows.length; i += 500) {
      await supabase.from('email_sends').upsert(sendRows.slice(i, i + 500), { onConflict: 'campaign_id,email' })
    }
  }

  await markCampaign(campaignId, {
    status: 'sent',
    sentAt: new Date().toISOString(),
    stats: { recipients: recipients.length, sent },
  })
  return { ok: true, sent, total: recipients.length }
}
