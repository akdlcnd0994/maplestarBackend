import { Hono } from 'hono';
import { Env } from '../index';
import { authMiddleware, requireRole } from '../middleware/auth';
import { success, error, notFound } from '../utils/response';

export const memberRoutes = new Hono<{ Bindings: Env }>();

// 길드원 목록 (온라인 상태: 최근 12시간 내 로그인)
memberRoutes.get('/', async (c) => {
  try {
    const online = c.req.query('online');
    const role = c.req.query('role');
    const allianceId = c.req.query('alliance_id');
    const pending = c.req.query('pending');
    const limit = parseInt(c.req.query('limit') || '100');

    // pending=true면 미승인 유저 목록 반환
    if (pending === 'true') {
      const pendingUsers = await c.env.DB.prepare(`
        SELECT u.id, u.character_name, u.job, u.level, u.discord, u.profile_image, u.default_icon, u.profile_zoom,
               u.alliance_id, u.role, u.created_at,
               a.name as alliance_name, a.emblem as alliance_emblem, a.is_main as is_main_guild
        FROM users u
        LEFT JOIN alliances a ON u.alliance_id = a.id
        WHERE u.is_approved = 0
        ORDER BY u.created_at DESC
      `).all();
      return success(c, pendingUsers.results);
    }

    // 12시간 기준으로 온라인 상태 계산
    let query = `
      SELECT
        u.id, u.character_name, u.job, u.level, u.profile_image, u.default_icon, u.profile_zoom, u.role,
        u.alliance_id, u.last_login_at, u.created_at,
        a.name as alliance_name, a.emblem as alliance_emblem, a.is_main as is_main_guild,
        CASE
          WHEN u.last_login_at IS NOT NULL AND datetime(u.last_login_at) > datetime('now', '-12 hours')
          THEN 1
          ELSE 0
        END as is_online
      FROM users u
      LEFT JOIN alliances a ON u.alliance_id = a.id
      WHERE u.is_approved = 1
    `;
    const params: any[] = [];

    if (online === 'true') {
      query += ' AND u.last_login_at IS NOT NULL AND datetime(u.last_login_at) > datetime("now", "-12 hours")';
    }

    if (role) {
      query += ' AND u.role = ?';
      params.push(role);
    }

    if (allianceId) {
      query += ' AND u.alliance_id = ?';
      params.push(parseInt(allianceId));
    }

    query += ' ORDER BY u.role = "master" DESC, u.role = "submaster" DESC, a.is_main DESC, u.level DESC LIMIT ?';
    params.push(limit);

    const members = await c.env.DB.prepare(query).bind(...params).all();

    // 랭킹 데이터로 멤버 정보 보강 (본캐/부캐 연결)
    const memberList = members.results as any[];
    if (memberList.length > 0) {
      const names = memberList.map((m: any) => m.character_name);
      const placeholders = names.map(() => '?').join(',');

      // 멤버 닉네임과 매칭되는 랭킹 캐릭터 조회
      const rankingData = await c.env.DB.prepare(
        `SELECT username, userlevel, userjob, userrank, userguild, usercode FROM ranking_characters WHERE username IN (${placeholders})`
      )
        .bind(...names)
        .all();

      const rankingMap = new Map<string, any>();
      const usercodes = new Set<string>();
      for (const r of rankingData.results as any[]) {
        rankingMap.set(r.username, r);
        usercodes.add(r.usercode);
      }

      // 동일 usercode를 가진 부캐릭터 조회
      let altMap = new Map<string, any[]>();
      if (usercodes.size > 0) {
        const codeArr = [...usercodes];
        const codePlaceholders = codeArr.map(() => '?').join(',');
        const altData = await c.env.DB.prepare(
          `SELECT username, userlevel, userjob, userrank, usercode FROM ranking_characters WHERE usercode IN (${codePlaceholders}) ORDER BY userlevel DESC`
        )
          .bind(...codeArr)
          .all();

        for (const alt of altData.results as any[]) {
          if (!altMap.has(alt.usercode)) {
            altMap.set(alt.usercode, []);
          }
          altMap.get(alt.usercode)!.push(alt);
        }
      }

      // 멤버 데이터에 랭킹 정보 및 부캐릭터 추가
      for (const member of memberList) {
        const ranking = rankingMap.get(member.character_name);
        if (ranking) {
          member.ranking_level = ranking.userlevel;
          member.ranking_job = ranking.userjob;
          member.ranking_rank = ranking.userrank;
          member.ranking_guild = ranking.userguild;
          // 같은 계정의 다른 캐릭터 (본인 제외)
          const allChars = altMap.get(ranking.usercode) || [];
          member.alt_characters = allChars.filter((a: any) => a.username !== member.character_name);
        } else {
          member.ranking_level = null;
          member.ranking_job = null;
          member.ranking_rank = null;
          member.ranking_guild = null;
          member.alt_characters = [];
        }
      }
    }

    return success(c, memberList);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 길드원 상세
memberRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const member = await c.env.DB.prepare(`
      SELECT
        u.id, u.character_name, u.job, u.level, u.discord, u.profile_image, u.default_icon, u.profile_zoom, u.role,
        u.alliance_id, u.last_login_at, u.created_at,
        a.name as alliance_name, a.emblem as alliance_emblem, a.is_main as is_main_guild,
        CASE
          WHEN u.last_login_at IS NOT NULL AND datetime(u.last_login_at) > datetime('now', '-12 hours')
          THEN 1
          ELSE 0
        END as is_online
      FROM users u
      LEFT JOIN alliances a ON u.alliance_id = a.id
      WHERE u.id = ? AND u.is_approved = 1
    `).bind(id).first();

    if (!member) {
      return notFound(c, '멤버를 찾을 수 없습니다.');
    }

    // 랭킹 데이터로 본캐/부캐 정보 추가
    const memberData = member as any;
    const ranking = await c.env.DB.prepare(
      'SELECT userlevel, userjob, userrank, userguild, usercode FROM ranking_characters WHERE username = ?'
    )
      .bind(memberData.character_name)
      .first<{ userlevel: number; userjob: string; userrank: number; userguild: string; usercode: string }>();

    if (ranking) {
      memberData.ranking_level = ranking.userlevel;
      memberData.ranking_job = ranking.userjob;
      memberData.ranking_rank = ranking.userrank;
      memberData.ranking_guild = ranking.userguild;

      const alts = await c.env.DB.prepare(
        'SELECT username, userlevel, userjob, userrank FROM ranking_characters WHERE usercode = ? AND username != ? ORDER BY userlevel DESC'
      )
        .bind(ranking.usercode, memberData.character_name)
        .all();

      memberData.alt_characters = alts.results;
    } else {
      memberData.ranking_level = null;
      memberData.ranking_job = null;
      memberData.ranking_rank = null;
      memberData.ranking_guild = null;
      memberData.alt_characters = [];
    }

    return success(c, memberData);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 멤버 프로필 수정 (직업, 레벨) - 관리자용
memberRoutes.put('/:id/profile', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { job, level } = body;

    const member = await c.env.DB.prepare(
      'SELECT id FROM users WHERE id = ?'
    ).bind(id).first();

    if (!member) {
      return notFound(c, '멤버를 찾을 수 없습니다.');
    }

    // 레벨 유효성 검사
    const levelNum = parseInt(level);
    if (isNaN(levelNum) || levelNum < 1 || levelNum > 300) {
      return error(c, 'VALIDATION_ERROR', '레벨은 1~300 사이여야 합니다.');
    }

    await c.env.DB.prepare(
      'UPDATE users SET job = ?, level = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(job || '', levelNum, id).run();

    return success(c, { message: '프로필이 수정되었습니다.' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 역할 변경 (길마/부마)
memberRoutes.put('/:id/role', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  try {
    const { role: myRole } = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();
    const { role } = body;

    const validRoles = ['member', 'submaster', 'master', 'honorary'];
    if (!validRoles.includes(role)) {
      return error(c, 'VALIDATION_ERROR', '유효하지 않은 역할입니다.');
    }

    // 부마스터는 마스터 역할 부여 불가
    if (myRole === 'submaster' && role === 'master') {
      return error(c, 'FORBIDDEN', '마스터 역할은 길드 마스터만 부여할 수 있습니다.', 403);
    }

    const member = await c.env.DB.prepare(
      'SELECT id, role FROM users WHERE id = ?'
    ).bind(id).first<{ id: number; role: string }>();

    if (!member) {
      return notFound(c, '멤버를 찾을 수 없습니다.');
    }

    // 부마스터가 마스터의 역할을 변경하려는 경우 방지
    if (myRole === 'submaster' && member.role === 'master') {
      return error(c, 'FORBIDDEN', '마스터의 역할은 변경할 수 없습니다.', 403);
    }

    await c.env.DB.prepare(
      'UPDATE users SET role = ?, updated_at = datetime("now") WHERE id = ?'
    ).bind(role, id).run();

    return success(c, { message: '역할이 변경되었습니다.' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 멤버 삭제/가입 거절 (길마/부마)
memberRoutes.delete('/:id', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  try {
    const { role: myRole, userId: myId } = c.get('user');
    const id = c.req.param('id');

    const member = await c.env.DB.prepare(
      'SELECT id, role FROM users WHERE id = ?'
    ).bind(id).first<{ id: number; role: string }>();

    if (!member) {
      return notFound(c, '멤버를 찾을 수 없습니다.');
    }

    // 본인 삭제 방지
    if (Number(id) === myId) {
      return error(c, 'FORBIDDEN', '본인 계정은 삭제할 수 없습니다.', 403);
    }

    // 마스터 삭제 방지
    if (member.role === 'master') {
      return error(c, 'FORBIDDEN', '마스터는 삭제할 수 없습니다.', 403);
    }

    // 부마스터가 부마스터 삭제 방지
    if (myRole === 'submaster' && member.role === 'submaster') {
      return error(c, 'FORBIDDEN', '부마스터는 다른 부마스터를 삭제할 수 없습니다.', 403);
    }

    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();

    return success(c, { message: '멤버가 삭제되었습니다.' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 가입 승인 (길마/부마)
memberRoutes.put('/:id/approve', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  try {
    const id = c.req.param('id');

    const member = await c.env.DB.prepare(
      'SELECT id, is_approved FROM users WHERE id = ?'
    ).bind(id).first<{ id: number; is_approved: number }>();

    if (!member) {
      return notFound(c, '멤버를 찾을 수 없습니다.');
    }

    if (member.is_approved) {
      return error(c, 'ALREADY_APPROVED', '이미 승인된 멤버입니다.');
    }

    await c.env.DB.prepare(
      'UPDATE users SET is_approved = 1, updated_at = datetime("now") WHERE id = ?'
    ).bind(id).run();

    return success(c, { message: '가입이 승인되었습니다.' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 대기 중인 가입 신청 목록 (길마/부마)
memberRoutes.get('/pending/list', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  try {
    const pending = await c.env.DB.prepare(`
      SELECT u.id, u.character_name, u.job, u.level, u.discord, u.profile_image, u.default_icon, u.profile_zoom,
             u.alliance_id, u.role, u.created_at,
             a.name as alliance_name, a.emblem as alliance_emblem, a.is_main as is_main_guild
      FROM users u
      LEFT JOIN alliances a ON u.alliance_id = a.id
      WHERE u.is_approved = 0
      ORDER BY u.created_at DESC
    `).all();

    return success(c, pending.results);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});
