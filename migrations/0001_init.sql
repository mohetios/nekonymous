-- Nekonymous V2 core schema (identity + aggregate stats only)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  telegram_user_hash TEXT NOT NULL UNIQUE,
  telegram_chat_ciphertext TEXT NOT NULL,

  locale TEXT NOT NULL DEFAULT 'fa',
  locale_source TEXT NOT NULL DEFAULT 'fallback',
  onboarding_completed INTEGER NOT NULL DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'active',
  bucket_id INTEGER NOT NULL,

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_bucket ON users(bucket_id);

CREATE TABLE IF NOT EXISTS public_links (
  slug TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,

  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER,

  FOREIGN KEY(owner_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_public_links_owner ON public_links(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_public_links_active ON public_links(is_active);

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
