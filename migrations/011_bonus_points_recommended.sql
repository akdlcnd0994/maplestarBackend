-- 첫 댓글/좋아요 보너스 + 추천게시물 보너스 포인트 설정 추가
INSERT OR IGNORE INTO point_activity_config (activity_type, activity_name, points_per_action, daily_limit, is_active) VALUES
('first_comment', '첫 댓글 보너스', 2, 50, 1),
('first_like', '첫 좋아요 보너스', 2, 50, 1),
('recommended_post', '추천게시물 보너스', 10, 10, 1);

-- 게시글에 추천 상태 컬럼 추가
ALTER TABLE posts ADD COLUMN is_recommended INTEGER NOT NULL DEFAULT 0;
