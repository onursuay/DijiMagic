#!/usr/bin/env node
/**
 * Web Site Yöneticisi kredi hesabı doğrulaması.
 * lib/website/credits.ts mantığının JS portu üzerinde assert eder (proje TS unit runner kullanmaz).
 * credits.ts değişirse bu port da güncellenmeli.
 */
const WEBSITE_CREDITS = { base: 40, perExtraPage: 15 }
function computeGenerationCost({ pageCount, localeCount }) {
  const pages = Math.max(1, Math.floor(pageCount || 1))
  const locales = Math.max(1, Math.floor(localeCount || 1))
  const perLocaleCost = WEBSITE_CREDITS.base + (pages - 1) * WEBSITE_CREDITS.perExtraPage
  return perLocaleCost * locales
}

const cases = [
  { in: { pageCount: 1, localeCount: 1 }, want: 40 },   // landing, tek dil
  { in: { pageCount: 4, localeCount: 1 }, want: 85 },   // 40 + 3*15
  { in: { pageCount: 4, localeCount: 2 }, want: 170 },  // 85 * 2
  { in: { pageCount: 1, localeCount: 3 }, want: 120 },  // 40 * 3
  { in: { pageCount: 0, localeCount: 0 }, want: 40 },   // alt sınır koruması
]
let fail = 0
for (const c of cases) {
  const got = computeGenerationCost(c.in)
  const ok = got === c.want
  if (!ok) fail++
  console.log(`${ok ? '✓' : '✗'} ${JSON.stringify(c.in)} => ${got} (beklenen ${c.want})`)
}
if (fail) { console.error(`\n❌ ${fail} hata`); process.exit(1) }
console.log('\n✓ Tüm kredi hesabı senaryoları geçti')
