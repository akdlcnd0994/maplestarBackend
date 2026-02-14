import { Hono } from 'hono';
import { Env } from '../index';
import { authMiddleware, requireRole } from '../middleware/auth';
import { success, error } from '../utils/response';

export const chaosRoutes = new Hono<{ Bindings: Env }>();

const VALID_STAT_ORDERS: Record<string, string> = {
  atk: 'cr.atk DESC',
  matk: 'cr.matk DESC',
  total: 'cr.total_stat DESC',
};

const VALID_UPGRADE_COUNTS = [5, 7, 9, 12];

// 랭킹 초기화 (관리자 전용)
chaosRoutes.delete('/rankings', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  try {
    await c.env.DB.prepare('DELETE FROM chaos_records').run();
    return success(c, { message: '혼줌 랭킹이 초기화되었습니다.' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', '랭킹 초기화에 실패했습니다.', 500);
  }
});

// 랭킹 조회
chaosRoutes.get('/rankings', async (c) => {
  const limit = parseInt(c.req.query('limit') || '20');
  const statType = c.req.query('stat_type') || 'total';
  const upgradeCount = c.req.query('upgrade_count');

  try {
    const orderBy = VALID_STAT_ORDERS[statType] || VALID_STAT_ORDERS.total;
    let query = `
      SELECT cr.*, u.character_name
      FROM chaos_records cr
      JOIN users u ON cr.user_id = u.id
    `;
    const params: any[] = [];

    if (upgradeCount) {
      query += ' WHERE cr.upgrade_count = ?';
      params.push(parseInt(upgradeCount));
    }

    query += ` ORDER BY ${orderBy} LIMIT ?`;
    params.push(limit);

    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    return success(c, results);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', '랭킹을 불러오지 못했습니다.', 500);
  }
});

// 기록 저장
chaosRoutes.post('/records', authMiddleware, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { atk, matk, str, dex, int, luk, total_stat, upgrade_count, innocent_used, chaos_success, chaos_fail } = body;

  if (total_stat === undefined || atk === undefined || matk === undefined) {
    return error(c, 'INVALID_INPUT', '필수 데이터가 누락되었습니다.');
  }

  const finalUpgradeCount = VALID_UPGRADE_COUNTS.includes(upgrade_count) ? upgrade_count : 5;

  try {
    await c.env.DB.prepare(`
      INSERT INTO chaos_records (user_id, atk, matk, str, dex, int, luk, total_stat, upgrade_count, innocent_used, chaos_success, chaos_fail)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      user.userId, atk, matk, str || 0, dex || 0, int || 0, luk || 0,
      total_stat, finalUpgradeCount, innocent_used || 0, chaos_success || 0, chaos_fail || 0
    ).run();

    return success(c, { message: '기록이 저장되었습니다.' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', '기록 저장에 실패했습니다.', 500);
  }
});
