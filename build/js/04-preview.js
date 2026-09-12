/* =====================================================================
 * 04-preview.js —— 实时预览（同文档真实渲染）
 *
 * 为什么不用 iframe.srcdoc：实测 CI360 在 srcdoc 文档里完全不渲染。
 * 另外库不支持参数热更新，所以每次改动都 destroyAll() + 清空容器 + 重新 init()。
 * ===================================================================== */
window.SD = window.SD || {};

SD.Preview = (function () {
  var host = null;
  var timer = null;
  var mounted = false;

  function mount(el) {
    host = el;
    mounted = true;
  }

  function destroy() {
    try {
      var ci = (typeof window.CI360 === 'function') ? new window.CI360() : window.CI360;
      if (ci && ci.destroyAll) ci.destroyAll();
    } catch (e) { /* 尚未初始化过，忽略 */ }
    if (host) host.innerHTML = '';
  }

  function render(state) {
    if (!mounted || !host) return;
    destroy();

    /* 拍品列表（博古架）：整页交给 iframe，布局所见即所得 */
    if (state.pageType === 'lots' && SD.Bogu) {
      var box = document.createElement('iframe');
      box.setAttribute('title', '预览');
      box.style.cssText = 'width:100%;height:100%;border:0;display:block;background:#f5f2ec';
      box.srcdoc = SD.Bogu.buildHtml(state, { mode: 'preview' });
      host.appendChild(box);
      if (SD.ShowEmpty) SD.ShowEmpty(false);
      return;
    }

    var cfg;
    try {
      cfg = SD.Codegen.buildConfig(state, { mode: 'preview' });
    } catch (e) {
      SD.status('预览配置生成失败：' + (e && e.message), 'err');
      return;
    }

    var list = cfg.imageListX || [];
    if (!list.length) {
      if (SD.ShowEmpty) SD.ShowEmpty(true);
      return;
    }
    if (SD.ShowEmpty) SD.ShowEmpty(false);

    var el = document.createElement('div');
    el.className = 'cloudimage-360';
    el.id = 'viewer';
    el.style.cssText = 'width:100%;height:100%';
    host.appendChild(el);

    try {
      var ci = (typeof window.CI360 === 'function') ? new window.CI360() : window.CI360;
      ci.init(el, cfg);
    } catch (e) {
      SD.status('预览初始化失败：' + (e && e.message), 'err');
    }
  }

  function schedule(state, delay) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      timer = null;
      render(state);
    }, delay === undefined ? 220 : delay);
  }

  return { mount: mount, destroy: destroy, render: render, schedule: schedule };
})();
