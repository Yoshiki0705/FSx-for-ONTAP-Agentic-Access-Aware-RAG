# Amazon Bedrock AgentCore Gateway - 設定ガイド

**作成日**: 2026-01-03  
**最終更新**: 2026-01-03  
**バージョン**: 1.0.0  
**対象**: Phase 1 - Gateway Construct

---

## 📋 目次

1. [概要](#概要)
2. [前提条件](#前提条件)
3. [基本設定](#基本設定)
4. [REST API変換設定](#rest-api変換設定)
5. [Lambda関数変換設定](#lambda関数変換設定)
6. [MCPサーバー統合設定](#mcpサーバー統合設定)
7. [環境別設定例](#環境別設定例)
8. [トラブルシューティング](#トラブルシューティング)
9. [FAQ](#faq)

---

## 概要

Amazon Bedrock AgentCore Gatewayは、既存のAPI/Lambda関数/MCPサーバーをBedrock Agent互換ツールに自動変換するコアコンポーネントです。OpenAPI仕様、Lambda関数メタデータ、MCPサーバーのTool定義を解析し、Bedrock Agentで使用可能なTool定義を生成します。

### 主な機能

- **REST API変換**: OpenAPI仕様からBedrock Agent Tool定義を自動生成
- **Lambda関数変換**: Lambda関数メタデータからBedrock Agent Tool定義を自動生成
- **MCPサーバー統合**: MCPサーバーのTool定義をBedrock Agent Tool定義に変換
- **KMS暗号化**: 環境変数の暗号化
- **VPC統合**: プライベートサブネット内での実行

---

## 前提条件

### 必須リソース

- **AWS CDK v2**: 2.100.0以上
- **Node.js**: 20.x以上
- **TypeScript**: 5.3以上
- **AWS Account**: Bedrock利用可能なリージョン

### 必須権限

- `bedrock:InvokeAgent`
- `lambda:CreateFunction`
- `lambda:UpdateFunctionCode`
- `lambda:GetFunction`
- `apigateway:GET`
- `s3:GetObject`（OpenAPI仕様がS3にある場合）
- `secretsmanager:GetSecretValue`（MCPサーバー認証時）
- `kms:CreateKey`
- `kms:Encrypt`
- `kms:Decrypt`

---

## 基本設定

### Step 1: cdk.context.jsonの設定

`cdk.context.json`に以下の設定を追加します：

```json
{
  "bedrockAgentCore": {
    "gateway": {
      "enabled": true,
      "projectName": "permission-aware-rag",
      "environment": "prod"
    }
  }
}
```

### Step 2: NetworkingStackへの統合

`lib/stacks/integrated/networking-stack.ts`で、Gateway Constructを有効化します：

```typescript
import { BedrockAgentCoreGatewayConstruct } from '../../modules/ai/constructs/bedrock-agent-core-gateway-construct';

export class NetworkingStack extends Stack {
  constructor(scope: Construct, id: string, props: NetworkingStackProps) {
    super(scope, id, props);

    // Gateway Construct作成
    const gatewayConfig = this.node.tryGetContext('bedrockAgentCore')?.gateway;
    
    if (gatewayConfig?.enabled) {
      new BedrockAgentCoreGatewayConstruct(this, 'Gateway', {
        enabled: true,
        projectName: gatewayConfig.projectName,
        environment: gatewayConfig.environment,
      });
    }
  }
}
```

### Step 3: デプロイ

```bash
# TypeScriptビルド
npm run build

# CDK Synth（テンプレート生成）
npx cdk synth

# デプロイ
npx cdk deploy NetworkingStack
```

---

## REST API変換設定

### 基本設定

OpenAPI仕様からBedrock Agent Tool定義を自動生成します。

```json
{
  "bedrockAgentCore": {
    "gateway": {
      "enabled": true,
      "projectName": "permission-aware-rag",
      "environment": "prod",
      "restApiConversion": {
        "enabled": true,
        "openApiSpecPath": "s3://my-bucket/openapi.yaml"
      }
    }
  }
}
```

### API Gateway統合

既存のAPI Gatewayと統合する場合：

```json
{
  "bedrockAgentCore": {
    "gateway": {
      "restApiConversion": {
        "enabled": true,
        "openApiSpecPath": "s3://my-bucket/openapi.yaml",
        "apiGatewayIntegration": {
          "apiId": "abc123def4",
          "stageName": "prod",
          "authType": "IAM"
        }
      }
    }
  }
}
```

### 変換オプション

Tool定義の生成をカスタマイズできます：

```json
{
  "bedrockAgentCore": {
    "gateway": {
      "restApiConversion": {
        "enabled": true,
        "openApiSpecPath": "s3://my-bucket/openapi.yaml",
        "conversionOptions": {
          "autoGenerateToolDefinitions": true,
          "toolNamePrefix": "api_",
          "excludePatterns": [
            "/internal/.*",
            "/admin/.*"
          ]
        }
      }
    }
  }
}
```

### FSx for ONTAP + S3 Access Points統合

OpenAPI仕様をFSx for ONTAP + S3 Access Points経由で読み込む場合：

```json
{
  "bedrockAgentCore": {
    "gateway": {
      "restApiConversion": {
        "enabled": true,
        "openApiSpecPath": "arn:aws:s3:ap-northeast-1:123456789012:accesspoint/my-access-point/openapi.yaml",
        "fsxIntegration": {
          "enabled": true,
          "fileSystemId": "fs-12345678",
          "volumePath": "/specs"
        }
      }
    }
  }
}
```

---

## Lambda関数変換設定

### 基本設定

Lambda関数メタデータからBedrock Agent Tool定義を自動生成します。

```json
{
  "bedrockAgentCore": {
    "gateway": {
      "enabled": true,
      "projectName": "permission-aware-rag",
      "environment": "prod",
      "lambdaFunctionConversion": {
        "enabled": true,
        "functionArns": [
          "arn:aws:lambda:ap-northeast-1:123456789012:function:my-function-1",
          "arn:aws:lambda:ap-northeast-1:123456789012:function:my-function-2"
        ]
      }
    }
  }
}
```

### メタデータ取得設定

Lambda関数のメタデータ取得方法を指定できます：

```json
{
  "bedrockAgentCore": {
    "gateway": {
      "lambdaFunctionConversion": {
        "enabled": true,
        "functionArns": [
          "arn:aws:lambda:ap-northeast-1:123456789012:function:my-function"
        ],
        "metadataSource": {
          "useTags": true,
          "useEnvironmentVariables": true
        }
      }
    }
  }
}
```

### カスタムメタデータプロバイダー

カスタムメタデータプロバイダーを使用する場合：

```json
{
  "bedrockAgentCore": {
    "gateway": {
      "lambdaFunctionConversion": {
        "enabled": true,
        "functionArns": [
          "arn:aws:lambda:ap-northeast-1:123456789012:function:my-function"
        ],
        "metadataSource": {
          "customMetadataProvider": "arn:aws:lambda:ap-northeast-1:123456789012:function:metadata-provider"
        }
      }
    }
  }
}
```

### 変換オプション

Tool定義の生成をカスタマイズできます：

```json
{
  "bedrockAgentCore": {
    "gateway": {
      "lambdaFunctionConversion": {
        "enabled": true,
        "functionArns": [
          "arn:aws:lambda:ap-northeast-1:123456789012:function:my-function"
        ],
        "conversionOptions": {
          "autoGenerateToolDefinitions": true,
          "toolNamePrefix": "lambda_",
          "timeout": 60
        }
      }
    }
  }
}
```

---

## MCPサーバー統合設定

### 基本設定（認証なし）

MCPサーバーのTool定義をBedrock Agent Tool定義に変換します。

```json
{
  "bedrockAgentCore": {
    "gateway": {
      "enabled": true,
      "projectName": "permission-aware-rag",
      "environment": "prod",
      "mcpServerIntegration": {
        "enabled": true,
        "serverEndpoint": "https://mcp-server.example.com",
        "authentication": {
          "type": "NONE"
        }
      }
    }
  }
}
```

### API Key認証

API Key認証を使用する場合：

```json
{
  "bedrockAgentCore": {
    "gateway": {
      "mcpServerIntegration": {
        "enabled": true,
        "serverEndpoint": "https://mcp-server.example.com",
        "authentication": {
          "type": "API_KEY",
          "apiKeySecretArn": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:mcp-api-key-abc123"
        }
      }
    }
  }
}
```

### OAuth2認証

OAuth2認証を使用する場合：

```json
{
  "bedrockAgentCore": {
    "gateway": {
      "mcpServerIntegration": {
        "enabled": true,
        "serverEndpoint": "https://mcp-server.example.com",
        "authentication": {
          "type": "OAUTH2",
          "oauth2Config": {
            "clientId": "my-client-id",
            "clientSecretArn": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:oauth2-secret-abc123",
            "tokenEndpoint": "https://auth.example.com/oauth2/token"
          }
        }
      }
    }
  }
}
```

### HTTP/HTTPSエンドポイント設定

MCPサーバーがHTTP/HTTPSエンドポイントを提供する場合：

```json
{
  "bedrockAgentCore": {
    "gateway": {
      "mcpServerIntegration": {
        "enabled": true,
        "serverEndpoint": "https://mcp-server.example.com/tools",
        "authentication": {
          "type": "API_KEY",
          "apiKeySecretArn": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:mcp-api-key-abc123"
        },
        "conversionOptions": {
          "autoGenerateToolDefinitions": true,
          "toolNamePrefix": "mcp_",
          "filterToolNames": [
            "search",
            "analyze",
            "summarize"
          ]
        }
      }
    }
  }
}
```

**重要**: Lambda環境ではWebSocketの直接使用が制限されているため、MCPサーバーはHTTP/HTTPSエンドポイント（例: `/tools`）でTool定義を提供する必要があります。

---

## 環境別設定例

### 開発環境（Development）

```json
{
  "bedrockAgentCore": {
    "gateway": {
      "enabled": true,
      "projectName": "permission-aware-rag",
      "environment": "dev",
      "restApiConversion": {
        "enabled": true,
        "openApiSpecPath": "s3://dev-bucket/openapi.yaml",
        "conversionOptions": {
          "autoGenerateToolDefinitions": true,
          "toolNamePrefix": "dev_api_"
        }
      },
      "lambdaFunctionConversion": {
        "enabled": true,
        "functionArns": [
          "arn:aws:lambda:ap-northeast-1:123456789012:function:dev-function"
        ],
        "conversionOptions": {
          "timeout": 30
        }
      },
      "mcpServerIntegration": {
        "enabled": false
      }
    }
  }
}
```

### ステージング環境（Staging）

```json
{
  "bedrockAgentCore": {
    "gateway": {
      "enabled": true,
      "projectName": "permission-aware-rag",
      "environment": "staging",
      "restApiConversion": {
        "enabled": true,
        "openApiSpecPath": "s3://staging-bucket/openapi.yaml",
        "apiGatewayIntegration": {
          "apiId": "staging-api-id",
          "stageName": "staging",
          "authType": "IAM"
        }
      },
      "lambdaFunctionConversion": {
        "enabled": true,
        "functionArns": [
          "arn:aws:lambda:ap-northeast-1:123456789012:function:staging-function-1",
          "arn:aws:lambda:ap-northeast-1:123456789012:function:staging-function-2"
        ],
        "metadataSource": {
          "useTags": true
        }
      },
      "mcpServerIntegration": {
        "enabled": true,
        "serverEndpoint": "https://staging-mcp.example.com",
        "authentication": {
          "type": "API_KEY",
          "apiKeySecretArn": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:staging-mcp-key"
        }
      }
    }
  }
}
```

### 本番環境（Production）

```json
{
  "bedrockAgentCore": {
    "gateway": {
      "enabled": true,
      "projectName": "permission-aware-rag",
      "environment": "prod",
      "restApiConversion": {
        "enabled": true,
        "openApiSpecPath": "arn:aws:s3:ap-northeast-1:123456789012:accesspoint/prod-access-point/openapi.yaml",
        "apiGatewayIntegration": {
          "apiId": "prod-api-id",
          "stageName": "prod",
          "authType": "IAM"
        },
        "conversionOptions": {
          "autoGenerateToolDefinitions": true,
          "excludePatterns": [
            "/internal/.*",
            "/admin/.*"
          ]
        },
        "fsxIntegration": {
          "enabled": true,
          "fileSystemId": "fs-prod-12345678",
          "volumePath": "/specs"
        }
      },
      "lambdaFunctionConversion": {
        "enabled": true,
        "functionArns": [
          "arn:aws:lambda:ap-northeast-1:123456789012:function:prod-function-1",
          "arn:aws:lambda:ap-northeast-1:123456789012:function:prod-function-2",
          "arn:aws:lambda:ap-northeast-1:123456789012:function:prod-function-3"
        ],
        "metadataSource": {
          "useTags": true,
          "useEnvironmentVariables": true
        },
        "conversionOptions": {
          "timeout": 60
        }
      },
      "mcpServerIntegration": {
        "enabled": true,
        "serverEndpoint": "https://prod-mcp.example.com/tools",
        "authentication": {
          "type": "OAUTH2",
          "oauth2Config": {
            "clientId": "prod-client-id",
            "clientSecretArn": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:prod-oauth2-secret",
            "tokenEndpoint": "https://auth.example.com/oauth2/token"
          }
        },
        "conversionOptions": {
          "filterToolNames": [
            "search",
            "analyze",
            "summarize",
            "translate"
          ]
        }
      }
    }
  }
}
```

---

## トラブルシューティング

### 問題1: REST API変換が失敗する

**症状**:
- OpenAPI仕様が読み込めない
- Tool定義が生成されない

**原因**:
- OpenAPI仕様ファイルのパスが不正
- S3バケットへのアクセス権限が不足
- OpenAPI仕様の形式が不正

**解決策**:

1. OpenAPI仕様ファイルのパスを確認：
```bash
aws s3 ls s3://my-bucket/openapi.yaml
```

2. Lambda実行ロールにS3読み取り権限を追加：
```bash
aws iam attach-role-policy \
  --role-name TokyoRegion-permission-aware-rag-prod-Gateway-Execution-Role \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess
```

3. OpenAPI仕様の形式を確認：
```bash
# OpenAPI 3.0形式であることを確認
cat openapi.yaml | grep "openapi: 3.0"
```

### 問題2: Lambda関数変換が失敗する

**症状**:
- Lambda関数メタデータが取得できない
- Tool定義が生成されない

**原因**:
- Lambda関数ARNが不正
- Lambda関数へのアクセス権限が不足
- Lambda関数にメタデータが設定されていない

**解決策**:

1. Lambda関数ARNを確認：
```bash
aws lambda get-function \
  --function-name my-function \
  --region ap-northeast-1
```

2. Lambda実行ロールにLambda読み取り権限を追加：
```bash
aws iam attach-role-policy \
  --role-name TokyoRegion-permission-aware-rag-prod-Gateway-Execution-Role \
  --policy-arn arn:aws:iam::aws:policy/AWSLambda_ReadOnlyAccess
```

3. Lambda関数にメタデータタグを追加：
```bash
aws lambda tag-resource \
  --resource arn:aws:lambda:ap-northeast-1:123456789012:function:my-function \
  --tags "ToolName=my_tool,ToolDescription=My tool description,InputSchema={\"type\":\"object\"}"
```

### 問題3: MCPサーバー統合が失敗する

**症状**:
- MCPサーバーに接続できない
- Tool定義が取得できない

**原因**:
- MCPサーバーエンドポイントが不正
- 認証情報が不正
- MCPサーバーがHTTP/HTTPSエンドポイントを提供していない

**解決策**:

1. MCPサーバーエンドポイントを確認：
```bash
curl -X GET https://mcp-server.example.com/tools
```

2. 認証情報を確認：
```bash
aws secretsmanager get-secret-value \
  --secret-id mcp-api-key-abc123 \
  --region ap-northeast-1
```

3. MCPサーバーがHTTP/HTTPSエンドポイントを提供していることを確認：
```bash
# /tools エンドポイントでTool定義が返されることを確認
curl -X GET https://mcp-server.example.com/tools \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 問題4: KMS暗号化エラー

**症状**:
- Lambda関数が環境変数を読み込めない
- KMS復号化エラーが発生

**原因**:
- KMS Key権限が不足
- Lambda実行ロールにKMS権限がない

**解決策**:

1. KMS Key権限を確認：
```bash
aws kms describe-key \
  --key-id alias/TokyoRegion-permission-aware-rag-prod-Gateway-Key \
  --region ap-northeast-1
```

2. Lambda実行ロールにKMS権限を追加：
```bash
aws iam attach-role-policy \
  --role-name TokyoRegion-permission-aware-rag-prod-Gateway-Execution-Role \
  --policy-arn arn:aws:iam::aws:policy/AWSKeyManagementServicePowerUser
```

### 問題5: FSx for ONTAP統合エラー

**症状**:
- FSx for ONTAP経由でOpenAPI仕様が読み込めない
- S3 Access Pointsへのアクセスが失敗する

**原因**:
- FSx for ONTAP File Systemが存在しない
- S3 Access Pointsが正しく設定されていない
- VPC統合が不正

**解決策**:

1. FSx for ONTAP File Systemを確認：
```bash
aws fsx describe-file-systems \
  --file-system-ids fs-12345678 \
  --region ap-northeast-1
```

2. S3 Access Pointsを確認：
```bash
aws s3control get-access-point \
  --account-id 123456789012 \
  --name my-access-point \
  --region ap-northeast-1
```

3. VPC統合を確認：
```bash
# Lambda関数がVPC内で実行されていることを確認
aws lambda get-function-configuration \
  --function-name TokyoRegion-permission-aware-rag-prod-Gateway-RestApiConverter-Function \
  --region ap-northeast-1 | grep VpcConfig
```

---

## FAQ

### Q1: Gateway機能は必須ですか？

**A1**: いいえ、オプションです。`enabled: false`に設定することで無効化できます。

### Q2: 複数のOpenAPI仕様を変換できますか？

**A2**: はい、複数のREST API変換設定を作成することで、複数のOpenAPI仕様を変換できます。

### Q3: Lambda関数のメタデータはどのように設定しますか？

**A3**: Lambda関数のタグまたは環境変数にメタデータを設定します。詳細は「Lambda関数変換設定」セクションを参照してください。

### Q4: MCPサーバーはWebSocketをサポートする必要がありますか？

**A4**: いいえ。Lambda環境ではWebSocketの直接使用が制限されているため、MCPサーバーはHTTP/HTTPSエンドポイント（例: `/tools`）でTool定義を提供する必要があります。

### Q5: FSx for ONTAP統合は必須ですか？

**A5**: いいえ、オプションです。S3バケットから直接OpenAPI仕様を読み込むこともできます。

### Q6: Tool定義の生成をカスタマイズできますか？

**A6**: はい、`conversionOptions`を使用してTool名プレフィックス、除外パターンなどをカスタマイズできます。

### Q7: 認証情報はどのように管理しますか？

**A7**: AWS Secrets Managerを使用して認証情報を安全に管理します。

### Q8: Gateway機能のコストはどのくらいですか？

**A8**: Lambda関数の実行時間、KMS Key使用料、S3/FSx for ONTAPストレージ使用料に応じて課金されます。詳細はAWS料金表を参照してください。

### Q9: Gateway機能のパフォーマンスはどのくらいですか？

**A9**: Lambda起動時間は3秒以内、API応答時間は1秒以内を目標としています。

### Q10: 既存のBedrock Agentと統合できますか？

**A10**: はい。Gateway機能で生成されたTool定義を既存のBedrock Agentに追加することで統合できます。

---

## 参考リンク

### AWS公式ドキュメント

- [Amazon Bedrock AgentCore](https://docs.aws.amazon.com/bedrock/)
- [AWS Lambda](https://docs.aws.amazon.com/lambda/)
- [Amazon API Gateway](https://docs.aws.amazon.com/apigateway/)
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/)
- [Amazon FSx for NetApp ONTAP](https://docs.aws.amazon.com/fsx/)
- [Amazon S3 Access Points](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-points.html)

### プロジェクトドキュメント

- [requirements.md](../../.kiro/specs/bedrock-agent-core-features/requirements.md) - 完全な要件定義
- [gateway-api-specification.md](./gateway-api-specification.md) - API仕様書
- [tasks.md](../../.kiro/specs/bedrock-agent-core-features/tasks.md) - タスクリスト

---

**作成者**: Kiro AI  
**作成日**: 2026-01-03  
**ステータス**: ✅ 完成  
**バージョン**: 1.0.0
