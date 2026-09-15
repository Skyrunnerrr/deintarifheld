import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { nextConfigApiHeaders, nextConfigInboxHeaders } from './lib/leads/security-headers.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const staticExport = process.env.STATIC_EXPORT === '1'

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
  webpack: (config) => {
    // motion-utils ESM files are iCloud-evicted; redirect to working CJS build
    config.resolve.alias['motion-utils'] = join(__dirname, 'node_modules/motion-utils/dist/cjs/index.js')
    return config
  },
}

export default nextConfig
