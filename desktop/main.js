/* =====================================================================
 * main.js —— 桌面应用主进程
 *
 * 做两件事：
 *   1) 在 127.0.0.1 上起一个只读静态服务（从 8788 起找空闲端口，
 *      被占用就顺延；只绑本机，不对外网开放）
 *   2) 开一个窗口指向它 —— 工作台照旧跑在 http:// 下，
 *      CI360 的 crossOrigin、WebGL 翻页等行为与在浏览器里完全一致
 *
 * 为什么不用 file://：CI360 给每张图设了 crossOrigin="anonymous"，
 * file:// 下会被浏览器拦掉、预览一片空白 —— 这也是现在必须用
 * 「启动工作台.bat」起本地服务的原因。桌面应用把这一步内置了。
 * ===================================================================== */
'use strict';
const { app, BrowserWindow, shell, dialog } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'app');      // 随应用发布的文件（studio.html + lib/ …）
const ENTRY = '/studio.html';
const BASE_PORT = 8788;                        // 与「启动工作台.bat」一致；被占用则顺延
const MAX_TRIES = 12;
let mainWin = null;
let server = null;
let port = 0;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.ps1': 'text/plain; charset=utf-8',
  '.bat': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.woff2': 'font/woff2'
};

function handleRequest(req, res) {
  let rel = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
  if (rel === '/' || rel === '') rel = ENTRY;
  const fp = path.normalize(path.join(ROOT, rel));
  if (!fp.startsWith(ROOT)) {                  /* 防目录穿越 */
    res.writeHead(403); res.end('forbidden'); return;
  }
  fs.readFile(fp, function (err, data) {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}

function startServer() {
  return new Promise(function (resolve, reject) {
    server = http.createServer(handleRequest);
    let tries = 0;
    function tryListen(p) {
      server.once('error', function (err) {
        if (err && err.code === 'EADDRINUSE' && tries < MAX_TRIES) {
          tries += 1;
          tryListen(BASE_PORT + tries);
        } else {
          reject(err);
        }
      });
      server.listen(p, '127.0.0.1', function () {
        port = server.address().port;
        console.log('[studio] local server: http://127.0.0.1:' + port + ENTRY);
        resolve(port);
      });
    }
    tryListen(BASE_PORT);
  });
}

function createWindow() {
  mainWin = new BrowserWindow({
    width: 1500,
    height: 920,
    minWidth: 1080,
    minHeight: 680,
    title: '360° 全景展示工作台',
    backgroundColor: '#12100e',
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true,                        /* 不显示默认菜单栏，更像个应用 */
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });
  mainWin.loadURL('http://127.0.0.1:' + port + ENTRY);
  /* 页面里的外链交给系统浏览器，不要跑在应用窗口里 */
  mainWin.webContents.setWindowOpenHandler(function (info) {
    if (/^https?:/i.test(info.url)) { shell.openExternal(info.url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
  mainWin.on('closed', function () { mainWin = null; });
}

/* 单实例：重复双击时激活已有窗口，而不是再起一个服务 */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', function () {
    if (mainWin) {
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.focus();
    }
  });
  app.whenReady().then(function () {
    if (!fs.existsSync(path.join(ROOT, 'studio.html'))) {
      dialog.showErrorBox('缺少文件',
        '没找到 app/studio.html。\n请先在 desktop 目录执行 npm run sync，把工作台文件同步进来。');
      app.quit();
      return;
    }
    startServer().then(function () {
      createWindow();
    }).catch(function (e) {
      dialog.showErrorBox('启动失败', '本地服务没能起来：' + (e && e.message));
      app.quit();
    });
  });
  app.on('window-all-closed', function () {
    if (server) { try { server.close(); } catch (e) { /* 忽略 */ } }
    app.quit();
  });
}
