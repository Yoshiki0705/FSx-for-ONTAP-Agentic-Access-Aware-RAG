/**
 * Amazon Bedrock AgentCore Identity Lambda Function
 * 
 * このLambda関数は、エージェントID管理APIを提供します。
 * - ID登録・更新・削除
 * - ID検証
 * - ロール管理
 * - 属性管理（ABAC）
 * 
 * @author Kiro AI
 * @date 2026-01-03
 * @version 1.0.0
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

/**
 * 環境変数
 */
interface EnvironmentVariables {
  PROJECT_NAME: string;
  ENVIRONMENT: string;
  IDENTITY_TABLE_NAME: string;
  AWS_REGION: string;
}

/**
 * エージェントID管理イベント
 */
interface IdentityEvent {
  action: 'create' | 'update' | 'delete' | 'get' | 'list' | 'validate' | 'assignRole' | 'checkPermission' | 'evaluatePolicy';
  agentId?: string;
  role?: string;
  attributes?: {
    department?: string;
    project?: string;
    sensitivity?: 'public' | 'internal' | 'confidential' | 'secret';
    customAttributes?: { [key: string]: string };
  };
  filters?: {
    role?: string;
    department?: string;
    project?: string;
  };
  // RBAC用
  permission?: string;
  // ABAC用
  policy?: {
    resource?: string;
    action?: string;
    conditions?: {
      [key: string]: any;
    };
  };
}

/**
 * エージェントIDレコード
 */
interface AgentIdentityRecord {
  agentId: string;
  timestamp: number;
  role: string;
  attributes: {
    department?: string;
    project?: string;
    sensitivity?: 'public' | 'internal' | 'confidential' | 'secret';
    customAttributes?: { [key: string]: string };
  };
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'inactive' | 'suspended';
}

/**
 * レスポンス
 */
interface IdentityResponse {
  statusCode: number;
  body: string;
}

// DynamoDBクライアント初期化（遅延初期化でテスト可能にする）
let docClient: DynamoDBDocumentClient | null = null;

function getDocClient(): DynamoDBDocumentClient {
  if (!docClient) {
    const dynamoDbClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'ap-northeast-1',
    });

    docClient = DynamoDBDocumentClient.from(dynamoDbClient, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      },
    });
  }
  return docClient;
}

/**
 * 環境変数取得
 */
function getEnvironmentVariables(): EnvironmentVariables {
  const projectName = process.env.PROJECT_NAME;
  const environment = process.env.ENVIRONMENT;
  const identityTableName = process.env.IDENTITY_TABLE_NAME;
  const awsRegion = process.env.AWS_REGION || 'ap-northeast-1';

  if (!projectName || !environment || !identityTableName) {
    throw new Error('必須環境変数が設定されていません');
  }

  return {
    PROJECT_NAME: projectName,
    ENVIRONMENT: environment,
    IDENTITY_TABLE_NAME: identityTableName,
    AWS_REGION: awsRegion,
  };
}

/**
 * エージェントID生成
 */
function generateAgentId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `agent-${timestamp}-${random}`;
}

/**
 * エージェントID検証
 */
function validateAgentId(agentId: string): boolean {
  // agent-{timestamp}-{random}形式をチェック
  const pattern = /^agent-\d+-[a-z0-9]+$/;
  return pattern.test(agentId);
}

/**
 * エージェントID作成
 */
async function createAgentIdentity(
  event: IdentityEvent,
  env: EnvironmentVariables
): Promise<IdentityResponse> {
  try {
    // エージェントID生成
    const agentId = generateAgentId();
    const now = new Date().toISOString();

    // レコード作成（timestamp: 0 を使用して最新レコードとして保存）
    const record: AgentIdentityRecord = {
      agentId,
      timestamp: 0, // 常に0を使用（最新レコードを示す）
      role: event.role || 'User',
      attributes: event.attributes || {},
      createdAt: now,
      updatedAt: now,
      status: 'active',
    };

    // DynamoDBに保存
    await getDocClient().send(
      new PutCommand({
        TableName: env.IDENTITY_TABLE_NAME,
        Item: record,
        ConditionExpression: 'attribute_not_exists(agentId)',
      })
    );

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: 'エージェントIDが作成されました',
        agentId,
        record,
      }),
    };
  } catch (error) {
    console.error('エージェントID作成エラー:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'エージェントID作成に失敗しました',
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
}

/**
 * エージェントID更新
 */
async function updateAgentIdentity(
  event: IdentityEvent,
  env: EnvironmentVariables
): Promise<IdentityResponse> {
  try {
    if (!event.agentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'agentIdが指定されていません',
        }),
      };
    }

    // エージェントID検証
    if (!validateAgentId(event.agentId)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: '無効なagentId形式です',
        }),
      };
    }

    const now = new Date().toISOString();

    // 更新式構築
    const updateExpressions: string[] = [];
    const expressionAttributeNames: { [key: string]: string } = {};
    const expressionAttributeValues: { [key: string]: any } = {};

    if (event.role) {
      updateExpressions.push('#role = :role');
      expressionAttributeNames['#role'] = 'role';
      expressionAttributeValues[':role'] = event.role;
    }

    if (event.attributes) {
      updateExpressions.push('#attributes = :attributes');
      expressionAttributeNames['#attributes'] = 'attributes';
      expressionAttributeValues[':attributes'] = event.attributes;
    }

    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = now;

    // DynamoDB更新
    const result = await getDocClient().send(
      new UpdateCommand({
        TableName: env.IDENTITY_TABLE_NAME,
        Key: {
          agentId: event.agentId,
          timestamp: 0, // 最新レコードを更新
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'エージェントIDが更新されました',
        agentId: event.agentId,
        record: result.Attributes,
      }),
    };
  } catch (error) {
    console.error('エージェントID更新エラー:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'エージェントID更新に失敗しました',
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
}

/**
 * エージェントID削除
 */
async function deleteAgentIdentity(
  event: IdentityEvent,
  env: EnvironmentVariables
): Promise<IdentityResponse> {
  try {
    if (!event.agentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'agentIdが指定されていません',
        }),
      };
    }

    // エージェントID検証
    if (!validateAgentId(event.agentId)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: '無効なagentId形式です',
        }),
      };
    }

    // DynamoDB削除
    await getDocClient().send(
      new DeleteCommand({
        TableName: env.IDENTITY_TABLE_NAME,
        Key: {
          agentId: event.agentId,
          timestamp: 0,
        },
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'エージェントIDが削除されました',
        agentId: event.agentId,
      }),
    };
  } catch (error) {
    console.error('エージェントID削除エラー:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'エージェントID削除に失敗しました',
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
}

/**
 * エージェントID取得
 */
async function getAgentIdentity(
  event: IdentityEvent,
  env: EnvironmentVariables
): Promise<IdentityResponse> {
  try {
    if (!event.agentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'agentIdが指定されていません',
        }),
      };
    }

    // エージェントID検証
    if (!validateAgentId(event.agentId)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: '無効なagentId形式です',
        }),
      };
    }

    // DynamoDB取得
    const result = await getDocClient().send(
      new GetCommand({
        TableName: env.IDENTITY_TABLE_NAME,
        Key: {
          agentId: event.agentId,
          timestamp: 0,
        },
      })
    );

    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: 'エージェントIDが見つかりません',
          agentId: event.agentId,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'エージェントIDが取得されました',
        record: result.Item,
      }),
    };
  } catch (error) {
    console.error('エージェントID取得エラー:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'エージェントID取得に失敗しました',
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
}

/**
 * エージェントIDリスト取得
 */
async function listAgentIdentities(
  event: IdentityEvent,
  env: EnvironmentVariables
): Promise<IdentityResponse> {
  try {
    // フィルター条件構築
    let filterExpression: string | undefined;
    const expressionAttributeNames: { [key: string]: string } = {};
    const expressionAttributeValues: { [key: string]: any } = {};

    if (event.filters) {
      const filters: string[] = [];

      if (event.filters.role) {
        filters.push('#role = :role');
        expressionAttributeNames['#role'] = 'role';
        expressionAttributeValues[':role'] = event.filters.role;
      }

      if (event.filters.department) {
        filters.push('#attributes.#department = :department');
        expressionAttributeNames['#attributes'] = 'attributes';
        expressionAttributeNames['#department'] = 'department';
        expressionAttributeValues[':department'] = event.filters.department;
      }

      if (event.filters.project) {
        filters.push('#attributes.#project = :project');
        expressionAttributeNames['#attributes'] = 'attributes';
        expressionAttributeNames['#project'] = 'project';
        expressionAttributeValues[':project'] = event.filters.project;
      }

      if (filters.length > 0) {
        filterExpression = filters.join(' AND ');
      }
    }

    // DynamoDBスキャン
    const result = await getDocClient().send(
      new ScanCommand({
        TableName: env.IDENTITY_TABLE_NAME,
        FilterExpression: filterExpression,
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 
          ? expressionAttributeNames 
          : undefined,
        ExpressionAttributeValues: Object.keys(expressionAttributeValues).length > 0 
          ? expressionAttributeValues 
          : undefined,
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'エージェントIDリストが取得されました',
        count: result.Items?.length || 0,
        items: result.Items || [],
      }),
    };
  } catch (error) {
    console.error('エージェントIDリスト取得エラー:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'エージェントIDリスト取得に失敗しました',
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
}

/**
 * エージェントID検証
 */
async function validateAgentIdentity(
  event: IdentityEvent,
  env: EnvironmentVariables
): Promise<IdentityResponse> {
  try {
    if (!event.agentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'agentIdが指定されていません',
        }),
      };
    }

    // 形式検証
    const isValidFormat = validateAgentId(event.agentId);
    if (!isValidFormat) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          valid: false,
          reason: '無効なagentId形式です',
        }),
      };
    }

    // 存在確認
    const result = await getDocClient().send(
      new GetCommand({
        TableName: env.IDENTITY_TABLE_NAME,
        Key: {
          agentId: event.agentId,
          timestamp: 0,
        },
      })
    );

    if (!result.Item) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          valid: false,
          reason: 'エージェントIDが存在しません',
        }),
      };
    }

    // ステータス確認
    const record = result.Item as AgentIdentityRecord;
    if (record.status !== 'active') {
      return {
        statusCode: 200,
        body: JSON.stringify({
          valid: false,
          reason: `エージェントIDのステータスが${record.status}です`,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        valid: true,
        agentId: event.agentId,
        record,
      }),
    };
  } catch (error) {
    console.error('エージェントID検証エラー:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'エージェントID検証に失敗しました',
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
}

/**
 * ロール割り当て（RBAC）
 */
async function assignRole(
  event: IdentityEvent,
  env: EnvironmentVariables
): Promise<IdentityResponse> {
  try {
    if (!event.agentId || !event.role) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'agentIdとroleが必要です',
        }),
      };
    }

    // エージェントID検証
    if (!validateAgentId(event.agentId)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: '無効なagentId形式です',
        }),
      };
    }

    // ロール検証
    const validRoles = ['Admin', 'User', 'ReadOnly'];
    if (!validRoles.includes(event.role)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: '無効なロールです',
          validRoles,
        }),
      };
    }

    const now = new Date().toISOString();

    // ロール割り当て
    const result = await getDocClient().send(
      new UpdateCommand({
        TableName: env.IDENTITY_TABLE_NAME,
        Key: {
          agentId: event.agentId,
          timestamp: 0,
        },
        UpdateExpression: 'SET #role = :role, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#role': 'role',
          '#updatedAt': 'updatedAt',
        },
        ExpressionAttributeValues: {
          ':role': event.role,
          ':updatedAt': now,
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'ロールが割り当てられました',
        agentId: event.agentId,
        role: event.role,
        record: result.Attributes,
      }),
    };
  } catch (error) {
    console.error('ロール割り当てエラー:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'ロール割り当てに失敗しました',
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
}

/**
 * 権限チェック（RBAC）
 */
async function checkPermission(
  event: IdentityEvent,
  env: EnvironmentVariables
): Promise<IdentityResponse> {
  try {
    if (!event.agentId || !event.permission) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'agentIdとpermissionが必要です',
        }),
      };
    }

    // エージェントID検証
    if (!validateAgentId(event.agentId)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: '無効なagentId形式です',
        }),
      };
    }

    // エージェント情報取得（強整合性読み込み）
    const result = await getDocClient().send(
      new GetCommand({
        TableName: env.IDENTITY_TABLE_NAME,
        Key: {
          agentId: event.agentId,
          timestamp: 0,
        },
        ConsistentRead: true, // 強整合性読み込みを使用
      })
    );

    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: 'エージェントIDが見つかりません',
        }),
      };
    }

    const record = result.Item as AgentIdentityRecord;

    // ロールベース権限チェック
    const rolePermissions: { [key: string]: string[] } = {
      Admin: ['*'],
      User: ['bedrock:InvokeAgent', 'bedrock:GetAgent', 'bedrock:ListAgents'],
      ReadOnly: ['bedrock:GetAgent', 'bedrock:ListAgents'],
    };

    const permissions = rolePermissions[record.role] || [];
    const hasPermission = permissions.includes('*') || permissions.includes(event.permission);

    return {
      statusCode: 200,
      body: JSON.stringify({
        agentId: event.agentId,
        role: record.role,
        permission: event.permission,
        allowed: hasPermission,
      }),
    };
  } catch (error) {
    console.error('権限チェックエラー:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: '権限チェックに失敗しました',
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
}

/**
 * ポリシー評価（ABAC）
 */
async function evaluatePolicy(
  event: IdentityEvent,
  env: EnvironmentVariables
): Promise<IdentityResponse> {
  try {
    if (!event.agentId || !event.policy) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'agentIdとpolicyが必要です',
        }),
      };
    }

    // エージェントID検証
    if (!validateAgentId(event.agentId)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: '無効なagentId形式です',
        }),
      };
    }

    // エージェント情報取得（強整合性読み込み）
    const result = await getDocClient().send(
      new GetCommand({
        TableName: env.IDENTITY_TABLE_NAME,
        Key: {
          agentId: event.agentId,
          timestamp: 0,
        },
        ConsistentRead: true, // 強整合性読み込みを使用
      })
    );

    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: 'エージェントIDが見つかりません',
        }),
      };
    }

    const record = result.Item as AgentIdentityRecord;

    // 属性ベースポリシー評価
    let allowed = true;
    const evaluationDetails: string[] = [];

    // 条件評価
    if (event.policy.conditions) {
      // 部署チェック
      if (event.policy.conditions.department) {
        const departmentMatch = record.attributes.department === event.policy.conditions.department;
        allowed = allowed && departmentMatch;
        evaluationDetails.push(
          `部署チェック: ${departmentMatch ? '✓' : '✗'} (要求: ${event.policy.conditions.department}, 実際: ${record.attributes.department})`
        );
      }

      // プロジェクトチェック
      if (event.policy.conditions.project) {
        const projectMatch = record.attributes.project === event.policy.conditions.project;
        allowed = allowed && projectMatch;
        evaluationDetails.push(
          `プロジェクトチェック: ${projectMatch ? '✓' : '✗'} (要求: ${event.policy.conditions.project}, 実際: ${record.attributes.project})`
        );
      }

      // 機密度チェック
      if (event.policy.conditions.sensitivity) {
        const sensitivityLevels = ['public', 'internal', 'confidential', 'secret'];
        const requiredLevel = sensitivityLevels.indexOf(event.policy.conditions.sensitivity);
        const agentLevel = sensitivityLevels.indexOf(record.attributes.sensitivity || 'public');
        const sensitivityMatch = agentLevel >= requiredLevel;
        allowed = allowed && sensitivityMatch;
        evaluationDetails.push(
          `機密度チェック: ${sensitivityMatch ? '✓' : '✗'} (要求: ${event.policy.conditions.sensitivity}, 実際: ${record.attributes.sensitivity})`
        );
      }

      // カスタム属性チェック
      if (event.policy.conditions.customAttributes) {
        Object.entries(event.policy.conditions.customAttributes).forEach(([key, value]) => {
          const customMatch = record.attributes.customAttributes?.[key] === value;
          allowed = allowed && customMatch;
          evaluationDetails.push(
            `カスタム属性 ${key}: ${customMatch ? '✓' : '✗'} (要求: ${value}, 実際: ${record.attributes.customAttributes?.[key]})`
          );
        });
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        agentId: event.agentId,
        policy: event.policy,
        allowed,
        evaluationDetails,
        agentAttributes: record.attributes,
      }),
    };
  } catch (error) {
    console.error('ポリシー評価エラー:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'ポリシー評価に失敗しました',
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
}

/**
 * Lambda ハンドラー
 */
export async function handler(event: IdentityEvent): Promise<IdentityResponse> {
  console.log('Identity Lambda起動:', JSON.stringify(event, null, 2));

  try {
    // 環境変数取得
    const env = getEnvironmentVariables();

    // アクション実行
    switch (event.action) {
      case 'create':
        return await createAgentIdentity(event, env);
      case 'update':
        return await updateAgentIdentity(event, env);
      case 'delete':
        return await deleteAgentIdentity(event, env);
      case 'get':
        return await getAgentIdentity(event, env);
      case 'list':
        return await listAgentIdentities(event, env);
      case 'validate':
        return await validateAgentIdentity(event, env);
      case 'assignRole':
        return await assignRole(event, env);
      case 'checkPermission':
        return await checkPermission(event, env);
      case 'evaluatePolicy':
        return await evaluatePolicy(event, env);
      default:
        return {
          statusCode: 400,
          body: JSON.stringify({
            message: '無効なアクションです',
            action: event.action,
          }),
        };
    }
  } catch (error) {
    console.error('Lambda実行エラー:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Lambda実行に失敗しました',
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
}
