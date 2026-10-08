# verify.js 断言数台账（「只增不减」的机械证明）

> 背景（第 105 轮教训）：`.workbuddy/tools/verify.js` 位于 gitignore 目录、无 git 历史，"断言只增不减"只能人工读，曾出现"算了不用的字段"式断言弱化（第 105 轮 b 教训）。
> 本台账自 2026-10-08（第 108 轮）起维护：**每轮 verify.js 被改动后，必须在此追加一行「日期 · 轮次 · 断言数 · 增量 · sha256 前 12 位 · 改动摘要」**。
> 审计方法：`sha256sum .workbuddy/tools/verify.js` 对照上一次记录 → hash 变了就必须有对应的台账行；台账行缺失 = 检查是否被弱化。

| 日期 | 轮次 | 断言数 | 增量 | sha256(前12) | 改动摘要 |
|---|---|---|---|---|---|
| 2026-10-08 | 102(P2 收口基线) | 425 | — | —（历史基线，无 hash 记录） | P2 难度曲线表驱动等 16 条（第 105 轮落地时达到 425） |
| 2026-10-08 | 108 | 431 | +6 | 325425d0f00a | ① ctx 桩新增 `strokeCount` 计数（纯增强）；② 新增 SELECTED TARGET MARKERS 段 6 断言：guide/guideDone 死代码移除×2 + 选中管合法落点数≥1 + 绿标 stroke 差值===合法落点数 + 提示进行中绿标让位（stroke 仅提示===两者）+ 可解首步存在 |
| 2026-10-08 | 109(N1) | 437 | +6 | 49908e6f15ab | 新增 YARN SKIN 段 6 断言：shade() 加深计算×2（#ff5b6e→rgb(204,73,88)、#ffffff→rgb(128,128,128)）+ 单次 drawBall arc===5/stroke===2（软阴影+底色+绕线×2+高光）+ 整帧 stroke≥管数×3（口沿+双刻槽）+ shh() muted 下安全；均为纯增强，未动既有断言 |
| 2026-10-08 | 110(期3首刀) | 452 | +15 | 75c5ed43e2d7 | 新增 SCENE BG 段 15 断言：CHAPTERS.length===5 + chapterOf 章界边界×3（1/10、11/20、50/99 封顶）+ 每日织补落星夜章 + chProg 端点×2（第1关0.1、第10关1.0；注意 startLevel 不赋值 level，断言须先 `level=10;`）+ mix/grayOf/rgbaOf 计算×3 + 5 章逐章渲染冒烟×5；ctx 桩无需改（createLinearGradient/measureText 桩已存在）；均为纯增强 |
