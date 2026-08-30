// POST /api/admin/questions/import   (أدمن بس - بيتأكد من الجلسة)
// body: { category?: string, exam_only?: boolean, questions: [{ text, option_a, option_b, option_c?, option_d?, correct_option }] }
//
// كل سؤال بينضاف لـ "بنك الأسئلة" (quiz_id = 'bank:<category>' لو فيه فئة،
// أو 'bank' لو مفيش) عشان لاحقاً /api/quizzes تقدر تسحب عشوائي من فئة معينة.
//
// exam_only=true: السؤال بيتحفظ لكن بيتخفى من التدريب الحر وسؤال اليوم
// (اللي بيوريا الإجابة الصح فورًا للطالب) - يفضل محجوز بس للاختبارات
// الحقيقية اللي بتتعمل من index.html، عشان تفصل بين بنك "التقييم" وبنك
// "التدريب" ومحدش يشوف إجابة امتحان جاي مقدمًا.
import { requireAdmin, json } from "../../../_lib/auth.js";

const ALLOWED_OPTIONS = new Set(["a", "b", "c", "d"]);

export async function onRequestPost(context) {
  const { request, env } = context;

  const admin = await requireAdmin(request, env);
  if (!admin) return json({ error: "محتاج تدخل كأدمن الأول" }, 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "الملف مش JSON صالح" }, 400);
  }

  const rawQuestions = Array.isArray(body?.questions) ? body.questions : null;
  if (!rawQuestions || rawQuestions.length === 0) {
    return json({ error: "لازم تبعت مصفوفة questions فيها سؤال واحد على الأقل" }, 400);
  }
  if (rawQuestions.length > 500) {
    return json({ error: "أقصى عدد أسئلة في الرفعة الواحدة هو 500" }, 400);
  }

  const category = body?.category ? String(body.category).trim() : "";
  const bankId = category ? `bank:${category}` : "bank";
  const examOnly = body?.exam_only ? 1 : 0;

  const cleaned = [];
  for (let i = 0; i < rawQuestions.length; i++) {
    const q = rawQuestions[i];
    const text = String(q?.text || "").trim();
    const optionA = String(q?.option_a || "").trim();
    const optionB = String(q?.option_b || "").trim();
    const optionC = q?.option_c ? String(q.option_c).trim() : null;
    const optionD = q?.option_d ? String(q.option_d).trim() : null;
    const correct = String(q?.correct_option || "").trim().toLowerCase();

    if (!text || !optionA || !optionB) {
      return json({ error: `السؤال رقم ${i + 1}: لازم يكون فيه نص وسؤالين اختيار (a, b) على الأقل` }, 400);
    }
    if (!ALLOWED_OPTIONS.has(correct)) {
      return json({ error: `السؤال رقم ${i + 1}: correct_option لازم يكون a أو b أو c أو d` }, 400);
    }
    if ((correct === "c" && !optionC) || (correct === "d" && !optionD)) {
      return json({ error: `السؤال رقم ${i + 1}: الإجابة الصح بتشاور على اختيار مش موجود` }, 400);
    }

    cleaned.push({ text, optionA, optionB, optionC, optionD, correct });
  }

  // نحسب order_index بحيث الأسئلة الجديدة تتضاف بعد الموجودة في نفس البنك.
  const countRow = await env.DB.prepare(
    "SELECT COUNT(*) as c FROM questions WHERE quiz_id = ?"
  ).bind(bankId).first();
  let nextIndex = countRow?.c || 0;

  const statements = cleaned.map((q) =>
    env.DB.prepare(
      `INSERT INTO questions (quiz_id, order_index, text, option_a, option_b, option_c, option_d, correct_option, exam_only)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(bankId, nextIndex++, q.text, q.optionA, q.optionB, q.optionC, q.optionD, q.correct, examOnly)
  );

  await env.DB.batch(statements);

  return json({ ok: true, inserted: cleaned.length, bank: bankId });
}
