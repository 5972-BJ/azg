const API_BASE_URL = (process.env.AI_BASE_URL || '').replace(/\/$/, '');
const API_KEY = process.env.AI_API_KEY || '';
const MODEL = process.env.AI_MODEL || '';

function isConfigured() {
    return Boolean(API_BASE_URL && API_KEY && MODEL);
}

async function askModel(messages, temperature = 0.2) {
    if (!isConfigured()) {
        const error = new Error('尚未配置 AI 模型，请在 .env 中设置 AI_BASE_URL、AI_API_KEY 和 AI_MODEL');
        error.status = 503;
        throw error;
    }

    const response = await fetch(`${API_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model: MODEL, messages, temperature })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(result.error?.message || `AI 服务请求失败（${response.status}）`);
        error.status = 502;
        throw error;
    }

    const content = result.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
        const error = new Error('AI 服务没有返回可用内容');
        error.status = 502;
        throw error;
    }
    return content.trim();
}

function parseJson(text) {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try {
        return JSON.parse(cleaned);
    } catch {
        const error = new Error('AI 返回的数据格式不正确，请重试');
        error.status = 502;
        throw error;
    }
}

async function analyzeImage(imageData, mimeType) {
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(imageData || '')) {
        const error = new Error('请上传 PNG、JPG 或 WebP 格式的图片');
        error.status = 400;
        throw error;
    }

    const extracted = await askModel([
        {
            role: 'system',
            content: '你是学习题目提取 Agent。准确读取图片中的题目、选项、已知条件和学生手写答案。保留公式与题目原意；看不清处标记为[无法辨认]，不要猜答案。只返回 JSON：{"question":"题目全文","studentAnswer":"学生答案或空字符串","subject":"学科","notes":"识别不确定处"}。'
        },
        {
            role: 'user',
            content: [
                { type: 'text', text: `请提取这张题目图片中的内容。图片类型：${mimeType}` },
                { type: 'image_url', image_url: { url: imageData, detail: 'high' } }
            ]
        }
    ]);
    const extraction = parseJson(extracted);
    if (!extraction.question) {
        const error = new Error('没有从图片中识别到题目，请换一张更清晰的图片');
        error.status = 422;
        throw error;
    }

    const analyzed = await askModel([
        {
            role: 'system',
            content: '你是严谨、善于启发的学习分析 Agent。分析题目，不直接堆砌结论；若有学生答案，判断正误并分析错因。只返回 JSON：{"summary":"一句话概括","concepts":[{"name":"知识点","description":"简述"}],"steps":[{"title":"步骤","detail":"推理过程"}],"answer":"最终答案","isCorrect":true,"mistakes":["可能的错因或常见陷阱"],"practice":"一道简短的迁移练习题"}。没有学生答案时 isCorrect 设为 null、mistakes 设为空数组。'
        },
        { role: 'user', content: JSON.stringify(extraction) }
    ]);

    return { extraction, analysis: parseJson(analyzed) };
}

async function tutorReply(context, question) {
    return askModel([
        {
            role: 'system',
            content: '你是耐心的 AI 学习导师。围绕学生上传的这道题和已完成的知识分析回答。先回应学生当前问题，再用清晰的小步骤解释；不要编造题目中没有的信息。若学生只发来题目，鼓励其先尝试关键一步。'
        },
        {
            role: 'user',
            content: `题目与分析上下文：\n${JSON.stringify(context)}\n\n学生问题：${question}`
        }
    ], 0.5);
}

module.exports = { analyzeImage, isConfigured, MODEL, tutorReply };