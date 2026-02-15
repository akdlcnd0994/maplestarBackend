import { Hono } from 'hono';
import { Env } from '../index';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { success, error, notFound } from '../utils/response';
import { earnActivityPoints, revokeActivityPoints, hasEarnedPointsFor } from '../services/points';

export const galleryRoutes = new Hono<{ Bindings: Env }>();

// 갤러리 목록
galleryRoutes.get('/', optionalAuthMiddleware, async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;

    const gallery = await c.env.DB.prepare(`
      SELECT g.*, u.character_name, u.profile_image, u.default_icon, u.profile_zoom
      FROM gallery g
      LEFT JOIN users u ON g.user_id = u.id
      WHERE g.is_deleted = 0
      ORDER BY g.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all<any>();

    const countResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM gallery WHERE is_deleted = 0'
    ).first<{ total: number }>();

    const total = countResult?.total || 0;

    const galleryWithUser = gallery.results.map(g => ({
      ...g,
      user: {
        character_name: g.character_name,
        profile_image: g.profile_image,
        default_icon: g.default_icon,
        profile_zoom: g.profile_zoom,
      },
    }));

    return success(c, galleryWithUser, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 갤러리 상세
galleryRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const item = await c.env.DB.prepare(`
      SELECT g.*, u.character_name, u.profile_image, u.default_icon, u.profile_zoom
      FROM gallery g
      LEFT JOIN users u ON g.user_id = u.id
      WHERE g.id = ? AND g.is_deleted = 0
    `).bind(id).first<any>();

    if (!item) {
      return notFound(c, '이미지를 찾을 수 없습니다.');
    }

    // 조회수 증가
    await c.env.DB.prepare(
      'UPDATE gallery SET view_count = view_count + 1 WHERE id = ?'
    ).bind(id).run();

    return success(c, {
      ...item,
      user: {
        character_name: item.character_name,
        profile_image: item.profile_image,
        default_icon: item.default_icon,
        profile_zoom: item.profile_zoom,
      },
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 갤러리 업로드
galleryRoutes.post('/', authMiddleware, async (c) => {
  try {
    if (!c.env.BUCKET) {
      return error(c, 'NOT_CONFIGURED', '이미지 저장소가 설정되지 않았습니다.', 503);
    }
    const { userId } = c.get('user');
    const formData = await c.req.formData();

    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const file = formData.get('file') as File;

    if (!title || !file) {
      return error(c, 'VALIDATION_ERROR', '제목과 이미지를 입력해주세요.');
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const uuid = crypto.randomUUID();
    const key = `gallery/original/${uuid}.${ext}`;

    await c.env.BUCKET.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });

    const imageUrl = `/api/images/${key}`;

    const result = await c.env.DB.prepare(
      `INSERT INTO gallery (user_id, title, description, image_key, image_url)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(userId, title, description || '', key, imageUrl).run();

    const pointResult = await earnActivityPoints(c.env.DB, userId, 'gallery', String(result.meta.last_row_id));

    return success(c, { id: result.meta.last_row_id, url: imageUrl, pointEarned: pointResult.earned ? pointResult.points : 0 });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 갤러리 수정
galleryRoutes.put('/:id', authMiddleware, async (c) => {
  try {
    const { userId, role } = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();
    const { title, description } = body;

    const item = await c.env.DB.prepare(
      'SELECT user_id FROM gallery WHERE id = ? AND is_deleted = 0'
    ).bind(id).first<{ user_id: number }>();

    if (!item) {
      return notFound(c, '이미지를 찾을 수 없습니다.');
    }

    if (item.user_id !== userId && role !== 'master' && role !== 'submaster') {
      return error(c, 'FORBIDDEN', '수정 권한이 없습니다.', 403);
    }

    await c.env.DB.prepare(
      'UPDATE gallery SET title = ?, description = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(title, description || '', id).run();

    return success(c, { message: '수정되었습니다.' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 갤러리 삭제
galleryRoutes.delete('/:id', authMiddleware, async (c) => {
  try {
    const { userId, role } = c.get('user');
    const id = c.req.param('id');

    const item = await c.env.DB.prepare(
      'SELECT user_id, image_key FROM gallery WHERE id = ? AND is_deleted = 0'
    ).bind(id).first<{ user_id: number; image_key: string }>();

    if (!item) {
      return notFound(c, '이미지를 찾을 수 없습니다.');
    }

    if (item.user_id !== userId && role !== 'master' && role !== 'submaster') {
      return error(c, 'FORBIDDEN', '삭제 권한이 없습니다.', 403);
    }

    // R2에서 이미지 삭제
    if (c.env.BUCKET) {
      try {
        await c.env.BUCKET.delete(item.image_key);
      } catch {}
    }

    await c.env.DB.prepare(
      'UPDATE gallery SET is_deleted = 1, updated_at = datetime("now") WHERE id = ?'
    ).bind(id).run();

    // 갤러리 업로드 포인트 회수 (본인 삭제 시)
    if (item.user_id === userId) {
      await revokeActivityPoints(c.env.DB, userId, 'gallery', String(id));
    }

    return success(c, { message: '삭제되었습니다.' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 좋아요 토글
galleryRoutes.post('/:id/like', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');
    const id = c.req.param('id');

    const existing = await c.env.DB.prepare(
      'SELECT id FROM gallery_likes WHERE gallery_id = ? AND user_id = ?'
    ).bind(id, userId).first();

    if (existing) {
      await c.env.DB.prepare(
        'DELETE FROM gallery_likes WHERE gallery_id = ? AND user_id = ?'
      ).bind(id, userId).run();
      await c.env.DB.prepare(
        'UPDATE gallery SET like_count = like_count - 1 WHERE id = ?'
      ).bind(id).run();
      return success(c, { liked: false });
    } else {
      await c.env.DB.prepare(
        'INSERT INTO gallery_likes (gallery_id, user_id) VALUES (?, ?)'
      ).bind(id, userId).run();
      await c.env.DB.prepare(
        'UPDATE gallery SET like_count = like_count + 1 WHERE id = ?'
      ).bind(id).run();
      // 자기 갤러리 좋아요는 포인트 미지급 + 이미 받은 좋아요 포인트 중복 방지
      const gallery = await c.env.DB.prepare('SELECT user_id FROM gallery WHERE id = ?').bind(id).first<{ user_id: number }>();
      let pointEarned = 0;
      if (gallery && gallery.user_id !== userId) {
        const alreadyEarned = await hasEarnedPointsFor(c.env.DB, userId, 'like', `gallery_${id}`);
        if (!alreadyEarned) {
          const pointResult = await earnActivityPoints(c.env.DB, userId, 'like', `gallery_${id}`);
          pointEarned = pointResult.earned ? pointResult.points : 0;
        }
      }
      return success(c, { liked: true, pointEarned });
    }
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});
