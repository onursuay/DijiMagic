import type { ThemeTokens } from '../types'

/**
 * Codegen (format='html') servisi için: bir sitenin temasından assembleDocument'in
 * `:root` bloğuna yazılacak CSS custom property haritasını (`--ink`, `--accent`, …) okur.
 *
 * designVars, Stage-1 DesignSystem'den `toDesignVars()` ile türetilip Task 15 (generate/persist)
 * tarafından `website.theme.designVars`'a yazılır. Henüz persist edilmemiş (eski / sections) bir
 * temada alan tanımsızdır → boş `{}` döner. assembleDocument boş designVars ile de geçerli bir
 * belge üretir (tailwindCompile :root bloğunu atlar, body kendi inline var()'larını kullanır),
 * dolayısıyla servis ASLA çökmez.
 */
export function themeToDesignVars(theme: ThemeTokens | null | undefined): Record<string, string> {
  const dv = theme?.designVars
  if (dv && typeof dv === 'object' && !Array.isArray(dv)) {
    // Yalnız string değerleri geçir (jsonb'den bozuk veri gelse bile CSS güvenli kalsın).
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(dv)) {
      if (typeof v === 'string') out[k] = v
    }
    return out
  }
  return {}
}
