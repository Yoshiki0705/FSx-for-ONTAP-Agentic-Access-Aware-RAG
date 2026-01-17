/**
 * 統合ファイル整理システム - ディレクトリ構造作成
 *
 * Agent Steering file-placement-guidelinesに準拠した
 * 統一ディレクトリ構造を作成する機能を提供します。
 */
import { ClassificationConfig, Environment } from '../types/index.js';
import { SSHConfig } from '../scanners/ec2-scanner.js';
/**
 * ディレクトリ作成結果
 */
export interface DirectoryCreationResult {
    /** 作成されたディレクトリ数 */
    createdDirectories: number;
    /** 作成されたディレクトリパス */
    createdPaths: string[];
    /** エラー */
    errors: string[];
    /** 成功したかどうか */
    success: boolean;
    /** 実行環境 */
    environment: Environment;
    /** 処理時間 */
    processingTime: number;
}
/**
 * ディレクトリ構造作成
 *
 * Agent Steering準拠のディレクトリ構造を両環境で作成し、
 * 適切な権限設定を行います。
 */
export declare class DirectoryCreator {
    private readonly config;
    private readonly sshConfig?;
    constructor(config: ClassificationConfig, sshConfig?: SSHConfig);
    /**
     * ローカル環境でディレクトリ構造を作成
     */
    createLocalDirectoryStructure(basePath?: string): Promise<DirectoryCreationResult>;
    /**
     * EC2環境でディレクトリ構造を作成
     */
    createEC2DirectoryStructure(basePath: string): Promise<DirectoryCreationResult>;
    /**
     * 統合ディレクトリ構造作成
     */
    createIntegratedDirectoryStructure(localBasePath: string, ec2BasePath: string): Promise<{
        local: DirectoryCreationResult;
        ec2: DirectoryCreationResult;
        success: boolean;
    }>;
    /**
     * 必須ディレクトリ一覧を取得
     */
    private getRequiredDirectories;
    /**
     * ローカル環境でのディレクトリ権限設定
     */
    private setLocalDirectoryPermissions;
    /**
     * EC2環境でのディレクトリ権限設定
     */
    private setEC2DirectoryPermissions;
    /**
     * ディレクトリ用READMEファイルを作成
     */
    private createDirectoryReadmeFiles;
    /**
     * README内容を取得
     */
    private getReadmeContents;
    /**
     * SSH コマンドを実行
     */
    private executeSSHCommand;
    /**
     * エラー結果を作成
     */
    private createErrorResult;
    /**
     * ディレクトリ構造の検証
     */
    validateDirectoryStructure(basePath: string, environment: Environment): Promise<{
        valid: boolean;
        missingDirectories: string[];
        extraDirectories: string[];
        permissionIssues: string[];
    }>;
    /**
     * 環境に応じたディレクトリ構造を作成
     */
    createEnvironmentStructure(basePath: string, environment?: Environment): Promise<DirectoryCreationResult>;
}
