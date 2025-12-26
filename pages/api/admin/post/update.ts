import type { NextApiRequest, NextApiResponse } from 'next'
import { client } from '../../../../utils/client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  try {
    const { id, caption, topic } = req.body || {}
    if (!id) return res.status(400).json({ ok: false, error: 'missing id' })
    const p = client.patch(id)
    const set: any = {}
    if (caption !== undefined) set.caption = caption
    if (topic !== undefined) set.topic = topic
    const r = await p.set(set).commit()
    res.status(200).json({ ok: true, data: r })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'error' })
  }
}
