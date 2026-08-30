// POST /api/auth/register   body: { email, password, name, grade? }
// أي إيميل هيتسجل كـ "طالب"، إلا لو مطابق لـ ADMIN_EMAIL المحدد في إعدادات
// المشروع (Environment Variables) — عندها بيتسجل كـ "أدمن" تلقائياً.
import {
  hashPassword, createSession, sessionCookieHeader, json,
  checkRateLimit, recordAttempt, clientIp,
} from "../../_lib/auth.js";

// حد أقصى 10 حسابات جديدة من نفس الـ IP خلال ساعة، عشان نمنع سبام تسجيل
// حسابات وهمية بالجملة (خصوصاً إن الباسورد مش بيتطلب تفعيل إيميل).
const REGISTER_LIMIT = { windowMs: 60 * 60 * 1000, max: 10 };

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "بيانات الطلب غير صالحة" }, 400);
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const name = String(body?.name || "").trim();
  const grade = body?.grade ? String(body.grade).trim() : null;

  if (!env?.DB) {
    return json({ error: "قاعدة البيانات غير مهيأة على هذا النشر" }, 503);
  }
  const ip = clientIp(request);
  const allowed = await checkRateLimit(env, `register:${ip}`, REGISTER_LIMIT);
  if (!allowed) {
    return json({ error: "محاولات إنشاء حسابات كتير من نفس الجهاز. استنى شوية وجرب تاني." }, 429);
  }

  if (!email || !email.includes("@")) {
    return json({ error: "اكتب إيميل صحيح" }, 400);
  }
  if (password.length < 8) {
    return json({ error: "الباسورد لازم يكون 8 حروف على الأقل" }, 400);
  }
  if (!name) {
    return json({ error: "اكتب اسمك" }, 400);
  }

  // نسجّل كل محاولة (نجحت أو فشلت في التحقق) عشان تدخل في حساب حد الـ IP.
  await recordAttempt(env, `register:${ip}`);

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) {
    return json({ error: "الإيميل ده مسجل قبل كده" }, 409);
  }

  const adminEmail = (env.ADMIN_EMAIL || "").trim().toLowerCase();
  const role = adminEmail && email === adminEmail ? "admin" : "student";

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const now = Date.now();

  await env.DB.prepare(
    "INSERT INTO users (id, email, password_hash, name, role, grade, total_points, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)"
  ).bind(id, email, passwordHash, name, role, grade, now).run();

  const { token, expiresAt } = await createSession(env, id);

  return json(
    { id, email, name, role, grade },
    201,
    { "set-cookie": sessionCookieHeader(token, Math.round((expiresAt - now) / 1000)) }
  );
}
