/* =====================================================================
 * 01-schema.js —— 参数定义（严格对应 Cloudimage 360 View 4.10.0）
 * 每个参数：key(v4 JS 配置名) / label / type / def / desc
 * type: text | num | bool | select | color | tri | list
 * tri = 三态布尔：null(未设置) / true / false
 * ===================================================================== */
window.SD = window.SD || {};

SD.SCHEMA = [
  {
    id: 'source', name: '图片源', open: true,
    desc: '决定图片从哪里来、共几帧',
    params: [
      { key: 'folder', label: '图片目录', type: 'text', def: './images/',
        desc: '图片所在目录，以 / 结尾' },
      { key: 'filenameX', label: '文件名模板（水平）', type: 'text', def: 'frame-{index}.jpg',
        desc: '{index} 会替换为序号' },
      { key: 'amountX', label: '水平帧数', type: 'num', def: 36, min: 1, max: 240,
        desc: '一圈拍了多少张' },
      { key: 'interp', label: '帧插值平滑', type: 'num', def: 0, min: 0, max: 4,
        desc: '在相邻帧之间插几张过渡帧。0=关闭；帧数少时调到 2~3 会顺滑很多' },
      { key: 'indexZeroBase', label: '序号补零位数', type: 'num', def: 0, min: 0, max: 6,
        desc: '3 表示 001、002…' },
      { key: 'imageListX', label: '水平图片列表（可选）', type: 'list', def: '',
        desc: '文件名不规则时用，每行一个 URL；填了则忽略目录+模板' },
      { key: 'filenameY', label: '文件名模板（垂直）', type: 'text', def: '',
        desc: '俯仰视角图，如 top-{index}.jpg' },
      { key: 'amountY', label: '垂直帧数', type: 'num', def: 0, min: 0, max: 120,
        desc: '0 = 不启用垂直轴' },
      { key: 'imageListY', label: '垂直图片列表（可选）', type: 'list', def: '', desc: '每行一个 URL' },
      { key: 'filenameGrid', label: '网格文件名模板', type: 'text', def: '',
        desc: '二维网格用，含 {indexX} 与 {indexY}' },
      { key: 'imageListGrid', label: '网格图片列表（可选）', type: 'list', def: '',
        desc: '每行一个 URL，Y 外层 X 内层' }
    ]
  },
  {
    id: 'behavior', name: '旋转行为', open: false,
    desc: '自动旋转与惯性',
    params: [
      { key: 'autoplay', label: '自动旋转', type: 'bool', def: false },
      { key: 'autoplayBehavior', label: '自动旋转方式', type: 'select', def: 'spin-x',
        options: [['spin-x', '水平环绕'], ['spin-y', '垂直环绕'], ['spin-xy', '逐行扫描'], ['spin-yx', '逐列扫描']] },
      { key: 'autoplayReverse', label: '自动旋转反向', type: 'bool', def: false },
      { key: 'playOnce', label: '只播一遍', type: 'bool', def: false },
      { key: 'speed', label: '自动旋转间隔', type: 'num', def: 80, min: 10, max: 2000, unit: 'ms' },
      { key: 'inertia', label: '拖动惯性', type: 'bool', def: false, desc: '松手后继续滑行' }
    ]
  },
  {
    id: 'control', name: '交互控制', open: false,
    desc: '鼠标 / 触摸 / 键盘',
    params: [
      { key: 'draggable', label: '鼠标拖动旋转', type: 'bool', def: true },
      { key: 'swipeable', label: '触摸滑动旋转', type: 'bool', def: true },
      { key: 'dragSpeed', label: '拖动灵敏度', type: 'num', def: 150, min: 10, max: 1000 },
      { key: 'dragReverse', label: '拖动方向反向', type: 'bool', def: false },
      { key: 'keys', label: '方向键控制', type: 'bool', def: false },
      { key: 'keysReverse', label: '方向键反向', type: 'bool', def: false },
      { key: 'stopAtEdges', label: '到边界停止', type: 'bool', def: false, desc: '不循环' },
      { key: 'stopAtEdgesX', label: '水平边界停止', type: 'tri', def: null, desc: '未设置 = 跟随上一项' },
      { key: 'stopAtEdgesY', label: '垂直边界停止', type: 'tri', def: null, desc: '未设置 = 跟随上一项' },
      { key: 'pinchZoom', label: '双指缩放', type: 'bool', def: true }
    ]
  },
  {
    id: 'display', name: '外观与控件', open: false,
    desc: '容器比例、缩放、主题',
    params: [
      { key: 'aspectRatio', label: '容器宽高比', type: 'text', def: '', placeholder: '如 4/3、1/1' },
      { key: 'theme', label: '内置主题', type: 'select', def: '',
        options: [['', '不指定'], ['light', '浅色'], ['dark', '深色']] },
      { key: 'fullscreen', label: '全屏按钮', type: 'bool', def: false },
      { key: 'zoomMax', label: '最大放大倍数', type: 'num', def: 5, min: 1, max: 10, step: 0.5 },
      { key: 'zoomStep', label: '每次缩放步进', type: 'num', def: 0.5, min: 0.1, max: 3, step: 0.1 },
      { key: 'zoomControls', label: '缩放按钮组', type: 'bool', def: true },
      { key: 'zoomControlsPosition', label: '缩放按钮位置', type: 'select', def: 'bottom-right',
        options: [['bottom-right', '右下'], ['bottom-left', '左下'], ['bottom-center', '下中'],
                  ['top-right', '右上'], ['top-left', '左上'], ['top-center', '上中']] },
      { key: 'scrollHint', label: '滚轮缩放提示', type: 'bool', def: true },
      { key: 'hints', label: '首次交互提示', type: 'bool', def: true },
      { key: 'initialIconShown', label: '初始 360° 图标', type: 'bool', def: true },
      { key: 'bottomCircle', label: '底部进度环', type: 'bool', def: false },
      { key: 'bottomCircleOffset', label: '进度环偏移', type: 'num', def: 5, min: 0, max: 60, unit: 'px' },
      { key: 'initOnClick', label: '点击后才加载', type: 'bool', def: false, desc: '省流量，适合一页多个' },
      { key: 'lazyload', label: '懒加载', type: 'bool', def: true }
    ]
  },
  {
    id: 'hotspot', name: '热点', open: false,
    desc: '在画面上打标记（时间轴自动生成）',
    params: [
      { key: 'hotspotTrigger', label: '触发方式', type: 'select', def: 'hover',
        options: [['hover', '悬停'], ['click', '点击']] },
      { key: 'hotspotTimelineOnClick', label: '点时间轴显示弹窗', type: 'bool', def: true },
      { key: 'markerTheme', label: '标记样式', type: 'select', def: '',
        options: [['', '默认'], ['default', 'default'], ['inverted', 'inverted'], ['brand', 'brand（品牌色）']] },
      { key: 'brandColor', label: '品牌色', type: 'color', def: '#ff6600' }
    ]
  },
  {
    id: 'book', name: '书籍（翻书图录）', open: false,
    desc: '仅「翻书图录」页面类型生效',
    params: [
      { key: 'bookW', label: '书宽', type: 'num', def: 900, min: 200, max: 3000, unit: 'px' },
      { key: 'bookH', label: '书高', type: 'num', def: 1200, min: 200, max: 3000, unit: 'px' },
      { key: 'bookFit', label: '尺寸适配', type: 'select', def: 'cover',
        options: [['cover', '跟随封面图（推荐）'], ['manual', '手动指定尺寸']],
        desc: '跟随封面时，画布比例自动等于封面图，不留空白' },
      { key: 'bookBend', label: '纸张弯曲程度', type: 'num', def: 1.4, min: 0.6, max: 3, step: 0.1,
        desc: '1 = 均匀圆弧；越大越向书脊集中弯折' },
      { key: 'bookSlices', label: '切片数', type: 'num', def: 90, min: 24, max: 200,
        desc: '越高越细腻，但更吃性能' },
      { key: 'bookShade', label: '折痕阴影', type: 'num', def: 0.55, min: 0, max: 1, step: 0.05,
        desc: '弯曲处的明暗强度' },
      { key: 'bookSkew', label: '倾斜角度', type: 'num', def: 2.6, min: 0, max: 12, step: 0.2,
        unit: '°', desc: '翻动时整页的斜角，0 = 完全水平' },
      { key: 'bookSkewY', label: '卷边翘角', type: 'num', def: 0.16, min: 0, max: 0.6, step: 0.02,
        desc: '卷起的那一边向下斜翘的幅度' },
      { key: 'bookCurlTilt', label: '卷边斜向', type: 'num', def: 0.22, min: 0, max: 0.6, step: 0.02,
        desc: '右下角比上端超前多少：越大卷边斜得越明显，0 = 整条竖边平移' },
      { key: 'bookCamDist', label: '相机距离', type: 'num', def: 3, min: 1.5, max: 8, step: 0.5,
        desc: '越小透视越强烈' },
      { key: 'bookBackTone', label: '纸背颜色', type: 'color', def: '#f3efe6',
        desc: '翻过 90° 后看到的纸张背面' },
      { key: 'bookMaxH', label: '屏幕占高上限', type: 'num', def: 88, min: 40, max: 100,
        unit: '%', desc: '书在屏幕里最高占多少' },
      { key: 'bookTurn', label: '翻页时长', type: 'num', def: 700, min: 150, max: 2000, unit: 'ms' },
      { key: 'bookBg', label: '桌面背景', type: 'color', def: '#2a2118' },
      { key: 'bookShowNav', label: '显示页码导航', type: 'bool', def: true },
      { key: 'boguMask2', label: '弹层遮罩浓度', type: 'num', def: 0.72, min: 0.2, max: 0.98, step: 0.02,
        desc: '越小越透，底下的内容页看得越清楚' }
    ]
  },
  {
    id: 'cdn', name: 'Cloudimage CDN（可选）', open: false,
    desc: '留空即走普通 URL，不依赖任何外部服务',
    params: [
      { key: 'ciToken', label: 'CDN Token', type: 'text', def: '', desc: '填了才走 Cloudimage 转码' },
      { key: 'ciFilters', label: 'CDN 滤镜', type: 'text', def: '' },
      { key: 'ciTransformation', label: 'CDN 变换', type: 'text', def: '' }
    ]
  }
];

/* 所有参数的默认值快照 */
SD.defaults = function () {
  var o = {};
  SD.SCHEMA.forEach(function (g) {
    g.params.forEach(function (p) { o[p.key] = p.def; });
  });
  return o;
};

/* 参数定义索引 */
SD.paramDef = function (key) {
  var found = null;
  SD.SCHEMA.forEach(function (g) {
    g.params.forEach(function (p) { if (p.key === key) found = p; });
  });
  return found;
};

/* 扁平参数列表 */
SD.allParams = function () {
  var out = [];
  SD.SCHEMA.forEach(function (g) { g.params.forEach(function (p) { out.push(p); }); });
  return out;
};
