#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build.py —— 把 build/ 下的源文件组装成工作台交付目录

交付结构：
  studio.html            工作台入口（HTML + CSS + JS 全部内联）
  lib/360-view.min.js    360 库（Cloudimage 360 View 4.10.0，MIT）
  lib/vysmo-flipbook.min.js 翻页库（@vysmo/flipbook 0.5.0，MIT）
  serve.ps1              零依赖本地服务
  启动工作台.bat          双击启动
  使用说明.txt

用法：python3 build/build.py
"""
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.abspath(os.path.join(ROOT, '..'))

JS_ORDER = [
    '01-schema.js',
    '02-templates.js',
    '03-materials.js',
    '04-preview.js',
    '05-codegen.js',
    '06-hotspots.js',
    '07-export.js',
    '11-book.js',
    '12-bookpage.js',
    '13-store.js',
    '08-app.js',
]

README_TEXT = """360° 全景展示工作台 —— 使用说明
==================================================

【怎么打开】
  1. 双击「启动工作台.bat」
  2. 浏览器会自动打开工作台（地址形如 http://localhost:8788/studio.html）
  3. 导入素材 → 右侧调参数 → 点右上「导出 HTML」选一个空文件夹

【为什么不能直接双击 studio.html】
  Cloudimage 360 View 会给每张图片设置 crossOrigin="anonymous"，浏览器在
  file:// 协议下会拦掉这些请求，预览会一片空白。
  启动器用 Windows 自带的 PowerShell 起一个本地服务，零安装、无需管理员权限。

【目录说明】
  studio.html            工作台页面（入口）
  lib/360-view.min.js    360 查看器库（Cloudimage 360 View 4.10.0，MIT 协议）
  lib/vysmo-flipbook.min.js 翻页库（@vysmo/flipbook 0.5.0，MIT 协议）
  serve.ps1              本地服务脚本（由启动器调用）
  启动工作台.bat          双击启动
  使用说明.txt            本文件
  build/                 源码目录（不影响使用；重新构建：python3 build/build.py）

【绿色版说明】
  整个文件夹拷到任何 Windows 10 / 11 电脑都能直接用，
  不需要安装 Node、Python、IIS 或任何运行环境。

【素材建议】
  · 支持任意帧数，最少的「前后左右上下」6 张也能用
  · 帧数少于 8 时旋转会略显跳跃：建议前 4 张做水平环绕，
    「上 / 下」两张填进参数里的「垂直」那一组，用上下拖动看俯仰
  · 一圈 24 张以上观感最顺滑
  · 文件名带序号（如 1.jpg、2.jpg 或 p01.jpg）会自动按顺序排好

【导出的成品怎么用】
  · 本机预览：双击导出文件夹里的「启动.bat」
  · 上线：把整个导出文件夹上传到网站目录，直接访问 index.html
"""


def read_text(rel):
    with open(os.path.join(ROOT, rel), 'r', encoding='utf-8') as f:
        return f.read()


def main():
    shell = read_text('shell.html')

    parts = []
    for name in JS_ORDER:
        path = os.path.join(ROOT, 'js', name)
        if not os.path.exists(path):
            sys.stderr.write('缺少源文件：build/js/%s\n' % name)
            return 1
        parts.append(read_text(os.path.join('js', name)).rstrip())
    app_js = '\n\n'.join(parts)

    # 先逐个检查源模块的语法 —— 一个小笔误就会让整个工作台失效，
    # 而症状往往是「点了没反应」，极难定位（已经栽过两次）。
    if shutil.which('node'):
        bad_files = []
        for name in JS_ORDER:
            fp = os.path.join(ROOT, 'js', name)
            rr = subprocess.run(['node', '--check', fp], capture_output=True,
                                text=True, encoding='utf-8', errors='replace')
            if rr.returncode != 0:
                bad_files.append((name, (rr.stderr or '')[:600]))
        if bad_files:
            for name, err in bad_files:
                sys.stderr.write('✗ %s 语法错误：' % name)
                sys.stderr.write(err)
                sys.stderr.write(chr(10))
            return 1
        print('  模块语法检查: 通过（%d 个）' % len(JS_ORDER))

    if '{{APP_JS}}' not in shell:
        sys.stderr.write('shell.html 缺少占位符 {{APP_JS}}\n')
        return 1

    # 逻辑代码内联进 <script>：防止源码里的 </script 提前闭合标签
    app_safe = app_js.replace('</script', '<\\/script')
    import datetime
    _bt = datetime.datetime.now().strftime('%m-%d %H:%M')
    html = shell.replace('{{APP_JS}}', app_safe).replace('{{BUILD_TIME}}', _bt)

    # newline='\n' 是必须的：Windows 上默认把 \n 写成 \r\n，
    # 会让这两个文件每次构建都退回 CRLF，与 .gitattributes 的 eol=lf 打架。
    out_html = os.path.join(DEST, 'studio.html')
    with open(out_html, 'w', encoding='utf-8', newline='\n') as f:
        f.write(html)

    # 第三方库与素材：vendor/ 下打好的产物，按目录结构整份复制过去
    #   （360 查看器、翻页库、sound/ 下的内置音效）。
    #   翻页库升级版本时跑 node build/mkvysmo.js 重新打包；音效要重生成跑
    #   python3 build/mksound.py；日常构建不需要 node / npm —— 绿色版仍只要 python。
    lib_dest_dir = os.path.join(DEST, 'lib')
    os.makedirs(lib_dest_dir, exist_ok=True)
    vendor_dir = os.path.join(ROOT, 'vendor')
    _copied = 0
    for _root, _dirs, _files in os.walk(vendor_dir):
        _rel = os.path.relpath(_root, vendor_dir)
        _dest = lib_dest_dir if _rel == '.' else os.path.join(lib_dest_dir, _rel)
        os.makedirs(_dest, exist_ok=True)
        for _fn in _files:
            shutil.copyfile(os.path.join(_root, _fn), os.path.join(_dest, _fn))
            _copied += 1
    print('  第三方库/素材: 已复制 %d 个文件到 lib/' % _copied)

    # 清掉上一版遗留的翻页库（引擎已换成 vysmo，留着会让人以为还在用 StPageFlip）
    _old_flip = os.path.join(lib_dest_dir, 'page-flip.browser.js')
    if os.path.exists(_old_flip):
        os.remove(_old_flip)
        print('  已移除旧库：lib/page-flip.browser.js')

    # 使用说明
    with open(os.path.join(DEST, '使用说明.txt'), 'w', encoding='utf-8',
              newline='\n') as f:
        f.write(README_TEXT)

    # 语法自检：buildInit 拼出来的 JS 容易漏逗号 / 多括号，
    # 这类错误构建时不报、要等导出后浏览器执行才炸，症状还很难定位。
    # 这里把它拼成完整脚本，交给 node --check 拦一道。
    if shutil.which('node') and os.path.exists(os.path.join(ROOT, 'check.js')):
        r = subprocess.run(['node', 'check.js'], cwd=ROOT,
                           capture_output=True, text=True,
                           encoding='utf-8', errors='replace')
        if r.returncode != 0:
            sys.stderr.write('生成待校验脚本失败：\n' + (r.stdout or '') + (r.stderr or ''))
            return 1
        tmpdir = os.path.join(ROOT, '.syntax-check')
        bad = []
        names = []
        if os.path.isdir(tmpdir):
            for fn in sorted(os.listdir(tmpdir)):
                if not fn.endswith('.js'):
                    continue
                names.append(fn)
                rr = subprocess.run(['node', '--check', os.path.join(tmpdir, fn)],
                                    capture_output=True, text=True,
                                    encoding='utf-8', errors='replace')
                if rr.returncode != 0:
                    bad.append((fn, (rr.stderr or rr.stdout or '')[:800]))
        if bad:
            for fn, err in bad:
                sys.stderr.write('\n✗ %s 语法错误：\n%s\n' % (fn, err))
            return 1
        print('  语法自检    : 通过（%d 份）' % len(names))
    else:
        print('  语法自检    : 跳过（未找到 node）')

    # 清掉历史命名
    old = os.path.join(DEST, '工作台.html')
    if os.path.exists(old):
        os.remove(old)
        print('  已移除旧文件：工作台.html')

    print('构建完成')
    print('  studio.html  : %.1f KB' % (len(html.encode('utf-8')) / 1024.0))
    print('  lib/         : 360-view.min.js + vysmo-flipbook.min.js')
    print('  serve.ps1    : 本地服务')
    print('  启动工作台.bat : 双击启动')
    print('  使用说明.txt  : 说明文档')
    return 0


if __name__ == '__main__':
    sys.exit(main())
