/* =====================================================================
 * 12-bookpage.js —— 翻书图录页面生成
 *
 * 一本书 = 封面 + N 张内容页 + 封底，统一尺寸。
 * 书上叠着「叶(leaf)」，第 i 叶绕左侧书脊旋转 180° 表示已翻过。
 * 内容页上的锚点绑定拍品（复用 STATE.lots），点击弹出该拍品的 360；
 * 没传 360 素材的拍品锚点会置灰且不可点。
 *
 * 交互：拖动 / 滑动翻页；也支持左右半区点击、← → 键、页码按钮。
 * ===================================================================== */
window.SD = window.SD || {};

SD.BookPage = (function () {

  function extOfName(name) {
    var m = /\.([a-z0-9]+)$/i.exec(String(name || ''));
    return m ? '.' + m[1].toLowerCase() : '.png';
  }

  /* ---------- 页序列（含封面封底） ---------- */
  function sheetList(state, mode) {
    var b = state.book || {};
    var out = [];

    function srcOf(item, fallbackName) {
      if (!item) return '';
      return (mode === 'preview') ? (item.url || '') : ('book/' + fallbackName);
    }

    out.push({
      kind: 'cover',
      src: srcOf(b.cover, 'cover' + extOfName(b.cover && b.cover.name)),
      anchors: []
    });

    (b.pages || []).forEach(function (p, i) {
      out.push({
        kind: 'page',
        src: srcOf(p, 'page-' + (i + 1) + extOfName(p && p.name)),
        anchors: (p && p.anchors) ? p.anchors : []
      });
    });

    out.push({
      kind: 'back',
      src: srcOf(b.back, 'back' + extOfName(b.back && b.back.name)),
      anchors: []
    });

    return out;
  }

  /* ---------- CSS ---------- */
  function buildCss(state) {
    var p = state.params || {};
    var W = p.bookW || 900, H = p.bookH || 1200;
    var turn = p.bookTurn || 700;
    var bg = p.bookBg || '#2a2118';
    var dot = p.bookDotSize || 16;
    var dotColor = p.bookDotColor || '#ffb340';

    return [
      'html,body{margin:0;padding:0;height:100%;overflow:hidden;background:' + bg + ';',
      '  font-family:-apple-system,"Microsoft YaHei","PingFang SC",sans-serif;}',
      'body{display:grid;place-items:center;}',

      '/* 书桌背景 */',
      '.desk{position:fixed;inset:0;background:radial-gradient(ellipse at 50% 42%,',
      '  rgba(255,255,255,.09) 0%, rgba(0,0,0,.55) 78%), ' + bg + ';}',

      '/* 书本 */',
      '.book-wrap{position:relative;z-index:2;display:grid;place-items:center;}',
      '.book{position:relative;',
      '  width:min(' + W + 'px, calc((100vh - 120px) * ' + (W / H).toFixed(4) + '));',
      '  height:min(' + H + 'px, calc(100vh - 120px));',
      '  perspective:2400px;}',
      '.book::after{ /* 书脊投影 */',
      '  content:"";position:absolute;left:0;top:0;bottom:0;width:26px;z-index:50;',
      '  background:linear-gradient(to right, rgba(0,0,0,.42), rgba(0,0,0,0));',
      '  pointer-events:none;border-radius:2px 0 0 2px;}',

      '/* 每一叶 */',
      '.leaf{position:absolute;inset:0;transform-origin:left center;',
      '  transition:transform ' + turn + 'ms cubic-bezier(.3,.05,.25,1);',
      '  backface-visibility:hidden;-webkit-backface-visibility:hidden;',
      '  background:#fff;border-radius:2px;overflow:hidden;',
      '  box-shadow:0 18px 44px rgba(0,0,0,.45);}',
      '.leaf.dragging{transition:none;}',
      '.leaf img{width:100%;height:100%;object-fit:contain;display:block;',
      '  user-select:none;-webkit-user-drag:none;pointer-events:none;background:#fff;}',
      '.leaf .ph{width:100%;height:100%;display:grid;place-items:center;',
      '  color:#b9ae9c;background:#f7f4ee;font-size:15px;letter-spacing:1px;}',
      '.leaf.flipped{transform:rotateY(-180deg);}',

      '/* 锚点：圆点 + 脉冲 */',
      '.dot{position:absolute;width:' + dot + 'px;height:' + dot + 'px;border-radius:50%;',
      '  background:' + dotColor + ';border:2px solid #fff;cursor:pointer;z-index:20;',
      '  transform:translate(-50%,-50%);box-shadow:0 0 0 0 ' + dotColor + 'cc,',
      '  0 2px 6px rgba(0,0,0,.35);animation:dotPulse 2s infinite;}',
      '@keyframes dotPulse{',
      '  0%{box-shadow:0 0 0 0 ' + dotColor + 'cc, 0 2px 6px rgba(0,0,0,.35);}',
      '  70%{box-shadow:0 0 0 ' + Math.round(dot * 0.9) + 'px rgba(0,0,0,0), 0 2px 6px rgba(0,0,0,.35);}',
      '  100%{box-shadow:0 0 0 0 rgba(0,0,0,0), 0 2px 6px rgba(0,0,0,.35);}}',
      '.dot:hover{transform:translate(-50%,-50%) scale(1.25);}',
      '.dot.off{background:#8d8478;cursor:not-allowed;animation:none;opacity:.5;}',
      '.dot .tip{position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);',
      '  background:rgba(24,18,12,.92);color:#fff;font-size:12px;padding:4px 10px;',
      '  border-radius:6px;white-space:nowrap;opacity:0;transition:opacity .15s;pointer-events:none;}',
      '.dot:hover .tip{opacity:1;}',
      '.dot.off .tip::after{content:" （未上传 360）";color:#c9bda9;}',

      '/* 右下角翻页热区提示 */',
      '.corner{position:absolute;bottom:0;width:22%;height:26%;z-index:40;cursor:pointer;}',
      '.corner.prev{left:0;}',
      '.corner.next{right:0;}',

      '/* 页码导航 */',
      '.book-nav{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:60;',
      '  display:flex;align-items:center;gap:14px;color:#e8dccb;font-size:14px;',
      '  background:rgba(0,0,0,.42);padding:8px 16px;border-radius:999px;',
      '  -webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);}',
      '.book-nav button{border:0;background:rgba(255,255,255,.14);color:#fff;width:32px;',
      '  height:32px;border-radius:50%;cursor:pointer;font-size:16px;line-height:1;}',
      '.book-nav button:hover{background:rgba(255,255,255,.3);}',
      '.book-nav button:disabled{opacity:.3;cursor:not-allowed;}',

      '/* 360 弹层 */',
      '.lot-modal{position:fixed;inset:0;z-index:9998;display:none;',
      '  background:rgba(0,0,0,' + (p.boguMask2 === undefined ? .72 : p.boguMask2) + ');}',
      '.lot-modal.on{display:grid;place-items:center;animation:lotFade .2s ease;}',
      '@keyframes lotFade{from{opacity:0}to{opacity:1}}',
      '/* 360 舞台与书页同尺寸同位：点开后正好盖在当前这一页上 */',
      '.lot-stage{width:min(' + W + 'px, calc((100vh - 120px) * ' + (W / H).toFixed(4) + '));',
      '  height:min(' + H + 'px, calc(100vh - 120px));',
      '  display:grid;place-items:center;position:relative;}',
      '/* 舞台与 aspectRatio 参数同比例，图片在其中按同比例适配，不拉伸 */',
      '.lot-stage .cloudimage-360{width:100%;height:100%;}',
      '.lot-stage .cloudimage-360 img{object-fit:contain;}',
      '.lot-stage .lot-title{position:absolute;top:-4px;left:0;color:#fff;font-size:15px;',
      '  letter-spacing:2px;opacity:.9;pointer-events:none;}',
      '.lot-close{position:absolute;top:22px;right:26px;width:40px;height:40px;border:0;',
      '  border-radius:50%;background:rgba(255,255,255,.14);color:#fff;font-size:20px;',
      '  cursor:pointer;}',
      '.lot-close:hover{background:rgba(255,255,255,.28);}',
      '.lot-hint{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);',
      '  color:rgba(255,255,255,.6);font-size:12px;letter-spacing:1px;z-index:9999;}',

      '@media (max-width:820px){',
      '  .book{width:min(' + W + 'px, calc((100vh - 100px) * ' + (W / H).toFixed(4) + '));}',
      '  .book-nav{bottom:12px;font-size:13px;padding:6px 12px;}',
      '}'
    ].join('\n');
  }

  /* ---------- 主体 ---------- */
  function buildBody(state, mode) {
    var sheets = sheetList(state, mode);
    var out = [];

    out.push('<div class="desk"></div>');
    out.push('<div class="book-wrap">');
    out.push('  <div class="book" id="book">');

    sheets.forEach(function (sh, i) {
      var inner = sh.src
        ? '<img src="' + SD.Codegen.esc(sh.src) + '" alt="">'
        : '<div class="ph">' + (sh.kind === 'page' ? '本页未上传图片' : '未上传') + '</div>';
      var dots = '';
      (sh.anchors || []).forEach(function (a) {
        var has = SD.Book ? SD.Book.lotHasMedia(a.lotId) : false;
        var title = SD.Book ? SD.Book.lotTitle(a.lotId) : '';
        dots += '<span class="dot' + (has ? '' : ' off') + '" data-lot="' +
                SD.Codegen.esc(a.lotId || '') + '"' +
                (has ? '' : ' data-off="1"') +
                ' style="left:' + a.x + '%;top:' + a.y + '%">' +
                '<span class="tip">' + SD.Codegen.esc(title || '未绑定拍品') + '</span></span>';
      });
      out.push('    <div class="leaf" data-i="' + i + '" data-kind="' + sh.kind + '">' +
               inner + dots + '</div>');
    });

    out.push('  </div>');
    out.push('</div>');

    out.push('<div class="corner prev" id="cPrev"></div>');
    out.push('<div class="corner next" id="cNext"></div>');

    if ((state.params || {}).bookShowNav !== false) {
      out.push('<div class="book-nav">');
      out.push('  <button id="navPrev" title="上一页">‹</button>');
      out.push('  <span id="navText">1 / ' + sheets.length + '</span>');
      out.push('  <button id="navNext" title="下一页">›</button>');
      out.push('</div>');
    }

    out.push('<div class="lot-modal" id="lotModal">');
    out.push('  <button class="lot-close" id="lotClose" title="关闭（Esc）">×</button>');
    out.push('  <div class="lot-stage" id="lotStage">');
    out.push('    <div class="lot-title" id="lotTitle"></div>');
    out.push('  </div>');
    out.push('</div>');
    out.push('<div class="lot-hint" id="lotHint" style="display:none">左右拖动旋转 · 上下拖动俯仰 · Esc 关闭</div>');

    return out.join('\n');
  }

  /* ---------- 脚本 ---------- */
  function buildInit(state, mode) {
    var p = state.params || {};
    var lots = state.lots || [];
    /* 每个拍品的图片地址（与博古架同一套规则） */
    var data = lots.map(function (lot, i) {
      var im = SD.Bogu ? SD.Bogu.lotImages(lot, i, mode) : { x: [], y: [] };
      var first = (lot.items || []).filter(function (x) { return !x.off; })[0] || null;
      var ratio = '';
      if (first && first.w && first.h) {
        var a = Math.abs(first.w), b = Math.abs(first.h);
        while (b) { var t = a % b; a = b; b = t; }
        ratio = (first.w / a) + '/' + (first.h / a);
      }
      return { id: lot.id, title: lot.title || '', code: lot.code || '',
               x: im.x, y: im.y, ratio: ratio };
    });

    var keep = {};
    Object.keys(p).forEach(function (k) {
      if (k.indexOf('book') !== 0 && k.indexOf('bogu') !== 0) keep[k] = p[k];
    });
    ['folder', 'filenameX', 'amountX', 'indexZeroBase', 'filenameY', 'amountY',
     'filenameGrid', 'imageListX', 'imageListY', 'imageListGrid'].forEach(function (k) {
      delete keep[k];
    });

    return [
      'var LOTS = ' + SD.Codegen.safeJson(data, true) + ';',
      'var BASE = ' + SD.Codegen.safeJson(keep, true) + ';',
      'var TURN = ' + (p.bookTurn || 700) + ';',
      'var BOOK_RATIO = ' + JSON.stringify(String(p.bookW || 900) + '/' + String(p.bookH || 1200)) + ';',
      'var leaves = Array.prototype.slice.call(document.querySelectorAll(".leaf"));',
      'var total = leaves.length;',
      'var cur = 0;',
      'var closeTimer = null;',
      '',
      '/* ---------- 翻页 ---------- */',
      'function paint() {',
      '  for (var i = 0; i < total; i++) {',
      '    var el = leaves[i];',
      '    var flipped = i < cur;',
      '    el.classList.toggle("flipped", flipped);',
      '    el.style.zIndex = flipped ? String(i + 1) : String(total - i + 1);',
      '    el.style.pointerEvents = (i === cur) ? "auto" : "none";',
      '  }',
      '  var t = document.getElementById("navText");',
      '  if (t) t.textContent = (cur + 1) + " / " + total;',
      '  var pv = document.getElementById("navPrev"), nx = document.getElementById("navNext");',
      '  if (pv) pv.disabled = (cur === 0);',
      '  if (nx) nx.disabled = (cur === total - 1);',
      '}',
      '',
      'function goTo(n) {',
      '  cur = Math.max(0, Math.min(total - 1, n));',
      '  paint();',
      '}',
      '',
      '/* ---------- 拖动 / 滑动翻页 ---------- */',
      'var dragging = false, startX = 0, startY = 0, dx = 0, leafEl = null;',
      '',
      'function onDown(e) {',
      '  var t = e.touches ? e.touches[0] : e;',
      '  if (e.target.closest && e.target.closest(".dot")) return;',
      '  dragging = true; dx = 0; startX = t.clientX; startY = t.clientY;',
      '  leafEl = leaves[cur];',
      '  if (leafEl) leafEl.classList.add("dragging");',
      '}',
      '',
      'function onMove(e) {',
      '  if (!dragging) return;',
      '  var t = e.touches ? e.touches[0] : e;',
      '  dx = t.clientX - startX;',
      '  var dy = t.clientY - startY;',
      '  if (Math.abs(dx) < Math.abs(dy) && Math.abs(dx) < 8) return;   /* 竖向滑动不翻页 */',
      '  if (e.cancelable) e.preventDefault();',
      '  var w = leafEl ? leafEl.offsetWidth : 600;',
      '  var deg = Math.max(-180, Math.min(0, (dx / w) * 180));',
      '  if (leafEl) leafEl.style.transform = "rotateY(" + deg + "deg)";',
      '}',
      '',
      'function onUp() {',
      '  if (!dragging) return;',
      '  dragging = false;',
      '  if (!leafEl) return;',
      '  leafEl.classList.remove("dragging");',
      '  leafEl.style.transform = "";',
      '  var w = leafEl.offsetWidth || 600;',
      '  if (dx < -w * 0.18 && cur < total - 1) { goTo(cur + 1); }',
      '  else if (dx > w * 0.18 && cur > 0) { goTo(cur - 1); }',
      '  else { paint(); }',
      '  leafEl = null;',
      '}',
      '',
      'var bookEl = document.getElementById("book");',
      'bookEl.addEventListener("mousedown", onDown);',
      'bookEl.addEventListener("touchstart", onDown, { passive: true });',
      'document.addEventListener("mousemove", onMove);',
      'document.addEventListener("touchmove", onMove, { passive: false });',
      'document.addEventListener("mouseup", onUp);',
      'document.addEventListener("touchend", onUp);',
      '',
      '/* 左右半区点击 / 键盘 / 页码按钮 */',
      'var cp = document.getElementById("cPrev"), cn = document.getElementById("cNext");',
      'if (cp) cp.addEventListener("click", function () { goTo(cur - 1); });',
      'if (cn) cn.addEventListener("click", function () { goTo(cur + 1); });',
      'var np = document.getElementById("navPrev"), nn = document.getElementById("navNext");',
      'if (np) np.addEventListener("click", function () { goTo(cur - 1); });',
      'if (nn) nn.addEventListener("click", function () { goTo(cur + 1); });',
      'document.addEventListener("keydown", function (e) {',
      '  if (e.key === "ArrowRight") goTo(cur + 1);',
      '  if (e.key === "ArrowLeft") goTo(cur - 1);',
      '  if (e.key === "Escape") closeLot();',
      '});',
      '',
      '/* ---------- 360 弹层 ---------- */',
      'var modal = document.getElementById("lotModal");',
      'var stage = document.getElementById("lotStage");',
      'var titleEl = document.getElementById("lotTitle");',
      'var hintEl = document.getElementById("lotHint");',
      '',
      'function destroyViewer() {',
      '  try {',
      '    var ci = (typeof window.CI360 === "function") ? new window.CI360() : window.CI360;',
      '    if (ci && ci.destroyAll) ci.destroyAll();',
      '  } catch (e) {}',
      '  var olds = stage.querySelectorAll(".cloudimage-360");',
      '  for (var i = 0; i < olds.length; i++) olds[i].parentNode.removeChild(olds[i]);',
      '}',
      '',
      'function closeLot() {',
      '  modal.classList.remove("on");',
      '  if (hintEl) hintEl.style.display = "none";',
      '  destroyViewer();',
      '}',
      '',
      'function openLot(lotId) {',
      '  var lot = null;',
      '  for (var i = 0; i < LOTS.length; i++) { if (LOTS[i].id === lotId) { lot = LOTS[i]; break; } }',
      '  if (!lot) return;',
      '  if (!(lot.x && lot.x.length) && !(lot.y && lot.y.length)) return;   /* 没素材 → 不响应 */',
      '  destroyViewer();',
      '  titleEl.textContent = lot.title + (lot.code ? "  " + lot.code : "");',
      '  modal.classList.add("on");',
      '  if (hintEl) hintEl.style.display = "";',
      '',
      '  var cfg = {};',
      '  for (var k in BASE) cfg[k] = BASE[k];',
      '  if (lot.x && lot.x.length) { cfg.imageListX = lot.x; cfg.amountX = lot.x.length; }',
      '  if (lot.y && lot.y.length) { cfg.imageListY = lot.y; cfg.amountY = lot.y.length; }',
      '  if (!cfg.aspectRatio) cfg.aspectRatio = BOOK_RATIO;',
      '',
      '  var el = document.createElement("div");',
      '  el.className = "cloudimage-360";',
      '  el.id = "lotViewer";',
      '  stage.appendChild(el);',
      '  var ci = (typeof window.CI360 === "function") ? new window.CI360() : window.CI360;',
      '  try { ci.init(el, cfg); } catch (e) { titleEl.textContent = "加载失败：" + e.message; }',
      '}',
      '',
      'bookEl.addEventListener("click", function (e) {',
      '  var d = e.target.closest ? e.target.closest(".dot") : null;',
      '  if (!d) return;',
      '  if (d.getAttribute("data-off")) return;   /* 没上传 360 → 点击无效 */',
      '  e.stopPropagation();',
      '  openLot(d.getAttribute("data-lot"));',
      '});',
      'document.getElementById("lotClose").addEventListener("click", closeLot);',
      'modal.addEventListener("click", function (e) { if (e.target === modal) closeLot(); });',
      '',
      'paint();'
    ].join('\n');
  }

  /* ---------- 完整页面 ---------- */
  function buildHtml(state, opts) {
    opts = opts || {};
    var mode = opts.mode || 'files';
    var title = state.title || '电子图录';

    var tail = (mode === 'preview')
      ? ['<div style="position:fixed;left:0;right:0;bottom:0;text-align:center;padding:4px;',
         'font-size:12px;color:#c9bda9;background:rgba(0,0,0,.4)">',
         '预览：可拖动翻页、点锚点查看拍品</div>'].join('')
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
      '<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">',
      '<title>' + SD.Codegen.esc(title) + '</title>',
      '<style>',
      buildCss(state),
      '</style>',
      '</head>',
      '<body>',
      '',
      SD.Codegen.fileWarn(),
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
    buildHtml: buildHtml,
    buildCss: buildCss,
    buildBody: buildBody,
    buildInit: buildInit,
    sheetList: sheetList
  };
})();
