/* =====================================================================
 * 09-lots.js —— 拍品（多场景）管理
 *
 * 工作台有两类页面：单品 360 展示、拍品列表（博古架）。
 * 拍品列表模式下，一个拍品 = 一套素材（沿用现有的水平/垂直分组）。
 *
 * 设计要点：STATE.lots 是「存储」，STATE.materials.items 是「当前正在编辑的
 * 那一份」。切换拍品时两边互相搬运 —— 这样 05-codegen / 07-export 里
 * 只看 materials.items 的逻辑完全不用改。
 * ===================================================================== */
window.SD = window.SD || {};

SD.Lots = (function () {

  function state() { return SD.STATE; }
  function lots() { return state().lots || (state().lots = []); }
  function activeIndex() { return state().activeLot || 0; }
  function current() { return lots()[activeIndex()] || null; }

  function newLot(n) {
    return {
      id: 'lot-' + Date.now().toString(36) + '-' + n,
      title: '拍品 ' + n,
      code: 'LOT ' + String(n),
      items: []
    };
  }

  /* ---------- 存储 ↔ 编辑视图 ---------- */
  function saveCurrent() {
    var lot = current();
    if (lot) lot.items = state().materials.items;
  }

  function pull(i) {
    state().activeLot = Math.max(0, Math.min(lots().length - 1, i));
    var lot = current();
    state().materials.items = (lot && lot.items) || [];
  }

  function load(i) {
    saveCurrent();
    pull(i);
  }

  function add() {
    saveCurrent();
    lots().push(newLot(lots().length + 1));
    pull(lots().length - 1);
    afterChange('已新增拍品');
  }

  function remove(i) {
    if (lots().length <= 1) { SD.toast('warn', '至少保留一个拍品'); return; }
    saveCurrent();
    lots().splice(i, 1);
    pull(Math.max(0, Math.min(lots().length - 1, i - 1)));
    afterChange('已删除拍品');
  }

  function move(i, dir) {
    var j = i + dir;
    if (j < 0 || j >= lots().length) return;
    saveCurrent();
    var a = lots();
    var t = a[i]; a[i] = a[j]; a[j] = t;
    pull(j);
    afterChange();
  }

  function rename(i, title, code) {
    var lot = lots()[i];
    if (!lot) return;
    if (title) lot.title = title;
    if (code !== undefined) lot.code = code;
    render();
    if (SD.refresh) SD.refresh();
  }

  function afterChange(msg) {
    if (SD.syncAfterLotChange) SD.syncAfterLotChange();
    if (msg) SD.toast('ok', msg);
  }

  /* ---------- 封面 = 该拍品第一张启用的图 ---------- */
  function coverUrl(lot) {
    var items = (lot && lot.items) || [];
    for (var i = 0; i < items.length; i++) {
      if (!items[i].off && items[i].url) return items[i].url;
    }
    return '';
  }

  function countOn(lot) {
    return ((lot && lot.items) || []).filter(function (x) { return !x.off; }).length;
  }

  /* ---------- 左栏渲染 ---------- */
  function render() {
    var host = document.getElementById('lotList');
    var bar = document.getElementById('lotBar');
    if (!host || !bar) return;

    var isLots = state().pageType === 'lots';
    bar.style.display = isLots ? '' : 'none';
    if (!isLots) return;

    host.innerHTML = '';
    lots().forEach(function (lot, i) {
      var cov = coverUrl(lot);
      var row = document.createElement('div');
      row.className = 'lot-row' + (i === activeIndex() ? ' on' : '');
      row.innerHTML =
        '<div class="lot-cover">' + (cov ? '<img alt="">' : '<span>无图</span>') + '</div>' +
        '<div class="lot-meta"><b></b><i></i></div>' +
        '<div class="lot-ops">' +
        '<button class="btn ghost sm" data-up title="上移">↑</button>' +
        '<button class="btn ghost sm" data-down title="下移">↓</button>' +
        '<button class="btn ghost sm" data-del title="删除">✕</button>' +
        '</div>';
      if (cov) row.querySelector('.lot-cover img').src = cov;
      row.querySelector('.lot-meta b').textContent = lot.title || '';
      row.querySelector('.lot-meta i').textContent = (lot.code || '') + ' · ' + countOn(lot) + ' 张';

      row.addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        load(i);
        afterChange();
      });
      row.querySelector('[data-up]').addEventListener('click', function (e) {
        e.stopPropagation(); move(i, -1);
      });
      row.querySelector('[data-down]').addEventListener('click', function (e) {
        e.stopPropagation(); move(i, 1);
      });
      row.querySelector('[data-del]').addEventListener('click', function (e) {
        e.stopPropagation(); remove(i);
      });
      host.appendChild(row);
    });
  }

  /* ---------- 初始化（首次进入拍品列表模式） ---------- */
  function ensureInit() {
    if (lots().length) return;
    var first = newLot(1);
    first.title = '拍品 1';
    first.code = 'LOT 1';
    first.items = state().materials.items || [];
    lots().push(first);
    state().activeLot = 0;
  }

  return {
    lots: lots,
    current: current,
    activeIndex: activeIndex,
    saveCurrent: saveCurrent,
    load: load,
    add: add,
    remove: remove,
    move: move,
    rename: rename,
    coverUrl: coverUrl,
    countOn: countOn,
    render: render,
    ensureInit: ensureInit
  };
})();
