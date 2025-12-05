import type { NextApiRequest, NextApiResponse } from 'next';
import { client } from '../../../utils/client';
import { allCaptionsQuery } from '../../../utils/queries';

type CaptionStat = { caption: string; count: number };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CaptionStat[]>,
) {
  if (req.method === 'GET') {
    const limit = Number(req.query.limit ?? 10);

    const rows: { caption: string }[] = await client.fetch(allCaptionsQuery());

    const counts = new Map<string, number>();
    rows.forEach(({ caption }) => {
      const key = caption.trim();
      if (!key) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    const top = Array.from(counts.entries())
      .map(([caption, count]) => ({ caption, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, Math.max(1, limit));

    res.status(200).json(top);
  }
}

