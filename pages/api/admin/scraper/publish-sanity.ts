import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

type PublishResponse =
  | {
      ok: true;
      data: {
        posted: number;
        skipped: number;
        failed: number;
        total?: number;
        failedSamples?: Array<{ link: string; error: string }>;
        postedLinks?: string[];
      };
    }
  | { ok: false; error: string };

function setCors(res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function loadPublisher() {
  const scriptPath = path.resolve(
    process.cwd(),
    'scripts',
    'publish-sanity.js',
  );
  let mod: any = null;
  try {
    mod = await import(scriptPath);
  } catch {
    mod = await import('../../../../scripts/publish-sanity.js');
  }
  const fn = mod?.publishPostsToSanity || mod?.default?.publishPostsToSanity;
  if (typeof fn !== 'function')
    throw new Error('publishPostsToSanity export not found');
  return fn as (
    posts: any[],
    opts?: any,
  ) => Promise<{
    posted: number;
    skipped: number;
    failed: number;
    failedSamples?: Array<{ link: string; error: string }>;
  }>;
}

function rewriteCdn(u: string): string {
  const s = String(u || '').trim();
  if (!s) return s;
  if (!s.includes('/get_file/')) return s;
  let host = '';
  try {
    host = new URL(s).hostname.toLowerCase();
  } catch {
    return s;
  }
  host = host.replace(/^www\./, '');
  const parts = s.split('/');
  if (parts.length < 5) return s;
  const tail = parts[parts.length - 1];
  const m = tail.match(/^(\d+)\.(mp4|mov|m3u8)$/i);
  if (!m) return s;
  const ext = m[2].toLowerCase();
  const id2 = parts[parts.length - 2];
  const res = parts[parts.length - 3];
  if (!/^\d+$/.test(id2) || !/^\d+$/.test(res)) return s;
  const cdnBase = `https://cdn.${host}`;
  return `${cdnBase}/${res}/${id2}/${id2}.${ext}`;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PublishResponse>,
) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });

  try {
    const { posts, runId, targetIndex } = (req.body || {}) as any;

    let publishPosts: any[] = Array.isArray(posts) ? posts : [];

    if (!publishPosts.length && runId) {
      const internal =
        process.env.SCRAPER_INTERNAL_URL || 'http://localhost:4000';
      const r = await fetch(`${internal}/api/publishable-posts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ runId, targetIndex }),
      });
      const json: any = await r.json().catch(() => null);
      publishPosts = json?.data?.posts || [];
    }

    if (!publishPosts.length)
      return res.status(400).json({ ok: false, error: 'posts_required' });

    publishPosts = publishPosts.map((p: any) => {
      const v = p?.video_src || p?.video_url;
      const r = rewriteCdn(v);
      if (r && r !== v) return { ...p, video_src: r };
      return p;
    });

    const publishPostsToSanity = await loadPublisher();
    const r = await publishPostsToSanity(publishPosts);
    return res
      .status(200)
      .json({ ok: true, data: { ...r, total: publishPosts.length } });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'error' });
  }
}
