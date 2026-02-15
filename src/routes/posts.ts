import { Hono } from 'hono';
import { Env } from '../index';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { success, error, notFound } from '../utils/response';
import { earnActivityPoints } from '../services/points';

export const postRoutes = new Hono<{ Bindings: Env }>();

// 게시글 목록
postRoutes.get('/', optionalAuthMiddleware, async (c) => {
  try {
    const category = c.req.query('category') || 'showoff';
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '10');
    const offset = (page - 1) * limit;

    // 카테고리 ID 조회
    const cat = await c.env.DB.prepare(
      'SELECT id FROM board_categories WHERE slug = ?'
    ).bind(category).first<{ id: number }>();

    if (!cat) {
      return error(c, 'NOT_FOUND', '카테고리를 찾을 수 없습니다.', 404);
    }

    const posts = await c.env.DB.prepare(`
      SELECT p.*, u.character_name, u.job, u.profile_image, u.default_icon, u.profile_zoom, u.role as user_role,
             u.alliance_id, a.name as alliance_name, a.emblem as alliance_emblem, a.is_main as is_main_guild,
             (SELECT GROUP_CONCAT(image_url) FROM post_images WHERE post_id = p.id) as image_urls
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN alliances a ON u.alliance_id = a.id
      WHERE p.category_id = ? AND p.is_deleted = 0
      ORDER BY p.is_notice DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(cat.id, limit, offset).all<any>();

    const countResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM posts WHERE category_id = ? AND is_deleted = 0'
    ).bind(cat.id).first<{ total: number }>();

    const total = countResult?.total || 0;

    // 이미지 URL 파싱
    const postsWithUser = posts.results.map(p => ({
      ...p,
      user: {
        character_name: p.character_name,
        job: p.job,
        profile_image: p.profile_image,
        default_icon: p.default_icon,
        profile_zoom: p.profile_zoom,
        role: p.user_role,
        alliance_id: p.alliance_id,
        alliance_name: p.alliance_name,
        alliance_emblem: p.alliance_emblem,
        is_main_guild: p.is_main_guild,
      },
      images: p.image_urls ? p.image_urls.split(',').map((url: string) => ({ image_url: url })) : [],
    }));

    return success(c, postsWithUser, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 게시글 상세
postRoutes.get('/:id', optionalAuthMiddleware, async (c) => {
  try {
    const id = c.req.param('id');

    const post = await c.env.DB.prepare(`
      SELECT p.*, u.character_name, u.job, u.profile_image, u.default_icon, u.profile_zoom, u.role as user_role,
             u.alliance_id, a.name as alliance_name, a.emblem as alliance_emblem, a.is_main as is_main_guild
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN alliances a ON u.alliance_id = a.id
      WHERE p.id = ? AND p.is_deleted = 0
    `).bind(id).first<any>();

    if (!post) {
      return notFound(c, '게시글을 찾을 수 없습니다.');
    }

    // 조회수 증가
    await c.env.DB.prepare(
      'UPDATE posts SET view_count = view_count + 1 WHERE id = ?'
    ).bind(id).run();

    // 이미지 조회
    const images = await c.env.DB.prepare(
      'SELECT * FROM post_images WHERE post_id = ? ORDER BY sort_order'
    ).bind(id).all();

    return success(c, {
      ...post,
      user: {
        character_name: post.character_name,
        job: post.job,
        profile_image: post.profile_image,
        default_icon: post.default_icon,
        profile_zoom: post.profile_zoom,
        role: post.user_role,
        alliance_id: post.alliance_id,
        alliance_name: post.alliance_name,
        alliance_emblem: post.alliance_emblem,
        is_main_guild: post.is_main_guild,
      },
      images: images.results,
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 게시글 작성
postRoutes.post('/', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');
    const body = await c.req.json();
    const { category, title, content } = body;

    if (!title || !content) {
      return error(c, 'VALIDATION_ERROR', '제목과 내용을 입력해주세요.');
    }

    const cat = await c.env.DB.prepare(
      'SELECT id FROM board_categories WHERE slug = ?'
    ).bind(category || 'showoff').first<{ id: number }>();

    if (!cat) {
      return error(c, 'NOT_FOUND', '카테고리를 찾을 수 없습니다.', 404);
    }

    const result = await c.env.DB.prepare(
      'INSERT INTO posts (category_id, user_id, title, content) VALUES (?, ?, ?, ?)'
    ).bind(cat.id, userId, title, content).run();

    const pointResult = await earnActivityPoints(c.env.DB, userId, 'post', String(result.meta.last_row_id));

    return success(c, { id: result.meta.last_row_id, pointEarned: pointResult.earned ? pointResult.points : 0 });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 게시글 수정
postRoutes.put('/:id', authMiddleware, async (c) => {
  try {
    const { userId, role } = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();
    const { title, content } = body;

    const post = await c.env.DB.prepare(
      'SELECT user_id FROM posts WHERE id = ? AND is_deleted = 0'
    ).bind(id).first<{ user_id: number }>();

    if (!post) {
      return notFound(c, '게시글을 찾을 수 없습니다.');
    }

    if (post.user_id !== userId && role !== 'master' && role !== 'submaster') {
      return error(c, 'FORBIDDEN', '수정 권한이 없습니다.', 403);
    }

    await c.env.DB.prepare(
      'UPDATE posts SET title = ?, content = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(title, content, id).run();

    return success(c, { message: '수정되었습니다.' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 게시글 삭제
postRoutes.delete('/:id', authMiddleware, async (c) => {
  try {
    const { userId, role } = c.get('user');
    const id = c.req.param('id');

    const post = await c.env.DB.prepare(
      'SELECT user_id FROM posts WHERE id = ? AND is_deleted = 0'
    ).bind(id).first<{ user_id: number }>();

    if (!post) {
      return notFound(c, '게시글을 찾을 수 없습니다.');
    }

    if (post.user_id !== userId && role !== 'master' && role !== 'submaster') {
      return error(c, 'FORBIDDEN', '삭제 권한이 없습니다.', 403);
    }

    await c.env.DB.prepare(
      'UPDATE posts SET is_deleted = 1, updated_at = datetime("now") WHERE id = ?'
    ).bind(id).run();

    return success(c, { message: '삭제되었습니다.' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 좋아요 토글
postRoutes.post('/:id/like', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');
    const id = c.req.param('id');

    const existing = await c.env.DB.prepare(
      'SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?'
    ).bind(id, userId).first();

    if (existing) {
      await c.env.DB.prepare(
        'DELETE FROM post_likes WHERE post_id = ? AND user_id = ?'
      ).bind(id, userId).run();
      await c.env.DB.prepare(
        'UPDATE posts SET like_count = like_count - 1 WHERE id = ?'
      ).bind(id).run();
      return success(c, { liked: false });
    } else {
      await c.env.DB.prepare(
        'INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)'
      ).bind(id, userId).run();
      await c.env.DB.prepare(
        'UPDATE posts SET like_count = like_count + 1 WHERE id = ?'
      ).bind(id).run();
      // 자기 게시글 좋아요는 포인트 미지급
      const post = await c.env.DB.prepare('SELECT user_id FROM posts WHERE id = ?').bind(id).first<{ user_id: number }>();
      let pointEarned = 0;
      if (post && post.user_id !== userId) {
        const pointResult = await earnActivityPoints(c.env.DB, userId, 'like', `post_${id}`);
        pointEarned = pointResult.earned ? pointResult.points : 0;
      }
      return success(c, { liked: true, pointEarned });
    }
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 이미지 업로드
postRoutes.post('/:id/images', authMiddleware, async (c) => {
  try {
    if (!c.env.BUCKET) {
      return error(c, 'NOT_CONFIGURED', '이미지 저장소가 설정되지 않았습니다.', 503);
    }
    const { userId } = c.get('user');
    const id = c.req.param('id');

    const post = await c.env.DB.prepare(
      'SELECT user_id FROM posts WHERE id = ? AND is_deleted = 0'
    ).bind(id).first<{ user_id: number }>();

    if (!post || post.user_id !== userId) {
      return error(c, 'FORBIDDEN', '권한이 없습니다.', 403);
    }

    const formData = await c.req.formData();
    const files = formData.getAll('files') as File[];
    const uploadedUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const key = `posts/${id}/${crypto.randomUUID()}.${ext}`;

      await c.env.BUCKET.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
      });

      const imageUrl = `/api/images/${key}`;
      uploadedUrls.push(imageUrl);

      await c.env.DB.prepare(
        'INSERT INTO post_images (post_id, image_key, image_url, sort_order) VALUES (?, ?, ?, ?)'
      ).bind(id, key, imageUrl, i).run();
    }

    return success(c, { urls: uploadedUrls });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 댓글 목록
postRoutes.get('/:id/comments', async (c) => {
  try {
    const id = c.req.param('id');

    const comments = await c.env.DB.prepare(`
      SELECT c.*, u.character_name, u.profile_image, u.default_icon, u.profile_zoom, u.role as user_role,
             a.name as alliance_name, a.emblem as alliance_emblem, a.is_main as is_main_guild
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN alliances a ON u.alliance_id = a.id
      WHERE c.post_id = ? AND c.is_deleted = 0
      ORDER BY c.created_at ASC
    `).bind(id).all<any>();

    const commentsWithUser = comments.results.map(c => ({
      ...c,
      user: {
        character_name: c.character_name,
        profile_image: c.profile_image,
        default_icon: c.default_icon,
        profile_zoom: c.profile_zoom,
        role: c.user_role,
        alliance_name: c.alliance_name,
        alliance_emblem: c.alliance_emblem,
        is_main_guild: c.is_main_guild,
      },
    }));

    return success(c, commentsWithUser);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 댓글 작성
postRoutes.post('/:id/comments', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');
    const postId = c.req.param('id');
    const body = await c.req.json();
    const { content, parentId } = body;

    if (!content) {
      return error(c, 'VALIDATION_ERROR', '내용을 입력해주세요.');
    }

    const result = await c.env.DB.prepare(
      'INSERT INTO comments (post_id, user_id, parent_id, content) VALUES (?, ?, ?, ?)'
    ).bind(postId, userId, parentId || null, content).run();

    await c.env.DB.prepare(
      'UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?'
    ).bind(postId).run();

    const pointResult = await earnActivityPoints(c.env.DB, userId, 'comment', String(result.meta.last_row_id));

    return success(c, { id: result.meta.last_row_id, pointEarned: pointResult.earned ? pointResult.points : 0 });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 댓글 삭제
postRoutes.delete('/:id/comments/:commentId', authMiddleware, async (c) => {
  try {
    const { userId, role } = c.get('user');
    const postId = c.req.param('id');
    const commentId = c.req.param('commentId');

    const comment = await c.env.DB.prepare(
      'SELECT user_id FROM comments WHERE id = ? AND post_id = ?'
    ).bind(commentId, postId).first<{ user_id: number }>();

    if (!comment) {
      return notFound(c, '댓글을 찾을 수 없습니다.');
    }

    if (comment.user_id !== userId && role !== 'master' && role !== 'submaster') {
      return error(c, 'FORBIDDEN', '삭제 권한이 없습니다.', 403);
    }

    await c.env.DB.prepare(
      'UPDATE comments SET is_deleted = 1 WHERE id = ?'
    ).bind(commentId).run();

    await c.env.DB.prepare(
      'UPDATE posts SET comment_count = comment_count - 1 WHERE id = ?'
    ).bind(postId).run();

    return success(c, { message: '삭제되었습니다.' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});
