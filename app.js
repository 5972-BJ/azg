require('dotenv').config();

const cors = require('cors');
const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./database.js');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'default_secret_change_me';

// 跨域与JSON解析
app.use(express.json());

// 统一返回格式
function sendResponse(res, success, data, message) {
    res.json({ success, data: data || null, message: message || '' });
}

// Token登录校验中间件
const checkToken = (req, res, next) => {
    const token = req.headers.token;
    if (!token) {
        return sendResponse(res, false, null, '未登录，请先登录');
    }
    try {
        const payload = jwt.verify(token, SECRET_KEY);
        req.user = payload;
        next();
    } catch (err) {
        return sendResponse(res, false, null, 'token无效或已过期，请重新登录');
    }
};

// ===== 注册 =====
app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return sendResponse(res, false, null, '用户名、邮箱和密码不能为空');
    if (password.length < 6) return sendResponse(res, false, null, '密码长度不能少于6位');
    try {
        const existingUser = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, email);
        if (existingUser) {
            const reason = existingUser.username === username ? '用户名已存在' : '邮箱已被注册';
            return sendResponse(res, false, null, reason);
        }
        const hashedPassword = bcrypt.hashSync(password, 10);
        db.prepare('INSERT INTO users(username, email, password) VALUES(?, ?, ?)').run(username, email, hashedPassword);
        sendResponse(res, true, null, '注册成功');
    } catch (err) {
        sendResponse(res, false, null, err.message);
    }
});

// ===== 登录 =====
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return sendResponse(res, false, null, '用户名和密码不能为空');
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return sendResponse(res, false, null, '用户不存在');
    if (!bcrypt.compareSync(password, user.password)) return sendResponse(res, false, null, '密码错误');
    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '24h' });
    sendResponse(res, true, { token, user: { id: user.id, username: user.username, email: user.email } }, '登录成功');
});

// ===== 提交反馈 =====
app.post('/api/feedback', (req, res) => {
    const { name, email, content } = req.body;
    if (!name || !content) return sendResponse(res, false, null, '姓名和内容不能为空');
    const time = new Date().toLocaleString('zh-CN');
    db.prepare('INSERT INTO feedbacks (name, email, content, create_time) VALUES (?, ?, ?, ?)')
        .run(name, email || '', content, time);
    sendResponse(res, true, null, '反馈提交成功');
});

// ===== 获取所有反馈（管理员） =====
app.get('/api/feedbacks', checkToken, (req, res) => {
    const rows = db.prepare('SELECT * FROM feedbacks ORDER BY id DESC').all();
    sendResponse(res, true, rows, '获取成功');
});

// ===== 聊天接口 =====
app.post('/api/chat', (req, res) => {
    const { user_id, message } = req.body;
    if (!user_id || !message) return sendResponse(res, false, null, 'user_id 和 message 不能为空');
    // 校验用户是否存在
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(user_id);
    if (!user) return sendResponse(res, false, null, '用户不存在');
    // 占位回复，后续替换AI模块
    const reply = `${user.username} 你好！你问的是："${message}"。（这里是占位回复，等待AI模块封装）`;
    const data = {
        reply,
        mindmap: null,
        image: null
    };
    sendResponse(res, true, data, '获取回复成功');
});

// ===== 保存对话记录 =====
app.post('/api/chat/save', checkToken, (req, res) => {
    const { user_id, question, answer, mind_map, image_url } = req.body;
    if (!user_id || !question || !answer) {
        return sendResponse(res, false, null, 'user_id、question、answer不能为空');
    }
    // 校验用户是否存在
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id);
    if (!user) return sendResponse(res, false, null, '用户不存在');
    try {
        const stmt = db.prepare(`
            INSERT INTO chat_record (user_id, question, answer, mind_map, image_url)
            VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(user_id, question, answer, mind_map || null, image_url || null);
        sendResponse(res, true, null, '对话保存成功');
    } catch (err) {
        sendResponse(res, false, null, '保存失败：' + err.message);
    }
});

// ===== 智能出题接口 =====
app.post('/api/questions', (req, res) => {
    const { keyword } = req.body;
    if (!keyword) return sendResponse(res, false, null, 'keyword 不能为空');
    // 占位题目，后续替换AI模块
    const questions = [
        {
            id: 1,
            type: '选择题',
            question: `关于「${keyword}」，下列说法正确的是？`,
            options: [
                `「${keyword}」的定义、原理与实际应用密切相关`,
                `「${keyword}」在日常学习中毫无用处`,
                `「${keyword}」只能用于考试，无法实践`,
                '以上说法都不正确'
            ],
            answer: 'A',
            explanation: `本题考查「${keyword}」的基本认知。正确理解概念并结合实际应用是掌握该知识点的关键。（占位解析，等待AI模块接入）`
        },
        {
            id: 2,
            type: '简答题',
            question: `请简述「${keyword}」的核心要点。`,
            options: null,
            answer: `（占位答案）围绕「${keyword}」，可从基本概念、核心原理、典型应用三个方面展开作答。`,
            explanation: '简答题建议分点作答，先给结论再展开说明。（占位解析，等待AI模块接入）'
        },
        {
            id: 3,
            type: '应用题',
            question: `请结合一个实际场景，说明「${keyword}」是如何应用的。`,
            options: null,
            answer: `（占位答案）例如在学习场景中，可以借助「${keyword}」提升理解与练习效率。`,
            explanation: '应用题重在理论联系实际，需写明场景、方法与结果。（占位解析，等待AI模块接入）'
        }
    ];
    sendResponse(res, true, questions, '出题成功（占位，等待AI模块接入）');
});

// ===== 查询用户历史对话 =====
app.get('/api/chat/history', checkToken, (req, res) => {
    const user_id = req.query.user_id;
    if (!user_id) {
        return sendResponse(res, false, null, '请求必须携带user_id');
    }
    try {
        const list = db.prepare(`
            SELECT * FROM chat_record WHERE user_id = ? ORDER BY create_time DESC
        `).all(user_id);
        sendResponse(res, true, list, '查询成功');
    } catch (err) {
        sendResponse(res, false, null, err.message);
    }
});

// ===== 前端静态页面（仅白名单，避免暴露 .env / 数据库等敏感文件） =====
// Express 5 的 req.path 不会自动解码，这里手动解码后再做白名单匹配
const STATIC_FILES = [
    '/index.html', '/style.css', '/script.js', '/login.html', '/api-test.html',
    '/页面/页面1.html', '/页面/页面2.html', '/页面/页面3.html', '/页面/页面4.html', '/页面/页面5.html'
];
app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    let decoded;
    try {
        decoded = decodeURIComponent(req.path);
    } catch (err) {
        return next();
    }
    if (STATIC_FILES.includes(decoded)) {
        return res.sendFile(path.join(__dirname, decoded));
    }
    next();
});

// ===== 根路径：返回前端首页 =====
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ===== API 清单（原根路径信息迁移到这里） =====
app.get('/api', (req, res) => {
    res.json({
        message: 'AI学习网站后端已运行【含反馈功能】',
        endpoints: {
            register: 'POST /api/register',
            login: 'POST /api/login',
            chat: 'POST /api/chat',
            questions: 'POST /api/questions',
            feedback: 'POST /api/feedback',
            feedbacks: 'GET /api/feedbacks',
            chatSave: 'POST /api/chat/save',
            chatHistory: 'GET /api/chat/history'
        }
    });
});

app.listen(PORT, () => {
    console.log(`✅ 服务器运行在 http://localhost:${PORT}`);
});