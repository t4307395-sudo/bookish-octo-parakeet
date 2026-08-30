// GET /api/categories -> كل فئات بنك الأسئلة مع العدد الكلي (يشمل الأسئلة
// المعلّمة exam_only، على عكس /api/practice/categories اللي بتستبعدها).
// مستخدمة في index.html وقت إنشاء اختبار حقيقي، عشان المعلم يقدر يختار من
// كل البنك (بما فيه أسئلة "امتحان فقط") مش بس اللي متاح للتدريب.
export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare(
    `SELECT quiz_id, COUNT(*) as count FROM questions
     WHERE quiz_id LIKE 'bank:%' GROUP BY quiz_id ORDER BY quiz_id ASC`
  ).all();

  const categories = results.map((r) => ({
    name: r.quiz_id.slice("bank:".length),
    count: r.count,
  }));

  const generalRow = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM questions WHERE quiz_id = 'bank'`
  ).first();

  return json({ general_count: generalRow?.count || 0, categories });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
