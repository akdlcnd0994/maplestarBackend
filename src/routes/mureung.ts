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

// 12배치 (2직업씩 × 11 + 마지막 2직업)
export const MUREUNG_BATCHES: number[][] = [
  [110, 120], [130, 210], [220, 230],
  [310, 320], [410, 420], [430, 510],
  [520, 530], [2110, 2210], [2310, 3110],
  [3210, 3310], [3510, 4110], [4210, 2410],
];
export const MUREUNG_TOTAL_BATCHES = MUREUNG_BATCHES.length; // 12

// 알려진 역대 회차 목록 (사이트 표기: roundEnd = 다음 회차 시작일)
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
  // 현재 진행 중인 회차(2026-03-09~)는 일반 scrapeMureungRankings로 처리
];

const MAX_PAGE = 20;
const BATCH_SIZE = 80;

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

/**
 * 현재 회차 정보 파싱 (date 파라미터 없이 fetch한 HTML)
 * visibleDates의 마지막 완료 회차에서 +14일 = 현재 진행 중인 회차 시작일
 * 현재 회차 보스명은 HTML 텍스트의 "M/D/YYYY~M/D/YYYY (보스명)" 패턴에서 파싱
 */
function parseRoundInfo(html: string): RoundInfo | null {
  // mureungId 목록 추출 (RSC visibleDates 데이터)
  const idMatches = [...html.matchAll(/mureungId[^:]*:(\d{8})/g)];
  if (idMatches.length === 0) return null;

  // 마지막 완료 회차 ID (= 가장 최근 역대 회차)
  const lastId = idMatches[idMatches.length - 1][1]; // e.g. "20260209"

  // 현재 회차 시작일 = 마지막 역대 회차 시작일 + 14일
  const lastDate = new Date(`${lastId.slice(0,4)}-${lastId.slice(4,6)}-${lastId.slice(6,8)}T00:00:00Z`);
  const startDate = new Date(lastDate);
  startDate.setUTCDate(startDate.getUTCDate() + 14);
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 14); // 사이트 표기: roundEnd = 다음 회차 시작일

  const roundStart = startDate.toISOString().slice(0, 10);
  const roundEnd   = endDate.toISOString().slice(0, 10);
  const roundKey   = `${roundStart}~${roundEnd}`;

  // 현재 회차 보스명 파싱: roundStart(YYYY-MM-DD)를 M/D/YYYY로 변환 후 해당 날짜 기준 매칭
  // HTML에 "M/D/YYYY~M/D/YYYY (보스명)" 형식으로 노출되므로 현재 회차 시작일로 정확히 매칭
  const [yr, mo, dy] = roundStart.split('-');
  const startMDY = `${parseInt(mo)}/${parseInt(dy)}/${yr}`; // e.g. "3/9/2026"
  const bossMatch = html.match(
    new RegExp(startMDY.replace(/\//g, '\\/') + '~[\\d/]+\\s*\\(([^)]+)\\)')
  );
  const bossName = bossMatch ? bossMatch[1].trim() : ''; // 미공개 시 '' 반환

  return { roundKey, roundStart, roundEnd, bossName };
}

/**
 * 무릉도장 랭킹 페이지 HTML 파싱
 * 실제 구조: flex-1(순위) / flex-4(아바타+캐릭터명) / flex-1(레벨) / flex-3(점수)
 */
function parseMureungHtml(html: string, jobGroup: number): MureungEntry[] {
  const results: MureungEntry[] = [];
  const jobName = MUREUNG_JOB_GROUPS[jobGroup] || '';

  const liBlocks = html.split(/<li\s+class="flex items-center py-2/);

  for (let i = 1; i < liBlocks.length; i++) {
    const block = liBlocks[i];

    // flex-1 text-center: 첫 번째가 순위
    const flex1Match = block.match(/class="flex-1 text-center">([^<]+)<\/span>/);
    if (!flex1Match) continue;
    const rank = parseInt(flex1Match[1].trim());
    if (isNaN(rank)) continue;

    // flex-3 text-center: 점수
    const flex3Match = block.match(/class="flex-3 text-center">([^<]+)<\/span>/);
    if (!flex3Match) continue;
    const score = parseInt(flex3Match[1].trim().replace(/,/g, ''));
    if (isNaN(score) || score <= 0) continue;

    // 캐릭터명: 아바타 </div> 바로 다음 텍스트 → </span><span class="flex-1 ...">
    const nameMatch = block.match(/<\/div>([^<]+)<\/span><span\s+class="flex-1 text-center">/);
    if (!nameMatch) continue;
    const username = nameMatch[1].trim();
    if (!username) continue;

    // 아바타 이미지: Next.js 이미지 프록시 URL에서 원본 URL 추출
    // src="/_next/image?url=https%3A%2F%2Fmod-file.dn.nexoncdn.co.kr%2Fprofile%2F{folder}%2F{file}.png&..."
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

/**
 * 무릉도장 스크래핑
 * batchIndex: 0~11 (배치 모드), undefined면 전체
 */
export async function scrapeMureungRankings(
  db: D1Database,
  batchIndex?: number
): Promise<{ total: number; errors: number; batch?: number; round?: string }> {
  const { date, time: rawTime } = getKSTTimestamp();
  const scrapedAt = `${date} ${rawTime}`;

  const jobGroups = batchIndex !== undefined
    ? MUREUNG_BATCHES[batchIndex] || []
    : Object.keys(MUREUNG_JOB_GROUPS).map(Number);

  if (jobGroups.length === 0) {
    return { total: 0, errors: 0, batch: batchIndex };
  }

  let roundId: number | null = null;
  let roundKey = '';
  let errorCount = 0;
  const allEntries: Array<{
    round_id: number;
    job_group: number;
    rank: number;
    username: string;
    score: number;
    job_name: string;
    avatar_img: string;
    usercode: string;
    scraped_at: string;
  }> = [];

  for (const jobGroup of jobGroups) {
    for (let page = 1; page <= MAX_PAGE; page++) {
      try {
        const url = `https://maplestar.io/rank/contents?type=mureung&jobGroup=${jobGroup}&page=${page}`;
        const response = await fetch(url, {
          headers: { 'User-Agent': 'MaplestarGuildBot/1.0' },
        });

        if (!response.ok) {
          errorCount++;
          continue;
        }

        const html = await response.text();
        const entries = parseMureungHtml(html, jobGroup);

        if (entries.length === 0) break;

        // 첫 페이지에서 회차 정보 파싱 및 저장
        if (roundId === null && page === 1) {
          const roundInfo = parseRoundInfo(html);
          if (roundInfo) {
            roundKey = roundInfo.roundKey;

            // 이미 존재하는 회차인지 확인
            const existing = await db
              .prepare('SELECT id FROM mureung_rounds WHERE round_key = ?')
              .bind(roundInfo.roundKey)
              .first<{ id: number }>();

            if (existing) {
              roundId = existing.id;
            } else {
              // 기존 회차 is_current = 0 처리
              await db.prepare('UPDATE mureung_rounds SET is_current = 0').run();

              const inserted = await db
                .prepare(
                  `INSERT INTO mureung_rounds (round_key, round_start, round_end, boss_name, is_current, scraped_at)
                   VALUES (?, ?, ?, ?, 1, ?)`
                )
                .bind(roundInfo.roundKey, roundInfo.roundStart, roundInfo.roundEnd, roundInfo.bossName, scrapedAt)
                .run();
              roundId = inserted.meta?.last_row_id as number;
            }

            // 최신 회차로 업데이트 (is_current = 1, boss_name이 비어있으면 파싱값으로 갱신)
            await db
              .prepare(`UPDATE mureung_rounds SET is_current = 1, scraped_at = ?,
                boss_name = CASE WHEN boss_name = '' THEN ? ELSE boss_name END WHERE id = ?`)
              .bind(scrapedAt, roundInfo.bossName, roundId)
              .run();
          }
        }

        if (roundId === null) {
          // 회차 파싱 실패 시 임시 라운드 생성
          const fallbackKey = `unknown-${date}`;
          const existing = await db
            .prepare('SELECT id FROM mureung_rounds WHERE round_key = ?')
            .bind(fallbackKey)
            .first<{ id: number }>();

          if (existing) {
            roundId = existing.id;
          } else {
            await db.prepare('UPDATE mureung_rounds SET is_current = 0').run();
            const inserted = await db
              .prepare(
                `INSERT INTO mureung_rounds (round_key, round_start, round_end, boss_name, is_current, scraped_at)
                 VALUES (?, ?, ?, '', 1, ?)`
              )
              .bind(fallbackKey, date, date, scrapedAt)
              .run();
            roundId = inserted.meta?.last_row_id as number;
          }
          roundKey = fallbackKey;
        }

        for (const entry of entries) {
          allEntries.push({
            round_id: roundId,
            job_group: jobGroup,
            rank: entry.rank,
            username: entry.username,
            score: entry.score,
            job_name: entry.jobName,
            avatar_img: entry.avatarImg,
            usercode: entry.usercode,
            scraped_at: scrapedAt,
          });
        }
      } catch (e) {
        console.error(`무릉 스크래핑 실패 jobGroup=${jobGroup} page=${page}:`, e);
        errorCount++;
      }
    }
  }

  // UPSERT (같은 회차+직업군+캐릭터명은 덮어쓰기)
  for (let i = 0; i < allEntries.length; i += BATCH_SIZE) {
    const batch = allEntries.slice(i, i + BATCH_SIZE);
    const stmts = batch.map((e) =>
      db
        .prepare(
          `INSERT INTO mureung_ranking (round_id, job_group, rank, username, score, job_name, avatar_img, usercode, scraped_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(round_id, job_group, username) DO UPDATE SET
             rank=excluded.rank, score=excluded.score, job_name=excluded.job_name,
             avatar_img=excluded.avatar_img, usercode=excluded.usercode, scraped_at=excluded.scraped_at`
        )
        .bind(e.round_id, e.job_group, e.rank, e.username, e.score, e.job_name, e.avatar_img, e.usercode, e.scraped_at)
    );
    await db.batch(stmts);
  }

  const batchInfo =
    batchIndex !== undefined
      ? ` (배치 ${batchIndex}/${MUREUNG_TOTAL_BATCHES - 1}, 직업군 ${jobGroups.join(',')})`
      : ' (전체)';
  console.log(`무릉 스크래핑 완료${batchInfo}: ${allEntries.length}건 저장, ${errorCount}건 오류, 회차=${roundKey}`);
  return { total: allEntries.length, errors: errorCount, batch: batchIndex, round: roundKey };
}

/**
 * 역대 무릉도장 회차 전체 스크래핑
 * KNOWN_MUREUNG_HISTORY의 모든 과거 회차를 순차적으로 스크래핑
 * (로컬 개발 환경 전용 — 프로덕션에서는 subrequest 제한에 걸릴 수 있음)
 * force=true 이면 이미 데이터가 있는 회차도 재크롤링
 */
export async function scrapeAllMureungHistory(
  db: D1Database,
  force = false
): Promise<{ total: number; errors: number; rounds: number; skipped: number }> {
  const { date, time: rawTime } = getKSTTimestamp();
  const scrapedAt = `${date} ${rawTime}`;
  const jobGroupList = Object.keys(MUREUNG_JOB_GROUPS).map(Number);

  let total = 0;
  let errors = 0;
  let skipped = 0;

  for (const knownRound of KNOWN_MUREUNG_HISTORY) {
    const roundKey = `${knownRound.roundStart}~${knownRound.roundEnd}`;

    // 회차 DB 확인/생성
    let roundId: number;
    const existing = await db
      .prepare('SELECT id FROM mureung_rounds WHERE round_key = ?')
      .bind(roundKey)
      .first<{ id: number }>();

    if (existing) {
      roundId = existing.id;

      // force=false 이면 이미 데이터가 있는 회차는 스킵
      if (!force) {
        const count = await db
          .prepare('SELECT COUNT(*) as cnt FROM mureung_ranking WHERE round_id = ?')
          .bind(roundId)
          .first<{ cnt: number }>();
        if (count && count.cnt > 0) {
          console.log(`역대 무릉 스킵: ${knownRound.bossName}(${knownRound.mureungId}) 이미 ${count.cnt}건 존재`);
          total += count.cnt;
          skipped++;
          continue;
        }
      }
    } else {
      const inserted = await db
        .prepare(
          `INSERT INTO mureung_rounds (round_key, round_start, round_end, boss_name, is_current, scraped_at)
           VALUES (?, ?, ?, ?, 0, ?)`
        )
        .bind(roundKey, knownRound.roundStart, knownRound.roundEnd, knownRound.bossName, scrapedAt)
        .run();
      roundId = inserted.meta?.last_row_id as number;
    }

    // 모든 직업군 + 모든 페이지 스크래핑
    const allEntries: Array<{
      round_id: number;
      job_group: number;
      rank: number;
      username: string;
      score: number;
      job_name: string;
      avatar_img: string;
      usercode: string;
      scraped_at: string;
    }> = [];

    for (const jobGroup of jobGroupList) {
      for (let page = 1; page <= MAX_PAGE; page++) {
        try {
          const url = `https://maplestar.io/rank/contents?type=mureung&jobGroup=${jobGroup}&page=${page}&date=${knownRound.mureungId}`;
          const response = await fetch(url, {
            headers: { 'User-Agent': 'MaplestarGuildBot/1.0' },
          });
          if (!response.ok) { errors++; continue; }

          const html = await response.text();
          const entries = parseMureungHtml(html, jobGroup);
          if (entries.length === 0) break;

          for (const entry of entries) {
            allEntries.push({
              round_id: roundId,
              job_group: jobGroup,
              rank: entry.rank,
              username: entry.username,
              score: entry.score,
              job_name: entry.jobName,
              avatar_img: entry.avatarImg,
              usercode: entry.usercode,
              scraped_at: scrapedAt,
            });
          }
        } catch (e) {
          console.error(
            `역대 무릉 스크래핑 실패 mureungId=${knownRound.mureungId} jobGroup=${jobGroup} page=${page}:`,
            e
          );
          errors++;
        }
      }
    }

    // UPSERT
    for (let i = 0; i < allEntries.length; i += BATCH_SIZE) {
      const chunk = allEntries.slice(i, i + BATCH_SIZE);
      const stmts = chunk.map((e) =>
        db
          .prepare(
            `INSERT INTO mureung_ranking (round_id, job_group, rank, username, score, job_name, avatar_img, usercode, scraped_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(round_id, job_group, username) DO UPDATE SET
               rank=excluded.rank, score=excluded.score, job_name=excluded.job_name,
               avatar_img=excluded.avatar_img, usercode=excluded.usercode, scraped_at=excluded.scraped_at`
          )
          .bind(e.round_id, e.job_group, e.rank, e.username, e.score, e.job_name, e.avatar_img, e.usercode, e.scraped_at)
      );
      await db.batch(stmts);
    }

    total += allEntries.length;
    console.log(
      `역대 무릉 완료: ${knownRound.bossName}(${knownRound.mureungId}) ${allEntries.length}건 저장`
    );
  }

  return { total, errors, rounds: KNOWN_MUREUNG_HISTORY.length, skipped };
}

/**
 * 무릉도장 회차 전환 감지 (매일 01:45 UTC 실행)
 * - 사이트에서 파싱한 현재 회차와 DB의 is_current=1 회차를 비교
 * - 다르면 회차 전환으로 판정 → DB 업데이트 (새 회차 등록, 이전 회차 is_current=0)
 */
export async function checkMureungRoundTransition(
  db: D1Database,
  workerHost: string
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
      // 회차 전환 감지
      console.log(`무릉 회차 전환 감지: ${dbCurrent?.round_key ?? 'none'} → ${roundInfo.roundKey}`);

      const { date, time: rawTime } = getKSTTimestamp();
      const scrapedAt = `${date} ${rawTime}`;

      // 기존 회차 전부 is_current = 0
      await db.prepare('UPDATE mureung_rounds SET is_current = 0').run();

      // 새 회차 INSERT OR IGNORE
      await db.prepare(
        `INSERT OR IGNORE INTO mureung_rounds (round_key, round_start, round_end, boss_name, is_current, scraped_at)
         VALUES (?, ?, ?, ?, 1, ?)`
      ).bind(roundInfo.roundKey, roundInfo.roundStart, roundInfo.roundEnd, roundInfo.bossName, scrapedAt).run();

      // 이미 존재하던 경우도 is_current = 1 갱신
      await db.prepare(
        `UPDATE mureung_rounds SET is_current = 1, scraped_at = ? WHERE round_key = ?`
      ).bind(scrapedAt, roundInfo.roundKey).run();

      // 이전 회차 캐시 워밍 (회차 전환 시 한 번만 수행)
      warmMureungPastRoundsCache(db, workerHost).catch(e =>
        console.error('회차 전환 후 캐시 워밍 실패:', e)
      );

      return { transitioned: true, oldRound: dbCurrent?.round_key, newRound: roundInfo.roundKey };
    }

    console.log(`무릉 회차 유지 중: ${dbCurrent.round_key}`);
    return { transitioned: false };
  } catch (e) {
    console.error('무릉 회차 전환 체크 실패:', e);
    return { transitioned: false };
  }
}

/**
 * 과거 회차 서버 캐시 워밍
 * 이미 캐시된 회차는 스킵, 없는 회차만 셀프 fetch → 기존 엔드포인트가 DB 조회 + cache.put 처리
 */
export async function warmMureungPastRoundsCache(
  db: D1Database,
  workerHost: string
): Promise<{ warmed: number; skipped: number }> {
  const { results: pastRounds } = await db
    .prepare('SELECT id FROM mureung_rounds WHERE is_current = 0 ORDER BY round_start DESC')
    .all<{ id: number }>();

  let warmed = 0;
  let skipped = 0;

  for (const { id: roundId } of pastRounds) {
    const urls = [
      `${workerHost}/api/mureung/overall?roundId=${roundId}`,
      `${workerHost}/api/mureung/guild-ranking?roundId=${roundId}`,
      ...Object.keys(MUREUNG_JOB_GROUPS).map(jg => `${workerHost}/api/mureung/job?jobGroup=${jg}&roundId=${roundId}`),
    ];

    // URL별 캐시 여부 개별 확인 → 없는 URL만 fetch
    const cacheChecks = await Promise.all(urls.map(url => caches.default.match(new Request(url))));
    const uncachedUrls = urls.filter((_, i) => !cacheChecks[i]);

    if (uncachedUrls.length === 0) {
      skipped++;
      continue;
    }

    // body consume 필수 — 읽지 않으면 Workers가 요청을 완전히 처리하지 않아 cache.put 미실행
    await Promise.all(uncachedUrls.map(url => fetch(url).then(r => r.text())));
    warmed++;
    console.log(`무릉 캐시 워밍 완료: 회차 ${roundId} (${uncachedUrls.length}개 워밍)`);
  }

  console.log(`무릉 캐시 워밍: ${warmed}회차 워밍, ${skipped}회차 스킵`);
  return { warmed, skipped };
}

/**
 * 현재 회차 서버 캐시 무효화 (매시 35분 실행)
 * roundId 없는 기본 조회 URL들을 삭제 → 다음 요청 시 DB 조회 후 자동 재캐싱
 */
export async function invalidateCurrentRoundCache(workerHost: string): Promise<void> {
  const cache = caches.default;
  const urls = [
    `${workerHost}/api/mureung/overall`,
    `${workerHost}/api/mureung/guild-ranking`,
    ...Object.keys(MUREUNG_JOB_GROUPS).map(jg => `${workerHost}/api/mureung/job?jobGroup=${jg}`),
  ];
  const results = await Promise.all(urls.map(url => cache.delete(new Request(url))));
  console.log(`무릉 현재 회차 캐시 무효화: ${results.filter(Boolean).length}/${urls.length}개 삭제`);
}

// ==================== API 엔드포인트 ====================

const PAST_ROUND_TTL = 2419200; // 과거 회차: 28일 (데이터 불변)
const CURRENT_ROUND_TTL = 3600; // 현재 회차: 1시간 (35분 cron 무효화와 맞춤)

/** Cache-Control 헤더를 포함한 JSON 응답 생성 및 서버 캐시 저장 */
function cachedResponse(c: any, data: any, maxAge: number): Response {
  const resp = new Response(JSON.stringify({ success: true, data }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${maxAge}`,
    },
  });
  c.executionCtx.waitUntil(caches.default.put(new Request(c.req.url), resp.clone()));
  return resp;
}

// 현재 회차 전직업 종합랭킹 (개인 최고 점수 기준, 상위 50명)
mureungRoutes.get('/overall', async (c) => {
  try {
    const roundParam = c.req.query('roundId');

    // 서버 캐시 체크 (현재 회차 기본 조회 + 과거 회차 모두)
    const cached = await caches.default.match(new Request(c.req.url));
    if (cached) return cached;

    let roundId: number | null = null;

    if (roundParam) {
      roundId = parseInt(roundParam);
    } else {
      const current = await c.env.DB.prepare(
        'SELECT id FROM mureung_rounds WHERE is_current = 1 ORDER BY round_start DESC LIMIT 1'
      ).first<{ id: number }>();
      roundId = current?.id ?? null;
    }

    if (!roundId) {
      return success(c, { round: null, rankings: [] });
    }

    const round = await c.env.DB.prepare(
      'SELECT * FROM mureung_rounds WHERE id = ?'
    ).bind(roundId).first<{ id: number; is_current: number; [key: string]: any }>();

    const { results } = await c.env.DB.prepare(`
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
        SELECT username, userlevel, userguild FROM (
          SELECT username, userlevel, userguild,
                 ROW_NUMBER() OVER (PARTITION BY username ORDER BY userdate DESC, usertime DESC) AS rn
          FROM ranking_characters
        ) WHERE rn = 1
      )
      SELECT
        cur.*,
        pr.rank AS prev_job_rank,
        rc.userlevel,
        rc.userguild
      FROM cur
      LEFT JOIN mureung_ranking pr
        ON pr.round_id = (SELECT id FROM prev_id)
        AND pr.username = cur.username
        AND pr.job_group = cur.job_group
      LEFT JOIN rc_latest rc ON rc.username = cur.username
      ORDER BY cur.score DESC
      LIMIT 50
    `).bind(roundId, roundId).all();

    const isPast = round && !round.is_current;
    const shouldCache = isPast || !roundParam;

    if (shouldCache) {
      const ttl = isPast ? PAST_ROUND_TTL : CURRENT_ROUND_TTL;
      return cachedResponse(c, { round, rankings: results }, ttl);
    }
    return success(c, { round, rankings: results });
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

    if (!jobGroupParam) {
      return error(c, 'BAD_REQUEST', 'jobGroup 파라미터가 필요합니다.', 400);
    }

    const jobGroup = parseInt(jobGroupParam);
    if (!(jobGroup in MUREUNG_JOB_GROUPS)) {
      return error(c, 'BAD_REQUEST', '유효하지 않은 jobGroup입니다.', 400);
    }

    // 서버 캐시 체크
    const cached = await caches.default.match(new Request(c.req.url));
    if (cached) return cached;

    let roundId: number | null = null;
    if (roundParam) {
      roundId = parseInt(roundParam);
    } else {
      const current = await c.env.DB.prepare(
        'SELECT id FROM mureung_rounds WHERE is_current = 1 ORDER BY round_start DESC LIMIT 1'
      ).first<{ id: number }>();
      roundId = current?.id ?? null;
    }

    if (!roundId) {
      return success(c, { round: null, jobGroup, jobName: MUREUNG_JOB_GROUPS[jobGroup], rankings: [] });
    }

    const round = await c.env.DB.prepare(
      'SELECT * FROM mureung_rounds WHERE id = ?'
    ).bind(roundId).first<{ id: number; is_current: number; [key: string]: any }>();

    const { results } = await c.env.DB.prepare(`
      WITH prev_id AS (
        SELECT id FROM mureung_rounds
        WHERE round_start < (SELECT round_start FROM mureung_rounds WHERE id = ?)
        ORDER BY round_start DESC LIMIT 1
      ),
      rc_latest AS (
        SELECT username, userlevel, userguild FROM (
          SELECT username, userlevel, userguild,
                 ROW_NUMBER() OVER (PARTITION BY username ORDER BY userdate DESC, usertime DESC) AS rn
          FROM ranking_characters
        ) WHERE rn = 1
      )
      SELECT
        mr.rank, mr.username, mr.score, mr.job_name, mr.avatar_img, mr.usercode,
        pr.rank AS prev_job_rank,
        rc.userlevel,
        rc.userguild
      FROM mureung_ranking mr
      LEFT JOIN mureung_ranking pr
        ON pr.round_id = (SELECT id FROM prev_id)
        AND pr.username = mr.username
        AND pr.job_group = mr.job_group
      LEFT JOIN rc_latest rc ON rc.username = mr.username
      WHERE mr.round_id = ? AND mr.job_group = ?
      ORDER BY mr.score DESC
      LIMIT ?
    `).bind(roundId, roundId, jobGroup, parseInt(limitParam)).all();

    const isPast = round && !round.is_current;
    const shouldCache = isPast || !roundParam;
    const data = { round, jobGroup, jobName: MUREUNG_JOB_GROUPS[jobGroup], rankings: results };

    if (shouldCache) {
      const ttl = isPast ? PAST_ROUND_TTL : CURRENT_ROUND_TTL;
      return cachedResponse(c, data, ttl);
    }
    return success(c, data);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 역대 최고 기록 TOP 10 (전 회차 통합, 캐릭터별 최고 점수 기준)
mureungRoutes.get('/history', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      WITH best AS (
        SELECT username, MAX(score) AS score
        FROM mureung_ranking
        GROUP BY username
      )
      SELECT m.username, b.score, m.job_name, m.avatar_img, m.usercode,
             r.round_start, r.round_end, r.boss_name
      FROM best b
      INNER JOIN mureung_ranking m
        ON m.username = b.username AND m.score = b.score
      INNER JOIN mureung_rounds r ON m.round_id = r.id
      GROUP BY m.username
      ORDER BY b.score DESC
      LIMIT 10
    `).all();
    return cachedResponse(c, results, 1800); // 역대 기록: 30분
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 회차 목록
mureungRoutes.get('/rounds', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM mureung_rounds ORDER BY round_start DESC LIMIT 50'
    ).all();
    return cachedResponse(c, results, 3600); // 회차 목록: 1시간
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 수동 스크래핑 트리거 (master 전용)
mureungRoutes.post('/scrape', authMiddleware, requireRole('master'), async (c) => {
  try {
    const batchParam = c.req.query('batch');
    const batchIndex =
      batchParam !== null && batchParam !== undefined ? parseInt(batchParam) : undefined;
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

// 과거 회차 캐시 워밍 (master 전용)
// 이미 캐시된 회차는 스킵, 없는 회차만 DB 조회 후 캐싱
mureungRoutes.post('/warm-cache', authMiddleware, requireRole('master'), async (c) => {
  try {
    const host = c.env.WORKER_HOST || 'https://api.maplestar.app';
    const result = await warmMureungPastRoundsCache(c.env.DB, host);
    return success(c, {
      message: `캐시 워밍 완료: ${result.warmed}회차 워밍, ${result.skipped}회차 스킵`,
      warmed: result.warmed,
      skipped: result.skipped,
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 역대 기록 전체 스크래핑 (master 전용, 로컬 환경 권장)
// ?force=true 이면 이미 데이터 있는 회차도 강제 재크롤링
mureungRoutes.post('/scrape-all-history', authMiddleware, requireRole('master'), async (c) => {
  try {
    const force = c.req.query('force') === 'true';
    const result = await scrapeAllMureungHistory(c.env.DB, force);
    return success(c, {
      message: `역대 무릉 스크래핑 완료: ${result.rounds}회차 ${result.total}건 저장, ${result.skipped}회차 스킵, ${result.errors}건 오류`,
      total: result.total,
      errors: result.errors,
      rounds: result.rounds,
      skipped: result.skipped,
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 회차별 길드 랭킹 (금/은/동 메달 집계)
mureungRoutes.get('/guild-ranking', async (c) => {
  try {
    const roundParam = c.req.query('roundId');

    // 서버 캐시 체크
    const cached = await caches.default.match(new Request(c.req.url));
    if (cached) return cached;

    let roundId: number | null = null;

    if (roundParam) {
      roundId = parseInt(roundParam);
    } else {
      const current = await c.env.DB.prepare(
        'SELECT id FROM mureung_rounds WHERE is_current = 1 ORDER BY round_start DESC LIMIT 1'
      ).first<{ id: number }>();
      roundId = current?.id ?? null;
    }

    if (!roundId) {
      return success(c, { round: null, rankings: [] });
    }

    const round = await c.env.DB.prepare(
      'SELECT * FROM mureung_rounds WHERE id = ?'
    ).bind(roundId).first<{ id: number; is_current: number; [key: string]: any }>();

    // 길드별 상위 30명 기준 메달 집계 + 총합 점수
    const { results: guildStats } = await c.env.DB.prepare(`
      WITH rc_latest AS (
        SELECT username, userguild FROM (
          SELECT username, userguild,
                 ROW_NUMBER() OVER (PARTITION BY username ORDER BY userdate DESC, usertime DESC) AS rn
          FROM ranking_characters
          WHERE userguild != '' AND userguild IS NOT NULL
        ) WHERE rn = 1
      ),
      round_entries AS (
        SELECT mr.job_group, mr.rank, mr.username, mr.score, mr.job_name, mr.avatar_img,
               rc.userguild AS guild
        FROM mureung_ranking mr
        INNER JOIN rc_latest rc ON rc.username = mr.username
        WHERE mr.round_id = ?
      ),
      char_best AS (
        SELECT guild, username, MAX(score) AS best_score
        FROM round_entries
        GROUP BY guild, username
      ),
      top30 AS (
        SELECT guild, username, best_score,
               ROW_NUMBER() OVER (PARTITION BY guild ORDER BY best_score DESC) AS rn
        FROM char_best
      ),
      medal_counts AS (
        SELECT re.guild,
          SUM(CASE WHEN re.rank = 1 THEN 1 ELSE 0 END) AS gold,
          SUM(CASE WHEN re.rank = 2 THEN 1 ELSE 0 END) AS silver,
          SUM(CASE WHEN re.rank = 3 THEN 1 ELSE 0 END) AS bronze
        FROM round_entries re
        INNER JOIN top30 t ON t.guild = re.guild AND t.username = re.username AND t.rn <= 30
        WHERE re.rank IN (1, 2, 3)
        GROUP BY re.guild
      ),
      total_scores AS (
        SELECT guild, SUM(best_score) AS total_score, COUNT(*) AS member_count
        FROM top30
        WHERE rn <= 30
        GROUP BY guild
      )
      SELECT
        mc.guild,
        mc.gold, mc.silver, mc.bronze,
        COALESCE(ts.total_score, 0) AS total_score,
        COALESCE(ts.member_count, 0) AS member_count,
        ROW_NUMBER() OVER (ORDER BY mc.gold DESC, mc.silver DESC, mc.bronze DESC, COALESCE(ts.total_score, 0) DESC) AS guild_rank
      FROM medal_counts mc
      LEFT JOIN total_scores ts ON ts.guild = mc.guild
      ORDER BY guild_rank
    `).bind(roundId).all();

    // 길드별 상위 30명 전체 (유저별 최고점 1행)
    const { results: medalMembers } = await c.env.DB.prepare(`
      WITH rc_latest AS (
        SELECT username, userguild FROM (
          SELECT username, userguild,
                 ROW_NUMBER() OVER (PARTITION BY username ORDER BY userdate DESC, usertime DESC) AS rn
          FROM ranking_characters
          WHERE userguild != '' AND userguild IS NOT NULL
        ) WHERE rn = 1
      ),
      round_entries AS (
        SELECT mr.rank, mr.username, mr.score, mr.job_name, mr.avatar_img,
               rc.userguild AS guild
        FROM mureung_ranking mr
        INNER JOIN rc_latest rc ON rc.username = mr.username
        WHERE mr.round_id = ?
      ),
      deduped AS (
        SELECT guild, username, rank, score, job_name, avatar_img,
               ROW_NUMBER() OVER (PARTITION BY guild, username ORDER BY score DESC) AS rn_inner
        FROM round_entries
      ),
      top30 AS (
        SELECT guild, username, rank, score, job_name, avatar_img,
               ROW_NUMBER() OVER (PARTITION BY guild ORDER BY score DESC) AS rn
        FROM deduped
        WHERE rn_inner = 1
      )
      SELECT guild, username, rank, score, job_name, avatar_img
      FROM top30
      WHERE rn <= 30
      ORDER BY guild, score DESC
    `).bind(roundId).all();

    const isPast = round && !round.is_current;
    const shouldCache = isPast || !roundParam;

    if (shouldCache) {
      const ttl = isPast ? PAST_ROUND_TTL : CURRENT_ROUND_TTL;
      return cachedResponse(c, { round, rankings: guildStats, medal_members: medalMembers }, ttl);
    }
    return success(c, { round, rankings: guildStats, medal_members: medalMembers });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 스크래핑 상태 확인
mureungRoutes.get('/status', async (c) => {
  try {
    const totalRecords = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM mureung_ranking'
    ).first<{ total: number }>();
    const currentRound = await c.env.DB.prepare(
      'SELECT * FROM mureung_rounds WHERE is_current = 1 ORDER BY round_start DESC LIMIT 1'
    ).first();
    const roundCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM mureung_rounds'
    ).first<{ total: number }>();

    return success(c, {
      total_records: totalRecords?.total || 0,
      total_rounds: roundCount?.total || 0,
      current_round: currentRound || null,
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});
