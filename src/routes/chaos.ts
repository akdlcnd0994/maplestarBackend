import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

type Variables = {
  user: {
    userId: number;
    username: string;
    role: string;
  };
};

export const chaosRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 랭킹 초기화 (관리자 전용)
chaosRoutes.delete('/rankings', authMiddleware, async (c) => {
  const user = c.get('user');

  // 관리자 권한 체크
  if (user.role !== 'master' && user.role !== 'submaster') {
    return error(c, 'FORBIDDEN', '관리자 권한이 필요합니다.', 403);
  }

  try {
    await c.env.DB.prepare(`DELETE FROM chaos_records`).run();
    return success(c, { message: '혼줌 랭킹이 초기화되었습니다.' });
  } catch (e) {
    console.error('Error resetting chaos rankings:', e);
    return error(c, 'SERVER_ERROR', '랭킹 초기화에 실패했습니다.', 500);
  }
});

// 랭킹 조회 (stat_type: atk, matk, total / upgrade_count: 5, 7, 9, 11)
chaosRoutes.get('/rankings', async (c) => {
  const limit = parseInt(c.req.query('limit') || '20');
  const statType = c.req.query('stat_type') || 'total'; // atk, matk, total
  const upgradeCount = c.req.query('upgrade_count'); // 5, 7, 9, 11 or null for all

  try {
    let orderBy = 'cr.total_stat DESC';
    if (statType === 'atk') {
      orderBy = 'cr.atk DESC';
    } else if (statType === 'matk') {
      orderBy = 'cr.matk DESC';
    }

    let whereClause = '1=1';
    const params: any[] = [];

    if (upgradeCount) {
      whereClause += ' AND cr.upgrade_count = ?';
      params.push(parseInt(upgradeCount));
    }

    params.push(limit);

    const { results } = await c.env.DB.prepare(`
      SELECT
        cr.id,
        cr.user_id,
        cr.atk,
        cr.matk,
        cr.str,
        cr.dex,
        cr.int,
        cr.luk,
        cr.total_stat,
        cr.upgrade_count,
        cr.innocent_used,
        cr.chaos_success,
        cr.chaos_fail,
        cr.created_at,
        u.character_name
      FROM chaos_records cr
      JOIN users u ON cr.user_id = u.id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ?
    `).bind(...params).all();

    return success(c, results);
  } catch (e: any) {
    console.error('Error fetching chaos rankings:', e);
    return error(c, 'SERVER_ERROR', '랭킹을 불러오지 못했습니다.', 500);
  }
});

// 기록 저장
chaosRoutes.post('/records', authMiddleware, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();

  const { atk, matk, str, dex, int, luk, total_stat, upgrade_count, innocent_used, chaos_success, chaos_fail } = body;

  if (total_stat === undefined || atk === undefined || matk === undefined) {
    return error(c, 'INVALID_INPUT', '필수 데이터가 누락되었습니다.', 400);
  }

  // upgrade_count 유효성 검사
  const validUpgradeCounts = [5, 7, 9, 12];
  const finalUpgradeCount = validUpgradeCounts.includes(upgrade_count) ? upgrade_count : 5;

  try {
    await c.env.DB.prepare(`
      INSERT INTO chaos_records (user_id, atk, matk, str, dex, int, luk, total_stat, upgrade_count, innocent_used, chaos_success, chaos_fail)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      user.userId,
      atk,
      matk,
      str || 0,
      dex || 0,
      int || 0,
      luk || 0,
      total_stat,
      finalUpgradeCount,
      innocent_used || 0,
      chaos_success || 0,
      chaos_fail || 0
    ).run();

    return success(c, { message: '기록이 저장되었습니다.' });
  } catch (e: any) {
    console.error('Error saving chaos record:', e);
    return error(c, 'SERVER_ERROR', '기록 저장에 실패했습니다.', 500);
  }
});

export default chaosRoutes;
