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
