// check-www.mjs — автономность бандла: рекурсивно ищем внешние URL в html/css/js.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = [join(ROOT, 'site'), join(ROOT, 'android', 'assets', 'www')];

function walk(dir, out) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const f of entries) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(html|css|js|mjs)$/.test(f)) out.push(p);
  }
}

let bad = 0, files = 0;
for (const dir of DIRS) {
  const list = [];
  walk(dir, list);
  if (!list.length) { console.log(`— ${dir}: нет (ок, пропускаю)`); continue; }
  for (const p of list) {
    files++;
    const text = readFileSync(p, 'utf8');
    const re = /(?:src|href)\s*=\s*["']https?:\/\/|https?:\/\/(?!schemas\.android|www\.w3)/g;
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (re.test(line)) {
        if (line.includes('schemas.android') || line.includes('www.w3.org')) return;
        console.log(`!! ${p}:${i + 1}: ${line.trim().slice(0, 100)}`);
        bad++;
      }
      re.lastIndex = 0;
    });
  }
}
console.log(`Проверено файлов: ${files}`);
if (bad) { console.error(`ОШИБКА: ${bad} внешних ссылок`); process.exit(1); }
console.log('OK: внешних ссылок нет — бандл автономен');
