const Database = require('better-sqlite3');
const path = require('path');

// 创建数据库文件
const db = new Database(path.join(__dirname, 'feedback.db'));

// 开启WAL模式（可选，优化读写）
db.pragma('journal_mode = WAL');

// 用户表
db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT
);
`);

// 反馈表
db.exec(`
CREATE TABLE IF NOT EXISTS feedbacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    content TEXT,
    create_time TEXT
);
`);

// 聊天记录表
db.exec(`
CREATE TABLE IF NOT EXISTS chat_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    mind_map TEXT,
    image_url TEXT,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

module.exports = db;