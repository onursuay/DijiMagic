'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  Loader2, KeyRound, ChevronDown, ChevronUp, Eye, EyeOff, ExternalLink,
  Copy, Check, RefreshCw,
} from 'lucide-react'

/**
 * Sunucu Authorization başlığını PHP'ye iletmiyorsa (auth_blocked) kullanıcıya
 * gösterilen kök .htaccess düzeltmesi. Literal sunucu yapılandırması — i18n'e
 * taşınmaz (çevrilmez), yalnız etrafındaki etiketler çevrilir.
 */
const HTACCESS_SNIPPET = `# YoAi — Authorization başlığını PHP'ye ilet
CGIPassAuth On

# Alternatif (Apache mod_rewrite):
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteCond %{HTTP:Authorization} ^(.*)
RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]
</IfModule>`

interface Props {
  /** Etkin site URL'i (analiz tabındaki aktif URL) — form öntanımlı doldurulur. */
  defaultUrl?: string | null
  /** Bağlantı başarıyla eklenince listeyi tazelemek için. */
  onConnected: () => void
  /** Tek-tık yetkilendirme uygun değilse panel otomatik açık başlasın. */
  defaultOpen?: boolean
  /** Modal içinde render: kart wrapper'ı olmadan, toggle butonu olmadan form gösterir. */
  alwaysOpen?: boolean
}

/**
 * WordPress'e MANUEL "Uygulama Parolası" ile bağlanma formu.
 *
 * Tek-tık yetkilendirme (authorize-application.php) ağır/yavaş sitelerde beyaz
 * ekrana düşebildiğinden, kullanıcı WP profilinden ürettiği uygulama parolasını
 * buraya yapıştırır. Doğrulama hafif `users/me` ucundan (10sn timeout) yapılır.
 */
export default function SeoWordPressConnect({ defaultUrl, onConnected, defaultOpen = false, alwaysOpen = false }: Props) {
  const t = useTranslations('dashboard.seo.articles.sites.wpManual')

  const [open, setOpen] = useState(defaultOpen)
  useEffect(() => { if (defaultOpen) setOpen(true) }, [defaultOpen])

  const [showHelp, setShowHelp] = useState(false)
  const [url, setUrl] = useState(defaultUrl || '')
  const [username, setUsername] = useState('')
  const [appPassword, setAppPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Etkin site URL'i değişirse (analiz tabındaki URL) ve kullanıcı henüz elle dokunmadıysa öntanımlıyı güncelle.
  useEffect(() => {
    if (defaultUrl) setUrl((prev) => (prev ? prev : defaultUrl))
  }, [defaultUrl])

  const errText = (code: string): string => {
    switch (code) {
      case 'invalid_url': return t('errInvalidUrl')
      case 'username_required': return t('errUsernameRequired')
      case 'weak_password': return t('errWeakPassword')
      case 'auth_failed': return t('errAuthFailed')
      case 'auth_blocked': return t('errAuthBlocked')
      case 'unreachable': return t('errUnreachable')
      case 'not_wordpress': return t('errNotWordpress')
      default: return t('errSaveFailed')
    }
  }

  const handleConnect = async () => {
    setErrorCode(null)
    setBusy(true)
    try {
      const res = await fetch('/api/seo/sites/wordpress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: url, username, appPassword }),
      })
      const data = await res.json()
      if (data.ok) {
        setUsername(''); setAppPassword(''); setOpen(false)
        onConnected()
      } else {
        setErrorCode(data.error || 'save_failed')
      }
    } catch {
      setErrorCode('save_failed')
    } finally {
      setBusy(false)
    }
  }

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(HTACCESS_SNIPPET)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* pano erişimi yoksa sessiz geç */
    }
  }

  if (!open && !alwaysOpen) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-3 border border-dashed border-gray-300 rounded-xl p-4 text-left hover:border-primary/40 hover:bg-primary/5 transition-colors"
      >
        <span className="flex items-center gap-2.5">
          <KeyRound className="w-4 h-4 text-gray-400" />
          <span>
            <span className="block text-sm font-medium text-gray-900">{t('title')}</span>
            <span className="block text-xs text-gray-500">{t('subtitle')}</span>
          </span>
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </button>
    )
  }

  const canSubmit = url.trim().length > 0 && username.trim().length > 0 && appPassword.replace(/\s+/g, '').length >= 16

  return (
    <div className={alwaysOpen ? 'space-y-3' : 'border border-primary/20 rounded-xl p-4 bg-primary/5 space-y-3'}>
      {!alwaysOpen && (
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <KeyRound className="w-4 h-4" /> {t('title')}
          </h4>
          <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{t('urlLabel')}</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('urlPlaceholder')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/15 focus:border-primary"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{t('usernameLabel')}</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={t('usernamePlaceholder')}
          autoComplete="off"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary/15 focus:border-primary"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{t('passwordLabel')}</label>
        <div className="flex items-center gap-2">
          <input
            type={showPass ? 'text' : 'password'}
            value={appPassword}
            onChange={(e) => setAppPassword(e.target.value)}
            placeholder={t('passwordPlaceholder')}
            autoComplete="off"
            className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono bg-white focus:ring-2 focus:ring-primary/15 focus:border-primary"
          />
          <button
            onClick={() => setShowPass((v) => !v)}
            type="button"
            className="shrink-0 inline-flex items-center px-2.5 py-2 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            title={showPass ? t('hide') : t('show')}
          >
            {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">{t('passwordHint')}</p>
      </div>

      {errorCode && errorCode !== 'auth_blocked' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700">{errText(errorCode)}</div>
      )}

      {errorCode === 'auth_blocked' && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2.5">
          <p className="text-xs text-gray-700 leading-relaxed">{t('errAuthBlocked')}</p>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-gray-600">{t('authBlockedFixTitle')}</p>
            <div className="relative">
              <pre className="bg-gray-900 text-gray-100 text-[11px] leading-relaxed rounded-lg p-2.5 pr-20 overflow-x-auto font-mono whitespace-pre">{HTACCESS_SNIPPET}</pre>
              <button
                type="button"
                onClick={copySnippet}
                className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-100 bg-white/10 hover:bg-white/20 rounded transition-colors"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? t('copied') : t('copy')}
              </button>
            </div>
            <p className="text-[11px] text-gray-500">{t('authBlockedFixHint')}</p>
          </div>
          <button
            type="button"
            onClick={handleConnect}
            disabled={busy || !canSubmit}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all active:scale-[0.97]"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {t('retry')}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setShowHelp((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900"
        >
          {t('howTitle')}
          {showHelp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={handleConnect}
          disabled={busy || !canSubmit}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
          {busy ? t('connecting') : t('connect')}
        </button>
      </div>

      {showHelp && (
        <div className="border-t border-primary/15 pt-3 space-y-2 text-xs text-gray-600 leading-relaxed">
          <p>{t('how1')}</p>
          <p>{t('how2')}</p>
          <p>{t('how3')}</p>
          <p>{t('how4')}</p>
          {url.trim() && (
            <a
              href={`${url.replace(/\/+$/, '')}/wp-admin/profile.php#application-passwords-section`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium pt-1"
            >
              <ExternalLink className="w-3.5 h-3.5" /> {t('openProfile')}
            </a>
          )}
        </div>
      )}
    </div>
  )
}
