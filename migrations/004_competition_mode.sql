-- 경쟁 모드용 추가 주문서 아이템
INSERT OR IGNORE INTO incubator_items (id, name, rate, type, percent) VALUES
(139, '장갑 공격력 주문서 10%', 0.1, 'scroll', 10),
(140, '장갑 공격력 주문서 100%', 0.05, 'scroll', 100);

-- 경쟁 모드 랭킹 테이블 (노가다 목장갑)
CREATE TABLE IF NOT EXISTS competition_glove_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  final_attack INTEGER NOT NULL DEFAULT 0,
  upgrade_count INTEGER NOT NULL DEFAULT 0,
  scroll_10_used INTEGER NOT NULL DEFAULT 0,
  scroll_60_used INTEGER NOT NULL DEFAULT 0,
  scroll_100_used INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 경쟁 모드 랭킹 테이블 (혼줌 시뮬레이터)
CREATE TABLE IF NOT EXISTS competition_chaos_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  atk INTEGER NOT NULL DEFAULT 0,
  matk INTEGER NOT NULL DEFAULT 0,
  str INTEGER NOT NULL DEFAULT 0,
  dex INTEGER NOT NULL DEFAULT 0,
  int INTEGER NOT NULL DEFAULT 0,
  luk INTEGER NOT NULL DEFAULT 0,
  total_stat INTEGER NOT NULL DEFAULT 0,
  upgrade_count INTEGER NOT NULL DEFAULT 0,
  chaos_used INTEGER NOT NULL DEFAULT 0,
  innocent_used INTEGER NOT NULL DEFAULT 0,
  white_used INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_competition_glove_attack ON competition_glove_records(final_attack DESC);
CREATE INDEX IF NOT EXISTS idx_competition_glove_user ON competition_glove_records(user_id);
CREATE INDEX IF NOT EXISTS idx_competition_chaos_total ON competition_chaos_records(total_stat DESC);
CREATE INDEX IF NOT EXISTS idx_competition_chaos_user ON competition_chaos_records(user_id);
