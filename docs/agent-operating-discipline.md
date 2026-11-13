# エージェント運用規律 — このリポジトリ固有の接続

このドキュメントは、長時間自律運用の規律を**このリポジトリに接続する**ためのものです。規律の本体（判断記録を残す、監査役を疑う方向で呼ぶ、ばらつきを測ってから効果を主張する、確認を核心に絞って並行作業を止めない）はグローバル steering（`ai-agent-workflow` の Parallel-by-default 節・Auditor Sub-Agent 節、`benchmark-and-evidence-standards`）が定義し、全セッションに効きます。**ここでは本体を複製せず、このリポジトリ固有の接続だけを書きます**（二重管理を避けるため）。

---

## 1. 判断記録の置き場所

多段タスク（新パターン追加 / 検証ラン / IaC 変更）では、タスクごとの判断記録に `## Decisions` / `## Rejected alternatives` / `## Assumptions` の3節を、実装の記述とは別に残します。

| 項目 | このリポジトリでの約束 |
|------|----------------------|
| 置き場所 | `.private/tasks/<task>/impl-note.md`（gitignored）。`.private/notes/<task>-<date>/evidence-record.md` の既存慣習と同系統 |
| 3節の収め方 | 別ファイルに切り出さず、そのタスクの1つの記録に収める |
| 既存ファイルがあるとき | 新名を増やさず、既存の記録（evidence-record.md 等）に3節を追記する |
| git 追跡 | しない。却下案・未検証前提は process metadata なので非公開側に置く |

検証を伴うなら、`Decisions` の根拠欄に evidence tier を対応づけます。

## 2. evidence tier の語彙

このリポジトリは独自の4語を既に持ち、`scripts/check-evidence.py` がゲートしています。**新しい5つ目の語を作らず、この4語に揃えます。** 定義と書き方は [証跡の区分ポリシー](evidence-policy.md) にあり、ここでは複製しません。

- `verified` — 記載の環境で再現した（日付 + リージョン必須、開発環境は `local`）
- `documented` — 公式ドキュメントまたは実測を持つ別プロジェクトの記録に記載がある（出典必須）
- `field-observation` — 一度観測したが再現未確認（「再現未確認」の明記）
- `hypothesis` — 論理的な推論で未検証（「未検証」の明記）

判断記録の `Decisions` では、根拠を「測定 / 文献 / 推測」で書いたうえで、公開物に出る主張には上の tier を対応づけます（測定→`verified`、文献→`documented`、推測→`hypothesis`）。

## 3. 監査役を呼ぶ合図

同一アプローチが2回失敗した / 同じファイルを3回以上編集し直している / 多段タスクで同じエラーが再発している、のいずれかに気づいたら、続ける前に `semantic_reviewer`（判断の見直し）か `context-gatherer`（前提が実装と合うかの確認）を呼び、判断記録と変更差分を渡します。**疑う方向で**: 根拠が推測のものはどれか、却下案で今なら復活すべきものはあるか、外れたら作業が無駄になる未検証の前提はどれか。

新設はしません。このリポジトリの監査相当は次に乗せます。

- 設計判断 → [Architecture Decision Records](architecture-decision-records.md) に1エントリ
- 検証の証跡 → `.private/notes/<task>-<date>/evidence-record.md`

公開物コミット直前のレビューは persona review board の担当で、監査役とは分けます。

## 4. ばらつきを測ってから効果を主張する

性能・スループット・レイテンシ・コストの数値で変更の効果を主張する前に、変更していない構成のランごとのばらつきを先に測ります。差がばらつきの範囲内ならノイズです。1回ずつしか測っていない「A は B より速い」も同じ扱いです。

- ランの区別は既存の `run2` 接尾辞に揃えます（例: `.private/notes/erag-evidence-2026-10-29-run2`）。
- `benchmarks/` の数値は `results/baseline-estimates.md`（理論推定）と実測を混同しません。`verified` の数値には測定条件（日付・リージョン・構成・測定方法・実行回数）を併記します（[evidence-policy.md](evidence-policy.md) の「数値を書くときの条件」）。

---

## このリポジトリ固有の繰り返しタスク型チェックリスト

2回目の同種の失敗は「チェックリストに項目が足りない」兆候として扱い、1項目ずつここに追記します。本体の `AGENTS.md`「Common Pitfalls & Solutions」が個別の罠を、ここがタスク型の進め方を持ちます。

### 検証ラン（実機で権限フィルタ等を確認する）

- [ ] 承認済みの課金ウィンドウ（上限時間）を決め、evidence-record に開始・終了を記録する
- [ ] 既存 FSx / VPC は参照のみ。使い捨て volume は検証後に削除する（不可逆操作は実行前に承認）
- [ ] 撤去で消える証跡（削除予定バケットのオブジェクト等）は撤去の**前**に `raw/` へ退避する
- [ ] inline と Lambda の両経路を確認する（`filterLog.source` で区別）
- [ ] Fail-Closed は `total>0 かつ allowed=0` を併せて確認する（0件返却と区別する）
- [ ] 実リソース ID は `.private/` に留め、公開物へはマスクして起こす
- [ ] tier は `verified（小規模・1 環境）` のように規模と環境数を添える

### CDK synth / デプロイ

- [ ] `.ts` を変えたら synth の前に `npx tsc`（古い `.js` が使われるのを防ぐ）
- [ ] フラグを追加したら、そのフラグでのみ生成されるリソースが増えるため CI の synth-matrix にレーンを1本足す
- [ ] synth レーンのフラグは construct を実際に生成するのに十分か確認する（緑でも中身が空なら無意味）
- [ ] 既存 VPC import は CIDR が必須。DynamoDB への Streams 追加は `cdk diff` を先に取る

### ベンチマーク測定

- [ ] 理論推定（`baseline-estimates.md`）と実測を取り違えない
- [ ] 効果を主張する前に unchanged 構成のラン間ばらつきを測る（規律4）
- [ ] 測定条件（日付・リージョン・構成・測定方法・実行回数）を数値に併記する

### 依存更新（`npm audit fix` / lockfile 変更）

- [ ] `npm audit fix` は直接の脆弱性以外（aws-cdk-lib minor、nested optional-peer、lockfile 付随パッケージ）も動かす。更新後に下を全て回す
- [ ] 両 workspace で**隔離した実 `npm ci`**（package.json + lockfile だけを空ディレクトリにコピーして実行）。`--dry-run` は optional-peer の sync ずれを見逃す
- [ ] `npx cdk synth` を **exit code** で判定する（末尾の schema mismatch 警告を成功と読まない）
- [ ] `scripts/check-dependency-audit.py`、`docker/nextjs` は `npx vitest run` も（phantom dependency は clean regen でのみ露見する）
- [ ] `aws-cdk-lib` を上げたら `aws-cdk` CLI も揃える（assembly schema version で結合。Dependabot の `aws-cdk` group と同じ）
- [ ] 直接 import するのに package.json 未宣言の依存（phantom dependency）は transitive hoist で通っているだけ。`grep` で import を洗い、`dependencies` に宣言する
