import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n.ts')

const nextConfig = {
  productionBrowserSourceMaps: process.env.NEXT_PUBLIC_DEBUG_SOURCEMAPS === '1',
  experimental: {
    turbo: {},
    serverActions: {
      bodySizeLimit: '50mb',
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
          "style-src 'self' 'unsafe-inline'",
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
