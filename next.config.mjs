import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n.ts')

const nextConfig = {
  productionBrowserSourceMaps: process.env.NEXT_PUBLIC_DEBUG_SOURCEMAPS === '1',
  experimental: {
    turbo: {},
    serverActions: {
      bodySizeLimit: '50mb',
    },
    // Web Site Yöneticisi codegen/serve modülleri (renderGate / assembleDocument /
    // tailwindCompile .mjs) bu CommonJS paketlerini server'da kullanır. Next bunları
    // BUNDLE ETMEZ; lambda'ya node_modules'tan DAHİL eder → import runtime'da çözülür.
    // Bu olmadan tracer paketleri atlıyordu → Vercel'de "Cannot find module" → 500.
    serverComponentsExternalPackages: ['sanitize-html', 'tailwindcss', 'postcss', 'autoprefixer', '@daytona/sdk'],
    outputFileTracingIncludes: {
      '/api/inngest': ['./lib/website/codegen/agentic/**/*.mjs', './lib/website/codegen/renderGate.mjs', './lib/website/codegen/sanitizeAllowlist.mjs', './lib/website/codegen/tailwindCompile.mjs'],
    },
  },
  async headers() {
    return [{
      source: '/s/:path*',
      headers: [{
        key: 'Content-Security-Policy',
        value: [
          "default-src 'none'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "img-src 'self' https: data:",
          "font-src https://fonts.gstatic.com",
          "connect-src 'self'",
          "frame-ancestors 'self'",
          "base-uri 'none'",
          "form-action 'self'",
        ].join('; '),
      }],
    }]
  },
}

export default withNextIntl(nextConfig)
