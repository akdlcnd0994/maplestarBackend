import { Hono } from 'hono';
import { Env } from '../index';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { processPointTransaction, getBalance } from '../services/points';
import { getTodayKST } from '../utils/date';

export const rouletteRoutes = new Hono<{ Bindings: Env }>();

const SPIN_COST = 10;

// 상품 목록 조회
rouletteRoutes.get('/prizes', async (c) => {
  try {
    const prizes = await c.env.DB.prepare(
      'SELECT id, name, type, value, probability, icon, color, sort_order FROM roulette_prizes WHERE is_active = 1 ORDER BY sort_order'
    ).all();
    return success(c, { prizes: prizes.results, spinCost: SPIN_COST });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 무료 스핀 가능 여부
rouletteRoutes.get('/free-spin', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');
    const today = getTodayKST();
    const used = await c.env.DB.prepare(
      'SELECT id FROM roulette_free_spins WHERE user_id = ? AND spin_date = ?'
    ).bind(userId, today).first();
    return success(c, { available: !used });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 스핀
rouletteRoutes.post('/spin', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');
    const today = getTodayKST();

    // 무료 스핀 확인
    const freeUsed = await c.env.DB.prepare(
      'SELECT id FROM roulette_free_spins WHERE user_id = ? AND spin_date = ?'
    ).bind(userId, today).first();
    const isFree = !freeUsed;

    // 유료 스핀이면 포인트 차감
    if (!isFree) {
      const balance = await getBalance(c.env.DB, userId);
      if (balance < SPIN_COST) {
        return error(c, 'INSUFFICIENT_POINTS', `포인트가 부족합니다. (현재: ${balance}P, 필요: ${SPIN_COST}P)`);
      }
      await processPointTransaction(c.env.DB, {
        userId,
        type: 'spend',
        amount: SPIN_COST,
        source: 'roulette',
        sourceId: `spin_${Date.now()}`,
        description: '룰렛 스핀',
      });
    }

    // 무료 스핀 사용 기록
    if (isFree) {
      await c.env.DB.prepare(
        'INSERT INTO roulette_free_spins (user_id, spin_date) VALUES (?, ?)'
      ).bind(userId, today).run();
    }

    // 상품 뽑기 (확률 기반)
    const prizes = await c.env.DB.prepare(
      'SELECT * FROM roulette_prizes WHERE is_active = 1 ORDER BY sort_order'
    ).all<{ id: number; name: string; type: string; value: string; probability: number; icon: string; color: string }>();

    const items = prizes.results;
    const random = Math.random();
    let cumulative = 0;
    let selectedPrize = items[items.length - 1]; // fallback

    for (const prize of items) {
      cumulative += prize.probability;
      if (random <= cumulative) {
        selectedPrize = prize;
        break;
      }
    }

    // 상품 지급
    let rewardAmount = 0;
    if (selectedPrize.type === 'points') {
      const pts = parseInt(selectedPrize.value);
      if (pts > 0) {
        await processPointTransaction(c.env.DB, {
          userId,
          type: 'earn',
          amount: pts,
          source: 'roulette',
          sourceId: `prize_${Date.now()}`,
          description: `룰렛 당첨: ${selectedPrize.name}`,
        });
        rewardAmount = pts;
      }
    } else if (selectedPrize.type === 'hatch_bonus') {
      const bonus = parseInt(selectedPrize.value);
      await c.env.DB.prepare(
        `INSERT INTO incubator_bonus (user_id, bonus_hatches, granted_by, reason, created_at)
         VALUES (?, ?, 0, '룰렛 당첨', datetime('now'))`
      ).bind(userId, bonus).run();
      rewardAmount = bonus;
    }

    // 히스토리 기록
    await c.env.DB.prepare(
      `INSERT INTO roulette_history (user_id, prize_id, prize_name, prize_type, prize_value, spin_cost, is_free, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(userId, selectedPrize.id, selectedPrize.name, selectedPrize.type, selectedPrize.value, isFree ? 0 : SPIN_COST, isFree ? 1 : 0).run();

    const newBalance = await getBalance(c.env.DB, userId);

    return success(c, {
      prize: {
        id: selectedPrize.id,
        name: selectedPrize.name,
        type: selectedPrize.type,
        value: selectedPrize.value,
        icon: selectedPrize.icon,
        color: selectedPrize.color,
      },
      isFree,
      rewardAmount,
      newBalance,
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 최근 스핀 기록
rouletteRoutes.get('/history', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');
    const history = await c.env.DB.prepare(
      `SELECT prize_name, prize_type, prize_value, spin_cost, is_free, created_at
       FROM roulette_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`
    ).bind(userId).all();
    return success(c, history.results);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});
