/* =====================================================================
 * check.js —— 构建期语法自检
 *
 * 背景：12-bookpage.js 的 buildInit() 返回的是一大串
 * "拼出来的 JS 源码"。这类代码写错（漏逗号、多一个花括号）时，构建
 * 本身不会报错 —— 要等真正导出、浏览器执行时才炸，而且症状是
 * "图不显示 / 按钮没反应"，很难定位。
 *
 * 这个脚本把 buildInit 的输出拼成一份完整脚本，交给 node --check 校验，
 * 在构建阶段就拦下来。
 *
 * 用法：node build/check.js
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const JS_DIR = path.join(__dirname, 'js');
const TMP = path.join(__dirname, '.syntax-check');

/* ---------- 最小 SD 环境 ---------- */
global.window = {};
global.SD = {
  Codegen: {
    esc: function (s) { return String(s == null ? '' : s); },
    safeJson: function (o) { return JSON.stringify(o); },
    fileWarn: function () { return '<div id="fileWarn"></div>'; }
  },
  Book: {
    book: function () { return {}; }
  }
};

/* ---------- 造一份有代表性的 state ---------- */
function mkState() {
  const mkItem = (n, w, h) => ({ name: n, url: 'u/' + n, w: w, h: h, off: false, axis: 'x' });
  return {
    pageType: 'book',
    title: '测试',
    templateId: 'bare',
    customCss: '',
    params: {
      bookW: 900, bookH: 1200, bookTurn: 700, bookSlices: 90, bookBend: 1.57,
      bookShade: .55, bookCamDist: 3, bookBackTone: '#f3efe6', boguMask2: .72,
      autoplay: false, draggable: true
    },
    book: {
      cover: { url: 'u/cover.png', name: 'cover.png' },
      back: { url: 'u/back.png', name: 'back.png' },
      pages: [
        { url: 'u/page-1.png', name: 'page-1.png' },
        { url: 'u/page-2.png', name: 'page-2.png' }
      ]
    },
    materials: { items: [mkItem('f1.png', 1000, 1000)] }
  };
}

/* ---------- 跑起来 ---------- */
const targets = [
  { file: '12-bookpage.js', key: 'BookPage', type: 'book' }
];

let failed = 0;

try { fs.mkdirSync(TMP, { recursive: true }); } catch (e) {}

targets.forEach(function (t) {
  const abs = path.join(JS_DIR, t.file);
  if (!fs.existsSync(abs)) { console.log('  跳过（不存在）: ' + t.file); return; }

  /* 每次重新加载，避免相互污染 */
  delete require.cache[require.resolve(abs)];
  try { require(abs); } catch (e) {
    console.log('  ✗ ' + t.file + ' 加载失败: ' + e.message);
    failed++; return;
  }

  const mod = SD[t.key];
  if (!mod || typeof mod.buildInit !== 'function') {
    console.log('  ✗ ' + t.file + ' 未导出 buildInit');
    failed++; return;
  }

  const state = mkState();
  state.pageType = t.type;

  ['files', 'preview'].forEach(function (mode) {
    let code;
    try {
      code = mod.buildInit(state, mode);
    } catch (e) {
      console.log('  ✗ ' + t.file + ' [' + mode + '] buildInit 抛错: ' + e.message);
      failed++; return;
    }
    const out = path.join(TMP, t.file.replace(/\.js$/, '') + '.' + mode + '.js');
    fs.writeFileSync(out, '(function () {\n' + code + '\n})();\n', 'utf-8');
    console.log('  · 生成 ' + path.relative(path.join(__dirname, '..'), out));
  });
});

if (!failed) {
  /* 交给 node --check 逐个校验（由 build.py 调用） */
  console.log('  ✓ 已生成待校验脚本');
}
process.exit(failed ? 1 : 0);
