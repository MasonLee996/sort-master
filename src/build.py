# 拼接源码 -> ../index.html（顺序：core, a, b, d, c）。运行：python src/build.py
import os; os.chdir(os.path.dirname(os.path.abspath(__file__)))
src="".join(open(f,encoding="utf8").read()+"\n" for f in ["core.js","game_a.js","game_b.js","game_d.js","game_c.js"])
t=open("template.html",encoding="utf8").read(); assert "/*__JS__*/" in t
open("../index.html","w",encoding="utf8").write(t.replace("/*__JS__*/",src.replace('module.exports','window.__m')))
print("ok", len(src))
