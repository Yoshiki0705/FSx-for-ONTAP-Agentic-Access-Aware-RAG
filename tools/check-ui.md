# 画面ソースの検査（check-ui）

`tools/check-ui.mjs` は、画面のソースからテンプレート的な書き方を拾う検査スクリプトです。
Hub（FSx-for-ONTAP-Adoption-Playbook）の `tools/portable/check-ui/` から取り込みました。出典は [NOTICE](../NOTICE) にあります。

```bash
node tools/check-ui.mjs --json docker/nextjs/src
```

指摘の件数は兆候で、画面が良くなったかどうかの判定には使いません。意図して残す行には、理由を添えて `check-ui-ignore` と書きます。

## 初回の検査結果（2026-11-10）

対象は `docker/nextjs/src` の 686 ファイルで、初回は 633 件でした。

| 仕分け | 件数 | 扱い |
|---|---|---|
| テスト（`__tests__`、`__tests__.disabled`） | 70 | 画面ではないので対象外 |
| `.tsx` と同名の `.js` | 9 | 削除済み。下記「同名の `.js`」 |
| `examples/AccessibilityExample.tsx` | 7 | 他のファイルから読み込まれておらず、画面ではない |
| コメント行 | 13 | 画面ではないので対象外（JSDoc の `*` 行を規則が除外しない） |
| 翻訳辞書（`messages/ja.ts` の「ようこそ」） | 1 | 画面の待機メッセージではない |
| 実際の画面 | 533 | 下記 |

## 実際の画面の 533 件の扱い

| 規則 | 件数 | 扱い |
|---|---|---|
| transition-all | 32 | 動かす性質を指定して修正（幅、色、影、不透明度など） |
| loud-gradient | 10 | 単色に修正 |
| tracked-uppercase | 7 | `uppercase tracking-wide` を外して修正 |
| exclamation | 3 | 「！」を「。」に修正 |
| hover-scale | 1 | 拡大をやめ、不透明度の変化に修正 |
| italic | 1 | 斜体を外して修正 |
| off-grid-spacing | 1 | `6px` を `8px` に修正 |
| looping-motion | 30 | 1 件は装飾の点滅だったので外して修正。29 件は進行中の表示なので残す |
| hover-menu | 8 | 7 件はホバー表示を残し、タッチと focus では常時表示に修正。1 件は強調のみなので残す |
| emoji | 440 | `lucide-react` に置き換え。下記「絵文字の置き換え」 |

## check-ui-ignore で残している行

37 行です。

| 理由 | 件数 |
|---|---|
| 読み込み中のスケルトンや表示（`animate-pulse`） | 23 |
| 読み込み中の点、ストリーミング中のカーソル、録音中の表示、実行中の Collaborator のみ | 6 |
| ホバー表示を残し、タッチと focus では常時表示にした操作（削除、フィードバック、コピー） | 7 |
| ホバーは強調のみで、メニューではない | 1 |

件数は `grep -rn check-ui-ignore docker/nextjs/src | wc -l` で数えます。増やす場合は理由を伴ってください。

## 同名の `.js`（削除済み）

初回の検査では、`tsc` が出力した `.js`、`.d.ts`、`.d.ts.map` が `docker/nextjs/src` に 48 本追跡されていました。`.js` は 22 本で、うち 21 本は同名の `.ts` / `.tsx` を持ちます。
Next.js 15.5.29 は拡張子なしの import を `.js`、`.tsx`、`.ts` の順に解決します。ビルド成果物で確認したところ、`useChatStore` は `.js` の古い版が束ねられていました（`[ChatStore]` のログも `setAgentMode` の実装も含まれない）。
48 本を削除し、`docker/nextjs/.gitignore` に `src/**/*.js`、`src/**/*.d.ts`、`src/**/*.d.ts.map` を足しました。削除前後で `next build` の経路一覧、型検査の件数（1284）、vitest の結果は同じです。実行されるコードは現行の `.ts` / `.tsx` になりました。
この修正の前は、`BedrockParameterPanel.tsx` と `LazyNetAppBrandSection.tsx` への修正も画面に反映されていませんでした。

## 絵文字の置き換え

実際の画面の絵文字 440 件は `lucide-react` のアイコンに置き換えました。アイコンを置けない文字列（`alert`、エラー文、チャット応答の Markdown、コメント）は、絵文字を削除して文だけにしています。
`icon: '🔍'` のようなデータは型を `LucideIcon` に変えました。

残る絵文字の指摘 35 件は、画面ではありません。

| 残り | 件数 | 理由 |
|---|---|---|
| テスト | 30 | 画面ではない。コンポーネントを import しない自己完結のテストが絵文字を定数で持つ |
| `examples/AccessibilityExample.tsx` | 5 | 他のファイルから読み込まれていない |

検査の対象外で、絵文字が残っているもの: `src/messages/*.json`（8 言語の翻訳辞書。スクリプトが `.json` を読まない）、`console.*` の出力。
