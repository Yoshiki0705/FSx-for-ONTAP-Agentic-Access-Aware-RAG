/**
 * Amazon Bedrock AgentCore Browser - Lambda関数単体テスト
 * 
 * @description Lambda関数の単体テストを実施
 * @author Kiro AI
 * @created 2026-01-03
 */

import { handler } from '../../../../lambda/agent-core-browser/index';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import * as puppeteer from 'puppeteer-core';

// AWS SDK Mockの作成
const s3Mock = mockClient(S3Client);

// Puppeteer Mockの作成
jest.mock('puppeteer-core');
jest.mock('@sparticuz/chromium');

describe('AgentCore Browser Lambda Handler', () => {
  let mockBrowser: any;
  let mockPage: any;

  // 各テスト前にモックをリセット
  beforeEach(() => {
    s3Mock.reset();
    
    // 環境変数を設定
    process.env.BROWSER_ACCESS_POINT_ARN = 'arn:aws:s3:us-east-1:123456789012:accesspoint/browser-ap';
    process.env.NODE_ENV = 'production';
    process.env.PROJECT_NAME = 'test-project';
    process.env.ENVIRONMENT = 'test';
    process.env.AWS_REGION = 'us-east-1';

    // Puppeteer Mockの設定
    mockPage = {
      goto: jest.fn().mockResolvedValue(undefined),
      screenshot: jest.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
      pdf: jest.fn().mockResolvedValue(Buffer.from('fake-pdf')),
      content: jest.fn().mockResolvedValue('<html><body>Test</body></html>'),
      evaluate: jest.fn().mockResolvedValue('Test content'),
      close: jest.fn().mockResolvedValue(undefined),
    };

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
    };

    (puppeteer.launch as jest.Mock).mockResolvedValue(mockBrowser);
  });

  // 各テスト後に環境変数をクリア
  afterEach(() => {
    delete process.env.BROWSER_ACCESS_POINT_ARN;
    delete process.env.NODE_ENV;
    delete process.env.PROJECT_NAME;
    delete process.env.ENVIRONMENT;
    delete process.env.AWS_REGION;
    jest.clearAllMocks();
  });

  describe('環境変数の読み込み', () => {
    it('必須環境変数が正しく読み込まれる', async () => {
      // Arrange
      const event = {
        action: 'screenshot',
        url: 'https://example.com',
      };

      s3Mock.on(PutObjectCommand).resolves({});

      // Act
      const result = await handler(event);

      // Assert
      expect(result).toBeDefined();
      expect(result.statusCode).toBe(200);
    });

    it('環境変数が欠落している場合はエラーを返す', async () => {
      // Arrange
      delete process.env.BROWSER_ACCESS_POINT_ARN;
      
      const event = {
        action: 'screenshot',
        url: 'https://example.com',
      };

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('環境変数が設定されていません');
    });
  });

  describe('Puppeteer統合', () => {
    it('Puppeteerが正しく起動される', async () => {
      // Arrange
      const event = {
        action: 'screenshot',
        url: 'https://example.com',
      };

      s3Mock.on(PutObjectCommand).resolves({});

      // Act
      await handler(event);

      // Assert
      expect(puppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          headless: expect.any(Boolean),
        })
      );
    });

    it('ページが正しく開かれる', async () => {
      // Arrange
      const event = {
        action: 'screenshot',
        url: 'https://example.com',
      };

      s3Mock.on(PutObjectCommand).resolves({});

      // Act
      await handler(event);

      // Assert
      expect(mockBrowser.newPage).toHaveBeenCalled();
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com');
    });

    it('ブラウザが正しくクローズされる', async () => {
      // Arrange
      const event = {
        action: 'screenshot',
        url: 'https://example.com',
      };

      s3Mock.on(PutObjectCommand).resolves({});

      // Act
      await handler(event);

      // Assert
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('スクリーンショット機能', () => {
    it('PNG形式のスクリーンショットが撮影される', async () => {
      // Arrange
      const event = {
        action: 'screenshot',
        url: 'https://example.com',
        format: 'png',
      };

      s3Mock.on(PutObjectCommand).resolves({});

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(200);
      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'png',
        })
      );
    });

    it('JPEG形式のスクリーンショットが撮影される', async () => {
      // Arrange
      const event = {
        action: 'screenshot',
        url: 'https://example.com',
        format: 'jpeg',
        quality: 80,
      };

      s3Mock.on(PutObjectCommand).resolves({});

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(200);
      expect(mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'jpeg',
          quality: 80,
        })
      );
    });
  });

  describe('FSx for ONTAP + S3 Access Points保存', () => {
    it('スクリーンショットがFSx for ONTAP + S3 Access Points経由で保存される', async () => {
      // Arrange
      const event = {
        action: 'screenshot',
        url: 'https://example.com',
      };

      s3Mock.on(PutObjectCommand).resolves({});

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(200);
      expect(s3Mock.calls()).toHaveLength(1);
      
      const call = s3Mock.call(0);
      expect(call.args[0].input).toMatchObject({
        Bucket: 'arn:aws:s3:us-east-1:123456789012:accesspoint/browser-ap',
        ContentType: 'image/png',
      });
    });
  });

  describe('エラーハンドリング', () => {
    it('Puppeteerエラーが正しくハンドリングされる', async () => {
      // Arrange
      const event = {
        action: 'screenshot',
        url: 'https://example.com',
      };

      (puppeteer.launch as jest.Mock).mockRejectedValue(new Error('Puppeteer Error'));

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('Puppeteerエラー');
    });

    it('S3エラーが正しくハンドリングされる', async () => {
      // Arrange
      const event = {
        action: 'screenshot',
        url: 'https://example.com',
      };

      s3Mock.on(PutObjectCommand).rejects(new Error('S3 Error'));

      // Act
      const result = await handler(event);

      // Assert
      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('S3保存エラー');
    });
  });
});
