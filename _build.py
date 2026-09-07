# -*- coding: utf-8 -*-
import io, json, sys, os, re

base = os.path.dirname(os.path.abspath(__file__))
tmp = os.path.join(base, '_bank_tmp')
sys.path.insert(0, tmp)

import s_a, s_b, s_c, s_d, m, m2

singles = s_a.singles_a + s_b.singles_b + s_c.singles_c + s_d.singles_d
multis = m.multis + m2.multis_b

# ---- validation ----
errors = []
for i, q in enumerate(singles):
    if not (0 <= q['a'] < len(q['o'])):
        errors.append(f"singles[{i}] bad answer index {q['a']} for {len(q['o'])} options: {q['q'][:30]}")
    if len(q['o']) < 2:
        errors.append(f"singles[{i}] too few options: {q['q'][:30]}")
for i, q in enumerate(multis):
    for a in q['a']:
        if not (0 <= a < len(q['o'])):
            errors.append(f"multis[{i}] bad answer index {a}: {q['q'][:30]}")

if errors:
    print("VALIDATION ERRORS:")
    for e in errors:
        print(" -", e)
    sys.exit(1)

print(f"OK singles={len(singles)} multis={len(multis)}")

# ---- carry over 'e'（书本原文解析）from previous questions.json by question text ----
e_lookup = {}
try:
    with io.open(os.path.join(base, 'questions.json'), encoding='utf-8') as fh:
        prev = json.load(fh)
    for q in prev.get('singles', []) + prev.get('multis', []):
        e_lookup[q['q']] = q.get('e', '')
except Exception as exc:
    print("warn: cannot load previous questions.json for e carry-over:", exc)
missing_e = 0
for q in singles + multis:
    if 'e' not in q:
        e = e_lookup.get(q['q'])
        q['e'] = e if e else ''
        if not e:
            missing_e += 1
print("e carry-over: no source explanation for", missing_e, "questions")

bank = {"singles": singles, "multis": multis}
json_str = json.dumps(bank, ensure_ascii=False, separators=(',', ':'))

# ---- write questions.json ----
with io.open(os.path.join(base, 'questions.json'), 'w', encoding='utf-8') as fh:
    fh.write(json_str)
print("questions.json written:", len(json_str), "chars")

# ---- replace QB block in index.html (index2.html 已弃用，不再更新) ----
for fn in ['index.html']:
    path = os.path.join(base, fn)
    with io.open(path, encoding='utf-8') as fh:
        html = fh.read()
    start = html.index('var QB = {')
    end_marker = ';var curQ=null'
    end = html.index(end_marker, start)
    new_html = html[:start] + 'var QB = ' + json_str + end_marker + html[end + len(end_marker):]

    # 同步顶部统计数字，避免题库变化后页面上的数字过期
    new_html = re.sub(r'覆盖[^|<]*\| 每次抽60题', '覆盖第三、四章全部内容 | 每次抽60题', new_html)
    new_html = re.sub(r'📝 单选\d+题', '📝 单选%d题' % len(singles), new_html)
    new_html = re.sub(r'📋 多选\d+题', '📋 多选%d题' % len(multis), new_html)

    with io.open(path, 'w', encoding='utf-8') as fh:
        fh.write(new_html)
    print(fn, "updated, size:", len(new_html))
