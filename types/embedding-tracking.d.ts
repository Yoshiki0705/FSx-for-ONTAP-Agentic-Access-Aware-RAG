/**
 * Embedding処理追跡用の型定義
 * ファイル単位でのMarkitdown/LangChain使用状況を追跡
 */
import { SupportedFileFormat, ProcessingStrategy, EmbeddingProcessingInfo } from './markitdown-config';
/**
 * DynamoDBに保存するEmbedding追跡レコード
 */
export interface EmbeddingTrackingRecord {
    /** パーティションキー: ファイルのハッシュ値 */
    fileHash: string;
    /** ソートキー: 処理日時（ISO文字列） */
    processedAt: string;
    /** ファイル名 */
    fileName: string;
    /** ファイル形式 */
    fileFormat: SupportedFileFormat;
    /** ファイルサイズ（バイト） */
    fileSize: number;
    /** 使用された処理戦略 */
    processingStrategy: ProcessingStrategy;
    /** Markitdownが使用されたか */
    usedMarkitdown: boolean;
    /** LangChainが使用されたか */
    usedLangChain: boolean;
    /** 最終的に選択された処理方法 */
    finalMethod: 'markitdown' | 'langchain';
    /** 処理時間（ミリ秒） */
    processingTime: number;
    /** 品質スコア（0-100） */
    qualityScore?: number;
    /** 変換後のマークダウン文字数 */
    markdownLength: number;
    /** エラーが発生したか */
    hasError: boolean;
    /** エラーメッセージ（存在する場合） */
    errorMessage?: string;
    /** ユーザーID */
    userId?: string;
    /** プロジェクトID */
    projectId?: string;
    /** TTL（自動削除用、Unix timestamp） */
    ttl: number;
    /** 作成日時 */
    createdAt: string;
    /** 更新日時 */
    updatedAt: string;
}
/**
 * Embedding追跡統計情報
 */
export interface EmbeddingTrackingStats {
    /** 総処理ファイル数 */
    totalFiles: number;
    /** Markitdownを使用したファイル数 */
    markitdownFiles: number;
    /** LangChainを使用したファイル数 */
    langchainFiles: number;
    /** 両方を使用したファイル数 */
    bothMethodsFiles: number;
    /** ファイル形式別統計 */
    formatStats: Record<SupportedFileFormat, {
        count: number;
        markitdownUsage: number;
        langchainUsage: number;
        averageProcessingTime: number;
        averageQualityScore?: number;
    }>;
    /** 処理戦略別統計 */
    strategyStats: Record<ProcessingStrategy, {
        count: number;
        successRate: number;
        averageProcessingTime: number;
    }>;
    /** 期間 */
    period: {
        startDate: string;
        endDate: string;
    };
}
/**
 * Embedding追跡クエリパラメータ
 */
export interface EmbeddingTrackingQuery {
    /** ファイル形式でフィルタ */
    fileFormat?: SupportedFileFormat;
    /** 処理方法でフィルタ */
    processingMethod?: 'markitdown' | 'langchain';
    /** 処理戦略でフィルタ */
    processingStrategy?: ProcessingStrategy;
    /** 開始日時 */
    startDate?: string;
    /** 終了日時 */
    endDate?: string;
    /** ユーザーIDでフィルタ */
    userId?: string;
    /** プロジェクトIDでフィルタ */
    projectId?: string;
    /** エラーありのみ */
    errorsOnly?: boolean;
    /** 制限数 */
    limit?: number;
    /** オフセット */
    offset?: number;
}
/**
 * Embedding追跡レポート
 */
export interface EmbeddingTrackingReport {
    /** レポート生成日時 */
    generatedAt: string;
    /** 統計情報 */
    stats: EmbeddingTrackingStats;
    /** 推奨事項 */
    recommendations: {
        /** 処理方法の推奨変更 */
        methodRecommendations: Array<{
            fileFormat: SupportedFileFormat;
            currentStrategy: ProcessingStrategy;
            recommendedStrategy: ProcessingStrategy;
            reason: string;
            expectedImprovement: string;
        }>;
        /** パフォーマンス改善提案 */
        performanceImprovements: Array<{
            area: string;
            suggestion: string;
            impact: 'high' | 'medium' | 'low';
        }>;
    };
}
/**
 * DynamoDBテーブル設計
 */
export declare const EMBEDDING_TRACKING_TABLE_SCHEMA: {
    readonly tableName: "EmbeddingProcessingTracking";
    readonly partitionKey: "fileHash";
    readonly sortKey: "processedAt";
    readonly globalSecondaryIndexes: readonly [{
        readonly indexName: "FileFormatIndex";
        readonly partitionKey: "fileFormat";
        readonly sortKey: "processedAt";
    }, {
        readonly indexName: "ProcessingMethodIndex";
        readonly partitionKey: "finalMethod";
        readonly sortKey: "processedAt";
    }, {
        readonly indexName: "UserIndex";
        readonly partitionKey: "userId";
        readonly sortKey: "processedAt";
    }];
    readonly ttlAttribute: "ttl";
};
/**
 * Embedding追跡レコードを作成
 */
export declare function createEmbeddingTrackingRecord(fileHash: string, embeddingInfo: EmbeddingProcessingInfo, fileSize: number, markdownLength: number, hasError?: boolean, errorMessage?: string, userId?: string, projectId?: string): EmbeddingTrackingRecord;
/**
 * ファイルハッシュを生成
 */
export declare function generateFileHash(fileName: string, fileSize: number, lastModified?: Date): string;
/**
 * 統計情報を初期化
 */
export declare function initializeEmbeddingStats(): EmbeddingTrackingStats;
