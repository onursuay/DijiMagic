'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

/**
 * Public abonelikten-çık sayfası (auth gerektirmez). E-postadaki linkten gelinir:
 * /unsubscribe?c={campaignId}&e={email}&s={sig}
 */
export default function UnsubscribePage() {
  const params = useSearchParams()
  const c = params.get('c') || ''
  const e = params.get('e') || ''
  const s = params.get('s') || ''

  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const handleUnsub = async () => {
    setStatus('loading')
    try {
      const res = await fetch('/api/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ c, e, s }),
      })
      const data = await res.json()
      setStatus(data.ok ? 'done' : 'error')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-md w-full text-center">
        {status === 'done' ? (
          <>
            <h1 className="text-lg font-semibold text-gray-900">Abonelikten çıkıldı</h1>
            <p className="text-sm text-gray-600 mt-2">
              <span className="font-medium">{e}</span> adresine artık e-posta gönderilmeyecek.
            </p>
          </>
        ) : status === 'error' ? (
          <>
            <h1 className="text-lg font-semibold text-gray-900">Bağlantı geçersiz</h1>
            <p className="text-sm text-gray-600 mt-2">İşlem tamamlanamadı. Lütfen e-postadaki bağlantıyı tekrar kullanın.</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-gray-900">Abonelikten çık</h1>
            <p className="text-sm text-gray-600 mt-2">
              <span className="font-medium">{e || 'Bu e-posta adresi'}</span> bundan sonra e-posta almak istemiyor musunuz?
            </p>
            <button
              onClick={handleUnsub}
              disabled={status === 'loading' || !c || !e || !s}
              className="mt-5 inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition"
            >
              {status === 'loading' ? 'İşleniyor…' : 'Abonelikten çık'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
