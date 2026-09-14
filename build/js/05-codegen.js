/* =====================================================================
 * 05-codegen.js —— 产物 HTML 代码生成
 *
 * 同一份生成逻辑同时服务「预览」「导出」，保证所见即所得。
 * 两个实测结论固化在这里：
 *   1) 4.10.0 把「实例」挂到 window.CI360，不能照抄 README 的 new CI360()
 *   2) 库只认普通 HTTP URL，所以预览用上传后的 /@mat/... URL，
 *      产出物则用 folder + filenameX 指向 images/ 目录
 * ===================================================================== */
window.SD = window.SD || {};

SD.Codegen = (function () {

  var LIB_HREF = './lib/360-view.min.js';
  var LIB_CDN = 'https://cdn.cloudimage.io/360-view/4.10.0/360-view.min.js';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* JSON → 可安全放进 <script> 的字面量 */
  function safeJson(obj, pretty) {
    var t = JSON.stringify(obj, null, pretty ? 2 : 0);
    return (t === undefined ? '{}' : t).replace(/<\//g, '<\\/');
  }

  function parseList(txt) {
    if (!txt) return [];
    return String(txt).split(/\r?\n/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; });
  }

  /* 当前生效的素材（排除被手动剔除的帧） */
  function activeItems(state) {
    var m = state.materials || {};
    return (m.items || []).filter(function (it) { return !it.off; });
  }

  /* ---------- 打开方式守卫 ----------
     双击 index.html 会以 file:// 打开，而 CI360 给每张图设了
     crossOrigin="anonymous"，file:// 下请求会被浏览器拦掉 ——
     画面退化成一个低分辨率版本且拖不动。这里直接拦下来讲清楚。 */
  function fileWarn() {
    return [
      '<div id="fileWarn" class="file-warn">',
      '  <div>',
      '    <h3>\u26a0 \u6253\u5f00\u65b9\u5f0f\u4e0d\u5bf9</h3>',
      '    <p>\u4f60\u6b63\u5728\u7528\u300c\u53cc\u51fb index.html\u300d\u7684\u65b9\u5f0f\u6253\u5f00\u9875\u9762\uff08<code>file://</code> \u534f\u8bae\uff09\u3002</p>',
      '    <p>360\u00b0 \u67e5\u770b\u5668\u5728\u8fd9\u79cd\u6a21\u5f0f\u4e0b<strong>\u65e0\u6cd5\u52a0\u8f7d\u56fe\u7247</strong>\uff0c\u753b\u9762\u4f1a\u6a21\u7cca\u3001\u4e5f\u4e0d\u80fd\u62d6\u52a8\u3002</p>',
      '    <p>\u8bf7<strong>\u5173\u95ed\u672c\u9875</strong>\uff0c\u6539\u4e3a\u53cc\u51fb\u540c\u76ee\u5f55\u4e0b\u7684 <code>\u542f\u52a8.bat</code>\u3002</p>',
      '  </div>',
      '</div>',
      '<style>',
      '.file-warn{position:fixed;inset:0;z-index:999999;display:none;place-items:center;',
      '  background:rgba(24,18,12,.94);padding:24px;text-align:center;',
      '  font-family:-apple-system,"Microsoft YaHei","PingFang SC",sans-serif;color:#fff;}',
      '.file-warn>div{max-width:540px;background:#2b2118;border:1px solid #5a4632;',
      '  border-radius:12px;padding:26px 28px;box-shadow:0 20px 60px rgba(0,0,0,.6);}',
      '.file-warn h3{margin:0 0 14px;font-size:19px;color:#ffcf70;}',
      '.file-warn p{margin:0 0 10px;line-height:1.85;font-size:14px;color:#e8dccb;}',
      '.file-warn code{background:#1a130d;padding:1px 6px;border-radius:4px;color:#ffcf70;}',
      '.file-warn strong{color:#fff;}',
      '</style>',
      '<script>(function(){ if (location.protocol === "file:") {',
      '  var w = document.getElementById("fileWarn"); if (w) { w.style.display = "grid"; } }})();<\/script>'
    ].join('\n');
  }

  var IMAGE_KEYS = ['folder', 'filenameX', 'amountX', 'indexZeroBase',
                    'filenameY', 'amountY', 'filenameGrid',
                    'imageListX', 'imageListY', 'imageListGrid'];

  /* 最大公约数 → 把 w/h 化成 4/3、1/1 这样的比例串 */
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = a % b; a = b; b = t; } return a || 1; }

  function sizeRatio(it) {
    if (!it || !it.w || !it.h) return '';
    var g = gcd(it.w, it.h);
    return (it.w / g) + '/' + (it.h / g);
  }

  function clearImageKeys(cfg) {
    IMAGE_KEYS.forEach(function (k) { delete cfg[k]; });
  }

  /* ---------- 生成 v4 配置对象 ----------
   * opts.mode:
   *   'preview' → imageListX = 上传后的真实 HTTP URL（本地服务 /@mat/...）
   *   'files'   → folder + filenameX + amountX（导出为 images/ 目录）
   *   'inline'  → imageListX = data: URL（单文件交付）
   */
  function buildConfig(state, opts) {
    opts = opts || {};
    var mode = opts.mode || 'files';
    var cfg = {};
    var p = state.params || {};

    SD.allParams().forEach(function (d) {
      var v = p[d.key];
      if (v === undefined || v === null || v === '') return;
      if (d.type === 'list') {
        var arr = parseList(v);
        if (arr.length) cfg[d.key] = arr;
        return;
      }
      if (d.type === 'tri') { cfg[d.key] = !!v; return; }
      cfg[d.key] = v;
    });

    if (SD.Hotspots) SD.Hotspots.applyTo(cfg);

    var m = state.materials || {};
    var items = activeItems(state);
    if (!items.length) return cfg;

    /* 容器比例默认跟随素材。否则 CI360 会按图片比例把 canvas 撑出视口：
       画面被放大裁切（看着发虚）+ 页面出现滚动条，拖动也会被带偏。 */
    if (!cfg.aspectRatio) {
      var autoRatio = sizeRatio(items[0]);
      if (autoRatio) cfg.aspectRatio = autoRatio;
    }

    var xs = items.filter(function (it) { return (it.axis || 'x') !== 'y'; });
    var ys = items.filter(function (it) { return it.axis === 'y'; });

    if (mode === 'files') {
      clearImageKeys(cfg);
      cfg.folder = m.folder || './images/';
      if (xs.length) {
        cfg.filenameX = m.filenameX || 'frame-{index}.jpg';
        cfg.amountX = xs.length;
        cfg.indexZeroBase = m.pad || 0;
      }
      if (ys.length) {
        cfg.filenameY = m.filenameY || 'vframe-{index}.jpg';
        cfg.amountY = ys.length;
      }
    } else if (mode === 'inline') {
      clearImageKeys(cfg);
      if (xs.length) cfg.imageListX = xs.map(function (it) { return it.dataUrl || it.name; });
      if (ys.length) cfg.imageListY = ys.map(function (it) { return it.dataUrl || it.name; });
    } else {
      clearImageKeys(cfg);
      if (xs.length) cfg.imageListX = xs.map(function (it) { return it.url || it.name; });
      if (ys.length) cfg.imageListY = ys.map(function (it) { return it.url || it.name; });
    }
    return cfg;
  }

  function initScript(cfg, opts) {
    var external = !opts || opts.external === undefined ? true : opts.external;
    var line = external
      ? '  var ci = (typeof window.CI360 === "function") ? new window.CI360() : window.CI360;'
      : '  var ci = (typeof window.CI360 === "function") ? new window.CI360() : window.CI360;';
    return [
      '(function () {',
      '  var el = document.getElementById("viewer");',
      '  var config = ' + safeJson(cfg, true) + ';',
      line,
      '  ci.init(el, config);',
      '})();'
    ].join('\n');
  }

  /* ---------- 完整产物 HTML ---------- */
  function buildHtml(state, opts) {
    opts = opts || {};
    var mode = opts.mode || 'files';

    /* 拍品列表（博古架）走独立生成器 */
    if (state.pageType === 'lots' && SD.Bogu) {
      return SD.Bogu.buildHtml(state, opts);
    }

    var tpl = SD.templateById(state.templateId);
    var cfg = buildConfig(state, { mode: mode });
    var title = state.title || '360° 产品展示';
    var libSrc = opts.libHref || LIB_HREF;

    var libTag = '<script src="' + esc(libSrc) + '"><\/script>';

    return [
      '<!DOCTYPE html>',
      '<html lang="zh-CN">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      '<title>' + esc(title) + '</title>',
      '<style>',
      tpl.css,
      (state.customCss || ''),
      '</style>',
      '</head>',
      '<body>',
      '',
      fileWarn(),
      '',
      tpl.body,
      '',
      '<!-- Cloudimage 360 View 4.10.0 (MIT License) -->',
      libTag,
      '<script>',
      initScript(cfg),
      '<\/script>',
      '</body>',
      '</html>',
      ''
    ].join('\n');
  }

  /* ---------- 供嵌入已有页面的片段（走 CDN） ---------- */
  function buildSnippet(state) {
    var cfg = buildConfig(state, { mode: 'files' });
    var tpl = SD.templateById(state.templateId);
    return [
      '<style>',
      tpl.css,
      '</style>',
      '<div id="viewer" class="cloudimage-360"></div>',
      '<script src="' + LIB_CDN + '"><\/script>',
      '<script>',
      initScript(cfg),
      '<\/script>'
    ].join('\n');
  }

  return {
    esc: esc,
    fileWarn: fileWarn,
    safeJson: safeJson,
    parseList: parseList,
    activeItems: activeItems,
    buildConfig: buildConfig,
    buildHtml: buildHtml,
    buildSnippet: buildSnippet,
    LIB_HREF: LIB_HREF,
    LIB_CDN: LIB_CDN
  };
})();
