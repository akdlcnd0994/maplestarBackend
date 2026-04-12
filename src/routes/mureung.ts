import { Hono } from 'hono';
import { Env } from '../index';
import { authMiddleware, requireRole } from '../middleware/auth';
import { success, error } from '../utils/response';
import { getKSTTimestamp } from '../utils/date';

export const mureungRoutes = new Hono<{ Bindings: Env }>();

export const MUREUNG_JOB_GROUPS: Record<number, string> = {
  110: '히어로', 120: '팔라딘', 130: '다크나이트',
  210: '위자드(불,독)', 220: '위자드(썬,콜)', 230: '비숍',
  310: '보우마스터', 320: '신궁',
  410: '나이트로드', 420: '섀도어', 430: '듀얼블레이더',
  510: '바이퍼', 520: '캡틴', 530: '캐논슈터',
  2110: '아란', 2210: '에반', 2310: '메르세데스',
  3110: '데몬슬레이어', 3210: '배틀메이지', 3310: '와일드헌터',
  3510: '메카닉', 4110: '하야토', 4210: '칸나', 2410: '팬텀',
};

export const MUREUNG_BATCHES: number[][] = [
  [110, 120], [130, 210], [220, 230],
  [310, 320], [410, 420], [430, 510],
  [520, 530], [2110, 2210], [2310, 3110],
  [3210, 3310], [3510, 4110], [4210, 2410],
];
export const MUREUNG_TOTAL_BATCHES = MUREUNG_BATCHES.length;

const KNOWN_MUREUNG_HISTORY = [
  { mureungId: '20251020', bossName: '자쿰',        roundStart: '2025-10-20', roundEnd: '2025-11-03' },
  { mureungId: '20251103', bossName: '혼테일',      roundStart: '2025-11-03', roundEnd: '2025-11-17' },
  { mureungId: '20251117', bossName: '반 레온',     roundStart: '2025-11-17', roundEnd: '2025-12-01' },
  { mureungId: '20251201', bossName: '핑크빈',      roundStart: '2025-12-01', roundEnd: '2025-12-15' },
  { mureungId: '20251215', bossName: '시그너스',    roundStart: '2025-12-15', roundEnd: '2025-12-29' },
  { mureungId: '20251229', bossName: '아카이럼',    roundStart: '2025-12-29', roundEnd: '2026-01-12' },
  { mureungId: '20260112', bossName: '모리 란마루', roundStart: '2026-01-12', roundEnd: '2026-01-26' },
  { mureungId: '20260126', bossName: '자쿰',        roundStart: '2026-01-26', roundEnd: '2026-02-09' },
  { mureungId: '20260209', bossName: '혼테일',      roundStart: '2026-02-09', roundEnd: '2026-02-23' },
  { mureungId: '20260223', bossName: '반레온',      roundStart: '2026-02-23', roundEnd: '2026-03-09' },
  { mureungId: '20260309', bossName: '핑크빈',      roundStart: '2026-03-09', roundEnd: '2026-03-23' },
  { mureungId: '20260323', bossName: '시그너스',    roundStart: '2026-03-23', roundEnd: '2026-04-06' },
  { mureungId: '20260406', bossName: '아카이럼',    roundStart: '2026-04-06', roundEnd: '2026-04-20' },
  { mureungId: '20260420', bossName: '모리 란마루', roundStart: '2026-04-20', roundEnd: '2026-05-04' },
  { mureungId: '20260504', bossName: '자쿰',        roundStart: '2026-05-04', roundEnd: '2026-05-18' },
  { mureungId: '20260518', bossName: '혼테일',      roundStart: '2026-05-18', roundEnd: '2026-06-01' },
  { mureungId: '20260601', bossName: '반 레온',     roundStart: '2026-06-01', roundEnd: '2026-06-15' },
  { mureungId: '20260615', bossName: '핑크빈',      roundStart: '2026-06-15', roundEnd: '2026-06-29' },
  { mureungId: '20260629', bossName: '시그너스',    roundStart: '2026-06-29', roundEnd: '2026-07-13' },
  { mureungId: '20260713', bossName: '아카이럼',    roundStart: '2026-07-13', roundEnd: '2026-07-27' },
  { mureungId: '20260727', bossName: '모리 란마루', roundStart: '2026-07-27', roundEnd: '2026-08-10' },
  { mureungId: '20260810', bossName: '자쿰',        roundStart: '2026-08-10', roundEnd: '2026-08-24' },
  { mureungId: '20260824', bossName: '혼테일',      roundStart: '2026-08-24', roundEnd: '2026-09-07' },
  { mureungId: '20260907', bossName: '반 레온',     roundStart: '2026-09-07', roundEnd: '2026-09-21' },
  { mureungId: '20260921', bossName: '핑크빈',      roundStart: '2026-09-21', roundEnd: '2026-10-05' },
  { mureungId: '20261005', bossName: '시그너스',    roundStart: '2026-10-05', roundEnd: '2026-10-19' },
  { mureungId: '20261019', bossName: '아카이럼',    roundStart: '2026-10-19', roundEnd: '2026-11-02' },
  { mureungId: '20261102', bossName: '모리 란마루', roundStart: '2026-11-02', roundEnd: '2026-11-16' },
  { mureungId: '20261116', bossName: '자쿰',        roundStart: '2026-11-16', roundEnd: '2026-11-30' },
  { mureungId: '20261130', bossName: '혼테일',      roundStart: '2026-11-30', roundEnd: '2026-12-14' },
  { mureungId: '20261214', bossName: '반 레온',     roundStart: '2026-12-14', roundEnd: '2026-12-28' },
  { mureungId: '20261228', bossName: '핑크빈',      roundStart: '2026-12-28', roundEnd: '2027-01-11' },
  { mureungId: '20270111', bossName: '시그너스',    roundStart: '2027-01-11', roundEnd: '2027-01-25' },
  { mureungId: '20270125', bossName: '아카이럼',    roundStart: '2027-01-25', roundEnd: '2027-02-08' },
  { mureungId: '20270208', bossName: '모리 란마루', roundStart: '2027-02-08', roundEnd: '2027-02-22' },
  { mureungId: '20270222', bossName: '자쿰',        roundStart: '2027-02-22', roundEnd: '2027-03-08' },
];

const MAX_PAGE = 20;
const BATCH_SIZE = 80;
const CURRENT_ROUND_TTL = 3600; // 현재 회차: 1시간

interface MureungEntry {
  rank: number;
  username: string;
  score: number;
  jobName: string;
  avatarImg: string;
  usercode: string;
}

interface RoundInfo {
  roundKey: string;
  roundStart: string;
  roundEnd: string;
  bossName: string;
}

// ==================== 응답 헬퍼 ====================

function makeJsonResp(data: any, maxAge: number): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${maxAge}`,
    },
  });
}

/** 현재 회차용 서버 캐시 (caches.default) */
function cachedResponse(c: any, data: any, maxAge: number): Response {
  const resp = makeJsonResp(data, maxAge);
  c.executionCtx.waitUntil(caches.default.put(new Request(c.req.url), resp.clone()));
  return resp;
}

// ==================== R2 헬퍼 (과거 회차 영구 캐시) ====================

/** R2 키: TTL 없이 영구 저장, 회차 전환 시 자동 생성 */
const r2KeyOverall = (roundId: number) => `mureung/overall/${roundId}.json`;
const r2KeyGuild   = (roundId: number) => `mureung/guild/${roundId}.json`;
const r2KeyJob     = (roundId: number, jobGroup: number) => `mureung/job/${roundId}/${jobGroup}.json`;

// 현재 회차 전용 고정 키 (매시 5분 덮어씀)
const R2_CURRENT_OVERALL = 'mureung/current/overall.json';
const R2_CURRENT_GUILD   = 'mureung/current/guild.json';
const r2KeyCurrentJob    = (jobGroup: number) => `mureung/current/job/${jobGroup}.json`;

async function getFromR2(bucket: R2Bucket, key: string): Promise<any | null> {
  const obj = await bucket.get(key);
  if (!obj) return null;
  return obj.json<any>();
}

async function putToR2(bucket: R2Bucket, key: string, data: any): Promise<void> {
  await bucket.put(key, JSON.stringify(data), {
    httpMetadata: { contentType: 'application/json' },
  });
}

// ==================== HTML 파싱 ====================

function parseRoundInfo(html: string): RoundInfo | null {
  const idMatches = [...html.matchAll(/mureungId[^:]*:(\d{8})/g)];
  if (idMatches.length === 0) return null;

  const lastId = idMatches[idMatches.length - 1][1];
  const lastDate = new Date(`${lastId.slice(0,4)}-${lastId.slice(4,6)}-${lastId.slice(6,8)}T00:00:00Z`);
  const startDate = new Date(lastDate);
  startDate.setUTCDate(startDate.getUTCDate() + 14);
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 14);

  const roundStart = startDate.toISOString().slice(0, 10);
  const roundEnd   = endDate.toISOString().slice(0, 10);
  const roundKey   = `${roundStart}~${roundEnd}`;

  const [yr, mo, dy] = roundStart.split('-');
  const startMDY = `${parseInt(mo)}/${parseInt(dy)}/${yr}`;
  const bossMatch = html.match(
    new RegExp(startMDY.replace(/\//g, '\\/') + '\\s*~\\s*[\\d/]+\\s*\\(([^)]+)\\)')
  );
  const bossName = bossMatch ? bossMatch[1].trim() : '';

  // HTML 파싱 실패 시 KNOWN_MUREUNG_HISTORY에서 폴백
  const resolvedBossName = bossName ||
    (KNOWN_MUREUNG_HISTORY.find(h => h.roundStart === roundStart)?.bossName ?? '');

  return { roundKey, roundStart, roundEnd, bossName: resolvedBossName };
}

function parseMureungHtml(html: string, jobGroup: number): MureungEntry[] {
  const results: MureungEntry[] = [];
  const jobName = MUREUNG_JOB_GROUPS[jobGroup] || '';
  const liBlocks = html.split(/<li\s+class="flex items-center py-2/);

  for (let i = 1; i < liBlocks.length; i++) {
    const block = liBlocks[i];

    const flex1Match = block.match(/class="flex-1 text-center">([^<]+)<\/span>/);
    if (!flex1Match) continue;
    const rank = parseInt(flex1Match[1].trim());
    if (isNaN(rank)) continue;

    const flex3Match = block.match(/class="flex-3 text-center">([^<]+)<\/span>/);
    if (!flex3Match) continue;
    const score = parseInt(flex3Match[1].trim().replace(/,/g, ''));
    if (isNaN(score) || score <= 0) continue;

    const nameMatch = block.match(/<\/div>([^<]+)<\/span><span\s+class="flex-1 text-center">/);
    if (!nameMatch) continue;
    const username = nameMatch[1].trim();
    if (!username) continue;

    const avatarMatch = block.match(
      /url=https?%3A%2F%2Fmod-file\.dn\.nexoncdn\.co\.kr%2Fprofile%2F(\d+)%2F(\d+\.png)/
    );
    const usercode = avatarMatch ? avatarMatch[2] : '';
    const avatarImg = avatarMatch
      ? `https://mod-file.dn.nexoncdn.co.kr/profile/${avatarMatch[1]}/${avatarMatch[2]}`
      : '';

    results.push({ rank, username, score, jobName, avatarImg, usercode });
  }

  return results;
}

// ==================== DB 쿼리 헬퍼 ====================

async function queryMureungOverall(db: D1Database, roundId: number) {
  const round = await db.prepare(
    'SELECT * FROM mureung_rounds WHERE id = ?'
  ).bind(roundId).first<{ id: number; is_current: number; [key: string]: any }>();

  if (!round) return { round: null, rankings: [] };

  const { results } = await db.prepare(`
    WITH cur AS (
      SELECT username, job_name, job_group, MAX(score) AS score, avatar_img, usercode, MIN(rank) AS job_rank
      FROM mureung_ranking WHERE round_id = ?
      GROUP BY username
    ),
    prev_id AS (
      SELECT id FROM mureung_rounds
      WHERE round_start < (SELECT round_start FROM mureung_rounds WHERE id = ?)
      ORDER BY round_start DESC LIMIT 1
    ),
    rc_latest AS (
      SELECT username, userlevel, userguild
      FROM ranking_characters_latest
    )
    SELECT cur.*, pr.rank AS prev_job_rank, rc.userlevel, rc.userguild
    FROM cur
    LEFT JOIN mureung_ranking pr
      ON pr.round_id = (SELECT id FROM prev_id) AND pr.username = cur.username AND pr.job_group = cur.job_group
    LEFT JOIN rc_latest rc ON rc.username = cur.username
    ORDER BY cur.score DESC LIMIT 50
  `).bind(roundId, roundId).all();

  return { round, rankings: results };
}

async function queryMureungJob(db: D1Database, roundId: number, jobGroup: number, limit = 100) {
  const round = await db.prepare(
    'SELECT * FROM mureung_rounds WHERE id = ?'
  ).bind(roundId).first<{ id: number; is_current: number; [key: string]: any }>();

  if (!round) return { round: null, jobGroup, jobName: MUREUNG_JOB_GROUPS[jobGroup], rankings: [] };

  const { results } = await db.prepare(`
    WITH prev_id AS (
      SELECT id FROM mureung_rounds
      WHERE round_start < (SELECT round_start FROM mureung_rounds WHERE id = ?)
      ORDER BY round_start DESC LIMIT 1
    ),
    rc_latest AS (
      SELECT username, userlevel, userguild
      FROM ranking_characters_latest
    )
    SELECT mr.rank, mr.username, mr.score, mr.job_name, mr.avatar_img, mr.usercode,
      pr.rank AS prev_job_rank, rc.userlevel, rc.userguild
    FROM mureung_ranking mr
    LEFT JOIN mureung_ranking pr
      ON pr.round_id = (SELECT id FROM prev_id) AND pr.username = mr.username AND pr.job_group = mr.job_group
    LEFT JOIN rc_latest rc ON rc.username = mr.username
    WHERE mr.round_id = ? AND mr.job_group = ?
    ORDER BY mr.score DESC LIMIT ?
  `).bind(roundId, roundId, jobGroup, limit).all();

  return { round, jobGroup, jobName: MUREUNG_JOB_GROUPS[jobGroup], rankings: results };
}

async function queryMureungGuildRanking(db: D1Database, roundId: number) {
  const round = await db.prepare(
    'SELECT * FROM mureung_rounds WHERE id = ?'
  ).bind(roundId).first<{ id: number; is_current: number; [key: string]: any }>();

  if (!round) return { round: null, rankings: [], medal_members: [] };

  const { results: guildStats } = await db.prepare(`
    WITH rc_latest AS (
      SELECT username, userguild
      FROM ranking_characters_latest
      WHERE userguild != '' AND userguild IS NOT NULL
    ),
    round_entries AS (
      SELECT mr.job_group, mr.rank, mr.username, mr.score, mr.job_name, mr.avatar_img, rc.userguild AS guild
      FROM mureung_ranking mr INNER JOIN rc_latest rc ON rc.username = mr.username WHERE mr.round_id = ?
    ),
    char_best AS (SELECT guild, username, MAX(score) AS best_score FROM round_entries GROUP BY guild, username),
    top30 AS (
      SELECT guild, username, best_score,
             ROW_NUMBER() OVER (PARTITION BY guild ORDER BY best_score DESC) AS rn FROM char_best
    ),
    medal_counts AS (
      SELECT re.guild,
        SUM(CASE WHEN re.rank = 1 THEN 1 ELSE 0 END) AS gold,
        SUM(CASE WHEN re.rank = 2 THEN 1 ELSE 0 END) AS silver,
        SUM(CASE WHEN re.rank = 3 THEN 1 ELSE 0 END) AS bronze
      FROM round_entries re INNER JOIN top30 t ON t.guild = re.guild AND t.username = re.username AND t.rn <= 30
      WHERE re.rank IN (1, 2, 3) GROUP BY re.guild
    ),
    total_scores AS (SELECT guild, SUM(best_score) AS total_score, COUNT(*) AS member_count FROM top30 WHERE rn <= 30 GROUP BY guild)
    SELECT mc.guild, mc.gold, mc.silver, mc.bronze,
      COALESCE(ts.total_score, 0) AS total_score, COALESCE(ts.member_count, 0) AS member_count,
      ROW_NUMBER() OVER (ORDER BY mc.gold DESC, mc.silver DESC, mc.bronze DESC, COALESCE(ts.total_score, 0) DESC) AS guild_rank
    FROM medal_counts mc LEFT JOIN total_scores ts ON ts.guild = mc.guild ORDER BY guild_rank
  `).bind(roundId).all();

  const { results: medalMembers } = await db.prepare(`
    WITH rc_latest AS (
      SELECT username, userguild
      FROM ranking_characters_latest
      WHERE userguild != '' AND userguild IS NOT NULL
    ),
    round_entries AS (
      SELECT mr.rank, mr.username, mr.score, mr.job_name, mr.avatar_img, rc.userguild AS guild
      FROM mureung_ranking mr INNER JOIN rc_latest rc ON rc.username = mr.username WHERE mr.round_id = ?
    ),
    deduped AS (
      SELECT guild, username, rank, score, job_name, avatar_img,
             ROW_NUMBER() OVER (PARTITION BY guild, username ORDER BY score DESC) AS rn_inner FROM round_entries
    ),
    top30 AS (
      SELECT guild, username, rank, score, job_name, avatar_img,
             ROW_NUMBER() OVER (PARTITION BY guild ORDER BY score DESC) AS rn FROM deduped WHERE rn_inner = 1
    )
    SELECT guild, username, rank, score, job_name, avatar_img FROM top30 WHERE rn <= 30 ORDER BY guild, score DESC
  `).bind(roundId).all();

  return { round, rankings: guildStats, medal_members: medalMembers };
}

// ==================== 스크래핑 ====================

export async function scrapeMureungRankings(
  db: D1Database,
  batchIndex?: number
): Promise<{ total: number; errors: number; batch?: number; round?: string }> {
  const { date, time: rawTime } = getKSTTimestamp();
  const scrapedAt = `${date} ${rawTime}`;

  const jobGroups = batchIndex !== undefined
    ? MUREUNG_BATCHES[batchIndex] || []
    : Object.keys(MUREUNG_JOB_GROUPS).map(Number);

  if (jobGroups.length === 0) return { total: 0, errors: 0, batch: batchIndex };

  let roundId: number | null = null;
  let roundKey = '';
  let errorCount = 0;
  const allEntries: Array<{
    round_id: number; job_group: number; rank: number; username: string;
    score: number; job_name: string; avatar_img: string; usercode: string; scraped_at: string;
  }> = [];

  for (const jobGroup of jobGroups) {
    for (let page = 1; page <= MAX_PAGE; page++) {
      try {
        const url = `https://maplestar.io/rank/contents?type=mureung&jobGroup=${jobGroup}&page=${page}`;
        const response = await fetch(url, { headers: { 'User-Agent': 'MaplestarGuildBot/1.0' } });
        if (!response.ok) { errorCount++; continue; }

        const html = await response.text();
        const entries = parseMureungHtml(html, jobGroup);
        if (entries.length === 0) break;

        if (roundId === null && page === 1) {
          const roundInfo = parseRoundInfo(html);
          if (roundInfo) {
            roundKey = roundInfo.roundKey;
            const existing = await db.prepare('SELECT id FROM mureung_rounds WHERE round_key = ?')
              .bind(roundInfo.roundKey).first<{ id: number }>();
            if (existing) {
              roundId = existing.id;
            } else {
              await db.prepare('UPDATE mureung_rounds SET is_current = 0').run();
              const inserted = await db.prepare(
                `INSERT INTO mureung_rounds (round_key, round_start, round_end, boss_name, is_current, scraped_at)
                 VALUES (?, ?, ?, ?, 1, ?)`
              ).bind(roundInfo.roundKey, roundInfo.roundStart, roundInfo.roundEnd, roundInfo.bossName, scrapedAt).run();
              roundId = inserted.meta?.last_row_id as number;
            }
            await db.prepare(
              `UPDATE mureung_rounds SET is_current = 1, scraped_at = ?,
               boss_name = CASE WHEN boss_name = '' THEN ? ELSE boss_name END WHERE id = ?`
            ).bind(scrapedAt, roundInfo.bossName, roundId).run();
          }
        }

        if (roundId === null) {
          const fallbackKey = `unknown-${date}`;
          const existing = await db.prepare('SELECT id FROM mureung_rounds WHERE round_key = ?')
            .bind(fallbackKey).first<{ id: number }>();
          if (existing) {
            roundId = existing.id;
          } else {
            await db.prepare('UPDATE mureung_rounds SET is_current = 0').run();
            const inserted = await db.prepare(
              `INSERT INTO mureung_rounds (round_key, round_start, round_end, boss_name, is_current, scraped_at)
               VALUES (?, ?, ?, '', 1, ?)`
            ).bind(fallbackKey, date, date, scrapedAt).run();
            roundId = inserted.meta?.last_row_id as number;
          }
          roundKey = fallbackKey;
        }

        for (const entry of entries) {
          allEntries.push({
            round_id: roundId, job_group: jobGroup, rank: entry.rank, username: entry.username,
            score: entry.score, job_name: entry.jobName, avatar_img: entry.avatarImg,
            usercode: entry.usercode, scraped_at: scrapedAt,
          });
        }
      } catch (e) {
        console.error(`무릉 스크래핑 실패 jobGroup=${jobGroup} page=${page}:`, e);
        errorCount++;
      }
    }
  }

  for (let i = 0; i < allEntries.length; i += BATCH_SIZE) {
    const batch = allEntries.slice(i, i + BATCH_SIZE);
    const stmts = batch.map((e) =>
      db.prepare(
        `INSERT INTO mureung_ranking (round_id, job_group, rank, username, score, job_name, avatar_img, usercode, scraped_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(round_id, job_group, username) DO UPDATE SET
           rank=excluded.rank, score=excluded.score, job_name=excluded.job_name,
           avatar_img=excluded.avatar_img, usercode=excluded.usercode, scraped_at=excluded.scraped_at`
      ).bind(e.round_id, e.job_group, e.rank, e.username, e.score, e.job_name, e.avatar_img, e.usercode, e.scraped_at)
    );
    await db.batch(stmts);
  }

  const batchInfo = batchIndex !== undefined
    ? ` (배치 ${batchIndex}/${MUREUNG_TOTAL_BATCHES - 1}, 직업군 ${jobGroups.join(',')})`
    : ' (전체)';
  console.log(`무릉 스크래핑 완료${batchInfo}: ${allEntries.length}건 저장, ${errorCount}건 오류, 회차=${roundKey}`);
  return { total: allEntries.length, errors: errorCount, batch: batchIndex, round: roundKey };
}

export async function scrapeAllMureungHistory(
  db: D1Database,
  force = false
): Promise<{ total: number; errors: number; rounds: number; skipped: number }> {
  const { date, time: rawTime } = getKSTTimestamp();
  const scrapedAt = `${date} ${rawTime}`;
  const jobGroupList = Object.keys(MUREUNG_JOB_GROUPS).map(Number);
  let total = 0, errors = 0, skipped = 0;

  for (const knownRound of KNOWN_MUREUNG_HISTORY) {
    const roundKey = `${knownRound.roundStart}~${knownRound.roundEnd}`;
    let roundId: number;
    const existing = await db.prepare('SELECT id FROM mureung_rounds WHERE round_key = ?')
      .bind(roundKey).first<{ id: number }>();

    if (existing) {
      roundId = existing.id;
      if (!force) {
        const count = await db.prepare('SELECT COUNT(*) as cnt FROM mureung_ranking WHERE round_id = ?')
          .bind(roundId).first<{ cnt: number }>();
        if (count && count.cnt > 0) {
          console.log(`역대 무릉 스킵: ${knownRound.bossName}(${knownRound.mureungId}) 이미 ${count.cnt}건 존재`);
          total += count.cnt;
          skipped++;
          continue;
        }
      }
    } else {
      const inserted = await db.prepare(
        `INSERT INTO mureung_rounds (round_key, round_start, round_end, boss_name, is_current, scraped_at)
         VALUES (?, ?, ?, ?, 0, ?)`
      ).bind(roundKey, knownRound.roundStart, knownRound.roundEnd, knownRound.bossName, scrapedAt).run();
      roundId = inserted.meta?.last_row_id as number;
    }

    const allEntries: Array<{
      round_id: number; job_group: number; rank: number; username: string;
      score: number; job_name: string; avatar_img: string; usercode: string; scraped_at: string;
    }> = [];

    for (const jobGroup of jobGroupList) {
      for (let page = 1; page <= MAX_PAGE; page++) {
        try {
          const url = `https://maplestar.io/rank/contents?type=mureung&jobGroup=${jobGroup}&page=${page}&date=${knownRound.mureungId}`;
          const response = await fetch(url, { headers: { 'User-Agent': 'MaplestarGuildBot/1.0' } });
          if (!response.ok) { errors++; continue; }
          const html = await response.text();
          const entries = parseMureungHtml(html, jobGroup);
          if (entries.length === 0) break;
          for (const entry of entries) {
            allEntries.push({
              round_id: roundId, job_group: jobGroup, rank: entry.rank, username: entry.username,
              score: entry.score, job_name: entry.jobName, avatar_img: entry.avatarImg,
              usercode: entry.usercode, scraped_at: scrapedAt,
            });
          }
        } catch (e) {
          console.error(`역대 무릉 스크래핑 실패 mureungId=${knownRound.mureungId} jobGroup=${jobGroup} page=${page}:`, e);
          errors++;
        }
      }
    }

    for (let i = 0; i < allEntries.length; i += BATCH_SIZE) {
      const chunk = allEntries.slice(i, i + BATCH_SIZE);
      const stmts = chunk.map((e) =>
        db.prepare(
          `INSERT INTO mureung_ranking (round_id, job_group, rank, username, score, job_name, avatar_img, usercode, scraped_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(round_id, job_group, username) DO UPDATE SET
             rank=excluded.rank, score=excluded.score, job_name=excluded.job_name,
             avatar_img=excluded.avatar_img, usercode=excluded.usercode, scraped_at=excluded.scraped_at`
        ).bind(e.round_id, e.job_group, e.rank, e.username, e.score, e.job_name, e.avatar_img, e.usercode, e.scraped_at)
      );
      await db.batch(stmts);
    }

    total += allEntries.length;
    console.log(`역대 무릉 완료: ${knownRound.bossName}(${knownRound.mureungId}) ${allEntries.length}건 저장`);
  }

  return { total, errors, rounds: KNOWN_MUREUNG_HISTORY.length, skipped };
}

// ==================== R2 캐시 관리 ====================

/**
 * 과거 회차 데이터를 R2에 저장
 * - R2는 TTL/LRU eviction 없이 영구 저장 → 워밍 1회로 영구적
 * - 이미 R2에 있으면 D1 쿼리 없이 스킵
 * - 회차 전환 시 자동 호출, 수동 버튼으로도 호출 가능
 */
export async function writeAllPastRoundsToR2(
  db: D1Database,
  bucket: R2Bucket
): Promise<{ written: number; skipped: number }> {
  const { results: pastRounds } = await db
    .prepare('SELECT * FROM mureung_rounds WHERE is_current = 0 ORDER BY round_start DESC')
    .all<{ id: number; is_current: number; [key: string]: any }>();

  let written = 0;
  let skipped = 0;

  for (const round of pastRounds) {
    const roundId = round.id;

    // R2에 이미 있으면 D1 쿼리 없이 스킵
    const existing = await bucket.head(r2KeyOverall(roundId));
    if (existing) {
      skipped++;
      continue;
    }

    // overall
    try {
      const data = await queryMureungOverall(db, roundId);
      await putToR2(bucket, r2KeyOverall(roundId), data);
    } catch (e) { console.error(`R2 저장 실패 overall roundId=${roundId}:`, e); }
    await new Promise(r => setTimeout(r, 500));

    // guild-ranking
    try {
      const data = await queryMureungGuildRanking(db, roundId);
      await putToR2(bucket, r2KeyGuild(roundId), data);
    } catch (e) { console.error(`R2 저장 실패 guild roundId=${roundId}:`, e); }
    await new Promise(r => setTimeout(r, 500));

    // 직업별 랭킹 (순차, 500ms delay)
    for (const jg of Object.keys(MUREUNG_JOB_GROUPS)) {
      try {
        const jobGroup = parseInt(jg);
        const data = await queryMureungJob(db, roundId, jobGroup);
        await putToR2(bucket, r2KeyJob(roundId, jobGroup), data);
        await new Promise(r => setTimeout(r, 500));
      } catch (e) { console.error(`R2 저장 실패 job=${jg} roundId=${roundId}:`, e); }
    }

    written++;
    console.log(`무릉 R2 저장 완료: 회차 ${roundId}`);
  }

  console.log(`무릉 R2 저장: ${written}회차 저장, ${skipped}회차 스킵`);
  return { written, skipped };
}

/**
 * 현재 회차 데이터를 D1에서 읽어 R2 고정 키에 저장 (매시 5분 실행)
 * 스크래핑(:00) 완료 후 갱신된 D1 데이터를 R2에 반영
 */
export async function writeCurrentRoundToR2(
  db: D1Database,
  bucket: R2Bucket
): Promise<{ success: boolean; roundId?: number }> {
  try {
    const current = await db
      .prepare('SELECT id FROM mureung_rounds WHERE is_current = 1 ORDER BY round_start DESC LIMIT 1')
      .first<{ id: number }>();
    if (!current) {
      console.log('무릉 현재 회차 R2 갱신: 현재 회차 없음');
      return { success: false };
    }
    const roundId = current.id;

    const [overallData, guildData] = await Promise.all([
      queryMureungOverall(db, roundId),
      queryMureungGuildRanking(db, roundId),
    ]);
    await Promise.all([
      putToR2(bucket, R2_CURRENT_OVERALL, overallData),
      putToR2(bucket, R2_CURRENT_GUILD, guildData),
    ]);

    for (const jg of Object.keys(MUREUNG_JOB_GROUPS)) {
      const jobGroup = parseInt(jg);
      const jobData = await queryMureungJob(db, roundId, jobGroup);
      await putToR2(bucket, r2KeyCurrentJob(jobGroup), jobData);
    }

    console.log(`무릉 현재 회차 R2 갱신 완료: roundId=${roundId}`);
    return { success: true, roundId };
  } catch (e) {
    console.error('무릉 현재 회차 R2 갱신 실패:', e);
    return { success: false };
  }
}

/**
 * 무릉도장 회차 전환 감지 (매일 01:45 UTC 실행)
 * 전환 감지 시 이전 회차를 R2에 자동 저장
 */
export async function checkMureungRoundTransition(
  db: D1Database,
  workerHost: string,
  bucket?: R2Bucket
): Promise<{ transitioned: boolean; oldRound?: string; newRound?: string }> {
  try {
    const dbCurrent = await db
      .prepare('SELECT * FROM mureung_rounds WHERE is_current = 1 ORDER BY round_start DESC LIMIT 1')
      .first<{ id: number; round_key: string; round_start: string }>();

    const url = `https://maplestar.io/rank/contents?type=mureung&jobGroup=110&page=1`;
    const response = await fetch(url, { headers: { 'User-Agent': 'MaplestarGuildBot/1.0' } });
    if (!response.ok) return { transitioned: false };

    const html = await response.text();
    const roundInfo = parseRoundInfo(html);
    if (!roundInfo) return { transitioned: false };

    if (!dbCurrent || dbCurrent.round_key !== roundInfo.roundKey) {
      console.log(`무릉 회차 전환 감지: ${dbCurrent?.round_key ?? 'none'} → ${roundInfo.roundKey}`);

      const { date, time: rawTime } = getKSTTimestamp();
      const scrapedAt = `${date} ${rawTime}`;

      await db.prepare('UPDATE mureung_rounds SET is_current = 0').run();
      await db.prepare(
        `INSERT OR IGNORE INTO mureung_rounds (round_key, round_start, round_end, boss_name, is_current, scraped_at)
         VALUES (?, ?, ?, ?, 1, ?)`
      ).bind(roundInfo.roundKey, roundInfo.roundStart, roundInfo.roundEnd, roundInfo.bossName, scrapedAt).run();
      await db.prepare(
        `UPDATE mureung_rounds SET is_current = 1, scraped_at = ? WHERE round_key = ?`
      ).bind(scrapedAt, roundInfo.roundKey).run();

      // 이전 회차를 R2에 자동 저장 (bucket이 있을 때만, Worker 종료 전 완료 보장을 위해 await)
      if (bucket) {
        await writeAllPastRoundsToR2(db, bucket).catch(e =>
          console.error('회차 전환 후 R2 저장 실패:', e)
        );
        // 현재 회차 R2 고정 키 삭제 → 다음 :05 갱신 전까지 D1 fallback 사용
        const jobDeleteKeys = Object.keys(MUREUNG_JOB_GROUPS).map(jg => bucket.delete(r2KeyCurrentJob(parseInt(jg))));
        await Promise.all([
          bucket.delete(R2_CURRENT_OVERALL),
          bucket.delete(R2_CURRENT_GUILD),
          ...jobDeleteKeys,
        ]).catch(e => console.error('현재 회차 R2 키 삭제 실패:', e));
      }

      return { transitioned: true, oldRound: dbCurrent?.round_key, newRound: roundInfo.roundKey };
    }

    console.log(`무릉 회차 유지 중: ${dbCurrent.round_key}`);
    return { transitioned: false };
  } catch (e) {
    console.error('무릉 회차 전환 체크 실패:', e);
    return { transitioned: false };
  }
}

// ==================== API 엔드포인트 ====================

// 현재 회차 전직업 종합랭킹
mureungRoutes.get('/overall', async (c) => {
  try {
    const roundParam = c.req.query('roundId');

    // 과거 회차: R2에서 먼저 확인 (D1 쿼리 없음)
    if (roundParam && c.env.BUCKET) {
      const roundId = parseInt(roundParam);
      const r2Data = await getFromR2(c.env.BUCKET, r2KeyOverall(roundId));
      if (r2Data) return success(c, r2Data);

      // R2 miss: D1 조회 후 R2에 백그라운드 저장
      const data = await queryMureungOverall(c.env.DB, roundId);
      if (data.round && !data.round.is_current) {
        c.executionCtx.waitUntil(putToR2(c.env.BUCKET, r2KeyOverall(roundId), data));
      }
      return success(c, data);
    }

    // 현재 회차: R2 고정 키에서 조회
    if (c.env.BUCKET) {
      const r2Data = await getFromR2(c.env.BUCKET, R2_CURRENT_OVERALL);
      if (r2Data) return success(c, r2Data);
    }

    // R2 miss: D1 직접 조회 (fallback)
    const current = await c.env.DB.prepare(
      'SELECT id FROM mureung_rounds WHERE is_current = 1 ORDER BY round_start DESC LIMIT 1'
    ).first<{ id: number }>();
    if (!current) return success(c, { round: null, rankings: [] });

    const data = await queryMureungOverall(c.env.DB, current.id);
    return success(c, data);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 직업별 랭킹
mureungRoutes.get('/job', async (c) => {
  try {
    const jobGroupParam = c.req.query('jobGroup');
    const roundParam = c.req.query('roundId');
    const limitParam = c.req.query('limit') || '100';

    if (!jobGroupParam) return error(c, 'BAD_REQUEST', 'jobGroup 파라미터가 필요합니다.', 400);

    const jobGroup = parseInt(jobGroupParam);
    if (!(jobGroup in MUREUNG_JOB_GROUPS)) return error(c, 'BAD_REQUEST', '유효하지 않은 jobGroup입니다.', 400);

    // 과거 회차: R2에서 먼저 확인
    if (roundParam && c.env.BUCKET) {
      const roundId = parseInt(roundParam);
      const r2Data = await getFromR2(c.env.BUCKET, r2KeyJob(roundId, jobGroup));
      if (r2Data) return success(c, r2Data);

      // R2 miss: D1 조회 후 R2에 백그라운드 저장
      const data = await queryMureungJob(c.env.DB, roundId, jobGroup, parseInt(limitParam));
      if (data.round && !data.round.is_current) {
        c.executionCtx.waitUntil(putToR2(c.env.BUCKET, r2KeyJob(roundId, jobGroup), data));
      }
      return success(c, data);
    }

    // 현재 회차: R2 고정 키에서 조회
    if (c.env.BUCKET) {
      const r2Data = await getFromR2(c.env.BUCKET, r2KeyCurrentJob(jobGroup));
      if (r2Data) return success(c, r2Data);
    }

    // R2 miss: D1 직접 조회 (fallback)
    const current = await c.env.DB.prepare(
      'SELECT id FROM mureung_rounds WHERE is_current = 1 ORDER BY round_start DESC LIMIT 1'
    ).first<{ id: number }>();
    if (!current) return success(c, { round: null, jobGroup, jobName: MUREUNG_JOB_GROUPS[jobGroup], rankings: [] });

    const data = await queryMureungJob(c.env.DB, current.id, jobGroup, parseInt(limitParam));
    return success(c, data);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 회차별 길드 랭킹
mureungRoutes.get('/guild-ranking', async (c) => {
  try {
    const roundParam = c.req.query('roundId');

    // 과거 회차: R2에서 먼저 확인
    if (roundParam && c.env.BUCKET) {
      const roundId = parseInt(roundParam);
      const r2Data = await getFromR2(c.env.BUCKET, r2KeyGuild(roundId));
      if (r2Data) return success(c, r2Data);

      // R2 miss: D1 조회 후 R2에 백그라운드 저장
      const data = await queryMureungGuildRanking(c.env.DB, roundId);
      if (data.round && !data.round.is_current) {
        c.executionCtx.waitUntil(putToR2(c.env.BUCKET, r2KeyGuild(roundId), data));
      }
      return success(c, data);
    }

    // 현재 회차: R2 고정 키에서 조회
    if (c.env.BUCKET) {
      const r2Data = await getFromR2(c.env.BUCKET, R2_CURRENT_GUILD);
      if (r2Data) return success(c, r2Data);
    }

    // R2 miss: D1 직접 조회 (fallback)
    const current = await c.env.DB.prepare(
      'SELECT id FROM mureung_rounds WHERE is_current = 1 ORDER BY round_start DESC LIMIT 1'
    ).first<{ id: number }>();
    if (!current) return success(c, { round: null, rankings: [], medal_members: [] });

    const data = await queryMureungGuildRanking(c.env.DB, current.id);
    return success(c, data);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 역대 최고 기록 TOP 10
mureungRoutes.get('/history', async (c) => {
  try {
    const cached = await caches.default.match(new Request(c.req.url));
    if (cached) return cached;

    const { results } = await c.env.DB.prepare(`
      WITH best AS (SELECT username, MAX(score) AS score FROM mureung_ranking GROUP BY username)
      SELECT m.username, b.score, m.job_name, m.avatar_img, m.usercode,
             r.round_start, r.round_end, r.boss_name
      FROM best b
      INNER JOIN mureung_ranking m ON m.username = b.username AND m.score = b.score
      INNER JOIN mureung_rounds r ON m.round_id = r.id
      GROUP BY m.username ORDER BY b.score DESC LIMIT 10
    `).all();
    return cachedResponse(c, results, 1800);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 회차 목록
mureungRoutes.get('/rounds', async (c) => {
  try {
    const cached = await caches.default.match(new Request(c.req.url));
    if (cached) return cached;

    const { results } = await c.env.DB.prepare(
      'SELECT * FROM mureung_rounds ORDER BY round_start DESC LIMIT 50'
    ).all();
    return cachedResponse(c, results, 3600);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 수동 스크래핑 트리거 (master 전용)
mureungRoutes.post('/scrape', authMiddleware, requireRole('master'), async (c) => {
  try {
    const batchParam = c.req.query('batch');
    const batchIndex = batchParam !== null && batchParam !== undefined ? parseInt(batchParam) : undefined;
    const result = await scrapeMureungRankings(c.env.DB, batchIndex);
    return success(c, {
      message: `무릉 스크래핑 완료: ${result.total}건 저장, ${result.errors}건 오류`,
      batch: result.batch,
      round: result.round,
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 과거 회차 R2 저장 (master 전용)
// 이미 R2에 있는 회차는 D1 쿼리 없이 스킵 → 사이트 영향 없음
mureungRoutes.post('/warm-cache', authMiddleware, requireRole('master'), async (c) => {
  if (!c.env.BUCKET) return error(c, 'NOT_CONFIGURED', 'R2 버킷이 설정되지 않았습니다.', 500);
  c.executionCtx.waitUntil(
    writeAllPastRoundsToR2(c.env.DB, c.env.BUCKET)
      .then(r => console.log(`R2 저장 완료: ${r.written}회차 저장, ${r.skipped}회차 스킵`))
      .catch(e => console.error('R2 저장 실패:', e))
  );
  return success(c, { message: 'R2 저장을 백그라운드에서 시작했습니다. (이미 저장된 회차는 자동 스킵)' });
});

// 특정 회차 R2 저장 (master 전용) - 회차 하나씩 나눠서 저장할 때 사용
mureungRoutes.post('/warm-cache/:roundId', authMiddleware, requireRole('master'), async (c) => {
  if (!c.env.BUCKET) return error(c, 'NOT_CONFIGURED', 'R2 버킷이 설정되지 않았습니다.', 500);
  const roundId = parseInt(c.req.param('roundId'));
  if (isNaN(roundId)) return error(c, 'BAD_REQUEST', '유효하지 않은 roundId입니다.', 400);

  const round = await c.env.DB.prepare('SELECT * FROM mureung_rounds WHERE id = ? AND is_current = 0')
    .bind(roundId).first<{ id: number }>();
  if (!round) return error(c, 'NOT_FOUND', '해당 과거 회차를 찾을 수 없습니다.', 404);

  c.executionCtx.waitUntil((async () => {
    try {
      const overall = await queryMureungOverall(c.env.DB, roundId);
      await putToR2(c.env.BUCKET!, r2KeyOverall(roundId), overall);
      await new Promise(r => setTimeout(r, 500));

      const guild = await queryMureungGuildRanking(c.env.DB, roundId);
      await putToR2(c.env.BUCKET!, r2KeyGuild(roundId), guild);
      await new Promise(r => setTimeout(r, 500));

      for (const jg of Object.keys(MUREUNG_JOB_GROUPS)) {
        const jobGroup = parseInt(jg);
        const data = await queryMureungJob(c.env.DB, roundId, jobGroup);
        await putToR2(c.env.BUCKET!, r2KeyJob(roundId, jobGroup), data);
        await new Promise(r => setTimeout(r, 500));
      }
      console.log(`R2 저장 완료: 회차 ${roundId}`);
    } catch (e) {
      console.error(`R2 저장 실패 roundId=${roundId}:`, e);
    }
  })());
  return success(c, { message: `회차 ${roundId} R2 저장을 백그라운드에서 시작했습니다.` });
});

// 역대 기록 전체 스크래핑 (master 전용)
mureungRoutes.post('/scrape-all-history', authMiddleware, requireRole('master'), async (c) => {
  try {
    const force = c.req.query('force') === 'true';
    const result = await scrapeAllMureungHistory(c.env.DB, force);
    return success(c, {
      message: `역대 무릉 스크래핑 완료: ${result.rounds}회차 ${result.total}건 저장, ${result.skipped}회차 스킵, ${result.errors}건 오류`,
      total: result.total, errors: result.errors, rounds: result.rounds, skipped: result.skipped,
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 스크래핑 상태 확인
mureungRoutes.get('/status', async (c) => {
  try {
    const totalRecords = await c.env.DB.prepare('SELECT COUNT(*) as total FROM mureung_ranking').first<{ total: number }>();
    const currentRound = await c.env.DB.prepare('SELECT * FROM mureung_rounds WHERE is_current = 1 ORDER BY round_start DESC LIMIT 1').first();
    const roundCount = await c.env.DB.prepare('SELECT COUNT(*) as total FROM mureung_rounds').first<{ total: number }>();

    return success(c, {
      total_records: totalRecords?.total || 0,
      total_rounds: roundCount?.total || 0,
      current_round: currentRound || null,
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});
