import type { CSSProperties } from 'react'
import type { WebsitePage, ThemeTokens } from '../types'
import { themeToCssVars, fontHrefFor } from './theme'
import { renderSection } from './sections'

interface SiteRendererProps {
  page: WebsitePage
  theme: ThemeTokens | null | undefined
  /** Önizleme kapsayıcısında kullanım için ek stil. */
  style?: CSSProperties
}

/** Tek bir sayfa modelini tema + yazı ailesi uygulayarak render eder. Saf sunum (server+client). */
export default function SiteRenderer({ page, theme, style }: SiteRendererProps) {
  return (
    <div
      style={{ ...themeToCssVars(theme), fontFamily: 'var(--site-font-body)', ...style }}
      className="bg-white text-black antialiased"
    >
      {/* Üretilen sitenin yazı aileleri — yalnız bu sitenin fontları (Next head'e hoist eder) */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={fontHrefFor(theme)} />
      {page.sections.map((block, i) => renderSection(block, i))}
    </div>
  )
}
