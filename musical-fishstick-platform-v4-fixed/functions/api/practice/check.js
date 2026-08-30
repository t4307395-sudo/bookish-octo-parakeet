// POST /api/practice/check   body: { question_id, selected_option }
// بيتأكد من إجابة سؤال تدريب واحد ويرجع الإجابة الصح. لو المستخدم داخل
// بحساب وغلط، بنسجلها في بنك أخطائه الشخصي عشان يراجعها بعدين (زي أي غلطة
// تانية)، من غير ما نكرر نفس السؤال لو كان مسجل قبل كده وغير متقن.
import { getSessionUser, json } from "../../_lib/auth.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json().catch(() => ({}));

  const questionId = Number(body?.question_id);
  if (!Number.isInteger(questionId)) return json({ error: "سؤال غير صالح" }, 400);

  const question = await env.DB.prepare(
    "SELECT id, quiz_id, correct_option, exam_only FROM questions WHERE id = ?"
  ).bind(questionId).first();
  if (!question) return json({ error: "السؤال غير موجود" }, 404);

  // أمان مهم: الـ endpoint ده لازم يشتغل بس على أسئلة "بنك التدريب"
  // (quiz_id = 'bank' أو 'bank:فئة') وغير معلّمة exam_only. من غيره أي حد
  // معاه question_id (حتى من اختبار حي مفتوح دلوقتي، أو معلّم كـ"امتحان
  // فقط") كان يقدر يستخدمه عشان يعرف إجابة سؤال قبل ما يجاوب فعليًا
  // (نفس الثغرة اللي answer.js اتصمم أصلاً عشان يمنعها).
  const isBankQuestion = question.quiz_id === "bank" || question.quiz_id.startsWith("bank:");
  if (!isBankQuestion || question.exam_only) {
    return json({ error: "السؤال ده مش جزء من بنك التدريب" }, 403);
  }

  const allowedOptions = new Set(["a", "b", "c", "d"]);
  const selected = String(body?.selected_option || "").toLowerCase();
  if (!allowedOptions.has(selected)) return json({ error: "اختيار غير صالح" }, 400);

  const isCorrect = selected === question.correct_option;

  const user = await getSessionUser(request, env);
  if (user && !isCorrect) {
    const existing = await env.DB.prepare(
      "SELECT id FROM mistakes WHERE user_id = ? AND question_id = ? AND mastered = 0"
    ).bind(user.id, questionId).first();
    if (!existing) {
      await env.DB.prepare(
        `INSERT INTO mistakes (user_id, question_id, quiz_id, selected_option, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(user.id, questionId, question.quiz_id, selected, Date.now()).run();
    }
  }

  return json({ correct: isCorrect, correct_option: question.correct_option });
}
