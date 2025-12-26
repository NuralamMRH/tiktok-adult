import type { GetServerSideProps } from 'next';
import { ROOT_URL } from '../utils';

function isoDate(d?: Date | string) {
  const date = d ? new Date(d) : new Date();
  return date.toISOString();
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const origin = ROOT_URL || 'http://localhost:3000';
  const lastmod = isoDate();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <sitemap><loc>${origin}/page_sitemap.xml</loc><lastmod>${lastmod}</lastmod></sitemap>
    <sitemap><loc>${origin}/video_sitemap.xml</loc><lastmod>${lastmod}</lastmod></sitemap>
    <sitemap><loc>${origin}/videos_sitemap.xml</loc><lastmod>${lastmod}</lastmod></sitemap>
    <sitemap><loc>${origin}/images_sitemap.xml</loc><lastmod>${lastmod}</lastmod></sitemap>
    <sitemap><loc>${origin}/users_sitemap.xml</loc><lastmod>${lastmod}</lastmod></sitemap>
    <sitemap><loc>${origin}/captions_sitemap.xml</loc><lastmod>${lastmod}</lastmod></sitemap>
  </sitemapindex>`;
  res.setHeader('Content-Type', 'application/xml');
  res.write(xml.trim());
  res.end();
  return { props: {} };
};

export default function DefaultSitemap() {
  return null;
}
