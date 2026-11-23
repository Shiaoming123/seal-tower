"""Build the self-contained HTML used by the existing local play link."""
import argparse
import base64
import json
import re
import subprocess
from pathlib import Path

BASE = Path(__file__).resolve().parent
OUTPUT = BASE.parent / "evidence" / "一印两价" / "一印两价.html"

def embed_files(source, label, mime):
    start = f"/* {label} sources */"
    end = f"/* end {label} sources */"
    before, table = source.split(start, 1)
    paths, after = table.split(end, 1)
    assets = {}
    for name, url in json.loads(paths).items():
        encoded = base64.b64encode((BASE / url).read_bytes()).decode("ascii")
        assets[name] = f"data:{mime};base64," + encoded
    return before + json.dumps(assets, separators=(",", ":")) + after

def build(output):
    html = (BASE / "index.html").read_text("utf8")
    def inline_css(match):
        css = (BASE / match.group(1)).read_text("utf8")
        return "<style>\n" + css + "\n</style>"
    html = re.sub(r'<link rel="stylesheet" href="([a-z-]+\.css)">', inline_css, html)
    scripts = []
    def collect(match):
        path = BASE / match.group(1)
        source = path.read_text("utf8")
        if path.name == "sprite-bank.js":
            source = embed_files(source, "sprite", "image/webp")
        if path.name == "font-bank.js":
            source = embed_files(source, "font", "font/woff2")
        if "</script" in source.lower():
            raise ValueError(f"Unescaped script end tag in {path}")
        scripts.append(source)
        return ""
    html = re.sub(r'<script defer src="([^"]+)"></script>', collect, html)
    html = html.replace("</body>", "<script>\n" + "\n;\n".join(scripts) + "\n</script>\n</body>")
    notices = sorted((BASE / "type").glob("*OFL*.txt"))
    if not notices:
        raise ValueError("Embedded fonts require their upstream license notices")
    license_text = "\n\n".join(p.name + "\n" + p.read_text("utf8") for p in notices)
    html = html.replace("</head>", '<script id="font-licenses" type="text/plain">\n' + license_text + "\n</script></head>")
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".tmp")
    temporary.write_bytes(html.encode("utf8"))
    temporary.replace(output)
    print(f"{output} ({output.stat().st_size} bytes)")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUTPUT, help="write a separate candidate for review")
    parser.add_argument("--verify-inventory", type=Path, metavar="EVIDENCE_DIR",
                        help="run placement, pixel and economic checks before replacing the playable HTML")
    args = parser.parse_args()
    if args.verify_inventory:
        evidence = args.verify_inventory.resolve()
        subprocess.run(["node", str(BASE / "check-bag-placement.cjs"), "--out", str(evidence)], check=True)
        subprocess.run(["node", str(BASE / "check-bag-art.cjs"), "--out", str(evidence)], check=True)
        subprocess.run(["node", str(BASE / "economy-balance.cjs")], check=True)
        subprocess.run(["node", str(BASE / "merchant-balance.cjs")], check=True)
        subprocess.run(["node", str(BASE / "escort-balance.cjs")], check=True)
        subprocess.run(["node", str(BASE / "check-event-exits.cjs")], check=True)
        for test in ["check-hunt-rules.cjs", "check-crawl-cards.cjs", "check-crawl-world.cjs"]:
            subprocess.run(["node", str(BASE / test)], check=True)
    build(args.output.resolve())
