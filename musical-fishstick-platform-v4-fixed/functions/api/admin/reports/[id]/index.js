// POST /api/admin/reports/:id  body: { status: 'resolved' }  (أدمن بس)
// بيقفل بلاغ بعد ما الأدمن يراجعه (يظبط السؤال أو يتأكد إنه سليم).
import { requireAdmin, json } from "../../../../_lib/auth.js";

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const admin = await requireAdmin(request, env);
  if (!admin) return json({ error: "محتاج تدخل كأدمن الأول" }, 403);

  const report = await env.DB.prepare("SELECT id FROM question_reports WHERE id = ?").bind(params.id).first();
  if (!report) return json({ error: "البلاغ غير موجود" }, 404);

  await env.DB.prepare("UPDATE question_reports SET status = 'resolved' WHERE id = ?").bind(params.id).run();
  return json({ ok: true });
}
