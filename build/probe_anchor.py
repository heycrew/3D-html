# -*- coding: utf-8 -*-
"""用 Playwright 真实点击「加锚点」，捕获页面报错（排查用，用完即删）。"""
import sys
from playwright.sync_api import sync_playwright

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
URL = "http://localhost:8788/studio.html?demo=1&book=1"

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME, headless=True,
                                args=["--no-sandbox", "--disable-gpu"])
    ctx = browser.new_context(viewport={"width": 1400, "height": 900})
    page = ctx.new_page()

    logs = []
    page.on("console", lambda m: logs.append("[%s] %s" % (m.type, m.text)))
    page.on("pageerror", lambda e: logs.append("[PAGEERROR] %s" % e))

    page.goto(URL, wait_until="domcontentloaded")
    page.wait_for_timeout(7000)          # 等 demo 上传 + 造书页数据

    # 1) 检查书页是否造出来了
    info = page.evaluate("""() => {
      const st = window.SD && SD.STATE;
      if (!st) return {err: 'no SD.STATE'};
      return {
        pageType: st.pageType,
        bookPages: (st.book && st.book.pages || []).length,
        coverUrl: (st.book && st.book.cover && st.book.cover.url) || '',
        page1Url: (st.book && st.book.pages && st.book.pages[0] && st.book.pages[0].url) || '',
        active: st.book && st.book.active,
        lots: (st.lots || []).length,
        materials: (st.materials.items || []).length,
        hasBook: typeof SD.Book,
        hasPick: SD.Book && typeof SD.Book.startAnchorPick
      };
    }""")
    print("=== 状态 ===")
    for k, v in info.items():
        print("  %-12s %s" % (k, v))

    # 2) 检查按钮
    btn = page.query_selector("#btnAddAnchor")
    print()
    print("=== 按钮 ===")
    print("  存在:", bool(btn))
    if btn:
        print("  可见:", btn.is_visible())
        print("  display:", page.evaluate("() => getComputedStyle(document.getElementById('btnAddAnchor')).display"))

    # 3) 选中第 1 页，再点加锚点
    print()
    print("=== 点击「＋ 加锚点」 ===")
    page.evaluate("""() => { if (SD.Book) { SD.Book.setActive(1); SD.Book.render(); } }""")
    page.wait_for_timeout(500)
    before = len([l for l in logs if "PAGEERROR" in l])
    if btn:
        btn.click()
        page.wait_for_timeout(1500)

    modal = page.query_selector(".modal-mask")
    print("  弹窗出现:", bool(modal))
    if modal:
        print("  弹窗文本:", page.inner_text(".modal")[:180].replace("\n", " / "))
        lot_sel = page.query_selector("#anLot")
        print("  关联拍品下拉:", "存在" if lot_sel else "不存在")
        if lot_sel:
            print("  下拉选项数:", len(page.query_selector_all("#anLot option")))
        print("  页图是否显示:", page.evaluate("""() => {
            const i = document.getElementById('anImg');
            return i ? (i.complete && i.naturalWidth > 0 ? 'yes ' + i.naturalWidth : 'no complete=' + i.complete + ' nw=' + i.naturalWidth) : 'no img';
        }"""))

    print()
    print("=== 页面日志（最后 20 条）===")
    for l in logs[-20:]:
        print("  " + l[:160])

    browser.close()
