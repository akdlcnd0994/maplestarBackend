-- 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    character_name TEXT NOT NULL,
    job TEXT,
    level INTEGER DEFAULT 100,
    discord TEXT,
    profile_image TEXT,
    role TEXT DEFAULT 'member',
    alliance_id INTEGER,
    is_approved INTEGER DEFAULT 0,
    is_online INTEGER DEFAULT 0,
    last_login_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (alliance_id) REFERENCES alliances(id)
);

-- 게시판 카테고리
CREATE TABLE IF NOT EXISTS board_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 게시글 테이블
CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    is_notice INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES board_categories(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 게시글 이미지
CREATE TABLE IF NOT EXISTS post_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    image_key TEXT NOT NULL,
    image_url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- 댓글 테이블
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    parent_id INTEGER,
    content TEXT NOT NULL,
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES comments(id)
);

-- 좋아요 테이블
CREATE TABLE IF NOT EXISTS post_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(post_id, user_id)
);

-- 갤러리 테이블
CREATE TABLE IF NOT EXISTS gallery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    image_key TEXT NOT NULL,
    image_url TEXT NOT NULL,
    thumbnail_key TEXT,
    thumbnail_url TEXT,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 갤러리 좋아요
CREATE TABLE IF NOT EXISTS gallery_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gallery_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (gallery_id) REFERENCES gallery(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(gallery_id, user_id)
);

-- 출석체크 테이블
CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    check_date TEXT NOT NULL,
    check_time TEXT DEFAULT (datetime('now')),
    streak_count INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, check_date)
);

-- 출석 통계
CREATE TABLE IF NOT EXISTS attendance_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    total_checks INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    max_streak INTEGER DEFAULT 0,
    last_check_date TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 출석 혜택
CREATE TABLE IF NOT EXISTS attendance_benefits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    reward_5 TEXT,
    reward_10 TEXT,
    reward_15 TEXT,
    reward_20 TEXT,
    reward_full TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(year, month)
);

-- 길드 연합 테이블
CREATE TABLE IF NOT EXISTS alliances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    master_name TEXT NOT NULL,
    member_count INTEGER DEFAULT 0,
    guild_level INTEGER DEFAULT 1,
    emblem TEXT,
    description TEXT,
    is_main INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 이벤트/일정 테이블
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL,
    event_date TEXT NOT NULL,
    event_time TEXT NOT NULL,
    max_participants INTEGER,
    current_participants INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 이벤트 참가자
CREATE TABLE IF NOT EXISTS event_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(event_id, user_id)
);

-- 공지사항 테이블
CREATE TABLE IF NOT EXISTS notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT NOT NULL,
    content TEXT,
    tag TEXT DEFAULT '공지',
    is_important INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_character_name ON users(character_name);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category_id, is_deleted, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_gallery_user ON gallery(user_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, check_date);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date, is_active);

-- 게임 점수 테이블 (랭킹 시스템)
CREATE TABLE IF NOT EXISTS game_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    game_type TEXT NOT NULL,
    score INTEGER NOT NULL,
    metadata TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, game_type)
);

CREATE INDEX IF NOT EXISTS idx_game_scores_type ON game_scores(game_type, score);
CREATE INDEX IF NOT EXISTS idx_game_scores_user ON game_scores(user_id);

-- 주문서 시뮬레이터 기록 테이블
CREATE TABLE IF NOT EXISTS scroll_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    success_count INTEGER NOT NULL DEFAULT 0,
    fail_count INTEGER NOT NULL DEFAULT 0,
    total_stat INTEGER NOT NULL DEFAULT 0,
    stat_type TEXT DEFAULT 'atk',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_scroll_records_user ON scroll_records(user_id);
CREATE INDEX IF NOT EXISTS idx_scroll_records_stat ON scroll_records(total_stat DESC);

-- 부화기 아이템 목록
CREATE TABLE IF NOT EXISTS incubator_items (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    rate REAL NOT NULL,
    type TEXT NOT NULL,
    percent INTEGER
);

-- 부화기 인벤토리
CREATE TABLE IF NOT EXISTS incubator_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    count INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (item_id) REFERENCES incubator_items(id),
    UNIQUE(user_id, item_id)
);

-- 부화기 기록 (모든 부화 기록)
CREATE TABLE IF NOT EXISTS incubator_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    hatch_count INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (item_id) REFERENCES incubator_items(id)
);

-- 부화기 일일 통계
CREATE TABLE IF NOT EXISTS incubator_daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    hatch_date TEXT NOT NULL,
    total_hatches INTEGER DEFAULT 0,
    legendary_count INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, hatch_date)
);

-- 부화기 보너스 횟수 (관리자 지급)
CREATE TABLE IF NOT EXISTS incubator_bonus (
    user_id INTEGER PRIMARY KEY,
    bonus_hatches INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_incubator_inventory_user ON incubator_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_incubator_history_user ON incubator_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incubator_daily_stats_user_date ON incubator_daily_stats(user_id, hatch_date);

-- 랭킹 캐릭터 테이블 (maplestar.io 스크래핑 데이터)
CREATE TABLE IF NOT EXISTS ranking_characters (
    userindex INTEGER PRIMARY KEY AUTOINCREMENT,
    userrank INTEGER NOT NULL,
    username TEXT NOT NULL,
    userlevel INTEGER NOT NULL,
    userjob TEXT NOT NULL,
    userguild TEXT DEFAULT '',
    userdate TEXT NOT NULL,
    usertime TEXT NOT NULL,
    usercode TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ranking_username ON ranking_characters(username);
CREATE INDEX IF NOT EXISTS idx_ranking_usercode ON ranking_characters(usercode);

-- 초기 데이터 삽입
INSERT OR IGNORE INTO board_categories (slug, name, description) VALUES
('showoff', '템자랑', '장비 자랑 게시판'),
('free', '자유게시판', '자유롭게 소통하는 공간');

INSERT OR IGNORE INTO alliances (name, master_name, member_count, guild_level, emblem, description, is_main, sort_order) VALUES
('메이플운동회', '운동회장', 127, 25, '🍁', '본 길드입니다. 레전드 시대의 감성을 함께.', 1, 1),
('단풍나무숲', '숲지기', 89, 22, '🌲', '사냥 특화 연합 길드.', 0, 2),
('버섯마을주민', '버섯왕', 64, 18, '🍄', '친목 위주, 초보자 환영!', 0, 3);

-- 부화기 아이템 초기 데이터 (138개)
INSERT OR IGNORE INTO incubator_items (id, name, rate, type, percent) VALUES
(1, '전설의 용사 뱃지', 0.001, 'special', NULL),
(2, '태초의 정수', 0.08, 'special', NULL),
(3, '[마스터리북]메이플용사 30', 0.2, 'book', NULL),
(4, '프로텍트 주문서', 0.23, 'scroll', NULL),
(5, '두손무기 공격력 주문서 50%', 0.25, 'scroll', 50),
(6, '두손무기 마력 주문서 50%', 0.25, 'scroll', 50),
(7, '한손무기 공격력 주문서 50%', 0.25, 'scroll', 50),
(8, '한손무기 마력 주문서 50%', 0.25, 'scroll', 50),
(9, '이노센트 주문서 100%', 0.28, 'scroll', 100),
(10, '스페셜 잠재능력 부여 주문서', 0.3, 'scroll', NULL),
(11, '악세서리 민첩성 주문서 50%', 0.3, 'scroll', 50),
(12, '악세서리 지력 주문서 50%', 0.3, 'scroll', 50),
(13, '악세서리 행운 주문서 50%', 0.3, 'scroll', 50),
(14, '악세서리 힘 주문서 50%', 0.3, 'scroll', 50),
(15, '펫장비 공격력 주문서 60%', 0.3, 'scroll', 60),
(16, '펫장비 마력 주문서 60%', 0.3, 'scroll', 60),
(17, '펫장비 민첩성 주문서 60%', 0.3, 'scroll', 60),
(18, '펫장비 이동속도 주문서 60%', 0.3, 'scroll', 60),
(19, '펫장비 점프력 주문서 60%', 0.3, 'scroll', 60),
(20, '펫장비 지력 주문서 60%', 0.3, 'scroll', 60),
(21, '펫장비 행운 주문서 60%', 0.3, 'scroll', 60),
(22, '펫장비 힘 주문서 60%', 0.3, 'scroll', 60),
(23, '혼돈의 주문서 60%', 0.3, 'scroll', 60),
(24, '투구 방어력 주문서 60%', 0.3, 'scroll', 60),
(25, '투구 체력 주문서 60%', 0.3, 'scroll', 60),
(26, '투구 지력 주문서 60%', 0.3, 'scroll', 60),
(27, '투구 민첩성 주문서 60%', 0.3, 'scroll', 60),
(28, '귀 장식 지력 주문서 60%', 0.3, 'scroll', 60),
(29, '귀 장식 민첩 주문서 60%', 0.3, 'scroll', 60),
(30, '귀 장식 행운 주문서 60%', 0.3, 'scroll', 60),
(31, '귀 장식 체력 주문서 60%', 0.3, 'scroll', 60),
(32, '상의 방어력 주문서 60%', 0.3, 'scroll', 60),
(33, '상의 힘 주문서 60%', 0.3, 'scroll', 60),
(34, '상의 체력 주문서 60%', 0.3, 'scroll', 60),
(35, '상의 행운 주문서 60%', 0.3, 'scroll', 60),
(36, '전신 갑옷 민첩성 주문서 60%', 0.3, 'scroll', 60),
(37, '전신 갑옷 방어력 주문서 60%', 0.3, 'scroll', 60),
(38, '전신 갑옷 지력 주문서 60%', 0.3, 'scroll', 60),
(39, '전신 갑옷 행운 주문서 60%', 0.3, 'scroll', 60),
(40, '전신 갑옷 힘 주문서 60%', 0.3, 'scroll', 60),
(41, '하의 방어력 주문서 60%', 0.3, 'scroll', 60),
(42, '하의 점프 주문서 60%', 0.3, 'scroll', 60),
(43, '하의 체력 주문서 60%', 0.3, 'scroll', 60),
(44, '하의 민첩성 주문서 60%', 0.3, 'scroll', 60),
(45, '신발 민첩성 주문서 60%', 0.3, 'scroll', 60),
(46, '신발 점프력 주문서 60%', 0.3, 'scroll', 60),
(47, '신발 이동속도 주문서 60%', 0.3, 'scroll', 60),
(48, '장갑 민첩성 주문서 60%', 0.3, 'scroll', 60),
(49, '장갑 공격력 주문서 60%', 0.3, 'scroll', 60),
(50, '장갑 체력 주문서 60%', 0.3, 'scroll', 60),
(51, '방패 방어력 주문서 60%', 0.3, 'scroll', 60),
(52, '방패 행운 주문서 60%', 0.3, 'scroll', 60),
(53, '방패 체력 주문서 60%', 0.3, 'scroll', 60),
(54, '방패 힘 주문서 60%', 0.3, 'scroll', 60),
(55, '망토 마법 방어력 주문서 60%', 0.3, 'scroll', 60),
(56, '망토 물리 방어력 주문서 60%', 0.3, 'scroll', 60),
(57, '망토 체력 주문서 60%', 0.3, 'scroll', 60),
(58, '망토 마나 주문서 60%', 0.3, 'scroll', 60),
(59, '망토 힘 주문서 60%', 0.3, 'scroll', 60),
(60, '망토 지력 주문서 60%', 0.3, 'scroll', 60),
(61, '망토 민첩성 주문서 60%', 0.3, 'scroll', 60),
(62, '망토 행운 주문서 60%', 0.3, 'scroll', 60),
(63, '반지 힘 주문서 60%', 0.3, 'scroll', 60),
(64, '반지 지력 주문서 60%', 0.3, 'scroll', 60),
(65, '반지 민첩성 주문서 60%', 0.3, 'scroll', 60),
(66, '반지 행운 주문서 60%', 0.3, 'scroll', 60),
(67, '벨트 힘 주문서 60%', 0.3, 'scroll', 60),
(68, '벨트 지력 주문서 60%', 0.3, 'scroll', 60),
(69, '벨트 민첩성 주문서 60%', 0.3, 'scroll', 60),
(70, '벨트 행운 주문서 60%', 0.3, 'scroll', 60),
(71, '한손검 공격력 주문서 60%', 0.3, 'scroll', 60),
(72, '한손검 명중치 주문서 60%', 0.3, 'scroll', 60),
(73, '한손도끼 공격력 주문서 60%', 0.3, 'scroll', 60),
(74, '한손도끼 명중치 주문서 60%', 0.3, 'scroll', 60),
(75, '한손둔기 공격력 주문서 60%', 0.3, 'scroll', 60),
(76, '한손둔기 명중치 주문서 60%', 0.3, 'scroll', 60),
(77, '단검 공격력 주문서 60%', 0.3, 'scroll', 60),
(78, '블레이드 공격력 주문서 60%', 0.3, 'scroll', 60),
(79, '완드 마력 주문서 60%', 0.3, 'scroll', 60),
(80, '스태프 마력 주문서 60%', 0.3, 'scroll', 60),
(81, '두손검 공격력 주문서 60%', 0.3, 'scroll', 60),
(82, '두손검 명중치 주문서 60%', 0.3, 'scroll', 60),
(83, '두손도끼 공격력 주문서 60%', 0.3, 'scroll', 60),
(84, '두손도끼 명중치 주문서 60%', 0.3, 'scroll', 60),
(85, '두손둔기 공격력 주문서 60%', 0.3, 'scroll', 60),
(86, '두손둔기 명중치 주문서 60%', 0.3, 'scroll', 60),
(87, '창 공격력 주문서 60%', 0.3, 'scroll', 60),
(88, '창 명중치 주문서 60%', 0.3, 'scroll', 60),
(89, '폴암 공격력 주문서 60%', 0.3, 'scroll', 60),
(90, '폴암 명중치 주문서 60%', 0.3, 'scroll', 60),
(91, '활 공격력 주문서 60%', 0.3, 'scroll', 60),
(92, '석궁 공격력 주문서 60%', 0.3, 'scroll', 60),
(93, '아대 공격력 주문서 60%', 0.3, 'scroll', 60),
(94, '너클 공격력 주문서 60%', 0.3, 'scroll', 60),
(95, '너클 명중치 주문서 60%', 0.3, 'scroll', 60),
(96, '건 공격력 주문서 60%', 0.3, 'scroll', 60),
(97, '듀얼 보우건 공격력 주문서 60%', 0.3, 'scroll', 60),
(98, '핸드캐논 공격력 주문서 60%', 0.3, 'scroll', 60),
(99, '한손무기 공격력 주문서 60%', 0.3, 'scroll', 60),
(100, '한손무기 마력 주문서 60%', 0.3, 'scroll', 60),
(101, '두손무기 공격력 주문서 60%', 0.3, 'scroll', 60),
(102, '방어구 힘 주문서 60%', 0.3, 'scroll', 60),
(103, '방어구 지력 주문서 60%', 0.3, 'scroll', 60),
(104, '방어구 민첩성 주문서 60%', 0.3, 'scroll', 60),
(105, '방어구 행운 주문서 60%', 0.3, 'scroll', 60),
(106, '악세서리 힘 주문서 60%', 0.3, 'scroll', 60),
(107, '악세서리 지력 주문서 60%', 0.3, 'scroll', 60),
(108, '악세서리 민첩성 주문서 60%', 0.3, 'scroll', 60),
(109, '악세서리 행운 주문서 60%', 0.3, 'scroll', 60),
(110, '방어구 강화 주문서 50%', 0.35, 'scroll', 50),
(111, '방어구 민첩성 주문서 50%', 0.35, 'scroll', 50),
(112, '방어구 지력 주문서 50%', 0.35, 'scroll', 50),
(113, '방어구 행운 주문서 50%', 0.35, 'scroll', 50),
(114, '방어구 힘 주문서 50%', 0.35, 'scroll', 50),
(115, '금빛 각인의 인장', 0.5, 'special', NULL),
(116, '황금 망치', 1, 'special', NULL),
(117, '백의 주문서 20%', 1, 'scroll', NULL),
(118, '불가사의한 레시피 두루마리', 1.5, 'scroll', NULL),
(119, '달님별님 쿠션', 1.95, 'chair', NULL),
(120, '갈색 모래토끼 쿠션', 1.95, 'chair', NULL),
(121, '핑크 비치파라솔', 1.95, 'chair', NULL),
(122, '네이비 벨벳쇼파', 1.95, 'chair', NULL),
(123, '레드 디자인체어', 1.95, 'chair', NULL),
(124, '부비 고양이 의자', 1.95, 'chair', NULL),
(125, '냠냠팬더 의자', 1.95, 'chair', NULL),
(126, '드래곤의 알', 1.95, 'special', NULL),
(127, '꿈꾸는 화가 의자', 1.95, 'chair', NULL),
(128, '와글친구 의자', 1.95, 'chair', NULL),
(129, '엔틱 축음기 의자', 1.95, 'chair', NULL),
(130, '백의 주문서 10%', 2, 'scroll', 10),
(131, '고급 잠재능력 부여 주문서', 2, 'scroll', NULL),
(132, '은빛 각인의 인장', 3, 'special', NULL),
(133, '황금 망치 50%', 3, 'special', NULL),
(134, '백의 주문서 5%', 3, 'scroll', NULL),
(135, '신비의 마스터리북', 3, 'book', NULL),
(136, '잠재능력 부여 주문서', 5, 'scroll', NULL),
(137, '경험치 2배 쿠폰', 10, 'coupon', NULL),
(138, '드롭률 30% 쿠폰', 10, 'coupon', NULL);
