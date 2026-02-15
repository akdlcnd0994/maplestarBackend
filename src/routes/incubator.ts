import { Hono } from 'hono';
import { Env } from '../index';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { getTodayKST } from '../utils/date';
import { earnActivityPoints } from '../services/points';

interface IncubatorItem {
  id: number;
  name: string;
  rate: number;
  type: string;
  percent: number | null;
}

export const incubatorRoutes = new Hono<{ Bindings: Env }>();

// 경쟁모드 부스트 설정 (고정 확률)
// ID 9: 이노센트 -> 1%
// 경쟁모드용 주문서 ID 목록
// ID 9: 이노센트
// ID 23: 혼줌 60%
// ID 139: 장공 10%
// ID 49: 장공 60%
// ID 140: 장공 100%
// ID 134: 백줌 5%
// ID 130: 백줌 10%
// ID 117: 백줌 20%
const COMPETITION_SCROLL_IDS = [9, 23, 49, 117, 130, 134, 139, 140];

// 경쟁모드 부스트 시 해당 주문서 확률 2배 적용
const getCompetitionBoostRate = (id: number, baseRate: number): number => {
  if (COMPETITION_SCROLL_IDS.includes(id)) {
    return baseRate * 2; // 2배 적용
  }
  return baseRate;
};

// 서버 사이드 확률 계산 함수
async function getRandomItem(db: D1Database, competitionBoost: boolean = false): Promise<IncubatorItem> {
  // DB에서 모든 아이템과 확률 가져오기
  const { results: items } = await db.prepare(`
    SELECT id, name, rate, type, percent FROM incubator_items ORDER BY id
  `).all<IncubatorItem>();

  if (!items || items.length === 0) {
    throw new Error('No items found in database');
  }

  // 경쟁모드 부스트 적용 시 경쟁용 주문서 확률 2배 적용
  const adjustedItems = items.map(item => ({
    ...item,
    rate: competitionBoost
      ? getCompetitionBoostRate(item.id, item.rate)
      : item.rate
  }));

  const totalRate = adjustedItems.reduce((sum, item) => sum + item.rate, 0);
  let random = Math.random() * totalRate;

  for (const item of adjustedItems) {
    random -= item.rate;
    if (random <= 0) {
      // 원본 아이템 정보 반환 (rate는 원본 값으로)
      return items.find(i => i.id === item.id)!;
    }
  }
  return items[items.length - 1];
}

// 아이템 목록 조회
incubatorRoutes.get('/items', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT id, name, rate, type, percent FROM incubator_items ORDER BY rate ASC, id ASC
    `).all();

    return success(c, results);
  } catch (e: any) {
    console.error('Error fetching items:', e);
    return error(c, 'SERVER_ERROR', '아이템 목록을 불러오지 못했습니다.', 500);
  }
});

// 내 인벤토리 조회
incubatorRoutes.get('/inventory', authMiddleware, async (c) => {
  const user = c.get('user');

  try {
    // 경쟁 모드 주문서를 먼저 표시, 그 다음 확률순
    const { results } = await c.env.DB.prepare(`
      SELECT
        inv.item_id,
        inv.count,
        i.name,
        i.rate,
        i.type,
        i.percent
      FROM incubator_inventory inv
      JOIN incubator_items i ON inv.item_id = i.id
      WHERE inv.user_id = ?
      ORDER BY
        CASE
          WHEN i.id IN (9, 23, 49, 117, 130, 134, 139, 140) THEN 0
          ELSE 1
        END,
        CASE i.id
          WHEN 9 THEN 1    -- 이노센트
          WHEN 23 THEN 2   -- 혼줌
          WHEN 139 THEN 3  -- 장공 10%
          WHEN 49 THEN 4   -- 장공 60%
          WHEN 140 THEN 5  -- 장공 100%
          WHEN 134 THEN 6  -- 백줌 5%
          WHEN 130 THEN 7  -- 백줌 10%
          WHEN 117 THEN 8  -- 백줌 20%
          ELSE 999
        END,
        i.rate ASC,
        i.id ASC
    `).bind(user.userId).all();

    return success(c, results);
  } catch (e: any) {
    console.error('Error fetching inventory:', e);
    return error(c, 'SERVER_ERROR', '인벤토리를 불러오지 못했습니다.', 500);
  }
});

// 오늘 부화 통계 조회
incubatorRoutes.get('/daily-stats', authMiddleware, async (c) => {
  const user = c.get('user');
  const today = getTodayKST();

  try {
    const stats = await c.env.DB.prepare(`
      SELECT total_hatches, legendary_count
      FROM incubator_daily_stats
      WHERE user_id = ? AND hatch_date = ?
    `).bind(user.userId, today).first();

    // 보너스 부화 횟수 확인
    const bonus = await c.env.DB.prepare(`
      SELECT bonus_hatches FROM incubator_bonus WHERE user_id = ?
    `).bind(user.userId).first();

    return success(c, {
      totalHatches: stats?.total_hatches || 0,
      legendaryCount: stats?.legendary_count || 0,
      bonusHatches: bonus?.bonus_hatches || 0,
      date: today
    });
  } catch (e: any) {
    console.error('Error fetching daily stats:', e);
    return error(c, 'SERVER_ERROR', '통계를 불러오지 못했습니다.', 500);
  }
});

// 부화 실행 (1회, 100회, 1000회)
incubatorRoutes.post('/hatch', authMiddleware, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const count = Math.min(Math.max(parseInt(body.count) || 1, 1), 5); // 1~5
  const competitionBoost = body.competitionBoost === true; // 경쟁모드 부스트
  const today = getTodayKST();
  const DAILY_LIMIT = 100;

  try {
    // 오늘 부화 횟수 확인
    const stats = await c.env.DB.prepare(`
      SELECT total_hatches FROM incubator_daily_stats
      WHERE user_id = ? AND hatch_date = ?
    `).bind(user.userId, today).first();

    // 보너스 부화 횟수 확인
    const bonus = await c.env.DB.prepare(`
      SELECT bonus_hatches FROM incubator_bonus WHERE user_id = ?
    `).bind(user.userId).first();

    const currentHatches = (stats?.total_hatches as number) || 0;
    const bonusHatches = (bonus?.bonus_hatches as number) || 0;
    const totalLimit = DAILY_LIMIT + bonusHatches;
    const remaining = totalLimit - currentHatches;

    if (remaining <= 0) {
      return error(c, 'DAILY_LIMIT', '오늘 부화 횟수를 모두 사용했습니다.', 400);
    }

    const actualCount = Math.min(count, remaining);
    const results: IncubatorItem[] = [];
    let legendaryFound = 0;

    // 서버에서 확률 계산하여 아이템 뽑기
    for (let i = 0; i < actualCount; i++) {
      const item = await getRandomItem(c.env.DB, competitionBoost);
      results.push(item);

      if (item.id === 1) { // 전설의 용사 뱃지
        legendaryFound++;
      }
    }

    // 인벤토리 업데이트 (배치 처리)
    const inventoryCounts: { [key: number]: number } = {};
    for (const item of results) {
      inventoryCounts[item.id] = (inventoryCounts[item.id] || 0) + 1;
    }

    // 트랜잭션 처리
    const statements: D1PreparedStatement[] = [];

    // 인벤토리 upsert
    for (const [itemId, itemCount] of Object.entries(inventoryCounts)) {
      statements.push(
        c.env.DB.prepare(`
          INSERT INTO incubator_inventory (user_id, item_id, count)
          VALUES (?, ?, ?)
          ON CONFLICT(user_id, item_id) DO UPDATE SET
            count = count + ?,
            updated_at = datetime('now')
        `).bind(user.userId, parseInt(itemId), itemCount, itemCount)
      );
    }

    // 히스토리 기록 (마지막 아이템만 기록 또는 전체)
    const lastItem = results[results.length - 1];
    statements.push(
      c.env.DB.prepare(`
        INSERT INTO incubator_history (user_id, item_id, hatch_count)
        VALUES (?, ?, ?)
      `).bind(user.userId, lastItem.id, actualCount)
    );

    // 일일 통계 업데이트
    statements.push(
      c.env.DB.prepare(`
        INSERT INTO incubator_daily_stats (user_id, hatch_date, total_hatches, legendary_count)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, hatch_date) DO UPDATE SET
          total_hatches = total_hatches + ?,
          legendary_count = legendary_count + ?
      `).bind(user.userId, today, actualCount, legendaryFound, actualCount, legendaryFound)
    );

    // 배치 실행
    await c.env.DB.batch(statements);

    const pointResult = await earnActivityPoints(c.env.DB, user.userId, 'incubator', today);

    return success(c, {
      hatchedCount: actualCount,
      lastItem,
      allItems: results,
      legendaryFound,
      inventory: inventoryCounts,
      dailyTotal: currentHatches + actualCount,
      pointEarned: pointResult.earned ? pointResult.points : 0,
    });
  } catch (e: any) {
    console.error('Error hatching:', e);
    return error(c, 'SERVER_ERROR', '부화 처리 중 오류가 발생했습니다.', 500);
  }
});

// 부화 기록 조회
incubatorRoutes.get('/history', authMiddleware, async (c) => {
  const user = c.get('user');
  const limit = parseInt(c.req.query('limit') || '50');

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT
        h.id,
        h.item_id,
        h.hatch_count,
        h.created_at,
        i.name,
        i.rate,
        i.type
      FROM incubator_history h
      JOIN incubator_items i ON h.item_id = i.id
      WHERE h.user_id = ?
      ORDER BY h.created_at DESC
      LIMIT ?
    `).bind(user.userId, limit).all();

    return success(c, results);
  } catch (e: any) {
    console.error('Error fetching history:', e);
    return error(c, 'SERVER_ERROR', '기록을 불러오지 못했습니다.', 500);
  }
});

// 주문서 인벤토리 조회 (시뮬레이터용 - 특정 아이템만)
incubatorRoutes.get('/scroll-inventory', authMiddleware, async (c) => {
  const user = c.get('user');

  // 경쟁 모드에서 사용하는 모든 주문서 아이템 ID
  // 혼줌: 23, 이노센트: 9, 백줌: 117/130/134, 장공: 49/139/140
  const scrollItemIds = [9, 23, 49, 117, 130, 134, 139, 140];

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT
        inv.item_id,
        inv.count,
        i.name,
        i.percent
      FROM incubator_inventory inv
      JOIN incubator_items i ON inv.item_id = i.id
      WHERE inv.user_id = ? AND inv.item_id IN (${scrollItemIds.join(',')})
    `).bind(user.userId).all();

    // 아이템별로 정리해서 반환
    const inventory: { [key: string]: number } = {};
    for (const item of results || []) {
      const i = item as any;
      if (i.item_id === 9) inventory.innocent = i.count;
      else if (i.item_id === 23) inventory.chaos60 = i.count;
      else if (i.item_id === 49) inventory.glove60 = i.count;
      else if (i.item_id === 117) inventory.white20 = i.count;
      else if (i.item_id === 130) inventory.white10 = i.count;
      else if (i.item_id === 134) inventory.white5 = i.count;
      else if (i.item_id === 139) inventory.glove10 = i.count;
      else if (i.item_id === 140) inventory.glove100 = i.count;
    }

    return success(c, {
      // 혼줌 시뮬용
      chaos60: inventory.chaos60 || 0,
      innocent: inventory.innocent || 0,
      white20: inventory.white20 || 0,
      white10: inventory.white10 || 0,
      white5: inventory.white5 || 0,
      // 노가다 목장갑용
      glove10: inventory.glove10 || 0,
      glove60: inventory.glove60 || 0,
      glove100: inventory.glove100 || 0,
    });
  } catch (e: any) {
    console.error('Error fetching scroll inventory:', e);
    return error(c, 'SERVER_ERROR', '주문서 인벤토리를 불러오지 못했습니다.', 500);
  }
});

// 주문서 사용 (인벤토리에서 차감)
incubatorRoutes.post('/use-scroll', authMiddleware, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { scrollType, count = 1 } = body;

  // 주문서 타입에 따른 아이템 ID 매핑
  const scrollItemMap: { [key: string]: number } = {
    // 혼줌 시뮬용
    chaos60: 23,      // 혼돈의 주문서 60%
    innocent: 9,      // 이노센트 주문서 100%
    white20: 117,     // 백의 주문서 20%
    white10: 130,     // 백의 주문서 10%
    white5: 134,      // 백의 주문서 5%
    // 노가다 목장갑용
    glove10: 139,     // 장갑 공격력 주문서 10%
    glove60: 49,      // 장갑 공격력 주문서 60%
    glove100: 140,    // 장갑 공격력 주문서 100%
  };

  const itemId = scrollItemMap[scrollType];
  if (!itemId) {
    return error(c, 'VALIDATION_ERROR', '유효하지 않은 주문서 타입입니다.', 400);
  }

  try {
    // 현재 보유량 확인
    const inventory = await c.env.DB.prepare(`
      SELECT count FROM incubator_inventory
      WHERE user_id = ? AND item_id = ?
    `).bind(user.userId, itemId).first<{ count: number }>();

    const currentCount = inventory?.count || 0;

    if (currentCount < count) {
      return error(c, 'INSUFFICIENT_ITEMS', `보유한 주문서가 부족합니다. (보유: ${currentCount}개)`, 400);
    }

    // 인벤토리에서 차감
    if (currentCount === count) {
      // 전부 사용하면 레코드 삭제
      await c.env.DB.prepare(`
        DELETE FROM incubator_inventory WHERE user_id = ? AND item_id = ?
      `).bind(user.userId, itemId).run();
    } else {
      // 일부만 사용
      await c.env.DB.prepare(`
        UPDATE incubator_inventory SET count = count - ?, updated_at = datetime('now')
        WHERE user_id = ? AND item_id = ?
      `).bind(count, user.userId, itemId).run();
    }

    return success(c, {
      used: count,
      remaining: currentCount - count,
      scrollType,
    });
  } catch (e: any) {
    console.error('Error using scroll:', e);
    return error(c, 'SERVER_ERROR', '주문서 사용에 실패했습니다.', 500);
  }
});

// ===== 경쟁 모드 랭킹 API =====

// 경쟁 모드 - 노가다 목장갑 랭킹 조회
incubatorRoutes.get('/competition/glove/rankings', async (c) => {
  const limit = parseInt(c.req.query('limit') || '20');

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT
        u.character_name,
        u.username,
        r.final_attack,
        r.upgrade_count,
        r.scroll_10_used,
        r.scroll_60_used,
        r.scroll_100_used,
        r.created_at
      FROM competition_glove_records r
      JOIN users u ON r.user_id = u.id
      ORDER BY r.final_attack DESC
      LIMIT ?
    `).bind(limit).all();

    return success(c, results || []);
  } catch (e: any) {
    console.error('Error fetching competition glove rankings:', e);
    return error(c, 'SERVER_ERROR', '랭킹을 불러오지 못했습니다.', 500);
  }
});

// 경쟁 모드 - 노가다 목장갑 기록 저장
incubatorRoutes.post('/competition/glove/records', authMiddleware, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { finalAttack, upgradeCount, scroll10Used, scroll60Used, scroll100Used } = body;

  try {
    // 기존 기록 확인
    const existing = await c.env.DB.prepare(`
      SELECT id, final_attack FROM competition_glove_records WHERE user_id = ?
    `).bind(user.userId).first<{ id: number; final_attack: number }>();

    // 기존 기록이 없거나 더 좋은 기록이면 저장
    if (!existing || finalAttack > existing.final_attack) {
      if (existing) {
        await c.env.DB.prepare(`
          UPDATE competition_glove_records
          SET final_attack = ?, upgrade_count = ?, scroll_10_used = ?, scroll_60_used = ?, scroll_100_used = ?, created_at = datetime('now')
          WHERE user_id = ?
        `).bind(finalAttack, upgradeCount, scroll10Used || 0, scroll60Used || 0, scroll100Used || 0, user.userId).run();
      } else {
        await c.env.DB.prepare(`
          INSERT INTO competition_glove_records (user_id, final_attack, upgrade_count, scroll_10_used, scroll_60_used, scroll_100_used)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(user.userId, finalAttack, upgradeCount, scroll10Used || 0, scroll60Used || 0, scroll100Used || 0).run();
      }
      return success(c, { saved: true, newRecord: true });
    }

    return success(c, { saved: false, newRecord: false, message: '기존 기록보다 낮습니다.' });
  } catch (e: any) {
    console.error('Error saving competition glove record:', e);
    return error(c, 'SERVER_ERROR', '기록 저장에 실패했습니다.', 500);
  }
});

// 경쟁 모드 - 혼줌 랭킹 조회 (공격력 기준)
incubatorRoutes.get('/competition/chaos/rankings', async (c) => {
  const limit = parseInt(c.req.query('limit') || '20');
  const statType = c.req.query('stat_type') || 'atk'; // 'atk' or 'matk'
  const upgradeCount = c.req.query('upgrade_count') ? parseInt(c.req.query('upgrade_count')!) : null;

  try {
    const orderColumn = statType === 'matk' ? 'matk' : 'atk';
    let query = `
      SELECT
        u.character_name,
        u.username,
        r.atk,
        r.matk,
        r.upgrade_count,
        r.chaos_used,
        r.innocent_used,
        r.white_used,
        r.created_at
      FROM competition_chaos_records r
      JOIN users u ON r.user_id = u.id
    `;

    if (upgradeCount) {
      query += ` WHERE r.upgrade_count = ?`;
      query += ` ORDER BY r.${orderColumn} DESC LIMIT ?`;
      const { results } = await c.env.DB.prepare(query).bind(upgradeCount, limit).all();
      return success(c, results || []);
    } else {
      query += ` ORDER BY r.${orderColumn} DESC LIMIT ?`;
      const { results } = await c.env.DB.prepare(query).bind(limit).all();
      return success(c, results || []);
    }
  } catch (e: any) {
    console.error('Error fetching competition chaos rankings:', e);
    return error(c, 'SERVER_ERROR', '랭킹을 불러오지 못했습니다.', 500);
  }
});

// 경쟁 모드 - 혼줌 기록 저장
incubatorRoutes.post('/competition/chaos/records', authMiddleware, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { atk, matk, upgradeCount, chaosUsed, innocentUsed, whiteUsed } = body;

  try {
    // 기존 기록 확인 (user_id + upgrade_count 조합으로 조회)
    const existing = await c.env.DB.prepare(`
      SELECT id, atk, matk FROM competition_chaos_records WHERE user_id = ? AND upgrade_count = ?
    `).bind(user.userId, upgradeCount).first<{ id: number; atk: number; matk: number }>();

    // 공격력 또는 마력이 더 높으면 업데이트
    const shouldUpdate = !existing || atk > existing.atk || matk > existing.matk;

    if (shouldUpdate) {
      if (existing) {
        // 더 높은 값만 업데이트
        const newAtk = Math.max(atk, existing.atk);
        const newMatk = Math.max(matk, existing.matk);
        await c.env.DB.prepare(`
          UPDATE competition_chaos_records
          SET atk = ?, matk = ?, chaos_used = ?, innocent_used = ?, white_used = ?, created_at = datetime('now')
          WHERE user_id = ? AND upgrade_count = ?
        `).bind(newAtk, newMatk, chaosUsed || 0, innocentUsed || 0, whiteUsed || 0, user.userId, upgradeCount).run();
      } else {
        await c.env.DB.prepare(`
          INSERT INTO competition_chaos_records (user_id, atk, matk, upgrade_count, chaos_used, innocent_used, white_used)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(user.userId, atk, matk, upgradeCount, chaosUsed || 0, innocentUsed || 0, whiteUsed || 0).run();
      }
      return success(c, { saved: true, newRecord: true });
    }

    return success(c, { saved: false, newRecord: false, message: '기존 기록보다 낮습니다.' });
  } catch (e: any) {
    console.error('Error saving competition chaos record:', e);
    return error(c, 'SERVER_ERROR', '기록 저장에 실패했습니다.', 500);
  }
});

// 전체 랭킹 (전설의 용사 뱃지 획득 순)
incubatorRoutes.get('/rankings', async (c) => {
  const limit = parseInt(c.req.query('limit') || '20');

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT
        u.character_name,
        u.username,
        inv.count as legendary_count
      FROM incubator_inventory inv
      JOIN users u ON inv.user_id = u.id
      WHERE inv.item_id = 1
      ORDER BY inv.count DESC
      LIMIT ?
    `).bind(limit).all();

    return success(c, results);
  } catch (e: any) {
    console.error('Error fetching rankings:', e);
    return error(c, 'SERVER_ERROR', '랭킹을 불러오지 못했습니다.', 500);
  }
});

// ===== 관리자 전용 API =====

// 모든 유저의 부화 통계 조회 (관리자용)
incubatorRoutes.get('/admin/users', authMiddleware, async (c) => {
  const user = c.get('user');

  if (user.role !== 'master' && user.role !== 'submaster') {
    return error(c, 'FORBIDDEN', '관리자만 접근할 수 있습니다.', 403);
  }

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT
        u.id,
        u.character_name,
        u.role,
        COALESCE(SUM(ds.total_hatches), 0) as total_hatches,
        COALESCE(SUM(ds.legendary_count), 0) as legendary_count,
        COALESCE(
          (SELECT count FROM incubator_inventory WHERE user_id = u.id AND item_id = 1),
          0
        ) as legendary_inventory,
        COALESCE(
          (SELECT bonus_hatches FROM incubator_bonus WHERE user_id = u.id),
          0
        ) as bonus_hatches
      FROM users u
      LEFT JOIN incubator_daily_stats ds ON u.id = ds.user_id
      WHERE u.is_approved = 1
      GROUP BY u.id
      ORDER BY total_hatches DESC
    `).all();

    return success(c, results);
  } catch (e: any) {
    console.error('Error fetching admin users:', e);
    return error(c, 'SERVER_ERROR', '유저 목록을 불러오지 못했습니다.', 500);
  }
});

// 특정 유저의 인벤토리 조회 (관리자용)
incubatorRoutes.get('/admin/users/:userId/inventory', authMiddleware, async (c) => {
  const user = c.get('user');
  const targetUserId = parseInt(c.req.param('userId'));

  if (user.role !== 'master' && user.role !== 'submaster') {
    return error(c, 'FORBIDDEN', '관리자만 접근할 수 있습니다.', 403);
  }

  try {
    // 유저 정보
    const targetUser = await c.env.DB.prepare(`
      SELECT id, character_name, role FROM users WHERE id = ?
    `).bind(targetUserId).first();

    if (!targetUser) {
      return error(c, 'NOT_FOUND', '유저를 찾을 수 없습니다.', 404);
    }

    // 인벤토리
    const { results: inventory } = await c.env.DB.prepare(`
      SELECT
        inv.item_id,
        inv.count,
        i.name,
        i.rate,
        i.type,
        i.percent
      FROM incubator_inventory inv
      JOIN incubator_items i ON inv.item_id = i.id
      WHERE inv.user_id = ?
      ORDER BY i.rate ASC, i.id ASC
    `).bind(targetUserId).all();

    // 오늘 통계
    const today = getTodayKST();
    const todayStats = await c.env.DB.prepare(`
      SELECT total_hatches, legendary_count
      FROM incubator_daily_stats
      WHERE user_id = ? AND hatch_date = ?
    `).bind(targetUserId, today).first();

    // 보너스 부화 횟수
    const bonus = await c.env.DB.prepare(`
      SELECT bonus_hatches FROM incubator_bonus WHERE user_id = ?
    `).bind(targetUserId).first();

    return success(c, {
      user: targetUser,
      inventory,
      todayStats: {
        totalHatches: todayStats?.total_hatches || 0,
        legendaryCount: todayStats?.legendary_count || 0,
      },
      bonusHatches: bonus?.bonus_hatches || 0
    });
  } catch (e: any) {
    console.error('Error fetching user inventory:', e);
    return error(c, 'SERVER_ERROR', '인벤토리를 불러오지 못했습니다.', 500);
  }
});

// 보너스 부화 횟수 지급 (마스터 전용)
incubatorRoutes.post('/admin/users/:userId/bonus', authMiddleware, async (c) => {
  const user = c.get('user');
  const targetUserId = parseInt(c.req.param('userId'));

  // 마스터만 가능
  if (user.role !== 'master') {
    return error(c, 'FORBIDDEN', '길드 마스터만 보너스를 지급할 수 있습니다.', 403);
  }

  const body = await c.req.json();
  const amount = parseInt(body.amount) || 0;

  if (amount <= 0 || amount > 10000) {
    return error(c, 'INVALID_INPUT', '지급량은 1~10000 사이여야 합니다.', 400);
  }

  try {
    // 보너스 테이블에 upsert
    await c.env.DB.prepare(`
      INSERT INTO incubator_bonus (user_id, bonus_hatches, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        bonus_hatches = bonus_hatches + ?,
        updated_at = datetime('now')
    `).bind(targetUserId, amount, amount).run();

    // 현재 보너스 조회
    const bonus = await c.env.DB.prepare(`
      SELECT bonus_hatches FROM incubator_bonus WHERE user_id = ?
    `).bind(targetUserId).first();

    return success(c, {
      message: `${amount}회 보너스가 지급되었습니다.`,
      totalBonus: bonus?.bonus_hatches || amount
    });
  } catch (e: any) {
    console.error('Error granting bonus:', e);
    return error(c, 'SERVER_ERROR', '보너스 지급에 실패했습니다.', 500);
  }
});

// 보너스 부화 횟수 회수 (마스터 전용)
incubatorRoutes.post('/admin/users/:userId/revoke-bonus', authMiddleware, async (c) => {
  const user = c.get('user');
  const targetUserId = parseInt(c.req.param('userId'));

  // 마스터만 가능
  if (user.role !== 'master') {
    return error(c, 'FORBIDDEN', '길드 마스터만 보너스를 회수할 수 있습니다.', 403);
  }

  try {
    // 현재 보너스 확인
    const current = await c.env.DB.prepare(`
      SELECT bonus_hatches FROM incubator_bonus WHERE user_id = ?
    `).bind(targetUserId).first();

    if (!current || (current.bonus_hatches as number) <= 0) {
      return error(c, 'NO_BONUS', '회수할 보너스가 없습니다.', 400);
    }

    const revokedAmount = current.bonus_hatches as number;

    // 보너스를 0으로 설정
    await c.env.DB.prepare(`
      UPDATE incubator_bonus SET bonus_hatches = 0, updated_at = datetime('now') WHERE user_id = ?
    `).bind(targetUserId).run();

    return success(c, {
      message: `${revokedAmount}회 보너스가 회수되었습니다.`,
      revokedAmount
    });
  } catch (e: any) {
    console.error('Error revoking bonus:', e);
    return error(c, 'SERVER_ERROR', '보너스 회수에 실패했습니다.', 500);
  }
});

// 유저 부화기 데이터 초기화 (마스터 전용)
incubatorRoutes.delete('/admin/users/:userId/reset', authMiddleware, async (c) => {
  const user = c.get('user');
  const targetUserId = parseInt(c.req.param('userId'));

  // 마스터만 가능
  if (user.role !== 'master') {
    return error(c, 'FORBIDDEN', '길드 마스터만 초기화할 수 있습니다.', 403);
  }

  try {
    // 유저 존재 확인
    const targetUser = await c.env.DB.prepare(`
      SELECT id, character_name FROM users WHERE id = ?
    `).bind(targetUserId).first();

    if (!targetUser) {
      return error(c, 'NOT_FOUND', '유저를 찾을 수 없습니다.', 404);
    }

    // 트랜잭션으로 모든 데이터 삭제
    const statements: D1PreparedStatement[] = [
      // 인벤토리 삭제
      c.env.DB.prepare(`DELETE FROM incubator_inventory WHERE user_id = ?`).bind(targetUserId),
      // 히스토리 삭제
      c.env.DB.prepare(`DELETE FROM incubator_history WHERE user_id = ?`).bind(targetUserId),
      // 일일 통계 삭제
      c.env.DB.prepare(`DELETE FROM incubator_daily_stats WHERE user_id = ?`).bind(targetUserId),
      // 보너스도 초기화
      c.env.DB.prepare(`DELETE FROM incubator_bonus WHERE user_id = ?`).bind(targetUserId),
    ];

    await c.env.DB.batch(statements);

    return success(c, {
      message: `${targetUser.character_name}님의 부화기 데이터가 초기화되었습니다.`
    });
  } catch (e: any) {
    console.error('Error resetting user incubator:', e);
    return error(c, 'SERVER_ERROR', '데이터 초기화에 실패했습니다.', 500);
  }
});

export default incubatorRoutes;
