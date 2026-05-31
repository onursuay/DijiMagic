/**
 * Meta Lead Ads form alanı ayrıştırıcı.
 *
 * Form alan adları kullanıcının formuna göre değişir ve Türkçe olabilir:
 *   adiniz / soyadiniz / telefon_numarasi / email-adresi / ulke
 *   first_name / last_name / phone_number / E-MAİL ADRESİ / ÜLKE
 * Bu yüzden ham eşitlik yerine normalize + esnek eşleştirme kullanılır
 * (Türkçe karakter farkları İ/ı/ş/ğ/ü/ö/ç temizlenir).
 */

export interface ParsedLeadFields {
  fullName: string | null
  email: string | null
  phone: string | null
}

interface FieldEntry { name?: string; values?: string[] }

/** Türkçe + aksanlı karakterleri ASCII'ye indirger, küçük harfe çevirir. */
function norm(s: string | undefined): string {
  return (s || '')
    .replace(/[İIı]/g, 'i')
    .replace(/[Şş]/g, 's')
    .replace(/[Ğğ]/g, 'g')
    .replace(/[Üü]/g, 'u')
    .replace(/[Öö]/g, 'o')
    .replace(/[Çç]/g, 'c')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

export function parseLeadFields(fieldData: FieldEntry[] | undefined): ParsedLeadFields {
  const list = Array.isArray(fieldData) ? fieldData : []
  const pick = (pred: (n: string) => boolean): string | null => {
    for (const f of list) {
      if (pred(norm(f.name))) {
        const v = (f.values ?? [])[0]
        if (v && String(v).trim()) return String(v).trim()
      }
    }
    return null
  }

  const email = pick((n) => n.includes('mail') || n.includes('posta'))
  const phone = pick((n) => n.includes('phone') || n.includes('telefon') || n.includes('gsm') || n.includes('cep'))

  const full = pick((n) => /^(full[_ ]?name|name|ad[_ ]?soyad|adsoyad|isim[_ ]?soyisim)$/.test(n))
  if (full) return { fullName: full, email, phone }

  const first = pick((n) => /^(first[_ ]?name|ad|adi|adin|adiniz|isim|isminiz)$/.test(n) || n.includes('first'))
  const last = pick((n) => /^(last[_ ]?name|soyad|soyadi|soyadin|soyadiniz|soyisim)$/.test(n) || n.includes('soyad'))
  const fullName = [first, last].filter(Boolean).join(' ').trim() || null

  return { fullName, email, phone }
}
