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
    pageType: 'single',   /* single = 单品 360；book = 翻书图录 */
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
  /* 纯外观类参数：直接改预览文档里的样式即可，
     没必要重建整个预览 —— 重建 iframe 要重新加载 360 库和全部图片，
     这正是「改了背景色半天没反应」的原因。 */
  var LIVE_STYLE = {
    bookBg: function (doc, v) {
      doc.documentElement.style.background = v;
      if (doc.body) doc.body.style.background = v;
    }
    /* 这里原本还有一项 bookDotColor（改锚点颜色），但面板上从来没有这个参数，
       那段永远不会被触发 —— 已随锚点样式改成常量一并删除。 */
  };

  function previewDoc() {
    /* 预览 iframe 挂在 stage-host 下；书模式里是 blob 文档 */
    var f = document.querySelector('#stage-host iframe') ||
            document.querySelector('.pv iframe') ||
            document.querySelector('iframe');
    if (!f) return null;
    try { return f.contentDocument || null; } catch (e) { return null; }
  }

  function liveStyle(key, val) {
    var fn = LIVE_STYLE[key];
    if (!fn) return false;
    var doc = previewDoc();
    if (!doc) return false;
    try { fn(doc, val); return true; } catch (e) { return false; }
  }

  function setParam(key, val) {
    STATE.params[key] = val;
    if (liveStyle(key, val)) {
      /* 外观已经即时生效；工程照常存盘，但不重建预览 */
      if (SD.Store) SD.Store.autoSave();
      status('已应用 · ' + key);
      return;
    }
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
      /* 多行文本域：列表类参数用「每行一个」，纯文案类（如加载文案）自定义提示 */
      ta.placeholder = d.placeholder || '每行一个（可留空）';
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
      /* 图片 404 时用原始 File 重传一次（服务重启后的旧 URL 已失效） */
      im.addEventListener('error', function () {
        if (!it.file || it._healing) return;
        it._healing = true;
        SD.Materials.importFiles([it.file], it.axis || 'x', null)
          .then(function (r) { if (r && r.length) { it.url = r[0].url; im.src = it.url; } it._healing = false; })
          .catch(function () { it._healing = false; });
      });
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
    /* 书模式：比例来自封面（与成品里书页画布保持一致） */
    if (STATE.pageType === 'book') {
      var cov = (STATE.book && STATE.book.cover) || null;
      if (cov && cov.w && cov.h) return cov.w + ' / ' + cov.h;
      return '';
    }
    var it = SD.Codegen.activeItems(STATE)[0];
    if (it && it.w && it.h) return it.w + ' / ' + it.h;
    return '';
  }

  function applyStage() {
    /* 热点只对「单品 360」的整张画面有意义；书模式用它反而添乱 */
    var hsBtn = $('btnAddHotspot'), hsList = $('btnHotspotList');
    var hsShow = (STATE.pageType === 'single') ? '' : 'none';
    if (hsBtn) hsBtn.style.display = hsShow;
    if (hsList) hsList.style.display = hsShow;
    /* 书模式下素材直接挂在内容页上，这里的全局上传区用不到 → 收起，界面更清爽 */
    var mp = $('matPanel');
    if (mp) mp.style.display = (STATE.pageType === 'book') ? 'none' : '';
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
    if (SD.Store) SD.Store.autoSave();
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

  /* ================= 导出 ================= */
  function doExport() {
    /* 前置检查要分页面类型：书把素材挂在各个内容页上，
       只有「单品」才用全局素材 —— 一律检查全局素材会误报「还没有素材」。 */
    if (STATE.pageType === 'book') {
      var bk0 = STATE.book || {};
      var nImg = ((bk0.pages || []).filter(function (p) { return p && p.url; }).length) +
                 ((bk0.cover && bk0.cover.url) ? 1 : 0) +
                 ((bk0.back && bk0.back.url) ? 1 : 0);
      if (!nImg) {
        toast('warn', '书里还没有内容', '先在左栏「书页」上传封面或内容页图片');
        return;
      }
    } else {
      var items = SD.Codegen.activeItems(STATE);
      if (!items.length) { toast('warn', '还没有素材', '先导入图片或载入示例'); return; }
    }

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
        /* 记下封面真实像素尺寸：书页画布默认按它的比例适配，避免留空白 */
        var im = new Image();
        im.onload = function () {
          var bk = SD.Book.book();
          if (bk.cover && bk.cover.url === it.url) {
            bk.cover.w = im.naturalWidth;
            bk.cover.h = im.naturalHeight;
            SD.Book.render();
            refresh();
            toast('ok', '封面已上传',
              '画布比例已按封面 ' + im.naturalWidth + '×' + im.naturalHeight + ' 适配', 5000);
          }
        };
        im.src = it.url;
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

  /* ================= 全局错误横幅 =================
     把未捕获的 JS 报错直接显示在页面顶部，便于用户截图反馈，
     也避免「点了没反应却看不到任何线索」。 */
  function installErrorBar() {
    function show(text) {
      var box = document.getElementById('errBar');
      if (!box) {
        box = document.createElement('div');
        box.id = 'errBar';
        box.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99999;'
          + 'background:#7a1f1f;color:#fff;font:12px/1.6 Consolas,monospace;'
          + 'padding:8px 12px;white-space:pre-wrap;max-height:40vh;overflow:auto';
        var tip = document.createElement('div');
        tip.style.cssText = 'font-weight:700;margin-bottom:4px';
        tip.textContent = '页面出错了（请把这段截图发给开发者）';
        box.appendChild(tip);
        document.body.appendChild(box);
      }
      var line = document.createElement('div');
      line.textContent = text;
      box.appendChild(line);
    }
    window.addEventListener('error', function (e) {
      var f = (e.filename || '').split('/').pop();
      show((e.message || '未知错误') + '  @' + f + ':' + (e.lineno || '?'));
    });
    window.addEventListener('unhandledrejection', function (e) {
      var r = e.reason;
      show('Promise 未处理：' + ((r && r.message) || r));
    });
  }

  /* ================= 工程自动保存 / 恢复 ================= */
  async function restoreFromStore() {
    var snap = await SD.Store.load();
    if (!snap) return false;

    STATE.pageType = snap.pageType || 'single';
    STATE.title = snap.title || STATE.title;
    STATE.customCss = snap.customCss || '';
    if (snap.templateId) STATE.templateId = snap.templateId;
    STATE.params = Object.assign(SD.defaults(), snap.params || {});
    if (!STATE.book) STATE.book = {};
    if (snap.book) {
      STATE.book.w = snap.book.w || 900;
      STATE.book.h = snap.book.h || 1200;
      STATE.book.active = snap.book.active || 0;
    }

    async function uploadOne(rec) {
      if (rec && rec.file) {
        try {
          var res = await SD.Materials.importFiles([rec.file], rec.axis || 'x', null);
          if (res && res.length) {
            res[0].off = !!rec.off;
            return res[0];
          }
        } catch (e) { /* 文件失效就退化成占位 */ }
      }
      return { name: rec.name || '', w: rec.w, h: rec.h,
               axis: rec.axis || 'x', off: !!rec.off };
    }

    /* 当前编辑的那一份 */
    var editing = [];
    for (var k = 0; k < (snap.editingItems || []).length; k++) {
      editing.push(await uploadOne(snap.editingItems[k]));
    }
    if (editing.length) STATE.materials.items = editing;

    /* 书页 */
    if (snap.book) {
      async function upSheet(rec) {
        if (!rec || !rec.file) return null;
        try {
          var r = await SD.Materials.importFiles([rec.file], 'x', null);
          if (r && r.length) return { url: r[0].url, file: rec.file, name: rec.name || '' };
        } catch (e) {}
        return null;
      }
      STATE.book.cover = await upSheet(snap.book.cover);
      STATE.book.back = await upSheet(snap.book.back);
      var pages = [];
      for (var m = 0; m < ((snap.book.pages) || []).length; m++) {
        var pg = snap.book.pages[m];
        var o = await upSheet(pg);
        pages.push({
          url: o ? o.url : '',
          file: o ? o.file : null,
          name: (o && o.name) || pg.name || ''
        });
      }
      STATE.book.pages = pages;
    }
    return true;
  }

  async function applyRestored() {
    if ($('pageType')) $('pageType').value = STATE.pageType;
    /* 旧工程的封面可能没记尺寸，补读，保证画布比例跟着封面 */
    ensureCoverSize();
    syncParamsUI();
    SD.Book.render();
    renderMaterials();
    refresh();
  }

  /* ================= 配置的导出 / 导入 =================
     只带「结构 + 参数」，不带图片（图片体积大，换机器时重新传一次即可）。 */
  function buildConf() {
    var bk = STATE.book || {};
    return {
      app: '360-studio',
      version: 2,
      exportedAt: new Date().toISOString(),
      pageType: STATE.pageType,
      title: STATE.title,
      templateId: STATE.templateId,
      customCss: STATE.customCss,
      params: JSON.parse(JSON.stringify(STATE.params || {})),
      book: {
        w: bk.w, h: bk.h,
        coverName: (bk.cover && bk.cover.name) || '',
        backName: (bk.back && bk.back.name) || '',
        pages: ((bk.pages) || []).map(function (p) {
          return { name: p.name || '' };
        })
      },
      note: '仅含配置与结构，不含图片；导入后请重新上传对应图片'
    };
  }

  function applyConf(conf) {
    if (!conf || conf.app !== '360-studio') {
      toast('err', '这不是本工作台导出的配置', '请选择正确的 JSON 文件');
      return;
    }
    STATE.pageType = conf.pageType || 'single';
    STATE.title = conf.title || STATE.title;
    STATE.templateId = conf.templateId || STATE.templateId;
    STATE.customCss = conf.customCss || '';
    STATE.params = Object.assign(SD.defaults(), conf.params || {});

    STATE.materials.items = [];

    /* 书页：图片留空待传 */
    if (!STATE.book) STATE.book = {};
    STATE.book.w = (conf.book && conf.book.w) || 900;
    STATE.book.h = (conf.book && conf.book.h) || 1200;
    STATE.book.active = 0;
    STATE.book.cover = null;
    STATE.book.back = null;
    STATE.book.pages = ((conf.book && conf.book.pages) || []).map(function (p) {
      return { url: '', file: null, name: p.name || '' };
    });

    if ($('pageType')) $('pageType').value = STATE.pageType;
    syncParamsUI();
    SD.Book.render();
    renderMaterials();
    refresh();

    var needImg = STATE.book.pages.length
                + (STATE.book.cover ? 1 : 0) + (STATE.book.back ? 1 : 0);
    toast('ok', '配置已导入', needImg
      ? '参数与结构已恢复；请重新上传图片（图片不在配置文件里）'
      : '参数与结构已恢复', 7000);
  }

  /* ================= 参数预设 ================= */
  var PRESETS = [
    { id: '', name: '（不套用）', params: null },
    { id: 'ec', name: '电商详情：稳、可放大',
      params: { zoomMax: 3, zoomControls: true, fullscreen: true, hints: true,
                scrollHint: true, dragSpeed: 150, lazyload: true } },
    { id: 'smooth', name: '少帧顺滑：插值 + 降灵敏',
      params: { interp: 3, dragSpeed: 90, hints: false, scrollHint: false } },
    { id: 'mobile', name: '移动端轻量：省内存',
      params: { zoomMax: 2, amountX: 24, lazyload: true, hints: false,
                scrollHint: false, bottomCircle: true } },
    { id: 'showcase', name: '展厅大图：自动旋转 + 暗色',
      params: { theme: 'dark', autoplay: true, speed: 60, fullscreen: true,
                zoomMax: 4, hints: false, aspectRatio: '' } },
    { id: 'strict', name: '严格不循环：到边界停',
      params: { stopAtEdges: true, stopAtEdgesX: true, stopAtEdgesY: true,
                inertia: false } }
  ];

  function buildPresetSelect() {
    var sel = $('presetSelect');
    if (!sel) return;
    sel.innerHTML = '';
    PRESETS.forEach(function (pr) {
      var op = document.createElement('option');
      op.value = pr.id;
      op.textContent = pr.name;
      sel.appendChild(op);
    });
    sel.addEventListener('change', function () {
      var id = sel.value;
      var pr = null;
      for (var i = 0; i < PRESETS.length; i++) { if (PRESETS[i].id === id) pr = PRESETS[i]; }
      if (!pr || !pr.params) { sel.value = ''; return; }
      Object.keys(pr.params).forEach(function (k) { STATE.params[k] = pr.params[k]; });
      syncParamsUI();
      refresh();
      toast('ok', '已套用预设', pr.name, 4000);
      sel.value = '';
    });
  }

  /* ================= 封面尺寸 =================
     书的画布比例要严格等于封面图的比例，否则图片 contain 之后两旁会留白。
     旧工程里 cover 可能只有 url、没有 w/h，这里补读一次。 */
  function ensureCoverSize() {
    var bk = STATE.book || {};
    var c = bk.cover;
    if (!c || !c.url || (c.w && c.h)) return Promise.resolve(false);
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () {
        c.w = im.naturalWidth;
        c.h = im.naturalHeight;
        res(true);
      };
      im.onerror = function () { res(false); };
      im.src = c.url;
    }).then(function (changed) {
      if (changed) {
        if (SD.Book && SD.Book.render) SD.Book.render();
        refresh();
        status('已按封面 ' + c.w + '×' + c.h + ' 校准画布比例');
      }
      return changed;
    });
  }

  /* ================= 本页 360 素材 =================
     书模式下每个内容页自带一组 360 素材，成品里点这一页就弹出。
     比原来「逐页建条目」少两步，更贴近真实素材组织方式。 */
  function page360Render() {
    var host = $('page360List'), hint = $('page360Hint');
    if (!host) return;
    var sh = SD.Book ? SD.Book.activeSheet() : null;
    var list = (sh && sh.kind === 'page') ? SD.Book.itemsOf(sh) : null;
    host.innerHTML = '';
    if (!list) {
      if (hint) hint.textContent = '先选一张内容页（封面 / 封底不需要 360 素材）';
      return;
    }
    list.forEach(function (it) {
      var d = document.createElement('div');
      d.className = 'mat-item' + (it.off ? ' is-off' : '');
      d.style.cssText = 'width:44px;height:44px;position:relative';
      d.title = (it.name || '') + '（' + (it.axis === 'y' ? '垂直俯仰' : '水平旋转') + '，点击可启用/排除；右键删除）';
      d.innerHTML = '<img alt="" style="width:100%;height:100%;object-fit:cover;border-radius:4px">';
      var im = d.querySelector('img');
      im.addEventListener('error', function () {
        if (!it.file || it._healing) return;
        it._healing = true;
        SD.Materials.importFiles([it.file], it.axis || 'x', null)
          .then(function (r) { if (r && r.length) { it.url = r[0].url; im.src = it.url; } it._healing = false; })
          .catch(function () { it._healing = false; });
      });
      if (it.url) im.src = it.url;
      d.addEventListener('click', function () {
        it.off = !it.off; page360Render(); refresh();
      });
      d.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        var i = list.indexOf(it);
        if (i >= 0) { list.splice(i, 1); page360Render(); refresh(); toast('ok', '已删除该素材'); }
      });
      host.appendChild(d);
    });
    if (hint) {
      var xs = list.filter(function (i) { return i.axis !== 'y'; }).length;
      var ys = list.filter(function (i) { return i.axis === 'y'; }).length;
      hint.innerHTML = list.length
        ? ('共 ' + list.length + ' 张（水平 ' + xs + ' · 垂直 ' + ys + '）' +
           (xs && xs < 8 ? '<br><span style="color:#e0a030">水平帧偏少，可在参数里把「帧插值平滑」开到 2~3</span>' : ''))
        : '还没有素材 —— 点上面按钮上传这一页的 360 图';
    }
  }

  function page360Upload(axis) {
    var sh = SD.Book ? SD.Book.activeSheet() : null;
    if (!sh || sh.kind !== 'page') {
      toast('warn', '请先在左栏「书页」里选中一张内容页');
      return;
    }
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.multiple = true;
    inp.addEventListener('change', function () {
      var files = Array.prototype.slice.call(inp.files || []);
      if (!files.length) return;
      status('正在上传本页 360 素材…');
      SD.Materials.importFiles(files, axis, function (n, total) {
        status('正在上传本页 360 素材 ' + n + '/' + total + '…');
      }).then(function (added) {
        var list = SD.Book.itemsOf(sh);
        (added || []).forEach(function (it) { list.push(it); });
        page360Render();
        refresh();
        status('就绪 · ' + sh.label + ' 已有 ' + list.length + ' 张 360 素材');
        toast('ok', '已添加 ' + (added || []).length + ' 张到' + sh.label,
          '成品里点这一页就会弹出这组 360', 5000);
      }).catch(function (e) {
        toast('err', '上传失败', (e && e.message) || '');
      });
    });
    inp.click();
  }

  /* ================= 素材体检 =================
     把常见坑一次说清楚：图尺寸不一致（会被拉伸）、帧数太少（旋转跳跃）、
     单张太大（手机慢）、书页缺图等。 */
  function probeSizes(list) {
    return Promise.all(list.map(function (it) {
      return new Promise(function (res) {
        if (it._w && it._h) return res();
        if (!it.url) return res();
        var im = new Image();
        im.onload = function () { it._w = im.naturalWidth; it._h = im.naturalHeight; res(); };
        im.onerror = function () { res(); };
        im.src = it.url;
      });
    }));
  }

  function collectCheckup() {
    var issues = [];
    function add(kind, title, detail) { issues.push({ kind: kind, title: title, detail: detail || '' }); }

    var items = (STATE.materials.items || []).filter(function (it) { return !it.off; });
    var xs = items.filter(function (it) { return it.axis !== 'y'; });
    var ys = items.filter(function (it) { return it.axis === 'y'; });

    /* 1) 尺寸一致性 —— 不一致会被第一张的比例拉伸 */
    var dims = {}, order = [];
    items.forEach(function (it) {
      if (!it._w || !it._h) return;
      var k = it._w + ' × ' + it._h;
      if (!dims[k]) { dims[k] = []; order.push(k); }
      dims[k].push(it.name || '');
    });
    if (order.length > 1) {
      order.sort(function (a, b) { return dims[b].length - dims[a].length; });
      add('warn', '图片尺寸不一致（共 ' + order.length + ' 种）—— 成品里会被拉伸变形',
        order.map(function (k) {
          var arr = dims[k];
          return '· ' + k + '（' + arr.length + ' 张）：' + arr.slice(0, 3).join('、') +
                 (arr.length > 3 ? ' …' : '');
        }).join('<br>') + '<br>建议先统一裁成同一尺寸再上传。');
    }

    /* 2) 帧数 */
    if (xs.length && xs.length < 8) {
      add('info', '水平帧数偏少（' + xs.length + ' 张）—— 旋转会一跳一跳',
        '两个办法：把「帧插值平滑」开到 2~3（推荐，不用重拍），或补拍更多帧。');
    }
    if (xs.length && !ys.length) {
      add('info', '没有垂直（俯仰）帧 —— 只能左右转，不能上下看',
        '想上下看需要再拍一组并上传为「垂直」组。');
    }

    /* 3) 单张体积 */
    var big = items.filter(function (it) { return it.file && it.file.size > 3 * 1024 * 1024; });
    if (big.length) {
      add('warn', big.length + ' 张图片过大（单张 > 3MB）—— 手机上会很慢',
        big.slice(0, 5).map(function (it) {
          return '· ' + (it.name || '') + ' ' + (it.file.size / 1048576).toFixed(1) + 'MB';
        }).join('<br>') + (big.length > 5 ? '<br>…' : '') + '<br>建议先压缩到每张 500KB 以内。');
    }

    /* 4) 书页 */
    if (STATE.pageType === 'book') {
      var bk = STATE.book || {};
      if (!bk.pages || !bk.pages.length) {
        add('warn', '还没有任何书页', '去左栏「书页」上传内容页图片。');
      } else {
        (bk.pages || []).forEach(function (p, i) {
          if (!p.url) add('warn', '第 ' + (i + 1) + ' 页还没有上传图片', '');
        });
      }
      if (!bk.cover || !bk.cover.url) add('info', '还没有上传封面', '成品会直接从第 1 页开始。');
    }

    return issues;
  }

  function showCheckup(issues) {
    var host = document.createElement('div');
    host.className = 'modal-mask';
    var icons = { err: '❌', warn: '⚠️', info: '💡' };
    var order = { err: 0, warn: 1, info: 2 };
    issues.sort(function (a, b) { return order[a.kind] - order[b.kind]; });
    var body = issues.map(function (it, i) {
      return '<div style="padding:10px 12px;margin-bottom:8px;border-radius:6px;' +
        'background:' + (it.kind === 'err' ? 'rgba(220,60,60,.14)' : it.kind === 'warn' ? 'rgba(240,170,40,.14)' : 'rgba(80,140,240,.14)') + ';' +
        'border:1px solid ' + (it.kind === 'err' ? 'rgba(220,60,60,.4)' : it.kind === 'warn' ? 'rgba(240,170,40,.4)' : 'rgba(80,140,240,.4)') + '">' +
        '<div style="font-weight:600;margin-bottom:' + (it.detail ? '6px' : '0') + '">' +
        icons[it.kind] + ' ' + it.title + '</div>' +
        (it.detail ? '<div style="font-size:12px;line-height:1.7;color:var(--sd-fg2)">' + it.detail + '</div>' : '') +
        '</div>';
    }).join('');
    if (!issues.length) {
      body = '<div style="padding:20px;text-align:center;color:var(--sd-fg2)">' +
        '✅ 没有发现问题，可以放心导出</div>';
    }
    host.innerHTML = '<div style="background:var(--sd-panel);border:1px solid var(--sd-line2);' +
      'border-radius:10px;padding:18px;width:min(620px,92vw);max-height:82vh;overflow:auto">' +
      '<h3 style="margin:0 0 12px">素材体检 —— 共 ' + issues.length + ' 条提示</h3>' +
      body +
      '<div style="text-align:right;margin-top:8px"><button class="btn" id="ckClose">知道了</button></div></div>';
    document.body.appendChild(host);
    host.addEventListener('click', function (e) { if (e.target === host) host.remove(); });
    document.getElementById('ckClose').addEventListener('click', function () { host.remove(); });
  }

  function runCheckup() {
    var items = (STATE.materials.items || []);
    status('正在体检…');
    return probeSizes(items).then(function () {
      var issues = collectCheckup();
      showCheckup(issues);
      status('就绪 · 体检完成，' + issues.length + ' 条提示');
    }).catch(function (e) {
      toast('err', '体检失败', (e && e.message) || '');
    });
  }

  /* ================= 服务重启自愈 =================
     素材存在本地服务的内存里，一旦服务重启（双击 启动.bat），
     页面里所有 /@mat/... URL 都会 404 —— 表现就是「缩略图空白、预览出不来」。
     这里通过 /@ping 的启动标识发现重启，然后用原始 File 全量重传。 */
  function healAfterRestart() {
    if (!SERVER_OK || !SD.Materials.checkRestart) return Promise.resolve(false);
    return SD.Materials.checkRestart().then(function (changed) {
      if (!changed) return false;

      var jobs = [];
      function reupload(holder) {
        if (!holder || !holder.file) return;
        jobs.push(SD.Materials.importFiles([holder.file], holder.axis || 'x', null)
          .then(function (r) { if (r && r.length) holder.url = r[0].url; })
          .catch(function () {}));
      }
      (STATE.materials.items || []).forEach(reupload);
      var bk = STATE.book || {};
      reupload(bk.cover);
      reupload(bk.back);
      (bk.pages || []).forEach(reupload);

      if (!jobs.length) return false;
      status('检测到本地服务重启，正在重新载入素材…', 'warn');
      return Promise.all(jobs).then(function () {
        renderMaterials();
        refresh();
        status('就绪 · 素材已随服务重启自动重新载入');
        toast('ok', '素材已自动重新载入', '本地服务重启过，图片地址已刷新', 5000);
        return true;
      });
    }).catch(function () { return false; });
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
        var bgv = s.getAttribute('data-bg');
        STATE.stage.bg = bgv;
        applyStage();
        /* 书模式下整页预览是 iframe，会把舞台背景整个盖住 ——
           所以这里的色块同时要改「书的桌面背景」，否则点了看不出任何变化。 */
        if (STATE.pageType === 'book' && bgv && bgv !== 'checker') {
          STATE.params.bookBg = bgv;
          var doc = previewDoc();
          if (doc) {
            doc.documentElement.style.background = bgv;
            if (doc.body) doc.body.style.background = bgv;
          } else {
            refresh();
          }
          status('已应用 · 桌面背景 ' + bgv);
        }
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
      if (t === 'book') {
        SD.Book.book();
        SD.Book.render();
        status('已切到翻书图录：左侧可管理封面 / 内容页 / 封底');
      } else {
        status('已切到单品 360 模式');
      }
      syncParamsUI();
      refresh();
    });

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

    var btnWipe = $('btnWipeStore');
    if (btnWipe) btnWipe.addEventListener('click', function () {
      if (!confirm('确定清除本机保存的工程吗？\n\n' +
                   '已上传的素材与参数都会消失，不可恢复。')) return;
      SD.Store.clear().then(function () {
        toast('ok', '已清除本地工程', '刷新后不会再恢复');
      });
    });
    SD.onStoreSaved = function (ts) {
      var el = $('stSaved');
      if (el) el.textContent = '已自动保存 ' + new Date(ts).toLocaleTimeString();
    };

    $('btnExportCfg').addEventListener('click', function () {
      var conf = buildConf();
      downloadFile('360-config.json', JSON.stringify(conf, null, 2), 'application/json');
      toast('ok', '已导出配置', '含参数与结构（不含图片）', 5000);
    });
    if ($('btnCheckup')) $('btnCheckup').addEventListener('click', function () { runCheckup(); });
    if ($('btnUpPage360X')) $('btnUpPage360X').addEventListener('click', function () { page360Upload('x'); });
    if ($('btnUpPage360Y')) $('btnUpPage360Y').addEventListener('click', function () { page360Upload('y'); });
    $('btnImportCfg').addEventListener('click', function () {
      var inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.json,application/json';
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0];
        if (!f) return;
        var rd = new FileReader();
        rd.onload = function () {
          var conf = null;
          try { conf = JSON.parse(rd.result); }
          catch (e) { toast('err', '配置文件解析失败', (e && e.message) || ''); return; }
          applyConf(conf);
        };
        rd.onerror = function () { toast('err', '读取文件失败'); };
        rd.readAsText(f, 'utf-8');
      });
      inp.click();
    });
  }

  /* ================= 启动 ================= */
  function boot() {
    installErrorBar();
    SD.Preview.mount($('stage-host'));
    buildTemplateSelect();
    buildPresetSelect();
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

    SD.Book.render();
    bindBookEvents();

    SD.Materials.ping().then(function (ok) {
      SERVER_OK = ok;
      if (!ok) {
        showEnvWarning();
        return;
      }
      status('就绪 · 本地服务已连接 · 360 库 ' + (libOk ? '已加载' : '未加载'));
      healAfterRestart();
      window.addEventListener('focus', function () { healAfterRestart(); });

      /* 有调试参数时不打扰，直接按参数走 */
      var hasDebug = /[?&](demo|book)/.test(location.search);
      if (!hasDebug && SD.Store) {
        restoreFromStore().then(function (restored) {
          if (!restored) return;
          applyRestored();
          toast('ok', '已恢复上次的工程',
                '素材已重新载入，可直接继续', 5000);
        }).catch(function () {});
      }

      if (/[?&]storetest/.test(location.search)) {
        setTimeout(function () {
          var snap = SD.Store.snapshot();
          var withFile = 0, total = 0;
          (snap.book && snap.book.pages || []).forEach(function (p) { total++; if (p.file) withFile++; });
          if (snap.book && snap.book.cover && snap.book.cover.file) { total++; withFile++; }
          if (snap.book && snap.book.back && snap.book.back.file) { total++; withFile++; }
          var box = document.createElement('pre');
          box.style.cssText = 'position:fixed;left:6px;bottom:6px;background:#000;'
            + 'color:#0f0;font:12px monospace;padding:8px;z-index:99999;max-width:92vw';
          box.textContent = 'snapshot:'
            + ' | editingItems=' + (snap.editingItems || []).length
            + ' | bookPages=' + ((snap.book && snap.book.pages) || []).length
            + ' | 带File的条目=' + withFile + '/' + total
            + ' | params键数=' + Object.keys(snap.params || {}).length;
          document.body.appendChild(box);
        }, 5000);
      }
      if (/[?&]diag/.test(location.search)) {
        setTimeout(function () {
          var sheet = SD.Book ? SD.Book.activeSheet() : null;
          var lines = [
            '页面类型     : ' + STATE.pageType,
            '书页数量     : ' + ((STATE.book && STATE.book.pages) || []).length,
            '当前选中     : ' + (sheet ? (sheet.kind + ' #' + sheet.index) : '-'),
            '该页有图     : ' + (sheet && sheet.page && sheet.page.url ? '是' : '否'),
            '素材数量     : ' + ((STATE.materials && STATE.materials.items) || []).length,
            '本地服务     : ' + (SERVER_OK ? '已连接' : '断开'),
            '360 库       : ' + (typeof window.CI360),
            '工作台版本   : ' + (document.querySelector('script[src*="360-view"]') ? '有库引用' : '-')
          ];
          var box = document.createElement('pre');
          box.style.cssText = 'position:fixed;left:6px;bottom:6px;background:#000;color:#0f0;'
            + 'font:12px/1.6 monospace;padding:8px 10px;z-index:99999;max-width:92vw';
          box.textContent = lines.join('\n');
          document.body.appendChild(box);
        }, 4000);
      }
      if (/[?&]code/.test(location.search)) {
        var pane = $('codepane');
        pane.classList.add('open');
        updateCode();
      }
      if (/[?&]book/.test(location.search)) {
        var ptb = $('pageType');
        ptb.value = 'book';
        ptb.dispatchEvent(new Event('change'));
        var _tryBook = 0;
        (function waitBook() {
          _tryBook++;
          var its = STATE.materials.items || [];
          var bk = SD.Book.book();
          if (bk.pages.length) return;
          if (its.length < 4) {
            if (_tryBook < 300) setTimeout(waitBook, 150);
            return;
          }
          function snap(k, nm) {
            var it = its[k];
            return it ? { url: it.url, file: it.file, name: nm } : null;
          }
          bk.cover = snap(0, 'cover.png');
          bk.back = snap(3, 'back.png');
          bk.pages = [
            { url: (snap(1, 'page-1.png') || {}).url, file: (snap(1, 'page-1.png') || {}).file,
              name: 'page-1.png' },
            { url: (snap(2, 'page-2.png') || {}).url, file: (snap(2, 'page-2.png') || {}).file,
              name: 'page-2.png' }
          ];
          SD.Book.setActive(1);
          SD.Book.render();
          if (SD.refresh) SD.refresh();
        })();
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
