# Permission-aware RAG システムアーキテクチャ

**最終更新**: 2025-12-30  
**バージョン**: 2.0

---

## 📋 目次

1. [システム概要](#システム概要)
2. [2つの動作モード](#2つの動作モード)
3. [KBモード（Knowledge Base Mode）](#kbモードknowledge-base-mode)
4. [Agentモード（Agent Mode）](#agentモードagent-mode)
5. [動的モデル選択システム](#動的モデル選択システム)
6. [アーキテクチャ図](#アーキテクチャ図)
7. [デプロイメント](#デプロイメント)

---

## システム概要

Permission-aware RAG システムは、Amazon Bedrock を活用した権限認識型の検索拡張生成（RAG）システムです。

### 主要機能

- ✅ **2つの動作モード**: Knowledge Base Mode と Agent Mode
- ✅ **動的モデル選択**: プロバイダーとモデルの自動検出
- ✅ **マルチリージョン対応**: 14リージョンでの展開
- ✅ **権限認識**: FSx for NetApp ONTAP による細かいアクセス制御
- ✅ **リアルタイム検索**: OpenSearch Serverless によるベクトル検索

---

## 2つの動作モード

このシステムは、**全く異なる2つのアーキテクチャ**を持つモードを提供します。

### 比較表

| 項目 | KBモード | Agentモード |
|------|---------|------------|
| **使用サービス** | Amazon Bedrock Knowledge Base | Amazon Bedrock Agent |
| **モデル選択** | フロントエンドで動的選択 | Agent設定で固定 |
| **モデル切り替え** | リクエストごとに可能 | Agent更新が必要 |
| **API Endpoint** | `/api/bedrock/chat` | `/api/bedrock/agent` |
| **モデル管理** | フロントエンド | CDK（BedrockAgentDynamicConstruct） |
| **推論方式** | 直接Bedrock Runtime API | Agent経由 |
| **検索機能** | Knowledge Base内蔵 | Agent内蔵 + Action Groups |
| **ユースケース** | シンプルなRAG | 複雑な推論・マルチステップ処理 |

---

## KBモード（Knowledge Base Mode）

### 概要

Amazon Bedrock Knowledge Base を使用した、シンプルで高速なRAGモードです。

### アーキテクチャ

```
ユーザー
  ↓
Next.js Frontend (モデル選択UI)
  ↓
POST /api/bedrock/chat
  ↓
Bedrock Runtime API (直接呼び出し)
  ↓
選択されたモデル (Claude, Nova, etc.)
  ↓
Knowledge Base (OpenSearch Serverless)
  ↓
レスポンス
```

### モデル選択フロー

1. **モデル一覧取得**
   ```typescript
   GET /api/bedrock/models/discovery?region=ap-northeast-1
   ```
   - 利用可能なモデルを動的に検出
   - プロバイダー情報を自動生成
   - リージョン対応状況を確認

2. **ユーザーがUIでモデル選択**
   - プロバイダー別にグループ化
   - モデルの特性（速度、コスト、品質）を表示
   - リアルタイムで切り替え可能

3. **チャットリクエスト送信**
   ```typescript
   POST /api/bedrock/chat
   {
     "message": "質問内容",
     "model": "anthropic.claude-3-5-sonnet-20240620-v1:0",
     "region": "ap-northeast-1",
     "settings": {
       "temperature": 0.7,
       "maxTokens": 4000
     }
   }
   ```

### 対応モデル（動的検出）

#### Anthropic
- ✅ Claude 3.5 Sonnet (20240620-v1)
- ✅ Claude 3 Haiku (20240307-v1)
- ✅ Claude 3 Opus (20240229-v1)

#### Amazon
- ✅ Nova Pro (v1)
- ✅ Nova Lite (v1)
- ✅ Nova Micro (v1)

#### その他
- ✅ Meta Llama（リージョンによる）
- ✅ Cohere Command（リージョンによる）
- ✅ AI21 Jurassic（リージョンによる）

**注意**: モデル一覧は動的に検出されるため、新しいモデルが追加されても自動的に対応します。

### API実装

**ファイル**: `docker/nextjs/src/app/api/bedrock/chat/route.ts`

**主要機能**:
- ✅ 動的モデル対応（プロバイダー別のリクエスト形式）
- ✅ ストリーミング対応
- ✅ エラーハンドリング
- ✅ リージョン切り替え

**リクエスト形式の自動判定**:
```typescript
// Anthropic Claude
if (model.includes('anthropic.claude')) {
  requestBody = {
    anthropic_version: "bedrock-2023-05-31",
    messages: [{ role: "user", content: message }]
  }
}

// Amazon Nova
else if (model.includes('amazon.nova')) {
  requestBody = {
    messages: [{ role: "user", content: [{ text: message }] }],
    inferenceConfig: { ... }
  }
}

// その他のモデル（自動対応）
else {
  requestBody = {
    inputText: message,
    textGenerationConfig: { ... }
  }
}
```

---

## Agentモード（Agent Mode）

### 概要

Amazon Bedrock Agent を使用した、高度な推論とマルチステップ処理が可能なモードです。

### アーキテクチャ

```
ユーザー
  ↓
Next.js Frontend (Agent情報表示)
  ↓
POST /api/bedrock/agent
  ↓
Bedrock Agent Runtime API
  ↓
Bedrock Agent (固定モデル)
  ├─ Knowledge Base
  ├─ Action Groups
  └─ Multi-Agent Collaboration
  ↓
レスポンス
```

### モデル管理フロー

1. **CDKでAgent作成**
   ```typescript
   // lib/modules/ai/constructs/bedrock-agent-dynamic-construct.ts
   const agent = new BedrockAgentDynamicConstruct(this, 'Agent', {
     agentName: 'permission-aware-rag-agent',
     foundationModel: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
     region: 'ap-northeast-1'
   });
   ```

2. **Parameter Storeに設定保存**
   ```
   /bedrock-agent/permission-aware-rag/prod/selected_model
   /bedrock-agent/permission-aware-rag/prod/use_case
   /bedrock-agent/permission-aware-rag/prod/model_requirements
   ```

3. **Agent情報取得**
   ```typescript
   GET /api/bedrock/agent-info?agentId=1NWQJTIMAH&region=ap-northeast-1
   ```
   - Agent ID
   - Alias ID
   - 使用中のモデル
   - ステータス

4. **チャットリクエスト送信**
   ```typescript
   POST /api/bedrock/agent
   {
     "message": "質問内容",
     "agentId": "1NWQJTIMAH",
     "agentAliasId": "PV3UAZPWCO",
     "sessionId": "session-123"
   }
   ```

### モデル更新方法

#### 方法1: AWS CLI（即座に反映）

```bash
# Agent情報取得
aws bedrock-agent get-agent \
  --agent-id 1NWQJTIMAH \
  --region ap-northeast-1

# モデル更新
aws bedrock-agent update-agent \
  --agent-id 1NWQJTIMAH \
  --agent-name "permission-aware-rag-agent" \
  --foundation-model "anthropic.claude-3-5-sonnet-20240620-v1:0" \
  --region ap-northeast-1

# Agent準備
aws bedrock-agent prepare-agent \
  --agent-id 1NWQJTIMAH \
  --region ap-northeast-1
```

#### 方法2: CDK Deploy（新規環境）

```bash
# CDKデプロイ
npx cdk deploy --all \
  --app 'npx ts-node --transpile-only bin/deploy-webapp-only.ts'
```

**注意**: 既存環境では、CloudFormation Importが必要です（Phase 4で対応予定）。

### 動的モデル選択（CDK実装）

**ファイル**: `lib/modules/ai/constructs/bedrock-agent-dynamic-construct.ts`

**主要機能**:
- ✅ リージョン別最適化（14リージョン対応）
- ✅ ユースケース別最適化（chat、generation、costEffective、multimodal）
- ✅ モデル要件ベース選択（onDemand、streaming、crossRegion）
- ✅ 非推奨モデルの自動検出とフォールバック
- ✅ Parameter Store統合

**使用例**:
```typescript
const modelConfig = BedrockModelConfig.getInstance();

// 最適なモデルを取得
const optimalModel = modelConfig.getOptimalModel(
  'ap-northeast-1',  // リージョン
  'chat',            // ユースケース
  {
    onDemand: true,
    streaming: true,
    crossRegion: true
  }
);

// 結果: 'anthropic.claude-3-5-sonnet-20240620-v1:0'
```

### API実装

**ファイル**: `docker/nextjs/src/app/api/bedrock/agent/route.ts`

**主要機能**:
- ✅ Agent呼び出し
- ✅ ストリーミングレスポンス処理
- ✅ セッション管理
- ✅ エラーハンドリング

---

## 動的モデル選択システム

### 概要

新しいプロバイダーやモデルが追加されても、**コード変更なし**で自動的に対応するシステムです。

### アーキテクチャ

```
Bedrock API
  ↓
ListFoundationModels
  ↓
動的検出エンジン
  ├─ プロバイダー抽出
  ├─ モデル情報生成
  ├─ リージョン対応確認
  └─ キャッシュ保存（DynamoDB）
  ↓
フロントエンド表示
```

### 実装ファイル

1. **動的検出API**
   - `docker/nextjs/src/app/api/bedrock/models/discovery/route.ts`
   - Bedrockモデルの自動検出
   - プロバイダー情報の自動生成
   - DynamoDBキャッシュ（1時間TTL）

2. **モデル設定管理**
   - `lib/config/bedrock-model-config.ts`
   - プロバイダー設定
   - モデルファミリー管理
   - リージョン別設定

3. **CDK Construct**
   - `lib/modules/ai/constructs/bedrock-agent-dynamic-construct.ts`
   - Agent作成時の動的モデル選択
   - Parameter Store統合
   - 自動更新Lambda関数

### プロバイダー追加方法

#### 新しいプロバイダーが追加された場合

**自動対応**: コード変更不要

動的検出エンジンが自動的に以下を実行：
1. プロバイダー名を抽出（例: `mistral.mistral-7b-instruct-v0:2` → `mistral`）
2. カラーテーマを生成
3. 表示名をフォーマット
4. フロントエンドに表示

#### 手動でプロバイダー設定を追加する場合

**ファイル**: `lib/config/bedrock-model-config.ts`

```typescript
// プロバイダー追加
this.providers.set('mistral', {
  name: 'Mistral AI',
  namingPattern: 'mistral.{model-name}-{version}',
  defaultRegions: ['us-east-1', 'eu-west-1'],
  supportedFeatures: {
    onDemand: true,
    provisioned: true,
    streaming: true,
    crossRegion: true,
  },
});

// モデルファミリー追加
this.families.set('mistral-7b', {
  name: 'Mistral 7B',
  provider: 'mistral',
  defaultModel: 'mistral.mistral-7b-instruct-v0:2',
  models: [
    {
      modelId: 'mistral.mistral-7b-instruct-v0:2',
      version: 'v0.2',
      releaseDate: '2024-01-01',
      status: 'stable',
      supportedRegions: ['us-east-1', 'eu-west-1'],
      features: {
        onDemand: true,
        provisioned: true,
        streaming: true,
        crossRegion: true,
        multimodal: false,
      },
      inputModalities: ['Text'],
      outputModalities: ['Text'],
    },
  ],
});
```

### モデル追加方法

#### 新しいモデルが追加された場合

**自動対応**: コード変更不要

動的検出エンジンが自動的に以下を実行：
1. モデルIDを検出
2. プロバイダーを判定
3. モダリティを推定
4. 最大トークン数を推定
5. フロントエンドに表示

#### 手動でモデル設定を追加する場合

**ファイル**: `lib/config/bedrock-model-config.ts`

```typescript
// 既存ファミリーに新しいバージョンを追加
const modelConfig = BedrockModelConfig.getInstance();

modelConfig.addModelVersion('claude-3-5-sonnet', {
  modelId: 'anthropic.claude-3-5-sonnet-20250101-v3:0',
  version: '20250101-v3',
  releaseDate: '2025-01-01',
  status: 'stable',
  supportedRegions: ['us-east-1', 'us-west-2', 'ap-northeast-1'],
  features: {
    onDemand: true,
    provisioned: true,
    streaming: true,
    crossRegion: true,
    multimodal: false,
  },
  inputModalities: ['Text'],
  outputModalities: ['Text'],
});
```

---

## アーキテクチャ図

### 全体アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                     CloudFront Distribution                  │
│                  (Global CDN + WAF Protection)               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Lambda Function (Container)               │
│                      Next.js Application                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  Frontend (React)                     │  │
│  │  ┌─────────────────┐  ┌─────────────────┐           │  │
│  │  │   KB Mode UI    │  │  Agent Mode UI  │           │  │
│  │  │ (Model Select)  │  │ (Agent Info)    │           │  │
│  │  └─────────────────┘  └─────────────────┘           │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  API Routes                           │  │
│  │  ┌─────────────────┐  ┌─────────────────┐           │  │
│  │  │ /api/bedrock/   │  │ /api/bedrock/   │           │  │
│  │  │     chat        │  │     agent       │           │  │
│  │  └─────────────────┘  └─────────────────┘           │  │
│  │  ┌─────────────────┐  ┌─────────────────┐           │  │
│  │  │ /api/bedrock/   │  │ /api/bedrock/   │           │  │
│  │  │ models/discovery│  │   agent-info    │           │  │
│  │  └─────────────────┘  └─────────────────┘           │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────┴─────────────────────┐
        ↓                                           ↓
┌───────────────────┐                   ┌───────────────────┐
│  Bedrock Runtime  │                   │  Bedrock Agent    │
│       API         │                   │    Runtime API    │
└───────────────────┘                   └───────────────────┘
        ↓                                           ↓
┌───────────────────┐                   ┌───────────────────┐
│  Selected Model   │                   │  Bedrock Agent    │
│  (Claude, Nova)   │                   │  (Fixed Model)    │
└───────────────────┘                   └───────────────────┘
        ↓                                           ↓
┌───────────────────┐                   ┌───────────────────┐
│ Knowledge Base    │                   │ Knowledge Base    │
│ (OpenSearch)      │                   │ + Action Groups   │
└───────────────────┘                   └───────────────────┘
```

### データフロー

#### KBモード

```
1. ユーザーがモデル選択
   ↓
2. GET /api/bedrock/models/discovery
   ↓
3. 利用可能なモデル一覧を表示
   ↓
4. ユーザーがメッセージ送信
   ↓
5. POST /api/bedrock/chat
   {
     "message": "質問",
     "model": "anthropic.claude-3-5-sonnet-20240620-v1:0"
   }
   ↓
6. Bedrock Runtime API呼び出し
   ↓
7. 選択されたモデルで推論
   ↓
8. Knowledge Base検索
   ↓
9. レスポンス返却
```

#### Agentモード

```
1. ページロード時にAgent情報取得
   ↓
2. GET /api/bedrock/agent-info
   ↓
3. Agent情報を表示（モデルは固定）
   ↓
4. ユーザーがメッセージ送信
   ↓
5. POST /api/bedrock/agent
   {
     "message": "質問",
     "agentId": "1NWQJTIMAH"
   }
   ↓
6. Bedrock Agent Runtime API呼び出し
   ↓
7. Agent内部で推論（固定モデル）
   ↓
8. Knowledge Base検索 + Action Groups実行
   ↓
9. レスポンス返却
```

---

## デプロイメント

### 前提条件

- AWS CLI設定済み
- Node.js 20+
- Docker
- CDK v2

### Lambda VPC配置オプション

このシステムは、Lambda関数のVPC配置を柔軟に設定できます。

#### VPC外配置（デフォルト）

**特徴**:
- ✅ シンプルな構成、VPC設定不要
- ✅ 低コスト（$0/月）
- ✅ 高速起動（Cold Start ~1秒）
- ✅ インターネット経由でAWSサービスにアクセス

**設定**:
```typescript
lambda: {
  vpc: {
    enabled: false, // VPC外に配置（デフォルト）
  },
}
```

**推奨用途**: 開発環境、プロトタイピング、コスト最適化優先

#### VPC内配置（推奨）

**特徴**:
- ✅ セキュリティ強化（プライベートネットワーク内）
- ✅ データ主権（データがVPC外に出ない）
- ✅ 低レイテンシ（VPC Endpoint経由）
- ✅ コンプライアンス対応

**設定**:
```typescript
lambda: {
  vpc: {
    enabled: true, // VPC内に配置
    endpoints: {
      dynamodb: true,           // 無料（Gateway Endpoint）
      bedrockRuntime: true,     // $7.2/月（Interface Endpoint）
      bedrockAgentRuntime: true, // $7.2/月（Interface Endpoint）
    },
  },
}
```

**VPC Endpoint料金**: $14.4/月（Bedrock使用時）

**推奨用途**: 本番環境、セキュリティ要件が高い場合、コンプライアンス対応

**詳細**: [Lambda VPC配置ガイド](guides/lambda-vpc-deployment-guide.md)

### デプロイ手順

#### 1. 依存関係インストール

```bash
npm install
```

#### 2. Lambda VPC配置の設定（オプション）

```bash
# VPC内配置に変更する場合
vim lib/config/environments/webapp-standalone-config.ts

# 以下のように設定
lambda: {
  vpc: {
    enabled: true,
    endpoints: {
      dynamodb: true,
      bedrockRuntime: true,
      bedrockAgentRuntime: true,
    },
  },
}
```

#### 3. CDKビルド

```bash
npm run build
```

#### 4. CDKデプロイ

**全スタックデプロイ**:
```bash
npx cdk deploy --all
```

**WebAppスタックのみ**:
```bash
npx cdk deploy --all \
  --app 'npx ts-node --transpile-only bin/deploy-webapp-only.ts'
```

#### 5. VPC設定の確認（VPC内配置の場合）

```bash
# Lambda関数のVPC設定を確認
aws lambda get-function-configuration \
  --function-name [FUNCTION_NAME] \
  --query 'VpcConfig' \
  --output json

# VPC Endpointの確認
aws ec2 describe-vpc-endpoints \
  --filters "Name=vpc-id,Values=[VPC_ID]" \
  --query 'VpcEndpoints[*].[ServiceName,State]' \
  --output table
```

#### 6. 環境変数設定

Lambda関数に以下の環境変数を設定：

```bash
BEDROCK_AGENT_ID=1NWQJTIMAH
BEDROCK_AGENT_ALIAS_ID=PV3UAZPWCO
BEDROCK_REGION=ap-northeast-1
AWS_REGION=ap-northeast-1
```

#### 7. 動作確認

```bash
# KBモード
curl -X POST https://your-cloudfront-domain.cloudfront.net/api/bedrock/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello",
    "model": "anthropic.claude-3-5-sonnet-20240620-v1:0",
    "region": "ap-northeast-1"
  }'

# Agentモード
curl -X POST https://your-cloudfront-domain.cloudfront.net/api/bedrock/agent \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello",
    "agentId": "1NWQJTIMAH",
    "agentAliasId": "PV3UAZPWCO"
  }'
```

---

## トラブルシューティング

### KBモードでモデルが表示されない

**原因**: 動的検出APIがエラー

**対処法**:
1. CloudWatch Logsを確認
2. Bedrock APIアクセス権限を確認
3. リージョンがBedrockをサポートしているか確認

### Agentモードで500エラー

**原因**: Agent設定またはIAM権限の問題

**対処法**:
1. Agent IDが正しいか確認
2. `bedrock:InvokeAgent`権限があるか確認
3. Agentが`PREPARED`状態か確認

### モデル切り替えが反映されない

**KBモード**: 即座に反映されるはず → キャッシュクリア

**Agentモード**: Agent更新が必要 → `PrepareAgent`を実行

### Lambda Cold Startが遅い（VPC内配置の場合）

**原因**: VPC内配置によるENI作成時間

**対処法**:
1. Provisioned Concurrencyを使用
2. または、VPC外配置に変更（開発環境の場合）

---

## 関連ドキュメント

- [README.md](../README.md) - プロジェクト概要
- [DEPLOYMENT.md](./DEPLOYMENT.md) - デプロイメントガイド
- [Lambda VPC配置ガイド](guides/lambda-vpc-deployment-guide.md) - VPC配置の詳細
- [API.md](./API.md) - API仕様書
- [CDK.md](./CDK.md) - CDK実装ガイド

---

**作成者**: Kiro AI  
**作成日**: 2025-12-30  
**ステータス**: アクティブ
