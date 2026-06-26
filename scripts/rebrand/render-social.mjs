// DijiMagic sosyal/marka görselleri:
//   github-social-1280x640.png  → GitHub repo "Social preview" (Settings → General)
//   vercel-avatar-1024.png      → Vercel proje/takım avatarı
// Koyu marka zemini + logo (beyaz Diji / camgöbeği-teal Magic) + sparkle.
import sharp from 'sharp'
const DESK = '/Users/onursuay/Desktop'

const GRAD = `
<linearGradient id="magic" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#34E0C4"/><stop offset="1" stop-color="#2FBF9B"/></linearGradient>
<linearGradient id="star" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34E0C4"/><stop offset="1" stop-color="#2BB673"/></linearGradient>
<radialGradient id="glow" cx="0.5" cy="0.40" r="0.55"><stop offset="0" stop-color="#2BB673" stop-opacity="0.20"/><stop offset="1" stop-color="#2BB673" stop-opacity="0"/></radialGradient>
<radialGradient id="vig" cx="0.5" cy="0.32" r="0.95"><stop offset="0" stop-color="#0E1626"/><stop offset="1" stop-color="#060609"/></radialGradient>`

function spark(cx, cy, R, fill, k = 0.30) {
  const o = k * R
  return `<path transform="translate(${cx},${cy})" fill="${fill}" d="M0,${-R} C${o},${-o} ${o},${-o} ${R},0 C${o},${o} ${o},${o} 0,${R} C${-o},${o} ${-o},${o} ${-R},0 C${-o},${-o} ${-o},${-o} 0,${-R} Z"/>`
}

// --- GitHub social 1280×640 ---
const banner = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="640" viewBox="0 0 1280 640"><defs>${GRAD}</defs>
<rect width="1280" height="640" fill="url(#vig)"/>
<rect width="1280" height="640" fill="url(#glow)"/>
<text x="628" y="338" text-anchor="middle" font-family="Montserrat, Arial" font-size="132" letter-spacing="-5"><tspan font-weight="600" fill="#FFFFFF">Diji</tspan><tspan font-weight="800" fill="url(#magic)">Magic</tspan></text>
${spark(908, 248, 32, 'url(#star)')}
${spark(951, 291, 16, 'url(#star)')}
<text x="640" y="430" text-anchor="middle" font-family="Montserrat, Arial" font-size="30" letter-spacing="1" font-weight="500" fill="#94A3B8">Reklam ve pazarlama yönetim platformu</text>
</svg>`

// --- Vercel avatar 1024 (kare, istiflenmiş wordmark) ---
const avatar = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs>${GRAD}</defs>
<rect width="1024" height="1024" fill="#0B1220"/>
<rect width="1024" height="1024" fill="url(#glow)"/>
<text x="512" y="452" text-anchor="middle" font-family="Montserrat, Arial" font-size="300" letter-spacing="-14" font-weight="600" fill="#FFFFFF">Diji</text>
<text x="512" y="784" text-anchor="middle" font-family="Montserrat, Arial" font-size="300" letter-spacing="-14" font-weight="800" fill="url(#magic)">Magic</text>
${spark(796, 236, 60, 'url(#star)')}
</svg>`

await sharp(Buffer.from(banner), { density: 96 }).png().toFile(`${DESK}/github-social-1280x640.png`)
await sharp(Buffer.from(avatar), { density: 96 }).png().toFile(`${DESK}/vercel-avatar-1024.png`)
console.log('social OK → github-social-1280x640.png + vercel-avatar-1024.png')
