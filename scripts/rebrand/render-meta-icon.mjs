import sharp from 'sharp'
function sparkle(cx,cy,R,fill){const k=0.28*R;return `<path transform="translate(${cx},${cy})" fill="${fill}" d="M0,${-R} C${k},${-k} ${k},${-k} ${R},0 C${k},${k} ${k},${k} 0,${R} C${-k},${k} ${-k},${k} ${-R},0 C${-k},${-k} ${-k},${-k} 0,${-R} Z"/>`}
// Meta App icon: 1024 kare, tam-dolu gradient (şeffaf köşe yok) + beyaz D + sparkle
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#34D39E"/><stop offset="0.55" stop-color="#2BB673"/><stop offset="1" stop-color="#1E9E63"/></linearGradient></defs>
<rect width="1024" height="1024" rx="180" fill="url(#g)"/>
<text x="504" y="720" text-anchor="middle" font-family="Montserrat, Arial" font-weight="800" font-size="620" fill="#FFFFFF">D</text>
${sparkle(748,312,84,'#FFFFFF')}
${sparkle(836,396,36,'#FFFFFF')}
</svg>`
await sharp(Buffer.from(svg)).png().toFile('/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/public/logos/dijimagic-meta-icon.png')
const S='/private/tmp/claude-501/-Users-onursuay-Desktop-Onur-Suay-Web-Siteleri-YoAi-Project/eab820cd-8b57-492a-8ae5-3220f6626ed1/scratchpad'
await sharp('/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/public/logos/dijimagic-meta-icon.png').resize({width:200}).toFile(S+'/meta-icon-preview.png')
console.log('meta icon OK (1024x1024 kare)')
