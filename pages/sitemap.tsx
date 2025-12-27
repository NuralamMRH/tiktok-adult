import Head from 'next/head';
import Layout from '../components/Layout';
import { client } from '../utils/client';
import type { GetServerSideProps } from 'next';
import { getRequestOrigin } from '../utils';

type PostLink = { _id: string; caption?: string };

type Props = {
  posts: PostLink[];
  pages: { url: string; title: string }[];
  origin: string;
};

export const getServerSideProps: GetServerSideProps<Props> = async ({ req }) => {
  let posts: PostLink[] = [];
  try {
    posts = await client.fetch(
      `*[_type == "post"] | order(_createdAt desc){ _id, caption }`,
    );
  } catch (_) {
    posts = [];
  }

  const origin = getRequestOrigin(req);

  const pages = [
    { url: '/', title: 'Home' },
    { url: '/search', title: 'Search' },
    { url: '/upload', title: 'Upload | Tik Tok' },
    { url: '/summary', title: 'Scraping Summary' },
  ];

  return { props: { posts, pages, origin } };
};

export default function SiteMap({ posts, pages, origin }: Props) {
  const makeAbs = (path: string) => `${origin}${path}`;

  return (
    <Layout>
      <Head>
        <title>Site Map</title>
        <meta property='og:url' content={makeAbs('/sitemap')}></meta>
      </Head>

      <div
        style={{
          height:
            'calc(100vh - 97px - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
        }}
        className='w-full overflow-y-auto px-4 py-6 text-gray-700 dark:text-gray-200'
      >
        <h1 className='mb-4 text-2xl font-bold'>Site Map</h1>

        <section className='mb-8'>
          <h2 className='mb-2 text-xl font-semibold'>Pages</h2>
          <ul className='space-y-2'>
            {pages.map((p) => (
              <li key={p.url} className='flex items-center gap-2'>
                <a href={p.url} className='text-primary hover:underline'>
                  {p.title}
                </a>
                <span className='text-sm text-gray-500 dark:text-gray-400'>
                  {makeAbs(p.url)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className='mb-2 text-xl font-semibold'>Posts</h2>
          <ul className='space-y-2'>
            {posts.map((post) => {
              const path = `/video/${post._id}`;
              return (
                <li key={post._id} className='flex items-center gap-2'>
                  <a href={path} className='text-primary hover:underline'>
                    {post.caption || 'Untitled'}
                  </a>
                  <span className='text-sm text-gray-500 dark:text-gray-400'>
                    {makeAbs(path)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </Layout>
  );
}
