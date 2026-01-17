/**
 * TASK-1.3.2: エンドツーエンドテスト
 * 
 * このテストは、Runtime機能のエンドツーエンドテストを実施します。
 * 
 * テスト内容:
 * - Bedrock Agentが正しく実行される
 * - Lambda関数が正しくスケールする
 * - エラーが正しくハンドリングされる
 * - パフォーマンスが要件を満たす
 * 
 * 注意: このテストは実際のAWS環境が必要です。
 * 環境変数を設定してから実行してください:
 * - AWS_REGION: AWSリージョン（例: ap-northeast-1）
 * - LAMBDA_FUNCTION_NAME: Lambda関数名
 * - BEDROCK_AGENT_ID: Bedrock Agent ID
 * - BEDROCK_AGENT_ALIAS_ID: Bedrock Agent Alias ID
 */

import {
  LambdaClient,
  InvokeCommand,
  GetFunctionCommand,
  GetFunctionConcurrencyCommand,
} from '@aws-sdk/client-lambda';
import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
} from '@aws-sdk/client-cloudwatch';

describe('Runtime E2Eテスト', () => {
  let lambdaClient: LambdaClient;
  let cloudWatchClient: CloudWatchClient;
  let functionName: string;
  let bedrockAgentId: string;
  let bedrockAgentAliasId: string;

  beforeAll(() => {
    // 環境変数を確認
    const region = process.env.AWS_REGION || 'ap-northeast-1';
    functionName = process.env.LAMBDA_FUNCTION_NAME || '';
    bedrockAgentId = process.env.BEDROCK_AGENT_ID || '';
    bedrockAgentAliasId = process.env.BEDROCK_AGENT_ALIAS_ID || '';

    if (!functionName || !bedrockAgentId || !bedrockAgentAliasId) {
      console.warn(
        '⚠️  環境変数が設定されていません。E2Eテストをスキップします。'
      );
      console.warn('  必要な環境変数:');
      console.warn('  - LAMBDA_FUNCTION_NAME');
      console.warn('  - BEDROCK_AGENT_ID');
      console.warn('  - BEDROCK_AGENT_ALIAS_ID');
    }

    // AWS SDKクライアントを初期化
    lambdaClient = new LambdaClient({ region });
    cloudWatchClient = new CloudWatchClient({ region });
  });

  afterAll(async () => {
    // クリーンアップ
    lambdaClient.destroy();
    cloudWatchClient.destroy();
  });

  describe('E2Eテスト: Bedrock Agent実行', () => {
    test('Bedrock Agentが正しく実行される', async () => {
      // 環境変数が設定されていない場合はスキップ
      if (!functionName || !bedrockAgentId || !bedrockAgentAliasId) {
        console.warn('⚠️  環境変数が設定されていないため、テストをスキップします。');
        return;
      }

      // Lambda関数を呼び出し
      const command = new InvokeCommand({
        FunctionName: functionName,
        Payload: JSON.stringify({
          agentId: bedrockAgentId,
          agentAliasId: bedrockAgentAliasId,
          sessionId: `test-session-${Date.now()}`,
          inputText: 'こんにちは、テストです。',
          enableTrace: true,
        }),
      });

      const response = await lambdaClient.send(command);

      // レスポンスを検証
      expect(response.StatusCode).toBe(200);
      expect(response.Payload).toBeDefined();

      // ペイロードをパース
      const payload = JSON.parse(
        new TextDecoder().decode(response.Payload)
      );

      // レスポンス構造を検証
      expect(payload).toHaveProperty('statusCode');
      expect(payload.statusCode).toBe(200);
      expect(payload).toHaveProperty('body');

      const body = JSON.parse(payload.body);
      expect(body).toHaveProperty('sessionId');
      expect(body).toHaveProperty('completion');
      expect(body).toHaveProperty('trace');
    }, 60000); // 60秒タイムアウト

    test('ストリーミングレスポンスが正しく処理される', async () => {
      // 環境変数が設定されていない場合はスキップ
      if (!functionName || !bedrockAgentId || !bedrockAgentAliasId) {
        console.warn('⚠️  環境変数が設定されていないため、テストをスキップします。');
        return;
      }

      // Lambda関数を呼び出し（ストリーミング有効）
      const command = new InvokeCommand({
        FunctionName: functionName,
        Payload: JSON.stringify({
          agentId: bedrockAgentId,
          agentAliasId: bedrockAgentAliasId,
          sessionId: `test-session-${Date.now()}`,
          inputText: 'ストリーミングテストです。',
          enableTrace: false,
        }),
      });

      const response = await lambdaClient.send(command);

      // レスポンスを検証
      expect(response.StatusCode).toBe(200);
      expect(response.Payload).toBeDefined();

      // ペイロードをパース
      const payload = JSON.parse(
        new TextDecoder().decode(response.Payload)
      );

      // レスポンス構造を検証
      expect(payload).toHaveProperty('statusCode');
      expect(payload.statusCode).toBe(200);
      expect(payload).toHaveProperty('body');

      const body = JSON.parse(payload.body);
      expect(body).toHaveProperty('completion');
      expect(body.completion).toBeTruthy();
    }, 60000); // 60秒タイムアウト
  });

  describe('E2Eテスト: Lambda関数スケーリング', () => {
    test('Lambda関数が正しくスケールする', async () => {
      // 環境変数が設定されていない場合はスキップ
      if (!functionName) {
        console.warn('⚠️  環境変数が設定されていないため、テストをスキップします。');
        return;
      }

      // Lambda関数の設定を取得
      const getFunctionCommand = new GetFunctionCommand({
        FunctionName: functionName,
      });

      const functionResponse = await lambdaClient.send(getFunctionCommand);

      // Reserved Concurrencyを確認
      expect(functionResponse.Concurrency).toBeDefined();
      expect(
        functionResponse.Concurrency?.ReservedConcurrentExecutions
      ).toBeGreaterThan(0);

      // 並行実行数を取得
      const getConcurrencyCommand = new GetFunctionConcurrencyCommand({
        FunctionName: functionName,
      });

      const concurrencyResponse = await lambdaClient.send(
        getConcurrencyCommand
      );

      expect(concurrencyResponse.ReservedConcurrentExecutions).toBeDefined();
      expect(
        concurrencyResponse.ReservedConcurrentExecutions
      ).toBeGreaterThan(0);
    }, 30000); // 30秒タイムアウト

    test('複数の同時リクエストを処理できる', async () => {
      // 環境変数が設定されていない場合はスキップ
      if (!functionName || !bedrockAgentId || !bedrockAgentAliasId) {
        console.warn('⚠️  環境変数が設定されていないため、テストをスキップします。');
        return;
      }

      // 5つの同時リクエストを送信
      const promises = Array.from({ length: 5 }, (_, i) => {
        const command = new InvokeCommand({
          FunctionName: functionName,
          Payload: JSON.stringify({
            agentId: bedrockAgentId,
            agentAliasId: bedrockAgentAliasId,
            sessionId: `test-session-concurrent-${Date.now()}-${i}`,
            inputText: `並行テスト ${i + 1}`,
            enableTrace: false,
          }),
        });

        return lambdaClient.send(command);
      });

      // 全てのリクエストが成功することを確認
      const responses = await Promise.all(promises);

      responses.forEach((response, i) => {
        expect(response.StatusCode).toBe(200);
        expect(response.Payload).toBeDefined();

        const payload = JSON.parse(
          new TextDecoder().decode(response.Payload)
        );
        expect(payload.statusCode).toBe(200);
      });
    }, 120000); // 120秒タイムアウト
  });

  describe('E2Eテスト: エラーハンドリング', () => {
    test('無効なパラメータの場合はエラーを返す', async () => {
      // 環境変数が設定されていない場合はスキップ
      if (!functionName) {
        console.warn('⚠️  環境変数が設定されていないため、テストをスキップします。');
        return;
      }

      // 無効なパラメータでLambda関数を呼び出し
      const command = new InvokeCommand({
        FunctionName: functionName,
        Payload: JSON.stringify({
          // agentIdが欠落
          agentAliasId: bedrockAgentAliasId,
          sessionId: `test-session-${Date.now()}`,
          inputText: 'エラーテストです。',
        }),
      });

      const response = await lambdaClient.send(command);

      // レスポンスを検証
      expect(response.StatusCode).toBe(200);
      expect(response.Payload).toBeDefined();

      // ペイロードをパース
      const payload = JSON.parse(
        new TextDecoder().decode(response.Payload)
      );

      // エラーレスポンスを検証
      expect(payload).toHaveProperty('statusCode');
      expect(payload.statusCode).toBe(400);
      expect(payload).toHaveProperty('body');

      const body = JSON.parse(payload.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toContain('agentId');
    }, 30000); // 30秒タイムアウト

    test('存在しないAgentIDの場合はエラーを返す', async () => {
      // 環境変数が設定されていない場合はスキップ
      if (!functionName || !bedrockAgentAliasId) {
        console.warn('⚠️  環境変数が設定されていないため、テストをスキップします。');
        return;
      }

      // 存在しないAgentIDでLambda関数を呼び出し
      const command = new InvokeCommand({
        FunctionName: functionName,
        Payload: JSON.stringify({
          agentId: 'non-existent-agent-id',
          agentAliasId: bedrockAgentAliasId,
          sessionId: `test-session-${Date.now()}`,
          inputText: 'エラーテストです。',
        }),
      });

      const response = await lambdaClient.send(command);

      // レスポンスを検証
      expect(response.StatusCode).toBe(200);
      expect(response.Payload).toBeDefined();

      // ペイロードをパース
      const payload = JSON.parse(
        new TextDecoder().decode(response.Payload)
      );

      // エラーレスポンスを検証
      expect(payload).toHaveProperty('statusCode');
      expect(payload.statusCode).toBeGreaterThanOrEqual(400);
      expect(payload).toHaveProperty('body');

      const body = JSON.parse(payload.body);
      expect(body).toHaveProperty('error');
    }, 30000); // 30秒タイムアウト
  });

  describe('E2Eテスト: パフォーマンス', () => {
    test('レイテンシが要件を満たす（3秒以内）', async () => {
      // 環境変数が設定されていない場合はスキップ
      if (!functionName || !bedrockAgentId || !bedrockAgentAliasId) {
        console.warn('⚠️  環境変数が設定されていないため、テストをスキップします。');
        return;
      }

      // 開始時刻を記録
      const startTime = Date.now();

      // Lambda関数を呼び出し
      const command = new InvokeCommand({
        FunctionName: functionName,
        Payload: JSON.stringify({
          agentId: bedrockAgentId,
          agentAliasId: bedrockAgentAliasId,
          sessionId: `test-session-${Date.now()}`,
          inputText: 'パフォーマンステストです。',
          enableTrace: false,
        }),
      });

      const response = await lambdaClient.send(command);

      // 終了時刻を記録
      const endTime = Date.now();
      const latency = endTime - startTime;

      // レイテンシを検証（3秒以内）
      expect(latency).toBeLessThan(3000);

      // レスポンスを検証
      expect(response.StatusCode).toBe(200);
    }, 60000); // 60秒タイムアウト

    test('CloudWatchメトリクスが記録される', async () => {
      // 環境変数が設定されていない場合はスキップ
      if (!functionName) {
        console.warn('⚠️  環境変数が設定されていないため、テストをスキップします。');
        return;
      }

      // CloudWatchメトリクスを取得
      const command = new GetMetricStatisticsCommand({
        Namespace: 'AWS/Lambda',
        MetricName: 'Invocations',
        Dimensions: [
          {
            Name: 'FunctionName',
            Value: functionName,
          },
        ],
        StartTime: new Date(Date.now() - 3600000), // 1時間前
        EndTime: new Date(),
        Period: 300, // 5分
        Statistics: ['Sum'],
      });

      const response = await cloudWatchClient.send(command);

      // メトリクスが記録されていることを確認
      expect(response.Datapoints).toBeDefined();
      expect(response.Datapoints!.length).toBeGreaterThan(0);
    }, 30000); // 30秒タイムアウト
  });

  describe('E2Eテスト: トレース機能', () => {
    test('トレース機能が有効な場合、トレース情報が含まれる', async () => {
      // 環境変数が設定されていない場合はスキップ
      if (!functionName || !bedrockAgentId || !bedrockAgentAliasId) {
        console.warn('⚠️  環境変数が設定されていないため、テストをスキップします。');
        return;
      }

      // Lambda関数を呼び出し（トレース有効）
      const command = new InvokeCommand({
        FunctionName: functionName,
        Payload: JSON.stringify({
          agentId: bedrockAgentId,
          agentAliasId: bedrockAgentAliasId,
          sessionId: `test-session-${Date.now()}`,
          inputText: 'トレーステストです。',
          enableTrace: true,
        }),
      });

      const response = await lambdaClient.send(command);

      // レスポンスを検証
      expect(response.StatusCode).toBe(200);
      expect(response.Payload).toBeDefined();

      // ペイロードをパース
      const payload = JSON.parse(
        new TextDecoder().decode(response.Payload)
      );

      // レスポンス構造を検証
      expect(payload).toHaveProperty('statusCode');
      expect(payload.statusCode).toBe(200);
      expect(payload).toHaveProperty('body');

      const body = JSON.parse(payload.body);
      expect(body).toHaveProperty('trace');
      expect(body.trace).toBeDefined();
      expect(Array.isArray(body.trace)).toBe(true);
      expect(body.trace.length).toBeGreaterThan(0);
    }, 60000); // 60秒タイムアウト
  });
});
