#!/usr/bin/env python3
"""依存関係の脆弱性ゲート。

方針:
  - **critical / high があれば落とす。** ただし許容リストに載っているものは除く
  - moderate / low は報告のみ（落とさない）
  - 許容リストの各エントリには理由と再確認期限（`review_by`）が必須。
    **期限を過ぎたエントリは許容されず、落とす。** 放置で恒久的な例外にならないようにする
  - エントリは 2 通り。
    - `advisory`（GHSA の ID）: その脆弱性だけを許容する。`npm audit` は脆弱な
      パッケージに依存する側（jest など）も 1 件ずつ数えるので、各指摘の `via` を
      たどって元の脆弱性を求め、**届く critical / high の脆弱性がすべて許容されている
      ときだけ**通す。同じパッケージに後から別の脆弱性が出れば、それは落ちる。
      `workspace` を書けばその workspace に限る
    - `workspace` + `package`: そのパッケージの指摘をまとめて許容する（以前からの形）。
      後から出た別の脆弱性も隠すので、修正の無い脆弱性には `advisory` を使う

以前のゲートは「脆弱性 1 件あたり −20 点、80 点未満で失敗」という算術だったため、
上流に修正が存在しない推移的依存が 1 つでもあると恒久的に赤で、赤であること自体が
情報を持たない状態になっていた。件数ではなく重大度と対応可能性で判定する。

検査対象は lockfile を持つ workspace（`npm audit` は lockfile だけで動くので、
CI では `npm ci` を必要としない）。

使用方法:
    python3 scripts/check-dependency-audit.py
    python3 scripts/check-dependency-audit.py --selftest

終了コード: 0 = 許容外の critical/high なし / 1 = あり / 2 = 自己確認の失敗
"""
from __future__ import annotations

import datetime as dt
import json
import os
import subprocess
import sys

WORKSPACES = ['.', 'docker/nextjs', 'lambda/agent-core-ad-sync']
ALLOWLIST_PATH = '.security/dependency-audit-allowlist.json'
BLOCKING = ('critical', 'high')


def run_audit(workspace: str) -> dict:
    if not os.path.exists(os.path.join(workspace, 'package-lock.json')):
        return {}
    proc = subprocess.run(
        ['npm', 'audit', '--json'],
        cwd=workspace, capture_output=True, text=True,
    )
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError:
        print(f'❌ {workspace}: npm audit の出力を解釈できませんでした')
        print(proc.stdout[:400])
        print(proc.stderr[:400])
        return {'__error__': True}


def load_allowlist(path: str = ALLOWLIST_PATH) -> list[dict]:
    if not os.path.exists(path):
        return []
    with open(path, encoding='utf-8') as handle:
        return json.load(handle).get('allowed', [])


def _entries_for(f: dict, allowlist: list[dict]) -> list[dict] | None:
    """f を許容するエントリの一覧。許容できないなら None。"""
    package_entry = next(
        (a for a in allowlist
         if 'package' in a and a.get('workspace') == f['workspace'] and a['package'] == f['package']),
        None,
    )
    if package_entry is not None:
        return [package_entry]
    advisories = sorted({a['id'] for a in f.get('advisories', []) if a['severity'] in BLOCKING})
    if not advisories:
        return None
    entries = []
    for adv in advisories:
        entry = next(
            (a for a in allowlist
             if a.get('advisory') == adv and a.get('workspace', f['workspace']) == f['workspace']),
            None,
        )
        if entry is None:
            return None
        entries.append(entry)
    return entries


def evaluate(findings: list[dict], allowlist: list[dict], today: dt.date) -> tuple[list, list, list]:
    """(落とすもの, 許容したもの, 期限切れ) を返す。"""
    blocked, allowed, expired = [], [], []
    for f in findings:
        if f['severity'] not in BLOCKING:
            continue
        entries = _entries_for(f, allowlist)
        if entries is None:
            blocked.append(f)
            continue
        try:
            dates = [dt.date.fromisoformat(e['review_by']) for e in entries]
        except (KeyError, ValueError):
            blocked.append({**f, 'note': 'review_by が無い、または日付として読めない'})
            continue
        first = min(dates).isoformat()
        if min(dates) < today:
            expired.append({**f, 'review_by': first})
        else:
            reason = ' / '.join(f"{e.get('advisory', e.get('package'))}: {e.get('reason', '')}" for e in entries)
            allowed.append({**f, 'review_by': first, 'reason': reason})
    return blocked, allowed, expired


def advisories_of(name: str, vulns: dict, seen: frozenset = frozenset()) -> list[dict]:
    """`via` をたどって、name が届く元の脆弱性（GHSA の ID と重大度）を返す。"""
    out: list[dict] = []
    for via in vulns.get(name, {}).get('via', []):
        if isinstance(via, dict):
            url = via.get('url', '')
            out.append({'id': url.rstrip('/').rsplit('/', 1)[-1] or str(via.get('source')),
                        'severity': via.get('severity', 'unknown')})
        elif isinstance(via, str) and via not in seen:
            out.extend(advisories_of(via, vulns, seen | {name}))
    unique = {a['id']: a for a in out}
    return list(unique.values())


def collect(workspaces: list[str]) -> tuple[list[dict], dict[str, dict], bool]:
    findings: list[dict] = []
    totals: dict[str, dict] = {}
    error = False
    for ws in workspaces:
        data = run_audit(ws)
        if data.get('__error__'):
            error = True
            continue
        if not data:
            continue
        totals[ws] = data.get('metadata', {}).get('vulnerabilities', {})
        vulns = data.get('vulnerabilities', {})
        for name, vuln in vulns.items():
            fix = vuln.get('fixAvailable')
            if fix is False:
                fix_state = 'なし'
            elif fix is True:
                fix_state = 'あり'
            else:
                fix_state = f"major: {fix.get('name')}@{fix.get('version')}"
            findings.append({
                'workspace': ws,
                'package': name,
                'severity': vuln.get('severity', 'unknown'),
                'fix': fix_state,
                'advisories': advisories_of(name, vulns),
            })
    return findings, totals, error


def selftest() -> int:
    """判定ロジックを固定データで確認する。"""
    today = dt.date(2026, 9, 8)
    findings = [
        {'workspace': '.', 'package': 'unlisted-high', 'severity': 'high', 'fix': 'あり'},
        {'workspace': '.', 'package': 'listed-high', 'severity': 'high', 'fix': 'なし'},
        {'workspace': '.', 'package': 'stale-high', 'severity': 'high', 'fix': 'なし'},
        {'workspace': '.', 'package': 'noisy-moderate', 'severity': 'moderate', 'fix': 'あり'},
    ]
    allowlist = [
        {'workspace': '.', 'package': 'listed-high', 'review_by': '2027-01-01', 'reason': 'x'},
        {'workspace': '.', 'package': 'stale-high', 'review_by': '2026-01-01', 'reason': 'x'},
    ]
    blocked, allowed, expired = evaluate(findings, allowlist, today)
    # 脆弱性の ID での許容。依存する側（jest）は via をたどって元（picomatch）に届く。
    vulns = {
        'picomatch': {'via': [{'url': 'https://github.com/advisories/GHSA-aaaa', 'severity': 'high'}]},
        'anymatch': {'via': ['picomatch']},
        'jest': {'via': ['anymatch', 'jest']},  # 循環してもたどり終える
        'tool': {'via': ['picomatch', {'url': 'https://github.com/advisories/GHSA-bbbb', 'severity': 'high'}]},
        'lint': {'via': ['picomatch', {'url': 'https://github.com/advisories/GHSA-cccc', 'severity': 'moderate'}]},
    }
    adv_findings = [
        {'workspace': ws, 'package': n, 'severity': 'high', 'fix': 'なし', 'advisories': advisories_of(n, vulns)}
        for ws, n in [('.', 'jest'), ('.', 'tool'), ('.', 'lint'), ('docker/nextjs', 'anymatch')]
    ]
    adv_allow = [{'advisory': 'GHSA-aaaa', 'workspace': '.', 'review_by': '2027-01-01', 'reason': 'x'}]
    a_blocked, a_allowed, _ = evaluate(adv_findings, adv_allow, today)
    _, _, a_expired = evaluate(adv_findings[:1], [{'advisory': 'GHSA-aaaa', 'review_by': '2026-01-01', 'reason': 'x'}], today)
    checks = {
        '許容リスト外の high を落とす': [f['package'] for f in blocked] == ['unlisted-high'],
        '期限内の許容エントリは通す': [f['package'] for f in allowed] == ['listed-high'],
        '期限切れの許容エントリを落とす': [f['package'] for f in expired] == ['stale-high'],
        'moderate は落とさない': all(f['severity'] != 'moderate' for f in blocked + expired),
        '脆弱性の ID で許容すると、via でそこに届く依存側も通す': {f['package'] for f in a_allowed} == {'jest', 'lint'},
        '許容していない high の脆弱性にも届くものは落とす': 'tool' in {f['package'] for f in a_blocked},
        'workspace を限った ID の許容は他の workspace に効かない': 'anymatch' in {f['package'] for f in a_blocked},
        '脆弱性の ID の許容も期限切れなら落とす': [f['package'] for f in a_expired] == ['jest'],
    }
    for label, ok in checks.items():
        print(f"{'✅' if ok else '❌'} selftest: {label}")
    return 0 if all(checks.values()) else 2


def main() -> int:
    if '--selftest' in sys.argv:
        return selftest()

    findings, totals, error = collect(WORKSPACES)
    allowlist = load_allowlist()
    blocked, allowed, expired = evaluate(findings, allowlist, dt.date.today())

    print('## 依存関係の脆弱性')
    for ws, counts in totals.items():
        print(f"  {ws}: " + ' / '.join(
            f'{k} {counts.get(k, 0)}' for k in ('critical', 'high', 'moderate', 'low')))

    if allowed:
        print('\n### 許容中（期限つき）')
        for f in allowed:
            print(f"  {f['severity']:8} {f['workspace']}: {f['package']} "
                  f"(fix={f['fix']}, 再確認 {f['review_by']})")
        # 1 つの脆弱性が依存側の数十件に出るので、理由はエントリごとに 1 回だけ出す。
        print('  理由:')
        for reason in dict.fromkeys(f['reason'] for f in allowed):
            print(f'    - {reason}')

    moderates = [f for f in findings if f['severity'] not in BLOCKING]
    if moderates:
        print('\n### 報告のみ（moderate / low、ゲートでは落とさない）')
        for f in moderates:
            print(f"  {f['severity']:8} {f['workspace']}: {f['package']} (fix={f['fix']})")

    if expired:
        print('\n### 許容期限切れ')
        for f in expired:
            print(f"  {f['severity']:8} {f['workspace']}: {f['package']} "
                  f"(期限 {f['review_by']}) — 再評価して期限を更新するか、修正してください")

    if blocked:
        print('\n### 許容されていない critical / high')
        for f in blocked:
            note = f" — {f['note']}" if 'note' in f else ''
            print(f"  {f['severity']:8} {f['workspace']}: {f['package']} (fix={f['fix']}){note}")
        print(f'\n{ALLOWLIST_PATH} に理由と再確認期限を書いて許容するか、修正してください。')

    if error:
        print('\n❌ npm audit の実行に失敗した workspace があります')
        return 1
    if blocked or expired:
        return 1
    print('\n✅ 許容外の critical / high はありません')
    return 0


if __name__ == '__main__':
    sys.exit(main())
