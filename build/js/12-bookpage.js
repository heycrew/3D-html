/* =====================================================================
 * 12-bookpage.js —— 翻书图录页面生成（Canvas 纸张弯曲翻页版）
 *
 * 一本书 = 封面 + N 张内容页 + 封底，统一尺寸。
 *
 * 翻页机制：
 *   不再用 CSS 的 rotateY 平面翻转，而是把页面按竖列切片，
 *   逐列计算「旋转角 → 3D 位置 → 透视投影」，模拟纸张绕书脊卷曲；
 *   并按该列法线朝向观众的成分叠明暗；转角超过 90° 的那部分显示纸背。
 *   全程只用 Canvas 2D，不引入任何第三方库。
 *
 * 层次：
 *   底层 <img class="sheet">  静止页（翻动时提前换成将被露出的那一页）
 *   中层 <canvas class="flip"> 翻动中的弯曲纸页
 *   上层 <div class="dots">    锚点（静止时显示当前页的锚点）
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

  /* 锚点 → HTML（共用给「当前页」与「翻页中」两种情形） */
  function dotsHtml(anchors) {
    var out = '';
    (anchors || []).forEach(function (a) {
      var has = SD.Book ? SD.Book.lotHasMedia(a.lotId) : false;
      var title = SD.Book ? SD.Book.lotTitle(a.lotId) : '';
      out += '<span class="dot' + (has ? '' : ' off') + '" data-lot="' +
             SD.Codegen.esc(a.lotId || '') + '"' +
             (has ? '' : ' data-off="1"') +
             ' style="left:' + a.x + '%;top:' + a.y + '%">' +
             '<span class="tip">' + SD.Codegen.esc(title || '未绑定拍品') + '</span></span>';
    });
    return out;
  }

  /* ---------- CSS ---------- */
  function buildCss(state) {
    var p = state.params || {};
    var W = p.bookW || 900, H = p.bookH || 1200;
    var bg = p.bookBg || '#2a2118';
    var dot = p.bookDotSize || 16;
    var dotColor = p.bookDotColor || '#ffb340';
    var size = 'width:min(' + W + 'px, calc((100vh - 120px) * ' + (W / H).toFixed(4) + '));' +
               'height:min(' + H + 'px, calc(100vh - 120px));';

    return [
      'html,body{margin:0;padding:0;height:100%;overflow:hidden;background:' + bg + ';',
      '  font-family:-apple-system,"Microsoft YaHei","PingFang SC",sans-serif;}',
      'body{display:grid;place-items:center;}',

      '/* 书桌背景 */',
      '.desk{position:fixed;inset:0;background:radial-gradient(ellipse at 50% 42%,',
      '  rgba(255,255,255,.09) 0%, rgba(0,0,0,.55) 78%), ' + bg + ';}',

      '/* 书本 */',
      '.book-wrap{position:relative;z-index:2;display:grid;place-items:center;}',
      '.book{position:relative;' + size + 'border-radius:2px;',
      '  box-shadow:0 18px 46px rgba(0,0,0,.5);background:#fff;}',
      '.book::after{ /* 书脊投影 */',
      '  content:"";position:absolute;left:0;top:0;bottom:0;width:26px;z-index:60;',
      '  background:linear-gradient(to right, rgba(0,0,0,.40), rgba(0,0,0,0));',
      '  pointer-events:none;border-radius:2px 0 0 2px;}',

      '/* 静止页 */',
      '.sheet{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;',
      '  display:block;user-select:none;-webkit-user-drag:none;background:#fff;}',
      '.sheet.hide{visibility:hidden;}',
      '.ph{position:absolute;inset:0;display:grid;place-items:center;',
      '  color:#b9ae9c;background:#f7f4ee;font-size:15px;letter-spacing:1px;}',
      '.ph.hide{display:none;}',

      '/* 翻动中的弯曲纸页 */',
      '.flip{position:absolute;inset:0;z-index:30;pointer-events:none;display:none;}',
      '.flip.on{display:block;}',

      '/* 锚点层 */',
      '.dots{position:absolute;inset:0;z-index:40;pointer-events:none;}',
      '.dots.hide{display:none;}',
      '.dot{position:absolute;width:' + dot + 'px;height:' + dot + 'px;border-radius:50%;',
      '  background:' + dotColor + ';border:2px solid #fff;cursor:pointer;',
      '  pointer-events:auto;transform:translate(-50%,-50%);',
      '  box-shadow:0 0 0 0 ' + dotColor + 'cc, 0 2px 6px rgba(0,0,0,.35);',
      '  animation:dotPulse 2s infinite;}',
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

      '/* 左右翻页热区 */',
      '.corner{position:absolute;bottom:0;width:22%;height:26%;z-index:50;cursor:pointer;}',
      '.corner.prev{left:0;}',
      '.corner.next{right:0;}',

      '/* 页码导航 */',
      '.book-nav{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:70;',
      '  display:flex;align-items:center;gap:14px;color:#e8dccb;font-size:14px;',
      '  background:rgba(0,0,0,.42);padding:8px 16px;border-radius:999px;',
      '  -webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);}',
      '.book-nav button{border:0;background:rgba(255,255,255,.14);color:#fff;width:32px;',
      '  height:32px;border-radius:50%;cursor:pointer;font-size:16px;line-height:1;}',
      '.book-nav button:hover{background:rgba(255,255,255,.3);}',
      '.book-nav button:disabled{opacity:.3;cursor:not-allowed;}',

      '/* 360 弹层：盖在书页位置上，按书尺寸同比例适配 */',
      '.lot-modal{position:fixed;inset:0;z-index:9998;display:none;',
      '  background:rgba(0,0,0,' + (p.boguMask2 === undefined ? .72 : p.boguMask2) + ');}',
      '.lot-modal.on{display:grid;place-items:center;animation:lotFade .2s ease;}',
      '@keyframes lotFade{from{opacity:0}to{opacity:1}}',
      '.lot-stage{' + size + 'display:grid;place-items:center;position:relative;}',
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
    out.push('    <img class="sheet" id="sheetA" alt="">');
    out.push('    <div class="ph hide" id="phBox">本页未上传图片</div>');
    out.push('    <canvas class="flip" id="flipCv"></canvas>');
    out.push('    <div class="dots" id="dotsLayer"></div>');
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
    var sheets = sheetList(state, mode);
    var lots = state.lots || [];

    /* 拍品数据（与博古架同一套规则） */
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

    /* 页数据（含锚点 HTML，避免运行时再拼） */
    var pages = sheets.map(function (sh) {
      return { kind: sh.kind, src: sh.src, dots: dotsHtml(sh.anchors) };
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
      'var SHEETS = ' + SD.Codegen.safeJson(pages, false) + ';',
      'var LOTS = ' + SD.Codegen.safeJson(data, false) + ';',
      'var BASE = ' + SD.Codegen.safeJson(keep, false) + ';',
      'var BOOK_RATIO = ' + JSON.stringify(String(p.bookW || 900) + '/' + String(p.bookH || 1200)) + ';',
      'var TURN = ' + (p.bookTurn || 700) + ';',
      'var SLICES = ' + (p.bookSlices || 90) + ';',
      'var BEND = ' + (p.bookBend === undefined ? 1.57 : p.bookBend) + ';',
      'var SHADE = ' + (p.bookShade === undefined ? .55 : p.bookShade) + ';',
      'var SKEW = ' + (p.bookSkew === undefined ? 2.6 : p.bookSkew) + ';',
      'var SKEWY = ' + (p.bookSkewY === undefined ? .16 : p.bookSkewY) + ';',
      'var CAMD = ' + (p.bookCamDist || 3) + ';',
      'var BACKTONE = ' + JSON.stringify(p.bookBackTone || '#f3efe6') + ';',
      '',
      'var bookEl = document.getElementById("book");',
      'var sheetA = document.getElementById("sheetA");',
      'var phBox = document.getElementById("phBox");',
      'var cv = document.getElementById("flipCv");',
      'var ctx = cv.getContext("2d");',
      'var dotsLayer = document.getElementById("dotsLayer");',
      'var navText = document.getElementById("navText");',
      'var total = SHEETS.length;',
      'var cur = 0;',
      'var W = 0, H = 0, camD = 0;',
      'var cache = {};',
      'var busy = false;',
      '',
      '/* ---------- 尺寸 ---------- */',
      'function measure() {',
      '  var r = bookEl.getBoundingClientRect();',
      '  W = Math.max(1, Math.round(r.width));',
      '  H = Math.max(1, Math.round(r.height));',
      '  cv.width = W; cv.height = H;',
      '  camD = W * CAMD;',
      '}',
      '',
      '/* ---------- 把某页按 contain 预渲染成 W×H 的离屏画布 ---------- */',
      'function prep(i, cb) {',
      '  if (cache[i] !== undefined) { if (cb) cb(cache[i]); return; }',
      '  var sh = SHEETS[i];',
      '  if (!sh || !sh.src) { cache[i] = null; if (cb) cb(null); return; }',
      '  var im = new Image();',
      '  im.onload = function () {',
      '    var c = document.createElement("canvas");',
      '    c.width = W; c.height = H;',
      '    var g = c.getContext("2d");',
      '    g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);',
      '    var s = Math.min(W / im.width, H / im.height);',
      '    var dw = im.width * s, dh = im.height * s;',
      '    g.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);',
      '    cache[i] = c;',
      '    if (cb) cb(c);',
      '  };',
      '  im.onerror = function () { cache[i] = null; if (cb) cb(null); };',
      '  im.src = sh.src;',
      '}',
      '',
      '/* ---------- 逐列绘制弯曲的纸页 ----------',
      '   t: 0 = 平放在右侧；1 = 完全翻到左侧',
      '   纸的左边缘固定在书脊 x=0，向右延伸弧长 W',
      '   每列转角 psi(u,t) = π·t + BEND·sin(π·t)·(2u-1)：',
      '     第一项是整体旋转；第二项让角度沿纸面分布 —— 自由端先翻、书脊端后翻，',
      '     这才是纸「弯」起来的样子。该误差项在 t=0 与 t=1 处归零，',
      '     所以末态是一张平铺到左边的纸。',
      '   注意：psi 超过 90° 的列看到的是纸背，其屏幕宽度为负，必须取绝对值绘制 */',
      'function bendDraw(src, t) {',
      '  ctx.clearRect(0, 0, W, H);',
      '  var tt = Math.min(1, Math.max(0, t));',
      '  if (!src) return;',
      '  if (tt <= 0.001) { ctx.drawImage(src, 0, 0); return; }',
      '',
      '  /* 自然斜角：整页随进度轻微倾斜并略放大，让翻动不像机械的水平推移；',
      '     两端倾角为 0、中途最大，所以静止时仍是端正的一页。 */',
      '  var tilt = SKEW * Math.sin(Math.PI * tt);',
      '  ctx.save();',
      '  var grow = 1 + Math.abs(tilt) * 0.006;',
      '  ctx.translate(W / 2, H / 2);',
      '  ctx.rotate(tilt * Math.PI / 180);',
      '  ctx.scale(grow, grow);',
      '  ctx.translate(-W / 2, -H / 2);',
      '',
      '  /* 卷边推进模型：',
      '     左侧是还在平放的纸，右端固定一小段向前卷起的纸边；',
      '     随翻页进度 t 增大，平放部分变窄、卷边整体向左推进。',
      '     卷曲段按圆弧参数化，逐列算出屏幕位置与法线，用于透视与明暗。 */',
      '  var flatW = (1 - tt) * W;',
      '  var curlW = Math.min(W * 0.24, flatW * 0.75) * Math.min(1, tt * 3.2);',
      '  var r = curlW > 0.5 ? curlW / Math.PI : 0;',
      '  var x0 = flatW - curlW;',
      '  var N = Math.max(8, SLICES);',
      '  var dW = W / N;',
      '  var colW = src.width / N;',
      '',
      '  for (var i = 0; i < N; i++) {',
      '    var px = (i + 0.5) * dW;               /* 该列在纸面上的位置 */',
      '    if (px > flatW) continue;              /* 已经翻走的部分不画 */',
      '    var sxp, zp, facing;',
      '    if (r <= 0.5 || px <= x0) {',
      '      sxp = px; zp = 0; facing = 1;        /* 平放段 */',
      '    } else {',
      '      var cu = (px - x0) / curlW;              /* 0..1 */',
      '      /* 指数 >1 让卷曲集中在纸边附近，更像软纸而不是刚性圆弧 */',
      '      var ang = Math.PI * Math.pow(Math.min(1, cu), 1.22);',
      '      sxp = x0 + r * Math.sin(ang);',
      '      zp = r * (1 - Math.cos(ang));',
      '      facing = Math.cos(ang);                  /* 卷过 90° 即看到纸背 */',
      '    }',
      '',
      '    /* 透视投影 */',
      '    var persp = camD / (camD - zp);',
      '    var sc = sxp * persp;',
      '',
      '    /* 列宽：取相邻两列的屏幕间距，近似为该列的投影宽度 */',
      '    var nxp, nzp;',
      '    if (r <= 0.5 || (px + dW) <= x0) { nxp = px + dW; nzp = 0; }',
      '    else if ((px + dW) > flatW) { continue; }',
      '    else {',
      '      var ang2 = (px + dW - x0) / curlW * Math.PI;',
      '      nxp = x0 + r * Math.sin(ang2);',
      '      nzp = r * (1 - Math.cos(ang2));',
      '    }',
      '    var sc2 = nxp * (camD / (camD - nzp));',
      '    var aw = Math.abs(sc2 - sc);',
      '    var bx = Math.min(sc, sc2);',
      '    if (aw <= 0.15) continue;',
      '',
      '    var sx = i * colW;',
      '    /* 卷起越高，整列越向下偏移一点 —— 纸角是斜着翘起来的 */',
      '    var lift = zp * SKEWY * (H / W);',
      '    var dy = lift;',
      '    var dh = H - lift * 0.55;',
      '    if (facing >= 0) {',
      '      ctx.drawImage(src, sx, 0, colW, src.height, bx, dy, aw, dh);',
      '      var d1 = (1 - facing) * SHADE;',
      '      if (d1 > 0.01) {',
      '        ctx.save(); ctx.globalAlpha = d1; ctx.fillStyle = "#000";',
      '        ctx.fillRect(bx, dy, aw, dh); ctx.restore();',
      '      }',
      '    } else {',
      '      /* 卷过 90°，露出纸背 */',
      '      ctx.save();',
      '      ctx.globalAlpha = 1; ctx.fillStyle = BACKTONE;',
      '      ctx.fillRect(bx, dy, aw, dh);',
      '      var d2 = (1 + facing) * SHADE * 0.6;',
      '      if (d2 > 0.01) {',
      '        ctx.globalAlpha = d2; ctx.fillStyle = "#000";',
      '        ctx.fillRect(bx, dy, aw, dh);',
      '      }',
      '      ctx.restore();',
      '    }',
      '  }',
      '',
      '  ctx.restore();',
      '}',
      '',
      '/* ---------- 静止状态 ---------- */',
      'function paint() {',
      '  ctx.clearRect(0, 0, W, H);',
      '  cv.classList.remove("on");',
      '  dotsLayer.classList.remove("hide");',
      '  var sh = SHEETS[cur];',
      '  var has = !!(sh && sh.src);',
      '  if (has) {',
      '    sheetA.src = sh.src;',
      '    sheetA.classList.remove("hide");',
      '    phBox.classList.add("hide");',
      '  } else {',
      '    sheetA.removeAttribute("src");',
      '    sheetA.classList.add("hide");',
      '    phBox.classList.remove("hide");',
      '  }',
      '  dotsLayer.innerHTML = (sh && sh.dots) ? sh.dots : "";',
      '  if (navText) navText.textContent = (cur + 1) + " / " + total;',
      '  var pv = document.getElementById("navPrev"), nx2 = document.getElementById("navNext");',
      '  if (pv) pv.disabled = (cur === 0);',
      '  if (nx2) nx2.disabled = (cur === total - 1);',
      '  /* 预取相邻页，翻页时更顺 */',
      '  prep(cur + 1); prep(cur - 1);',
      '}',
      '',
      'function goTo(n) {',
      '  if (busy) return;',
      '  cur = Math.max(0, Math.min(total - 1, n));',
      '  paint();',
      '}',
      '',
      '/* ---------- 翻页动画 ---------- */',
      'var raf = null;',
      'function animateFlip(dir, from, to, done) {',
      '  var t0 = performance.now();',
      '  var src = dir > 0 ? cache[cur] : cache[cur - 1];',
      '  cv.classList.add("on");',
      '  dotsLayer.classList.add("hide");',
      '  function step(now) {',
      '    var k = Math.min(1, (now - t0) / TURN);',
      '    var e = 1 - Math.pow(1 - k, 3);            /* easeOutCubic */',
      '    var t = from + (to - from) * e;',
      '    bendDraw(src, t);',
      '    if (k < 1) { raf = requestAnimationFrame(step); }',
      '    else { raf = null; if (done) done(); }',
      '  }',
      '  raf = requestAnimationFrame(step);',
      '}',
      '',
      'function flipNext() {',
      '  if (busy || cur >= total - 1) return;',
      '  busy = true;',
      '  /* 先把底层换成「将被露出的那一页」，翻动过程中就是它露出来 */',
      '  prep(cur + 1, function () {',
      '    var next = SHEETS[cur + 1];',
      '    if (next && next.src) { sheetA.src = next.src; sheetA.classList.remove("hide"); phBox.classList.add("hide"); }',
      '    else { sheetA.removeAttribute("src"); sheetA.classList.add("hide"); phBox.classList.remove("hide"); }',
      '    animateFlip(1, 0, 1, function () { cur++; busy = false; paint(); });',
      '  });',
      '}',
      '',
      'function flipPrev() {',
      '  if (busy || cur <= 0) return;',
      '  busy = true;',
      '  prep(cur - 1, function () { animateFlip(-1, 1, 0, function () { cur--; busy = false; paint(); }); });',
      '}',
      '',
      '/* ---------- 拖动 / 滑动 ---------- */',
      'var dragging = false, startX = 0, startY = 0, dragT = 0, dragDir = 1;',
      '',
      'function onDown(e) {',
      '  if (busy) return;',
      '  var t = e.touches ? e.touches[0] : e;',
      '  if (e.target.closest && e.target.closest(".dot")) return;',
      '  dragging = true; dragT = 0; startX = t.clientX; startY = t.clientY;',
      '  dragDir = 0;   /* 尚未决定方向 */',
      '}',
      '',
      'function onMove(e) {',
      '  if (!dragging) return;',
      '  var t = e.touches ? e.touches[0] : e;',
      '  var dx = t.clientX - startX;',
      '  var dy = t.clientY - startY;',
      '  if (!dragDir) {',
      '    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;',
      '    dragDir = (Math.abs(dx) >= Math.abs(dy)) ? (dx < 0 ? 1 : -1) : 0;',
      '    if (!dragDir) { dragging = false; return; }   /* 竖向滑动不翻页 */',
      '    var src0 = dragDir > 0 ? cache[cur] : cache[cur - 1];',
      '    if (!src0) { dragging = false; return; }',
      '    cv.classList.add("on");',
      '    dotsLayer.classList.add("hide");',
      '  }',
      '  if (e.cancelable) e.preventDefault();',
      '  var raw = Math.abs(dx) / W;',
      '  var t2 = Math.min(1, raw);',
      '  dragT = t2;',
      '  var src = dragDir > 0 ? cache[cur] : cache[cur - 1];',
      '  bendDraw(src, dragDir > 0 ? t2 : (1 - t2));',
      '}',
      '',
      'function onUp() {',
      '  if (!dragging) { return; }',
      '  dragging = false;',
      '  if (!dragDir) { return; }',
      '  var src = dragDir > 0 ? cache[cur] : cache[cur - 1];',
      '  if (!src) { paint(); return; }',
      '  var pass = dragT > 0.32;',
      '  busy = true;',
      '  if (dragDir > 0) {',
      '    if (pass && cur < total - 1) {',
      '      animateFlip(1, dragT, 1, function () { cur++; busy = false; paint(); });',
      '    } else {',
      '      animateFlip(1, dragT, 0, function () { busy = false; paint(); });',
      '    }',
      '  } else {',
      '    if (pass && cur > 0) {',
      '      animateFlip(-1, 1 - dragT, 0, function () { cur--; busy = false; paint(); });',
      '    } else {',
      '      animateFlip(-1, 1 - dragT, 1, function () { busy = false; paint(); });',
      '    }',
      '  }',
      '  dragDir = 0;',
      '  dragT = 0;',
      '}',
      '',
      'bookEl.addEventListener("mousedown", onDown);',
      'bookEl.addEventListener("touchstart", onDown, { passive: true });',
      'document.addEventListener("mousemove", onMove, { passive: false });',
      'document.addEventListener("touchmove", onMove, { passive: false });',
      'document.addEventListener("mouseup", onUp);',
      'document.addEventListener("touchend", onUp);',
      '',
      '/* ---------- 热区 / 键盘 / 页码 ---------- */',
      'var cp = document.getElementById("cPrev"), cn = document.getElementById("cNext");',
      'if (cp) cp.addEventListener("click", flipPrev);',
      'if (cn) cn.addEventListener("click", flipNext);',
      'var np = document.getElementById("navPrev"), nn = document.getElementById("navNext");',
      'if (np) np.addEventListener("click", flipPrev);',
      'if (nn) nn.addEventListener("click", flipNext);',
      'document.addEventListener("keydown", function (e) {',
      '  if (e.key === "ArrowRight") flipNext();',
      '  if (e.key === "ArrowLeft") flipPrev();',
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
      '/* ---------- 启动 ---------- */',
      'window.addEventListener("resize", function () { measure(); cache = {}; paint(); });',
      'measure();',
      'prep(cur, function () { paint(); });',
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
         '预览：拖动翻页（纸张弯曲）、点锚点查看拍品</div>'].join('')
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
