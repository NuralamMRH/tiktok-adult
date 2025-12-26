import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'

export const config = { api: { bodyParser: false } }

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()
  const p = '/app/shared/publisher.log'
  let pos = 0
  const send = (line: string) => { res.write(`data: ${line}\n\n`) }
  const initial = fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : ''
  if (initial) {
    const lines = initial.split(/\r?\n/).slice(-200)
    for (const l of lines) send(l)
    pos = Buffer.byteLength(initial)
  }
  const watcher = fs.watch(p, { persistent: true }, () => {
    try {
      const fd = fs.openSync(p, 'r')
      const stats = fs.fstatSync(fd)
      if (stats.size > pos) {
        const len = stats.size - pos
        const buf = Buffer.alloc(len)
        fs.readSync(fd, buf, 0, len, pos)
        pos = stats.size
        const text = buf.toString('utf-8')
        text.split(/\r?\n/).forEach(line => line && send(line))
      }
      fs.closeSync(fd)
    } catch {}
  })
  req.on('close', () => { try { watcher.close() } catch {} res.end() })
}
