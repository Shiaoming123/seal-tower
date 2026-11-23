# 照影廊 · 斩妖塔

> **当前开发在 [`v2/`](v2/)。** v2 是全量重做的版本：第一人称随机迷宫、卡牌战斗、异形背包构筑、三层塔和负钟君。运行方法见 [v2/README.md](v2/README.md)，反馈与改动的对照见 [v2/docs/重构说明.md](v2/docs/重构说明.md)。下面是旧原型的说明，旧代码原样保留供对照。

[开发导航](docs/开发导航.md) · [Agent 协作规范](docs/Agent协作规范.md) · [任务清单](docs/协作任务.md) · [开发日志](docs/dev-log/README.md)

一款中式像素风网页 Roguelike 原型。你在镇灯铺接单，进塔打牌猎妖，选择消耗灯灰挡招、卖货换装备，或带货回铺完成委托。当前主线是第一人称的「镇灯铺 · 猎妖供货」。固定机位的斩妖塔、一印两价和押运也保存在项目中。

[下载离线版与开发归档](https://github.com/Shiaoming123/seal-tower/releases/tag/v0.1.0) · [设计背景与对话决策](docs/项目对话与决策.md) · [继续开发](docs/继续开发.md) · [历史归档索引](docs/开发归档.md) · [逐字对话和原附件](docs/conversation/README.md)

## 历史原型

以下试玩、构建和归档说明对应 `first-cut/`。当前版本使用 [v2 运行说明](v2/README.md)。

### 试玩

从 Release 下载 `seal-tower-offline.zip`，解压后在浏览器打开 `照影廊.html`。在标题点「镇灯铺 · 入塔接单」。路签 1 适合复现第二层桥驿、岔路和鼠洞。

开发时在仓库根目录运行：

```sh
python -m http.server 8774 --bind 127.0.0.1
```

- 第一人称卡牌主线在 [本地试玩](http://127.0.0.1:8774/first-cut/?play=crawl&seed=1)。
- 侧面机位猎妖在 [本地试玩](http://127.0.0.1:8774/first-cut/?play=hunt&seed=1)。
- 第一剑和印契旧线在 [本地试玩](http://127.0.0.1:8774/first-cut/)。
- 最早的斩妖塔原型在 [仓库根页](http://127.0.0.1:8774/)。

### 构建与验证

游戏使用原生 HTML、CSS、JavaScript、Canvas 和浏览器合成音频。运行时不依赖 npm、GPU 特性或联网素材。用 Python 3 打包为独立 HTML：

```sh
python first-cut/build_offline.py --output dist/seal-tower.html
npm test
```

规则测试需要 Node.js 22 或以上。浏览器自动化还需要 Chrome 和 Playwright：

```sh
npm ci
npm run test:browser
```

没有安装名为 Chrome 的浏览器时，可运行 `npx playwright install chromium` 后再运行同一条浏览器测试命令。新增文案时安装 `fonttools[woff]`，用 `python first-cut/type/build_fonts.py --check` 检查离线字库。[字体重建](first-cut/type/README.md)

## 许可

项目代码按 [MIT](LICENSE) 发布。字体、图像、音效和历史记录的权利范围见 [素材与许可](docs/素材与许可.md)。
