/* =====================================================================
 * 07-export.js —— 导出器
 *
 * 主路径：File System Access API（showDirectoryPicker）直接把整个产物目录
 * 写到磁盘 —— 工作台跑在 http://localhost 下属于安全上下文，该 API 可用。
 * 产物结构：
 *     导出/
 *     ├─ index.html          引用 ./lib/ 与 ./images/
 *     ├─ images/             frame-1.jpg …
 *     ├─ lib/360-view.min.js
 *     ├─ serve.ps1
 *     ├─ 启动.bat
 *     └─ 使用说明.txt
 * ===================================================================== */
window.SD = window.SD || {};

SD.Export = (function () {

  function canPickDir() {
    return typeof window.showDirectoryPicker === 'function';
  }

  function extOf(name) {
    var m = /\.([a-z0-9]+)$/i.exec(String(name || ''));
    return m ? '.' + m[1].toLowerCase() : '.png';   /* 与 12-bookpage 的 extOfName 保持一致 */
  }

  /* 导出时统一重命名，保证 {index} 模板与排序都可靠 */
  function planNames(items) {
    var xi = 0, yi = 0, out = [];
    for (var i = 0; i < items.length; i++) {
      var ext = extOf(items[i].name);
      if (items[i].axis === 'y') { yi++; out.push('vframe-' + yi + ext); }
      else { xi++; out.push('frame-' + xi + ext); }
    }
    return out;
  }

  function batContent(openFile, port) {
    return [
      '@echo off',
      'cd /d "%~dp0"',
      'powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port ' + (port || 8790) +
        ' -Open "' + openFile + '"',
      'echo.',
      'echo Server stopped.',
      'pause',
      ''
    ].join('\r\n');
  }

  function readmeText(state, count, names) {
    return [
      '360° 产品展示 —— 使用说明',
      '========================================',
      '',
      '【怎么打开】',
      '  直接双击 index.html 通常看不到图片：Cloudimage 360 View 会给每张图',
      '  设置 crossOrigin="anonymous"，浏览器在 file:// 协议下会拦掉这些请求。',
      '  请改为双击 启动.bat —— 它会用 Windows 自带的 PowerShell 起一个本地',
      '  服务并自动打开浏览器（不需要安装任何东西，也不需要管理员权限）。',
      '',
      '【目录说明】',
      '  index.html            展示页面（不要改名）',
      '  images/               图片素材，共 ' + count + ' 张',
      '  lib/360-view.min.js   360 查看器库（Cloudimage 360 View 4.10.0，MIT）',
      '  serve.ps1             本地服务脚本（由 启动.bat 调用）',
      '  启动.bat              双击即可预览',
      '',
      '【怎么放到服务器上】',
      '  把整个文件夹上传到网站目录即可，无需 PHP / Node 等运行环境。',
      '  访问 index.html 就是成品页面。',
      '',
      '【当前配置】',
      '  页面模板：' + (state.templateId || ''),
      '  素材张数：' + count,
      '  图片顺序：' + names.join('、'),
      '',
      '【手动导出时注意】',
      '  images/ 里的文件名必须与 index.html 中 filenameX 的 {index} 模板一致，',
      '  序号从 1 开始。',
      ''
    ].join('\r\n');
  }

  /* ---------- 读写辅助 ---------- */
  function fetchBytes(rel) {
    return fetch(rel, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('读取 ' + rel + ' 失败（' + r.status + '）');
      return r.arrayBuffer();
    });
  }

  async function writeIn(dir, relPath, data) {
    var parts = String(relPath).split('/');
    var name = parts.pop();
    var cur = dir;
    for (var i = 0; i < parts.length; i++) {
      cur = await cur.getDirectoryHandle(parts[i], { create: true });
    }
    var fh = await cur.getFileHandle(name, { create: true });
    var w = await fh.createWritable();
    await w.write(data);
    await w.close();
  }

  /* ---------- 主流程：写到一个用户选择的目录 ---------- */
  async function exportToDirectory(state, onProgress) {
    var items = SD.Codegen.activeItems(state);
    var isLots = state.pageType === 'lots';
    var isBook = state.pageType === 'book';
    if (isBook) {
      var bk0 = state.book || {};
      var nPage0 = (bk0.pages || []).filter(function (x) { return x && x.url; }).length;
      if (!(bk0.cover && bk0.cover.url) && !nPage0) {
        throw new Error('书里还没有内容：请先上传封面或内容页图片');
      }
    } else if (isLots) {
      SD.Lots.saveCurrent();
      var lotTotal = (state.lots || []).reduce(function (n, l) {
        return n + SD.Bogu.onItems(l).length;
      }, 0);
      if (!lotTotal) throw new Error('还没有拍品素材，先给拍品导入图片');
    } else if (!items.length) {
      throw new Error('还没有素材，先导入图片或载入示例');
    }

    var names = isLots
      ? (state.lots || []).map(function (l, i) { return (l.title || ('拍品' + (i + 1))); })
      : planNames(items);
    var dir;
    try {
      dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'ci360-export' });
    } catch (e) {
      if (e && e.name === 'AbortError') return { cancelled: true };
      throw e;
    }

    var nImgs = isLots
      ? (state.lots || []).reduce(function (n, l) { return n + SD.Bogu.onItems(l).length; }, 0)
      : (isBook ? (function () {
          var bk1 = state.book || {};
          var n = (bk1.cover && bk1.cover.url) ? 1 : 0;
          n += (bk1.pages || []).filter(function (x) { return x && x.url; }).length;
          n += (bk1.back && bk1.back.url) ? 1 : 0;
          return n;
        })() : items.length);
    var total = nImgs + 4;
    var step = 0;
    function tick(label) {
      step++;
      if (onProgress) onProgress(step, total, label);
    }

    /* 0) 先把导出文件名算好 —— Bogu.buildHtml 生成页面时会引用它，
          必须赶在 buildHtml 之前完成，否则页面里的图片路径会变成 undefined */
    if (isLots) {
      (state.lots || []).forEach(function (lot) {
        var lotItems = SD.Bogu.onItems(lot);
        var ci = 0, cy = 0;
        lotItems.forEach(function (it) {
          var ex = extOf(it.name);
          if (it.axis === 'y') { cy++; it.exportName = 'vframe-' + cy + ex; }
          else { ci++; it.exportName = 'frame-' + ci + ex; }
        });
      });
    }

    /* 1) index.html —— 指向 ./images/ 与 ./lib/ */
    var xs = items.filter(function (it) { return (it.axis || 'x') !== 'y'; });
    var ys = items.filter(function (it) { return it.axis === 'y'; });
    var prev = { folder: state.materials.folder, fx: state.materials.filenameX,
                 fy: state.materials.filenameY };
    state.materials.folder = './images/';
    state.materials.pad = 0;
    if (!isLots && xs.length) state.materials.filenameX = 'frame-{index}' + extOf(xs[0].name);
    if (!isLots && ys.length) state.materials.filenameY = 'vframe-{index}' + extOf(ys[0].name);
    var html = SD.Codegen.buildHtml(state, { mode: 'files' });
    state.materials.folder = prev.folder;
    state.materials.filenameX = prev.fx;
    state.materials.filenameY = prev.fy;
    await writeIn(dir, 'index.html', html);
    tick('index.html');

    /* 2) images/ */
    if (isLots) {
      /* 每个拍品一个子目录：images/lot-1/frame-1.jpg … */
      for (var li = 0; li < (state.lots || []).length; li++) {
        var its = SD.Bogu.onItems(state.lots[li]);
        var xi = 0, yi = 0;
        for (var k = 0; k < its.length; k++) {
          var it = its[k];
          var ex = extOf(it.name);
          var nm;
          if (it.axis === 'y') { yi++; nm = 'vframe-' + yi + ex; }
          else { xi++; nm = 'frame-' + xi + ex; }
          it.exportName = nm;   /* Bogu.buildHtml 生成页面时会用到 */
          var bb = it.file || await (await fetch(it.url)).blob();
          await writeIn(dir, 'images/lot-' + (li + 1) + '/' + nm, bb);
          tick('lot-' + (li + 1) + '/' + nm);
        }
      }
    } else if (isBook) {
      /* 翻书图录：书本相关图放 book/ 下，命名与页面引用保持一致 */
      var bk = state.book || {};
      var put = async function (item, rel) {
        if (!item || !item.url) return;
        var blob = item.file || await (await fetch(item.url)).blob();
        await writeIn(dir, rel, blob);
        tick(rel);
      };
      if (bk.cover && bk.cover.url) await put(bk.cover, 'book/cover' + extOf(bk.cover.name));
      for (var pi = 0; pi < (bk.pages || []).length; pi++) {
        var pg = bk.pages[pi];
        if (pg && pg.url) await put(pg, 'book/page-' + (pi + 1) + extOf(pg.name));
      }
      if (bk.back && bk.back.url) await put(bk.back, 'book/back' + extOf(bk.back.name));
    } else {
      for (var i = 0; i < items.length; i++) {
        var f = items[i].file;
        var blob = f || await (await fetch(items[i].url)).blob();
        await writeIn(dir, 'images/' + names[i], blob);
        tick(names[i]);
      }
    }

    /* 2b) 翻书模式：拍品的 360 素材同样要导出（锚点指向它们） */
    if (isBook) {
      for (var bi = 0; bi < (state.lots || []).length; bi++) {
        var bits = SD.Bogu.onItems(state.lots[bi]);
        var bxi = 0, byi = 0;
        for (var bk2 = 0; bk2 < bits.length; bk2++) {
          var bit = bits[bk2];
          var bex = extOf(bit.name);
          var bnm;
          if (bit.axis === 'y') { byi++; bnm = 'vframe-' + byi + bex; }
          else { bxi++; bnm = 'frame-' + bxi + bex; }
          bit.exportName = bnm;
          var bblob = bit.file || await (await fetch(bit.url)).blob();
          await writeIn(dir, 'images/lot-' + (bi + 1) + '/' + bnm, bblob);
          tick('lot-' + (bi + 1) + '/' + bnm);
        }
      }
    }

    /* 3) lib/ */
    var libBytes = await fetchBytes('lib/360-view.min.js');
    await writeIn(dir, 'lib/360-view.min.js', libBytes);
    tick('lib/360-view.min.js');

    /* 4) serve.ps1 */
    var ps = await fetchBytes('serve.ps1');
    await writeIn(dir, 'serve.ps1', ps);
    tick('serve.ps1');

    /* 5) 启动.bat + 使用说明 */
    await writeIn(dir, '启动.bat', batContent('index.html', 8790));
    await writeIn(dir, '使用说明.txt', readmeText(state, nImgs, names));

    return { ok: true, dir: dir.name, files: nImgs + 5, names: names };
  }

  /* ---------- 降级：只下载 index.html ---------- */
  function exportHtmlOnly(state) {
    var html = SD.Codegen.buildHtml(state, { mode: 'files' });
    SD.downloadFile('index.html', html, 'text/html');
    return html;
  }

  return {
    canPickDir: canPickDir,
    planNames: planNames,
    batContent: batContent,
    readmeText: readmeText,
    exportToDirectory: exportToDirectory,
    exportHtmlOnly: exportHtmlOnly
  };
})();
