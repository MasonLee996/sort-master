# 拼接源码 + 内联 assets -> ../index.html（顺序：core, a, b, d, c）。运行：python src/build.py
import os, base64
os.chdir(os.path.dirname(os.path.abspath(__file__)))

src = "".join(open(f, encoding="utf8").read() + "\n"
              for f in ["core.js", "game_a.js", "game_b.js", "game_d.js", "game_c.js"])

# src/assets/*.png -> const ASSETS = {"yarn":"data:image/png;base64,..."}
parts = []
AD = "assets"
if os.path.isdir(AD):
    for f in sorted(os.listdir(AD)):
        if not f.lower().endswith(".png"):
            continue
        with open(os.path.join(AD, f), "rb") as fh:
            b64 = base64.b64encode(fh.read()).decode("ascii")
        parts.append('"%s":"data:image/png;base64,%s"' % (os.path.splitext(f)[0], b64))
prelude = "const ASSETS={" + ",".join(parts) + "};\n"

t = open("template.html", encoding="utf8").read()
assert "/*__JS__*/" in t
html = t.replace("/*__JS__*/", prelude + src.replace('module.exports', 'window.__m'))
open("../index.html", "w", encoding="utf8").write(html)
print("ok src=%dB assets=%d 张(%dKB) html=%dKB"
      % (len(src), len(parts), sum(len(p) for p in parts) // 1024, len(html) // 1024))
