/**
 * 統合ファイル整理システム - EC2環境スキャナー
 *
 * EC2環境（Ubuntu）でのSSH接続によるリモートファイルスキャン機能を提供します。
 * 270個の平置きファイルとホームディレクトリの整理対象ファイルを検出します。
 */
import { BaseFileScanner } from '../core/file-scanner.js';
import { FileInfo } from '../types/index.js';
/**
 * SSH接続設定
 */
export interface SSHConfig {
    host: string;
    user: string;
    keyPath: string;
    port?: number;
    timeout?: number;
}
/**
 * EC2環境ファイルスキャナー
 *
 * SSH接続を使用してEC2環境のファイルシステムにアクセスし、
 * リモートファイルの情報を収集します。
 */
export declare class EC2FileScanner extends BaseFileScanner {
    private readonly sshConfig;
    private readonly projectPath;
    private readonly homeDirectory;
    constructor(sshConfig: SSHConfig, projectPath?: string, homeDirectory?: string, excludePatterns?: string[]);
    /**
     * EC2環境の平置きファイルを検出
     *
     * 要件1.2, 6.1, 6.2, 6.3, 6.4, 6.5に対応
     */
    detectEC2FlatFiles(): Promise<FileInfo[]>;
    /**
     * EC2ホームディレクトリの平置きファイルを検出
     */
    detectHomeFlatFiles(): Promise<FileInfo[]>;
    /**
     * 古いプロジェクトディレクトリを検出
     */
    detectOldProjectDirectories(): Promise<FileInfo[]>;
    /**
     * リモートディレクトリをスキャン
     */
    private scanRemoteDirectory;
    /**
     * リモートファイル情報を取得
     */
    private getRemoteFileInfo;
    /**
     * SSH コマンドを実行
     */
    private executeSSHCommand;
    /**
     * Unix権限文字列を8進数に変換
     */
    private parseUnixPermissions;
    /**
     * 相対パスを取得（EC2環境用）
     */
    protected getRelativePath(filePath: string): string;
    /**
     * ファイル権限を取得（EC2環境用）
     */
    protected getPermissions(stats: any): string;
    /**
     * SSH接続テスト
     */
    testConnection(): Promise<boolean>;
    /**
     * EC2環境の詳細情報を取得
     */
    getEnvironmentInfo(): Promise<{
        hostname: string;
        platform: string;
        architecture: string;
        uptime: string;
        diskUsage: string;
        memoryUsage: string;
        projectPath: string;
        homeDirectory: string;
        totalFiles: number;
        flatFiles: number;
    }>;
    /**
     * EC2環境のヘルスチェック
     */
    performHealthCheck(): Promise<{
        status: 'healthy' | 'warning' | 'error';
        issues: string[];
        recommendations: string[];
    }>;
    /**
     * リモートディレクトリの存在確認
     */
    verifyDirectoryExists(remotePath: string): Promise<boolean>;
    /**
     * リモートディレクトリの作成
     */
    createRemoteDirectory(remotePath: string, permissions?: string): Promise<boolean>;
    /**
     * リモートディレクトリの書き込み権限確認
     */
    verifyWritePermission(remotePath: string): Promise<boolean>;
    /**
     * EC2環境でのファイル分析
     */
    analyzeEC2Files(): Promise<{
        scriptFiles: FileInfo[];
        documentFiles: FileInfo[];
        configFiles: FileInfo[];
        oldProjects: FileInfo[];
        largeFiles: FileInfo[];
    }>;
}
