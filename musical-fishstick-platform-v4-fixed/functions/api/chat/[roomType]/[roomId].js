// GET  /api/chat/:roomType/:roomId?since=<timestamp>  -> رسايل جديدة (polling زي results.html)
// POST /api/chat/:roomType/:roomId   body: { text }     -> إرسال رسالة
// roomType: 'class' (لازم تكون عضو فيه) أو 'quiz' (أي حد معاه كود الاختبار)
// أو 'global' (الساحة العامة: أي حد يقدر يقرأ، لازم حساب عشان يكتب - roomId ثابت 'global')
import { getSessionUser, json } from "../../../_lib/auth.js";

const MAX_LEN = 500;

async function canAccessRoom(env, user, roomType, roomId) {
  if (roomType === "class") {
    if (!user) return false;
    const member = await env.DB.prepare(
      "SELECT 1 FROM class_members WHERE class_id = ? AND user_id = ?"
    ).bind(roomId, user.id).first();
    return !!member;
  }
  if (roomType === "quiz") {
    const quiz = await env.DB.prepare("SELECT id FROM quizzes WHERE id = ?").bind(roomId).first();
    return !!quiz;
  }
  if (roomType === "global") {
    return roomId === "global";
  }
  return false;
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const user = await getSessionUser(request, env);
  const { roomType, roomId } = params;

  if (!(await canAccessRoom(env, user, roomType, roomId))) {
    return json({ error: "لا يمكنك الوصول لهذه الغرفة" }, 403);
  }

  const url = new URL(request.url);
  const since = Number(url.searchParams.get("since")) || 0;

  const { results } = await env.DB.prepare(
    `SELECT id, user_id, name, text, created_at FROM messages
     WHERE room_type = ? AND room_id = ? AND created_at > ?
     ORDER BY created_at ASC LIMIT 100`
  ).bind(roomType, roomId, since).all();

  return json({ messages: results });
}

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const user = await getSessionUser(request, env);
  const { roomType, roomId } = params;

  if (!user) return json({ error: "لازم تسجل دخول عشان تدردش" }, 401);
  if (!(await canAccessRoom(env, user, roomType, roomId))) {
    return json({ error: "لا يمكنك الوصول لهذه الغرفة" }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const text = String(body?.text || "").trim().slice(0, MAX_LEN);
  if (!text) return json({ error: "اكتب رسالة" }, 400);

  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO messages (room_type, room_id, user_id, name, text, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(roomType, roomId, user.id, user.name, text, now).run();

  return json({ ok: true, created_at: now });
}
