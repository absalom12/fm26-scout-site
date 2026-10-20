// The site is static; this only runs for /stats and videos (run_worker_first). Safari and iOS play a video only if the
// server answers byte-range requests with 206 Partial Content, which static assets don't.
const KINDS = ['time', 'banner', 'consent_yes', 'consent_no'];

// Cookieless stats from stats.js: adds to per-day totals in D1, keeps nothing about the visitor.
// ponytail: no rate limit, anyone can inflate the counts; add one if the numbers look gamed.
async function stats(req, env) {
  if (req.method !== 'POST' || !env.DB) return new Response(null, { status: 204 });
  let d;
  try { d = await req.json(); } catch { return new Response(null, { status: 400 }); }
  if (!d || !KINDS.includes(d.k)) return new Response(null, { status: 400 });
  const path = typeof d.p === 'string' && /^\/[\w.-]{0,40}$/.test(d.p) ? d.p : '/';
  const time = d.k === 'time';
  const secs = time ? Math.min(Math.max(Number(d.s) || 0, 0), 1800) : 0;
  const n = time && !d.f ? 0 : 1;
  await env.DB.prepare('INSERT INTO stats (day, path, kind, n, secs) VALUES (date(), ?, ?, ?, ?) ' +
    'ON CONFLICT DO UPDATE SET n = n + excluded.n, secs = secs + excluded.secs').bind(path, d.k, n, secs).run();
  return new Response(null, { status: 204 });
}

export default {
  async fetch(req, env) {
    if (new URL(req.url).pathname === '/stats') return stats(req, env);
    const res = await env.ASSETS.fetch(req);
    if (res.status !== 200) return res;
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('Range') || '');
    if (!m || (m[1] === '' && m[2] === '')) {
      const h = new Headers(res.headers);
      h.set('Accept-Ranges', 'bytes');
      return new Response(res.body, { status: 200, headers: h });
    }
    const buf = await res.arrayBuffer(), size = buf.byteLength;
    const start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]);
    const end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    const h = new Headers(res.headers);
    h.set('Accept-Ranges', 'bytes');
    h.set('Content-Range', `bytes ${start}-${end}/${size}`);
    h.set('Content-Length', String(end - start + 1));
    return new Response(buf.slice(start, end + 1), { status: 206, headers: h });
  },
};
