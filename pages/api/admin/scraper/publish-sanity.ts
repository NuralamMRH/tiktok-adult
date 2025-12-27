import type { NextApiRequest, NextApiResponse } from 'next'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
}

type PublishResponse =
  | { ok: true; data: { posted: number; skipped: number; failed: number } }
  | { ok: false; error: string }

function setCors(res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

async function loadPublisher() {
  const mod: any = await import('../../../../scripts/publish-sanity.js')
  const fn = mod?.publishPostsToSanity || mod?.default?.publishPostsToSanity
  if (typeof fn !== 'function') throw new Error('publishPostsToSanity export not found')
  return fn as (posts: any[], opts?: any) => Promise<{ posted: number; skipped: number; failed: number }>
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<PublishResponse>) {
  setCors(res)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' })

  try {
    const { posts, runId, targetIndex } = (req.body || {}) as any

    let publishPosts: any[] = Array.isArray(posts) ? posts : []

    if (!publishPosts.length && runId) {
      const internal = process.env.SCRAPER_INTERNAL_URL || 'http://localhost:4000'
      const r = await fetch(`${internal}/api/publishable-posts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ runId, targetIndex }),
      })
      const json: any = await r.json().catch(() => null)
      publishPosts = json?.data?.posts || []
    }

    if (!publishPosts.length) return res.status(400).json({ ok: false, error: 'posts_required' })

    const publishPostsToSanity = await loadPublisher()
    const r = await publishPostsToSanity(publishPosts)
    return res.status(200).json({ ok: true, data: r })
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || 'error' })
  }
}

