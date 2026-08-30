// POST /api/challenges/:id/accept   body: { name }
// بيعمل نفس اللي بيعمله /api/quizzes/:id/join، بس كمان بيربط المشارك الجديد
// كـ "الطرف التاني" في التحدي عشان نقدر نقارن الدرجتين بعدين.
import { getSessionUser, json, hashParticipantToken } from "../../../_lib/auth.js";

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const challenge = await env.DB.prepare("SELECT * FROM challenges WHERE id = ?").bind(params.id).first();
  if (!challenge) return json({ error: "التحدي غير موجود" }, 404);
  if (challenge.to_participant_id) return json({ error: "التحدي ده اتقبل قبل كده" }, 400);

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  if (!name) return json({ error: "اكتب اسمك الأول" }, 400);

  const quiz = await env.DB.prepare("SELECT * FROM quizzes WHERE id = ?").bind(challenge.quiz_id).first();
  if (!quiz) return json({ error: "الاختبار غير موجود" }, 404);

  const user = await getSessionUser(request, env);
  const participantId = crypto.randomUUID();
  const participantToken = crypto.randomUUID() + crypto.randomUUID();
  const participantTokenHash = await hashParticipantToken(participantToken);
  const now = Date.now();

  const totalQuestions = await env.DB.prepare(
    "SELECT COUNT(*) as c FROM questions WHERE quiz_id = ?"
  ).bind(challenge.quiz_id).first();

  await env.DB.prepare(
    "INSERT INTO participants (id, quiz_id, name, joined_at, total_questions, user_id, participant_token_hash) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(participantId, challenge.quiz_id, name, now, totalQuestions.c, user ? user.id : null, participantTokenHash).run();

  await env.DB.prepare(
    "UPDATE challenges SET to_participant_id = ?, status = 'accepted' WHERE id = ?"
  ).bind(participantId, challenge.id).run();

  return json({
    participant_id: participantId,
    participant_token: participantToken,
    started_at: now,
    duration_seconds: quiz.duration_seconds,
    joined_as: user ? user.name : null,
  });
}
