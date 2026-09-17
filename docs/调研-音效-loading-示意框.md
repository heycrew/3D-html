翻页音效 / 加载文案 / 交互示意区 —— 调研方案
============================================
调研阶段：只出方案，未改任何产品代码
调研日期：2026-09-17
适用范围：翻书图录（产物 = 纯静态 HTML + lib/vysmo-flipbook.min.js + lib/360-view.min.js）

一句话结论
  · 音效「静音也能听见」不需要任何 hack：用 <audio> 元素放音效就自带这个能力
    （iOS 把 audio/video 元素归到 media 通道，忽略静音开关；Web Audio 才是 ambient 通道会被静音）。
  · 加载文案是纯自研的活（覆盖层 + 淡出），无需第三方。
  · 四角示意框：产物侧用纯 CSS（零依赖，约 40 行）；只有「工作台里鼠标拉框」这一步
    可能值得引库，候选是 interact.js / moveable+selecto / cropper.js。


=====================================================================
需求 1：翻页音效，设置里可开关，打开后「手机静音也能听见」
=====================================================================

1.1 机制（这是整个需求的关键，先讲清平台事实）

iOS 把网页音频分成两个通道，行为完全不同：

  <audio> / <video> 元素  → media 通道：**忽略静音开关**，会打断别的 App 的音乐
  Web Audio API           → ambient 通道：**遵守静音开关**，可与其他 App 混音

WebKit 工程师在 Bug #252746 里原话：「Web Audio 被 iOS 当作 ambient 声音，可以和
其他应用混音，代价是必须遵守静音开关；而 video/audio 播放会打断其他音频，且忽略
静音开关。」（https://wiki.webkit.org/show_bug.cgi?id=252746）

→ 结论：**用 HTMLAudioElement 播放翻页音效，就天然满足「静音开关下也能听见」**，
  不需要引入 Web Audio，也不需要社区那套「循环播放静音 audio」的 hack。

1.2 三条可选路线对比

  A. <audio> 元素直接播放（推荐）
     做法：产物里放一个 Audio 对象，翻页时 currentTime = 0; play()。
     优点：零依赖；天然走 media 通道；代码最少；没有副作用。
     缺点：连翻时需要自己做去重/节流；iOS 上会打断用户正在听的音乐。
     增强：顺手设 `navigator.audioSession.type = 'playback'`（Safari 16.4+ 才有，
           没有就跳过）——这是 W3C Audio Session API 的官方做法，用来把页面音频
           显式声明成 media 类输出。
           参考：https://github.com/w3c/audio-session/blob/main/index.bs
                https://joellof.com/ios-background-audio/

  B. Web Audio API + 循环静音 <audio> 元素（社区 hack，不推荐）
     成熟库：chordbook/iosunmute、@wado/unmute-ios-audio、@activetheory/ios-silent-bypass。
     做法：再用一个 loop 的静音 <audio> 把 Web Audio 顶到 media 通道上。
     缺点（库作者自己列的）：锁定屏幕/控制中心会出现媒体控件；部分 iOS/iPadOS 上
     帧率下降（Babylon.js 为此加了 disableIOSRingerSwitchWorkaround 开关，他们的结论是
     「没有既能保持正常渲染性能又能绕过静音开关的验证过的方案」）；切后台回来可能又变哑。
     参考：https://github.com/chordbook/iosunmute
           https://forum.babylonjs.com/t/audioenginev2-playing-staticsound-on-top-of-streamingsound-decreases-fps-in-ios-safari/64049/8

  C. 只用 Web Audio 的 AudioContext
     缺点：直接遵守静音开关 → 不满足需求。排除。

1.3 必须向用户说清的边界（做不到的部分）

  · 「静音开关 / 铃声静音」→ 能绕过（方案 A 天然如此）。
  · 「媒体音量调到 0」→ **任何网页都发不出声**，这是系统/硬件级的，不可能绕过。
    所以文案上应写成「静音开关下仍可播放」，而不是「不管怎样都响」。
  · 首次发声仍需一次**用户手势**（autoplay 策略）。翻页本身就是手势，天然满足；
    稳妥起见在第一次 pointerdown 时做一次静音解锁（play() 后立刻 pause()）。
  · 桌面浏览器无此问题；Android 的「静音/勿扰」一般不影响媒体播放（媒体音量为 0 才会）。

1.4 音效素材与许可（商用要看清）

  | 来源 | 商用 | 署名 | 备注 |
  |---|---|---|---|
  | Mixkit（Envato） | 可以 | 不需要 | 音效/音乐全在免费许可下；不能把原文件当素材转卖。推荐 |
  | Pixabay | 可以 | 不需要 | 「Content License」；不能原样转卖/再分发成素材库。推荐 |
  | Freesound | **逐条看** | 看许可 | CC0 可商用免署名；CC BY 需署名；CC BY-NC 禁商用。要过滤 |
  | FiftySounds / freesoundsite 等聚合站 | 声称可商用 | 不需要 | 第三方聚合，来源要自己核实 |

  参考：https://pixabay.com/sound-effects/film-special-effects-page-flip-1-178322/
       https://janinedesignsdaily.com/mixkit-review/
       https://freesound.org/forum/sample-requests/42249/

  建议落地：内置 1~2 个免署名音效（下载来源链接与许可记进 docs/ 与本文件），
  同时支持「上传自定义音效」——用户自己的音频没有许可问题，也更贴合拍品调性。

1.5 参数与实现骨架（贴我们的代码结构）

  参数（build/js/01-schema.js 的 book 组）：
    bookSoundOn      bool   默认 false   翻页音效
    bookSoundSrc     select 默认 'flip1' 内置音效 1 / 内置音效 2 / 自定义上传
    bookSoundFile    file   上传的自定义音效（沿用现有素材上传机制）
    bookSoundVolume  num    默认 0.7      0~1

  产物（build/js/12-bookpage.js）：
    · buildBody：<audio id="pgSound" preload="auto" src="…">（导出用 sound/xxx.mp3，
      预览用内存 URL）；<64KB 时可考虑 base64 内联，省一次请求也避开 CORS
    · buildInit：listenPointer 解锁（首次 pointerdown 静音播一次再 pause）
      + 挂到 fb.on('flipstart')：currentTime = 0; play().catch(()=>{})
      + 连翻去重：若上一次播放距今 < 120ms 就跳过（避免密集翻页变成噪音）
    · 若 navigator.audioSession 存在 → type = 'playback'

  导出（build/js/07-export.js）：音效文件写进产物 sound/ 目录（跟 images/ 一样的路径）。
  工作台预览：预览文档同源，音量/开关改动可即时生效，不必重建 iframe。

1.6 风险
  · iOS 会打断用户正在播放的音乐（media 通道独占）——这是「能听见」的代价，建议在
    使用说明里写一句；若用户更在意「不打扰」，可把默认值关掉、由用户显式打开。
  · 连翻密集触发需要节流，否则听感很吵（方案里已含）。
  · 首次手势前 play() 会被拦，属正常，catch 掉即可。


=====================================================================
需求 2：首次加载 loading 的自定义文案
=====================================================================

2.1 方案（纯自研，无需第三方）

  产物加载链路我们已经有了：bootFlip() 逐页预检图片（onload/onerror）→ initFlip() 建
  翻页器 → 库 ready → 首帧绘制。正好可以把这段等待做成可配置的加载态。

  实现要点：
  · buildBody 最前面加一层覆盖层：
      <div id="bootLoad"><div class="bl-text">正在装帧…</div><div class="bl-prog"></div></div>
  · bootFlip 里每次 fin() 更新进度（「正在加载 3 / 12」），文案主体用用户自定义的那句
  · 结束时机：fb.ready 之后 + 第一帧绘制完成（再 requestAnimationFrame 一帧更稳），
    然后加 .done 淡出（opacity 过渡 200~300ms）后 remove
  · 最短显示时长（如 350ms）：素材很快时避免「闪一下就没」，观感更稳
  · 背景色默认取 bookBg（桌面背景）或纸色，避免白闪

  参数：
    bookLoadOn    bool  默认 true    首次加载显示提示
    bookLoadText  text  默认「正在装帧…」   自定义文案（支持多行，换行原样显示）
    bookLoadProg  bool  默认 true    是否附带「x / y」进度

2.2 与其它需求的关系
  · 与「示意框」互补：加载完 → 首帧 → （若开）示意框淡入，中间不会同时出现两套动效。
  · 与音效无关，但音效解锁可以挂在同一个首次 pointerdown 上。

2.3 风险：几乎没有。唯一要注意的是别把加载层做成阻塞（不可见时 pointer-events: none）。


=====================================================================
需求 3：交互示意区（四角框 + 呼吸 + 阴影，工作台鼠标拉取）
=====================================================================

这个需求要拆成两半看：**产物里怎么画**（展示态）和**工作台里怎么拉**（编辑态）。

3.1 产物侧：纯 CSS，零依赖（约 40 行）

  四角框的成熟写法（各来源一致）：
    · 框体一个 div（绝对定位，按百分比尺寸），里面 4 个子元素各作一个角；
    · 每个角只留两条边框 + 一个圆角：
        .c-tl { border-top:2px solid; border-left:2px solid; border-top-left-radius:6px; }
        其余三个角同理（或用同一个类 + transform: rotate(90deg/180deg/270deg) 复用）
    · 参考实现：https://fwdtools.com/ui-snippets/mobile-camera-screen/
                https://fwdtools.com/ui-snippets/mobile-qr-scanner-screen/

  「无论背景图都能看清」——调研结论是**别用 mix-blend-mode: difference**：
    · 它在中间灰调背景上会退化成 #808080，直接失效（WCAG 1.4.3 不过）；
    · 它依赖同一层叠上下文，父级一个 opacity/transform/filter 就会**静默失效**；
    · 还有整屏重绘的性能开销。
    参考：https://www.w3tweaks.com/css/css-mix-blend-mode-explained/#faq

  可靠做法是**双层描边（深 + 浅两色叠放）**，这也是 BBC 给 CSS 工作组提的诉求
  （他们现在就是用 box-shadow 做黑白双色聚焦环）：
    · 每个角用两条 box-shadow（0 blur、完全不透明）叠出「内白外黑」或「内黑外白」；
    · 两色对比度 ≥ 9:1，则无论底层是亮是暗，至少有一层可读；
    · 再叠一层带模糊的投影，让框从背景上「浮起来」（用户要的阴影）。
    参考：https://craftcms.com/blog/custom-focus-indicators-with-css-variables
         https://lists.w3.org/Archives/Public/public-css-archive/2022Jun/0266.html

  呼吸动画（各来源一致的要点）：
    · 动 **opacity + box-shadow 扩散**，时长 **2.5~4s**、`ease-in-out`、`infinite`；
    · 四个角用**同一个 animation-delay**，否则看着乱；
    · 不要动 width/height/border-color（触发布局/重绘，会掉帧）；
    · 加 `@media (prefers-reduced-motion: reduce)` 关掉呼吸。
    参考：https://www.php.cn/faq/1994910.html（12px 扩散 + rgba 的呼吸写法）

  时序与层级（我们的痛点，逐条对上游需求）：
    · 「翻页动画结束后再显示」→ 挂 `fb.on('flipend')` 淡入；`fb.on('flipstart')` 淡出
    · 层级：在翻页 canvas 之上、`.dots` 与 360 弹层之下（弹层是 z-index 9998）
    · **必须 pointer-events: none** —— 否则会吃掉「点页面开 360」的点击
    · 与 360 弹层同开时的处理：弹层打开时隐藏示意框（沿用现有 `busy` / 弹层状态判断）

3.2 工作台侧：鼠标拉框

  现成库对比（GitHub 星数取自调研当时的快照）：

  | 库 | Star | 定位 | 拿来做什么 | 适配度 |
  |---|---|---|---|---|
  | interact.js | ~12.9k | 低层指针事件（drag/resize/gesture，鼠标触摸统一） | 自己做「拉框 + 拖 4 角调整」 | 高（自己写绘制，库只给指针） |
  | moveable（+ selecto） | ~10~11k | 元素变换工具箱（拖拽/缩放/旋转/吸附）+ 框选 | 可拖拽缩放的框、参考线 | 高但重（我们只要一个框） |
  | cropper.js | 很流行（2.0 已重构为 Web Components） | 图像裁剪 UX（遮罩/网格/手柄） | 「在图上拉框」本身 | 中：它自带裁剪的全套 UI，要清掉一层样式 |
  | 原生 pointer events | — | — | 只要「拉一次框 + 拖角改大小」 | 够用，约 60~80 行 |

  参考：https://github.com/daybrush/moveable ; https://interactjs.io/index.html ;
       https://github.com/fengyuanchen/cropperjs/blob/b32a9755/docs/migration.md

  我的建议：**产物侧不引任何库**（纯 CSS）；**工作台侧**二选一——
    · 只要单框、只在本项目用 → 原生 pointer events 自研（体积零增加、行为完全可控）；
    · 若想要「多框 + 参考线 + 吸附」这类手感 → 引 interact.js（~13k 星、12KB gzip 级、
      无框架依赖），比 moveable/cropper 更贴合「低层指针 + 自己画」。

  交互设计（对应的实现细节）：
    · 预览是同源 blob 文档（04-preview.js 已经在跨文档改样式），所以可以直接读 iframe 里
      `.book-shell` 的 rect 做坐标映射；
    · 工作台加一个「示意区」模式开关（或参数组里的按钮）：进入后在工作台上叠一层透明
      覆盖层接管指针，避免和 vysmo 的拖拽翻页打架；
    · 拉框交互：pointerdown 记起点 → pointermove 实时画 → pointerup 落定；
      之后可用 4 个角手柄调整（这步可选，最小可用是「不满意就重拉」）；
    · 存储用**百分比**：{ x, y, w, h } 相对书容器 → 产物按容器尺寸还原，跨设备一致；
    · 可加「锁定比例」开关（沿用 1:x 或 4:3 等预设）与「重置」按钮。

  参数（book 组）：
    bookHintOn      bool   默认 false   显示交互示意区
    bookHintW/H     num    用拉的框定尺寸（UI 展示为只读数值 + 「重新拉取」按钮）
    bookHintColor   color  默认 #ffffff  描边主色（内层）
    bookHintRadius  num    默认 6px      角半径
    bookHintLen     num    默认占短边 12% 每个角的臂长
    bookHintBreath  bool   默认 true     呼吸动画
    bookHintDelayMs num    默认 0        翻页结束后延迟多久显示

3.3 风险
  · 拉框模式与翻页手势冲突 → 用「模式开关」隔离（上面已写）。
  · 框的坐标依赖书的容器比例；书比例变化（换封面）时框会跟着缩放，这是预期行为，
    但要在 UI 上提示「框按比例保存」。
  · 四角在极小尺寸下会糊在一起 → 给角臂长设下限（如 ≥ 10px，或按短边的百分比取 max）。


=====================================================================
集成点（改哪些文件）
=====================================================================
  · build/js/01-schema.js     新增三组参数（音效 / 加载 / 示意区）
  · build/js/12-bookpage.js   buildCss（角框样式 + 呼吸关键帧 + 加载层样式）、
                              buildBody（加载层、示意框 DOM、audio 元素）、
                              buildInit（加载收起、示意框时序、音效播放与解锁）
  · build/js/07-export.js     导出 sound/ 与音效文件；lib 清单不变
  · build/js/08-app.js        工作台「拉框」覆盖层与参数面板联动
  · build/js/04-preview.js    预览重建策略：示意框/音效改动不必重建 iframe
  · docs/                     使用说明补一段（音效的静音边界说明）


=====================================================================
实施顺序与工作量（我的建议）
=====================================================================
  1) 加载文案（最简单，独立）            ~0.5 天
  2) 示意框：产物侧 CSS + 时序           ~0.5 天
     示意框：工作台拉框                    ~1 天
  3) 翻页音效：产物播放 + 解锁 + 节流     ~0.5 天
     音效素材接入 + 导出打包               ~0.5 天
     iOS 真机实测（静音开关 / 听歌时打断） ~0.5 天 ← 最不确定的一段，需要真机

  顺序理由：前两项都是纯前端可控、可离线验证；音效的「静音下能听见」必须在真机上确认，
  放到最后做，避免它拖住其它两项。

=====================================================================
需要你拍板的点
=====================================================================
  A. 音效素材 → **已定**：内置 2 个（实际实现为程序合成，见下）+ 支持自定义
  B. 示意框数量 → **已定**：一页一个
  C. 首屏显示 → **已定**：不显示，翻页结束后才淡入（按原需求原话）
  D. 示意框手柄 → **已定**：先只做「鼠标拉取 + 不满意重拉」，不做拖角微调


=====================================================================
实施结果（4 项已全部完成并提交）
=====================================================================
  ca3ae78  【1】首次加载提示：bookLoadOn / bookLoadText（多行）/ bookLoadProg
           —— 用 JS 现建覆盖层（不白闪、不动 CSS），bootFlip 里报进度、
           fb.ready 后加一帧才淡出，最短显示 350ms
  61f1b41  【2】交互示意区（产物侧）：bookHintOn / bookHintBox / bookHintColor /
           bookHintLen / bookHintRadius / bookHintBreath / bookHintDelay
           —— 四角（非整边框）、双层描边（亮/暗底都可读，实测角区明暗差 124 / 245）、
           flipstart 淡出 / flipend 淡入、pointer-events:none、弹层打开时用 :has 隐藏
  4ffd69d  【3】工作台拉框：预览里点「示意区」→ 拖拽 → 百分比坐标 postMessage 回工作台，
           写进 bookHintBox；框位置接进 LIVE_STYLE 就地更新（不重建 iframe、不跳页）
  c8671af  【4】翻页音效：bookSoundOn / bookSoundKind（内置 / 自定义路径）/ bookSoundCustom /
           bookSoundVolume —— <audio> 播放（media 通道，静音开关下可响）、120ms 节流、
           首次手势静音解锁、导出时把 lib/sound/book-voice.mp3 一起打包
  6ab48cd  示意区优化：框归属「第 N 张内容页」（bookHintPage，默认第 1 张）+ 只对访客展示一次；
           工作台点「示意区」会自动跳到那一页
  c58dcbe  内置音效定稿：只留一个 —— 用客户提供的 book-voice.mp3（放进 build/vendor/sound/，
           lib/ 完全由 vendor/ 重建），音效来源参数简化为「内置音效 / 自定义路径」

  实现过程中的两处取舍（提交信息里都写了原因）：
    · 内置音效：一开始这个环境拿不到素材站的二进制文件，先用 build/mksound.py 合成过两个
      音色应急；后来客户给了 book-voice.mp3，就改成只内置这一个，合成脚本与那两个 wav 一并
      移除。要再换音效：覆盖 build/vendor/sound/book-voice.mp3 后重新构建，或在面板里选
      「自定义路径」填自己的文件。
    · 示意框「自定义长宽」：没有加独立的宽/高滑块，而是由「拉框」直接决定（bookHintBox
      存 x,y,宽,高 四个百分比），需要时也能手动改这几个数字。

  验证脚本（都在 build/.verify/，自包含素材、随时可重跑）：
    verify_book.py        主回归：前进/回翻卷曲、页面方向、拖拽回翻、点内容页开 360、加载文案
    verify_hint.py        示意框：首屏不显示、只在指定内容页且只展示一次、亮暗底可读性、
                          点击穿透、弹层隐藏、呼吸
    verify_pick.py        拉框：真实工作台预览里合成拖拽 → 自动跳页、参数被正确写入、预览未被重建
    verify_sound.py       音效：内置 mp3 加载成功（readyState/duration）、音量、解锁 + 翻页播放、
                          关闭无声音、自定义路径
    verify_sound_race.py  音效时序：解锁的 pause 必须都在翻页播放**之前**（不能把音效掐掉）

  iOS 实测暴露的问题与修法（2e2426c、以及后续这次改动）——
  桌面 Chrome 复现不了，只能靠真机反馈 + 公开资料：

  1) 「加了音效却没声音」：解锁逻辑拿**主元素**做（自己音量调 0 → play → resolve 后 pause），
     和首次翻页抢同一个 audio → 那一声被静音或被 pause 掐掉；play() 的 promise 不 resolve 时
     音量还会卡在 0。→ 解锁改用独立元素，且播放前每次纠正音量。
  2) 手机「第一次翻页有声、之后全哑」：iOS 的两个特性叠在一起 ——
     · 手势解锁是**按元素**的（不是按页面），新元素要各自解锁；
     · 同一个 <audio> 在音频尚未播完时再次 play() 常被**静默忽略**；
     · currentTime = 0 在 iOS 上有 INDEX_SIZE_ERR 的历史坑；load() 会把元素限制成只能播一两次。
     → 用 **2 个 <audio> 轮换**（池化）+ currentTime 用 **0.1** + 播放被拒时换元素兜底重试；
       解锁时池里**每个**元素在**同一手势栈内同步** play()→pause()（异步 pause 会落在翻页
       播放之后把它掐掉）。
     参考：SO #4799369「Reusing HTML5 Audio Object in Mobile Safari」、WebKit #287624 / #264473。

  仍需真机确认（自动化测不了）：
    · iOS「静音开关」下翻页音效是否真的出声（机制上应该成立：走 <audio> 的 media 通道；
      若某些 iOS 版本仍无声，下一步可试 Audio Session API 的组合方案）
    · iOS 上放音会打断用户正在听的音乐（media 通道独占），这是「能听见」的代价
