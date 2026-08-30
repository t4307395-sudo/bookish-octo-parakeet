// GET /api/mistakes -> بنك الأخطاء الشخصي للمستخدم الحالي (غير المتقنة بس)
import { getSessionUser, json } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "لازم تسجل دخول" }, 401);

  const { results } = await env.DB.prepare(
    `SELECT m.id as mistake_id, m.selected_option, m.created_at,
            q.id as question_id, q.text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option
     FROM mistakes m
     JOIN questions q ON q.id = m.question_id
     WHERE m.user_id = ? AND m.mastered = 0
     ORDER BY m.created_at DESC
     LIMIT 100`
  ).bind(user.id).all();

  return json({ mistakes: results });
}
