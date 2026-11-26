import { analyst, analystLicence } from './analyst.js';

// The site is static; this only runs for /stats, /app-stats, /api/* and videos (run_worker_first). Safari and iOS play a video only if the
// server answers byte-range requests with 206 Partial Content, which static assets don't.
const KINDS = ['time', 'banner', 'consent_yes', 'consent_no', 'app_yes', 'app_no'];  // app_*: the app's usage-stats answer

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
    if (ids.length) await env.DB.batch(ids.flatMap(i => [env.DB.prepare('DELETE FROM app_usage WHERE install = ?').bind(i),
      env.DB.prepare('DELETE FROM app_install_day WHERE install = ?').bind(i)]));  // the summary forgets them at once too
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
    'ON CONFLICT DO UPDATE SET n = n + excluded.n, os = excluded.os';  // a row keeps the version that first recorded it
  // vs: {day: version} from apps that queue the version per day; older apps send only the current one (v).
  const ver = day => (typeof d.vs?.[day] === 'string' && /^[\w.-]{1,20}$/.test(d.vs[day]) ? d.vs[day] : d.v);
  for (let i = 0; i < rows.length; i += 100)
    await env.DB.batch(rows.slice(i, i + 100).map(([day, event, n]) => env.DB.prepare(sql).bind(d.id, day, event, n, ver(day), d.os)));
  return new Response(null, { status: 204 });
}

// Per-user-per-day summary read by the private metrics dashboard (metrics-dashboard/queries/scoutsheet-app.js, same SQL):
// one row per install and day with save loads, save failures and seconds of use, so the dashboard reads a few hundred
// rows instead of every event. Rebuilt from `from` onwards.
const ROLLUP = [
  'DELETE FROM app_install_day WHERE day >= ?1',
  `INSERT INTO app_install_day (day, install, os, version, loads, fails, time_s)
    SELECT day, install, MAX(os), MAX(version), COALESCE(SUM(CASE WHEN event LIKE 'save_loaded%' THEN n END), 0),
      COALESCE(SUM(CASE WHEN event LIKE 'save_fail:%' OR event LIKE 'save_failed%' THEN n END), 0),
      COALESCE(SUM(CASE WHEN event = 'time' THEN n END), 0)
    FROM app_usage WHERE day >= ?1 GROUP BY day, install`,
];
const rollup = (env, from) => env.DB.batch(ROLLUP.map(q => env.DB.prepare(q).bind(from)));
const daysAgo = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

export default {
  // Hourly: refresh today and yesterday. At 03:00 UTC: the last 14 days (late counts from computers that were offline),
  // the privacy clean-up (app counts gone after 14 months, hashed IPs after one day); on Mondays a full rebuild.
  async scheduled(event, env) {
    if (!env.DB) return;
    const at = new Date(event.scheduledTime ?? Date.now()), nightly = at.getUTCHours() === 3;
    if (nightly) {
      await env.DB.batch(["DELETE FROM app_usage WHERE day < date('now', '-14 months')",
        "DELETE FROM app_install_day WHERE day < date('now', '-14 months')",
        "DELETE FROM analyst_ip WHERE day < date('now')"].map(q => env.DB.prepare(q)));
    }
    await rollup(env, nightly ? (at.getUTCDay() === 1 ? '0000-01-01' : daysAgo(14)) : daysAgo(1));
  },
  async fetch(req, env) {
    const path = new URL(req.url).pathname;
    if (path === '/stats') return stats(req, env);
    if (path === '/app-stats') return appStats(req, env);
    if (path === '/api/analyst') return analyst(req, env);
    if (path === '/api/analyst/licence') return analystLicence(req, env);
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
