import type { GetServerSideProps } from 'next';
import { client } from '../utils/client';
import { ROOT_URL } from '../utils';

function isoDate(d?: Date | string) {
  const date = d ? new Date(d) : new Date();
  return date.toISOString();
}

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const origin = ROOT_URL || 'http://localhost:3000';
  let posts: {
    _id: string;
    _updatedAt?: string;
    caption?: string;
    imageUrl?: string;
  }[] = [];
  try {
    posts = await client.fetch(
      `*[_type == "post" && defined(imageUrl) && imageUrl != ""]{ _id, _updatedAt, caption, imageUrl }[0...2000]`,
    );
  } catch {
    posts = [];
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
          xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
    ${posts
      .map((p) => {
        const loc = `${origin}/video/${p._id}`;
        const lastmod = isoDate(p._updatedAt);
        const imageLoc = p.imageUrl ? esc(p.imageUrl) : '';
        const title = p.caption ? esc(p.caption) : '';
        return `<url><loc>${esc(loc)}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>0.6</priority><image:image><image:loc>${imageLoc}</image:loc>${title ? `<image:title>${title}</image:title>` : ''}</image:image></url>`;
      })
      .join('')}
  </urlset>`;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none';");
  res.end(xml.trim());
  return { props: {} };
};

export default function ImagesSitemap() {
  return null;
}
