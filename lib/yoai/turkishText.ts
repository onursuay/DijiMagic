/* ──────────────────────────────────────────────────────────
   YoAi — Türkçe metin yardımcıları

   JS varsayılan toLowerCase() Türkçe büyük "İ"yi 'i̇' (i + U+0307
   combining dot above) üretir → naive .includes('istanbul') FALSE döner.
   Bu util İ/I'yı 'i'ye indirger ve combining dot'u temizler; şehir/anahtar
   eşlemeleri büyük-küçük harf ve diakritikten bağımsız doğru çalışır.
   ────────────────────────────────────────────────────────── */

/** Türkçe-bilinçli küçük harf normalizasyonu (İ/I → i, combining dot strip). */
export function normalizeTrLower(s: string | null | undefined): string {
  return (s || '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .toLowerCase()
    .replace(/̇/g, '')
}

/** text içinde city (büyük/küçük/diakritik bağımsız) geçiyor mu? */
export function cityIncludes(text: string | null | undefined, city: string | null | undefined): boolean {
  if (!text || !city) return false
  return normalizeTrLower(text).includes(normalizeTrLower(city))
}
