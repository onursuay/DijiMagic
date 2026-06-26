// DijiMagic logo render — Montserrat (Diji=Medium, Magic=Bold) + AI sparkle.
// "AI yeni nesil" renklendirme (2026-06-26): yıldızlar camgöbeği→yeşil gradyan,
// "Magic" yeşil→teal gradyan, "Diji" zemine göre nötr (koyu/beyaz).
// İki varyant üretir:
//   public/logos/dijimagic-logo.png        → açık zemin (Diji koyu)
//   public/logos/dijimagic-logo-light.png  → koyu zemin (Diji beyaz)
// Ayrıca scratchpad'e iki "proof" karesi (legibility doğrulaması) basar.
import sharp from 'sharp'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = resolve(ROOT, 'public/logos')
const PROOF = '/private/tmp/claude-501/-Users-onursuay-Desktop-Onur-Suay-Web-Siteleri-YoAi-Project/9faa2d86-aeb5-4072-a3a1-eb8d434ba660/scratchpad'

const W = 1100, H = 340
const DENSITY = 216 // ~3x crispness (≈3300px geniş)

// Marka renkleri
const STAR_FROM = '#34E0C4' // parlak camgöbeği
const STAR_TO = '#2BB673'   // marka yeşili
const MAGIC_FROM = '#2BB673'
const MAGIC_TO = '#2FBF9B'  // teal-yeşil (primary.light)

// 4-uçlu içbükey sparkle (origin merkezli, R yarıçap)
function sparkle(cx, cy, R, fill) {
  const k = 0.28 * R
  return `<path transform="translate(${cx},${cy})" fill="${fill}" d="M0,${-R} C${k},${-k} ${k},${-k} ${R},0 C${k},${k} ${k},${k} 0,${R} C${-k},${k} ${-k},${k} ${-R},0 C${-k},${-k} ${-k},${-k} 0,${-R} Z"/>`
}

function svg(dijiFill) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<linearGradient id="star" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${STAR_FROM}"/><stop offset="1" stop-color="${STAR_TO}"/>
</linearGradient>
<linearGradient id="magic" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="${MAGIC_FROM}"/><stop offset="1" stop-color="${MAGIC_TO}"/>
</linearGradient>
</defs>
<text x="510" y="232" text-anchor="middle" font-family="Montserrat, 'Avenir Next', Arial" font-size="184" letter-spacing="-4"><tspan font-weight="500" fill="${dijiFill}">Diji</tspan><tspan font-weight="800" fill="url(#magic)">Magic</tspan></text>
${sparkle(958, 96, 46, 'url(#star)')}
${sparkle(1012, 150, 22, 'url(#star)')}
</svg>`
}

const renderPng = (dijiFill) =>
  sharp(Buffer.from(svg(dijiFill)), { density: DENSITY }).png()

// 1) Gerçek varlıklar (şeffaf arka plan)
await renderPng('#0B1220').toFile(resolve(OUT, 'dijimagic-logo.png'))        // açık zemin
await renderPng('#FFFFFF').toFile(resolve(OUT, 'dijimagic-logo-light.png'))  // koyu zemin

// 2) Proof kareleri (yalnız doğrulama — uygulama kullanmaz)
await renderPng('#0B1220').flatten({ background: '#F3F4F6' })
  .toFile(resolve(PROOF, 'proof-on-light.png'))
await renderPng('#FFFFFF').flatten({ background: '#0B1220' })
  .toFile(resolve(PROOF, 'proof-on-dark.png'))

console.log('render OK → dijimagic-logo.png + dijimagic-logo-light.png (+ 2 proof)')
