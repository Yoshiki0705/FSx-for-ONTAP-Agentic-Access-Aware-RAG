# デプロイメント トラブルシューティング

本ドキュメントでは、AWS環境へのデプロイ時に発生する既知の問題とその解決方法を記載します。

---

## 1. CloudFormation Guard Hook によるデプロイブロック

### 症状

`cdk deploy` 実行時に全リソース作成が以下のエラーで失敗する:

```
Resource handler returned message: "Guard Hook FSxNS3AP::Guard::Hook failed with status: FAILED. 
Reason: ruleLocation contains invalid extension type"
```

### 原因

別プロジェクト（FSx for ONTAP S3 Access Point 検証等）で登録された CloudFormation Guard Hook `FSxNS3AP::Guard::Hook` がアカウント内でアクティブになっている。このフックは全 CloudFormation リソース作成に対して評価が実行されるが、ルール定義に問題があるため全リソースをブロックする。

### 解決方法

#### デプロイ前: Guard Hook を無効化

```bash
aws cloudformation deactivate-type \
  --type HOOK \
  --type-name "FSxNS3AP::Guard::Hook" \
  --region ap-northeast-1
```

#### デプロイ後: Guard Hook を再有効化

他プロジェクトで Guard Hook が必要な場合は、デプロイ完了後に再有効化する:

```bash
aws cloudformation activate-type \
  --type HOOK \
  --type-name "FSxNS3AP::Guard::Hook" \
  --region ap-northeast-1
```

### 確認方法

アカウント内のアクティブな Hook を確認:

```bash
aws cloudformation list-types \
  --type HOOK \
  --visibility PRIVATE \
  --filters TypeNamePrefix=FSxNS3AP \
  --region ap-northeast-1
```

### 予防策

- デプロイ前に `aws cloudformation list-types --type HOOK` でアクティブな Hook を確認する
- CI/CD パイプラインにフック確認ステップを追加する
- Guard Hook のルール定義を修正して正しい拡張子フィルタを設定する

---

## 2. Smart Routing Auto Mode の動作仕様

### 概要

Smart Routing の自動モード（Auto Mode）は、ユーザーが明示的に「⚡自動」ボタンをクリックした場合にのみ有効になります。

### 動作マトリクス

| Smart Routing | モデル選択 | 動作 |
|---------------|-----------|------|
| OFF | 任意 | 手動選択モデルを使用 |
| ON + モデル手動選択 | リストから選択 | "Manual override active" — 手動選択モデルを使用 |
| ON + 「⚡自動」クリック | 自動 | クエリ複雑度に基づく3層自動ルーティング |

### UX フロー

1. サイドバーの Smart Routing トグルを ON にする
2. ModelSelector に「⚡ 自動」オプションが表示される
3. 「⚡ 自動」をクリックすると Auto Mode が有効化される
4. モデルリストから別のモデルを選択すると Manual Override に戻る

### 注意事項

- Smart Routing ON でもモデルを手動選択している場合は自動ルーティングは行われない
- これは意図的な設計（ユーザーの明示的な選択を尊重）
- レスポンスメタデータに「Auto」バッジが表示されるのは自動ルーティング時のみ

---

## 3. Full-Context 分類の発動条件

### 概要

3層ルーティングの `full-context` 分類は、以下の **両方の条件** を同時に満たす場合にのみ発動します:

### 条件

1. **ドキュメント分析意図キーワード**: クエリに以下のキーワードが含まれている
2. **コンテキストサイズ > 4000文字**: RAG検索結果等のコンテキストが4000文字を超えている

### ドキュメント分析意図キーワード

#### 日本語
- この文書を要約
- レポート全体を分析
- 文書全体
- ドキュメントを要約
- 全文を分析
- 資料全体
- 報告書を要約
- ファイル全体

#### 英語
- summarize this document
- analyze the full report
- summarize the entire
- analyze the whole
- full document analysis
- review the complete
- process the entire

### 重要な制約

- **RAG検索結果がない場合（contextSize=0）**: キーワードが含まれていても `full-context` には分類されない
- **キーワードがない場合**: コンテキストが大きくても `full-context` には分類されない
- **片方の条件のみ**: `simple` または `complex` に分類される（既存の2層ロジック）

### 設計意図（Property 3）

この「両方の条件が必要」という設計は、Property-Based Test の Property 3 で保証されています:

> *For any* query string that either (a) lacks all Document_Analysis_Intent keywords OR (b) has a context size less than or equal to the configured threshold, the `classifyQuery` function SHALL NOT return `classification: 'full-context'`.

これにより、単にキーワードを含むだけの短い質問が不必要に重量モデル（Opus）にルーティングされることを防ぎます。

### 現在の制限事項

現在の実装では、`routeQuery()` は RAG 検索の **前** に呼び出されるため、`contextSize` パラメータにはデフォルト値 0 が使用されます。これは full-context ルーティングが初回クエリでは発動しないことを意味します。

**回避策**: 会話コンテキスト（AgentCore Memory からの直近メッセージ）の長さを `contextSize` として渡すことで、会話が進んだ後のクエリでは full-context ルーティングが発動する可能性があります。

---

## 4. GPT-5.5 可用性エラー

### 症状

ModelSelector で GPT-5.5 を選択した際にインラインエラーが表示される。

### 原因

GPT-5.5 はリージョンによって利用可能性が異なります。選択時に `ModelAccessVerifier` がリアルタイムで可用性を検証し、利用不可の場合はエラーを表示して前のモデル選択に戻します。

### 解決方法

- GPT-5.5 が利用可能なリージョンを選択する
- または別のモデルを使用する

### 注意事項

- GPT-5.5 は手動選択専用（自動ルーティングの対象外）
- Property 6 により、Smart Routing Auto Mode では GPT-5.5 は絶対に選択されない

---

## 5. CloudWatch メトリクスが表示されない

### 確認事項

1. **名前空間**: `SmartRouting`
2. **ディメンション**: `RoutingTier`（値: `simple`, `complex`, `full-context`, `manual`）
3. **メトリクス名**: `RoutingCount`

### トラブルシューティング

```bash
# メトリクスの存在確認
aws cloudwatch list-metrics \
  --namespace SmartRouting \
  --region ap-northeast-1

# 直近のデータポイント確認
aws cloudwatch get-metric-statistics \
  --namespace SmartRouting \
  --metric-name RoutingCount \
  --dimensions Name=RoutingTier,Value=simple \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region ap-northeast-1
```

### 注意事項

- EMF メトリクスは Lambda の CloudWatch Logs から自動抽出される
- メトリクスが表示されるまで数分のラグがある
- Lambda の実行ログに EMF JSON が出力されていることを確認する

---

## 6. デプロイ前チェックリスト

```bash
# 1. Guard Hook の確認
aws cloudformation list-types --type HOOK --visibility PRIVATE --region ap-northeast-1

# 2. Bedrock モデルアクセスの確認
aws bedrock list-foundation-models --region ap-northeast-1 \
  --query 'modelSummaries[?contains(modelId, `opus`)].modelId'

# 3. CDK diff で変更内容を確認
npx cdk diff --all

# 4. デプロイ実行
npx cdk deploy --all --require-approval never
```

---

## 7. Guard Hook 再有効化手順（デプロイ後）

デプロイ完了後、別プロジェクトで Guard Hook が必要な場合は再有効化する:

```bash
aws cloudformation activate-type \
  --type HOOK \
  --type-name "FSxNS3AP::Guard::Hook" \
  --region ap-northeast-1
```

⚠️ **注意**: Guard Hook のルール定義に問題がある場合（"ruleLocation contains invalid extension type"）、再有効化すると他のデプロイもブロックされます。ルール定義を修正してから再有効化することを推奨します。

---

## 8. S3 Access Point 作成 CLI 構文

### 概要

FSx for ONTAP の S3 Access Point を CLI で作成する際、正しい構文を使用する必要があります。`--generate-cli-skeleton` で正確なフォーマットを確認できます。

### 正しい CLI 構文

```bash
# スケルトン確認（正しいパラメータ構造を確認）
aws fsx create-and-attach-s3-access-point --generate-cli-skeleton

# UNIX ユーザータイプの場合
aws fsx create-and-attach-s3-access-point \
  --name "my-s3-access-point" \
  --type ONTAP \
  --ontap-configuration '{
    "VolumeId": "fsvol-0123456789abcdef0",
    "FileSystemIdentity": {
      "Type": "UNIX",
      "UnixUser": {"Name": "root"}
    }
  }' \
  --region ap-northeast-1

# WINDOWS ユーザータイプの場合（SVM が AD 参加済みであること）
aws fsx create-and-attach-s3-access-point \
  --name "my-s3-access-point" \
  --type ONTAP \
  --ontap-configuration '{
    "VolumeId": "fsvol-0123456789abcdef0",
    "FileSystemIdentity": {
      "Type": "WINDOWS",
      "WindowsUser": {"Name": "Admin"}
    }
  }' \
  --region ap-northeast-1
```

### 重要な注意事項

- `--type ONTAP` は必須（省略するとエラー）
- `--ontap-configuration` は JSON 文字列で指定
- WINDOWS ユーザーにドメインプレフィクス（例: `DEMO\Admin`）を含めてはいけない。ユーザー名のみ（例: `Admin`）を指定する
- 作成完了まで数分かかる。`describe-s3-access-point-attachments` で `Lifecycle: AVAILABLE` を確認

### 作成状態の確認

```bash
aws fsx describe-s3-access-point-attachments \
  --region ap-northeast-1 \
  --query "S3AccessPointAttachments[?Name=='my-s3-access-point'].[Lifecycle,S3AccessPoint.Alias]" \
  --output table
```

---

## 9. Bedrock KB Data Source と S3 Access Point Alias

### 概要

Bedrock Knowledge Base の `CreateDataSource` API は S3 Access Point ARN を直接受け付けません。代わりに、S3 AP の **alias** を標準的なバケット ARN 形式で指定する必要があります。

### 重要な統合パターン

```
❌ 間違い: S3 Access Point ARN を直接指定
   arn:aws:s3:ap-northeast-1:123456789012:accesspoint/my-s3-access-point

✅ 正しい: S3 AP alias をバケット ARN 形式で指定
   arn:aws:s3:::{alias}
   例: arn:aws:s3:::my-s3-access-point-abc123def-s3alias
```

### 手順

```bash
# 1. S3 AP alias を取得
S3AP_ALIAS=$(aws fsx describe-s3-access-point-attachments \
  --region ap-northeast-1 \
  --query "S3AccessPointAttachments[?Name=='my-s3-access-point'].S3AccessPoint.Alias" \
  --output text)

echo "S3 AP Alias: $S3AP_ALIAS"

# 2. Bedrock KB Data Source 作成時に alias をバケット ARN として使用
aws bedrock-agent create-data-source \
  --knowledge-base-id "KB_ID" \
  --name "fsx-ontap-datasource" \
  --data-source-configuration '{
    "type": "S3",
    "s3Configuration": {
      "bucketArn": "arn:aws:s3:::'$S3AP_ALIAS'"
    }
  }' \
  --region ap-northeast-1
```

### KB Auto-Sync との連携

KB Auto-Sync の `kbDataSourceId` パラメータには、上記で作成した Data Source の ID を指定します。

```bash
# Data Source ID の確認
aws bedrock-agent list-data-sources \
  --knowledge-base-id "KB_ID" \
  --region ap-northeast-1 \
  --query "dataSourceSummaries[].dataSourceId" --output text
```

---

## 10. Lambda invoke エンコーディング問題（macOS）

### 症状

macOS/zsh 環境で `aws lambda invoke` に `--payload` をインラインで指定すると、エンコーディングエラーが発生する（文字 '²' 等の不正文字が混入）。

### 原因

macOS のシェル（zsh）がペイロード文字列のエンコーディングを変換してしまう場合がある。

### 解決方法

`--cli-binary-format raw-in-base64-out` フラグを追加する:

```bash
# ❌ エンコーディング問題が発生する可能性
aws lambda invoke \
  --function-name perm-rag-demo-demo-kb-auto-sync \
  --payload '{}' \
  /tmp/response.json

# ✅ 正しい方法
aws lambda invoke \
  --function-name perm-rag-demo-demo-kb-auto-sync \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/response.json

# レスポンス確認
cat /tmp/response.json | python3 -m json.tool
```

### 代替方法

ペイロードをファイルから読み込む方法でも回避可能:

```bash
echo '{}' > /tmp/payload.json
aws lambda invoke \
  --function-name perm-rag-demo-demo-kb-auto-sync \
  --payload file:///tmp/payload.json \
  /tmp/response.json
```

---

## 11. KB Auto-Sync 検証コマンド

### Lambda 手動実行

```bash
# 手動トリガー
aws lambda invoke \
  --function-name perm-rag-demo-demo-kb-auto-sync \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/kb-sync-response.json \
  --region ap-northeast-1

# レスポンス確認
cat /tmp/kb-sync-response.json | python3 -m json.tool
# 期待出力: {"statusCode": 200, "scannedFiles": N, "changedFiles": M, "ingestionJobId": "...", "durationMs": ...}
```

### DynamoDB インベントリ確認

```bash
# インベントリテーブルのアイテム数確認
aws dynamodb scan \
  --table-name perm-rag-demo-demo-kb-sync-inventory \
  --select COUNT \
  --region ap-northeast-1

# インベントリ内容確認（最初の5件）
aws dynamodb scan \
  --table-name perm-rag-demo-demo-kb-sync-inventory \
  --max-items 5 \
  --region ap-northeast-1 \
  --query "Items[].{fileKey: fileKey.S, size: size.N, lastModified: lastModified.S, eTag: eTag.S}"
```

### インジェスションジョブ確認

```bash
# 最新のインジェスションジョブ確認
aws bedrock-agent list-ingestion-jobs \
  --knowledge-base-id "KB_ID" \
  --data-source-id "DS_ID" \
  --max-results 3 \
  --sort-by attribute=STARTED_AT,order=DESCENDING \
  --region ap-northeast-1

# 特定ジョブの詳細確認
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id "KB_ID" \
  --data-source-id "DS_ID" \
  --ingestion-job-id "JOB_ID" \
  --region ap-northeast-1
```

### EventBridge Scheduler 確認

```bash
# スケジュール状態確認
aws scheduler get-schedule \
  --name perm-rag-demo-demo-kb-auto-sync-schedule \
  --region ap-northeast-1 \
  --query "{State: State, Expression: ScheduleExpression, Target: Target.Arn}"
```

### CloudWatch メトリクス確認

```bash
# KbAutoSync メトリクスの存在確認
aws cloudwatch list-metrics \
  --namespace KbAutoSync \
  --region ap-northeast-1

# 直近のスキャンファイル数
aws cloudwatch get-metric-statistics \
  --namespace KbAutoSync \
  --metric-name ScannedFileCount \
  --dimensions Name=FunctionName,Value=perm-rag-demo-demo-kb-auto-sync \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region ap-northeast-1
```

### CloudWatch Alarm 確認

```bash
aws cloudwatch describe-alarms \
  --alarm-names perm-rag-demo-demo-kb-auto-sync-errors \
  --region ap-northeast-1 \
  --query "MetricAlarms[].{Name: AlarmName, State: StateValue, Threshold: Threshold}"
```

---

## 12. Capacity Guardrails デプロイ手順

### CloudFormation デプロイ

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
    NotificationEmail=<YOUR_EMAIL> \
    MaxGrowPerActionPct=50 \
    MaxGrowPerDayGiB=500 \
    CooldownMinutes=30 \
    CreateVpcEndpoints=false \
  --region ap-northeast-1
```

> **注意**: CDK でデプロイ済みの VPC に既に VPC エンドポイントが存在する場合は `CreateVpcEndpoints=false` を指定する。DynamoDB Gateway Endpoint はテンプレート内に含まれているが、既存エンドポイントと重複するとエラーになる。

### Lambda コードデプロイ（個別ステップ）

CloudFormation テンプレートは `ZipFile` インラインプレースホルダーコードを使用するため、実際の Lambda コードは別途デプロイが必要:

```bash
# Lambda コードをパッケージング
cd automation/fsxn-ops/lambda
zip -r /tmp/capacity_monitor.zip common/ capacity_monitor/

# Lambda 関数コードを更新
aws lambda update-function-code \
  --function-name fsxn-ops-capacity-monitor \
  --zip-file fileb:///tmp/capacity_monitor.zip \
  --region ap-northeast-1

# デプロイ確認
aws lambda get-function \
  --function-name fsxn-ops-capacity-monitor \
  --query "Configuration.{LastModified: LastModified, CodeSize: CodeSize, Runtime: Runtime}" \
  --region ap-northeast-1
```

### 検証コマンド

#### DynamoDB テーブル確認

```bash
# テーブル存在確認
aws dynamodb describe-table \
  --table-name fsxn-ops-guardrails-fsxn-ops \
  --query "Table.{TableName: TableName, Status: TableStatus, TTL: TimeToLiveDescription}" \
  --region ap-northeast-1

# TTL 設定確認
aws dynamodb describe-time-to-live \
  --table-name fsxn-ops-guardrails-fsxn-ops \
  --region ap-northeast-1
# 期待出力: {"TimeToLiveDescription": {"TimeToLiveStatus": "ENABLED", "AttributeName": "ttl_epoch"}}
```

#### CloudWatch Dashboard 確認

```bash
# Dashboard 存在確認
aws cloudwatch get-dashboard \
  --dashboard-name FSxNOps-Guardrails-Dashboard \
  --region ap-northeast-1 \
  --query "DashboardName"
```

#### Lambda 手動実行（テスト）

```bash
# capacity_monitor を手動トリガー
aws lambda invoke \
  --function-name fsxn-ops-capacity-monitor \
  --payload '{"test": true}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/guardrails-response.json \
  --region ap-northeast-1

cat /tmp/guardrails-response.json | python3 -m json.tool
```

#### CloudWatch メトリクス確認

```bash
# Guardrails メトリクスの存在確認（自動拡張試行時のみ出力される）
aws cloudwatch list-metrics \
  --namespace FSxNOps/Guardrails \
  --region ap-northeast-1

# 注意: 閾値未超過の場合、ガードレールは評価されないためメトリクスは出力されない。
# メトリクスが表示されない場合は正常動作（自動拡張が試行されていない）。
```

### テスト後の環境変数リセット

テスト時に閾値を変更した場合、必ず安全なデフォルト値にリセットする:

```bash
# 安全なデフォルト値にリセット
aws lambda update-function-configuration \
  --function-name fsxn-ops-capacity-monitor \
  --environment "Variables={
    AUTO_RESIZE_ENABLED=false,
    DRY_RUN=true,
    MAX_GROW_PER_ACTION_PCT=50,
    MAX_GROW_PER_DAY_GIB=500,
    COOLDOWN_MINUTES=30,
    GUARDRAILS_TABLE_NAME=fsxn-ops-guardrails-fsxn-ops,
    FSX_FILESYSTEM_ID=<FSX_FILESYSTEM_ID>,
    MANAGEMENT_LIF=<MANAGEMENT_LIF_IP>,
    ONTAP_SECRET_ID=<SECRETS_MANAGER_SECRET_ARN>,
    SNS_TOPIC_ARN=<SNS_TOPIC_ARN>
  }" \
  --region ap-northeast-1
```

> **重要**: `AUTO_RESIZE_ENABLED=false` と `DRY_RUN=true` を設定することで、テスト後に意図しない自動拡張が実行されることを防止する。

### VPC Endpoints に関する注意事項

| シナリオ | `CreateVpcEndpoints` 設定 | 理由 |
|---------|--------------------------|------|
| CDK VPC に既存エンドポイントあり | `false` | 重複作成エラーを回避 |
| スタンドアロン VPC（エンドポイントなし） | `true` | DynamoDB Gateway Endpoint を含む全エンドポイントを作成 |

DynamoDB Gateway Endpoint は Lambda サブネットのルートテーブルに関連付けが必要。`CreateVpcEndpoints=true` の場合、テンプレートが自動的に `RouteTableIds` パラメータで指定されたルートテーブルに関連付ける。


---

## 13. Transfer Family StructuredLogDestinations EarlyValidation エラー

### 症状

`cdk deploy` 実行時に ChangeSet 作成段階で以下のエラーが発生する:

```
AWS::EarlyValidation::PropertyValidation - Resource handler returned message: 
"Invalid request provided: StructuredLogDestinations..."
```

### 原因

`AWS::Transfer::Server` リソースの `StructuredLogDestinations` プロパティに CloudWatch Logs ARN + `:*` サフィックスを指定すると、AWS の新しいプロパティバリデーション（EarlyValidation）でリジェクトされる。

この問題は 2026年初頭から発生しており、Transfer Family の CloudFormation リソースハンドラーが `StructuredLogDestinations` の値を正しく検証できないことが原因。

### 解決方法

`structuredLogDestinations` プロパティを Transfer Family サーバー構成から削除する。Transfer Family は `loggingRole` を設定するだけで CloudWatch Logs に標準形式でログを出力する。

```typescript
// ❌ エラーになる構成
const server = new transfer.CfnServer(this, 'Server', {
  structuredLogDestinations: [`${logGroup.logGroupArn}:*`],
  // ...
});

// ✅ 正しい構成（structuredLogDestinations を削除）
const server = new transfer.CfnServer(this, 'Server', {
  loggingRole: loggingRole.roleArn,
  // structuredLogDestinations は指定しない
  // ...
});
```

### 影響

- Transfer Family の構造化 JSON ログ（`structuredLogDestinations`）は利用不可
- 標準形式のログは `loggingRole` 経由で CloudWatch Logs に正常出力される
- SFTP 操作（ログイン、アップロード、ダウンロード）の監査証跡は維持される

---

## 14. Transfer Family HomeDirectoryMappings Target フォーマット

### 正しいフォーマット

Transfer Family の論理ディレクトリマッピング（`HomeDirectoryMappings`）の `Target` は以下の形式が必須:

```
/{bucket-or-access-point-name}/prefix
```

**例:**

```
# ✅ 正しい — AP名 + プレフィックス（末尾スラッシュなし）
Target: /my-s3-access-point/uploads/demo-user

# ✅ 正しい — AP名のみ（ルートマッピング）
Target: /my-s3-access-point
```

### 間違いパターン

```
# ❌ ARN全体を使用 — Transfer Family は拒否する
Target: /arn:aws:s3:ap-northeast-1:123456789012:accesspoint/my-ap/uploads/demo-user

# ❌ 末尾スラッシュ付き — "Target in mapping has a trailing '/'" エラー
Target: /my-s3-access-point/uploads/demo-user/

# ❌ 先頭スラッシュなし
Target: my-s3-access-point/uploads/demo-user
```

### CDK での正しい実装

```typescript
// S3 Access Point ARN から AP 名を抽出
const apName = s3AccessPointArn.split('/').pop()!;

// homeDirectoryPrefix は末尾スラッシュなしで定義
const homePrefix = `/uploads/${userConfig.userName}`;  // 末尾スラッシュなし

// Target を構築
const target = `/${apName}${homePrefix}`;
// 結果: /my-access-point/uploads/demo-user

const user = new transfer.CfnUser(this, 'User', {
  homeDirectoryType: 'LOGICAL',
  homeDirectoryMappings: [{
    entry: '/',
    target: target,  // /{ap-name}/uploads/{userName}
  }],
  // ...
});
```

### エラーメッセージ

| エラーメッセージ | 原因 | 修正方法 |
|----------------|------|---------|
| `Target in mapping has a trailing '/'` | Target の末尾に `/` がある | `homeDirectoryPrefix` から末尾スラッシュを削除 |
| `CREATE_FAILED` (User リソース) | Target フォーマットが不正 | ARN ではなく AP 名を使用し、`/{ap-name}/prefix` 形式にする |

---

## 15. Transfer Family デプロイ検証コマンド

### サーバー状態確認

```bash
# Transfer Family サーバー一覧
aws transfer list-servers \
  --region ap-northeast-1 \
  --query "Servers[].{ServerId: ServerId, State: State, EndpointType: EndpointType}"

# 特定サーバーの詳細確認
aws transfer describe-server \
  --server-id s-xxxxxxxxxxxxxxxxx \
  --region ap-northeast-1 \
  --query "{ServerId: Server.ServerId, State: Server.State, Endpoint: Server.EndpointDetails, Protocols: Server.Protocols, SecurityPolicy: Server.SecurityPolicyName}"
```

### SFTP ユーザー確認

```bash
# ユーザー一覧
aws transfer list-users \
  --server-id s-xxxxxxxxxxxxxxxxx \
  --region ap-northeast-1

# ユーザー詳細（ホームディレクトリマッピング確認）
aws transfer describe-user \
  --server-id s-xxxxxxxxxxxxxxxxx \
  --user-name demo-user \
  --region ap-northeast-1 \
  --query "{UserName: User.UserName, HomeDirectoryType: User.HomeDirectoryType, HomeDirectoryMappings: User.HomeDirectoryMappings, Role: User.Role}"
```

### Ingestion Trigger Lambda 手動実行

```bash
# Lambda 手動トリガー
aws lambda invoke \
  --function-name perm-rag-demo-demo-transfer-ingestion-trigger \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/transfer-trigger-response.json \
  --region ap-northeast-1

# レスポンス確認
cat /tmp/transfer-trigger-response.json | python3 -m json.tool
# 期待出力: {"statusCode": 200, "detectedFiles": N, "changedFiles": M, ...}
```

### DynamoDB テーブル確認

```bash
# スキャン状態テーブル
aws dynamodb scan \
  --table-name perm-rag-demo-demo-transfer-scan-state \
  --select COUNT \
  --region ap-northeast-1

# ファイルインベントリテーブル
aws dynamodb scan \
  --table-name perm-rag-demo-demo-transfer-file-inventory \
  --select COUNT \
  --region ap-northeast-1

# 権限マッピングテーブル
aws dynamodb scan \
  --table-name perm-rag-demo-demo-transfer-permission-mapping \
  --select COUNT \
  --region ap-northeast-1
```

### EventBridge Scheduler 確認

```bash
# スケジュール状態確認
aws scheduler list-schedules \
  --name-prefix perm-rag-demo-demo-transfer \
  --region ap-northeast-1 \
  --query "Schedules[].{Name: Name, State: State}"

# 詳細確認
aws scheduler get-schedule \
  --name perm-rag-demo-demo-transfer-ingestion-schedule \
  --region ap-northeast-1 \
  --query "{State: State, Expression: ScheduleExpression, Target: Target.Arn}"
```

### SFTP 接続テスト（SSH 鍵設定後）

```bash
# SFTP 接続テスト
sftp -i /path/to/private-key \
  demo-user@s-xxxxxxxxxxxxxxxxx.server.transfer.ap-northeast-1.amazonaws.com

# 接続後のコマンド例
sftp> pwd
sftp> ls
sftp> put test-document.pdf
sftp> quit
```

### CloudWatch メトリクス確認

```bash
# TransferFamilyIngestion メトリクスの存在確認
aws cloudwatch list-metrics \
  --namespace TransferFamilyIngestion \
  --region ap-northeast-1

# 直近の検出ファイル数
aws cloudwatch get-metric-statistics \
  --namespace TransferFamilyIngestion \
  --metric-name DetectedFiles \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region ap-northeast-1
```


---

## 16. Docker イメージ OCI 形式 vs Lambda Docker V2 要件

### 症状

Lambda 関数の Docker イメージ更新後、以下のエラーで関数が起動しない:

```
The image manifest, config or layer media type for the source image is not supported.
```

### 原因

CodeBuild Standard 7.0 およびローカル Docker（Colima/BuildKit 有効環境）は、デフォルトで **OCI Image Index 形式** (`application/vnd.oci.image.index.v1+json`) のマニフェストを生成する。Lambda は **Docker V2 manifest** (`application/vnd.docker.distribution.manifest.v2+json`) のみをサポートする。

以下の回避策は**不十分**:
- `DOCKER_BUILDKIT=0`: BuildKit 無効化は最新 Docker では確実に動作しない
- `--provenance=false` のみ: SBOM アタッチメントが残り OCI Index が生成される場合がある

### 解決方法

`docker buildx build` に `--provenance=false --sbom=false --push` を指定する:

```bash
# ✅ 正しいビルドコマンド（Docker V2 manifest を保証）
docker buildx build \
  --provenance=false \
  --sbom=false \
  --platform linux/amd64 \
  -t ${ECR_URI}:${IMAGE_TAG} \
  -f Dockerfile \
  --push \
  .
```

### マニフェスト形式の検証

プッシュ後に必ずマニフェスト形式を確認する:

```bash
# ECR からマニフェストメディアタイプを確認
aws ecr batch-get-image \
  --repository-name permission-aware-rag-webapp \
  --image-ids imageTag=${IMAGE_TAG} \
  --region ap-northeast-1 \
  --query 'images[0].imageManifestMediaType' \
  --output text

# 期待出力: application/vnd.docker.distribution.manifest.v2+json
# NG出力:  application/vnd.oci.image.index.v1+json
```

### 代替検証方法（docker manifest inspect）

```bash
# ローカルで manifest を確認
docker manifest inspect ${ECR_URI}:${IMAGE_TAG} | jq '.mediaType'

# 期待出力: "application/vnd.docker.distribution.manifest.v2+json"
```

### 予防策

- `pre-deploy-setup.sh` は修正済み（`docker buildx build --provenance=false --sbom=false --push` を使用）
- CI/CD パイプラインでも同様のビルドコマンドを使用すること
- CodeBuild buildspec で `DOCKER_BUILDKIT=0` は使用しないこと（不確実）

---

## 17. CDK イメージタグキャッシュ問題

### 症状

ECR に新しい Docker イメージをプッシュしたが、`cdk deploy` で Lambda 関数のイメージが更新されない。

### 原因

CDK は `latest` タグを使用している場合、synth 時にイメージダイジェストを比較してリソース変更を検出する。しかし、ECR の `latest` タグが OCI Index を指している場合、ダイジェストが実際のイメージマニフェストと異なるため、CDK が変更を検出できない。

### 解決方法

`cdk.context.json` の `imageTag` パラメータに**明示的なタグ**を使用する:

```json
{
  "imageTag": "voice-btn-page-20260615"
}
```

### 重要なルール

- フロントエンド変更を含むデプロイでは、**必ず `imageTag` を変更する**
- タグ命名規則: `{feature}-{YYYYMMDD}` または `{feature}-{YYYYMMDD-HHMMSS}`
- `latest` タグは開発時の便宜のためのみ使用し、CDK デプロイでは参照しない

### 確認方法

```bash
# cdk.context.json の imageTag を確認
cat cdk.context.json | jq '.imageTag'

# ECR の利用可能なタグを確認
aws ecr list-images \
  --repository-name permission-aware-rag-webapp \
  --region ap-northeast-1 \
  --query 'imageIds[*].imageTag' \
  --output table
```

---

## 18. VoiceButton が表示されない

### 症状

音声チャット機能を有効化（`NEXT_PUBLIC_VOICE_CHAT_ENABLED=true`）しているが、チャット画面にマイクボタンが表示されない。

### 原因パターン

#### パターン A: ページ統合の問題

`genai/page.tsx` が `MessageInput` コンポーネントを使用せず、直接 `<input>` 要素をレンダリングしている場合、`MessageInput.tsx` 内の VoiceButton は表示されない。

**確認方法**: `genai/page.tsx` に VoiceButton のインポートとレンダリングがあるか確認する。

```typescript
// genai/page.tsx に以下が必要:
import { VoiceButton } from '@/components/VoiceButton';
// ... JSX 内で <VoiceButton /> をレンダリング
```

#### パターン B: useVoiceCapability の権限状態

ブラウザのマイク権限が "prompt"（未確認）状態のとき、`canUseVoice` が `false` を返してボタンが非表示になる。

**修正済みロジック**:
```typescript
// 正しいマッピング:
// "granted" → isMicrophonePermitted = true
// "prompt"  → isMicrophonePermitted = null（未確認だがボタンは表示）
// "denied"  → isMicrophonePermitted = false（ボタン非表示）

// canUseVoice 条件:
const canUseVoice = isMicrophonePermitted !== false && /* 他の条件 */;
```

#### パターン C: 環境変数の問題

Docker ビルド時に `NEXT_PUBLIC_VOICE_CHAT_ENABLED=true` が渡されていない。

**確認方法**:
```bash
# Lambda 環境変数を確認
aws lambda get-function-configuration \
  --function-name perm-rag-demo-demo-webapp \
  --region ap-northeast-1 \
  --query "Environment.Variables.NEXT_PUBLIC_VOICE_CHAT_ENABLED"
```

> **注意**: `NEXT_PUBLIC_*` 環境変数は Next.js ビルド時に埋め込まれるため、Lambda 環境変数ではなく Docker ビルド時の `--build-arg` で渡す必要がある。

### 予防策

- `genai/page.tsx` に VoiceButton を直接レンダリングする（MessageInput に依存しない）
- `useVoiceCapability` フックで "prompt" 状態を `null` にマッピングする
- Docker ビルド時に `--build-arg NEXT_PUBLIC_VOICE_CHAT_ENABLED=true` を含める

---

## 19. AgentCore Runtime CloudFormation 制限

### 症状

CDK テンプレートに `AWS::BedrockAgentCore::AgentRuntime` または `AWS::KinesisVideo::SignalingChannelPolicy` リソースを追加すると、デプロイ時に以下のエラーが発生する:

```
Resource type 'AWS::BedrockAgentCore::AgentRuntime' is not supported.
```

### 原因

AgentCore Runtime および KVS SignalingChannelPolicy は CloudFormation リソースタイプとして未サポート（2026年6月時点）。CDK L1/L2 コンストラクトも存在しない。

### 解決方法

Voice Agent は CDK/CloudFormation 外で CLI/SDK を使用して手動デプロイする:

```bash
# 1. Pipecat Voice Agent Docker イメージをビルド・プッシュ
docker buildx build --provenance=false --sbom=false \
  --platform linux/amd64 \
  -t ${ECR_URI}:pipecat-agent \
  -f docker/pipecat-agent/Dockerfile \
  --push \
  docker/pipecat-agent/

# 2. AgentCore Runtime エージェント作成（CLI/SDK）
aws bedrock-agentcore create-agent-runtime \
  --agent-runtime-name "voice-rag-agent" \
  --description "Voice RAG Agent with Pipecat" \
  --agent-runtime-artifact '{
    "containerImage": {
      "uri": "'${ECR_URI}':pipecat-agent"
    }
  }' \
  --region ap-northeast-1

# 3. KVS Signaling Channel 作成
aws kinesisvideo create-signaling-channel \
  --channel-name "voice-chat-signaling" \
  --channel-type SINGLE_MASTER \
  --region ap-northeast-1
```

### CDK テンプレートでの対応

CDK テンプレートから AgentCore Runtime リソースを削除し、代わりにデプロイ手順ドキュメントに CLI コマンドを記載する:

```typescript
// ❌ CDK で定義しない（CloudFormation 未サポート）
// new CfnResource(this, 'VoiceAgent', {
//   type: 'AWS::BedrockAgentCore::AgentRuntime',
//   ...
// });

// ✅ CDK Outputs で必要な情報を出力し、手動デプロイの入力に使用
new cdk.CfnOutput(this, 'EcrRepoUri', { value: ecrRepo.repositoryUri });
new cdk.CfnOutput(this, 'VpcSubnetIds', { value: vpc.privateSubnets.map(s => s.subnetId).join(',') });
```

### 今後の対応

- CloudFormation サポートが追加され次第、CDK コンストラクトに移行する
- それまでは `post-deploy-setup.sh` に Voice Agent デプロイステップを追加することを検討


---

## 20. Docker Layer Cache によるソース変更未反映（2026-06-08 知見）

### 症状

ソースコード（`docker/nextjs/src/` 配下）を変更してリビルド・デプロイしたが、動作が変わらない。Lambda の環境変数やイメージ URI は更新されているのに、実行時の挙動が古いコードのまま。

### 原因

`docker buildx build` がレイヤーキャッシュを使い回し、`COPY . .` ステップで古いソースファイルを含むレイヤーを再利用している。特に以下の条件で発生しやすい:

1. `Dockerfile` の `COPY package*.json ./` + `npm install` レイヤーが変わらない場合
2. ローカルの Docker キャッシュに前回ビルドのレイヤーが残っている場合
3. `.dockerignore` で除外されていないキャッシュファイルが干渉する場合

### 解決方法

```bash
# ✅ --no-cache フラグ付きでリビルド（デフォルト推奨）
docker buildx build --platform linux/amd64 \
  --provenance=false --sbom=false --output type=docker \
  --no-cache \
  -t ${ECR_REGISTRY}/${ECR_REPO}:latest \
  -f docker/nextjs/Dockerfile docker/nextjs
```

### deploy-webapp.sh の改善（2026-06-08 適用済み）

`development/scripts/deploy-webapp.sh` はデフォルトで `--no-cache` を使用するよう変更済み:

- デフォルト: `--no-cache`（ソース変更を確実に反映）
- `--use-cache` オプション: 依存関係のみの更新時に高速ビルド
- デプロイ後に ECR image digest を出力（追跡用）
- Lambda に反映されたイメージ URI を確認出力

### 予防策

1. ソースコード変更時は常に `--no-cache` を使用する
2. `docker/nextjs/.next/` キャッシュを事前削除する
3. デプロイ後に CloudFront URL でブラウザのハードリロード（Ctrl+Shift+R）を実行する
4. Lambda のログで実行コードのバージョンを確認する（EMF メトリクスのタイムスタンプ等）

---

## 21. SID Filter のカンマ区切りフォーマット問題（2026-06-08 修正済み）

### 症状

Permission-aware RAG で検索すると、メタデータが付与されているドキュメントでも「アクセス不可」として除外され、空の回答が返る。

### 原因

Bedrock Knowledge Base がメタデータを格納する際、`.metadata.json` で配列として定義した `allowed_group_sids` をカンマ区切りの単一文字列として返す場合がある:

```json
// .metadata.json で定義した形式:
{"metadataAttributes": {"allowed_group_sids": ["S-1-1-0", "S-1-5-21-xxx-512"]}}

// KB が返すメタデータの形式:
{"allowed_group_sids": "S-1-1-0,S-1-5-21-xxx-512"}
```

修正前の `parseDocumentSIDs()` はこのカンマ区切り形式をパースできず、文字列全体を1つのSIDとして扱っていた。

### 修正内容

`docker/nextjs/src/lib/rag-pipeline/sid-filter.ts` の `parseDocumentSIDs()` に以下のフォールバックを追加:

```typescript
// カンマ区切りフォーマットのサポート
if (raw.includes(',')) {
  return raw.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
}
```

### 修正コミット

- `578435b` — `fix: SID filter — support comma-separated allowed_group_sids format`

### テスト

- `docker/nextjs/src/__tests__/rag-pipeline/sid-filter.test.ts` にカンマ区切り形式のテストケース追加済み
- `lib/schemas/metadata-schema.ts` に正式スキーマ定義＋正規化関数を追加済み

### 教訓

1. Bedrock KB のメタデータ格納形式は `.metadata.json` の定義とは異なる場合がある
2. 全フォーマット（配列、カンマ区切り、JSON文字列、単一値）を網羅的にパースする
3. Property-based test でフォーマットのバリエーションを網羅する


---

## 22. S3 Vectors Filterable Metadata 2048 Bytes 制限（2026-06-08 発見）

### 症状

KB Ingestion Job が `COMPLETE` になるが、`numberOfDocumentsFailed` が多数報告される。ingestion は成功扱いだが、一部のドキュメントがインデックスに追加されない。

### エラーメッセージ

```
Encountered error: Invalid record for key '<chunk-id>': 
Filterable metadata must have at most 2048 bytes 
(Service: S3Vectors, Status Code: 400)
```

### 原因

Amazon S3 Vectors は、各チャンクに付与できる **filterable metadata の合計サイズが 2048 bytes** に制限されている。以下の要因でこの制限を超える:

1. `allowed_group_sids` に多数の長い SID（例: `S-1-5-21-1234567890-1234567890-1234567890-512`）を含む
2. `category`、`owner`、`classification` など複数のメタデータフィールドを同時に付与
3. Bedrock KB が内部的に追加するメタデータ（`x-amz-bedrock-kb-chunk-id` 等）も合計に含まれる

### 影響

- 影響を受けるドキュメントは検索結果に表示されない
- Permission filter で「アクセス可能なドキュメントがない」と誤判定される可能性
- ingestion ジョブ自体は `COMPLETE` になるため、気づきにくい

### 解決方法

#### 方法 A: メタデータサイズの削減

```json
// ❌ 2048 bytes を超える可能性がある（長いSID × 多数）
{
  "metadataAttributes": {
    "allowed_group_sids": [
      "S-1-5-21-1234567890-1234567890-1234567890-512",
      "S-1-5-21-1234567890-1234567890-1234567890-1001",
      "S-1-5-21-1234567890-1234567890-1234567890-2200",
      "S-1-5-21-1234567890-1234567890-1234567890-8100",
      "S-1-1-0"
    ],
    "category": "healthcare",
    "owner": "medical-department-team-alpha",
    "classification": "confidential"
  }
}

// ✅ グループSIDのみに限定し、サイズを抑える
{
  "metadataAttributes": {
    "allowed_group_sids": ["S-1-1-0", "S-1-5-21-xxx-512"],
    "category": "healthcare"
  }
}
```

#### 方法 B: OpenSearch Serverless への切り替え

S3 Vectors の制限が問題になる場合、`vectorStoreType` を `opensearch-serverless` に変更する。OpenSearch Serverless にはこの制限がない。

```bash
# CDK context で切り替え
npx cdk deploy --all -c vectorStoreType=opensearch-serverless
```

> **注意**: ベクトルストアの切り替えは KB 再作成が必要。既存データの再ingestion が発生する。

### 確認方法

```bash
# Ingestion ジョブの失敗理由を確認
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id $KB_ID \
  --data-source-id $DS_ID \
  --ingestion-job-id $JOB_ID \
  --region ap-northeast-1 \
  --query 'ingestionJob.failureReasons'

# 失敗数の確認
aws bedrock-agent get-ingestion-job \
  --knowledge-base-id $KB_ID \
  --data-source-id $DS_ID \
  --ingestion-job-id $JOB_ID \
  --region ap-northeast-1 \
  --query 'ingestionJob.statistics.numberOfDocumentsFailed'
```

### 予防策

1. `.metadata.json` の合計サイズを計算してから ingestion を実行する
2. `allowed_group_sids` は最大 3-5 グループに制限する
3. Metadata Schema Validation (`lib/schemas/metadata-schema.ts`) の `validateMetadata()` にサイズチェックを追加検討
4. ingestion 後に `numberOfDocumentsFailed > 0` をアラート対象にする


---

## 23. Bedrock Agent foundationModel と Inference Profile の非互換（2026-06-08 発見）

### 症状

CDK で Agent の `foundationModel` に inference profile ID（`jp.anthropic.claude-haiku-4-5-20251001-v1:0` 等）を設定すると、Agent 呼び出し時に以下のエラーが発生する:

```
The provided model identifier is invalid.
```

または base model ID（`anthropic.claude-haiku-4-5-20251001-v1:0`）を設定すると:

```
Invocation of model ID anthropic.claude-haiku-4-5-20251001-v1:0 with on-demand throughput isn't supported.
```

### 原因

Bedrock Agent の `foundationModel` パラメータは **base model ID のみ**を受け付ける。inference profile ID は無効。しかし ap-northeast-1 では一部のモデル（Claude Haiku 4.5 等）が on-demand で利用不可のため、Agent の foundationModel に設定すると呼び出し時にエラーになる。

### 解決方法

ap-northeast-1 で on-demand 利用可能なモデルを Agent の foundationModel に使用する:

```typescript
// ✅ on-demand available in ap-northeast-1
const singleAgentModel = 'anthropic.claude-3-haiku-20240307-v1:0';

// ❌ inference profile — Agent does NOT accept these
// 'jp.anthropic.claude-haiku-4-5-20251001-v1:0'
// 'apac.anthropic.claude-haiku-4-5-20251001-v1:0'

// ❌ base ID but NOT on-demand available in ap-northeast-1
// 'anthropic.claude-haiku-4-5-20251001-v1:0'
```

### Agent Alias バージョン問題

Agent の `foundationModel` を CDK で変更しても、Alias が古い versioned agent を参照している場合は変更が反映されない。

```
Agent DRAFT: model updated ✅
Agent Version 1: old model ❌ (Alias points here)
```

Alias を新バージョンに更新するには:
1. `create_agent_version` で新バージョンを作成（AWS Console or 最新 SDK）
2. `update_agent_alias` の `routingConfiguration` を新バージョンに変更

> **注意**: ローカルの boto3/AWS CLI が古い場合、`create_agent_version` API が未対応の場合がある。AWS Console での操作または SDK アップグレードが必要。
