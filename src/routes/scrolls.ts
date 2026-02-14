import { Hono } from 'hono';
import { Env } from '../index';
import { authMiddleware, requireRole } from '../middleware/auth';
import { success, error } from '../utils/response';
import { earnActivityPoints } from '../services/points';

export const scrollRoutes = new Hono<{ Bindings: Env }>();

// 주문서 랭킹 조회
scrollRoutes.get('/rankings', async (c) => {
  const limit = parseInt(c.req.query('limit') || '50');

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT sr.*, u.character_name, u.username
      FROM scroll_records sr
      JOIN users u ON sr.user_id = u.id
      ORDER BY sr.total_stat DESC, sr.success_count DESC, sr.created_at DESC
      LIMIT ?
    `).bind(limit).all();

    return success(c, results);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', '랭킹을 불러오지 못했습니다.', 500);
  }
});

// 주문서 랭킹 초기화 (관리자 전용)
scrollRoutes.delete('/rankings', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  try {
    await c.env.DB.prepare('DELETE FROM scroll_records').run();
    return success(c, { message: '주문서 랭킹이 초기화되었습니다.' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', '랭킹 초기화에 실패했습니다.', 500);
  }
});

// 내 기록 조회
scrollRoutes.get('/my-records', authMiddleware, async (c) => {
  const user = c.get('user');

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM scroll_records
      WHERE user_id = ?
      ORDER BY total_stat DESC, created_at DESC
      LIMIT 20
    `).bind(user.userId).all();

    return success(c, results);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', '기록을 불러오지 못했습니다.', 500);
  }
});

// 기록 저장
scrollRoutes.post('/records', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { item_id, item_name, success_count, fail_count, total_stat, stat_type } = body;

    if (!item_name || success_count === undefined || total_stat === undefined) {
      return error(c, 'VALIDATION_ERROR', '필수 데이터가 누락되었습니다.');
    }

    const existing = await c.env.DB.prepare(`
      SELECT id, total_stat FROM scroll_records
      WHERE user_id = ? AND item_id = ?
      ORDER BY total_stat DESC LIMIT 1
    `).bind(user.userId, item_id || 1).first();

    const isNewRecord = !existing || total_stat > (existing.total_stat as number);

    if (isNewRecord) {
      const statements: D1PreparedStatement[] = [];

      if (existing) {
        statements.push(
          c.env.DB.prepare('DELETE FROM scroll_records WHERE id = ?').bind(existing.id)
        );
      }

      statements.push(
        c.env.DB.prepare(`
          INSERT INTO scroll_records (user_id, item_id, item_name, success_count, fail_count, total_stat, stat_type)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(user.userId, item_id || 1, item_name, success_count || 0, fail_count || 0, total_stat || 0, stat_type || 'atk')
      );

      await c.env.DB.batch(statements);
    }

    const pointResult = await earnActivityPoints(c.env.DB, user.userId, 'scroll', String(item_id || 1));

    return success(c, {
      isNewRecord,
      message: isNewRecord ? '새로운 최고 기록!' : '기존 기록이 더 좋습니다.',
      pointEarned: pointResult.earned ? pointResult.points : 0,
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', '기록 저장에 실패했습니다.', 500);
  }
});
