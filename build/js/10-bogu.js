/* =====================================================================
 * 10-bogu.js —— 拍品列表（博古架）页面生成
 *
 * 关键设计：列表页只渲染封面 <img>，点某一格才创建那个拍品的 360 实例，
 * 关闭时销毁 —— 所以同时最多只有 1 个 viewer，20 个拍品也不卡。
 * 布局用 CSS Grid + 跨度表做「错落」感，避免手工 SVG。
 * ===================================================================== */
window.SD = window.SD || {};

SD.Bogu = (function () {

  var LAYOUTS = {
    cuoluo: {
      name: '错落', cols: 6, rowH: 88, gap: 14,
      spans: [[2, 2], [1, 1], [1, 1], [2, 1], [1, 2], [1, 1], [2, 1], [1, 2], [1, 1], [1, 1]]
    },
    jiugong: {
      name: '九宫', cols: 3, rowH: 150, gap: 16, spans: [[1, 1]]
    },
    pinzi: {
      name: '品字', cols: 5, rowH: 108, gap: 14,
      spans: [[2, 2], [1, 1], [1, 1], [1, 1], [2, 2], [1, 1]]
    }
  };

  var THEMES = {
    dark: {
      frame: 'linear-gradient(160deg,#6b4a2f 0%,#4a3220 55%,#3a2718 100%)',
      inner: '#241811', cap: '#f0e2cf', sub: '#bda98d'
    },
    warm: {
      frame: 'linear-gradient(160deg,#d8b483 0%,#b8905c 55%,#9a7444 100%)',
      inner: '#6d4f2c', cap: '#3a2a18', sub: '#6b5334'
    },
    black: {
      frame: 'linear-gradient(160deg,#3d3d40 0%,#242427 55%,#161618 100%)',
      inner: '#0e0e10', cap: '#e6e6ea', sub: '#9a9aa2'
    }
  };

  function layoutOf(p) { return LAYOUTS[p.boguLayout] || LAYOUTS.cuoluo; }
  function themeOf(p) { return THEMES[p.boguTheme] || THEMES.dark; }
  function onItems(lot) {
    return ((lot && lot.items) || []).filter(function (x) { return !x.off; });
  }
  function coverOf(lot) { return onItems(lot)[0] || null; }

  /* ---------- 每个拍品的图片地址 ---------- */
  /* mode='files'   → images/lot-N/frame-1.jpg（导出）
     mode='preview' → 上传后的 /@mat/... 真实 URL（工作台预览） */
  /* 导出文件名：frame-1.jpg / vframe-1.jpg（垂直轴单独计数）。
     注意：在「生成页面时」现算，不依赖外部预先赋值 ——
     否则一旦调用顺序不对，页面里的路径就会变成 undefined。 */
  function gcdNum(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { var t = a % b; a = b; b = t; }
    return a || 1;
  }

  /* 素材宽高比 → "1/1" / "4/3" 这样的字符串 */
  function ratioOf(it) {
    if (!it || !it.w || !it.h) return '';
    var g = gcdNum(it.w, it.h);
    return (it.w / g) + '/' + (it.h / g);
  }

  function extOfName(name) {
    var m = /\.([a-z0-9]+)$/i.exec(String(name || ''));
    return m ? '.' + m[1].toLowerCase() : '.jpg';
  }

  function lotImages(lot, idx, mode) {
    var items = onItems(lot);
    var xs = [], ys = [];
    var xi = 0, yi = 0;
    items.forEach(function (it) {
      var src;
      if (mode === 'preview') {
        src = it.url || '';
      } else if (it.axis === 'y') {
        yi++; src = 'images/lot-' + (idx + 1) + '/vframe-' + yi + extOfName(it.name);
      } else {
        xi++; src = 'images/lot-' + (idx + 1) + '/frame-' + xi + extOfName(it.name);
      }
      if (!src) return;
      (it.axis === 'y' ? ys : xs).push(src);
    });
    return { x: xs, y: ys };
  }

  /* ---------- 页面 CSS ---------- */
  function buildCss(state) {
    var p = state.params || {};
    var L = layoutOf(p), T = themeOf(p);
    var cols = p.boguCols || L.cols;
    var rowH = p.boguRowH || L.rowH;
    var gap = p.boguGap === undefined || p.boguGap === null ? L.gap : p.boguGap;

    return [
      'html,body{margin:0;padding:0;background:#f5f2ec;overflow-x:hidden;',
      '  font-family:-apple-system,"Microsoft YaHei","PingFang SC",sans-serif;}',
      '.bg-title{text-align:center;padding:34px 20px 4px;}',
      '.bg-title h1{margin:0;font-size:24px;letter-spacing:3px;color:#3a2f22;font-weight:600;}',
      '.bg-title p{margin:8px 0 0;color:#9a8d78;font-size:13px;letter-spacing:1px;}',
      '.bogu-wrap{max-width:1180px;margin:0 auto;padding:22px 22px 46px;}',
      '',
      '/* 架子本体：木色底 + 内凹阴影，营造「格子」立体感 */',
      '.bogu{',
      '  display:grid;',
      '  grid-template-columns:repeat(' + cols + ',1fr);',
      '  grid-auto-rows:' + rowH + 'px;',
      '  gap:' + gap + 'px;',
      '  padding:' + Math.round(gap * 1.25) + 'px;',
      '  background:' + T.frame + ';',
      '  border-radius:10px;',
      '  box-shadow:0 14px 40px rgba(40,26,14,.30), inset 0 0 0 1px rgba(255,255,255,.10);',
      '}',
      '.cell{',
      '  position:relative;overflow:hidden;cursor:pointer;border-radius:4px;',
      '  background:' + T.inner + ';',
      '  box-shadow:inset 0 3px 10px rgba(0,0,0,.55), 0 1px 0 rgba(255,255,255,.07);',
      '  transition:transform .18s ease, box-shadow .18s ease;',
      '}',
      '.cell:hover{transform:translateY(-3px);',
      '  box-shadow:inset 0 3px 10px rgba(0,0,0,.45), 0 10px 26px rgba(0,0,0,.35);}',
      '.cell img{width:100%;height:100%;object-fit:contain;display:block;padding:6px;',
      '  box-sizing:border-box;transition:transform .25s ease;}',
      '.cell:hover img{transform:scale(1.05);}',
      '.cell .empty{width:100%;height:100%;display:grid;place-items:center;',
      '  color:rgba(255,255,255,.28);font-size:12px;}',
      '.cell .cap{position:absolute;left:0;right:0;bottom:0;padding:16px 8px 7px;',
      '  background:linear-gradient(to top, rgba(0,0,0,.72), rgba(0,0,0,0));',
      '  pointer-events:none;}',
      '.cell .cap b{display:block;font-size:13px;font-weight:600;color:#fff;',
      '  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.cell .cap i{display:block;font-style:normal;font-size:11px;color:rgba(255,255,255,.72);',
      '  letter-spacing:.5px;}',
      '.cell .zoom{position:absolute;top:7px;right:7px;width:22px;height:22px;border-radius:50%;',
      '  background:rgba(0,0,0,.45);color:#fff;font-size:12px;display:grid;place-items:center;',
      '  opacity:0;transition:opacity .18s;pointer-events:none;}',
      '.cell:hover .zoom{opacity:1;}',
      '',
      '/* 点击后的遮罩 + 360 舞台 */',
      '.lot-modal{position:fixed;inset:0;z-index:9998;display:none;',
      '  background:rgba(0,0,0,' + (p.boguMask || .86) + ');',
      '  -webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);}',
      '.lot-modal.on{display:grid;place-items:center;animation:lotFade .2s ease;}',
      '@keyframes lotFade{from{opacity:0}to{opacity:1}}',
      '.lot-stage{width:min(92vw,1040px);height:min(82vh,780px);',
      '  display:grid;place-items:center;position:relative;}',
      '/* 只定高度、宽度交给 aspect-ratio 自适应；两个维度都定死会让 1:1 的 canvas 被拉伸 */',
      '.lot-stage .cloudimage-360{height:100%;width:auto;max-width:100%;}',
      '.lot-stage .lot-title{position:absolute;top:-6px;left:0;color:#fff;font-size:15px;',
      '  letter-spacing:2px;opacity:.9;pointer-events:none;}',
      '.lot-close{position:absolute;top:22px;right:26px;width:40px;height:40px;border:0;',
      '  border-radius:50%;background:rgba(255,255,255,.14);color:#fff;font-size:20px;',
      '  cursor:pointer;transition:background .15s;}',
      '.lot-close:hover{background:rgba(255,255,255,.28);}',
      '.lot-hint{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);',
      '  color:rgba(255,255,255,.6);font-size:12px;letter-spacing:1px;white-space:nowrap;}',
      '',
      '@media (max-width:820px){',
      '  .bogu{grid-template-columns:repeat(3,1fr) !important;grid-auto-rows:110px;}',
      '  .cell{grid-column:span 1 !important;grid-row:span 1 !important;}',
      '  .bg-title h1{font-size:19px;}',
      '  .lot-stage{width:96vw;height:70vh;}',
      '}'
    ].join('\n');
  }

  /* ---------- 页面主体 ---------- */
  function buildBody(state, mode) {
    var p = state.params || {};
    var L = layoutOf(p);
    var lots = state.lots || [];
    var out = [];

    out.push('<div class="bogu-wrap">');
    out.push('  <div class="bg-title">');
    out.push('    <h1>' + SD.Codegen.esc(state.title || '拍品总览') + '</h1>');
    out.push('    <p>点击任意拍品可 360° 查看</p>');
    out.push('  </div>');
    out.push('  <div class="bogu" id="bogu">');

    lots.forEach(function (lot, i) {
      var sp = L.spans[i % L.spans.length] || [1, 1];
      var style = '';
      if (sp[0] > 1) style += 'grid-column:span ' + sp[0] + ';';
      if (sp[1] > 1) style += 'grid-row:span ' + sp[1] + ';';
      var im = lotImages(lot, i, mode);
      var coverSrc = im.x[0] || im.y[0] || '';
      var img = coverSrc
        ? '<img src="' + SD.Codegen.esc(coverSrc) + '" alt="">'
        : '<div class="empty">待添加</div>';
      var cap = '';
      if (p.boguShowCap || p.boguShowCode) {
        cap = '<div class="cap">' +
              (p.boguShowCap ? '<b>' + SD.Codegen.esc(lot.title || '') + '</b>' : '') +
              (p.boguShowCode ? '<i>' + SD.Codegen.esc(lot.code || '') + '</i>' : '') +
              '</div>';
      }
      out.push('    <div class="cell" data-lot="' + i + '"' +
               (style ? ' style="' + style + '"' : '') + '>' +
               img + cap + '<span class="zoom">⊕</span></div>');
    });

    out.push('  </div>');
    out.push('</div>');
    out.push('');
    out.push('<div class="lot-modal" id="lotModal">');
    out.push('  <button class="lot-close" id="lotClose" title="关闭（Esc）">×</button>');
    out.push('  <div class="lot-stage" id="lotStage">');
    out.push('    <div class="lot-title" id="lotTitle"></div>');
    out.push('  </div>');
    out.push('  <div class="lot-hint">左右拖动旋转 · 上下拖动俯仰 · Esc 关闭</div>');
    out.push('</div>');
    return out.join('\n');
  }

  /* ---------- 页面脚本（弹层 + 按需创建/销毁） ---------- */
  function buildInit(state, mode) {
    var p = state.params || {};
    var lots = state.lots || [];
    var data = lots.map(function (lot, i) {
      var im = lotImages(lot, i, mode);
      var first = onItems(lot)[0] || null;
      return {
        title: lot.title || '', code: lot.code || '',
        x: im.x, y: im.y,
        ratio: ratioOf(first)
      };
    });

    /* 只保留会影响 viewer 的参数，避免把 boguXxx 传给库 */
    var keep = {};
    Object.keys(state.params || {}).forEach(function (k) {
      if (k.indexOf('bogu') !== 0) keep[k] = state.params[k];
    });
    ['folder', 'filenameX', 'amountX', 'indexZeroBase', 'filenameY', 'amountY',
     'filenameGrid', 'imageListX', 'imageListY', 'imageListGrid'].forEach(function (k) {
      delete keep[k];
    });

    return [
      'var LOTS = ' + SD.Codegen.safeJson(data, true) + ';',
      'var BASE = ' + SD.Codegen.safeJson(keep, true) + ';',
      'var cur = null;',
      'var modal = document.getElementById("lotModal");',
      'var stage = document.getElementById("lotStage");',
      'var titleEl = document.getElementById("lotTitle");',
      '',
      'function destroyViewer() {',
      '  try {',
      '    var ci = (typeof window.CI360 === "function") ? new window.CI360() : window.CI360;',
      '    if (ci && ci.destroyAll) ci.destroyAll();',
      '  } catch (e) {}',
      '  var olds = stage.querySelectorAll(".cloudimage-360");',
      '  for (var i = 0; i < olds.length; i++) olds[i].parentNode.removeChild(olds[i]);',
      '  cur = null;',
      '}',
      '',
      'function openLot(i) {',
      '  var lot = LOTS[i];',
      '  if (!lot) return;',
      '  destroyViewer();',
      '  titleEl.textContent = lot.title + (lot.code ? "  " + lot.code : "");',
      '  modal.classList.add("on");',
      '',
      '  var cfg = {};',
      '  for (var k in BASE) cfg[k] = BASE[k];',
      '  if (lot.x && lot.x.length) { cfg.imageListX = lot.x; cfg.amountX = lot.x.length; }',
      '  if (lot.y && lot.y.length) { cfg.imageListY = lot.y; cfg.amountY = lot.y.length; }',
      '  if (!cfg.aspectRatio) cfg.aspectRatio = lot.ratio || "1/1";',
      '',
      '  var el = document.createElement("div");',
      '  el.className = "cloudimage-360";',
      '  el.id = "lotViewer";',
      '  stage.appendChild(el);',
      '  var ci = (typeof window.CI360 === "function") ? new window.CI360() : window.CI360;',
      '  try { ci.init(el, cfg); } catch (e) { titleEl.textContent = "加载失败：" + e.message; }',
      '}',
      '',
      'function closeLot() {',
      '  modal.classList.remove("on");',
      '  destroyViewer();',
      '}',
      '',
      'document.getElementById("bogu").addEventListener("click", function (e) {',
      '  var cell = e.target.closest(".cell");',
      '  if (cell) openLot(parseInt(cell.getAttribute("data-lot"), 10));',
      '});',
      'document.getElementById("lotClose").addEventListener("click", closeLot);',
      'modal.addEventListener("click", function (e) { if (e.target === modal) closeLot(); });',
      'document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeLot(); });',
      '',
      '/* ?lot=N 直接打开第 N 个拍品 */',
      'var _m = /[?&]lot=(\\d+)/.exec(location.search);',
      'if (_m) setTimeout(function () { openLot(parseInt(_m[1], 10) - 1); }, 300);'
    ].join('\n');
  }

  /* ---------- 完整页面 ---------- */
  function buildHtml(state, opts) {
    opts = opts || {};
    var mode = opts.mode || 'files';
    var title = state.title || '拍品总览';

    /* 预览只展示布局：srcdoc 里 CI360 初始化不生效，弹层没有意义 */
    var tail = (mode === 'preview')
      ? ['<div style="text-align:center;padding:6px 10px 18px;font-size:12px;color:#9a8d78">',
         '预览仅展示博古架布局；点击查看 360° 请在导出后操作</div>'].join('\n')
      : ['',
         '<script src="./lib/360-view.min.js"><\/script>',
         '<script>',
         '(function () {',
         buildInit(state, mode),
         '})();',
         '<\/script>'].join('\n');

    return [
      '<!DOCTYPE html>',
      '<html lang="zh-CN">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      '<title>' + SD.Codegen.esc(title) + '</title>',
      '<style>',
      buildCss(state),
      '</style>',
      '</head>',
      '<body>',
      '',
      buildBody(state, mode),
      '',
      tail,
      '</body>',
      '</html>',
      ''
    ].join('\n');
  }

  return {
    LAYOUTS: LAYOUTS,
    THEMES: THEMES,
    buildHtml: buildHtml,
    buildCss: buildCss,
    buildBody: buildBody,
    buildInit: buildInit,
    lotImages: lotImages,
    onItems: onItems,
    coverOf: coverOf
  };
})();
