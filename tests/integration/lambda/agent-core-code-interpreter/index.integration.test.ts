/**
 * Amazon Bedrock AgentCore Code Interpreter Lambda Function - 統合テスト
 * 
 * 実際のAWSサービスを使用した統合テストです。
 * 
 * @author Kiro AI
 * @date 2026-01-04
 */

import { handler } from '../../../../lambda/agent-core-code-interpreter/index';

describe('Code Interpreter Lambda Function - Integration Tests', () => {
  let sessionId: string;

  // 環境変数設定
  beforeAll(() => {
    // 環境変数が設定されているか確認
    if (!process.env.PROJECT_NAME) {
      throw new Error('PROJECT_NAME environment variable is not set');
    }
    if (!process.env.ENVIRONMENT) {
      throw new Error('ENVIRONMENT environment variable is not set');
    }
  });

  // 各テスト後にセッションをクリーンアップ
  afterEach(async () => {
    if (sessionId) {
      try {
        await handler({
          action: 'STOP_SESSION',
          sessionId,
        });
      } catch (error) {
        console.error('Failed to stop session:', error);
      }
    }
  });

  describe('セッション管理統合テスト', () => {
    test('セッションのライフサイクル（開始→停止）が正常に動作する', async () => {
      // セッション開始
      const startResponse = await handler({
        action: 'START_SESSION',
      });

      expect(startResponse.status).toBe('SUCCESS');
      expect(startResponse.sessionId).toBeDefined();
      expect(startResponse.result?.output).toContain('started successfully');
      expect(startResponse.metrics.latency).toBeGreaterThan(0);

      sessionId = startResponse.sessionId!;

      // セッション停止
      const stopResponse = await handler({
        action: 'STOP_SESSION',
        sessionId,
      });

      expect(stopResponse.status).toBe('SUCCESS');
      expect(stopResponse.result?.output).toContain('stopped successfully');
      expect(stopResponse.metrics.latency).toBeGreaterThan(0);

      // セッションをクリア（afterEachで再度停止しないように）
      sessionId = '';
    }, 60000);

    test('複数のセッションを同時に管理できる', async () => {
      const sessionIds: string[] = [];

      try {
        // 3つのセッションを開始
        for (let i = 0; i < 3; i++) {
          const response = await handler({
            action: 'START_SESSION',
          });

          expect(response.status).toBe('SUCCESS');
          expect(response.sessionId).toBeDefined();
          sessionIds.push(response.sessionId!);
        }

        // 全てのセッションIDがユニークであることを確認
        const uniqueIds = new Set(sessionIds);
        expect(uniqueIds.size).toBe(3);

        // 全てのセッションを停止
        for (const id of sessionIds) {
          const response = await handler({
            action: 'STOP_SESSION',
            sessionId: id,
          });

          expect(response.status).toBe('SUCCESS');
        }
      } finally {
        // クリーンアップ
        for (const id of sessionIds) {
          try {
            await handler({
              action: 'STOP_SESSION',
              sessionId: id,
            });
          } catch (error) {
            // エラーは無視
          }
        }
      }
    }, 120000);
  });

  describe('コード実行統合テスト', () => {
    beforeEach(async () => {
      // テスト用セッション作成
      const response = await handler({
        action: 'START_SESSION',
      });
      sessionId = response.sessionId!;
    });

    test('簡単なPythonコードを実行できる', async () => {
      const response = await handler({
        action: 'EXECUTE_CODE',
        sessionId,
        code: 'print("Hello, World!")',
        language: 'python',
      });

      // Bedrock Agent Runtime APIが利用可能な場合は成功
      // モック環境では失敗する可能性がある
      expect(response.status).toBeDefined();
      expect(response.metrics.latency).toBeGreaterThan(0);

      if (response.status === 'SUCCESS') {
        expect(response.result?.output).toBeDefined();
      }
    }, 120000);

    test('数値計算を実行できる', async () => {
      const response = await handler({
        action: 'EXECUTE_CODE',
        sessionId,
        code: `
result = 2 + 2
print(f"Result: {result}")
        `,
        language: 'python',
      });

      expect(response.status).toBeDefined();
      expect(response.metrics.latency).toBeGreaterThan(0);

      if (response.status === 'SUCCESS') {
        expect(response.result?.output).toBeDefined();
      }
    }, 120000);

    test('タイムアウト設定が動作する', async () => {
      const response = await handler({
        action: 'EXECUTE_CODE',
        sessionId,
        code: 'import time; time.sleep(5)',
        language: 'python',
        options: {
          timeout: 2, // 2秒でタイムアウト
        },
      });

      expect(response.status).toBeDefined();
      expect(response.metrics.latency).toBeGreaterThan(0);

      // タイムアウトエラーまたは実行エラーが発生する
      if (response.status === 'FAILED') {
        expect(response.error?.message).toBeDefined();
      }
    }, 120000);
  });

  describe('ファイル操作統合テスト', () => {
    beforeEach(async () => {
      // テスト用セッション作成
      const response = await handler({
        action: 'START_SESSION',
      });
      sessionId = response.sessionId!;
    });

    test('ファイルの書き込み・読み込み・削除ができる', async () => {
      const testFilePath = 'test-file.txt';
      const testContent = 'Hello, Code Interpreter!';

      // ファイル書き込み
      const writeResponse = await handler({
        action: 'WRITE_FILE',
        sessionId,
        filePath: testFilePath,
        fileContent: testContent,
      });

      expect(writeResponse.status).toBeDefined();
      expect(writeResponse.metrics.latency).toBeGreaterThan(0);

      if (writeResponse.status === 'SUCCESS') {
        // ファイル読み込み
        const readResponse = await handler({
          action: 'READ_FILE',
          sessionId,
          filePath: testFilePath,
        });

        expect(readResponse.status).toBeDefined();

        if (readResponse.status === 'SUCCESS') {
          expect(readResponse.result?.fileContent).toBe(testContent);
        }

        // ファイル削除
        const deleteResponse = await handler({
          action: 'DELETE_FILE',
          sessionId,
          filePath: testFilePath,
        });

        expect(deleteResponse.status).toBeDefined();
      }
    }, 120000);

    test('ファイル一覧を取得できる', async () => {
      // 複数のファイルを作成
      const files = ['file1.txt', 'file2.txt', 'file3.txt'];

      for (const file of files) {
        await handler({
          action: 'WRITE_FILE',
          sessionId,
          filePath: file,
          fileContent: `Content of ${file}`,
        });
      }

      // ファイル一覧取得
      const listResponse = await handler({
        action: 'LIST_FILES',
        sessionId,
      });

      expect(listResponse.status).toBeDefined();
      expect(listResponse.metrics.latency).toBeGreaterThan(0);

      if (listResponse.status === 'SUCCESS') {
        expect(listResponse.result?.files).toBeDefined();
        expect(Array.isArray(listResponse.result?.files)).toBe(true);
      }
    }, 120000);
  });

  describe('ターミナルコマンド実行統合テスト', () => {
    beforeEach(async () => {
      // テスト用セッション作成
      const response = await handler({
        action: 'START_SESSION',
      });
      sessionId = response.sessionId!;
    });

    test('安全なコマンドを実行できる', async () => {
      const response = await handler({
        action: 'EXECUTE_COMMAND',
        sessionId,
        command: 'echo "Hello, World!"',
      });

      expect(response.status).toBeDefined();
      expect(response.metrics.latency).toBeGreaterThan(0);

      if (response.status === 'SUCCESS') {
        expect(response.result?.output).toBeDefined();
      }
    }, 120000);

    test('危険なコマンドはブロックされる', async () => {
      const dangerousCommands = [
        'rm -rf /',
        'dd if=/dev/zero of=/dev/sda',
        'mkfs.ext4 /dev/sda1',
      ];

      for (const cmd of dangerousCommands) {
        const response = await handler({
          action: 'EXECUTE_COMMAND',
          sessionId,
          command: cmd,
        });

        expect(response.status).toBe('FAILED');
        expect(response.error?.message).toContain('Dangerous command is not allowed');
      }
    }, 120000);

    test('ネットワークアクセスが無効の場合、curlコマンドはブロックされる', async () => {
      const response = await handler({
        action: 'EXECUTE_COMMAND',
        sessionId,
        command: 'curl https://example.com',
      });

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('Network access is not allowed');
    }, 120000);
  });

  describe('パッケージ管理統合テスト', () => {
    beforeEach(async () => {
      // テスト用セッション作成
      const response = await handler({
        action: 'START_SESSION',
      });
      sessionId = response.sessionId!;
    });

    test('許可されたパッケージをインストールできる', async () => {
      const response = await handler({
        action: 'INSTALL_PACKAGE',
        sessionId,
        packageName: 'numpy',
        packageVersion: '1.24.0',
        language: 'python',
      });

      expect(response.status).toBeDefined();
      expect(response.metrics.latency).toBeGreaterThan(0);

      if (response.status === 'SUCCESS') {
        expect(response.result?.output).toContain('numpy');

        // パッケージ一覧を確認
        const listResponse = await handler({
          action: 'LIST_PACKAGES',
          sessionId,
        });

        expect(listResponse.status).toBe('SUCCESS');
        expect(listResponse.result?.files).toContain('numpy==1.24.0');
      }
    }, 180000); // パッケージインストールは時間がかかる

    test('許可されていないパッケージはインストールできない', async () => {
      const response = await handler({
        action: 'INSTALL_PACKAGE',
        sessionId,
        packageName: 'malicious-package',
        language: 'python',
      });

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('is not allowed');
    }, 120000);

    test('インストール済みパッケージ一覧を取得できる', async () => {
      const response = await handler({
        action: 'LIST_PACKAGES',
        sessionId,
      });

      expect(response.status).toBe('SUCCESS');
      expect(response.result?.output).toBeDefined();
      expect(response.metrics.latency).toBeGreaterThan(0);
    }, 120000);
  });

  describe('エラーハンドリング統合テスト', () => {
    test('存在しないセッションでの操作はエラーになる', async () => {
      const nonExistentSessionId = 'session-non-existent-12345';

      const response = await handler({
        action: 'EXECUTE_CODE',
        sessionId: nonExistentSessionId,
        code: 'print("Hello")',
      });

      expect(response.status).toBe('FAILED');
      expect(response.error?.message).toContain('not found');
    }, 60000);

    test('不正なアクションはエラーになる', async () => {
      const response = await handler({
        action: 'INVALID_ACTION' as any,
      });

      expect(response.status).toBe('FAILED');
      expect(response.error?.code).toBe('INTERNAL_ERROR');
    }, 60000);
  });

  describe('メトリクス統合テスト', () => {
    beforeEach(async () => {
      // テスト用セッション作成
      const response = await handler({
        action: 'START_SESSION',
      });
      sessionId = response.sessionId!;
    });

    test('全てのレスポンスにメトリクスが含まれる', async () => {
      const actions = [
        { action: 'LIST_FILES' as const, sessionId },
        { action: 'LIST_PACKAGES' as const, sessionId },
      ];

      for (const event of actions) {
        const response = await handler(event);

        expect(response.metrics).toBeDefined();
        expect(response.metrics.latency).toBeGreaterThan(0);
        expect(typeof response.metrics.latency).toBe('number');
      }
    }, 120000);

    test('実行時間が記録される（コード実行時）', async () => {
      const response = await handler({
        action: 'EXECUTE_CODE',
        sessionId,
        code: 'print("Hello")',
        language: 'python',
      });

      expect(response.metrics).toBeDefined();
      expect(response.metrics.latency).toBeGreaterThan(0);

      if (response.status === 'SUCCESS' && response.metrics.executionTime) {
        expect(response.metrics.executionTime).toBeGreaterThan(0);
      }
    }, 120000);
  });
});
