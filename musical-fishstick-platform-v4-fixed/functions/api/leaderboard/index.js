// GET /api/leaderboard?grade=...&limit=50&period=all|week|month
// لوحة صدارة عامة. period=all (افتراضي) = إجمالي النقاط المخزن في users.total_points.
// period=week/month = نقاط الاختبارات اللي خلصت فعلياً في آخر 7/30 يوم بس (بتتحسب
// وقت الطلب من جدول participants، مش من عمود مخزن، عشان تفضل صحيحة مع الوقت).
import { json } from "../../_lib/auth.js";

const PERIOD_DAYS = { week: 7, month: 30 };

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const grade = url.searchParams.get("grade")?.trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);
  const period = url.searchParams.get("period") === "week" || url.searchParams.get("period") === "month"
    ? url.searchParams.get("period")
    : "all";

  if (period === "all") {
    let query = `SELECT id, name, grade, total_points AS points FROM users WHERE role = 'student'`;
    const binds = [];
    if (grade) {
      query += ` AND grade = ?`;
      binds.push(grade);
    }
    query += ` ORDER BY points DESC, name ASC LIMIT ?`;
    binds.push(limit);

    const { results } = await env.DB.prepare(query).bind(...binds).all();
    return json({ students: results, period });
  }

  const sinceTs = Date.now() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000;
  let query = `
    SELECT u.id, u.name, u.grade, COALESCE(SUM(p.score), 0) AS points
    FROM participants p
    JOIN users u ON u.id = p.user_id
    WHERE p.finished_at IS NOT NULL AND p.finished_at >= ? AND u.role = 'student'`;
  const binds = [sinceTs];
  if (grade) {
    query += ` AND u.grade = ?`;
    binds.push(grade);
  }
  query += ` GROUP BY u.id HAVING points > 0 ORDER BY points DESC, u.name ASC LIMIT ?`;
  binds.push(limit);

  const { results } = await env.DB.prepare(query).bind(...binds).all();
  return json({ students: results, period });
}
