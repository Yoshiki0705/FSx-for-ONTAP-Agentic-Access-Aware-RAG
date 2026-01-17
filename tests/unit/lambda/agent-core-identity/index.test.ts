/**
 * Amazon Bedrock AgentCore Identity Lambda Function - 単体テスト
 * 
 * テスト対象:
 * - エージェントID管理（作成、更新、削除、取得、リスト、検証）
 * - RBAC（ロール割り当て、権限チェック）
 * - ABAC（ポリシー評価）
 * 
 * @author Kiro AI
 * @date 2026-01-03
 * @version 1.0.0
 */

// AWS SDK v3のモック
const mockSend = jest.fn();

// DynamoDBClientのモック
jest.mock('@aws-sdk/client-dynamodb', () => {
  return {
    DynamoDBClient: jest.fn(() => ({})),
  };
});

// DynamoDBDocumentClientのモック
jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
  return {
    ...actual,
    DynamoDBDocumentClient: {
      from: jest.fn(() => ({
        send: mockSend,
      })),
    },
  };
});

// テスト対象のハンドラーをインポート（モック後）
import { handler } from '../../../../lambda/agent-core-identity/index';

describe('Identity Lambda Function - エージェントID管理', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  describe('createAgentIdentity - エージェントID作成', () => {
    it('正常にエージェントIDを作成できる', async () => {
      mockSend.mockResolvedValueOnce({});

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
    });

    it('デフォルトロールでエージェントIDを作成できる', async () => {
      mockSend.mockResolvedValueOnce({});

      const event = {
        action: 'create' as const,
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.record.role).toBe('User');
    });

    it('DynamoDBエラー時に500エラーを返す', async () => {
      mockSend.mockRejectedValueOnce(new Error('DynamoDB Error'));

      const event = {
        action: 'create' as const,
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('エージェントID作成に失敗しました');
    });
  });

  describe('updateAgentIdentity - エージェントID更新', () => {
    it('正常にエージェントIDを更新できる', async () => {
      const updatedRecord = {
        agentId: 'agent-1234567890-abc123',
        timestamp: 0,
        role: 'Admin',
        attributes: {
          department: 'engineering',
          project: 'rag-system',
          sensitivity: 'secret',
        },
        updatedAt: new Date().toISOString(),
      };

      mockSend.mockResolvedValueOnce({
        Attributes: updatedRecord,
      });

      const event = {
        action: 'update' as const,
        agentId: 'agent-1234567890-abc123',
        role: 'Admin',
        attributes: {
          department: 'engineering',
          project: 'rag-system',
          sensitivity: 'secret' as const,
        },
      };

      const response = await handler(event);

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
      mockSend.mockResolvedValueOnce({});

      const event = {
        action: 'delete' as const,
        agentId: 'agent-1234567890-abc123',
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('エージェントIDが削除されました');
      expect(body.agentId).toBe('agent-1234567890-abc123');
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
      const record = {
        agentId: 'agent-1234567890-abc123',
        timestamp: 0,
        role: 'User',
        attributes: {
          department: 'engineering',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'active',
      };

      mockSend.mockResolvedValueOnce({
        Item: record,
      });

      const event = {
        action: 'get' as const,
        agentId: 'agent-1234567890-abc123',
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('エージェントIDが取得されました');
      expect(body.record.agentId).toBe('agent-1234567890-abc123');
    });

    it('エージェントIDが存在しない場合は404エラーを返す', async () => {
      mockSend.mockResolvedValueOnce({
        Item: undefined,
      });

      const event = {
        action: 'get' as const,
        agentId: 'agent-1234567890-abc123',
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('エージェントIDが見つかりません');
    });
  });

  describe('listAgentIdentities - エージェントIDリスト取得', () => {
    it('正常にエージェントIDリストを取得できる', async () => {
      const items = [
        {
          agentId: 'agent-1234567890-abc123',
          role: 'User',
          attributes: { department: 'engineering' },
        },
        {
          agentId: 'agent-0987654321-xyz789',
          role: 'Admin',
          attributes: { department: 'sales' },
        },
      ];

      mockSend.mockResolvedValueOnce({
        Items: items,
      });

      const event = {
        action: 'list' as const,
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('エージェントIDリストが取得されました');
      expect(body.count).toBe(2);
      expect(body.items).toHaveLength(2);
    });

    it('フィルター条件でエージェントIDリストを取得できる', async () => {
      const items = [
        {
          agentId: 'agent-1234567890-abc123',
          role: 'User',
          attributes: { department: 'engineering' },
        },
      ];

      mockSend.mockResolvedValueOnce({
        Items: items,
      });

      const event = {
        action: 'list' as const,
        filters: {
          role: 'User',
          department: 'engineering',
        },
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.count).toBe(1);
    });
  });

  describe('validateAgentIdentity - エージェントID検証', () => {
    it('有効なエージェントIDを検証できる', async () => {
      const record = {
        agentId: 'agent-1234567890-abc123',
        timestamp: 0,
        role: 'User',
        attributes: {},
        status: 'active',
      };

      mockSend.mockResolvedValueOnce({
        Item: record,
      });

      const event = {
        action: 'validate' as const,
        agentId: 'agent-1234567890-abc123',
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.valid).toBe(true);
      expect(body.agentId).toBe('agent-1234567890-abc123');
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
      mockSend.mockResolvedValueOnce({
        Item: undefined,
      });

      const event = {
        action: 'validate' as const,
        agentId: 'agent-1234567890-abc123',
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.valid).toBe(false);
      expect(body.reason).toBe('エージェントIDが存在しません');
    });

    it('非アクティブなエージェントIDを検証できる', async () => {
      const record = {
        agentId: 'agent-1234567890-abc123',
        status: 'inactive',
      };

      mockSend.mockResolvedValueOnce({
        Item: record,
      });

      const event = {
        action: 'validate' as const,
        agentId: 'agent-1234567890-abc123',
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.valid).toBe(false);
      expect(body.reason).toBe('エージェントIDのステータスがinactiveです');
    });
  });
});

describe('Identity Lambda Function - RBAC（ロールベースアクセス制御）', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  describe('assignRole - ロール割り当て', () => {
    it('正常にロールを割り当てられる', async () => {
      const updatedRecord = {
        agentId: 'agent-1234567890-abc123',
        role: 'Admin',
        updatedAt: new Date().toISOString(),
      };

      mockSend.mockResolvedValueOnce({
        Attributes: updatedRecord,
      });

      const event = {
        action: 'assignRole' as const,
        agentId: 'agent-1234567890-abc123',
        role: 'Admin',
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('ロールが割り当てられました');
      expect(body.role).toBe('Admin');
    });

    it('agentIdまたはroleが指定されていない場合は400エラーを返す', async () => {
      const event = {
        action: 'assignRole' as const,
        agentId: 'agent-1234567890-abc123',
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('agentIdとroleが必要です');
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
      const record = {
        agentId: 'agent-1234567890-abc123',
        role: 'Admin',
      };

      mockSend.mockResolvedValueOnce({
        Item: record,
      });

      const event = {
        action: 'checkPermission' as const,
        agentId: 'agent-1234567890-abc123',
        permission: 'bedrock:DeleteAgent',
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.allowed).toBe(true);
    });

    it('Userロールは実行・参照権限を持つ', async () => {
      const record = {
        agentId: 'agent-1234567890-abc123',
        role: 'User',
      };

      mockSend.mockResolvedValueOnce({
        Item: record,
      });

      const event = {
        action: 'checkPermission' as const,
        agentId: 'agent-1234567890-abc123',
        permission: 'bedrock:InvokeAgent',
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.allowed).toBe(true);
    });

    it('ReadOnlyロールは参照権限のみを持つ', async () => {
      const record = {
        agentId: 'agent-1234567890-abc123',
        role: 'ReadOnly',
      };

      mockSend.mockResolvedValueOnce({
        Item: record,
      });

      const event = {
        action: 'checkPermission' as const,
        agentId: 'agent-1234567890-abc123',
        permission: 'bedrock:GetAgent',
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.allowed).toBe(true);
    });

    it('ReadOnlyロールは実行権限を持たない', async () => {
      const record = {
        agentId: 'agent-1234567890-abc123',
        role: 'ReadOnly',
      };

      mockSend.mockResolvedValueOnce({
        Item: record,
      });

      const event = {
        action: 'checkPermission' as const,
        agentId: 'agent-1234567890-abc123',
        permission: 'bedrock:InvokeAgent',
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.allowed).toBe(false);
    });

    it('エージェントIDが存在しない場合は404エラーを返す', async () => {
      mockSend.mockResolvedValueOnce({
        Item: undefined,
      });

      const event = {
        action: 'checkPermission' as const,
        agentId: 'agent-1234567890-abc123',
        permission: 'bedrock:InvokeAgent',
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('エージェントIDが見つかりません');
    });
  });
});

describe('Identity Lambda Function - ABAC（属性ベースアクセス制御）', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  describe('evaluatePolicy - ポリシー評価', () => {
    it('全ての条件が一致する場合はallowedがtrueになる', async () => {
      const record = {
        agentId: 'agent-1234567890-abc123',
        role: 'User',
        attributes: {
          department: 'engineering',
          project: 'rag-system',
          sensitivity: 'secret',
          customAttributes: {
            region: 'ap-northeast-1',
          },
        },
      };

      mockSend.mockResolvedValueOnce({
        Item: record,
      });

      const event = {
        action: 'evaluatePolicy' as const,
        agentId: 'agent-1234567890-abc123',
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

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.allowed).toBe(true);
      expect(body.evaluationDetails).toHaveLength(4);
    });

    it('部署が一致しない場合はallowedがfalseになる', async () => {
      const record = {
        agentId: 'agent-1234567890-abc123',
        attributes: {
          department: 'sales',
          project: 'rag-system',
        },
      };

      mockSend.mockResolvedValueOnce({
        Item: record,
      });

      const event = {
        action: 'evaluatePolicy' as const,
        agentId: 'agent-1234567890-abc123',
        policy: {
          conditions: {
            department: 'engineering',
          },
        },
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.allowed).toBe(false);
    });

    it('機密度レベルの階層チェックが正しく動作する', async () => {
      const record = {
        agentId: 'agent-1234567890-abc123',
        attributes: {
          sensitivity: 'secret',
        },
      };

      mockSend.mockResolvedValueOnce({
        Item: record,
      });

      const event = {
        action: 'evaluatePolicy' as const,
        agentId: 'agent-1234567890-abc123',
        policy: {
          conditions: {
            sensitivity: 'confidential',
          },
        },
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.allowed).toBe(true);
    });

    it('機密度レベルが不足している場合はallowedがfalseになる', async () => {
      const record = {
        agentId: 'agent-1234567890-abc123',
        attributes: {
          sensitivity: 'internal',
        },
      };

      mockSend.mockResolvedValueOnce({
        Item: record,
      });

      const event = {
        action: 'evaluatePolicy' as const,
        agentId: 'agent-1234567890-abc123',
        policy: {
          conditions: {
            sensitivity: 'confidential',
          },
        },
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.allowed).toBe(false);
    });

    it('カスタム属性が一致しない場合はallowedがfalseになる', async () => {
      const record = {
        agentId: 'agent-1234567890-abc123',
        attributes: {
          customAttributes: {
            region: 'us-east-1',
          },
        },
      };

      mockSend.mockResolvedValueOnce({
        Item: record,
      });

      const event = {
        action: 'evaluatePolicy' as const,
        agentId: 'agent-1234567890-abc123',
        policy: {
          conditions: {
            customAttributes: {
              region: 'ap-northeast-1',
            },
          },
        },
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.allowed).toBe(false);
    });

    it('agentIdまたはpolicyが指定されていない場合は400エラーを返す', async () => {
      const event = {
        action: 'evaluatePolicy' as const,
        agentId: 'agent-1234567890-abc123',
      };

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('agentIdとpolicyが必要です');
    });
  });
});

describe('Identity Lambda Function - エラーハンドリング', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it('無効なアクションの場合は400エラーを返す', async () => {
    const event = {
      action: 'invalidAction' as any,
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('無効なアクションです');
  });

  it('環境変数が設定されていない場合は500エラーを返す', async () => {
    const originalTableName = process.env.IDENTITY_TABLE_NAME;
    delete process.env.IDENTITY_TABLE_NAME;

    const event = {
      action: 'create' as const,
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('Lambda実行に失敗しました');

    process.env.IDENTITY_TABLE_NAME = originalTableName;
  });
});
