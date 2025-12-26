import type { NextApiRequest, NextApiResponse } from 'next';
import { client } from '../../../utils/client';

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const posts: any[] = await client.fetch(
      `*[_type=="post"]{_id,_createdAt,likeCount,comments}`,
    );
    const users: any[] = await client.fetch(`*[_type=="user"]{_id,_createdAt}`);
    const totalPosts = posts.length;
    const totalUsers = users.length;
    const totalComments = posts.reduce(
      (a, p) => a + (Array.isArray(p.comments) ? p.comments.length : 0),
      0,
    );
    const totalLikes = posts.reduce((a, p) => a + (p.likeCount || 0), 0);
    res
      .status(200)
      .json({ ok: true, totalPosts, totalUsers, totalComments, totalLikes });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'error' });
  }
}
