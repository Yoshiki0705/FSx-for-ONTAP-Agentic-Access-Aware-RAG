/**
 * Amazon Bedrock AgentCore Browser Lambda Function - 統合テスト
 * 
 * @author Kiro AI
 * @date 2026-01-04
 */

import { S3Client, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { handler } from '../../../../lambda/agent-core-browser/index';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-1' });
const testScreenshotKeys: Array<{ bucket: string; key: string }> = [];

async function cleanupTestData() {
  for (const { bucket, key } of testScreenshotKeys) {
    try {
      await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      console.log(`クリーンアップ完了: s3://${bucket}/${key}`);
    } catch (error) {
      console.error(`クリーンアップエラー (${key}):`, error);
    }
  }
  testScreenshotKeys.length = 0;
}

describe('Browser Lambda Function - 統合テスト', () => {
  afterEach(async () => {
    await cleanupTestData();
  });

  describe('SCREENSHOT - スクリーンショット撮影', () => {
    it('正常にスクリーンショットを撮影してS3に保存できる', async () => {
      const request = {
        action: 'SCREENSHOT' as const,
        url: 'https://example.com',
        options: {
          viewport: { width: 1920, height: 1080 },
          waitFor: 'body',
          timeout: 30000,
        },
      };

      const response = await handler(request);

      // エラーメッセージを出力
      if (response.status === 'FAILED') {
        console.error('Screenshot test failed:', response.error);
      }

      expect(response.status).toBe('SUCCESS');
      expect(response.requestId).toBeDefined();
      expect(response.result?.screenshot).toBeDefined();
      expect(response.metrics.latency).toBeGreaterThan(0);
      expect(response.metrics.pageLoadTime).toBeGreaterThan(0);

      if (response.result?.screenshot) {
        const s3Url = response.result.screenshot;
        const match = s3Url.match(/s3:\/\/([^\/]+)\/(.+)/);
        if (match) {
          const [, bucket, key] = match;
          const headCommand = new HeadObjectCommand({ Bucket: bucket, Key: key });
          const headResponse = await s3Client.send(headCommand);
          expect(headResponse.ContentType).toBe('image/png');
          testScreenshotKeys.push({ bucket, key });
        }
      }
    });
  });

  describe('SCRAPE - Webスクレイピング', () => {
    it('正常にWebページをスクレイピングできる', async () => {
      const request = {
        action: 'SCRAPE' as const,
        url: 'https://example.com',
        options: { timeout: 30000 },
      };

      const response = await handler(request);

      expect(response.status).toBe('SUCCESS');
      expect(response.requestId).toBeDefined();
      expect(response.result?.html).toBeDefined();
      expect(response.result?.data).toBeDefined();
      expect(response.metrics.latency).toBeGreaterThan(0);
    });
  });

  describe('AUTOMATE - ブラウザ自動化', () => {
    it('正常にブラウザ自動化タスクを実行できる', async () => {
      const request = {
        action: 'AUTOMATE' as const,
        url: 'https://example.com',
        automation: {
          steps: [
            { type: 'WAIT' as const, selector: 'body', timeout: 5000 },
            { type: 'SCROLL' as const, value: '500', timeout: 1000 },
          ],
        },
      };

      const response = await handler(request);

      expect(response.status).toBe('SUCCESS');
      expect(response.requestId).toBeDefined();
      expect(response.metrics.latency).toBeGreaterThan(0);
    });
  });

  describe('エラーハンドリング', () => {
    it('無効なURLでエラーを返す', async () => {
      const request = {
        action: 'SCREENSHOT' as const,
        url: 'invalid-url',
      };

      const response = await handler(request);

      expect(response.status).toBe('FAILED');
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBeDefined();
      expect(response.error?.message).toBeDefined();
    });
  });

  describe('メトリクス', () => {
    it('実行時間メトリクスを返す', async () => {
      const request = {
        action: 'SCREENSHOT' as const,
        url: 'https://example.com',
      };

      const response = await handler(request);

      expect(response.status).toBe('SUCCESS');
      expect(response.metrics).toBeDefined();
      expect(response.metrics.latency).toBeGreaterThan(0);
      expect(response.metrics.pageLoadTime).toBeGreaterThan(0);

      if (response.result?.screenshot) {
        const s3Url = response.result.screenshot;
        const match = s3Url.match(/s3:\/\/([^\/]+)\/(.+)/);
        if (match) {
          const [, bucket, key] = match;
          testScreenshotKeys.push({ bucket, key });
        }
      }
    });
  });
});
