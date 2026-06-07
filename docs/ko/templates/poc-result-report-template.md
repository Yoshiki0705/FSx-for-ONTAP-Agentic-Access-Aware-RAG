# PoC 결과 보고서 템플릿

**🌐 Language:** [日本語](../../templates/poc-result-report-template.md) | [English](../../en/templates/poc-result-report-template.md) | **한국어** | [简体中文](../../zh-CN/templates/poc-result-report-template.md) | [繁體中文](../../zh-TW/templates/poc-result-report-template.md) | [Français](../../fr/templates/poc-result-report-template.md) | [Deutsch](../../de/templates/poc-result-report-template.md) | [Español](../../es/templates/poc-result-report-template.md)

**용도**: パートナー/SIが顧客にPoC実施結果を報告するためのフォーマット

---

## 1. エグゼクティブサマリー

| 項目 | 内容 |
|------|------|
| 顧客名 | _____ |
| 実施期間 | YYYY/MM/DD — YYYY/MM/DD |
| 対象業務 | _____ |
| 対象ドキュメント数 | _____ 件 |
| 対象ユーザー数 | _____ 人 |
| 全体評価 | ☐ 本番移行推奨 / ☐ 追加検証要 / ☐ 見送り |

---

## 2. 定量評価結果

### 2.1 RAG 品質指標

| 指標 | 目標値 | 実測値 | 判定 |
|------|--------|--------|------|
| Faithfulness (事実整合性) | ≥ 0.85 | _____ | ☐ Pass / ☐ Fail |
| Answer Relevancy (回答関連性) | ≥ 0.80 | _____ | ☐ Pass / ☐ Fail |
| Context Precision (コンテキスト精度) | ≥ 0.75 | _____ | ☐ Pass / ☐ Fail |
| Permission 違反数 | 0 | _____ | ☐ Pass / ☐ Fail |

### 2.2 パフォーマンス指標

| 指標 | 目標値 | 実測値 | 判定 |
|------|--------|--------|------|
| 応答時間 (P50) | ≤ 3s | _____ s | ☐ Pass / ☐ Fail |
| 応答時間 (P95) | ≤ 8s | _____ s | ☐ Pass / ☐ Fail |
| Prompt Cache ヒット率 | ≥ 50% | _____ % | ☐ Pass / ☐ Fail |

### 2.3 ビジネス効果指標

| 指標 | PoC前 | PoC後 | 改善率 |
|------|-------|-------|--------|
| 検索時間（1件あたり） | _____ 分 | _____ 秒 | _____ % |
| 一次回答率 | _____ % | _____ % | _____ pt |
| 権限外情報へのアクセス | _____ 件 | 0 件 | 100% |

---

## 3. 権限制御検証結果

| テストシナリオ | 結果 | 備考 |
|--------------|------|------|
| 管理者ユーザー → 全文書アクセス | ☐ Pass / ☐ Fail | |
| 一般ユーザー → 公開文書のみ | ☐ Pass / ☐ Fail | |
| グループ権限 → 所属部門文書のみ | ☐ Pass / ☐ Fail | |
| 権限変更 → 即時反映 | ☐ Pass / ☐ Fail | 最大遅延: _____ 分 |
| 権限なし文書 → 検索結果から除外 | ☐ Pass / ☐ Fail | |

---

## 4. コスト実績

| 項目 | 月額見込み | 備考 |
|------|-----------|------|
| FSx for ONTAP | $_____ | |
| Bedrock (推論) | $_____ | Smart Routing適用後 |
| Bedrock (Embedding) | $_____ | 初回 + 差分 |
| ベクトルストア | $_____ | S3 Vectors / OpenSearch |
| その他 (Lambda, DynamoDB, CloudFront) | $_____ | |
| **合計** | **$_____** | |

---

## 5. 検出された課題 & 推奨事項

| # | 課題 | 影響度 | 推奨対応 | 対応時期 |
|---|------|--------|---------|---------|
| 1 | | ☐ 高 / ☐ 中 / ☐ 低 | | |
| 2 | | ☐ 高 / ☐ 中 / ☐ 低 | | |
| 3 | | ☐ 高 / ☐ 中 / ☐ 低 | | |

---

## 6. 本番移行に向けた Next Steps

| # | アクション | 担当 | 期限 |
|---|-----------|------|------|
| 1 | セキュリティ評価（IAM最小権限、暗号化） | | |
| 2 | 負荷テスト（想定ユーザー数の2倍） | | |
| 3 | DR設計（Multi-AZ、バックアップ） | | |
| 4 | 運用設計（Runbook、アラート） | | |
| 5 | Go/No-Go 判定会議 | | |

---

## 7. 添付資料

- [ ] CloudWatch ダッシュボードスクリーンショット
- [ ] RAGAS 評価結果 (JSON)
- [ ] Permission-matrix テスト結果
- [ ] コスト明細 (AWS Cost Explorer)
- [ ] ユーザーアンケート結果（実施した場合）
