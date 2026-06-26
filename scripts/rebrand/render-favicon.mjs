// DijiMagic favicon — MEVCUT LOGO uyarlaması: istiflenmiş "Diji"/"Magic", KOYU zemin.
// (Owner seçimi: mevcut logoya en sadık koyu varyant — beyaz Diji, camgöbeği-teal Magic, köşe yıldız.)
// Tam set:
//   app/icon.png            512  daire (şeffaf köşe)            → tarayıcı sekmesi
//   app/favicon.ico         16/32/48 paket (bağımlılıksız ICO)  → universal/legacy
//   app/apple-icon.png      180  tam-dolu kare (iOS yuvarlar)
//   public/icons/icon-192.png, icon-512.png   PWA "any" (tam-dolu kare)
//   public/icons/icon-maskable-512.png        PWA maskable (güvenli bölge)
import sharp from 'sharp'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const APP = resolve(ROOT, 'app')
const ICONS = resolve(ROOT, 'public/icons')
const DESK = '/Users/onursuay/Desktop'
const S = 512
const BG = '#0B1220'

const DEFS = `
<linearGradient id="magic" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#34E0C4"/><stop offset="1" stop-color="#2FBF9B"/></linearGradient>
<linearGradient id="star" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34E0C4"/><stop offset="1" stop-color="#2BB673"/></linearGradient>`

function spark(cx, cy, R, fill, k = 0.30) {
  const o = k * R
  return `<path transform="translate(${cx},${cy})" fill="${fill}" d="M0,${-R} C${o},${-o} ${o},${-o} ${R},0 C${o},${o} ${o},${o} 0,${R} C${-o},${o} ${-o},${o} ${-R},0 C${-o},${-o} ${-o},${-o} 0,${-R} Z"/>`
}

// istiflenmiş wordmark + köşe yıldız (merkez 256,256 etrafında ölçeklenebilir)
function content(scale = 1) {
  const inner = `
<text x="256" y="226" text-anchor="middle" font-family="Montserrat, Arial" font-size="150" letter-spacing="-7" font-weight="600" fill="#FFFFFF">Diji</text>
<text x="256" y="392" text-anchor="middle" font-family="Montserrat, Arial" font-size="150" letter-spacing="-7" font-weight="800" fill="url(#magic)">Magic</text>
${spark(398, 118, 30, 'url(#star)')}`
  return scale === 1 ? inner : `<g transform="translate(256,256) scale(${scale}) translate(-256,-256)">${inner}</g>`
}

const frame = (bg, scale = 1) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><defs>${DEFS}</defs>${bg}${content(scale)}</svg>`

const circleSvg = frame(`<circle cx="256" cy="256" r="256" fill="${BG}"/>`)            // şeffaf köşe
const squareSvg = frame(`<rect width="${S}" height="${S}" fill="${BG}"/>`)             // tam-dolu
const maskableSvg = frame(`<rect width="${S}" height="${S}" fill="${BG}"/>`, 0.80)     // güvenli bölge

const png = (svg, size) => sharp(Buffer.from(svg), { density: 160 }).resize(size, size).png().toBuffer()

// ICO encoder (PNG gömülü, bağımlılıksız)
function packIco(items) {
  const count = items.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(count, 4)
  const dirs = [], datas = []
  let offset = 6 + count * 16
  for (const { size, buf } of items) {
    const d = Buffer.alloc(16)
    d.writeUInt8(size >= 256 ? 0 : size, 0); d.writeUInt8(size >= 256 ? 0 : size, 1)
    d.writeUInt8(0, 2); d.writeUInt8(0, 3); d.writeUInt16LE(1, 4); d.writeUInt16LE(32, 6)
    d.writeUInt32LE(buf.length, 8); d.writeUInt32LE(offset, 12)
    offset += buf.length; dirs.push(d); datas.push(buf)
  }
  return Buffer.concat([header, ...dirs, ...datas])
}
const fs = await import('fs')

// 1) app/icon.png (daire)
await sharp(await png(circleSvg, S)).toFile(resolve(APP, 'icon.png'))
// 2) app/favicon.ico (16/32/48 daireden)
const i16 = await png(circleSvg, 16), i32 = await png(circleSvg, 32), i48 = await png(circleSvg, 48)
fs.writeFileSync(resolve(APP, 'favicon.ico'), packIco([{ size: 16, buf: i16 }, { size: 32, buf: i32 }, { size: 48, buf: i48 }]))
// 3) app/apple-icon.png (180 tam-dolu)
await sharp(await png(squareSvg, 180)).toFile(resolve(APP, 'apple-icon.png'))
// 4) PWA 192/512 (tam-dolu) + maskable
await sharp(await png(squareSvg, 192)).toFile(resolve(ICONS, 'icon-192.png'))
await sharp(await png(squareSvg, 512)).toFile(resolve(ICONS, 'icon-512.png'))
await sharp(await png(maskableSvg, 512)).toFile(resolve(ICONS, 'icon-maskable-512.png'))

// Doğrulama önizlemesi + masaüstü kopyası
const circ = await png(circleSvg, 512)
const comp = [{ input: await sharp(circ).resize(260, 260).toBuffer(), top: 20, left: 20 },
              { input: await sharp(await png(squareSvg, 512)).resize(260, 260).toBuffer(), top: 20, left: 300 },
              { input: await sharp(await png(maskableSvg, 512)).resize(260, 260).toBuffer(), top: 20, left: 580 }]
let lx = 20
for (const sz of [16, 32, 48]) {
  const up = await sharp(await sharp(circ).resize(sz, sz).toBuffer()).resize(120, 120, { kernel: 'nearest' }).toBuffer()
  comp.push({ input: await sharp({ create: { width: 130, height: 130, channels: 3, background: '#FFFFFF' } }).composite([{ input: up, gravity: 'center' }]).png().toBuffer(), top: 310, left: lx }); lx += 140
  comp.push({ input: await sharp({ create: { width: 130, height: 130, channels: 3, background: '#1B1F2A' } }).composite([{ input: up, gravity: 'center' }]).png().toBuffer(), top: 310, left: lx }); lx += 150
}
await sharp({ create: { width: 940, height: 460, channels: 3, background: '#E7EBEF' } }).composite(comp).png().toFile(`${DESK}/DijiMagic-favicon-onizleme.png`)
await sharp(circ).toFile(`${DESK}/DijiMagic-favicon.png`)
fs.copyFileSync(resolve(APP, 'favicon.ico'), `${DESK}/DijiMagic-favicon.ico`)

console.log('favicon (wordmark koyu) OK → app/icon.png, favicon.ico, apple-icon.png, public/icons/* + masaüstü önizleme')
