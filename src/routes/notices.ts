import { Hono } from 'hono';
import { Env } from '../index';
import { success, error } from '../utils/response';
import { authMiddleware } from '../middleware/auth';

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

    // Map user info
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
    `).bind(id).first();

    if (!notice) {
      return error(c, 'NOT_FOUND', '공지사항을 찾을 수 없습니다.', 404);
    }

    const result: any = { ...notice };
    if (notice.character_name) {
      result.user = {
        character_name: notice.character_name,
        profile_image: notice.profile_image,
      };
    }

    return success(c, result);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 공지사항 작성 (길마/부마만)
noticeRoutes.post('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user') as any;

    // 권한 체크
    if (user.role !== 'master' && user.role !== 'submaster') {
      return error(c, 'FORBIDDEN', '공지사항 작성 권한이 없습니다.', 403);
    }

    const body = await c.req.json();
    const { title, content, is_important } = body;

    if (!title?.trim() || !content?.trim()) {
      return error(c, 'VALIDATION_ERROR', '제목과 내용을 입력해주세요.', 400);
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

// 공지사항 수정 (길마/부마만)
noticeRoutes.put('/:id', authMiddleware, async (c) => {
  try {
    const user = c.get('user') as any;
    const id = c.req.param('id');

    // 권한 체크
    if (user.role !== 'master' && user.role !== 'submaster') {
      return error(c, 'FORBIDDEN', '공지사항 수정 권한이 없습니다.', 403);
    }

    const body = await c.req.json();
    const { title, content, is_important } = body;

    if (!title?.trim() || !content?.trim()) {
      return error(c, 'VALIDATION_ERROR', '제목과 내용을 입력해주세요.', 400);
    }

    await c.env.DB.prepare(`
      UPDATE notices
      SET title = ?, content = ?, is_important = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(title.trim(), content.trim(), is_important ? 1 : 0, id).run();

    return success(c, { id });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 공지사항 삭제 (길마/부마만)
noticeRoutes.delete('/:id', authMiddleware, async (c) => {
  try {
    const user = c.get('user') as any;
    const id = c.req.param('id');

    // 권한 체크
    if (user.role !== 'master' && user.role !== 'submaster') {
      return error(c, 'FORBIDDEN', '공지사항 삭제 권한이 없습니다.', 403);
    }

    // 소프트 삭제
    await c.env.DB.prepare(`
      UPDATE notices SET is_active = 0 WHERE id = ?
    `).bind(id).run();

    return success(c, { deleted: true });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});
