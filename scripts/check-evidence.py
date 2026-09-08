#!/usr/bin/env python3
"""証跡ラベルの検査。

docs/evidence-policy.md の 4 区分（verified / documented / field-observation / hypothesis）が、
必須の付随情報を伴っているかを検査する。**ラベルは主張ごとの行内ラベル**で、
このリポジトリの doc は 1 ファイルに複数の主張が混在するため、ファイル単位の
frontmatter ではなくこの形を採る。

検査内容:
  - `[verified ...]` に日付（YYYY-MM-DD）とリージョンがあり、日付が未来でないこと
  - `[documented]` の同じ行か直後 2 行以内に URL または「出典 / Source」があること
  - `[field-observation]` の近く（同じ行か直後 2 行）に「再現未確認 / reproduction not confirmed」
  - `[hypothesis]` の近くに「未検証 / unverified」

ラベルを使っていないファイルは検査しない（段階的に採用できるようにするため）。
ただしラベルを使った箇所は必ず要件を満たす必要がある。

使用方法:
    python3 scripts/check-evidence.py
    python3 scripts/check-evidence.py docs
    python3 scripts/check-evidence.py --selftest

終了コード: 0 = 違反なし / 1 = 違反あり / 2 = 自己確認の失敗
"""
from __future__ import annotations

import datetime as dt
import os
import re
import sys
import tempfile

LABEL = re.compile(r'\[(verified|documented|field-observation|hypothesis)([^\]]*)\]')
DATE = re.compile(r'\b(\d{4})-(\d{2})(?:-(\d{2}))?\b')
REGION = re.compile(r'\b[a-z]{2}-[a-z]+-\d\b')
URL = re.compile(r'https?://')
SOURCE_WORDS = ('出典', 'Source', 'source')
FIELD_WORDS = (
    '再現未確認', '再現は未確認', 'reproduction not confirmed',
    '재현 미확인', '未确认可复现', '未確認可重現',
    'reproduction non confirmée', 'Reproduktion nicht bestätigt',
    'reproducción no confirmada',
)
HYPO_WORDS = (
    '未検証', 'unverified', 'Unverified',
    '미검증', '未验证', '未驗證',
    'non vérifié', 'nicht verifiziert', 'no verificado', 'no verificada',
)
SKIP_DIRS = {
    'node_modules', '.git', 'cdk.out', '.venv', '.next', 'dist',
    '.pytest_cache', '.hypothesis', '__pycache__',
}
# ポリシー自身は書き方の説明としてラベルを引用するため対象外
EXCLUDE_FILES = {
    os.path.normpath('docs/evidence-policy.md'),
    os.path.normpath('docs/en/evidence-policy.md'),
}


def check_text(path: str, lines: list[str], today: dt.date) -> list[str]:
    problems: list[str] = []
    for i, line in enumerate(lines):
        for match in LABEL.finditer(line):
            tier, rest = match.group(1), match.group(2)
            context = ' '.join(lines[i:i + 3])
            where = f'{path}:{i + 1}'
            if tier == 'verified':
                found = DATE.search(rest)
                if not found:
                    problems.append(f'{where}: verified に日付（YYYY-MM-DD か YYYY-MM）がありません')
                else:
                    try:
                        # 日を記録していない場合は月粒度を許す。記録より細かい精度を
                        # 書かせないため（存在しない再現性を示唆する）。
                        day = int(found.group(3)) if found.group(3) else 1
                        when = dt.date(int(found.group(1)), int(found.group(2)), day)
                        if when > today:
                            problems.append(f'{where}: verified の日付 {found.group(0)} が未来です')
                    except ValueError:
                        problems.append(f'{where}: verified の日付 {found.group(0)} が日付として読めません')
                if not REGION.search(rest):
                    problems.append(f'{where}: verified にリージョンがありません')
            elif tier == 'documented':
                if not URL.search(context) and not any(w in context for w in SOURCE_WORDS):
                    problems.append(f'{where}: documented に出典（URL か文書名）がありません')
            elif tier == 'field-observation':
                if not any(w in context for w in FIELD_WORDS):
                    problems.append(f'{where}: field-observation に「再現未確認」がありません')
            elif tier == 'hypothesis':
                if not any(w in context for w in HYPO_WORDS):
                    problems.append(f'{where}: hypothesis に「未検証」がありません')
    return problems




def check_legacy(paths: list[str]) -> list[str]:
    """旧表記（VERIFIED / UNVERIFIED）が残っていないかを検査する。

    **範囲を宣言して出力する。** 検出器はパターンと走査範囲の両方で沈黙するので、
    何を見たかを結果と一緒に示す。
    """
    pattern = re.compile(r'\bUNVERIFIED\b|✅\s*\*\*VERIFIED\*\*|⚠️\s*VERIFIED')
    problems: list[str] = []
    for path in paths:
        if not os.path.isfile(path) or os.path.normpath(path) in EXCLUDE_FILES:
            continue
        with open(path, encoding='utf-8', errors='replace') as handle:
            for n, line in enumerate(handle, 1):
                # 旧表記そのものを説明する行（規約の記述）は除外する。
                # 逃げ道を増やさないため、行ごとの明示のみを認める。
                if 'allow:legacy-marker' in line:
                    continue
                if pattern.search(line):
                    problems.append(f'{path}:{n}: 旧表記が残っています（4 語の行内ラベルに移行してください）')
    return problems


def legacy_paths() -> list[str]:
    """旧表記を検査する対象。移行済みの面だけを見る（宣言された範囲）。"""
    paths = ['AGENTS.md']
    for root in ('docs', 'benchmarks'):
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
            paths += [os.path.join(dirpath, f) for f in filenames if f.endswith('.md')]
    return paths


def walk(roots: list[str]) -> tuple[int, int, list[str]]:
    problems: list[str] = []
    scanned = labelled = 0
    today = dt.date.today()
    for root in roots:
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
            for filename in filenames:
                if not filename.endswith('.md'):
                    continue
                path = os.path.normpath(os.path.join(dirpath, filename))
                if path in EXCLUDE_FILES:
                    continue
                scanned += 1
                with open(path, encoding='utf-8', errors='replace') as handle:
                    lines = handle.read().splitlines()
                if not any(LABEL.search(line) for line in lines):
                    continue
                labelled += 1
                problems.extend(check_text(path, lines, today))
    return scanned, labelled, problems


def selftest() -> int:
    today = dt.date(2026, 9, 9)
    cases = {
        'verified に日付とリージョンがあれば通る':
            (['**[verified 2026-07-19 / ap-northeast-1]** 動作した。'], 0),
        'verified に日付が無ければ落ちる':
            (['**[verified / ap-northeast-1]** 動作した。'], 1),
        '日を記録していない月粒度 YYYY-MM は通る':
            (['**[verified 2026-07 / ap-northeast-1]** 動作した。'], 0),
        '月粒度でも未来なら落ちる':
            (['**[verified 2026-12 / ap-northeast-1]** 動作した。'], 1),
        'verified にリージョンが無ければ落ちる':
            (['**[verified 2026-07-19]** 動作した。'], 1),
        'verified の未来日付は落ちる':
            (['**[verified 2027-01-01 / ap-northeast-1]** 動作した。'], 1),
        'documented に URL があれば通る':
            (['**[documented]** そうなる。', '', 'https://docs.aws.amazon.com/x'], 0),
        'documented に出典が無ければ落ちる':
            (['**[documented]** そうなる。'], 1),
        'field-observation に再現未確認があれば通る':
            (['**[field-observation]** 落ちた。**再現未確認**。'], 0),
        'field-observation に再現未確認が無ければ落ちる':
            (['**[field-observation]** 落ちた。'], 1),
        'hypothesis に未検証があれば通る':
            (['**[hypothesis]** こうだと思う。**未検証**。'], 0),
        'hypothesis に未検証が無ければ落ちる':
            (['**[hypothesis]** こうだと思う。'], 1),
    }
    ok = True
    for label, (lines, expected) in cases.items():
        problems = check_text('t.md', lines, today)
        passed = len(problems) == expected
        ok = ok and passed
        print(f"{'✅' if passed else '❌'} selftest: {label}")
        if not passed:
            print(f'    期待 {expected} 件 / 実際 {len(problems)} 件: {problems}')

    # ラベルが無いファイルは検査対象外になること
    with tempfile.TemporaryDirectory() as tmp:
        with open(os.path.join(tmp, 'plain.md'), 'w', encoding='utf-8') as handle:
            handle.write('# 何のラベルも無い doc\n')
        scanned, labelled, problems = walk([tmp])
        passed = scanned == 1 and labelled == 0 and not problems
        ok = ok and passed
        print(f"{'✅' if passed else '❌'} selftest: ラベルの無いファイルは対象外")

    with tempfile.TemporaryDirectory() as tmp:
        legacy = os.path.join(tmp, 'legacy.md')
        with open(legacy, 'w', encoding='utf-8') as handle:
            handle.write('| R1 | x | ✅ **VERIFIED** | y |\n- ⚠️ UNVERIFIED: z\n')
        clean = os.path.join(tmp, 'clean.md')
        with open(clean, 'w', encoding='utf-8') as handle:
            handle.write('**[verified 2026-07 / ap-northeast-1]** 動作した。\n')
        allowed = os.path.join(tmp, 'allowed.md')
        with open(allowed, 'w', encoding='utf-8') as handle:
            handle.write('`UNVERIFIED` は使わない <!-- allow:legacy-marker -->\n')
        found = check_legacy([legacy, clean, allowed])
        passed = len(found) == 2
        ok = ok and passed
        print(f"{'✅' if passed else '❌'} selftest: 旧表記を検出し、"
              f"allow:legacy-marker の行は除外する")
        if not passed:
            print(f'    期待 2 件 / 実際 {len(found)} 件: {found}')
    return 0 if ok else 2


def main() -> int:
    if '--selftest' in sys.argv:
        return selftest()
    roots = [a for a in sys.argv[1:] if not a.startswith('--')] or ['.']
    scanned, labelled, problems = walk(roots)
    legacy_targets = legacy_paths()
    problems += check_legacy(legacy_targets)
    print(f'Markdown {scanned} ファイルを検査、証跡ラベルを持つのは {labelled} ファイル、'
          f'違反 {len(problems)} 件')
    print(f'旧表記の検査範囲: AGENTS.md と docs/ benchmarks/ 配下の '
          f'{len(legacy_targets)} ファイル')
    for p in problems:
        print(p)
    if problems:
        print('\n書き方は docs/evidence-policy.md を参照してください。')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
