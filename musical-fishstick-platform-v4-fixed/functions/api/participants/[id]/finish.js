// POST /api/participants/:id/finish   body: { started_at }
import { applyGameProgress, recordMistakes } from "../../../_lib/gamification.js";
import { verifyParticipantAccess } from "../../../_lib/auth.js";

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const participantId = params.id;
  const body = await request.json().catch(() => ({}));

  const participant = await verifyParticipantAccess(request, env, participantId);
  if (!participant) return json({ error: "رمز المحاولة غير صالح أو منتهي" }, 403);

  if (participant.finished_at) {
    return json({ score: participant.score, total_questions: participant.total_questions });
  }

  // نتأكد إننا بنعد بس الإجابات الصح اللي بتخص أسئلة اختبار المشارك ده
  // بالذات (join مع quiz_id) عشان محدش يقدر يضخم درجته بإجابات
  // مسربة من اختبارات تانية.
  const correctCount = await env.DB.prepare(
    `SELECT COUNT(*) as c
     FROM answers a
     JOIN questions q ON q.id = a.question_id
     WHERE a.participant_id = ? AND a.is_correct = 1 AND q.quiz_id = ?`
  ).bind(participantId, participant.quiz_id).first();

  const now = Date.now();
  const startedAt = participant.joined_at;
  const timeTaken = Math.max(0, Math.round((now - startedAt) / 1000));

  const quiz = await env.DB.prepare("SELECT duration_seconds FROM quizzes WHERE id = ?").bind(participant.quiz_id).first();
  const expired = quiz && timeTaken >= Number(quiz.duration_seconds);

  await env.DB.prepare(
    "UPDATE participants SET score = ?, finished_at = ?, time_taken_seconds = ? WHERE id = ?"
  ).bind(correctCount.c, now, timeTaken, participantId).run();

  // لو المشارك داخل بحساب مسجل: نضيف درجته لإجمالي نقاطه، نحدّث XP/المستوى/الـ streak،
  // ونسجل أخطاءه في بنك الأخطاء الشخصي عشان يراجعها بعدين.
  let progress = null;
  if (participant.user_id) {
    await env.DB.prepare(
      "UPDATE users SET total_points = total_points + ? WHERE id = ?"
    ).bind(correctCount.c, participant.user_id).run();

    progress = await applyGameProgress(env, participant.user_id, correctCount.c);
    await recordMistakes(env, participantId, participant.user_id, participant.quiz_id);
  }

  // لو المشارك ده طرف في تحدي (من أي ناحية)، وبعد ما يخلص نشوف هل الطرف
  // التاني خلص هو كمان؛ لو الاتنين خلصوا نحدّث حالة التحدي لـ 'completed' فعلياً
  // (مش وقت القبول بس، عشان الحالة تعكس الواقع صح).
  const challenge = await env.DB.prepare(
    "SELECT * FROM challenges WHERE from_participant_id = ? OR to_participant_id = ?"
  ).bind(participantId, participantId).first();
  if (challenge && challenge.to_participant_id) {
    const otherId = challenge.from_participant_id === participantId
      ? challenge.to_participant_id
      : challenge.from_participant_id;
    const other = await env.DB.prepare(
      "SELECT finished_at FROM participants WHERE id = ?"
    ).bind(otherId).first();
    if (other?.finished_at) {
      await env.DB.prepare(
        "UPDATE challenges SET status = 'completed' WHERE id = ?"
      ).bind(challenge.id).run();
    }
  }

  return json({
    score: correctCount.c,
    total_questions: participant.total_questions,
    time_taken_seconds: timeTaken,
    progress, // null لو ضيف؛ وإلا { xp_gained, xp, level, leveled_up, streak_count }
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
