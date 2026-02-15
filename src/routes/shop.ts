import { Hono } from 'hono';
import { Env } from '../index';
import { authMiddleware, requireRole } from '../middleware/auth';
import { success, error, notFound } from '../utils/response';
import { processPointTransaction, logAdminAction } from '../services/points';

const shop = new Hono<{ Bindings: Env }>();

// ==================== 사용자 API ====================

// 상품 목록 조회
shop.get('/items', async (c) => {
  const items = await c.env.DB.prepare(
    `SELECT id, name, description, image_key, image_url, price, stock, max_per_user, sort_order
     FROM shop_items WHERE is_active = 1
     ORDER BY sort_order ASC, created_at DESC`
  ).all();
  return success(c, items.results);
});

// 상품 상세 조회
shop.get('/items/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const item = await c.env.DB.prepare(
    'SELECT * FROM shop_items WHERE id = ? AND is_active = 1'
  ).bind(id).first();

  if (!item) return notFound(c, '상품을 찾을 수 없습니다.');
  return success(c, item);
});

// 상품 구매
shop.post('/purchase', authMiddleware, async (c) => {
  const user = c.get('user');
  const { item_id, quantity = 1 } = await c.req.json();

  if (!item_id || quantity < 1 || quantity > 10) {
    return error(c, 'INVALID_INPUT', '유효하지 않은 입력입니다.');
  }

  // 상품 정보 확인
  const item = await c.env.DB.prepare(
    'SELECT * FROM shop_items WHERE id = ? AND is_active = 1'
  ).bind(item_id).first<any>();

  if (!item) return notFound(c, '상품을 찾을 수 없습니다.');

  // 재고 사전 확인
  if (item.stock < quantity) {
    return error(c, 'OUT_OF_STOCK', '재고가 부족합니다.');
  }

  // 인당 구매 제한 확인
  const purchasedRow = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(quantity), 0) as total
     FROM shop_orders WHERE user_id = ? AND item_id = ? AND status = 'completed'`
  ).bind(user.userId, item_id).first<{ total: number }>();

  if ((purchasedRow?.total ?? 0) + quantity > item.max_per_user) {
    return error(c, 'PURCHASE_LIMIT', `이 상품은 인당 최대 ${item.max_per_user}개까지 구매 가능합니다.`);
  }

  const totalPrice = item.price * quantity;

  // 포인트 차감 (원자적 잔액 검증)
  const txnResult = await processPointTransaction(c.env.DB, {
    userId: user.userId,
    type: 'spend',
    amount: totalPrice,
    source: 'shop',
    sourceId: String(item_id),
    description: `교환소: ${item.name} x${quantity}`,
  });

  if (!txnResult.success) {
    return error(c, 'INSUFFICIENT_BALANCE', '포인트가 부족합니다.');
  }

  // 원자적 재고 차감 (stock >= quantity 조건부 UPDATE로 레이스 컨디션 방지)
  const stockUpdate = await c.env.DB.prepare(
    `UPDATE shop_items SET stock = stock - ?, updated_at = datetime('now')
     WHERE id = ? AND stock >= ?`
  ).bind(quantity, item_id, quantity).run();

  if (!stockUpdate.meta?.changes || stockUpdate.meta.changes === 0) {
    // 재고 부족 (동시 구매로 인한 경합) - 포인트 환불
    await processPointTransaction(c.env.DB, {
      userId: user.userId,
      type: 'refund',
      amount: totalPrice,
      source: 'shop',
      sourceId: String(item_id),
      description: `교환소 재고 부족 환불: ${item.name}`,
    });
    return error(c, 'OUT_OF_STOCK', '재고가 부족합니다. 포인트가 환불되었습니다.');
  }

  // 주문 기록
  await c.env.DB.prepare(
    `INSERT INTO shop_orders (user_id, item_id, quantity, total_price, status, created_at)
     VALUES (?, ?, ?, ?, 'completed', datetime('now'))`
  ).bind(user.userId, item_id, quantity, totalPrice).run();

  return success(c, {
    message: `${item.name} x${quantity} 교환 완료!`,
    totalPrice,
    newBalance: txnResult.newBalance,
  });
});

// 내 주문 내역
shop.get('/orders', authMiddleware, async (c) => {
  const user = c.get('user');
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = (page - 1) * limit;

  const countRow = await c.env.DB.prepare(
    'SELECT COUNT(*) as total FROM shop_orders WHERE user_id = ?'
  ).bind(user.userId).first<{ total: number }>();

  const orders = await c.env.DB.prepare(
    `SELECT so.*, si.name as item_name, si.image_url
     FROM shop_orders so
     JOIN shop_items si ON si.id = so.item_id
     WHERE so.user_id = ?
     ORDER BY so.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(user.userId, limit, offset).all();

  return success(c, orders.results, {
    page,
    limit,
    total: countRow?.total ?? 0,
    totalPages: Math.ceil((countRow?.total ?? 0) / limit),
  });
});

// ==================== 어드민 API ====================

// 전체 상품 목록 (비활성 포함)
shop.get('/admin/items', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  const items = await c.env.DB.prepare(
    'SELECT * FROM shop_items ORDER BY sort_order ASC, created_at DESC'
  ).all();
  return success(c, items.results);
});

// 상품 등록
shop.post('/admin/items', authMiddleware, requireRole('master'), async (c) => {
  const admin = c.get('user');
  const contentType = c.req.header('Content-Type') || '';

  let name: string, description: string, price: number, stock: number, maxPerUser: number, sortOrder: number;
  let imageKey = '', imageUrl = '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData();
    name = formData.get('name') as string;
    description = formData.get('description') as string || '';
    price = parseInt(formData.get('price') as string);
    stock = parseInt(formData.get('stock') as string || '0');
    maxPerUser = parseInt(formData.get('max_per_user') as string || '1');
    sortOrder = parseInt(formData.get('sort_order') as string || '0');

    const file = formData.get('file') as File | null;
    if (file && c.env.BUCKET) {
      const ext = file.name.split('.').pop() || 'png';
      imageKey = `shop/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      await c.env.BUCKET.put(imageKey, file.stream(), {
        httpMetadata: { contentType: file.type },
      });
      imageUrl = `/api/images/${imageKey}`;
    }
  } else {
    const body = await c.req.json();
    name = body.name;
    description = body.description || '';
    price = body.price;
    stock = body.stock || 0;
    maxPerUser = body.max_per_user || 1;
    sortOrder = body.sort_order || 0;
  }

  if (!name || !price || price < 1) {
    return error(c, 'INVALID_INPUT', '상품명과 가격은 필수입니다.');
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO shop_items (name, description, image_key, image_url, price, stock, max_per_user, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(name, description, imageKey, imageUrl, price, stock, maxPerUser, sortOrder).run();

  await logAdminAction(c.env.DB, admin.userId, 'create_shop_item', 'shop_item', String(result.meta?.last_row_id), {
    name, price, stock,
  });

  return success(c, { id: result.meta?.last_row_id, message: '상품이 등록되었습니다.' });
});

// 상품 수정
shop.put('/admin/items/:id', authMiddleware, requireRole('master'), async (c) => {
  const admin = c.get('user');
  const id = parseInt(c.req.param('id'));
  const contentType = c.req.header('Content-Type') || '';

  let name: string | null = null, description: string | null = null;
  let price: number | null = null, stock: number | null = null;
  let maxPerUser: number | null = null, sortOrder: number | null = null;
  let isActive: number | null = null;
  let imageKey: string | null = null, imageUrl: string | null = null;

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData();
    name = formData.get('name') as string;
    description = formData.get('description') as string;
    price = formData.get('price') ? parseInt(formData.get('price') as string) : null;
    stock = formData.get('stock') ? parseInt(formData.get('stock') as string) : null;
    maxPerUser = formData.get('max_per_user') ? parseInt(formData.get('max_per_user') as string) : null;
    sortOrder = formData.get('sort_order') ? parseInt(formData.get('sort_order') as string) : null;
    isActive = formData.get('is_active') ? parseInt(formData.get('is_active') as string) : null;

    const file = formData.get('file') as File | null;
    if (file && c.env.BUCKET) {
      // 기존 이미지 삭제
      const existing = await c.env.DB.prepare('SELECT image_key FROM shop_items WHERE id = ?').bind(id).first<any>();
      if (existing?.image_key) {
        await c.env.BUCKET.delete(existing.image_key);
      }

      const ext = file.name.split('.').pop() || 'png';
      imageKey = `shop/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      await c.env.BUCKET.put(imageKey, file.stream(), {
        httpMetadata: { contentType: file.type },
      });
      imageUrl = `/api/images/${imageKey}`;
    }
  } else {
    const body = await c.req.json();
    name = body.name ?? null;
    description = body.description ?? null;
    price = body.price ?? null;
    stock = body.stock ?? null;
    maxPerUser = body.max_per_user ?? null;
    sortOrder = body.sort_order ?? null;
    isActive = body.is_active ?? null;
  }

  const existing = await c.env.DB.prepare('SELECT id FROM shop_items WHERE id = ?').bind(id).first();
  if (!existing) return notFound(c, '상품을 찾을 수 없습니다.');

  await c.env.DB.prepare(
    `UPDATE shop_items SET
       name = COALESCE(?, name),
       description = COALESCE(?, description),
       image_key = COALESCE(?, image_key),
       image_url = COALESCE(?, image_url),
       price = COALESCE(?, price),
       stock = COALESCE(?, stock),
       max_per_user = COALESCE(?, max_per_user),
       is_active = COALESCE(?, is_active),
       sort_order = COALESCE(?, sort_order),
       updated_at = datetime('now')
     WHERE id = ?`
  ).bind(name, description, imageKey, imageUrl, price, stock, maxPerUser, isActive, sortOrder, id).run();

  await logAdminAction(c.env.DB, admin.userId, 'update_shop_item', 'shop_item', String(id), {
    name, price, stock, isActive,
  });

  return success(c, { message: '상품이 수정되었습니다.' });
});

// 상품 삭제
shop.delete('/admin/items/:id', authMiddleware, requireRole('master'), async (c) => {
  const admin = c.get('user');
  const id = parseInt(c.req.param('id'));

  // 이미지 삭제
  const item = await c.env.DB.prepare('SELECT image_key, name FROM shop_items WHERE id = ?').bind(id).first<any>();
  if (item?.image_key && c.env.BUCKET) {
    await c.env.BUCKET.delete(item.image_key);
  }

  await c.env.DB.prepare('DELETE FROM shop_items WHERE id = ?').bind(id).run();

  await logAdminAction(c.env.DB, admin.userId, 'delete_shop_item', 'shop_item', String(id), {
    name: item?.name,
  });

  return success(c, { message: '상품이 삭제되었습니다.' });
});

// 전체 주문 내역 (관리자)
shop.get('/admin/orders', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '30'), 100);
  const offset = (page - 1) * limit;

  const countRow = await c.env.DB.prepare(
    'SELECT COUNT(*) as total FROM shop_orders'
  ).first<{ total: number }>();

  const orders = await c.env.DB.prepare(
    `SELECT so.*, si.name as item_name, si.image_url as item_image,
            u.character_name, u.username
     FROM shop_orders so
     JOIN shop_items si ON si.id = so.item_id
     JOIN users u ON u.id = so.user_id
     ORDER BY so.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();

  return success(c, orders.results, {
    page,
    limit,
    total: countRow?.total ?? 0,
    totalPages: Math.ceil((countRow?.total ?? 0) / limit),
  });
});

export const shopRoutes = shop;
