import { Hono } from 'hono';
import { Env } from '../index';
import { authMiddleware, requireRole } from '../middleware/auth';
import { success, error } from '../utils/response';

export const rankingRoutes = new Hono<{ Bindings: Env }>();

// jobGroup 범위: 0~5, 10~15, 21~23, 30~33, 35, 41~42
const JOB_GROUPS = [0, 1, 2, 3, 4, 5, 10, 11, 12, 13, 14, 15, 21, 22, 23, 30, 31, 32, 33, 35, 41, 42];
const MAX_PAGE = 20;
const BATCH_SIZE = 80;

// Workers 무료 플랜 subrequest 50개 제한 대응: 2개 직업군씩 배치
const JOB_GROUP_BATCHES = [
  [0, 1], [2, 3], [4, 5],
  [10, 11], [12, 13], [14, 15],
  [21, 22], [23, 30], [31, 32],
  [33, 35], [41, 42],
];
const TOTAL_BATCHES = JOB_GROUP_BATCHES.length; // 11

interface RankingCharacter {
  userrank: number;
  username: string;
  userlevel: number;
  userjob: string;
  userguild: string;
  userdate: string;
  usertime: string;
  usercode: string;
}

/**
 * maplestar.io 랭킹 페이지 HTML을 파싱하여 캐릭터 정보를 추출
 */
function parseRankingHtml(html: string): Array<{ rank: number; name: string; level: number; job: string; guild: string; code: string }> {
  const results: Array<{ rank: number; name: string; level: number; job: string; guild: string; code: string }> = [];

  const liBlocks = html.split(/<li\s+class="flex items-center py-2/);

  for (let i = 1; i < liBlocks.length; i++) {
    const block = liBlocks[i];

    const codeMatch = block.match(/%2Fprofile%2F\d+%2F(\d+\.png)/);
    if (!codeMatch) continue;

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

    results.push({ rank, name, level, job, guild, code: codeMatch[1] });
  }

  return results;
}

/**
 * 랭킹 스크래핑 (UPSERT 방식 - 기존 데이터 유지하면서 업데이트)
 * batchIndex: 0~10 (운영 배치 모드), undefined면 전체 스크래핑 (로컬/수동)
 */
export async function scrapeAllRankings(db: D1Database, batchIndex?: number): Promise<{ total: number; errors: number; batch?: number }> {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kst = new Date(now.getTime() + kstOffset);
  const userdate = kst.toISOString().split('T')[0];
  const usertime = kst.toISOString().split('T')[1].split('.')[0];
  const timestamp = `${userdate} ${usertime}`;

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
          });
        }
      } catch (e) {
        console.error(`스크래핑 실패 jobGroup=${jobGroup} page=${page}:`, e);
        errorCount++;
      }
    }
  }

  // UPSERT: 기존 데이터 유지하면서 업데이트 (username UNIQUE 인덱스 필요)
  for (let i = 0; i < allCharacters.length; i += BATCH_SIZE) {
    const batch = allCharacters.slice(i, i + BATCH_SIZE);
    const stmts = batch.map((char) =>
      db
        .prepare(
          `INSERT INTO ranking_characters (userrank, username, userlevel, userjob, userguild, userdate, usertime, usercode)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(username) DO UPDATE SET
             userrank=excluded.userrank, userlevel=excluded.userlevel, userjob=excluded.userjob,
             userguild=excluded.userguild, userdate=excluded.userdate, usertime=excluded.usertime,
             usercode=excluded.usercode`
        )
        .bind(char.userrank, char.username, char.userlevel, char.userjob, char.userguild, char.userdate, char.usertime, char.usercode)
    );
    await db.batch(stmts);
  }

  // 코드 히스토리 기록 (본캐/부캐 영구 연결용)
  for (let i = 0; i < allCharacters.length; i += BATCH_SIZE) {
    const batch = allCharacters.slice(i, i + BATCH_SIZE);
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

// 랭킹 데이터 조회 API
rankingRoutes.get('/', async (c) => {
  try {
    const username = c.req.query('username');
    const guild = c.req.query('guild');
    const job = c.req.query('job');
    const limit = parseInt(c.req.query('limit') || '100');

    let query = 'SELECT * FROM ranking_characters WHERE 1=1';
    const params: any[] = [];

    if (username) {
      query += ' AND username LIKE ?';
      params.push(`%${username}%`);
    }
    if (guild) {
      query += ' AND userguild = ?';
      params.push(guild);
    }
    if (job) {
      query += ' AND userjob = ?';
      params.push(job);
    }

    query += ' ORDER BY userrank ASC LIMIT ?';
    params.push(limit);

    const result = await c.env.DB.prepare(query).bind(...params).all();
    return success(c, result.results);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 특정 캐릭터의 본캐/부캐 조회 (히스토리 기반 - 영구 연결)
rankingRoutes.get('/alts/:username', async (c) => {
  try {
    const username = c.req.param('username');

    // 해당 캐릭터가 사용했던 모든 usercode 조회 (히스토리)
    const codeHistory = await c.env.DB.prepare(
      'SELECT DISTINCT usercode FROM character_code_history WHERE username = ?'
    ).bind(username).all();

    const codes = (codeHistory.results as any[]).map((r: any) => r.usercode);
    if (codes.length === 0) {
      return success(c, { character: null, alt_characters: [] });
    }

    // 해당 usercode들을 사용했던 모든 캐릭터 조회 (히스토리)
    const codePlaceholders = codes.map(() => '?').join(',');
    const linkedUsernames = await c.env.DB.prepare(
      `SELECT DISTINCT username FROM character_code_history WHERE usercode IN (${codePlaceholders})`
    ).bind(...codes).all();

    const allNames = (linkedUsernames.results as any[]).map((r: any) => r.username);
    if (allNames.length === 0) {
      return success(c, { character: null, alt_characters: [] });
    }

    // 연결된 모든 캐릭터의 최신 랭킹 데이터 조회
    const namePlaceholders = allNames.map(() => '?').join(',');
    const characters = await c.env.DB.prepare(
      `SELECT username, userlevel, userjob, userrank, userguild, usercode FROM ranking_characters WHERE username IN (${namePlaceholders}) ORDER BY userlevel DESC`
    ).bind(...allNames).all();

    return success(c, {
      characters: characters.results,
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
    const count = await c.env.DB.prepare('SELECT COUNT(*) as total FROM ranking_characters').first<{ total: number }>();
    const latest = await c.env.DB.prepare('SELECT userdate, usertime FROM ranking_characters ORDER BY userdate DESC, usertime DESC LIMIT 1').first<{
      userdate: string;
      usertime: string;
    }>();
    const historyCount = await c.env.DB.prepare('SELECT COUNT(*) as total FROM character_code_history').first<{ total: number }>();

    return success(c, {
      total_characters: count?.total || 0,
      total_code_history: historyCount?.total || 0,
      last_scrape_date: latest?.userdate || null,
      last_scrape_time: latest?.usertime || null,
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});
