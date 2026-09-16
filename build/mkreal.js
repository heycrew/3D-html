/* 用真实素材生成一份产物（供对比验证） */
'use strict';
const fs = require('fs'), path = require('path');
const OUT = process.argv[2];
const SRC = process.argv[3];          // 用户产物目录，复用其 book/ images/
const BOOKW = parseInt(process.argv[4] || '900', 10);
const BOOKH = parseInt(process.argv[5] || '1200', 10);

global.window = {};
global.SD = {
  Codegen: {
    esc: s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
             .replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
    safeJson: o => JSON.stringify(o),
    fileWarn: () => '<div id="fileWarn" style="display:none"></div>'
  },
  Book: { lotHasMedia: () => true, lotTitle: () => '', book: () => ({}) },
  Bogu: { onItems: lot => (lot && lot.items) || [],
          lotImages: (lot, i) => ({ x: (lot.items||[]).map(it => it.src), y: [] }) }
};
require(path.join(__dirname, 'js/12-bookpage.js'));

/* 扫一遍用户目录里的图片 */
function ls(d) { try { return fs.readdirSync(d); } catch (e) { return []; } }
const bookDir = path.join(SRC, 'book');
const imgDir = path.join(SRC, 'images');
const cover = ls(bookDir).find(f => /^cover\./i.test(f));
const back  = ls(bookDir).find(f => /^back\./i.test(f));
const pages = ls(bookDir).filter(f => /^page-[0-9]+\.(jpe?g|png|webp|gif)$/i.test(f)).sort();

const lots = ls(imgDir).filter(f => /^lot-/i.test(f)).sort().map((d, i) => {
  const files = ls(path.join(imgDir, d)).sort();
  return {
    id: 'lot-' + (i + 1),
    title: '拍品 ' + (i + 1),
    code: 'LOT ' + (i + 1),
    items: files.map((f, j) => ({
      src: 'images/' + d + '/' + f,
      name: f, w: 1000, h: 1000,
      axis: j < Math.max(1, files.length - 2) ? 'x' : 'y',   /* 末两张当垂直帧 */
      off: false
    }))
  };
});

const state = {
  pageType: 'book', title: '电子图录', templateId: 'bare', customCss: '',
  params: {
    bookW: BOOKW, bookH: BOOKH,
    bookTurn: 700, bookSlices: 90, bookBend: 1.57, bookShade: .55,
    bookCamDist: 3, bookBackTone: '#f3efe6', boguMask2: .72,
    bookSkew: 2.6, bookSkewY: .16, bookShowNav: true,
    draggable: true, autoplay: false
  },
  book: {
    cover: cover ? { url: 'book/' + cover, name: cover } : null,
    back: back ? { url: 'book/' + back, name: back } : null,
    pages: pages.map((f, i) => {
      const pdir = ls(path.join(bookDir, 'page-' + (i + 1)))
        .filter(g => /\.(jpe?g|png|webp)$/i.test(g)).sort();
      return {
        url: 'book/' + f, name: f,
        items: pdir.map(g => ({ name: g, w: 1000, h: 1000 })),
        anchors: i === 0 && lots.length
          ? [{ id: 'a1', x: 50, y: 50, lotId: lots[0].id }] : []
      };
    })
  },
  lots: lots,
  materials: { items: [] }
};

const html = SD.BookPage.buildHtml(state, { mode: 'files' });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html, 'utf-8');
console.log('已生成: ' + path.join(OUT, 'index.html'));
console.log('  书页: ' + (cover ? 1 : 0) + ' 封面 + ' + pages.length + ' 内容页 + ' + (back ? 1 : 0) + ' 封底');
console.log('  拍品: ' + lots.length + ' 个（各 ' + (lots[0] ? lots[0].items.length : 0) + ' 张）');
console.log('  书尺寸: ' + BOOKW + 'x' + BOOKH);
