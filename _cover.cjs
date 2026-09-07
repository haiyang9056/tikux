/* 覆盖度分析：把每道题的 e（书本原文解析）映射回 docx_后两章.txt 的小节，统计各小节题量 */
const fs = require('fs');
const P = 'E:/Codex_CN/tk/';

const bank = JSON.parse(fs.readFileSync(P + 'questions.json', 'utf8'));
const raw = fs.readFileSync(P + 'docx_后两章.txt', 'utf8').split(/\r?\n/);

const norm = s => s.replace(/\s+/g, '').replace(/[，。、；：？！“”‘’（）()《》—\-·%％~～]/g, '');

// 段落（去掉 [n] 前缀）
const paras = raw.map(l => l.replace(/^\[\d+\]\s*/, '')).map((t, i) => ({ i: i + 1, t, n: norm(t) }));

// 小节边界（兼容 OCR 污染的前缀，如 "0.3.8 xxx"、"03.5 xxx"、"04.6 xxx"）
const secRe = /^\s*0*[.]?0*(\d)\.(\d+)\s/;
const secs = [];
paras.forEach(p => {
  const m = p.t.match(secRe);
  if (m) secs.push({ id: m[1] + '.' + m[2], line: p.i, title: p.t.slice(0, 40) });
});
function secOf(line) {
  let cur = '(前言)';
  for (const s of secs) { if (s.line <= line) cur = s.id; else break; }
  return cur;
}

// 对每题：在原文中找与 e 重叠度最高的段落
function locate(e) {
  if (!e) return null;
  // 用 e 中较长的连续片段去原文找
  const en = norm(e.replace(/【[^】]*】/g, ''));
  if (en.length < 8) return null;
  let best = null;
  for (const p of paras) {
    if (p.n.length < 8) continue;
    // 滑动窗口：取 e 的若干 12 字片段看是否被原文包含
    let hit = 0;
    for (let k = 0; k + 12 <= en.length; k += 6) {
      if (p.n.includes(en.slice(k, k + 12))) hit++;
    }
    if (hit > 0 && (!best || hit > best.hit)) best = { line: p.i, hit, sec: secOf(p.i) };
  }
  return best;
}

const bySec = {};
secs.forEach(s => { bySec[s.id] = { title: s.title, s: 0, m: 0, total: 0, unloc: 0 }; });
bySec['(前言)'] = { title: '章前引言', s: 0, m: 0, total: 0, unloc: 0 };
bySec['(未定位)'] = { title: '解析无法定位到原文', s: 0, m: 0, total: 0, unloc: 0 };

const unlocated = [];
for (const key of ['singles', 'multis']) {
  bank[key].forEach((q, qi) => {
    const loc = locate(q.e);
    const sec = loc ? loc.sec : '(未定位)';
    if (!bySec[sec]) bySec[sec] = { title: sec, s: 0, m: 0, total: 0, unloc: 0 };
    if (key === 'singles') bySec[sec].s++; else bySec[sec].m++;
    bySec[sec].total++;
    if (!loc) unlocated.push((key === 'singles' ? 'S' : 'M') + qi + ' ' + q.q.slice(0, 32));
  });
}

const order = ['(前言)', ...secs.map(s => s.id), '(未定位)'];
console.log('小节\t单选\t多选\t合计\t标题');
let ts = 0, tm = 0;
order.forEach(id => {
  const v = bySec[id]; if (!v) return;
  ts += v.s; tm += v.m;
  console.log(`${id}\t${v.s}\t${v.m}\t${v.total}\t${v.title}`);
});
console.log(`合计\t${ts}\t${tm}\t${ts + tm}`);
console.log('\n--- 未能定位到原文的题目 (' + unlocated.length + ') ---');
unlocated.forEach(x => console.log(x));
console.log('\n--- 各小节原文字数 ---');
secs.forEach((s, idx) => {
  const end = idx + 1 < secs.length ? secs[idx + 1].line : paras.length + 1;
  let chars = 0;
  for (let l = s.line; l < end; l++) { const p = paras[l - 1]; if (p) chars += p.n.length; }
  console.log(`${s.id}\t行${s.line}-${end - 1}\t${chars}字\t${s.title}`);
});
