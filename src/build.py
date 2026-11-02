# 拼接源码 + 内联 assets -> ../index.html（顺序：core, a, b, d, c）。运行：python src/build.py
import os, base64
os.chdir(os.path.dirname(os.path.abspath(__file__)))

src = "".join(open(f, encoding="utf8").read() + "\n"
              for f in ["core.js", "game_a.js", "game_b.js", "game_d.js", "game_c.js"])

# src/assets/*.png -> const ASSETS = {...};
# ⚠️ 关键：每个 base64 切成 ≤8KB 短块、跨行用 "+" 拼接。
# 否则整张资产表会被压成一条 1.3MB 的超长单行，桌面能解析、但 iOS Safari 等
# 手机浏览器对单行长度有硬上限，超长会 SyntaxError 整段挂掉 → 手机白屏。
CHUNK = 8000
out = ["const ASSETS={};"]
asset_n = 0
asset_kb = 0
AD = "assets"
if os.path.isdir(AD):
    for f in sorted(os.listdir(AD)):
        if not f.lower().endswith((".png", ".jpg", ".jpeg")):
            continue
        with open(os.path.join(AD, f), "rb") as fh:
            b64 = base64.b64encode(fh.read()).decode("ascii")
        mime = "image/jpeg" if f.lower().endswith((".jpg", ".jpeg")) else "image/png"
        key = os.path.splitext(f)[0]
        asset_n += 1
        asset_kb += len(b64) // 1024
        chunks = [b64[i:i + CHUNK] for i in range(0, len(b64), CHUNK)]  # 切成短块
        val = '"data:%s;base64,"' % mime
        for ch in chunks:
            val += '+\n"%s"' % ch
        out.append('ASSETS["%s"]=%s;' % (key, val))
prelude = "\n".join(out) + "\n"

t = open("template.html", encoding="utf8").read()
assert "/*__JS__*/" in t
html = t.replace("/*__JS__*/", prelude + src.replace('module.exports', 'window.__m'))
open("../index.html", "w", encoding="utf8").write(html)
print("ok src=%dB assets=%d 张(%dKB) html=%dKB"
      % (len(src), asset_n, asset_kb, len(html) // 1024))
