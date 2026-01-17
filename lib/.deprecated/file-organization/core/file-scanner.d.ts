/**
 * 統合ファイル整理システム - ベースファイルスキャナー
 *
 * ローカル環境とEC2環境の両方で平置きファイルを検出し、
 * ファイル情報を収集するベースクラスを提供します。
 */
import { FileScanner, FileInfo, FlatFileReport, StructureAnalysis, DirectoryNode, Environment } from '../types/index.js';
/**
 * ベースファイルスキャナークラス
 *
 * 抽象クラスとして、共通のファイルスキャン機能を提供し、
 * 環境固有の実装は継承クラスで行います。
 */
export declare abstract class BaseFileScanner implements FileScanner {
    protected readonly environment: Environment;
    protected readonly excludePatterns: string[];
    protected readonly maxFileSize: number;
    constructor(environment: Environment, excludePatterns?: string[], maxFileSize?: number);
    /**
     * ディレクトリをスキャンしてファイル情報を取得
     */
    scanDirectory(scanPath: string): Promise<FileInfo[]>;
    /**
     * 平置きファイルを検出
     */
    detectFlatFiles(rootPath: string): Promise<FlatFileReport>;
    /**
     * ファイル構造を分析
     */
    analyzeFileStructure(analyzePath: string): Promise<StructureAnalysis>;
    /**
     * 再帰的にディレクトリをスキャン
     */
    protected scanDirectoryRecursive(currentPath: string, files: FileInfo[]): Promise<void>;
    /**
     * ファイル情報を取得
     */
    protected getFileInfo(filePath: string): Promise<FileInfo | null>;
    /**
     * 平置きファイルをフィルタリング
     */
    protected filterFlatFiles(allFiles: FileInfo[], rootPath: string): FileInfo[];
    /**
     * 疑わしいファイルかどうかを判定
     */
    protected isSuspiciousFile(file: FileInfo): boolean;
    /**
     * 問題のあるファイルを特定
     */
    protected identifyProblematicFiles(files: FileInfo[]): FileInfo[];
    /**
     * ディレクトリ構造を構築
     */
    protected buildDirectoryStructure(rootPath: string): Promise<DirectoryNode[]>;
    /**
     * ディレクトリノードを構築
     */
    protected buildDirectoryNode(dirPath: string): Promise<DirectoryNode>;
    /**
     * 除外すべきパスかどうかを判定
     */
    protected shouldExclude(filePath: string): boolean;
    /**
     * テキストファイルかどうかを判定
     */
    protected isTextFile(extension: string): boolean;
    /**
     * 相対パスを取得
     */
    protected abstract getRelativePath(filePath: string): string;
    /**
     * ファイル権限を取得
     */
    protected abstract getPermissions(stats: any): string;
}
/**
 * ファイルスキャナーユーティリティ関数
 */
export declare class FileScannerUtils {
    /**
     * ファイルサイズを人間が読みやすい形式に変換
     */
    static formatFileSize(bytes: number): string;
    /**
     * ファイル拡張子から推定されるファイルタイプを取得
     */
    static getFileTypeFromExtension(extension: string): string;
    /**
     * ファイルパスから推定される用途を取得
     */
    static inferFilePurpose(filePath: string): string;
    /**
     * ファイル情報をCSV形式で出力
     */
    static exportToCSV(files: FileInfo[]): string;
    /**
     * スキャン結果の統計情報を生成
     */
    static generateStatistics(report: FlatFileReport): Record<string, any>;
}
