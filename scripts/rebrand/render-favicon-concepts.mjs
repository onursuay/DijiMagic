// DijiMagic favicon konsept render — kare/yuvarlak-güvenli mark adayları.
// 4 konsep × [yuvarlatılmış kare 512, daire 512, 32px@açık, 32px@koyu] kontak sayfası.
import sharp from 'sharp'

const DESK = '/Users/onursuay/Desktop'
const S = 512

const GRAD = `
<linearGradient id="star" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34E0C4"/><stop offset="1" stop-color="#2BB673"/></linearGradient>
<linearGradient id="magic" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2BB673"/><stop offset="1" stop-color="#2FBF9B"/></linearGradient>
<linearGradient id="greenbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2FBF9B"/><stop offset="1" stop-color="#1F9D63"/></linearGradient>
<radialGradient id="glow" cx="0.5" cy="0.42" r="0.6"><stop offset="0" stop-color="#2BB673" stop-opacity="0.35"/><stop offset="1" stop-color="#2BB673" stop-opacity="0"/></radialGradient>`

function spark(cx, cy, R, fill, k = 0.30) {
  const o = k * R
  return `<path transform="translate(${cx},${cy})" fill="${fill}" d="M0,${-R} C${o},${-o} ${o},${-o} ${R},0 C${o},${o} ${o},${o} 0,${R} C${-o},${o} ${-o},${o} ${-R},0 C${-o},${-o} ${-o},${-o} 0,${-R} Z"/>`
}

const wrap = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><defs>${GRAD}</defs>${inner}</svg>`

// A — Yıldız işareti / koyu zemin (gradyan sparkle)
const A = wrap(`
<rect width="${S}" height="${S}" fill="#0B1220"/>
<circle cx="256" cy="246" r="240" fill="url(#glow)"/>
${spark(244, 272, 150, 'url(#star)')}
${spark(372, 150, 58, 'url(#star)')}`)

// A2 — Yıldız işareti / yeşil zemin (beyaz sparkle)
const A2 = wrap(`
<rect width="${S}" height="${S}" fill="url(#greenbg)"/>
${spark(244, 272, 150, '#FFFFFF')}
${spark(372, 150, 58, '#EAFBF4')}`)

// B — İstiflenmiş wordmark "Diji / Magic" / koyu zemin (senin fikrin)
const B = wrap(`
<rect width="${S}" height="${S}" fill="#0B1220"/>
<text x="256" y="232" text-anchor="middle" font-family="Montserrat, Arial" font-size="152" letter-spacing="-5" font-weight="500" fill="#FFFFFF">Diji</text>
<text x="256" y="392" text-anchor="middle" font-family="Montserrat, Arial" font-size="152" letter-spacing="-5" font-weight="800" fill="url(#magic)">Magic</text>`)

// C — "D" monogram + sparkle / yeşil zemin
const C = wrap(`
<rect width="${S}" height="${S}" fill="url(#greenbg)"/>
<text x="244" y="392" text-anchor="middle" font-family="Montserrat, Arial" font-size="392" letter-spacing="-8" font-weight="800" fill="#FFFFFF">D</text>
${spark(388, 150, 60, '#FFFFFF')}`)

const concepts = [A, A2, B, C]

// maskeler
const roundMask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><rect width="${S}" height="${S}" rx="112" ry="112" fill="#fff"/></svg>`)
const circMask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><circle cx="256" cy="256" r="256" fill="#fff"/></svg>`)

async function masked(svg, mask) {
  const base = await sharp(Buffer.from(svg), { density: 144 }).resize(S, S).png().toBuffer()
  return sharp(base).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
}

// Kontak sayfası
const CELL = 280, COLS = 4, ROWS = concepts.length
const PAD = 20, SHEETW = COLS * CELL, SHEETH = ROWS * CELL
const cells = []
for (let r = 0; r < ROWS; r++) {
  const round = await masked(concepts[r], roundMask)
  const circ = await masked(concepts[r], circMask)
  const big = 240
  const round240 = await sharp(round).resize(big, big).toBuffer()
  const circ240 = await sharp(circ).resize(big, big).toBuffer()
  // 32px gerçek favicon boyutu → 120'ye nearest upscale (pikselleşmeyi göster)
  const small32 = await sharp(circ).resize(32, 32).toBuffer()
  const small120 = await sharp(small32).resize(120, 120, { kernel: 'nearest' }).toBuffer()
  const onWhite = await sharp({ create: { width: big, height: big, channels: 3, background: '#FFFFFF' } })
    .composite([{ input: small120, gravity: 'center' }]).png().toBuffer()
  const onDark = await sharp({ create: { width: big, height: big, channels: 3, background: '#1B1F2A' } })
    .composite([{ input: small120, gravity: 'center' }]).png().toBuffer()
  const off = (PAD)
  cells.push({ input: round240, top: r * CELL + PAD, left: 0 * CELL + off })
  cells.push({ input: circ240, top: r * CELL + PAD, left: 1 * CELL + off })
  cells.push({ input: onWhite, top: r * CELL + PAD, left: 2 * CELL + off })
  cells.push({ input: onDark, top: r * CELL + PAD, left: 3 * CELL + off })
}
await sharp({ create: { width: SHEETW, height: SHEETH, channels: 3, background: '#EEF1F4' } })
  .composite(cells).png().toFile(`${DESK}/DijiMagic-favicon-konseptler.png`)

console.log('favicon concepts OK → DijiMagic-favicon-konseptler.png')
