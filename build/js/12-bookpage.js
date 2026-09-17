/* =====================================================================
 * 12-bookpage.js —— 翻书图录页面生成（真实卷曲翻页版）
 *
 * 一本书 = 封面 + N 张内容页 + 封底，按封面比例统一尺寸。
 *
 * 翻页机制：
 *   交给第三方库 @vysmo/flipbook（MIT）—— WebGL 连续曲面卷曲，
 *   前进与回翻走同一条卷曲管道，并支持拖拽跟手（scrub）。
 *   库随产物打包：lib/vysmo-flipbook.min.js（IIFE，经典 <script src> 可用；
 *   产物源在 build/vendor/，升级见 build/mkvysmo.js）。
 *
 * 层次：
 *   <div class="book">  翻页库的 canvas（当前页 + 翻动中的卷曲纸页）
 *   <div class="dots">  360 锚点热区（浮在书页之上）
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
    /* 锚点（.dot，点页面开 360 时那个脉冲圆点）的尺寸与颜色写死在这里：
       面板上没有对应参数，原先的 p.bookDotSize / p.bookDotColor 永远只会
       取到默认值 —— 「代码里像可配、界面里却改不了」的遗留，已清理成常量。 */
    var dot = 16;
    var dotColor = '#ffb340';
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
      '/* 翻动页的背面现在由翻页库着色（纸背颜色 = 参数「纸背颜色」），',
      '   不再铺「淡化版当前页」那一层（老方案要补丁改库的清屏才做得出）。 */',
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
    /* 背面由翻页库着色（参数「纸背颜色」），这里不再铺淡化层 */
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
      '/* 卷边斜向 = 翻页库的铰链倾角（弧度）；纸背颜色是纯色 ——',
      '   不再是「被翻页面的淡化版」（老方案要改库的清屏才做得出）。 */',
      'var TILT = ' + (p.bookCurlTilt === undefined ? .22 : p.bookCurlTilt) + ';',
      'var BACKRGB = ' + (function (hex) {
        var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ''));
        if (!m) return '[0.953, 0.937, 0.902]';
        return '[' + [1, 2, 3].map(function (i) {
          return (parseInt(m[i], 16) / 255).toFixed(3);
        }).join(', ') + ']';
      })(p.bookBackTone || '#f3efe6') + ';',
      '/* 拖拽跟手 / 提交阈值 / 循环 / 预载页数：都来自参数面板 */',
      'var DRAG = ' + (p.bookDrag === false ? 'false' : 'true') + ';',
      'var COMMIT = ' + (p.bookDragCommit === undefined ? .35 : p.bookDragCommit) + ';',
      'var LOOP = ' + (p.bookLoop ? 'true' : 'false') + ';',
      'var PRELOAD = ' + (p.bookPreload === undefined ? 2 : p.bookPreload) + ';',
      '',
      'var bookEl = document.getElementById("book");',
      '/* ---------- 翻页引擎：@vysmo/flipbook（lib/vysmo-flipbook.min.js）----------',
      '   WebGL 连续曲面卷曲。前进与回翻走的是同一条卷曲管道 —— 老的 StPageFlip',
      '   在单页模式下回翻根本不卷曲（官方停更未修），只能靠合成一次手势去绕，',
      '   这里不需要了。它还原生支持拖拽跟手（dragNavigation）。',
      '   单页形态：一屏一页；canvas 铺满容器，而容器（.book-shell）已按封面比例',
      '   和屏幕算好尺寸，这里不再自己算第二遍。',
      '   注意：页面是按纹理直接铺满容器的（与老库行为一致），所以内容图要与书',
      '   尺寸同比例，否则会被拉伸。库只吃图片/canvas、不吃 DOM —— 360 锚点与',
      '   点击由上面的 .dots 层和 bookEl 上的监听承担（见文件后半段）。 */',
      'var phBox = document.getElementById("phBox");',
      'var dotsLayer = document.getElementById("dotsLayer");',
      'var navText = document.getElementById("navText");',
      '/* 只有确实有图的页才交给翻页库：缺图的页它没法渲染，直接跳过 */',
      'var PAGES = SHEETS.filter(function (s) { return !!(s && s.src); });',
      'var total = PAGES.length;',
      'var cur = 0;',
      'var busy = false;',
      'var fb = null;',
      '',
      '/* ---------- 首次加载提示（参数：首次加载提示 / 加载文案 / 显示加载进度）----------',
      '   为什么用 JS 建而不是写进 HTML：html/body 已经铺了桌面背景色，',
      '   这段脚本紧跟着内容执行，屏幕上不会出现白闪；也省得为它单独写一套 CSS。',
      '   文案支持多行（white-space: pre-line）。 */',
      'var LOAD_ON = ' + (p.bookLoadOn === false ? 'false' : 'true') + ';',
      'var LOAD_PROG = ' + (p.bookLoadProg === false ? 'false' : 'true') + ';',
      'var LOAD_TXT = ' + JSON.stringify(
        String(p.bookLoadText || '').replace(/\r\n?/g, '\n').trim() || '正在装帧…') + ';',
      'var bootEl = null;',
      'var _bootAt = Date.now();',
      'if (LOAD_ON) {',
      '  bootEl = document.createElement("div");',
      '  bootEl.id = "bootLoad";',
      '  bootEl.setAttribute("style",',
      '    "position:fixed;inset:0;z-index:200;display:grid;place-items:center;' + 
      'text-align:center;white-space:pre-line;box-sizing:border-box;padding:24px;" +',
      '    "background:' + (p.bookBg || '#2a2118') + ';color:#b9ae9c;font-size:15px;' + 
      'letter-spacing:2px;transition:opacity .35s ease");',
      '  var _btw = document.createElement("div");',
      '  var _bpw = document.createElement("div");',
      '  _btw.className = "bt";',
      '  _btw.textContent = LOAD_TXT;',
      '  _bpw.className = "bp";',
      '  _bpw.setAttribute("style", "margin-top:10px;font-size:13px;opacity:.7");',
      '  /* 必须包一层：.boot 是 grid + place-items:center，',
      '     两个直接子元素会各占一个网格单元、被分别居中（文案跑到 1/4 高、',
      '     进度跑到 3/4 高）。包一层之后整块才居中。 */',
      '  var _bwrap = document.createElement("div");',
      '  _bwrap.appendChild(_btw);',
      '  _bwrap.appendChild(_bpw);',
      '  bootEl.appendChild(_bwrap);',
      '  document.body.appendChild(bootEl);',
      '}',
      'function bootProg(done, all) {',
      '  if (!bootEl || !LOAD_PROG) return;',
      '  var bp = bootEl.querySelector(".bp");',
      '  if (bp) bp.textContent = "已加载 " + done + " / " + all + " 页";',
      '}',
      'function hideBoot() {',
      '  if (!bootEl) return;',
      '  /* 最短 350ms：素材很快就绪时也别「闪一下就没」 */',
      '  var wait = Math.max(0, 350 - (Date.now() - _bootAt));',
      '  setTimeout(function () {',
      '    bootEl.style.opacity = "0";',
      '    setTimeout(function () {',
      '      if (bootEl && bootEl.parentNode) bootEl.parentNode.removeChild(bootEl);',
      '      bootEl = null;',
      '    }, 420);',
      '  }, wait);',
      '}',
      '',
      '/* ---------- 交互示意区（参数：交互示意区 / 示意框位置 / 颜色 / 角臂 / 圆角 / 呼吸 / 延迟）----------',
      '   按需求用「四角」而不是完整边框。「任何底色都看得清」靠双层描边：四角本身是',
      '   浅色描边，外面再套一圈 filter: drop-shadow 的深色描边 —— 亮底图时深色那层可读、',
      '   暗底图时浅色那层可读。不用 mix-blend-mode: difference：它在中间灰的底图上会退化成',
      '   #808080 直接失效，还会被父级任意 opacity/transform/filter 静默破坏。',
      '   样式走动态 <style>：这是一段自包含的小组件，集中在一处便于整体摘除或替换。 */',
      'var HINT_ON = ' + (p.bookHintOn ? 'true' : 'false') + ';',
      'var HINT_BREATH = ' + (p.bookHintBreath === false ? 'false' : 'true') + ';',
      'var HINT_DELAY = ' + (p.bookHintDelay === undefined ? 0 : Number(p.bookHintDelay) || 0) + ';',
      'var HINT_LEN = ' + (p.bookHintLen === undefined ? 12 : Number(p.bookHintLen) || 12) + ';',
      'var HINT_BOX = ' + JSON.stringify((function () {
        var a = String(p.bookHintBox || '').split(',').map(function (s) { return Number(String(s).trim()); });
        if (a.length !== 4 || !a.every(function (n) { return isFinite(n); })) a = [20, 25, 60, 50];
        return a;
      })()) + ';',
      '/* 变量名带 frame 前缀：产物里已有 hintEl / hintTimer 之类的名字，',
      '   同作用域下 var 会互相覆盖（踩过一次，见下面的说明）。 */',
      'var frameEl = null;',
      'var hintTimer = null;',
      'if (HINT_ON) {',
      '  var _hs = document.createElement("style");',
      '  _hs.textContent =',
      '    ".hint{position:absolute;z-index:55;pointer-events:none;opacity:0;" +',
      '    "transition:opacity .32s ease;" +',
      '    "filter:drop-shadow(0 0 2px rgba(0,0,0,.9)) drop-shadow(0 0 7px rgba(0,0,0,.45));}" +',
      '    ".hint.on{opacity:1;}" +',
      '    ".hint .hc{position:absolute;width:var(--hl,40px);height:var(--hl,40px);" +',
      '    "border:3px solid ' + (p.bookHintColor || '#ffffff') + ';border-radius:' + 
      (p.bookHintRadius === undefined ? 6 : Number(p.bookHintRadius) || 0) + 'px;}" +',
      '    ".hint .hc.tl{left:0;top:0;border-right:0;border-bottom:0;}" +',
      '    ".hint .hc.tr{right:0;top:0;border-left:0;border-bottom:0;}" +',
      '    ".hint .hc.bl{left:0;bottom:0;border-right:0;border-top:0;}" +',
      '    ".hint .hc.br{right:0;bottom:0;border-left:0;border-top:0;}" +',
      '    "@keyframes hintBreath{0%,100%{opacity:.5;}50%{opacity:1;}}" +',
      '    ".hint.breath .hc{animation:hintBreath 3.2s ease-in-out infinite;}" +',
      '    "@media (prefers-reduced-motion: reduce){.hint .hc{animation:none;opacity:1;}}" +',
      '    /* 360 弹层打开时藏起来（用 :has 就省掉一处事件挂钩；旧浏览器不支持时',
      '       最多是「弹层上仍看得见框」，而框是 pointer-events:none，不影响操作）*/',
      '    "body:has(.lot-modal.on) .hint{opacity:0 !important;}";',
      '  document.head.appendChild(_hs);',
      '  /* 挂到 .book-shell（书的容器）上而不是翻页库的 #book 里：',
      '     免得和库自己创建的 canvas 混在同一层 DOM 里。',
      '     变量叫 frameEl 而不是 hintEl —— 产物后半段本来就有个同名的',
      '     hintEl（= 360 弹层底部那条提示），var 同作用域会互相覆盖，',
      '     现象是「不报错、也没效果」，示意框永远不显示。踩过一次。 */',
      '  frameEl = document.createElement("div");',
      '  frameEl.id = "hintBox";',
      '  frameEl.className = "hint" + (HINT_BREATH ? " breath" : "");',
      '  frameEl.setAttribute("style", "left:" + HINT_BOX[0] + "%;top:" + HINT_BOX[1] + "%;" +',
      '    "width:" + HINT_BOX[2] + "%;height:" + HINT_BOX[3] + "%;");',
      '  ["tl", "tr", "bl", "br"].forEach(function (c) {',
      '    var e = document.createElement("i");',
      '    e.className = "hc " + c;',
      '    frameEl.appendChild(e);',
      '  });',
      '  (bookEl.parentNode || document.body).appendChild(frameEl);',
      '}',
      'function layoutHint() {',
      '  if (!frameEl) return;',
      '  var r = frameEl.getBoundingClientRect();',
      '  /* 角臂按框的短边算，且不小于 10px —— 框拉得很小时四角不会糊成一团 */',
      '  var len = Math.max(10, Math.round(Math.min(r.width, r.height) * HINT_LEN / 100));',
      '  frameEl.style.setProperty("--hl", len + "px");',
      '}',
      'function showHint(on) { if (frameEl) frameEl.classList.toggle("on", !!on); }',
      '/* 这里原本还有个 RATIO（页面宽高比）变量 —— 那是喂给 CI360 的 aspectRatio 用的；',
      '   画布比例现在由 .book-shell 的 CSS 决定（buildCss 里按封面比例算好），',
      '   运行时用不到它，已删除。 */',
      '',
      '/* 页码、翻页按钮可用状态 */',
      'function syncNav() {',
      '  dotsLayer.innerHTML = (PAGES[cur] && PAGES[cur].dots) ? PAGES[cur].dots : "";',
      '  if (navText) navText.textContent = (cur + 1) + " / " + total;',
      '  var pv = document.getElementById("navPrev"), nx = document.getElementById("navNext");',
      '  /* 循环翻页时首尾不锁 —— 按钮永远可点 */',
      '  if (pv) pv.disabled = (!LOOP && cur === 0);',
      '  if (nx) nx.disabled = (!LOOP && cur === total - 1);',
      '}',
      '',
      '/* 两个方向都走库的 next() / prev()：同一条卷曲管道，没有「回翻不卷」的坑。',
      '   busy 只管按钮与键盘（库内部本来就会忽略动画中的新请求，这里只是避免',
      '   连点把页码和画面搞乱）；拖拽由库自己接管，不受 busy 影响。',
      '   LOOP 打开时首尾相接，所以边界判断要让位。 */',
      'function flipNext() { if (fb && !busy && (LOOP || cur < total - 1)) fb.next(); }',
      'function flipPrev() { if (fb && !busy && (LOOP || cur > 0)) fb.prev(); }',
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
      '  /* 万一翻页库初始化失败，至少把原因显示出来，别留一片空白 */',
      '  try {',
      '  fb = VysmoFlipbook.createFlipbook({',
      '    container: bookEl,',
      '    pages: PAGES.map(function (s) { return s.src; }),',
      '    axis: "horizontal",        /* 从右边缘往左翻（西式书）*/',
      '    tilt: TILT,                /* 卷边斜向：斜着推进，不是整条竖边平移 */',
      '    backColor: BACKRGB,        /* 翻动页背面 = 纸背颜色（纯色）*/',
      '    flipDuration: TURN,',
      '    dragNavigation: DRAG,      /* 拖拽跟手（参数「拖拽翻页」）*/',
      '    dragCommitThreshold: COMMIT,',
      '    loop: LOOP,                /* 参数「循环翻页」*/',
      '    /* 点击留给「点页面开 360」：库不接管点击 */',
      '    clickNavigation: false,',
      '    /* 键盘也自己接（见下面的 keydown），免得和 360 弹层抢 */',
      '    keyboardNavigation: false,',
      '    /* 懒加载：只把当前页和邻近页传上 GPU，长图录也不爆显存 */',
      '    lazy: true,',
      '    preloadWindow: PRELOAD     /* 参数「预载页数」*/',
      '  });',
      '  /* change 在翻到新页后触发（同步页码/热点）；',
      '     flipstart / flipend 管忙标志与收尾；示意框严格跟着这两个事件走：',
      '     翻页一开始就淡出，翻页结束后（按参数延迟）再淡入。 */',
      '  fb.on("change", function (i) { cur = i; syncNav(); layoutHint(); });',
      '  fb.on("flipstart", function () { busy = true; showHint(false); });',
      '  fb.on("flipend", function () {',
      '    busy = false;',
      '    syncNav();',
      '    layoutHint();',
      '    if (!HINT_ON) return;',
      '    if (HINT_DELAY > 0) {',
      '      if (hintTimer) clearTimeout(hintTimer);',
      '      hintTimer = setTimeout(function () { showHint(true); }, HINT_DELAY);',
      '    } else {',
      '      showHint(true);',
      '    }',
      '  });',
      '  } catch (err) {',
      '    if (phBox) {',
      '      phBox.classList.remove("hide");',
      '      phBox.textContent = "翻页器初始化失败：" + (err && err.message);',
      '    }',
      '    if (window.console) console.error("[flip] init failed:", err);',
      '  }',
      '  window.__fb = fb;   /* 诊断用：控制台可直接调 next/prev/goTo/seek */',
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
      '/* ?flip=0.4 想把翻页画面停在指定进度看效果：控制台调 __fb.seek(0.4)，',
      '   库原生支持 scrub，不需要真实拖拽。 */',
      '/* 触屏或窄屏时：关掉 360 查看器的文字提示与操作按钮，纯手势操作 */',
      'var IS_TOUCH = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);',
      'var IS_NARROW = window.innerWidth < 820;',
      'var SIMPLE_UI = IS_TOUCH || IS_NARROW;',
      '/* ---------- 启动 ---------- */',
      '/* 尺寸自适应不用我们管：翻页库用 ResizeObserver 盯着容器，容器一变它自己',
      '   重建缓冲。老库要「销毁 + 重建 + 跳回原页」，是因为基准尺寸由我们算。 */',
      '/* 预检每一页能不能加载：失败的直接从页表里剔掉。',
      '   翻页库要等所有页 decode 完才会 ready，坏图会让它一直等下去（翻页停住）——',
      '   而缺素材是很常见的情况。过滤完再建翻页器。 */',
      'function bootFlip() {',
      '  if (!PAGES.length) { initFlip(); hideBoot(); return; }',
      '  var keep = [], left = PAGES.length;',
      '  bootProg(0, PAGES.length);',
      '  var fin = function (i, pg, ok) {',
      '    if (ok) { keep[i] = pg; }',
      '    bootProg(PAGES.length - left + 1, PAGES.length);',
      '    if (--left === 0) {',
      '      PAGES = keep.filter(function (x) { return !!x; });',
      '      total = PAGES.length;',
      '      initFlip();',
      '      /* 加载提示要等「首帧就位」再收：ready 之后再加一帧，避免看到空书 */',
      '      if (fb && fb.ready && fb.ready.then) {',
      '        fb.ready.then(function () { requestAnimationFrame(hideBoot); });',
      '      } else {',
      '        hideBoot();',
      '      }',
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
    var flipLib = libSrc.replace(/360-view[.]min[.]js$/, 'vysmo-flipbook.min.js');
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
