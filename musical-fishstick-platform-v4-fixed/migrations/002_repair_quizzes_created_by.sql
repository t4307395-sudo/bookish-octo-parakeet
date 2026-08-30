-- إصلاح خاص بقاعدة D1 التي نفذت index قبل إضافة عمود quizzes.created_by.
-- شغّل هذا الملف مرة واحدة فقط إذا كان PRAGMA table_info(quizzes)
-- لا يعرض created_by. لا تعِد تشغيل migration 001 على نفس القاعدة.
ALTER TABLE quizzes ADD COLUMN created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_quizzes_created_by ON quizzes(created_by);
