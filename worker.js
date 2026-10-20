// The site is static; this only runs for /stats, /app-stats and videos (run_worker_first). Safari and iOS play a video only if the
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

// Opt-in usage counts from the ScoutSheet app (telemetry.py): {id, v, os, days: {day: {event: n}}}, or {forget: [ids]}
// when the user turns it off.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EVENT = /^[a-z_]{1,32}(:[\w.-]{1,40})?$/;

async function appStats(req, env) {
  if (req.method !== 'POST' || !env.DB) return new Response(null, { status: 204 });
  let d;
  try { d = await req.json(); } catch { return new Response(null, { status: 400 }); }
  if (Array.isArray(d?.forget)) {
    const ids = d.forget.filter(i => UUID.test(i)).slice(0, 20);
    if (ids.length) await env.DB.batch(ids.map(i => env.DB.prepare('DELETE FROM app_usage WHERE install = ?').bind(i)));
    return new Response(null, { status: 204 });
  }
  if (!UUID.test(d?.id) || typeof d.days !== 'object' || !/^[\w.-]{1,20}$/.test(d.v) || !['mac', 'windows', 'linux'].includes(d.os))
    return new Response(null, { status: 400 });
  const oldest = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
  const rows = [];
  for (const [day, counts] of Object.entries(d.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < oldest || typeof counts !== 'object') continue;
    for (const [event, n] of Object.entries(counts))
      if (EVENT.test(event) && Number.isInteger(n) && n > 0 && n <= 1e7) rows.push([day, event, n]);
  }
  if (rows.length > 5000) return new Response(null, { status: 413 });
  const sql = 'INSERT INTO app_usage (install, day, event, n, version, os) VALUES (?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT DO UPDATE SET n = n + excluded.n, version = excluded.version, os = excluded.os';
  for (let i = 0; i < rows.length; i += 100)
    await env.DB.batch(rows.slice(i, i + 100).map(([day, event, n]) => env.DB.prepare(sql).bind(d.id, day, event, n, d.v, d.os)));
  return new Response(null, { status: 204 });
}

export default {
  async scheduled(_, env) {  // daily: the privacy notice promises app counts are gone after 14 months
    await env.DB?.prepare("DELETE FROM app_usage WHERE day < date('now', '-14 months')").run();
  },
  async fetch(req, env) {
    const path = new URL(req.url).pathname;
    if (path === '/stats') return stats(req, env);
    if (path === '/app-stats') return appStats(req, env);
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
