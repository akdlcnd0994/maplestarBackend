import { Hono } from 'hono';
import { Env } from '../index';
import { authMiddleware, requireRole } from '../middleware/auth';
import { success, error } from '../utils/response';
import { getKSTTimestamp } from '../utils/date';

export const rankingRoutes = new Hono<{ Bindings: Env }>();

const RANKING_CACHE_TTL = 3600; // 매시 정각 스크래핑 주기와 동일 (1시간)

/** URL 기반 TTL 캐싱 헬퍼 — 캐시 히트 시 DB 조회 없이 즉시 반환 */
async function withCache(c: any, fetchFn: () => Promise<any>): Promise<Response> {
  const cacheKey = new Request(c.req.url);
  const cached = await caches.default.match(cacheKey);
  if (cached) return cached;

  const data = await fetchFn();
  const resp = new Response(JSON.stringify({ success: true, data }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${RANKING_CACHE_TTL}`,
    },
  });
  c.executionCtx.waitUntil(caches.default.put(cacheKey, resp.clone()));
  return resp;
}

// jobGroup 범위: 0~5, 10~15, 21~24, 30~33, 35, 41~42, 49 (24=팬텀, 49=아야메)
const JOB_GROUPS = [0, 1, 2, 3, 4, 5, 10, 11, 12, 13, 14, 15, 21, 22, 23, 24, 30, 31, 32, 33, 35, 41, 42, 49];
const MAX_PAGE = 20;
const BATCH_SIZE = 80;

// Workers 무료 플랜 subrequest 50개 제한 대응: 2개 직업군씩 배치
const JOB_GROUP_BATCHES = [
  [0, 1], [2, 3], [4, 5],
  [10, 11], [12, 13], [14, 15],
  [21, 22], [23, 24], [30, 31],
  [32, 33], [35, 41], [42, 49],
];
const TOTAL_BATCHES = JOB_GROUP_BATCHES.length; // 12

interface RankingCharacter {
  userrank: number;
  username: string;
  userlevel: number;
  userjob: string;
  userguild: string;
  userdate: string;
  usertime: string;
  usercode: string;
  avatar_img: string;
}

/**
 * maplestar.io 랭킹 페이지 HTML을 파싱하여 캐릭터 정보를 추출
 */
function parseRankingHtml(html: string): Array<{ rank: number; name: string; level: number; job: string; guild: string; code: string; avatarImg: string }> {
  const results: Array<{ rank: number; name: string; level: number; job: string; guild: string; code: string; avatarImg: string }> = [];

  const liBlocks = html.split(/<li\s+class="flex items-center py-2/);

  for (let i = 1; i < liBlocks.length; i++) {
    const block = liBlocks[i];

    const flex2Matches = [...block.matchAll(/class="flex-2 text-center">([^<]+)<\/span>/g)];
    if (flex2Matches.length < 3) continue;

    const rank = parseInt(flex2Matches[0][1].trim());
    const level = parseInt(flex2Matches[1][1].trim());
    const job = flex2Matches[2][1].trim();

    if (isNaN(rank) || isNaN(level)) continue;

    const nameMatch = block.match(/<\/div>([^<]+)<\/span><span class="flex-2 text-center">/);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();
    if (!name) continue;

    let guild = '';
    const guildWithMarkMatch = block.match(/guild mark pattern[\s\S]*?<\/div>([^<]*)<\/span>/);
    if (guildWithMarkMatch) {
      guild = guildWithMarkMatch[1].trim();
    } else {
      const guildDirectMatch = block.match(/class="flex-2 flex items-center justify-center gap-x-2">([^<]*)<\/span>/);
      if (guildDirectMatch) {
        guild = guildDirectMatch[1].trim();
      }
    }

    // 아바타 이미지는 없을 수 있음 (프로필 미설정 캐릭터)
    const codeMatch = block.match(/%2Fprofile%2F(\d+)%2F(\d+\.png)/);
    const code = codeMatch ? codeMatch[2] : '';
    const avatarImg = codeMatch ? `https://mod-file.dn.nexoncdn.co.kr/profile/${codeMatch[1]}/${codeMatch[2]}` : '';
    results.push({ rank, name, level, job, guild, code, avatarImg });
  }

  return results;
}

/**
 * 랭킹 스크래핑 (히스토리 누적 방식 - 매 스크래핑마다 새 레코드 삽입)
 * batchIndex: 0~10 (운영 배치 모드), undefined면 전체 스크래핑 (로컬/수동)
 */
export async function scrapeAllRankings(db: D1Database, batchIndex?: number): Promise<{ total: number; errors: number; batch?: number }> {
  const { date: userdate, time: rawtime } = getKSTTimestamp();
  const usertime = rawtime.slice(0, 2); // "HH" 형식 (예: "18")
  const timestamp = `${userdate} ${rawtime}`;

  // batchIndex가 없으면 전체 스크래핑 (로컬/수동 실행용)
  const jobGroups = batchIndex !== undefined
    ? JOB_GROUP_BATCHES[batchIndex] || []
    : JOB_GROUPS;

  if (jobGroups.length === 0) {
    return { total: 0, errors: 0, batch: batchIndex };
  }

  const allCharacters: RankingCharacter[] = [];
  let errorCount = 0;

  for (const jobGroup of jobGroups) {
    for (let page = 1; page <= MAX_PAGE; page++) {
      try {
        const url = `https://maplestar.io/rank/world?type=character&jobGroup=${jobGroup}&page=${page}`;
        const response = await fetch(url, {
          headers: { 'User-Agent': 'MaplestarGuildBot/1.0' }
        });

        if (!response.ok) {
          errorCount++;
          continue;
        }

        const html = await response.text();
        const characters = parseRankingHtml(html);

        if (characters.length === 0) break;

        for (const char of characters) {
          allCharacters.push({
            userrank: char.rank,
            username: char.name,
            userlevel: char.level,
            userjob: char.job,
            userguild: char.guild,
            userdate,
            usertime,
            usercode: char.code,
            avatar_img: char.avatarImg,
          });
        }
      } catch (e) {
        console.error(`스크래핑 실패 jobGroup=${jobGroup} page=${page}:`, e);
        errorCount++;
      }
    }
  }

  // INSERT: 히스토리 누적
  for (let i = 0; i < allCharacters.length; i += BATCH_SIZE) {
    const batch = allCharacters.slice(i, i + BATCH_SIZE);
    const stmts = batch.map((char) =>
      db
        .prepare(
          `INSERT OR REPLACE INTO ranking_characters (userrank, username, userlevel, userjob, userguild, userdate, usertime, usercode, avatar_img)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(char.userrank, char.username, char.userlevel, char.userjob, char.userguild, char.userdate, char.usertime, char.usercode, char.avatar_img)
    );
    await db.batch(stmts);
  }

  // ranking_characters_latest 갱신 (캐릭터당 최신 1행 유지 — rc_latest 풀스캔 방지)
  for (let i = 0; i < allCharacters.length; i += BATCH_SIZE) {
    const batch = allCharacters.slice(i, i + BATCH_SIZE);
    const stmts = batch.map((char) =>
      db.prepare(
        `INSERT INTO ranking_characters_latest (userrank, username, userlevel, userjob, userguild, userdate, usertime, usercode, avatar_img)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(username) DO UPDATE SET
           userrank=excluded.userrank, userlevel=excluded.userlevel,
           userjob=excluded.userjob, userguild=excluded.userguild,
           userdate=excluded.userdate, usertime=excluded.usertime,
           usercode=CASE WHEN excluded.usercode != '' THEN excluded.usercode ELSE ranking_characters_latest.usercode END,
           avatar_img=CASE WHEN excluded.avatar_img != '' THEN excluded.avatar_img ELSE ranking_characters_latest.avatar_img END`
      ).bind(char.userrank, char.username, char.userlevel, char.userjob, char.userguild, char.userdate, char.usertime, char.usercode, char.avatar_img)
    );
    await db.batch(stmts);
  }

  // 코드 히스토리 기록 (본캐/부캐 영구 연결용, 아바타 없는 캐릭터 제외)
  const charsWithCode = allCharacters.filter((c) => c.usercode);
  for (let i = 0; i < charsWithCode.length; i += BATCH_SIZE) {
    const batch = charsWithCode.slice(i, i + BATCH_SIZE);
    const stmts = batch.map((char) =>
      db
        .prepare(
          `INSERT INTO character_code_history (username, usercode, first_seen, last_seen)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(username, usercode) DO UPDATE SET last_seen=excluded.last_seen`
        )
        .bind(char.username, char.usercode, timestamp, timestamp)
    );
    await db.batch(stmts);
  }

  const batchInfo = batchIndex !== undefined ? ` (배치 ${batchIndex}/${TOTAL_BATCHES - 1}, 직업군 ${jobGroups.join(',')})` : ' (전체)';
  console.log(`랭킹 스크래핑 완료${batchInfo}: ${allCharacters.length}건 저장, ${errorCount}건 오류`);
  return { total: allCharacters.length, errors: errorCount, batch: batchIndex };
}

// 랭킹 데이터 조회 API (최신 스냅샷만)
rankingRoutes.get('/', async (c) => {
  try {
    return await withCache(c, async () => {
      const username = c.req.query('username');
      const guild = c.req.query('guild');
      const job = c.req.query('job');
      const limit = parseInt(c.req.query('limit') || '100');

      let query = `SELECT * FROM ranking_characters_latest WHERE 1=1`;
      const params: any[] = [];

      if (username) {
        query += ' AND rc.username LIKE ?';
        params.push(`%${username}%`);
      }
      if (guild) {
        query += ' AND rc.userguild = ?';
        params.push(guild);
      }
      if (job) {
        query += ' AND rc.userjob = ?';
        params.push(job);
      }

      query += ' ORDER BY rc.userrank ASC LIMIT ?';
      params.push(limit);

      const result = await c.env.DB.prepare(query).bind(...params).all();
      return result.results;
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 특정 캐릭터의 본캐/부캐 조회 (히스토리 기반 - 영구 연결)
rankingRoutes.get('/alts/:username', async (c) => {
  try {
    return await withCache(c, async () => {
      const username = c.req.param('username');

      const codeHistory = await c.env.DB.prepare(
        'SELECT DISTINCT usercode FROM character_code_history WHERE username = ?'
      ).bind(username).all();

      const codes = (codeHistory.results as any[]).map((r: any) => r.usercode);
      if (codes.length === 0) return { character: null, alt_characters: [] };

      const codePlaceholders = codes.map(() => '?').join(',');
      const linkedUsernames = await c.env.DB.prepare(
        `SELECT DISTINCT username FROM character_code_history WHERE usercode IN (${codePlaceholders})`
      ).bind(...codes).all();

      const allNames = (linkedUsernames.results as any[]).map((r: any) => r.username);
      if (allNames.length === 0) return { character: null, alt_characters: [] };

      const namePlaceholders = allNames.map(() => '?').join(',');
      const characters = await c.env.DB.prepare(
        `SELECT rc.username, rc.userlevel, rc.userjob, rc.userrank, rc.userguild, rc.usercode, rc.avatar_img
         FROM ranking_characters rc
         INNER JOIN (SELECT username, MAX(userindex) as max_idx FROM ranking_characters WHERE username IN (${namePlaceholders}) GROUP BY username) latest
         ON rc.username = latest.username AND rc.userindex = latest.max_idx
         ORDER BY rc.userlevel DESC`
      ).bind(...allNames).all();

      return { characters: characters.results };
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 특정 캐릭터 레벨 변화 이력 조회
rankingRoutes.get('/history/:username', async (c) => {
  try {
    return await withCache(c, async () => {
      const username = c.req.param('username');
      const days = parseInt(c.req.query('days') || '30');

      const now = new Date();
      now.setHours(now.getHours() + 9);
      now.setDate(now.getDate() - days);
      const threshold = now.toISOString().slice(0, 10);

      const result = await c.env.DB.prepare(
        `SELECT userlevel, userjob, userrank, userguild, userdate, usertime, avatar_img
         FROM ranking_characters
         WHERE username = ? AND userdate >= ?
         ORDER BY userdate ASC, usertime ASC`
      ).bind(username, threshold).all();

      return result.results;
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 본캐+부캐 전체 히스토리 조회 (차트용)
rankingRoutes.get('/history/:username/alts', async (c) => {
  try {
    return await withCache(c, async () => {
      const username = c.req.param('username');
      const days = parseInt(c.req.query('days') || '30');

      const now = new Date();
      now.setHours(now.getHours() + 9);
      now.setDate(now.getDate() - days);
      const threshold = now.toISOString().slice(0, 10);

      const codeHistory = await c.env.DB.prepare(
        'SELECT DISTINCT usercode FROM character_code_history WHERE username = ?'
      ).bind(username).all();

      const codes = (codeHistory.results as any[]).map((r: any) => r.usercode);
      if (codes.length === 0) return { characters: {} };

      const codePlaceholders = codes.map(() => '?').join(',');
      const linkedNames = await c.env.DB.prepare(
        `SELECT DISTINCT username FROM character_code_history WHERE usercode IN (${codePlaceholders})`
      ).bind(...codes).all();

      const allNames = (linkedNames.results as any[]).map((r: any) => r.username);
      if (allNames.length === 0) return { characters: {} };

      const namePlaceholders = allNames.map(() => '?').join(',');
      const history = await c.env.DB.prepare(
        `SELECT username, userlevel, userjob, userrank, userguild, userdate, usertime, avatar_img
         FROM ranking_characters
         WHERE username IN (${namePlaceholders}) AND userdate >= ?
         ORDER BY userdate ASC, usertime ASC`
      ).bind(...allNames, threshold).all();

      const grouped: Record<string, any[]> = {};
      for (const row of history.results as any[]) {
        if (!grouped[row.username]) grouped[row.username] = [];
        grouped[row.username].push(row);
      }

      return { characters: grouped };
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 수동 스크래핑 트리거 (관리자 전용)
// ?batch=0~10 으로 특정 배치만 실행 가능 (운영에서 전체 실행 시 subrequest 초과됨)
rankingRoutes.post('/scrape', authMiddleware, requireRole('master'), async (c) => {
  try {
    const batchParam = c.req.query('batch');
    const batchIndex = batchParam !== null && batchParam !== undefined ? parseInt(batchParam) : undefined;
    const result = await scrapeAllRankings(c.env.DB, batchIndex);
    return success(c, { message: `스크래핑 완료: ${result.total}건 저장, ${result.errors}건 오류`, batch: result.batch });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 스크래핑 상태 확인
rankingRoutes.get('/status', async (c) => {
  try {
    const totalRecords = await c.env.DB.prepare('SELECT COUNT(*) as total FROM ranking_characters').first<{ total: number }>();
    const uniqueChars = await c.env.DB.prepare('SELECT COUNT(DISTINCT username) as total FROM ranking_characters').first<{ total: number }>();
    const latest = await c.env.DB.prepare('SELECT userdate, usertime FROM ranking_characters ORDER BY userindex DESC LIMIT 1').first<{
      userdate: string;
      usertime: string;
    }>();
    const historyCount = await c.env.DB.prepare('SELECT COUNT(*) as total FROM character_code_history').first<{ total: number }>();

    return success(c, {
      total_records: totalRecords?.total || 0,
      unique_characters: uniqueChars?.total || 0,
      total_code_history: historyCount?.total || 0,
      last_scrape_date: latest?.userdate || null,
      last_scrape_time: latest?.usertime || null,
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});
