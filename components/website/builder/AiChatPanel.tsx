'use client'

import { useTranslations } from 'next-intl'
import { MessageSquare, Sparkles } from 'lucide-react'

/**
 * #builder-8a — SOL panel iskeleti. 8c'de doğal-dil sohbet + kredi-zaman çizelgesi + sürüm
 * geçmişi buraya gelecek; şimdilik markalı "Yakında" placeholder'ı. Temiz slot: BuilderWorkspace
 * bu paneli olduğu gibi 8c bileşeniyle değiştirebilir.
 */
export default function AiChatPanel() {
  const t = useTranslations('dashboard.webSiteYoneticisi')

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="flex items-center gap-2 px-1 pb-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <MessageSquare className="w-4 h-4" />
        </span>
        <h3 className="text-base font-semibold text-gray-900">{t('builder.aiPanelTitle')}</h3>
        <span className="ml-auto inline-flex items-center rounded-full bg-gray-100 text-gray-600 text-caption px-2 py-0.5">
          {t('builder.aiPanelSoon')}
        </span>
      </div>

      <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-gray-200 bg-gray-50/40 px-5 py-8">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-gray-200 text-primary">
          <Sparkles className="w-5 h-5" />
        </span>
        <p className="mt-3 text-sm leading-relaxed text-gray-500 max-w-[18rem]">
          {t('builder.aiPanelHint')}
        </p>
      </div>
    </div>
  )
}
