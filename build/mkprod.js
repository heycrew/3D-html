/* =====================================================================
 * mkprod.js —— 用真实的 buildHtml() 生成一份产物样本，供端到端验证
 *
 * 好处：验证的是「真正会被导出的那份页面」，而不是我另抄一遍的测试页。
 * 用法：node build/mkprod.js <输出目录>
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] || 'build/.verify/bookprod';
const JS_DIR = path.join(__dirname, 'js');

/* ---------- 最小 SD 环境 ---------- */
global.window = {};
global.SD = {
  Codegen: {
    esc: function (s) {
      return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
    safeJson: function (o) { return JSON.stringify(o); },
    fileWarn: function () { return '<div id="fileWarn" style="display:none"></div>'; }
  },
  Book: {
    lotHasMedia: function () { return true; },     /* 让锚点可点，便于测 360 */
    lotTitle: function () { return '测试拍品'; },
    book: function () { return {}; }
  },
  Bogu: {
    onItems: function (lot) { return (lot && lot.items) || []; },
    lotImages: function (lot, i) {
      /* 用真实存在的图片，方便直接跑 */
      return { x: ['images/lot-1/frame-1.png', 'images/lot-1/frame-2.png'], y: [] };
    }
  }
};

require(path.join(JS_DIR, '12-bookpage.js'));

const state = {
  pageType: 'book',
  title: '效果验证',
  templateId: 'bare',
  customCss: '',
  params: {
    bookW: 900, bookH: 1200, bookTurn: 700, bookSlices: 90, bookBend: 1.57,
    bookShade: .55, bookCamDist: 3, bookBackTone: '#f3efe6', boguMask2: .72,
    bookSkew: 2.6, bookSkewY: .16, bookShowNav: true,
    draggable: true, autoplay: false
  },
  book: {
    cover: { url: 'book/cover.png', name: 'cover.png' },
    back: { url: 'book/back.png', name: 'back.png' },
    pages: [
      { url: 'book/page-1.png', name: 'page-1.png',
        anchors: [{ id: 'a1', x: 45, y: 42, lotId: 'lot-1' }] },
      { url: 'book/page-2.png', name: 'page-2.png', anchors: [] }
    ]
  },
  lots: [{ id: 'lot-1', title: '测试拍品', code: 'LOT 1', items: [] }],
  materials: { items: [] }
};

const html = SD.BookPage.buildHtml(state, { mode: 'files' });

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html, 'utf-8');

/* 放一张测试图当书页，并把 lib 链过去 */
function writeGrid(file, w, h) {
  const { createCanvas } = (function () {
    try { return require('canvas'); } catch (e) { return {}; }
  })();
  /* 没有 canvas 模块就退化成一张纯色 PPM→ 不行；用现成的 PNG 更稳 */
  return false;
}

console.log('已生成产物: ' + path.join(OUT, 'index.html'));
console.log('html 长度: ' + html.length);
