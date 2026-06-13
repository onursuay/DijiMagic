// Meta detaylı hedefleme: her segment kendi flexible_spec alanına yazılmalı
// (interests / behaviors / life_events / family_statuses ...). Davranış/demografi ID'sini
// 'interests' altında göndermek GEÇERSİZ parametredir (publish reddi / yanlış hedefleme).

export interface DetailedTargetingItem {
  id: string
  name: string
  metaType?: string
}

// Graph API FlexibleTargeting'de geçerli alan adları. Bunun dışındaki ham type'lar
// güvenli şekilde 'interests'e düşer (eski davranıştan daha kötü değil).
const FLEX_KEYS = new Set<string>([
  'interests',
  'behaviors',
  'life_events',
  'family_statuses',
  'industries',
  'income',
  'education_statuses',
  'education_majors',
  'education_schools',
  'work_positions',
  'work_employers',
  'relationship_statuses',
  'college_years',
  'user_adclusters',
  'politics',
  'interested_in',
])

/**
 * Detaylı hedefleme öğelerini tek bir flexible_spec AND-bloğuna, her biri kendi alan adı
 * altında (OR) gruplar. metaType yoksa/whitelist dışındaysa 'interests'e düşer.
 * Boş girdide undefined döner (alan hiç gönderilmez).
 */
export function buildFlexibleSpec(
  items: DetailedTargetingItem[],
): Array<Record<string, { id: string; name: string }[]>> | undefined {
  if (!items || items.length === 0) return undefined
  const block: Record<string, { id: string; name: string }[]> = {}
  for (const it of items) {
    const raw = (it.metaType || '').toLowerCase().trim()
    const key = FLEX_KEYS.has(raw) ? raw : 'interests'
    if (!block[key]) block[key] = []
    block[key].push({ id: it.id, name: it.name })
  }
  return [block]
}
