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
      /* 当前正在编辑的那一份也要存 */
      editingItems: (st.materials && st.materials.items || []).map(function (it) {
        return {
          name: it.name || '', w: it.w, h: it.h,
          axis: it.axis || 'x', off: !!it.off, file: it.file || null
        };
      }),

      book: {
        w: bk.w || 900, h: bk.h || 1200,
        active: bk.active || 0,
        cover: fileOf(bk.cover),
        back: fileOf(bk.back),
        pages: ((bk.pages) || []).map(function (p) {
          return {
            name: p.name || '', file: p.file || null
          };
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

  /* 完全空的工程不必存 */
  function hasWork(snap) {
    if (snap.editingItems && snap.editingItems.length) return true;
    var b = snap.book || {};
    if (b.cover && b.cover.file) return true;
    if (b.back && b.back.file) return true;
    if ((b.pages || []).some(function (p) { return p.file; })) return true;
    return false;
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
    lastSaved: lastSaved,
    isEnabled: isEnabled,
    setEnabled: setEnabled
  };
})();
