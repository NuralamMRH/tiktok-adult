import fs from 'fs';
import path from 'path';
import type { GetServerSideProps } from 'next';

type Summary = {
  total_posts: number;
  new_posts: number;
  posts_with_videos: number;
  posts_with_images: number;
  errors: number;
  pages_completed?: number;
  page_limit?: number;
  last_run_at?: string;
};

type Props = {
  summary: Summary | null;
};

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const root = process.cwd();
  const primary = path.join(root, 'scraping-summary.json');
  const fallback = path.join(root, 'python-scraper', 'scraping-summary.json');
  const shared = '/app/shared/scraping-summary.json';
  let summary: Summary | null = null;
  try {
    const raw = fs.readFileSync(primary, 'utf-8');
    summary = JSON.parse(raw);
  } catch (_) {
    try {
      const raw2 = fs.readFileSync(fallback, 'utf-8');
      summary = JSON.parse(raw2);
    } catch (_) {
      try {
        const raw3 = fs.readFileSync(shared, 'utf-8');
        summary = JSON.parse(raw3);
      } catch (_) {
        summary = null;
      }
    }
  }
  return { props: { summary } };
};

export default function SummaryPage({ summary }: Props) {
  if (!summary) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Scraping Summary</h1>
        <p>No summary data available.</p>
      </div>
    );
  }
  return (
    <div style={{ padding: 24 }}>
      <h1>Scraping Summary</h1>
      <div style={{ display: 'grid', gap: 8 }}>
        <div>Total posts: {summary.total_posts}</div>
        <div>New posts: {summary.new_posts}</div>
        <div>Posts with videos: {summary.posts_with_videos}</div>
        <div>Posts with images: {summary.posts_with_images}</div>
        <div>Errors: {summary.errors}</div>
        {typeof summary.pages_completed === 'number' && (
          <div>Pages completed: {summary.pages_completed}</div>
        )}
        {typeof summary.page_limit === 'number' && (
          <div>Page limit: {summary.page_limit}</div>
        )}
        {summary.last_run_at && <div>Last run: {summary.last_run_at}</div>}
      </div>
    </div>
  );
}
