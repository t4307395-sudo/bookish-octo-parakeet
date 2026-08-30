// POST /api/classes/join   body: { join_code }
import { getSessionUser, json } from "../../_lib/auth.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "لازم تسجل دخول" }, 401);

  const body = await request.json().catch(() => ({}));
  const code = String(body?.join_code || "").trim().toUpperCase();
  if (!code) return json({ error: "اكتب كود الفصل" }, 400);

  const cls = await env.DB.prepare("SELECT * FROM classes WHERE join_code = ?").bind(code).first();
  if (!cls) return json({ error: "كود الفصل غير صحيح" }, 404);

  const existing = await env.DB.prepare(
    "SELECT 1 FROM class_members WHERE class_id = ? AND user_id = ?"
  ).bind(cls.id, user.id).first();
  if (existing) return json({ id: cls.id, name: cls.name, already_member: true });

  await env.DB.prepare(
    "INSERT INTO class_members (class_id, user_id, joined_at) VALUES (?, ?, ?)"
  ).bind(cls.id, user.id, Date.now()).run();

  return json({ id: cls.id, name: cls.name });
}
