import { Context } from 'hono';

export function success(c: Context, data: any, meta?: any) {
  return c.json({ success: true, data, ...(meta && { meta }) });
}

export function error(c: Context, code: string, message: string, status: number = 400) {
  return c.json({ success: false, error: { code, message } }, status);
}

export function unauthorized(c: Context, message: string = '로그인이 필요합니다.') {
  return error(c, 'UNAUTHORIZED', message, 401);
}

export function forbidden(c: Context, message: string = '권한이 없습니다.') {
  return error(c, 'FORBIDDEN', message, 403);
}

export function notFound(c: Context, message: string = '찾을 수 없습니다.') {
  return error(c, 'NOT_FOUND', message, 404);
}
