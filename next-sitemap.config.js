/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://www.deintarifheld.de',
  generateRobotsTxt: true,
  outDir: './out',
  trailingSlash: true,
  robotsTxtOptions: {
    policies: [
      { userAgent: '*', allow: '/', disallow: ['/api/'] },
    ],
    additionalSitemaps: [],
  },
  exclude: [
    '/agb', '/agb/',
    '/datenschutz', '/datenschutz/',
    '/impressum', '/impressum/',
    '/404', '/404/', '/404.html',
    '/icon.png', '/icon.png/',
  ],
  changefreq: 'weekly',
  priority: 0.7,
  transform: async (config, path) => {
    const normalizedPath = path.endsWith('/') ? path : path + '/'

    // Custom priority per page
    const priorities = {
      '/': 1.0,
      '/unternehmen/': 0.9,
      '/karriere/': 0.8,
    }
    return {
      loc: path,
      changefreq: path === '/' ? 'daily' : 'weekly',
      priority: priorities[normalizedPath] || priorities[path] || config.priority,
      lastmod: new Date().toISOString(),
    }
  },
}
