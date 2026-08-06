CREATE TABLE IF NOT EXISTS visitor_counts (
  counter_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at INTEGER NOT NULL
);

-- CounterAPI에서 마지막으로 확인한 누적값을 이관한다.
INSERT OR IGNORE INTO visitor_counts (counter_key, count, updated_at)
VALUES ('total', 588, unixepoch());

INSERT OR IGNORE INTO visitor_counts (counter_key, count, updated_at)
VALUES ('daily-20260806', 4, unixepoch());
