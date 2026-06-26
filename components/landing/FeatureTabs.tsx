'use client'

import { useState, useEffect } from 'react'
import FeatureVisual from './FeatureVisual'

/* ── SVG ikonlar (statik, currentColor) ── */
const ICONS: Record<string, string> = {
  meta: '<path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>',
  google: '<text x="3.5" y="18" font-size="19" font-weight="700" font-family="Arial,sans-serif" fill="currentColor" stroke="none">G</text>',
  tiktok: '<path d="M9 18V8.5a5.5 5.5 0 005.5 5.5V10a4 4 0 01-2.5-3.7V3h-3z"/><circle cx="6" cy="18" r="3"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  trending: '<polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/>',
  sparkle: '<path d="M11 3l1.6 4.4L17 9l-4.4 1.6L11 15l-1.6-4.4L5 9l4.4-1.6z"/><path d="M18.5 13l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"/>',
  users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98"/><path d="M15.41 6.51l-6.82 3.98"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>',
  chart: '<path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>',
  crm: '<rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M13 9h6M13 13h6M5 16c.4-1.2 1.6-2 3-2s2.6.8 3 2"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>',
  plug: '<path d="M10 13a5 5 0 007.07 0l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.07 0l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>',
}
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[name] || '' }} />
}

type Feat = { slug: string; icon: string; soon?: boolean; points?: { tr: string[]; en: string[] }; tr: { name: string; desc: string }; en: { name: string; desc: string } }
type Layout = 'cards' | 'carousel' | 'rows' | 'bento'
type Group = { id: string; layout: Layout; tr: { eyebrow: string; title: string }; en: { eyebrow: string; title: string }; feats: Feat[] }

const GROUPS: Group[] = [
  {
    id: 'reklam', layout: 'cards',
    tr: { eyebrow: 'Reklam Yönetimi', title: 'Tüm Reklam Platformların Tek Panelde' },
    en: { eyebrow: 'Ad Management', title: 'All Your Ad Platforms in One Panel' },
    feats: [
      { slug: 'meta', icon: 'meta', tr: { name: 'Meta', desc: 'Facebook, Instagram ve WhatsApp kampanyalarını yapay zekâ destekli kurulumla tek panelden başlat ve yönet.' }, en: { name: 'Meta', desc: 'Launch and manage Facebook, Instagram and WhatsApp campaigns from one panel with AI-guided setup.' } },
      { slug: 'google', icon: 'google', tr: { name: 'Google', desc: 'Google Ads ve YouTube reklamlarını Arama, Görüntülü ve Performance Max dahil tek yerden kontrol et.' }, en: { name: 'Google', desc: 'Control Google Ads and YouTube — Search, Display and Performance Max — from a single place.' } },
      { slug: 'tiktok', icon: 'tiktok', soon: true, tr: { name: 'TikTok', desc: 'TikTok reklamları çok yakında aynı panele entegre oluyor.' }, en: { name: 'TikTok', desc: 'TikTok ads are coming soon to the same panel.' } },
    ],
  },
  {
    id: 'ai', layout: 'carousel',
    tr: { eyebrow: 'Yapay Zeka ve Strateji', title: 'DijiMagic, Reklamlarını Senin Yerine Düşünür' },
    en: { eyebrow: 'AI and Strategy', title: 'DijiMagic Thinks Your Ads Through for You' },
    feats: [
      { slug: 'strateji', icon: 'target', tr: { name: 'Strateji', desc: 'Yapay zekâ; siteni, sosyal medyanı ve ürünlerini inceleyip sana özel bir reklam stratejisi kurar.' }, en: { name: 'Strategy', desc: 'AI reviews your site, social media and products to build an ad strategy tailored to you.' } },
      { slug: 'optimizasyon', icon: 'trending', tr: { name: 'Optimizasyon', desc: 'Her reklamın getirisini anlık izler; düşük performanslıyı kısar, yüksek dönüşümlüye bütçe ekler.' }, en: { name: 'Optimization', desc: 'Tracks each ad\'s return in real time — trims low performers and scales high converters.' } },
      { slug: 'dijialgoritma', icon: 'sparkle', tr: { name: 'DijiAlgoritma', desc: 'İşletmene özel yapay zekâ asistanı; sorularını yanıtlar, içerik üretir ve büyüme önerir.' }, en: { name: 'DijiAlgorithm', desc: 'A business-specific AI assistant that answers questions, creates content and suggests growth.' } },
      { slug: 'hedef-kitle', icon: 'users', tr: { name: 'Hedef Kitle', desc: 'Yüksek değerli segmentleri keşfet, benzer kitleler oluştur, hedeflemeyi makine öğrenmesiyle keskinleştir.' }, en: { name: 'Target Audience', desc: 'Discover high-value segments, build lookalikes and sharpen targeting with machine learning.' } },
    ],
  },
  {
    id: 'icerik', layout: 'rows',
    tr: { eyebrow: 'İçerik ve Üretim', title: 'Kreatiften Siteye, Üretim Saniyeler İçinde' },
    en: { eyebrow: 'Content and Creation', title: 'From Creatives to Your Site, in Seconds' },
    feats: [
      { slug: 'tasarim', icon: 'image',
        tr: { name: 'Tasarım', desc: 'Markanın rengini, tonunu ve ürünlerini öğrenen yapay zekâ, saniyeler içinde reklama hazır görseller üretir. Arka planı temizler, başlığı yazar ve her platformun ölçüsüne göre dışa aktarır.' },
        en: { name: 'Design', desc: 'AI that learns your brand colors, tone and products generates ad-ready visuals in seconds. It cleans up backgrounds, writes the headline and exports to each platform\'s exact size.' },
        points: { tr: ['Marka kimliğine uygun sınırsız varyasyon', 'Otomatik arka plan temizleme ve düzen', 'Meta ve Google ölçülerine tek tıkla dışa aktarım'], en: ['Unlimited on-brand variations', 'Automatic background removal and layout', 'One-click export to Meta and Google sizes'] } },
      { slug: 'sosyal-medya', icon: 'share',
        tr: { name: 'Sosyal Medya', desc: 'Tüm sosyal hesaplarını tek panele bağla; gönderilerini planla, takvimle ve yayınla. İçerik fikirlerini yapay zekâyla üret, kitlenin en aktif olduğu saatte otomatik paylaş.' },
        en: { name: 'Social Media', desc: 'Connect all your social accounts to one panel; plan, schedule and publish your posts. Generate content ideas with AI and auto-post when your audience is most active.' },
        points: { tr: ['Instagram, Facebook ve daha fazlası tek yerde', 'Sürükle-bırak içerik takvimi', 'En iyi saatte otomatik paylaşım'], en: ['Instagram, Facebook and more in one place', 'Drag-and-drop content calendar', 'Auto-publish at the optimal time'] } },
      { slug: 'seo-plus', icon: 'search',
        tr: { name: 'SEO Plus', desc: 'Sitenin arama performansını derinlemesine tarar; teknik hataları, eksik anahtar kelimeleri ve rakip boşluklarını ortaya çıkarır. SEO odaklı içerikle sıralamada seni yukarı taşır.' },
        en: { name: 'SEO Plus', desc: 'Deeply scans your site\'s search performance; surfaces technical errors, missing keywords and competitor gaps. Moves you up the rankings with SEO-focused content.' },
        points: { tr: ['Teknik SEO ve site hızı analizi', 'Anahtar kelime ve rakip boşluğu tespiti', 'SEO uyumlu içerik önerileri'], en: ['Technical SEO and site-speed analysis', 'Keyword and competitor gap detection', 'SEO-ready content suggestions'] } },
      { slug: 'web-site-yoneticisi', icon: 'globe',
        tr: { name: 'Web Site Yöneticisi', desc: 'İşletmen için modern bir web sitesini kod yazmadan oluştur. Yapay zekâ içeriği ve düzeni hazırlar; sen ince ayar yapar, tek tıkla yayına alırsın.' },
        en: { name: 'Website Manager', desc: 'Build a modern website for your business without writing code. AI drafts the content and layout; you fine-tune it and publish in one click.' },
        points: { tr: ['Hazır, mobil uyumlu şablonlar', 'Yapay zekâ ile içerik ve düzen', 'Tek tıkla yayın ve güncelleme'], en: ['Ready, mobile-friendly templates', 'AI-generated content and layout', 'One-click publish and update'] } },
    ],
  },
  {
    id: 'yonetim', layout: 'bento',
    tr: { eyebrow: 'Yönetim ve Büyüme', title: 'Müşteriden Rapora, Büyümeyi Tek Yerden Yönet' },
    en: { eyebrow: 'Management and Growth', title: 'From Customers to Reports, Manage Growth in One Place' },
    feats: [
      { slug: 'raporlar', icon: 'chart', tr: { name: 'Raporlar', desc: 'Meta ve Google performansını birleşik panoda izle; zamanlanmış, otomatik raporlar al.' }, en: { name: 'Reports', desc: 'Track Meta and Google performance in a unified dashboard; receive scheduled, automated reports.' } },
      { slug: 'crm-sistemi', icon: 'crm', tr: { name: 'CRM Sistemi', desc: 'Müşteri ilişkilerini ve lead\'lerini tek yerden takip et, satış sürecini uçtan uca yönet.' }, en: { name: 'CRM System', desc: 'Track customer relationships and leads in one place; manage your sales pipeline end to end.' } },
      { slug: 'email-marketing', icon: 'mail', tr: { name: 'Email Marketing', desc: 'E-posta kampanyaları ve otomasyonlarıyla müşterilerinle bağını güçlendir.' }, en: { name: 'Email Marketing', desc: 'Strengthen ties with your customers through email campaigns and automations.' } },
      { slug: 'entegrasyon', icon: 'plug', tr: { name: 'Entegrasyon', desc: 'Meta, Google, Google Analytics, Search Console ve daha fazlasını tek noktadan bağla.' }, en: { name: 'Integration', desc: 'Connect Meta, Google, Google Analytics, Search Console and more from a single hub.' } },
    ],
  },
]

function SoonBadge({ label }: { label: string }) {
  return <span className="text-[10.5px] font-semibold uppercase tracking-wide text-emerald-300 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">{label}</span>
}
function IconBox({ name, size = 22, big = false }: { name: string; size?: number; big?: boolean }) {
  return (
    <div className={`shrink-0 ${big ? 'w-14 h-14' : 'w-12 h-12'} rounded-xl bg-gradient-to-br from-emerald-400/[0.14] to-teal-400/[0.06] border border-emerald-400/20 flex items-center justify-center text-emerald-400`}>
      <Icon name={name} size={size} />
    </div>
  )
}

/* Soldan sağa KESİNTİSİZ döngü (seamless marquee) — kartlar duplike, CSS ile %50 kayar; hover'da durur */
function Carousel({ feats, isEn, soonLabel }: { feats: Feat[]; isEn: boolean; soonLabel: string }) {
  const items = [...feats, ...feats]
  return (
    <div className="feat-marquee-wrap relative overflow-hidden -mx-5 md:-mx-8">
      <div className="feat-marquee flex w-max">
        {items.map((f, i) => (
          <div
            key={i}
            {...(i < feats.length ? { id: f.slug } : {})}
            aria-hidden={i >= feats.length}
            className="shrink-0 w-[280px] sm:w-[320px] mr-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <IconBox name={f.icon} />
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="text-lg font-semibold text-white truncate">{isEn ? f.en.name : f.tr.name}</h3>
                {f.soon && <SoonBadge label={soonLabel} />}
              </div>
            </div>
            <p className="text-[15px] text-gray-300/90 leading-relaxed">{isEn ? f.en.desc : f.tr.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function FeatureTabs({ isEn, soonLabel }: { isEn: boolean; soonLabel: string }) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const hash = decodeURIComponent((typeof window !== 'undefined' ? window.location.hash : '').replace('#', ''))
    if (!hash) return
    const gi = GROUPS.findIndex((g) => g.id === hash || g.feats.some((f) => f.slug === hash))
    if (gi >= 0) {
      setActive(gi)
      window.setTimeout(() => {
        const el = document.getElementById(hash)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 160)
    }
  }, [])

  const g = GROUPS[active]
  const nm = (f: Feat) => (isEn ? f.en.name : f.tr.name)
  const ds = (f: Feat) => (isEn ? f.en.desc : f.tr.desc)

  return (
    <section className="relative w-full px-6 pt-3 pb-9 md:pb-12">
      <div className="max-w-6xl mx-auto">
        {/* Toggle pill — aşağıdaki içerik kutusunun ÜST kenarına biner (iyzads gibi birleşik) */}
        <div className="relative z-10 flex justify-center -mb-6">
          <div className="inline-flex flex-wrap justify-center gap-1 p-1.5 rounded-full border border-white/[0.08] bg-[#1b212c] shadow-[0_12px_34px_-12px_rgba(0,0,0,0.7)]">
            {GROUPS.map((gr, i) => (
              <button
                key={gr.id}
                onClick={() => setActive(i)}
                aria-pressed={active === i}
                className={`px-4 py-2 rounded-full text-[13.5px] transition-all duration-200 ${active === i
                  ? 'bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-400/30 shadow-[0_0_18px_-6px_rgba(16,185,129,0.5)]'
                  : 'text-gray-400 hover:text-white font-medium border border-transparent'}`}
              >
                {isEn ? gr.en.eyebrow : gr.tr.eyebrow}
              </button>
            ))}
          </div>
        </div>

        {/* İçerik sahnesi — toggle bunun üst kenarına biner */}
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.015] px-5 md:px-8 pt-14 pb-8 md:pt-16 md:pb-10 overflow-hidden">
          <div key={active} className="feat-tab-enter">
            <div className="mb-6 md:mb-8 text-center">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-emerald-400/80 mb-2.5">{isEn ? g.en.eyebrow : g.tr.eyebrow}</p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white max-w-3xl mx-auto">{isEn ? g.en.title : g.tr.title}</h2>
          </div>

          {/* ── CARDS (Reklam) — 3 büyük platform kartı ── */}
          {g.layout === 'cards' && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {g.feats.map((f) => (
                <div key={f.slug} id={f.slug} className="group relative scroll-mt-32 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 md:p-7 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/25 hover:bg-white/[0.04] hover:shadow-[0_10px_44px_-14px_rgba(16,185,129,0.22)]">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="mb-4 group-hover:shadow-[0_0_22px_rgba(16,185,129,0.18)] w-fit rounded-xl transition-all"><IconBox name={f.icon} big /></div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-white">{nm(f)}</h3>
                    {f.soon && <SoonBadge label={soonLabel} />}
                  </div>
                  <p className="text-[15px] text-gray-300/90 leading-relaxed">{ds(f)}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── CAROUSEL (AI) — otomatik kayan kartlar ── */}
          {g.layout === 'carousel' && <Carousel feats={g.feats} isEn={isEn} soonLabel={soonLabel} />}

          {/* ── ROWS (İçerik) — dönüşümlü metin / animasyonlu görsel ── */}
          {g.layout === 'rows' && (
            <div className="space-y-10 md:space-y-14">
              {g.feats.map((f, i) => (
                <div key={f.slug} id={f.slug} className="grid md:grid-cols-2 gap-6 md:gap-12 items-center scroll-mt-32">
                  <div className={i % 2 === 1 ? 'md:order-2' : ''}>
                    <div className="flex items-center gap-3 mb-3">
                      <IconBox name={f.icon} big />
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-xl md:text-2xl font-bold text-white">{nm(f)}</h3>
                        {f.soon && <SoonBadge label={soonLabel} />}
                      </div>
                    </div>
                    <p className="text-[15px] md:text-base text-gray-300/90 leading-relaxed max-w-md mb-4">{ds(f)}</p>
                    {f.points && (
                      <ul className="space-y-2.5 max-w-md">
                        {(isEn ? f.points.en : f.points.tr).map((p, pi) => (
                          <li key={pi} className="flex items-start gap-2.5 text-[14px] text-gray-300/85">
                            <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-emerald-400/15 border border-emerald-400/30 flex items-center justify-center">
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgb(110,231,183)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12" /></svg>
                            </span>
                            {p}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className={i % 2 === 1 ? 'md:order-1' : ''}>
                    <FeatureVisual slug={f.slug} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── BENTO (Yönetim) — asimetrik ızgara ── */}
          {g.layout === 'bento' && (
            <div className="grid md:grid-cols-3 gap-4 md:gap-5">
              {g.feats.map((f, i) => {
                const span = i === 0 || i === 3 ? 'md:col-span-2' : 'md:col-span-1'
                return (
                  <div key={f.slug} id={f.slug} className={`group relative scroll-mt-32 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 md:p-7 transition-all duration-300 hover:border-emerald-400/25 hover:bg-white/[0.04] hover:shadow-[0_10px_44px_-14px_rgba(16,185,129,0.2)] ${span}`}>
                    <div className="flex items-start gap-4">
                      <IconBox name={f.icon} big={i === 0 || i === 3} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h3 className="text-lg font-semibold text-white">{nm(f)}</h3>
                          {f.soon && <SoonBadge label={soonLabel} />}
                        </div>
                        <p className="text-[15px] text-gray-300/90 leading-relaxed">{ds(f)}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          </div>
        </div>
      </div>
    </section>
  )
}
