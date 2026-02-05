import { Hono } from 'hono';
import { Env } from '../index';
import { authMiddleware, requireRole } from '../middleware/auth';
import { success, error } from '../utils/response';

export const attendanceRoutes = new Hono<{ Bindings: Env }>();

// 한국 시간 (KST = UTC+9) 기준 오늘 날짜
// 오전 5시 기준으로 하루가 바뀜 (5시 이전이면 전날 날짜)
function getTodayKST(): string {
  const now = new Date();
  // KST = UTC + 9시간
  const kstTime = now.getTime() + (9 * 60 * 60 * 1000);
  const kstDate = new Date(kstTime);

  // UTC 메서드를 명시적으로 사용하여 타임존 문제 방지
  const hours = kstDate.getUTCHours();

  // 오전 5시 이전이면 전날로 처리
  if (hours < 5) {
    kstDate.setUTCDate(kstDate.getUTCDate() - 1);
  }

  const year = kstDate.getUTCFullYear();
  const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// 한국 시간 기준 어제 날짜 (오전 5시 기준)
function getYesterdayKST(): string {
  const now = new Date();
  const kstTime = now.getTime() + (9 * 60 * 60 * 1000);
  const kstDate = new Date(kstTime);

  const hours = kstDate.getUTCHours();

  // 오전 5시 이전이면 전날로 처리
  if (hours < 5) {
    kstDate.setUTCDate(kstDate.getUTCDate() - 1);
  }

  // 그리고 하루 더 빼서 어제 날짜
  kstDate.setUTCDate(kstDate.getUTCDate() - 1);

  const year = kstDate.getUTCFullYear();
  const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// 한국 시간 기준 현재 년/월 (오전 5시 기준)
function getCurrentYearMonthKST(): { year: number; month: number } {
  const now = new Date();
  const kstTime = now.getTime() + (9 * 60 * 60 * 1000);
  const kstDate = new Date(kstTime);

  const hours = kstDate.getUTCHours();

  // 오전 5시 이전이면 전날로 처리
  if (hours < 5) {
    kstDate.setUTCDate(kstDate.getUTCDate() - 1);
  }

  return {
    year: kstDate.getUTCFullYear(),
    month: kstDate.getUTCMonth() + 1
  };
}

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

    // 이미 출석했는지 확인
    const existing = await c.env.DB.prepare(
      'SELECT id FROM attendance WHERE user_id = ? AND check_date = ?'
    ).bind(userId, today).first();

    if (existing) {
      return error(c, 'ALREADY_CHECKED', '이미 출석체크를 완료했습니다.');
    }

    // 어제 출석 여부 확인 (연속 출석 계산) - 한국시간 기준
    const yesterdayStr = getYesterdayKST();

    const yesterdayAttendance = await c.env.DB.prepare(
      'SELECT streak_count FROM attendance WHERE user_id = ? AND check_date = ?'
    ).bind(userId, yesterdayStr).first<{ streak_count: number }>();

    const streakCount = yesterdayAttendance ? yesterdayAttendance.streak_count + 1 : 1;

    // 출석체크 등록
    await c.env.DB.prepare(
      'INSERT INTO attendance (user_id, check_date, streak_count) VALUES (?, ?, ?)'
    ).bind(userId, today, streakCount).run();

    // 통계 업데이트
    const stats = await c.env.DB.prepare(
      'SELECT * FROM attendance_stats WHERE user_id = ?'
    ).bind(userId).first<any>();

    if (stats) {
      const newMaxStreak = Math.max(stats.max_streak, streakCount);
      await c.env.DB.prepare(`
        UPDATE attendance_stats
        SET total_checks = total_checks + 1,
            current_streak = ?,
            max_streak = ?,
            last_check_date = ?
        WHERE user_id = ?
      `).bind(streakCount, newMaxStreak, today, userId).run();
    } else {
      await c.env.DB.prepare(`
        INSERT INTO attendance_stats (user_id, total_checks, current_streak, max_streak, last_check_date)
        VALUES (?, 1, ?, ?, ?)
      `).bind(userId, streakCount, streakCount, today).run();
    }

    return success(c, {
      message: '출석체크 완료!',
      streak: streakCount,
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 출석 통계
attendanceRoutes.get('/stats', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');

    const stats = await c.env.DB.prepare(
      'SELECT * FROM attendance_stats WHERE user_id = ?'
    ).bind(userId).first();

    if (!stats) {
      return success(c, {
        total_checks: 0,
        current_streak: 0,
        max_streak: 0,
        last_check_date: null,
      });
    }

    return success(c, stats);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 출석 랭킹
attendanceRoutes.get('/ranking', async (c) => {
  try {
    const ranking = await c.env.DB.prepare(`
      SELECT s.*, u.character_name, u.profile_image, u.default_icon, u.profile_zoom
      FROM attendance_stats s
      LEFT JOIN users u ON s.user_id = u.id
      ORDER BY s.total_checks DESC
      LIMIT 10
    `).all<any>();

    const rankingWithUser = ranking.results.map((r, i) => ({
      rank: i + 1,
      character_name: r.character_name,
      profile_image: r.profile_image,
      default_icon: r.default_icon,
      profile_zoom: r.profile_zoom,
      total_checks: r.total_checks,
      current_streak: r.current_streak,
      max_streak: r.max_streak,
    }));

    return success(c, rankingWithUser);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 이번 달 혜택 조회 (공개)
attendanceRoutes.get('/benefits', async (c) => {
  try {
    const yearParam = c.req.query('year');
    const monthParam = c.req.query('month');

    const kstNow = getCurrentYearMonthKST();
    const year = yearParam ? parseInt(yearParam) : kstNow.year;
    const month = monthParam ? parseInt(monthParam) : kstNow.month;

    const benefits = await c.env.DB.prepare(`
      SELECT * FROM attendance_benefits WHERE year = ? AND month = ?
    `).bind(year, month).first();

    return success(c, benefits || {
      year,
      month,
      reward_5: '',
      reward_10: '',
      reward_15: '',
      reward_20: '',
      reward_full: '',
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

    // 기존 혜택 확인
    const existing = await c.env.DB.prepare(
      'SELECT id FROM attendance_benefits WHERE year = ? AND month = ?'
    ).bind(year, month).first();

    if (existing) {
      await c.env.DB.prepare(`
        UPDATE attendance_benefits
        SET reward_5 = ?, reward_10 = ?, reward_15 = ?, reward_20 = ?, reward_full = ?, updated_at = datetime('now')
        WHERE year = ? AND month = ?
      `).bind(reward_5 || '', reward_10 || '', reward_15 || '', reward_20 || '', reward_full || '', year, month).run();
    } else {
      await c.env.DB.prepare(`
        INSERT INTO attendance_benefits (year, month, reward_5, reward_10, reward_15, reward_20, reward_full)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(year, month, reward_5 || '', reward_10 || '', reward_15 || '', reward_20 || '', reward_full || '').run();
    }

    return success(c, { message: '혜택이 저장되었습니다.' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 관리자: 전체 유저 출석 현황
attendanceRoutes.get('/admin/users', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  try {
    const yearParam = c.req.query('year');
    const monthParam = c.req.query('month');

    const kstNow = getCurrentYearMonthKST();
    const year = yearParam ? parseInt(yearParam) : kstNow.year;
    const month = monthParam ? String(parseInt(monthParam)).padStart(2, '0') : String(kstNow.month).padStart(2, '0');
    const startDate = `${year}-${month}-01`;
    const endDate = `${year}-${month}-31`;

    // 모든 승인된 유저와 그들의 출석 현황
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

    // 각 유저의 출석한 날짜 목록도 가져오기
    const result = await Promise.all(users.results.map(async (user: any) => {
      const dates = await c.env.DB.prepare(`
        SELECT check_date FROM attendance
        WHERE user_id = ? AND check_date >= ? AND check_date <= ?
        ORDER BY check_date ASC
      `).bind(user.id, startDate, endDate).all<any>();

      return {
        ...user,
        attendance_dates: dates.results.map((d: any) => d.check_date),
      };
    }));

    return success(c, result);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});
