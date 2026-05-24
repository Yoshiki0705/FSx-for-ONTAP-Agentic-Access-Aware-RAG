# フィードバック活用 & Feature Gate 運用ガイド

**作成日**: 2026-05-24  
**対象**: 運用チーム、プロダクトオーナー

---

## Part 1: フィードバック → 改善フロー

### 週次フィードバックレビュー手順

```
毎週月曜日:
1. DynamoDB feedback テーブルから前週のデータを集計
2. negative フィードバックのクエリパターンを分析
3. 改善アクションを決定
4. 次週に効果を確認
```

### 集計クエリ（Athena or CLI）

```bash
# 前週の positive/negative 比率
aws dynamodb query \
  --table-name ${PREFIX}-rag-feedback \
  --index-name date-rating-index \
  --key-condition-expression "#d = :date" \
  --expression-attribute-names '{"#d":"date"}' \
  --expression-attribute-values '{":date":{"S":"2026-05-20"}}' \
  --region ap-northeast-1

# negative フィードバックの多いクエリパターン
# → queryPreview フィールドでパターンを特定
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
