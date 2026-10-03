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
    /* 默认展开：书页的那些参数（加载文案 / 翻页音效…）都在这一组里，
       折叠着用户根本找不到（第一次交上去就被问「看不见新功能」）。 */
    id: 'book', name: '书籍（翻书图录）', open: true,
    desc: '仅「翻书图录」页面类型生效（翻页引擎：@vysmo/flipbook，WebGL 卷曲）',
    params: [
      { key: 'bookW', label: '书宽', type: 'num', def: 900, min: 200, max: 3000, unit: 'px' },
      { key: 'bookH', label: '书高', type: 'num', def: 1200, min: 200, max: 3000, unit: 'px' },
      { key: 'bookFit', label: '尺寸适配', type: 'select', def: 'cover',
        options: [['cover', '跟随封面图（推荐）'], ['manual', '手动指定尺寸']],
        desc: '跟随封面时，画布比例自动等于封面图，不留空白' },
      { key: 'bookTurn', label: '翻页时长', type: 'num', def: 700, min: 150, max: 2000, unit: 'ms' },
      { key: 'bookCurlTilt', label: '卷边斜向', type: 'num', def: 0.22, min: 0, max: 0.6, step: 0.02,
        desc: '卷边斜着推进的程度（0 = 整条竖边平移）' },
      { key: 'bookBackTone', label: '纸背颜色', type: 'color', def: '#f3efe6',
        desc: '翻动页背面的颜色（纯色，不做内容淡化）' },
      { key: 'bookDrag', label: '拖拽翻页', type: 'bool', def: true,
        desc: '手指 / 鼠标拖能把纸页掀起来跟手；关掉后只靠角落热区与按钮翻页' },
      { key: 'bookDragCommit', label: '拖拽提交阈值', type: 'num', def: 0.35, min: 0.1, max: 0.9, step: 0.05,
        desc: '拖过多少（占页宽比例）松手才翻过去，不到就回弹' },
      { key: 'bookLoop', label: '循环翻页', type: 'bool', def: false,
        desc: '翻到最后一页再往后翻会回到第 1 页（回翻同理）' },
      { key: 'bookPreload', label: '预载页数', type: 'num', def: 2, min: 0, max: 12,
        desc: '当前页前后各预先加载几页。它直接决定纹理显存：窗口 = 2×预载+3 页，' +
              '一张 1500×2000 的图约占 12MB —— 默认 6 就是 180MB 量级，移动 GPU 会崩' +
              '（症状是书页空白、怎么翻都不动）。调小省显存；太小则回翻时会卡一下' },
      { key: 'bookLoadOn', label: '首次加载提示', type: 'bool', def: true,
        desc: '素材还没就位时先显示一层提示，避免白屏' },
      { key: 'bookLoadText', label: '加载文案', type: 'list', def: '正在装帧…',
        placeholder: '支持多行（直接换行）',
        desc: '首次加载时显示的文字，可留空（回退默认）' },
      { key: 'bookLoadProg', label: '显示加载进度', type: 'bool', def: true,
        desc: '文案下面显示「已加载 x / y 页」' },
      { key: 'bookLoadTopText', label: '加载页说明文字', type: 'text', def: '点页码可拖动跳页',
        desc: '显示在加载页底部「模拟页码」的上方（那句话就是解释页码能点的）；留空则不显示' },
      { key: 'bookBg', label: '桌面背景', type: 'color', def: '#ffffff',
        desc: '书页四周的留白底色，默认纯黑（注意：改默认值只影响新工程，' +
              '已保存的工程仍用它当时的值）' },
      { key: 'bookShowNav', label: '显示页码导航', type: 'bool', def: true,
        desc: '底部那条：左边「窑口图录」、中间页码、右边「自动翻页」。' +
              '点页码会展开一条拖动进度条（拖动时显示第几页，松手跳过去）' },
      { key: 'bookCatalogTitle', label: '窑口目录按钮名', type: 'text', def: '窑口目录',
        desc: '底部那条左侧按钮与图墙标题的文字（默认「窑口目录」）。图墙内容由工作台' +
              '左侧「窑口目录」里配的条目决定（页码 + 标题 + 自定义图）；一条都没配时照旧显示全部页面' },
      { key: 'bookPage360Bar', label: '360 素材缩略图', type: 'bool', def: true,
        desc: '导航条上方那条：这一页有几张 360 素材就画几张缩略图，' +
              '点第 N 张就从第 N 帧开始看；本页没有 360 素材时整条自动隐藏' },
      { key: 'bookZoomOn', label: '双击放大查看', type: 'bool', def: true,
        desc: '双击内容页进入全屏大图：双指 / 滚轮缩放、拖动平移，双击复位，' +
              '缩小到默认大小为止（再小就回到默认）。关掉后双击不再响应' },
      { key: 'bookAutoMs', label: '自动翻页间隔', type: 'num', def: 3000, min: 1000, max: 20000,
        step: 500, unit: 'ms',
        desc: '点「自动翻页」后每隔多久翻一页；翻到最后一页会自动停下' },
      { key: 'bookSoundOn', label: '翻页音效', type: 'bool', def: false,
        desc: '翻页时播放音效。用 <audio> 播放，所以手机的静音开关下也能听见；' +
              '但「媒体音量」被调到 0 时任何网页都发不出声' },
      { key: 'bookSoundKind', label: '音效来源', type: 'select', def: 'builtin',
        options: [['builtin', '内置音效'], ['custom', '自定义路径']],
        desc: '内置音效就是项目自带的 lib/sound/book-voice.mp3；想换成自己的录音选「自定义路径」' },
      { key: 'bookSoundCustom', label: '自定义音效路径', type: 'text', def: '',
        placeholder: '如 ./sound/my-turn.mp3 或 https://…',
        desc: '选「自定义路径」时生效；导出产物请把文件放进导出目录再填相对路径' },
      { key: 'bookSoundVolume', label: '音效音量', type: 'num', def: 0.7, min: 0, max: 1, step: 0.05 },
      { key: 'boguMask2', label: '弹层遮罩浓度', type: 'num', def: 0.72, min: 0.2, max: 0.98, step: 0.02,
        desc: '越小越透，底下的内容页看得越清楚' },
      /* 帧插值原本挂在「图片源」那一组（单品用的），但 360 弹层也吃它：
         一圈帧数少时调到 2~3，旋转会顺滑很多。单品下线后把它搬到这里，
         否则参数面板里就没地方调了。 */
      { key: 'interp', label: '360 帧插值平滑', type: 'num', def: 0, min: 0, max: 4,
        desc: '在相邻帧之间插几张过渡帧。0=关闭；拍照张数少时调到 2~3 会顺滑很多' },
      /* ---------- 分享 ---------- */
      { key: 'bookShareOn', label: '分享按钮', type: 'bool', def: true,
        desc: '页面右上角显示一个「分享」按钮：手机上调系统分享面板，电脑上复制链接；' +
              '微信里会提示「点右上角 → 转发给朋友」（微信不支持网页直接调起转发）。' +
              '关掉只保留分享卡片信息（og 标签）' },
      { key: 'bookShareTitle', label: '分享标题', type: 'text', def: '',
        placeholder: '留空则用页面标题',
        desc: '分享卡片上的标题（留空就用上面的「页面标题」）' },
      { key: 'bookShareBase', label: '站点地址', type: 'text', def: '',
        placeholder: '例如 https://pqn.funsun.cn/auction/',
        desc: '填部署后的网址（结尾带 /）。微信抓取分享卡片时不执行网页脚本，' +
              '只认 HTML 源码里的绝对地址，所以封面图必须在这里拼成完整网址 —— ' +
              '不填的话微信又抓不到图，可能「发送给朋友」点了没反应' },
      { key: 'bookShareText', label: '分享文案', type: 'list', def: '',
        placeholder: '留空则用页面标题',
        desc: '分享卡片上的描述文字（支持多行）。' +
              '分享卡片用的封面图就是「封面」' }
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
