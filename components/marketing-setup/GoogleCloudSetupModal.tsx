'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Cloud, X, KeyRound, Check, Copy } from 'lucide-react'

interface GoogleCloudSetupModalProps {
  open: boolean
  onClose: () => void
}

/**
 * Dismissible helper modal that lists the Google Cloud APIs the setup consent
 * needs, plus the OAuth authorized redirect URI to register. Unlike the access
 * barriers, this modal CAN be closed (X / ESC / backdrop click).
 */
export default function GoogleCloudSetupModal({
  open,
  onClose,
}: GoogleCloudSetupModalProps) {
  const t = useTranslations('marketingSetup')
  const [redirectUri, setRedirectUri] = useState('')
  const [copied, setCopied] = useState(false)

  // The authorized redirect URI is origin-relative; resolve at runtime.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRedirectUri(`${window.location.origin}/api/oauth/setup-google/callback`)
    }
  }, [])

  // Body scroll lock + ESC close while open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', handler)
    }
  }, [open, onClose])

  if (!open) return null

  const apis = [
    t('cloudModal.apiGtm'),
    t('cloudModal.apiGa4'),
    t('cloudModal.apiGsc'),
    t('cloudModal.apiSiteVerification'),
  ]

  const copyRedirect = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cloud-setup-title"
    >
      {/* Backdrop — click to close */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Card */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="h-1.5 bg-gradient-to-r from-primary via-primary/70 to-primary" />

        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-7 pt-7 pb-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
              <Cloud className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2
                id="cloud-setup-title"
                className="text-lg font-bold tracking-tight text-gray-900"
              >
                {t('cloudModal.title')}
              </h2>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-gray-500">
            {t('cloudModal.description')}
          </p>

          {/* APIs to enable */}
          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {t('cloudModal.apisTitle')}
            </h3>
            <ul className="mt-3 space-y-2">
              {apis.map((api) => (
                <li
                  key={api}
                  className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5"
                >
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="text-sm font-medium text-gray-700">
                    {api}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* OAuth client + redirect URI */}
          <div className="mt-5">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
              <KeyRound className="h-3.5 w-3.5" />
              {t('cloudModal.oauthTitle')}
            </h3>
            <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
              <p className="text-xs font-medium text-primary">
                {t('cloudModal.oauthRedirect')}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700">
                  {redirectUri || '…'}
                </code>
                <button
                  type="button"
                  onClick={copyRedirect}
                  disabled={!redirectUri}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-800 disabled:opacity-50"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      {t('common.copied')}
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      {t('common.copy')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {t('cloudModal.doneButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
