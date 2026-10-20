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
