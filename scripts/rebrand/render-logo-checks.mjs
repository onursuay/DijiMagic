import sharp from 'sharp'
const S='/private/tmp/claude-501/-Users-onursuay-Desktop-Onur-Suay-Web-Siteleri-YoAi-Project/eab820cd-8b57-492a-8ae5-3220f6626ed1/scratchpad'
// Header mock: koyu bar (lacivert) + logoyu ~150px genişlikte yerleştir (gerçek header ölçeği)
const logo = await sharp(S+'/logo-white-on-dark.png').resize({width:150}).png().toBuffer()
const meta = await sharp(logo).metadata()
await sharp({create:{width:900,height:72,channels:4,background:'#0B1220'}})
  .composite([{input:logo, top:Math.round((72-meta.height)/2), left:28}])
  .png().toFile(S+'/logo-header-mock.png')
console.log('header mock OK', meta.width, 'x', meta.height)
