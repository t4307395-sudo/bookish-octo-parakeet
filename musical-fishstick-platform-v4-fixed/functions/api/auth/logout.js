// POST /api/auth/logout
import { clearSessionCookieHeader, deleteSession, json } from "../../_lib/auth.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (env?.DB) {
    await deleteSession(request, env).catch(() => {});
  }
  return json({ ok: true }, 200, { "set-cookie": clearSessionCookieHeader() });
}
