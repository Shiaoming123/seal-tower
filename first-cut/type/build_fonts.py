"""Rebuild the three game webfonts from the pinned inputs documented in README.md."""
from argparse import ArgumentParser
from hashlib import sha256
from pathlib import Path
import re
from shutil import copyfile

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


OUT = Path(__file__).resolve().parent
GAME = OUT.parent
FONTS = (
    ("brush", "Tower Brush", "6d2546bb189c732a8ca29af9e22457b152387d158aa459e4ac2ce1e51788b7fb"),
    ("script", "Tower Script", "f4b8a34d1f838fe411540cb7c97b1c384ac9738a876c4104500bc42508b2312a"),
    ("ledger", "Tower Ledger", "a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da"),
)
EXTRA = "灯纹印估单首摊兑票末市路签钤印成交系袋留印肆柒价银贰壹叁伍陆捌玖拾零金契落印开秤绯绡交易钤封典籍重试书斩妖塔朱记茶钱↶→×＋「」《》"


def game_codepoints(key):
    files = [*GAME.glob("*.js"), GAME / "index.html", GAME.parent / "game.js"]
    chars = set(EXTRA) | {chr(n) for n in range(32, 127)}
    for source in files:
        content = source.read_text(encoding="utf-8")
        if key == "brush" and source.name not in {"hud.js", "market-ui.js", "bazaar.js", "trade-table.js", "bag-ui.js", "escort-ui.js", "profile.js", "hunt-ui.js", "hunt-rules.js", "crawl-world.js", "crawl-cards.js", "index.html"}:
            # Market event titles and places are data. The other UI titles and
            # stamps are drawn in the two dedicated canvas layout modules.
            content = "".join(re.findall(r"\b(?:title|place|name)\s*:\s*([^,\n}]+)", content))
        chars.update(c for c in content if ord(c) > 126)
    return {ord(c) for c in chars}


def check_coverage(key, font, chars):
    # CJK and game punctuation must work offline. The secondary Script face
    # supplies a middle dot and two arrows absent from the other upstreams.
    shared = {"brush": "·→↶", "script": "", "ledger": "↶"}
    missing = chars - font.getBestCmap().keys() - set(map(ord, shared[key]))
    if missing:
        raise ValueError(f"{key} lacks " + "".join(chr(c) for c in sorted(missing)))


def make_font(key, family, digest, source, chars):
    if sha256(source.read_bytes()).hexdigest() != digest:
        raise ValueError(f"Unexpected upstream file: {source}")
    font = TTFont(source, recalcTimestamp=False)
    check_coverage(key, font, chars)
    options = subset.Options()
    options.name_IDs = list(range(26))
    options.name_languages = [0x409]
    worker = subset.Subsetter(options=options)
    worker.populate(unicodes=chars)
    worker.subset(font)
    if key == "ledger":
        instantiateVariableFont(font, {"wght": 580}, inplace=True)
    names = font["name"]
    replaced = {1, 2, 3, 4, 6, 16, 17, 18, 20, 21, 22, 25}
    names.names[:] = [entry for entry in names.names if entry.nameID not in replaced]
    for name_id, value in {1: family, 2: "Regular", 3: family + " 1.0 game subset",
                           4: family, 6: family.replace(" ", "") + "-Regular"}.items():
        names.setName(value, name_id, 3, 1, 0x409)
    font.flavor = "woff2"
    output = OUT / f"tower-{key}.woff2"
    font.save(output)
    copyfile(source.parent / "OFL.txt", OUT / f"OFL-{key}.txt")
    print(f"{output.name}: {len(font.getBestCmap())} code points, {output.stat().st_size} bytes")


if __name__ == "__main__":
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Check current game text against the shipped subsets.")
    for key, _, _ in FONTS:
        parser.add_argument("--" + key, type=Path, help="Original TTF with matching OFL.txt beside it.")
    args = parser.parse_args()
    for key, family, digest in FONTS:
        required = game_codepoints(key)
        if args.check:
            check_coverage(key, TTFont(OUT / f"tower-{key}.woff2"), required)
        elif source := getattr(args, key):
            make_font(key, family, digest, source, required)
        else:
            parser.error(f"--{key} is required to build the subsets")
