360° 全景展示工作台 —— 绿色版桌面应用
======================================

【怎么用（给最终用户）】
  1. 把 desktop/dist/win-unpacked/ 整个文件夹拷到目标电脑（Win10 / Win11 都行）
  2. 双击里面的「360全景展示工作台.exe」
  3. 用完之后直接关窗口即可 —— 本地服务会跟着关掉

  免安装、不需要 Node / Python / IIS，也不需要管理员权限。
  唯一的环境前提是系统里有 Microsoft Edge（WebView 内核由 Electron 自带，
  这里只是说：Electron 自带 Chromium，所以对系统**没有**额外要求）。

【它做了什么】
  应用启动时会在 127.0.0.1 上起一个只读的静态服务（从 8788 起找空闲端口，
  被占用就顺延），然后开一个窗口指向它。之所以不直接读本地文件：
  Cloudimage 360 View 会给每张图设 crossOrigin="anonymous"，
  file:// 协议下会被浏览器拦掉、预览一片空白 —— 这也是命令行版必须用
  「启动工作台.bat」起服务的原因。桌面应用把这一步内置了，用户双击就行。

【目录结构】
  desktop/
  ├─ main.js        主进程：内置静态服务 + 窗口（单实例、端口顺延、外链走系统浏览器）
  ├─ sync.js        把工作台的发布文件同步到 app/（electron-builder 不允许打进上级目录）
  ├─ make_icon.py   生成 icon.ico（纯几何图形，6 个尺寸）
  ├─ package.json   electron / electron-builder 配置（默认出 win dir 免安装目录）
  ├─ app/           同步出来的发布文件（studio.html + lib/ + serve.ps1 + 使用说明.txt）
  └─ dist/          打包产物（win-unpacked/ 就是那个绿色文件夹）

【怎么重新打包（给维护者）】
  # 1. 先在项目根生成最新的工作台
  python3 build/build.py
  # 2. 同步发布文件
  cd desktop && npm install      # 首次需要（会下载 Electron，约 100MB）
  npm run dist                   # = node sync.js + electron-builder --win dir
  # 想要「单个 exe」版本（每次启动会自解压，慢一点）：
  npm run dist-portable

  只调前端（studio.html / lib / 桌面应用代码）时，改完重跑上面两步即可。

【注意】
  · 用户导入的素材存在浏览器（Electron 内置 Chromium）的本地库里，换机器不会带走；
    要迁移工程请用工作台的「导出配置 / 导入配置」或重新选素材。
  · 打包产物约 200MB（自带 Chromium），这是「在任何 Win10/Win11 上都能跑」的代价；
    若目标机器确定都装了 WebView2 运行时，可改用 C# + WebView2 方案把体积压到 ~15MB。
  · 库与音效都在 app/lib/ 下，与命令行版共用同一套文件 —— 升级翻页库 / 换音效后，
    重新跑 build.py + sync + 打包即可。
