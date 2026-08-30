// GET /api/history -> سجل الاختبارات التنافسية اللي خلصها المستخدم الحالي
// (بيربط participants بيوزره عبر user_id، فمحتاج المستخدم يكون داخل بحساب
// وقت ما لعب الاختبار عشان يظهر هنا).
import { getSessionUser, json } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "لازم تسجل دخول" }, 401);

  const { results } = await env.DB.prepare(
    `SELECT p.id as participant_id, p.quiz_id, q.title, p.score, p.total_questions,
            p.time_taken_seconds, p.finished_at
     FROM participants p
     JOIN quizzes q ON q.id = p.quiz_id
     WHERE p.user_id = ? AND p.finished_at IS NOT NULL
     ORDER BY p.finished_at DESC
     LIMIT 50`
  ).bind(user.id).all();

  return json({ history: results });
}
