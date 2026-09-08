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

// 出题记录表
db.exec(`
CREATE TABLE IF NOT EXISTS question_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    keyword TEXT NOT NULL,
    questions TEXT NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// 错题本表
db.exec(`
CREATE TABLE IF NOT EXISTS mistakes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    keyword TEXT NOT NULL,
    type TEXT,
    question TEXT NOT NULL,
    options TEXT,
    answer TEXT,
    explanation TEXT,
    wrong_answer TEXT,
    wrong_count INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    master_time DATETIME
);
`);

// 学习计划表
db.exec(`
CREATE TABLE IF NOT EXISTS study_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    goal TEXT NOT NULL,
    tasks TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    complete_time DATETIME
);
`);

// 学习打卡表（同一用户同一天只记一次）
db.exec(`
CREATE TABLE IF NOT EXISTS study_checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    check_date TEXT NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, check_date)
);
`);

module.exports = db;