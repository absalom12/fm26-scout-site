-- Cookieless site stats: one row per day, page and kind. No visitor ID, no IP.
-- npx wrangler d1 execute scoutsheet-stats --remote --file schema.sql
CREATE TABLE IF NOT EXISTS stats (
  day TEXT NOT NULL,
  path TEXT NOT NULL,
  kind TEXT NOT NULL,      -- time | banner | consent_yes | consent_no
  n INTEGER NOT NULL DEFAULT 0,
  secs REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path, kind)
);

-- Opt-in usage counts sent by the ScoutSheet app: one row per install, day and event. Deleted after 14 months.
CREATE TABLE IF NOT EXISTS app_usage (
  install TEXT NOT NULL,   -- random ID made when the user opts in
  day TEXT NOT NULL,
  event TEXT NOT NULL,     -- e.g. export:full, time (n = seconds)
  n INTEGER NOT NULL DEFAULT 0,
  version TEXT,
  os TEXT,
  PRIMARY KEY (install, day, event)
);

-- AI analyst (analyst.js): free tries and supporter quota per install or licence, AI spend per month, calls per hashed IP
-- per day (deleted the next day). Never any request text.
CREATE TABLE IF NOT EXISTS analyst_quota (
  id TEXT PRIMARY KEY,     -- install uuid, 'polar:' || Polar licence key id, or 'test:' || hash (tester keys)
  month TEXT, searches INTEGER NOT NULL DEFAULT 0,   -- charged searches this month (supporter quota)
  total INTEGER NOT NULL DEFAULT 0,                  -- charged searches ever (free tries)
  day TEXT, day_calls INTEGER NOT NULL DEFAULT 0,
  conv TEXT, conv_searches INTEGER NOT NULL DEFAULT 0, conv_charged INTEGER NOT NULL DEFAULT 0,
  search TEXT, search_calls INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS analyst_spend (
  month TEXT PRIMARY KEY, usd REAL NOT NULL DEFAULT 0, calls INTEGER NOT NULL DEFAULT 0,
  trial INTEGER NOT NULL DEFAULT 0, paid INTEGER NOT NULL DEFAULT 0   -- charged searches by plan
);
-- Supporter licence keys seen by the analyst: Polar's answer cached 24 h. The quota row of a key is 'polar:' || polar_id.
CREATE TABLE IF NOT EXISTS analyst_licence (
  key_hash TEXT PRIMARY KEY,   -- sha256 of the key (the key itself is never stored)
  polar_id TEXT, display_key TEXT, customer TEXT,   -- Polar's key id, masked key and buyer email, to match Polar's dashboard
  status TEXT, checked_at INTEGER
);
CREATE TABLE IF NOT EXISTS analyst_ip (
  ip_hash TEXT NOT NULL, day TEXT NOT NULL, calls INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (ip_hash, day)
);

-- Row-read budget (D1 free tier: 5M rows read a day for the account). The dashboard's range queries read only the
-- days asked for (day first, covering event/install/n), and existence checks stop at the first matching event.
CREATE INDEX IF NOT EXISTS app_usage_day ON app_usage(day, event, install, n);
CREATE INDEX IF NOT EXISTS app_usage_event ON app_usage(event, day);

-- Per-user-per-day summary for the private metrics dashboard, rebuilt hourly from app_usage (worker.js scheduled).
CREATE TABLE IF NOT EXISTS app_install_day (
  day TEXT NOT NULL, install TEXT NOT NULL, os TEXT, version TEXT,
  loads INTEGER NOT NULL DEFAULT 0,   -- save_loaded* counts
  fails INTEGER NOT NULL DEFAULT 0,   -- save_fail:* + save_failed* counts
  time_s INTEGER NOT NULL DEFAULT 0,  -- seconds of use (event "time")
  PRIMARY KEY (install, day)
);
CREATE INDEX IF NOT EXISTS app_install_day_day ON app_install_day(day);
