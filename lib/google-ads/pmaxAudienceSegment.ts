// Saf (yan etkisiz) — PMax kitle sinyali için seçilen segmenti Audience resource AudienceSegment'ine eşler.
// Audience dimension'da desteklenmeyen tür (ör. COMBINED_AUDIENCE) veya resourceName yoksa null döner.

export function buildPMaxAudienceSegment(
  s: { category: string; id: string; resourceName: string },
): Record<string, unknown> | null {
  if (!s.resourceName) return null
  switch (s.category) {
    case 'USER_LIST':
      return { userList: { userList: s.resourceName } }
    case 'AFFINITY':
    case 'IN_MARKET':
      return { userInterest: { userInterestCategory: s.resourceName } }
    case 'DETAILED_DEMOGRAPHIC':
      return { detailedDemographic: { detailedDemographic: s.resourceName } }
    case 'LIFE_EVENT':
      return { lifeEvent: { lifeEvent: s.resourceName } }
    case 'CUSTOM_AUDIENCE':
      return { customAudience: { customAudience: s.resourceName } }
    default:
      return null
  }
}
