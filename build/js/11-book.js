/* =====================================================================
 * 11-book.js —— 翻书图录：书籍数据模型与页管理
 *
 * 一本书 = 封面 + N 张内容页 + 封底，全部按统一尺寸显示。
 * 内容页可以自带一组 360 素材，点击页面即弹出查看。
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
        pages: [],                /* { url, file, name, items: [360 素材] } */
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
    b.pages.push({ url: '', file: null, name: '', items: [] });
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

  /* ---------- 本页的 360 素材组（一个内容页自带一组，点页面即可弹出） ---------- */
  function itemsOf(sh) {
    if (!sh || sh.kind !== 'page') return null;
    if (!sh.page.items) sh.page.items = [];
    return sh.page.items;
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
        sub: (function () {
          var n = (p.items || []).filter(function (it) { return !it.off; }).length;
          return n ? (n + ' 张 360 素材') : '未上传 360 素材';
        })(),
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

  /* ---------- 窑口图录条目 ----------
     产物底部那个按钮里的内容：每条 = 页码 + 标题 +（可选）自定义图。
     数组顺序就是显示顺序；自定义图为空时，展示时自动回退成该页的图。 */
  function catalog() {
    var b = book();
    if (!b.catalog) b.catalog = [];
    return b.catalog;
  }

  function addCatalog() {
    var list = catalog();
    /* 默认指向第 1 张内容页（页码 2 = 封面之后的第一张；只有封面时退回 1） */
    list.push({ page: Math.min(2, lastIndex()), title: '', img: null });
    afterChange('已添加一条窑口图录');
  }

  function removeCatalog(i) {
    var list = catalog();
    if (i < 0 || i >= list.length) return;
    list.splice(i, 1);
    afterChange('已删除该条目');
  }

  function moveCatalog(i, dir) {
    var list = catalog();
    var j = i + dir;
    if (i < 0 || i >= list.length || j < 0 || j >= list.length) return;
    var t = list[i]; list[i] = list[j]; list[j] = t;
    afterChange();
  }

  function setCatalog(i, patch) {
    var list = catalog();
    if (i < 0 || i >= list.length) return;
    var c = list[i];
    Object.keys(patch || {}).forEach(function (k) { c[k] = patch[k]; });
    afterChange();
  }

  return {
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
    itemsOf: itemsOf,
    catalog: catalog,
    addCatalog: addCatalog,
    removeCatalog: removeCatalog,
    moveCatalog: moveCatalog,
    setCatalog: setCatalog,
    render: render
  };
})();
