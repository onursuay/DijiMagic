import 'server-only'
import { supabase } from '@/lib/supabase/client'

const TR_MAP: Record<string, string> = {
  ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u',
  Ç: 'c', Ğ: 'g', Ö: 'o', Ş: 's', Ü: 'u',
}

/** Türkçe-güvenli, DNS-uyumlu subdomain slug'ı (a-z0-9-, 3-40 char). */
export function slugifySubdomain(input: string): string {
  const replaced = (input || '').replace(/[çğıİöşüÇĞÖŞÜ]/g, (ch) => TR_MAP[ch] ?? ch)
  let slug = replaced
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
  if (slug.length < 3) slug = `site-${slug}`.replace(/-+$/g, '').slice(0, 40)
  return slug
}

/** Çakışmada -2, -3 … ekleyerek benzersiz subdomain üretir. */
export async function ensureUniqueSubdomain(base: string): Promise<string> {
  const root = slugifySubdomain(base)
  if (!supabase) return root
  let candidate = root
  let n = 1
  while (n <= 50) {
    const { data } = await supabase
      .from('websites')
      .select('id')
      .eq('subdomain', candidate)
      .maybeSingle()
    if (!data) return candidate
    n += 1
    candidate = `${root}-${n}`.slice(0, 40)
  }
  return `${root}-${Date.now().toString(36)}`.slice(0, 40)
}
