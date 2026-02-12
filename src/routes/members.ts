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

      // 코드 히스토리 기반 부캐릭터 조회 (영구 연결)
      // 1. 멤버 이름으로 히스토리에서 모든 usercode 조회
      const memberNames = memberList.map((m: any) => m.character_name);
      const memberNamePlaceholders = memberNames.map(() => '?').join(',');
      const memberCodeHistory = await c.env.DB.prepare(
        `SELECT username, usercode FROM character_code_history WHERE username IN (${memberNamePlaceholders})`
      ).bind(...memberNames).all();

      // 멤버별 usercode 목록
      const memberCodesMap = new Map<string, Set<string>>();
      for (const row of memberCodeHistory.results as any[]) {
        if (!memberCodesMap.has(row.username)) {
          memberCodesMap.set(row.username, new Set());
        }
        memberCodesMap.get(row.username)!.add(row.usercode);
      }

      // 2. 모든 관련 usercode로 연결된 캐릭터 조회
      const allCodes = new Set<string>();
      for (const codes of memberCodesMap.values()) {
        for (const code of codes) allCodes.add(code);
      }
      // ranking_characters의 현재 usercode도 포함
      for (const r of rankingData.results as any[]) {
        allCodes.add(r.usercode);
      }

      let altMap = new Map<string, any[]>(); // usercode → characters
      if (allCodes.size > 0) {
        const codeArr = [...allCodes];
        const codePlaceholders = codeArr.map(() => '?').join(',');

        // 히스토리에서 해당 코드를 가진 모든 캐릭터명 조회
        const linkedNames = await c.env.DB.prepare(
          `SELECT DISTINCT username, usercode FROM character_code_history WHERE usercode IN (${codePlaceholders})`
        ).bind(...codeArr).all();

        // usercode별 연결된 캐릭터명 맵
        const codeToNames = new Map<string, Set<string>>();
        for (const row of linkedNames.results as any[]) {
          if (!codeToNames.has(row.usercode)) {
            codeToNames.set(row.usercode, new Set());
          }
          codeToNames.get(row.usercode)!.add(row.username);
        }

        // 연결된 모든 캐릭터의 랭킹 데이터 조회
        const allLinkedNames = new Set<string>();
        for (const names of codeToNames.values()) {
          for (const name of names) allLinkedNames.add(name);
        }

        if (allLinkedNames.size > 0) {
          const nameArr = [...allLinkedNames];
          const namePlaceholders = nameArr.map(() => '?').join(',');
          const altData = await c.env.DB.prepare(
            `SELECT username, userlevel, userjob, userrank, usercode FROM ranking_characters WHERE username IN (${namePlaceholders}) ORDER BY userlevel DESC`
          ).bind(...nameArr).all();

          for (const alt of altData.results as any[]) {
            // 현재 usercode와 히스토리 usercode 모두로 매핑
            if (!altMap.has(alt.usercode)) {
              altMap.set(alt.usercode, []);
            }
            altMap.get(alt.usercode)!.push(alt);
          }

          // 히스토리 코드로도 매핑 (코드 변경 시 연결 유지)
          for (const [code, names] of codeToNames) {
            for (const name of names) {
              const charData = (altData.results as any[]).find((a: any) => a.username === name);
              if (charData && !altMap.get(code)?.some((a: any) => a.username === name)) {
                if (!altMap.has(code)) altMap.set(code, []);
                altMap.get(code)!.push(charData);
              }
            }
          }
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

          // 히스토리 기반 부캐 조회: 해당 멤버의 모든 usercode로 연결된 캐릭터
          const memberCodes = memberCodesMap.get(member.character_name) || new Set([ranking.usercode]);
          const altSet = new Set<string>();
          const altList: any[] = [];
          for (const code of memberCodes) {
            const chars = altMap.get(code) || [];
            for (const ch of chars) {
              if (ch.username !== member.character_name && !altSet.has(ch.username)) {
                altSet.add(ch.username);
                altList.push(ch);
              }
            }
          }
          // 현재 usercode로도 조회
          if (!memberCodes.has(ranking.usercode)) {
            const chars = altMap.get(ranking.usercode) || [];
            for (const ch of chars) {
              if (ch.username !== member.character_name && !altSet.has(ch.username)) {
                altSet.add(ch.username);
                altList.push(ch);
              }
            }
          }
          member.alt_characters = altList.sort((a: any, b: any) => b.userlevel - a.userlevel);
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

      // 히스토리 기반 부캐 조회 (영구 연결)
      const codeHistory = await c.env.DB.prepare(
        'SELECT DISTINCT usercode FROM character_code_history WHERE username = ?'
      ).bind(memberData.character_name).all();

      const codes = (codeHistory.results as any[]).map((r: any) => r.usercode);
      if (!codes.includes(ranking.usercode)) codes.push(ranking.usercode);

      const codePlaceholders = codes.map(() => '?').join(',');
      const linkedNames = await c.env.DB.prepare(
        `SELECT DISTINCT username FROM character_code_history WHERE usercode IN (${codePlaceholders})`
      ).bind(...codes).all();

      const allNames = (linkedNames.results as any[]).map((r: any) => r.username).filter((n: string) => n !== memberData.character_name);

      if (allNames.length > 0) {
        const namePlaceholders = allNames.map(() => '?').join(',');
        const alts = await c.env.DB.prepare(
          `SELECT username, userlevel, userjob, userrank FROM ranking_characters WHERE username IN (${namePlaceholders}) ORDER BY userlevel DESC`
        ).bind(...allNames).all();
        memberData.alt_characters = alts.results;
      } else {
        memberData.alt_characters = [];
      }
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
