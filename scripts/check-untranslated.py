#!/usr/bin/env python3
"""英語版に残った未翻訳の原文（日本語）を検出する。

`docs/i18n-policy.md` のティア 2（English = 対訳）に対する検査。節の数を見る
`check-i18n.py` では、**見出しごと日本語のまま置かれた doc** を検出できない
（節の数は一致するため）。実際に 2 ファイルがその状態で通過していた。

意図的に日本語を含む箇所（i18n キーの対応表、言語名の一覧、日本語の入力例、
分類器が照合する日本語キーワード）は領域マーカーで除外する。

    <!-- allow:source-language:start -->
    | `signin.adSignIn` | ADでサインイン | Sign in with AD |
    <!-- allow:source-language:end -->

行ごとの除外ではなく領域にしたのは、表の行の中に HTML コメントを置くと
読者に見えてしまうため。

対象は `docs/en/` のみ。ティア 3（ko / zh-CN / zh-TW / fr / de / es）は部分訳が
方針なので、この検査の範囲外であることを実行時に出力する。

使用方法:
    python3 scripts/check-untranslated.py
    python3 scripts/check-untranslated.py --selftest

終了コード: 0 = 違反なし / 1 = 違反あり / 2 = 自己確認の失敗
"""
from __future__ import annotations

import os
import re
import sys
import tempfile

# Latin 系の言語には漢字もかなも現れない
CJK = re.compile(r'[\u3041-\u3096\u30a1-\u30fa\u4e00-\u9fff]')
# ko / zh には漢字が正当に現れるため、日本語固有のかなだけを見る。
# 記号（・ ー）はかな範囲にあるが翻訳文にも出るので除く。
KANA = re.compile(r'[\u3041-\u3096\u30a1-\u30fa]')
FENCE = re.compile(r'^\s*(```|~~~)')
ALLOW_START = 'allow:source-language:start'
ALLOW_END = 'allow:source-language:end'
LINK_TEXT = re.compile(r'\[[^\]]*\]\([^)]*\)')
# 検査対象と、その言語で「原文が残っている」と判定するパターン。
#
# ティア 3 も 2026-09 に未翻訳を解消したので対象に含める。範囲を広げないと
# 同じ状態（見出しだけ訳された原文のコピー）が再び入っても検出できない。
TARGETS = {
    'docs/en': CJK,
    'docs/fr': CJK,
    'docs/de': CJK,
    'docs/es': CJK,
    'docs/ko': KANA,
    'docs/zh-CN': KANA,
    'docs/zh-TW': KANA,
}


def check_file(path: str, lines: list[str], pattern: re.Pattern = CJK) -> list[str]:
    problems: list[str] = []
    in_fence = False
    in_allow = False
    for n, line in enumerate(lines, 1):
        if FENCE.match(line):
            in_fence = not in_fence
            continue
        if ALLOW_START in line:
            in_allow = True
            continue
        if ALLOW_END in line:
            in_allow = False
            continue
        if in_fence or in_allow:
            continue
        # 言語スイッチャは他言語名を含む
        if '🌐' in line:
            continue
        # リンクの表示名（[日本語](...) など）は除いて判定する
        if pattern.search(LINK_TEXT.sub('', line)):
            problems.append(f'{path}:{n}: 未翻訳の原文が残っています: {line.strip()[:80]}')
    # 閉じ忘れた許可領域は、以降のすべてを検査対象から外す。
    # 検出器が沈黙する形なので、それ自体を違反として扱う。
    if in_allow:
        problems.append(f'{path}: 許可領域が閉じられていません（{ALLOW_END} がない）')
    return problems


def walk(root: str, pattern: re.Pattern = CJK) -> tuple[int, list[str]]:
    problems: list[str] = []
    scanned = 0
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not d.startswith('.')]
        for filename in sorted(filenames):
            if not filename.endswith('.md'):
                continue
            path = os.path.join(dirpath, filename)
            scanned += 1
            with open(path, encoding='utf-8', errors='replace') as handle:
                problems.extend(check_file(path, handle.read().splitlines(), pattern))
    return scanned, problems


def selftest() -> int:
    ok = True
    cases = {
        '英語だけなら通る': (['# Title', 'This is English.'], 0),
        '日本語の地の文は落ちる': (['# Title', 'これは日本語です。'], 1),
        'コードフェンス内の日本語は対象外': (['```', '# 日本語のコメント', '```'], 0),
        'リンクの表示名は対象外': (['See [日本語版](../x.md) for details.'], 0),
        '許可領域の中は対象外':
            ([f'<!-- {ALLOW_START} -->', '| key | ADでサインイン | Sign in |',
              f'<!-- {ALLOW_END} -->'], 0),
        '許可領域を閉じた後は再び対象':
            ([f'<!-- {ALLOW_START} -->', '| key | ADでサインイン |',
              f'<!-- {ALLOW_END} -->', 'これは残った未翻訳です。'], 1),
        '言語スイッチャの行は対象外': (['**🌐 Language:** 日本語 | English'], 0),
        '閉じ忘れた許可領域は違反':
            ([f'<!-- {ALLOW_START} -->', '| key | ADでサインイン |'], 1),
    }
    for label, (lines, expected) in cases.items():
        problems = check_file('t.md', lines)
        passed = len(problems) == expected
        ok = ok and passed
        print(f"{'✅' if passed else '❌'} selftest: {label}")
        if not passed:
            print(f'    期待 {expected} 件 / 実際 {len(problems)} 件: {problems}')

    with tempfile.TemporaryDirectory() as tmp:
        with open(os.path.join(tmp, 'a.md'), 'w', encoding='utf-8') as handle:
            handle.write('# Title\nこれは未翻訳です。\n')
        scanned, problems = walk(tmp, CJK)
        passed = scanned == 1 and len(problems) == 1
        ok = ok and passed
        print(f"{'✅' if passed else '❌'} selftest: ディレクトリ走査が違反を返す")
    return 0 if ok else 2


def main() -> int:
    if '--selftest' in sys.argv:
        return selftest()
    scanned = 0
    problems: list[str] = []
    for target, pattern in TARGETS.items():
        count, found = walk(target, pattern)
        scanned += count
        problems.extend(found)
    print(f'{len(TARGETS)} 言語の Markdown {scanned} ファイルを検査、違反 {len(problems)} 件')
    print('ko / zh は漢字が正当に現れるため、日本語固有のかなだけを見ています。'
          'Latin 系（en / fr / de / es）は漢字とかなの両方を見ます。')
    for problem in problems:
        print(problem)
    if problems:
        print('\n意図的に原文を残す箇所は '
              f'<!-- {ALLOW_START} --> と <!-- {ALLOW_END} --> で囲んでください。')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
