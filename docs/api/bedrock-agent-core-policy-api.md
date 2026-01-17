# Bedrock Agent Core Policy API仕様書

**バージョン**: 1.0.0  
**最終更新**: 2026-01-04

---

## 目次

1. [概要](#概要)
2. [Construct API](#construct-api)
3. [自然言語ポリシーAPI](#自然言語ポリシーapi)
4. [Cedar統合API](#cedar統合api)
5. [ポリシー管理API](#ポリシー管理api)
6. [データストレージ](#データストレージ)
7. [セキュリティ](#セキュリティ)

---

## 概要

Bedrock Agent Core Policy APIは、自然言語ポリシー、Cedar統合、ポリシー管理機能を提供します。

### 主要機能

- **自然言語ポリシー**: 自然言語でポリシーを記述し、自動的にCedar形式に変換
- **Cedar統合**: Cedar Policy Languageによる形式的検証と競合検出
- **ポリシー管理**: CRUD操作、バージョン管理、承認ワークフロー、監査ログ

### アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                  Policy Construct                            │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Natural      │  │ Cedar        │  │ Policy       │     │
│  │ Language     │→ │ Integration  │→ │ Management   │     │
│  │ Parser       │  │              │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         ↓                  ↓                  ↓             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Bedrock      │  │ Formal       │  │ S3 + DynamoDB│     │
│  │ Claude 3     │  │ Verification │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## Construct API

### BedrockAgentCorePolicyConstruct

Bedrock Agent Coreのポリシー管理機能を提供するConstruct。

#### コンストラクタ

```typescript
new BedrockAgentCorePolicyConstruct(
  scope: Construct,
  id: string,
  props: BedrockAgentCorePolicyConstructProps
)
```

#### プロパティ

##### BedrockAgentCorePolicyConstructProps

| プロパティ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|-----------|------|
| enabled | boolean | ✓ | - | Policy機能を有効化 |
| projectName | string | ✓ | - | プロジェクト名 |
| environment | string | ✓ | - | 環境名（dev, staging, prod等） |
| naturalLanguagePolicyConfig | NaturalLanguagePolicyConfig | - | - | 自然言語ポリシー設定 |
| cedarIntegrationConfig | CedarIntegrationConfig | - | - | Cedar統合設定 |
| policyManagementConfig | PolicyManagementConfig | - | - | ポリシー管理設定 |
| policyRetentionDays | number | - | 365 | ポリシー保持期間（日数） |
| tags | Record<string, string> | - | - | タグ |

##### NaturalLanguagePolicyConfig

| プロパティ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|-----------|------|
| enabled | boolean | ✓ | - | 自然言語ポリシーを有効化 |
| parserModel | string | - | claude-3-sonnet | パーサーモデル |
| autoConversion | boolean | - | true | 自動Cedar変換を有効化 |
| useTemplates | boolean | - | true | ポリシーテンプレートを使用 |

##### CedarIntegrationConfig

| プロパティ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|-----------|------|
| enabled | boolean | ✓ | - | Cedar統合を有効化 |
| formalVerification | boolean | - | true | 形式的検証を有効化 |
| conflictDetection | boolean | - | true | 競合検出を有効化 |
| policyOptimization | boolean | - | false | ポリシー最適化を有効化 |

##### PolicyManagementConfig

| プロパティ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|-----------|------|
| enabled | boolean | ✓ | - | ポリシー管理を有効化 |
| versionControl | boolean | - | true | バージョン管理を有効化 |
| auditLogging | boolean | - | true | 監査ログを有効化 |
| approvalWorkflow | boolean | - | false | 承認ワークフローを有効化 |
| reviewPeriodDays | number | - | 90 | ポリシーレビュー期間（日数） |

#### パブリックプロパティ

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| policyBucket | s3.IBucket | ポリシー保存用S3バケット |
| policyTable | dynamodb.ITable | ポリシーメタデータ保存用DynamoDBテーブル |
| auditLogTable | dynamodb.ITable \| undefined | 監査ログ保存用DynamoDBテーブル |
| logGroup | logs.ILogGroup | ログループ |

#### メソッド

##### grantPolicyBucketAccess

ポリシーバケットへのアクセス権限を付与します。

```typescript
grantPolicyBucketAccess(grantee: iam.IGrantable): iam.Grant
```

**パラメータ**:
- `grantee`: 権限を付与する対象（Lambda関数、IAMロール等）

**戻り値**: IAM Grant

##### grantPolicyTableAccess

ポリシーテーブルへのアクセス権限を付与します。

```typescript
grantPolicyTableAccess(grantee: iam.IGrantable): iam.Grant
```

**パラメータ**:
- `grantee`: 権限を付与する対象

**戻り値**: IAM Grant

##### grantAuditLogTableAccess

監査ログテーブルへのアクセス権限を付与します。

```typescript
grantAuditLogTableAccess(grantee: iam.IGrantable): iam.Grant
```

**パラメータ**:
- `grantee`: 権限を付与する対象

**戻り値**: IAM Grant

#### 使用例

```typescript
import { BedrockAgentCorePolicyConstruct } from './constructs/bedrock-agent-core-policy-construct';

const policy = new BedrockAgentCorePolicyConstruct(this, 'Policy', {
  enabled: true,
  projectName: 'my-project',
  environment: 'production',
  naturalLanguagePolicyConfig: {
    enabled: true,
    parserModel: 'anthropic.claude-3-sonnet-20240229-v1:0',
    autoConversion: true,
    useTemplates: true,
  },
  cedarIntegrationConfig: {
    enabled: true,
    formalVerification: true,
    conflictDetection: true,
  },
  policyManagementConfig: {
    enabled: true,
    versionControl: true,
    auditLogging: true,
    approvalWorkflow: true,
  },
  tags: {
    Environment: 'production',
    Project: 'my-project',
  },
});

// Lambda関数に権限を付与
policy.grantPolicyBucketAccess(myLambdaFunction);
policy.grantPolicyTableAccess(myLambdaFunction);
```

---

## 自然言語ポリシーAPI

### Lambda関数アクション

#### parse-policy

自然言語ポリシーをパースします。

**リクエスト**:
```json
{
  "action": "parse-policy",
  "payload": {
    "policy": "ユーザー user-123 に Document doc-456 への 読み取り を許可する",
    "language": "ja"
  }
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "principal": {
      "type": "user",
      "identifier": "user-123"
    },
    "action": {
      "type": "allow",
      "operations": ["read"]
    },
    "resource": {
      "type": "Document",
      "identifier": "doc-456"
    },
    "metadata": {
      "description": "ユーザーにドキュメントへの読み取りを許可",
      "confidence": 0.95,
      "language": "ja"
    }
  }
}
```

#### generate-from-template

テンプレートからポリシーを生成します。

**リクエスト**:
```json
{
  "action": "generate-from-template",
  "payload": {
    "templateId": "basic-allow",
    "variables": {
      "userId": "user-123",
      "operation": "読み取り",
      "resourceType": "Document",
      "resourceId": "doc-456"
    }
  }
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "policy": "ユーザー user-123 に Document doc-456 への 読み取り を許可する"
  }
}
```

#### get-templates

利用可能なテンプレート一覧を取得します。

**リクエスト**:
```json
{
  "action": "get-templates",
  "payload": {
    "category": "access-control"
  }
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": [
    {
      "id": "basic-allow",
      "name": "基本的なアクセス許可",
      "description": "特定のユーザーに特定のリソースへのアクセスを許可",
      "category": "access-control",
      "variables": ["userId", "operation", "resourceType", "resourceId"]
    }
  ]
}
```

---

## Cedar統合API

### validate-cedar

Cedarポリシーを検証します。

**リクエスト**:
```json
{
  "action": "validate-cedar",
  "payload": {
    "cedarPolicy": {
      "id": "policy-001",
      "effect": "permit",
      "principal": "User::\"user-123\"",
      "action": "Action::\"read\"",
      "resource": "Document::\"doc-456\""
    }
  }
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "errors": [],
    "warnings": []
  }
}
```

### formal-verification

形式的検証を実行します。

**リクエスト**:
```json
{
  "action": "formal-verification",
  "payload": {
    "policies": [
      {
        "id": "policy-001",
        "effect": "permit",
        "principal": "User::\"user-123\"",
        "action": "Action::\"read\"",
        "resource": "Document::\"doc-456\""
      }
    ]
  }
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "isConsistent": true,
    "isComplete": true,
    "hasDeadCode": false,
    "reachabilityAnalysis": {
      "reachablePolicies": ["policy-001"],
      "unreachablePolicies": [],
      "shadowedPolicies": []
    },
    "conflictAnalysis": {
      "conflicts": [],
      "redundancies": [],
      "gaps": []
    }
  }
}
```

---

## ポリシー管理API

### create-policy

ポリシーを作成します。

**リクエスト**:
```json
{
  "action": "create-policy",
  "payload": {
    "policy": {
      "metadata": {
        "policyId": "policy-001",
        "agentId": "agent-123",
        "description": "ユーザーにドキュメントへの読み取りを許可",
        "tags": {
          "department": "sales"
        }
      },
      "parsedPolicy": { },
      "cedarPolicy": { },
      "cedarText": "permit(...)"
    },
    "userId": "admin-001"
  }
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "policyId": "policy-001",
    "version": 1
  }
}
```

### get-policy

ポリシーを取得します。

**リクエスト**:
```json
{
  "action": "get-policy",
  "payload": {
    "policyId": "policy-001",
    "version": 1
  }
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "metadata": {
      "policyId": "policy-001",
      "version": 1,
      "status": "active",
      "createdAt": "2026-01-04T10:00:00Z"
    },
    "parsedPolicy": { },
    "cedarPolicy": { },
    "cedarText": "permit(...)"
  }
}
```

### search-policies

ポリシーを検索します。

**リクエスト**:
```json
{
  "action": "search-policies",
  "payload": {
    "agentId": "agent-123",
    "status": "active",
    "limit": 20
  }
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "policies": [
      {
        "policyId": "policy-001",
        "version": 1,
        "status": "active",
        "description": "ユーザーにドキュメントへの読み取りを許可"
      }
    ],
    "nextToken": "eyJ..."
  }
}
```

### approve-policy

ポリシーを承認します。

**リクエスト**:
```json
{
  "action": "approve-policy",
  "payload": {
    "policyId": "policy-001",
    "userId": "approver-001"
  }
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": {
    "success": true
  }
}
```

### get-audit-logs

監査ログを取得します。

**リクエスト**:
```json
{
  "action": "get-audit-logs",
  "payload": {
    "policyId": "policy-001",
    "limit": 10
  }
}
```

**レスポンス**:
```json
{
  "success": true,
  "data": [
    {
      "logId": "log-001",
      "policyId": "policy-001",
      "timestamp": 1704355200000,
      "action": "create",
      "userId": "admin-001"
    }
  ]
}
```

---

## データストレージ

### S3バケット構造

```
policies/
└── {policyId}/
    ├── v1.json
    ├── v2.json
    └── v3.json
```

### DynamoDBテーブル構造

#### ポリシーメタデータテーブル

| 属性 | 型 | キー | 説明 |
|------|-----|------|------|
| policyId | String | PK | ポリシーID |
| version | Number | SK | バージョン番号 |
| agentId | String | GSI1-PK | エージェントID |
| status | String | GSI2-PK | ステータス |
| createdAt | String | GSI1-SK | 作成日時 |
| updatedAt | String | GSI2-SK | 更新日時 |

#### 監査ログテーブル

| 属性 | 型 | キー | 説明 |
|------|-----|------|------|
| logId | String | PK | ログID |
| timestamp | Number | SK | タイムスタンプ |
| policyId | String | GSI1-PK | ポリシーID |
| userId | String | GSI2-PK | ユーザーID |
| action | String | - | アクション |
| ttl | Number | TTL | 有効期限 |

---

## セキュリティ

### 暗号化

- **S3**: KMS暗号化（カスタムキーまたはS3マネージド）
- **DynamoDB**: KMS暗号化
- **CloudWatch Logs**: KMS暗号化

### アクセス制御

- **IAM**: 最小権限の原則
- **S3**: パブリックアクセスブロック
- **DynamoDB**: 削除保護（本番環境）

### 監査

- **全操作**: 監査ログ記録
- **バージョン管理**: 全変更履歴保持
- **承認ワークフロー**: 承認者記録

---

## エラーコード

| コード | 説明 |
|--------|------|
| INVALID_PRINCIPAL | Principalが無効 |
| INVALID_ACTION | Actionが無効 |
| INVALID_RESOURCE | Resourceが無効 |
| POLICY_NOT_FOUND | ポリシーが見つからない |
| VALIDATION_FAILED | 検証失敗 |
| CONFLICT_DETECTED | 競合検出 |
| UNAUTHORIZED | 権限なし |

---

## 変更履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|----------|
| 1.0.0 | 2026-01-04 | 初版リリース |

---

**作成者**: Kiro AI  
**最終更新**: 2026-01-04
