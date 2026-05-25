import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ========== 获取当前文件所在目录（用于定位 data 文件夹）==========
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========== 读取信件数据 ==========
function loadLettersData() {
    // 从 api 目录向上到根目录，再进入 data 文件夹
    const filePath = path.join(__dirname, '..', 'data', 'letters.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    return data.letters || [];
}

// ========== 双重验证密码 ==========
const STEP1_SECRETS = ["启明星", "OpenSesame", "芝兰"];
const STEP2_SECRETS = ["月光码头", "2026@Gate", "玉树"];

// ========== 错误限制配置 ==========
const MAX_FAIL_ATTEMPTS = 5;
const LOCK_DURATION = 15 * 60 * 1000; // 15分钟
const failRecords = new Map(); // IP -> { count, lockUntil }

// ========== 访问统计（内存计数，重启归零） ==========
let visitCount = 0;

// ========== 邮件配置（从环境变量读取） ==========
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const TO_EMAIL = process.env.TO_EMAIL;

let transporter = null;
if (SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
        host: "smtp.qq.com",
        port: 465,
        secure: true,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
}

// ========== 辅助函数 ==========
function getClientIp(req) {
    return req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
}

function isLocked(ip) {
    const record = failRecords.get(ip);
    if (record && record.lockUntil && record.lockUntil > Date.now()) {
        return { locked: true, remaining: Math.ceil((record.lockUntil - Date.now()) / 60000) };
    }
    return { locked: false };
}

function recordFailure(ip) {
    const now = Date.now();
    let record = failRecords.get(ip);
    if (!record) {
        record = { count: 1, lockUntil: null };
    } else {
        if (record.lockUntil && record.lockUntil < now) {
            record = { count: 1, lockUntil: null };
        } else {
            record.count++;
            if (record.count >= MAX_FAIL_ATTEMPTS && !record.lockUntil) {
                record.lockUntil = now + LOCK_DURATION;
            }
        }
    }
    failRecords.set(ip, record);
    return record;
}

function clearFailures(ip) {
    failRecords.delete(ip);
}

async function sendFeedbackEmail(name, email, message) {
    if (!transporter) return false;
    try {
        await transporter.sendMail({
            from: `"网站留言" <${SMTP_USER}>`,
            to: TO_EMAIL,
            subject: `来自 ${name} 的新留言`,
            text: `称呼：${name}\n邮箱：${email}\n留言：\n${message}`,
            html: `<p>称呼：${name}</p><p>邮箱：${email}</p><p>留言：</p><p>${message.replace(/\n/g, '<br>')}</p>`
        });
        return true;
    } catch (e) {
        console.error("邮件发送失败:", e);
        return false;
    }
}

function incrementVisitCount() {
    visitCount++;
    return visitCount;
}

// ========== Vercel 函数入口 ==========
export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // GET /api/stats 返回访问统计
    if (req.method === 'GET') {
        if (req.url === '/api/stats') {
            return res.status(200).json({ visits: visitCount });
        }
        return res.status(200).json({ message: "API is running" });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: '方法不允许' });
    }

    const body = req.body;
    const ip = getClientIp(req);

    // 处理留言提交
    if (body.message !== undefined && body.name && body.email) {
        const { name, email, message } = body;
        const success = await sendFeedbackEmail(name, email, message);
        if (success) {
            return res.status(200).json({ success: true, message: '留言已寄出' });
        } else {
            return res.status(500).json({ success: false, error: '邮件服务异常' });
        }
    }

    // 处理双重验证
    const { step1, step2, letterIndex = 0 } = body;

    // 检查锁定
    const lock = isLocked(ip);
    if (lock.locked) {
        return res.status(429).json({ success: false, error: `尝试次数过多，请 ${lock.remaining} 分钟后再试`, locked: true });
    }

    if (!step1 || !step2) {
        return res.status(400).json({ success: false, error: '请提供完整的验证信息' });
    }

    const isStep1Valid = STEP1_SECRETS.includes(step1);
    const isStep2Valid = STEP2_SECRETS.includes(step2);

    if (!isStep1Valid || !isStep2Valid) {
        const record = recordFailure(ip);
        const remainingAttempts = MAX_FAIL_ATTEMPTS - record.count;
        if (record.lockUntil) {
            return res.status(429).json({ success: false, error: '密码错误次数过多，已锁定15分钟', locked: true });
        }
        return res.status(401).json({ success: false, error: `密令错误`, remainingAttempts: Math.max(0, remainingAttempts) });
    }

    // 验证成功，清除失败记录
    clearFailures(ip);

    // 增加访问计数
    const totalVisits = incrementVisitCount();

    // 读取信件数据
    let letters = [];
    try {
        letters = loadLettersData();
    } catch (err) {
        console.error('读取信件失败', err);
        return res.status(500).json({ success: false, error: '信件数据读取失败' });
    }

    const idx = Math.min(Math.max(0, letterIndex), letters.length - 1);
    const letter = letters[idx];
    const dateStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

    return res.status(200).json({
        success: true,
        content: letter.content,
        title: letter.title,
        date: dateStr,
        visits: totalVisits,
        totalLetters: letters.length
    });
}

export const config = {
    runtime: 'nodejs',
};
