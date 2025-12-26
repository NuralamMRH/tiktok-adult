import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';

export const config = { api: { bodyParser: false } };

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  const internal = process.env.SCRAPER_INTERNAL_URL;
  const send = (line: string) => {
    res.write(`data: ${line}\n\n`);
  };
  let closed = false;
  if (internal) {
    const sources = ['scraper-live.log', 'scraper.log'];
    const lastMap: Record<string, string> = {};
    const tick = async () => {
      if (closed) return;
      try {
        for (const src of sources) {
          const r = await fetch(`${internal}/${src}`, { cache: 'no-store' });
          if (r.ok) {
            const text = await r.text();
            const last = lastMap[src] || '';
            if (text && text !== last) {
              const prevLines = last.split(/\r?\n/);
              const nextLines = text.split(/\r?\n/);
              for (let i = prevLines.length; i < nextLines.length; i++) {
                if (nextLines[i]) send(nextLines[i]);
              }
              lastMap[src] = text;
            }
          }
        }
      } catch {}
      setTimeout(tick, 1000);
    };
    tick();
  } else {
    const files = ['/app/shared/scraper-live.log', '/app/shared/scraper.log'];
    const positions: Record<string, number> = {};
    const watchers: fs.FSWatcher[] = [];
    for (const p of files) {
      let initial = '';
      try {
        initial = fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
      } catch {}
      if (initial) {
        const lines = initial.split(/\r?\n/).slice(-200);
        for (const l of lines) send(l);
        positions[p] = Buffer.byteLength(initial);
      } else {
        positions[p] = 0;
      }
      try {
        const w = fs.watch(p, { persistent: true }, () => {
          try {
            const fd = fs.openSync(p, 'r');
            const stats = fs.fstatSync(fd);
            const pos = positions[p] || 0;
            if (stats.size > pos) {
              const len = stats.size - pos;
              const buf = Buffer.alloc(len);
              fs.readSync(fd, buf, 0, len, pos);
              positions[p] = stats.size;
              const text = buf.toString('utf-8');
              text.split(/\r?\n/).forEach((line) => line && send(line));
            }
            fs.closeSync(fd);
          } catch {}
        });
        watchers.push(w);
      } catch {}
    }
    req.on('close', () => {
      for (const w of watchers) {
        try {
          w.close();
        } catch {}
      }
    });
  }
  req.on('close', () => {
    closed = true;
    res.end();
  });
}
