-- Nekonymous core schema (single init migration, assessment v1)

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

CREATE TABLE IF NOT EXISTS assessment_profiles (
  user_id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',

  dimension_scores_json TEXT NOT NULL,
  result_summary_json TEXT NOT NULL DEFAULT '{}',
  profile_summary_text TEXT,

  vector_id TEXT,
  vector_status TEXT NOT NULL DEFAULT 'not_indexed',
  vector_updated_at INTEGER,

  discoverable INTEGER NOT NULL DEFAULT 0,
  safety_tier TEXT NOT NULL DEFAULT 'normal',
  primary_intent TEXT NOT NULL DEFAULT 'deep-talk',
  profile_bucket INTEGER NOT NULL DEFAULT 0,

  completed_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_profiles_status_updated
ON assessment_profiles(status, updated_at);

CREATE INDEX IF NOT EXISTS idx_assessment_profiles_discoverable_locale
ON assessment_profiles(discoverable, updated_at);

CREATE INDEX IF NOT EXISTS idx_assessment_profiles_vector_status
ON assessment_profiles(vector_status, updated_at);

CREATE INDEX IF NOT EXISTS idx_assessment_profiles_matching_filters
ON assessment_profiles(discoverable, safety_tier, primary_intent, profile_bucket);

CREATE INDEX IF NOT EXISTS idx_assessment_profiles_version_discoverable
ON assessment_profiles(version, discoverable, status);

CREATE TABLE IF NOT EXISTS assessment_attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started',

  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  abandoned_at INTEGER,

  total_questions INTEGER NOT NULL,
  answered_questions INTEGER NOT NULL DEFAULT 0,

  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_user_started
ON assessment_attempts(user_id, started_at);

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_status_started
ON assessment_attempts(status, started_at);

CREATE TABLE IF NOT EXISTS assessment_answers (
  attempt_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  question_id TEXT NOT NULL,
  answer_value INTEGER NOT NULL,

  answered_at INTEGER NOT NULL,

  PRIMARY KEY(attempt_id, question_id),

  FOREIGN KEY(attempt_id) REFERENCES assessment_attempts(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_answers_user
ON assessment_answers(user_id, attempt_id);

CREATE TABLE IF NOT EXISTS profile_vector_index_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  vector_id TEXT NOT NULL,
  profile_version TEXT NOT NULL,
  status TEXT NOT NULL,

  model TEXT NOT NULL,
  dimension INTEGER,
  error_message TEXT,

  created_at INTEGER NOT NULL,
  completed_at INTEGER,

  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_profile_vector_events_user_created
ON profile_vector_index_events(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_profile_vector_events_status_created
ON profile_vector_index_events(status, created_at);

CREATE TABLE IF NOT EXISTS match_requests (
  id TEXT PRIMARY KEY,

  requester_user_id TEXT NOT NULL,
  candidate_user_id TEXT NOT NULL,

  requester_profile_version TEXT NOT NULL,
  candidate_profile_version TEXT NOT NULL,

  score REAL NOT NULL,
  vector_score REAL,
  deterministic_score REAL,

  explanation_json TEXT NOT NULL DEFAULT '{}',

  intro_ciphertext TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  responded_at INTEGER,
  expires_at INTEGER,

  idempotency_key TEXT NOT NULL UNIQUE,

  FOREIGN KEY(requester_user_id) REFERENCES users(id),
  FOREIGN KEY(candidate_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_match_requests_candidate_status
ON match_requests(candidate_user_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_match_requests_requester_status
ON match_requests(requester_user_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_match_requests_expires
ON match_requests(status, expires_at);

CREATE TABLE IF NOT EXISTS match_suggestions (
  id TEXT PRIMARY KEY,

  user_id TEXT NOT NULL,
  candidate_user_id TEXT NOT NULL,

  profile_version TEXT NOT NULL,
  candidate_profile_version TEXT NOT NULL,

  score REAL NOT NULL,
  vector_score REAL,
  deterministic_score REAL,

  explanation_json TEXT NOT NULL DEFAULT '{}',

  status TEXT NOT NULL DEFAULT 'shown',
  created_at INTEGER NOT NULL,
  action_at INTEGER,

  UNIQUE(user_id, candidate_user_id, profile_version),

  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(candidate_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_match_suggestions_user_created
ON match_suggestions(user_id, created_at);

CREATE TABLE IF NOT EXISTS match_blocks (
  user_id TEXT NOT NULL,
  blocked_user_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'dismissed',

  created_at INTEGER NOT NULL,

  PRIMARY KEY(user_id, blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_match_blocks_user
ON match_blocks(user_id, created_at);

CREATE TABLE IF NOT EXISTS match_events (
  id TEXT PRIMARY KEY,

  type TEXT NOT NULL,

  user_id TEXT,
  target_user_id TEXT,
  match_request_id TEXT,

  metadata_json TEXT NOT NULL DEFAULT '{}',

  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_match_events_user_created
ON match_events(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_match_events_request_created
ON match_events(match_request_id, created_at);

CREATE INDEX IF NOT EXISTS idx_match_events_type_created
ON match_events(type, created_at);
