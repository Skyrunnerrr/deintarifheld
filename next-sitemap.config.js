/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://www.deintarifheld.de',
  generateRobotsTxt: true,
  outDir: './public',
  trailingSlash: true,
  robotsTxtOptions: {
    policies: [
      { userAgent: '*', allow: '/', disallow: ['/api/'] },
    ],
    additionalSitemaps: [],
  },
  exclude: ['/agb/', '/datenschutz/', '/impressum/', '/404'],
  changefreq: 'weekly',
  priority: 0.7,
  transform: async (config, path) => {
    // Custom priority per page
    const priorities = {
      '/': 1.0,
      '/unternehmen/': 0.9,
      '/karriere/': 0.8,
    }
    return {
      loc: path,
      changefreq: path === '/' ? 'daily' : 'weekly',
      priority: priorities[path] || config.priority,
      lastmod: new Date().toISOString(),
    }
  },
}
