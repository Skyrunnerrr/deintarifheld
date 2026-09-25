import { nextConfigApiHeaders, nextConfigInboxHeaders } from './lib/leads/security-headers.js'
import { assertProductionApiEnv } from './lib/leads/production-env-preflight.js'

const staticExport = process.env.STATIC_EXPORT === '1'

if (!staticExport && process.env.VERCEL_ENV === 'production') {
  assertProductionApiEnv(process.env)
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(staticExport ? { output: 'export' } : {}),
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  async headers() {
    if (staticExport) return []
    return [
      {
        source: '/api/:path*',
        headers: nextConfigApiHeaders(),
      },
      {
        source: '/api/admin/inbox',
        headers: nextConfigInboxHeaders(),
      },
      {
        source: '/api/admin/inbox/',
        headers: nextConfigInboxHeaders(),
      },
    ]
  },
}

export default nextConfig
