/**
 * Amazon Bedrock AgentCore Identity Lambda Function - 統合テスト
 * 
 * 実際のDynamoDBを使用した統合テスト
 * 
 * テスト対象:
 * - エージェントID管理（作成、更新、削除、取得、リスト、検証）
 * - RBAC（ロール割り当て、権限チェック）
 * - ABAC（ポリシー評価）
 * 
 * @author Kiro AI
 * @date 2026-01-04
 * @version 1.0.0
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from '../../../../lambda/agent-core-identity/index';

// DynamoDBクライアント初期化
const dynamoDbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

const docClient = DynamoDBDocumentClient.from(dynamoDbClient);

// テスト用のエージェントIDを保存
const testAgentIds: string[] = [];

/**
 * テスト後のクリーンアップ
 */
async function cleanupTestData() {
  const tableName = process.env.IDENTITY_TABLE_NAME;
  if (!tableName) {
    console.warn('IDENTITY_TABLE_NAME環境変数が設定されていません');
    return;
  }

  // テスト中に作成されたエージェントIDを削除
  for (const agentId of testAgentIds) {
    try {
      await docClient.send(
        new DeleteCommand({
          TableName: tableName,
          Key: {
            agentId,
            timestamp: 0,
          },
        })
      );
      console.log(`クリーンアップ完了: ${agentId}`);
    } catch (error) {
      console.error(`クリーンアップエラー (${agentId}):`, error);
    }
  }

  // テスト用エージェントIDリストをクリア
  testAgentIds.length = 0;
}

describe('Identity Lambda Function - 統合テスト - エージェントID管理', () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  describe('createAgentIdentity - エージェントID作成', () => {
    it('正常にエージェントIDを作成できる', async () => {
      const event = {
        action: 'create' as const,
        role: 'User',
        attributes: {
          department: 'engineering',
          project: 'rag-system',
          sensitivity: 'confidential' as const,
        },
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('エージェントIDが作成されました');
      expect(body.agentId).toMatch(/^agent-\d+-[a-z0-9]+$/);
      expect(body.record.role).toBe('User');
      expect(body.record.attributes.department).toBe('engineering');

      // クリーンアップ用に保存
      testAgentIds.push(body.agentId);
    });

    it('デフォルトロールでエージェントIDを作成できる', async () => {
      const event = {
        action: 'create' as const,
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.record.role).toBe('User');

      testAgentIds.push(body.agentId);
    });
  });

  describe('updateAgentIdentity - エージェントID更新', () => {
    it('正常にエージェントIDを更新できる', async () => {
      // まずエージェントIDを作成
      const createEvent = {
        action: 'create' as const,
        role: 'User',
      };
      const createResponse = await handler(createEvent);
      const createBody = JSON.parse(createResponse.body);
      const agentId = createBody.agentId;
      testAgentIds.push(agentId);

      // 更新
      const updateEvent = {
        action: 'update' as const,
        agentId,
        role: 'Admin',
        attributes: {
          department: 'engineering',
          project: 'rag-system',
          sensitivity: 'secret' as const,
        },
      };

      const response = await handler(updateEvent);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('エージェントIDが更新されました');
      expect(body.record.role).toBe('Admin');
    });

    it('agentIdが指定されていない場合は400エラーを返す', async () => {
      const event = {
        action: 'update' as const,
        role: 'Admin',
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('agentIdが指定されていません');
    });

    it('無効なagentId形式の場合は400エラーを返す', async () => {
      const event = {
        action: 'update' as const,
        agentId: 'invalid-id',
        role: 'Admin',
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('無効なagentId形式です');
    });
  });

  describe('deleteAgentIdentity - エージェントID削除', () => {
    it('正常にエージェントIDを削除できる', async () => {
      // まずエージェントIDを作成
      const createEvent = {
        action: 'create' as const,
      };
      const createResponse = await handler(createEvent);
      const createBody = JSON.parse(createResponse.body);
      const agentId = createBody.agentId;

      // 削除
      const deleteEvent = {
        action: 'delete' as const,
        agentId,
      };

      const response = await handler(deleteEvent);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('エージェントIDが削除されました');
      expect(body.agentId).toBe(agentId);

      // 削除済みなのでクリーンアップリストから除外
      const index = testAgentIds.indexOf(agentId);
      if (index > -1) {
        testAgentIds.splice(index, 1);
      }
    });

    it('agentIdが指定されていない場合は400エラーを返す', async () => {
      const event = {
        action: 'delete' as const,
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('agentIdが指定されていません');
    });
  });

  describe('getAgentIdentity - エージェントID取得', () => {
    it('正常にエージェントIDを取得できる', async () => {
      // まずエージェントIDを作成
      const createEvent = {
        action: 'create' as const,
        role: 'User',
        attributes: {
          department: 'engineering',
        },
      };
      const createResponse = await handler(createEvent);
      const createBody = JSON.parse(createResponse.body);
      const agentId = createBody.agentId;
      testAgentIds.push(agentId);

      // 取得
      const getEvent = {
        action: 'get' as const,
        agentId,
      };

      const response = await handler(getEvent);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('エージェントIDが取得されました');
      expect(body.record.agentId).toBe(agentId);
    });

    it('エージェントIDが存在しない場合は404エラーを返す', async () => {
      const event = {
        action: 'get' as const,
        agentId: 'agent-9999999999-nonexistent',
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('エージェントIDが見つかりません');
    });
  });

  describe('listAgentIdentities - エージェントIDリスト取得', () => {
    it('正常にエージェントIDリストを取得できる', async () => {
      // 2つのエージェントIDを作成
      const createEvent1 = {
        action: 'create' as const,
        role: 'User',
        attributes: { department: 'engineering' },
      };
      const createResponse1 = await handler(createEvent1);
      const createBody1 = JSON.parse(createResponse1.body);
      testAgentIds.push(createBody1.agentId);

      const createEvent2 = {
        action: 'create' as const,
        role: 'Admin',
        attributes: { department: 'sales' },
      };
      const createResponse2 = await handler(createEvent2);
      const createBody2 = JSON.parse(createResponse2.body);
      testAgentIds.push(createBody2.agentId);

      // リスト取得
      const listEvent = {
        action: 'list' as const,
      };

      const response = await handler(listEvent);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('エージェントIDリストが取得されました');
      expect(body.count).toBeGreaterThanOrEqual(2);
      expect(body.items).toBeInstanceOf(Array);
    });
  });

  describe('validateAgentIdentity - エージェントID検証', () => {
    it('有効なエージェントIDを検証できる', async () => {
      // まずエージェントIDを作成
      const createEvent = {
        action: 'create' as const,
      };
      const createResponse = await handler(createEvent);
      const createBody = JSON.parse(createResponse.body);
      const agentId = createBody.agentId;
      testAgentIds.push(agentId);

      // 検証
      const validateEvent = {
        action: 'validate' as const,
        agentId,
      };

      const response = await handler(validateEvent);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.valid).toBe(true);
      expect(body.agentId).toBe(agentId);
    });

    it('無効な形式のエージェントIDを検証できる', async () => {
      const event = {
        action: 'validate' as const,
        agentId: 'invalid-id',
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.valid).toBe(false);
      expect(body.reason).toBe('無効なagentId形式です');
    });

    it('存在しないエージェントIDを検証できる', async () => {
      const event = {
        action: 'validate' as const,
        agentId: 'agent-9999999999-nonexistent',
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.valid).toBe(false);
      expect(body.reason).toBe('エージェントIDが存在しません');
    });
  });
});

describe('Identity Lambda Function - 統合テスト - RBAC', () => {
  afterAll(async () => {
    // 全テスト終了後にクリーンアップ
    await cleanupTestData();
  });

  describe('assignRole - ロール割り当て', () => {
    it('正常にロールを割り当てられる', async () => {
      // まずエージェントIDを作成
      const createEvent = {
        action: 'create' as const,
        role: 'User',
      };
      const createResponse = await handler(createEvent);
      const createBody = JSON.parse(createResponse.body);
      const agentId = createBody.agentId;
      testAgentIds.push(agentId);

      // ロール割り当て
      const assignEvent = {
        action: 'assignRole' as const,
        agentId,
        role: 'Admin',
      };

      const response = await handler(assignEvent);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('ロールが割り当てられました');
      expect(body.role).toBe('Admin');
    });

    it('無効なロールの場合は400エラーを返す', async () => {
      const event = {
        action: 'assignRole' as const,
        agentId: 'agent-1234567890-abc123',
        role: 'InvalidRole',
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('無効なロールです');
      expect(body.validRoles).toEqual(['Admin', 'User', 'ReadOnly']);
    });
  });

  describe('checkPermission - 権限チェック', () => {
    it('Adminロールは全権限を持つ', async () => {
      // Adminロールのエージェントを作成
      const createEvent = {
        action: 'create' as const,
        role: 'Admin',
      };
      const createResponse = await handler(createEvent);
      const createBody = JSON.parse(createResponse.body);
      const agentId = createBody.agentId;
      testAgentIds.push(agentId);

      // 権限チェック
      const checkEvent = {
        action: 'checkPermission' as const,
        agentId,
        permission: 'bedrock:DeleteAgent',
      };

      const response = await handler(checkEvent);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.allowed).toBe(true);
    });

    it('Userロールは実行・参照権限を持つ', async () => {
      // Userロールのエージェントを作成
      const createEvent = {
        action: 'create' as const,
        role: 'User',
      };
      const createResponse = await handler(createEvent);
      const createBody = JSON.parse(createResponse.body);
      const agentId = createBody.agentId;
      testAgentIds.push(agentId);

      // 権限チェック
      const checkEvent = {
        action: 'checkPermission' as const,
        agentId,
        permission: 'bedrock:InvokeAgent',
      };

      const response = await handler(checkEvent);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.allowed).toBe(true);
    });

    it('ReadOnlyロールは実行権限を持たない', async () => {
      // ReadOnlyロールのエージェントを作成
      const createEvent = {
        action: 'create' as const,
        role: 'ReadOnly',
      };
      const createResponse = await handler(createEvent);
      const createBody = JSON.parse(createResponse.body);
      const agentId = createBody.agentId;
      testAgentIds.push(agentId);

      // 権限チェック
      const checkEvent = {
        action: 'checkPermission' as const,
        agentId,
        permission: 'bedrock:InvokeAgent',
      };

      const response = await handler(checkEvent);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.allowed).toBe(false);
    });
  });
});

describe('Identity Lambda Function - 統合テスト - ABAC', () => {
  afterAll(async () => {
    // 全テスト終了後にクリーンアップ
    await cleanupTestData();
  });

  describe('evaluatePolicy - ポリシー評価', () => {
    it('全ての条件が一致する場合はallowedがtrueになる', async () => {
      // エージェントを作成
      const createEvent = {
        action: 'create' as const,
        role: 'User',
        attributes: {
          department: 'engineering',
          project: 'rag-system',
          sensitivity: 'secret' as const,
          customAttributes: {
            region: 'ap-northeast-1',
          },
        },
      };
      const createResponse = await handler(createEvent);
      const createBody = JSON.parse(createResponse.body);
      const agentId = createBody.agentId;
      testAgentIds.push(agentId);

      // ポリシー評価
      const evaluateEvent = {
        action: 'evaluatePolicy' as const,
        agentId,
        policy: {
          resource: 'bedrock:agent:12345',
          action: 'bedrock:InvokeAgent',
          conditions: {
            department: 'engineering',
            project: 'rag-system',
            sensitivity: 'confidential',
            customAttributes: {
              region: 'ap-northeast-1',
            },
          },
        },
      };

      const response = await handler(evaluateEvent);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.allowed).toBe(true);
      expect(body.evaluationDetails).toHaveLength(4);
    });

    it('部署が一致しない場合はallowedがfalseになる', async () => {
      // エージェントを作成
      const createEvent = {
        action: 'create' as const,
        attributes: {
          department: 'sales',
          project: 'rag-system',
        },
      };
      const createResponse = await handler(createEvent);
      const createBody = JSON.parse(createResponse.body);
      const agentId = createBody.agentId;
      testAgentIds.push(agentId);

      // ポリシー評価
      const evaluateEvent = {
        action: 'evaluatePolicy' as const,
        agentId,
        policy: {
          conditions: {
            department: 'engineering',
          },
        },
      };

      const response = await handler(evaluateEvent);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.allowed).toBe(false);
    });

    it('機密度レベルの階層チェックが正しく動作する', async () => {
      // secretレベルのエージェントを作成
      const createEvent = {
        action: 'create' as const,
        attributes: {
          sensitivity: 'secret' as const,
        },
      };
      const createResponse = await handler(createEvent);
      const createBody = JSON.parse(createResponse.body);
      const agentId = createBody.agentId;
      testAgentIds.push(agentId);

      // confidentialレベルのリソースにアクセス可能か確認
      const evaluateEvent = {
        action: 'evaluatePolicy' as const,
        agentId,
        policy: {
          conditions: {
            sensitivity: 'confidential',
          },
        },
      };

      const response = await handler(evaluateEvent);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.allowed).toBe(true);
    });
  });
});

describe('Identity Lambda Function - 統合テスト - エラーハンドリング', () => {
  it('無効なアクションの場合は400エラーを返す', async () => {
    const event = {
      action: 'invalidAction' as any,
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('無効なアクションです');
  });
});
