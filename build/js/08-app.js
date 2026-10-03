/* =====================================================================
 * 08-app.js —— 状态、面板装配与主循环
 * ===================================================================== */
window.SD = window.SD || {};

(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return SD.Codegen.esc(s); };

  /* ================= 状态 =================
     页面类型只剩「翻书图录」：单品 360 展示那一路已经去掉（入口、素材面板、
     参数都撤了），所以这里直接固定成 book —— 免得出现「模式是单品、界面却是
     书籍」的空白状态。底层函数（Codegen / Materials）保留，不再被 UI 调用。 */
  var STATE = {
    templateId: SD.TEMPLATES[0].id,
    title: '360° 产品展示',
    customCss: '',
    params: SD.defaults(),
    materials: { items: [], folder: './images/', filenameX: 'frame-{index}.jpg', pad: 0 },
    pageType: 'book',     /* 固定翻书图录（单品 360 展示已下线） */
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
    /* 只渲染「书籍（翻书图录）」这一组 —— 单品 360 展示已经下线，
       其余那些组（图片源 / 旋转行为 / 交互控制 / 外观与控件 / 热点 / CDN）
       都是给单品用的，摆在这里只会让人以为还能用。
       组定义仍留在 01-schema.js 里（defaults 还要用），只是不再渲染。 */
    SD.SCHEMA.filter(function (g) { return g.id === 'book'; }).forEach(function (g, i) {
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

  function syncParamsUI() {
    buildParams();
    /* 顶栏的「页面标题」也要跟着（导入配置 / 恢复工程之后 STATE.title 会变） */
    if ($('titleInput')) $('titleInput').value = STATE.title || '';
  }

  /* 顶栏「页面标题」：写进产物的 <title> —— 手机打开链接时顶部 / 微信分享栏显示的就是它 */
  function bindTitle() {
    var inp = $('titleInput');
    if (!inp) return;
    inp.value = STATE.title || '';
    inp.addEventListener('change', function () {
      STATE.title = inp.value.trim();
      if (SD.Store) SD.Store.autoSave();
      updateCode();          /* 只影响产物的 <title>：更新右下角代码栏即可，不必重建预览 */
      status('页面标题：' + (STATE.title || '（默认 360° 产品展示）'));
    });
  }

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

  /* ================= 素材 =================
     单品模式的「素材面板」已下线（左侧那一栏只剩书页与窑口图录），
     所以这里第一件事就是「面板不在就什么都不做」—— 它现在只在
     单品路径下才会被真正用到，而那条路已经没有了。 */
  function renderMaterials() {
    var items = STATE.materials.items || [];
    var host = $('matList');
    var stats = $('matStats');
    if (!host) return;
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

  /* ================= 窑口图录（产物底部那个按钮里的条目） =================
     每条 = 页码（产物里的真实页码，1 = 封面）+ 标题 + 可选自定义图。
     自定义图留空时，产物里自动回退成该页的图。 */
  var _catKey = '';
  function catRender() {
    var host = $('catList'), hint = $('catHint');
    if (!host) return;
    var list = SD.Book ? SD.Book.catalog() : [];
    var last = SD.Book ? SD.Book.lastIndex() : 1;
    /* key 里故意不含 title：输标题时不该重建这一栏（会丢焦点） */
    var key = list.map(function (c) {
      return (c.page || 1) + '|' + ((c.img && (c.img.url || c.img.name)) || '');
    }).join(',') + '#' + last;
    if (key === _catKey) return;
    _catKey = key;
    host.innerHTML = '';
    var INP = 'background:var(--sd-bg3);color:inherit;border:1px solid var(--sd-line);' +
              'border-radius:6px;padding:3px 6px;font:inherit;font-size:12px;box-sizing:border-box';
    list.forEach(function (c, i) {
      var row = document.createElement('div');
      row.className = 'lot-row';
      row.style.cssText = 'margin:0 0 6px;padding:6px;display:flex;gap:6px;align-items:flex-start';
      row.innerHTML =
        '<div class="lot-cover" style="width:44px;height:44px;flex:0 0 auto">' +
          (c.img && c.img.url ? '<img alt="">' : '<span>页图</span>') + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="display:flex;gap:4px;align-items:center">' +
            '<select data-page style="flex:0 0 96px;' + INP + '"></select>' +
            '<button class="btn ghost sm" data-up title="上移">↑</button>' +
            '<button class="btn ghost sm" data-down title="下移">↓</button>' +
            '<button class="btn ghost sm" data-del title="删除">✕</button>' +
          '</div>' +
          '<input data-title placeholder="标题（显示在图片下方）" style="width:100%;margin-top:4px;' + INP + '">' +
          '<div style="display:flex;gap:6px;margin-top:4px">' +
            '<button class="btn ghost sm" data-img>选自定义图</button>' +
            (c.img ? '<button class="btn ghost sm" data-imgdel>改用页图</button>' : '') +
          '</div>' +
        '</div>';
      if (c.img && c.img.url) row.querySelector('.lot-cover img').src = c.img.url;

      var sel = row.querySelector('[data-page]');
      for (var n = 1; n <= last; n++) {
        var op = document.createElement('option');
        op.value = String(n);
        op.textContent = (n === 1) ? '封面' : ((n === last) ? '封底' : ('第 ' + (n - 1) + ' 页'));
        sel.appendChild(op);
      }
      sel.value = String(Math.max(1, Math.min(last, c.page || 1)));
      sel.addEventListener('change', function () {
        SD.Book.setCatalog(i, { page: Number(sel.value) || 1 });
      });

      var ti = row.querySelector('[data-title]');
      ti.value = c.title || '';
      ti.addEventListener('input', function () {
        /* 直接改数据（不走 afterChange）—— 免得每敲一个字重画这一栏 */
        var arr = SD.Book.catalog();
        if (arr[i]) arr[i].title = ti.value;
        if (SD.Store) SD.Store.autoSave();
        if (SD.refresh) SD.refresh();
      });

      row.querySelector('[data-up]').addEventListener('click', function (e) {
        e.stopPropagation(); SD.Book.moveCatalog(i, -1);
      });
      row.querySelector('[data-down]').addEventListener('click', function (e) {
        e.stopPropagation(); SD.Book.moveCatalog(i, 1);
      });
      row.querySelector('[data-del]').addEventListener('click', function (e) {
        e.stopPropagation(); SD.Book.removeCatalog(i);
      });
      row.querySelector('[data-img]').addEventListener('click', function (e) {
        e.stopPropagation();
        pickOneImage(function (it) {
          SD.Book.setCatalog(i, { img: { url: it.url, file: it.file, name: it.name } });
        });
      });
      var idel = row.querySelector('[data-imgdel]');
      if (idel) idel.addEventListener('click', function (e) {
        e.stopPropagation(); SD.Book.setCatalog(i, { img: null });
      });

      host.appendChild(row);
    });
    if (hint) {
      hint.innerHTML = list.length
        ? ('共 ' + list.length + ' 条；标题显示在图下方，自定义图留空就用该页的图')
        : '还没有条目 —— 点右上「＋ 添加条目」。不配的话，产物里那个按钮仍显示全部页面的图墙';
    }
  }

  /* ================= 书籍 logo =================
     左栏那个「上传书籍 logo」按钮旁边的缩略图：有 logo 就显示，没有就藏起来。
     产物里它显示在书的上方居中（加载页的加载文案上方也用同一张）。 */
  function logoRender() {
    var img = $('logoThumb');
    var btn = $('btnUpLogo');
    if (!img) return;
    var lg = (SD.Book ? SD.Book.book() : (STATE.book || {})).logo;
    if (lg && lg.url) {
      if (img.getAttribute('src') !== lg.url) img.src = lg.url;
      img.style.display = '';
      if (btn) btn.textContent = '更换书籍 logo';
      img.title = (lg.name || 'logo') + '（点左边按钮可更换）';
    } else {
      img.style.display = 'none';
      if (btn) btn.textContent = '上传书籍 logo';
    }
  }

  /* ================= 主刷新 ================= */
  var codeTimer = null;

  function refresh() {
    applyStage();
    if (SD.Store) SD.Store.autoSave();
    var hc = $('hsCount');
    if (hc) hc.textContent = SD.Hotspots ? SD.Hotspots.count() : 0;
    /* 「本页 360 素材」得跟着当前页走：切页（左栏点某一行、新增/删除页、
       导入页面图）都会走到这里。以前只有动素材本身时才刷新它，所以换到
       另一页之后，下面那栏还显示着上一页的素材。 */
    page360Render();
    catRender();          /* 窑口图录那一栏（key 不变时不重建，输标题不掉焦点） */
    logoRender();         /* 左栏「上传书籍 logo」旁边的缩略图 */
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
      /* 完整错误打进控制台：toast 只有一行，而「导出失败」四个字本身说明不了
         是哪一步 —— 控制台里能看到「写 book/xxx 失败：具体原因」。 */
      try { console.error('[导出失败]', e); } catch (e2) {}
      var msg = (e && e.message) || String(e || '未知错误');
      if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) {
        msg = '浏览器拒绝了写入权限：换一个自己的文件夹（别选系统盘根目录、Program Files）再试。';
      } else if (e && e.name === 'AbortError') {
        msg = '目录选择被取消了';
      }
      toast('err', '导出失败', msg, 12000);
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

  /* ================= 批量导入 ================= */
  /* 选一个目录（Chromium 自带的 webkitdirectory：弹的是系统目录框，
     纯前端、浏览器版和桌面版行为一致，不需要动 Electron 的 Node 能力）。
     每个 File 都带 webkitRelativePath，形如「秋拍图录/1/0.jpg」——
     第一段是用户选中的目录名，识别器会剥掉它。 */
  function pickDirectory(cb) {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.webkitdirectory = true;
    inp.multiple = true;
    inp.style.display = 'none';
    inp.addEventListener('change', function () {
      var list = Array.prototype.slice.call(inp.files || []);
      if (inp.parentNode) inp.parentNode.removeChild(inp);
      cb(list);
    });
    document.body.appendChild(inp);
    inp.click();
  }

  function entriesOf(files) {
    return files.map(function (f) {
      return { path: f.webkitRelativePath || f.name, file: f };
    });
  }

  var PLAN_PREVIEW_MAX = 40;      /* 预览里最多逐页列这么多行，其余只给汇总 */

  function showImportPlan(plan, onGo) {
    var t = plan.total;
    var many = t.pages > (SD.DirImport.WARN_PAGES || 300);
    var rows = [];
    plan.pages.slice(0, PLAN_PREVIEW_MAX).forEach(function (p) {
      var bits = [];
      bits.push(p.pageImg ? ('本页图 ' + p.pageImg.name) : '缺本页图');
      if (p.frames.length) bits.push(p.frames.length + ' 张素材');
      else bits.push('没有 360 素材');
      rows.push('<li><b>第 ' + p.no + ' 页</b> ' + esc(bits.join(' + ')) + '</li>');
    });
    if (plan.pages.length > PLAN_PREVIEW_MAX) {
      rows.push('<li>…（还有 ' + (plan.pages.length - PLAN_PREVIEW_MAX) + ' 页）</li>');
    }
    var warns = plan.warnings.map(function (w) {
      return '<li>' + esc(w.text) + '</li>';
    }).join('');
    /* 窑口图录会被重建成「没有 360 素材」的那几页 —— 提前告诉用户条数，
       以及「一条都没有」时产物会回退显示全部页面的图墙（既有行为）。 */
    var noFrames = plan.pages.filter(function (p) { return !p.frames.length; }).length;

    var mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = [
      '<div class="modal">',
      /* 结构必须按工作台的模态约定来：.modal > .modal-head + .modal-body + .modal-foot。
         为什么：.modal 是 flex column + max-height:82vh，而**只有 .modal-body 带
         overflow:auto** —— 它是唯一会滚动、且能收缩的 flex 子项。
         之前把所有内容裸放在 .modal 下，结果是：.plan-list（也有 overflow）被压成 0 高
         （「每页摘要」完全看不见），而 .plan-warn 没有 overflow、min-height:auto 按内容算、
         40 条告警把 .modal-foot 顶到视口外 —— 按钮就点不到了。 */
      '  <div class="modal-head">识别结果<span class="spacer"></span>' +
        (many ? '<span style="color:#e0a33a;font-weight:400;font-size:12px">页数偏多，请确认</span>' : '') +
        '</div>',
      '  <div class="modal-body">',
      '    <p class="mini-note" style="padding:0">目录：<b>' + esc(plan.root) + '</b></p>',
      '    <p' + (many ? ' style="color:#e0a33a"' : '') + '>识别到 <b>' + t.pages + '</b> 页、' +
      '     <b>' + t.images + '</b> 张图' +
      (plan.skipped.system ? ('（另有 ' + plan.skipped.system + ' 个系统文件已跳过）') : '') +
      '。</p>',
      '    <p>封面：' + (plan.cover ? '✓ ' + esc(plan.cover.name) : '✗ 没有') +
      '　封底：' + (plan.back ? '✓ ' + esc(plan.back.name) : '✗ 没有') + '</p>',
      many ? '<p style="color:#e0a33a">页数超过 ' + (SD.DirImport.WARN_PAGES || 300) +
             ' 页，请确认目录没选错。</p>' : '',
      '    <div class="plan-list"><ul>' + rows.join('') + '</ul></div>',
      warns ? ('<div class="plan-warn"><b>需要注意</b><ul>' + warns + '</ul></div>') : '',
      '    <p class="mini-note" style="padding:0">窑口图录会重建成 ' + noFrames + ' 条' +
      (noFrames ? '（没有 360 素材的内容页，按页码顺序，标题写页码）'
                : ' —— 但没有一页缺 360 素材，所以它是空的：产物里那个按钮会回退显示全部页面') +
      '。</p>',
      '    <p class="mini-note" style="padding:0">导入会<strong>清空并重建</strong>整本书' +
      '（封面、封底、全部内容页）。书籍 logo 不受影响。</p>',
      '  </div>',
      '  <div class="modal-foot">',
      '    <button class="btn ghost" data-cancel>取消</button>',
      '    <button class="btn primary" data-go>' + (many ? '确认导入 ' + t.pages + ' 页' : '开始导入') + '</button>',
      '  </div>',
      '</div>'
    ].join('\n');
    document.body.appendChild(mask);
    function close() { if (mask.parentNode) mask.parentNode.removeChild(mask); }
    mask.addEventListener('click', function (e) {
      if (e.target === mask || e.target.hasAttribute('data-cancel')) { close(); return; }
      if (e.target.hasAttribute('data-go')) { close(); onGo(); }
    });
  }

  /* 把识别结果一条条传上去。全部成功之后才动 STATE.book ——
     中途取消或失败时工作台保持原样，不会出现「清了半本」。 */
  function runBatchImport(plan) {
    var urlOf = '/@upload';
    /* 上传队列：每项是「传一组图，结果放回 plan 的哪个位置」 */
    var jobs = [];
    if (plan.cover) jobs.push({ kind: 'cover', files: [plan.cover.file] });
    if (plan.back) jobs.push({ kind: 'back', files: [plan.back.file] });
    plan.pages.forEach(function (p, i) {
      if (p.pageImg) jobs.push({ kind: 'pageImg', page: i, files: [p.pageImg.file] });
      if (p.frames.length) {
        jobs.push({ kind: 'frames', page: i,
                    files: p.frames.map(function (f) { return f.file; }) });
      }
    });

    var totalImgs = plan.total.images;
    var doneImgs = 0;
    var failed = [];    /* 失败项：连「身份」（封面/封底/页图/素材 + 页码）和原 File
                           一起留着，这样能只重传这几张，不用整本重来 */
    var out = { cover: null, back: null, pages: plan.pages.map(function (p) {
      return { url: '', name: '', file: null, items: [] };
    }) };
    var cancelled = false;

    var box = document.createElement('div');
    box.className = 'import-prog';
    box.innerHTML = '<div class="import-prog-bar"><i></i></div>' +
                    '<div class="import-prog-txt"></div>' +
                    '<button class="btn ghost sm" data-stop>取消</button>';
    document.body.appendChild(box);
    var bar = box.querySelector('i');
    var txt = box.querySelector('.import-prog-txt');
    box.querySelector('[data-stop]').addEventListener('click', function () {
      cancelled = true;
      txt.textContent = '正在取消…';
    });
    function setProg(name) {
      var pct = totalImgs ? Math.round(doneImgs / totalImgs * 100) : 100;
      bar.style.width = pct + '%';
      txt.textContent = '正在上传 ' + Math.min(doneImgs + 1, totalImgs) + ' / ' + totalImgs +
                        (name ? ' · ' + name : '');
      status('批量导入中 ' + pct + '%');
    }
    function finish() {
      if (box.parentNode) box.parentNode.removeChild(box);
    }

    /* ---- 失败清单 + 只重试失败项 ---- */
    function retryFailed(list, cb) {
      var left = [];
      var seq = Promise.resolve();
      list.forEach(function (f) {
        seq = seq.then(function () {
          if (!f.file) { left.push(f); return null; }
          return SD.Materials.importFiles([f.file], 'x').then(function (items) {
            var it = (items || [])[0];
            if (!it || !it.url) {
              left.push({ kind: f.kind, page: f.page, name: f.name,
                          err: (it && it.err) || '上传失败', file: f.file });
              return;
            }
            /* 成功：并回 out 里同一个位置，这样最后生效的是完整一本 */
            if (f.kind === 'cover') out.cover = it;
            else if (f.kind === 'back') out.back = it;
            else if (f.kind === 'pageImg') out.pages[f.page] = it;
            else if (f.kind === 'frames') {
              out.pages[f.page].items = (out.pages[f.page].items || []).concat([it]);
            }
          });
        });
      });
      return seq.then(function () { cb(left); });
    }

    function showImportFailed(list, onDone) {
      var mask = document.createElement('div');
      mask.className = 'modal-mask';
      var rows = list.map(function (f) {
        var where = f.kind === 'cover' ? '封面'
                  : f.kind === 'back' ? '封底'
                  : f.kind === 'pageImg' ? ('第 ' + (f.page + 1) + ' 页的本页图')
                  : ('第 ' + (f.page + 1) + ' 页的 360 素材');
        return '<li><b>' + esc(f.name) + '</b><br><span class="mini-note">' +
               esc(where) + ' · ' + esc(f.err) + '</span></li>';
      }).join('');
      mask.innerHTML = [
        '<div class="modal">',
        '  <div class="modal-head">有 ' + list.length + ' 项没传成功</div>',
        '  <div class="modal-body">',
        '    <p>书页<strong>没有改动</strong>（要全部成功才生效）。可以只重试下面这几项，' +
        '已经传成功的不会重传。</p>',
        '    <div class="plan-list"><ul>' + rows + '</ul></div>',
        '    <p class="mini-note">如果是「文件过大」这类提示，重试结果也一样，' +
        '得先处理那张图再重试。</p>',
        '  </div>',
        '  <div class="modal-foot">',
        '    <button class="btn ghost" data-cancel>放弃</button>',
        '    <button class="btn primary" data-retry>重试这 ' + list.length + ' 项</button>',
        '  </div>',
        '</div>'
      ].join('');
      document.body.appendChild(mask);
      var btn = mask.querySelector('[data-retry]');
      function close() { if (mask.parentNode) mask.parentNode.removeChild(mask); }
      mask.querySelector('[data-cancel]').addEventListener('click', function () {
        close();
        status('批量导入未生效：有 ' + list.length + ' 项没传成功');
      });
      btn.addEventListener('click', function () {
        btn.disabled = true;
        btn.textContent = '正在重试…';
        retryFailed(list, function (still) {
          close();
          if (still.length) { showImportFailed(still, onDone); return; }
          toast('ok', '重试成功', '全部图都传完了，正在写进书页');
          onDone();
        });
      });
    }

    var chain = Promise.resolve();
    jobs.forEach(function (job) {
      chain = chain.then(function () {
        if (cancelled) return null;
        setProg(job.files[0] && job.files[0].name);
        return SD.Materials.importFiles(job.files, 'x', function (i, n, nm) {
          /* 这一批内部的进度：doneImgs 已经累加了前面几批 */
          var pct = totalImgs ? Math.round((doneImgs + i) / totalImgs * 100) : 100;
          bar.style.width = pct + '%';
          txt.textContent = '正在上传 ' + (doneImgs + i) + ' / ' + totalImgs + ' · ' + nm;
          status('批量导入中 ' + pct + '%');
        }).then(function (items) {
          doneImgs += job.files.length;
          /* §8：失败的不写进 state —— importFiles 失败时仍 resolve，只是没有 url。
             四路（封面 / 封底 / 页图 / 该页 360 素材）统一先按 url 过滤，否则
             封面或有图页会显示「已上传」点开却是空的（11-book.js 判定用 r.img.url）。 */
          var ok = (items || []).filter(function (it) { return it && it.url; });
          if (job.kind === 'cover') out.cover = ok[0] || null;
          else if (job.kind === 'back') out.back = ok[0] || null;
          else if (job.kind === 'pageImg') { if (ok[0]) out.pages[job.page] = ok[0]; }
          else if (job.kind === 'frames') out.pages[job.page].items = ok;
          /* 失败的**不写进 state**（§8），但要留下来：连「身份」和原 File 一起记
             （importFiles 在 meta.file 里存了一份），供「重试失败项」单独重传。 */
          (items || []).forEach(function (it) {
            if (it && it.url) return;
            failed.push({ kind: job.kind, page: job.page,
                          name: (it && it.name) || '（未知文件）',
                          err: (it && it.err) || '上传失败',
                          file: (it && it.file) || job.files[0] || null });
          });
        });
      });
    });

    /* ---- 所有图都传完了，才动 state（清空重建）----
       抽成独立函数：失败项重试成功之后要回到这里再走一遍。 */
    function afterAll() {
      finish();
      if (cancelled) {
        status('已取消批量导入');
        toast('warn', '已取消', '工作台保持原样，没有改动任何书页');
        return;
      }
      var bk = SD.Book ? SD.Book.book() : (STATE.book = STATE.book || {});
      bk.cover = out.cover ? { url: out.cover.url, name: out.cover.name, file: out.cover.file } : null;
      bk.back = out.back ? { url: out.back.url, name: out.back.name, file: out.back.file } : null;
      bk.pages = out.pages.map(function (p) {
        return { url: p.url || '', name: p.name || '', file: p.file || null, items: p.items || [] };
      });
      bk.active = 0;

      /* 窑口图录（图墙）：清空重建为「没有 360 素材」的内容页，按页码顺序。
         为什么要这么做：那些页点不出全景，放进图墙访客才知道有这么些纯图页。
         注意 page 是「产物页码」—— 1 是封面，所以内容页第 N 页 = N + 1；
         这里的下标 i 从 0 起，故 i + 2。标题就写页码（目录树里没有别的文字信息）。
         这是「清空重建」：手工配过的条目会被替换（用户已确认）。 */
      bk.catalog = [];
      bk.pages.forEach(function (p, i) {
        var n = (p.items || []).filter(function (it) { return it && !it.off; }).length;
        if (!n) bk.catalog.push({ page: i + 2, title: '第 ' + (i + 1) + ' 页', img: null });
      });

      /* 画布比例跟着封面走（和单张上传封面那段一致） */
      if (bk.cover && bk.cover.url) {
        var im = new Image();
        im.onload = function () {
          if (bk.cover && bk.cover.url === out.cover.url) {
            bk.cover.w = im.naturalWidth;
            bk.cover.h = im.naturalHeight;
            bk.w = im.naturalWidth || bk.w;
            bk.h = im.naturalHeight || bk.h;
            SD.Book.render();
            refresh();
            SD.Store.autoSave();
          }
        };
        im.src = bk.cover.url;
      }
      SD.Book.render();
      refresh();
      SD.Store.autoSave();          /* 只在这里存一次 */
      status('批量导入完成');
      toast('ok', '批量导入完成',
        '已导入 ' + plan.total.pages + ' 页 / ' + plan.total.images + ' 张图', 5000);
    }

    /* 有失败项 → **先不动书页**（用户定的规则：全部成功了才改），弹清单单独重试；
       重试成功后回到 afterAll()，把攒在 out 里的结果一次性写进 state。 */
    return chain.then(function () {
      if (failed.length) { showImportFailed(failed, afterAll); return; }
      afterAll();
    }).catch(function (e) {
      finish();
      status('批量导入失败', 'err');
      toast('err', '批量导入失败', (e && e.message) || '请重试');
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

    var batch = $('btnBatchImport');
    if (batch) batch.addEventListener('click', function () {
      if (!SERVER_OK) { toast('err', '预览不可用', '请改用「启动工作台.bat」打开工作台', 9000); return; }
      pickDirectory(function (files) {
        if (!files.length) return;
        var plan = SD.DirImport.scan(entriesOf(files));
        if (!plan.pages.length) {
          toast('err', '没认出内容页',
            '选的目录里没找到数字命名的子文件夹。请选到「以 1、2、3… 为直接子目录」的那一层。', 9000);
          return;
        }
        showImportPlan(plan, function () { runBatchImport(plan); });
      });
    });

    /* 书籍 logo：显示在书的上方居中（加载页的加载文案上方也用同一张） */
    var upLogo = $('btnUpLogo');
    if (upLogo) upLogo.addEventListener('click', function () {
      pickOneImage(function (it) {
        SD.Book.book().logo = { url: it.url, file: it.file, name: it.name };
        refresh();
        toast('ok', '书籍 logo 已上传', '显示在书的上方居中，加载页也会用它', 6000);
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

    /* 窑口图录：产物底部那个按钮里的条目（页码 + 标题 + 自定义图） */
    var addCat = $('btnAddCat');
    if (addCat) addCat.addEventListener('click', function () { SD.Book.addCatalog(); });
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

    /* 页面类型固定翻书图录：老工程里存的 'single' 也一律按书籍恢复，
       否则会出现「界面是书籍栏、预览却走单品查看器」的空白状态。 */
    STATE.pageType = 'book';
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

    /* 单品模式那份「当前素材」不再恢复：素材只挂在各内容页上（见下面的书页）。
       老工程里残留的 editingItems 直接忽略即可。 */

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
        /* 这一页的 360 素材：逐张重新上传换回新的 /@mat 地址 */
        var its = [];
        for (var k2 = 0; k2 < (((pg || {}).items) || []).length; k2++) {
          var it2 = pg.items[k2];
          var io = await upSheet(it2);
          its.push({
            url: io ? io.url : '',
            file: io ? io.file : (it2 && it2.file) || null,
            name: (io && io.name) || (it2 && it2.name) || '',
            axis: (it2 && it2.axis) || 'x',
            off: !!(it2 && it2.off),
            w: it2 && it2.w, h: it2 && it2.h
          });
        }
        pages.push({
          url: o ? o.url : '',
          file: o ? o.file : null,
          name: (o && o.name) || pg.name || '',
          items: its
        });
      }
      STATE.book.pages = pages;

      /* 书籍 logo 同样要重新传一遍（/@mat 地址一次性） */
      STATE.book.logo = await upSheet(snap.book.logo);

      /* 窑口图录：页码与标题直接恢复，自定义图要重新传一遍
         （/@mat/... 是一次性地址，服务一重启就失效） */
      var cats = [];
      for (var q = 0; q < ((snap.book.catalog) || []).length; q++) {
        var c0 = snap.book.catalog[q];
        var co = await upSheet(c0.img);
        cats.push({
          page: c0.page || 1,
          title: c0.title || '',
          img: co ? { url: co.url, file: co.file, name: co.name } : null
        });
      }
      STATE.book.catalog = cats;
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
        }),
        /* 窑口图录：结构与文字可以带走，自定义图不带（导入后重新选） */
        catalog: ((bk.catalog) || []).map(function (c) {
          return { page: c.page || 1, title: c.title || '',
                   imgName: (c.img && c.img.name) || '' };
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
    /* 同上：导入旧配置时也一律按翻书图录恢复 */
    STATE.pageType = 'book';
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
    /* 窑口图录：页码与标题恢复，自定义图留空待重新选 */
    STATE.book.catalog = ((conf.book && conf.book.catalog) || []).map(function (c) {
      return { page: c.page || 1, title: c.title || '', img: null };
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
  var _p360Key = '';
  function page360Render(force) {
    var host = $('page360List'), hint = $('page360Hint');
    if (!host) return;
    var sh = SD.Book ? SD.Book.activeSheet() : null;
    var list = (sh && sh.kind === 'page') ? SD.Book.itemsOf(sh) : null;
    /* 内容没变就别重建：参数滑杆会高频调 refresh，重建这排缩略图会闪一下 */
    var key = (sh ? sh.kind + '#' + sh.index : 'none') + '/' +
              (list ? list.length : -1) + '/' +
              (list ? list.map(function (it) {
                return (it.url || it.name || '') + (it.off ? '*' : '');
              }).join(',') : '');
    if (!force && key === _p360Key) return;
    _p360Key = key;
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
      /* 窑口图录的自定义图也是素材，一起换新地址 */
      (bk.catalog || []).forEach(function (c) { if (c) reupload(c.img); });

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
    /* 单品模式的素材面板（选择图片 / 文件夹 / 载入示例 / 拖拽导入 / 重排 /
       清空 / 水平垂直选择）整块已下线 —— 它的 DOM 已经不在了，绑定自然会
       抛「Cannot read properties of null」。底层函数（addMaterials /
       loadDemo / clearMaterials）保留，只是不再有入口调用它们。 */
    var dz = $('dropzone');   /* 旧版留下的拖拽导入；DOM 在就直接跳过 */
    if (dz) {
      dz.addEventListener('click', function () { var f = $('fileInput'); if (f) f.click(); });
      ['dragenter', 'dragover'].forEach(function (ev) {
        dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('over'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('over'); });
      });
    }

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

    /* 「页面类型」下拉已下线（只做翻书图录），这里的切换绑定一并去掉。
       书籍模型在启动时就会初始化（见 boot 里的 SD.Book.book()）。 */


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

    /* 「清空本地工程」= 清掉这个工程用到的**全部图片素材**：
       IndexedDB 里存的工程快照、本地服务内存里的 /@mat 素材、以及内存里
       书页 / 封面 / 封底 / 每页 360 / 窑口图录自定义图的引用。 */
    var btnWipe = $('btnWipeStore');
    if (btnWipe) btnWipe.addEventListener('click', function () {
      if (!confirm('确定清空本地工程吗？\n\n' +
                   '书页图、360 素材、窑口图录自定义图与参数都会消失，不可恢复。')) return;
      var clearLocal = SD.Materials && SD.Materials.clearServer
        ? SD.Materials.clearServer() : Promise.resolve();
      Promise.resolve(clearLocal).catch(function () {}).then(function () {
        return SD.Store.clear();
      }).then(function () {
        /* 内存里的图片引用也一并清掉，否则界面上还挂着已经失效的素材 */
        STATE.materials.items = [];
        var bk = SD.Book ? SD.Book.book() : (STATE.book || {});
        bk.cover = null;
        bk.back = null;
        (bk.pages || []).forEach(function (p) {
          p.url = ''; p.file = null; p.name = '';
          p.items = [];
        });
        (bk.catalog || []).forEach(function (c) { c.img = null; });
        renderMaterials();
        SD.Book.render();
        refresh();
        toast('ok', '已清空本地工程', '所有图片素材与参数都清掉了，刷新后不会再恢复', 7000);
      });
    });

    /* 「保存素材」= 手动把当前工程落库（平时是自动保存，这一下是「现在就存」）。
       存进去的是原始 File 对象，所以下次打开工作台书页图与 360 素材都还在。 */
    var btnSave = $('btnSaveStore');
    if (btnSave) btnSave.addEventListener('click', function () {
      var bk = SD.Book ? SD.Book.book() : (STATE.book || {});
      /* 页图和 360 素材要分开数。以前合成一个 n，而「批量导入」时每页的 360 素材
         就是从它自己的页图生成出来的，同一张源图被数了两遍（704 张显示成 1408），
         看着像「保存的时候又把老素材存了一遍」。保存本身是覆盖写，不会累积。 */
      var nPage = (bk.cover && bk.cover.file ? 1 : 0) + (bk.back && bk.back.file ? 1 : 0);
      var nFrame = 0;
      (bk.pages || []).forEach(function (p) {
        if (p && p.file) nPage += 1;
        nFrame += ((p && p.items) || []).filter(function (it) { return it && it.file; }).length;
      });
      nPage += (bk.catalog || []).filter(function (c) { return c && c.img && c.img.file; }).length;
      if (!nPage && !nFrame) {
        toast('warn', '还没有可保存的素材', '先在左栏上传封面 / 内容页图 / 360 素材');
        return;
      }
      status('正在保存素材…');
      SD.Store.saveNow().then(function (ok) {
        if (ok) {
          var txt = nPage + ' 张页图 + ' + nFrame + ' 帧 360 素材';
          status('已保存 · ' + txt);
          toast('ok', '素材已保存',
            '共 ' + txt + ' —— 下次打开工作台会自动恢复，可继续操作', 8000);
        } else {
          status('保存失败', 'err');
          toast('err', '保存失败', '浏览器可能禁用了本地存储（无痕模式 / 空间不足）');
        }
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
    /* 顶栏的「页面模板 / 参数预设」已按需求去掉，不再初始化它们
       （模板/预设的代码仍在，只是没有入口；产物默认走 templates 里的第一个） */
    buildParams();
    bindTitle();
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
        /* 先清掉旧版本留下的残留（单品模式那份临时素材 editingItems）：
           本地只该留「当前图录真正用到的素材」。顺带把内存里那份单品素材
           也清空 —— 它已经没有任何入口了。 */
        STATE.materials.items = [];
        SD.Store.purgeLegacy().then(function (purged) {
          if (purged) {
            SD.Store.saveNow();   /* 清完存一次干净快照，让本地库与当前工程一致 */
            toast('ok', '已清理旧的临时素材',
                  '本地只保留当前图录用到的素材', 6000);
          }
          return restoreFromStore();
        }).catch(function () {
          return restoreFromStore();
        }).then(function (restored) {
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
        /* ?book=1 以前靠「切到书籍模式」触发；页面类型已固定为书籍，
           这里只需要把书籍模型与左栏刷新一遍。 */
        STATE.pageType = 'book';
        SD.Book.book();
        SD.Book.render();
        syncParamsUI();
        refresh();
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
