import { Hono } from 'hono';
import { Env } from '../index';
import { authMiddleware, requireRole } from '../middleware/auth';
import { success, error } from '../utils/response';
import { getTodayKST } from '../utils/date';
import {
  processPointTransaction,
  earnActivityPoints,
  logAdminAction,
  getBalance,
  verifyPointIntegrity,
} from '../services/points';

const points = new Hono<{ Bindings: Env }>();

// ==================== 사용자 API ====================

// 내 포인트 잔액 조회
points.get('/balance', authMiddleware, async (c) => {
  const user = c.get('user');
  const row = await c.env.DB.prepare(
    `SELECT balance, total_earned, total_spent, updated_at
     FROM point_balances WHERE user_id = ?`
  ).bind(user.userId).first();

  return success(c, {
    balance: row?.balance ?? 0,
    totalEarned: row?.total_earned ?? 0,
    totalSpent: row?.total_spent ?? 0,
  });
});

// 내 포인트 거래 내역
points.get('/transactions', authMiddleware, async (c) => {
  const user = c.get('user');
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const type = c.req.query('type') || '';
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE user_id = ?';
  const params: any[] = [user.userId];

  if (type && ['earn', 'spend', 'admin_grant', 'admin_deduct', 'refund'].includes(type)) {
    whereClause += ' AND type = ?';
    params.push(type);
  }

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM point_transactions ${whereClause}`
  ).bind(...params).first<{ total: number }>();

  const transactions = await c.env.DB.prepare(
    `SELECT id, type, amount, balance_after, source, description, created_at
     FROM point_transactions ${whereClause}
     ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return success(c, transactions.results, {
    page,
    limit,
    total: countRow?.total ?? 0,
    totalPages: Math.ceil((countRow?.total ?? 0) / limit),
  });
});

// 오늘 활동별 포인트 획득 현황
points.get('/daily', authMiddleware, async (c) => {
  const user = c.get('user');
  const today = getTodayKST();

  const earnings = await c.env.DB.prepare(
    `SELECT pe.activity_type, pe.count, pe.total_points,
            pac.activity_name, pac.points_per_action, pac.daily_limit
     FROM point_activity_config pac
     LEFT JOIN point_daily_earnings pe
       ON pe.activity_type = pac.activity_type
       AND pe.user_id = ? AND pe.earn_date = ?
     WHERE pac.is_active = 1
     ORDER BY pac.id`
  ).bind(user.userId, today).all();

  return success(c, earnings.results.map((e: any) => ({
    activityType: e.activity_type,
    activityName: e.activity_name,
    pointsPerAction: e.points_per_action,
    dailyLimit: e.daily_limit,
    todayCount: e.count ?? 0,
    todayPoints: e.total_points ?? 0,
  })));
});

// 포인트 랭킹
points.get('/ranking', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);

  const ranking = await c.env.DB.prepare(
    `SELECT pb.user_id, pb.balance, pb.total_earned, pb.total_spent,
            u.character_name, u.profile_image, u.default_icon, u.profile_zoom, u.job, u.level,
            u.active_name_color, u.active_frame, u.active_title, u.active_title_rarity
     FROM point_balances pb
     JOIN users u ON u.id = pb.user_id
     WHERE u.is_approved = 1
     ORDER BY pb.balance DESC
     LIMIT ?`
  ).bind(limit).all();

  return success(c, ranking.results);
});

// ==================== 어드민 API ====================

// 활동 포인트 설정 조회
points.get('/admin/config', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  const configs = await c.env.DB.prepare(
    'SELECT * FROM point_activity_config ORDER BY id'
  ).all();
  return success(c, configs.results);
});

// 활동 포인트 설정 수정
points.put('/admin/config/:activityType', authMiddleware, requireRole('master'), async (c) => {
  const user = c.get('user');
  const activityType = c.req.param('activityType');
  const { points_per_action, daily_limit, is_active } = await c.req.json();

  // 유효성 검증
  if (points_per_action !== undefined && (points_per_action < 0 || points_per_action > 100)) {
    return error(c, 'INVALID_INPUT', '포인트는 0~100 사이여야 합니다.');
  }
  if (daily_limit !== undefined && (daily_limit < 0 || daily_limit > 100)) {
    return error(c, 'INVALID_INPUT', '일일 제한은 0~100 사이여야 합니다.');
  }

  const existing = await c.env.DB.prepare(
    'SELECT * FROM point_activity_config WHERE activity_type = ?'
  ).bind(activityType).first();

  if (!existing) {
    return error(c, 'NOT_FOUND', '활동 유형을 찾을 수 없습니다.', 404);
  }

  await c.env.DB.prepare(
    `UPDATE point_activity_config SET
       points_per_action = COALESCE(?, points_per_action),
       daily_limit = COALESCE(?, daily_limit),
       is_active = COALESCE(?, is_active),
       updated_at = datetime('now')
     WHERE activity_type = ?`
  ).bind(
    points_per_action ?? null,
    daily_limit ?? null,
    is_active ?? null,
    activityType
  ).run();

  await logAdminAction(c.env.DB, user.userId, 'update_point_config', 'point_config', activityType, {
    points_per_action, daily_limit, is_active,
  });

  return success(c, { message: '설정이 업데이트되었습니다.' });
});

// 사용자 포인트 수동 지급
points.post('/admin/grant', authMiddleware, requireRole('master'), async (c) => {
  const admin = c.get('user');
  const { user_id, amount, description } = await c.req.json();

  if (!user_id || !amount || amount <= 0 || amount > 10000) {
    return error(c, 'INVALID_INPUT', '유효하지 않은 입력입니다.');
  }

  const result = await processPointTransaction(c.env.DB, {
    userId: user_id,
    type: 'admin_grant',
    amount,
    source: 'admin',
    sourceId: String(admin.userId),
    description: description || `관리자 수동 지급`,
  });

  if (!result.success) {
    return error(c, 'TRANSACTION_FAILED', '포인트 지급에 실패했습니다.');
  }

  await logAdminAction(c.env.DB, admin.userId, 'grant_points', 'user', String(user_id), {
    amount, description, newBalance: result.newBalance,
  });

  return success(c, { newBalance: result.newBalance, transactionId: result.transactionId });
});

// 사용자 포인트 차감
points.post('/admin/deduct', authMiddleware, requireRole('master'), async (c) => {
  const admin = c.get('user');
  const { user_id, amount, description } = await c.req.json();

  if (!user_id || !amount || amount <= 0 || amount > 10000) {
    return error(c, 'INVALID_INPUT', '유효하지 않은 입력입니다.');
  }

  const result = await processPointTransaction(c.env.DB, {
    userId: user_id,
    type: 'admin_deduct',
    amount,
    source: 'admin',
    sourceId: String(admin.userId),
    description: description || `관리자 수동 차감`,
  });

  if (!result.success) {
    return error(c, 'INSUFFICIENT_BALANCE', '잔액이 부족합니다.');
  }

  await logAdminAction(c.env.DB, admin.userId, 'deduct_points', 'user', String(user_id), {
    amount, description, newBalance: result.newBalance,
  });

  return success(c, { newBalance: result.newBalance, transactionId: result.transactionId });
});

// 전체 사용자 포인트 목록 (관리자)
points.get('/admin/users', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  const users = await c.env.DB.prepare(
    `SELECT u.id, u.character_name, u.username, u.role, u.profile_image, u.default_icon,
            COALESCE(pb.balance, 0) as balance,
            COALESCE(pb.total_earned, 0) as total_earned,
            COALESCE(pb.total_spent, 0) as total_spent
     FROM users u
     LEFT JOIN point_balances pb ON pb.user_id = u.id
     WHERE u.is_approved = 1
     ORDER BY pb.total_earned DESC NULLS LAST`
  ).all();

  return success(c, users.results);
});

// 특정 사용자 거래 내역 (관리자)
points.get('/admin/users/:userId/transactions', authMiddleware, requireRole('master', 'submaster'), async (c) => {
  const userId = parseInt(c.req.param('userId'));
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);

  const transactions = await c.env.DB.prepare(
    `SELECT id, type, amount, balance_after, source, description, created_at
     FROM point_transactions WHERE user_id = ?
     ORDER BY created_at DESC LIMIT ?`
  ).bind(userId, limit).all();

  return success(c, transactions.results);
});

// 포인트 무결성 검증 (관리자)
points.get('/admin/verify/:userId', authMiddleware, requireRole('master'), async (c) => {
  const userId = parseInt(c.req.param('userId'));
  const result = await verifyPointIntegrity(c.env.DB, userId);
  return success(c, result);
});

// 감사 로그 조회
points.get('/admin/audit-log', authMiddleware, requireRole('master'), async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const offset = (page - 1) * limit;

  const countRow = await c.env.DB.prepare(
    'SELECT COUNT(*) as total FROM admin_audit_log'
  ).first<{ total: number }>();

  const logs = await c.env.DB.prepare(
    `SELECT al.*, u.character_name as admin_name
     FROM admin_audit_log al
     JOIN users u ON u.id = al.admin_user_id
     ORDER BY al.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();

  return success(c, logs.results, {
    page,
    limit,
    total: countRow?.total ?? 0,
    totalPages: Math.ceil((countRow?.total ?? 0) / limit),
  });
});

export const pointRoutes = points;
