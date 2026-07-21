CREATE TABLE IF NOT EXISTS access_controls (
  user_key TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_access_controls_status ON access_controls (status);

INSERT INTO access_controls (user_key, status, updated_at)
SELECT latest.user_key, latest.status, COALESCE(latest.reviewed_at, latest.created_at)
FROM access_requests AS latest
WHERE latest.id = (
  SELECT candidate.id
  FROM access_requests AS candidate
  WHERE candidate.user_key = latest.user_key
  ORDER BY candidate.created_at DESC, candidate.id DESC
  LIMIT 1
)
ON CONFLICT(user_key) DO UPDATE SET
  status = excluded.status,
  updated_at = excluded.updated_at;
