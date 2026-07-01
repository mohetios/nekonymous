CREATE TABLE IF NOT EXISTS platform_daily_stats (
  day TEXT NOT NULL,
  event_name TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (day, event_name)
);

CREATE TABLE IF NOT EXISTS platform_daily_stats_by_key (
  day TEXT NOT NULL,
  event_name TEXT NOT NULL,
  stat_key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (day, event_name, stat_key)
);

CREATE TABLE IF NOT EXISTS platform_daily_unique_stats (
  day TEXT NOT NULL,
  event_name TEXT NOT NULL,
  unique_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (day, event_name, unique_hash)
);

CREATE INDEX IF NOT EXISTS idx_platform_daily_stats_day_event
ON platform_daily_stats (day, event_name);

CREATE INDEX IF NOT EXISTS idx_platform_daily_unique_day_event
ON platform_daily_unique_stats (day, event_name);
