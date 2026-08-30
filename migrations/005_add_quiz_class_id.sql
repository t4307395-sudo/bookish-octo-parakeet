-- إصلاح توافق v4: إنشاء الاختبار واختباراتي يعتمدان على class_id.
-- شغّل هذا الملف مرة واحدة فقط إذا كان العمود غير موجود في quizzes.
ALTER TABLE quizzes ADD COLUMN class_id TEXT REFERENCES classes(id);
