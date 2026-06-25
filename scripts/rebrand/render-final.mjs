// Final DijiMagic logo (yatay wordmark, şeffaf, trimli) + kare favicon (app/icon.png).
import sharp from 'sharp'
import { resolve } from 'path'
const ROOT = process.cwd()

function sparkle(cx, cy, R, fill) {
  const k = 0.28 * R
  return `<path transform="translate(${cx},${cy})" fill="${fill}" d="M0,${-R} C${k},${-k} ${k},${-k} ${R},0 C${k},${k} ${k},${k} 0,${R} C${-k},${k} ${-k},${k} ${-R},0 C${-k},${-k} ${-k},${-k} 0,${-R} Z"/>`
}

// --- 1) Yatay wordmark (her yerde brightness-0 invert ile beyaz olur; fill=koyu lacivert) ---
const W = 1100, H = 340, FILL = '#0B1220'
const wordmark = `<svg xmlns="http://www.w3.org/2000/svg" width="${W*2}" height="${H*2}" viewBox="0 0 ${W} ${H}">
<text x="510" y="232" text-anchor="middle" font-family="Montserrat, 'Avenir Next', Arial" font-size="184" letter-spacing="-4" fill="${FILL}"><tspan font-weight="500">Diji</tspan><tspan font-weight="800">Magic</tspan></text>
${sparkle(958, 96, 46, FILL)}
${sparkle(1012, 150, 22, FILL)}
</svg>`
await sharp(Buffer.from(wordmark)).png()
  .trim({ threshold: 1 })
  .extend({ top: 24, bottom: 24, left: 24, right: 24, background: { r:0,g:0,b:0,alpha:0 } })
  .toFile(resolve(ROOT, 'public/logos/dijimagic-logo.png'))

// --- 2) Kare favicon: marka-yeşili gradient yuvarlak kare + beyaz "D" + sparkle ---
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#2FBF9B"/><stop offset="1" stop-color="#2BB673"/></linearGradient></defs>
<rect width="512" height="512" rx="116" fill="url(#g)"/>
<text x="248" y="372" text-anchor="middle" font-family="Montserrat, Arial" font-weight="800" font-size="360" fill="#FFFFFF">D</text>
${sparkle(392, 150, 46, '#FFFFFF')}
${sparkle(440, 196, 20, '#FFFFFF')}
</svg>`
await sharp(Buffer.from(icon)).png().toFile(resolve(ROOT, 'app/icon.png'))

// önizleme kopyaları
const S='/private/tmp/claude-501/-Users-onursuay-Desktop-Onur-Suay-Web-Siteleri-YoAi-Project/eab820cd-8b57-492a-8ae5-3220f6626ed1/scratchpad'
await sharp(resolve(ROOT,'public/logos/dijimagic-logo.png')).flatten({background:'#F3F4F6'}).resize({width:420}).toFile(S+'/final-logo-preview.png')
await sharp(resolve(ROOT,'app/icon.png')).resize({width:128}).toFile(S+'/final-icon-preview.png')
const m = await sharp(resolve(ROOT,'public/logos/dijimagic-logo.png')).metadata()
console.log('logo:', m.width+'x'+m.height, '(en-boy', (m.width/m.height).toFixed(2)+':1) | icon: 512x512')
