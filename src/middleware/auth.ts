import { Context, Next } from 'hono';
import { verifyJWTWithStatus } from '../utils/jwt';
import { error } from '../utils/response';

export interface AuthUser {
  userId: number;
  username: string;
  role: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(c, 'UNAUTHORIZED', '로그인이 필요합니다.', 401);
  }

  const token = authHeader.substring(7);
  const secret = c.env.JWT_SECRET || 'dev-secret-key-change-in-production';

  const result = await verifyJWTWithStatus(token, secret);

  if (result.status === 'expired') {
    return error(c, 'SESSION_EXPIRED', '로그인 세션이 만료되었습니다. 다시 로그인해주세요.', 401);
  }

  if (result.status === 'invalid') {
    return error(c, 'INVALID_TOKEN', '유효하지 않은 토큰입니다.', 401);
  }

  c.set('user', {
    userId: result.payload.userId,
    username: result.payload.username,
    role: result.payload.role,
  });

  await next();
}

export async function optionalAuthMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const secret = c.env.JWT_SECRET || 'dev-secret-key-change-in-production';
    const result = await verifyJWTWithStatus(token, secret);
    if (result.status === 'valid') {
      c.set('user', {
        userId: result.payload.userId,
        username: result.payload.username,
        role: result.payload.role,
      });
    }
  }
  await next();
}

export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    if (!user || !roles.includes(user.role)) {
      return unauthorized(c, '권한이 없습니다.');
    }
    await next();
  };
}
