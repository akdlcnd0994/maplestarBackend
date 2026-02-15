import { Hono } from 'hono';
import { Env } from '../index';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { hashPassword, verifyPassword } from '../utils/password';
import { signJWT } from '../utils/jwt';
import { getBalance } from '../services/points';

export const authRoutes = new Hono<{ Bindings: Env }>();

// 회원가입
authRoutes.post('/signup', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password, character_name, job, level, discord, alliance_id } = body;

    if (!username || !password || !character_name) {
      return error(c, 'VALIDATION_ERROR', '필수 항목을 입력해주세요.');
    }

    if (username.length < 4 || username.length > 12) {
      return error(c, 'VALIDATION_ERROR', '아이디는 4-12자여야 합니다.');
    }

    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      return error(c, 'VALIDATION_ERROR', '아이디는 영문/숫자만 가능합니다.');
    }

    if (password.length < 8) {
      return error(c, 'VALIDATION_ERROR', '비밀번호는 8자 이상이어야 합니다.');
    }

    // 중복 체크
    const existing = await c.env.DB.prepare(
      'SELECT id FROM users WHERE username = ?'
    ).bind(username).first();

    if (existing) {
      return error(c, 'DUPLICATE_ERROR', '이미 사용 중인 아이디입니다.');
    }

    // 선택한 길드가 본 길드인지 연합 길드인지 확인
    let role = 'member';
    if (alliance_id) {
      const alliance = await c.env.DB.prepare(
        'SELECT is_main FROM alliances WHERE id = ?'
      ).bind(alliance_id).first<{ is_main: number }>();
      role = alliance?.is_main ? 'member' : 'honorary';
    }

    const passwordHash = await hashPassword(password);

    const result = await c.env.DB.prepare(
      `INSERT INTO users (username, password_hash, character_name, job, level, discord, alliance_id, role, is_approved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).bind(username, passwordHash, character_name, job || '', level || 1, discord || '', alliance_id || null, role).run();

    return success(c, { id: result.meta.last_row_id, message: '회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 로그인
authRoutes.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password } = body;

    if (!username || !password) {
      return error(c, 'VALIDATION_ERROR', '아이디와 비밀번호를 입력해주세요.');
    }

    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE username = ?'
    ).bind(username).first<any>();

    if (!user) {
      return error(c, 'AUTH_ERROR', '아이디 또는 비밀번호가 일치하지 않습니다.');
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return error(c, 'AUTH_ERROR', '아이디 또는 비밀번호가 일치하지 않습니다.');
    }

    if (!user.is_approved) {
      return error(c, 'NOT_APPROVED', '가입 승인 대기 중입니다.');
    }

    // 로그인 시간 업데이트
    await c.env.DB.prepare(
      'UPDATE users SET last_login_at = datetime("now"), is_online = 1 WHERE id = ?'
    ).bind(user.id).run();

    const secret = c.env.JWT_SECRET;
    const token = await signJWT({
      userId: user.id,
      username: user.username,
      role: user.role,
    }, secret);

    const { password_hash, ...userData } = user;

    return success(c, { token, user: userData });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 내 정보 조회
authRoutes.get('/me', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');

    const user = await c.env.DB.prepare(`
      SELECT u.id, u.username, u.character_name, u.job, u.level, u.discord,
             u.profile_image, u.default_icon, u.profile_zoom, u.role, u.alliance_id, u.is_online, u.created_at,
             u.active_name_color, u.active_frame, u.active_title,
             (SELECT ci.rarity FROM customization_items ci
              JOIN user_customizations uc ON uc.item_id = ci.id
              WHERE uc.user_id = u.id AND uc.is_equipped = 1 AND ci.type = 'title'
              LIMIT 1) as active_title_rarity,
             a.name as alliance_name, a.emblem as alliance_emblem, a.is_main as is_main_guild
      FROM users u
      LEFT JOIN alliances a ON u.alliance_id = a.id
      WHERE u.id = ?
    `).bind(userId).first();

    if (!user) {
      return error(c, 'NOT_FOUND', '사용자를 찾을 수 없습니다.', 404);
    }

    const pointBalance = await getBalance(c.env.DB, userId);

    return success(c, { ...user, point_balance: pointBalance });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 프로필 수정
authRoutes.put('/profile', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');
    const body = await c.req.json();
    const { job, level, discord, default_icon, clear_profile_image, profile_zoom } = body;

    // profile_zoom만 업데이트하는 경우
    if (profile_zoom !== undefined && Object.keys(body).length === 1) {
      await c.env.DB.prepare(
        'UPDATE users SET profile_zoom = ?, updated_at = datetime("now") WHERE id = ?'
      ).bind(profile_zoom, userId).run();
      return success(c, { message: '확대 설정이 저장되었습니다.' });
    }

    // 아이콘 선택 시 profile_image를 null로 설정
    if (default_icon && clear_profile_image) {
      await c.env.DB.prepare(
        'UPDATE users SET job = ?, level = ?, discord = ?, default_icon = ?, profile_image = NULL, profile_zoom = COALESCE(?, profile_zoom), updated_at = datetime("now") WHERE id = ?'
      ).bind(job || '', level || 100, discord || '', default_icon, profile_zoom || null, userId).run();
    } else {
      await c.env.DB.prepare(
        'UPDATE users SET job = ?, level = ?, discord = ?, default_icon = ?, profile_zoom = COALESCE(?, profile_zoom), updated_at = datetime("now") WHERE id = ?'
      ).bind(job || '', level || 100, discord || '', default_icon || null, profile_zoom || null, userId).run();
    }

    return success(c, { message: '프로필이 수정되었습니다.' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 프로필 이미지 업로드
authRoutes.post('/profile/image', authMiddleware, async (c) => {
  try {
    if (!c.env.BUCKET) {
      return error(c, 'NOT_CONFIGURED', '이미지 저장소가 설정되지 않았습니다.', 503);
    }
    const { userId } = c.get('user');
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return error(c, 'VALIDATION_ERROR', '이미지를 선택해주세요.');
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const key = `profiles/${userId}/${crypto.randomUUID()}.${ext}`;

    await c.env.BUCKET.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });

    // R2 퍼블릭 URL (설정에 따라 다름)
    const imageUrl = `/api/images/${key}`;

    await c.env.DB.prepare(
      'UPDATE users SET profile_image = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(imageUrl, userId).run();

    return success(c, { url: imageUrl });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 내가 쓴 글 목록
authRoutes.get('/my-posts', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;

    const posts = await c.env.DB.prepare(`
      SELECT p.*, bc.name as category_name, bc.slug as category_slug
      FROM posts p
      LEFT JOIN board_categories bc ON p.category_id = bc.id
      WHERE p.user_id = ? AND p.is_deleted = 0
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all<any>();

    const countResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM posts WHERE user_id = ? AND is_deleted = 0'
    ).bind(userId).first<{ total: number }>();

    return success(c, posts.results, {
      page,
      limit,
      total: countResult?.total || 0,
      totalPages: Math.ceil((countResult?.total || 0) / limit),
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 내가 쓴 댓글 목록
authRoutes.get('/my-comments', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;

    const comments = await c.env.DB.prepare(`
      SELECT c.*, p.title as post_title, p.id as post_id, bc.slug as category_slug
      FROM comments c
      LEFT JOIN posts p ON c.post_id = p.id
      LEFT JOIN board_categories bc ON p.category_id = bc.id
      WHERE c.user_id = ? AND c.is_deleted = 0
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all<any>();

    const countResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM comments WHERE user_id = ? AND is_deleted = 0'
    ).bind(userId).first<{ total: number }>();

    return success(c, comments.results, {
      page,
      limit,
      total: countResult?.total || 0,
      totalPages: Math.ceil((countResult?.total || 0) / limit),
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 내가 쓴 갤러리 목록
authRoutes.get('/my-gallery', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;

    const gallery = await c.env.DB.prepare(`
      SELECT * FROM gallery
      WHERE user_id = ? AND is_deleted = 0
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all<any>();

    const countResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM gallery WHERE user_id = ? AND is_deleted = 0'
    ).bind(userId).first<{ total: number }>();

    return success(c, gallery.results, {
      page,
      limit,
      total: countResult?.total || 0,
      totalPages: Math.ceil((countResult?.total || 0) / limit),
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 참여했던 일정 목록
authRoutes.get('/my-events', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;

    const events = await c.env.DB.prepare(`
      SELECT e.*, ep.status as participation_status, ep.created_at as joined_at
      FROM event_participants ep
      LEFT JOIN events e ON ep.event_id = e.id
      WHERE ep.user_id = ?
      ORDER BY e.event_date DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all<any>();

    const countResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM event_participants WHERE user_id = ?'
    ).bind(userId).first<{ total: number }>();

    return success(c, events.results, {
      page,
      limit,
      total: countResult?.total || 0,
      totalPages: Math.ceil((countResult?.total || 0) / limit),
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 가입 신청 (비로그인)
authRoutes.post('/register', async (c) => {
  try {
    const formData = await c.req.formData();
    const characterName = formData.get('character_name') as string;
    const job = formData.get('job') as string;
    const level = formData.get('level') as string;
    const discord = formData.get('discord') as string;
    const message = formData.get('message') as string;
    const allianceId = formData.get('alliance_id') as string;
    const imageFile = formData.get('image') as File | null;

    if (!characterName || !job || !level || !discord || !allianceId) {
      return error(c, 'VALIDATION_ERROR', '필수 항목을 입력해주세요.');
    }

    // 선택한 길드가 본 길드인지 연합 길드인지 확인
    const alliance = await c.env.DB.prepare(
      'SELECT is_main FROM alliances WHERE id = ?'
    ).bind(parseInt(allianceId)).first<{ is_main: number }>();

    // 연합 길드면 명예길드원(honorary), 본 길드면 일반 member
    const role = alliance?.is_main ? 'member' : 'honorary';

    // 임시 아이디/비번 생성 (가입 신청용)
    const tempUsername = `pending_${Date.now()}`;
    const tempPassword = await hashPassword(crypto.randomUUID());

    let profileImage = '';
    if (imageFile && c.env.BUCKET) {
      const ext = imageFile.name.split('.').pop()?.toLowerCase() || 'png';
      const key = `profiles/pending/${crypto.randomUUID()}.${ext}`;
      await c.env.BUCKET.put(key, await imageFile.arrayBuffer(), {
        httpMetadata: { contentType: imageFile.type },
      });
      profileImage = `/api/images/${key}`;
    }

    await c.env.DB.prepare(
      `INSERT INTO users (username, password_hash, character_name, job, level, discord, profile_image, alliance_id, role, is_approved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).bind(tempUsername, tempPassword, characterName, job, parseInt(level), discord, profileImage, parseInt(allianceId), role).run();

    return success(c, { message: '가입 신청이 완료되었습니다.' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});
