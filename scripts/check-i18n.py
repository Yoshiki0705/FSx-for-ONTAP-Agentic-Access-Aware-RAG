#!/usr/bin/env python3
"""翻訳の抄訳開示を検査する。

docs/i18n-policy.md の方針を機械で見る部分。**節の数**を原文（日本語）と比べ、
差があるのに開示バナーが無いもの、差が無いのにバナーが残っているものを検出する。

検出できないこと: 章の中身が薄くなっている場合。節を落としたかどうかだけを見る。
この限界と走査範囲は実行時に出力する。**検出器は範囲とパターンの両方で沈黙する。**

使用方法:
    python3 scripts/check-i18n.py
    python3 scripts/check-i18n.py --report
    python3 scripts/check-i18n.py --selftest

終了コード: 0 = 違反なし / 1 = 違反あり / 2 = 自己確認の失敗
"""
from __future__ import annotations

import os
import re
import sys
import tempfile

LANGS = ['en', 'ko', 'zh-CN', 'zh-TW', 'fr', 'de', 'es']
MARKER = '<!-- i18n:abridged -->'
# 読者向けの表示。言語ごとに文言は違うが、この語のどれかを含むこと。
DISCLOSURE_WORDS = (
    '抄訳', 'Abridged', 'abridged', '부분 번역', '节译', '節譯',
    'Traduction partielle', 'Gekürzte', 'Traducción parcial',
)
HEADING = re.compile(r'^#{2,6}\s')
FENCE = re.compile(r'^\s*(```|~~~)')
# 日本語版にしか存在しない種類のファイル（翻訳の対象外）
JA_ONLY_PREFIX = ('articles/', 'verification-logs/')
JA_ONLY_FILES = {'deployment-guide.ja.md', 'cross-repo-links-snippet.md'}


def count_sections(path: str) -> int:
    """コードフェンスの内側を除いて `##` 以下の見出しを数える。

    フェンスを除外しないとシェルのコメント行を見出しと誤認する。
    """
    inside = False
    total = 0
    with open(path, encoding='utf-8', errors='replace') as handle:
        for line in handle:
            if FENCE.match(line):
                inside = not inside
                continue
            if not inside and HEADING.match(line):
                total += 1
    return total


def read(path: str) -> str:
    with open(path, encoding='utf-8', errors='replace') as handle:
        return handle.read()


def strip_fences(text: str) -> str:
    """コードフェンスの内側を落とす。

    バナーの書き方を説明する doc は、フェンスの中にマーカーを例示する。
    除外しないと、方針を説明した doc 自身が違反として挙がる。
    """
    kept: list[str] = []
    inside = False
    for line in text.splitlines():
        if FENCE.match(line):
            inside = not inside
            continue
        if not inside:
            kept.append(line)
    # インラインコード（`...`）も落とす。方針 doc は本文中で
    # `<!-- i18n:abridged -->` を引用するため、残すと自身が違反になる。
    return re.sub(r'`[^`]*`', '', '\n'.join(kept))


def check_pair(source: str, translation: str) -> list[str]:
    """原文と翻訳の 1 組を検査する。"""
    problems: list[str] = []
    src_sections = count_sections(source)
    body = strip_fences(read(translation))
    has_marker = MARKER in body
    # マーカー自身が 'abridged' を含むため、表示の検査から必ず除く。
    # 除かないとマーカーだけで開示済みと誤判定する（selftest が捕まえた欠陥）。
    has_prose = any(word in body.replace(MARKER, '') for word in DISCLOSURE_WORDS)
    tr_sections = count_sections(translation)
    # マーカー行自体は見出しではないので数に影響しない
    if src_sections != tr_sections:
        if not has_marker:
            problems.append(
                f'{translation}: 節の数が原文と違う（原文 {src_sections} / 翻訳 '
                f'{tr_sections}）のに {MARKER} がありません')
        elif not has_prose:
            problems.append(
                f'{translation}: {MARKER} はありますが、読者向けの抄訳の表示がありません')
    else:
        if has_marker:
            problems.append(
                f'{translation}: 節の数が原文と一致しています（{src_sections}）。'
                f'{MARKER} と抄訳の表示を外してください')
    return problems


def ja_documents(root: str = 'docs') -> list[str]:
    """原文（日本語）の doc を集める。docs/<lang>/ 配下は除く。"""
    found: list[str] = []
    for dirpath, dirnames, filenames in os.walk(root):
        rel_dir = os.path.relpath(dirpath, root)
        head = rel_dir.split(os.sep)[0]
        if head in LANGS:
            dirnames[:] = []
            continue
        for filename in filenames:
            if not filename.endswith('.md'):
                continue
            rel = os.path.normpath(os.path.join(rel_dir, filename)) if rel_dir != '.' else filename
            if rel in JA_ONLY_FILES or rel.startswith(JA_ONLY_PREFIX):
                continue
            found.append(rel)
    return sorted(found)


def walk(root: str = 'docs') -> tuple[int, list[str]]:
    problems: list[str] = []
    pairs = 0
    for rel in ja_documents(root):
        source = os.path.join(root, rel)
        for lang in LANGS:
            translation = os.path.join(root, lang, rel)
            if not os.path.exists(translation):
                continue  # 未翻訳は範囲外（ティア 3）
            pairs += 1
            problems.extend(check_pair(source, translation))
    return pairs, problems


def report(root: str = 'docs') -> int:
    docs = ja_documents(root)
    print(f'原文（日本語）{len(docs)} ファイル')
    print(f'{"lang":6} {"翻訳あり":>8} {"構成一致":>8} {"抄訳（開示済み）":>16} {"未翻訳":>7}')
    for lang in LANGS:
        have = match = abridged = 0
        for rel in docs:
            translation = os.path.join(root, lang, rel)
            if not os.path.exists(translation):
                continue
            have += 1
            if count_sections(os.path.join(root, rel)) == count_sections(translation):
                match += 1
            elif MARKER in strip_fences(read(translation)):
                abridged += 1
        print(f'{lang:6} {have:8} {match:8} {abridged:16} {len(docs) - have:7}')
    return 0


def selftest() -> int:
    ok = True
    cases = {
        '節の数が一致していれば通る': (['## A', '## B'], ['## A', '## B'], 0),
        '節が落ちているのにバナーが無ければ落ちる': (['## A', '## B'], ['## A'], 1),
        '節が落ちていてバナーがあれば通る':
            (['## A', '## B'], [MARKER, '> **⚠️ 抄訳**: 一部です', '## A'], 0),
        'マーカーだけで表示が無ければ落ちる': (['## A', '## B'], [MARKER, '## A'], 1),
        '一致しているのにバナーが残っていれば落ちる':
            (['## A'], [MARKER, '> **⚠️ 抄訳**: 一部です', '## A'], 1),
        'コードフェンス内の # は見出しに数えない':
            (['## A', '```', '## これはコメント', '```'], ['## A'], 0),
        'フェンス内で例示されたマーカーは開示と見なさない':
            (['## A', '## B'], ['## A', '```', MARKER, '```'], 1),
        'インラインコード内のマーカー言及は開示と見なさない':
            (['## A', '## B'], ['## A', f'本文で `{MARKER}` に触れるだけ'], 1),
    }
    with tempfile.TemporaryDirectory() as tmp:
        for label, (src, tr, expected) in cases.items():
            s = os.path.join(tmp, 'src.md')
            t = os.path.join(tmp, 'tr.md')
            for path, lines in ((s, src), (t, tr)):
                with open(path, 'w', encoding='utf-8') as handle:
                    handle.write('\n'.join(lines) + '\n')
            problems = check_pair(s, t)
            passed = len(problems) == expected
            ok = ok and passed
            print(f"{'✅' if passed else '❌'} selftest: {label}")
            if not passed:
                print(f'    期待 {expected} 件 / 実際 {len(problems)} 件: {problems}')

    # 未翻訳が違反にならないこと
    with tempfile.TemporaryDirectory() as tmp:
        os.makedirs(os.path.join(tmp, 'en'))
        with open(os.path.join(tmp, 'only-ja.md'), 'w', encoding='utf-8') as handle:
            handle.write('## A\n## B\n')
        pairs, problems = walk(tmp)
        passed = pairs == 0 and not problems
        ok = ok and passed
        print(f"{'✅' if passed else '❌'} selftest: 未翻訳は違反にしない")
    return 0 if ok else 2


def main() -> int:
    if '--selftest' in sys.argv:
        return selftest()
    if '--report' in sys.argv:
        return report()
    pairs, problems = walk()
    print(f'原文と翻訳の組 {pairs} 件を検査、違反 {len(problems)} 件')
    print('見ているのは節（`##` 以下の見出し）の数だけです。'
          '章の中身が薄くなっている場合は検出しません。')
    for problem in problems:
        print(problem)
    if problems:
        print('\n書き方は docs/i18n-policy.md を参照してください。')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
