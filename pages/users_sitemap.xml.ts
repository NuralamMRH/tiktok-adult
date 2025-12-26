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
  const origin = ROOT_URL || 'http://xxxdeshi.xyz';
  let users: { _id: string; _updatedAt?: string }[] = [];
  try {
    users = await client.fetch(
      `*[_type == "user"]{ _id, _updatedAt }[0...2000]`,
    );
  } catch (_) {
    users = [];
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${users
      .map((u) => {
        const loc = `${origin}/profile/${u._id}`;
        const lastmod = isoDate(u._updatedAt);
        return `<url><loc>${esc(loc)}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.5</priority></url>`;
      })
      .join('')}
  </urlset>`;
  res.setHeader('Content-Type', 'application/xml');
  res.write(xml.trim());
  res.end();
  return { props: {} };
};

export default function UsersSitemap() {
  return null;
}
