import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
const __dirname = dirname(fileURLToPath(import.meta.url))

const staticExport = process.env.STATIC_EXPORT === '1'

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(staticExport ? { output: 'export' } : {}),
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    // motion-utils ESM files are iCloud-evicted; redirect to working CJS build
    config.resolve.alias['motion-utils'] = join(__dirname, 'node_modules/motion-utils/dist/cjs/index.js')
    return config
  },
}

export default nextConfig
