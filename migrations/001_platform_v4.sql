-- Migration for an existing D1 database created before this release.
-- Run once, in order, after backing up the database.
ALTER TABLE participants ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE participants ADD COLUMN participant_token_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_participants_user ON participants(user_id);
ALTER TABLE users ADD COLUMN xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN level INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN streak_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_active_date TEXT;
ALTER TABLE quizzes ADD COLUMN created_by TEXT REFERENCES users(id);
ALTER TABLE quizzes ADD COLUMN class_id TEXT REFERENCES classes(id);
CREATE INDEX IF NOT EXISTS idx_quizzes_created_by ON quizzes(created_by);
ALTER TABLE questions ADD COLUMN exam_only INTEGER NOT NULL DEFAULT 0;
