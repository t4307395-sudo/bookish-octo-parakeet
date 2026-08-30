// GET /api/quizzes/:id  -> quiz meta + questions WITHOUT correct_option
export async function onRequestGet(context) {
  const { env, params } = context;
  const id = params.id;
  
  const quiz = await env.DB.prepare("SELECT * FROM quizzes WHERE id = ?").bind(id).first();
  if (!quiz) return json({ error: "الاختبار غير موجود" }, 404);
  
  // سحب الأسئلة بترتيب عشوائي لكل لاعب
  const { results } = await env.DB.prepare(
    "SELECT id, order_index, text, option_a, option_b, option_c, option_d FROM questions WHERE quiz_id = ? ORDER BY RANDOM()"
  ).bind(id).all();
  
  return json({
    id: quiz.id,
    title: quiz.title,
    duration_seconds: quiz.duration_seconds,
    questions: results,
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
