import { Hono } from 'hono';
import { Env } from '../index';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';
import { processPointTransaction, getBalance } from '../services/points';

export const customizationRoutes = new Hono<{ Bindings: Env }>();

// 아이템 목록 조회
customizationRoutes.get('/items', async (c) => {
  try {
    const items = await c.env.DB.prepare(
      'SELECT * FROM customization_items WHERE is_active = 1 ORDER BY type, sort_order'
    ).all();
    return success(c, items.results);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 내 커스터마이징 목록
customizationRoutes.get('/my', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');
    const items = await c.env.DB.prepare(
      `SELECT uc.id, uc.item_id, uc.is_equipped, uc.purchased_at,
              ci.type, ci.name, ci.description, ci.value, ci.rarity, ci.icon, ci.preview
       FROM user_customizations uc
       JOIN customization_items ci ON uc.item_id = ci.id
       WHERE uc.user_id = ?
       ORDER BY ci.type, ci.sort_order`
    ).bind(userId).all();
    return success(c, items.results);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 아이템 구매
customizationRoutes.post('/purchase', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');
    const { itemId } = await c.req.json();

    // 아이템 확인
    const item = await c.env.DB.prepare(
      'SELECT * FROM customization_items WHERE id = ? AND is_active = 1'
    ).bind(itemId).first<{ id: number; type: string; name: string; value: string; price: number; rarity: string }>();

    if (!item) {
      return error(c, 'NOT_FOUND', '아이템을 찾을 수 없습니다.');
    }

    // 이미 보유 확인
    const existing = await c.env.DB.prepare(
      'SELECT id FROM user_customizations WHERE user_id = ? AND item_id = ?'
    ).bind(userId, itemId).first();

    if (existing) {
      return error(c, 'ALREADY_OWNED', '이미 보유한 아이템입니다.');
    }

    // 포인트 확인 & 차감
    const balance = await getBalance(c.env.DB, userId);
    if (balance < item.price) {
      return error(c, 'INSUFFICIENT_POINTS', `포인트가 부족합니다. (현재: ${balance}P, 필요: ${item.price}P)`);
    }

    await processPointTransaction(c.env.DB, {
      userId,
      type: 'spend',
      amount: item.price,
      source: 'customization',
      sourceId: `item_${itemId}`,
      description: `프로필 아이템 구매: ${item.name}`,
    });

    // 보유 아이템에 추가
    await c.env.DB.prepare(
      'INSERT INTO user_customizations (user_id, item_id, is_equipped, purchased_at) VALUES (?, ?, 0, datetime("now"))'
    ).bind(userId, itemId).run();

    const newBalance = await getBalance(c.env.DB, userId);

    return success(c, { message: '구매 완료!', newBalance });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 아이템 장착/해제
customizationRoutes.put('/equip', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');
    const { itemId, equip } = await c.req.json();

    // 보유 확인
    const owned = await c.env.DB.prepare(
      `SELECT uc.id, ci.type, ci.value FROM user_customizations uc
       JOIN customization_items ci ON uc.item_id = ci.id
       WHERE uc.user_id = ? AND uc.item_id = ?`
    ).bind(userId, itemId).first<{ id: number; type: string; value: string }>();

    if (!owned) {
      return error(c, 'NOT_OWNED', '보유하지 않은 아이템입니다.');
    }

    if (equip) {
      // 같은 타입의 다른 아이템 해제
      await c.env.DB.prepare(
        `UPDATE user_customizations SET is_equipped = 0
         WHERE user_id = ? AND item_id IN (
           SELECT uc2.item_id FROM user_customizations uc2
           JOIN customization_items ci2 ON uc2.item_id = ci2.id
           WHERE uc2.user_id = ? AND ci2.type = ?
         )`
      ).bind(userId, userId, owned.type).run();

      // 선택한 아이템 장착
      await c.env.DB.prepare(
        'UPDATE user_customizations SET is_equipped = 1 WHERE user_id = ? AND item_id = ?'
      ).bind(userId, itemId).run();

      // users 테이블에 활성 커스텀 업데이트
      const columnMap: Record<string, string> = {
        name_color: 'active_name_color',
        frame: 'active_frame',
        title: 'active_title',
      };
      const column = columnMap[owned.type];
      if (column) {
        await c.env.DB.prepare(
          `UPDATE users SET ${column} = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(owned.value, userId).run();
      }
    } else {
      // 해제
      await c.env.DB.prepare(
        'UPDATE user_customizations SET is_equipped = 0 WHERE user_id = ? AND item_id = ?'
      ).bind(userId, itemId).run();

      // users 테이블에서 제거
      const columnMap: Record<string, string> = {
        name_color: 'active_name_color',
        frame: 'active_frame',
        title: 'active_title',
      };
      const column = columnMap[owned.type];
      if (column) {
        await c.env.DB.prepare(
          `UPDATE users SET ${column} = NULL, updated_at = datetime('now') WHERE id = ?`
        ).bind(userId).run();
      }
    }

    return success(c, { message: equip ? '장착 완료!' : '해제 완료!' });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});
