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

/* 用 esbuild 的 JS API 而不是 CLI：banner 里有空格，
   在 Windows 上经 shell 传参会把它拆散。 */
const esbuild = require(path.join(SRC, 'node_modules', 'esbuild'));
esbuild.buildSync({
  entryPoints: [path.join(SRC, 'entry.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2019',
  legalComments: 'none',
  banner: { js: BANNER },
  outfile: OUT
});

console.log('  翻页库打包  : @vysmo/flipbook %s -> vendor/vysmo-flipbook.min.js'
  + ' (%s KB, esbuild %s)', VER, (fs.statSync(OUT).size / 1024).toFixed(1),
  require(path.join(SRC, 'node_modules', 'esbuild', 'package.json')).version);
