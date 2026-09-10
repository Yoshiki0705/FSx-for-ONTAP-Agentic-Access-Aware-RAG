#!/usr/bin/env python3
"""ワークフローが参照するリポジトリ内パスの存在を検査する。

**リポジトリに無いスクリプトを呼ぶワークフローは、走っているように見えて
何も検査しない。** 実例（2026-09 に整理）:

- `.github/actions/run-tests` と `.github/actions/quality-gate` は
  `development/` 配下（gitignore）のスクリプトを呼ぶ composite action で、
  どのワークフローからも参照されていなかった
- `document-auto-update.yml` は 2 つのステップとも "not found, skipping" を
  出して success を返し、毎 push で「ドキュメント品質ゲート成功」に見えていた
- `ci-cd.yml` / `pr-check.yml` / `ci-cd-with-slack.yml` は同じ欠落スクリプトの
  fallback で本物のテストを走らせており、同じ 763 件が三重に実行されていた

検出方針: `run:` などに現れるリポジトリ相対パスらしい文字列を拾い、存在を確認する。
`${{ ... }}` を含むもの、glob、コメント行は対象外。意図的に「無いこと」を扱う
参照（存在確認の分岐など）は行末に `allow:missing-path` を付ける。

使用方法:
    python3 scripts/check-workflow-paths.py
    python3 scripts/check-workflow-paths.py --selftest

終了コード: 0 = 違反なし / 1 = 違反あり / 2 = 自己確認の失敗
"""
from __future__ import annotations

import glob
import os
import re
import sys
import tempfile

# 追跡対象のトップレベルディレクトリ。ここから始まる文字列をパスとみなす。
ROOTS = (
    'development', 'scripts', 'demo-data', 'automation', 'lambda', 'lib', 'bin',
    'tests', 'docker', 'benchmarks', 'docs', '.github',
)
PATH = re.compile(r'(?<![\w./-])((?:' + '|'.join(re.escape(r) for r in ROOTS) + r')/[\w./-]+)')
ALLOW = 'allow:missing-path'


def check_text(path: str, lines: list[str]) -> list[str]:
    problems: list[str] = []
    for n, line in enumerate(lines, 1):
        stripped = line.strip()
        # コメント行は対象外。実行されないため、参照の腐りは害を持たない。
        if stripped.startswith('#'):
            continue
        if ALLOW in line:
            continue
        for match in PATH.finditer(line):
            target = match.group(1).rstrip('.,;:"\'`)')
            # 式で組み立てる部分と glob は解決できないので見ない
            if '${{' in line[max(0, match.start() - 40):match.end()]:
                continue
            if '*' in target:
                continue
            if os.path.exists(target):
                continue
            problems.append(f'{path}:{n}: 参照先が存在しません: {target}')
    return problems


def workflow_files() -> list[str]:
    return sorted(glob.glob('.github/workflows/*.yml')
                  + glob.glob('.github/workflows/*.yaml')
                  + glob.glob('.github/actions/*/action.yml'))


def walk(files: list[str] | None = None) -> tuple[int, list[str]]:
    files = files if files is not None else workflow_files()
    problems: list[str] = []
    for path in files:
        with open(path, encoding='utf-8', errors='replace') as handle:
            problems.extend(check_text(path, handle.read().splitlines()))
    return len(files), problems


def selftest() -> int:
    ok = True
    cases = {
        '存在するパスは通る': (['        run: python3 scripts/check-doc-links.py'], 0),
        '存在しないパスは落ちる': (['        run: bash development/scripts/testing/x.sh'], 1),
        'コメント行は対象外': (['        # python3 development/scripts/notifications/x.py'], 0),
        '式を含む行は対象外': (['        run: pytest ${{ matrix.dir }}/tests/nope.py'], 0),
        'glob は対象外': (['        run: zizmor .github/workflows/*.yml'], 0),
        'allow:missing-path を付けた行は対象外':
            (['        run: test -f development/x.sh  # allow:missing-path'], 0),
    }
    for label, (lines, expected) in cases.items():
        problems = check_text('wf.yml', lines)
        passed = len(problems) == expected
        ok = ok and passed
        print(f"{'✅' if passed else '❌'} selftest: {label}")
        if not passed:
            print(f'    期待 {expected} 件 / 実際 {len(problems)} 件: {problems}')

    with tempfile.TemporaryDirectory() as tmp:
        wf = os.path.join(tmp, 'w.yml')
        with open(wf, 'w', encoding='utf-8') as handle:
            handle.write('        run: bash scripts/does-not-exist.sh\n')
        count, problems = walk([wf])
        passed = count == 1 and len(problems) == 1
        ok = ok and passed
        print(f"{'✅' if passed else '❌'} selftest: ファイル走査が違反を返す")
    return 0 if ok else 2


def main() -> int:
    if '--selftest' in sys.argv:
        return selftest()
    count, problems = walk()
    print(f'ワークフローと composite action {count} ファイルを検査、違反 {len(problems)} 件')
    print('コメント行・${{ }} を含む行・glob は対象外です。')
    for problem in problems:
        print(problem)
    if problems:
        print('\n存在しないスクリプトを呼ぶステップは、走っているように見えて何も'
              '検査しません。参照を直すか、ステップを削除してください。'
              f'意図的に不在を扱う行には {ALLOW} を付けます。')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
