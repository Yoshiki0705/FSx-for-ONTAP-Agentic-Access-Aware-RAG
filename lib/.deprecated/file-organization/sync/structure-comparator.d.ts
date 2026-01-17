/**
 * 統合ファイル整理システム - 構造比較機能
 *
 * ローカル・EC2環境間のディレクトリ構造比較機能を提供し、
 * 差分検出と整合性分析を実行します。
 */
import { Environment } from '../types/index.js';
import { SSHConfig } from '../scanners/ec2-scanner.js';
/**
 * ディレクトリ構造情報
 */
export interface DirectoryStructure {
    /** 環境 */
    environment: Environment;
    /** ルートパス */
    rootPath: string;
    /** ディレクトリ一覧 */
    directories: DirectoryInfo[];
    /** ファイル一覧 */
    files: FileStructureInfo[];
    /** スキャン時刻 */
    scanTime: Date;
    /** 総ディレクトリ数 */
    totalDirectories: number;
    /** 総ファイル数 */
    totalFiles: number;
}
/**
 * ディレクトリ情報
 */
export interface DirectoryInfo {
    /** パス */
    path: string;
    /** 権限 */
    permissions: string;
    /** 作成日時 */
    createdAt?: Date;
    /** 更新日時 */
    modifiedAt: Date;
    /** 子ディレクトリ数 */
    childDirectories: number;
    /** 子ファイル数 */
    childFiles: number;
}
/**
 * ファイル構造情報
 */
export interface FileStructureInfo {
    /** パス */
    path: string;
    /** ファイルサイズ */
    size: number;
    /** 権限 */
    permissions: string;
    /** 更新日時 */
    modifiedAt: Date;
    /** ファイルタイプ */
    type: string;
    /** チェックサム（オプション） */
    checksum?: string;
}
/**
 * 構造比較結果
 */
export interface StructureComparison {
    /** 比較ID */
    comparisonId: string;
    /** 比較時刻 */
    comparisonTime: Date;
    /** ローカル構造 */
    localStructure: DirectoryStructure;
    /** EC2構造 */
    ec2Structure: DirectoryStructure;
    /** 差分情報 */
    differences: StructureDifference[];
    /** 一致率 */
    matchPercentage: number;
    /** 比較サマリー */
    summary: ComparisonSummary;
}
/**
 * 構造差分
 */
export interface StructureDifference {
    /** 差分タイプ */
    type: 'missing_directory' | 'extra_directory' | 'missing_file' | 'extra_file' | 'permission_mismatch' | 'size_mismatch' | 'content_mismatch';
    /** 対象パス */
    path: string;
    /** 環境 */
    environment: Environment;
    /** 詳細 */
    details: {
        expected?: any;
        actual?: any;
        description: string;
    };
    /** 重要度 */
    severity: 'low' | 'medium' | 'high' | 'critical';
    /** 推奨アクション */
    recommendedAction: string;
}
/**
 * 比較サマリー
 */
export interface ComparisonSummary {
    /** 総項目数 */
    totalItems: number;
    /** 一致項目数 */
    matchingItems: number;
    /** 差分項目数 */
    differenceItems: number;
    /** 重要度別統計 */
    severityStats: Record<string, number>;
    /** タイプ別統計 */
    typeStats: Record<string, number>;
    /** 処理時間 */
    processingTime: number;
}
/**
 * 構造比較器
 *
 * ローカル・EC2環境間のディレクトリ構造を比較し、
 * 詳細な差分分析を提供します。
 */
export declare class StructureComparator {
    private readonly sshConfig?;
    constructor(sshConfig?: SSHConfig);
    /**
     * 環境間構造比較を実行
     */
    compareStructures(localRootPath?: string, ec2RootPath?: string): Promise<StructureComparison>;
    /**
     * ローカル構造をスキャン
     */
    scanLocalStructure(rootPath: string): Promise<DirectoryStructure>;
    /**
     * EC2構造をスキャン
     */
    scanEC2Structure(rootPath: string): Promise<DirectoryStructure>;
    /**
     * ローカルディレクトリを再帰的にスキャン
     */
    private scanLocalDirectory;
    /**
     * EC2ディレクトリを再帰的にスキャン
     */
    private scanEC2Directory;
    /**
     * 構造差分を分析
     */
    private analyzeDifferences;
    /**
     * ディレクトリ差分を分析
     */
    private analyzeDirectoryDifferences;
    /**
     * ファイル差分を分析
     */
    private analyzeFileDifferences;
    /**
     * 一致率を計算
     */
    private calculateMatchPercentage;
    /**
     * 比較サマリーを生成
     */
    private generateComparisonSummary;
    /**
     * スキップすべきディレクトリかどうか判定
     */
    private shouldSkipDirectory;
    /**
     * 構造比較レポートを生成
     */
    generateComparisonReport(comparison: StructureComparison): string;
    /**
     * SSH コマンドを実行
     */
    private executeSSHCommand;
}
