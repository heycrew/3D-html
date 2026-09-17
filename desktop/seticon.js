/* 打包完成后，给 exe 写入图标与版本信息（exe 属性里看到的那几行）。
 *
 * 为什么不交给 electron-builder 自己做（它默认就会做）：
 *   那一步要先用 rcedit 改 PE 资源，而 rcedit 来自它要联网下载的 winCodeSign-2.6.0 包；
 *   更麻烦的是那个包里含 macOS 的 .dylib 符号链接，Windows 上解压需要额外特权，
 *   经常整包解压失败（ERROR: Cannot create symbolic link ...）。于是：
 *     · electron-builder 侧关掉 signAndEditExecutable（见 package.json 的 build.win）
 *     · 打完包由本脚本自己调 rcedit
 *   tools/rcedit-x64.exe 是从同一个包里单独抠出来的（命令行 7za x -xr'!darwin'），
 *   随仓库一起走 —— 这样没有网络也能打出带图标的 exe。
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const RCEDIT = path.join(HERE, 'tools', 'rcedit-x64.exe');
const PKG = require('./package.json');
const EXE = path.join(HERE, 'dist', 'win-unpacked', PKG.productName + '.exe');

if (!fs.existsSync(RCEDIT)) {
  console.error('[seticon] 找不到 tools/rcedit-x64.exe —— 没法写图标');
  process.exit(1);
}
if (!fs.existsSync(EXE)) {
  console.error('[seticon] 找不到 ' + EXE + ' —— 先跑 electron-builder');
  process.exit(1);
}

execFileSync(RCEDIT, [
  EXE,
  '--set-icon', path.join(HERE, 'icon.ico'),
  '--set-file-version', PKG.version,
  '--set-product-version', PKG.version,
  '--set-version-string', 'ProductName', PKG.productName,
  '--set-version-string', 'FileDescription', PKG.description,
  '--set-version-string', 'CompanyName', 'Reasonix'
], { stdio: 'inherit' });

console.log('[seticon] 已写入图标与版本信息：' + path.basename(EXE));
