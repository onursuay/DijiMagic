// DijiMagic favicon — MEVCUT LOGO uyarlaması: istiflenmiş "Diji" / "Magic".
// Yuvarlak/kare favicon alanına sığsın diye wordmark iki satıra alınır.
// 3 zemin varyantı × [daire 512, kare 512, 32px@açık, 32px@koyu, 16px@koyu] kontak sayfası.
import sharp from 'sharp'

const DESK = '/Users/onursuay/Desktop'
const S = 512

const DEFS = `
<linearGradient id="magic" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2BB673"/><stop offset="1" stop-color="#2FBF9B"/></linearGradient>
<linearGradient id="magicBright" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#34E0C4"/><stop offset="1" stop-color="#2FBF9B"/></linearGradient>
<linearGradient id="star" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34E0C4"/><stop offset="1" stop-color="#2BB673"/></linearGradient>
<linearGradient id="greenbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2FBF9B"/><stop offset="1" stop-color="#1F9D63"/></linearGradient>`

function spark(cx, cy, R, fill, k = 0.30) {
  const o = k * R
  return `<path transform="translate(${cx},${cy})" fill="${fill}" d="M0,${-R} C${o},${-o} ${o},${-o} ${R},0 C${o},${o} ${o},${o} 0,${R} C${-o},${o} ${-o},${o} ${-R},0 C${-o},${-o} ${-o},${-o} 0,${-R} Z"/>`
}

// istiflenmiş wordmark — diji üst, magic alt
function stack(dijiFill, magicFill, withSpark) {
  const FS = 150, LS = -7
  return `
<text x="256" y="226" text-anchor="middle" font-family="Montserrat, Arial" font-size="${FS}" letter-spacing="${LS}" font-weight="600" fill="${dijiFill}">Diji</text>
<text x="256" y="392" text-anchor="middle" font-family="Montserrat, Arial" font-size="${FS}" letter-spacing="${LS}" font-weight="800" fill="${magicFill}">Magic</text>
${withSpark ? spark(398, 118, 30, 'url(#star)') : ''}`
}

const frame = (bg, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><defs>${DEFS}</defs>${bg}${inner}</svg>`

const circle = (fill) => `<circle cx="256" cy="256" r="256" fill="${fill}"/>`
const square = (fill) => `<rect width="${S}" height="${S}" fill="${fill}"/>`

// 3 varyant: [daire-bg, kare-bg, dijiFill, magicFill, sparkle?]
const variants = [
  { name: 'koyu',  cbg: circle('#0B1220'),       sbg: square('#0B1220'),       diji: '#FFFFFF', magic: 'url(#magicBright)', sp: true  },
  { name: 'yesil', cbg: circle('url(#greenbg)'), sbg: square('url(#greenbg)'), diji: '#FFFFFF', magic: '#FFFFFF',           sp: false },
  { name: 'acik',  cbg: circle('#FFFFFF'),       sbg: square('#F3F4F6'),       diji: '#0B1220', magic: 'url(#magic)',       sp: true  },
]

const png = (svg, size) => sharp(Buffer.from(svg), { density: 160 }).resize(size, size).png().toBuffer()

const CELLT = 20, COL = [20, 300, 580, 720, 860], ROWH = 300
const comp = []
for (let i = 0; i < variants.length; i++) {
  const v = variants[i]
  const circSvg = frame(v.cbg, stack(v.diji, v.magic, v.sp))
  const sqSvg = frame(v.sbg, stack(v.diji, v.magic, v.sp))
  const top = CELLT + i * ROWH
  comp.push({ input: await sharp(await png(circSvg, 512)).resize(260, 260).toBuffer(), top, left: COL[0] })
  comp.push({ input: await sharp(await png(sqSvg, 512)).resize(260, 260).toBuffer(), top, left: COL[1] })
  // küçük örnekler (daireden)
  const circBuf = await png(circSvg, 512)
  for (const [ci, sz, bg] of [[2, 32, '#FFFFFF'], [3, 32, '#1B1F2A'], [4, 16, '#1B1F2A']]) {
    const sm = await sharp(circBuf).resize(sz, sz).toBuffer()
    const up = await sharp(sm).resize(130, 130, { kernel: 'nearest' }).toBuffer()
    const cell = await sharp({ create: { width: 140, height: 140, channels: 3, background: bg } }).composite([{ input: up, gravity: 'center' }]).png().toBuffer()
    comp.push({ input: cell, top: top + 60, left: COL[ci] })
  }
}
await sharp({ create: { width: 1020, height: CELLT * 2 + variants.length * ROWH, channels: 3, background: '#E7EBEF' } })
  .composite(comp).png().toFile(`${DESK}/DijiMagic-favicon-wordmark.png`)

console.log('wordmark favicon concepts OK → DijiMagic-favicon-wordmark.png')
