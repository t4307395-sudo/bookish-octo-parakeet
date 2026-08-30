// GET /api/admin/reports -> بلاغات الأسئلة المفتوحة (أدمن بس)
import { requireAdmin, json } from "../../../_lib/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const admin = await requireAdmin(request, env);
  if (!admin) return json({ error: "محتاج تدخل كأدمن الأول" }, 403);

  const { results } = await env.DB.prepare(
    `SELECT r.id, r.reason, r.created_at, r.question_id,
            q.text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.quiz_id
     FROM question_reports r
     JOIN questions q ON q.id = r.question_id
     WHERE r.status = 'open'
     ORDER BY r.created_at DESC
     LIMIT 100`
  ).all();

  return json({ reports: results });
}
