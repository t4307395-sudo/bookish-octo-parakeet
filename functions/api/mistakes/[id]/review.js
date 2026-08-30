// POST /api/mistakes/:id/review   body: { selected_option }
// بيتنادى لما الطالب يراجع سؤال من بنك أخطائه. لو جاوب صح بيتحول mastered=1
// (بيختفي من الليستة)، لو غلط تاني بيفضل ظاهر عشان يحاول تاني.
import { getSessionUser, json } from "../../../_lib/auth.js";

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "لازم تسجل دخول" }, 401);

  const mistake = await env.DB.prepare(
    "SELECT m.*, q.correct_option FROM mistakes m JOIN questions q ON q.id = m.question_id WHERE m.id = ? AND m.user_id = ?"
  ).bind(params.id, user.id).first();
  if (!mistake) return json({ error: "السؤال غير موجود في بنك أخطائك" }, 404);

  const body = await request.json().catch(() => ({}));
  const selected = String(body?.selected_option || "").trim().toLowerCase();
  const isCorrect = selected === String(mistake.correct_option).trim().toLowerCase();

  if (isCorrect) {
    await env.DB.prepare("UPDATE mistakes SET mastered = 1 WHERE id = ?").bind(mistake.id).run();
  }

  return json({ correct: isCorrect, correct_option: mistake.correct_option });
}
