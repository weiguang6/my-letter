// ========== Vercel Serverless Function ==========
// 信件内容存储在这里，不会暴露给前端

const STEP1_SECRETS = ["启明星", "OpenSesame", "芝兰"];
const STEP2_SECRETS = ["月光码头", "2026@Gate", "玉树"];

// ========== 信件内容（在这里修改您的信件） ==========
const LETTER_CONTENT = `
    <p>见信如晤。</p>
    <p>当你看到这封信时，说明你已经通过了双重验证，并且这些文字是从服务器端安全加载的。查看网页源代码只能看到加载逻辑，看不到信件原文。</p>
    <p>写这封信时，窗外石榴花开得正盛，晚风穿过回廊，带来草木的清气。我想把这种宁静的片刻分享给你——在这个信息纷杂的时代，还能静心解锁一封远方的信，已是难得。</p>
    <p>随信附上一段话：<strong>"山有峰顶，海有彼岸。漫漫长途，终有回转。余味苦涩，终有回甘。"</strong> 愿你在生活的旅途中，也能穿越一道道关卡，抵达属于自己的丰饶之地。</p>
    <div class="signature" style="text-align:right; margin-top:24px; font-style:italic;">
        守秘人<br>
        于 双锁书斋
    </div>
`;

function getCurrentDate() {
    const now = new Date();
    return `${now.getFullYear()}年 · ${now.getMonth() + 1}月${now.getDate()}日`;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: '方法不允许' });
    }
    
    const { step1, step2 } = req.body;
    
    if (!step1 || !step2) {
        return res.status(400).json({ success: false, error: '请提供完整的验证信息' });
    }
    
    const isStep1Valid = STEP1_SECRETS.includes(step1);
    const isStep2Valid = STEP2_SECRETS.includes(step2);
    
    if (!isStep1Valid || !isStep2Valid) {
        return res.status(401).json({ success: false, error: '密令错误，无法获取信件' });
    }
    
    return res.status(200).json({
        success: true,
        content: LETTER_CONTENT,
        date: getCurrentDate()
    });
}