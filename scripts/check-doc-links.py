#!/usr/bin/env python3
"""Markdown の相対リンク切れを検出する。

読者（人と AI）がドキュメントから辿れない参照を CI で落とすためのゲート。
検査対象は Markdown のリンク記法 `[text](path)` のうち、リポジトリ相対のもの。

対象外:
  - http:// https:// mailto: tel: data: と `#` 始まりのアンカー
  - `~/` 始まり（利用者のホーム配下。リポジトリの外）
  - 本文やコードブロック中に出てくる単なるパス文字列
    （読者がこれから作るファイルを指す場合があるため、リンク記法のみを見る）

使用方法:
    python3 scripts/check-doc-links.py            # リポジトリ全体
    python3 scripts/check-doc-links.py docs       # 範囲を限定
    python3 scripts/check-doc-links.py --selftest # 検出能力の自己確認

終了コード: 0 = リンク切れなし / 1 = リンク切れあり / 2 = 自己確認の失敗
"""
from __future__ import annotations

import os
import re
import sys
import tempfile

LINK = re.compile(r'\[[^\]]*\]\(([^)\s]+)\)')
SKIP_PREFIX = ('http://', 'https://', 'mailto:', 'tel:', 'data:', '#', '~')
SKIP_DIRS = {
    'node_modules', '.git', 'cdk.out', '.venv', '.next', 'dist',
    '.pytest_cache', '.hypothesis', '__pycache__',
}


def find_broken(roots: list[str]) -> tuple[int, list[tuple[str, int, str]]]:
    broken: list[tuple[str, int, str]] = []
    scanned = 0
    for root in roots:
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
            for filename in filenames:
                # llms.txt は AI 向けの入口で Markdown 記法のリンクを持つ。
                # 拡張子で外すと、この 1 ファイルだけ検査されずに腐る。
                if not filename.endswith('.md') and filename != 'llms.txt':
                    continue
                path = os.path.join(dirpath, filename)
                scanned += 1
                with open(path, encoding='utf-8', errors='replace') as handle:
                    for lineno, line in enumerate(handle, 1):
                        for target in LINK.findall(line):
                            if target.startswith(SKIP_PREFIX):
                                continue
                            bare = target.split('#')[0].split('?')[0]
                            if not bare:
                                continue
                            resolved = os.path.normpath(os.path.join(dirpath, bare))
                            if not os.path.exists(resolved):
                                broken.append((path, lineno, target))
    return scanned, broken


def selftest() -> int:
    """壊れたリンクを含む一時ファイルを作り、検出できることを確認する。

    「ゲートが通った」ことと「ゲートが機能している」ことは別物なので、
    検出できない場合はここで落とす。
    """
    with tempfile.TemporaryDirectory() as tmp:
        ok_target = os.path.join(tmp, 'exists.md')
        with open(ok_target, 'w', encoding='utf-8') as handle:
            handle.write('# exists\n')
        with open(os.path.join(tmp, 'index.md'), 'w', encoding='utf-8') as handle:
            handle.write(
                '[live](exists.md)\n'
                '[dead](no-such-file.md)\n'
                '[external](https://example.com/none.md)\n'
                '[anchor](#section)\n'
                '[home](~/.kiro/steering/x.md)\n'
            )
        _, broken = find_broken([tmp])
        targets = [t for _, _, t in broken]
        if targets != ['no-such-file.md']:
            print(f'❌ selftest: 期待 ["no-such-file.md"] に対して {targets}')
            return 2
    print('✅ selftest: リンク切れ 1 件を検出し、外部 URL・アンカー・~/ を除外した')
    return 0


def main() -> int:
    args = [a for a in sys.argv[1:] if a != '--selftest']
    if '--selftest' in sys.argv:
        return selftest()

    roots = args or ['.']
    scanned, broken = find_broken(roots)
    print(f'Markdown {scanned} ファイルを検査、リンク切れ {len(broken)} 件')
    for path, lineno, target in broken:
        print(f'{path}:{lineno}: {target}')
    if broken:
        print('\nリンク切れがあります。参照先を直すか、リンク記法を外してください。')
        print('リポジトリに含まれないもの（development/ や .kiro/ 配下など）は、')
        print('リンクにせず本文で「ローカル専用」と書いてください。')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
