'use client'

import { useState } from 'react'
import { Send, CheckCircle2 } from 'lucide-react'

export interface ContactFormLabels {
  name: string
  email: string
  phone: string
  message: string
  send: string
  sending: string
  success: string
  error: string
}

/**
 * Üretilen sitenin GERÇEK iletişim formu (client island). Site sahibinin e-postasına gönderir
 * (`POST /api/website/<id>/contact`). Spam koruması: gizli honeypot alanı (`website`) + sunucu tarafı.
 * Etiketler site diline göre props ile gelir (YoAi UI i18n değil).
 */
export default function ContactForm({ websiteId, labels }: { websiteId: string; labels: ContactFormLabels }) {
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle')
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '', website: '' })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (state === 'sending') return
    setState('sending')
    try {
      const res = await fetch(`/api/website/${websiteId}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setState(res.ok ? 'ok' : 'err')
    } catch {
      setState('err')
    }
  }

  if (state === 'ok') {
    return (
      <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] p-8 flex flex-col items-center text-center gap-3">
        <CheckCircle2 className="w-10 h-10" style={{ color: 'var(--site-accent)' }} />
        <p className="text-[1.05rem] font-medium" style={{ color: 'var(--site-ink)' }}>{labels.success}</p>
      </div>
    )
  }

  const inputCls =
    'w-full rounded-xl border border-black/[0.12] bg-white px-4 py-3 text-[0.975rem] outline-none focus:border-[color:var(--site-accent)] focus:ring-2 focus:ring-[color:var(--site-accent)]/20 transition-all'

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white ring-1 ring-black/[0.06] p-6 sm:p-7 space-y-3.5" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 18px 40px -28px rgba(0,0,0,0.3)' }}>
      {/* honeypot — gizli; bot doldurur, sunucu eler */}
      <input type="text" name="website" value={form.website} onChange={set('website')} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <div className="grid sm:grid-cols-2 gap-3.5">
        <input required value={form.name} onChange={set('name')} placeholder={labels.name} className={inputCls} />
        <input required type="email" value={form.email} onChange={set('email')} placeholder={labels.email} className={inputCls} />
      </div>
      <input value={form.phone} onChange={set('phone')} placeholder={labels.phone} inputMode="tel" className={inputCls} />
      <textarea required value={form.message} onChange={set('message')} rows={4} placeholder={labels.message} className={`${inputCls} resize-none`} />
      {state === 'err' && <p className="text-[0.9rem] text-red-600">{labels.error}</p>}
      <button
        type="submit"
        disabled={state === 'sending'}
        className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[0.975rem] font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}
      >
        <Send className="w-4 h-4" /> {state === 'sending' ? labels.sending : labels.send}
      </button>
    </form>
  )
}
