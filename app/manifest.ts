import type { MetadataRoute } from 'next'

// PWA manifest — Next.js bunu /manifest.webmanifest olarak servis eder ve
// <link rel="manifest"> etiketini otomatik ekler. Favicon seti app/icon.png +
// app/favicon.ico + app/apple-icon.png ile konvansiyon üzerinden bağlanır.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DijiMagic',
    short_name: 'DijiMagic',
    description: 'Reklam ve pazarlama yönetim platformu',
    start_url: '/',
    display: 'standalone',
    background_color: '#13181f',
    theme_color: '#0B1220',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
