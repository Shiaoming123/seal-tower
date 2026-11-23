# 照影廊字库

匾额、题签和大写数额使用毛笔字。道友和绯绡的对白使用中等字重的楷书。状态、报价和气血数字使用较厚的黑体，以便在手机上辨认。游戏随包加载三个 WOFF2 子集，字体服务无需联网。

| 游戏字体 | 原作与输入版本 | 使用位置 | 原始文件与许可 |
| --- | --- | --- | --- |
| Tower Brush | Ma Shan Zheng Regular 2.003 | 照影廊匾额、估单题签、肆与柒 | [上游 TTF](https://raw.githubusercontent.com/google/fonts/06bfe0d62a98375cb09c942fa18e68bd32cff057/ofl/mashanzheng/MaShanZheng-Regular.ttf) · [随包许可](OFL-brush.txt) |
| Tower Script | 霞鹜文楷 Medium 1.530 | 对白、普通选项 | [上游 TTF](https://raw.githubusercontent.com/lxgw/LxgwWenKai/e52e0e1e9f561f1caa2e14c8154d3a1accee834a/fonts/TTF/LXGWWenKai-Medium.ttf) · [随包许可](OFL-script.txt) |
| Tower Ledger | Noto Sans SC 2.004，固定至字重 580 | 灵石、价格、气血、细小注记 | [上游 TTF](https://raw.githubusercontent.com/google/fonts/6c1dbe27dcf7/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf) · [随包许可](OFL-ledger.txt) |

三套字体以 SIL Open Font License 1.1 随游戏分发。该许可允许字体与商业游戏一同嵌入和分发。三个衍生子集均采用新的主字体名并保留各自上游版权和许可。离线单文件也应包含三份版权声明及许可正文。[SIL 官方使用说明，第 1.4 问](https://openfontlicense.org/ofl-faq/#faq-1-4)

## 更新文案后的检查

项目在 Python 3.13.15、fontTools 4.61.1 和 Brotli 1.2.0 上生成这些文件。在项目根目录使用已安装 fontTools 和 Brotli 的 Python 检查现有字形。

```bash
python first-cut/type/build_fonts.py --check
```

脚本扫描 `game.js`、试玩入口和 `first-cut/*.js`。题字额外检查场景名、票签及 HUD 文案，正文与账目扫描全部游戏用字。非固定来源的新题字可以加入脚本的 `EXTRA`。文楷补齐题字中的间隔号、箭头及撤回符号。新增缺字时，准备表中三份原始 TTF，并将各自的上游 `OFL.txt` 放在相应 TTF 同目录，运行以下命令后重新打包。

```bash
python first-cut/type/build_fonts.py \
  --brush "/path/to/brush/MaShanZheng-Regular.ttf" \
  --script "/path/to/script/LXGWWenKai-Medium.ttf" \
  --ledger "/path/to/ledger/NotoSansSC[wght].ttf"
```

脚本校验每份原始 TTF 的 SHA256，固定账目字重，压缩 WOFF2，重写字体标识并复制许可文件。`font-bank.js` 暴露 `TowerFonts.ready`。画布调用 `CutInk.text(ctx, value, x, y, size, color, bold, role)`，其中 `role` 可取 `title`、`speech`、`price` 或 `label`。省略角色时仍按原调用中的字号和强调标记选择字体。
