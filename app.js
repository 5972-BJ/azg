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

// ===== DeepSeek AI 配置 =====
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

// 答疑助手人设
const AI_SYSTEM_PROMPT = [
    '你是「AGZ AI学习网站」的答疑助手，帮助学生解答各学科的学习问题。',
    '回答要求：',
    '1. 准确、通俗易懂，优先把概念和原理讲清楚；',
    '2. 善用分点、步骤和例子，重要结论可以单独总结；',
    '3. 如果问题不够完整，先给出通用讲解，再引导用户补充细节；',
    '4. 使用中文回答，公式尽量用文字或简单符号表达。'
].join('\n');

// 出题助手人设（要求输出纯 JSON）
const QUESTIONS_SYSTEM_PROMPT = [
    '你是「AGZ AI学习网站」的智能出题助手。',
    '根据用户给出的知识点，生成 3 道适合学生的练习题：1道选择题、1道简答题、1道应用题。',
    '要求：题目准确覆盖知识点、难度适中、答案和解析完整；',
    '选择题的 answer 必须且只能是正确选项的字母（A/B/C/D 其中一个，不要带选项内容）；',
    '简答题和应用题的 answer 写参考答案要点，用于后续批改对照；',
    '必须只输出一个 JSON 对象，不要输出任何其他文字，格式如下：',
    '{"questions":[{"type":"选择题","question":"题干","options":["选项A","选项B","选项C","选项D"],"answer":"B","explanation":"解析"},{"type":"简答题","question":"题干","options":null,"answer":"参考答案要点","explanation":"解析"},{"type":"应用题","question":"题干","options":null,"answer":"参考答案要点","explanation":"解析"}]}'
].join('\n');

// 智能批改人设（要求输出纯 JSON）
const GRADE_SYSTEM_PROMPT = [
    '你是「AGZ AI学习网站」的智能批改助手。',
    '根据题目、参考答案和学生作答，判断学生答案是否正确，并给出点评。',
    '批改标准：意思正确、要点齐全即可判定为 correct=true，不要求与参考答案逐字一致；',
    '点评用中文，2~3句话：先说明对错，再简要说明依据；若答错，给出关键思路提示，但不要直接写出完整答案。',
    '必须只输出一个 JSON 对象，不要输出任何其他文字，格式如下：',
    '{"correct":true,"comment":"点评内容"}'
].join('\n');

// 解析出题返回的 JSON（容错处理 markdown 代码块包裹等情况）
function parseQuestions(text) {
    let json = text;
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) json = fence[1];
    const data = JSON.parse(json);
    if (!data || !Array.isArray(data.questions)) throw new Error('AI 返回格式不正确');
    return data.questions
        .map((q, i) => ({
            id: i + 1,
            type: q.type || '题目',
            question: q.question || '',
            options: Array.isArray(q.options) && q.options.length ? q.options : null,
            answer: q.answer || '',
            explanation: q.explanation || ''
        }))
        .filter(q => q.question);
}

// 解析批改返回的 JSON（容错处理 markdown 代码块包裹等情况）
function parseGrade(text) {
    let json = text;
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) json = fence[1];
    const data = JSON.parse(json);
    return {
        correct: !!data.correct,
        comment: data.comment || ''
    };
}

// 解析错题选项 JSON（容错）
function parseOptions(str) {
    if (!str) return null;
    try {
        const arr = JSON.parse(str);
        return Array.isArray(arr) && arr.length ? arr : null;
    } catch (e) {
        return null;
    }
}

// 学习计划规划师人设（要求输出纯 JSON）
const PLAN_SYSTEM_PROMPT = [
    '你是「AGZ AI学习网站」的学习计划规划师。',
    '根据用户的学习目标、计划天数和每天可用时间，制定一份可执行的学习计划。',
    '要求：',
    '1. 把大目标拆解成每天 2~4 个具体可执行的小任务（例如"观看导数概念讲解视频并做笔记"），不要写空话；',
    '2. 任务按"学习新知 → 巩固练习 → 总结复盘"的节奏安排，最后一天安排综合测试或整体复习；',
    '3. 输出 JSON 时，每天必须生成 2~4 个任务对象（day 字段相同表示同一天），任务总量必须是计划天数 × 2 到 3 条；',
    '必须只输出一个 JSON 对象，不要输出任何其他文字，格式如下（注意同一天有多条任务）：',
    '{"title":"计划标题（简短）","tasks":[{"day":1,"content":"任务内容"},{"day":1,"content":"任务内容"},{"day":2,"content":"任务内容"},{"day":2,"content":"任务内容"}]}'
].join('\n');

// 学习监督教练人设（输出纯文本）
const URGE_SYSTEM_PROMPT = [
    '你是「AGZ AI学习网站」的学习监督教练。',
    '根据学生的学习计划和当前进度，给出一段监督提醒。',
    '规则：',
    '1. 有逾期未完成的任务：直接指出差距，给 1 条立即可执行的追赶建议；',
    '2. 进度正常但有未完成任务：肯定已完成的努力，鼓励继续；',
    '3. 全部完成：热烈祝贺，并建议开始新的学习挑战；',
    '语气像严格又温暖的教练，2~4 句话，中文，直接输出文字（不要 JSON、不要 markdown 标记）。'
].join('\n');

// 解析计划返回的 JSON（容错处理 markdown 代码块包裹等情况）
function parsePlan(text) {
    let json = text;
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) json = fence[1];
    const data = JSON.parse(json);
    if (!data || !Array.isArray(data.tasks) || !data.tasks.length) throw new Error('AI 返回格式不正确');
    const tasks = data.tasks
        .map(t => ({ day: Number(t.day) || 1, content: String(t.content || '').trim() }))
        .filter(t => t.content);
    if (!tasks.length) throw new Error('AI 返回格式不正确');
    return {
        title: String(data.title || '').trim() || '我的学习计划',
        tasks
    };
}

// 日期工具：YYYY-MM-DD
function fmtDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
}

// 计划第 N 天对应的日期（以计划创建日为第 1 天）
function dayToDate(createDay, day) {
    const d = new Date(createDay + 'T00:00:00');
    d.setDate(d.getDate() + (Number(day) || 1) - 1);
    return fmtDate(d);
}

// 计算连续打卡天数（今天没打卡则从昨天往前数）
function calcStreak(dates) {
    if (!dates.length) return 0;
    const set = new Set(dates);
    const cur = new Date();
    if (!set.has(fmtDate(cur))) cur.setDate(cur.getDate() - 1);
    let streak = 0;
    while (set.has(fmtDate(cur))) {
        streak += 1;
        cur.setDate(cur.getDate() - 1);
    }
    return streak;
}

// 调用 DeepSeek 对话接口（OpenAI 兼容格式，extra 可覆盖默认参数）
async function callDeepSeek(messages, extra) {
    if (!DEEPSEEK_API_KEY) throw new Error('未配置 DEEPSEEK_API_KEY');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000); // 60秒超时
    try {
        const res = await fetch(DEEPSEEK_BASE_URL + '/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + DEEPSEEK_API_KEY
            },
            body: JSON.stringify(Object.assign({
                model: DEEPSEEK_MODEL,
                messages,
                temperature: 0.7,
                max_tokens: 2000,
                stream: false
            }, extra || {})),
            signal: controller.signal
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error('DeepSeek 接口返回 ' + res.status + '：' + text.slice(0, 200));
        }
        const data = await res.json();
        const reply = data.choices && data.choices[0] && data.choices[0].message
            ? data.choices[0].message.content
            : '';
        if (!reply) throw new Error('DeepSeek 返回内容为空');
        return reply;
    } finally {
        clearTimeout(timer);
    }
}

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

// ===== 聊天接口（对接 DeepSeek） =====
app.post('/api/chat', async (req, res) => {
    const { user_id, message } = req.body;
    if (!user_id || !message) return sendResponse(res, false, null, 'user_id 和 message 不能为空');
    // 校验用户是否存在
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(user_id);
    if (!user) return sendResponse(res, false, null, '用户不存在');
    try {
        // 取最近 10 轮对话作为上下文（过滤掉旧的占位回复）
        const history = db.prepare(`
            SELECT question, answer FROM chat_record
            WHERE user_id = ? ORDER BY id DESC LIMIT 10
        `).all(user_id)
            .reverse()
            .filter(r => r.answer && !/占位|等待AI模块/.test(r.answer));

        const messages = [
            { role: 'system', content: AI_SYSTEM_PROMPT },
            ...history.flatMap(r => [
                { role: 'user', content: r.question },
                { role: 'assistant', content: r.answer }
            ]),
            { role: 'user', content: message }
        ];

        const reply = await callDeepSeek(messages);
        sendResponse(res, true, { reply, mindmap: null, image: null }, '获取回复成功');
    } catch (err) {
        console.error('[DeepSeek] 调用失败：', err.message);
        sendResponse(res, false, null, 'AI 服务暂时不可用：' + err.message);
    }
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

// ===== 智能出题接口（对接 DeepSeek，需登录） =====
app.post('/api/questions', checkToken, async (req, res) => {
    const { keyword } = req.body;
    if (!keyword) return sendResponse(res, false, null, 'keyword 不能为空');
    try {
        const reply = await callDeepSeek([
            { role: 'system', content: QUESTIONS_SYSTEM_PROMPT },
            { role: 'user', content: keyword }
        ], {
            temperature: 0.5,
            max_tokens: 3000,
            response_format: { type: 'json_object' }
        });
        const questions = parseQuestions(reply);
        // 保存出题记录（失败不影响出题结果）
        try {
            db.prepare('INSERT INTO question_record (user_id, keyword, questions) VALUES (?, ?, ?)')
                .run(req.user.id, keyword, JSON.stringify(questions));
        } catch (saveErr) {
            console.error('[出题记录] 保存失败：', saveErr.message);
        }
        sendResponse(res, true, questions, '出题成功');
    } catch (err) {
        console.error('[DeepSeek] 出题失败：', err.message);
        sendResponse(res, false, null, 'AI 出题失败：' + err.message);
    }
});

// ===== 智能批改接口（对接 DeepSeek，需登录） =====
app.post('/api/questions/grade', checkToken, async (req, res) => {
    const { question, reference_answer, user_answer } = req.body;
    if (!question || !user_answer) return sendResponse(res, false, null, 'question 和 user_answer 不能为空');
    try {
        const reply = await callDeepSeek([
            { role: 'system', content: GRADE_SYSTEM_PROMPT },
            {
                role: 'user',
                content: [
                    '题目：' + question,
                    '参考答案：' + (reference_answer || '（无）'),
                    '学生作答：' + user_answer
                ].join('\n')
            }
        ], {
            temperature: 0.3,
            max_tokens: 500,
            response_format: { type: 'json_object' }
        });
        const grade = parseGrade(reply);
        sendResponse(res, true, grade, '批改完成');
    } catch (err) {
        console.error('[DeepSeek] 批改失败：', err.message);
        sendResponse(res, false, null, 'AI 批改失败：' + err.message);
    }
});

// ===== 查询出题历史 =====
app.get('/api/questions/history', checkToken, (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT id, keyword, questions, create_time FROM question_record
            WHERE user_id = ? ORDER BY id DESC
        `).all(req.user.id);
        const list = rows.map(r => {
            let questions = null;
            try {
                questions = JSON.parse(r.questions);
            } catch (e) {
                questions = null;
            }
            return { id: r.id, keyword: r.keyword, questions, create_time: r.create_time };
        });
        sendResponse(res, true, list, '查询成功');
    } catch (err) {
        sendResponse(res, false, null, err.message);
    }
});

// ===== 错题本：加入错题（重复的待复习错题自动累加错误次数） =====
app.post('/api/mistakes', checkToken, (req, res) => {
    const { keyword, type, question, options, answer, explanation, wrong_answer } = req.body;
    if (!question) return sendResponse(res, false, null, 'question 不能为空');
    try {
        const existing = db.prepare(
            'SELECT id, wrong_count FROM mistakes WHERE user_id = ? AND question = ? AND status = ?'
        ).get(req.user.id, question, 'pending');
        if (existing) {
            db.prepare('UPDATE mistakes SET wrong_count = ?, wrong_answer = ?, type = ?, keyword = ? WHERE id = ?')
                .run(existing.wrong_count + 1, wrong_answer || '', type || null, keyword || '', existing.id);
            return sendResponse(res, true, { id: existing.id, added: false }, '该题已在错题本，错误次数 +1');
        }
        const info = db.prepare(`
            INSERT INTO mistakes (user_id, keyword, type, question, options, answer, explanation, wrong_answer)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(req.user.id, keyword || '', type || null, question,
            options ? JSON.stringify(options) : null,
            answer || '', explanation || '', wrong_answer || '');
        sendResponse(res, true, { id: info.lastInsertRowid, added: true }, '已加入错题本');
    } catch (err) {
        sendResponse(res, false, null, err.message);
    }
});

// ===== 错题本：列表 + 统计 =====
app.get('/api/mistakes', checkToken, (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM mistakes WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
        const list = rows.map(r => ({
            id: r.id,
            keyword: r.keyword,
            type: r.type,
            question: r.question,
            options: parseOptions(r.options),
            answer: r.answer,
            explanation: r.explanation,
            wrong_answer: r.wrong_answer,
            wrong_count: r.wrong_count,
            status: r.status,
            create_time: r.create_time,
            master_time: r.master_time
        }));
        const pending = list.filter(r => r.status === 'pending');
        const mastered = list.filter(r => r.status === 'mastered');
        const total = list.length;
        sendResponse(res, true, {
            pending,
            mastered,
            stats: {
                pending: pending.length,
                mastered: mastered.length,
                total,
                rate: total ? Math.round(mastered.length / total * 100) : 0
            }
        }, '查询成功');
    } catch (err) {
        sendResponse(res, false, null, err.message);
    }
});

// ===== 错题本：标记已掌握 / 重新加入待复习 =====
function updateMistakeStatus(req, res, status, okMsg) {
    const id = Number(req.params.id);
    if (!id) return sendResponse(res, false, null, 'id 无效');
    try {
        const row = db.prepare('SELECT id FROM mistakes WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (!row) return sendResponse(res, false, null, '错题不存在或无权操作');
        db.prepare(status === 'mastered'
            ? 'UPDATE mistakes SET status = ?, master_time = CURRENT_TIMESTAMP WHERE id = ?'
            : 'UPDATE mistakes SET status = ?, master_time = NULL WHERE id = ?').run(status, id);
        sendResponse(res, true, null, okMsg);
    } catch (err) {
        sendResponse(res, false, null, err.message);
    }
}

app.post('/api/mistakes/:id/master', checkToken, (req, res) => {
    updateMistakeStatus(req, res, 'mastered', '已标记为掌握，继续加油！');
});

app.post('/api/mistakes/:id/reopen', checkToken, (req, res) => {
    updateMistakeStatus(req, res, 'pending', '已重新加入待复习');
});

// ===== 错题本：复习时又答错，错误次数 +1 =====
app.post('/api/mistakes/:id/retry', checkToken, (req, res) => {
    const id = Number(req.params.id);
    if (!id) return sendResponse(res, false, null, 'id 无效');
    try {
        const row = db.prepare('SELECT id, wrong_count FROM mistakes WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (!row) return sendResponse(res, false, null, '错题不存在或无权操作');
        db.prepare('UPDATE mistakes SET wrong_count = ?, wrong_answer = ?, status = ? WHERE id = ?')
            .run(row.wrong_count + 1, req.body.wrong_answer || '', 'pending', id);
        sendResponse(res, true, { wrong_count: row.wrong_count + 1 }, '已记录，再想想！');
    } catch (err) {
        sendResponse(res, false, null, err.message);
    }
});

// ===== 错题本：移除错题 =====
app.delete('/api/mistakes/:id', checkToken, (req, res) => {
    const id = Number(req.params.id);
    if (!id) return sendResponse(res, false, null, 'id 无效');
    try {
        const info = db.prepare('DELETE FROM mistakes WHERE id = ? AND user_id = ?').run(id, req.user.id);
        if (!info.changes) return sendResponse(res, false, null, '错题不存在或无权操作');
        sendResponse(res, true, null, '已移除');
    } catch (err) {
        sendResponse(res, false, null, err.message);
    }
});

// ===== 学习计划：AI 生成并保存 =====
app.post('/api/plans/generate', checkToken, async (req, res) => {
    const { goal, days, daily_time } = req.body;
    if (!goal) return sendResponse(res, false, null, 'goal 不能为空');
    const planDays = Math.min(Math.max(Number(days) || 7, 1), 30);
    try {
        const reply = await callDeepSeek([
            { role: 'system', content: PLAN_SYSTEM_PROMPT },
            {
                role: 'user',
                content: '学习目标：' + goal + '\n计划天数：' + planDays + ' 天\n每天可用时间：' + (daily_time || '1小时')
            }
        ], {
            temperature: 0.5,
            max_tokens: 3000,
            response_format: { type: 'json_object' }
        });
        const plan = parsePlan(reply);
        plan.tasks = plan.tasks.map(t => ({ day: Math.min(Math.max(t.day, 1), planDays), content: t.content }));
        const info = db.prepare('INSERT INTO study_plans (user_id, title, goal, tasks) VALUES (?, ?, ?, ?)')
            .run(req.user.id, plan.title, goal, JSON.stringify(plan.tasks));
        sendResponse(res, true, {
            id: info.lastInsertRowid,
            title: plan.title,
            goal,
            days: planDays,
            tasks: plan.tasks.map((t, i) => ({ id: i, day: t.day, content: t.content, done: false }))
        }, '计划已生成');
    } catch (err) {
        console.error('[DeepSeek] 生成计划失败：', err.message);
        sendResponse(res, false, null, 'AI 生成计划失败：' + err.message);
    }
});

// ===== 学习计划：列表 + 打卡统计 =====
app.get('/api/plans', checkToken, (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM study_plans WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
        const plans = rows.map(r => {
            let tasks = [];
            try {
                tasks = JSON.parse(r.tasks).map((t, i) => ({
                    id: i,
                    day: Number(t.day) || 1,
                    content: t.content,
                    done: !!t.done
                }));
            } catch (e) { /* 数据损坏时返回空任务 */ }
            const total = tasks.length;
            const done = tasks.filter(t => t.done).length;
            return {
                id: r.id,
                title: r.title,
                goal: r.goal,
                tasks,
                status: r.status,
                create_time: r.create_time,
                complete_time: r.complete_time,
                progress: { total, done, rate: total ? Math.round(done / total * 100) : 0 }
            };
        });
        const dates = db.prepare('SELECT check_date FROM study_checkins WHERE user_id = ?').all(req.user.id).map(r => r.check_date);
        const today = fmtDate(new Date());
        sendResponse(res, true, {
            plans,
            stats: {
                streak: calcStreak(dates),
                today_checked: dates.includes(today),
                total_days: dates.length,
                active_plans: plans.filter(p => p.status === 'active').length
            }
        }, '查询成功');
    } catch (err) {
        sendResponse(res, false, null, err.message);
    }
});

// ===== 学习计划：切换任务完成状态（完成自动打卡） =====
app.post('/api/plans/:id/toggle-task', checkToken, (req, res) => {
    const id = Number(req.params.id);
    const taskId = Number(req.body.task_id);
    if (!id || isNaN(taskId)) return sendResponse(res, false, null, '参数无效');
    try {
        const row = db.prepare('SELECT * FROM study_plans WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (!row) return sendResponse(res, false, null, '计划不存在或无权操作');
        const tasks = JSON.parse(row.tasks);
        if (taskId < 0 || taskId >= tasks.length) return sendResponse(res, false, null, '任务不存在');
        tasks[taskId].done = tasks[taskId].done ? 0 : 1;
        db.prepare('UPDATE study_plans SET tasks = ? WHERE id = ?').run(JSON.stringify(tasks), id);
        // 完成任务自动打卡
        if (tasks[taskId].done) {
            db.prepare('INSERT OR IGNORE INTO study_checkins (user_id, check_date) VALUES (?, ?)')
                .run(req.user.id, fmtDate(new Date()));
        }
        const dates = db.prepare('SELECT check_date FROM study_checkins WHERE user_id = ?').all(req.user.id).map(r => r.check_date);
        const today = fmtDate(new Date());
        sendResponse(res, true, {
            done: !!tasks[taskId].done,
            streak: calcStreak(dates),
            today_checked: dates.includes(today)
        }, '已更新');
    } catch (err) {
        sendResponse(res, false, null, err.message);
    }
});

// ===== 学习计划：手动打卡 =====
app.post('/api/checkin', checkToken, (req, res) => {
    try {
        db.prepare('INSERT OR IGNORE INTO study_checkins (user_id, check_date) VALUES (?, ?)')
            .run(req.user.id, fmtDate(new Date()));
        const dates = db.prepare('SELECT check_date FROM study_checkins WHERE user_id = ?').all(req.user.id).map(r => r.check_date);
        sendResponse(res, true, {
            streak: calcStreak(dates),
            today_checked: true,
            total_days: dates.length
        }, '打卡成功，继续保持！');
    } catch (err) {
        sendResponse(res, false, null, err.message);
    }
});

// ===== 学习计划：标记完成 =====
app.post('/api/plans/:id/complete', checkToken, (req, res) => {
    const id = Number(req.params.id);
    if (!id) return sendResponse(res, false, null, 'id 无效');
    try {
        const row = db.prepare('SELECT id FROM study_plans WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (!row) return sendResponse(res, false, null, '计划不存在或无权操作');
        db.prepare('UPDATE study_plans SET status = ?, complete_time = CURRENT_TIMESTAMP WHERE id = ?').run('completed', id);
        sendResponse(res, true, null, '恭喜完成计划！');
    } catch (err) {
        sendResponse(res, false, null, err.message);
    }
});

// ===== 学习计划：删除 =====
app.delete('/api/plans/:id', checkToken, (req, res) => {
    const id = Number(req.params.id);
    if (!id) return sendResponse(res, false, null, 'id 无效');
    try {
        const info = db.prepare('DELETE FROM study_plans WHERE id = ? AND user_id = ?').run(id, req.user.id);
        if (!info.changes) return sendResponse(res, false, null, '计划不存在或无权操作');
        sendResponse(res, true, null, '已删除');
    } catch (err) {
        sendResponse(res, false, null, err.message);
    }
});

// ===== 学习计划：AI 监督提醒 =====
app.post('/api/plans/:id/urge', checkToken, async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return sendResponse(res, false, null, 'id 无效');
    try {
        const row = db.prepare('SELECT * FROM study_plans WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (!row) return sendResponse(res, false, null, '计划不存在或无权操作');
        let tasks = [];
        try { tasks = JSON.parse(row.tasks); } catch (e) { /* 忽略损坏数据 */ }
        const total = tasks.length;
        const done = tasks.filter(t => t.done).length;
        const today = fmtDate(new Date());
        const createDay = row.create_time ? String(row.create_time).slice(0, 10) : today;
        const overdue = tasks.filter(t => !t.done && dayToDate(createDay, t.day) < today).length;
        const reply = await callDeepSeek([
            { role: 'system', content: URGE_SYSTEM_PROMPT },
            {
                role: 'user',
                content: [
                    '计划标题：' + row.title,
                    '计划目标：' + row.goal,
                    '任务总数：' + total + '，已完成：' + done + '，逾期未完成：' + overdue,
                    '今天日期：' + today
                ].join('\n')
            }
        ], { temperature: 0.6, max_tokens: 400 });
        sendResponse(res, true, { message: reply }, '监督提醒已生成');
    } catch (err) {
        console.error('[DeepSeek] 监督提醒失败：', err.message);
        sendResponse(res, false, null, 'AI 监督提醒失败：' + err.message);
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
            questionsGrade: 'POST /api/questions/grade',
            questionsHistory: 'GET /api/questions/history',
            mistakesAdd: 'POST /api/mistakes',
            mistakesList: 'GET /api/mistakes',
            mistakesMaster: 'POST /api/mistakes/:id/master',
            mistakesReopen: 'POST /api/mistakes/:id/reopen',
            mistakesRetry: 'POST /api/mistakes/:id/retry',
            mistakesDelete: 'DELETE /api/mistakes/:id',
            planGenerate: 'POST /api/plans/generate',
            plansList: 'GET /api/plans',
            planToggleTask: 'POST /api/plans/:id/toggle-task',
            planComplete: 'POST /api/plans/:id/complete',
            planDelete: 'DELETE /api/plans/:id',
            planUrge: 'POST /api/plans/:id/urge',
            checkin: 'POST /api/checkin',
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