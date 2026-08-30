// POST /api/quizzes/:id/join   body: { name }
// لو اللاعب داخل بحساب مسجل (session cookie صالح)، بنربط مشاركته بحسابه
// عشان نقاطه تتحسب بعدين في لوحة الصدارة العامة. لسه ممكن يلعب كضيف عادي.
import { getSessionUser, json, hashParticipantToken } from "../../../_lib/auth.js";

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const quizId = params.id;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "بيانات الطلب غير صالحة" }, 400);
  }

  if (!body.name || !body.name.trim()) {
    return json({ error: "اكتب اسمك الأول" }, 400);
  }

  const quiz = await env.DB.prepare("SELECT * FROM quizzes WHERE id = ?").bind(quizId).first();
  if (!quiz) return json({ error: "الاختبار غير موجود" }, 404);
  if (quiz.status !== "active") return json({ error: "الاختبار مقفول" }, 400);

  const user = await getSessionUser(request, env);
  const participantId = crypto.randomUUID();
  const participantToken = crypto.randomUUID() + crypto.randomUUID();
  const participantTokenHash = await hashParticipantToken(participantToken);
  const now = Date.now();

  const totalQuestions = await env.DB.prepare(
    "SELECT COUNT(*) as c FROM questions WHERE quiz_id = ?"
  ).bind(quizId).first();

  await env.DB.prepare(
    "INSERT INTO participants (id, quiz_id, name, joined_at, total_questions, user_id, participant_token_hash) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(participantId, quizId, body.name.trim(), now, totalQuestions.c, user ? user.id : null, participantTokenHash).run();

  return json({
    participant_id: participantId,
    participant_token: participantToken,
    started_at: now,
    duration_seconds: quiz.duration_seconds,
    joined_as: user ? user.name : null,
  });
}
