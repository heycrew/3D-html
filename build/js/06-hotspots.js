/* =====================================================================
 * 06-hotspots.js —— 热点可视化编辑
 *
 * CI360 的热点在 JS 配置里是数组，positions 为「帧索引 → {x, y}」映射。
 * 省略 containerSize 时坐标按百分比（0-100）解释，所以工作台直接取
 * 点击位置占舞台的百分比，所见即所得。
 * ===================================================================== */
window.SD = window.SD || {};

SD.Hotspots = (function () {
  var picking = false;
  var layer = null;

  function st() { return SD.STATE; }

  function list() {
    var s = st();
    if (!s.hotspots) s.hotspots = [];
    return s.hotspots;
  }

  function stageEl() { return document.getElementById('stage-frame'); }

  /* 当前预览停在第几帧（0-based） */
  function activeFrame() {
    try {
      var ci = (typeof window.CI360 === 'function') ? new window.CI360() : window.CI360;
      var v = ci && ci.getViewById ? ci.getViewById('viewer') : null;
      if (v && typeof v.activeImageX === 'number') return v.activeImageX;
    } catch (e) { /* 忽略 */ }
    return 0;
  }

  /* ---------- 选点层 ---------- */
  function buildLayer() {
    if (layer && layer.parentNode) return layer;
    var stage = stageEl();
    if (!stage) return null;
    layer = document.createElement('div');
    layer.id = 'hotspot-layer';
    layer.style.cssText =
      'position:absolute;inset:0;z-index:20;cursor:crosshair;display:none;' +
      'background:rgba(79,142,247,.10);outline:2px dashed rgba(79,142,247,.7);outline-offset:-2px';
    layer.addEventListener('click', onPick);
    stage.appendChild(layer);
    return layer;
  }

  function startPicking() {
    if (!buildLayer()) return;
    picking = true;
    layer.style.display = 'block';
    SD.status('加热点：在预览图上点一下要放标记的位置（Esc 取消）', 'warn');
  }

  function stopPicking() {
    picking = false;
    if (layer) layer.style.display = 'none';
  }

  function onPick(e) {
    if (!picking) return;
    var r = stageEl().getBoundingClientRect();
    var x = Math.max(0, Math.min(100, +(((e.clientX - r.left) / r.width) * 100).toFixed(2)));
    var y = Math.max(0, Math.min(100, +(((e.clientY - r.top) / r.height) * 100).toFixed(2)));
    stopPicking();
    askDetails(activeFrame(), x, y);
  }

  /* ---------- 填写内容 ---------- */
  function askDetails(frame, x, y) {
    var mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = [
      '<div class="modal" style="width:min(460px,92vw)">',
      '  <div class="modal-head"><span>新增热点</span></div>',
      '  <div class="modal-body">',
      '    <p style="margin:0 0 10px">位置：第 <b>' + (frame + 1) + '</b> 帧，',
      '       x <b>' + x + '%</b>，y <b>' + y + '%</b></p>',
      '    <label style="display:block;margin-bottom:10px">',
      '      <span style="font-size:12px;color:var(--sd-fg2)">标记标题（时间轴上会显示）</span>',
      '      <input type="text" id="hsLabel" placeholder="例如：瓶口细节" ' +
      '        style="width:100%;margin-top:4px">',
      '    </label>',
      '    <label style="display:block">',
      '      <span style="font-size:12px;color:var(--sd-fg2)">弹窗内容（可写 HTML）</span>',
      '      <textarea id="hsBody" style="width:100%;height:78px;margin-top:4px" ' +
      '        placeholder="例如：&lt;b&gt;手工描金&lt;/b&gt;&lt;p&gt;口径 8cm，纯手工绘制&lt;/p&gt;"></textarea>',
      '    </label>',
      '  </div>',
      '  <div class="modal-foot">',
      '    <button class="btn" data-cancel>取消</button>',
      '    <button class="btn primary" data-ok>添加</button>',
      '  </div>',
      '</div>'
    ].join('\n');
    document.body.appendChild(mask);

    setTimeout(function () {
      var i = document.getElementById('hsLabel');
      if (i) i.focus();
    }, 30);

    function close() { if (mask.parentNode) mask.parentNode.removeChild(mask); }

    mask.addEventListener('click', function (e) {
      if (e.target === mask || e.target.hasAttribute('data-cancel')) { close(); return; }
      if (e.target.hasAttribute('data-ok')) {
        var lab = (document.getElementById('hsLabel').value || '').trim();
        var body = (document.getElementById('hsBody').value || '').trim();
        list().push({
          id: 'hs-' + Date.now().toString(36),
          label: lab || ('热点 ' + (list().length + 1)),
          content: body,
          frame: frame,
          x: x, y: y
        });
        close();
        if (SD.refresh) SD.refresh();
        SD.toast('ok', '已添加热点', '位置：第 ' + (frame + 1) + ' 帧');
      }
    });
  }

  /* ---------- 列表管理 ---------- */
  function showList() {
    var items = list();
    var mask = document.createElement('div');
    mask.className = 'modal-mask';
    var rows = items.length
      ? items.map(function (h, i) {
          return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;' +
                 'border-bottom:1px solid var(--sd-line)">' +
                 '<span style="color:var(--sd-fg3);width:20px">' + (i + 1) + '</span>' +
                 '<span style="flex:1">' + SD.Codegen.esc(h.label) +
                 '<span style="color:var(--sd-fg3);font-size:11px"> · 第 ' + (h.frame + 1) +
                 ' 帧 · ' + h.x + '%, ' + h.y + '%</span></span>' +
                 '<button class="btn ghost sm" data-del="' + h.id + '">删除</button>' +
                 '</div>';
        }).join('\n')
      : '<p style="color:var(--sd-fg3)">还没有热点。点「添加热点」后在预览图上选位置。</p>';

    mask.innerHTML = [
      '<div class="modal" style="width:min(520px,92vw)">',
      '  <div class="modal-head"><span>热点列表（' + items.length + '）</span></div>',
      '  <div class="modal-body">' + rows + '</div>',
      '  <div class="modal-foot">',
      '    <button class="btn" data-clear>全部清空</button>',
      '    <button class="btn primary" data-close>完成</button>',
      '  </div>',
      '</div>'
    ].join('\n');
    document.body.appendChild(mask);

    function close() { if (mask.parentNode) mask.parentNode.removeChild(mask); }

    mask.addEventListener('click', function (e) {
      var del = e.target.getAttribute && e.target.getAttribute('data-del');
      if (del) {
        var arr = list();
        for (var i = 0; i < arr.length; i++) {
          if (arr[i].id === del) { arr.splice(i, 1); break; }
        }
        close();
        if (SD.refresh) SD.refresh();
        showList();
        return;
      }
      if (e.target.hasAttribute('data-clear')) {
        st().hotspots = [];
        close();
        if (SD.refresh) SD.refresh();
        SD.toast('ok', '热点已清空');
        return;
      }
      if (e.target === mask || e.target.hasAttribute('data-close')) close();
    });
  }

  /* ---------- 写进 CI360 配置 ---------- */
  function applyTo(cfg) {
    var items = list();
    if (!items.length) return cfg;
    cfg.hotspots = items.map(function (h) {
      var pos = {};
      pos[h.frame] = { x: h.x, y: h.y };
      return {
        id: h.id,
        label: h.label,
        orientation: 'x',
        positions: pos,
        content: h.content || ('<strong>' + SD.Codegen.esc(h.label) + '</strong>')
      };
    });
    return cfg;
  }

  function count() { return list().length; }

  return {
    startPicking: startPicking,
    stopPicking: stopPicking,
    showList: showList,
    applyTo: applyTo,
    count: count,
    activeFrame: activeFrame
  };
})();
