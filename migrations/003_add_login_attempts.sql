-- شغّل هذا الملف مرة واحدة على D1 الحالية.
-- يحل خطأ 500 في register الذي ينتج عن غياب جدول login_attempts.
CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier
ON login_attempts(identifier, created_at);
