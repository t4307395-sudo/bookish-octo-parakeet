// GET /api/classes/:id/leaderboard -> لوحة صدارة الفصل ده بس (مش عامة)
import { getSessionUser, json } from "../../../_lib/auth.js";

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "لازم تسجل دخول" }, 401);

  const membership = await env.DB.prepare(
    "SELECT 1 FROM class_members WHERE class_id = ? AND user_id = ?"
  ).bind(params.id, user.id).first();
  if (!membership) return json({ error: "أنت لست عضواً في هذا الفصل" }, 403);

  const { results } = await env.DB.prepare(
    `SELECT u.id, u.name, u.total_points, u.xp, u.level, u.streak_count
     FROM class_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.class_id = ?
     ORDER BY u.total_points DESC, u.name ASC`
  ).bind(params.id).all();

  return json({ students: results });
}
