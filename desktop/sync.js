/* =====================================================================
 * sync.js —— 把工作台的发布文件同步到 desktop/app/
 *
 * 桌面应用只服务 app/ 里的东西：studio.html + lib/（含 360 库、翻页库、音效）
 * 以及导出时要用的 serve.ps1 / 使用说明.txt。
 *
 * 为什么要这一步：electron-builder 不允许把「上级目录」打进去，
 * 所以先把发布文件拷到 app/ 再打包。改完工作台后重新跑一次即可：
 *   npm run sync
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..');
const DST = path.join(__dirname, 'app');
const FILES = ['studio.html', 'serve.ps1', '使用说明.txt'];
const DIRS = ['lib'];

function cp(from, to) {
  const st = fs.statSync(from);
  if (st.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) cp(path.join(from, name), path.join(to, name));
  } else {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}

fs.rmSync(DST, { recursive: true, force: true });
let n = 0;
for (const f of FILES) {
  const s = path.join(SRC, f);
  if (fs.existsSync(s)) { cp(s, path.join(DST, f)); n++; }
  else console.warn('  跳过（源文件不存在）：' + f);
}
for (const d of DIRS) {
  const s = path.join(SRC, d);
  if (fs.existsSync(s)) cp(s, path.join(DST, d));
  else console.warn('  跳过（源目录不存在）：' + d);
}
console.log('  已同步到 desktop/app/：' + fs.readdirSync(DST).join('  '));
console.log('  提示：先在项目根跑 python3 build/build.py 生成最新 studio.html，再跑本脚本。');
