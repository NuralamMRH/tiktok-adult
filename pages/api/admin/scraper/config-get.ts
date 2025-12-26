import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const p = '/app/shared/scraper-config.json';
    const data = fs.existsSync(p)
      ? JSON.parse(fs.readFileSync(p, 'utf-8'))
      : {};
    res.status(200).json({ ok: true, data });
  } catch (e: any) {
    res.status(200).json({ ok: true, data: {} });
  }
}
