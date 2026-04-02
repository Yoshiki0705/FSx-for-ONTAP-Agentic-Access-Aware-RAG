/**
 * APIエンドポイントHTTPメソッド検証テスト
 *
 * Next.js App Routerでは、エクスポートされた関数名（POST, GET, DELETE等）が
 * 受け付けるHTTPメソッドを定義する。各ルートが正しいメソッドをエクスポートしていることを検証する。
 *
 * Requirements: 3.1
 *
 * @jest-environment node
 */

// Mock AWS SDK modules to avoid actual client initialization
jest.mock('@aws-sdk/client-bedrock-agentcore', () => ({
  BedrockAgentCoreClient: jest.fn().mockImplementation(() => ({})),
  CreateEventCommand: jest.fn(),
  ListSessionsCommand: jest.fn(),
  ListEventsCommand: jest.fn(),
  DeleteEventCommand: jest.fn(),
  RetrieveMemoryRecordsCommand: jest.fn(),
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
  },
  PutCommand: jest.fn(),
  ScanCommand: jest.fn(),
  UpdateCommand: jest.fn(),
}));

jest.mock('@/lib/auth/session-manager', () => ({
  sessionManager: {
    getSessionFromCookies: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('@/lib/agentcore/session-metadata', () => ({
  saveSessionMetadata: jest.fn(),
  getSessionList: jest.fn().mockResolvedValue([]),
  updateSessionMetadata: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid'),
}));

describe('AgentCore Memory API — HTTPメソッドエクスポート検証', () => {
  describe('session route (POST/GET/DELETE)', () => {
    it('POST, GET, DELETE をエクスポートする', async () => {
      const sessionRoute = await import('../session/route');

      expect(typeof sessionRoute.POST).toBe('function');
      expect(typeof sessionRoute.GET).toBe('function');
      expect(typeof sessionRoute.DELETE).toBe('function');
    });

    it('PUT, PATCH をエクスポートしない', async () => {
      const sessionRoute = await import('../session/route') as any;

      expect(sessionRoute.PUT).toBeUndefined();
      expect(sessionRoute.PATCH).toBeUndefined();
    });
  });

  describe('event route (POST/GET)', () => {
    it('POST, GET をエクスポートする', async () => {
      const eventRoute = await import('../event/route');

      expect(typeof eventRoute.POST).toBe('function');
      expect(typeof eventRoute.GET).toBe('function');
    });

    it('DELETE, PUT, PATCH をエクスポートしない', async () => {
      const eventRoute = await import('../event/route') as any;

      expect(eventRoute.DELETE).toBeUndefined();
      expect(eventRoute.PUT).toBeUndefined();
      expect(eventRoute.PATCH).toBeUndefined();
    });
  });

  describe('search route (POST)', () => {
    it('POST をエクスポートする', async () => {
      const searchRoute = await import('../search/route');

      expect(typeof searchRoute.POST).toBe('function');
    });

    it('GET, DELETE, PUT, PATCH をエクスポートしない', async () => {
      const searchRoute = await import('../search/route') as any;

      expect(searchRoute.GET).toBeUndefined();
      expect(searchRoute.DELETE).toBeUndefined();
      expect(searchRoute.PUT).toBeUndefined();
      expect(searchRoute.PATCH).toBeUndefined();
    });
  });
});
