import { Hono } from 'hono';
import { Env } from '../index';
import { authMiddleware } from '../middleware/auth';
import { success, error } from '../utils/response';

export const gameRoutes = new Hono<{ Bindings: Env }>();

// 게임 점수 제출
gameRoutes.post('/scores', authMiddleware, async (c) => {
  try {
    const { userId, username } = c.get('user');
    const body = await c.req.json();
    const { game_type, score, metadata } = body;

    const validGames = ['reaction', 'memory', 'typing', 'number', 'game2048', 'aimtrainer', 'colortest', 'snake', 'flappy', 'pattern'];
    if (!validGames.includes(game_type)) {
      return error(c, 'VALIDATION_ERROR', '유효하지 않은 게임입니다.');
    }

    // 유저 정보 가져오기
    const user = await c.env.DB.prepare(
      'SELECT character_name FROM users WHERE id = ?'
    ).bind(userId).first<{ character_name: string }>();

    // 기존 최고 점수 확인
    const existing = await c.env.DB.prepare(`
      SELECT id, score FROM game_scores
      WHERE user_id = ? AND game_type = ?
    `).bind(userId, game_type).first<{ id: number; score: number }>();

    // 낮은 점수가 좋은 게임 (반응속도, 숫자맞추기)
    const lowerIsBetter = ['reaction', 'number'].includes(game_type);

    let isNewRecord = false;
    if (!existing) {
      // 새 기록 추가
      await c.env.DB.prepare(`
        INSERT INTO game_scores (user_id, game_type, score, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(userId, game_type, score, JSON.stringify(metadata || {})).run();
      isNewRecord = true;
    } else {
      // 기록 갱신 (더 좋은 점수일 때만)
      const isBetter = lowerIsBetter ? score < existing.score : score > existing.score;
      if (isBetter) {
        await c.env.DB.prepare(`
          UPDATE game_scores SET score = ?, metadata = ?, updated_at = datetime('now')
          WHERE id = ?
        `).bind(score, JSON.stringify(metadata || {}), existing.id).run();
        isNewRecord = true;
      }
    }

    // 현재 순위 조회
    const rankQuery = lowerIsBetter
      ? 'SELECT COUNT(*) + 1 as rank FROM game_scores WHERE game_type = ? AND score < ?'
      : 'SELECT COUNT(*) + 1 as rank FROM game_scores WHERE game_type = ? AND score > ?';

    const rankResult = await c.env.DB.prepare(rankQuery)
      .bind(game_type, score).first<{ rank: number }>();

    return success(c, {
      isNewRecord,
      score,
      rank: rankResult?.rank || 1,
      character_name: user?.character_name
    });
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 게임별 랭킹 조회
gameRoutes.get('/rankings/:gameType', async (c) => {
  try {
    const gameType = c.req.param('gameType');
    const limit = parseInt(c.req.query('limit') || '10');

    const validGames = ['reaction', 'memory', 'typing', 'number', 'game2048', 'aimtrainer', 'colortest', 'snake', 'flappy', 'pattern'];
    if (!validGames.includes(gameType)) {
      return error(c, 'VALIDATION_ERROR', '유효하지 않은 게임입니다.');
    }

    // 낮은 점수가 좋은 게임
    const lowerIsBetter = ['reaction', 'number'].includes(gameType);
    const orderBy = lowerIsBetter ? 'ASC' : 'DESC';

    const rankings = await c.env.DB.prepare(`
      SELECT gs.id, gs.score, gs.metadata, gs.updated_at,
             u.id as user_id, u.character_name, u.profile_image, u.default_icon, u.profile_zoom
      FROM game_scores gs
      JOIN users u ON gs.user_id = u.id
      WHERE gs.game_type = ?
      ORDER BY gs.score ${orderBy}
      LIMIT ?
    `).bind(gameType, limit).all();

    return success(c, rankings.results?.map((r: any, i: number) => ({
      rank: i + 1,
      score: r.score,
      metadata: JSON.parse(r.metadata || '{}'),
      updated_at: r.updated_at,
      user: {
        id: r.user_id,
        character_name: r.character_name,
        profile_image: r.profile_image,
        default_icon: r.default_icon,
        profile_zoom: r.profile_zoom
      }
    })));
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 내 게임 기록 조회
gameRoutes.get('/my-scores', authMiddleware, async (c) => {
  try {
    const { userId } = c.get('user');

    const scores = await c.env.DB.prepare(`
      SELECT game_type, score, metadata, updated_at
      FROM game_scores
      WHERE user_id = ?
    `).bind(userId).all();

    // 각 게임별 순위 계산
    const result: any = {};
    for (const score of (scores.results || [])) {
      const s = score as any;
      const lowerIsBetter = ['reaction', 'number'].includes(s.game_type);
      const rankQuery = lowerIsBetter
        ? 'SELECT COUNT(*) + 1 as rank FROM game_scores WHERE game_type = ? AND score < ?'
        : 'SELECT COUNT(*) + 1 as rank FROM game_scores WHERE game_type = ? AND score > ?';

      const rankResult = await c.env.DB.prepare(rankQuery)
        .bind(s.game_type, s.score).first<{ rank: number }>();

      result[s.game_type] = {
        score: s.score,
        metadata: JSON.parse(s.metadata || '{}'),
        rank: rankResult?.rank || 1,
        updated_at: s.updated_at
      };
    }

    return success(c, result);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});

// 전체 랭킹 통계 (각 게임 TOP 3)
gameRoutes.get('/rankings', async (c) => {
  try {
    const games = ['reaction', 'memory', 'typing', 'number', 'game2048', 'aimtrainer', 'colortest', 'snake', 'flappy', 'pattern'];
    const result: any = {};

    for (const game of games) {
      const lowerIsBetter = ['reaction', 'number'].includes(game);
      const orderBy = lowerIsBetter ? 'ASC' : 'DESC';

      const top3 = await c.env.DB.prepare(`
        SELECT gs.score, u.character_name, u.profile_image, u.default_icon
        FROM game_scores gs
        JOIN users u ON gs.user_id = u.id
        WHERE gs.game_type = ?
        ORDER BY gs.score ${orderBy}
        LIMIT 3
      `).bind(game).all();

      result[game] = top3.results || [];
    }

    return success(c, result);
  } catch (e: any) {
    return error(c, 'SERVER_ERROR', e.message, 500);
  }
});
