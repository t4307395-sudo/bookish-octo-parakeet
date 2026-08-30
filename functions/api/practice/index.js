// GET /api/practice?category=...&count=10
// بيرجع دفعة أسئلة عشوائية من بنك التدريب (من غير correct_option، زي أي
// سؤال بيتبعت للاعب قبل ما يجاوب). لو مفيش category بيسحب من 'bank' العام.
import { json } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env?.DB) return json({ error: 'قاعدة البيانات غير مرتبطة بالمشروع. أضف D1 binding باسم DB ثم أعد النشر.' }, 503);
  const url = new URL(request.url);
  const category = url.searchParams.get("category")?.trim();
  const count = Math.min(Math.max(Number(url.searchParams.get("count")) || 10, 1), 50);
  const bankId = category ? `bank:${category}` : "bank";

  // exam_only=0 بس: أسئلة الامتحانات الحقيقية (اللي المعلم علّمها "امتحان
  // فقط") متتاحش هنا عشان محدش يشوف إجابتها الصح مقدمًا قبل امتحان حقيقي.
  const { results } = await env.DB.prepare(
    `SELECT id, text, option_a, option_b, option_c, option_d
     FROM questions WHERE quiz_id = ? AND exam_only = 0 ORDER BY RANDOM() LIMIT ?`
  ).bind(bankId, count).all();

  return json({ bank: bankId, questions: results });
}
