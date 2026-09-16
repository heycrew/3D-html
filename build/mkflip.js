/* =====================================================================
 * mkflip.js —— 生成打过补丁的翻页库到 lib/page-flip.browser.js
 *
 * 为什么需要补丁：StPageFlip 每帧会把整张 canvas 填成白色
 *   clear(){ this.ctx.fillStyle="white"; this.ctx.fillRect(...) }
 * 于是「翻动页的背面」永远是白的。改成 clearRect（透明）之后，
 * 下层我们自己铺的「淡化版当前页」就露出来了 —— 也就是
 * 「背面用被翻页面的内容变淡」的效果。
 *
 * 库升级后重跑构建即可；补丁目标找不到时这里会报错退出，
 * 不会静默产出一个没打补丁的库。
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const VENDOR = path.join(__dirname, 'vendor', 'page-flip.browser.js');
const OUT = path.join(__dirname, '..', 'lib', 'page-flip.browser.js');

const OLD = 'clear(){this.ctx.fillStyle="white",this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height)}';
const NEW = 'clear(){this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height)}';

const src = fs.readFileSync(VENDOR, 'utf8');
let out;
if (src.indexOf(NEW) >= 0) {
  out = src;                                   /* vendor 本身就是补丁后的 */
  console.log('  翻页库补丁  : 已应用（vendored）');
} else {
  const n = src.split(OLD).length - 1;
  if (n !== 1) {
    console.error('✗ 翻页库补丁：在 vendor/page-flip.browser.js 里找到 ' + n + ' 处目标代码（应为 1）');
    console.error('  库版本可能变了，需要对照新版本调整补丁。');
    process.exit(1);
  }
  out = src.replace(OLD, NEW);
  console.log('  翻页库补丁  : 已应用（清屏改为透明，背面交给下层淡化层）');
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out, 'utf8');
