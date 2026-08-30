// POST /api/auth/login   body: { email, password }
import {
  verifyPassword, createSession, sessionCookieHeader, json,
  checkRateLimit, recordAttempt,
} from "../../_lib/auth.js";

// 8 محاولات فاشلة كحد أقصى لكل إيميل خلال 15 دقيقة.
const LOGIN_LIMIT = { windowMs: 15 * 60 * 1000, max: 8 };

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

  if (!email || !password) {
    return json({ error: "اكتب الإيميل والباسورد" }, 400);
  }
  if (!env?.DB) {
    return json({ error: "قاعدة البيانات غير مهيأة على هذا النشر" }, 503);
  }

  // نحسب المحاولات على مستوى الإيميل نفسه (مش IP) عشان نمنع تخمين باسورد
  // حساب معيّن، حتى لو المهاجم بيغيّر IP.
  const allowed = await checkRateLimit(env, email, LOGIN_LIMIT);
  if (!allowed) {
    return json({ error: "محاولات دخول كتير غلط على الإيميل ده. استنى 15 دقيقة وجرب تاني." }, 429);
  }

  const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  // نفس رسالة الخطأ في الحالتين (إيميل مش موجود / باسورد غلط) عشان محدش
  // يقدر يكتشف إيه الإيميلات المسجلة في المنصة.
  const genericError = async () => {
    await recordAttempt(env, email);
    return json({ error: "الإيميل أو الباسورد غلط" }, 401);
  };

  if (!user) return genericError();
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return genericError();

  const { token, expiresAt } = await createSession(env, user.id);
  const now = Date.now();

  return json(
    { id: user.id, email: user.email, name: user.name, role: user.role, grade: user.grade },
    200,
    { "set-cookie": sessionCookieHeader(token, Math.round((expiresAt - now) / 1000)) }
  );
}
