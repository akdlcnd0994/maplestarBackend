-- Migration from local DB
DELETE FROM users WHERE 1=1;
DELETE FROM alliances WHERE 1=1;
DELETE FROM posts WHERE 1=1;
DELETE FROM events WHERE 1=1;

-- Alliances
INSERT INTO alliances (id, name, master_name, member_count, guild_level, emblem, description, is_main, sort_order, created_at) VALUES (1, '메이플운동회', '애시', 16, 3, '🍁', '메이플 운동회 길드입니다. 옛날 메이플의 모든 감성을 함께합니다.', 1, 1, '2026-01-21 19:48:50');
INSERT INTO alliances (id, name, master_name, member_count, guild_level, emblem, description, is_main, sort_order, created_at) VALUES (4, '지존 길드', '복숭아', 45, 7, NULL, '복숭아, 외국을 비롯한 지존들이 이끌어가는 이름 그대로 지존 길드', 0, 2, '2026-01-21 20:52:14');

-- Users
INSERT INTO users (id, username, password_hash, character_name, job, level, discord, profile_image, default_icon, role, alliance_id, is_approved, is_online, last_login_at, created_at, updated_at) VALUES (1, 'testuser', '1a94fa30b73e4c5b792f9b23da4fece3:2b3e40bcf7ae72a374fc59fc005404f7476511d0b1317bfe44f0e890c2861be6', '테스트캐릭', '캐논슈터', 133, 'test#1234', NULL, 'elf', 'member', NULL, 1, 1, '2026-01-21 20:42:26', '2026-01-21 19:50:00', '2026-01-21 20:57:36');
INSERT INTO users (id, username, password_hash, character_name, job, level, discord, profile_image, default_icon, role, alliance_id, is_approved, is_online, last_login_at, created_at, updated_at) VALUES (2, 'testuser2', '2c1bb819d50c58ad6407a656022b1b11:20b7600300eefb5df58d024467e8151f6675dbb78060aed8c52be7188367aece', '한글테스트', NULL, 100, 'test#5678', NULL, NULL, 'member', NULL, 1, 0, NULL, '2026-01-21 19:52:25', '2026-01-21 19:52:25');
INSERT INTO users (id, username, password_hash, character_name, job, level, discord, profile_image, default_icon, role, alliance_id, is_approved, is_online, last_login_at, created_at, updated_at) VALUES (3, 'tetetetetet', '640a1fa3389b471f90520c68b6060371:c7f8636e4ba6c9e07cc22e56c6b9941cc16c9f1ef991535c95a011865c3b9ab7', '애시', '비숍', 181, 'sdf2asd', NULL, 'fox', 'master', NULL, 1, 1, '2026-01-21 21:52:16', '2026-01-21 19:53:09', '2026-01-21 21:57:15');

-- Posts
INSERT INTO posts (id, category_id, user_id, title, content, view_count, like_count, comment_count, is_notice, is_deleted, created_at, updated_at) VALUES (1, 1, 3, 'te', 'te', 0, 1, 0, 0, 1, '2026-01-21 19:57:44', '2026-01-21 20:34:46');
INSERT INTO posts (id, category_id, user_id, title, content, view_count, like_count, comment_count, is_notice, is_deleted, created_at, updated_at) VALUES (2, 1, 3, 'te', 'te', 0, 1, 1, 0, 0, '2026-01-21 19:57:56', '2026-01-21 19:57:56');

-- Events
INSERT INTO events (id, title, description, event_type, event_date, event_time, max_participants, current_participants, is_active, created_by, created_at) VALUES (1, '흑사 여제 클리어팟', '여제 격파 참여', 'boss', '2026-01-23', '21:00', 1, 1, 1, 1, '2026-01-21 20:39:39');
INSERT INTO events (id, title, description, event_type, event_date, event_time, max_participants, current_participants, is_active, created_by, created_at) VALUES (2, '10만원 상품 내전 운동회', '10만원 상당 상품 걸고 내전 이벤트 운동회', 'event', '2026-01-24', '20:00', 10, 1, 1, 1, '2026-01-21 21:46:09');