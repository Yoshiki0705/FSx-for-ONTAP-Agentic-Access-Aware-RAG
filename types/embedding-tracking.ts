/// <reference types="node" />
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
export const EMBEDDING_TRACKING_TABLE_SCHEMA = {
  tableName: 'EmbeddingProcessingTracking',
  partitionKey: 'fileHash',
  sortKey: 'processedAt',
  globalSecondaryIndexes: [
    {
      indexName: 'FileFormatIndex',
      partitionKey: 'fileFormat',
      sortKey: 'processedAt'
    },
    {
      indexName: 'ProcessingMethodIndex',
      partitionKey: 'finalMethod',
      sortKey: 'processedAt'
    },
    {
      indexName: 'UserIndex',
      partitionKey: 'userId',
      sortKey: 'processedAt'
    }
  ],
  ttlAttribute: 'ttl'
} as const;

/**
 * Embedding追跡レコードを作成
 */
export function createEmbeddingTrackingRecord(
  fileHash: string,
  embeddingInfo: EmbeddingProcessingInfo,
  fileSize: number,
  markdownLength: number,
  hasError: boolean = false,
  errorMessage?: string,
  userId?: string,
  projectId?: string
): EmbeddingTrackingRecord {
  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60); // 90日後に自動削除

  return {
    fileHash,
    processedAt: embeddingInfo.processedAt,
    fileName: embeddingInfo.fileName,
    fileFormat: embeddingInfo.fileFormat,
    fileSize,
    processingStrategy: embeddingInfo.strategy,
    usedMarkitdown: embeddingInfo.usedMarkitdown,
    usedLangChain: embeddingInfo.usedLangChain,
    finalMethod: embeddingInfo.finalMethod,
    processingTime: embeddingInfo.processingTime,
    qualityScore: embeddingInfo.qualityScore,
    markdownLength,
    hasError,
    errorMessage,
    userId,
    projectId,
    ttl,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * ファイルハッシュを生成
 */
export function generateFileHash(fileName: string, fileSize: number, lastModified?: Date): string {
  const content = `${fileName}-${fileSize}-${lastModified?.getTime() || Date.now()}`;
  // 実際の実装では crypto.createHash('sha256') を使用
  return Buffer.from(content).toString('base64').substring(0, 32);
}

/**
 * 統計情報を初期化
 */
export function initializeEmbeddingStats(): EmbeddingTrackingStats {
  const formatStats: Record<SupportedFileFormat, any> = {} as any;
  const formats: SupportedFileFormat[] = ['docx', 'xlsx', 'pptx', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'html', 'xml', 'csv', 'tsv'];
  
  formats.forEach(format => {
    formatStats[format] = {
      count: 0,
      markitdownUsage: 0,
      langchainUsage: 0,
      averageProcessingTime: 0,
      averageQualityScore: undefined
    };
  });

  const strategyStats: Record<ProcessingStrategy, any> = {
    'markitdown-only': { count: 0, successRate: 0, averageProcessingTime: 0 },
    'langchain-only': { count: 0, successRate: 0, averageProcessingTime: 0 },
    'markitdown-first': { count: 0, successRate: 0, averageProcessingTime: 0 },
    'langchain-first': { count: 0, successRate: 0, averageProcessingTime: 0 },
    'both-compare': { count: 0, successRate: 0, averageProcessingTime: 0 },
    'auto-select': { count: 0, successRate: 0, averageProcessingTime: 0 }
  };

  return {
    totalFiles: 0,
    markitdownFiles: 0,
    langchainFiles: 0,
    bothMethodsFiles: 0,
    formatStats,
    strategyStats,
    period: {
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString()
    }
  };
}