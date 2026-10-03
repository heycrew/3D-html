/* =====================================================================
 * 03-materials.js —— 素材管线
 *
 * 关键约束（已实测）：Cloudimage 360 View 只接受普通 HTTP URL —— file://、
 * data:、blob: 一律加载不出来。所以本地图片必须经「读取 → 降采样 → 上传到
 * 本地服务」后，用 /@mat/... 这样的真实 URL 交给预览。
 * 导出时则改用原始文件写进 images/ 目录。
 * ===================================================================== */
window.SD = window.SD || {};

SD.Materials = (function () {
  var PREVIEW_MAX_EDGE = 960;   /* 预览图最大边长，够看清、又不拖慢渲染 */
  var serverOk = false;
  var checked = false;

  /* ---------- 探测本地服务 ---------- */
  var bootId = null;

  function ping() {
    if (checked) return Promise.resolve(serverOk);
    return fetch('/@ping', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        checked = true;
        serverOk = !!(j && j.ok);
        if (serverOk) bootId = j.boot || 'unknown';
        return serverOk;
      })
      .catch(function () { checked = true; serverOk = false; return false; });
  }

  /* 服务是否重启过（重启后内存里的素材全丢，URL 会 404） */
  function checkRestart() {
    return fetch('/@ping', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.ok) return false;
        var now = j.boot || 'unknown';
        var changed = (bootId !== null && now !== bootId);
        bootId = now;
        return changed;
      })
      .catch(function () { return false; });
  }

  function isServer() { return serverOk; }
  function isFileMode() { return location.protocol === 'file:'; }

  function clearServer() {
    if (!serverOk) return Promise.resolve();
    return fetch('/@mat', { method: 'DELETE' }).catch(function () {});
  }

  function safeName(name) {
    return String(name || 'frame').replace(/[\\\/:*?"<>|]+/g, '_');
  }

  /* ---------- 读图 ---------- */
  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve({ img: img, objUrl: url }); };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('无法读取图片：' + file.name));
      };
      img.src = url;
    });
  }

  /* 预览图存成什么格式：按原文件类型 —— 原是 PNG（可能有透明）就还是 PNG，
     其余（JPEG 等）存 JPEG。
     为什么必须分：实测书页素材 2000×2695 降采样到 960 后，PNG 是 462KB/张
     （704 张 = 317MB，全压在本地服务内存里），JPEG 只要 59KB/张（共 41MB）。 */
  function previewMime(file) {
    if (/png/i.test(file.type || '') || /\.png$/i.test(file.name || '')) return 'image/png';
    return 'image/jpeg';
  }

  /* ---------- 单张：降采样 + 上传 ---------- */
  function upload(file, axis) {
    return loadImage(file).then(function (o) {
      var img = o.img;
      var scale = Math.min(1, PREVIEW_MAX_EDGE / Math.max(img.width, img.height));
      var w = Math.max(1, Math.round(img.width * scale));
      var h = Math.max(1, Math.round(img.height * scale));

      var cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);

      var meta = {
        name: file.name,
        w: img.width, h: img.height,
        previewW: w, previewH: h,
        file: file,
        off: false,
        axis: axis === 'y' ? 'y' : 'x'
      };

      return new Promise(function (resolve) {
        cv.toBlob(function (blob) {
          if (!blob) { URL.revokeObjectURL(o.objUrl); resolve(meta); return; }
          fetch('/@upload', {
            method: 'POST',
            headers: { 'X-File-Name': encodeURIComponent(safeName(file.name)) },
            body: blob
          })
            .then(function (r) { return r.json(); })
            .then(function (j) {
              meta.url = j.url;
              URL.revokeObjectURL(o.objUrl);
              resolve(meta);
            })
            .catch(function () {
              URL.revokeObjectURL(o.objUrl);
              resolve(meta);
            });
        }, previewMime(file), 0.85);
      });
    });
  }

  /* ---------- 自然排序 ----------
     识别器（09-dirimport.js）给 360 帧排序要用**同一处**规则：
     两套规则漂移会让「预览里看到的帧序」和「实际传上去的顺序」不一致，
     而 360 帧序错一格整个旋转就错乱。 */
  function naturalCompare(a, b) {
    return String(a).localeCompare(String(b), 'zh-Hans-CN',
      { numeric: true, sensitivity: 'base' });
  }

  /* ---------- 批量导入（串行上传以免打爆内存） ---------- */
  function importFiles(files, axis, onProgress) {
    var list = Array.prototype.slice.call(files).filter(function (f) {
      return /^image\//.test(f.type) ||
             /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name);
    });
    if (!list.length) return Promise.resolve([]);

    list.sort(function (a, b) { return naturalCompare(a.name, b.name); });

    var out = [];
    var chain = Promise.resolve();
    list.forEach(function (f, i) {
      chain = chain.then(function () {
        if (onProgress) onProgress(i + 1, list.length, f.name);
        return upload(f, axis).then(function (m) { out.push(m); });
      });
    });
    return chain.then(function () { return out; });
  }

  /* ---------- 生成示例素材（无素材时可直接看效果） ---------- */
  function demoItems() {
    return new Promise(function (resolve) {
      var colors = ['#d94141', '#2fae63', '#2f6fd0', '#d9a72f', '#9a3fd0', '#2fa9b8'];
      var labels = ['前', '右', '后', '左', '上', '下'];
      var out = [];
      var chain = Promise.resolve();
      labels.forEach(function (lb, i) {
        chain = chain.then(function () {
          var cv = document.createElement('canvas');
          cv.width = 480; cv.height = 360;
          var x = cv.getContext('2d');
          x.fillStyle = colors[i]; x.fillRect(0, 0, 480, 360);
          x.fillStyle = 'rgba(255,255,255,.95)';
          x.font = 'bold 110px "Microsoft YaHei",sans-serif';
          x.textAlign = 'center'; x.textBaseline = 'middle';
          x.fillText(lb, 240, 165);
          x.font = '22px "Microsoft YaHei",sans-serif';
          x.fillStyle = 'rgba(255,255,255,.78)';
          x.fillText('第 ' + (i + 1) + ' / 6 帧', 240, 268);

          return new Promise(function (res) {
            cv.toBlob(function (blob) {
              var nm = 'frame-' + (i + 1) + '.png';
              var meta = { name: nm, w: 480, h: 360,
                           previewW: 480, previewH: 360, off: false,
                           axis: i < 4 ? 'x' : 'y',
                           /* 存一份 File，这样刷新后也能被自动恢复 */
                           file: blob ? new File([blob], nm, { type: 'image/png' }) : null };
              if (!serverOk || !blob) { res(meta); return; }
              fetch('/@upload', {
                method: 'POST',
                headers: { 'X-File-Name': encodeURIComponent(meta.name) },
                body: blob
              }).then(function (r) { return r.json(); })
                .then(function (j) { meta.url = j.url; res(meta); })
                .catch(function (e) { meta.err = (e && e.message) || '上传失败'; res(meta); });
            }, 'image/png');
          });
        });
        chain = chain.then(function (m) { out.push(m); });
      });
      chain.then(function () { resolve(out); });
    });
  }

  return {
    ping: ping,
    checkRestart: checkRestart,
    isServer: isServer,
    isFileMode: isFileMode,
    clearServer: clearServer,
    naturalCompare: naturalCompare,
    importFiles: importFiles,
    demoItems: demoItems,
    PREVIEW_MAX_EDGE: PREVIEW_MAX_EDGE
  };
})();
