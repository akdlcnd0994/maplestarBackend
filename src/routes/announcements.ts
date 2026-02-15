import { Hono } from 'hono';
import { Env } from '../index';
import { authMiddleware, requireRole } from '../middleware/auth';
import { success, error, notFound } from '../utils/response';
import { logAdminAction } from '../services/points';
import { getKSTTimestamp } from '../utils/date';

const announcements = new Hono<{ Bindings: Env }>();

// ==================== 사용자 API ====================

// 안 읽은 공지 팝업 목록 (로그인 사용자)
announcements.get('/unread', authMiddleware, async (c) => {
  const user = c.get('user');
  const { date, time } = getKSTTimestamp();
  const now = `${date} ${time}`;

  const unread = await c.env.DB.prepare(
    `SELECT a.id, a.title, a.content, a.type, a.priority, a.created_at
     FROM announcements a
     WHERE a.is_active = 1
       AND (a.start_date IS NULL OR a.start_date <= ?)
       AND (a.end_date IS NULL OR a.end_date >= ?)
       AND a.id NOT IN (
         SELECT announcement_id FROM announcement_reads WHERE user_id = ?
       )
     ORDER BY a.priority DESC, a.created_at DESC`
  ).bind(now, now, user.userId).all();

  return success(c, unread.results);
});

// 공지 팝업 읽음 처리
announcements.post('/:id/read', authMiddleware, async (c) => {
  const user = c.get('user');
  const id = parseInt(c.req.param('id'));

  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO announcement_reads (user_id, announcement_id, read_at)
     VALUES (?, ?, datetime('now'))`
  ).bind(user.userId, id).run();

  return success(c, { message: '확인 완료' });
});

// 전체 공지 목록 (공개)
announcements.get('/', async (c) => {
  const { date, time } = getKSTTimestamp();
  const now = `${date} ${time}`;
  const items = await c.env.DB.prepare(
    `SELECT id, title, content, type, priority, created_at
     FROM announcements
     WHERE is_active = 1
       AND (start_date IS NULL OR start_date <= ?)
       AND (end_date IS NULL OR end_date >= ?)
     ORDER BY priority DESC, created_at DESC
     LIMIT 20`
  ).bind(now, now).all();

  return success(c, items.results);
});

// ==================== 어드민 API ====================

// 전체 공지 목록 (비활성 포함)
announcements.get('/admin/list', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  const items = await c.env.DB.prepare(
    `SELECT a.*, u.character_name as created_by_name
     FROM announcements a
     JOIN users u ON u.id = a.created_by
     ORDER BY a.created_at DESC`
  ).all();
  return success(c, items.results);
});

// 공지 생성
announcements.post('/admin', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  const admin = c.get('user');
  const { title, content, type = 'info', priority = 0, start_date, end_date } = await c.req.json();

  if (!title || !content) {
    return error(c, 'INVALID_INPUT', '제목과 내용은 필수입니다.');
  }

  const validTypes = ['info', 'feature', 'event', 'maintenance'];
  if (!validTypes.includes(type)) {
    return error(c, 'INVALID_INPUT', '유효하지 않은 공지 유형입니다.');
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO announcements (title, content, type, priority, start_date, end_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(title, content, type, priority, start_date || null, end_date || null, admin.userId).run();

  await logAdminAction(c.env.DB, admin.userId, 'create_announcement', 'announcement', String(result.meta?.last_row_id), {
    title, type,
  });

  return success(c, { id: result.meta?.last_row_id, message: '공지가 등록되었습니다.' });
});

// 공지 수정
announcements.put('/admin/:id', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  const admin = c.get('user');
  const id = parseInt(c.req.param('id'));
  const { title, content, type, priority, is_active, start_date, end_date } = await c.req.json();

  const existing = await c.env.DB.prepare('SELECT id FROM announcements WHERE id = ?').bind(id).first();
  if (!existing) return notFound(c, '공지를 찾을 수 없습니다.');

  await c.env.DB.prepare(
    `UPDATE announcements SET
       title = COALESCE(?, title),
       content = COALESCE(?, content),
       type = COALESCE(?, type),
       priority = COALESCE(?, priority),
       is_active = COALESCE(?, is_active),
       start_date = COALESCE(?, start_date),
       end_date = COALESCE(?, end_date),
       updated_at = datetime('now')
     WHERE id = ?`
  ).bind(title ?? null, content ?? null, type ?? null, priority ?? null, is_active ?? null, start_date ?? null, end_date ?? null, id).run();

  await logAdminAction(c.env.DB, admin.userId, 'update_announcement', 'announcement', String(id), {
    title, type, is_active,
  });

  return success(c, { message: '공지가 수정되었습니다.' });
});

// 공지 삭제
announcements.delete('/admin/:id', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  const admin = c.get('user');
  const id = parseInt(c.req.param('id'));

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM announcement_reads WHERE announcement_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM announcements WHERE id = ?').bind(id),
  ]);

  await logAdminAction(c.env.DB, admin.userId, 'delete_announcement', 'announcement', String(id), {});

  return success(c, { message: '공지가 삭제되었습니다.' });
});

export const announcementRoutes = announcements;
