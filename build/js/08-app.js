/* =====================================================================
 * 08-app.js —— 状态、面板装配与主循环
 * ===================================================================== */
window.SD = window.SD || {};

(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return SD.Codegen.esc(s); };

  /* ================= 状态 ================= */
  var STATE = {
    templateId: SD.TEMPLATES[0].id,
    title: '360° 产品展示',
    customCss: '',
    params: SD.defaults(),
    materials: { items: [], folder: './images/', filenameX: 'frame-{index}.jpg', pad: 0 },
    pageType: 'single',   /* single = 单品 360；lots = 拍品列表（博古架） */
    lots: [],             /* 拍品列表模式下的多套素材 */
    activeLot: 0,
    stage: { width: 520, bg: 'checker' }
  };
  SD.STATE = STATE;

  var SERVER_OK = false;
  var AXIS = 'x';   /* 后续导入的图片归到哪条轴 */

  /* ================= 通用 UI ================= */
  function toast(kind, title, msg, ms) {
    var el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.innerHTML = '<b>' + esc(title) + '</b>' + (msg ? '<span>' + esc(msg) + '</span>' : '');
    $('toasts').appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .28s';
      el.style.opacity = '0';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, ms || 3200);
  }
  SD.toast = toast;

  function status(msg, kind) {
    $('stMsg').textContent = msg;
    $('stDot').className = 'dot' + (kind ? ' ' + kind : '');
  }
  SD.status = status;

  function showEmpty(show) {
    var el = $('stage-empty');
    if (!el) return;
    if (show) el.classList.remove('hide');
    else el.classList.add('hide');
  }
  SD.ShowEmpty = showEmpty;

  /* ================= 参数面板 ================= */
  function setParam(key, val) {
    STATE.params[key] = val;
    refresh();
  }

  function rowFor(d) {
    var row = document.createElement('div');
    row.className = 'prow' + (d.type === 'list' ? ' wide' : '');
    var val = STATE.params[d.key];

    var lab = document.createElement('label');
    lab.innerHTML = esc(d.label) +
      (d.desc ? '<span class="sub">' + esc(d.desc) + '</span>' : '');
    row.appendChild(lab);

    var ctl = document.createElement('div');
    ctl.className = 'ctl';

    if (d.type === 'bool') {
      var sw = document.createElement('label'); sw.className = 'switch';
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!val;
      cb.addEventListener('change', function () { setParam(d.key, cb.checked); });
      var track = document.createElement('span'); track.className = 'track';
      sw.appendChild(cb); sw.appendChild(track);
      ctl.appendChild(sw);

    } else if (d.type === 'tri') {
      var tri = document.createElement('div'); tri.className = 'tri';
      [['跟随', null], ['是', true], ['否', false]].forEach(function (opt) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = opt[0];
        if (val === opt[1]) b.className = 'on';
        b.addEventListener('click', function () {
          setParam(d.key, opt[1]);
          Array.prototype.forEach.call(tri.children, function (x) { x.className = ''; });
          b.className = 'on';
        });
        tri.appendChild(b);
      });
      ctl.appendChild(tri);

    } else if (d.type === 'select') {
      var sel = document.createElement('select');
      (d.options || []).forEach(function (o) {
        var op = document.createElement('option');
        op.value = o[0]; op.textContent = o[1];
        if (String(val) === String(o[0])) op.selected = true;
        sel.appendChild(op);
      });
      sel.addEventListener('change', function () { setParam(d.key, sel.value); });
      ctl.appendChild(sel);

    } else if (d.type === 'num') {
      var num = document.createElement('input');
      num.type = 'number';
      num.value = val === null || val === undefined ? '' : val;
      if (d.min !== undefined) num.min = d.min;
      if (d.max !== undefined) num.max = d.max;
      if (d.step !== undefined) num.step = d.step;
      num.addEventListener('change', function () {
        var v = num.value === '' ? '' : Number(num.value);
        if (typeof v === 'number' && d.min !== undefined && v < d.min) v = d.min;
        if (typeof v === 'number' && d.max !== undefined && v > d.max) v = d.max;
        num.value = v;
        setParam(d.key, v);
      });
      ctl.appendChild(num);
      if (d.unit) {
        var u = document.createElement('span');
        u.style.cssText = 'color:var(--sd-fg3);font-size:11px';
        u.textContent = d.unit;
        ctl.appendChild(u);
      }

    } else if (d.type === 'color') {
      var col = document.createElement('input');
      col.type = 'color';
      col.value = /^#[0-9a-f]{6}$/i.test(String(val)) ? val : '#ff6600';
      col.addEventListener('input', function () { setParam(d.key, col.value); });
      ctl.appendChild(col);

    } else if (d.type === 'list') {
      var ta = document.createElement('textarea');
      ta.value = val || '';
      ta.placeholder = '每行一个（可留空）';
      ta.addEventListener('change', function () { setParam(d.key, ta.value); });
      ctl.appendChild(ta);

    } else {
      var tx = document.createElement('input');
      tx.type = 'text';
      tx.value = val === null || val === undefined ? '' : val;
      if (d.placeholder) tx.placeholder = d.placeholder;
      tx.addEventListener('change', function () { setParam(d.key, tx.value); });
      ctl.appendChild(tx);
    }

    row.appendChild(ctl);
    return row;
  }

  function buildParams() {
    var host = $('paramsHost');
    var openState = {};
    Array.prototype.forEach.call(host.querySelectorAll('.pgroup'), function (g, i) {
      openState[i] = g.classList.contains('open');
    });

    host.innerHTML = '';
    SD.SCHEMA.forEach(function (g, i) {
      var box = document.createElement('div');
      var isOpen = openState[i] === undefined ? g.open : openState[i];
      box.className = 'pgroup' + (isOpen ? ' open' : '');

      var head = document.createElement('div');
      head.className = 'pgroup-head';
      head.innerHTML = '<span class="chev">▶</span><span>' + esc(g.name) + '</span>' +
                       '<span class="cnt">' + g.params.length + '</span>';
      head.addEventListener('click', function () { box.classList.toggle('open'); });
      box.appendChild(head);

      var body = document.createElement('div');
      body.className = 'pgroup-body';
      g.params.forEach(function (d) { body.appendChild(rowFor(d)); });
      box.appendChild(body);
      host.appendChild(box);
    });
  }

  function syncParamsUI() { buildParams(); }

  /* ================= 模板 ================= */
  function buildTemplateSelect() {
    var sel = $('tplSelect');
    sel.innerHTML = '';
    SD.TEMPLATES.forEach(function (t) {
      if (t.disabled) return;
      var op = document.createElement('option');
      op.value = t.id;
      op.textContent = t.name;
      sel.appendChild(op);
    });
    sel.value = STATE.templateId;
    sel.addEventListener('change', function () {
      STATE.templateId = sel.value;
      var t = SD.templateById(sel.value);
      Object.keys(t.defaults || {}).forEach(function (k) {
        STATE.params[k] = t.defaults[k];
      });
      syncParamsUI();
      var tbg = templateBg(t);
      if (tbg) STATE.stage.bg = tbg;
      applyStage();
      refresh();
      status('已切换到模板：' + t.name);
    });
  }

  /* ================= 素材 ================= */
  function renderMaterials() {
    var items = STATE.materials.items || [];
    var host = $('matList');
    var stats = $('matStats');
    host.innerHTML = '';

    if (!items.length) {
      host.innerHTML = '<div class="mat-empty">还没有素材<br>' +
        '<span style="color:#5b6472">支持任意帧数，6 张也能用</span></div>';
      stats.innerHTML = '';
      $('stMat').textContent = '';
      $('stFrame').textContent = '';
      return;
    }

    var xs = [], ys = [];
    items.forEach(function (it) { (it.axis === 'y' ? ys : xs).push(it); });

    stats.innerHTML = '共 <b>' + items.length + '</b> 张 &nbsp;·&nbsp; 水平 <b>' + xs.length +
      '</b> 张，垂直 <b>' + ys.length + '</b> 张' + frameHint(xs.length, ys.length);

    var wrap = document.createElement('div');
    wrap.className = 'mat-items';
    items.forEach(function (it) {
      var isY = it.axis === 'y';
      var gi = (isY ? ys : xs).indexOf(it) + 1;
      var d = document.createElement('div');
      d.className = 'mat-item' + (it.off ? ' is-off' : '');
      d.title = (it.name || '') + '（' + (isY ? '垂直俯仰' : '水平旋转') + '帧，点击可启用 / 排除）';
      d.innerHTML = '<img alt=""><span class="idx">' + (isY ? 'V' : 'H') + gi + '</span>';
      var im = d.querySelector('img');
      if (it.url) im.src = it.url;
      d.addEventListener('click', function () {
        it.off = !it.off;
        renderMaterials();
        refresh();
      });
      wrap.appendChild(d);
    });
    host.appendChild(wrap);

    $('stMat').textContent = '素材 ' + items.length + ' 张';
    $('stFrame').textContent = '水平 ' + countOn(xs) + ' / 垂直 ' + countOn(ys);
  }

  function countOn(list) {
    return list.filter(function (x) { return !x.off; }).length;
  }

  function frameHint(nx, ny) {
    if (ny > 0) return '<br>水平拖动转一圈，上下拖动看俯仰';
    if (nx > 0 && nx < 8) return '<br>水平帧数偏少，旋转会略显跳跃；建议一圈 24 张以上';
    return '';
  }

  function syncFrameCount() {
    var xs = STATE.materials.items.filter(function (it) { return (it.axis || 'x') !== 'y'; });
    var ys = STATE.materials.items.filter(function (it) { return it.axis === 'y'; });
    if (xs.length) STATE.params.amountX = xs.length;
    STATE.params.amountY = ys.length;
  }

  function addMaterials(files) {
    if (!SERVER_OK) {
      toast('err', '预览不可用', '请关闭本页，改用「启动工作台.bat」打开工作台', 9000);
      return;
    }
    status('正在导入素材…');
    SD.Materials.importFiles(files, AXIS, function (i, n, name) {
      status('导入中 ' + i + ' / ' + n + '：' + name);
    }).then(function (items) {
      if (!items.length) { toast('warn', '没有可用图片', '支持 jpg / png / webp 等'); status('就绪'); return; }
      STATE.materials.items = STATE.materials.items.concat(items);
      syncFrameCount();
      syncParamsUI();
      renderMaterials();
      refresh();
      if (STATE.pageType === 'lots') { SD.Lots.saveCurrent(); SD.Lots.render(); }
      toast('ok', '已导入 ' + items.length + ' 张素材');
      status('就绪 · 素材 ' + STATE.materials.items.length + ' 张');
    }).catch(function (e) {
      toast('err', '导入失败', (e && e.message) || '');
      status('导入失败', 'err');
    });
  }

  function loadDemo() {
    if (!SERVER_OK) {
      toast('err', '预览不可用', '请改用「启动工作台.bat」打开工作台', 9000);
      return;
    }
    status('正在生成示例素材…');
    SD.Materials.demoItems().then(function (items) {
      STATE.materials.items = items;
      syncFrameCount();
      syncParamsUI();
      renderMaterials();
      refresh();
      if (STATE.pageType === 'lots') { SD.Lots.saveCurrent(); SD.Lots.render(); }
      toast('ok', '已载入示例素材', '水平 4 帧（前/右/后/左）＋ 垂直 2 帧（上/下）');
      status('就绪 · 示例素材 6 张');
    });
  }

  function clearMaterials() {
    STATE.materials.items = [];
    STATE.params.amountX = 1;
    STATE.params.amountY = 0;
    SD.Materials.clearServer();
    renderMaterials();
    refresh();
    status('素材已清空');
  }

  /* ================= 舞台 ================= */
  /* 取出模板 CSS 里 body 的背景，用来近似还原成品页面的观感 */
  function templateBg(tpl) {
    var m = /body\s*\{([^}]*)\}/.exec(tpl.css || '');
    if (!m) return '';
    var bg = /background\s*:\s*([^;]+)/.exec(m[1]);
    return bg ? bg[1].trim() : '';
  }

  function autoRatio() {
    var it = SD.Codegen.activeItems(STATE)[0];
    if (it && it.w && it.h) return it.w + ' / ' + it.h;
    return '';
  }

  function applyStage() {
    var f = $('stage-frame');
    var bg = STATE.stage.bg;
    f.className = 'checker' === bg ? 'checker' : '';
    f.style.background = bg === 'checker' ? '' : bg;
    f.style.width = STATE.stage.width + 'px';
    var ratio = STATE.params.aspectRatio || autoRatio();
    f.style.aspectRatio = ratio || '4 / 3';
    $('stageW').value = STATE.stage.width;
    $('stageMeta').textContent = ratio ? ('比例 ' + ratio) : '';
  }

  /* ================= 主刷新 ================= */
  var codeTimer = null;

  function refresh() {
    applyStage();
    var hc = $('hsCount');
    if (hc) hc.textContent = SD.Hotspots ? SD.Hotspots.count() : 0;
    SD.Preview.schedule(STATE);

    if (codeTimer) clearTimeout(codeTimer);
    codeTimer = setTimeout(function () {
      codeTimer = null;
      updateCode();
    }, 220);
  }

  function updateCode() {
    var html = SD.Codegen.buildHtml(STATE, { mode: 'files' });
    $('codebox').value = html;
    $('codeInfo').textContent = '约 ' + (new Blob([html]).size / 1024).toFixed(1) + ' KB';
  }

  SD.refresh = refresh;

  /* 切换拍品后：素材面板 / 参数面板 / 预览 / 拍品列表 全部刷新 */
  SD.syncAfterLotChange = function () {
    renderMaterials();
    syncFrameCount();
    syncParamsUI();
    refresh();
    SD.Lots.render();
  };

  /* ================= 导出 ================= */
  function doExport() {
    var items = SD.Codegen.activeItems(STATE);
    if (!items.length) { toast('warn', '还没有素材', '先导入图片或载入示例'); return; }

    if (!SD.Export.canPickDir()) {
      SD.Export.exportHtmlOnly(STATE);
      toast('warn', '当前浏览器不支持选择目录',
        '已下载 index.html；请自行把 lib/、serve.ps1 与 images/ 放在同级目录', 9000);
      return;
    }

    status('正在导出…');
    SD.Export.exportToDirectory(STATE, function (i, n, label) {
      status('导出中 ' + i + ' / ' + n + '：' + label);
    }).then(function (r) {
      if (r && r.cancelled) { status('已取消导出'); return; }
      status('导出完成');
      toast('ok', '导出完成', '共 ' + r.files + ' 个文件 → ' + r.dir +
        '（双击其中的 启动.bat 即可预览）', 7000);
    }).catch(function (e) {
      toast('err', '导出失败', (e && e.message) || '');
      status('导出失败', 'err');
    });
  }

  /* ================= 工具 ================= */
  function downloadFile(name, content, mime) {
    try {
      var blob = new Blob([content], { type: (mime || 'text/plain') + ';charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 400);
      return true;
    } catch (e) {
      toast('err', '下载失败', (e && e.message) || '');
      return false;
    }
  }
  SD.downloadFile = downloadFile;

  function showHelp() {
    var mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = [
      '<div class="modal">',
      '  <div class="modal-head"><span>使用说明</span><span class="spacer"></span>',
      '    <button class="btn ghost sm" data-close>关闭</button></div>',
      '  <div class="modal-body">',
      '    <h4>三步做出一个 360° 展示页</h4>',
      '    <ol>',
      '      <li><b>导入素材</b>：左侧拖入图片，或点「选择文件夹」。支持任意帧数，6 张也能用。</li>',
      '      <li><b>调参数</b>：右侧分组面板，改动实时反映到中间预览。</li>',
      '      <li><b>导出</b>：点右上「导出 HTML」，选一个空文件夹，'
        + '工作台会把 <code>index.html</code>、<code>images/</code>、'
        + '<code>lib/</code>、<code>serve.ps1</code>、<code>启动.bat</code> 全部写好。</li>',
      '    </ol>',
      '    <h4>为什么必须用「启动工作台.bat」</h4>',
      '    <p>Cloudimage 360 View 会给每张图设置 <code>crossOrigin="anonymous"</code>，'
        + '而且只认 HTTP 地址 —— 双击 HTML 用 <code>file://</code> 打开时，'
        + '浏览器会拦掉图片请求，预览会是空白。'
        + '<code>启动工作台.bat</code> 用 Windows 自带的 PowerShell 起一个本地服务，'
        + '零安装、不需要管理员权限。</p>',
      '    <h4>导出的成品怎么用</h4>',
      '    <p>整个文件夹拷到任何 Win10 / Win11 电脑，双击里面的 <code>启动.bat</code> 即可；'
        + '要上线就把整个文件夹上传到网站目录，直接访问 <code>index.html</code>。</p>',
      '    <h4>少帧素材（比如瓷器 6 张）</h4>',
      '    <p>帧数少于 8 时旋转会略显跳跃。建议：前面 4 张（前后左右）做水平环绕，'
        + '「上 / 下」两张填进 <b>垂直</b> 那一组，用上下拖动查看俯仰视角。</p>',
      '    <h4>常用参数</h4>',
      '    <ul>',
      '      <li><b>水平帧数</b>：一圈拍了几张，导入素材后会自动填好</li>',
      '      <li><b>自动旋转</b> + <b>间隔</b>：进页面后自己转起来</li>',
      '      <li><b>最大放大倍数</b>：手机端建议 2-3，桌面端 3-5</li>',
      '      <li><b>点击后才加载</b>：一页放多个查看器时打开，省流量</li>',
      '    </ul>',
      '  </div>',
      '  <div class="modal-foot"><button class="btn primary" data-close>知道了</button></div>',
      '</div>'
    ].join('\n');
    document.body.appendChild(mask);
    function close() { if (mask.parentNode) mask.parentNode.removeChild(mask); }
    mask.addEventListener('click', function (e) {
      if (e.target === mask || e.target.hasAttribute('data-close')) close();
    });
  }

  /* ================= 翻书图录 ================= */
  function pickOneImage(cb) {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      status('正在上传图片…');
      SD.Materials.importFiles([f], 'x', null).then(function (items) {
        if (!items.length) { status('就绪'); return; }
        cb(items[0]);
        status('就绪');
      }).catch(function (e) {
        toast('err', '上传失败', (e && e.message) || '');
        status('上传失败', 'err');
      });
    });
    inp.click();
  }

  function bindBookEvents() {
    var addPage = $('btnAddPage');
    if (addPage) addPage.addEventListener('click', function () { SD.Book.addPage(); });

    var upCover = $('btnUpCover');
    if (upCover) upCover.addEventListener('click', function () {
      pickOneImage(function (it) {
        SD.Book.book().cover = { url: it.url, file: it.file, name: it.name };
        SD.Book.render();
        refresh();
        toast('ok', '封面已上传');
      });
    });

    var upBack = $('btnUpBack');
    if (upBack) upBack.addEventListener('click', function () {
      pickOneImage(function (it) {
        SD.Book.book().back = { url: it.url, file: it.file, name: it.name };
        SD.Book.render();
        refresh();
        toast('ok', '封底已上传');
      });
    });

    var upPage = $('btnUpPage');
    if (upPage) upPage.addEventListener('click', function () {
      var sh = SD.Book.activeSheet();
      if (sh.kind !== 'page') { toast('warn', '请先在左侧选中一张内容页'); return; }
      pickOneImage(function (it) {
        sh.page.url = it.url;
        sh.page.file = it.file;
        sh.page.name = it.name;
        SD.Book.render();
        refresh();
        toast('ok', '本页图片已上传');
      });
    });
  }

  /* ================= 环境提示 ================= */
  function showEnvWarning() {
    status('文件模式（file://）下预览不可用，请用「启动工作台.bat」打开', 'warn');
    var e = $('stage-empty');
    if (e) {
      e.innerHTML = '<div><span class="big">⚠</span>当前是文件模式，预览不可用<br>' +
        '<span style="font-size:12px;color:#6b7686">' +
        '请关闭本页，双击「启动工作台.bat」重新打开工作台</span></div>';
      e.classList.remove('hide');
    }
    toast('err', '请用「启动工作台.bat」打开',
      '360 库只接受 HTTP 地址，file:// 下图片会被浏览器拦掉。', 9000);
  }

  /* ================= 事件装配 ================= */
  function bindEvents() {
    $('btnPickFiles').addEventListener('click', function () { $('fileInput').click(); });
    $('btnPickDir').addEventListener('click', function () { $('dirInput').click(); });
    $('btnDemo').addEventListener('click', loadDemo);
    $('fileInput').addEventListener('change', function (e) { addMaterials(e.target.files); e.target.value = ''; });
    $('dirInput').addEventListener('change', function (e) { addMaterials(e.target.files); e.target.value = ''; });

    var dz = $('dropzone');
    dz.addEventListener('click', function () { $('fileInput').click(); });
    ['dragenter', 'dragover'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('over'); });
    });
    dz.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files) addMaterials(e.dataTransfer.files);
    });

    $('btnSortName').addEventListener('click', function () {
      STATE.materials.items.sort(function (a, b) {
        return String(a.name).localeCompare(String(b.name), 'zh-Hans-CN',
          { numeric: true, sensitivity: 'base' });
      });
      renderMaterials();
      refresh();
      toast('ok', '已按文件名重排');
    });
    $('btnClearMat').addEventListener('click', clearMaterials);

    Array.prototype.forEach.call($('axisPick').querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () {
        Array.prototype.forEach.call($('axisPick').querySelectorAll('button'),
          function (o) { o.className = ''; });
        b.className = 'on';
        AXIS = b.getAttribute('data-axis');
        status('后续导入的图片将作为' + (AXIS === 'y' ? '垂直俯仰' : '水平旋转') + '帧');
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('.swatch'), function (s) {
      s.addEventListener('click', function () {
        Array.prototype.forEach.call(document.querySelectorAll('.swatch'), function (o) { o.classList.remove('on'); });
        s.classList.add('on');
        STATE.stage.bg = s.getAttribute('data-bg');
        applyStage();
      });
    });
    $('stageW').addEventListener('change', function () {
      var v = parseInt($('stageW').value, 10);
      if (isNaN(v)) v = 520;
      STATE.stage.width = Math.max(120, Math.min(2400, v));
      applyStage();
    });
    $('btnAutoRatio').addEventListener('click', function () {
      var r = autoRatio();
      if (!r) { toast('warn', '无法自动识别', '请先导入素材'); return; }
      STATE.params.aspectRatio = r;
      syncParamsUI();
      applyStage();
      toast('ok', '已按素材比例设置', r);
    });

    $('pageType').addEventListener('change', function () {
      var t = $('pageType').value;
      STATE.pageType = t;
      var ab = $('btnAddAnchor');
      if (ab) ab.style.display = (t === 'book') ? '' : 'none';
      if (t === 'book') {
        SD.Book.book();
        SD.Book.render();
        status('已切到翻书图录：左侧可管理封面 / 内容页 / 封底');
      } else if (t === 'lots') {
        SD.Lots.ensureInit();
        SD.Lots.render();
        status('已切到拍品列表模式：左侧可管理多个拍品');
      } else {
        SD.Lots.saveCurrent();
        SD.Lots.render();
        status('已切到单品 360 模式');
      }
      syncParamsUI();
      refresh();
    });
    $('btnAddLot').addEventListener('click', function () { SD.Lots.add(); });
    var btnAn = $('btnAddAnchor');
    if (btnAn) btnAn.addEventListener('click', function () { SD.Book.startAnchorPick(); });

    $('btnAddHotspot').addEventListener('click', function () {
      if (!SD.Codegen.activeItems(STATE).length) {
        toast('warn', '先导入素材', '热点要打在实际画面上');
        return;
      }
      SD.Hotspots.startPicking();
    });
    $('btnHotspotList').addEventListener('click', function () { SD.Hotspots.showList(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') SD.Hotspots.stopPicking();
    });

    $('codepane-head').addEventListener('click', function (e) {
      if (e.target.closest('button')) return;
      $('codepane').classList.toggle('open');
      if ($('codepane').classList.contains('open')) updateCode();
    });
    $('btnCopyCode').addEventListener('click', function () {
      var ta = $('codebox');
      ta.select();
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(ta.value)
            .then(function () { toast('ok', '已复制到剪贴板'); },
                  function () { document.execCommand('copy'); toast('ok', '已复制到剪贴板'); });
        } else { document.execCommand('copy'); toast('ok', '已复制到剪贴板'); }
      } catch (err) { toast('err', '复制失败', '请手动选中后 Ctrl+C'); }
    });
    $('btnDownloadCode').addEventListener('click', function () {
      SD.Export.exportHtmlOnly(STATE);
      toast('ok', '已下载 index.html',
        '还需要同级放好 lib/、serve.ps1 与 images/（建议直接用「导出 HTML」）', 6000);
    });
    $('btnExport').addEventListener('click', doExport);

    $('btnResetParams').addEventListener('click', function () {
      STATE.params = SD.defaults();
      syncFrameCount();
      syncParamsUI();
      refresh();
      toast('ok', '参数已恢复默认');
    });

    $('btnHelp').addEventListener('click', showHelp);

    $('btnExportCfg').addEventListener('click', function () {
      var conf = {
        app: '360-studio', version: 1,
        templateId: STATE.templateId,
        title: STATE.title,
        params: STATE.params,
        materials: {
          count: STATE.materials.items.length,
          names: STATE.materials.items.map(function (i) { return i.name; })
        }
      };
      downloadFile('360-config.json', JSON.stringify(conf, null, 2), 'application/json');
      toast('ok', '已导出配置', '（不含图片本身）');
    });
    $('btnImportCfg').addEventListener('click', function () {
      toast('warn', '配置导入', '将随后续版本提供');
    });
  }

  /* ================= 启动 ================= */
  function boot() {
    SD.Preview.mount($('stage-host'));
    buildTemplateSelect();
    buildParams();
    bindEvents();
    applyStage();
    renderMaterials();
    showEmpty(true);
    updateCode();

    var libOk = typeof window.CI360 !== 'undefined';
    if (!libOk) {
      status('360 库未加载（lib/360-view.min.js 是否在同级目录？）', 'err');
      toast('err', '360 库未加载', '请确认 lib/360-view.min.js 与工作台在同一目录', 8000);
    }

    SD.Lots.ensureInit();
    SD.Lots.render();
    SD.Book.render();
    bindBookEvents();

    SD.Materials.ping().then(function (ok) {
      SERVER_OK = ok;
      if (!ok) {
        showEnvWarning();
        return;
      }
      status('就绪 · 本地服务已连接 · 360 库 ' + (libOk ? '已加载' : '未加载'));
      if (/[?&]code/.test(location.search)) {
        var pane = $('codepane');
        pane.classList.add('open');
        updateCode();
      }
      if (/[?&]lots/.test(location.search)) {
        var pt = $('pageType');
        pt.value = 'lots';
        pt.dispatchEvent(new Event('change'));
      }
      if (/[?&]book/.test(location.search)) {
        var ptb = $('pageType');
        ptb.value = 'book';
        ptb.dispatchEvent(new Event('change'));
        setTimeout(function () {
          var bk = SD.Book.book();
          var its = STATE.materials.items || [];
          if (bk.pages.length || its.length < 4) return;
          function snap(k, nm) {
            var it = its[k];
            return it ? { url: it.url, file: it.file, name: nm } : null;
          }
          bk.cover = snap(0, 'cover.png');
          bk.back = snap(3, 'back.png');
          bk.pages = [
            { url: (snap(1, 'page-1.png') || {}).url, file: (snap(1, 'page-1.png') || {}).file,
              name: 'page-1.png', anchors: [] },
            { url: (snap(2, 'page-2.png') || {}).url, file: (snap(2, 'page-2.png') || {}).file,
              name: 'page-2.png', anchors: [] }
          ];
          if (SD.Lots.lots().length) {
            bk.pages[0].anchors.push({ id: 'an-t1', x: 42, y: 38, lotId: SD.Lots.lots()[0].id });
          }
          SD.Book.render();
          if (SD.refresh) SD.refresh();
        }, 2500);
      }
      if (/[?&]dump/.test(location.search)) {
        setTimeout(function () {
          var full = SD.Codegen.buildHtml(STATE, { mode: 'files' });
          var keep = full.split('\n').filter(function (l) {
            return l.indexOf('<img') >= 0 || l.indexOf('imageList') >= 0
                || l.indexOf('filenameX') >= 0 || l.indexOf('images/lot') >= 0;
          });
          var box = document.createElement('pre');
          box.style.cssText = 'position:fixed;left:8px;bottom:60px;z-index:99999;background:#000;'
            + 'color:#0f0;font:11px monospace;padding:8px;max-width:94vw;max-height:46vh;overflow:auto';
          box.textContent = keep.length ? keep.join('\n') : '(未找到 img / filename 行)';
          document.body.appendChild(box);
        }, 3500);
      }
      if (/[?&]demo/.test(location.search)) loadDemo();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
