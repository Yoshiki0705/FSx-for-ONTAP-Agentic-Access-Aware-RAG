/**
 * Bedrock Chat API — 権限チェックの契約
 *
 * このスイートは以前、営業時間・地理的制限・動的権限といった判定を
 * **このルートが行う**前提で書かれていた。実装はそれらを判定しない。
 * `checkPermissions()` は権限フィルタ Lambda を `InvokeCommand` で呼び、
 * その verdict を転送するだけで、時刻や IP による判定は Lambda 側にある。
 *
 * 加えて、jsdom には Web の `Request` グローバルが無いため、route handler を
 * import した時点で `ReferenceError: Request is not defined` になり、
 * **このスイートは 1 度も実行されていなかった**（CI も frontend の Jest を
 * 呼んでいない）。読み込めるようにしたうえで、実装が実際に持っている契約
 * ——Lambda の応答をどう解釈し、どの状態で何を返すか——を検査する形に直した。
 *
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

jest.mock('@aws-sdk/client-bedrock-runtime');
jest.mock('@aws-sdk/client-lambda');

import { LambdaClient } from '@aws-sdk/client-lambda';
import { POST } from '../route';

/** Lambda の応答（Payload は Uint8Array）を組み立てる */
function lambdaPayload(statusCode: number, body: Record<string, unknown>) {
  return {
    Payload: new TextEncoder().encode(
      JSON.stringify({ statusCode, body: JSON.stringify(body) }),
    ),
  };
}

/**
 * `send` は prototype 側に差し替える。
 *
 * ルートはモジュール読み込み時に `new LambdaClient(...)` を実行して
 * インスタンスを保持するため、あとから constructor を差し替えても
 * そのインスタンスには届かない（automock された prototype メソッドを共有している）。
 */
function mockLambdaSend(impl: () => unknown) {
  const send = jest.fn(impl);
  (LambdaClient.prototype as unknown as { send: unknown }).send = send;
  return send;
}

function chatRequest(body: Record<string, unknown> | string) {
  return new NextRequest('http://localhost:3000/api/bedrock/chat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.10',
      'user-agent': 'Jest',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('Bedrock Chat API の権限チェック', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.AWS_REGION = 'ap-northeast-1';
    process.env.PERMISSION_FILTER_FUNCTION_NAME = 'test-permission-filter';
    delete process.env.ENABLE_PERMISSION_CHECK;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  describe('Lambda の verdict を転送する', () => {
    test('拒否されたら 403 と Lambda のメッセージを返す', async () => {
      mockLambdaSend(() =>
        lambdaPayload(200, { allowed: false, message: '営業時間外のためアクセスできません' }),
      );

      const response = await POST(chatRequest({ message: 'テスト', userId: 'u1' }));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      // 判定理由は Lambda が決める。ルートはそれをそのまま見せる
      expect(data.reason).toBe('営業時間外のためアクセスできません');
    });

    test('Lambda が 200 でも allowed=false なら拒否する', async () => {
      mockLambdaSend(() => lambdaPayload(200, { allowed: false, message: '権限がありません' }));

      const response = await POST(chatRequest({ message: 'テスト', userId: 'u1' }));

      expect(response.status).toBe(403);
    });

    test('Lambda が 403 を返したら allowed=true でも拒否する', async () => {
      mockLambdaSend(() => lambdaPayload(403, { allowed: true, message: '拒否' }));

      const response = await POST(chatRequest({ message: 'テスト', userId: 'u1' }));

      expect(response.status).toBe(403);
    });
  });

  describe('Lambda が答えられない場合', () => {
    test('応答が空なら拒否する（fail-closed）', async () => {
      mockLambdaSend(() => ({}));

      const response = await POST(chatRequest({ message: 'テスト', userId: 'u1' }));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.reason).toBe('権限チェック処理中にエラーが発生しました');
    });

    test('想定外の例外は拒否する（fail-closed）', async () => {
      mockLambdaSend(() => {
        throw Object.assign(new Error('boom'), { name: 'ThrottlingException' });
      });

      const response = await POST(chatRequest({ message: 'テスト', userId: 'u1' }));

      expect(response.status).toBe(403);
    });

    test('関数が存在しない場合は開発モードとして許可する（意図された fail-open）', async () => {
      // 実装の分岐。デプロイ前の開発でロックアウトしないための例外で、
      // ResourceNotFoundException / AccessDeniedException に限られる。
      mockLambdaSend(() => {
        throw Object.assign(new Error('missing'), { name: 'ResourceNotFoundException' });
      });

      const response = await POST(chatRequest({ message: 'テスト', userId: 'u1' }));

      // Bedrock 呼び出しはモックなので 403 以外であること（＝権限段で止まっていない）を見る
      expect(response.status).not.toBe(403);
    });
  });

  describe('環境変数による無効化', () => {
    test('ENABLE_PERMISSION_CHECK=false のとき Lambda を呼ばない', async () => {
      process.env.ENABLE_PERMISSION_CHECK = 'false';
      const send = mockLambdaSend(() => lambdaPayload(200, { allowed: false }));

      const response = await POST(chatRequest({ message: 'テスト', userId: 'u1' }));

      expect(send).not.toHaveBeenCalled();
      expect(response.status).not.toBe(403);
    });
  });

  describe('入力の検証', () => {
    // 修正前は request.json() が try の外にあり、例外がハンドラを抜けて
    // 制御されていない 500 になっていた。
    test('壊れた JSON は 400 を返し、権限段まで進まない', async () => {
      const send = mockLambdaSend(() => lambdaPayload(200, { allowed: true }));

      const response = await POST(chatRequest('invalid json'));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('JSON');
      expect(send).not.toHaveBeenCalled();
    });
  });
});
