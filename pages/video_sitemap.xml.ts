import type { GetServerSideProps } from 'next';
import { client } from '../utils/client';
import { getRequestOrigin } from '../utils';

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

export const getServerSideProps: GetServerSideProps = async ({ res, req }) => {
  const origin = getRequestOrigin(req);
  let posts: { _id: string; _updatedAt?: string }[] = [];
  try {
    posts = await client.fetch(
      `*[_type == "post"]{ _id, _updatedAt }[0...2000]`,
    );
  } catch (_) {
    posts = [];
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${posts
      .map((p) => {
        const loc = `${origin}/video/${p._id}`;
        const lastmod = isoDate(p._updatedAt);
        return `<url><loc>${esc(loc)}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`;
      })
      .join('')}
  </urlset>`;
  res.setHeader('Content-Type', 'application/xml');
  res.write(xml.trim());
  res.end();
  return { props: {} };
};

export default function VideoSitemap() {
  return null;
}
