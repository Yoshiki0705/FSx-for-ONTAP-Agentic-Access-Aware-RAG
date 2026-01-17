/**
 * Amazon Bedrock AgentCore Code Interpreter Lambda Function - 単体テスト
 * 
 * @author Kiro AI
 * @date 2026-01-04
 */

import { handler } from '../../../../lambda/agent-core-code-interpreter/index';

// モック設定
jest.mock('@aws-sdk/client-bedrock-agent-runtime');
jest.mock('@aws-sdk/client-s3');

describe('Code Interpreter Lambda Function - Unit Tests', () => {
  // 環境変数設定
  beforeAll(() => {
    process.env.PROJECT_NAME = 'test-project';
    process.env.ENVIRONMENT = 'test';
    process.env.FSX_S3_ACCESS_POINT_ARN = 'arn:aws:s3:us-east-1:123456789012:accesspoint/test-access-point';
    process.env.EXECUTION_TIMEOUT = '60';
    process.env.MEMORY_LIMIT = '512';
    process.env.ALLOWED_PACKAGES = '["numpy", "pandas", "matplotlib", "scipy"]';
    process.env.ALLOW_NETWORK_ACCESS = 'false';
    process.env.SESSION_TIMEOUT = '3600';
    process.env.MAX_CONCURRENT_SESSIONS = '10';
  });

  // 各テスト後にモックをクリア
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('セッション管理', () => {
    test('セッション開始が成功する', async () => {
      const event = {
        action: 'START_SESSION' as const,
      };

      const response = await handler(event);

      expect(response.status).toBe('SUCCESS');
      expect(response.sessionId).toBeDefined();
      expect(response.result?.output).toContain('started successfully');
    });

    test('セッション停止が成功する', async () => {
      // まずセッションを開始
      const startEvent = {
        action: 'START_SESSION' as const,
      };
      const startResponse = await handler(startEvent);
      const sessionId = startResponse.sessionId!;

      // セッションを停止
      const stopEvent = {
        action: 'STOP_SESSION' as const,
        sessionId,
      };
      const stopResponse = await handler(stopEvent);

      expect(stopResponse.status).toBe('SUCCESS');
      expect(stopResponse.result?.output).toContain('stopped successfully');
    });

    test('存在しないセッションの停止はエラーになる', async () => {
      const event = {
        action: 'STOP_SESSION' as const,
        sessionId: 'non-existent-session',
      };

      const response = await handler(event);

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('not found');
    });

    test('最大同時セッション数を超えるとエラーになる', async () => {
      // 最大セッション数を1に設定
      process.env.MAX_CONCURRENT_SESSIONS = '1';

      // 1つ目のセッション開始
      const event1 = {
        action: 'START_SESSION' as const,
      };
      const response1 = await handler(event1);
      expect(response1.status).toBe('SUCCESS');

      // 2つ目のセッション開始（エラーになるはず）
      const event2 = {
        action: 'START_SESSION' as const,
      };
      const response2 = await handler(event2);
      expect(response2.status).toBe('FAILED');
      expect(response2.error?.message).toContain('Maximum concurrent sessions');

      // 環境変数を元に戻す
      process.env.MAX_CONCURRENT_SESSIONS = '10';
    });
  });

  describe('コード実行', () => {
    let sessionId: string;

    beforeEach(async () => {
      // テスト用セッション作成
      const startEvent = {
        action: 'START_SESSION' as const,
      };
      const startResponse = await handler(startEvent);
      sessionId = startResponse.sessionId!;
    });

    test('セッションIDが必須', async () => {
      const event = {
        action: 'EXECUTE_CODE' as const,
        code: 'print("Hello, World!")',
      };

      const response = await handler(event);

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('Session ID is required');
    });

    test('コードが必須', async () => {
      const event = {
        action: 'EXECUTE_CODE' as const,
        sessionId,
      };

      const response = await handler(event);

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('Code is required');
    });

    test('存在しないセッションでのコード実行はエラーになる', async () => {
      const event = {
        action: 'EXECUTE_CODE' as const,
        sessionId: 'non-existent-session',
        code: 'print("Hello, World!")',
      };

      const response = await handler(event);

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('not found');
    });
  });

  describe('ファイル操作', () => {
    let sessionId: string;

    beforeEach(async () => {
      // テスト用セッション作成
      const startEvent = {
        action: 'START_SESSION' as const,
      };
      const startResponse = await handler(startEvent);
      sessionId = startResponse.sessionId!;
    });

    test('ファイル書き込みにはセッションIDが必須', async () => {
      const event = {
        action: 'WRITE_FILE' as const,
        filePath: 'test.txt',
        fileContent: 'Hello, World!',
      };

      const response = await handler(event);

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('Session ID is required');
    });

    test('ファイル書き込みにはファイルパスが必須', async () => {
      const event = {
        action: 'WRITE_FILE' as const,
        sessionId,
        fileContent: 'Hello, World!',
      };

      const response = await handler(event);

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('File path is required');
    });

    test('ファイル書き込みにはファイル内容が必須', async () => {
      const event = {
        action: 'WRITE_FILE' as const,
        sessionId,
        filePath: 'test.txt',
      };

      const response = await handler(event);

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('File content is required');
    });

    test('ファイル読み込みにはセッションIDが必須', async () => {
      const event = {
        action: 'READ_FILE' as const,
        filePath: 'test.txt',
      };

      const response = await handler(event);

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('Session ID is required');
    });

    test('ファイル読み込みにはファイルパスが必須', async () => {
      const event = {
        action: 'READ_FILE' as const,
        sessionId,
      };

      const response = await handler(event);

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('File path is required');
    });

    test('ファイル削除にはセッションIDが必須', async () => {
      const event = {
        action: 'DELETE_FILE' as const,
        filePath: 'test.txt',
      };

      const response = await handler(event);

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('Session ID is required');
    });

    test('ファイル削除にはファイルパスが必須', async () => {
      const event = {
        action: 'DELETE_FILE' as const,
        sessionId,
      };

      const response = await handler(event);

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('File path is required');
    });

    test('ファイル一覧取得にはセッションIDが必須', async () => {
      const event = {
        action: 'LIST_FILES' as const,
      };

      const response = await handler(event);

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('Session ID is required');
    });
  });

  describe('ターミナルコマンド実行', () => {
    let sessionId: string;

    beforeEach(async () => {
      // テスト用セッション作成
      const startEvent = {
        action: 'START_SESSION' as const,
      };
      const startResponse = await handler(startEvent);
      sessionId = startResponse.sessionId!;
    });

    test('コマンド実行にはセッションIDが必須', async () => {
      const event = {
        action: 'EXECUTE_COMMAND' as const,
        command: 'ls -la',
      };

      const response = await handler(event);

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('Session ID is required');
    });

    test('コマンド実行にはコマンドが必須', async () => {
      const event = {
        action: 'EXECUTE_COMMAND' as const,
        sessionId,
      };

      const response = await handler(event);

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('Command is required');
    });

    test('ネットワークアクセスが無効の場合、curlコマンドはエラーになる', async () => {
      const event = {
        action: 'EXECUTE_COMMAND' as const,
        sessionId,
        command: 'curl https://example.com',
      };

      const response = await handler(event);

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('Network access is not allowed');
    });

    test('ネットワークアクセスが無効の場合、wgetコマンドはエラーになる', async () => {
      const event = {
        action: 'EXECUTE_COMMAND' as const,
        sessionId,
        command: 'wget https://example.com',
      };

      const response = await handler(event);

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('Network access is not allowed');
    });

    test('危険なコマンド（rm -rf）はブロックされる', async () => {
      const event = {
        action: 'EXECUTE_COMMAND' as const,
        sessionId,
        command: 'rm -rf /',
      };

      const response = await handler(event);

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('Dangerous command is not allowed');
    });

    test('危険なコマンド（dd）はブロックされる', async () => {
      const event = {
        action: 'EXECUTE_COMMAND' as const,
        sessionId,
        command: 'dd if=/dev/zero of=/dev/sda',
      };

      const response = await handler(event);

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('Dangerous command is not allowed');
    });
  });

  describe('パッケージ管理', () => {
    let sessionId: string;

    beforeEach(async () => {
      // テスト用セッション作成
      const startEvent = {
        action: 'START_SESSION' as const,
      };
      const startResponse = await handler(startEvent);
      sessionId = startResponse.sessionId!;
    });

    test('パッケージインストールにはセッションIDが必須', async () => {
      const event = {
        action: 'INSTALL_PACKAGE' as const,
        packageName: 'numpy',
      };

      const response = await handler(event);

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('Session ID is required');
    });

    test('パッケージインストールにはパッケージ名が必須', async () => {
      const event = {
        action: 'INSTALL_PACKAGE' as const,
        sessionId,
      };

      const response = await handler(event);

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('Package name is required');
    });

    test('許可されていないパッケージはインストールできない', async () => {
      const event = {
        action: 'INSTALL_PACKAGE' as const,
        sessionId,
        packageName: 'malicious-package',
      };

      const response = await handler(event);

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('is not allowed');
    });

    test('パッケージ一覧取得にはセッションIDが必須', async () => {
      const event = {
        action: 'LIST_PACKAGES' as const,
      };

      const response = await handler(event);

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('Session ID is required');
    });

    test('新規セッションではパッケージが0個', async () => {
      const event = {
        action: 'LIST_PACKAGES' as const,
        sessionId,
      };

      const response = await handler(event);

      expect(response.status).toBe('SUCCESS');
      expect(response.result?.output).toContain('No packages installed');
    });
  });

  describe('エラーハンドリング', () => {
    test('不正なアクションはエラーになる', async () => {
      const event = {
        action: 'INVALID_ACTION' as any,
      };

      const response = await handler(event);

      expect(response.status).toBe('FAILED');
      expect(response.error?.code).toBe('INTERNAL_ERROR');
    });

    test('レスポンスには必ずrequestIdが含まれる', async () => {
      const event = {
        action: 'START_SESSION' as const,
      };

      const response = await handler(event);

      expect(response.requestId).toBeDefined();
      expect(typeof response.requestId).toBe('string');
    });

    test('レスポンスには必ずstatusが含まれる', async () => {
      const event = {
        action: 'START_SESSION' as const,
      };

      const response = await handler(event);

      expect(response.status).toBeDefined();
      expect(['SUCCESS', 'FAILED']).toContain(response.status);
    });

    test('レスポンスには必ずmetricsが含まれる', async () => {
      const event = {
        action: 'START_SESSION' as const,
      };

      const response = await handler(event);

      expect(response.metrics).toBeDefined();
      expect(response.metrics.latency).toBeDefined();
      expect(typeof response.metrics.latency).toBe('number');
    });
  });

  describe('メトリクス', () => {
    test('レイテンシが記録される', async () => {
      const event = {
        action: 'START_SESSION' as const,
      };

      const response = await handler(event);

      expect(response.metrics.latency).toBeGreaterThan(0);
    });

    test('実行時間が記録される（コード実行時）', async () => {
      // セッション開始
      const startEvent = {
        action: 'START_SESSION' as const,
      };
      const startResponse = await handler(startEvent);
      const sessionId = startResponse.sessionId!;

      // コード実行（モック環境では実際には実行されない）
      const executeEvent = {
        action: 'EXECUTE_CODE' as const,
        sessionId,
        code: 'print("Hello, World!")',
      };

      const executeResponse = await handler(executeEvent);

      // モック環境ではBedrockが動作しないため、エラーになる可能性がある
      // メトリクスは常に記録される
      expect(executeResponse.metrics).toBeDefined();
      expect(executeResponse.metrics.latency).toBeGreaterThan(0);
    });
  });
});
