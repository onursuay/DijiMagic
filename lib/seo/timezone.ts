/**
 * Timezone yardımcıları — kullanıcının yerel saatini (publish_time + IANA
 * timezone) UTC cron tetiklemesiyle eşleştirmek için.
 *
 * Sabit offset hesaplamak yerine Intl ile tz'ye çevirir → DST ve farklı
 * ülkeler için doğru çalışır.
 */

export interface LocalParts {
  date: string // YYYY-MM-DD (yerel)
  hour: number
  minute: number
  weekday: number // 0=Pazar .. 6=Cumartesi
}

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

export function getLocalParts(tz: string, at: Date = new Date()): LocalParts {
  let timeZone = tz
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
  } catch {
    timeZone = 'Europe/Istanbul'
  }
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  })
  const parts = fmt.formatToParts(at)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  let hour = parseInt(get('hour'), 10)
  if (hour === 24) hour = 0 // bazı ortamlar 24 döndürür
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour,
    minute: parseInt(get('minute'), 10),
    weekday: WEEKDAY_MAP[get('weekday')] ?? 0,
  }
}

/**
 * Schedule bu anda tetiklenmeli mi?
 *
 * Saatlik cron (0 * * * *) ile çalışır. Tek-saat tam eşleşme yerine "yayın anı
 * bugün geldi/geçti + bugün henüz çalışmadı" mantığı kullanır → kullanıcı yayın
 * saatini o günkü pencereden SONRA ayarlasa bile (ör. 23:14'ü 23:30'da kaydetse)
 * bir sonraki saatlik cron'da AYNI GÜN telafi edilir; ertesi güne sarkmaz.
 */
export function isScheduleDue(
  publishTime: string,
  timezone: string,
  frequency: 'daily' | 'weekdays' | 'weekly',
  weekday: number | null,
  lastRunDate: string | null,
  at: Date = new Date()
): boolean {
  const local = getLocalParts(timezone, at)
  const [hStr, mStr] = publishTime.split(':')
  const targetHour = parseInt(hStr ?? '9', 10)
  const targetMinute = parseInt(mStr ?? '0', 10)

  // Aynı yerel günde zaten çalıştıysa tekrar tetikleme (idempotency).
  if (lastRunDate === local.date) return false

  // Frekans kontrolü — bugün uygun bir gün mü?
  if (frequency === 'weekdays' && (local.weekday === 0 || local.weekday === 6)) return false
  if (frequency === 'weekly' && weekday != null && local.weekday !== weekday) return false

  // Yayın anı bugün geldi/geçti mi? (dakika dahil)
  const nowMinutes = local.hour * 60 + local.minute
  const targetMinutes = targetHour * 60 + targetMinute
  return nowMinutes >= targetMinutes
}
