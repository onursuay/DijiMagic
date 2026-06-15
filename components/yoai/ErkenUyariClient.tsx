'use client'

/* ──────────────────────────────────────────────────────────
   Erken Uyarı — kullanıcı görünümü (yoalgoritma alt sekmesi).

   Günlük nöbetçinin ürettiği wd_* uyarılarını severity'ye göre listeler.
   "Şimdi tara" ile anlık (interaktif, e-postasız) tarama tetikler.
   UI standardı: max-w-7xl, text-base başlık, animate-card-enter, hover,
   amber/sarı YOK (acil = red, dikkat = gray).
   ────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, ShieldAlert, RefreshCw, AlertTriangle, CircleDot } from 'lucide-react'

type Severity = 'critical' | 'high' | 'medium' | 'info'

interface WatchdogAlert {
  id: string
  source_platform: 'meta' | 'google' | null
  alert_type: string
  severity: Severity
  title: string
  body: string | null
  recommended_action: string | null
  alert_payload: { accountName?: string; count?: number } & Record<string, unknown>
  created_at: string
}

interface ApiResponse {
  ok: boolean
  counts: { total: number; critical: number; high: number; medium: number }
  alerts: WatchdogAlert[]
}

const SEV_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, info: 3 }
const SEV_META: Record<Severity, { label: string; chip: string; bar: string; icon: typeof ShieldAlert }> = {
  critical: { label: 'ACİL', chip: 'bg-red-50 text-red-700', bar: 'border-l-red-600', icon: ShieldAlert },
  high: { label: 'Yüksek', chip: 'bg-red-50 text-red-600', bar: 'border-l-red-500', icon: AlertTriangle },
  medium: { label: 'Dikkat', chip: 'bg-gray-100 text-gray-700', bar: 'border-l-gray-400', icon: CircleDot },
  info: { label: 'Bilgi', chip: 'bg-gray-100 text-gray-600', bar: 'border-l-gray-300', icon: CircleDot },
}

function fmtDate(s: string): string {
  try {
    return new Date(s).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })
  } catch { return '' }
}

export default function ErkenUyariClient() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/yoai/watchdog', { cache: 'no-store' })
      const json = (await res.json()) as ApiResponse
      if (!res.ok || !json.ok) throw new Error('Uyarılar yüklenemedi')
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const scanNow = useCallback(async () => {
    setScanning(true); setError(null)
    try {
      const res = await fetch('/api/yoai/watchdog', { method: 'POST' })
      if (!res.ok) throw new Error('Tarama başarısız')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tarama hatası')
    } finally { setScanning(false) }
  }, [load])

  const alerts = (data?.alerts ?? []).slice().sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity])
  const counts = data?.counts

  return (
    <div className="flex-1 overflow-y-auto app-content-surface p-6">
      <div className="max-w-7xl mx-auto">
        {/* Başlık + aksiyon */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Erken Uyarı</h1>
            <p className="text-sm leading-relaxed text-gray-600 mt-1">
              Reklam hesaplarınız her sabah otomatik taranır. Para sızıntısı, hesap askısı,
              reddedilen veya çalışmayan reklam tespit edilirse burada ve e-posta ile uyarılırsınız.
              Bu tarama reklamlara dokunmaz, yalnız bilgilendirir.
            </p>
          </div>
          <button
            onClick={scanNow}
            disabled={scanning}
            className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white active:scale-[0.97] transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Taranıyor...' : 'Şimdi tara'}
          </button>
        </div>

        {/* Özet sayaçları */}
        {counts && counts.total > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {([['critical', 'Acil'], ['high', 'Yüksek'], ['medium', 'Dikkat']] as const).map(([k, label], index) => (
              <div
                key={k}
                className="rounded-xl border border-gray-200 bg-white p-4 animate-card-enter"
                style={{ ['--card-index' as string]: index }}
              >
                <div className="text-2xl font-bold text-gray-900">{counts[k]}</div>
                <div className="text-caption text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
        )}

        {/* Boş durum */}
        {!loading && !error && alerts.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center animate-card-enter">
            <ShieldCheck className="w-10 h-10 text-primary mx-auto mb-3" />
            <h2 className="text-base font-semibold text-gray-900">Her şey yolunda</h2>
            <p className="text-sm leading-relaxed text-gray-600 mt-1">
              Aktif reklamlarınızda dikkat gerektiren bir durum yok. Son kontrol bugün yapıldı.
            </p>
          </div>
        )}

        {loading && (
          <div className="text-sm text-gray-500 py-10 text-center">Yükleniyor...</div>
        )}

        {/* Uyarı kartları */}
        <div className="space-y-3">
          {alerts.map((a, index) => {
            const meta = SEV_META[a.severity] ?? SEV_META.info
            const Icon = meta.icon
            return (
              <div
                key={a.id}
                className={`rounded-xl border border-gray-200 border-l-4 ${meta.bar} bg-white p-4 hover:shadow-md transition-all duration-300 animate-card-enter`}
                style={{ ['--card-index' as string]: Math.min(index, 10) }}
              >
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold ${meta.chip}`}>
                    <Icon className="w-3 h-3" /> {meta.label}
                  </span>
                  <span className="text-caption text-gray-500">
                    {a.alert_payload?.accountName || '—'} · {a.source_platform === 'google' ? 'Google' : 'Meta'} · {fmtDate(a.created_at)}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-gray-900">{a.title}</h3>
                {a.body && <p className="text-sm leading-relaxed text-gray-600 mt-1">{a.body}</p>}
                {a.recommended_action && (
                  <p className="text-sm text-gray-900 mt-2"><span className="font-semibold">Öneri:</span> {a.recommended_action}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
