// GET  /api/classes      -> الفصول اللي المستخدم صاحبها أو عضو فيها
// POST /api/classes  body: { name } -> إنشاء فصل جديد، المنشئ بيبقى صاحبه
import { getSessionUser, json } from "../../_lib/auth.js";

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "لازم تسجل دخول" }, 401);

  const ownedOnly = new URL(request.url).searchParams.get("owned") === "1";
  const { results } = ownedOnly
    ? await env.DB.prepare(
        `SELECT id, name, join_code, owner_id, created_at
         FROM classes WHERE owner_id = ? ORDER BY created_at DESC`
      ).bind(user.id).all()
    : await env.DB.prepare(
        `SELECT c.id, c.name, c.join_code, c.owner_id, c.created_at
         FROM classes c
         LEFT JOIN class_members cm ON cm.class_id = c.id AND cm.user_id = ?
         WHERE c.owner_id = ? OR cm.user_id = ?
         ORDER BY c.created_at DESC`
      ).bind(user.id, user.id, user.id).all();

  return json({ classes: results });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "لازم تسجل دخول" }, 401);

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  if (!name) return json({ error: "اكتب اسم الفصل" }, 400);

  const id = crypto.randomUUID();
  const now = Date.now();

  // كود الفصل عشوائي من 6 حروف/أرقام، فيه UNIQUE constraint في قاعدة
  // البيانات. احتمال التصادم ضئيل جداً بس بنعيد المحاولة كام مرة احتياطاً
  // بدل ما نرجع خطأ 500 للمستخدم لأسباب مش غلطته.
  let joinCode;
  let inserted = false;
  for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
    joinCode = randomCode();
    try {
      await env.DB.prepare(
        "INSERT INTO classes (id, name, join_code, owner_id, created_at) VALUES (?, ?, ?, ?, ?)"
      ).bind(id, name, joinCode, user.id, now).run();
      inserted = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("UNIQUE") || attempt === 4) throw error;
      // تصادم في join_code: جرّب كود تاني في اللفة الجاية.
    }
  }

  // المنشئ نفسه بيبقى عضو تلقائي عشان يظهر في لوحة صدارة فصله لو لعب.
  await env.DB.prepare(
    "INSERT INTO class_members (class_id, user_id, joined_at) VALUES (?, ?, ?)"
  ).bind(id, user.id, now).run();

  return json({ id, name, join_code: joinCode }, 201);
}
