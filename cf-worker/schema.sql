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
