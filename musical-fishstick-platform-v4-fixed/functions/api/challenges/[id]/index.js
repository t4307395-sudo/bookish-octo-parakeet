// GET /api/challenges/:id -> حالة التحدي ونتيجة الطرفين (لعرضها في نتائج التحدي)
import { json } from "../../../_lib/auth.js";

export async function onRequestGet(context) {
  const { env, params } = context;
  const challenge = await env.DB.prepare("SELECT * FROM challenges WHERE id = ?").bind(params.id).first();
  if (!challenge) return json({ error: "التحدي غير موجود" }, 404);

  const from = await env.DB.prepare(
    "SELECT name, score, total_questions, time_taken_seconds, finished_at FROM participants WHERE id = ?"
  ).bind(challenge.from_participant_id).first();

  let to = null;
  if (challenge.to_participant_id) {
    to = await env.DB.prepare(
      "SELECT name, score, total_questions, time_taken_seconds, finished_at FROM participants WHERE id = ?"
    ).bind(challenge.to_participant_id).first();
  }

  let winner = null;
  if (from?.finished_at && to?.finished_at) {
    if (from.score > to.score) winner = "from";
    else if (to.score > from.score) winner = "to";
    else winner = "tie";
  }

  return json({ id: challenge.id, quiz_id: challenge.quiz_id, status: challenge.status, from, to, winner });
}
