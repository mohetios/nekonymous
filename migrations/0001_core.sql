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

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'anonymous_relay',

  user_a_id TEXT NOT NULL,
  user_b_id TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'active',
  message_count INTEGER NOT NULL DEFAULT 0,
  report_count INTEGER NOT NULL DEFAULT 0,
  last_event_at INTEGER NOT NULL,

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  UNIQUE(user_a_id, user_b_id, type)
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_a ON conversations(user_a_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user_b ON conversations(user_b_id, updated_at);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,

  reporter_user_id TEXT NOT NULL,
  reported_user_id TEXT,
  conversation_id TEXT,
  ticket_ref TEXT,

  reason_code TEXT NOT NULL,
  details_ciphertext TEXT,
  status TEXT NOT NULL DEFAULT 'open',

  created_at INTEGER NOT NULL,
  reviewed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_reports_status_created ON reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON reports(reported_user_id, created_at);

CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  consent_type TEXT NOT NULL,
  version TEXT NOT NULL,

  accepted_at INTEGER NOT NULL,
  revoked_at INTEGER,

  UNIQUE(user_id, consent_type, version)
);
