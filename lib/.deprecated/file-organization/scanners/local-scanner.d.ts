/**
 * 統合ファイル整理システム - ローカル環境スキャナー
 *
 * ローカル環境（macOS/Linux）でのファイルスキャン機能を提供します。
 * 20+個の平置きファイルを検出し、適切な分類のための情報を収集します。
 */
import { BaseFileScanner } from '../core/file-scanner.js';
import { FileInfo } from '../types/index.js';
/**
 * ローカル環境ファイルスキャナー
 *
 * macOS/Linux環境でのファイルシステムアクセスを行い、
 * ローカル固有のファイル情報を収集します。
 */
export declare class LocalFileScanner extends BaseFileScanner {
    private readonly rootPath;
    constructor(rootPath?: string, excludePatterns?: string[]);
    /**
     * ローカル環境の平置きファイルを特別に検出
     *
     * 要件1.1, 5.1, 5.2, 5.3, 5.4, 5.5に対応
     */
    detectLocalFlatFiles(): Promise<FileInfo[]>;
    /**
     * ローカル環境固有のファイル分析
     */
    analyzeLocalFiles(): Promise<{
        configFiles: FileInfo[];
        testFiles: FileInfo[];
        tempFiles: FileInfo[];
        scriptFiles: FileInfo[];
        documentFiles: FileInfo[];
    }>;
    /**
     * 開発環境固有ファイルの検出
     */
    detectDevelopmentFiles(): Promise<FileInfo[]>;
    /**
     * 相対パスを取得（ローカル環境用）
     */
    protected getRelativePath(filePath: string): string;
    /**
     * ファイル権限を取得（Unix系システム用）
     */
    protected getPermissions(stats: any): string;
    /**
     * 設定ファイルかどうかを判定
     */
    private isConfigFile;
    /**
     * テストファイルかどうかを判定
     */
    private isTestFile;
    /**
     * 一時ファイルかどうかを判定
     */
    private isTempFile;
    /**
     * スクリプトファイルかどうかを判定
     */
    private isScriptFile;
    /**
     * ドキュメントファイルかどうかを判定
     */
    private isDocumentFile;
    /**
     * パターンマッチング
     */
    private matchesPattern;
    /**
     * ファイルサイズをフォーマット
     */
    private formatFileSize;
    /**
     * ローカル環境の詳細情報を取得
     */
    getEnvironmentInfo(): Promise<{
        platform: string;
        architecture: string;
        nodeVersion: string;
        workingDirectory: string;
        homeDirectory: string;
        totalFiles: number;
        flatFiles: number;
    }>;
    /**
     * ローカル環境のヘルスチェック
     */
    performHealthCheck(): Promise<{
        status: 'healthy' | 'warning' | 'error';
        issues: string[];
        recommendations: string[];
    }>;
}
