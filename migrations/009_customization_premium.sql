-- Migration 009: 꾸미기 아이템 프리미엄 리뉴얼
-- 기존 23개 -> 73개 (닉네임 25, 프레임 18, 칭호 30)

-- 칭호 등급 저장용 컬럼 추가
ALTER TABLE users ADD COLUMN active_title_rarity TEXT DEFAULT NULL;

-- 기존 아이템 비활성화
UPDATE customization_items SET is_active = 0;

-- 기존 장착 아이템 해제 (비활성화된 아이템)
UPDATE user_customizations SET is_equipped = 0
WHERE item_id IN (SELECT id FROM customization_items WHERE is_active = 0);

-- 기존 유저의 활성 커스터마이징 초기화
UPDATE users SET active_name_color = NULL, active_frame = NULL, active_title = NULL, active_title_rarity = NULL;

-- ==================== 닉네임 색상 (25개) ====================

-- 기본 (Common, 20~30P) - 8개
INSERT INTO customization_items (type, name, description, value, price, rarity, sort_order) VALUES
  ('name_color', '체리 레드', '선명한 빨강', '#e53935', 20, 'common', 101),
  ('name_color', '코발트 블루', '깊은 파랑', '#1e88e5', 20, 'common', 102),
  ('name_color', '에메랄드', '보석 녹색', '#00897b', 20, 'common', 103),
  ('name_color', '라벤더', '은은한 보라', '#7e57c2', 25, 'common', 104),
  ('name_color', '코랄 핑크', '따뜻한 핑크', '#f06292', 25, 'common', 105),
  ('name_color', '민트', '시원한 민트', '#26a69a', 20, 'common', 106),
  ('name_color', '앰버', '따뜻한 호박색', '#ffb300', 30, 'common', 107),
  ('name_color', '슬레이트', '차분한 회청', '#78909c', 20, 'common', 108);

-- 고급 (Rare, 50P) - 6개 (그라데이션)
INSERT INTO customization_items (type, name, description, value, price, rarity, sort_order) VALUES
  ('name_color', '로즈골드', '로즈골드 그라데이션', 'gradient:#e8a87c,#d4838f', 50, 'rare', 201),
  ('name_color', '오션 딥', '바다 그라데이션', 'gradient:#0077b6,#00b4d8', 50, 'rare', 202),
  ('name_color', '선셋 바이올렛', '석양 그라데이션', 'gradient:#c471ed,#f64f59', 50, 'rare', 203),
  ('name_color', '포레스트', '숲 그라데이션', 'gradient:#134e5e,#71b280', 50, 'rare', 204),
  ('name_color', '피치 크림', '복숭아 그라데이션', 'gradient:#ffecd2,#fcb69f', 50, 'rare', 205),
  ('name_color', '미드나잇', '다크 그라데이션', 'gradient:#232526,#414345', 50, 'rare', 206);

-- 에픽 (Epic, 100P) - 6개 (발광)
INSERT INTO customization_items (type, name, description, value, price, rarity, sort_order) VALUES
  ('name_color', '골드 글로우', '금빛 발광 효과', 'glow:#ffd700', 100, 'epic', 301),
  ('name_color', '아이스 글로우', '얼음 발광 효과', 'glow:#4fc3f7', 100, 'epic', 302),
  ('name_color', '독 글로우', '독안개 발광 효과', 'glow:#76ff03', 100, 'epic', 303),
  ('name_color', '네온사인', '네온 발광 효과', 'glow:#ff1744', 100, 'epic', 304),
  ('name_color', '블러드문', '짙은 붉은빛 발광', 'glow:#b71c1c', 100, 'epic', 305),
  ('name_color', '일렉트릭', '전기 발광 효과', 'glow:#448aff', 100, 'epic', 306);

-- 전설 (Legendary, 200~300P) - 5개 (애니메이션)
INSERT INTO customization_items (type, name, description, value, price, rarity, sort_order) VALUES
  ('name_color', '레인보우', '무지개 흐름 애니메이션', 'rainbow', 200, 'legendary', 401),
  ('name_color', '오로라', '오로라 색변환 애니메이션', 'aurora', 250, 'legendary', 402),
  ('name_color', '홀로그램', '메탈릭 홀로그램 효과', 'hologram', 250, 'legendary', 403),
  ('name_color', '인페르노', '불꽃 색상 맥동', 'inferno', 300, 'legendary', 404),
  ('name_color', '갤럭시', '은하계 보라+파랑 흐름', 'galaxy', 300, 'legendary', 405);

-- ==================== 프로필 프레임 (18개) ====================

-- 기본 (Common, 30P) - 4개
INSERT INTO customization_items (type, name, description, value, price, rarity, sort_order) VALUES
  ('frame', '심플 화이트', '깔끔한 흰색 테두리', 'white', 30, 'common', 101),
  ('frame', '심플 블랙', '모던한 검은 테두리', 'black', 30, 'common', 102),
  ('frame', '우드', '따뜻한 나무색 테두리', 'wood', 30, 'common', 103),
  ('frame', '스틸', '메탈릭 회색 테두리', 'steel', 30, 'common', 104);

-- 고급 (Rare, 60~80P) - 5개
INSERT INTO customization_items (type, name, description, value, price, rarity, sort_order) VALUES
  ('frame', '실버', '은빛 광택 테두리', 'silver', 60, 'rare', 201),
  ('frame', '골드', '금빛 광택 테두리', 'gold', 80, 'rare', 202),
  ('frame', '로즈골드', '로즈골드 광택 테두리', 'rosegold', 80, 'rare', 203),
  ('frame', '벚꽃', '핑크 벚꽃 테마', 'sakura', 70, 'rare', 204),
  ('frame', '바다', '파란 물결 테마', 'ocean', 70, 'rare', 205);

-- 에픽 (Epic, 120~150P) - 5개
INSERT INTO customization_items (type, name, description, value, price, rarity, sort_order) VALUES
  ('frame', '네온', '사이버펑크 네온 발광', 'neon', 120, 'epic', 301),
  ('frame', '불꽃', '타오르는 불꽃 맥동', 'fire', 130, 'epic', 302),
  ('frame', '얼음', '차가운 서리 효과', 'ice', 130, 'epic', 303),
  ('frame', '번개', '전기 스파크 효과', 'lightning', 150, 'epic', 304),
  ('frame', '독', '독안개 초록 발광', 'poison', 150, 'epic', 305);

-- 전설 (Legendary, 250~400P) - 4개
INSERT INTO customization_items (type, name, description, value, price, rarity, sort_order) VALUES
  ('frame', '레전더리', '무지개 그라데이션 회전', 'legendary', 250, 'legendary', 401),
  ('frame', '용의 숨결', '빨강+금 파동 효과', 'dragon', 350, 'legendary', 402),
  ('frame', '별의 파편', '파랑+보라 맥동 효과', 'starlight', 350, 'legendary', 403),
  ('frame', '보스 킬러', '붉은 광폭 오라', 'bosskiller', 400, 'legendary', 404);

-- ==================== 칭호 (30개) ====================

-- 기본 (Common, 10~20P) - 8개
INSERT INTO customization_items (type, name, description, value, price, rarity, sort_order) VALUES
  ('title', '뉴비', '갓 입문한 새내기', '뉴비', 10, 'common', 101),
  ('title', '산책자', '길드를 유유히 돌아다니는', '산책자', 10, 'common', 102),
  ('title', '감자', '소파에 누운 감자', '감자', 15, 'common', 103),
  ('title', '눈팅러', '조용히 지켜보는 자', '눈팅러', 10, 'common', 104),
  ('title', '잠수함', '가끔 떠오르는 잠수함', '잠수함', 15, 'common', 105),
  ('title', '평범한 시민', '그냥 평범한 시민입니다', '평범한 시민', 10, 'common', 106),
  ('title', '호기심 고양이', '뭐든 궁금한 고양이', '호기심 고양이', 20, 'common', 107),
  ('title', '씹덕', '진정한 오타쿠', '씹덕', 20, 'common', 108);

-- 고급 (Rare, 40~60P) - 8개
INSERT INTO customization_items (type, name, description, value, price, rarity, sort_order) VALUES
  ('title', '활동왕', '모든 활동에 빠지지 않는', '활동왕', 40, 'rare', 201),
  ('title', '댓글 요정', '댓글을 달지 않고는 못 배기는', '댓글 요정', 40, 'rare', 202),
  ('title', '출석의 달인', '매일 빠짐없이 출석하는', '출석의 달인', 50, 'rare', 203),
  ('title', '사진 수집가', '갤러리의 단골손님', '사진 수집가', 50, 'rare', 204),
  ('title', '행운아', '룰렛의 총아', '행운아', 45, 'rare', 205),
  ('title', '수다쟁이', '채팅을 멈출 수 없는', '수다쟁이', 40, 'rare', 206),
  ('title', '열정맨', '누구보다 열정적인', '열정맨', 50, 'rare', 207),
  ('title', '포인트 헌터', '포인트라면 사족을 못 쓰는', '포인트 헌터', 60, 'rare', 208);

-- 에픽 (Epic, 100~150P) - 8개
INSERT INTO customization_items (type, name, description, value, price, rarity, sort_order) VALUES
  ('title', '게임 폐인', '게임에 미친 사람', '게임 폐인', 100, 'epic', 301),
  ('title', '갤러리 장인', '갤러리를 빛내는 장인', '갤러리 장인', 100, 'epic', 302),
  ('title', '길드 스타', '모두가 아는 스타', '길드 스타', 120, 'epic', 303),
  ('title', '분위기 메이커', '어디서든 분위기를 살리는', '분위기 메이커', 120, 'epic', 304),
  ('title', '시간 부자', '시간이 남아도는 자', '시간 부자', 100, 'epic', 305),
  ('title', '만렙 직전', '거의 다 왔다', '만렙 직전', 130, 'epic', 306),
  ('title', '콘텐츠 괴물', '콘텐츠 소비 기계', '콘텐츠 괴물', 150, 'epic', 307),
  ('title', '올라운더', '뭐든지 다 잘하는', '올라운더', 150, 'epic', 308);

-- 전설 (Legendary, 200~400P) - 6개
INSERT INTO customization_items (type, name, description, value, price, rarity, sort_order) VALUES
  ('title', '운동회 레전드', '역대급 운동회의 전설', '운동회 레전드', 200, 'legendary', 401),
  ('title', '메이플 신', '메이플의 살아있는 신화', '메이플 신', 300, 'legendary', 402),
  ('title', '길드의 심장', '길드를 이끄는 심장', '길드의 심장', 250, 'legendary', 403),
  ('title', '전설이 되다', '전설이 된 자', '전설이 되다', 350, 'legendary', 404),
  ('title', '보스 슬레이어', '모든 보스를 쓰러뜨린', '보스 슬레이어', 300, 'legendary', 405),
  ('title', '언터처블', '누구도 건드릴 수 없는', '언터처블', 400, 'legendary', 406);
