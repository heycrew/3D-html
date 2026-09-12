/* =====================================================================
 * 02-templates.js —— 页面外观模板
 * 每个模板 = 产物页面的 DOM 结构 + CSS + 参数默认覆盖
 * 预览与导出共用同一份定义，保证所见即所得
 * ===================================================================== */
window.SD = window.SD || {};

SD.TEMPLATES = [
  {
    id: 'bare',
    name: '极简铺满',
    desc: '查看器铺满整个页面，只保留缩放与全屏按钮',
    defaults: { fullscreen: true, zoomControls: true, aspectRatio: '', hints: true },
    body: [
      '<div id="viewer" class="cloudimage-360"></div>'
    ].join('\n'),
    css: [
      'html,body{height:100%;margin:0;padding:0;overflow:hidden;background:#f6f7f9;',
      '  font-family:-apple-system,"Microsoft YaHei","PingFang SC",sans-serif;}',
      'body{display:grid;place-items:center;}',
      '/* 高度跟随视口、宽度按素材比例自适应，保证整图完整显示且不被放大 */',
      '#viewer{height:100vh;height:100dvh;width:auto;max-width:100vw;max-height:100vh;}'
    ].join('\n')
  },

  {
    id: 'card',
    name: '电商详情卡',
    desc: '左侧 360° 查看器 + 右侧商品信息，带「加入购物车」',
    defaults: { fullscreen: true, zoomControls: true, aspectRatio: '4/3', hints: true },
    body: [
      '<div class="wrap">',
      '  <div class="viewer-col">',
      '    <div id="viewer" class="cloudimage-360"></div>',
      '  </div>',
      '  <div class="info">',
      '    <h1>商品名称</h1>',
      '    <p class="sub">副标题 / 卖点一句话</p>',
      '    <div class="price">¥ 1,299.00</div>',
      '    <p class="desc">拖动图片可 360° 查看商品细节。双击放大，滚轮或双指缩放，支持全屏。</p>',
      '    <div class="tags"><span>正品保障</span><span>七天无理由</span><span>顺丰包邮</span></div>',
      '    <button class="buy">加入购物车</button>',
      '  </div>',
      '</div>'
    ].join('\n'),
    css: [
      'body{margin:0;background:#fff;color:#1f2329;',
      '  font-family:-apple-system,"Microsoft YaHei","PingFang SC",sans-serif;}',
      '.wrap{display:flex;gap:32px;max-width:1160px;margin:0 auto;padding:32px 24px;',
      '  flex-wrap:wrap;align-items:flex-start;}',
      '.viewer-col{flex:1 1 520px;min-width:300px;}',
      '#viewer{width:100%;aspect-ratio:4/3;background:#f6f7f9;border-radius:10px;',
      '  overflow:hidden;border:1px solid #eceef2;}',
      '.info{flex:1 1 300px;min-width:260px;padding-top:6px;}',
      '.info h1{font-size:22px;margin:0 0 6px;line-height:1.4;}',
      '.info .sub{color:#8a929e;font-size:13px;margin:0 0 16px;}',
      '.price{color:#e4393c;font-size:28px;font-weight:700;margin-bottom:16px;}',
      '.desc{color:#5c6673;line-height:1.9;font-size:14px;margin:0 0 18px;}',
      '.tags{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px;}',
      '.tags span{background:#f2f4f7;color:#5c6673;font-size:12px;padding:4px 10px;border-radius:4px;}',
      '.buy{background:#ff5a2c;color:#fff;border:0;border-radius:8px;padding:13px 40px;',
      '  font-size:15px;font-weight:600;cursor:pointer;transition:background .15s;}',
      '.buy:hover{background:#e84c20;}'
    ].join('\n')
  },

  {
    id: 'dark',
    name: '暗色展厅',
    desc: '深色背景 + 聚光灯效果，适合展示高质感商品',
    defaults: { fullscreen: true, zoomControls: true, theme: 'dark', hints: false,
                aspectRatio: '4/3', scrollHint: false },
    body: [
      '<div id="stage">',
      '  <div id="viewer" class="cloudimage-360"></div>',
      '</div>'
    ].join('\n'),
    css: [
      'html,body{height:100%;margin:0;background:#0a0b0e;}',
      '#stage{width:100%;height:100vh;height:100dvh;display:grid;place-items:center;',
      '  background:radial-gradient(circle at 50% 42%,#1d222b 0%,#0a0b0e 68%);}',
      '#viewer{height:min(100vh,88vw);width:auto;max-width:90vw;max-height:100vh;}',
      ':root{',
      '  --ci360-button-bg:rgba(255,255,255,.07);',
      '  --ci360-button-bg-hover:rgba(255,255,255,.14);',
      '  --ci360-icon-color:#c6cede;',
      '  --ci360-icon-color-hover:#ffffff;',
      '  --ci360-zoom-controls-bg:rgba(255,255,255,.07);',
      '  --ci360-zoom-controls-bg-hover:rgba(255,255,255,.14);',
      '  --ci360-zoom-controls-color:#c6cede;',
      '  --ci360-zoom-controls-color-hover:#ffffff;',
      '  --ci360-spinner-color:#fff;',
      '  --ci360-fullscreen-bg:#0a0b0e;',
      '  --ci360-popper-bg:rgba(28,32,40,.97);',
      '  --ci360-popper-color:#e6eaf2;',
      '}'
    ].join('\n')
  },

  {
    id: 'hero',
    name: '居中卡片',
    desc: '浅色渐变背景上的圆角卡片，适合落地页首屏',
    defaults: { fullscreen: false, zoomControls: true, aspectRatio: '4/3', hints: true },
    body: [
      '<div class="card">',
      '  <div id="viewer" class="cloudimage-360"></div>',
      '  <p class="cap">拖动查看 360° 全貌</p>',
      '</div>'
    ].join('\n'),
    css: [
      'body{margin:0;min-height:100vh;display:grid;place-items:center;',
      '  background:linear-gradient(135deg,#eef3fa 0%,#dee8f5 100%);',
      '  font-family:-apple-system,"Microsoft YaHei","PingFang SC",sans-serif;}',
      '.card{background:#fff;border-radius:18px;padding:18px 18px 10px;',
      '  box-shadow:0 22px 60px rgba(24,52,96,.16);}',
      '#viewer{width:min(86vw,720px);aspect-ratio:4/3;border-radius:12px;overflow:hidden;}',
      '.cap{text-align:center;color:#8a95a6;font-size:13px;margin:14px 0 8px;}'
    ].join('\n')
  },

  {
    id: 'gallery',
    name: '多产品页',
    desc: '一页多个 360° 卡片，点击后才加载（省流量）',
    defaults: { initOnClick: true, fullscreen: false, zoomControls: true, hints: false },
    disabled: true,   /* 依赖多场景导航（M5），暂未启用 */
    body: [
      '<h1 class="page-title">产品总览</h1>',
      '<div class="grid" id="grid"></div>',
      '<script>',
      '/* 由工作台在导出时展开为多个 viewer 卡片 */',
      '<\/script>'
    ].join('\n'),
    css: [
      'body{margin:0;background:#f6f7f9;color:#1f2329;',
      '  font-family:-apple-system,"Microsoft YaHei","PingFang SC",sans-serif;}',
      '.page-title{font-size:22px;font-weight:600;text-align:center;padding:34px 20px 6px;margin:0;}',
      '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));',
      '  gap:20px;max-width:1200px;margin:0 auto;padding:24px;}',
      '.item{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(20,40,80,.07);}',
      '.item .cloudimage-360{width:100%;aspect-ratio:4/3;background:#f2f4f7;}',
      '.item .name{padding:12px 14px;font-size:14px;color:#3c454f;}',
      '.item .price{padding:0 14px 14px;color:#e4393c;font-weight:600;font-size:15px;}'
    ].join('\n')
  }
];

SD.templateById = function (id) {
  for (var i = 0; i < SD.TEMPLATES.length; i++) {
    if (SD.TEMPLATES[i].id === id) return SD.TEMPLATES[i];
  }
  return SD.TEMPLATES[0];
};
