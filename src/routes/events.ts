import { Hono } from 'hono';
import { Env } from '../index';
import { authMiddleware, requireRole } from '../middleware/auth';
import { success, error, notFound } from '../utils/response';
import { getTodayKST } from '../utils/date';

export const eventRoutes = new Hono<{ Bindings: Env }>();

// 이벤트 목록
eventRoutes.get('/', async (c) => {
  try {
    const today = getTodayKST();

    const events = await c.env.DB.prepare(`
      SELECT * FROM events
      WHERE is_active = 1 AND event_date >= ?
      ORDER BY event_date ASC, event_time ASC
    `).bind(today).all();

    return success(c, events.results);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 이벤트 상세
eventRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const event = await c.env.DB.prepare(
      'SELECT * FROM events WHERE id = ?'
    ).bind(id).first();

    if (!event) {
      return notFound(c, '이벤트를 찾을 수 없습니다.');
    }

    const participants = await c.env.DB.prepare(`
      SELECT ep.*, u.character_name, u.job, u.level
      FROM event_participants ep
      LEFT JOIN users u ON ep.user_id = u.id
      WHERE ep.event_id = ?
    `).bind(id).all<any>();

    return success(c, {
      ...event,
      participants: participants.results.map((p: any) => ({
        id: p.id, user_id: p.user_id, character_name: p.character_name,
        job: p.job, level: p.level, status: p.status,
      })),
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 이벤트 참가 신청/취소
eventRoutes.post('/:id/join', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');
    const id = c.req.param('id');

    const event = await c.env.DB.prepare(
      'SELECT * FROM events WHERE id = ? AND is_active = 1'
    ).bind(id).first<any>();

    if (!event) {
      return notFound(c, '이벤트를 찾을 수 없습니다.');
    }

    const existing = await c.env.DB.prepare(
      'SELECT id FROM event_participants WHERE event_id = ? AND user_id = ?'
    ).bind(id, userId).first();

    if (existing) {
      await c.env.DB.batch([
        c.env.DB.prepare('DELETE FROM event_participants WHERE event_id = ? AND user_id = ?').bind(id, userId),
        c.env.DB.prepare('UPDATE events SET current_participants = current_participants - 1 WHERE id = ?').bind(id),
      ]);
      return success(c, { joined: false, message: '참가가 취소되었습니다.' });
    }

    if (event.max_participants && event.current_participants >= event.max_participants) {
      return error(c, 'FULL', '정원이 가득 찼습니다.');
    }

    await c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO event_participants (event_id, user_id, status) VALUES (?, ?, "confirmed")').bind(id, userId),
      c.env.DB.prepare('UPDATE events SET current_participants = current_participants + 1 WHERE id = ?').bind(id),
    ]);

    return success(c, { joined: true, message: '참가 신청이 완료되었습니다!' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 이벤트 생성 (관리자)
eventRoutes.post('/', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  try {
    const body = await c.req.json();
    const { title, description, event_date, event_time, event_type, max_participants } = body;

    if (!title || !event_date) {
      return error(c, 'VALIDATION_ERROR', '제목과 날짜는 필수입니다.');
    }

    const result = await c.env.DB.prepare(`
      INSERT INTO events (title, description, event_date, event_time, event_type, max_participants, current_participants, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 0, 1)
    `).bind(title, description || '', event_date, event_time || '20:00', event_type || 'event', max_participants || null).run();

    return success(c, { id: result.meta.last_row_id, message: '일정이 등록되었습니다.' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 이벤트 수정 (관리자)
eventRoutes.put('/:id', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { title, description, event_date, event_time, event_type, max_participants, is_active } = body;

    const event = await c.env.DB.prepare('SELECT id FROM events WHERE id = ?').bind(id).first();
    if (!event) return notFound(c, '이벤트를 찾을 수 없습니다.');

    await c.env.DB.prepare(`
      UPDATE events SET title = ?, description = ?, event_date = ?, event_time = ?, event_type = ?, max_participants = ?, is_active = ?, updated_at = datetime("now")
      WHERE id = ?
    `).bind(title, description || '', event_date, event_time || '20:00', event_type || 'event', max_participants || null, is_active !== undefined ? (is_active ? 1 : 0) : 1, id).run();

    return success(c, { message: '일정이 수정되었습니다.' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 이벤트 삭제 (관리자)
eventRoutes.delete('/:id', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  try {
    const id = c.req.param('id');

    const event = await c.env.DB.prepare('SELECT id FROM events WHERE id = ?').bind(id).first();
    if (!event) return notFound(c, '이벤트를 찾을 수 없습니다.');

    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM event_participants WHERE event_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM events WHERE id = ?').bind(id),
    ]);

    return success(c, { message: '일정이 삭제되었습니다.' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 참가자 목록 조회
eventRoutes.get('/:id/participants', async (c) => {
  try {
    const id = c.req.param('id');

    const participants = await c.env.DB.prepare(`
      SELECT ep.*, u.character_name, u.job, u.level, u.profile_image, u.default_icon, u.profile_zoom
      FROM event_participants ep
      LEFT JOIN users u ON ep.user_id = u.id
      WHERE ep.event_id = ?
      ORDER BY ep.created_at ASC
    `).bind(id).all<any>();

    return success(c, participants.results.map((p: any) => ({
      id: p.id, user_id: p.user_id, character_name: p.character_name,
      job: p.job, level: p.level, profile_image: p.profile_image,
      default_icon: p.default_icon, profile_zoom: p.profile_zoom, status: p.status,
    })));
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});
