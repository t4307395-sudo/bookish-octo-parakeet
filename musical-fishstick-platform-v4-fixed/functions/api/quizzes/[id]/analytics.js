// GET /api/quizzes/:id/analytics -> نسبة الإجابة الصح لكل سؤال في الاختبار ده
// عبر كل المشاركين اللي جاوبوا. بتساعد المعلم يكتشف الأسئلة اللي "ملغومة"
// (غامضة أو غلط) لو نسبة الصح فيها منخفضة جداً بشكل غير متوقع، أو الأسئلة
// السهلة جداً اللي مش بتفرّق بين الطلاب.
export async function onRequestGet(context) {
  const { env, params } = context;
  const quizId = params.id;

  const quiz = await env.DB.prepare("SELECT id, title FROM quizzes WHERE id = ?").bind(quizId).first();
  if (!quiz) return json({ error: "الاختبار غير موجود" }, 404);

  const { results } = await env.DB.prepare(
    `SELECT q.id as question_id, q.order_index, q.text,
            COUNT(a.id) as total_answers,
            SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers
     FROM questions q
     LEFT JOIN answers a ON a.question_id = q.id
     WHERE q.quiz_id = ?
     GROUP BY q.id
     ORDER BY q.order_index ASC`
  ).bind(quizId).all();

  const questions = results.map((r) => ({
    question_id: r.question_id,
    text: r.text,
    total_answers: r.total_answers,
    correct_answers: r.correct_answers,
    correct_rate: r.total_answers > 0 ? Math.round((r.correct_answers / r.total_answers) * 100) : null,
  }));

  return json({ quiz_title: quiz.title, questions });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
