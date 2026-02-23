# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 일반 규칙

- 모든 답변은 한글 기반으로 작성.
- 프론트엔드 프로젝트: `../maplestarFrontend` (상위 디렉토리의 maplestarFrontend 폴더)
- 로컬 개발 시 로컬 D1 사용, 배포 시 원격 D1 자동 매칭.
- "서버 열어줘" 등 로컬 서버 실행 요청 시 백엔드(`npm run dev`)와 프론트엔드(`../maplestarFrontend`에서 `npm run dev`) 모두 실행.

## Build & Development Commands

```bash
npm run dev              # 로컬 개발 서버 (wrangler dev, port 8787, 로컬 D1 사용)
npm run deploy           # Cloudflare Workers 배포 (원격 D1 사용)
npm run db:migrate       # 원격 D1에 schema.sql 실행
npm run db:migrate:local # 로컬 D1에 schema.sql 실행
```

개별 마이그레이션 파일은 `migrations/`에 있으며 수동으로 실행:
```bash
npx wrangler d1 execute maplestar-guild-db --file=./migrations/NNN_name.sql        # 원격
npx wrangler d1 execute maplestar-guild-db --local --file=./migrations/NNN_name.sql # 로컬
```

테스트 프레임워크는 설정되어 있지 않음.

## Architecture

**스택:** Cloudflare Workers + Hono v4 + D1 (SQLite) + R2 (이미지 저장소), TypeScript.

### Entry Point & Export Format

`src/index.ts`에서 Hono 앱을 생성하고 `fetch`와 `scheduled` 핸들러를 export함. 반드시 래퍼 함수를 사용해야 함 (`fetch: app.fetch` 직접 사용 시 바인딩 문제 발생):

```typescript
export default {
  fetch(request, env, ctx) { return app.fetch(request, env, ctx); },
  async scheduled(event, env, ctx) { /* cron 로직 */ },
};
```

### Environment Bindings

```typescript
interface Env {
  DB: D1Database;
  BUCKET?: R2Bucket;
  JWT_SECRET: string;
  ENVIRONMENT: string;
}
```

### Route Organization

모든 라우트는 `src/routes/`에 위치하며 `src/index.ts`에서 `/api/` 접두사로 마운트됨. 각 라우트 파일은 Hono 라우터 인스턴스를 export함. 현재 19개 라우트 모듈: auth, posts, gallery, attendance, members, alliances, events, notices, games, scrolls, chaos, incubator, ranking, points, shop, announcements, roulette, notifications, customizations.

### Middleware & Auth

- `authMiddleware` — JWT 인증 필수. `c.get('user')`에 `{userId, username, role}` 설정.
- `optionalAuthMiddleware` — 동일하지만 토큰 없거나 유효하지 않아도 통과.
- `requireRole(...roles)` — 역할 검사, `authMiddleware` 뒤에 사용. 주로: `requireRole('master', 'submaster')`.

### Response Helpers (`src/utils/response.ts`)

일관된 API 응답을 위해 반드시 사용:
- `success(c, data, meta?)` — `{ success: true, data, meta? }`
- `error(c, code, message, status?)` — `{ success: false, error: { code, message } }`
- `unauthorized(c)`, `forbidden(c)`, `notFound(c)` — 에러 응답 단축 함수.

### Crypto (Web Crypto API, 외부 의존성 없음)

- **JWT** (`src/utils/jwt.ts`): HMAC-SHA256, 기본 만료 7일. `signJWT()`, `verifyJWT()`, `verifyJWTWithStatus()`.
- **Password** (`src/utils/password.ts`): PBKDF2-SHA256, 10만 회 반복, `"saltHex:hashHex"` 형식으로 저장.

### Date/Timezone (`src/utils/date.ts`)

모든 날짜 로직은 KST (UTC+9) 기준이며 **새벽 5시 일일 리셋** 기준 (자정 아님). `getTodayKST()`는 이 리셋을 반영한 현재 "게임 일자"를 반환.

### Points System (`src/services/points.ts`)

이중 원장 설계, 3개 테이블 사용 (`point_balances`, `point_transactions`, `point_transaction_log`). 주요 함수:
- `processPointTransaction(db, txn)` — 출금 시 잔액 검증을 포함한 원자적 처리.
- `earnActivityPoints(db, userId, activityType, sourceId?)` — 활동 유형별 일일 한도 적용.
- `revokeActivityPoints(db, userId, source, sourceId)` — 콘텐츠 삭제 시 포인트 회수.

### Ranking Scraper (`src/routes/ranking.ts`)

`scheduled()` 핸들러를 통해 매시 정각 maplestar.io 랭킹 페이지 스크래핑. 22개 직업군을 11개 배치로 분할 (Cloudflare 50 subrequest 제한), `hour % 11`로 순환. `ranking_characters` 테이블에 UPSERT. 동일 `usercode` (아바타 이미지 경로에서 추출)로 본캐/부캐 연결.

### D1 Query Patterns

```typescript
// 단일 행 조회
const row = await db.prepare('SELECT ...').bind(...).first<T>();
// 복수 행 조회
const { results } = await db.prepare('SELECT ...').bind(...).all<T>();
// 배치 처리 (한 번에 ~80개 statement 제한)
await db.batch([stmt1, stmt2, ...]);
// 삽입 후 ID 가져오기
const res = await db.prepare('INSERT ...').bind(...).run();
const id = res.meta?.last_row_id;
```

### Pagination Convention

```typescript
const page = parseInt(c.req.query('page') || '1');
const limit = parseInt(c.req.query('limit') || '10');
const offset = (page - 1) * limit;
// meta에 포함: { page, limit, total, totalPages }
```

## Deployment

`main` 브랜치에 push하면 GitHub Actions (`deploy.yml`)가 `npx wrangler deploy` 실행. `CLOUDFLARE_API_KEY`와 `CLOUDFLARE_EMAIL` 시크릿이 GitHub에 설정되어 있음.

## CORS

허용된 origin: `maplestar.app`, `www.maplestar.app`, `maplestar-guild-rw4.pages.dev`, `localhost:5173`, `api.maplestar.app`.

## Platform Notes

- Windows 개발 환경 — PowerShell에서 `$` 변수 문제 있으므로 스크립팅 시 `node -e` 사용 권장.
- 유일한 의존성은 `hono`; 모든 암호화는 Workers 런타임 내장 Web Crypto API 사용.
