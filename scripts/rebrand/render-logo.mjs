// DijiMagic logo render — Montserrat (Diji=Medium, Magic=Bold) + magic sparkle, monokrom.
import sharp from 'sharp'
import { resolve } from 'path'

const OUT = '/private/tmp/claude-501/-Users-onursuay-Desktop-Onur-Suay-Web-Siteleri-YoAi-Project/eab820cd-8b57-492a-8ae5-3220f6626ed1/scratchpad'
const W = 1100, H = 340

// 4-uçlu içbükey sparkle (origin merkezli, R yarıçap)
function sparkle(cx, cy, R, fill) {
  const k = 0.28 * R
  return `<path transform="translate(${cx},${cy})" fill="${fill}" d="M0,${-R} C${k},${-k} ${k},${-k} ${R},0 C${k},${k} ${k},${k} 0,${R} C${-k},${k} ${-k},${k} ${-R},0 C${-k},${-k} ${-k},${-k} 0,${-R} Z"/>`
}

function svg(fill, withBg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${withBg ? `<rect width="${W}" height="${H}" fill="#0B1220"/>` : ''}
<text x="510" y="232" text-anchor="middle" font-family="Montserrat, 'Avenir Next', Arial" font-size="184" letter-spacing="-4" fill="${fill}"><tspan font-weight="500">Diji</tspan><tspan font-weight="800">Magic</tspan></text>
${sparkle(958, 96, 46, fill)}
${sparkle(1012, 150, 22, fill)}
</svg>`
}

await sharp(Buffer.from(svg('#0B1220', true /*on light? no, show on light*/ ? false : false))).png()
  .flatten({ background: '#F3F4F6' }).toFile(resolve(OUT, 'logo-dark-on-light.png'))
await sharp(Buffer.from(svg('#FFFFFF', true))).png().toFile(resolve(OUT, 'logo-white-on-dark.png'))
console.log('render OK: logo-dark-on-light.png + logo-white-on-dark.png')
