# FSx for ONTAP 運用自動化 — AWS 環境統合検証レポート

**実施日**: 2026-05-01  
**環境**: ap-northeast-1 (東京リージョン)

---

## 検証環境

| 項目 | 値 |
|------|-----|
| FSx ファイルシステム | `<FSX_FILESYSTEM_ID>` |
| ONTAP バージョン | NetApp Release 9.17.1P4D3 |
| 管理 LIF | `<MANAGEMENT_LIF_IP>` |
| SVM | `<SVM_NAME>` |
| ストレージ容量 | 1024 GiB |
| SnapMirror 関係 | 0 (DR 構成なし — 同一クラスタ内で E2E テスト実施) |
| Lambda ランタイム | Python 3.12 |

### VPC エンドポイント (5 種必須)

| サービス | タイプ | 用途 |
|---------|--------|------|
| `com.amazonaws.{region}.secretsmanager` | Interface | ONTAP 認証情報取得 |
| `com.amazonaws.{region}.fsx` | Interface | FSx API (容量変更等) |
| `com.amazonaws.{region}.monitoring` | Interface | CloudWatch メトリクス取得 |
| `com.amazonaws.{region}.sns` | Interface | SNS 通知送信 |
| `com.amazonaws.{region}.s3` | **Gateway** | S3 / FSx for ONTAP S3 Access Point アクセス |

> S3 Gateway エンドポイントは Lambda サブネットのルートテーブルに関連付けが必要。

---

## 検証結果サマリー

| Phase | テスト内容 | 結果 | 備考 |
|-------|-----------|------|------|
| 0 | CFn テンプレート検証 | ✅ PASS | `aws cloudformation validate-template` 成功 |
| 1 | Lambda パッケージ作成 | ✅ PASS | 4 ZIP ファイル作成 |
| 2 | ONTAP REST API 疎通 | ✅ PASS | 5/5 テスト通過 |
| 3 | capacity_monitor | ✅ PASS | FS + ボリューム監視成功 |
| 4 | ontap_api_executor | ✅ PASS | GET /cluster 成功 |
| 5 | snapmirror_ops | ✅ PASS | discover + discover_shares 成功 |
| 6 | Step Functions | ✅ PASS | SUCCEEDED (Discover → DiscoverShares → Done) |
| 7 | SnapMirror E2E | ✅ PASS | 11/11 テスト (create → transfer → break → resync → cleanup) |
| 8 | 容量自動拡張 | ✅ PASS | ドライラン + 実拡張 (4 ボリューム × 20% 拡張確認) |
| 9 | CFn スタック完全デプロイ | ✅ PASS | `aws cloudformation deploy` 成功 |
| 10 | EventBridge Scheduler | ✅ PASS | 5 分間隔の自動実行確認 (CloudWatch Logs) |
| 11 | SNS 通知送信 | ✅ PASS | SNS Publish API 呼び出し成功 |
| 12 | data_preprocessor (FSx for ONTAP S3 AP) | ✅ PASS | scan / collect_metadata / generate_tasks |

---

## 検証で得た知見

### VPC エンドポイント

- VPC 内の Lambda から AWS API にアクセスするには **5 種の VPC エンドポイント**が必須
- SNS VPC エンドポイントがないと、閾値超過時の通知送信がタイムアウトする
- S3 Gateway エンドポイントは Lambda サブネットのルートテーブルに関連付けが必要

### fsxadmin パスワード

- Secrets Manager のパスワードと FSx for ONTAP の fsxadmin パスワードが不一致だと 401 エラー
- `aws fsx update-file-system --ontap-configuration FsxAdminPassword=...` で同期が必要

### SnapMirror

- 同一 SVM 内でも SnapMirror 関係の作成・ブレーク・再同期が正常に動作
- 関係作成後、明示的に `/transfers` POST で初期転送を開始する必要がある

### CloudWatch メトリクス

- StorageCapacityUtilization メトリクスが取得できない場合がある
- capacity_monitor は自動的に ONTAP REST API にフォールバック

### Lambda Handler パス

- CFn テンプレートの Handler は `module.handler.handler` 形式が必要
  - 例: `capacity_monitor.handler.handler` (× `handler.handler`)

### CFn デプロイ

- 以前のテストで作成した同名 IAM ロールが残っていると CFn デプロイが失敗する
- CFn の ZipFile はプレースホルダー。実コードは `aws lambda update-function-code` で別途デプロイ

---

## 本番デプロイ時の注意事項

1. **VPC エンドポイント (5 種必須)**:
   - Interface: `secretsmanager`, `fsx`, `monitoring`, `sns`
   - Gateway: `s3` (Lambda サブネットのルートテーブルに関連付けが必要)
   - CFn テンプレートの `CreateVpcEndpoints=true` で自動作成。既存エンドポイントがある場合は `false` に設定。
2. **fsxadmin パスワード同期**: Secrets Manager の値と FSx for ONTAP の fsxadmin パスワードが一致していることを確認。
3. **セキュリティグループ**: Lambda の SG から ONTAP 管理 LIF (port 443) へのアウトバウンドを許可。
4. **サブネット**: Lambda はプライベートサブネットに配置。NAT Gateway は不要 (VPC エンドポイント使用)。
5. **Lambda Handler パス**: CFn テンプレートの Handler は `module.handler.handler` 形式。
6. **Lambda コードデプロイ**: CFn の ZipFile はプレースホルダー。実コードは `aws lambda update-function-code --zip-file` で別途デプロイが必要。

---

## 検証スクリプト

再検証が必要な場合:
```bash
bash automation/fsxn-ops/tests/integration/run_aws_verification.sh
```

このスクリプトは以下を自動実行する:
- IAM ロール作成
- Lambda 4 関数デプロイ・テスト
- Step Functions 作成・実行
- 全リソースのクリーンアップ
