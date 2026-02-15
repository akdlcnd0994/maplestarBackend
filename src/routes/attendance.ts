import { Hono } from 'hono';
import { Env } from '../index';
import { authMiddleware, requireRole } from '../middleware/auth';
import { success, error } from '../utils/response';
import { getTodayKST, getYesterdayKST, getCurrentYearMonthKST } from '../utils/date';
import { earnActivityPoints } from '../services/points';

export const attendanceRoutes = new Hono<{ Bindings: Env }>();

// 이번 달 또는 특정 달 출석 현황
attendanceRoutes.get('/', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');
    const yearParam = c.req.query('year');
    const monthParam = c.req.query('month');

    const kstNow = getCurrentYearMonthKST();
    const year = yearParam ? parseInt(yearParam) : kstNow.year;
    const month = monthParam ? String(parseInt(monthParam)).padStart(2, '0') : String(kstNow.month).padStart(2, '0');
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`;

    const attendance = await c.env.DB.prepare(`
      SELECT * FROM attendance
      WHERE user_id = ? AND check_date >= ? AND check_date <= ?
      ORDER BY check_date ASC
    `).bind(userId, startDate, endDate).all();

    return success(c, attendance.results);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 출석체크
attendanceRoutes.post('/check', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');
    const today = getTodayKST();

    const existing = await c.env.DB.prepare(
      'SELECT id FROM attendance WHERE user_id = ? AND check_date = ?'
    ).bind(userId, today).first();

    if (existing) {
      return error(c, 'ALREADY_CHECKED', '이미 출석체크를 완료했습니다.');
    }

    const yesterdayStr = getYesterdayKST();
    const yesterdayAttendance = await c.env.DB.prepare(
      'SELECT streak_count FROM attendance WHERE user_id = ? AND check_date = ?'
    ).bind(userId, yesterdayStr).first<{ streak_count: number }>();

    const streakCount = yesterdayAttendance ? yesterdayAttendance.streak_count + 1 : 1;

    const stats = await c.env.DB.prepare(
      'SELECT * FROM attendance_stats WHERE user_id = ?'
    ).bind(userId).first<any>();

    const statements: D1PreparedStatement[] = [
      c.env.DB.prepare(
        'INSERT INTO attendance (user_id, check_date, streak_count) VALUES (?, ?, ?)'
      ).bind(userId, today, streakCount),
    ];

    if (stats) {
      statements.push(
        c.env.DB.prepare(`
          UPDATE attendance_stats
          SET total_checks = total_checks + 1, current_streak = ?, max_streak = ?, last_check_date = ?
          WHERE user_id = ?
        `).bind(streakCount, Math.max(stats.max_streak, streakCount), today, userId)
      );
    } else {
      statements.push(
        c.env.DB.prepare(`
          INSERT INTO attendance_stats (user_id, total_checks, current_streak, max_streak, last_check_date)
          VALUES (?, 1, ?, ?, ?)
        `).bind(userId, streakCount, streakCount, today)
      );
    }

    await c.env.DB.batch(statements);

    // 포인트 지급
    const pointResult = await earnActivityPoints(c.env.DB, userId, 'attendance', today);

    return success(c, { message: '출석체크 완료!', streak: streakCount, pointEarned: pointResult.earned ? pointResult.points : 0 });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 출석 통계
attendanceRoutes.get('/stats', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');
    const today = getTodayKST();

    const stats = await c.env.DB.prepare(
      'SELECT * FROM attendance_stats WHERE user_id = ?'
    ).bind(userId).first();

    if (!stats) {
      return success(c, {
        total_checks: 0, current_streak: 0, max_streak: 0,
        last_check_date: null, server_today: today, checked_today: false,
      });
    }

    return success(c, {
      ...stats, server_today: today, checked_today: stats.last_check_date === today,
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 출석 랭킹 (월별)
attendanceRoutes.get('/ranking', async (c) => {
  try {
    const yearParam = c.req.query('year');
    const monthParam = c.req.query('month');

    const kstNow = getCurrentYearMonthKST();
    const year = yearParam ? parseInt(yearParam) : kstNow.year;
    const month = monthParam ? String(parseInt(monthParam)).padStart(2, '0') : String(kstNow.month).padStart(2, '0');
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`;

    const ranking = await c.env.DB.prepare(`
      SELECT
        a.user_id,
        COUNT(*) as month_checks,
        u.character_name, u.profile_image, u.default_icon, u.profile_zoom,
        u.active_name_color, u.active_frame, u.active_title, u.active_title_rarity,
        COALESCE(s.current_streak, 0) as current_streak
      FROM attendance a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN attendance_stats s ON a.user_id = s.user_id
      WHERE a.check_date >= ? AND a.check_date <= ?
      GROUP BY a.user_id
      ORDER BY month_checks DESC, MAX(a.check_date) DESC
      LIMIT 10
    `).bind(startDate, endDate).all<any>();

    return success(c, {
      year: parseInt(String(year)),
      month: parseInt(month),
      ranking: ranking.results.map((r: any, i: number) => ({
        rank: i + 1,
        character_name: r.character_name,
        profile_image: r.profile_image,
        default_icon: r.default_icon,
        profile_zoom: r.profile_zoom,
        active_name_color: r.active_name_color,
        active_frame: r.active_frame,
        active_title: r.active_title,
        active_title_rarity: r.active_title_rarity,
        month_checks: r.month_checks,
        current_streak: r.current_streak,
      })),
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 이번 달 혜택 조회
attendanceRoutes.get('/benefits', async (c) => {
  try {
    const yearParam = c.req.query('year');
    const monthParam = c.req.query('month');

    const kstNow = getCurrentYearMonthKST();
    const year = yearParam ? parseInt(yearParam) : kstNow.year;
    const month = monthParam ? parseInt(monthParam) : kstNow.month;

    const benefits = await c.env.DB.prepare(
      'SELECT * FROM attendance_benefits WHERE year = ? AND month = ?'
    ).bind(year, month).first();

    return success(c, benefits || {
      year, month, reward_5: '', reward_10: '', reward_15: '', reward_20: '', reward_full: '',
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 혜택 설정 (관리자)
attendanceRoutes.post('/benefits', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  try {
    const body = await c.req.json();
    const { year, month, reward_5, reward_10, reward_15, reward_20, reward_full } = body;

    if (!year || !month) {
      return error(c, 'VALIDATION_ERROR', '년도와 월을 입력해주세요.');
    }

    await c.env.DB.prepare(`
      INSERT INTO attendance_benefits (year, month, reward_5, reward_10, reward_15, reward_20, reward_full)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(year, month) DO UPDATE SET
        reward_5 = excluded.reward_5, reward_10 = excluded.reward_10,
        reward_15 = excluded.reward_15, reward_20 = excluded.reward_20,
        reward_full = excluded.reward_full, updated_at = datetime('now')
    `).bind(year, month, reward_5 || '', reward_10 || '', reward_15 || '', reward_20 || '', reward_full || '').run();

    return success(c, { message: '혜택이 저장되었습니다.' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 관리자: 전체 유저 출석 현황 (N+1 쿼리 수정)
attendanceRoutes.get('/admin/users', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  try {
    const yearParam = c.req.query('year');
    const monthParam = c.req.query('month');

    const kstNow = getCurrentYearMonthKST();
    const year = yearParam ? parseInt(yearParam) : kstNow.year;
    const month = monthParam ? String(parseInt(monthParam)).padStart(2, '0') : String(kstNow.month).padStart(2, '0');
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`;

    // 1. 모든 승인된 유저와 통계
    const users = await c.env.DB.prepare(`
      SELECT
        u.id, u.character_name, u.profile_image, u.default_icon, u.profile_zoom,
        COALESCE(s.total_checks, 0) as total_checks,
        COALESCE(s.current_streak, 0) as current_streak,
        COALESCE(s.max_streak, 0) as max_streak,
        s.last_check_date,
        (SELECT COUNT(*) FROM attendance a WHERE a.user_id = u.id AND a.check_date >= ? AND a.check_date <= ?) as month_count
      FROM users u
      LEFT JOIN attendance_stats s ON u.id = s.user_id
      WHERE u.is_approved = 1
      ORDER BY month_count DESC, u.character_name ASC
    `).bind(startDate, endDate).all<any>();

    // 2. 해당 월의 모든 출석 기록을 한 번에 조회
    const allAttendance = await c.env.DB.prepare(`
      SELECT user_id, check_date FROM attendance
      WHERE check_date >= ? AND check_date <= ?
      ORDER BY check_date ASC
    `).bind(startDate, endDate).all<any>();

    // 유저별 출석 날짜 맵 구성
    const attendanceMap = new Map<number, string[]>();
    for (const row of allAttendance.results) {
      if (!attendanceMap.has(row.user_id)) {
        attendanceMap.set(row.user_id, []);
      }
      attendanceMap.get(row.user_id)!.push(row.check_date);
    }

    const result = users.results.map((user: any) => ({
      ...user,
      attendance_dates: attendanceMap.get(user.id) || [],
    }));

    return success(c, result);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});
