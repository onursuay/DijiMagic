'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { MessageSquare, Sparkles, Send, Loader2, MousePointerClick, RotateCcw, Layers } from 'lucide-react'
import DictateButton from '@/components/website/DictateButton'

/** Sohbet mesajı (parent'ta tutulur — sayfa/dil değişse de korunur). */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  /** assistant satırı sürüyor mu (uygulanıyor…) → spinner. */
  pending?: boolean
}

interface AiChatPanelProps {
  messages: ChatMessage[]
  /** Sohbet komutu gönder → parent: seçili blok varsa /patch (ai_rewrite), yoksa /generate (sayfa revize). */
  onSubmit: (text: string) => void
  /** "Baştan üret" (reject) — seçimden bağımsız tüm sayfayı yeniden üretir. */
  onRegenerate: (text: string) => void
  /** Bir komut işleniyor → input + butonlar kilit. */
  busy: boolean
  /** Seçili blok etiketi (varsa) → komutun bloğa hedefleneceğini gösterir; yoksa sayfa geneli. */
  selectedLabel?: string | null
}

type Mode = 'edit' | 'regenerate'

/**
 * #builder-8c — SOL panel: doğal-dil SOHBET ile site düzenleme.
 *
 * Gönderince (parent karar verir):
 *   - Tuvalde bir blok SEÇİLİYSE → hedefli /patch (op ai_rewrite, targetId = seçili blok) → blok-düzey edit.
 *   - Seçim YOKSA → sayfa-düzey /generate revize (revisionMode 'edit') → blok-patch ya da yeniden üret.
 * "Baştan üret" modu (toggle) → /generate revisionMode 'reject' (reddet/yeniden üret affordance korunur).
 *
 * Konuşma (kullanıcı mesajı + kısa "uygulanıyor/uygulandı" asistan satırı) parent state'inde tutulur.
 * 402 → parent AccessRequiredModal (kredi) açar. Başarı → parent tuvali tazeler (reloadKey).
 * Amber/sarı YASAK; tüm metinler i18n.
 */
export default function AiChatPanel({ messages, onSubmit, onRegenerate, busy, selectedLabel = null }: AiChatPanelProps) {
  const t = useTranslations('dashboard.webSiteYoneticisi.builder.chat')
  const uiLocale = useLocale()
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<Mode>('edit')
  const threadRef = useRef<HTMLDivElement>(null)

  // Yeni mesaj geldikçe en alta kaydır.
  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [messages])

  const send = () => {
    const text = input.trim()
    if (!text || busy) return
    if (mode === 'regenerate') onRegenerate(text)
    else onSubmit(text)
    setInput('')
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // Hedef bağlam satırı: seçili blok varsa bloğa, yoksa sayfaya (regenerate modunda tüm sayfa).
  const targetLine =
    mode === 'regenerate'
      ? t('targetRegenerate')
      : selectedLabel
        ? t('targetBlock', { block: selectedLabel })
        : t('targetPage')

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="flex items-center gap-2 px-1 pb-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <MessageSquare className="w-4 h-4" />
        </span>
        <h3 className="text-base font-semibold text-gray-900">{t('title')}</h3>
      </div>

      {/* Konuşma akışı */}
      <div ref={threadRef} className="flex-1 min-h-0 overflow-y-auto pr-0.5 flex flex-col gap-2.5">
        {messages.length === 0 ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-gray-200 bg-gray-50/40 px-5 py-8">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-gray-200 text-primary">
              <Sparkles className="w-5 h-5" />
            </span>
            <p className="mt-3 text-sm leading-relaxed text-gray-500 max-w-[18rem]">{t('emptyHint')}</p>
          </div>
        ) : (
          messages.map((m, i) =>
            m.role === 'user' ? (
              <div
                key={m.id}
                className="self-end max-w-[90%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm leading-relaxed text-white animate-card-enter"
                style={{ ['--card-index' as string]: Math.min(i, 10) }}
              >
                {m.text}
              </div>
            ) : (
              <div
                key={m.id}
                className="self-start max-w-[90%] inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-gray-200 bg-white px-3.5 py-2 text-sm leading-relaxed text-gray-700 animate-card-enter"
                style={{ ['--card-index' as string]: Math.min(i, 10) }}
              >
                {m.pending ? (
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                )}
                {m.text}
              </div>
            ),
          )
        )}
      </div>

      {/* Komut girişi */}
      <div className="mt-3 shrink-0">
        {/* Mod seçici: Düzenle / Baştan üret */}
        <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-white mb-2">
          <button
            type="button"
            onClick={() => setMode('edit')}
            disabled={busy}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
              mode === 'edit' ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> {t('modeEdit')}
          </button>
          <button
            type="button"
            onClick={() => setMode('regenerate')}
            disabled={busy}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
              mode === 'regenerate' ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" /> {t('modeRegenerate')}
          </button>
        </div>

        {/* Hedef bağlam ipucu */}
        <p className="flex items-center gap-1.5 text-caption text-gray-500 mb-2">
          {mode === 'regenerate' ? (
            <Layers className="w-3.5 h-3.5 shrink-0" />
          ) : selectedLabel ? (
            <MousePointerClick className="w-3.5 h-3.5 text-primary shrink-0" />
          ) : (
            <Layers className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="truncate">{targetLine}</span>
        </p>

        <div className="rounded-xl border border-gray-200 bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            disabled={busy}
            placeholder={mode === 'regenerate' ? t('placeholderRegenerate') : t('placeholder')}
            className="w-full resize-none rounded-t-xl bg-transparent px-3 py-2.5 text-sm leading-relaxed text-gray-800 placeholder:text-gray-400 outline-none disabled:opacity-60"
          />
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <DictateButton
              onAppend={(text) => setInput(input ? `${input} ${text}` : text)}
              lang={uiLocale === 'en' ? 'en-US' : 'tr-TR'}
              labelStart={t('dictate')}
              labelStop={t('listening')}
              labelPause={t('stopDictate')}
            />
            <button
              type="button"
              onClick={send}
              disabled={busy || !input.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white active:scale-[0.97] transition-all disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {busy ? t('sending') : t('send')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
