# FSx for NetApp ONTAP 運用自動化スイート

## 概要

Amazon FSx for NetApp ONTAP と AWS Lambda / Step Functions を連携させ、
イベント非依存で運用自動化・省力化を実現する構成。

**AWS 環境検証済み** (2026-05-01): ONTAP 9.17.1P4D3 で全 Phase PASS。
詳細は [docs/aws-verification-report.md](docs/aws-verification-report.md) を参照。

## 構成方針

- **イベント駆動は前提にしない** — S3 Event Notification 不使用
- **アプリ主導 or 定期実行** — EventBridge Scheduler で制御
- **FSx for ONTAP 側に常駐プロセスなし**
- **Lambda から NFS マウントしない** — ONTAP REST API / FSx API のみ
- **S3 Access Point は "境界" として扱う**

## クイックスタート

### デプロイ

```bash
aws cloudformation deploy \
  --template-file automation/fsxn-ops/cfn/fsxn-ops-stack.yaml \
  --stack-name fsxn-ops \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    FsxFilesystemId=<FSX_FILESYSTEM_ID> \
    ManagementLif=<MANAGEMENT_LIF_IP> \
    OntapSecretId=<SECRETS_MANAGER_SECRET_ARN> \
    VpcId=<VPC_ID> \
    SubnetIds=<PRIVATE_SUBNET_ID> \
    SecurityGroupId=<SECURITY_GROUP_ID> \
    NotificationEmail=<YOUR_EMAIL>
```

### テスト

```bash
# ユニットテスト (32 テスト)
pip install -r automation/fsxn-ops/requirements.txt
pytest automation/fsxn-ops/tests/ -v

# AWS 統合テスト (Lambda デプロイ→テスト→クリーンアップを自動実行)
bash automation/fsxn-ops/tests/integration/run_aws_verification.sh
```

## 前提条件

- FSx for NetApp ONTAP がデプロイ済み
- SVM 管理ユーザー (fsxadmin) が利用可能
- Secrets Manager に `{"username": "fsxadmin", "password": "xxx"}` 形式で保存
- **fsxadmin パスワード同期**: Secrets Manager の値と FSx ONTAP の実パスワードが一致していること
  ```bash
  # パスワード同期 (不一致の場合)
  aws fsx update-file-system --file-system-id <FS_ID> \
    --ontap-configuration FsxAdminPassword=<PASSWORD>
  ```

## VPC エンドポイント要件

VPC 内の Lambda から AWS API にアクセスするため、以下の VPC エンドポイントが**必須**:

| サービス | タイプ | 用途 |
|---------|--------|------|
| `com.amazonaws.{region}.secretsmanager` | Interface | ONTAP 認証情報取得 |
| `com.amazonaws.{region}.fsx` | Interface | FSx API (容量変更等) |
| `com.amazonaws.{region}.monitoring` | Interface | CloudWatch メトリクス取得 |
| `com.amazonaws.{region}.sns` | Interface | SNS 通知送信 |
| `com.amazonaws.{region}.s3` | **Gateway** | S3 / FSx ONTAP S3 Access Point アクセス |

> CFn テンプレート (`cfn/fsxn-ops-stack.yaml`) に VPC エンドポイント定義が含まれています。
> S3 Gateway エンドポイントは Lambda サブネットのルートテーブルに関連付けが必要です。

## ディレクトリ構成

```
automation/fsxn-ops/
├── README.md                          # 本ファイル
├── requirements.txt                   # Python 依存 (テスト用)
├── pytest.ini                         # テスト設定
├── docs/
│   ├── why-this-makes-fsxn-easier.md  # この構成で楽になる理由
│   └── aws-verification-report.md     # AWS 環境検証レポート
├── stepfunctions/
│   ├── snapmirror-failover.asl.json   # SnapMirror フェイルオーバー ASL
│   └── snapmirror-failback.asl.json   # SnapMirror フェイルバック ASL
├── lambda/
│   ├── common/
│   │   ├── ontap_client.py            # ONTAP REST API クライアント共通
│   │   └── fsx_helpers.py             # FSx API ヘルパー
│   ├── capacity_monitor/
│   │   └── handler.py                 # 容量監視・自動拡張
│   ├── ontap_api_executor/
│   │   └── handler.py                 # ONTAP 管理 API 汎用実行
│   ├── snapmirror_ops/
│   │   └── handler.py                 # SnapMirror 操作 (9 アクション)
│   └── data_preprocessor/
│       └── handler.py                 # AI/分析向け前処理
├── tests/
│   ├── conftest.py                    # テストフィクスチャ
│   ├── test_ontap_client.py           # ONTAP クライアントテスト (11件)
│   ├── test_snapmirror_ops.py         # SnapMirror 操作テスト (10件)
│   ├── test_ontap_api_executor.py     # API Executor テスト (7件)
│   ├── test_capacity_monitor.py       # 容量監視テスト (4件)
│   └── integration/
│       ├── run_aws_verification.sh    # AWS 統合テストスクリプト
│       └── test_ontap_connectivity.py # ONTAP 疎通テスト Lambda
├── iam/
│   └── roles.yaml                     # IAM ロール設計 (CloudFormation)
├── eventbridge/
│   └── schedules.yaml                 # EventBridge スケジュール定義
└── cfn/
    └── fsxn-ops-stack.yaml            # 統合 CloudFormation テンプレート
```

## 実装ユースケース

| # | ユースケース | 実装 | トリガー |
|---|-------------|------|---------|
| 1 | SnapMirror フェイルオーバー自動化 | Step Functions + Lambda | 手動 / API |
| 2 | FSx ONTAP 容量監視・自動拡張 | Lambda | EventBridge (5分間隔) |
| 3 | ONTAP 管理 API 実行 | Lambda | API Gateway / 手動 |
| 4 | AI/分析向けデータ前処理 | Step Functions + Lambda | EventBridge / アプリ |

## 参考実装

- [SnapMirror Failover Orchestration](https://github.com/aws-samples/sample-fsx-ontap-failover-and-failback-orchestration)
- [FSx ONTAP Samples & Scripts](https://github.com/NetApp/FSx-ONTAP-samples-scripts)
- [FSx ONTAP Monitoring & Auto-Resizing](https://docs.netapp.com/us-en/netapp-solutions-dataops/automation/fsxn-monitoring-resizing.html)
- [GenAI Bedrock FSx ONTAP](https://github.com/aws-samples/genai-bedrock-fsxontap)

## トラブルシューティング (検証で得た知見)

### Lambda が Secrets Manager / FSx API にアクセスできない (タイムアウト)

**原因**: VPC 内の Lambda は VPC エンドポイント経由でしか AWS API にアクセスできない。

**必要な VPC エンドポイント**:

| サービス | タイプ | 用途 |
|---------|--------|------|
| `com.amazonaws.{region}.secretsmanager` | Interface | ONTAP 認証情報取得 |
| `com.amazonaws.{region}.fsx` | Interface | FSx API (容量変更等) |
| `com.amazonaws.{region}.monitoring` | Interface | CloudWatch メトリクス取得 |
| `com.amazonaws.{region}.sns` | Interface | SNS 通知送信 |
| `com.amazonaws.{region}.s3` | **Gateway** | S3 / FSx ONTAP S3 Access Point アクセス |

**S3 Gateway エンドポイントの注意点**: Lambda のサブネットが使用するルートテーブルに関連付けが必要。CFn テンプレートの `RouteTableIds` パラメータで指定する。

### ONTAP REST API が 401 Unauthorized を返す

**原因**: Secrets Manager のパスワードと FSx ONTAP の fsxadmin パスワードが不一致。

**解決**:
```bash
# Secrets Manager のパスワードで FSx ONTAP を更新
CURRENT_PW=$(aws secretsmanager get-secret-value \
  --secret-id <SECRET_ID> --query 'SecretString' --output text \
  | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['password'])")

aws fsx update-file-system \
  --file-system-id <FS_ID> \
  --ontap-configuration "FsxAdminPassword=$CURRENT_PW"
```

### CloudWatch StorageCapacityUtilization メトリクスが取得できない

**原因**: FSx ONTAP の StorageCapacityUtilization メトリクスは、ファイルシステム作成直後やデータが少ない場合に取得できないことがある。

**対応**: capacity_monitor は自動的に ONTAP REST API にフォールバックし、ボリュームレベルの使用率を直接取得する。FS レベルの使用率は 0% として扱われる。

### SnapMirror 関係作成後に初期転送が始まらない

**原因**: SnapMirror 関係の作成と初期転送は別操作。関係作成後に明示的に転送を開始する必要がある。

**対応**: `final_transfer` アクション (`POST /snapmirror/relationships/{uuid}/transfers`) を呼び出す。Step Functions の ASL では `FinalTransfer` ステートがこれを実行する。

### CFn デプロイ時に IAM ロール名の衝突エラー

**原因**: 以前のテストや手動作成で同名の IAM ロールが残っている。

**解決**: デプロイ前に既存ロールを確認・削除する。
```bash
aws iam delete-role --role-name fsxn-ops-capacity-monitor-role
```

### FSx ONTAP S3 Access Point の作成方法

FSx ONTAP の NAS データを S3 API 経由で公開するには、通常の S3 Access Point ではなく FSx 専用の API を使用する:

```bash
aws fsx create-and-attach-s3-access-point \
  --name my-s3ap \
  --type ONTAP \
  --ontap-configuration '{
    "VolumeId": "fsvol-0123456789abcdef0",
    "FileSystemIdentity": {
      "Type": "UNIX",
      "UnixUser": {"Name": "root"}
    }
  }'
```

確認: `aws fsx describe-s3-access-point-attachments`
