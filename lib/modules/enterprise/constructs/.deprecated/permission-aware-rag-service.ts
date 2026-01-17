/**
 * 権限認識型RAG検索サービス
 * 
 * ユーザー権限に基づくベクトル検索とコンテキスト生成
 */

import * as aws from 'aws-sdk';
import { OpenSearch } from '@opensearch-project/opensearch';
import { PermissionFilterEngine } from './permission-filter-engine';
import { UserPermission, PermissionFilterConfig, AccessControlResult } from '../interfaces/permission-config';

export interface RAGSearchRequest {
  /** 検索クエリ */
  readonly query: string;
  
  /** ユーザー権限情報 */
  readonly userPermission: UserPermission;
  
  /** 検索オプション */
  readonly options?: {
    readonly maxResults?: number;
    readonly minScore?: number;
    readonly includeMetadata?: boolean;
    readonly searchType?: 'text' | 'multimodal' | 'hybrid';
  };
}

export interface RAGSearchResponse {
  /** 検索結果 */
  readonly results: RAGSearchResult[];
  
  /** 総ヒット数（フィルタリング前） */
  readonly totalHits: number;
  
  /** フィルタリング後ヒット数 */
  readonly filteredHits: number;
  
  /** 実行時間（ミリ秒） */
  readonly executionTimeMs: number;
  
  /** 監査ログ */
  readonly auditLog: AccessControlResult[];
  
  /** 生成されたコンテキスト */
  readonly generatedContext?: string;
}

export interface RAGSearchResult {
  /** ドキュメントID */
  readonly documentId: string;
  
  /** 類似度スコア */
  readonly score: number;
  
  /** テキストコンテンツ */
  readonly textContent: string;
  
  /** ファイルパス */
  readonly filePath: string;
  
  /** メタデータ */
  readonly metadata: {
    readonly contentType: string;
    readonly modelVersion: string;
    readonly createdAt: string;
    readonly owner?: string;
  };
  
  /** 権限情報 */
  readonly permissionInfo: {
    readonly accessReason: string;
    readonly appliedRules: string[];
  };
}

export class PermissionAwareRAGService {
  private opensearchClient: OpenSearch;
  private bedrockClient: aws.BedrockRuntime;
  private permissionEngine: PermissionFilterEngine;

  constructor(
    opensearchClient: OpenSearch,
    bedrockClient: aws.BedrockRuntime,
    permissionConfig: PermissionFilterConfig
  ) {
    this.opensearchClient = opensearchClient;
    this.bedrockClient = bedrockClient;
    this.permissionEngine = new PermissionFilterEngine(permissionConfig);
  }

  /**
   * 権限認識型RAG検索実行
   */
  public async executeRAGSearch(request: RAGSearchRequest): Promise<RAGSearchResponse> {
    const startTime = Date.now();
    
    try {
      // 1. クエリのEmbedding生成
      const queryEmbedding = await this.generateQueryEmbedding(
        request.query, 
        request.options?.searchType || 'text'
      );

      // 2. 権限フィルター生成
      const permissionFilter = this.permissionEngine.generateSearchFilter(request.userPermission);

      // 3. OpenSearch検索実行
      const searchQuery = this.buildSearchQuery(
        queryEmbedding,
        permissionFilter,
        request.options
      );

      const searchResponse = await this.opensearchClient.search({
        index: 'titan-multimodal-embeddings',
        body: searchQuery
      });

      // 4. 結果の後処理フィルタリング
      const { filteredResults, auditLog } = this.permissionEngine.filterSearchResults(
        searchResponse.body.hits.hits,
        request.userPermission
      );

      // 5. RAG結果構築
      const ragResults = filteredResults.map(hit => this.buildRAGResult(hit, request.userPermission));

      // 6. コンテキスト生成（オプション）
      let generatedContext: string | undefined;
      if (request.options?.includeMetadata && ragResults.length > 0) {
        generatedContext = await this.generateContext(ragResults, request.query);
      }

      const executionTimeMs = Date.now() - startTime;

      return {
        results: ragResults,
        totalHits: searchResponse.body.hits.total.value,
        filteredHits: ragResults.length,
        executionTimeMs,
        auditLog,
        generatedContext
      };

    } catch (error) {
      throw new Error(`RAG検索エラー: ${error}`);
    }
  }

  /**
   * クエリEmbedding生成
   */
  private async generateQueryEmbedding(query: string, searchType: string): Promise<number[]> {
    const modelId = searchType === 'multimodal' 
      ? 'amazon.titan-embed-image-v1'
      : 'amazon.titan-embed-text-v2:0';

    const body = searchType === 'multimodal'
      ? JSON.stringify({
          inputText: query,
          embeddingConfig: { outputEmbeddingLength: 1024 }
        })
      : JSON.stringify({
          inputText: query,
          dimensions: 1024,
          normalize: true
        });

    const response = await this.bedrockClient.invokeModel({
      modelId,
      body
    }).promise();

    const result = JSON.parse(response.body.toString());
    return result.embedding;
  }

  /**
   * OpenSearch検索クエリ構築
   */
  private buildSearchQuery(
    queryEmbedding: number[],
    permissionFilter: any,
    options?: RAGSearchRequest['options']
  ): any {
    const maxResults = options?.maxResults || 10;
    const minScore = options?.minScore || 0.1;

    return {
      size: maxResults,
      min_score: minScore,
      query: {
        bool: {
          must: [
            {
              knn: {
                text_embedding_vector: {
                  vector: queryEmbedding,
                  k: maxResults * 2 // 権限フィルタリングを考慮して多めに取得
                }
              }
            }
          ],
          filter: permissionFilter.bool ? [permissionFilter] : []
        }
      },
      _source: {
        excludes: ['text_embedding_vector', 'multimodal_embedding_vector'] // ベクトルデータは除外
      }
    };
  }

  /**
   * RAG結果構築
   */
  private buildRAGResult(hit: any, userPermission: UserPermission): RAGSearchResult {
    const source = hit._source;
    const accessResult = this.permissionEngine.checkDocumentAccess(source, userPermission);

    return {
      documentId: source.document_id,
      score: hit._score,
      textContent: source.text_content,
      filePath: source.file_path,
      metadata: {
        contentType: source.content_type,
        modelVersion: source.model_version,
        createdAt: source.created_at,
        owner: source.owner
      },
      permissionInfo: {
        accessReason: accessResult.reason,
        appliedRules: accessResult.appliedRules
      }
    };
  }

  /**
   * コンテキスト生成
   */
  private async generateContext(results: RAGSearchResult[], query: string): Promise<string> {
    const contextParts = results.slice(0, 5).map((result, index) => 
      `[文書${index + 1}] ${result.textContent.substring(0, 200)}...`
    );

    return `検索クエリ: "${query}"\n\n関連文書:\n${contextParts.join('\n\n')}`;
  }

  /**
   * 権限統計取得
   */
  public getPermissionStatistics(): any {
    return this.permissionEngine.getStatistics();
  }
}