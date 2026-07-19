# デプロイガイド: 既存 FSx for ONTAP 環境への統合

**Language:** **日本語** | [English](deployment-guide.md) | [한국어](ko/deployment-guide.md) | [简体中文](zh-CN/deployment-guide.md) | [繁體中文](zh-TW/deployment-guide.md) | [Français](fr/deployment-guide.md) | [Deutsch](de/deployment-guide.md) | [Español](es/deployment-guide.md)

**作成日**: 2026-07  
**ステータス**: アクティブ  
**対象**: インフラエンジニア、パートナー/SI が顧客環境にデプロイする場合

---

## クイックスタート（TL;DR）

経験者向けの最短手順:

```bash
git clone https://github.com/Yoshiki0705/Permission-aware-RAG-FSxN-CDK.git
cd Permission-aware-RAG-FSxN-CDK && npm ci

# 1. CDK ブートストラップ（両リージョン — アカウントごとに1回）
npx cdk bootstrap aws://ACCOUNT_ID/ap-northeast-1
npx cdk bootstrap aws://ACCOUNT_ID/us-east-1    # WAF スタック用

# 2. 設定
cp cdk.context.existing-env.example.json cdk.context.json
# 編集: existingFileSystemId, existingSvmId, existingVolumeId, projectName, environment を設定

# 3. ビルド & 検証
bash demo-data/scripts/pre-deploy-setup.sh      # コンテナのビルド・プッシュ
bash scripts/preflight-check.sh                 # 環境の検証

# 4. デプロイ（約 15〜20 分）
npx cdk synth --quiet && npx cdk deploy --all --require-approval broadening

# 5. デプロイ後セットアップ
bash demo-data/scripts/post-deploy-setup.sh     # ユーザー作成、KB データソース、デモデータ
```

デプロイ後、CDK 出力に表示された CloudFront URL を開き、post-deploy スクリプトが出力したデモユーザーの認証情報でサインインしてください。

---

## エグゼクティブサマリ

本ガイドは、Amazon FSx for NetApp ONTAP、VPC、および関連ネットワークリソースが既に存在する環境へ Permission-aware RAG システムをデプロイする手順を説明します。CDK デプロイと CloudFormation デプロイの両方をカバーしています。既存環境統合では FSx for ONTAP のプロビジョニング（約 30〜40 分）をスキップし、総デプロイ時間を約 15〜20 分に短縮します。

**判断基準**: フル機能デプロイにはフィーチャーフラグ付きの CDK を使用。CDK が利用できない環境、または運用自動化レイヤーを独立デプロイする場合は CloudFormation（`fsxn-ops` スタック）を使用。

---

## デプロイされるリソース一覧

CDK デプロイ時にアカウントに作成される AWS リソース:

| カテゴリ | リソース | 備考 |
|---------|---------|------|
| ネットワーク | VPC エンドポイント（または既存利用） | `skipVpcEndpoints` で制御 |
| セキュリティ | Cognito User Pool、WAF WebACL | WAF は us-east-1 |
| コンピュート | Lambda 関数（Next.js コンテナ） | ECR からプル |
| ストレージ | S3 バケット（ベクトル）、DynamoDB テーブル | user-access 権限管理 |
| AI/ML | Bedrock Knowledge Base、S3 Vectors インデックス | 埋め込み + 検索 |
| CDN | CloudFront ディストリビューション | HTTPS フロントエンド |
| （オプション） | Managed AD、Transfer Family、Monitoring | フィーチャーフラグ依存 |

> ⚠️ **既存環境への影響なし**: CDK は既存の FSx for ONTAP ファイルシステム、SVM、ボリューム、ジャンクションパス、エクスポートポリシー、CIFS 共有を **一切変更しません**。リソース ID を読み取り参照するのみです。既存ワークロード（NFS/SMB）に影響はありません。

---

## 目次

1. [前提条件](#1-前提条件)
2. [アーキテクチャ概要](#2-アーキテクチャ概要)
3. [CDK デプロイ（推奨）](#3-cdk-デプロイ推奨)
4. [CloudFormation デプロイ](#4-cloudformation-デプロイ)
5. [VPC エンドポイントの考慮事項](#5-vpc-エンドポイントの考慮事項)
6. [デプロイ後の検証](#6-デプロイ後の検証)
7. [Day 2 運用](#7-day-2-運用)
8. [コスト見積もり](#8-コスト見積もり)
9. [トラブルシューティング](#9-トラブルシューティング)
10. [クリーンアップ / 削除](#10-クリーンアップ--削除)
11. [FAQ](#11-faq)

---

## 1. 前提条件

### 必要なリソース（既存）

| リソース | 例 | 取得方法 |
|----------|-----|----------|
| FSx for ONTAP ファイルシステム ID | `fs-0123456789abcdef0` | `aws fsx describe-file-systems` |
| Storage Virtual Machine (SVM) ID | `svm-0123456789abcdef0` | `aws fsx describe-storage-virtual-machines` |
| ボリューム ID | `fsvol-0123456789abcdef0` | `aws fsx describe-volumes` |
| VPC ID | `vpc-0abc123def456` | `aws ec2 describe-vpcs` |
| プライベートサブネット ID（2+ AZ） | `subnet-0aaa..., subnet-0bbb...` | `aws ec2 describe-subnets` |
| セキュリティグループ ID（ONTAP 管理アクセス） | `sg-0123456789abcdef0` | `aws ec2 describe-security-groups` |
| ONTAP 管理 LIF IP | `198.51.100.10` | FSx コンソール > ファイルシステム > ネットワーク |

### 必要なツール

```bash
# CDK デプロイ
node --version    # >= 18.x
npx cdk --version # >= 2.244.0（プロジェクトローカル）
aws --version     # >= 2.15

# 事前検証
jq --version      # >= 1.6
bash --version    # >= 4.0
```

### IAM 権限

デプロイ実行プリンシパルに最低限必要な権限:
- `fsx:Describe*`（既存リソースの参照）
- `cloudformation:*`（スタック管理）
- CDK ブートストラップ権限一式（[CDK Bootstrapping](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html) 参照）
- `bedrock:*`（Knowledge Base 作成）
- `cognito-idp:*`, `lambda:*`, `s3:*`, `dynamodb:*`, `cloudfront:*`

> **本番環境向けの補足**: 上記は PoC / 開発環境での簡易的な権限です。本番環境では CDK が生成する CloudFormation テンプレートの `cdk.out/` 内を確認し、実際に必要なアクションのみに限定した IAM ポリシーを作成してください。`cdk diff` の出力も、追加される IAM リソースの確認に有用です。スコープダウンの参考: [AWS CDK Security Best Practices](https://docs.aws.amazon.com/cdk/v2/guide/security.html)。

### ネットワーク要件

| ソース | 宛先 | ポート | 用途 |
|--------|------|--------|------|
| Lambda SG | ONTAP 管理 LIF | TCP 443 | ONTAP REST API |
| Lambda SG | S3 VPC エンドポイント | TCP 443 | S3 Access Point |
| Lambda SG | Bedrock VPC エンドポイント | TCP 443 | KB API, Converse API |
| Lambda SG | DynamoDB VPC エンドポイント | TCP 443 | user-access テーブル |
| Lambda SG | Secrets Manager エンドポイント | TCP 443 | ONTAP 認証情報 |

---

## 2. アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────────┐
│  既存環境（顧客管理）                                              │
│                                                                   │
│  ┌──────────────────┐   ┌──────────────────┐                    │
│  │ FSx for ONTAP    │   │ VPC              │                    │
│  │ (fs-0xxxx)       │   │ (vpc-0xxxx)      │                    │
│  │                  │   │ ┌──────────────┐ │                    │
│  │ ┌─────────────┐  │   │ │プライベート   │ │                    │
│  │ │ SVM         │  │   │ │サブネット     │ │                    │
│  │ │ └─ Volume   │  │◄──┤ │（既存）       │ │                    │
│  │ └─────────────┘  │   │ └──────────────┘ │                    │
│  └──────────────────┘   └──────────────────┘                    │
│                                                                   │
└───────────────────────────────┬───────────────────────────────────┘
                                │ 参照（ID）
┌───────────────────────────────▼───────────────────────────────────┐
│  RAG システム（CDK デプロイ）                                       │
│                                                                    │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────┐ │
│  │ CloudFront │ │ Cognito    │ │ Lambda     │ │ Bedrock KB     │ │
│  │ + WAF      │ │ User Pool  │ │ (Next.js)  │ │ + S3 Vectors   │ │
│  └────────────┘ └────────────┘ └─────┬──────┘ └────────────────┘ │
│                                       │                            │
│  ┌────────────┐ ┌────────────┐ ┌─────▼──────┐                    │
│  │ DynamoDB   │ │ S3 Access  │ │ VPC        │                    │
│  │ user-access│ │ Point      │ │ Endpoints  │                    │
│  └────────────┘ └────────────┘ └────────────┘                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. CDK デプロイ（推奨）

### 3.1 CDK ブートストラップ（アカウントごとに1回）

CDK はデプロイ先の各リージョンにブートストラップスタックが必要です。S3 バケットと IAM ロールを作成します:

```bash
# プライマリリージョン（FSx for ONTAP が存在するリージョン）
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/ap-northeast-1

# us-east-1（WAF スタックに必要 — CloudFront は us-east-1 の WAF を要求）
npx cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/us-east-1
```

> 他の CDK プロジェクトで既にブートストラップ済みの場合はスキップ可能。

### 3.2 クローンとインストール

```bash
git clone https://github.com/Yoshiki0705/Permission-aware-RAG-FSxN-CDK.git
cd Permission-aware-RAG-FSxN-CDK
npm ci
```

### 3.3 `cdk.context.json` の設定

テンプレートをコピーして環境固有の値を入力:

```bash
cp cdk.context.existing-env.example.json cdk.context.json
```

> テンプレートは2種類あります: `cdk.context.existing-env.example.json`（最小構成、既存 FSx for ONTAP 用）と `cdk.context.json.example`（全機能リファレンス）。既存環境統合にはまず前者をベースにしてください。

**既存環境の最小構成**:

```jsonc
{
  "projectName": "perm-rag",
  "environment": "prod",
  "imageTag": "20260712-001",

  // === 既存 FSx for ONTAP（3つ全て必須） ===
  "existingFileSystemId": "fs-0123456789abcdef0",
  "existingSvmId": "svm-0123456789abcdef0",
  "existingVolumeId": "fsvol-0123456789abcdef0",

  // === ネットワーク（既存VPCをインポートする場合） ===
  // デフォルトでは CDK が新規 VPC を作成。既存を使う場合:
  "existingVpcId": "vpc-0abc123def456",

  // === セキュリティ ===
  "allowedCountries": ["JP"],
  "adDomainName": "corp.example.com",

  // === 機能フラグ ===
  "vectorStoreType": "s3vectors",
  "enableAgent": true
}
```

> **注意**: `existingFileSystemId`、`existingSvmId`、`existingVolumeId` の 3 つ全てを指定すると、CDK は FSx for ONTAP、SVM、Volume の作成を完全にスキップします。3 つ全て指定するか、全て省略するかのいずれかです（一部のみの指定は不可）。

### 3.4 コンテナイメージのビルド

```bash
bash demo-data/scripts/pre-deploy-setup.sh
```

Next.js コンテナを ECR にビルド・プッシュします（ECR リポジトリは CDK ブートストラップで自動作成済み）。スクリプトはイメージタグを出力します — 次のステップで使います。Lambda 互換のため `--provenance=false --sbom=false` を使用。

> **ヒント**: `cdk.context.json` の `imageTag` はこのスクリプトが出力したタグと一致させてください。`"imageTag": "latest"` を設定すると常に最新のプッシュを使いますが、再現性のため明示的なタグを推奨します。

### 3.5 事前検証の実行

```bash
bash scripts/preflight-check.sh
```

事前検証スクリプトは以下を検証します: AWS 認証情報、VPC 存在確認、サブネットのマルチ AZ、セキュリティグループ、FSx for ONTAP ライフサイクル状態、SVM/Volume 整合性、VPC エンドポイント競合、Secrets Manager シークレット、CDK ブートストラップ状態。スキップオプションは `scripts/preflight-check.sh --help` を参照。

### 3.6 デプロイ

```bash
# まず合成（設定の検証）
npx cdk synth --quiet

# 全スタックをデプロイ（初回は 'broadening' で IAM 変更を確認）
npx cdk deploy --all --require-approval broadening
# 初回成功後の更新では以下で高速化可能:
# npx cdk deploy --all --require-approval never
```

**デプロイ順序**（CDK 依存関係により自動決定）:

```
WafStack (us-east-1)
  → NetworkingStack
    → SecurityStack
      → StorageStack（既存 FSx 参照を使用）
        → AIStack
          → WebAppStack
```

**所要時間**: 約 15〜20 分（新規 FSx for ONTAP 作成時は 45〜60 分）。

### 3.7 デプロイ後のセットアップ

```bash
bash demo-data/scripts/post-deploy-setup.sh
```

Cognito ユーザーの作成、KB データソースの設定、デモデータのアップロードを行います。スクリプトは以下を出力します:
- **CloudFront URL** — ブラウザで開く
- **デモユーザーの認証情報** — ユーザー名と初回サインイン用の一時パスワード
- **KB データソース ID** — Auto-Sync を後から有効化する際に使用

---

## 4. CloudFormation デプロイ

`automation/fsxn-ops/cfn/fsxn-ops-stack.yaml` テンプレートは、FSx for ONTAP 運用自動化レイヤー（容量監視、自動拡張）を CDK RAG システムとは独立してデプロイします。

### 4.1 パラメータファイルの作成

テンプレートからパラメータファイルを作成:

```bash
cp cfn-params/existing-environment.example.json cfn-params/my-environment.json
# 値を編集
```

### 4.2 CLI でデプロイ

```bash
aws cloudformation deploy \
  --template-file automation/fsxn-ops/cfn/fsxn-ops-stack.yaml \
  --stack-name fsxn-ops-prod \
  --parameter-overrides file://cfn-params/my-environment.json \
  --capabilities CAPABILITY_IAM \
  --region ap-northeast-1
```

### 4.3 CloudFormation パラメータリファレンス

| パラメータ | 必須 | 説明 | 例 |
|-----------|------|------|-----|
| `FsxFilesystemId` | Yes | FSx for ONTAP ファイルシステム ID | `fs-0123456789abcdef0` |
| `ManagementLif` | Yes | ONTAP 管理 LIF IP アドレス | `198.51.100.10` |
| `OntapSecretId` | Yes | Secrets Manager シークレット ID（fsxadmin 認証情報） | `ontap-fsxadmin-password` |
| `VpcId` | Yes | Lambda 配置先 VPC ID | `vpc-0abc123def456` |
| `SubnetIds` | Yes | プライベートサブネット ID（カンマ区切り） | `subnet-0aaa...,subnet-0bbb...` |
| `SecurityGroupId` | Yes | ONTAP 管理 LIF への HTTPS 許可 SG | `sg-0123456789abcdef0` |
| `NotificationEmail` | Yes | アラート通知先メール | `ops@example.com` |
| `FsThresholdPct` | No | FS 容量アラート閾値（%） | `85` |
| `VolThresholdPct` | No | ボリューム容量アラート閾値（%） | `80` |
| `AutoResizeEnabled` | No | 自動拡張の有効化 | `false` |
| `DryRun` | No | ドライランモード（実際の変更なし） | `true` |
| `MonitoringIntervalMinutes` | No | 監視チェック間隔（分） | `5` |

---

## 5. VPC エンドポイントの考慮事項

### 5.1 Interface エンドポイント vs Gateway エンドポイント

| サービス | エンドポイントタイプ | 使用元 | 備考 |
|---------|-------------------|--------|------|
| S3 | **Gateway** | KB データソース、S3 Vectors | 無料、ルートテーブルベース |
| DynamoDB | **Gateway** | user-access テーブル | 無料、ルートテーブルベース |
| Bedrock Runtime | **Interface** | Converse API、KB Retrieve | 約 $0.01/時/AZ + データ転送 |
| Secrets Manager | **Interface** | ONTAP 認証情報 | 約 $0.01/時/AZ + データ転送 |
| STS | **Interface** | IAM ロール引き受け | 約 $0.01/時/AZ + データ転送 |
| ECR (dkr + api) | **Interface** | Lambda イメージプル | 約 $0.01/時/AZ + データ転送 |

### 5.2 競合の防止

既存 VPC に上記サービスの VPC エンドポイントが既に存在する場合、CDK のデフォルト動作（新規作成）は以下のエラーで**失敗**します:

```
The VPC endpoint for this service already exists in this VPC
```

**解決方法**:

#### 方法 A: 既存エンドポイントのインポート（推奨）

`cdk.context.json` で指定:

```jsonc
{
  // CDK 管理の VPC エンドポイント作成をスキップ
  "skipVpcEndpoints": ["s3", "dynamodb", "bedrock-runtime", "secretsmanager"]
}
```

#### 方法 B: エンドポイント競合のない既存 VPC を使用

既存 VPC のルートテーブルに Gateway エンドポイントが含まれ、Interface エンドポイントが Lambda からアクセス可能なサブネットにあることを確認します。

#### 方法 C: 新規 VPC にデプロイしてピアリング

`existingVpcId` を省略 — CDK が専用 VPC を作成し、FSx for ONTAP VPC への VPC ピアリングまたは Transit Gateway を構成します。

### 5.3 Interface エンドポイント用セキュリティグループ

Interface エンドポイントには、Lambda セキュリティグループからの **インバウンド TCP 443** を許可するセキュリティグループが必要です:

```bash
# 既存エンドポイント SG が Lambda アクセスを許可しているか確認
aws ec2 describe-security-groups --group-ids sg-ENDPOINT_SG \
  --query 'SecurityGroups[].IpPermissions[]'
```

共有エンドポイント SG を使用している環境では、RAG Lambda SG（CDK デプロイ時に作成）のインバウンドルールをデプロイ後に追加するか、事前に作成して参照してください。

---

## 6. デプロイ後の検証

組み込みの検証スクリプトを実行:

```bash
bash demo-data/scripts/verify-deployment.sh perm-rag-prod
```

または手動で確認:

```bash
# 1. スタック状態
aws cloudformation describe-stacks \
  --stack-name perm-rag-prod-WebApp \
  --query 'Stacks[0].StackStatus'

# 2. Lambda ヘルスチェック
aws lambda invoke --function-name perm-rag-prod-webapp \
  --payload '{}' /dev/null --log-type Tail \
  --query 'StatusCode'

# 3. FSx for ONTAP 接続確認（Lambda 経由）
aws lambda invoke --function-name perm-rag-prod-webapp \
  --payload '{"healthCheck": true}' /tmp/health.json
cat /tmp/health.json

# 4. CloudFront ディストリビューション
aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='perm-rag-prod'].{Id:Id,Domain:DomainName}"
```

---

## 7. Day 2 運用

### 7.1 KB データ同期

| 方法 | トリガー | レイテンシ | ユースケース |
|------|---------|----------|-------------|
| 手動 | `bash demo-data/scripts/sync-kb-datasource.sh` | オンデマンド | アドホック更新 |
| Auto-Sync | EventBridge Scheduler | 5 分（設定可能） | 定常運用 |
| Transfer Family | SFTP アップロードイベント | 約 5 分 | パートナーインジェスション |

### 7.2 アプリケーション更新

```bash
# フロントエンドのみ更新（約 3 分）
bash development/scripts/deploy-webapp.sh

# 全スタック更新（CDK コンストラクト変更時）
npx cdk deploy --all --require-approval never
```

### 7.3 ユーザー追加

```bash
# Cognito ユーザー + DynamoDB 権限エントリの作成
bash demo-data/scripts/create-demo-users.sh
bash demo-data/scripts/setup-user-access.sh
```

### 7.4 監視

`enableMonitoring=true` の場合:
- CloudWatch ダッシュボード: `{projectName}-{environment}-dashboard`
- SNS アラート: `monitoringEmail` で設定
- FSx for ONTAP 容量: `fsxn-ops` Lambda で監視（デプロイ済みの場合）

**ログの場所**:
- Lambda アプリケーションログ: CloudWatch Logs `/aws/lambda/{projectName}-{environment}-webapp`
- CDK デプロイログ: ターミナル出力 + CloudFormation コンソールのイベント
- ONTAP 監査ログ: ONTAP 監査ログ配信設定については [運用ランブック](operations-runbook.md) を参照

**ログレベルの変更**:

Lambda 関数は構造化 JSON ログを出力します。ログレベルは環境変数で制御:

```bash
# ログレベルを DEBUG に変更（一時的なトラブルシュート時）
aws lambda update-function-configuration \
  --function-name {projectName}-{environment}-webapp \
  --environment "Variables={LOG_LEVEL=DEBUG}" \
  --region ap-northeast-1

# 通常運用に戻す
aws lambda update-function-configuration \
  --function-name {projectName}-{environment}-webapp \
  --environment "Variables={LOG_LEVEL=INFO}" \
  --region ap-northeast-1
```

> 有効な値: `DEBUG`, `INFO`（デフォルト）, `WARN`, `ERROR`

### 7.5 バックアップとリカバリ

- **FSx for ONTAP**: 既存の顧客バックアップポリシーで管理（Snapshot/SnapMirror）
- **DynamoDB**: ポイントインタイムリカバリがデフォルトで有効
- **S3 Vectors / KB**: ソース（FSx for ONTAP ボリューム）から再インデックス可能
- **Cognito**: `aws cognito-idp list-users` でエクスポート

---

## 8. コスト見積もり

### 増分コスト（RAG システムのみ、既存 FSx for ONTAP を除く）

| コンポーネント | 月額コスト（ap-northeast-1） | 備考 |
|--------------|---------------------------|------|
| Lambda (Next.js) | 約 $5〜30 | トラフィックに依存 |
| S3 Vectors | 約 $5〜20 | ドキュメント数に依存 |
| Bedrock KB (Titan Embeddings) | 約 $10〜50 | インジェスションジョブごと |
| Bedrock Converse (Claude) | 約 $20〜200 | クエリ量に依存 |
| CloudFront | 約 $5〜20 | データ転送量 |
| Cognito | 無料（50K MAU 未満） | |
| DynamoDB | 約 $5〜10 | オンデマンド、小規模テーブル |
| WAF | 約 $6 | Web ACL + ルール |
| VPC エンドポイント（Interface） | 約 $15〜45 | エンドポイントごと/AZ ごと¹ |
| **合計（軽量利用）** | **約 $70〜150/月** | 1,000 クエリ/日 |
| **合計（中程度利用）** | **約 $200〜500/月** | 10,000 クエリ/日 |

> ¹ **VPC Endpoint コストの目安**: Interface Endpoint 4 個（Bedrock Runtime, Secrets Manager, STS, ECR）× 2 AZ × $0.01/時 × 730 時間 ≈ **$58/月**。Gateway Endpoint（S3, DynamoDB）は無料。既存 VPC に共有エンドポイントがある場合はこのコストは不要。

> **コストに関する補足**: 最大の変動費は Bedrock モデル呼び出しです。Smart Routing を使用して単純なクエリを低コストモデル（Haiku）に振り分け、高コストモデル（Sonnet/Opus）は複雑なクエリに限定することでコストを最適化できます。初月は全ドキュメントの初回インジェストにより費用が高くなる可能性があります — 2ヶ月目以降は増分変更のみの処理になります。

**ベクトルストア選択の目安**:

| | S3 Vectors（デフォルト） | OpenSearch Serverless |
|--|--------------------------|---------------------|
| 月額 | 数ドル〜$20 | 約 $700〜（2 OCU 最小） |
| レイテンシ | サブ秒（十分な PoC 品質） | 低レイテンシ（大規模向け） |
| 適用場面 | PoC、開発、小〜中規模（〜100K ドキュメント） | 本番、大規模、低レイテンシ要件 |
| 切替 | `vectorStoreType` を変更 + KB 再作成 | 同左 |

> 詳細比較: [スタック構成比較](stack-architecture-comparison.md)

### デプロイ所要時間

| フェーズ | 所要時間 | 備考 |
|---------|---------|------|
| 事前検証 | 2〜3 分 | 自動バリデーション |
| ECR イメージビルド | 3〜5 分 | Docker クロスコンパイル |
| CDK デプロイ（既存 FSx for ONTAP） | 15〜20 分 | FSx 作成をスキップ |
| CDK デプロイ（新規 FSx for ONTAP） | 45〜60 分 | FSx プロビジョニング含む |
| デプロイ後セットアップ | 5〜10 分 | ユーザー、KB データソース、デモデータ |

<details><summary>スタック別内訳（既存 FSx for ONTAP 構成）</summary>

| スタック | 所要時間 | 主なリソース |
|---------|---------|------------|
| WafStack (us-east-1) | 1〜2 分 | WebACL, IP Set |
| NetworkingStack | 2〜3 分 | VPC Endpoints |
| SecurityStack | 2〜3 分 | Cognito User Pool |
| StorageStack | 1〜2 分 | DynamoDB, S3（FSx 参照のみ） |
| AIStack | 3〜5 分 | Bedrock KB, S3 Vectors Index |
| WebAppStack | 3〜5 分 | Lambda, CloudFront Distribution |

</details>

---

## 9. トラブルシューティング

| 症状 | 原因 | 解決方法 |
|------|------|----------|
| `VPC endpoint already exists` | 既存エンドポイントとの競合 | context に `skipVpcEndpoints` を設定 |
| `Cannot resolve FSx file system` | FS ID またはリージョンの不一致 | `existingFileSystemId` がリージョンと一致しているか確認 |
| `Lambda timeout on ONTAP call` | SG に管理 LIF への HTTPS ルールがない | Lambda SG から ONTAP 管理 LIF への TCP 443 ルールを追加 |
| `S3 Access Point 403` | IAM または AP ポリシーの不足 | AP ARN に対する `s3:GetObject` を確認 |
| S3 AP Lifecycle: FAILED | AD-joined SVM で AD DC 到達不能 | AD 非参加 SVM を使用するか AD DC 接続を修復。[詳細](deployment-troubleshooting.md#26-s3-access-point-が-ad-joined-svm-で-failed-になる2026-07-19-検証済み) |
| Agent: `accessDeniedException` | Agent IAM ロールに `inference-profile/*` リソースがない | [Inference Profile 対応](deployment-troubleshooting.md#23-bedrock-agent-foundationmodel-と-inference-profile2026-07-19-更新)を参照 |
| Agent: `Legacy model blocked` | claude-3-haiku が 30 日未使用でブロック | JP Inference Profile (`jp.anthropic.claude-haiku-4-5-20251001-v1:0`) に移行 |
| cdk-nag `Found errors` で停止 | IAM ワイルドカード未抑制 | NagSuppression を追加 or 一時無効化。[詳細](deployment-troubleshooting.md#27-cdk-nag-awssolutions-エラーでデプロイが止まる2026-07-19-知見) |
| `KB ingestion returns 0 docs` | `.metadata.json` が存在しない | `upload-demo-data-s3ap.sh` を実行（メタデータ生成） |
| `Cognito callback mismatch` | CloudFront URL が未設定 | context に `cloudFrontUrl` を設定 |
| CDK synth: `All three existing IDs required` | 部分的な指定 | `existingFileSystemId`、`existingSvmId`、`existingVolumeId` の 3 つ全てを指定するか、全て省略 |

> 詳細なトラブルシューティング（27 項目）は [deployment-troubleshooting.md](deployment-troubleshooting.md) を参照してください。

---

## 10. クリーンアップ / 削除

既存 FSx for ONTAP に影響を与えずに RAG システムリソースを全て削除:

```bash
# 全 CDK スタックを削除（逆順、約 10〜15 分）
npx cdk destroy --all --force

# fsxn-ops CFn スタックを別途デプロイした場合:
aws cloudformation delete-stack --stack-name fsxn-ops-prod --region ap-northeast-1
```

**削除されるもの**: CloudFront、WAF、Lambda、Cognito、DynamoDB、S3（ベクトル）、VPC エンドポイント（CDK 作成分）、Bedrock KB。

**削除されないもの**: 既存の FSx for ONTAP ファイルシステム、SVM、ボリューム、VPC、サブネット、セキュリティグループは影響を受けません。CDK ブートストラップスタック（`CDKToolkit`）は将来の利用のため残ります。

> **注意**: `cdk destroy` は Cognito User Pool を永久に削除します。必要な場合は事前にユーザーデータをエクスポート: `aws cognito-idp list-users --user-pool-id <pool-id>`

---

## 11. FAQ

### 既存の Cognito User Pool を使用できますか？

現時点では不可です。CDK スタックは必要なカスタム属性（SID、UID、GID マッピング）を含む独自の User Pool を作成・管理します。既存の IdP を SAML または OIDC 経由で作成された Pool にフェデレートすることは可能です。

### FSx for ONTAP と異なるリージョンにデプロイできますか？

できません。RAG Lambda は VPC 経由で FSx for ONTAP 管理 LIF にネットワーク接続する必要があります。クロスリージョン VPC ピアリングはレイテンシと複雑さを追加します。FSx for ONTAP と同じリージョンにデプロイしてください。

### FSx for ONTAP がマルチプロトコル（NFS + SMB）の場合は？

完全にサポートされています。Windows ACL セマンティクスには `volumeSecurityStyle: "NTFS"`、POSIX には `"UNIX"` を設定します。権限対応リトリーバルは両方を処理します。

### 既存 FSx for ONTAP に影響を与えずに RAG システムを更新するには？

CDK は既存の FSx for ONTAP リソースを ID で参照するのみで、変更は一切行いません。RAG スタック（Lambda、KB、UI）の更新は FSx for ONTAP の運用とは独立しています。

### デプロイせずに事前検証だけ実行できますか？

はい。`scripts/preflight-check.sh` は読み取り専用で、変更は行いません。デプロイを開始する前に接続性と設定を検証します。

### 既存 ONTAP ボリュームの要件は？

ボリュームは以下を満たす必要があります:
- `CREATED` ライフサイクル状態であること
- ジャンクションパス（例: `/vol1`）が設定されていること — S3 Access Point はこのパスにマッピング
- SVM のデータ LIF からアクセス可能であること
- 適切なエクスポートポリシー（NFS）または CIFS 共有（SMB）が設定されていること

CDK はジャンクションパス、エクスポートポリシー、CIFS 共有を一切変更しません。CDK が作成する S3 Access Point は、FSx for ONTAP S3 AP 機能を通じてボリューム内容への S3 互換読み取りアクセスを提供します。

### 複数のボリュームを使用できますか？

現時点では、CDK スタックはプライマリ Knowledge Base データソースとして単一ボリュームを参照します。複数ボリュームをインデックスするには:
1. 追加の S3 Access Point を手動作成し、デプロイ後に KB データソースとして追加
2. 単一ボリューム内の複数 qtree/ディレクトリで部門レベルの分離を実現

### 「FSx for ONTAP S3 Access Point」とは？

FSx for ONTAP S3 AP は、ONTAP ボリュームのデータを S3 API 経由で公開する機能です。Bedrock Knowledge Base などの AWS サービスが、NFS/SMB マウントなしで標準的な S3 `GetObject`/`ListObjectsV2` 呼び出しを使ってボリューム内のファイルを読み取れます。S3 Access Point はデプロイ後に作成され、元のファイルの NTFS ACL または UNIX パーミッションを尊重します。

---

## 次のステップ

デプロイ成功後:

1. **UI を確認** — CloudFront URL を開き、サインインしてドキュメントについて質問してみる
2. **自身のデータをアップロード** — `demo-data/scripts/upload-demo-data-s3ap.sh` を参考に本番ファイルをインジェスト
3. **権限を設定** — DynamoDB でユーザーと SID/UID/GID のマッピングを設定しアクセス制御を有効化
4. **機能を有効化** — `cdk.context.json.example` のフィーチャーフラグを確認し、Agent、Monitoring、Guardrails を必要に応じて有効化
5. **本番強化** — [本番準備チェックリスト](production-readiness-checklist.md) を参照

---

## 付録 A: 新規環境デプロイ（FSx for ONTAP 新規作成）

既存 FSx for ONTAP がない環境でゼロからデプロイする場合の最小構成:

```jsonc
{
  "projectName": "rag-demo",
  "environment": "demo",
  "imageTag": "latest",
  "allowedIps": [],
  "allowedCountries": ["JP"],
  // AD 連携が必要な場合（オプション）:
  // "adPassword": "YourStrongP@ssw0rd123",
  // "adDomainName": "demo.local"
}
```

`existingFileSystemId` / `existingSvmId` / `existingVolumeId` を省略すると、CDK が FSx for ONTAP ファイルシステム、SVM、ボリュームを新規作成します。所要時間は約 45〜60 分です。

デプロイコマンドは同一です:

```bash
bash demo-data/scripts/pre-deploy-setup.sh
npx cdk deploy --all --require-approval never
bash demo-data/scripts/post-deploy-setup.sh
```

> **注意**: 新規 FSx for ONTAP 作成ではデフォルトで NTFS セキュリティスタイルのボリュームが作成されます。`volumeSecurityStyle: "UNIX"` で POSIX 権限ベースに変更可能です。

---

## 付録 B: フィーチャーフラグ一覧

全フィーチャーフラグのリファレンスは以下を参照してください:

- **`cdk.context.json.example`** — 全パラメータのコメント付きテンプレート（リポジトリルート）
- **[AGENTS.md](../AGENTS.md)** — Feature Flags セクションにフラグ・デフォルト値・説明の対応表

主要フラグ（抜粋）:

| フラグ | デフォルト | 説明 |
|--------|-----------|------|
| `enableAgent` | `false` | Bedrock Agent（KB 検索 + 多段階推論） |
| `enableGuardrails` | `false` | Bedrock Guardrails（コンテンツフィルタ + PII） |
| `enableMonitoring` | `false` | CloudWatch ダッシュボード + SNS アラート |
| `enableTransferFamily` | `false` | SFTP インジェスションパイプライン |
| `enableKbAutoSync` | `false` | ファイル変更検出 + KB 自動同期 |
| `enableVoiceChat` | `false` | 音声チャット（Nova Sonic） |
| `enableAgentCoreGateway` | `false` | AgentCore Gateway + Permission Interceptor |
| `vectorStoreType` | `s3-vectors` | ベクトルストア選択（`s3-vectors` / `opensearch-serverless`） |
| `kbSearchType` | `SEMANTIC` | 検索タイプ（`SEMANTIC` / `HYBRID`） |

---

## 付録 C: WAF & Geo 制限

CloudFront 用 WAF（us-east-1）は 6 ルールで構成:

| 優先度 | ルール | 説明 |
|--------|--------|------|
| 100 | RateLimit | 5 分間 3000 リクエスト超でブロック |
| 200 | AWSIPReputationList | 悪意ある IP をブロック |
| 300 | AWSCommonRuleSet | OWASP Top 10 準拠（一部除外） |
| 400 | AWSKnownBadInputs | Log4j 等の既知脆弱性 |
| 500 | AWSSQLiRuleSet | SQL インジェクション |
| 600 | IPAllowList | `allowedIps` 設定時のみ有効 |

**Geo 制限**: `allowedCountries` で許可国を指定（デフォルト: `["JP"]`）。空配列で全世界許可。

カスタマイズは `lib/stacks/demo/demo-waf-stack.ts` を直接編集します。

---

## 付録 D: 認証モード設定

認証モードの詳細な構成例（AD Federation / OIDC / LDAP / マルチ IdP）は以下を参照:

- [認証・ユーザー管理ガイド](auth-and-user-management.md) — 全モードの技術詳細
- [認証モード別デモ環境構築ガイド](../demo-data/guides/auth-mode-setup-guide.md) — ワンショットセットアップスクリプト付き

---

## 関連ドキュメント

- [コスト見積もりワークシート](cost-estimation-worksheet.md)
- [運用ランブック](operations-runbook.md)
- [パートナー展開パターン](partner-deployment-patterns.md)
- [Transfer Family ネットワーク前提条件](transfer-family-networking-prerequisites.md)
- [本番準備チェックリスト](production-readiness-checklist.md)
- [デプロイトラブルシューティング](deployment-troubleshooting.md)
