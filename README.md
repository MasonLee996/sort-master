# 拾线铺 · Demo

> 微信小游戏方向的玩法 Demo：**堆叠拾取 + 7 格线篮三消（抓大鹅式）× 客人订单 + 线铺修复剧情（浪漫餐厅式）**。

**在线试玩**：https://masonlee996.github.io/sort-master/

## 玩法
1. 筐里散落着一堆东西，点**没被压住**的物件放进下方线篮。
2. 篮里凑齐 **3 个一样的**自动收好；篮子装满（开局 7 格）就输。
3. 顶部是**客人订单**：每拿一件，客人耐心 -1；收好他要的东西就交单 → **线篮 +1 格（最多 9 格）+ 金币**。
4. 过关得星星，回**线铺**修复家具、解锁剧情。
5. 道具：抖篮（重洗）/ 退回（篮里 3 件放回筐顶）/ 透视；用完可看广告或花 30 金币。

## 关卡曲线（`src/sim3.js` 每关 400 局实测，裸玩通过率）
| 1 | 2 | 3–6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|
| 100% 教学 | **32% 卡点关** | 92–98% 爽关 | 64% | 82% 喘气 | 51% | **15% Boss** |

## 目录
| 路径 | 说明 |
|---|---|
| `index.html` | 构建产物，单文件可直接打开 / GitHub Pages 发布（贴图已 base64 内联） |
| `src/assets/` | 贴图素材：10 物件 + 4 道具图标（透明 PNG）+ 8 角色立绘（PNG）+ 墙/桌纹理（JPEG） |
| `src/template.html` | HTML/CSS 模板（`/*__JS__*/` 占位） |
| `src/core.js` | 数据（关卡/物件/剧情）+ 有解生成器 |
| `src/game_a.js` `game_b.js` | 绘制、音效、交互、三消、道具 |
| `src/game_d.js` | 客人订单系统 |
| `src/game_c.js` | 关卡流程、结算、广告占位、线铺 |
| `src/sim3.js` `sweep.js` | 调参模拟器（订单奖励 / 耐心 / 单关参数扫描） |
| `src/smoke.js` | Node vm 冒烟测试（全 10 关流程） |
| `design/` | 效果图（原画版 / 纯矢量对照版） |
| `docs/` | 玩法重设计方案、项目决策卡 |

## 开发
```bash
python src/build.py      # 拼接 src → index.html，并把 src/assets/*.png 内联成 ASSETS
node src/smoke.js        # 冒烟
node .workbuddy/tools/verify_assets.js   # 贴图接入校验（内联/加载/绘制/回退）
REWARD=slot MAXSLOT=9 CHASE=3 PATK=11 PATB=8 node src/sim3.js   # 难度/订单平衡
```

**贴图约定**：`COLORS[i]` ↔ `ITEM_KEYS[i]` ↔ `src/assets/<key>.png` 一一对应（颜色=物件）。
贴图未加载完成时 `drawItem` 自动回退到 emoji 绘制，不会白屏。

## 历史
旧版《收纳大师》（倒球解谜 H5）已废弃，完整代码保留在分支 `archive/sort-master-h5` / 标签 `archive-h5-final`。
