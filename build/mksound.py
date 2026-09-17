#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""mksound.py —— 合成两个翻页音效（内置素材），输出到 build/vendor/sound/

为什么要自己合成：内置音效要么从素材站下载二进制（本项目里没有下载渠道，
也不该把第三方音频塞进仓库），要么自己生成。合成的好处是**零版权顾虑**、
体积可控、随时可重生成。想换成真实录音时，把同名 wav 覆盖掉即可
（工作台面板里也能填自定义路径）。

两个音色：
  flip-light.wav  轻纸页：噪声 + 高通，短促清脆，约 0.30s
  flip-heavy.wav  厚书页：低频更重、衰减更慢，约 0.45s

用法：python3 build/mksound.py
"""
import math
import os
import random
import struct
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'vendor', 'sound')
SR = 22050


def synth(dur, tau, hp, lp, low_gain, low_hz, seed):
    """白噪声 -> 一阶高通 -> 一阶低通 -> 指数衰减包络；再叠一点低频颤动。"""
    rnd = random.Random(seed)
    n = int(SR * dur)
    out = []
    prev_x, prev_y = 0.0, 0.0
    for i in range(n):
        t = i / SR
        x = rnd.uniform(-1.0, 1.0)
        # 一阶高通（差分）：去掉过低的隆隆声
        hp_out = x - prev_x * hp
        prev_x = x
        # 一阶低通（滑动平均）：削掉刺耳的高频 → 像纸而不是"沙沙电流"
        lp_out = prev_y + lp * (hp_out - prev_y)
        prev_y = lp_out
        # 包络：6ms 起振 + 指数衰减
        attack = min(1.0, t / 0.006)
        env = attack * math.exp(-t / tau)
        s = lp_out * env
        # 低频颤动：模拟纸页抖动
        s += low_gain * math.sin(2 * math.pi * low_hz * t) * env * env
        out.append(max(-1.0, min(1.0, s * 0.85)))
    return out


def write_wav(path, samples):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<h', int(s * 32767)) for s in samples))
    return os.path.getsize(path)


def main():
    light = synth(dur=0.30, tau=0.075, hp=0.93, lp=0.55, low_gain=0.10, low_hz=170, seed=7)
    heavy = synth(dur=0.45, tau=0.130, hp=0.90, lp=0.34, low_gain=0.22, low_hz=95, seed=21)
    a = write_wav(os.path.join(OUT, 'flip-light.wav'), light)
    b = write_wav(os.path.join(OUT, 'flip-heavy.wav'), heavy)
    print('  flip-light.wav  %.1f KB' % (a / 1024.0))
    print('  flip-heavy.wav  %.1f KB' % (b / 1024.0))
    print('  输出目录        %s' % os.path.relpath(OUT, os.path.dirname(HERE)))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
