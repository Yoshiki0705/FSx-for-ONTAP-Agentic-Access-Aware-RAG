/**
 * 高度権限制御システム テストスイート
 * 
 * Bedrock Chat APIの権限チェック機能をテスト
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';

// テスト用のモック設定
jest.mock('@aws-sdk/client-bedrock-runtime');
jest.mock('@aws-sdk/client-lambda');

describe('高度権限制御システム - Bedrock Chat API', () => {
  
  beforeEach(() => {
    // 環境変数のモック設定
    process.env.AWS_REGION = 'ap-northeast-1';
    process.env.PERMISSION_FILTER_FUNCTION_NAME = 'test-permission-filter';
    process.env.AUDIT_LOG_FUNCTION_NAME = 'test-audit-log';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('時間ベース制限テスト', () => {
    
    test('営業時間内のアクセス（平日14:00）- 許可', async () => {
      // 平日14:00のモック
      const mockDate = new Date('2024-01-15T14:00:00+09:00'); // 月曜日14:00
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const request = new NextRequest('http://localhost:3000/api/bedrock/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Browser'
        },
        body: JSON.stringify({
          message: 'テストメッセージ',
          userId: 'testuser',
          permissions: ['basic']
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    test('営業時間外のアクセス（平日22:00）- 拒否', async () => {
      // 平日22:00のモック
      const mockDate = new Date('2024-01-15T22:00:00+09:00'); // 月曜日22:00
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const request = new NextRequest('http://localhost:3000/api/bedrock/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Browser'
        },
        body: JSON.stringify({
          message: 'テストメッセージ',
          userId: 'testuser',
          permissions: ['basic']
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.reason).toContain('営業時間外');
    });

    test('緊急アクセスユーザーの深夜アクセス（2:00）- 許可', async () => {
      // 深夜2:00のモック
      const mockDate = new Date('2024-01-15T02:00:00+09:00'); // 月曜日2:00
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const request = new NextRequest('http://localhost:3000/api/bedrock/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Browser'
        },
        body: JSON.stringify({
          message: 'テストメッセージ',
          userId: 'admin001', // 緊急アクセスユーザー
          permissions: ['admin']
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    test('週末アクセス（土曜日14:00）- 拒否', async () => {
      // 土曜日14:00のモック
      const mockDate = new Date('2024-01-13T14:00:00+09:00'); // 土曜日14:00
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const request = new NextRequest('http://localhost:3000/api/bedrock/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Browser'
        },
        body: JSON.stringify({
          message: 'テストメッセージ',
          userId: 'testuser',
          permissions: ['basic']
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.reason).toContain('営業時間外');
    });
  });

  describe('地理的制限テスト', () => {
    
    test('日本からの許可されたIPアクセス - 許可', async () => {
      const mockDate = new Date('2024-01-15T14:00:00+09:00'); // 平日14:00
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const request = new NextRequest('http://localhost:3000/api/bedrock/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.10', // 許可されたIPレンジ
          'user-agent': 'Test Browser'
        },
        body: JSON.stringify({
          message: 'テストメッセージ',
          userId: 'testuser',
          permissions: ['basic']
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    test('海外からの未許可アクセス - 拒否', async () => {
      const mockDate = new Date('2024-01-15T14:00:00+09:00'); // 平日14:00
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const request = new NextRequest('http://localhost:3000/api/bedrock/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '8.8.8.8', // 海外IP
          'user-agent': 'Test Browser'
        },
        body: JSON.stringify({
          message: 'テストメッセージ',
          userId: 'testuser',
          permissions: ['basic']
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.reason).toContain('許可されていない地域');
    });
  });

  describe('動的権限テスト', () => {
    
    test('プロジェクト参加ユーザーの機密リソースアクセス - 許可', async () => {
      const mockDate = new Date('2024-01-15T14:00:00+09:00'); // 平日14:00
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const request = new NextRequest('http://localhost:3000/api/bedrock/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Browser'
        },
        body: JSON.stringify({
          message: 'テストメッセージ',
          userId: 'project_alpha_user',
          permissions: ['project_access'],
          modelId: 'bedrock-chat-confidential'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    test('一般ユーザーの機密リソースアクセス - 拒否', async () => {
      const mockDate = new Date('2024-01-15T14:00:00+09:00'); // 平日14:00
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const request = new NextRequest('http://localhost:3000/api/bedrock/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Browser'
        },
        body: JSON.stringify({
          message: 'テストメッセージ',
          userId: 'testuser',
          permissions: ['basic'],
          modelId: 'bedrock-chat-confidential'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.reason).toContain('アクセス権限がありません');
    });
  });

  describe('エラーハンドリングテスト', () => {
    
    test('必須パラメータ不足 - エラー', async () => {
      const request = new NextRequest('http://localhost:3000/api/bedrock/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Browser'
        },
        body: JSON.stringify({
          // messageが不足
          userId: 'testuser',
          permissions: ['basic']
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Message is required');
    });

    test('不正なJSONリクエスト - エラー', async () => {
      const request = new NextRequest('http://localhost:3000/api/bedrock/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Browser'
        },
        body: 'invalid json'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('監査ログテスト', () => {
    
    test('アクセス成功時の監査ログ記録', async () => {
      const mockDate = new Date('2024-01-15T14:00:00+09:00'); // 平日14:00
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const request = new NextRequest('http://localhost:3000/api/bedrock/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Browser'
        },
        body: JSON.stringify({
          message: 'テストメッセージ',
          userId: 'testuser',
          permissions: ['basic']
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.securityInfo).toBeDefined();
      expect(data.securityInfo.permissionCheckPassed).toBe(true);
    });

    test('アクセス拒否時の監査ログ記録', async () => {
      const mockDate = new Date('2024-01-15T22:00:00+09:00'); // 平日22:00
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const request = new NextRequest('http://localhost:3000/api/bedrock/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Test Browser'
        },
        body: JSON.stringify({
          message: 'テストメッセージ',
          userId: 'testuser',
          permissions: ['basic']
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.auditLog).toBeDefined();
      expect(data.auditLog.result).toBe('DENIED');
    });
  });
});