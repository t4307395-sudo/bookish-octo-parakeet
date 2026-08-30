// مكتبة مشتركة لمنطق "المنصة": XP/مستويات، Streak يومي، وتسجيل الأخطاء.
// بتتنادى من finish.js بعد ما اللاعب يخلص الاختبار، بس لو داخل بحساب مسجل.

const XP_PER_CORRECT = 10;
const XP_PER_LEVEL = 100; // كل 100 XP = مستوى جديد

function todayUTC() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

// بيرجع عدد الأيام الفارقة بين تاريخين بصيغة YYYY-MM-DD
function daysBetween(a, b) {
  const d1 = new Date(a + "T00:00:00Z");
  const d2 = new Date(b + "T00:00:00Z");
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

// بتضيف XP، تحدّث المستوى، وتحدّث الـ streak اليومي لمستخدم مسجل.
// لازم تتنادى مرة واحدة بس لكل اختبار يخلص (finish.js).
export async function applyGameProgress(env, userId, correctCount) {
  const user = await env.DB.prepare(
    "SELECT xp, level, streak_count, last_active_date FROM users WHERE id = ?"
  ).bind(userId).first();
  if (!user) return null;

  const xpGained = correctCount * XP_PER_CORRECT;
  const newXp = user.xp + xpGained;
  const newLevel = Math.floor(newXp / XP_PER_LEVEL) + 1;

  const today = todayUTC();
  let newStreak = user.streak_count || 0;
  if (!user.last_active_date) {
    newStreak = 1;
  } else {
    const diff = daysBetween(user.last_active_date, today);
    if (diff === 0) {
      // لعب قبل كده النهاردة، الـ streak متتغيرش
    } else if (diff === 1) {
      newStreak += 1; // استمرارية يوم بعد يوم
    } else if (diff > 1) {
      newStreak = 1; // انقطع، يرجع يبدأ من 1
    }
  }

  await env.DB.prepare(
    "UPDATE users SET xp = ?, level = ?, streak_count = ?, last_active_date = ? WHERE id = ?"
  ).bind(newXp, newLevel, newStreak, today, userId).run();

  return {
    xp_gained: xpGained,
    xp: newXp,
    level: newLevel,
    leveled_up: newLevel > user.level,
    streak_count: newStreak,
  };
}

// بتحفظ كل إجابة غلط في اختبار المشارك ده في بنك الأخطاء الشخصي بتاعه.
export async function recordMistakes(env, participantId, userId, quizId) {
  if (!userId) return;
  const { results: wrongAnswers = [] } = await env.DB.prepare(
    `SELECT question_id, selected_option FROM answers
     WHERE participant_id = ? AND is_correct = 0`
  ).bind(participantId).all();
  if (!wrongAnswers.length) return;

  const now = Date.now();
  const statements = wrongAnswers.map((w) =>
    env.DB.prepare(
      `INSERT INTO mistakes (user_id, question_id, quiz_id, selected_option, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(userId, w.question_id, quizId, w.selected_option, now)
  );
  await env.DB.batch(statements);
}
