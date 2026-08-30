// مكتبة مشتركة للتشفير وإدارة الجلسات.
// اسم المجلد بيبدأ بـ "_" عشان Cloudflare Pages ميعتبروش route بحد ذاته.

const SESSION_COOKIE = "session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 يوم

// ---------- تشفير الباسورد (PBKDF2 عبر Web Crypto، متاح في Cloudflare Workers) ----------

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hashBuffer = await deriveBits(password, salt);
  return `${toHex(salt)}:${toHex(new Uint8Array(hashBuffer))}`;
}

export async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = String(stored || "").split(":");
  if (!saltHex || !hashHex) return false;
  const salt = fromHex(saltHex);
  const hashBuffer = await deriveBits(password, salt);
  const computedHex = toHex(new Uint8Array(hashBuffer));
  return timingSafeEqual(computedHex, hashHex);
}

async function deriveBits(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
}

function toHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function fromHex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------- الجلسات ----------

export async function createSession(env, userId) {
  const token = crypto.randomUUID();
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).bind(token, userId, now, now + SESSION_TTL_MS).run();
  return { token, expiresAt: now + SESSION_TTL_MS };
}

export function sessionCookieHeader(token, maxAgeSeconds) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookieHeader() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function getCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// بتمسح الجلسة من قاعدة البيانات نفسها (مش بس الكوكي من المتصفح)، عشان لو
// حد سرق التوكن قبل الـ logout يفضلش شغال بعده.
export async function deleteSession(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return;
  await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
}

// بيرجع الـ user الحالي (من غير الباسورد) لو الجلسة صالحة، وإلا null.
export async function getSessionUser(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;

  const session = await env.DB.prepare(
    "SELECT * FROM sessions WHERE token = ?"
  ).bind(token).first();
  if (!session || session.expires_at < Date.now()) return null;

  const user = await env.DB.prepare(
    "SELECT id, email, name, role, grade, total_points, xp, level, streak_count, last_active_date, created_at FROM users WHERE id = ?"
  ).bind(session.user_id).first();
  return user || null;
}

export async function requireAdmin(request, env) {
  const user = await getSessionUser(request, env);
  if (!user || user.role !== "admin") return null;
  return user;
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

// ---------- Rate limiting بسيط (ضد محاولات تخمين الباسورد بالجملة) ----------
// بيسجل كل محاولة (ناجحة أو فاشلة) في جدول login_attempts، ويرفض لو تجاوز
// المعرّف (إيميل أو IP) الحد الأقصى في آخر نافذة زمنية. لا يحتاج أي خدمة
// خارجية (Redis/KV) - شغال بالكامل على D1 زي باقي المشروع.

export async function hashParticipantToken(token) {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(digest));
}

export async function verifyParticipantAccess(request, env, participantId) {
  const token = request.headers.get("x-participant-token");
  if (!token) return null;
  const tokenHash = await hashParticipantToken(token);
  return env.DB.prepare(
    "SELECT * FROM participants WHERE id = ? AND participant_token_hash = ?"
  ).bind(participantId, tokenHash).first();
}

export function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

// بيرجع true لو المعرّف لسه مسموح له يحاول، false لو تجاوز الحد.
export async function checkRateLimit(env, identifier, { windowMs, max }) {
  const since = Date.now() - windowMs;
  const row = await env.DB.prepare(
    "SELECT COUNT(*) as c FROM login_attempts WHERE identifier = ? AND created_at > ?"
  ).bind(identifier, since).first();
  return (row?.c || 0) < max;
}

export async function recordAttempt(env, identifier) {
  await env.DB.prepare(
    "INSERT INTO login_attempts (identifier, created_at) VALUES (?, ?)"
  ).bind(identifier, Date.now()).run();
}
