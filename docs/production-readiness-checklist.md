# 本番化チェックリスト（Production Readiness Checklist）

**🌐 Language:** **日本語** | [English](en/production-readiness-checklist.md) | [한국어](ko/production-readiness-checklist.md) | [简体中文](zh-CN/production-readiness-checklist.md) | [繁體中文](zh-TW/production-readiness-checklist.md) | [Français](fr/production-readiness-checklist.md) | [Deutsch](de/production-readiness-checklist.md) | [Español](es/production-readiness-checklist.md)

**作成日**: 2026-05-21  
**ステータス**: ドラフト  
**対象**: PoC → 本番移行を検討するチーム向け

---

## 概要

本ドキュメントは、Permission-aware RAG システムを PoC 環境から本番環境へ移行する際に確認すべき項目を整理したチェックリストです。

---

## 成熟度レベル定義

| レベル | 名称 | 説明 | 対象 |
|--------|------|------|------|
| L1 | Demo | 同梱サンプルデータ・ユーザーで動作確認。最短デプロイ | 技術検証、社内デモ |
| L2 | PoC | 顧客 AD/IdP 接続、実ファイル投入、評価ログ取得 | 顧客提案、効果検証 |
| L3 | Production | マルチアカウント、監査ログ保全、DR、SLO、脅威モデル、運用 Runbook | 本番業務利用 |

---

## L1 → L2（Demo → PoC）チェックリスト

### 認証・ID連携

- [ ] Cognito User Pool を顧客 IdP（OIDC / SAML / LDAP）に接続
- [ ] テストユーザーで SSO サインイン成功を確認
- [ ] SID / UID+GID の自動取得が動作することを確認
- [ ] `authFailureMode` を `fail-closed` に設定し、権限取得失敗時のブロック動作を確認

### データ投入

- [ ] 実ファイル（10〜100件）を FSx for ONTAP ボリュームに配置
- [ ] `.metadata.json` が正しく生成されることを確認
- [ ] Bedrock KB データソース同期が完了することを確認
- [ ] 権限の異なるユーザーで検索結果が正しくフィルタリングされることを確認

### 評価

- [ ] 回答精度の定性評価（10問以上）
- [ ] 権限違反がゼロであることを確認
- [ ] 応答時間の計測（P50 / P95 / P99）

---

## L2 → L3（PoC → Production）チェックリスト

### 1. セキュリティ

#### 暗号化

- [ ] KMS CMK による S3 / DynamoDB / FSx 暗号化（`enableKmsEncryption=true`）
- [ ] KMS キーローテーション有効化
- [ ] TLS 1.2 以上の強制（CloudFront、ALB、FSx）
- [ ] Secrets Manager でパスワード・API キーを管理（`cdk.context.json` にハードコードしない）

#### ネットワーク

- [ ] VPC エンドポイント有効化（`enableVpcEndpoints=true`）
  - S3、DynamoDB、Bedrock、Bedrock Agent、CloudWatch Logs、STS
- [ ] セキュリティグループの最小権限化（不要なインバウンドルール削除）
- [ ] NAT Gateway 経由のアウトバウンド制限
- [ ] CloudFront Geo 制限の適切な設定

#### WAF

- [ ] レートリミットの本番値設定（デフォルト: 2000 req/5min）
- [ ] IP 許可リストの設定（社内 IP のみ）
- [ ] WAF ログの S3 保存有効化
- [ ] Bot Control ルールの追加検討

#### IAM

- [ ] Lambda 実行ロールの最小権限化
- [ ] Bedrock KB ロールの最小権限化
- [ ] クロスアカウントアクセスの制限
- [ ] IAM Access Analyzer による未使用権限の検出

### 2. 監査・ログ

- [ ] CloudTrail 有効化（全リージョン、管理イベント + データイベント）
- [ ] CloudWatch Logs の保持期間設定（最低 1 年）
- [ ] S3 アクセスログの有効化
- [ ] DynamoDB ストリームによる権限変更追跡
- [ ] Bedrock モデル呼び出しログの有効化
- [ ] 監査ログの改ざん防止（S3 Object Lock / Glacier Vault Lock）
- [ ] RAG 検索ログ（ユーザー ID、クエリ、参照ドキュメント、フィルタリング結果）の保存

### 3. 可用性・DR

- [ ] FSx for ONTAP Multi-AZ 構成の確認
- [ ] DynamoDB のポイントインタイムリカバリ（PITR）有効化
- [ ] S3 バージョニング有効化
- [ ] バックアップスケジュールの設定（FSx 自動バックアップ）
- [ ] RTO / RPO の定義と検証
- [ ] DR リージョンの選定と SnapMirror レプリケーション設計
- [ ] 障害時の手動フェイルオーバー手順書の作成

### 4. 運用

- [ ] CloudWatch ダッシュボード設定（`enableMonitoring=true`）
- [ ] アラート閾値の設定
  - Lambda エラー率 > 1%
  - Bedrock レイテンシ P95 > 10s
  - DynamoDB スロットリング
  - FSx ストレージ使用率 > 80%
- [ ] 運用 Runbook の作成
  - KB 再同期手順
  - 権限キャッシュ強制クリア手順
  - 緊急権限剥奪手順
  - ロールバック手順
- [ ] インシデント対応フローの定義
- [ ] オンコール体制の確立

### 5. コスト管理

- [ ] AWS Budgets によるコストアラート設定
- [ ] タグ戦略の定義（Environment、Project、CostCenter）
- [ ] S3 ライフサイクルポリシー（ログの Glacier 移行）
- [ ] Lambda の適切なメモリ・タイムアウト設定
- [ ] Bedrock モデル利用量のモニタリング
- [ ] 月次コストレビュープロセスの確立

### 6. スケーラビリティ

- [ ] DynamoDB のキャパシティモード選択（オンデマンド vs プロビジョンド）
- [ ] Lambda 同時実行数の設定
- [ ] Bedrock スループットの確認（プロビジョンドスループット検討）
- [ ] FSx throughput capacity の適切な設定
- [ ] CloudFront キャッシュ戦略の最適化

### 7. コンプライアンス

- [ ] データ分類ポリシーの策定（機密、社外秘、公開）
- [ ] 個人情報の取り扱いルール定義
- [ ] データ保持期間の定義
- [ ] 利用規約・プライバシーポリシーの整備
- [ ] 業界固有の規制対応（医療: HIPAA、金融: FISC、公共: ISMAP）

### 8. テスト

- [ ] 権限マトリクステストの実施（[tests/permission-matrix/](../tests/permission-matrix/) 参照）
- [ ] 負荷テスト（想定同時ユーザー数の 2 倍）
- [ ] セキュリティテスト（ペネトレーションテスト）
- [ ] DR テスト（フェイルオーバー / フェイルバック）
- [ ] 権限変更反映テスト（ACL 変更 → 検索結果反映の確認）

---

## 本番デプロイ前の最終確認

```bash
# 1. CDK diff で変更内容を確認
npx cdk diff --all

# 2. セキュリティスキャン
npx cdk synth --quiet | cfn-nag

# 3. テスト実行
npx jest --no-coverage
cd automation/fsxn-ops && python3 -m pytest tests/ -v

# 4. デプロイ（承認付き）
npx cdk deploy --all --require-approval broadening
```

---

## 関連ドキュメント

| ドキュメント | 内容 |
|-------------|------|
| [permission-consistency.md](permission-consistency.md) | 権限変更時の整合性モデル |
| [governance-and-audit.md](governance-and-audit.md) | ガバナンス・監査設計 |
| [partner-deployment-patterns.md](partner-deployment-patterns.md) | マルチテナント展開パターン |
| [safe-experimentation-guide.md](safe-experimentation-guide.md) | 安全な実験ガイド |
| [evaluation.md](evaluation.md) | RAG / Agent 評価メトリクス |
