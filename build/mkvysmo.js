/* =====================================================================
 * mkvysmo.js —— 把 @vysmo/flipbook 打成 IIFE 全局脚本
 *               输出 build/vendor/vysmo-flipbook.min.js
 *
 * 为什么必须打成 IIFE（而不是直接用库的 ESM dist）：
 *   产物和「工作台实时预览」都可能跑在 blob: 文档里，ESM 的相对 import
 *   在那样的文档中会解析失败；file:// 下 ESM 还会被 CORS 直接拦掉。
 *   打成经典脚本后 <script src> 直接可用 —— 和原来的翻页库用法一致。
 *
 * 什么时候需要跑：升级 @vysmo/flipbook 版本时（改 build/vysmo-src/package.json
 *   里的版本号再执行本脚本）。日常构建（build.py）只是把这个产物复制到
 *   lib/，不需要 node / npm / 网络 —— 绿色版构建仍然只要一个 python。
 *
 * 用法：node build/mkvysmo.js
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SRC = path.join(__dirname, 'vysmo-src');
const OUT = path.join(__dirname, 'vendor', 'vysmo-flipbook.min.js');
const VER = require(path.join(SRC, 'package.json')).dependencies['@vysmo/flipbook'];

/* 产物头部留一条来源信息：以后看到 lib/ 里的这个文件能直接查到版本与升级方式 */
const BANNER = '/*! @vysmo/flipbook ' + VER + ' (MIT) - page-curl flipbook, IIFE bundle '
  + 'for <script src>. build: esbuild --bundle --minify --format=iife. '
  + 'upgrade: node build/mkvysmo.js */';

if (!fs.existsSync(path.join(SRC, 'node_modules', '@vysmo', 'flipbook'))) {
  console.log('  安装打包依赖（首次需要网络）：' + path.relative(process.cwd(), SRC));
  const r = spawnSync('npm', ['install', '--no-audit', '--no-fund'], {
    cwd: SRC, stdio: 'inherit', shell: process.platform === 'win32'
  });
  if (r.status !== 0) {
    console.error('✗ npm install 失败，请手动执行：cd build/vysmo-src && npm install');
    process.exit(1);
  }
}

/* ---------- 补丁：lazy 路径的纹理 Y 翻转 ----------
 * 库的 TextureCache.loadUrlAsTexture() 是这么走的：
 *     const bitmap = await createImageBitmap(blob);
 *     return this.uploadAsNewTexture(bitmap);
 * 而 uploadAsNewTexture 靠 gl.pixelStorei(UNPACK_FLIP_Y_WEBGL, true) 翻纹理 ——
 * 这个参数对 **ImageBitmap 源按 WebGL 规范被忽略**，方向只能由
 * createImageBitmap 的 imageOrientation 决定。于是：开了 lazy（flipbook 的
 * lazy:true 走 preload → resolveAsync → 这条路）时页面纹理没翻转，
 * 整个页面上下颠倒；非 lazy 路径用 HTMLImageElement，pixelStorei 有效，
 * 所以只有开了 lazy 才会看到「页面是倒着的」。
 * 升级库版本时若这段源码变了，下面的计数校验会直接报错退出，不会静默放过。 */
const GL_FLIP_PATCH = {
  name: 'gl-core-lazy-flip',
  setup: function (build) {
    build.onLoad({ filter: /gl-core[\\/]dist[\\/]texture-cache\.js$/ }, function (args) {
      const src = fs.readFileSync(args.path, 'utf8');
      const OLD = 'await createImageBitmap(blob)';
      const NEW = "await createImageBitmap(blob, { imageOrientation: this.flipY ? 'flipY' : 'none' })";
      const n = src.split(OLD).length - 1;
      if (n !== 1) {
        throw new Error('纹理翻转补丁：在 ' + path.basename(args.path) + ' 里找到 ' + n
          + ' 处目标代码（应为 1）—— 库版本可能变了，需要对照新版本调整补丁。');
      }
      console.log('  纹理翻转补丁: 已应用（lazy 路径的 createImageBitmap 补上 imageOrientation）');
      return { contents: src.replace(OLD, NEW), loader: 'js' };
    });
  }
};

/* 用 esbuild 的 JS API 而不是 CLI：banner 里有空格，
   在 Windows 上经 shell 传参会把它拆散。
   又：必须用异步 API —— esbuild 不允许 buildSync 里带 plugins（补丁要用插件）。 */
const esbuild = require(path.join(SRC, 'node_modules', 'esbuild'));
esbuild.build({
  entryPoints: [path.join(SRC, 'entry.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2019',
  legalComments: 'none',
  banner: { js: BANNER },
  plugins: [GL_FLIP_PATCH],
  outfile: OUT
}).then(function () {
  console.log('  翻页库打包  : @vysmo/flipbook %s -> vendor/vysmo-flipbook.min.js'
    + ' (%s KB, esbuild %s)', VER, (fs.statSync(OUT).size / 1024).toFixed(1),
    require(path.join(SRC, 'node_modules', 'esbuild', 'package.json')).version);
}).catch(function (err) {
  console.error(err && (err.message || err));
  process.exit(1);
});
