'use strict';
const cheerio = require('cheerio');
const redirects = require('../data/project-redirects.json');
const projects = require('../data/projects.json');
const DEFAULT_ORIGIN = 'https://duoonex.com';
function siteOrigin(value = process.env.SITE_URL || DEFAULT_ORIGIN) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('SITE_URL must be an HTTP(S) origin without a path, credentials or query.');
  return url.origin;
}
function route(file) { return '/' + file.replace(/index\.html$/, ''); }
function indexable(file, html) {
  const $ = cheerio.load(html);
  return !redirects[route(file)] && !/noindex/i.test($('meta[name="robots"]').attr('content') || '');
}
function renderSeo(html, origin) {
  if (origin === DEFAULT_ORIGIN) return html;
  const $ = cheerio.load(html);
  $('link[rel="canonical"],meta[property="og:url"],meta[property="og:image"],meta[name="twitter:image"]').each((_, el) => {
    const key = el.tagName === 'link' ? 'href' : 'content';
    $(el).attr(key, ($(el).attr(key) || '').replace(DEFAULT_ORIGIN, origin));
  });
  $('script[type="application/ld+json"]').each((_, el) => $(el).text($(el).text().split(DEFAULT_ORIGIN).join(origin).replace(/</g, '\\u003c')));
  return $.html();
}
function sitemap(pages, origin) {
  const escape = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + pages.map(file => '  <url><loc>' + escape(origin + route(file)) + '</loc></url>').join('\n') + '\n</urlset>\n';
}
function robots(origin) { return 'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /*?preview=\n\nSitemap: ' + origin + '/sitemap.xml\n'; }
function llms(origin) {
  return '# DuooNex\n\n> Dubai-based website and application development for UAE businesses, with remote delivery for GCC and international projects.\n\n## Services\n' + [
    ['Custom websites', '/services/web-design/', 'Responsive business websites and content management.'],
    ['Custom applications', '/services/web-app-mvp-development/', 'Operational workflows, dashboards and customer portals.'],
    ['React and Next.js', '/services/saas-mvp-development/', 'API-connected websites and application interfaces.'],
    ['Python and AI workflows', '/services/ai-mvp-development/', 'Business backends, APIs and scoped AI integrations.'],
    ['Shopify development', '/services/webflow/', 'Liquid themes, product content and store integrations.'],
    ['WordPress development', '/services/law-firm-web-design-development/', 'Service websites and manageable publishing.'],
    ['UI/UX design', '/services/ui-ux-design/', 'Figma journeys, interfaces and prototypes.']
  ].map(([name, url, description]) => `- [${name}](${origin}${url}): ${description}`).join('\n') +
  '\n\n## Selected projects\n' + projects.map(p => `- [${p.name}](${origin}/case-studies/${p.slug}/): ${p.summary}`).join('\n') +
  `\n\n## Company and contact\n- [About DuooNex](${origin}/about/)\n- [Company facts](${origin}/llm-info/)\n- [Contact](${origin}/contact/)\n- Email: johnsantonyjo@gmail.com\n- Phone / WhatsApp: +971 58 810 2728\n- Location: Dubai, United Arab Emirates\n- Pricing and timelines are agreed by project scope.\n\n## Reading this portfolio\nProject pages describe evidenced scope and show original project media. Screenshots are not claims of business results. Application deployment and optional integrations require their own configuration. This file is a navigation aid, not a guarantee of AI indexing or citation.\n`;
}
module.exports = {siteOrigin, route, indexable, renderSeo, sitemap, robots, llms, redirects};
