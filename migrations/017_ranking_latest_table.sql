-- ranking_characters_latest: 캐릭터당 최신 1행만 유지
-- 스크래핑 시 UPSERT로 자동 갱신 → rc_latest CTE 풀스캔(3.7M행) 대체
CREATE TABLE IF NOT EXISTS ranking_characters_latest (
  userindex INTEGER PRIMARY KEY AUTOINCREMENT,
  userrank  INTEGER,
  username  TEXT NOT NULL,
  userlevel INTEGER,
  userjob   TEXT,
  userguild TEXT DEFAULT '',
  userdate  TEXT,
  usertime  TEXT,
  usercode  TEXT DEFAULT '',
  avatar_img TEXT DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rcl_username  ON ranking_characters_latest(username);
CREATE INDEX        IF NOT EXISTS idx_rcl_userguild ON ranking_characters_latest(userguild);
CREATE INDEX        IF NOT EXISTS idx_rcl_usercode  ON ranking_characters_latest(usercode);
