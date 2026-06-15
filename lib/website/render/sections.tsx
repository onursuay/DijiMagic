import type { SectionBlock } from '../types'

/**
 * Üretilen sitenin responsive bölüm bileşenleri. Saf sunum (server+client uyumlu, hook yok).
 * Tasarım barı (referans kalitesi — Elysium/Anamour): görsel-önde hero, her kartta gerçek
 * fotoğraf, büyük responsive tipografi (clamp), ferah ve tutarlı boşluk, açık↔koyu bölüm ritmi,
 * marka aksanı + tematik açık zemin. Görsel yoksa her bölüm zarif fallback ile dolu durur.
 */

type Dict = Record<string, unknown>
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
const arr = (v: unknown): Dict[] => (Array.isArray(v) ? (v as Dict[]) : [])
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : [])

/** GÜVENLİK: href/src AI üretiminden gelebilir; yalnız güvenli şemalar (javascript:/data:text engellenir). */
const safeHref = (u: unknown, fallback = '#'): string => {
  const s = typeof u === 'string' ? u.trim() : ''
  if (!s) return fallback
  if (s.startsWith('#') || s.startsWith('/')) return s
  try {
    const url = new URL(s)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? url.toString() : fallback
  } catch { return fallback }
}
const safeImg = (u: unknown): string => {
  const s = typeof u === 'string' ? u.trim() : ''
  if (!s) return ''
  if (s.startsWith('/')) return s
  if (s.startsWith('data:image/')) return s
  try {
    const url = new URL(s)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : ''
  } catch { return '' }
}

interface NavLink { label: string; href: string }
const navLinks = (v: unknown): NavLink[] =>
  arr(v).map((x) => ({ label: str(x.label), href: safeHref(x.href) })).filter((x) => x.label)

// ── Tutarlı ölçek tokenları ──
const CONTAINER = 'max-w-6xl mx-auto px-6 sm:px-8'
const SECTION = 'py-20 sm:py-28'
const EYEBROW = 'text-[0.78rem] font-semibold uppercase tracking-[0.18em]'
const H2 = 'text-[clamp(1.9rem,3.6vw,2.75rem)] font-semibold leading-[1.12] tracking-[-0.02em]'
const LEAD = 'text-[1.0625rem] sm:text-[1.15rem] leading-[1.75]'

const HEADING_STYLE = { fontFamily: 'var(--site-font-heading)' as const }

/** Görsel yoksa kullanılan zarif marka gradyanı (boş kutu hissi vermez). */
function GradientFill({ seed = 0, className = '' }: { seed?: number; className?: string }) {
  const a = seed % 2 === 0
  return (
    <div
      aria-hidden
      className={`absolute inset-0 ${className}`}
      style={{
        background: a
          ? 'linear-gradient(135deg, color-mix(in srgb, var(--site-ink) 92%, black), var(--site-accent))'
          : 'linear-gradient(135deg, var(--site-accent), color-mix(in srgb, var(--site-ink) 88%, black))',
      }}
    />
  )
}

export function HeaderSection({ content }: { content: Dict }) {
  const brand = str(content.brand, 'Marka')
  const logoUrl = safeImg(content.logoUrl)
  const nav = navLinks(content.nav)
  const ctaLabel = str(content.ctaLabel)
  const ctaHref = safeHref(content.ctaHref, '#contact')
  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-white/80 border-b border-black/[0.06]">
      <div className={`${CONTAINER} h-[74px] flex items-center justify-between gap-4`}>
        <a href="#" className="flex items-center gap-2.5 shrink-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={brand} className="h-9 w-auto max-w-[170px] object-contain" />
          ) : (
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white text-sm font-bold"
              style={{ backgroundColor: 'var(--site-accent)' }}
            >
              {brand.charAt(0).toUpperCase()}
            </span>
          )}
          <span
            className="text-[1.1rem] font-semibold tracking-[-0.01em]"
            style={{ color: 'var(--site-ink)', ...HEADING_STYLE }}
          >
            {brand}
          </span>
        </a>
        <nav className="hidden md:flex items-center">
          {nav.map((l, i) => (
            <a
              key={i}
              href={l.href}
              className="ml-8 first:ml-0 text-[0.95rem] text-black/60 hover:text-black whitespace-nowrap transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>
        {ctaLabel && (
          <a
            href={ctaHref}
            className="hidden sm:inline-flex items-center rounded-full px-5 py-2.5 text-[0.9rem] font-medium transition-transform hover:-translate-y-0.5"
            style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}
          >
            {ctaLabel}
          </a>
        )}
      </div>
    </header>
  )
}

export function HeroSection({ content }: { content: Dict }) {
  const eyebrow = str(content.eyebrow)
  const title = str(content.title, 'Başlık')
  const subtitle = str(content.subtitle)
  const ctaLabel = str(content.ctaLabel)
  const ctaHref = safeHref(content.ctaHref, '#contact')
  const ctaLabel2 = str(content.secondaryCtaLabel)
  const ctaHref2 = safeHref(content.secondaryCtaHref, '#about')
  const imageUrl = safeImg(content.imageUrl)
  return (
    <section className="relative overflow-hidden text-white">
      {/* Arka plan: fotoğraf + okunabilirlik gradyanı, yoksa marka gradyanı */}
      {imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.30) 35%, rgba(0,0,0,0.62) 100%)',
            }}
          />
          <div aria-hidden className="absolute inset-0" style={{ background: 'color-mix(in srgb, var(--site-ink) 32%, transparent)' }} />
        </>
      ) : (
        <>
          <GradientFill seed={0} />
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />
        </>
      )}
      <div className={`relative ${CONTAINER} min-h-[88vh] flex flex-col justify-center py-28`}>
        <div className="max-w-3xl">
          {eyebrow && (
            <p className={`${EYEBROW} mb-5`} style={{ color: 'color-mix(in srgb, var(--site-accent) 70%, white)' }}>
              {eyebrow}
            </p>
          )}
          <h1
            className="text-[clamp(2.5rem,6vw,5rem)] font-semibold leading-[1.04] tracking-[-0.03em]"
            style={HEADING_STYLE}
          >
            {title}
          </h1>
          {subtitle && (
            <p className={`mt-7 ${LEAD} text-white/85 max-w-xl`}>{subtitle}</p>
          )}
          {(ctaLabel || ctaLabel2) && (
            <div className="mt-10 flex flex-wrap items-center gap-3.5">
              {ctaLabel && (
                <a
                  href={ctaHref}
                  className="inline-flex items-center rounded-full px-8 py-4 text-[0.98rem] font-medium transition-transform hover:-translate-y-0.5"
                  style={{
                    backgroundColor: 'var(--site-accent)',
                    color: 'var(--site-on-accent)',
                    boxShadow: '0 18px 40px -16px color-mix(in srgb, var(--site-accent) 80%, black)',
                  }}
                >
                  {ctaLabel}
                </a>
              )}
              {ctaLabel2 && (
                <a
                  href={ctaHref2}
                  className="inline-flex items-center rounded-full border border-white/35 px-7 py-4 text-[0.98rem] font-medium text-white hover:bg-white/10 transition-colors"
                >
                  {ctaLabel2}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export function StatsSection({ content }: { content: Dict }) {
  const items = arr(content.items)
    .map((x) => ({ value: str(x.value), label: str(x.label) }))
    .filter((x) => x.value && x.label)
    .slice(0, 4)
  if (items.length === 0) return null
  return (
    <section style={{ backgroundColor: 'var(--site-surface)' }}>
      <div className={`${CONTAINER} py-14`}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-10 gap-x-6 divide-y sm:divide-y-0 sm:divide-x divide-black/[0.07]">
          {items.map((it, i) => (
            <div key={i} className="text-center px-4 pt-8 sm:pt-0 first:pt-0">
              <div className="text-[clamp(2rem,4vw,3rem)] font-semibold leading-none" style={{ color: 'var(--site-accent)', ...HEADING_STYLE }}>
                {it.value}
              </div>
              <div className="mt-3 text-[0.9rem] font-medium uppercase tracking-[0.1em] text-black/55">{it.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

interface SectionHead { eyebrow?: string; heading: string; intro?: string; center?: boolean; onDark?: boolean }
function SectionHeading({ eyebrow, heading, intro, center, onDark }: SectionHead) {
  return (
    <div className={center ? 'max-w-2xl mx-auto text-center' : 'max-w-2xl'}>
      {eyebrow && (
        <p className={`${EYEBROW} mb-3.5`} style={{ color: 'var(--site-accent)' }}>{eyebrow}</p>
      )}
      <h2 className={H2} style={{ color: onDark ? 'var(--site-on-accent)' : 'var(--site-ink)', ...HEADING_STYLE }}>
        {heading}
      </h2>
      {intro && (
        <p className={`mt-5 ${LEAD} ${onDark ? 'text-white/75' : 'text-black/60'}`}>{intro}</p>
      )}
    </div>
  )
}

export function ServicesSection({ content }: { content: Dict }) {
  const heading = str(content.heading, 'Hizmetlerimiz')
  const eyebrow = str(content.eyebrow)
  const intro = str(content.intro)
  const items = arr(content.items)
    .map((x) => ({ title: str(x.title), description: str(x.description), imageUrl: safeImg(x.imageUrl) }))
    .filter((x) => x.title)
  return (
    <section id="services" className={SECTION} style={{ backgroundColor: 'var(--site-surface)' }}>
      <div className={CONTAINER}>
        <SectionHeading eyebrow={eyebrow} heading={heading} intro={intro} center />
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {items.map((it, i) => (
            <div
              key={i}
              className="group rounded-3xl bg-white overflow-hidden ring-1 ring-black/[0.06] transition-transform duration-300 hover:-translate-y-1.5"
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 18px 40px -28px rgba(0,0,0,0.30)' }}
            >
              <div className="relative aspect-[16/11] overflow-hidden">
                {it.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.imageUrl} alt={it.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                ) : (
                  <>
                    <GradientFill seed={i} />
                    <span className="absolute inset-0 flex items-center justify-center text-white/90 text-3xl font-bold" style={HEADING_STYLE}>
                      {it.title.charAt(0).toUpperCase()}
                    </span>
                  </>
                )}
              </div>
              <div className="p-7">
                <h3 className="text-[1.2rem] font-semibold leading-snug" style={{ color: 'var(--site-ink)', ...HEADING_STYLE }}>{it.title}</h3>
                {it.description && (
                  <p className="mt-2.5 text-[0.975rem] text-black/60" style={{ lineHeight: 1.7 }}>{it.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function FeaturesSection({ content }: { content: Dict }) {
  const heading = str(content.heading, 'Neden Biz')
  const eyebrow = str(content.eyebrow)
  const items = arr(content.items)
    .map((x) => ({ title: str(x.title), description: str(x.description) }))
    .filter((x) => x.title)
  return (
    <section className={SECTION}>
      <div className={CONTAINER}>
        <SectionHeading eyebrow={eyebrow} heading={heading} />
        <div className="mt-14 grid sm:grid-cols-2 gap-x-12 gap-y-11">
          {items.map((it, i) => (
            <div key={i} className="flex gap-5">
              <div
                className="mt-0.5 h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center text-[1.05rem] font-bold"
                style={{ backgroundColor: 'var(--site-accent-soft)', color: 'var(--site-accent)' }}
              >
                {String(i + 1).padStart(2, '0')}
              </div>
              <div>
                <h3 className="text-[1.2rem] font-semibold" style={{ color: 'var(--site-ink)', ...HEADING_STYLE }}>{it.title}</h3>
                {it.description && (
                  <p className="mt-2 text-[1rem] text-black/60" style={{ lineHeight: 1.75 }}>{it.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function SplitSection({ content }: { content: Dict }) {
  const eyebrow = str(content.eyebrow)
  const heading = str(content.heading, '')
  const body = str(content.body)
  const bullets = strArr(content.bullets).slice(0, 5)
  const imageUrl = safeImg(content.imageUrl)
  const imageLeft = content.imageSide === 'left'
  const tone = str(content.tone, 'ink') // 'ink' | 'accent'
  const onDark = true
  const panelBg = tone === 'accent' ? 'var(--site-accent)' : 'var(--site-ink)'
  return (
    <section className="overflow-hidden">
      <div className="grid lg:grid-cols-2 items-stretch">
        {/* Görsel taraf */}
        <div className={`relative min-h-[340px] lg:min-h-[560px] ${imageLeft ? 'lg:order-1' : 'lg:order-2'}`}>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={heading} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <GradientFill seed={1} />
          )}
        </div>
        {/* Renkli panel */}
        <div
          className={`flex items-center ${imageLeft ? 'lg:order-2' : 'lg:order-1'}`}
          style={{ backgroundColor: panelBg, color: 'var(--site-on-accent)' }}
        >
          <div className="w-full max-w-xl mx-auto px-8 sm:px-12 py-16 lg:py-24">
            {eyebrow && (
              <p className={`${EYEBROW} mb-3.5`} style={{ color: tone === 'accent' ? 'rgba(255,255,255,0.75)' : 'color-mix(in srgb, var(--site-accent) 70%, white)' }}>
                {eyebrow}
              </p>
            )}
            {heading && <h2 className={H2} style={{ color: 'var(--site-on-accent)', ...HEADING_STYLE }}>{heading}</h2>}
            {body && <p className={`mt-5 ${LEAD} text-white/80`}>{body}</p>}
            {bullets.length > 0 && (
              <ul className="mt-7 space-y-3.5">
                {bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-3 text-[1rem] text-white/85">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: tone === 'accent' ? '#fff' : 'var(--site-accent)' }} />
                    <span style={{ lineHeight: 1.6 }}>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export function GallerySection({ content }: { content: Dict }) {
  const eyebrow = str(content.eyebrow)
  const heading = str(content.heading)
  const images = arr(content.images)
    .map((x) => ({ url: safeImg(x.url), caption: str(x.caption) }))
    .filter((x) => x.url)
    .slice(0, 5)
  if (images.length < 3) return null
  return (
    <section className={SECTION}>
      <div className={CONTAINER}>
        {(heading || eyebrow) && <SectionHeading eyebrow={eyebrow} heading={heading || ''} />}
        <div className={`${heading || eyebrow ? 'mt-12' : ''} grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5`}>
          {images.map((img, i) => (
            <div
              key={i}
              className={`group relative overflow-hidden rounded-2xl ring-1 ring-black/[0.06] ${i === 0 ? 'col-span-2 row-span-2 aspect-square md:aspect-auto' : 'aspect-[4/3]'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.caption || ''} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
              {img.caption && (
                <>
                  <div aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/65 to-transparent" />
                  <span className="absolute bottom-4 left-4 right-4 text-white text-[0.95rem] font-medium drop-shadow">{img.caption}</span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function AboutSection({ content }: { content: Dict }) {
  const eyebrow = str(content.eyebrow, '')
  const heading = str(content.heading, 'Hakkımızda')
  const body = str(content.body)
  const imageUrl = safeImg(content.imageUrl)
  return (
    <section id="about" className={SECTION}>
      <div className={`${CONTAINER} grid lg:grid-cols-2 gap-12 lg:gap-20 items-center`}>
        <div className="relative">
          <div className="aspect-[4/5] rounded-[2rem] overflow-hidden ring-1 ring-black/[0.06] shadow-[0_40px_80px_-40px_rgba(0,0,0,0.4)]">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={heading} className="w-full h-full object-cover" />
            ) : (
              <GradientFill seed={1} />
            )}
          </div>
        </div>
        <div className="max-w-xl">
          {eyebrow && <p className={`${EYEBROW} mb-3.5`} style={{ color: 'var(--site-accent)' }}>{eyebrow}</p>}
          <h2 className={H2} style={{ color: 'var(--site-ink)', ...HEADING_STYLE }}>{heading}</h2>
          {body && <p className={`mt-6 ${LEAD} text-black/65`}>{body}</p>}
        </div>
      </div>
    </section>
  )
}

export function TestimonialSection({ content }: { content: Dict }) {
  const eyebrow = str(content.eyebrow)
  const heading = str(content.heading, '')
  const items = arr(content.items)
    .map((x) => ({ quote: str(x.quote), author: str(x.author), role: str(x.role) }))
    .filter((x) => x.quote)
    .slice(0, 3)
  if (items.length === 0) return null
  return (
    <section className={SECTION} style={{ backgroundColor: 'var(--site-ink)' }}>
      <div className={CONTAINER}>
        {(heading || eyebrow) && <SectionHeading eyebrow={eyebrow} heading={heading || ''} center onDark />}
        <div className={`${heading || eyebrow ? 'mt-14' : ''} grid md:grid-cols-3 gap-6`}>
          {items.map((it, i) => (
            <figure key={i} className="rounded-3xl bg-white/[0.06] ring-1 ring-white/10 p-8 flex flex-col">
              <div className="text-[2.5rem] leading-none mb-3" style={{ color: 'var(--site-accent)', fontFamily: 'Georgia, serif' }}>“</div>
              <blockquote className="text-[1.0625rem] text-white/85 flex-1" style={{ lineHeight: 1.7 }}>{it.quote}</blockquote>
              {(it.author || it.role) && (
                <figcaption className="mt-6 pt-5 border-t border-white/10">
                  {it.author && <div className="text-[0.98rem] font-semibold text-white">{it.author}</div>}
                  {it.role && <div className="text-[0.85rem] text-white/55 mt-0.5">{it.role}</div>}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

export function CtaSection({ content }: { content: Dict }) {
  const heading = str(content.heading, '')
  const body = str(content.body)
  const ctaLabel = str(content.ctaLabel)
  const ctaHref = safeHref(content.ctaHref, '#contact')
  if (!heading) return null
  return (
    <section className="relative overflow-hidden" style={{ backgroundColor: 'var(--site-accent)' }}>
      <div aria-hidden className="absolute inset-0 opacity-[0.12]" style={{ background: 'radial-gradient(40rem 30rem at 80% -20%, #fff, transparent 60%)' }} />
      <div className={`relative ${CONTAINER} py-20 sm:py-24 text-center`} style={{ color: 'var(--site-on-accent)' }}>
        <h2 className="text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-[1.1] tracking-[-0.02em] max-w-3xl mx-auto" style={HEADING_STYLE}>
          {heading}
        </h2>
        {body && <p className="mt-5 text-[1.1rem] text-white/85 max-w-xl mx-auto" style={{ lineHeight: 1.7 }}>{body}</p>}
        {ctaLabel && (
          <a
            href={ctaHref}
            className="mt-9 inline-flex items-center rounded-full bg-white px-8 py-4 text-[0.98rem] font-semibold transition-transform hover:-translate-y-0.5"
            style={{ color: 'var(--site-accent)', boxShadow: '0 18px 40px -16px rgba(0,0,0,0.4)' }}
          >
            {ctaLabel}
          </a>
        )}
      </div>
    </section>
  )
}

export function ContactSection({ content }: { content: Dict }) {
  const heading = str(content.heading, 'İletişim')
  const body = str(content.body)
  const locations = strArr(content.locations)
  const links = navLinks(content.links)
  return (
    <section id="contact" className={SECTION} style={{ backgroundColor: 'var(--site-ink)' }}>
      <div className="max-w-3xl mx-auto px-6 text-center text-white">
        <h2 className="text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-[1.1] tracking-[-0.02em]" style={HEADING_STYLE}>{heading}</h2>
        {body && <p className={`mt-6 ${LEAD} text-white/75 max-w-xl mx-auto`}>{body}</p>}
        {locations.length > 0 && <p className="mt-7 text-[1rem] text-white/60">{locations.join('  ·  ')}</p>}
        {links.length > 0 && (
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            {links.map((l, i) => (
              <a
                key={i}
                href={l.href}
                className="rounded-full border border-white/20 px-6 py-2.5 text-[0.92rem] text-white/90 hover:bg-white/10 transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export function FooterSection({ content }: { content: Dict }) {
  const brand = str(content.brand, 'Marka')
  const logoUrl = safeImg(content.logoUrl)
  const note = str(content.note)
  const tagline = str(content.tagline)
  const nav = navLinks(content.nav)
  const social = navLinks(content.links)
  const locations = strArr(content.locations)
  const pagesLabel = str(content.pagesLabel, 'Sayfalar')
  const contactLabel = str(content.contactLabel, 'İletişim')
  return (
    <footer className="border-t border-black/[0.06] bg-black/[0.015]">
      <div className={`${CONTAINER} py-16`}>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-5 max-w-sm">
            <div className="flex items-center gap-2.5">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={brand} className="h-9 w-auto max-w-[160px] object-contain" />
              ) : (
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white text-sm font-bold"
                  style={{ backgroundColor: 'var(--site-accent)' }}
                >
                  {brand.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="text-[1.1rem] font-semibold" style={{ color: 'var(--site-ink)', ...HEADING_STYLE }}>{brand}</span>
            </div>
            {tagline && <p className="mt-4 text-[0.95rem] text-black/55" style={{ lineHeight: 1.7 }}>{tagline}</p>}
          </div>

          {nav.length > 0 && (
            <div className="lg:col-span-3">
              <h4 className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-black/40">{pagesLabel}</h4>
              <ul className="mt-4 space-y-3">
                {nav.map((l, i) => (
                  <li key={i}>
                    <a href={l.href} className="text-[0.95rem] text-black/60 hover:text-black transition-colors">{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(locations.length > 0 || social.length > 0) && (
            <div className="lg:col-span-4">
              <h4 className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-black/40">{contactLabel}</h4>
              {locations.length > 0 && <p className="mt-4 text-[0.95rem] text-black/60" style={{ lineHeight: 1.7 }}>{locations.join('  ·  ')}</p>}
              {social.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                  {social.map((l, i) => (
                    <a key={i} href={l.href} className="text-[0.9rem] text-black/55 hover:text-black transition-colors">{l.label}</a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mt-14 pt-6 border-t border-black/[0.06] text-[0.85rem] text-black/45">
          {note || `© ${brand}`}
        </div>
      </div>
    </footer>
  )
}

/** Bölüm tipi → bileşen eşlemesi. Bilinmeyen tip sessizce atlanır (geriye uyumlu). */
export function renderSection(block: SectionBlock, key: number) {
  const content = (block.content ?? {}) as Dict
  switch (block.type) {
    case 'header': return <HeaderSection key={key} content={content} />
    case 'hero': return <HeroSection key={key} content={content} />
    case 'stats': return <StatsSection key={key} content={content} />
    case 'services': return <ServicesSection key={key} content={content} />
    case 'features': return <FeaturesSection key={key} content={content} />
    case 'split': return <SplitSection key={key} content={content} />
    case 'gallery': return <GallerySection key={key} content={content} />
    case 'about': return <AboutSection key={key} content={content} />
    case 'testimonial': return <TestimonialSection key={key} content={content} />
    case 'cta': return <CtaSection key={key} content={content} />
    case 'contact': return <ContactSection key={key} content={content} />
    case 'footer': return <FooterSection key={key} content={content} />
    default: return null
  }
}
