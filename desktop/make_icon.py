# -*- coding: utf-8 -*-
"""make_icon.py —— 生成桌面应用图标 desktop/icon.ico

画一个深色圆角底 + 白色圆环 + “360°”，输出多尺寸 ico（16/32/48/64/128/256）。
图标是纯几何图形，不依赖任何字体文件缺失的写法（用 PIL 自带字体画数字）。

用法：python3 desktop/make_icon.py
"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'icon.ico')
SIZES = [16, 32, 48, 64, 128, 256]
S = 512                     # 先画大图再缩放，边缘更干净


def draw():
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # 圆角深色底
    pad = int(S * 0.04)
    d.rounded_rectangle([pad, pad, S - pad, S - pad], radius=int(S * 0.22),
                        fill=(18, 16, 14, 255), outline=(255, 179, 64, 255), width=int(S * 0.022))
    # 白色圆环（象征 360 环绕）
    r = int(S * 0.30)
    cx = cy = S // 2
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 255, 255, 255), width=int(S * 0.045))
    # 环上开一个缺口 + 箭头，暗示“旋转”
    d.polygon([(cx + r - int(S * 0.055), cy - int(S * 0.075)),
               (cx + r + int(S * 0.075), cy - int(S * 0.015)),
               (cx + r - int(S * 0.030), cy + int(S * 0.055))],
              fill=(255, 179, 64, 255))
    return im


def main():
    big = draw()
    # "360°" 用 PIL 内置位图字体会很糊，这里直接用它画数字（够用），再叠一个度数小圆
    try:
        from PIL import ImageFont
        font = None
        for cand in ('arialbd.ttf', 'Arial_Bold.ttf', 'DejaVuSans-Bold.ttf'):
            try:
                font = ImageFont.truetype(cand, int(S * 0.20))
                break
            except Exception:
                continue
        if font is None:
            font = ImageFont.load_default()
        d = ImageDraw.Draw(big)
        txt = '360'
        box = d.textbbox((0, 0), txt, font=font)
        tw, th = box[2] - box[0], box[3] - box[1]
        d.text((S // 2 - tw // 2, S // 2 - th // 2 - box[1]), txt, font=font,
               fill=(255, 255, 255, 255))
        # 度数小圆
        cr = int(S * 0.028)
        px = S // 2 + tw // 2 + int(S * 0.012)
        py = S // 2 - int(S * 0.105)
        d.ellipse([px, py, px + cr * 2, py + cr * 2], outline=(255, 255, 255, 255), width=int(S * 0.014))
    except Exception as e:
        print('  （数字部分跳过：%s）' % e)

    big.save(OUT, sizes=[(n, n) for n in SIZES])
    print('  已生成 %s（%d 个尺寸：%s）' % (os.path.relpath(OUT, os.path.dirname(HERE)),
                                        len(SIZES), '/'.join(str(n) for n in SIZES)))
    print('  文件大小 %.1f KB' % (os.path.getsize(OUT) / 1024.0))


if __name__ == '__main__':
    raise SystemExit(main())
