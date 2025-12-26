import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse,
) {
  const internal = process.env.SCRAPER_INTERNAL_URL;
  if (internal) {
    try {
      const r = await fetch(`${internal}/progress`, { cache: 'no-store' });
      const json = await r.json();
      return res.status(200).json(json);
    } catch {}
  }
  try {
    const p = '/app/shared/scraper-progress.json';
    const data = fs.existsSync(p)
      ? JSON.parse(fs.readFileSync(p, 'utf-8'))
      : {};
    res.status(200).json({ ok: true, data });
  } catch (e: any) {
    res.status(200).json({ ok: true, data: {} });
  }
}
