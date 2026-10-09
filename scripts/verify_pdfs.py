# /// script
# requires-python = ">=3.12"
# dependencies = ["pdfplumber>=0.11"]
# ///
"""Cross-check the workbook (via the JSON that build_data.py wrote) against the archived CBS PDFs.

Run from the repository root after build_data.py:

    uv run scripts/verify_pdfs.py

For every figure the website uses, look for the same number in the text of the CBS release it was
transcribed from. This is a presence check: it confirms that each value appears in the right
release, not where on the page it appears. Results go to web/src/data/verification.json and are
shown on the site's Data quality page. The script never edits the data.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
PDFS = ROOT / "original" / "SA Gaming Data"
DATA = ROOT / "web" / "src" / "data"

# A run of digit groups separated by single spaces or commas, e.g. "11 694", "1,016" or "12563".
RUN = re.compile(r"\d+(?:[ ,\u00a0\u202f]\d+)*(?:\.\d+)?")


def pdf_text(path: Path) -> str:
    """Layout-preserving text (pdfplumber), so columns that share a baseline stay apart."""
    with pdfplumber.open(str(path)) as pdf:
        return "\n".join((page.extract_text(layout=True) or "") for page in pdf.pages)


def numbers(text: str) -> set[str]:
    """Every number in the text as a normalised string (thousands separators removed).

    CBS formats thousands with commas in older releases and with spaces in newer ones
    ("11 694"), so a run such as "11 694" yields "11", "694" and "11694". Joins are only made
    across 3-digit groups, the way a thousands separator works.
    """
    out: set[str] = set()
    for m in RUN.finditer(text):
        raw = m.group(0)
        decimals = ""
        if "." in raw:
            raw, decimals = raw.rsplit(".", 1)
            decimals = "." + decimals
        parts = re.split(r"[ ,\u00a0\u202f]", raw)
        for i in range(len(parts)):
            out.add(parts[i] + (decimals if i == len(parts) - 1 else ""))
            joined = parts[i]
            for j in range(i + 1, len(parts)):
                if len(parts[j]) != 3:
                    break
                joined += parts[j]
                out.add(joined + (decimals if j == len(parts) - 1 else ""))
    return out


def decimals_in(nums: set[str]) -> list[float]:
    return [float(n) for n in nums if "." in n]


def has_close(values: list[float], v: float, tol: float) -> bool:
    return any(abs(x - v) <= tol for x in values)


def nearest(values, v: float, rel: float = 0.01):
    """The printed number closest to v (within rel), to show next to a miss."""
    best = None
    for x in values:
        if abs(x - v) <= abs(v) * rel and (best is None or abs(x - v) < abs(best - v)):
            best = x
    return best


def fmt_money(v: float) -> str:
    return f"{v:.2f}"


def fmt_int(v: float) -> str:
    return str(int(round(v)))


def fy_file(fy: str) -> str:
    return fy  # '2013-14' -> '2013-14.pdf'


def check_statewide(result: dict) -> None:
    rows = json.loads((DATA / "statewide.json").read_text())["rows"]
    by_fy = defaultdict(list)
    for r in rows:
        by_fy[r["fy"]].append(r)
    checked = found = 0
    misses = []
    for fy, rs in sorted(by_fy.items()):
        path = PDFS / "Gaming Statistics Statewide" / f"{fy_file(fy)}.pdf"
        nums = numbers(pdf_text(path))
        money = decimals_in(nums)
        for r in rs:
            for field in ("ngr", "tax", "venueShare", "machines", "venues"):
                checked += 1
                v = r[field]
                if field in ("machines", "venues"):
                    ok = fmt_int(v) in nums
                else:
                    # CBS occasionally prints three decimals (e.g. $73.812 mil); allow rounding.
                    ok = has_close(money, v, 0.0051)
                if ok:
                    found += 1
                else:
                    misses.append({"period": r["month"], "field": field, "value": v})
    result["statewide"] = {
        "family": "Gaming Statistics Statewide",
        "checked": checked,
        "found": found,
        "misses": misses,
    }


def check_lga(result: dict) -> None:
    lga = json.loads((DATA / "lga.json").read_text())
    by_fy = defaultdict(list)
    for u in lga["units"]:
        by_fy[u["fy"]].append(u)
    checked = found = 0
    misses = []
    totals = []
    for fy, units in sorted(by_fy.items()):
        path = PDFS / "Gaming Machine Revenue by ABS LGA" / f"{fy}.pdf"
        text = pdf_text(path)
        nums = numbers(text)
        money = [float(n) for n in nums if re.fullmatch(r"\d+\.\d{2}", n)]
        for u in units:
            checked += 1
            # Reconstructed group totals can differ from the printed figure by a few cents,
            # because the workbook stored each member's equal share rounded to the cent.
            tolerance = 0.01 * u["workbookRows"] + 0.005
            if has_close(money, u["ngr"], tolerance):
                found += 1
            else:
                misses.append(
                    {
                        "period": fy,
                        "field": u["label"],
                        "value": u["ngr"],
                        "printed": nearest(money, u["ngr"]),
                    }
                )
            # Machine counts are integers in the releases; skip small, non-distinctive ones and
            # the FY 2019/20 release, which has no machine column.
            if u["machines"] is not None and u["machines"] >= 50:
                checked += 1
                if fmt_int(u["machines"]) in nums:
                    found += 1
                else:
                    misses.append(
                        {"period": fy, "field": f"{u['label']} · machines", "value": u["machines"]}
                    )
        # The release's own printed total: the largest money value on the page.
        printed_total = max(money)
        workbook_total = round(sum(r["ngr"] for r in lga["rows"] if r["fy"] == fy), 2)
        totals.append(
            {"fy": fy, "printedTotal": printed_total, "workbookTotal": workbook_total}
        )
    result["lga"] = {
        "family": "Gaming Machine Revenue by ABS LGA",
        "checked": checked,
        "found": found,
        "misses": misses,
        "totals": totals,
    }


def check_licences(result: dict) -> None:
    rows = json.loads((DATA / "licences.json").read_text())["rows"]
    folder = PDFS / "Gaming Machine License Statistics"
    cache: dict[str, set[str]] = {}
    unreadable: set[str] = set()
    checked = found = 0
    misses = []
    for r in rows:
        y, m = map(int, r["month"].split("-"))
        q = {7: 1, 8: 1, 9: 1, 10: 2, 11: 2, 12: 2, 1: 3, 2: 3, 3: 3, 4: 4, 5: 4, 6: 4}[m]
        path = folder / f"{r['fy']} Q{q}.pdf"
        if not path.exists():
            continue
        key = str(path)
        if key not in cache:
            text = pdf_text(path)
            if len(re.sub(r"\D", "", text)) < 20:
                unreadable.add(path.name)
            cache[key] = numbers(text)
        if path.name in unreadable:
            continue
        nums = cache[key]
        for field in ("licences", "entitlements", "liveLicences", "liveMachines"):
            v = r[field]
            if v is None or v < 100:  # small counts (0, 40 …) are not distinctive enough
                continue
            checked += 1
            if fmt_int(v) in nums:
                found += 1
            else:
                misses.append(
                    {"period": r["month"], "field": f"{r['category']} · {field}", "value": v}
                )
    result["licences"] = {
        "family": "Gaming Machine Licence Statistics",
        "checked": checked,
        "found": found,
        "misses": misses,
        "note": "Counts under 100 are skipped because small numbers are not distinctive.",
        "imageOnly": sorted(unreadable),
    }


def check_manufacturers(result: dict) -> None:
    rows = json.loads((DATA / "manufacturers.json").read_text())["rows"]
    folder = PDFS / "Gaming Manufacturer’s Market Reports "
    files = {p.stem: p for p in folder.glob("*.pdf")}
    cache: dict[str, set[str]] = {}
    checked = found = 0
    misses = []
    for r in rows:
        candidates = [p for stem, p in files.items() if stem.startswith(r["fy"])]
        if not candidates:
            continue
        nums: set[str] = set()
        for p in candidates:
            if str(p) not in cache:
                cache[str(p)] = numbers(pdf_text(p))
            nums |= cache[str(p)]
        v = r["machines"]
        if v < 100:
            continue
        checked += 1
        if fmt_int(v) in nums:
            found += 1
        else:
            misses.append({"period": r["month"], "field": r["manufacturer"], "value": v})
    result["manufacturers"] = {
        "family": "Gaming Manufacturer’s Market Reports",
        "checked": checked,
        "found": found,
        "misses": misses,
        "note": "Counts under 100 are skipped because small numbers are not distinctive.",
    }


def main() -> None:
    result: dict = {}
    for fn in (check_statewide, check_lga, check_licences, check_manufacturers):
        fn(result)
        k = list(result)[-1]
        r = result[k]
        print(f"{r['family']}: {r['found']}/{r['checked']} values found, {len(r['misses'])} not found")
        for miss in r["misses"][:12]:
            print("   ", miss)
    out = DATA / "verification.json"
    out.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
