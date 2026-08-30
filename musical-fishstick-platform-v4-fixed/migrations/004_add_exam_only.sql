-- شغّل هذا الملف مرة واحدة على D1 الحالية إذا كان exam_only غير موجود في questions.
-- هذا العمود مطلوب للتدريب وسؤال اليوم.
ALTER TABLE questions ADD COLUMN exam_only INTEGER NOT NULL DEFAULT 0;
