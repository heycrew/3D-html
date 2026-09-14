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

    /* 某个内容页自己的 360 素材组：预览用内存 URL，导出用相对文件名 */
    function itemsOf(page, pageIndex) {
      var arr = (page && page.items) || [];
      var out = [];
      arr.forEach(function (it, k) {
        if (it.off) return;
        var nm = 'book/page-' + (pageIndex + 1) + '/' +
                 (it.name || ('frame-' + (k + 1) + '.png'));
        var u = (mode === 'preview') ? (it.url || '') : nm;
        if (u) out.push(u);
      });
      return out;
    }

    out.push({
      kind: 'cover',
      src: srcOf(b.cover, 'cover' + extOfName(b.cover && b.cover.name)),
      items: [], title: '封面'
    });

    (b.pages || []).forEach(function (p, i) {
      out.push({
        kind: 'page',
        src: srcOf(p, 'page-' + (i + 1) + extOfName(p && p.name)),
        items: itemsOf(p, i),
        title: '第 ' + (i + 1) + ' 页'
      });
    });

    out.push({
      kind: 'back',
      src: srcOf(b.back, 'back' + extOfName(b.back && b.back.name)),
      items: [], title: '封底'
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
    /* 尺寸适配：跟随封面图时，把「书高」按封面的真实宽高比换算，
       这样封面、内页都能铺满画布，四周不留空白。 */
    var _p = state.params || {};
    var _cov = (state.book && state.book.cover) || null;
    var _fit = (_p.bookFit !== 'manual') && _cov && _cov.w && _cov.h;
    var W = _p.bookW || 900, H = _p.bookH || 1200;
    if (_fit) { H = Math.max(1, Math.round(W * _cov.h / _cov.w)); }
    var bg = p.bookBg || '#2a2118';
    var dot = p.bookDotSize || 16;
    var dotColor = p.bookDotColor || '#ffb340';
    var R = (W / H).toFixed(4);
    /* 按屏幕宽高等比铺满：两轴同时受 100vw / 100vh 约束，
       取更小的那个 → 整本书永远完整可见（不裁切、不变形）。
       适配后多出来的位置就是背景色（html/body 已铺 bg）。
       原先还扣了 120px 给底部导航，导致下面空出一大条 —— 已去掉，
       导航改为半透明浮层，压在书上而不占版面。 */
    var size = 'width:min(100vw, calc(100vh * ' + R + '));' +
               'height:min(100vh, calc(100vw / ' + R + '));';

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
      '  box-shadow:0 18px 46px rgba(0,0,0,.5);background:' + bg + ';}',
      '.book::after{ /* 书脊投影 */',
      '  content:"";position:absolute;left:0;top:0;bottom:0;width:26px;z-index:60;',
      '  background:linear-gradient(to right, rgba(0,0,0,.40), rgba(0,0,0,0));',
      '  pointer-events:none;border-radius:2px 0 0 2px;}',

      '/* 静止页 */',
      '.sheet{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;',
      '  display:block;user-select:none;-webkit-user-drag:none;background:' + bg + ';}',
      '.sheet.hide{visibility:hidden;}',
      '.ph{position:absolute;inset:0;display:grid;place-items:center;',
      '  color:#b9ae9c;background:#f7f4ee;font-size:15px;letter-spacing:1px;}',
      '.ph.hide{display:none;}',

      '/* 翻动中的弯曲纸页 */',
      '.flip{position:absolute;inset:0;z-index:30;pointer-events:none;',
      '  opacity:0;visibility:hidden;',
      '  transition:opacity .14s linear, visibility 0s linear .14s;}',
      '.flip.on{opacity:1;visibility:visible;',
      '  transition:opacity .14s linear, visibility 0s linear;}',

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
      '.lot-stage{width:min(100vw, calc(100vh * ' + R + '));' +
      '  height:min(100vh, calc(100vw / ' + R + '));' +
      '  display:grid;place-items:center;position:relative;}',
      '.lot-stage .cloudimage-360{width:100%;height:100%;}',
      '.lot-stage .cloudimage-360 img{object-fit:contain;}',
      /* 让查看器画布撑满整个舞台：素材本身是正方形时，
         CI360 只建了 520x520 的画布，放大后很快顶到边界被裁。
         交给容器定尺寸 + object-fit:contain ——
         图片仍按自身比例居中不变形，但可用空间变成整个屏幕。 */
      '.lot-stage .cloudimage-360 canvas{width:100% !important;height:100% !important;',
      '  object-fit:contain;display:block;}',
      '.lot-stage .lot-title{position:absolute;top:-4px;left:0;color:#fff;font-size:15px;',
      '  letter-spacing:2px;opacity:.9;pointer-events:none;}',
      '.lot-close{position:absolute;top:22px;right:26px;width:40px;height:40px;border:0;',
      '  border-radius:50%;background:rgba(255,255,255,.14);color:#fff;font-size:20px;',
      '  cursor:pointer;}',
      '.lot-close:hover{background:rgba(255,255,255,.28);}',
      '.lot-hint{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);',
      '  color:rgba(255,255,255,.6);font-size:12px;letter-spacing:1px;z-index:9999;}',

      '@media (max-width:820px){',
      '  /* 手机上靠手势操作 —— 隐藏所有按钮与文字提示 */',
      '  .book-nav button{display:none;}',
      '  .lot-hint{display:none !important;}',
      '  .lot-close{width:34px;height:34px;font-size:17px;top:14px;right:14px;}',
      '  .book-nav{bottom:12px;font-size:13px;padding:6px 14px;}',
      '  .corner{display:none;}         /* 也去掉左右点击热区，避免误触 */',
      '  .lot-hint{font-size:11px;}',
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
    out.push('    <img class="sheet" id="sheetB" alt="">');
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
      /* items：这一页自己的 360 素材组（点这一页就弹它）
         title：弹层标题 */
      return { kind: sh.kind, src: sh.src,
               items: sh.items || [], title: sh.title || '',
               dots: dotsHtml(sh.anchors) };
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
      '/* CI360 的 aspectRatio 只认数字（如 0.75）或 "4/3" 形式；传 "600/800" 会被忽略并退回 1:1 正方形，所以要换算成小数。 */',
      'var BOOK_RATIO = ' + (function () {
        var cov = (state.book && state.book.cover) || null;
        if (p.bookFit !== 'manual' && cov && cov.w && cov.h) return (cov.w / cov.h);
        return (Number(p.bookW || 900) / Number(p.bookH || 1200));
      })().toFixed(4) + ';',
      'var INTERP = ' + (p.interp || 0) + ';',
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
      'var sheetB = document.getElementById("sheetB");',
      '/* 当前显示在上层的是哪一张："A" 或 "B" —— 双缓冲用 */',
      'var _top = "A";',
      'if (sheetB) sheetB.classList.add("hide");',
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
      'var _flipDone = false;   /* ?flip 调试模式：绘制完成后不让静止状态覆盖 */',
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
      '  /* 倾斜要保留，但不能用「绕中心旋转」——那会把画面四角转出去，',
      '     而右侧「已翻走」的区域本是空白，一转就转到左上角，于是左上角漏出下一页。',
      '     改用「以左上角为原点的整体斜切」：书脊侧（左上）固定不动，',
      '     越靠右越向下错开 —— 倾斜感保留，左上角永远是当前页的内容。',
      '     斜切会在纵向撑出缺口，所以绘制时把每列上下都扩展一点补上。 */',
      '  var _tan = Math.tan(tilt * Math.PI / 180);',
      '  var _ext = Math.abs(_tan) * W;      /* 斜切在纵向撑出的缺口 */',
      '  ctx.transform(1, _tan, 0, 1, 0, 0);',
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
      '    var dy = lift - _ext / 2;',
      '    var dh = H + _ext - lift * 0.55;',
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
      '/* ---------- 静止状态 ---------- */',
      '/* 双缓冲：sheetA / sheetB 两张图交替显示。',
      '   换页时先把新页加载到「不在显示的那张」，等它解码完成、确实上屏之后，',
      '   才隐藏旧页并撤掉卷边画布 ——',
      '   这样中间任何一帧看到的都是正确内容，不会闪出上一页。',
      '   为什么必须双缓冲：单个 img 换 src 后，浏览器在解码新图期间仍然显示旧图，',
      '   「先解码再赋值」也压不住这一帧的空窗。 */',
      'function paint() {',
      '  if (_flipDone) return;',
      '  ctx.clearRect(0, 0, W, H);',
      '  dotsLayer.classList.remove("hide");',
      '  var sh = SHEETS[cur];',
      '  var want = (sh && sh.src) ? sh.src : "";',
      '  var top = (_top === "A") ? sheetA : sheetB;',
      '  var bot = (_top === "A") ? sheetB : sheetA;',
      '',
      '  /* 页码、锚点、相邻页预取：与显示哪张无关，先做完 */',
      '  var tail = function () {',
      '    dotsLayer.innerHTML = (sh && sh.dots) ? sh.dots : "";',
      '    if (navText) navText.textContent = (cur + 1) + " / " + total;',
      '    var pv = document.getElementById("navPrev"), nx2 = document.getElementById("navNext");',
      '    if (pv) pv.disabled = (cur === 0);',
      '    if (nx2) nx2.disabled = (cur === total - 1);',
      '    prep(cur + 1); prep(cur - 1);',
      '  };',
      '',
      '  if (!want) {           /* 这一页没有图：显示占位，直接撤画布 */',
      '    sheetA.classList.add("hide");',
      '    sheetB.classList.add("hide");',
      '    phBox.classList.remove("hide");',
      '    tail();',
      '    cv.classList.remove("on");   /* 没图才真的撤画布 */',
      '    return;',
      '  }',
      '  phBox.classList.add("hide");',
      '',
      '  if (top.getAttribute("src") === want) {   /* 显示的已经是目标页 */',
      '    top.classList.remove("hide");',
      '    tail();',
      '    holdFrame();',
      '    return;',
      '  }',
      '',
      '  /* 换页：新页加载到备用那张，解码完成后让它盖住旧页，',
      '     再等两帧（确保真的上屏）才隐藏旧页与画布。 */',
      '  var swap = function () {',
      '    bot.style.zIndex = "3";',
      '    top.style.zIndex = "2";',
      '    bot.classList.remove("hide");',
      '    _top = (_top === "A") ? "B" : "A";',
      '    requestAnimationFrame(function () {',
      '      requestAnimationFrame(function () {',
      '        top.classList.add("hide");',
      '        tail();',
      '        holdFrame();',
      '      });',
      '    });',
      '  };',
      '  var go = function () {',
      '    if (bot.decode) { bot.decode().then(swap).catch(swap); }',
      '    else { swap(); }',
      '  };',
      '  bot.src = want;',
      '  if (bot.complete && bot.naturalWidth) { go(); }',
      '  else { bot.addEventListener("load", go); bot.addEventListener("error", swap); }',
      '  tail();',
      '}',
      '',
      '/* 让卷边画布常驻显示「当前这一页」的最终画面，而不是撤掉它。',
      '   为什么这样就彻底不闪了：',
      '   之前无论怎么优化，都是在「撤掉 canvas、露出 img」这一刻做文章，',
      '   而那一刻总有新旧画面的交替。现在干脆不撤 ——',
      '   canvas 上画的内容和底下的 img 完全同源（都是 prep() 预渲染的同尺寸帧），',
      '   两者像素一致，切不切、什么时候切，都看不出来。',
      '   画布 pointer-events:none，不影响点页面、翻页、锚点。 */',
      'function holdFrame() {',
      '  var fr = cache[cur];',
      '  if (!fr) { prep(cur, function () { holdFrame(); }); return; }',
      '  ctx.clearRect(0, 0, W, H);',
      '  ctx.drawImage(fr, 0, 0);',
      '  cv.classList.add("on");',
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
      '    /* 向后翻：底层必须换成下一页 ——',
      '       否则卷起的是第 N 页、露出来的还是第 N 页，看不出在翻书；',
      '       向前翻时底层保持当前页（翻回来的是上一页，会盖在上面）。 */',
      '    if (dragDir > 0) {',
      '      var nx0 = SHEETS[cur + 1];',
      '      if (nx0 && nx0.src) {',
      '        sheetA.src = nx0.src;',
      '        sheetA.classList.remove("hide");',
      '        phBox.classList.add("hide");',
      '      }',
      '    }',
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
      '/* ---------- 帧插值：相邻帧交叉淡化，缓解少帧的跳跃感 ---------- */',
      'function buildInterpolated(list, n, done) {',
      '  if (!n || !list || list.length < 2) { done(list || []); return; }',
      '  var imgs = [], total = list.length, loaded = 0, failed = false;',
      '  function step() {',
      '    if (++loaded < total) return;',
      '    if (failed) { done(list); return; }',
      '    var W = imgs[0] && imgs[0].naturalWidth, H = imgs[0] && imgs[0].naturalHeight;',
      '    if (!W || !H) { done(list); return; }',
      '    var out = [];',
      '    for (var i = 0; i < total; i++) {',
      '      out.push(list[i]);',
      '      var a = imgs[i], b = imgs[(i + 1) % total];',
      '      if (!a || !b) continue;',
      '      for (var k = 1; k <= n; k++) {',
      '        var c = document.createElement("canvas");',
      '        c.width = W; c.height = H;',
      '        var g = c.getContext("2d");',
      '        g.drawImage(a, 0, 0, W, H);',
      '        g.globalAlpha = k / (n + 1);',
      '        g.drawImage(b, 0, 0, W, H);',
      '        try { out.push(c.toDataURL("image/jpeg", 0.88)); }',
      '        catch (e) { done(list); return; }',
      '      }',
      '    }',
      '    done(out);',
      '  }',
      '  for (var i = 0; i < total; i++) {',
      '    (function (idx) {',
      '      var im = new Image();',
      '      im.onload = function () { imgs[idx] = im; step(); };',
      '      im.onerror = function () { failed = true; step(); };',
      '      im.src = list[idx];',
      '    })(i);',
      '  }',
      '}',
      'function openSheet360(sh) {',
      '  if (!sh || !sh.items || !sh.items.length) return;   /* 本页没素材 → 不响应 */',
      '  var lot = { x: sh.items, y: [], title: sh.title || "" };',
      '  destroyViewer();',
      '  titleEl.textContent = lot.title;',
      '  modal.classList.add("on");',
      '  if (hintEl) hintEl.style.display = "";',
      '',
      '  var cfg = {};',
      '  for (var k in BASE) cfg[k] = BASE[k];',
      '  var _go = function (xlist) {',
      '  if (xlist && xlist.length) { cfg.imageListX = xlist; cfg.amountX = xlist.length; }',
      '  if (lot.y && lot.y.length) { cfg.imageListY = lot.y; cfg.amountY = lot.y.length; }',
      '  if (!cfg.aspectRatio) cfg.aspectRatio = BOOK_RATIO;',
      '  if (SIMPLE_UI) {',
      '    cfg.hints = false;          /* 不显示拖拽/双击提示 */',
      '    cfg.scrollHint = false;     /* 不显示 Ctrl+滚轮提示 */',
      '    cfg.zoomControls = false;   /* 不显示缩放按钮组 */',
      '  }',
      '',
      '  var el = document.createElement("div");',
      '  el.className = "cloudimage-360";',
      '  el.id = "lotViewer";',
      '  stage.appendChild(el);',
      '  var ci = (typeof window.CI360 === "function") ? new window.CI360() : window.CI360;',
      '  try { ci.init(el, cfg); } catch (e) { titleEl.textContent = "加载失败：" + e.message; }',
      '  /* 让查看器画布铺满整个舞台：CI360 按素材尺寸建画布，素材本身是正方形时就只有 520x520，放大后立刻顶到边界被裁。这里把尺寸交给容器（object-fit:contain 保证图片按自身比例居中不变形），放大时可用空间就是整个屏幕。 */',
      '  var _fitCanvas = function () {',
      '    var _cs = stage.querySelectorAll("canvas");',
      '    for (var _j = 0; _j < _cs.length; _j++) {',
      '      _cs[_j].style.setProperty("width", "100%", "important");',
      '      _cs[_j].style.setProperty("height", "100%", "important");',
      '      _cs[_j].style.setProperty("object-fit", "contain", "important");',
      '      _cs[_j].style.setProperty("display", "block", "important");',
      '    }',
      '  };',
      '  _fitCanvas();',
      '  requestAnimationFrame(_fitCanvas);',
      '  setTimeout(_fitCanvas, 120);',
      '  };',
      '  buildInterpolated(lot.x, INTERP, _go);',
      '}',
      '',
      '/* 点内容页任意位置 → 弹出这一页自己的 360 素材组。',
      '   翻页热区（左右下角）与导航按钮除外。',
      '   关键：拖动翻页（滑动）松手后浏览器仍会补发一次 click，',
      '   若不排除，翻完页就会「自动」弹出 360 —— 表现为翻页后冒出全景。',
      '   所以记录按下位置，位移超过阈值就认定是翻页手势，不算点击。 */',
      'var _dnX = 0, _dnY = 0, _moved = false;',
      'bookEl.addEventListener("pointerdown", function (e) {',
      '  _dnX = e.clientX; _dnY = e.clientY; _moved = false;',
      '});',
      'bookEl.addEventListener("pointermove", function (e) {',
      '  if (Math.abs(e.clientX - _dnX) > 8 || Math.abs(e.clientY - _dnY) > 8) _moved = true;',
      '});',
      'bookEl.addEventListener("click", function (e) {',
      '  if (_moved) { _moved = false; return; }          /* 刚才是翻页拖动 → 不是点击 */',
      '  if (busy) return;                                 /* 翻页动画进行中 → 忽略 */',
      '  var t = e.target;',
      '  if (t && t.closest) {',
      '    if (t.closest(".corner") || t.closest(".book-nav") || t.closest(".dot")) return;',
      '  }',
      '  if (modal.classList.contains("on")) return;',
      '  var sh = SHEETS[cur];',
      '  if (!sh || !sh.items || !sh.items.length) return;   /* 本页没有 360 素材 → 不响应 */',
      '  openSheet360(sh);',
      '});',
      'document.getElementById("lotClose").addEventListener("click", closeLot);',
      'modal.addEventListener("click", function (e) { if (e.target === modal) closeLot(); });',
      '',
      '/* ?flip=0.4 直接把翻页画面停在指定进度，',
      '   方便截图对照效果（不依赖真实拖拽）*/',
      '/* 触屏或窄屏时：关掉 360 查看器的文字提示与操作按钮，纯手势操作 */',
      'var IS_TOUCH = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);',
      'var IS_NARROW = window.innerWidth < 820;',
      'var SIMPLE_UI = IS_TOUCH || IS_NARROW;',
      '',
      'var _fm = /[?&]flip=([0-9.]+)/.exec(location.search);',
      'if (_fm) {',
      '' ,
      '  var _t = Math.max(0, Math.min(1, parseFloat(_fm[1])));',
      '  var _try = 0;',
      '  var _timer = setInterval(function () {',
      '    _try++;',
      '    var img = document.getElementById("sheetA");',
      '    if (img && img.complete && img.naturalWidth) {',
      '      clearInterval(_timer);',
      '      var c = document.createElement("canvas");',
      '      c.width = W; c.height = H;',
      '      var g = c.getContext("2d");',
      '      g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);',
      '      var sc = Math.min(W / img.naturalWidth, H / img.naturalHeight);',
      '      var dw = img.naturalWidth * sc, dh = img.naturalHeight * sc;',
      '      g.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);',
      '      var _nx = SHEETS[cur + 1];',
      '      if (_nx && _nx.src) { sheetA.src = _nx.src; }   /* 底层换成下一页 */',
      '      cv.classList.add("on");',
      '      dotsLayer.classList.add("hide");',
      '      bendDraw(c, _t);',
      '      _flipDone = true;',
      '      _dbg("drawn");',
      '    } else if (_try > 400) { clearInterval(_timer); _dbg("timeout try=" + _try); }',
      '  }, 50);',
      '  function _dbg(msg) {',
      '    var d = document.createElement("pre");',
      '    d.style.cssText = "position:fixed;left:6px;bottom:6px;background:#000;color:#0f0;"',
      '      + "font:12px monospace;padding:6px;z-index:99999;max-width:92vw";',
      '    var img = document.getElementById("sheetA");',
      '    d.textContent = "flip=" + _t + " | " + msg',
      '      + " | WxH=" + W + "x" + H',
      '      + " | img=" + (img ? (img.complete ? "loaded" : "loading") + "/" + img.naturalWidth : "none")',
      '      + " | cvOn=" + cv.classList.contains("on");',
      '    document.body.appendChild(d);',
      '  }',
      '}',

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

    /* 预览也要真正跑起来（不只是摆个空壳）：
       之前用 srcdoc 时 CI360 不渲染，于是干脆连脚本都不发了 ——
       现在预览走 blob URL（有真实 origin、与页面同源），逻辑可以正常运行。
       libHref 允许外面传绝对地址，避免 blob 文档里相对路径解析出错。 */
    var libSrc = opts.libHref || './lib/360-view.min.js';
    var tail = [
      '',
      '<script src="' + libSrc + '"><\/script>',
      '<script>',
      '(function () {',
      buildInit(state, mode),
      '})();',
      '<\/script>',
      (mode === 'preview'
        ? ['<div style="position:fixed;left:0;right:0;bottom:0;text-align:center;padding:4px;',
           'font-size:12px;color:#c9bda9;background:rgba(0,0,0,.4);pointer-events:none">',
           '预览：拖动翻页（纸张弯曲）、点锚点查看拍品</div>'].join('')
        : '')
    ].join('\n');

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
