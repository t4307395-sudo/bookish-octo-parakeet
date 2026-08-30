// POST /api/questions/:id/report   body: { reason? }
// إبلاغ عن سؤال فيه مشكلة (غلط/غامض/إجابتين صح..إلخ). متاح للضيوف والطلاب
// المسجلين، عشان أي حد واجه مشكلة في سؤال يقدر يبلغ عنها فوراً.
import { getSessionUser, json } from "../../../_lib/auth.js";

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const questionId = Number(params.id);
  if (!Number.isInteger(questionId)) return json({ error: "سؤال غير صالح" }, 400);

  const question = await env.DB.prepare("SELECT id FROM questions WHERE id = ?").bind(questionId).first();
  if (!question) return json({ error: "السؤال غير موجود" }, 404);

  const body = await request.json().catch(() => ({}));
  const reason = String(body?.reason || "").trim().slice(0, 500) || null;

  const user = await getSessionUser(request, env);

  await env.DB.prepare(
    `INSERT INTO question_reports (question_id, user_id, reason, status, created_at)
     VALUES (?, ?, ?, 'open', ?)`
  ).bind(questionId, user?.id || null, reason, Date.now()).run();

  return json({ ok: true });
}
