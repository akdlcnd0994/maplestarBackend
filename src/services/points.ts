/**
 * 포인트 서비스 - 이중 원장 기반 안전한 포인트 관리
 * 모든 포인트 변동은 이 서비스를 통해서만 처리
 */

import { getTodayKST, getKSTTimestamp } from '../utils/date';

type TransactionType = 'earn' | 'spend' | 'admin_grant' | 'admin_deduct' | 'refund';

interface PointTransaction {
  userId: number;
  type: TransactionType;
  amount: number;
  source: string;
  sourceId?: string;
  description: string;
}

// SHA-256 체크섬 생성 (무결성 검증)
async function generateChecksum(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const msgBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 포인트 거래 처리 (원자적 이중 원장)
 * - point_transactions: 주 원장
 * - point_transaction_log: 백업 원장 (체크섬 포함)
 * - point_balances: 잔액 캐시
 *
 * 레이스 컨디션 방지:
 * - 지출 시 UPDATE ... WHERE balance >= ? 사용 (원자적 잔액 검증)
 * - 백업 원장도 동일 배치에 포함
 */
export async function processPointTransaction(
  db: D1Database,
  txn: PointTransaction
): Promise<{ success: boolean; newBalance: number; transactionId: number }> {
  // 금액 계산 (earn/admin_grant/refund는 양수, spend/admin_deduct는 음수)
  const isDebit = txn.type === 'spend' || txn.type === 'admin_deduct';
  const signedAmount = isDebit ? -Math.abs(txn.amount) : Math.abs(txn.amount);
  const absAmount = Math.abs(txn.amount);

  const { date, time } = getKSTTimestamp();
  const createdAt = `${date} ${time}`;

  if (isDebit) {
    // === 지출: 원자적 잔액 검증 (TOCTOU 방지) ===
    // balance >= absAmount 조건부 UPDATE로 레이스 컨디션 차단
    const updateResult = await db.prepare(
      `UPDATE point_balances SET
        balance = balance - ?,
        total_spent = total_spent + ?,
        updated_at = ?
      WHERE user_id = ? AND balance >= ?`
    ).bind(absAmount, absAmount, createdAt, txn.userId, absAmount).run();

    if (!updateResult.meta?.changes || updateResult.meta.changes === 0) {
      // 잔액 부족 또는 레코드 없음
      const balRow = await db.prepare(
        'SELECT balance FROM point_balances WHERE user_id = ?'
      ).bind(txn.userId).first<{ balance: number }>();
      return { success: false, newBalance: balRow?.balance ?? 0, transactionId: 0 };
    }

    // 새 잔액 조회
    const newBalRow = await db.prepare(
      'SELECT balance FROM point_balances WHERE user_id = ?'
    ).bind(txn.userId).first<{ balance: number }>();
    const newBalance = newBalRow?.balance ?? 0;
    const balanceBefore = newBalance + absAmount;

    // 체크섬 생성
    const checksumData = `${txn.userId}:${txn.type}:${signedAmount}:${balanceBefore}:${newBalance}:${txn.source}:${createdAt}`;
    const checksum = await generateChecksum(checksumData);

    // 주 원장 + 백업 원장 동시 기록
    const results = await db.batch([
      db.prepare(
        `INSERT INTO point_transactions (user_id, type, amount, balance_after, source, source_id, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(txn.userId, txn.type, signedAmount, newBalance, txn.source, txn.sourceId || null, txn.description, createdAt),
      db.prepare(
        `INSERT INTO point_transaction_log (transaction_id, user_id, type, amount, balance_before, balance_after, checksum, created_at)
         VALUES (last_insert_rowid(), ?, ?, ?, ?, ?, ?, ?)`
      ).bind(txn.userId, txn.type, signedAmount, balanceBefore, newBalance, checksum, createdAt),
    ]);

    const txnResult = results[0] as D1Result;
    const transactionId = txnResult.meta?.last_row_id ?? 0;

    return { success: true, newBalance, transactionId };
  } else {
    // === 수입: UPSERT + 주 원장 + 백업 원장 일괄 배치 ===
    // 먼저 현재 잔액 확인 (체크섬용)
    const balRow = await db.prepare(
      'SELECT balance FROM point_balances WHERE user_id = ?'
    ).bind(txn.userId).first<{ balance: number }>();
    const currentBalance = balRow?.balance ?? 0;
    const newBalance = currentBalance + absAmount;

    // 체크섬 생성
    const checksumData = `${txn.userId}:${txn.type}:${signedAmount}:${currentBalance}:${newBalance}:${txn.source}:${createdAt}`;
    const checksum = await generateChecksum(checksumData);

    // 원자적 배치: 잔액 UPSERT + 주 원장 + 백업 원장
    const results = await db.batch([
      db.prepare(
        `INSERT INTO point_balances (user_id, balance, total_earned, total_spent, updated_at)
         VALUES (?, ?, ?, 0, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           balance = balance + ?,
           total_earned = total_earned + ?,
           updated_at = ?`
      ).bind(txn.userId, absAmount, absAmount, createdAt, absAmount, absAmount, createdAt),
      db.prepare(
        `INSERT INTO point_transactions (user_id, type, amount, balance_after, source, source_id, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(txn.userId, txn.type, signedAmount, newBalance, txn.source, txn.sourceId || null, txn.description, createdAt),
      db.prepare(
        `INSERT INTO point_transaction_log (transaction_id, user_id, type, amount, balance_before, balance_after, checksum, created_at)
         VALUES (last_insert_rowid(), ?, ?, ?, ?, ?, ?, ?)`
      ).bind(txn.userId, txn.type, signedAmount, currentBalance, newBalance, checksum, createdAt),
    ]);

    const txnResult = results[1] as D1Result;
    const transactionId = txnResult.meta?.last_row_id ?? 0;

    return { success: true, newBalance, transactionId };
  }
}

/**
 * 활동 포인트 획득 (일일 제한 확인 포함)
 */
export async function earnActivityPoints(
  db: D1Database,
  userId: number,
  activityType: string,
  sourceId?: string
): Promise<{ earned: boolean; points: number; dailyCount: number; dailyLimit: number }> {
  const today = getTodayKST();

  // 활동 설정 조회
  const config = await db.prepare(
    'SELECT points_per_action, daily_limit, is_active FROM point_activity_config WHERE activity_type = ?'
  ).bind(activityType).first<{ points_per_action: number; daily_limit: number; is_active: number }>();

  if (!config || !config.is_active) {
    return { earned: false, points: 0, dailyCount: 0, dailyLimit: 0 };
  }

  // 오늘 획득 횟수 확인
  const daily = await db.prepare(
    'SELECT count, total_points FROM point_daily_earnings WHERE user_id = ? AND activity_type = ? AND earn_date = ?'
  ).bind(userId, activityType, today).first<{ count: number; total_points: number }>();

  const currentCount = daily?.count ?? 0;

  // 일일 제한 확인
  if (currentCount >= config.daily_limit) {
    return { earned: false, points: 0, dailyCount: currentCount, dailyLimit: config.daily_limit };
  }

  // 활동명 매핑
  const activityNames: Record<string, string> = {
    attendance: '출석체크',
    post: '게시글 작성',
    comment: '댓글 작성',
    gallery: '갤러리 업로드',
    game: '미니게임',
    scroll: '주문서 시뮬',
    chaos: '혼줌 시뮬',
    incubator: '부화기',
    event_join: '일정 참여',
    like: '좋아요',
  };

  // 포인트 지급
  const result = await processPointTransaction(db, {
    userId,
    type: 'earn',
    amount: config.points_per_action,
    source: activityType,
    sourceId,
    description: `${activityNames[activityType] || activityType} 활동 포인트`,
  });

  if (!result.success) {
    return { earned: false, points: 0, dailyCount: currentCount, dailyLimit: config.daily_limit };
  }

  // 일일 획득 기록 업데이트
  await db.prepare(
    `INSERT INTO point_daily_earnings (user_id, activity_type, earn_date, count, total_points)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(user_id, activity_type, earn_date) DO UPDATE SET
       count = count + 1,
       total_points = total_points + ?`
  ).bind(userId, activityType, today, config.points_per_action, config.points_per_action).run();

  return {
    earned: true,
    points: config.points_per_action,
    dailyCount: currentCount + 1,
    dailyLimit: config.daily_limit,
  };
}

/**
 * 어드민 감사 로그 기록
 */
export async function logAdminAction(
  db: D1Database,
  adminUserId: number,
  actionType: string,
  targetType: string,
  targetId: string,
  details: Record<string, any> = {}
): Promise<void> {
  const { date, time } = getKSTTimestamp();
  await db.prepare(
    `INSERT INTO admin_audit_log (admin_user_id, action_type, target_type, target_id, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(adminUserId, actionType, targetType, targetId, JSON.stringify(details), `${date} ${time}`).run();
}

/**
 * 사용자 포인트 잔액 조회
 */
export async function getBalance(db: D1Database, userId: number): Promise<number> {
  const row = await db.prepare(
    'SELECT balance FROM point_balances WHERE user_id = ?'
  ).bind(userId).first<{ balance: number }>();
  return row?.balance ?? 0;
}

/**
 * 포인트 무결성 검증 (관리자용)
 * 주 원장의 합산과 잔액 캐시 비교
 */
export async function verifyPointIntegrity(
  db: D1Database,
  userId: number
): Promise<{ valid: boolean; cachedBalance: number; computedBalance: number }> {
  const [balanceRow, sumRow] = await Promise.all([
    db.prepare('SELECT balance FROM point_balances WHERE user_id = ?').bind(userId).first<{ balance: number }>(),
    db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM point_transactions WHERE user_id = ?').bind(userId).first<{ total: number }>(),
  ]);

  const cachedBalance = balanceRow?.balance ?? 0;
  const computedBalance = sumRow?.total ?? 0;

  return {
    valid: cachedBalance === computedBalance,
    cachedBalance,
    computedBalance,
  };
}
