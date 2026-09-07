// Node 版构建脚本（本机无可用 Python，逻辑与 _build.py 一致）
// 用法: node _build.cjs
const fs = require('fs');
const path = require('path');

const base = __dirname;
const tmpDir = path.join(base, '_bank_tmp');

// _bank_tmp/*.py 里的题库都是 JSON 兼容的字面量，剥掉整行 # 注释与变量赋值头即可解析
function loadBank(file, varName) {
  const src = fs.readFileSync(path.join(tmpDir, file), 'utf8')
    .split('\n')
    .filter(l => !l.trim().startsWith('#'))
    .join('\n');
  const s = src.indexOf(varName + ' = [');
  if (s === -1) throw new Error(`${file}: 找不到 ${varName}`);
  const arr = src.slice(s + varName.length + 3, src.lastIndexOf(']') + 1)
    .replace(/,(\s*])/g, '$1');  // Python 允许尾随逗号，JSON 不允许
  const list = JSON.parse(arr);
  if (!Array.isArray(list)) throw new Error(`${file}: ${varName} 不是数组`);
  return list;
}

const singles = [
  ...loadBank('s_a.py', 'singles_a'),
  ...loadBank('s_b.py', 'singles_b'),
  ...loadBank('s_c.py', 'singles_c'),
  ...loadBank('s_d.py', 'singles_d'),
];
const multis = [
  ...loadBank('m.py', 'multis'),
  ...loadBank('m2.py', 'multis_b'),
];

// ---- validation ----
const errors = [];
singles.forEach((q, i) => {
  if (!q.o || q.o.length < 2) errors.push(`singles[${i}] 选项不足: ${q.q}`);
  if (!(q.a >= 0 && q.a < q.o.length)) errors.push(`singles[${i}] 答案下标越界 ${q.a}/${q.o.length}: ${q.q}`);
});
multis.forEach((q, i) => {
  if (!q.o || q.o.length < 2) errors.push(`multis[${i}] 选项不足: ${q.q}`);
  if (!Array.isArray(q.a) || q.a.length < 1) errors.push(`multis[${i}] 答案缺失: ${q.q}`);
  else q.a.forEach(a => {
    if (!(a >= 0 && a < q.o.length)) errors.push(`multis[${i}] 答案下标越界 ${a}: ${q.q}`);
  });
});

// ---- 重复题检测（仅告警）----
const seen = new Map();
[...singles, ...multis].forEach(q => {
  if (seen.has(q.q)) seen.get(q.q).push(q.q);
  else seen.set(q.q, []);
});
const dups = [...seen.entries()].filter(([, v]) => v.length > 0).map(([k]) => k);
if (dups.length) {
  console.log('重复题干 ' + dups.length + ' 处:');
  dups.forEach(d => console.log(' -', d));
}

if (errors.length) {
  console.log('VALIDATION ERRORS:');
  errors.forEach(e => console.log(' -', e));
  process.exit(1);
}
console.log(`OK singles=${singles.length} multis=${multis.length}`);

// ---- 从上一版 questions.json 按题干回填 e（书本原文解析）----
const eLookup = new Map();
try {
  const prev = JSON.parse(fs.readFileSync(path.join(base, 'questions.json'), 'utf8'));
  [...(prev.singles || []), ...(prev.multis || [])].forEach(q => eLookup.set(q.q, q.e || ''));
} catch (err) {
  console.log('warn: 无法读取旧 questions.json 回填 e:', err.message);
}
let missingE = 0;
[...singles, ...multis].forEach(q => {
  if (!('e' in q)) {
    const e = eLookup.get(q.q) || '';
    q.e = e;
    if (!e) missingE++;
  }
});
console.log('e 回填: ' + missingE + ' 题没有原文解析');

const bank = { singles, multis };
const jsonStr = JSON.stringify(bank);

fs.writeFileSync(path.join(base, 'questions.json'), jsonStr, 'utf8');
console.log('questions.json 已写入: ' + jsonStr.length + ' 字符');

// ---- 替换 index.html 中的 QB 块，并同步顶部统计数字 ----
const htmlPath = path.join(base, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf('var QB = {');
const endMarker = ';var curQ=null';
const end = html.indexOf(endMarker, start);
if (start === -1 || end === -1) throw new Error('index.html 中找不到 QB 块');
html = html.slice(0, start) + 'var QB = ' + jsonStr + endMarker + html.slice(end + endMarker.length);

html = html
  .replace(/覆盖[^|<]*\| 每次抽60题/, '覆盖第三、四章全部内容 | 每次抽60题')
  .replace(/📝 单选\d+题/, `📝 单选${singles.length}题`)
  .replace(/📋 多选\d+题/, `📋 多选${multis.length}题`);

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('index.html 已更新, size: ' + html.length);
