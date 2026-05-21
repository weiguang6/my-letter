const express = require('express');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ 从环境变量读取答案（不在代码里）
const ANSWER_1 = process.env.Q1;
const ANSWER_2 = process.env.Q2;

const LETTER = `
亲爱的：

当你看到这封信时，
说明你还记得那个“欧舒丹”的瞬间。

有些记忆，只属于我们两个人。
谢谢你来过我的世界。

—— 2026
`;

app.post('/api/unlock', (req, res) => {
  const { a1, a2 } = req.body;

  if (a1 !== ANSWER_1 || a2 !== ANSWER_2) {
    return res.json({ ok: false });
  }

  res.json({
    ok: true,
    content: LETTER
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});