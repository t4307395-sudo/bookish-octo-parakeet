// POST /api/quizzes   (لازم تسجيل دخول - أي حساب مسجل يقدر ينشئ اختبار)
// body: { title, duration_seconds, question_count, category?, class_id? }
//
// ملحوظة (v4): إنشاء الاختبار بقى محتاج تسجيل دخول عشان يبقى ليه "مالك"
// (created_by)، وده اللي بيخلي المعلم يقدر يرجع يشوف كل اختباراته من
// GET /api/quizzes/mine بدل ما يضطر يحتفظ بكل رابط لوحده. لو عايز تربط
// الاختبار بفصل معيّن (class_id)، لازم تكون صاحب الفصل ده.
import { getSessionUser } from "../../_lib/auth.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env?.DB) {
    return json({ error: "قاعدة البيانات غير مهيأة على هذا النشر" }, 503);
  }

  const user = await getSessionUser(request, env);
  if (!user) {
    return json({ error: "لازم تسجل دخول عشان تنشئ اختبار (عشان تقدر تتابعه بعدين من صفحة اختباراتي)" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "بيانات الطلب غير صالحة" }, 400);
  }

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const durationSeconds = Number(body?.duration_seconds);
  const questionCount = Number(body?.question_count);
  const category = typeof body?.category === "string" ? body.category.trim() : "";
  const bankId = category ? `bank:${category}` : "bank";
  const requestedClassId = typeof body?.class_id === "string" ? body.class_id.trim() : "";

  if (!title) {
    return json({ error: "اكتب عنوان الاختبار" }, 400);
  }
  if (!Number.isInteger(durationSeconds) || durationSeconds < 60 || durationSeconds > 3600) {
    return json({ error: "مدة الاختبار يجب أن تكون بين دقيقة و60 دقيقة" }, 400);
  }
  if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 50) {
    return json({ error: "عدد الأسئلة يجب أن يكون بين 1 و50" }, 400);
  }

  // لو المعلم اختار فصل معيّن، نتأكد إنه فعلاً صاحبه (مش أي فصل تاني).
  let classId = null;
  if (requestedClassId) {
    const owned = await env.DB.prepare(
      "SELECT id FROM classes WHERE id = ? AND owner_id = ?"
    ).bind(requestedClassId, user.id).first();
    if (!owned) {
      return json({ error: "الفصل ده مش تابعلك أو غير موجود" }, 403);
    }
    classId = requestedClassId;
  }

  const id = crypto.randomUUID().slice(0, 8);
  const now = Date.now();

  try {
    // افحص البنك قبل إنشاء سجل الاختبار حتى لا تترك سجلات يتيمة عند الفشل.
    const { results: bankQuestions = [] } = await env.DB.prepare(
      `SELECT text, option_a, option_b, option_c, option_d, correct_option
       FROM questions WHERE quiz_id = ? ORDER BY RANDOM() LIMIT ?`
    ).bind(bankId, questionCount).all();

    if (bankQuestions.length < questionCount) {
      return json({
        error: `عدد الأسئلة المتاحة في البنك هو ${bankQuestions.length} فقط، بينما طلبت ${questionCount}.`,
        available_questions: bankQuestions.length,
      }, 400);
    }

    await env.DB.prepare(
      "INSERT INTO quizzes (id, title, duration_seconds, created_at, status, created_by, class_id) VALUES (?, ?, ?, ?, 'active', ?, ?)"
    ).bind(id, title, durationSeconds, now, user.id, classId).run();

    const statements = bankQuestions.map((question, index) =>
      env.DB.prepare(
        `INSERT INTO questions
         (quiz_id, order_index, text, option_a, option_b, option_c, option_d, correct_option)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        index,
        question.text,
        question.option_a,
        question.option_b,
        question.option_c || null,
        question.option_d || null,
        String(question.correct_option).trim().toLowerCase()
      )
    );

    await env.DB.batch(statements);
    return json({ id, invite_url: `/play.html?quiz=${id}` });
  } catch (error) {
    // محاولة تنظيف السجل إذا فشل إدراج الأسئلة بعد إنشاء الاختبار.
    try {
      await env.DB.batch([
        env.DB.prepare("DELETE FROM questions WHERE quiz_id = ?").bind(id),
        env.DB.prepare("DELETE FROM quizzes WHERE id = ?").bind(id),
      ]);
    } catch {
      // لا نخفي الخطأ الأصلي إذا فشل التنظيف أيضاً.
    }

    console.error("create quiz failed", {
      message: error instanceof Error ? error.message : String(error),
      quizId: id,
    });
    return json({ error: "حدث خطأ داخلي أثناء إنشاء الاختبار" }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
