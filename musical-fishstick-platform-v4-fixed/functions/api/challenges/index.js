// POST /api/challenges   body: { participant_id }
// بيتنادى بعد ما تخلص اختبارك، عشان تولّد رابط تحدي تبعته لصاحبك.
// صاحبك بيحل نفس الأسئلة في وقته، ونقارن الدرجتين بعدين.
import { json } from "../../_lib/auth.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await request.json().catch(() => ({}));
  const participantId = String(body?.participant_id || "").trim();
  if (!participantId) return json({ error: "بيانات ناقصة" }, 400);

  const participant = await env.DB.prepare(
    "SELECT * FROM participants WHERE id = ?"
  ).bind(participantId).first();
  if (!participant) return json({ error: "المشارك غير موجود" }, 404);
  if (!participant.finished_at) return json({ error: "لازم تخلص الاختبار الأول" }, 400);

  const id = crypto.randomUUID().slice(0, 8);
  await env.DB.prepare(
    "INSERT INTO challenges (id, quiz_id, from_participant_id, status, created_at) VALUES (?, ?, ?, 'pending', ?)"
  ).bind(id, participant.quiz_id, participantId, Date.now()).run();

  return json({ id, invite_url: `/play.html?quiz=${participant.quiz_id}&challenge=${id}` }, 201);
}
