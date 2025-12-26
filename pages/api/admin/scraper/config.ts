import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  try {
    const { baseUrl, intervalSeconds } = req.body || {}
    const target = process.env.SCRAPER_INTERNAL_URL || 'http://localhost:4000'
    const r = await axios.post(`${target}/config`, { baseUrl, intervalSeconds }, { timeout: 5000 })
    res.status(200).json({ ok: true, data: r.data })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'error' })
  }
}
