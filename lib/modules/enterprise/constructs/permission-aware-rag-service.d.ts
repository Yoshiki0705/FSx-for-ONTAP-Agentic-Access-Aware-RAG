/**
 * 権限認識型RAG検索サービス
 *
 * ユーザー権限に基づくベクトル検索とコンテキスト生成
 */
import * as aws from 'aws-sdk';
import { OpenSearch } from '@opensearch-project/opensearch';
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
export declare class PermissionAwareRAGService {
    private opensearchClient;
    private bedrockClient;
    private permissionEngine;
    constructor(opensearchClient: OpenSearch, bedrockClient: aws.BedrockRuntime, permissionConfig: PermissionFilterConfig);
    /**
     * 権限認識型RAG検索実行
     */
    executeRAGSearch(request: RAGSearchRequest): Promise<RAGSearchResponse>;
    /**
     * クエリEmbedding生成
     */
    private generateQueryEmbedding;
    /**
     * OpenSearch検索クエリ構築
     */
    private buildSearchQuery;
    /**
     * RAG結果構築
     */
    private buildRAGResult;
    /**
     * コンテキスト生成
     */
    private generateContext;
    /**
     * 権限統計取得
     */
    getPermissionStatistics(): any;
}
