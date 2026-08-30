// GET /api/practice/categories -> قائمة الفئات المتاحة في بنك التدريب مع عدد أسئلة كل فئة
// (مستخرجة من quiz_id بصيغة 'bank:<فئة>'؛ 'bank' العام مبيتحسبش فئة مسماة).
import { json } from "../../../_lib/auth.js";

export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare(
    `SELECT quiz_id, COUNT(*) as count FROM questions
     WHERE quiz_id LIKE 'bank:%' AND exam_only = 0 GROUP BY quiz_id ORDER BY quiz_id ASC`
  ).all();

  const categories = results.map((r) => ({
    name: r.quiz_id.slice("bank:".length),
    count: r.count,
  }));

  const generalRow = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM questions WHERE quiz_id = 'bank' AND exam_only = 0`
  ).first();

  return json({ general_count: generalRow?.count || 0, categories });
}
