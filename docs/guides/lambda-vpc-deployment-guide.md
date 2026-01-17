# Lambda VPC配置ガイド

**最終更新**: 2025年12月30日  
**Phase**: Phase 2 - Task 7  
**ステータス**: 実装完了

## 📋 概要

このガイドは、AWS Lambda関数のVPC配置オプションと、Bedrock VPC Endpointの統合について説明します。Phase 2 - Task 7で実装されたCDK統合により、設定ファイルで簡単にVPC配置を切り替えることができます。

## 🎯 Lambda VPC配置オプション

### VPC外配置（デフォルト）

**特徴**:
- ✅ **シンプルな構成**: VPC設定不要
- ✅ **低コスト**: VPC Endpoint料金不要（$0/月）
- ✅ **高速起動**: Cold Start時間が短い（~1秒）
- ✅ **インターネット経由**: パブリックエンドポイント経由でAWSサービスにアクセス

**設定例**:
```typescript
// lib/config/environments/webapp-standalone-config.ts
export const webAppConfig: WebAppStackConfig = {
  lambda: {
    vpc: {
      enabled: false, // VPC外に配置（デフォルト）
    },
  },
};
```

**推奨用途**:
- 開発環境
- プロトタイピング
- コスト最適化が優先される場合
- 迅速なデプロイが必要な場合

**アーキテクチャ図**:
```
┌─────────────────────────────────────────────────────────────────┐
│                    Lambda Function (VPC外)                       │
│                  Runtime: Node.js 20.x                           │
└────────┬────────────┬────────────┬────────────────────────────┘
         │            │            │
         │ Internet   │ Internet   │ Internet
         ▼            ▼            ▼
┌────────────┐ ┌────────────┐ ┌────────────────┐
│  DynamoDB  │ │  Bedrock   │ │ Bedrock Agent  │
│  (Public)  │ │  (Public)  │ │    (Public)    │
└────────────┘ └────────────┘ └────────────────┘
```

### VPC内配置（推奨）

**特徴**:
- ✅ **セキュリティ強化**: プライベートネットワーク内で動作
- ✅ **データ主権**: データがVPC外に出ない
- ✅ **低レイテンシ**: VPC Endpoint経由で直接アクセス
- ✅ **コンプライアンス**: 規制要件に対応

**設定例**:
```typescript
// lib/config/environments/webapp-standalone-config.ts
export const webAppConfig: WebAppStackConfig = {
  lambda: {
    vpc: {
      enabled: true, // VPC内に配置
      endpoints: {
        dynamodb: true,           // 無料（Gateway Endpoint）
        bedrockRuntime: true,     // $7.2/月（Interface Endpoint）
        bedrockAgentRuntime: true, // $7.2/月（Interface Endpoint）
      },
    },
  },
};
```

**VPC Endpoint料金**:
- **DynamoDB**: 無料（Gateway Endpoint）
- **Bedrock Runtime**: $7.2/月（Interface Endpoint）
- **Bedrock Agent Runtime**: $7.2/月（Interface Endpoint）
- **合計**: $14.4/月（Bedrock使用時）

**推奨用途**:
- 本番環境
- セキュリティ要件が高い場合
- コンプライアンス対応が必要な場合
- データ主権が重要な場合

**アーキテクチャ図**:
```
┌─────────────────────────────────────────────────────────────────┐
│                         VPC                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Lambda Function (VPC内)                        │ │
│  │            Runtime: Node.js 20.x                            │ │
│  └────────┬────────────┬────────────┬─────────────────────────┘ │
│           │            │            │                            │
│           │ VPC EP     │ VPC EP     │ VPC EP                     │
│           ▼            ▼            ▼                            │
│  ┌────────────┐ ┌────────────┐ ┌────────────────┐              │
│  │  DynamoDB  │ │  Bedrock   │ │ Bedrock Agent  │              │
│  │  VPC EP    │ │  VPC EP    │ │    VPC EP      │              │
│  └────────────┘ └────────────┘ └────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 VPC配置の切り替え手順

### Step 1: 設定ファイルを編集

```bash
# 設定ファイルを開く
vim lib/config/environments/webapp-standalone-config.ts
```

**VPC外配置（デフォルト）**:
```typescript
export const webAppConfig: WebAppStackConfig = {
  lambda: {
    vpc: {
      enabled: false, // VPC外に配置
    },
  },
};
```

**VPC内配置（推奨）**:
```typescript
export const webAppConfig: WebAppStackConfig = {
  lambda: {
    vpc: {
      enabled: true, // VPC内に配置
      endpoints: {
        dynamodb: true,           // 無料
        bedrockRuntime: true,     // $7.2/月
        bedrockAgentRuntime: true, // $7.2/月
      },
    },
  },
};
```

### Step 2: CDKデプロイ

```bash
# 全スタックデプロイ
npx cdk deploy --all

# または WebAppスタックのみ
npx cdk deploy TokyoRegion-permission-aware-rag-prod-WebApp
```

### Step 3: VPC設定の確認

```bash
# Lambda関数のVPC設定を確認
aws lambda get-function-configuration \
  --function-name TokyoRegion-permission-aware-rag-prod-WebApp-Function \
  --region ap-northeast-1 \
  --query 'VpcConfig' \
  --output json

# 期待される出力（VPC内配置の場合）:
# {
#   "SubnetIds": ["subnet-xxx", "subnet-yyy"],
#   "SecurityGroupIds": ["sg-xxx"],
#   "VpcId": "vpc-xxx"
# }

# 期待される出力（VPC外配置の場合）:
# {}
```

### Step 4: VPC Endpointの確認

```bash
# VPC Endpointの一覧を取得
aws ec2 describe-vpc-endpoints \
  --filters "Name=vpc-id,Values=vpc-xxx" \
  --region ap-northeast-1 \
  --query 'VpcEndpoints[*].[ServiceName,State]' \
  --output table

# 期待される出力（VPC内配置の場合）:
# ---------------------------------------------------------------
# |                    DescribeVpcEndpoints                     |
# +---------------------------------------------+---------------+
# |  com.amazonaws.ap-northeast-1.dynamodb      |  available    |
# |  com.amazonaws.ap-northeast-1.bedrock-runtime|  available   |
# |  com.amazonaws.ap-northeast-1.bedrock-agent-runtime| available|
# +---------------------------------------------+---------------+
```

## 📊 VPC配置の比較表

| 項目 | VPC外配置 | VPC内配置 |
|------|----------|----------|
| **セキュリティ** | 標準 | 強化 |
| **コスト** | 低（$0/月） | 中（$14.4/月） |
| **Cold Start** | 高速（~1秒） | やや遅い（~2秒） |
| **レイテンシ** | 標準 | 低（VPC EP経由） |
| **設定複雑度** | 低 | 中 |
| **推奨環境** | 開発・プロトタイプ | 本番・コンプライアンス |
| **データ主権** | 標準 | 強化 |
| **コンプライアンス** | 標準 | 対応 |

## 🚀 Phase 2-7 実装完了内容

### 設定インターフェース拡張

**LambdaVpcConfigインターフェース追加**:
```typescript
// lib/config/interfaces/webapp-stack-config.ts
export interface LambdaVpcConfig {
  enabled: boolean;
  endpoints?: {
    dynamodb?: boolean;
    bedrockRuntime?: boolean;
    bedrockAgentRuntime?: boolean;
  };
}
```

### VPC Endpoint作成メソッド追加

**createBedrockRuntimeVpcEndpoint()**:
```typescript
// lib/stacks/integrated/webapp-stack.ts
private createBedrockRuntimeVpcEndpoint(vpc: ec2.IVpc): ec2.InterfaceVpcEndpoint {
  return new ec2.InterfaceVpcEndpoint(this, 'BedrockRuntimeVpcEndpoint', {
    vpc,
    service: new ec2.InterfaceVpcEndpointService(
      `com.amazonaws.${this.region}.bedrock-runtime`,
      443
    ),
    privateDnsEnabled: true,
    subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  });
}
```

**createBedrockAgentRuntimeVpcEndpoint()**:
```typescript
private createBedrockAgentRuntimeVpcEndpoint(vpc: ec2.IVpc): ec2.InterfaceVpcEndpoint {
  return new ec2.InterfaceVpcEndpoint(this, 'BedrockAgentRuntimeVpcEndpoint', {
    vpc,
    service: new ec2.InterfaceVpcEndpointService(
      `com.amazonaws.${this.region}.bedrock-agent-runtime`,
      443
    ),
    privateDnsEnabled: true,
    subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  });
}
```

### 自動VPC Endpoint作成

**条件付き作成**:
```typescript
// VPC内配置の場合のみVPC Endpointを作成
if (this.config.lambda.vpc.enabled) {
  if (this.config.lambda.vpc.endpoints?.dynamodb) {
    this.createDynamoDBVpcEndpoint(vpc);
  }
  if (this.config.lambda.vpc.endpoints?.bedrockRuntime) {
    this.createBedrockRuntimeVpcEndpoint(vpc);
  }
  if (this.config.lambda.vpc.endpoints?.bedrockAgentRuntime) {
    this.createBedrockAgentRuntimeVpcEndpoint(vpc);
  }
}
```

### Lambda VPC配置の柔軟化

**設定ファイルで簡単切り替え**:
```typescript
// VPC外配置
lambda: { vpc: { enabled: false } }

// VPC内配置
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

## 🎯 使用方法

### デフォルト（VPC外）

**設定**:
```typescript
lambda: {
  vpc: {
    enabled: false, // VPC外に配置（現在の構成）
  },
}
```

**デプロイ**:
```bash
npx cdk deploy --all
```

**確認**:
```bash
aws lambda get-function-configuration \
  --function-name [FUNCTION_NAME] \
  --query 'VpcConfig' \
  --output json
# 出力: {}
```

### VPC内配置（推奨）

**設定**:
```typescript
lambda: {
  vpc: {
    enabled: true, // VPC内に配置
    endpoints: {
      dynamodb: true,           // 無料
      bedrockRuntime: true,     // $7.2/月
      bedrockAgentRuntime: true, // $7.2/月
    },
  },
}
```

**デプロイ**:
```bash
npx cdk deploy --all
```

**確認**:
```bash
# Lambda VPC設定
aws lambda get-function-configuration \
  --function-name [FUNCTION_NAME] \
  --query 'VpcConfig' \
  --output json

# VPC Endpoint
aws ec2 describe-vpc-endpoints \
  --filters "Name=vpc-id,Values=[VPC_ID]" \
  --query 'VpcEndpoints[*].[ServiceName,State]' \
  --output table
```

## 🔍 トラブルシューティング

### Lambda関数がVPC内に配置されない

**症状**: `VpcConfig`が空のオブジェクト

**原因**: 設定ファイルで`enabled: false`になっている

**解決策**:
```typescript
lambda: {
  vpc: {
    enabled: true, // ← trueに変更
    endpoints: { ... },
  },
}
```

### VPC Endpointが作成されない

**症状**: `describe-vpc-endpoints`で表示されない

**原因**: 設定ファイルで`endpoints`が無効になっている

**解決策**:
```typescript
lambda: {
  vpc: {
    enabled: true,
    endpoints: {
      dynamodb: true,           // ← trueに変更
      bedrockRuntime: true,     // ← trueに変更
      bedrockAgentRuntime: true, // ← trueに変更
    },
  },
}
```

### Cold Startが遅い

**症状**: Lambda関数の起動に2秒以上かかる

**原因**: VPC内配置によるENI作成時間

**解決策**:
- Provisioned Concurrencyを使用
- または、VPC外配置に変更（開発環境の場合）

## 📚 関連ドキュメント

- [Phase 2-7 Bedrock VPC Endpoint CDK統合レポート](../../development/docs/reports/local/phase2-task7-bedrock-vpc-endpoint-cdk-integration.md)
- [Phase 2-6 DynamoDB VPC Endpoint CDK統合レポート](../../development/docs/reports/local/phase2-task6-dynamodb-vpc-endpoint-cdk-integration.md)
- [デプロイメントガイド（統合版）](DEPLOYMENT_GUIDE_UNIFIED.md)
- [アーキテクチャガイド](../ARCHITECTURE.md)

---

**作成者**: Kiro AI  
**作成日**: 2025年12月30日  
**ステータス**: 実装完了
