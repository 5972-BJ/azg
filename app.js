require('dotenv').config();

const cors = require('cors');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database.js');
const learningAgent = require('./learning-agent.js');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'default_secret_change_me';

// 跨域与JSON解析
app.use(express.json({ limit: '12mb' }));

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

// ===== 拍题学习工作流 =====
app.get('/api/learning/status', (req, res) => {
    sendResponse(res, true, {
        configured: learningAgent.isConfigured(),
        model: learningAgent.isConfigured() ? learningAgent.MODEL : null
    }, '工作流状态');
});

app.post('/api/learning/analyze', async (req, res) => {
    try {
        const { imageData, mimeType } = req.body;
        const result = await learningAgent.analyzeImage(imageData, mimeType);
        sendResponse(res, true, result, '题目分析完成');
    } catch (err) {
        res.status(err.status || 500).json({ success: false, data: null, message: err.message });
    }
});

app.post('/api/learning/chat', async (req, res) => {
    try {
        const { context, question } = req.body;
        if (!context || typeof question !== 'string' || !question.trim()) {
            return res.status(400).json({ success: false, data: null, message: '请提供题目分析上下文和问题' });
        }
        const reply = await learningAgent.tutorReply(context, question.trim());
        sendResponse(res, true, { reply }, '回答完成');
    } catch (err) {
        res.status(err.status || 500).json({ success: false, data: null, message: err.message });
    }
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
    console.log(`✅ 服务器运行在 http://localhost:${PORT}`);
});