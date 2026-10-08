/* =====================================================================
 * 13-store.js —— 工程自动保存 / 恢复（IndexedDB）
 *
 * 为什么需要：素材只存在内存里，刷新页面就全没了 —— 用户辛苦传的
 * 几十张图会一并消失。这里把「参数 + 素材 + 书页」
 * 自动存进浏览器本地数据库，下次打开自动恢复。
 *
 * 关键点：预览用的 /@mat/... URL 是本地服务临时发的，重启即失效，
 * 所以存的是**原始 File 对象**（IndexedDB 支持结构化克隆 File/Blob），
 * 恢复时重新上传一遍换回新的 URL。
 * ===================================================================== */
window.SD = window.SD || {};

SD.Store = (function () {
  var DB_NAME = 'ci360-studio';
  var STORE = 'project';
  var KEY = 'current';
  var VERSION = 1;

  var dbPromise = null;
  var saveTimer = null;
  var lastSavedAt = 0;
  var enabled = true;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req;
      try { req = indexedDB.open(DB_NAME, VERSION); }
      catch (e) { reject(e); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }

  function tx(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(STORE, mode);
        var store = t.objectStore(STORE);
        var out = fn(store);
        t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error); };
      });
    });
  }

  /* ---------- 快照：把当前工程压成可存的结构 ---------- */
  function fileOf(o) {
    if (!o) return null;
    return { name: o.name || '', file: o.file || null };
  }

  function snapshot() {
    var st = SD.STATE;
    if (!st) return null;
    var bk = st.book || {};
    return {
      v: VERSION,
      savedAt: Date.now(),
      pageType: st.pageType || 'single',
      title: st.title || '',
      customCss: st.customCss || '',
      templateId: st.templateId || '',
      params: JSON.parse(JSON.stringify(st.params || {})),
      /* 这里原本还存着单品模式的「当前素材」（editingItems）。单品 360 展示
         已下线，那一份临时素材不再需要 —— 素材现在只挂在各内容页上
         （见下面的 book.pages[].items），别再往库里塞一份重复的。 */

      book: {
        w: bk.w || 900, h: bk.h || 1200,
        active: bk.active || 0,
        cover: fileOf(bk.cover),
        back: fileOf(bk.back),
        /* 书籍 logo（显示在书的上方居中 + 加载页文案上方）*/
        logo: fileOf(bk.logo),
        pages: ((bk.pages) || []).map(function (p) {
          return {
            name: p.name || '', file: p.file || null,
            /* 每页自己的 360 素材也要存 —— 少这一段，刷新后「本页 360 素材」
               就整组丢了（用户反馈过：保存以后下次打开 360 素材没了）。 */
            items: ((p.items) || []).map(function (it) {
              return {
                name: it.name || '', file: it.file || null,
                axis: it.axis || 'x', off: !!it.off, w: it.w, h: it.h
              };
            })
          };
        }),
        /* 图录条目（页码 + 标题 + 可选的自定义图），数组顺序就是显示顺序 */
        catalog: ((bk.catalog) || []).map(function (c) {
          return { page: c.page || 1, title: c.title || '', img: fileOf(c.img) };
        })
      }
    };
  }

  /* ---------- 保存 ---------- */
  function saveNow() {
    if (!enabled) return Promise.resolve(false);
    var snap;
    try { snap = snapshot(); } catch (e) { return Promise.resolve(false); }
    if (!snap) return Promise.resolve(false);
    if (!hasWork(snap)) return Promise.resolve(false);
    return tx('readwrite', function (store) { store.put(snap, KEY); })
      .then(function () {
        lastSavedAt = Date.now();
        if (SD.onStoreSaved) SD.onStoreSaved(lastSavedAt);
        return true;
      })
      .catch(function () { return false; });
  }

  /* 「有内容」= 书籍工程里真的挂着素材。
     注意：只看 book —— 单品模式那份临时素材（editingItems）已经下线，
     不能再让一个「只剩单品素材的老工程」被当成有内容、一遍遍存下去。 */
  function hasWork(snap) {
    var b = snap.book || {};
    if (b.cover && b.cover.file) return true;
    if (b.back && b.back.file) return true;
    if ((b.pages || []).some(function (p) {
      return p.file || (p.items || []).some(function (it) { return it && it.file; });
    })) return true;
    if ((b.catalog || []).some(function (c) { return c && c.img && c.img.file; })) return true;
    return false;
  }

  /* ---------- 清掉旧版本留下的残留 ----------
     单品 360 展示下线之后，老的工程快照里还躺着 editingItems（那一份临时素材
     的 File 对象）：既用不上、又占空间，还会把「空工程」判成有内容。
     这里在读出来之后判断一次，有残留就用干净结构覆盖回去（等于删掉那份素材）。
     返回 true 表示确实清理过。 */
  function purgeLegacy() {
    return load().then(function (snap) {
      if (!snap) return false;
      var legacy = Object.prototype.hasOwnProperty.call(snap, 'editingItems')
                || Object.prototype.hasOwnProperty.call(snap, 'materials')
                || snap.pageType === 'single';
      if (!legacy) return false;
      var clean = snapshot();
      if (!hasWork(clean)) {
        /* 清理完发现其实只剩空壳 → 整条记录删掉，别留着 */
        return tx('readwrite', function (store) { store.delete(KEY); })
          .then(function () { return true; }).catch(function () { return false; });
      }
      return tx('readwrite', function (store) { store.put(clean, KEY); })
        .then(function () { return true; }).catch(function () { return false; });
    }).catch(function () { return false; });
  }

  /* 变更后延时保存，避免拖动参数时疯狂写库 */
  function autoSave(delay) {
    if (!enabled) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveTimer = null;
      saveNow();
    }, delay === undefined ? 1500 : delay);
  }

  function load() {
    return tx('readonly', function (store) { return store.get(KEY); })
      .then(function (v) { return v || null; })
      .catch(function () { return null; });
  }

  function clear() {
    enabled = false;
    return tx('readwrite', function (store) { store.delete(KEY); })
      .then(function () { enabled = true; if (SD.onStoreCleared) SD.onStoreCleared(); return true; })
      .catch(function () { enabled = true; return false; });
  }

  function lastSaved() { return lastSavedAt; }
  function isEnabled() { return enabled; }
  function setEnabled(v) { enabled = !!v; }

  return {
    snapshot: snapshot,
    saveNow: saveNow,
    autoSave: autoSave,
    load: load,
    clear: clear,
    purgeLegacy: purgeLegacy,
    lastSaved: lastSaved,
    isEnabled: isEnabled,
    setEnabled: setEnabled
  };
})();
