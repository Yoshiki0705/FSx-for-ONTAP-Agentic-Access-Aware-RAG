/**
 * KBモード — 会話コンテキスト統合テスト
 *
 * Task 11: AgentCore Memoryから直近の会話履歴を取得し、
 * Converse APIのmessages配列に過去の会話を追加するテスト。
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 *
 * @jest-environment node
 */

// === Mock setup (hoisted) ===
const mockAgentCoreSend = jest.fn();
const mockBedrockSend = jest.fn();
const mockConverseCommand = jest.fn();

// Mock AgentCore SDK
jest.mock('@aws-sdk/client-bedrock-agentcore', () => ({
  BedrockAgentCoreClient: jest.fn().mockImplementation(() => ({
    send: (...args: any[]) => mockAgentCoreSend(...args),
  })),
  ListEventsCommand: jest.fn().mockImplementation((input: any) => ({
    _type: 'ListEventsCommand',
    input,
  })),
}));

// Mock Bedrock Runtime SDK
jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
    send: (...args: any[]) => mockBedrockSend(...args),
  })),
  ConverseCommand: jest.fn().mockImplementation((input: any) => {
    mockConverseCommand(input);
    return { _type: 'ConverseCommand', input };
  }),
}));

// Mock Bedrock Agent Runtime SDK
jest.mock('@aws-sdk/client-bedrock-agent-runtime', () => ({
  BedrockAgentRuntimeClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({
      retrievalResults: [
        {
          content: { text: 'Test document content' },
          location: { s3Location: { uri: 's3://bucket/test-doc.md' } },
          score: 0.95,
          metadata: { allowed_group_sids: ['S-1-5-21-test'] },
        },
      ],
    }),
  })),
  RetrieveCommand: jest.fn().mockImplementation((input: any) => ({ input })),
}));

// Mock DynamoDB
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({
      Item: {
        userId: { S: 'test-user' },
        userSID: { S: 'S-1-5-21-test' },
        groupSIDs: { L: [{ S: 'S-1-5-21-test' }] },
      },
    }),
  })),
  GetItemCommand: jest.fn().mockImplementation((input: any) => ({ input })),
}));

jest.mock('@aws-sdk/util-dynamodb', () => ({
  unmarshall: jest.fn().mockReturnValue({
    userId: 'test-user',
    userSID: 'S-1-5-21-test',
    groupSIDs: ['S-1-5-21-test'],
  }),
}));

jest.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: jest.fn().mockImplementation(() => null),
  InvokeCommand: jest.fn(),
}));

// Mock monitoring metrics — use relative path from route.ts to the metrics module
// The route.ts imports '@/lib/monitoring/metrics' which resolves to 'src/lib/monitoring/metrics'
// We need to mock it at the path that jest resolves it to
jest.mock('../../../../../../lib/monitoring/metrics', () => ({
  createMetricsLogger: jest.fn().mockReturnValue({
    setDimension: jest.fn(),
    putMetric: jest.fn(),
    flush: jest.fn(),
  }),
}));

// Set env vars before importing the route
const originalEnv = process.env;

beforeAll(() => {
  process.env = {
    ...originalEnv,
    AWS_REGION: 'ap-northeast-1',
    BEDROCK_KB_ID: 'test-kb-id',
    USER_ACCESS_TABLE_NAME: 'test-user-access',
    PERMISSION_FILTER_LAMBDA_ARN: '',
  };
});

afterAll(() => {
  process.env = originalEnv;
});

// Import NextRequest/NextResponse
import { NextRequest } from 'next/server';

// Helper to create a mock NextRequest
function createMockRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/bedrock/kb/retrieve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('KB Retrieve — AgentCore Memory Integration (Task 11)', () => {
  beforeEach(() => {
    mockAgentCoreSend.mockReset();
    mockBedrockSend.mockReset();
    mockConverseCommand.mockReset();

    // Default: Converse API returns a valid response
    mockBedrockSend.mockResolvedValue({
      output: {
        message: {
          content: [{ text: 'Test response from Converse API' }],
        },
      },
    });
  });

  describe('Sub-task 11.1: AgentCore Memoryから会話履歴を取得', () => {
    it('should NOT call AgentCore Memory when ENABLE_AGENTCORE_MEMORY is false', async () => {
      process.env.ENABLE_AGENTCORE_MEMORY = 'false';
      process.env.AGENTCORE_MEMORY_ID = '';

      // Re-import to pick up env changes
      jest.resetModules();
      const { POST } = await import('../route');

      const req = createMockRequest({
        query: 'テスト質問',
        userId: 'test-user',
        memorySessionId: 'session-123',
      });

      await POST(req);

      expect(mockAgentCoreSend).not.toHaveBeenCalled();
    });

    it('should NOT call AgentCore Memory when memorySessionId is not provided', async () => {
      process.env.ENABLE_AGENTCORE_MEMORY = 'true';
      process.env.AGENTCORE_MEMORY_ID = 'mem-test-id';

      jest.resetModules();
      const { POST } = await import('../route');

      const req = createMockRequest({
        query: 'テスト質問',
        userId: 'test-user',
        // No memorySessionId
      });

      await POST(req);

      expect(mockAgentCoreSend).not.toHaveBeenCalled();
    });

    it('should call AgentCore Memory when enabled and sessionId is provided', async () => {
      process.env.ENABLE_AGENTCORE_MEMORY = 'true';
      process.env.AGENTCORE_MEMORY_ID = 'mem-test-id';

      mockAgentCoreSend.mockResolvedValueOnce({
        events: [
          {
            eventId: 'evt-1',
            payload: [{ conversational: { role: 'USER', content: { text: '前の質問' } } }],
          },
          {
            eventId: 'evt-2',
            payload: [{ conversational: { role: 'ASSISTANT', content: { text: '前の回答' } } }],
          },
        ],
      });

      jest.resetModules();
      const { POST } = await import('../route');

      const req = createMockRequest({
        query: '新しい質問',
        userId: 'test-user',
        memorySessionId: 'session-123',
      });

      await POST(req);

      expect(mockAgentCoreSend).toHaveBeenCalledTimes(1);
      const cmd = mockAgentCoreSend.mock.calls[0][0];
      expect(cmd.input.memoryId).toBe('mem-test-id');
      expect(cmd.input.sessionId).toBe('session-123');
      expect(cmd.input.actorId).toBe('test-user');
    });

    it('should gracefully handle AgentCore Memory retrieval failure', async () => {
      process.env.ENABLE_AGENTCORE_MEMORY = 'true';
      process.env.AGENTCORE_MEMORY_ID = 'mem-test-id';

      mockAgentCoreSend.mockRejectedValueOnce(new Error('Memory service unavailable'));

      jest.resetModules();
      const { POST } = await import('../route');

      const req = createMockRequest({
        query: 'テスト質問',
        userId: 'test-user',
        memorySessionId: 'session-123',
      });

      const response = await POST(req);
      const data = await response.json();

      // KB検索は正常に完了すること（メモリ取得失敗はブロックしない）
      expect(data.success).toBe(true);
    });
  });

  describe('Sub-task 11.2: Converse APIのmessages配列に過去の会話を追加', () => {
    it('should prepend conversation history to Converse API messages', async () => {
      process.env.ENABLE_AGENTCORE_MEMORY = 'true';
      process.env.AGENTCORE_MEMORY_ID = 'mem-test-id';

      mockAgentCoreSend.mockResolvedValueOnce({
        events: [
          {
            eventId: 'evt-1',
            payload: [{ conversational: { role: 'USER', content: { text: '前の質問' } } }],
          },
          {
            eventId: 'evt-2',
            payload: [{ conversational: { role: 'ASSISTANT', content: { text: '前の回答' } } }],
          },
        ],
      });

      jest.resetModules();
      const { POST } = await import('../route');

      const req = createMockRequest({
        query: '新しい質問',
        userId: 'test-user',
        memorySessionId: 'session-123',
      });

      await POST(req);

      // Converse APIが呼ばれたことを確認
      expect(mockConverseCommand).toHaveBeenCalled();
      const converseInput = mockConverseCommand.mock.calls[0][0];

      // messages配列に会話履歴 + 現在の質問が含まれること
      expect(converseInput.messages.length).toBe(3); // 2 history + 1 current
      expect(converseInput.messages[0].role).toBe('user');
      expect(converseInput.messages[0].content[0].text).toBe('前の質問');
      expect(converseInput.messages[1].role).toBe('assistant');
      expect(converseInput.messages[1].content[0].text).toBe('前の回答');
      // 最後のメッセージは現在の質問（プロンプト付き）
      expect(converseInput.messages[2].role).toBe('user');
      expect(converseInput.messages[2].content[0].text).toContain('新しい質問');
    });

    it('should include memoryContextUsed in response metadata when history is used', async () => {
      process.env.ENABLE_AGENTCORE_MEMORY = 'true';
      process.env.AGENTCORE_MEMORY_ID = 'mem-test-id';

      mockAgentCoreSend.mockResolvedValueOnce({
        events: [
          {
            eventId: 'evt-1',
            payload: [{ conversational: { role: 'USER', content: { text: '前の質問' } } }],
          },
        ],
      });

      jest.resetModules();
      const { POST } = await import('../route');

      const req = createMockRequest({
        query: '新しい質問',
        userId: 'test-user',
        memorySessionId: 'session-123',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.metadata.memoryContextUsed).toBe(true);
      expect(data.metadata.memoryMessageCount).toBe(1);
    });

    it('should send single message when no conversation history exists', async () => {
      process.env.ENABLE_AGENTCORE_MEMORY = 'false';
      process.env.AGENTCORE_MEMORY_ID = '';

      jest.resetModules();
      const { POST } = await import('../route');

      const req = createMockRequest({
        query: 'テスト質問',
        userId: 'test-user',
      });

      await POST(req);

      expect(mockConverseCommand).toHaveBeenCalled();
      const converseInput = mockConverseCommand.mock.calls[0][0];

      // 会話履歴なし — 現在の質問のみ
      expect(converseInput.messages.length).toBe(1);
      expect(converseInput.messages[0].role).toBe('user');
    });
  });

  describe('Sub-task 11.3: KBモードとAgentモードのセッション独立管理', () => {
    it('should accept memorySessionId as an optional field in the request', async () => {
      process.env.ENABLE_AGENTCORE_MEMORY = 'true';
      process.env.AGENTCORE_MEMORY_ID = 'mem-test-id';

      mockAgentCoreSend.mockResolvedValueOnce({ events: [] });

      jest.resetModules();
      const { POST } = await import('../route');

      // KBモード用のセッションID
      const req = createMockRequest({
        query: 'KB質問',
        userId: 'test-user',
        memorySessionId: 'kb-session-456',
      });

      await POST(req);

      // AgentCore Memoryが呼ばれ、KBモード用のセッションIDが使われること
      expect(mockAgentCoreSend).toHaveBeenCalledTimes(1);
      const cmd = mockAgentCoreSend.mock.calls[0][0];
      expect(cmd.input.sessionId).toBe('kb-session-456');
    });

    it('should work without memorySessionId (backward compatibility)', async () => {
      process.env.ENABLE_AGENTCORE_MEMORY = 'true';
      process.env.AGENTCORE_MEMORY_ID = 'mem-test-id';

      jest.resetModules();
      const { POST } = await import('../route');

      const req = createMockRequest({
        query: 'テスト質問',
        userId: 'test-user',
        // No memorySessionId — backward compatible
      });

      const response = await POST(req);
      const data = await response.json();

      expect(data.success).toBe(true);
      // AgentCore Memoryは呼ばれない
      expect(mockAgentCoreSend).not.toHaveBeenCalled();
    });
  });
});
