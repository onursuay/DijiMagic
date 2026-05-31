/**
 * CRM pipeline aşamaları — istemci tarafı sıralama + renk (onaylı palet:
 * gray / emerald / primary / red; amber YOK). Etiketler i18n'den (crm.stages.*).
 */

export const STAGES = ['giris', 'uygun', 'donusum', 'kayip', 'uygun_degil'] as const
export type Stage = (typeof STAGES)[number]

export interface StageStyle {
  /** Renk noktası (Kanban sütun başlığı, select). */
  dot: string
  /** Rozet (chip). */
  chip: string
  /** Kanban sütun üst çizgisi. */
  bar: string
}

export const STAGE_STYLE: Record<Stage, StageStyle> = {
  giris: { dot: 'bg-gray-300', chip: 'bg-gray-100 text-gray-600 border-gray-200', bar: 'bg-gray-300' },
  uygun: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500' },
  donusum: { dot: 'bg-primary', chip: 'bg-primary/10 text-primary border-primary/20', bar: 'bg-primary' },
  kayip: { dot: 'bg-red-500', chip: 'bg-red-50 text-red-700 border-red-200', bar: 'bg-red-500' },
  uygun_degil: { dot: 'bg-gray-400', chip: 'bg-gray-100 text-gray-500 border-gray-200', bar: 'bg-gray-400' },
}
