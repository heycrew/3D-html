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
      '.book-shell{position:relative;' + size + 'border-radius:2px;',
      '  box-shadow:0 18px 46px rgba(0,0,0,.5);}',
      '.book{position:absolute;inset:0;}',
      '/* 翻动页的背面：build/mkflip.js 把库的逐帧清屏改成了透明，',
      '   于是被翻走的那块会露出这张「淡化版当前页」。 */',
      '.flip-back{position:absolute;inset:0;background-repeat:no-repeat;',
      '  background-position:center;background-size:contain;',
      '  opacity:0;pointer-events:none;transition:opacity .12s linear;}',
      '.flip-back.on{opacity:.3;}',
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

      '/* 翻动中的弯曲纸页',
      '   canvas 属于「替换元素」：只写 inset:0 而 width/height 是 auto 时，',
      '   它用自身的 width/height 属性当显示尺寸。高分屏下我们放大了',
      '   backing store，若不显式写 100%，整个画布会跟着被放大出界。 */',

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
      '/* 舞台就是整个屏幕。',
      '   grid-template-* 必须写死：不写的话 grid 行高由内容决定，',
      '   而查看器的 aspect-ratio 会把这一行撑到几千 px，',
      '   连带的 height:100% 也变成那个高度 —— 图片上下被裁掉。 */',
      '.lot-stage{width:100vw;height:100vh;display:grid;place-items:center;',
      '  grid-template-columns:100%;grid-template-rows:100%;position:relative;}',
      '/* CI360 会给容器设 CSS aspect-ratio 并按它撑高（实测 2493px）。',
      '   这里统一压回 100%，尺寸交给舞台；图片本身由下面 canvas 的',
      '   object-fit:contain 居中缩放 —— 完整可见、不变形。 */',
      '.lot-stage .cloudimage-360{width:100% !important;height:100% !important;',
      '  aspect-ratio:auto !important;max-height:100% !important;}',
      '.lot-stage .cloudimage-360-inner-box{width:100% !important;height:100% !important;',
      '  aspect-ratio:auto !important;}',
      '/* 「第 x 页」标题不再显示：弹层里看的是拍品，页号是多余干扰 */',
      '.lot-stage .lot-title{display:none;}',
      '.lot-stage .cloudimage-360 img{object-fit:contain;}',
      /* 画布尺寸交给容器（width/height:100%），显示比例由 object-fit 决定：
         默认 contain —— 素材完整可见、不变形；
         一旦放大，openSheet360 里的 _applyFit 会把 object-fit 换成 cover，
         让放大的画面铺满整个屏幕。
         为什么不能只写一条固定 CSS：CI360 按「容器宽 x 素材宽高比」建画布，
         1:1 素材就是正方形，在更宽的舞台上按素材比例显示时左右必然留空。 */
      '.lot-stage .cloudimage-360 canvas{width:100% !important;height:100% !important;',
      '  object-fit:contain;display:block;}',
      '/* 360 的初始图标（那个 360° 圆标）默认停在查看器正中、正好压住拍品，',
      '   挪到屏幕底部居中。 */',
      '.lot-stage .cloudimage-initial-icon{top:auto !important;bottom:64px !important;',
      '  left:50% !important;transform:translateX(-50%) !important;}',
      '.lot-close{position:absolute;top:22px;right:26px;z-index:5;width:40px;height:40px;border:0;',
      '  border-radius:50%;background:rgba(255,255,255,.14);color:#fff;font-size:20px;',
      '  cursor:pointer;}',
      '.lot-close:hover{background:rgba(255,255,255,.28);}',
      '.lot-hint{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);',
      '  color:rgba(255,255,255,.6);font-size:12px;letter-spacing:1px;z-index:9999;}',

      '@media (max-width:820px){',
      '  /* 手机上靠手势操作 —— 按钮都收起来，但底部那条操作说明要保留：',
      '     它写的就是手机手势，正是给手机用户看的 */',
      '  .book-nav button{display:none;}',
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
    out.push('  <div class="book-shell">');
    out.push('    <div class="flip-back" id="flipBack"></div>');
    out.push('    <div class="book" id="book"></div>');
    out.push('    <div class="ph hide" id="phBox">本页未上传图片</div>');
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
    out.push('<div class="lot-hint" id="lotHint" style="display:none">左右拖动旋转 · 双指放大缩小</div>');

    return out.join('\n');
  }

  /* ---------- 脚本 ---------- */
  function buildInit(state, mode) {
    var p = state.params || {};
    var sheets = sheetList(state, mode);
    /* 页数据 */
    var pages = sheets.map(function (sh) {
      /* items：这一页自己的 360 素材组（点这一页就弹它）
         title：弹层标题 */
      return { kind: sh.kind, src: sh.src,
               items: sh.items || [], title: sh.title || '' };
    });

    var keep = {};
    Object.keys(p).forEach(function (k) {
      if (k.indexOf('book') !== 0) keep[k] = p[k];
    });
    ['folder', 'filenameX', 'amountX', 'indexZeroBase', 'filenameY', 'amountY',
     'filenameGrid', 'imageListX', 'imageListY', 'imageListGrid'].forEach(function (k) {
      delete keep[k];
    });

    return [
      'var SHEETS = ' + SD.Codegen.safeJson(pages, false) + ';',
      'var BASE = ' + SD.Codegen.safeJson(keep, false) + ';',
      '/* 这里原本把书页比例塞给 CI360 的 aspectRatio。实测它只改容器高度',
      '   （1400 -> 1867），对画布尺寸毫无作用 —— CI360 的画布始终是',
      '   「容器宽 x 素材宽高比」。既无收益又把容器撑高，已移除。 */',
      'var INTERP = ' + (p.interp || 0) + ';',
      'var TURN = ' + (p.bookTurn || 700) + ';',
      'var SLICES = ' + (p.bookSlices || 90) + ';',
      'var BEND = ' + (p.bookBend === undefined ? 1.57 : p.bookBend) + ';',
      'var SHADE = ' + (p.bookShade === undefined ? .55 : p.bookShade) + ';',
      'var SKEW = ' + (p.bookSkew === undefined ? 2.6 : p.bookSkew) + ';',
      'var SKEWY = ' + (p.bookSkewY === undefined ? .16 : p.bookSkewY) + ';',
      '/* 卷边斜向：纸面上端比下端超前多少（0 = 整条竖边平移）*/',
      'var CURLTILT = ' + (p.bookCurlTilt === undefined ? .22 : p.bookCurlTilt) + ';',
      'var CAMD = ' + (p.bookCamDist || 3) + ';',
      'var BACKTONE = ' + JSON.stringify(p.bookBackTone || '#f3efe6') + ';',
      '',
      'var bookEl = document.getElementById("book");',
      '/* ---------- 翻页引擎：StPageFlip（lib/page-flip.browser.js）----------',
      '   原先这里是一整套自研的 canvas 卷曲绘制：把纸面切成十几条矩形去近似一张',
      '   连续曲面，条与条之间必然错位 —— 段数少就是台阶（看着像马赛克），',
      '   段数多则每帧绘制次数爆炸。改用成熟库（MIT、零依赖）后，卷曲是连续曲面',
      '   加阴影渐变，既顺滑又不吃性能。',
      '   只用它的单页模式：一屏一页，页面尺寸跟着屏幕走。 */',
      'var bookEl = document.getElementById("book");',
      'var phBox = document.getElementById("phBox");',
      'var dotsLayer = document.getElementById("dotsLayer");',
      'var navText = document.getElementById("navText");',
      'var flipBack = document.getElementById("flipBack");',
      '/* 只有确实有图的页才交给翻页库：缺图的页它没法渲染，直接跳过 */',
      'var PAGES = SHEETS.filter(function (s) { return !!(s && s.src); });',
      'var total = PAGES.length;',
      'var cur = 0;',
      'var busy = false;',
      'var pf = null;',
      '/* 页面宽高比：优先用封面真实比例，否则退回书页设置 */',
      'var RATIO = ' + (function () {
        var cov = (state.book && state.book.cover) || null;
        if (p.bookFit !== 'manual' && cov && cov.w && cov.h) return (cov.w / cov.h);
        return (Number(p.bookW || 900) / Number(p.bookH || 1200));
      })().toFixed(4) + ';',
      '',
      '/* 页码、翻页按钮可用状态 */',
      'function syncNav() {',
      '  dotsLayer.innerHTML = (PAGES[cur] && PAGES[cur].dots) ? PAGES[cur].dots : "";',
      '  if (navText) navText.textContent = (cur + 1) + " / " + total;',
      '  var pv = document.getElementById("navPrev"), nx = document.getElementById("navNext");',
      '  if (pv) pv.disabled = (cur === 0);',
      '  if (nx) nx.disabled = (cur === total - 1);',
      '}',
      '',
      '/* 用 flip(目标页) 而不是 flipNext/flipPrev：后两者是「模拟按书页左右边缘」，',
      '   单页模式下没有左页，flipPrev 会被直接忽略（键盘/按钮回翻不动就是这个原因）。',
      '   flip(页码) 是带动画翻到指定页，两个方向都可靠。 */',
      '/* 被翻动的始终是「当前页」（前进和回翻都是它），所以用 PAGES[cur] 的图。',
      '   翻页一开始铺上、结束就撤掉。 */',
      'function _showBack(on) {',
      '  if (!flipBack) return;',
      '  var src = (on && PAGES[cur] && PAGES[cur].src) ? PAGES[cur].src : null;',
      '  if (src) { flipBack.style.backgroundImage = "url(" + src + ")"; }',
      '  flipBack.classList.toggle("on", !!src);',
      '}',
      '/* 前进用 flipNext()：它走的是「从右边缘翻」的正规路径，卷曲动画正常；',
      '   换成 flip(页码) 会走 flipToPage（先挪展开索引再翻），观感变成整页平移。 */',
      'function flipNext() { if (pf && cur < total - 1) { busy = true; _showBack(true); pf.flipNext(); } }',
      '/* 回翻不能用 flipPrev()/flip(cur-1)：单页模式下库把「左边缘」当成不可翻',
      '   区域，这种调用会被静默忽略（实测页码 3->3 纹丝不动，还不报错）。',
      '   但它自己的拖拽路径是好的，所以这里合成一次「从左往右拖」的手势，',
      '   走的还是库的动画流程。 */',
      'function _swipeBack() {',
      '  var r = bookEl.getBoundingClientRect();',
      '  var y = Math.round(r.top + r.height / 2);',
      '  var x0 = Math.round(r.left + r.width * 0.25);',
      '  var x1 = Math.round(r.left + r.width * 0.8);',
      '  var fire = function (type, x) {',
      '    var ev = new MouseEvent(type, { bubbles: true, cancelable: true,',
      '      clientX: x, clientY: y, button: 0, buttons: 1, view: window });',
      '    /* mousedown 必须落在「书页元素」上，跟真实拖动一样：直接发给外层',
      '       容器的话，库的命中判断会当成没点在书上，整个手势被忽略。 */',
      '    var tgt = (type === "mousedown") ? (document.elementFromPoint(x, y) || document) : document;',
      '    tgt.dispatchEvent(ev);',
      '  };',
      '  fire("mousedown", x0);',
      '  /* 逐帧推进，别在一帧里瞬移：库是按「拖动中的手指位置」实时折叠纸张的，',
      '     同步派完所有 mousemove 等于瞬间拖到位 —— 中间过程一帧都不显示，',
      '     看上去就跟「整块返回」一样。 */',
      '  var step = 0, N = 10;',
      '  var tick = function () {',
      '    step++;',
      '    fire("mousemove", Math.round(x0 + (x1 - x0) * step / N));',
      '    if (step < N) { setTimeout(tick, 16); } else { fire("mouseup", x1); }',
      '  };',
      '  setTimeout(tick, 16);',
      '}',
      'function flipPrev() { if (pf && cur > 0) { busy = true; _showBack(true); _swipeBack(); } }',
      '',
      'function initFlip() {',
      '  if (!total) {',
      '    /* 一页有图的都没有：只留占位提示，不建翻页器 */',
      '    if (phBox) phBox.classList.remove("hide");',
      '    if (bookEl) bookEl.style.display = "none";',
      '    syncNav();',
      '    return;',
      '  }',
      '  if (phBox) phBox.classList.add("hide");',
      '  /* 基准页尺寸直接量容器：容器（.book-shell）已按封面比例和屏幕',
      '     算好尺寸。若这里再按窗口另算一遍，手机上会得到比容器更大的',
      '     尺寸（实测 633x844 vs 容器 390x520），书就被裁掉一块。 */',
      '  var _bb = bookEl.getBoundingClientRect();',
      '  var bw = Math.max(1, Math.round(_bb.width));',
      '  var bh = Math.max(1, Math.round(_bb.height));',
      '  /* 万一翻页库初始化失败，至少把原因显示出来，别留一片空白 */',
      '  try {',
      '  pf = new St.PageFlip(bookEl, {',
      '    width: bw, height: bh,',
      '    /* 必须 fixed：stretch 会按「窗口」尺寸判定单页/对开，' + 
      '       宽屏下就变成左右两页了；fixed 用我们按容器算好的尺寸。 */',
      '    size: "fixed",',
      '    usePortrait: true,',
      '    showCover: true,',
      '    flippingTime: TURN,',
      '    maxShadowOpacity: ' + (p.bookShade === undefined ? .55 : p.bookShade) + ',',
      '    drawShadow: true,',
      '    mobileScrollSupport: true,',
      '    /* 点击留给「点页面开 360」：翻页只走拖拽、角落与按钮 */',
      '    disableFlipByClick: true,',
      '    useMouseEvents: true',
      '  });',
      '  pf.loadFromImages(PAGES.map(function (s) { return s.src; }));',
      '  pf.on("flip", function (e) { cur = e.data; busy = false; _showBack(false); syncNav(); });',
      '  pf.on("changeState", function (e) { if (e.data === "read") busy = false; });',
      '  } catch (err) {',
      '    if (phBox) {',
      '      phBox.classList.remove("hide");',
      '      phBox.textContent = "翻页器初始化失败：" + (err && err.message);',
      '    }',
      '    if (window.console) console.error("[flip] init failed:", err);',
      '  }',
      '  window.__pf = pf;   /* 诊断用：控制台可直接调 flip/turnToPage */',
      '  syncNav();',
      '}',
      '',
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
      '/* 显示方式的轮询句柄：弹层开着时定时同步画布的 object-fit，',
      '   关掉弹层立刻清掉（由谁驱动见 openSheet360 末尾的说明）。 */',
      'var fitTimer = null;',
      'function destroyViewer() {',
      '  if (fitTimer) { clearInterval(fitTimer); fitTimer = null; }',
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
      '  /* 操作说明按设备给：手机上缩放靠双指；电脑上是滚轮 / 双击。',
      '     SIMPLE_UI = 触摸屏或窄屏（和上面 zoomControls 用的是同一个判断）。 */',
      '  if (hintEl) {',
      '    hintEl.textContent = SIMPLE_UI',
      '      ? "左右拖动旋转 · 双指放大缩小"',
      '      : "左右拖动旋转 · 滚轮 / 双击缩放";',
      '    hintEl.style.display = "";',
      '  }',
      '',
      '  var cfg = {};',
      '  for (var k in BASE) cfg[k] = BASE[k];',
      '  var _go = function (xlist) {',
      '  if (xlist && xlist.length) { cfg.imageListX = xlist; cfg.amountX = xlist.length; }',
      '  if (lot.y && lot.y.length) { cfg.imageListY = lot.y; cfg.amountY = lot.y.length; }',
      '  /* 不主动塞 aspectRatio：实测它只改容器高度、对画布尺寸无效。',
      '     画布尺寸由 CI360 按「容器宽 x 素材宽高比」决定，显示比例交给 object-fit。 */',
      '  /* CI360 自带的操作提示都是英文（Drag to rotate / Double-click to zoom /',
      '     Ctrl + scroll），跟弹层底部那条中文说明并排会中英混杂。',
      '     这里一律关掉，只保留中文说明。 */',
      '  cfg.hints = false;',
      '  cfg.scrollHint = false;',
      '  if (SIMPLE_UI) {',
      '    cfg.zoomControls = false;   /* 手机上不显示缩放按钮组，纯手势操作 */',
      '  }',
      '',
      '  var el = document.createElement("div");',
      '  el.className = "cloudimage-360";',
      '  el.id = "lotViewer";',
      '  stage.appendChild(el);',
      '  var ci = (typeof window.CI360 === "function") ? new window.CI360() : window.CI360;',
      '  /* init() 的返回值就是查看器实例（isZoomed 挂在它上面）。',
      '     不用配置回调 onZoomIn/onZoomChange：那是 CI360 的原型内部方法',
      '     （负责取消惯性、显隐控件），覆盖掉会破坏它自己的行为。 */',
      '  var viewer = null;',
      '  try { viewer = ci.init(el, cfg); } catch (e) { titleEl.textContent = "加载失败：" + e.message; }',
      '  /* 画布显示方式按缩放状态切换。',
      '     为什么必须切换：CI360 按「容器宽 x 素材宽高比」建画布 —— 1:1 的素材',
      '     就是正方形（实测 1400x1400），而舞台是整屏（1400x780，更宽）。',
      '     一直按素材比例 contain 居中显示，放大后画面只会占据屏幕中间一块、',
      '     左右留空 —— 也就是「放大时没有铺满整个屏幕」。所以：',
      '       未放大 -> contain：素材完整可见、不变形；',
      '       已放大 -> cover  ：铺满整个屏幕。放大本就是看局部，被裁掉的部分',
      '                        可以拖动平移补看（CI360 的 zoomPan 已支持）。',
      '     是否放大取自查看器实例的 isZoomed，见下面的 _isZoomed()。 */',
      '  /* 当前是否处于放大状态。只认查看器实例上的 isZoomed（实测：初始为',
      '     null、放大后为 true）；读不到就返回 null 表示「不确定」—— 调用方',
      '     遇到 null 一律不动，免得把已经正确的状态覆盖掉。 */',
      '  function _isZoomed() {',
      '    try {',
      '      if (viewer && typeof viewer.isZoomed === "boolean") return viewer.isZoomed;',
      '      var _zp = viewer && viewer.zoomPan;',
      '      if (_zp && typeof _zp.getZoom === "function") {',
      '        var _z = _zp.getZoom();',
      '        if (typeof _z === "number") return _z > 1.001;',
      '      }',
      '    } catch (err) {}',
      '    return null;',
      '  }',
      '  function _applyFit() {',
      '    var zoomed = _isZoomed();',
      '    if (zoomed === null) return;           /* 状态未知 -> 保持现状 */',
      '    var fit = zoomed ? "cover" : "contain";',
      '    var _cs = stage.querySelectorAll("canvas");',
      '    for (var _j = 0; _j < _cs.length; _j++) {',
      '      var _c = _cs[_j];',
      '      /* 只在真的变了才写：轮询每 200ms 调一次，避免无谓的样式重算 */',
      '      if (_c.style.getPropertyValue("object-fit") !== fit) {',
      '        _c.style.setProperty("width", "100%", "important");',
      '        _c.style.setProperty("height", "100%", "important");',
      '        _c.style.setProperty("object-fit", fit, "important");',
      '        _c.style.setProperty("display", "block", "important");',
      '      }',
      '    }',
      '  }',
      '  _applyFit();',
      '  requestAnimationFrame(function () { _applyFit(); });',
      '  setTimeout(function () { _applyFit(); }, 120);',
      '  /* 用轮询而不是 CI360 的缩放回调：一是那些回调会覆盖它的原型内部方法，',
      '     二是重置路径未必派发事件。弹层开着时每 200ms 对一次状态，关闭时由',
      '     destroyViewer 清掉；状态读不到就不动（见 _isZoomed）。 */',
      '  if (fitTimer) clearInterval(fitTimer);',
      '  fitTimer = setInterval(function () { _applyFit(); }, 200);',
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
      '  var sh = PAGES[cur];',
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
      '/* ---------- 启动 ---------- */',
      '/* 尺寸自适应由翻页库自己处理（它监听 resize），这里只建一次 */',
      '/* 窗口尺寸变了：fixed 模式下基准尺寸是我们自己算的，得重算并重建',
      '   （保留当前页），否则书会停在旧尺寸上。 */',
      'var _rsTimer = null;',
      'window.addEventListener("resize", function () {',
      '  clearTimeout(_rsTimer);',
      '  _rsTimer = setTimeout(function () {',
      '    var keep = cur;',
      '    if (pf) { try { pf.destroy(); } catch (e) {} pf = null; }',
      '    bookEl.innerHTML = "";',
      '    initFlip();',
      '    if (pf && keep > 0) { try { pf.turnToPage(keep); syncNav(); } catch (e) {} }',
      '  }, 250);',
      '});',
      '/* 预检每一页能不能加载：失败的直接从页表里剔掉。',
      '   否则翻页库会一直停在 loading（转圈图标常驻），翻页整个卡住 ——',
      '   而缺素材是很常见的情况。过滤完再建翻页器。 */',
      'function bootFlip() {',
      '  if (!PAGES.length) { initFlip(); return; }',
      '  var keep = [], left = PAGES.length;',
      '  var fin = function (i, pg, ok) {',
      '    if (ok) { keep[i] = pg; }',
      '    if (--left === 0) {',
      '      PAGES = keep.filter(function (x) { return !!x; });',
      '      total = PAGES.length;',
      '      initFlip();',
      '    }',
      '  };',
      '  PAGES.forEach(function (pg, i) {',
      '    var im = new Image();',
      '    im.onload = function () { fin(i, pg, true); };',
      '    im.onerror = function () { fin(i, pg, false); };',
      '    im.src = pg.src;',
      '  });',
      '}',
      'bootFlip();'
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
    /* 翻页库与 360 库放同一目录 */
    var flipLib = libSrc.replace(/360-view[.]min[.]js$/, 'page-flip.browser.js');
    var tail = [
      '',
      '<script src="' + libSrc + '"><\/script>',
      '<script src="' + flipLib + '"><\/script>',
      '<script>',
      '(function () {',
      buildInit(state, mode),
      '})();',
      '<\/script>',
      (mode === 'preview'
        ? ['<div style="position:fixed;left:0;right:0;bottom:0;text-align:center;padding:4px;',
           'font-size:12px;color:#c9bda9;background:rgba(0,0,0,.4);pointer-events:none">',
           '预览：拖动翻页（纸张弯曲）、点页面查看 360</div>'].join('')
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
