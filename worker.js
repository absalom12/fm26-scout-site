// The site is static; this only runs for videos (run_worker_first). Safari and iOS play a video only if the server
// answers byte-range requests with 206 Partial Content, which static assets don't.
export default {
  async fetch(req, env) {
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
