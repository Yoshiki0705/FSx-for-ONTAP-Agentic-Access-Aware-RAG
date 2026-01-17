# Policy設定ガイド

**作成日**: 2026-01-04  
**バージョン**: 1.0.0

---

## 📋 概要

このガイドでは、BedrockAgentCorePolicyConstructを使用して、Bedrock Agentのポリシー管理・Cedar統合・自然言語ポリシー機能を設定する方法を説明します。

---

## 🎯 主な機能

### 1. 自然言語ポリシー
- 日本語・英語でのポリシー記述
- Amazon Bedrock Claude 3による解析
- 構造化されたポリシー生成

### 2. Cedar統合
- Cedar Policy Language変換
- 形式検証（Formal Verification）
- 競合検出（Conflict Detection）
- 到達可能性分析（Reachability Analysis）

### 3. ポリシー管理
- CRUD操作
- バージョン管理
- 承認ワークフロー
- 監査ログ
- 検索機能

### 4. セキュリティ
- S3暗号化（ポリシーストレージ）
- DynamoDB暗号化（メタデータ・監査ログ）
- IAM権限管理

---

## 🚀 基本的な使い方

### 最小限の設定

```typescript
import { BedrockAgentCorePolicyConstruct } from './lib/modules/ai/constructs/bedrock-agent-core-policy-construct';

const policy = new BedrockAgentCorePolicyConstruct(this, 'Policy', {
  enabled: true,
  projectName: 'my-project',
  environment: 'production',
});
```

### 完全な設定

```typescript
const policy = new BedrockAgentCorePolicyConstruct(this, 'Policy', {
  enabled: true,
  projectName: 'my-project',
  environment: 'production',
  
  // 自然言語ポリシー設定
  naturalLanguagePolicyConfig: {
    enabled: true,
    supportedLanguages: ['ja', 'en'],
    bedrockModelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    maxTokens: 4096,
    temperature: 0.0,
  },
  
  // Cedar統合設定
  cedarIntegrationConfig: {
    enabled: true,
    formalVerification: true,
    conflictDetection: true,
    reachabilityAnalysis: true,
    validationLevel: 'strict',
  },
  
  // ポリシー管理設定
  policyManagementConfig: {
    enabled: true,
    versioningEnabled: true,
    approvalWorkflow: true,
    auditLogging: true,
    searchEnabled: true,
    maxVersionsPerPolicy: 10,
    retentionDays: 90,
  },
  
  // タグ
  tags: {
    Team: 'Security',
    CostCenter: 'Compliance',
  },
});
```

---

## 📝 自然言語ポリシーの作成

### 日本語でのポリシー記述

```typescript
const naturalLanguagePolicy = `
ユーザーが自分のドキュメントを読むことを許可する。
ただし、機密レベルが「極秘」のドキュメントは除外する。
また、ユーザーが所属する部署のドキュメントのみアクセス可能とする。
`;

// Lambda関数を呼び出してポリシーを解析
const response = await lambda.invoke({
  FunctionName: 'PolicyFunction',
  Payload: JSON.stringify({
    action: 'parse-policy',
    naturalLanguagePolicy,
    language: 'ja',
  }),
});
```

### 英語でのポリシー記述

```typescript
const naturalLanguagePolicy = `
Allow users to read their own documents.
Exclude documents with confidentiality level "top-secret".
Users can only access documents belonging to their department.
`;

const response = await lambda.invoke({
  FunctionName: 'PolicyFunction',
  Payload: JSON.stringify({
    action: 'parse-policy',
    naturalLanguagePolicy,
    language: 'en',
  }),
});
```

---

## 🔄 Cedar Policy Languageへの変換

### 自然言語からCedarへの変換

```typescript
// Step 1: 自然言語ポリシーを解析
const parseResponse = await lambda.invoke({
  FunctionName: 'PolicyFunction',
  Payload: JSON.stringify({
    action: 'parse-policy',
    naturalLanguagePolicy: '...',
    language: 'ja',
  }),
});

const parsedPolicy = JSON.parse(parseResponse.Payload).parsedPolicy;

// Step 2: CedarポリシーテキストとJSONに変換
const convertResponse = await lambda.invoke({
  FunctionName: 'PolicyFunction',
  Payload: JSON.stringify({
    action: 'convert-to-cedar',
    parsedPolicy,
  }),
});

const { cedarPolicyText, cedarPolicyJson } = JSON.parse(convertResponse.Payload);
```

### ワンステップ変換

```typescript
// 解析と変換を一度に実行
const response = await lambda.invoke({
  FunctionName: 'PolicyFunction',
  Payload: JSON.stringify({
    action: 'parse-and-convert',
    naturalLanguagePolicy: '...',
    language: 'ja',
  }),
});

const { parsedPolicy, cedarPolicyText, cedarPolicyJson } = JSON.parse(response.Payload);
```

---

## ✅ ポリシー検証

### 基本的な検証

```typescript
const response = await lambda.invoke({
  FunctionName: 'PolicyFunction',
  Payload: JSON.stringify({
    action: 'validate-policy',
    parsedPolicy,
  }),
});

const validationResult = JSON.parse(response.Payload);
console.log('検証結果:', validationResult.isValid);
console.log('スコア:', validationResult.score);
console.log('問題:', validationResult.issues);
```

### Cedar形式検証

```typescript
const response = await lambda.invoke({
  FunctionName: 'PolicyFunction',
  Payload: JSON.stringify({
    action: 'validate-cedar',
    cedarPolicyText: '...',
  }),
});

const { isValid, errors } = JSON.parse(response.Payload);
```

### 形式検証（Formal Verification）

```typescript
const response = await lambda.invoke({
  FunctionName: 'PolicyFunction',
  Payload: JSON.stringify({
    action: 'formal-verification',
    cedarPolicyText: '...',
  }),
});

const { isValid, properties, counterexamples } = JSON.parse(response.Payload);
```

---

## 🔍 競合検出

### ポリシー間の競合検出

```typescript
const response = await lambda.invoke({
  FunctionName: 'PolicyFunction',
  Payload: JSON.stringify({
    action: 'detect-conflicts',
    policies: [parsedPolicy1, parsedPolicy2, parsedPolicy3],
  }),
});

const { hasConflicts, conflicts } = JSON.parse(response.Payload);

if (hasConflicts) {
  conflicts.forEach(conflict => {
    console.log('競合タイプ:', conflict.type);
    console.log('影響を受けるポリシー:', conflict.affectedPolicies);
    console.log('推奨解決策:', conflict.resolution);
  });
}
```

---

## 📚 ポリシーテンプレート

### 組み込みテンプレートの使用

```typescript
// テンプレート一覧取得
const templatesResponse = await lambda.invoke({
  FunctionName: 'PolicyFunction',
  Payload: JSON.stringify({
    action: 'get-templates',
  }),
});

const templates = JSON.parse(templatesResponse.Payload).templates;

// テンプレートからポリシー生成
const generateResponse = await lambda.invoke({
  FunctionName: 'PolicyFunction',
  Payload: JSON.stringify({
    action: 'generate-from-template',
    templateId: 'document-read-own',
    parameters: {
      resourceType: 'Document',
      action: 'read',
    },
  }),
});

const generatedPolicy = JSON.parse(generateResponse.Payload).policy;
```

### 利用可能なテンプレート

1. **document-read-own**: 自分のドキュメント読み取り
2. **document-write-own**: 自分のドキュメント書き込み
3. **document-read-department**: 部署のドキュメント読み取り
4. **document-read-confidential**: 機密レベル制限付き読み取り
5. **document-admin**: ドキュメント管理者権限
6. **time-based-access**: 時間ベースアクセス制御
7. **ip-based-access**: IPアドレスベースアクセス制御
8. **role-based-access**: ロールベースアクセス制御
9. **attribute-based-access**: 属性ベースアクセス制御
10. **deny-all**: 全拒否ポリシー

---

## 💾 ポリシー管理

### ポリシーの作成

```typescript
const response = await lambda.invoke({
  FunctionName: 'PolicyFunction',
  Payload: JSON.stringify({
    action: 'create-policy',
    policyData: {
      name: 'document-read-policy',
      description: 'ドキュメント読み取りポリシー',
      parsedPolicy,
      cedarPolicyText,
      cedarPolicyJson,
      tags: ['document', 'read'],
    },
  }),
});

const { policyId } = JSON.parse(response.Payload);
```

### ポリシーの取得

```typescript
const response = await lambda.invoke({
  FunctionName: 'PolicyFunction',
  Payload: JSON.stringify({
    action: 'get-policy',
    policyId: 'policy-123',
  }),
});

const policy = JSON.parse(response.Payload).policy;
```

### ポリシーの更新

```typescript
const response = await lambda.invoke({
  FunctionName: 'PolicyFunction',
  Payload: JSON.stringify({
    action: 'update-policy',
    policyId: 'policy-123',
    updates: {
      description: '更新されたドキュメント読み取りポリシー',
      parsedPolicy: updatedParsedPolicy,
      cedarPolicyText: updatedCedarText,
    },
  }),
});
```

### ポリシーの削除

```typescript
const response = await lambda.invoke({
  FunctionName: 'PolicyFunction',
  Payload: JSON.stringify({
    action: 'delete-policy',
    policyId: 'policy-123',
  }),
});
```

---

## 🔎 ポリシー検索

### タグによる検索

```typescript
const response = await lambda.invoke({
  FunctionName: 'PolicyFunction',
  Payload: JSON.stringify({
    action: 'search-policies',
    filters: {
      tags: ['document', 'read'],
    },
  }),
});

const policies = JSON.parse(response.Payload).policies;
```

### ステータスによる検索

```typescript
const response = await lambda.invoke({
  FunctionName: 'PolicyFunction',
  Payload: JSON.stringify({
    action: 'search-policies',
    filters: {
      status: 'active',
    },
  }),
});
```

---

## ✅ 承認ワークフロー

### ポリシーの承認

```typescript
const response = await lambda.invoke({
  FunctionName: 'PolicyFunction',
  Payload: JSON.stringify({
    action: 'approve-policy',
    policyId: 'policy-123',
    approver: 'user@example.com',
    comment: '承認しました',
  }),
});
```

### ポリシーの却下

```typescript
const response = await lambda.invoke({
  FunctionName: 'PolicyFunction',
  Payload: JSON.stringify({
    action: 'reject-policy',
    policyId: 'policy-123',
    approver: 'user@example.com',
    comment: '修正が必要です',
  }),
});
```

---

## 🔄 バージョン管理

### バージョン履歴の取得

```typescript
const response = await lambda.invoke({
  FunctionName: 'PolicyFunction',
  Payload: JSON.stringify({
    action: 'get-policy-versions',
    policyId: 'policy-123',
  }),
});

const versions = JSON.parse(response.Payload).versions;
```

---

## 📊 監査ログ

### 監査ログの取得

```typescript
const response = await lambda.invoke({
  FunctionName: 'PolicyFunction',
  Payload: JSON.stringify({
    action: 'get-audit-logs',
    filters: {
      policyId: 'policy-123',
      startTime: '2026-01-01T00:00:00Z',
      endTime: '2026-01-31T23:59:59Z',
    },
  }),
});

const logs = JSON.parse(response.Payload).logs;
```

---

## 🔧 Lambda統合

### Lambda関数への権限付与

```typescript
// ポリシーバケットへの読み取り権限
policy.grantPolicyBucketRead(myLambdaFunction);

// ポリシーバケットへの書き込み権限
policy.grantPolicyBucketWrite(myLambdaFunction);

// メタデータテーブルへの読み取り権限
policy.grantMetadataTableRead(myLambdaFunction);

// メタデータテーブルへの書き込み権限
policy.grantMetadataTableWrite(myLambdaFunction);

// 監査ログテーブルへの書き込み権限
policy.grantAuditLogTableWrite(myLambdaFunction);
```

---

## 🎯 ベストプラクティス

### 1. ポリシー命名規則

- **形式**: `{resource-type}-{action}-{scope}`
- **例**: `document-read-own`, `document-write-department`

### 2. バージョン管理

- 重要な変更は必ず新しいバージョンとして保存
- 最大バージョン数: 10（デフォルト）
- 古いバージョンは自動的にアーカイブ

### 3. 承認ワークフロー

- **開発環境**: 承認不要
- **ステージング環境**: 1名の承認が必要
- **本番環境**: 2名の承認が必要

### 4. 監査ログ保持期間

- **開発環境**: 30日
- **ステージング環境**: 60日
- **本番環境**: 90日以上

### 5. タグ付け

必須タグ：
- `Environment`: 環境名（dev, staging, prod）
- `ResourceType`: リソースタイプ（Document, User等）
- `Action`: アクション（read, write, delete等）
- `Owner`: ポリシー所有者

---

## 🔧 トラブルシューティング

### 自然言語ポリシーの解析に失敗する

**原因**: ポリシーが曖昧または複雑すぎる

**解決策**:
- ポリシーを簡潔に記述する
- 1つのポリシーに1つの目的を持たせる
- 具体的な条件を明示する

### Cedar変換エラー

**原因**: 解析されたポリシーが不完全

**解決策**:
```typescript
// 検証を実行してから変換
const validationResponse = await lambda.invoke({
  FunctionName: 'PolicyFunction',
  Payload: JSON.stringify({
    action: 'validate-policy',
    parsedPolicy,
  }),
});

if (validationResponse.isValid) {
  // 変換を実行
}
```

### 競合検出が動作しない

**原因**: Cedar統合が無効化されている

**解決策**:
```typescript
cedarIntegrationConfig: {
  enabled: true,
  conflictDetection: true,
}
```

### 承認ワークフローが動作しない

**原因**: ポリシー管理設定で承認ワークフローが無効化されている

**解決策**:
```typescript
policyManagementConfig: {
  enabled: true,
  approvalWorkflow: true,
}
```

---

## 📚 関連ドキュメント

- [Policy API仕様書](../api/bedrock-agent-core-policy-api.md)
- [Cedar Policy Language公式ドキュメント](https://www.cedarpolicy.com/)
- [Amazon Bedrock公式ドキュメント](https://docs.aws.amazon.com/bedrock/)
- [運用・保守ガイド](./OPERATIONS_MAINTENANCE_GUIDE_JA.md)

---

**このガイドは継続的に更新されます。**
