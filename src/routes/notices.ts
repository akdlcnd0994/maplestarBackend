import { Hono } from 'hono';
import { Env } from '../index';
import { authMiddleware, requireRole } from '../middleware/auth';
import { success, error, notFound } from '../utils/response';

export const noticeRoutes = new Hono<{ Bindings: Env }>();

// 공지사항 목록
noticeRoutes.get('/', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');

    const notices = await c.env.DB.prepare(`
      SELECT n.*, u.character_name, u.profile_image, u.default_icon, u.profile_zoom
      FROM notices n
      LEFT JOIN users u ON n.user_id = u.id
      WHERE n.is_active = 1
      ORDER BY n.is_important DESC, n.created_at DESC
      LIMIT ?
    `).bind(limit).all();

    const result = notices.results.map((n: any) => ({
      ...n,
      user: n.character_name ? {
        character_name: n.character_name,
        profile_image: n.profile_image,
        default_icon: n.default_icon,
        profile_zoom: n.profile_zoom,
      } : null,
    }));

    return success(c, result);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 공지사항 상세
noticeRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const notice = await c.env.DB.prepare(`
      SELECT n.*, u.character_name, u.profile_image, u.default_icon, u.profile_zoom
      FROM notices n
      LEFT JOIN users u ON n.user_id = u.id
      WHERE n.id = ? AND n.is_active = 1
    `).bind(id).first<any>();

    if (!notice) {
      return notFound(c, '공지사항을 찾을 수 없습니다.');
    }

    return success(c, {
      ...notice,
      user: notice.character_name ? {
        character_name: notice.character_name,
        profile_image: notice.profile_image,
        default_icon: notice.default_icon,
        profile_zoom: notice.profile_zoom,
      } : null,
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 공지사항 작성 (관리자)
noticeRoutes.post('/', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { title, content, is_important } = body;

    if (!title?.trim() || !content?.trim()) {
      return error(c, 'VALIDATION_ERROR', '제목과 내용을 입력해주세요.');
    }

    const result = await c.env.DB.prepare(`
      INSERT INTO notices (user_id, title, content, is_important, is_active, created_at)
      VALUES (?, ?, ?, ?, 1, datetime('now'))
    `).bind(user.userId, title.trim(), content.trim(), is_important ? 1 : 0).run();

    return success(c, { id: result.meta.last_row_id });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 공지사항 수정 (관리자)
noticeRoutes.put('/:id', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { title, content, is_important } = body;

    if (!title?.trim() || !content?.trim()) {
      return error(c, 'VALIDATION_ERROR', '제목과 내용을 입력해주세요.');
    }

    await c.env.DB.prepare(`
      UPDATE notices SET title = ?, content = ?, is_important = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(title.trim(), content.trim(), is_important ? 1 : 0, id).run();

    return success(c, { id });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 공지사항 삭제 (관리자)
noticeRoutes.delete('/:id', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare('UPDATE notices SET is_active = 0 WHERE id = ?').bind(id).run();
    return success(c, { deleted: true });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});
