-- Quiz competition system schema (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 600,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT REFERENCES users(id),
  class_id TEXT REFERENCES classes(id)
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT,
  option_d TEXT,
  correct_option TEXT NOT NULL,
  exam_only INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id)
);

CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  name TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  finished_at INTEGER,
  score INTEGER,
  total_questions INTEGER,
  time_taken_seconds INTEGER,
  user_id TEXT REFERENCES users(id),
  participant_token_hash TEXT,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id)
);

CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  participant_id TEXT NOT NULL,
  question_id INTEGER NOT NULL,
  selected_option TEXT,
  is_correct INTEGER,
  answered_at INTEGER,
  FOREIGN KEY (participant_id) REFERENCES participants(id),
  FOREIGN KEY (question_id) REFERENCES questions(id)
);

CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_participants_quiz ON participants(quiz_id);
CREATE INDEX IF NOT EXISTS idx_answers_participant ON answers(participant_id);

-- ===== نظام المستخدمين (طلاب + أدمن) =====

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',   -- 'student' أو 'admin'
  grade TEXT,                              -- الصف/السنة الدراسية، اختياري
  total_points INTEGER NOT NULL DEFAULT 0, -- إجمالي نقاط الطالب عبر كل الاختبارات (للوحة الصدارة العامة)
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  streak_count INTEGER NOT NULL DEFAULT 0,
  last_active_date TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- محاولات المصادقة المستخدمة في rate limiting للتسجيل والدخول.
CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts(identifier, created_at);

-- ربط اختياري: لو اللاعب داخل بحساب مسجل، نربطه بيوزره عشان تتحسب نقاطه
-- في اللوحة العامة. لسه ممكن يلعب كضيف (user_id يفضل NULL).
CREATE INDEX IF NOT EXISTS idx_participants_user ON participants(user_id);

-- ===================================================================
-- Platform v2: XP/مستويات/Streak + بنك أخطاء + فصول + تحديات + دردشة
-- (لو قاعدة بيانات شغالة بالفعل، شغّل السطور دي مرة واحدة في D1 Console.
--  لو قاعدة بيانات جديدة تماماً، schema.sql هيعمل كل حاجة من غير خطوة إضافية)
-- ===================================================================


-- بنك الأخطاء الشخصي: كل سؤال أجاب عليه الطالب غلط بيتسجل هنا تلقائياً
CREATE TABLE IF NOT EXISTS mistakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  question_id INTEGER NOT NULL,
  quiz_id TEXT NOT NULL,
  selected_option TEXT,
  mastered INTEGER NOT NULL DEFAULT 0, -- بيتحول 1 لما الطالب يجاوبها صح في المراجعة
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (question_id) REFERENCES questions(id)
);
CREATE INDEX IF NOT EXISTS idx_mistakes_user ON mistakes(user_id, mastered);

-- الفصول: أي طالب مسجل يقدر يعمل فصل (يبقى "معلّم" له) وياخد كود انضمام
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  join_code TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS class_members (
  class_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (class_id, user_id),
  FOREIGN KEY (class_id) REFERENCES classes(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_class_members_user ON class_members(user_id);

-- تحديات غير مباشرة (Async 1v1): طالب يلعب اختبار، يبعت رابط تحدي لصاحبه،
-- صاحبه يلعب نفس الأسئلة وقت ما يريحه، وبعدين تتقارن الدرجتين.
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  from_participant_id TEXT NOT NULL,
  to_participant_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending (لسه محدش قبل) | accepted (الطرف التاني بدأ يحل) | completed (الاتنين خلصوا)
  created_at INTEGER NOT NULL,
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id),
  FOREIGN KEY (from_participant_id) REFERENCES participants(id),
  FOREIGN KEY (to_participant_id) REFERENCES participants(id)
);

-- دردشة بسيطة (polling، زي باقي المنصة): غرفة لكل فصل أو لكل اختبار
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_type TEXT NOT NULL, -- 'class' | 'quiz'
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_type, room_id, created_at);

-- ===================================================================
-- Platform v3: سؤال اليوم، تدريب حر، سجل الاختبارات، ساحة عامة
-- (كل الأسطر دي CREATE TABLE / CREATE INDEX بس - آمنة تماماً إنها تتنفذ
--  على قاعدة بيانات شغالة من غير أي خطوة إضافية أو ALTER)
-- ===================================================================

-- إجابة كل مستخدم على سؤال اليوم (مرة واحدة بس في اليوم بتوقيت UTC)
CREATE TABLE IF NOT EXISTS daily_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  answer_date TEXT NOT NULL, -- 'YYYY-MM-DD' بتوقيت UTC
  question_id INTEGER NOT NULL,
  selected_option TEXT,
  is_correct INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, answer_date),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (question_id) REFERENCES questions(id)
);
CREATE INDEX IF NOT EXISTS idx_daily_answers_date ON daily_answers(answer_date);

-- إبلاغ الطلاب عن سؤال فيه مشكلة (غلط/غامض/إجابتين صح..إلخ) عشان الأدمن يراجعه.
CREATE TABLE IF NOT EXISTS question_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  user_id TEXT,               -- ممكن يكون NULL لو ضيف بلّغ من اختبار من غير حساب
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- open | resolved
  created_at INTEGER NOT NULL,
  FOREIGN KEY (question_id) REFERENCES questions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_question_reports_status ON question_reports(status, created_at);
-- ملحوظة: الشات العام (roomType='global') والتدريب الحر وسجل الاختبارات
-- بيستخدموا جداول موجودة بالفعل (messages, questions, participants)، فمحتاجين
-- الجدول ده بس الجديد.

-- ===================================================================
-- Platform v4: تحسينات لجعل المنصة صالحة فعلياً لتقييم الطلاب
-- (ملكية الاختبارات + حماية تسجيل الدخول + فصل بنك الامتحان عن التدريب
--  + تحليل أداء الأسئلة). كل الأسطر دي آمنة على قاعدة بيانات شغالة.
-- ===================================================================

-- ملكية الاختبار: مين اللي أنشأه، ولو مرتبط بفصل معيّن (اختياري).
-- ده اللي بيخلي المعلم يقدر يرجع يشوف كل اختباراته في "اختباراتي"
-- (GET /api/quizzes/mine) بدل ما يحتاج يحتفظ بكل رابط لوحده.
CREATE INDEX IF NOT EXISTS idx_quizzes_created_by ON quizzes(created_by);

-- علامة "سؤال امتحان فقط": لو 1، السؤال ده بيتخفى من التدريب الحر وسؤال
-- اليوم (اللي بيوريا الإجابة الصح فورًا)، وبيفضل محفوظ بس عشان يتسحب في
-- اختبارات حقيقية. من غيرها، أي طالب يقدر "يتدرب" على نفس بنك أي امتحان
-- جاي ويشوف إجابته الصح مقدمًا عن طريق /api/practice/check.

-- محاولات تسجيل الدخول/إنشاء الحساب: تستخدم للـ rate limiting البسيط في
-- login.js و register.js (منع تخمين الباسورد بالجملة أو سبام تسجيل حسابات).
CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT NOT NULL, -- إيميل (لتسجيل الدخول) أو IP (لإنشاء حساب)
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts(identifier, created_at);
