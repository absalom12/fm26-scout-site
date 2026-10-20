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
