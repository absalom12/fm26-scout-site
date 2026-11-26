// ScoutSheet AI recruitment analyst: a locked relay between the desktop app and Claude Haiku.
// The app keeps the conversation (only it can read the save: player lookups, counting players, loosening). Each POST
// here is ONE model call: the Worker adds the master prompt, the answer schema, the tool and the key, checks the
// licence or the free tries, applies the caps, and returns the model's reply. No request text is ever stored.
// Secrets / vars: ANTHROPIC_API_KEY, ANALYST_OFF ("1" = kill switch), BUDGET_USD (monthly cap, default 20),
// IP_SALT, POLAR_ORG_ID (licence keys are Polar's), LICENCE_TEST_KEYS (comma-separated keys for testers, no purchase),
// ANTHROPIC_URL (local tests only).

import { systemPrompt } from './analyst.prompt.js';

const MODEL = 'claude-haiku-5-5';
const PRICE = { in: 0.10, cache_read: 0.01, cache_write: 0.125, out: 0.50 };  // $ per million tokens (Haiku 5.5)
const TRIAL_SEARCHES = 10, SUPPORTER_MONTH = 100, TRIAL_SHARE = 0.7;          // trials stop at 70% of the budget
const CAP = { callsPerSearch: 12, followUps: 15, installDay: 60, ipDay: 150, messages: 20, body: 64000, userText: 6500, toolText: 8000 };
const MODES = ['full', 'fair', 'moneyball'];
const POSITIONS = ['GK', 'CB', 'FB', 'DL', 'DR', 'WBL', 'WBR', 'DM', 'CM', 'W', 'ML', 'MR', 'AML', 'AMR', 'AM', 'ST'];
const SQUAD = ['star_player', 'important_player', 'regular_starter', 'squad_player', 'fringe_player', 'impact_sub', 'backup',
  'breakthrough_prospect', 'future_prospect', 'youngster', 'surplus_to_requirements', 'first_choice_goalkeeper', 'cup_goalkeeper'];
const REGIONS = ['Africa', 'Asia', 'North and Central America', 'Europe', 'Oceania', 'South America'];
const LOWER_IS_BETTER = ['possession_lost', 'mistakes', 'fouls_made', 'goals_allowed', 'conceded', 'yellow', 'red_cards', 'offsides'];
const FIXED_COLS = { left_foot: 'left foot strength, 1-20', right_foot: 'right foot strength, 1-20', height_cm: 'height in cm',
  months_left: 'months left on his contract', reputation_world: 'world reputation, 0-10000',
  club_reputation: "his club's reputation, 0-10000", league_strength: 'strength of his league, 0-10000',
  // Fair play only (the app sends them only there): CA and PA as the game's stars, against the manager's own squad
  stars_ability: "current ability in stars, 0.5-5 in half steps, against the manager's squad: 5 as good as the best players, 4 a regular starter, 3 squad level",
  stars_potential_hi: 'potential in stars, 0.5-5 in half steps: the most he could reach (use it for potential)' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// ---------- the master prompt: private, in analyst.prompt.js (see analyst.prompt.example.js) ----------

// Filter catalogue: the app sends only column names (its save's visible columns); the meanings are written here.
function catalogue(cols) {
  const words = c => c.replaceAll('_', ' '), f = {};
  for (const c of [...cols].sort()) {
    if (c.startsWith('attributes_')) f[c] = `attribute ${words(c.slice(11))}, 1-20`;
    else if (c.startsWith('personality_')) f[c] = `personality ${words(c.slice(12))}, 1-20 (controversy: low is good)`;
    else if (c.startsWith('pct_s_')) f[c] = `percentile of ${words(c.slice(6)).replace(' p90', ' per 90')} among same-position players, 0-100`;
    else if (c.startsWith('s_') && c !== 's_league_id' && c !== 's_league_rep') f[c] = `this season: ${words(c.slice(2)).replace(' p90', ' per 90').replace(' pct', ' %')}`;
  }
  for (const [c, d] of Object.entries(FIXED_COLS)) if (cols.includes(c)) f[c] = d;
  return f;
}


const WORD_KEYS = mode => ['positions', 'age', 'money', 'nations', 'leagues', 'status', ...(mode === 'full' ? ['ca_pa'] : [])];

function schema(mode, cat) {
  const num = { anyOf: [{ type: 'number' }, { type: 'null' }] }, whole = { anyOf: [{ type: 'integer' }, { type: 'null' }] };
  const strs = { type: 'array', items: { type: 'string' } };
  const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
  return obj({
    status: { type: 'string', enum: ['ask', 'search', 'unclear'] },
    questions: { type: 'array', items: obj({ label: { type: 'string' }, question: { type: 'string' }, options: strs }) },
    brief: { type: 'string' },
    positions: { type: 'array', items: { type: 'string', enum: POSITIONS } },
    filters: { type: 'array', items: obj({ column: { type: 'string', enum: Object.keys(cat) }, min: num, max: num, words: { type: 'string' } }) },
    age_min: whole, age_max: whole, value_max_gbp: whole, wage_max_gbp_week: whole,
    ...(mode === 'full' ? { ca_min: whole, pa_min: whole } : {}),
    nations: strs, regions: { type: 'array', items: { type: 'string', enum: REGIONS } }, leagues: strs,
    squad_status: { type: 'string', enum: ['any', ...SQUAD] },
    availability: { type: 'string', enum: ['any', 'free_agent', 'on_loan'] },
    home_grown: { type: 'string', enum: ['any', 'club', 'nation'] },
    ignored: strs,
    words: obj(Object.fromEntries(WORD_KEYS(mode).map(k => [k, { type: 'string' }]))),
  });
}

const LOOKUP_TOOL = { name: 'lookup_player', strict: true,
  description: "Find a player in the manager's save by name (part of the name is fine). Returns up to 3 matches with club, age, positions, value, wage and the attributes or statistics visible in this mode.",
  input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false } };

// ---------- checks ----------

const fail = (status, error) => Response.json({ error }, { status });
const str = (v, max) => typeof v === 'string' && v.length <= max;

// Only a conversation the app could have built: alternating turns from the user, plain text or lookup results from
// the user, text or lookup_player calls from the model. Anything else (another tool, a system turn, huge text) is refused.
function cleanMessages(ms) {
  if (!Array.isArray(ms) || !ms.length || ms.length > CAP.messages || ms.length % 2 === 0) return null;
  const out = [];
  for (const [i, m] of ms.entries()) {
    const role = i % 2 ? 'assistant' : 'user';
    if (m?.role !== role) return null;
    if (role === 'user') {
      if (str(m.content, CAP.userText)) { out.push({ role, content: m.content }); continue; }
      if (!Array.isArray(m.content) || !m.content.length || m.content.length > 3) return null;
      const blocks = m.content.map(b => b?.type === 'tool_result' && str(b.tool_use_id, 100) && str(b.content, CAP.toolText)
        ? { type: 'tool_result', tool_use_id: b.tool_use_id, content: b.content } : null);
      if (blocks.includes(null)) return null;
      out.push({ role, content: blocks });
    } else {
      if (str(m.content, CAP.toolText)) { out.push({ role, content: m.content }); continue; }
      if (!Array.isArray(m.content) || !m.content.length || m.content.length > 4) return null;
      const blocks = m.content.map(b => b?.type === 'text' && str(b.text, CAP.toolText) ? { type: 'text', text: b.text }
        : b?.type === 'tool_use' && b.name === 'lookup_player' && str(b.id, 100) && str(b.input?.name, 80)
          ? { type: 'tool_use', id: b.id, name: 'lookup_player', input: { name: b.input.name } } : null);
      if (blocks.includes(null)) return null;
      out.push({ role, content: blocks });
    }
  }
  return out;
}

const sha256 = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');

// A Supporter licence key is valid when Polar says "granted" (Polar revokes it when the subscription ends), or when it
// is one of LICENCE_TEST_KEYS (testers). Polar's answer is cached 24 h in analyst_licence; if Polar can't be reached,
// a key that was valid in the last 7 days stays valid. Returns the id the quota is kept under, or null.
const DAY_MS = 864e5;
async function licenceId(key, env) {
  if ((env.LICENCE_TEST_KEYS || '').split(',').map(s => s.trim()).filter(Boolean).includes(key)) return 'test:' + (await sha256(key)).slice(0, 16);
  if (!env.POLAR_ORG_ID) return null;
  const hash = await sha256(key), now = Date.now();
  const c = await env.DB.prepare('SELECT * FROM analyst_licence WHERE key_hash = ?').bind(hash).first();
  if (c && now - c.checked_at < DAY_MS) return c.status === 'granted' ? 'polar:' + c.polar_id : null;
  let r;
  try {
    r = await fetch('https://api.polar.sh/v1/customer-portal/license-keys/validate', { method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'ScoutSheet-server' }, body: JSON.stringify({ key, organization_id: env.POLAR_ORG_ID }) });
  } catch { r = null; }
  // Polar unreachable or erroring (anything but a 200 or a 404 'unknown key'): nothing is cached, a recent valid answer still counts
  if (!r || (!r.ok && r.status !== 404)) return c?.status === 'granted' && now - c.checked_at < 7 * DAY_MS ? 'polar:' + c.polar_id : null;
  const v = r.ok ? await r.json() : null, granted = v?.status === 'granted';
  await env.DB.prepare(`INSERT INTO analyst_licence (key_hash, polar_id, display_key, customer, status, checked_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (key_hash) DO UPDATE SET polar_id = coalesce(excluded.polar_id, polar_id), display_key = coalesce(excluded.display_key, display_key),
    customer = coalesce(excluded.customer, customer), status = excluded.status, checked_at = excluded.checked_at`)
    .bind(hash, v?.id ?? null, v?.display_key ?? null, v?.customer?.email ?? null, granted ? 'granted' : 'refused', now).run();
  return granted ? 'polar:' + v.id : null;
}

// ---------- the endpoint ----------

// D1 down (e.g. the account's daily read limit, 2026-11-23) threw out of the handler: Cloudflare answered 1101 and
// the app said "did not answer". Now a clean 503 the app can name.
const d1Safe = handler => async (req, env) => {
  try { return await handler(req, env); } catch (e) { console.error('analyst', e); return fail(503, 'busy'); }
};

export const analyst = d1Safe(async (req, env) => {
  if (req.method !== 'POST') return fail(405, 'bad_request');
  if (!env.DB || !env.ANTHROPIC_API_KEY) return fail(503, 'off');
  const raw = await req.text();
  if (raw.length > CAP.body) return fail(413, 'bad_request');
  let d;
  try { d = JSON.parse(raw); } catch { return fail(400, 'bad_request'); }
  if (d?.v !== 1) return fail(426, 'update_app');
  if (env.ANALYST_OFF === '1') return fail(503, 'off');
  const cols = d.columns;
  if (!UUID.test(d.install) || !UUID.test(d.conversation) || !UUID.test(d.search_id) || !MODES.includes(d.mode)
    || !Array.isArray(cols) || !cols.length || cols.length > 400 || !cols.every(c => /^[a-z0-9_]{1,48}$/.test(c))) return fail(400, 'bad_request');
  const messages = cleanMessages(d.messages);
  if (!messages) return fail(400, 'bad_request');

  // who pays: a valid licence (supporter) or the install's free tries
  const supporter = typeof d.licence === 'string' && d.licence.length > 0;
  const licId = supporter && d.licence.length <= 100 ? await licenceId(d.licence, env) : null;
  if (supporter && !licId) return fail(401, 'licence_invalid');
  const id = supporter ? licId : d.install;
  const day = new Date().toISOString().slice(0, 10), month = day.slice(0, 7);
  const budget = Number(env.BUDGET_USD || 20);

  const ipHash = await sha256(`${req.headers.get('CF-Connecting-IP') || ''}|${day}|${env.IP_SALT || ''}`);
  const [spend, q, ip] = await Promise.all([
    env.DB.prepare('SELECT usd FROM analyst_spend WHERE month = ?').bind(month).first(),
    env.DB.prepare('SELECT * FROM analyst_quota WHERE id = ?').bind(id).first(),
    env.DB.prepare('SELECT calls FROM analyst_ip WHERE ip_hash = ? AND day = ?').bind(ipHash, day).first(),
  ]);
  const usd = spend?.usd || 0;
  if (usd >= budget * (supporter ? 1 : TRIAL_SHARE)) return fail(503, 'budget');
  if ((ip?.calls || 0) >= CAP.ipDay) return fail(429, 'ip_cap');
  const r = { searches: 0, total: 0, month, day, day_calls: 0, conv: '', conv_searches: 0, conv_charged: 0, search: '', search_calls: 0, ...q };
  if (r.month !== month) Object.assign(r, { month, searches: 0 });
  if (r.day !== day) Object.assign(r, { day, day_calls: 0 });
  if (r.conv !== d.conversation) Object.assign(r, { conv: d.conversation, conv_searches: 0, conv_charged: 0 });
  if (r.search !== d.search_id) Object.assign(r, { search: d.search_id, search_calls: 0 });
  if (r.day_calls >= CAP.installDay || r.search_calls >= CAP.callsPerSearch || r.conv_searches >= CAP.followUps) return fail(429, 'install_cap');
  const left = () => supporter ? SUPPORTER_MONTH - r.searches : TRIAL_SEARCHES - r.total;
  if (!r.conv_charged && left() <= 0) return fail(supporter ? 429 : 402, supporter ? 'month_quota' : 'trial_over');

  // one model call, everything but the conversation fixed here
  const cat = catalogue(cols);
  let res;
  try {
    res = await fetch(env.ANTHROPIC_URL || 'https://api.anthropic.com/v1/messages', {  // ANTHROPIC_URL: a fake model for local tests
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 3000, tools: [LOOKUP_TOOL], messages,
        system: [{ type: 'text', text: systemPrompt(d.mode, cat, LOWER_IS_BETTER), cache_control: { type: 'ephemeral' } }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema: schema(d.mode, cat) } },
      }),
    });
  } catch { return fail(502, 'model'); }
  if (!res.ok) return fail(502, 'model');
  const m = await res.json();
  const u = m.usage || {};
  const cost = ((u.input_tokens || 0) * PRICE.in + (u.cache_read_input_tokens || 0) * PRICE.cache_read
    + (u.cache_creation_input_tokens || 0) * PRICE.cache_write + (u.output_tokens || 0) * PRICE.out) / 1e6;

  // charge: once per conversation, on its first search answer (questions and follow-ups are free)
  let isSearch = false;
  if (m.stop_reason === 'end_turn') try { isSearch = JSON.parse(m.content.find(b => b.type === 'text')?.text || '{}').status === 'search'; } catch {}
  if (isSearch) {
    r.conv_searches += 1;
    if (!r.conv_charged) { r.conv_charged = 1; r.searches += 1; r.total += 1; }
  }
  r.day_calls += 1; r.search_calls += 1;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO analyst_quota (id, month, searches, total, day, day_calls, conv, conv_searches, conv_charged, search, search_calls)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET month = excluded.month, searches = excluded.searches,
      total = excluded.total, day = excluded.day, day_calls = excluded.day_calls, conv = excluded.conv, conv_searches = excluded.conv_searches,
      conv_charged = excluded.conv_charged, search = excluded.search, search_calls = excluded.search_calls`)
      .bind(id, r.month, r.searches, r.total, r.day, r.day_calls, r.conv, r.conv_searches, r.conv_charged, r.search, r.search_calls),
    env.DB.prepare(`INSERT INTO analyst_spend (month, usd, calls, trial, paid) VALUES (?, ?, 1, ?, ?) ON CONFLICT (month) DO UPDATE SET
      usd = usd + excluded.usd, calls = calls + 1, trial = trial + excluded.trial, paid = paid + excluded.paid`)
      .bind(month, cost, isSearch && !supporter && r.conv_searches === 1 ? 1 : 0, isSearch && supporter && r.conv_searches === 1 ? 1 : 0),
    env.DB.prepare('INSERT INTO analyst_ip (ip_hash, day, calls) VALUES (?, ?, 1) ON CONFLICT DO UPDATE SET calls = calls + 1').bind(ipHash, day),
  ]).catch(e => console.error('analyst: usage not saved', e));  // the answer is paid for already: still send it
  return Response.json({
    stop_reason: m.stop_reason,
    content: (m.content || []).filter(b => b.type === 'text' || b.type === 'tool_use'),
    usage: { input: u.input_tokens || 0, cache_read: u.cache_read_input_tokens || 0, cache_write: u.cache_creation_input_tokens || 0, output: u.output_tokens || 0, usd: Math.round(cost * 1e6) / 1e6 },
    quota: { plan: supporter ? 'supporter' : 'trial', left: left() },
  });
});

// Settings: "is this licence key valid?" (one call when the manager pastes it).
export const analystLicence = d1Safe(async (req, env) => {
  let d;
  try { d = await req.json(); } catch { return fail(400, 'bad_request'); }
  if (!str(d?.licence, 100) || !d.licence) return fail(400, 'bad_request');
  const id = await licenceId(d.licence, env);
  if (!id) return fail(401, 'licence_invalid');
  const q = await env.DB.prepare('SELECT month, searches FROM analyst_quota WHERE id = ?').bind(id).first();
  const used = q?.month === new Date().toISOString().slice(0, 7) ? q.searches : 0;
  return Response.json({ ok: true, plan: 'supporter', left: SUPPORTER_MONTH - used });
});
