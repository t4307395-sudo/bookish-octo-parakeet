// GET /api/auth/me -> بيانات المستخدم الحالي لو مسجل دخول، وإلا null
import { getSessionUser, json } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env?.DB) return json({ user: null, error: 'قاعدة البيانات غير مرتبطة بالمشروع.' }, 503);
  try {
    const user = await getSessionUser(request, env);
    return json({ user });
  } catch {
    return json({ user: null, error: 'تعذر التحقق من الجلسة حاليًا.' }, 503);
  }
}
