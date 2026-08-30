// GET /api/auth/me -> بيانات المستخدم الحالي لو مسجل دخول، وإلا null
import { getSessionUser, json } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const user = await getSessionUser(request, env);
  return json({ user });
}
