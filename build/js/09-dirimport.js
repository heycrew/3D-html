/* =====================================================================
 * 09-dirimport.js —— 批量导入：目录树识别
 *
 * 纯函数：输入「文件路径表」，输出「这本书长什么样」。
 * 不碰 DOM、不碰 SD.STATE、不发请求 —— 这样可以在探针里直接喂假路径断言
 * （见 build/.verify/probe_dirimport.py）。
 *
 * 认识的目录形态（真实图录就是这么摆的）：
 *   根/封面.jpg          → 封面
 *   根/封底.jpg          → 封底
 *   根/1/0.jpg           → 第 1 页的本页图
 *   根/1/1.JPG 2.JPG …   → 第 1 页的 360 帧（按数字排序）
 * ===================================================================== */
window.SD = window.SD || {};

SD.DirImport = (function () {
  var IMG_RE = /\.(jpe?g|png|webp|gif|bmp|avif|tiff?)$/i;
  var NUM_RE = /^\d+$/;
  var WARN_PAGES = 300;      /* 超过这个页数要在预览里二次确认（不硬拒） */

  function stem(name) { return String(name || '').replace(/\.[^.]+$/, '').trim(); }
  function isImage(name) { return IMG_RE.test(String(name || '')); }
  /* macOS 会往目录里塞 .DS_Store 与 ._xxx 资源叉文件；
     后者扩展名可能是 .jpg，不过滤就会被当成图片混进帧序。 */
  function isJunk(name) { return String(name || '').charAt(0) === '.'; }
  /* 输出项统一成 { name, file, path }（见设计文档 §4.2）：
     name 从路径末段取出 —— 真实 entry 只保证有 path（取自 webkitRelativePath）与 file。 */
  function item(e, p, name) { return { name: name, file: e.file || null, path: p }; }

  function scan(entries) {
    var list = (entries || []).filter(function (e) { return e && e.path; });
    var warnings = [];
    var system = 0, other = 0;
    var cover = null, back = null;
    var byPage = {};
    var nonNumDirs = {}, nestedDirs = {};
    var dupFrame = 0;

    var root = '';
    list.forEach(function (e) {
      var p = String(e.path).replace(/\\/g, '/');
      var i = p.indexOf('/');
      if (i < 0) return;                          /* 没有目录层，忽略 */
      var seg = p.slice(i + 1).split('/');
      if (!seg.length || !seg[seg.length - 1]) return;
      if (!root) root = p.slice(0, i);
      var name = seg[seg.length - 1];
      if (isJunk(name)) { system += 1; return; }

      if (seg.length === 1) {
        /* 根目录下的文件：只看封面 / 封底 */
        if (!isImage(name)) { other += 1; return; }
        var st = stem(name);
        if (st === '封面') {
          if (!cover) cover = item(e, p, name);
          else warnings.push({ code: 'multi-cover',
                               text: '根目录下有多个「封面」，已忽略：' + name });
          return;
        }
        if (st === '封底') {
          if (!back) back = item(e, p, name);
          else warnings.push({ code: 'multi-back',
                               text: '根目录下有多个「封底」，已忽略：' + name });
          return;
        }
        other += 1;
        return;
      }

      if (seg.length > 2) { nestedDirs[seg[0]] = 1; return; }

      var dir = seg[0];
      if (!NUM_RE.test(dir)) { nonNumDirs[dir] = 1; return; }
      var no = parseInt(dir, 10);
      if (!(no >= 1)) { other += 1; return; }
      if (!isImage(name)) { other += 1; return; }
      var slot = byPage[no] || (byPage[no] = { no: no, pageImg: null, frames: [] });
      if (stem(name) === '0') {
        if (!slot.pageImg) slot.pageImg = item(e, p, name); else other += 1;
      } else {
        var fname = name;
        var dup = slot.frames.some(function (f) { return f.name === fname; });
        if (dup) dupFrame += 1; else slot.frames.push(item(e, p, name));
      }
    });

    /* 帧序：用与上传同一处的比较器，避免两套规则漂移 */
    var nc = (SD.Materials && SD.Materials.naturalCompare) || null;
    var nos = Object.keys(byPage).map(Number).sort(function (a, b) { return a - b; });
    var maxNo = nos.length ? nos[nos.length - 1] : 0;
    var pages = [];
    var images = 0;
    if (cover) images += 1;
    if (back) images += 1;
    for (var n = 1; n <= maxNo; n++) {
      var s = byPage[n] || { no: n, pageImg: null, frames: [] };
      s.frames.sort(function (a, b) {
        return nc ? nc(a.name, b.name)
                  : String(a.name).localeCompare(String(b.name), 'zh-Hans-CN',
                      { numeric: true, sensitivity: 'base' });
      });
      pages.push({ no: n, pageImg: s.pageImg, frames: s.frames });
      if (s.pageImg) images += 1;
      images += s.frames.length;
      if (!s.pageImg) warnings.push({ code: 'page-without-image', text: '第 ' + n + ' 页没有 0.* 本页图' });
      if (!s.frames.length) warnings.push({ code: 'page-without-frames', text: '第 ' + n + ' 页没有 360 素材' });
    }

    if (!cover) warnings.push({ code: 'no-cover', text: '根目录下没找到「封面.xxx」' });
    if (!back) warnings.push({ code: 'no-back', text: '根目录下没找到「封底.xxx」' });
    if (!pages.length) warnings.push({ code: 'no-pages', text: '没有识别到任何数字命名的子目录（内容页）' });
    Object.keys(nonNumDirs).forEach(function (d) {
      warnings.push({ code: 'non-numeric-dir', text: '忽略非数字目录：' + d + '/' });
    });
    Object.keys(nestedDirs).forEach(function (d) {
      warnings.push({ code: 'nested-dir', text: '忽略更深层的目录：' + d + '/…' });
    });
    if (dupFrame) warnings.push({ code: 'duplicate-frame', text: '有 ' + dupFrame + ' 个重名帧被跳过' });
    if (pages.length > WARN_PAGES) {
      warnings.push({ code: 'too-many-pages',
                      text: '识别到 ' + pages.length + ' 页，超过 ' + WARN_PAGES + ' 页，导入前请确认' });
    }
    if (other) warnings.push({ code: 'ignored-files', text: '另有 ' + other + ' 个文件认不出，已跳过' });

    return {
      root: root,
      cover: cover, back: back,
      pages: pages,
      total: { pages: pages.length, images: images },
      skipped: { system: system, other: other },
      warnings: warnings
    };
  }

  return { scan: scan, WARN_PAGES: WARN_PAGES };
})();
