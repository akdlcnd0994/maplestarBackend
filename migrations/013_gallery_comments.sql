CREATE TABLE IF NOT EXISTS gallery_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gallery_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (gallery_id) REFERENCES gallery(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

ALTER TABLE gallery ADD COLUMN comment_count INTEGER DEFAULT 0;
