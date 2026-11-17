# フィードバック活用 & Feature Gate 運用ガイド

**作成日**: 2026-05-24  
**対象**: 運用チーム、プロダクトオーナー

---

## Part 1: フィードバック → 改善フロー
### 有効化と、保存されるもの
評価の保存は既定で無効です。質問文（500 文字まで）を保存するので、明示的に有効にします。

```bash
npx cdk deploy --all -c enableFeedback=true            # 保持は既定の 90 日
npx cdk deploy --all -c enableFeedback=true -c feedbackRetentionDays=30
```

有効にすると、WebApp スタックに DynamoDB テーブル `${PREFIX}-rag-feedback` と Lambda `${PREFIX}-feedback-collector` が入り、チャットの回答ごとに高評価・低評価のボタンが出ます。無効なときは、ボタンは出ず、`/api/feedback` は 503（`feedback_disabled`）を返します。保存に失敗したときは、画面にエラーを出し、「送信済み」にはしません。

| 保存する項目 | 内容 |
|---|---|
| `userId` | 署名検証済みのセッションの利用者（ブラウザが送る値は使わない） |
| `rating`、`comment` | `positive` / `negative`。コメントは任意で 1,000 文字まで |
| `query` | 質問文。500 文字まで |
| `responseId`、`modelId`、`routingTier` | 回答の ID、モデル名、ルーティングの区分 |
| `sourceDocIds` | 根拠にした文書の ID。S3 の URI の SHA-256 の先頭 24 文字で、ファイル名は残さない（20 件まで） |
| `timestamp`、`date`、`ttlEpoch` | 時刻、日付（UTC）、期限（保持日数後） |

回答の本文と、文書の本文・名前は保存しません。根拠の文書は、利用者の権限で見えた引用だけがハッシュにされます。

### 評価を読む権限
Web アプリは評価用 Lambda を呼ぶだけで、テーブルを読めません。読むのは週次レビューをする運用者で、そのロールに管理ポリシー `${PREFIX}-feedback-reader`（出力 `FeedbackReaderPolicyArn`）を付けます。このポリシーは `Query`、`GetItem`、`BatchGetItem`、`Scan` だけを許します。

### 週次フィードバックレビュー手順
```
毎週月曜日:
1. date-rating-index で前週 7 日分の positive / negative を数える
2. negative の query（質問文）のパターンを分析する
3. 根拠にした文書の ID を、文書の名前に戻して確認する（下記）
4. 改善アクションを決定し、次週に効果を確認する
```

### 集計クエリ（CLI）
```bash
# 1 日分の positive / negative の件数
for r in positive negative; do
  aws dynamodb query \
    --table-name ${PREFIX}-rag-feedback \
    --index-name date-rating-index \
    --key-condition-expression "#d = :date AND rating = :r" \
    --expression-attribute-names '{"#d":"date"}' \
    --expression-attribute-values '{":date":{"S":"2026-11-10"},":r":{"S":"'$r'"}}' \
    --select COUNT --region ap-northeast-1 --query Count
done

# negative の質問文（query 属性）と根拠の文書 ID
aws dynamodb query \
  --table-name ${PREFIX}-rag-feedback \
  --index-name date-rating-index \
  --key-condition-expression "#d = :date AND rating = :r" \
  --expression-attribute-names '{"#d":"date"}' \
  --expression-attribute-values '{":date":{"S":"2026-11-10"},":r":{"S":"negative"}}' \
  --projection-expression "query,modelId,routingTier,sourceDocIds,comment" \
  --region ap-northeast-1
```

### 文書の ID を名前に戻す
`sourceDocIds` は名前を持たないので、評価を読めるだけの運用者には文書の名前が分かりません。バケット（または S3 Access Points のエイリアス）を一覧できる運用者は、次のスクリプトで戻せます。

```bash
aws s3api list-objects-v2 --bucket <エイリアス> --query 'Contents[].Key' --output text \
  | tr '\t' '\n' | python3 scripts/resolve-feedback-doc-ids.py --bucket <エイリアス> <ID> [<ID> ...]
```

### 利用者の評価を消す（削除の依頼があったとき）
`userId-timestamp-index` で `feedbackId` と `timestamp` を集め、1 件ずつ `delete-item` します。保持日数を過ぎたレコードは DynamoDB の TTL が消しますが、期限の直後に消えるとは限りません。

```bash
aws dynamodb query --table-name ${PREFIX}-rag-feedback --index-name userId-timestamp-index \
  --key-condition-expression "userId = :u" --expression-attribute-values '{":u":{"S":"<利用者>"}}' \
  --projection-expression "feedbackId,#t" --expression-attribute-names '{"#t":"timestamp"}' --region ap-northeast-1
```

### 改善アクションマトリクス
| negative パターン | 原因推定 | アクション |
|-----------------|---------|-----------|
| 「〇〇について教えて」→ 回答なし | ドキュメント未登録 | 該当ドキュメントをKBに追加 |
| 回答が不正確 | チャンキングが不適切 | チャンキング戦略を HIERARCHICAL に変更 |
| 回答が古い | KB同期遅延 | ポーリング間隔を短縮 or CloudTrailモードに変更 |
| 回答が長すぎる/短すぎる | プロンプト問題 | Agent instruction を調整 |
| 権限エラー | 権限設計の問題 | .metadata.json の allowed_group_sids を確認 |
---
## Part 2: Feature Gate 運用ガイド
> **Feature Gate について**: `FeatureGateConstruct` と Lambda はありますが、どのスタックにも組み込まれておらず、呼び出す `/api/config/feature-gates` もありません（2026-11-17 時点の origin/main）。以下の運用手順は、それらが配線されてからのものです。


### 段階的開放の推奨フロー

```
Stage 1: 内部テスト (enabledUsers のみ)
  ↓ 1週間、エラー率 < 1%、negative feedback < 10%
Stage 2: 25% ロールアウト (rolloutPercentage: 25)
  ↓ 1週間、同上
Stage 3: 50% ロールアウト
  ↓ 1週間、同上
Stage 4: 100% ロールアウト (defaultEnabled: true)
```

### 各ステージでの確認事項

| 確認項目 | 閾値 | 超過時のアクション |
|---------|------|-----------------|
| Lambda エラー率 | < 1% | ロールバック（rolloutPercentage を前ステージに戻す） |
| negative feedback 率 | < 20% | 原因分析 → 修正後に再開 |
| 応答時間 P95 | < 10秒 | パフォーマンス調査 |
| コスト増加率 | < 150% of baseline | コスト最適化 → 再開 |

### ロールバック手順

```bash
# 即時ロールバック: rolloutPercentage を 0 に設定
aws dynamodb update-item \
  --table-name ${PREFIX}-feature-gates \
  --key '{"featureId":{"S":"hybrid-search"}}' \
  --update-expression "SET rolloutPercentage = :zero" \
  --expression-attribute-values '{":zero":{"N":"0"}}' \
  --region ap-northeast-1

# 完全無効化: defaultEnabled を false に
aws dynamodb update-item \
  --table-name ${PREFIX}-feature-gates \
  --key '{"featureId":{"S":"hybrid-search"}}' \
  --update-expression "SET defaultEnabled = :false, rolloutPercentage = :zero" \
  --expression-attribute-values '{":false":{"BOOL":false},":zero":{"N":"0"}}' \
  --region ap-northeast-1
```

### Feature Gate 変更の監査

Feature Gate テーブルへの変更は CloudTrail で自動記録されます。変更履歴の確認:

```bash
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=${PREFIX}-feature-gates \
  --region ap-northeast-1 \
  --query 'Events[*].{Time:EventTime,User:Username,Event:EventName}'
```

---

## 関連ドキュメント

- [ROI ダッシュボード解釈ガイド](roi-dashboard-interpretation-guide.md)
- [RAG / Agent 評価フレームワーク](evaluation.md)
- [安全な実験ガイド](safe-experimentation-guide.md)
