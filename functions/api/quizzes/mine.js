// GET /api/quizzes/mine -> كل الاختبارات اللي أنشأها المستخدم الحالي
// (لازم تسجيل دخول). بيرجع لكل اختبار: عدد المشاركين اللي خلصوا، ومتوسط
// درجاتهم، عشان المعلم يقدر يتابع كل اختباراته من مكان واحد من غير ما
// يحتاج يحتفظ بكل رابط لوحده.
import { getSessionUser, json } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env?.DB) return json({ error: "قاعدة البيانات غير مهيأة على هذا النشر" }, 503);
  let user;
  try {
    user = await getSessionUser(request, env);
  } catch {
    return json({ error: "تعذر التحقق من الجلسة حاليًا" }, 503);
  }
  if (!user) return json({ error: "لازم تسجل دخول" }, 401);

  try {
    const { results } = await env.DB.prepare(
      `SELECT q.id, q.title, q.created_at, q.duration_seconds, q.status, q.class_id,
              COUNT(CASE WHEN p.finished_at IS NOT NULL THEN 1 END) as finished_count,
              COUNT(p.id) as joined_count,
              AVG(CASE WHEN p.finished_at IS NOT NULL THEN p.score END) as avg_score,
              MAX(p.total_questions) as total_questions
       FROM quizzes q
       LEFT JOIN participants p ON p.quiz_id = q.id
       WHERE q.created_by = ?
       GROUP BY q.id
       ORDER BY q.created_at DESC
       LIMIT 100`
    ).bind(user.id).all();
    return json({ quizzes: results });
  } catch (error) {
    console.error("load my quizzes failed", { message: error instanceof Error ? error.message : String(error) });
    return json({ error: "تعذر تحميل اختباراتك. تأكد من تحديث مخطط قاعدة البيانات ثم أعد المحاولة." }, 500);
  }
}
