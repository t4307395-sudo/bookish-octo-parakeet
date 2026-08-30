// GET /api/quizzes/:id/results -> leaderboard for all participants of this quiz
export async function onRequestGet(context) {
  const { env, params } = context;
  const quizId = params.id;

  const quiz = await env.DB.prepare("SELECT * FROM quizzes WHERE id = ?").bind(quizId).first();
  if (!quiz) return json({ error: "الاختبار غير موجود" }, 404);

  const { results } = await env.DB.prepare(
    `SELECT id, name, score, total_questions, time_taken_seconds, finished_at
     FROM participants WHERE quiz_id = ? ORDER BY finished_at IS NULL, score DESC, time_taken_seconds ASC`
  ).bind(quizId).all();

  const allFinished = results.length > 0 && results.every((p) => p.finished_at !== null);

  return json({
    quiz_title: quiz.title,
    all_finished: allFinished,
    participants: results,
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
