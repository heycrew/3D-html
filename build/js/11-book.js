/* =====================================================================
 * 11-book.js —— 翻书图录：书籍数据模型与页管理
 *
 * 一本书 = 封面 + N 张内容页 + 封底，全部按统一尺寸显示。
 * 内容页上可以打锚点，锚点绑定到某个拍品（复用 STATE.lots），
 * 点击锚点弹出该拍品的 360 —— 没传 360 素材的拍品则不可点。
 *
 * 「页」在界面上是一条虚拟序列：[封面, 页1, 页2 … 页N, 封底]，
 * 用 active 索引表示当前正在编辑的是哪一张。
 * ===================================================================== */
window.SD = window.SD || {};

SD.Book = (function () {

  function st() { return SD.STATE; }

  function book() {
    var s = st();
    if (!s.book) {
      s.book = {
        w: 900, h: 1200,          /* 整本书的统一尺寸，可自定义 */
        cover: null,              /* { url, file, name } */
        back: null,
        pages: [],                /* { url, file, name, anchors: [{x,y,lotId}] } */
        active: 0                 /* 当前编辑的纸张索引 */
      };
    }
    if (!s.book.pages) s.book.pages = [];
    return s.book;
  }

  /* ---------- 虚拟页序列 ---------- */
  function lastIndex() { return book().pages.length + 1; }

  function sheetAt(i) {
    var b = book();
    if (i <= 0) return { kind: 'cover', index: 0, label: '封面' };
    if (i >= lastIndex()) return { kind: 'back', index: lastIndex(), label: '封底' };
    return { kind: 'page', index: i, page: b.pages[i - 1], label: '第 ' + i + ' 页' };
  }

  function activeIndex() { return book().active || 0; }
  function activeSheet() { return sheetAt(activeIndex()); }

  function setActive(i) {
    var b = book();
    b.active = Math.max(0, Math.min(lastIndex(), i));
  }

  function imageOfSheet(sh) {
    var b = book();
    if (sh.kind === 'cover') return b.cover;
    if (sh.kind === 'back') return b.back;
    return sh.page || null;
  }

  /* ---------- 页操作 ---------- */
  function addPage() {
    var b = book();
    b.pages.push({ url: '', file: null, name: '', anchors: [] });
    setActive(b.pages.length);
    afterChange('已新增一页');
  }

  function removePage(i) {
    var b = book();
    if (i < 0 || i >= b.pages.length) return;
    b.pages.splice(i, 1);
    setActive(Math.min(activeIndex(), lastIndex()));
    afterChange('已删除该页');
  }

  function movePage(i, dir) {
    var b = book();
    var j = i + dir;
    if (i < 0 || i >= b.pages.length || j < 0 || j >= b.pages.length) return;
    var t = b.pages[i]; b.pages[i] = b.pages[j]; b.pages[j] = t;
    setActive(j + 1);
    afterChange();
  }

  /* ---------- 锚点 ---------- */
  function anchorsOf(sh) {
    if (sh.kind !== 'page' || !sh.page) return [];
    if (!sh.page.anchors) sh.page.anchors = [];
    return sh.page.anchors;
  }

  function addAnchor(sh, x, y, lotId) {
    var list = anchorsOf(sh);
    list.push({ id: 'an-' + Date.now().toString(36), x: x, y: y, lotId: lotId || '' });
    afterChange('已添加锚点');
  }

  function removeAnchor(sh, id) {
    var list = anchorsOf(sh);
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { list.splice(i, 1); break; }
    }
    afterChange('已删除锚点');
  }

  function anchorCount() {
    return book().pages.reduce(function (n, p) {
      return n + ((p && p.anchors) ? p.anchors.length : 0);
    }, 0);
  }

  /* ---------- 拍品是否有 360 素材（决定锚点能不能点） ---------- */
  function lotHasMedia(lotId) {
    if (!lotId || !SD.Lots) return false;
    var arr = SD.Lots.lots() || [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === lotId) return SD.Lots.countOn(arr[i]) > 0;
    }
    return false;
  }

  function lotTitle(lotId) {
    if (!lotId || !SD.Lots) return '';
    var arr = SD.Lots.lots() || [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].id === lotId) return arr[i].title || '';
    }
    return '';
  }

  function afterChange(msg) {
    render();
    if (SD.refresh) SD.refresh();
    if (msg) SD.toast('ok', msg);
  }

  /* ---------- 左栏渲染 ---------- */
  function render() {
    var host = document.getElementById('bookList');
    var bar = document.getElementById('bookBar');
    if (!host || !bar) return;

    var isBook = st().pageType === 'book';
    bar.style.display = isBook ? '' : 'none';
    if (!isBook) return;

    var b = book();
    host.innerHTML = '';

    var rows = [];
    rows.push({ i: 0, label: '封面', sub: b.cover ? '已上传' : '未上传', img: b.cover, kind: 'cover' });
    b.pages.forEach(function (p, k) {
      rows.push({
        i: k + 1,
        label: '第 ' + (k + 1) + ' 页',
        sub: (p.anchors ? p.anchors.length : 0) + ' 个锚点',
        img: p, kind: 'page', pi: k
      });
    });
    rows.push({ i: lastIndex(), label: '封底', sub: b.back ? '已上传' : '未上传', img: b.back, kind: 'back' });

    rows.forEach(function (r) {
      var row = document.createElement('div');
      row.className = 'lot-row' + (r.i === activeIndex() ? ' on' : '');
      row.innerHTML =
        '<div class="lot-cover">' + (r.img && r.img.url ? '<img alt="">' : '<span>空</span>') + '</div>' +
        '<div class="lot-meta"><b></b><i></i></div>' +
        ((r.kind === 'page')
          ? '<div class="lot-ops">' +
            '<button class="btn ghost sm" data-up title="上移">↑</button>' +
            '<button class="btn ghost sm" data-down title="下移">↓</button>' +
            '<button class="btn ghost sm" data-del title="删除">✕</button>' +
            '</div>'
          : '');
      if (r.img && r.img.url) row.querySelector('.lot-cover img').src = r.img.url;
      row.querySelector('.lot-meta b').textContent = r.label;
      row.querySelector('.lot-meta i').textContent = r.sub;

      row.addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        setActive(r.i);
        render();
        if (SD.refresh) SD.refresh();
      });
      if (r.kind === 'page') {
        row.querySelector('[data-up]').addEventListener('click', function (e) {
          e.stopPropagation(); movePage(r.pi, -1);
        });
        row.querySelector('[data-down]').addEventListener('click', function (e) {
          e.stopPropagation(); movePage(r.pi, 1);
        });
        row.querySelector('[data-del]').addEventListener('click', function (e) {
          e.stopPropagation(); removePage(r.pi);
        });
      }
      host.appendChild(row);
    });
  }

  /* ---------- 锚点选点：先在下方选拍品，再在页图上点位置 ---------- */
  function startAnchorPick() {
    var sh = activeSheet();
    if (sh.kind !== 'page') { SD.toast('warn', '请先在左侧选中一张内容页'); return; }
    if (!sh.page || !sh.page.url) { SD.toast('warn', '本页还没上传图片'); return; }

    var arr = (SD.Lots && SD.Lots.lots()) || [];
    /* 锚点必须绑定拍品；一个都没有时自动补一个，避免下拉空着没法操作 */
    if (!arr.length) {
      SD.Lots.add();
      arr = SD.Lots.lots() || [];
      SD.toast('warn', '已自动新建「拍品 1」', '记得给它上传 360 素材，否则锚点在成品页面上会置灰', 7000);
    }
    var opts = arr.map(function (l) {
      var has = countOnLot(l) > 0;
      return '<option value="' + l.id + '"' + (has ? '' : ' data-nomedia="1"') + '>' +
             SD.Codegen.esc(l.title || l.id) + (has ? '' : '（无 360 素材）') + '</option>';
    }).join('');

    var mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = [
      '<div class="modal" style="width:min(680px,94vw)">',
      '  <div class="modal-head"><span>在页面上点选锚点</span>',
      '    <span class="spacer"></span><button class="btn ghost sm" data-close>完成</button></div>',
      '  <div class="modal-body">',
      '    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">',
      '      <span style="font-size:12px;color:var(--sd-fg2)">关联拍品</span>',
      '      <select id="anLot" style="flex:1">' + opts + '</select>',
      '    </div>',
      '    <p style="margin:0 0 8px;color:var(--sd-fg3);font-size:12px">',
      '      先选好拍品，再在下面的页面上点位置（可连续点多个）。',
      '      标注为「无 360 素材」的拍品，成品页面上会置灰且不可点。</p>',
      '    <div id="anStage" style="position:relative;width:100%;max-width:560px;margin:0 auto;',
      '      border:1px solid var(--sd-line2);border-radius:6px;overflow:hidden;cursor:crosshair">',
      '      <img id="anImg" style="width:100%;display:block" alt="">',
      '    </div>',
      '    <div id="anList" style="margin-top:12px"></div>',
      '  </div>',
      '</div>'
    ].join('\n');
    document.body.appendChild(mask);

    /* 素材 URL 是本地服务临时发的，服务重启后就失效了 ——
       这里检测加载失败并自动用原始 File 重传一次，避免「弹窗开着却看不到页面」 */
    var anImg = document.getElementById('anImg');
    anImg.onerror = function () {
      if (sh.page && sh.page.file) {
        SD.status('页面图已失效，正在重新载入…', 'warn');
        SD.Materials.importFiles([sh.page.file], 'x', null).then(function (r) {
          if (r && r.length) {
            sh.page.url = r[0].url;
            anImg.src = r[0].url;
            SD.status('就绪');
            SD.toast('ok', '页面图已重新载入');
          } else { SD.toast('err', '页面图重新载入失败', '请重新上传本页图片'); }
        }).catch(function () { SD.toast('err', '页面图重新载入失败', '请重新上传本页图片'); });
      } else {
        SD.toast('err', '页面图加载失败', '可能是本地服务重启过 —— 请刷新工作台（Ctrl+F5）后重试');
      }
    };
    anImg.src = sh.page.url;

    function refreshList() {
      var list = anchorsOf(sh);
      var host = document.getElementById('anList');
      if (!list.length) { host.innerHTML = '<p style="color:var(--sd-fg3);font-size:12px">还没有锚点</p>'; return; }
      host.innerHTML = '';
      list.forEach(function (a) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:5px 0;' +
                            'border-bottom:1px solid var(--sd-line);font-size:12px';
        row.innerHTML = '<span style="flex:1">' + SD.Codegen.esc(lotTitle(a.lotId) || '未绑定') +
          '<span style="color:var(--sd-fg3)"> · ' + a.x + '%, ' + a.y + '%</span></span>' +
          '<button class="btn ghost sm" data-del="' + a.id + '">删除</button>';
        row.querySelector('[data-del]').addEventListener('click', function () {
          removeAnchor(sh, a.id);
          refreshList();
        });
        host.appendChild(row);
      });
    }
    refreshList();

    document.getElementById('anStage').addEventListener('click', function (e) {
      var r = e.currentTarget.getBoundingClientRect();
      var x = Math.max(0, Math.min(100, +(((e.clientX - r.left) / r.width) * 100).toFixed(2)));
      var y = Math.max(0, Math.min(100, +(((e.clientY - r.top) / r.height) * 100).toFixed(2)));
      var sel = document.getElementById('anLot');
      if (!sel || !sel.options.length) {
        SD.toast('err', '没有可关联的拍品', '请先在左栏「拍品」区点「＋ 新增」并上传 360 素材', 8000);
        return;
      }
      if (!sel.value) { SD.toast('warn', '请先在上方选择关联拍品'); return; }
      addAnchor(sh, x, y, sel.value);
      refreshList();
    });

    mask.addEventListener('click', function (e) {
      if (e.target === mask || e.target.hasAttribute('data-close')) {
        if (mask.parentNode) mask.parentNode.removeChild(mask);
        if (SD.refresh) SD.refresh();
      }
    });
  }

  function countOnLot(l) {
    return ((l && l.items) || []).filter(function (x) { return !x.off; }).length;
  }

  return {
    startAnchorPick: startAnchorPick,
    book: book,
    lastIndex: lastIndex,
    sheetAt: sheetAt,
    activeIndex: activeIndex,
    activeSheet: activeSheet,
    setActive: setActive,
    imageOfSheet: imageOfSheet,
    addPage: addPage,
    removePage: removePage,
    movePage: movePage,
    anchorsOf: anchorsOf,
    addAnchor: addAnchor,
    removeAnchor: removeAnchor,
    anchorCount: anchorCount,
    lotHasMedia: lotHasMedia,
    lotTitle: lotTitle,
    render: render
  };
})();
