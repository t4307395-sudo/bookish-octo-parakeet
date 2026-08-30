// GET  /api/daily  -> سؤال اليوم (نفسه لكل الطلاب في نفس اليوم) + هل جاوبته قبل كده
// POST /api/daily   body: { question_id, selected_option }  -> تسجيل إجابة اليوم (مرة واحدة بس)
//
// سؤال اليوم بيتحدد بشكل ثابت (deterministic) من تاريخ اليوم بتوقيت UTC، بحيث
// كل الطلاب يشوفوا نفس السؤال، وبيتغير تلقائي كل يوم من غير أي تدخل يدوي.
import { getSessionUser, json } from "../../_lib/auth.js";
import { applyGameProgress } from "../../_lib/gamification.js";

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

// hash بسيط وثابت للتاريخ عشان نختار index من بنك الأسئلة.
function dateSeed(dateStr) {
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = (h * 31 + dateStr.charCodeAt(i)) >>> 0;
  }
  return h;
}

async function pickTodayQuestion(env, dateStr) {
  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM questions WHERE (quiz_id = 'bank' OR quiz_id LIKE 'bank:%') AND exam_only = 0`
  ).first();
  const total = countRow?.c || 0;
  if (total === 0) return null;

  const offset = dateSeed(dateStr) % total;
  const question = await env.DB.prepare(
    `SELECT id, text, option_a, option_b, option_c, option_d, correct_option
     FROM questions WHERE (quiz_id = 'bank' OR quiz_id LIKE 'bank:%') AND exam_only = 0
     ORDER BY id ASC LIMIT 1 OFFSET ?`
  ).bind(offset).first();
  return question;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const date = todayUTC();
  const question = await pickTodayQuestion(env, date);
  if (!question) return json({ error: "مفيش أسئلة في البنك لسه" }, 404);

  const user = await getSessionUser(request, env);
  let alreadyAnswered = null;
  if (user) {
    alreadyAnswered = await env.DB.prepare(
      "SELECT selected_option, is_correct FROM daily_answers WHERE user_id = ? AND answer_date = ?"
    ).bind(user.id, date).first();
  }

  return json({
    date,
    question: {
      id: question.id,
      text: question.text,
      option_a: question.option_a,
      option_b: question.option_b,
      option_c: question.option_c,
      option_d: question.option_d,
    },
    already_answered: !!alreadyAnswered,
    your_answer: alreadyAnswered || null,
    correct_option: alreadyAnswered ? question.correct_option : undefined,
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "لازم تسجل دخول عشان تجاوب سؤال اليوم" }, 401);

  const date = todayUTC();
  const question = await pickTodayQuestion(env, date);
  if (!question) return json({ error: "مفيش أسئلة في البنك لسه" }, 404);

  const body = await request.json().catch(() => ({}));
  const questionId = Number(body?.question_id);
  if (questionId !== question.id) {
    return json({ error: "سؤال اليوم اتغير، حدّث الصفحة وجرب تاني" }, 409);
  }

  const existing = await env.DB.prepare(
    "SELECT id FROM daily_answers WHERE user_id = ? AND answer_date = ?"
  ).bind(user.id, date).first();
  if (existing) return json({ error: "جاوبت سؤال اليوم بالفعل" }, 400);

  const allowedOptions = new Set(["a", "b", "c", "d"]);
  const selected = String(body?.selected_option || "").toLowerCase();
  if (!allowedOptions.has(selected)) return json({ error: "اختيار غير صالح" }, 400);

  const isCorrect = selected === question.correct_option ? 1 : 0;

  try {
    await env.DB.prepare(
      `INSERT INTO daily_answers (user_id, answer_date, question_id, selected_option, is_correct, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(user.id, date, question.id, selected, isCorrect, Date.now()).run();
  } catch {
    // فشل الإدراج غالباً بسبب UNIQUE(user_id, answer_date) لو حصل سباق طلبات
    return json({ error: "جاوبت سؤال اليوم بالفعل" }, 400);
  }

  const progress = await applyGameProgress(env, user.id, isCorrect);

  return json({ correct: !!isCorrect, correct_option: question.correct_option, progress });
}
