import { Hono } from 'hono';
import { Env } from '../index';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';

export const notificationRoutes = new Hono<{ Bindings: Env }>();

// 알림 목록 조회
notificationRoutes.get('/', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');
    const limit = parseInt(c.req.query('limit') || '30');
    const offset = parseInt(c.req.query('offset') || '0');

    const notifications = await c.env.DB.prepare(
      `SELECT id, type, actor_id, actor_name, target_type, target_id, target_title, message, is_read, created_at
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(userId, limit, offset).all();

    return success(c, notifications.results);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 읽지 않은 알림 수
notificationRoutes.get('/unread-count', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');
    const result = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
    ).bind(userId).first<{ count: number }>();
    return success(c, { count: result?.count || 0 });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 알림 읽음 처리
notificationRoutes.put('/:id/read', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');
    const id = c.req.param('id');
    await c.env.DB.prepare(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?'
    ).bind(id, userId).run();
    return success(c, { message: 'ok' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 전체 읽음 처리
notificationRoutes.put('/read-all', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');
    await c.env.DB.prepare(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0'
    ).bind(userId).run();
    return success(c, { message: 'ok' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

/**
 * 알림 생성 유틸 (다른 라우트에서 호출)
 */
export async function createNotification(
  db: D1Database,
  userId: number,
  type: string,
  actorId: number,
  actorName: string,
  targetType: string,
  targetId: number,
  targetTitle: string,
  message: string
): Promise<void> {
  // 자기 자신에게는 알림 안 보냄
  if (userId === actorId) return;

  try {
    await db.prepare(
      `INSERT INTO notifications (user_id, type, actor_id, actor_name, target_type, target_id, target_title, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(userId, type, actorId, actorName, targetType, targetId, targetTitle || '', message).run();
  } catch (e) {
    console.error('Failed to create notification:', e);
  }
}
