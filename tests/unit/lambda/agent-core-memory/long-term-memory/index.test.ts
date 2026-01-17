/**
 * Amazon Bedrock AgentCore Memory - Long-Term Memory Lambda関数単体テスト
 * 
 * @description Long-Term Memory Lambda関数の単体テストを実施
 * @author Kiro AI
 * @created 2026-01-03
 */

import { handler, LongTermMemoryEvent } from '../../../../../lambda/agent-core-memory/long-term-memory/index';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { mockClient } from 'aws-sdk-client-mock';

// AWS SDK Mockの作成
const s3Mock = mockClient(S3Client);
const bedrockMock = mockClient(BedrockRuntimeClient);

// OpenSearchクライアントのモック
jest.mock('@opensearch-project/opensearch', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      index: jest.fn().mockResolvedValue({ body: { result: 'created' } }),
      search: jest.fn().mockResolvedValue({
        body: {
          hits: {
            hits: [
              {
                _id: 'doc-123',
                _score: 1.5,
                _source: {
                  title: 'Test Document',
                  content: 'Test content',
                  metadata: { key: 'value' },
                },
              },
            ],
          },
        },
      }),
      get: jest.fn().mockResolvedValue({
        body: {
          found: true,
          _source: {
            title: 'Test Document',
            content: 'Test content',
            s3Key: 'documents/doc-123.json',
            createdAt: '2026-01-03T00:00:00.000Z',
            updatedAt: '2026-01-03T00:00:00.000Z',
          },
        },
      }),
      delete: jest.fn().mockResolvedValue({ body: { result: 'deleted' } }),
    })),
  };
});

jest.mock('@opensearch-project/opensearch/aws', () => ({
  AwsSigv4Signer: jest.fn().mockReturnValue({}),
}));

describe('Long-Term Memory Lambda Handler', () => {
  beforeEach(() => {
    s3Mock.reset();
    bedrockMock.reset();
    
    // 環境変数を設定
    process.env.PROJECT_NAME = 'test-project';
    process.env.ENVIRONMENT = 'test';
    process.env.S3_BUCKET_NAME = 'test-bucket';
    process.env.S3_ACCESS_POINT_ARN = 'arn:aws:s3:ap-northeast-1:123456789012:accesspoint/test-ap';
    process.env.FSX_FILE_SYSTEM_ID = 'fs-12345678';
    process.env.OPENSEARCH_ENDPOINT = 'https://test-opensearch.ap-northeast-1.aoss.amazonaws.com';
    process.env.OPENSEARCH_INDEX_NAME = 'test-long-term-memory';
    process.env.EMBEDDING_MODEL = 'amazon.titan-embed-text-v1';
    process.env.VECTOR_DIMENSION = '1536';
    process.env.AWS_REGION = 'ap-northeast-1';
  });

  afterEach(() => {
    delete process.env.PROJECT_NAME;
    delete process.env.ENVIRONMENT;
    delete process.env.S3_BUCKET_NAME;
    delete process.env.S3_ACCESS_POINT_ARN;
    delete process.env.FSX_FILE_SYSTEM_ID;
    delete process.env.OPENSEARCH_ENDPOINT;
    delete process.env.OPENSEARCH_INDEX_NAME;
    delete process.env.EMBEDDING_MODEL;
    delete process.env.VECTOR_DIMENSION;
    delete process.env.AWS_REGION;
  });

  describe('環境変数の読み込み', () => {
    it('必須環境変数が欠落している場合はエラーを返す', async () => {
      delete process.env.OPENSEARCH_ENDPOINT;
      
      const event: LongTermMemoryEvent = {
        operation: 'store',
        document: {
          title: 'Test Document',
          content: 'Test content',
        },
      };

      const result = await handler(event);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required environment variables');
    });
  });

  describe('store操作', () => {
    it('ドキュメントが正しく保存される', async () => {
      const event: LongTermMemoryEvent = {
        operation: 'store',
        documentId: 'doc-123',
        document: {
          title: 'Test Document',
          content: 'Test content for embedding',
          metadata: { key: 'value' },
        },
      };

      // Bedrock Embeddingsのモック
      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(JSON.stringify({
          embedding: new Array(1536).fill(0.1),
        })),
      });

      // S3のモック
      s3Mock.on(PutObjectCommand).resolves({});

      const result = await handler(event);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('store');
      expect(result.data).toBeDefined();
      expect(result.data.documentId).toBe('doc-123');
      expect(result.data.usedAccessPoint).toBe(true);
      expect(s3Mock.calls()).toHaveLength(1);
      expect(bedrockMock.calls()).toHaveLength(1);
    });

    it('S3 Access Pointが使用される', async () => {
      const event: LongTermMemoryEvent = {
        operation: 'store',
        document: {
          title: 'Test Document',
          content: 'Test content',
        },
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(JSON.stringify({
          embedding: new Array(1536).fill(0.1),
        })),
      });

      s3Mock.on(PutObjectCommand).resolves({});

      const result = await handler(event);

      expect(result.success).toBe(true);
      expect(result.data.bucketName).toContain('accesspoint');
      
      const s3Call = s3Mock.call(0);
      expect(s3Call.args[0].input.Bucket).toContain('accesspoint');
    });

    it('documentパラメータが欠落している場合はエラーを返す', async () => {
      const event: LongTermMemoryEvent = {
        operation: 'store',
      };

      const result = await handler(event);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter: document');
    });
  });

  describe('search操作', () => {
    it('ドキュメントが正しく検索される', async () => {
      const event: LongTermMemoryEvent = {
        operation: 'search',
        searchQuery: {
          query: 'test query',
          maxResults: 5,
          similarityThreshold: 0.7,
        },
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(JSON.stringify({
          embedding: new Array(1536).fill(0.1),
        })),
      });

      const result = await handler(event);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('search');
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.count).toBeGreaterThanOrEqual(0);
      expect(bedrockMock.calls()).toHaveLength(1);
    });

    it('searchQueryパラメータが欠落している場合はエラーを返す', async () => {
      const event: LongTermMemoryEvent = {
        operation: 'search',
      };

      const result = await handler(event);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter: searchQuery');
    });
  });

  describe('get操作', () => {
    it('ドキュメントが正しく取得される', async () => {
      const event: LongTermMemoryEvent = {
        operation: 'get',
        documentId: 'doc-123',
      };

      const result = await handler(event);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('get');
      expect(result.data).toBeDefined();
      expect(result.data.documentId).toBe('doc-123');
      expect(result.data.title).toBe('Test Document');
    });

    it('documentIdパラメータが欠落している場合はエラーを返す', async () => {
      const event: LongTermMemoryEvent = {
        operation: 'get',
      };

      const result = await handler(event);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter: documentId');
    });
  });

  describe('delete操作', () => {
    it('ドキュメントが正しく削除される', async () => {
      const event: LongTermMemoryEvent = {
        operation: 'delete',
        documentId: 'doc-123',
      };

      const result = await handler(event);

      expect(result.success).toBe(true);
      expect(result.operation).toBe('delete');
    });
  });

  describe('Bedrock Embeddings統合', () => {
    it('ベクトル化が正しく実行される', async () => {
      const event: LongTermMemoryEvent = {
        operation: 'store',
        document: {
          title: 'Test',
          content: 'Test content for embedding generation',
        },
      };

      bedrockMock.on(InvokeModelCommand).resolves({
        body: new TextEncoder().encode(JSON.stringify({
          embedding: new Array(1536).fill(0.5),
        })),
      });

      s3Mock.on(PutObjectCommand).resolves({});

      const result = await handler(event);

      expect(result.success).toBe(true);
      expect(bedrockMock.calls()).toHaveLength(1);
      
      const bedrockCall = bedrockMock.call(0);
      expect(bedrockCall.args[0].input.modelId).toBe('amazon.titan-embed-text-v1');
    });
  });

  describe('パラメータ検証', () => {
    it('operationパラメータが欠落している場合はエラーを返す', async () => {
      const event = {} as any;

      const result = await handler(event);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter: operation');
    });

    it('サポートされていない操作の場合はエラーを返す', async () => {
      const event = {
        operation: 'invalid',
      } as any;

      const result = await handler(event);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported operation');
    });
  });
});
