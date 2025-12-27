import type { GetServerSideProps } from 'next';
import { getRequestOrigin } from '../utils';

function isoDate(d?: Date | string) {
  const date = d ? new Date(d) : new Date();
  return date.toISOString();
}

export const getServerSideProps: GetServerSideProps = async ({ res, req }) => {
  const origin = getRequestOrigin(req);
  const urls = [
    { loc: `${origin}/`, changefreq: 'hourly', priority: '1.0', lastmod: isoDate() },
    { loc: `${origin}/search`, changefreq: 'daily', priority: '0.8', lastmod: isoDate() },
    { loc: `${origin}/upload`, changefreq: 'weekly', priority: '0.5', lastmod: isoDate() },
    { loc: `${origin}/summary`, changefreq: 'daily', priority: '0.4', lastmod: isoDate() },
    { loc: `${origin}/sitemap`, changefreq: 'weekly', priority: '0.3', lastmod: isoDate() },
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls
      .map(
        (u) =>
          `<url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`,
      )
      .join('')}
  </urlset>`;
  res.setHeader('Content-Type', 'application/xml');
  res.write(xml.trim());
  res.end();
  return { props: {} };
};

export default function PageSitemap() {
  return null;
}
