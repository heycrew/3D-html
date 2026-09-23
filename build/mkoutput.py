# -*- coding: utf-8 -*-
"""把仓库里的样例 output/ 用当前版本重新导出一遍。

为什么需要：output/ 是一份历史导出样例（.gitignore 里那条 output/ 就是它）。
它由更早的版本生成，会有两个毛病：
  · 页面 head 里没有内联图标 → 打开时浏览器请求 /favicon.ico 拿 404（控制台红字）
  · 自带的 serve.ps1 / 使用说明.txt / lib 是旧版，与当前版本不一致

做法：index.html 走工作台里那条真正的生成路径（SD.Codegen.buildHtml），
其余文件从项目根复制最新版 —— 等价于「用当前版本导出一次」。

用法：python3 build/mkoutput.py
"""
import functools
import http.server
import os
import shutil
import sys
import threading

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
OUT = os.path.join(ROOT, 'output')
PORT = 8940
BASE = 'http://127.0.0.1:%d' % PORT

# 单品 360 的极简铺满模板 + 6 帧，参数与旧样例一致
GEN = """() => {
  var st = JSON.parse(JSON.stringify(window.SD.STATE));
  st.pageType = 'single';
  st.title = '360° 产品展示';
  st.templateId = 'bare';
  st.customCss = '';
  st.materials = { items: [], folder: './images/', filenameX: 'frame-{index}.jpg', pad: 0 };
  Object.assign(st.params, {
    folder: './images/', filenameX: 'frame-{index}.jpg', amountX: 6, indexZeroBase: 0,
    aspectRatio: '', fullscreen: false, zoomControls: true, hints: true, scrollHint: true
  });
  return window.SD.Codegen.buildHtml(st, { mode: 'files' });
}"""


def serve():
    hd = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', PORT), hd)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def main():
    if not os.path.isdir(OUT):
        sys.stderr.write('没有 output/ 目录：这份样例不存在，跳过\n')
        return 1
    srv = serve()
    try:
        with sync_playwright() as pw:
            b = pw.chromium.launch(channel="chrome")
            g = b.new_page()
            g.goto(BASE + '/studio.html', wait_until='load')
            g.wait_for_function("window.SD && window.SD.Codegen", timeout=15000)
            html = g.evaluate(GEN)
            b.close()
    finally:
        srv.shutdown()

    with open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(html)
    shutil.copyfile(os.path.join(ROOT, 'serve.ps1'), os.path.join(OUT, 'serve.ps1'))
    shutil.copyfile(os.path.join(ROOT, '使用说明.txt'), os.path.join(OUT, '使用说明.txt'))
    libdir = os.path.join(OUT, 'lib')
    shutil.rmtree(libdir, ignore_errors=True)
    shutil.copytree(os.path.join(ROOT, 'lib'), libdir)
    # 与 07-export.js 的 batContent 保持一致（CRLF，端口 8790）
    bat = '\r\n'.join([
        '@echo off', 'cd /d "%~dp0"',
        'powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port 8790'
        ' -Open "index.html"',
        'echo.', 'echo Server stopped.', 'pause', ''])
    with open(os.path.join(OUT, '启动.bat'), 'w', encoding='utf-8', newline='') as f:
        f.write(bat)

    print('已刷新 output/：')
    print('  index.html   %d B' % len(html.encode('utf-8')))
    print('  serve.ps1 / 使用说明.txt / lib/ / 启动.bat  ← 取自当前版本')
    return 0


if __name__ == '__main__':
    sys.exit(main())
