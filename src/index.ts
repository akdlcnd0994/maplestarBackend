import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from './routes/auth';
import { postRoutes } from './routes/posts';
import { galleryRoutes } from './routes/gallery';
import { attendanceRoutes } from './routes/attendance';
import { memberRoutes } from './routes/members';
import { allianceRoutes } from './routes/alliances';
import { eventRoutes } from './routes/events';
import { noticeRoutes } from './routes/notices';
import { gameRoutes } from './routes/games';
import { scrollRoutes } from './routes/scrolls';
import { chaosRoutes } from './routes/chaos';
import { incubatorRoutes } from './routes/incubator';
import { rankingRoutes, scrapeAllRankings } from './routes/ranking';
import { pointRoutes } from './routes/points';
import { shopRoutes } from './routes/shop';
import { announcementRoutes } from './routes/announcements';

export interface Env {
  DB: D1Database;
  BUCKET?: R2Bucket;
  JWT_SECRET: string;
  ENVIRONMENT: string;
}

const app = new Hono<{ Bindings: Env }>();

// CORS 설정
app.use('*', cors({
  origin: ['https://maplestar.app', 'https://www.maplestar.app', 'https://maplestar-guild-rw4.pages.dev', 'http://localhost:5173', 'https://api.maplestar.app'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
}));

// 라우트 등록
app.route('/api/auth', authRoutes);
app.route('/api/posts', postRoutes);
app.route('/api/gallery', galleryRoutes);
app.route('/api/attendance', attendanceRoutes);
app.route('/api/members', memberRoutes);
app.route('/api/alliances', allianceRoutes);
app.route('/api/events', eventRoutes);
app.route('/api/notices', noticeRoutes);
app.route('/api/games', gameRoutes);
app.route('/api/scrolls', scrollRoutes);
app.route('/api/chaos', chaosRoutes);
app.route('/api/incubator', incubatorRoutes);
app.route('/api/ranking', rankingRoutes);
app.route('/api/points', pointRoutes);
app.route('/api/shop', shopRoutes);
app.route('/api/announcements', announcementRoutes);

// 이미지 서빙 (R2)
app.get('/api/images/*', async (c) => {
  try {
    if (!c.env.BUCKET) {
      return c.json({ success: false, error: { code: 'NOT_CONFIGURED', message: 'Image storage not configured' } }, 503);
    }
    const key = c.req.path.replace('/api/images/', '');
    const object = await c.env.BUCKET.get(key);

    if (!object) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Image not found' } }, 404);
    }

    const origin = c.req.header('Origin') || '';
    const allowedOrigins = ['https://maplestar.app', 'https://www.maplestar.app', 'https://maplestar-guild-rw4.pages.dev', 'http://localhost:5173', 'https://api.maplestar.app'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'image/png');
    headers.set('Cache-Control', 'public, max-age=31536000');
    headers.set('Access-Control-Allow-Origin', corsOrigin);
    headers.set('Access-Control-Allow-Credentials', 'true');

    return new Response(object.body, { headers });
  } catch (e: any) {
    return c.json({ success: false, error: { code: 'SERVER_ERROR', message: e.message } }, 500);
  }
});

// 헬스체크
app.get('/api/health', (c) => c.json({ success: true, data: { status: 'ok' } }));

// 404
app.notFound((c) => c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not Found' } }, 404));

// 에러 핸들링
app.onError((err, c) => {
  console.error(err);
  return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } }, 500);
});

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // 매시 정각 실행, 시간 기반으로 배치 인덱스 결정 (11개 배치 순환)
    const hour = new Date(event.scheduledTime).getUTCHours();
    const batchIndex = hour % 11;
    ctx.waitUntil(scrapeAllRankings(env.DB, batchIndex));
  },
};
