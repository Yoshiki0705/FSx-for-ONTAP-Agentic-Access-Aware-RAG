#!/usr/bin/env python3
"""業種別デモデータパック（demo-data/industry-packs/）の整合を検査する。

見るもの:
  - 業種カードの業種 ID（docker/nextjs/src/constants/card-constants.ts の INDUSTRIES）と
    パックのディレクトリが 1 対 1 であること
  - 各パックの文書が 5 本で、すべてに対応する `.metadata.json` があること（逆も同様）
  - `.metadata.json` が正式スキーマ（`allowed_group_sids` が SID の配列）であること
  - 使われている SID（`S-1-1-0` と Domain Admins を除く）が、README の SID 一覧にあること
  - 文書にメールアドレス、IP アドレス、URL、エムダッシュがないこと（架空データの安全確認）

使用方法:
    python3 scripts/check-industry-packs.py
    python3 scripts/check-industry-packs.py --selftest

終了コード: 0 = 問題なし / 1 = 問題あり / 2 = 自己確認の失敗
"""
from __future__ import annotations

import json
import re
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACKS = ROOT / "demo-data" / "industry-packs"
CARDS = ROOT / "docker" / "nextjs" / "src" / "constants" / "card-constants.ts"
DOCS_PER_PACK = 5
SID = re.compile(r"^S-1-(?:1-0|5-21-000-000-000-\d+)$")
EVERYONE = "S-1-1-0"
ADMINS = "S-1-5-21-000-000-000-512"
UNSAFE = re.compile(
    r"[\w.+-]+@[\w-]+\.[\w.]+"  # メールアドレス
    r"|\b\d{1,3}(?:\.\d{1,3}){3}\b"  # IPv4
    r"|https?://(?!example\.(?:com|org)\b)"  # URL（予約済みの example.com / example.org は除く）
    r"|—"  # エムダッシュ
)


def industry_ids(cards: Path) -> list[str]:
    return re.findall(r"\{ id: '([a-z]+)', icon: \w+, labelKey: 'cards\.industries", cards.read_text(encoding="utf-8"))


def readme_rids(readme: Path) -> set[str]:
    """README の SID 一覧にある末尾の番号（`-2100` の形）を集める。"""
    return set(re.findall(r"^\| `-(\d+)` \|", readme.read_text(encoding="utf-8"), re.M))


def check(packs: Path, cards: Path) -> list[str]:
    problems: list[str] = []
    ids = industry_ids(cards)
    if not ids:
        return [f"{cards}: 業種 ID を読み取れない"]
    dirs = sorted(p.name for p in packs.iterdir() if p.is_dir())
    for missing in sorted(set(ids) - set(dirs)):
        problems.append(f"{missing}: 業種カードはあるがパックがない")
    for extra in sorted(set(dirs) - set(ids)):
        problems.append(f"{extra}: パックはあるが業種カードがない")
    known = readme_rids(packs / "README.md")
    for name in sorted(set(ids) & set(dirs)):
        pack = packs / name
        docs = sorted(p.name for p in pack.glob("*.md"))
        metas = sorted(p.name for p in pack.glob("*.md.metadata.json"))
        if len(docs) != DOCS_PER_PACK:
            problems.append(f"{name}: 文書が {len(docs)} 本（{DOCS_PER_PACK} 本のはず）")
        for doc in docs:
            if f"{doc}.metadata.json" not in metas:
                problems.append(f"{name}/{doc}: .metadata.json がない")
            text = (pack / doc).read_text(encoding="utf-8")
            if UNSAFE.search(text):
                problems.append(f"{name}/{doc}: メールアドレス・IP・URL・エムダッシュのいずれかを含む")
        for meta in metas:
            if meta.removesuffix(".metadata.json") not in docs:
                problems.append(f"{name}/{meta}: 対応する文書がない")
            try:
                data = json.loads((pack / meta).read_text(encoding="utf-8"))
                sids = data["metadataAttributes"]["allowed_group_sids"]
            except (KeyError, TypeError, ValueError) as exc:
                problems.append(f"{name}/{meta}: スキーマ違反（{exc!r}）")
                continue
            if not isinstance(sids, list) or not sids or not all(isinstance(s, str) and SID.match(s) for s in sids):
                problems.append(f"{name}/{meta}: allowed_group_sids が SID の配列ではない")
                continue
            for sid in sids:
                rid = sid.rsplit("-", 1)[-1]
                if sid not in (EVERYONE, ADMINS) and rid not in known:
                    problems.append(f"{name}/{meta}: SID 末尾 -{rid} が README の SID 一覧にない")
    return problems


def selftest() -> int:
    """検出器が、通してはいけない入力で落ちることを確かめる。"""
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        cards = root / "cards.ts"
        cards.write_text("{ id: 'legal', icon: Gavel, labelKey: 'cards.industries.legal' },\n", encoding="utf-8")
        packs = root / "packs"
        (packs / "legal").mkdir(parents=True)
        (packs / "README.md").write_text("| `-4100` | 法務部 | x |\n", encoding="utf-8")
        for n in range(DOCS_PER_PACK):
            (packs / "legal" / f"d{n}.md").write_text("架空の文書", encoding="utf-8")
            (packs / "legal" / f"d{n}.md.metadata.json").write_text(
                json.dumps({"metadataAttributes": {"allowed_group_sids": ["S-1-5-21-000-000-000-4100", ADMINS]}}),
                encoding="utf-8",
            )
        if check(packs, cards):
            print("selftest: 正しいパックが落ちた", check(packs, cards))
            return 2
        cases = {
            "メタデータ欠落": lambda: (packs / "legal" / "d0.md.metadata.json").unlink(),
            "SID が一覧にない": lambda: (packs / "legal" / "d1.md.metadata.json").write_text(
                json.dumps({"metadataAttributes": {"allowed_group_sids": ["S-1-5-21-000-000-000-9999"]}}), encoding="utf-8"
            ),
            "文字列形式の SID": lambda: (packs / "legal" / "d2.md.metadata.json").write_text(
                json.dumps({"metadataAttributes": {"allowed_group_sids": "S-1-1-0"}}), encoding="utf-8"
            ),
            "メールアドレス": lambda: (packs / "legal" / "d3.md").write_text("連絡先 a@example.com", encoding="utf-8"),
            "業種の欠落": lambda: __import__("shutil").rmtree(packs / "legal"),
        }
        for label, mutate in cases.items():
            mutate()
            if not check(packs, cards):
                print(f"selftest: {label} を検出できない")
                return 2
            # 次のケースのために作り直す
            for n in range(DOCS_PER_PACK):
                (packs / "legal").mkdir(exist_ok=True)
                (packs / "legal" / f"d{n}.md").write_text("架空の文書", encoding="utf-8")
                (packs / "legal" / f"d{n}.md.metadata.json").write_text(
                    json.dumps({"metadataAttributes": {"allowed_group_sids": ["S-1-5-21-000-000-000-4100", ADMINS]}}),
                    encoding="utf-8",
                )
    print("selftest: OK（5 種類の不備を検出）")
    return 0


def main() -> int:
    if "--selftest" in sys.argv:
        return selftest()
    problems = check(PACKS, CARDS)
    ids = industry_ids(CARDS)
    for problem in problems:
        print(problem)
    print(f"業種 {len(ids)} 件のパックを検査、問題 {len(problems)} 件")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
