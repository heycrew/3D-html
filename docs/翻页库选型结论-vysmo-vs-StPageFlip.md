翻页库选型结论：StPageFlip 2.0.7 vs @vysmo/flipbook 0.5.0
========================================================
结论阶段：只做判断，未改任何产品代码 / lib / build 产物
依据：build/.verify/cand/ 下的实测现场（2026-09-16 22:12–22:33）+ 两个库的源码

【已落地】（2026-09-16 晚，结论被采纳后）
  工作台的翻页引擎已切到 @vysmo/flipbook 0.5.0：
  · 产物 lib/vysmo-flipbook.min.js（35.8 KB，IIFE —— 预览跑在 blob 文档里，
    必须是经典脚本，ESM 相对 import 会解析失败）。打包源 build/vysmo-src/，
    重打包脚本 build/mkvysmo.js；日常构建 build.py 只做复制，不需要 node/npm。
  · build/js/12-bookpage.js 的产物模板改为 createFlipbook(...)，参数映射：
    翻页时长 → flipDuration，卷边斜向 → tilt，纸背颜色 → backColor（hex → [r,g,b]）。
    clickNavigation/keyboardNavigation 关掉（点击留给「点页面开 360」，键盘自己接）。
  · 顺手修掉一个既有 bug：07-export.js 的 lib/ 从来只复制 360 查看器，
    翻页库根本没被复制 —— 导出的成品书页一直翻不动。现在按清单复制两个库。
  · 端到端验证（build/.verify/e2e_export.py，走真实产物目录）：
    前进/回翻都有卷曲中间态、拖拽回翻跟手并在过半后提交、点内容页弹 360、
    Esc 关闭、翻页过程中不误触弹层。

【结论】
建议把书页翻页引擎切到 @vysmo/flipbook 0.5.0（MIT），
代价是接受两处功能降级：背面只能纯色、页面只能是图片/canvas（不能是 DOM）。

理由（按对当前遗留问题的重要性排序）
  1. 回翻卷曲
     现状：StPageFlip 在单页模式（usePortrait + size:"fixed"）下 flipPrev 被静默忽略，
           官方停更未修（见 d54e1d4、0a534c4）。我们只能靠「逐帧合成拖拽」绕过，
           属于对库内部行为的逆向利用，脆弱。
     vysmo：正反向走同一条卷曲管道。夹具实测 vysmo_feasible.png 里
           FORWARD(→) 与 BACKWARD(←) 两行均完整卷曲，且是 WebGL 曲面而非近似。
  2. 背面效果
     现状：StPageFlip 没有「背面」概念，我们靠补丁（逐帧清屏改透明 + 下层铺被翻页的
           淡化版，见 4b1595f）拼出来，组合逻辑复杂。
     vysmo：有 backColor 参数，直传卷曲着色器（create.js:32 / 211 / 235）。
           实测 22:33 的 backcolor_fixed.png：默认黑色背面 → 传 [243/255,239/255,230/255]
           后变成米白纸色。
  3. 拖拽 scrub（跟手卷曲）
     现状：StPageFlip 无公开 scrub API。
     vysmo：原生 dragNavigation + dragCommitThreshold + seek(progress)。
           实测拖拽过程中逐帧曲面变化，无马赛克、无缝隙。
  4. 产物体积
     StPageFlip 产物：lib/page-flip.browser.js = 44,111 B
     vysmo 打包产物  ：lib/vysmo-flipbook.min.js = 35.8 KB（minified，
                     已含 @vysmo/animations + transitions + easings + gl-core 的 tree-shake 结果）
     → 换库不会让产物变大。
  5. 许可与离线
     两个库都是 MIT。@vysmo/flipbook 0.5.0 无 peerDependencies、sideEffects:false，
     依赖仅 animations/transitions/easings 0.5.0。产物是本地打包的，
     随 lib/ 一起发，「离线运行」这条路已验证可行。

【代价 / 风险】
  1. 背面只能纯色。需求里写的「背面用被翻页面内容变淡」在 vysmo 上做不了
     （backColor 是 readonly [number, number, number]，纯色直达着色器）。
     已确认按「纯色纸背」落地（用户拍板：背面可以先不做）。
  2. 页面源只能是 string(URL) / HTMLImageElement / HTMLCanvasElement，
     types.d.ts 明写 rich-DOM pages are out of scope for v1。
     → 页面上的锚点/360 点击改为 canvas 之上的叠层 DOM（我们本来就整屏叠 UI）。
  3. 版本极早期（0.5.0，0.x）。API 可能在小版本间破坏。
     对策：版本钉死在 build/vysmo-src/package.json，产物随 lib/ 打包（不依赖 CDN）。
  4. WebGL 依赖。渲染走 @vysmo/gl-core：canvas 铺满容器、按 devicePixelRatio 建缓冲、
     ResizeObserver 跟随容器。源码里没有 2D 降级路径
     → 在禁用/不支持 WebGL 的环境会白屏，这是换库引入的新失败模式（StPageFlip 是 canvas2d）。
  5. 尺寸模型不同。vysmo 没有 StPageFlip 的 size/usePortrait 双页判定，
     canvas 就是填满容器（rect × dpr）。对「整屏单页」更直接，
     「按封面比例适配 + 剩余留白用背景色」由我们的 .book-shell 控制。

【已核实】
  · 页面比例 ≠ 容器比例时的适配：**拉伸铺满（stretch），不是 contain**。
    实测（fx_adapt.png）：容器 1:1、封面 0.75 → 封面被横向拉伸，四周没有留白。
    与老库行为一致（不是回归），但意味着**内容图必须与书尺寸同比例**。
  · backColor 的传法：三元组（[0.953, 0.937, 0.902]）生效；生成器已把
    「纸背颜色」hex 实时转成三元组（tools 里那段 IIFE）。
  · 单页形态：canvas 尺寸 = 容器 rect × dpr，容器比例由 .book-shell 决定。

【仍待核实】
  · 无 WebGL / WebGL 被禁时的实际表现（是否白屏、有无提示）——上线前在目标机型试。
  · lazy + preloadWindow 在 24 页以上时的显存/流畅度（已开 lazy、preloadWindow: 2）。

【实际改动清单】
  · 新增：build/vendor/vysmo-flipbook.min.js、build/mkvysmo.js、build/vysmo-src/（打包源）
  · 删除：build/mkflip.js（旧库的补丁工具）、build/vendor/page-flip.browser.js、
          lib/page-flip.browser.js（构建时也会自动清理）
  · 修改：build/js/12-bookpage.js（引擎 + CSS 的 .flip-back 层 + resize 逻辑）、
          build/js/07-export.js（lib 清单）、build/build.py（复制两个库/文档）
  · 未做：运行时双引擎开关 —— 回退直接走 git 历史（切换是原子的，产物也随之换）。
  · 待决：UI 上 7 个旧引擎参数已失效但仍在面板里 ——
          bookBend（纸张弯曲程度）、bookSlices（切片数）、bookShade（折痕阴影）、
          bookSkew（倾斜角度）、bookSkewY（卷边翘角）、bookCamDist（相机距离）、
          bookMaxH（屏幕占高上限）。新引擎只认「翻页时长 / 卷边斜向 / 纸背颜色」。
