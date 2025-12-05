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
  let captions: { caption: string }[] = [];
  try {
    captions = await client.fetch(
      `*[_type == "post" && defined(caption) && caption != ""]{ caption }[0...2000]`,
    );
  } catch (_) {
    captions = [];
  }
  const now = isoDate();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${captions
      .map((c) => {
        const loc = `${origin}/?caption=${encodeURIComponent(c.caption)}`;
        return `<url><loc>${esc(loc)}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>0.4</priority></url>`;
      })
      .join('')}
  </urlset>`;
  res.setHeader('Content-Type', 'application/xml');
  res.write(xml.trim());
  res.end();
  return { props: {} };
};

export default function CaptionsSitemap() {
  return null;
}

