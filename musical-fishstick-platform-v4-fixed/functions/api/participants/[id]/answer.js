import { verifyParticipantAccess } from "../../../_lib/auth.js";
// POST /api/participants/:id/answer   body: { question_id, selected_option }
export async function onRequestPost(context) {
  const { request, env, params } = context;
  const participantId = params.id;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "بيانات الطلب غير صالحة" }, 400);
  }

  const questionId = Number(body?.question_id);
  if (!Number.isInteger(questionId)) {
    return json({ error: "سؤال غير صالح" }, 400);
  }

  // لازم نعرف المشارك تابع لأنهي اختبار، عشان نمنع إرسال إجابات لأسئلة
  // من اختبارات تانية (ثغرة كانت بتسمح بتضخيم الدرجة).
  const participant = await verifyParticipantAccess(request, env, participantId);
  if (!participant) return json({ error: "رمز المحاولة غير صالح أو منتهي" }, 403);
  const quiz = await env.DB.prepare("SELECT duration_seconds FROM quizzes WHERE id = ?").bind(participant.quiz_id).first();
  if (!quiz) return json({ error: "الاختبار غير موجود" }, 404);
  if (Date.now() - Number(participant.joined_at) >= Number(quiz.duration_seconds) * 1000) {
    return json({ error: "انتهى وقت الاختبار" }, 400);
  }
  if (participant.finished_at) {
    return json({ error: "الاختبار خلص بالنسبة لك بالفعل" }, 400);
  }

  const question = await env.DB.prepare(
    "SELECT id, quiz_id, correct_option FROM questions WHERE id = ?"
  ).bind(questionId).first();
  if (!question) return json({ error: "السؤال غير موجود" }, 404);

  // السؤال لازم يكون تابع لنفس اختبار المشارك، مش أي اختبار تاني.
  if (question.quiz_id !== participant.quiz_id) {
    return json({ error: "السؤال ده مش جزء من الاختبار بتاعك" }, 403);
  }

  const allowedOptions = new Set(["a", "b", "c", "d"]);
  const selected = String(body?.selected_option || "").toLowerCase();
  if (!allowedOptions.has(selected)) {
    return json({ error: "اختيار غير صالح" }, 400);
  }
  const isCorrect = selected === question.correct_option ? 1 : 0;

  // امسح إجابة سابقة لنفس السؤال لو موجودة (لو المستخدم غيّر رأيه)
  await env.DB.prepare(
    "DELETE FROM answers WHERE participant_id = ? AND question_id = ?"
  ).bind(participantId, questionId).run();

  await env.DB.prepare(
    "INSERT INTO answers (participant_id, question_id, selected_option, is_correct, answered_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(participantId, questionId, selected, isCorrect, Date.now()).run();

  // ملحوظة أمان: متعرفش المستخدم كان صح ولا غلط دلوقتي، عشان منديلوش
  // فرصة يجرب كل الاختيارات ويكتشف الإجابة الصح قبل ما يثبت اختياره.
  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
