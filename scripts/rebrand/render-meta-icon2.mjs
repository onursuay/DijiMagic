import sharp from 'sharp'
function sparkle(cx,cy,R,fill){const k=0.28*R;return `<path transform="translate(${cx},${cy})" fill="${fill}" d="M0,${-R} C${k},${-k} ${k},${-k} ${R},0 C${k},${k} ${k},${k} 0,${R} C${-k},${k} ${-k},${k} ${-R},0 C${-k},${-k} ${-k},${-k} 0,${-R} Z"/>`}
const grad=`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34D39E"/><stop offset="0.55" stop-color="#2BB673"/><stop offset="1" stop-color="#1E9E63"/></linearGradient></defs>`
const stacked=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${grad}
<rect width="1024" height="1024" rx="180" fill="url(#g)"/>
<text x="512" y="500" text-anchor="middle" font-family="Montserrat, Arial" font-weight="500" font-size="248" letter-spacing="-6" fill="#FFFFFF">Diji</text>
<text x="500" y="760" text-anchor="middle" font-family="Montserrat, Arial" font-weight="800" font-size="248" letter-spacing="-8" fill="#FFFFFF">Magic</text>
${sparkle(842,205,60,'#FFFFFF')}${sparkle(905,262,26,'#FFFFFF')}
</svg>`
const OUT='/private/tmp/claude-501/-Users-onursuay-Desktop-Onur-Suay-Web-Siteleri-YoAi-Project/eab820cd-8b57-492a-8ae5-3220f6626ed1/scratchpad'
await sharp(Buffer.from(stacked)).png().toFile(OUT+'/icon-stacked.png')
console.log('stacked v2 OK')
