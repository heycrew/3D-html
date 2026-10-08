# 第三方组件与许可 / Third-Party Notices

本项目包含或依赖以下第三方组件。在此致谢，并按要求保留其版权声明。

The following third-party components are included in or used by this project.
Thanks to their authors; their copyright notices are preserved as required.

---

## Cloudimage 360 View 4.10.0 — MIT

- 文件 / Files：`build/vendor/360-view.min.js`、`lib/360-view.min.js`（两份内容一致 / kept byte-identical）
- 上游 / Upstream：<https://github.com/scaleflex/js-cloudimage-360-view>
- 版权 / Copyright：Scaleflex
- 说明：该文件已补上版权头注释，按 MIT 条款随本项目分发。
  The copyright header has been added to the vendored bundle, which is redistributed here under the MIT terms.

## @vysmo/flipbook 0.5.0 — MIT

- 文件 / Files：`build/vendor/vysmo-flipbook.min.js`、`lib/vysmo-flipbook.min.js`
- 打包来源 / Bundled by：`build/mkvysmo.js`（esbuild IIFE；依赖声明见 `build/vysmo-src/package.json`）
- 上游 / Upstream：<https://www.npmjs.com/package/@vysmo/flipbook>
- 文件头已保留 `@vysmo/flipbook 0.5.0 (MIT)` 声明 / Its banner is preserved in the bundle.

## Electron 33.x — MIT

仅用于绿色版桌面应用（`desktop/`），不进入导出的页面产物。
Used only by the portable desktop app (`desktop/`); never bundled into the exported page.

## rcedit — MIT

- 文件 / File：`desktop/tools/rcedit-x64.exe`
- 上游 / Upstream：<https://github.com/electron/rcedit>
- 用途 / Purpose：桌面应用打包时写入图标与版本信息 / writes icon and version info when packaging.

---

## 翻页音效不随仓库分发 / The page-turn sound is NOT included

导出的页面在开启「翻页音效」时会去读：

```
lib/sound/book-voice.mp3
```

**该音频文件不包含在本仓库中。** 请自行准备并放入上述路径，或在工作台里把「音效来源」改成
「自定义路径」并指向你自己的音频地址。导出时会自动带上这个文件（存在才复制，不存在也不报错）。

The exported page reads `lib/sound/book-voice.mp3` when the page-turn sound is enabled.
**That audio file is not distributed with this repository.** Supply your own file at that path,
or switch *Sound source* to *Custom path* in the studio. The export step copies it automatically
if present, and silently skips it otherwise.

---

## 参考与致谢 / References and Acknowledgements

本项目的翻页动效在设计阶段参考过以下公开实现，特此致谢。
The page-turn effects in this project were designed with reference to the following
open-source work. Our thanks to its author.

### StPageFlip 2.0.7 — MIT

- 上游 / Upstream：<https://github.com/Nodlik/StPageFlip>（npm 包名 `page-flip`）
- 版权 / Copyright：Nodlik（详见其仓库 LICENSE / see the LICENSE in its repository）
- 与本项目的关系 / Relationship：

  本项目**早期版本**曾以该库作为翻页引擎，并为其打过补丁；翻页动效的设计思路亦受其启发。
  相关的补丁工具与库文件已在版本迭代中移除（可从 git 历史查到：
  `build/mkflip.js`、`build/vendor/page-flip.browser.js`、`lib/page-flip.browser.js`）。

  当前的引擎构成是：WebGL 翻页用 [`@vysmo/flipbook`](#vysmoflipbook-050--mit)，
  canvas 兜底引擎为本项目自行实现。若本项目代码中仍含有源自该库的片段，
  则按 MIT 条款保留上述版权声明。

  Earlier versions of this project used that library as the flip engine and carried
  patches for it; its approach also informed our page-turn design. The patch tooling and
  library files were removed in later revisions (see git history for the paths listed
  above). The current engines are `@vysmo/flipbook` for WebGL flipping and a
  self-implemented canvas fallback. Where any fragment of that library remains,
  the copyright notice above is retained as required by the MIT license.
