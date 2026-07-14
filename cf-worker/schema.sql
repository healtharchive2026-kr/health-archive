CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  delete_token TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at);

CREATE TABLE IF NOT EXISTS auth_attempts (
  client_key TEXT PRIMARY KEY,
  fail_count INTEGER NOT NULL DEFAULT 0,
  blocked_until INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_attempts_updated_at ON auth_attempts (updated_at);

CREATE TABLE IF NOT EXISTS access_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT NOT NULL,
  department TEXT NOT NULL,
  purpose TEXT NOT NULL,
  email TEXT NOT NULL,
  user_key TEXT NOT NULL,
  client_key TEXT NOT NULL,
  analytics_consent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  review_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_access_requests_email ON access_requests (email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_requests_user_key ON access_requests (user_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_requests_client_key ON access_requests (client_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_requests_created_at ON access_requests (created_at);

CREATE TABLE IF NOT EXISTS usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_key TEXT NOT NULL,
  event_name TEXT NOT NULL,
  target TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user_created ON usage_events (user_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_target_created ON usage_events (target, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events (created_at);
