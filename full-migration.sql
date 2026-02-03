-- Full migration from local DB
DELETE FROM attendance_benefits WHERE 1=1;
DELETE FROM attendance_stats WHERE 1=1;
DELETE FROM attendance WHERE 1=1;
DELETE FROM event_participants WHERE 1=1;
DELETE FROM gallery_likes WHERE 1=1;
DELETE FROM gallery WHERE 1=1;
DELETE FROM post_likes WHERE 1=1;
DELETE FROM comments WHERE 1=1;
DELETE FROM posts WHERE 1=1;
DELETE FROM notices WHERE 1=1;
DELETE FROM events WHERE 1=1;
DELETE FROM users WHERE 1=1;
DELETE FROM alliances WHERE 1=1;
DELETE FROM board_categories WHERE 1=1;

-- board_categories
INSERT INTO board_categories (id, slug, name, description, created_at) VALUES (1, 'showoff', '템자랑', '장비 자랑 게시판', '2026-01-21 19:48:50');
INSERT INTO board_categories (id, slug, name, description, created_at) VALUES (2, 'free', '자유게시판', '자유롭게 소통하는 공간', '2026-01-21 19:48:50');

-- alliances
INSERT INTO alliances (id, name, master_name, member_count, guild_level, emblem, description, is_main, sort_order, created_at) VALUES (1, '메이플운동회', '애시', 16, 3, '🍁', '메이플 운동회 길드입니다. 옛날 메이플의 모든 감성을 함께합니다.', 1, 1, '2026-01-21 19:48:50');
INSERT INTO alliances (id, name, master_name, member_count, guild_level, emblem, description, is_main, sort_order, created_at) VALUES (4, '지존 길드', '복숭아', 45, 7, NULL, '복숭아, 외국을 비롯한 지존들이 이끌어가는 이름 그대로 지존 길드', 0, 2, '2026-01-21 20:52:14');

-- users
INSERT INTO users (id, username, password_hash, character_name, job, level, discord, profile_image, role, is_approved, is_online, last_login_at, created_at, updated_at, default_icon, alliance_id) VALUES (1, 'testuser', '1a94fa30b73e4c5b792f9b23da4fece3:2b3e40bcf7ae72a374fc59fc005404f7476511d0b1317bfe44f0e890c2861be6', '테스트캐릭', '캐논슈터', 133, 'test#1234', NULL, 'member', 1, 1, '2026-01-21 20:42:26', '2026-01-21 19:50:00', '2026-01-21 20:57:36', 'elf', NULL);
INSERT INTO users (id, username, password_hash, character_name, job, level, discord, profile_image, role, is_approved, is_online, last_login_at, created_at, updated_at, default_icon, alliance_id) VALUES (2, 'testuser2', '2c1bb819d50c58ad6407a656022b1b11:20b7600300eefb5df58d024467e8151f6675dbb78060aed8c52be7188367aece', '한글테스트', NULL, 100, 'test#5678', NULL, 'member', 1, 0, NULL, '2026-01-21 19:52:25', '2026-01-21 19:52:25', NULL, NULL);
INSERT INTO users (id, username, password_hash, character_name, job, level, discord, profile_image, role, is_approved, is_online, last_login_at, created_at, updated_at, default_icon, alliance_id) VALUES (3, 'tetetetetet', '640a1fa3389b471f90520c68b6060371:c7f8636e4ba6c9e07cc22e56c6b9941cc16c9f1ef991535c95a011865c3b9ab7', '애시', '비숍', 181, 'sdf2asd', NULL, 'master', 1, 1, '2026-01-21 21:52:16', '2026-01-21 19:53:09', '2026-01-21 21:57:15', 'fox', NULL);

-- posts
INSERT INTO posts (id, category_id, user_id, title, content, view_count, like_count, comment_count, is_notice, is_deleted, created_at, updated_at) VALUES (1, 1, 3, 'te', 'te', 0, 1, 0, 0, 1, '2026-01-21 19:57:44', '2026-01-21 20:34:46');
INSERT INTO posts (id, category_id, user_id, title, content, view_count, like_count, comment_count, is_notice, is_deleted, created_at, updated_at) VALUES (2, 1, 3, 'te', 'te', 0, 1, 1, 0, 0, '2026-01-21 19:57:56', '2026-01-21 19:57:56');

-- comments
INSERT INTO comments (id, post_id, user_id, parent_id, content, is_deleted, created_at, updated_at) VALUES (1, 2, 3, NULL, '1', 1, '2026-01-21 20:27:08', '2026-01-21 20:27:08');
INSERT INTO comments (id, post_id, user_id, parent_id, content, is_deleted, created_at, updated_at) VALUES (2, 2, 3, NULL, '테스트 댓글이지용', 0, '2026-01-21 21:12:08', '2026-01-21 21:12:08');

-- post_likes
INSERT INTO post_likes (id, post_id, user_id, created_at) VALUES (2, 1, 3, '2026-01-21 20:19:10');
INSERT INTO post_likes (id, post_id, user_id, created_at) VALUES (5, 2, 3, '2026-01-21 21:12:10');

-- gallery
INSERT INTO gallery (id, user_id, title, description, image_key, image_url, thumbnail_key, thumbnail_url, view_count, like_count, is_deleted, created_at, updated_at) VALUES (1, 3, '1', '1', 'gallery/original/d3960f1c-096e-402b-9529-5851b0bae7b5.png', '/api/images/gallery/original/d3960f1c-096e-402b-9529-5851b0bae7b5.png', NULL, NULL, 0, 2, 0, '2026-01-21 19:58:06', '2026-01-21 19:58:06');

-- gallery_likes
INSERT INTO gallery_likes (id, gallery_id, user_id, created_at) VALUES (15, 1, 3, '2026-01-21 20:35:03');
INSERT INTO gallery_likes (id, gallery_id, user_id, created_at) VALUES (16, 1, 1, '2026-01-21 20:42:38');

-- attendance
INSERT INTO attendance (id, user_id, check_date, check_time, streak_count) VALUES (1, 3, '2026-01-21', '2026-01-21 19:54:09', 1);

-- attendance_stats
INSERT INTO attendance_stats (id, user_id, total_checks, current_streak, max_streak, last_check_date) VALUES (1, 3, 1, 1, 1, '2026-01-21');

-- attendance_benefits
INSERT INTO attendance_benefits (id, year, month, reward_5, reward_10, reward_15, reward_20, reward_full, created_at, updated_at) VALUES (1, 2026, 1, '메소 100만', '메소 200만', '메소 300만', '메소 500만', '메소 1천만', '2026-01-21 21:10:16', '2026-01-21 21:10:16');

-- events
INSERT INTO events (id, title, description, event_type, event_date, event_time, max_participants, current_participants, is_active, created_by, created_at, updated_at) VALUES (1, '흑사 여제 클리어팟', '여제 격파 참여', 'boss', '2026-01-23', '21:00', 1, 1, 1, NULL, '2026-01-21 20:39:39', '2026-01-21 21:26:31');
INSERT INTO events (id, title, description, event_type, event_date, event_time, max_participants, current_participants, is_active, created_by, created_at, updated_at) VALUES (2, '10만원 상품 내전 운동회', '10만원 상당 상품 걸고 내전 이벤트 운동회', 'event', '2026-01-24', '20:00', 10, 1, 1, NULL, '2026-01-21 21:46:09', NULL);

-- event_participants
INSERT INTO event_participants (id, event_id, user_id, status, created_at) VALUES (1, 1, 3, 'confirmed', '2026-01-21 20:39:45');
INSERT INTO event_participants (id, event_id, user_id, status, created_at) VALUES (2, 2, 3, 'confirmed', '2026-01-21 21:46:14');

-- notices
INSERT INTO notices (id, title, content, tag, is_hot, is_active, created_by, created_at, user_id, is_important, updated_at) VALUES (1, 'ㅅㄷ', 'ㅅㄷ', '공지', 0, 0, NULL, '2026-01-21 20:40:31', 3, 0, NULL);
INSERT INTO notices (id, title, content, tag, is_hot, is_active, created_by, created_at, user_id, is_important, updated_at) VALUES (2, '공지사항 테스트', '공지 테스트', '공지', 0, 1, NULL, '2026-01-21 20:40:40', 3, 1, NULL);
INSERT INTO notices (id, title, content, tag, is_hot, is_active, created_by, created_at, user_id, is_important, updated_at) VALUES (3, '1', '1', '공지', 0, 1, NULL, '2026-01-21 20:48:33', 3, 0, NULL);
