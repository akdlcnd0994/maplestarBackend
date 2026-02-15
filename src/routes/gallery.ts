import { Hono } from 'hono';
import { Env } from '../index';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { success, error, notFound } from '../utils/response';
import { earnActivityPoints, revokeActivityPoints, hasEarnedPointsFor } from '../services/points';
import { createNotification } from './notifications';

export const galleryRoutes = new Hono<{ Bindings: Env }>();

// 갤러리 목록
galleryRoutes.get('/', optionalAuthMiddleware, async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;

    const gallery = await c.env.DB.prepare(`
      SELECT g.*, u.character_name, u.profile_image, u.default_icon, u.profile_zoom, u.active_name_color, u.active_frame, u.active_title, u.active_title_rarity
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
        active_name_color: g.active_name_color,
        active_frame: g.active_frame,
        active_title: g.active_title,
        active_title_rarity: g.active_title_rarity,
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
      SELECT g.*, u.character_name, u.profile_image, u.default_icon, u.profile_zoom, u.active_name_color, u.active_frame, u.active_title, u.active_title_rarity
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
        active_name_color: item.active_name_color,
        active_frame: item.active_frame,
        active_title: item.active_title,
        active_title_rarity: item.active_title_rarity,
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

// 댓글 목록
galleryRoutes.get('/:id/comments', async (c) => {
  try {
    const id = c.req.param('id');
    const comments = await c.env.DB.prepare(`
      SELECT gc.*, u.character_name, u.profile_image, u.default_icon, u.profile_zoom, u.role as user_role,
             u.active_name_color, u.active_frame, u.active_title, u.active_title_rarity,
             a.name as alliance_name, a.emblem as alliance_emblem, a.is_main as is_main_guild
      FROM gallery_comments gc
      LEFT JOIN users u ON gc.user_id = u.id
      LEFT JOIN alliances a ON u.alliance_id = a.id
      WHERE gc.gallery_id = ? AND gc.is_deleted = 0
      ORDER BY gc.created_at ASC
    `).bind(id).all<any>();

    const commentsWithUser = comments.results.map(c => ({
      id: c.id,
      gallery_id: c.gallery_id,
      user_id: c.user_id,
      content: c.content,
      created_at: c.created_at,
      user: {
        character_name: c.character_name,
        profile_image: c.profile_image,
        default_icon: c.default_icon,
        profile_zoom: c.profile_zoom,
        role: c.user_role,
        alliance_name: c.alliance_name,
        alliance_emblem: c.alliance_emblem,
        is_main_guild: c.is_main_guild,
        active_name_color: c.active_name_color,
        active_frame: c.active_frame,
        active_title: c.active_title,
        active_title_rarity: c.active_title_rarity,
      },
    }));

    return success(c, commentsWithUser);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 댓글 작성
galleryRoutes.post('/:id/comments', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');
    const galleryId = c.req.param('id');
    const body = await c.req.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return error(c, 'VALIDATION_ERROR', '댓글 내용을 입력해주세요.');
    }

    await c.env.DB.prepare(
      'INSERT INTO gallery_comments (gallery_id, user_id, content) VALUES (?, ?, ?)'
    ).bind(galleryId, userId, content.trim()).run();

    await c.env.DB.prepare(
      'UPDATE gallery SET comment_count = comment_count + 1 WHERE id = ?'
    ).bind(galleryId).run();

    // 포인트 지급 (자기 갤러리 댓글 제외)
    const gallery = await c.env.DB.prepare('SELECT user_id, title FROM gallery WHERE id = ?').bind(galleryId).first<{ user_id: number; title: string }>();
    let pointEarned = 0;
    if (gallery && gallery.user_id !== userId) {
      const pointResult = await earnActivityPoints(c.env.DB, userId, 'comment', `gallery_${galleryId}`);
      pointEarned = pointResult.earned ? pointResult.points : 0;

      // 알림
      const actor = await c.env.DB.prepare('SELECT character_name FROM users WHERE id = ?').bind(userId).first<{ character_name: string }>();
      await createNotification(c.env.DB, gallery.user_id, 'comment_gallery', userId, actor?.character_name || '', 'gallery', Number(galleryId), gallery.title || '', `${actor?.character_name}님이 사진에 댓글을 남겼습니다.`);
    }

    return success(c, { message: '댓글이 등록되었습니다.', pointEarned });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 댓글 삭제
galleryRoutes.delete('/:id/comments/:commentId', authMiddleware, async (c) => {
  try {
    const { userId, role } = c.get('user');
    const galleryId = c.req.param('id');
    const commentId = c.req.param('commentId');

    const comment = await c.env.DB.prepare(
      'SELECT user_id FROM gallery_comments WHERE id = ? AND gallery_id = ? AND is_deleted = 0'
    ).bind(commentId, galleryId).first<{ user_id: number }>();

    if (!comment) {
      return notFound(c, '댓글을 찾을 수 없습니다.');
    }

    if (comment.user_id !== userId && role !== 'master' && role !== 'submaster') {
      return error(c, 'FORBIDDEN', '삭제 권한이 없습니다.', 403);
    }

    await c.env.DB.prepare(
      'UPDATE gallery_comments SET is_deleted = 1 WHERE id = ?'
    ).bind(commentId).run();

    await c.env.DB.prepare(
      'UPDATE gallery SET comment_count = MAX(comment_count - 1, 0) WHERE id = ?'
    ).bind(galleryId).run();

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
      const gallery = await c.env.DB.prepare('SELECT user_id, title FROM gallery WHERE id = ?').bind(id).first<{ user_id: number; title: string }>();
      let pointEarned = 0;
      if (gallery && gallery.user_id !== userId) {
        const alreadyEarned = await hasEarnedPointsFor(c.env.DB, userId, 'like', `gallery_${id}`);
        if (!alreadyEarned) {
          const pointResult = await earnActivityPoints(c.env.DB, userId, 'like', `gallery_${id}`);
          pointEarned = pointResult.earned ? pointResult.points : 0;
        }
        // 알림: 갤러리 좋아요
        const actor = await c.env.DB.prepare('SELECT character_name FROM users WHERE id = ?').bind(userId).first<{ character_name: string }>();
        await createNotification(c.env.DB, gallery.user_id, 'like_gallery', userId, actor?.character_name || '', 'gallery', Number(id), gallery.title || '', `${actor?.character_name}님이 사진에 좋아요를 눌렀습니다.`);
      }
      return success(c, { liked: true, pointEarned });
    }
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});
