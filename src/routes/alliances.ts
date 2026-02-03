import { Hono } from 'hono';
import { Env } from '../index';
import { authMiddleware, requireRole } from '../middleware/auth';
import { success, error, notFound } from '../utils/response';

export const allianceRoutes = new Hono<{ Bindings: Env }>();

// 연합 길드 목록
allianceRoutes.get('/', async (c) => {
  try {
    const alliances = await c.env.DB.prepare(`
      SELECT * FROM alliances
      ORDER BY is_main DESC, sort_order ASC
    `).all();

    return success(c, alliances.results);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 연합 길드 상세
allianceRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const alliance = await c.env.DB.prepare(
      'SELECT * FROM alliances WHERE id = ?'
    ).bind(id).first();

    if (!alliance) {
      return error(c, 'NOT_FOUND', '길드를 찾을 수 없습니다.', 404);
    }

    return success(c, alliance);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 연합 길드 추가 (관리자)
allianceRoutes.post('/', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  try {
    const body = await c.req.json();
    const { guild_name, guild_master, member_count, guild_level, description, is_main } = body;

    if (!guild_name) {
      return error(c, 'VALIDATION_ERROR', '길드 이름은 필수입니다.');
    }

    // 정렬 순서 계산
    const maxOrder = await c.env.DB.prepare('SELECT MAX(sort_order) as max FROM alliances').first<{ max: number }>();
    const sortOrder = (maxOrder?.max || 0) + 1;

    const result = await c.env.DB.prepare(`
      INSERT INTO alliances (name, master_name, member_count, guild_level, description, is_main, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      guild_name,
      guild_master || '',
      member_count || 0,
      guild_level || 1,
      description || '',
      is_main ? 1 : 0,
      sortOrder
    ).run();

    return success(c, { id: result.meta.last_row_id, message: '연합 길드가 추가되었습니다.' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 연합 길드 수정 (관리자)
allianceRoutes.put('/:id', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { guild_name, guild_master, member_count, guild_level, description, is_main } = body;

    const alliance = await c.env.DB.prepare('SELECT id FROM alliances WHERE id = ?').bind(id).first();
    if (!alliance) {
      return notFound(c, '길드를 찾을 수 없습니다.');
    }

    await c.env.DB.prepare(`
      UPDATE alliances SET name = ?, master_name = ?, member_count = ?, guild_level = ?, description = ?, is_main = ?
      WHERE id = ?
    `).bind(
      guild_name,
      guild_master || '',
      member_count || 0,
      guild_level || 1,
      description || '',
      is_main ? 1 : 0,
      id
    ).run();

    return success(c, { message: '연합 길드가 수정되었습니다.' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 연합 길드 삭제 (관리자)
allianceRoutes.delete('/:id', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  try {
    const id = c.req.param('id');

    const alliance = await c.env.DB.prepare('SELECT id, is_main FROM alliances WHERE id = ?').bind(id).first<{ id: number; is_main: number }>();
    if (!alliance) {
      return notFound(c, '길드를 찾을 수 없습니다.');
    }

    if (alliance.is_main) {
      return error(c, 'CANNOT_DELETE_MAIN', '메인 길드는 삭제할 수 없습니다.');
    }

    await c.env.DB.prepare('DELETE FROM alliances WHERE id = ?').bind(id).run();

    return success(c, { message: '연합 길드가 삭제되었습니다.' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});
