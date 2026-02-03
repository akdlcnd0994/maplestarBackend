import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
  JWT_SECRET: string;
};

type Variables = {
  user: {
    userId: number;
    username: string;
    role: string;
  };
};

export const scrollRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 주문서 랭킹 조회
scrollRoutes.get('/rankings', async (c) => {
  const limit = parseInt(c.req.query('limit') || '50');

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT
        sr.*,
        u.character_name,
        u.username
      FROM scroll_records sr
      JOIN users u ON sr.user_id = u.id
      ORDER BY sr.total_stat DESC, sr.success_count DESC, sr.created_at DESC
      LIMIT ?
    `).bind(limit).all();

    return c.json({ success: true, data: results });
  } catch (e) {
    console.error('Error fetching scroll rankings:', e);
    return c.json({ success: false, error: 'Failed to fetch rankings' }, 500);
  }
});

// 주문서 랭킹 초기화 (관리자 전용)
scrollRoutes.delete('/rankings', authMiddleware, async (c) => {
  const user = c.get('user');

  // 관리자 권한 체크
  if (user.role !== 'master' && user.role !== 'submaster') {
    return c.json({ success: false, error: '관리자 권한이 필요합니다.' }, 403);
  }

  try {
    await c.env.DB.prepare(`DELETE FROM scroll_records`).run();
    return c.json({ success: true, message: '주문서 랭킹이 초기화되었습니다.' });
  } catch (e) {
    console.error('Error resetting scroll rankings:', e);
    return c.json({ success: false, error: '랭킹 초기화에 실패했습니다.' }, 500);
  }
});

// 내 기록 조회
scrollRoutes.get('/my-records', authMiddleware, async (c) => {
  const user = c.get('user');

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT *
      FROM scroll_records
      WHERE user_id = ?
      ORDER BY total_stat DESC, created_at DESC
      LIMIT 20
    `).bind(user.userId).all();

    return c.json({ success: true, data: results });
  } catch (e) {
    console.error('Error fetching my scroll records:', e);
    return c.json({ success: false, error: 'Failed to fetch records' }, 500);
  }
});

// 기록 저장
scrollRoutes.post('/records', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    if (!user || !user.userId) {
      return c.json({ success: false, error: 'User not authenticated' }, 401);
    }

    const body = await c.req.json();
    const { item_id, item_name, success_count, fail_count, total_stat, stat_type } = body;

    if (!item_name || success_count === undefined || total_stat === undefined) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }

    // 기존 최고 기록 조회
    const existing = await c.env.DB.prepare(`
      SELECT id, total_stat FROM scroll_records
      WHERE user_id = ? AND item_id = ?
      ORDER BY total_stat DESC
      LIMIT 1
    `).bind(user.userId, item_id || 1).first();

    // 새 기록이 더 좋으면 저장 (또는 처음이면 저장)
    const isNewRecord = !existing || total_stat > (existing.total_stat as number);

    if (isNewRecord) {
      // 기존 기록 삭제 (같은 아이템)
      if (existing) {
        await c.env.DB.prepare(`
          DELETE FROM scroll_records WHERE id = ?
        `).bind(existing.id).run();
      }

      // 새 기록 저장
      await c.env.DB.prepare(`
        INSERT INTO scroll_records (user_id, item_id, item_name, success_count, fail_count, total_stat, stat_type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        user.userId,
        item_id || 1,
        item_name,
        success_count || 0,
        fail_count || 0,
        total_stat || 0,
        stat_type || 'atk'
      ).run();
    }

    return c.json({
      success: true,
      isNewRecord,
      message: isNewRecord ? '새로운 최고 기록!' : '기존 기록이 더 좋습니다.'
    });
  } catch (e: any) {
    console.error('Error saving scroll record:', e?.message || e);
    return c.json({ success: false, error: `Failed to save record: ${e?.message || 'Unknown error'}` }, 500);
  }
});

export default scrollRoutes;
