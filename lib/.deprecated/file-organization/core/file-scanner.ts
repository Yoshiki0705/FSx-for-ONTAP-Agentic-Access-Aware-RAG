/**
 * 統合ファイル整理システム - ベースファイルスキャナー
 * 
 * ローカル環境とEC2環境の両方で平置きファイルを検出し、
 * ファイル情報を収集するベースクラスを提供します。
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  FileScanner, 
  FileInfo, 
  FlatFileReport, 
  StructureAnalysis, 
  DirectoryNode,
  Environment,
  OrganizationError,
  OrganizationErrorType
} from '../types/index.js';

/**
 * ベースファイルスキャナークラス
 * 
 * 抽象クラスとして、共通のファイルスキャン機能を提供し、
 * 環境固有の実装は継承クラスで行います。
 */
export abstract class BaseFileScanner implements FileScanner {
  protected readonly environment: Environment;
  protected readonly excludePatterns: string[];
  protected readonly maxFileSize: number;

  constructor(
    environment: Environment,
    excludePatterns: string[] = [],
    maxFileSize: number = 104857600 // 100MB
  ) {
    this.environment = environment;
    this.excludePatterns = excludePatterns;
    this.maxFileSize = maxFileSize;
  }

  /**
   * ディレクトリをスキャンしてファイル情報を取得
   */
  public async scanDirectory(scanPath: string): Promise<FileInfo[]> {
    try {
      const files: FileInfo[] = [];
      await this.scanDirectoryRecursive(scanPath, files);
      return files;
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.SCAN_FAILED,
        `ディレクトリスキャンに失敗しました: ${scanPath}`,
        scanPath,
        this.environment,
        error as Error
      );
    }
  }

  /**
   * 平置きファイルを検出
   */
  public async detectFlatFiles(rootPath: string): Promise<FlatFileReport> {
    try {
      const allFiles = await this.scanDirectory(rootPath);
      const flatFiles = this.filterFlatFiles(allFiles, rootPath);
      
      const filesByType = new Map<string, FileInfo[]>();
      const suspiciousFiles: FileInfo[] = [];
      const largeFiles: FileInfo[] = [];

      for (const file of flatFiles) {
        // 拡張子別分類
        const ext = file.extension || 'no-extension';
        if (!filesByType.has(ext)) {
          filesByType.set(ext, []);
        }
        filesByType.get(ext)!.push(file);

        // 疑わしいファイルの検出
        if (this.isSuspiciousFile(file)) {
          suspiciousFiles.push(file);
        }

        // 大きなファイルの検出
        if (file.size > this.maxFileSize / 10) { // 10MB以上
          largeFiles.push(file);
        }
      }

      return {
        environment: this.environment,
        totalFiles: flatFiles.length,
        filesByType,
        suspiciousFiles,
        largeFiles,
        scanTime: new Date(),
        scanPath: rootPath
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.SCAN_FAILED,
        `平置きファイル検出に失敗しました: ${rootPath}`,
        rootPath,
        this.environment,
        error as Error
      );
    }
  }

  /**
   * ファイル構造を分析
   */
  public async analyzeFileStructure(analyzePath: string): Promise<StructureAnalysis> {
    try {
      const allFiles = await this.scanDirectory(analyzePath);
      const flatFiles = this.filterFlatFiles(allFiles, analyzePath);
      const directoryStructure = await this.buildDirectoryStructure(analyzePath);
      const problematicFiles = this.identifyProblematicFiles(allFiles);

      return {
        environment: this.environment,
        flatFileCount: flatFiles.length,
        directoryStructure,
        analysisTime: new Date(),
        problematicFiles
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.SCAN_FAILED,
        `ファイル構造分析に失敗しました: ${analyzePath}`,
        analyzePath,
        this.environment,
        error as Error
      );
    }
  }

  /**
   * 再帰的にディレクトリをスキャン
   */
  protected async scanDirectoryRecursive(
    currentPath: string, 
    files: FileInfo[]
  ): Promise<void> {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        // 除外パターンのチェック
        if (this.shouldExclude(fullPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          // ディレクトリの場合は再帰的にスキャン
          await this.scanDirectoryRecursive(fullPath, files);
        } else if (entry.isFile()) {
          // ファイルの場合は情報を収集
          const fileInfo = await this.getFileInfo(fullPath);
          if (fileInfo) {
            files.push(fileInfo);
          }
        }
      }
    } catch (error) {
      // ディレクトリアクセスエラーは警告として記録し、処理を継続
      console.warn(`ディレクトリアクセスエラー: ${currentPath}`, error);
    }
  }

  /**
   * ファイル情報を取得
   */
  protected async getFileInfo(filePath: string): Promise<FileInfo | null> {
    try {
      const stats = await fs.stat(filePath);
      const relativePath = this.getRelativePath(filePath);
      const fileName = path.basename(filePath);
      const extension = path.extname(filePath);

      // ファイルサイズチェック
      if (stats.size > this.maxFileSize) {
        console.warn(`ファイルサイズが大きすぎます: ${filePath} (${stats.size} bytes)`);
      }

      // 小さなテキストファイルの内容を読み込み
      let content: string | undefined;
      if (stats.size < 1024 && this.isTextFile(extension)) {
        try {
          content = await fs.readFile(filePath, 'utf-8');
        } catch {
          // 内容読み込みエラーは無視
        }
      }

      return {
        path: filePath,
        name: fileName,
        extension: extension.toLowerCase(),
        size: stats.size,
        permissions: this.getPermissions(stats),
        lastModified: stats.mtime,
        content,
        environment: this.environment,
        relativePath,
        isDirectory: stats.isDirectory(),
        isHidden: fileName.startsWith('.')
      };
    } catch (error) {
      console.warn(`ファイル情報取得エラー: ${filePath}`, error);
      return null;
    }
  }

  /**
   * 平置きファイルをフィルタリング
   */
  protected filterFlatFiles(allFiles: FileInfo[], rootPath: string): FileInfo[] {
    return allFiles.filter(file => {
      const relativePath = path.relative(rootPath, file.path);
      const pathParts = relativePath.split(path.sep);
      
      // ルートディレクトリ直下のファイルのみを平置きファイルとして判定
      return pathParts.length === 1 && !file.isDirectory;
    });
  }

  /**
   * 疑わしいファイルかどうかを判定
   */
  protected isSuspiciousFile(file: FileInfo): boolean {
    const suspiciousPatterns = [
      /^temp_/i,
      /\.tmp$/i,
      /\.temp$/i,
      /^response\.json$/i,
      /^output\./i,
      /^debug\./i,
      /^test-.*\.json$/i,
      /^.*-backup$/i,
      /^.*\.old$/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(file.name));
  }

  /**
   * 問題のあるファイルを特定
   */
  protected identifyProblematicFiles(files: FileInfo[]): FileInfo[] {
    return files.filter(file => {
      // 大きすぎるファイル
      if (file.size > this.maxFileSize) {
        return true;
      }

      // 不適切な権限
      if (file.permissions === '777' || file.permissions === '666') {
        return true;
      }

      // 疑わしいファイル
      if (this.isSuspiciousFile(file)) {
        return true;
      }

      return false;
    });
  }

  /**
   * ディレクトリ構造を構築
   */
  protected async buildDirectoryStructure(rootPath: string): Promise<DirectoryNode[]> {
    const structure: DirectoryNode[] = [];
    
    try {
      const entries = await fs.readdir(rootPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirPath = path.join(rootPath, entry.name);
          
          if (this.shouldExclude(dirPath)) {
            continue;
          }

          const node = await this.buildDirectoryNode(dirPath);
          structure.push(node);
        }
      }
    } catch (error) {
      console.warn(`ディレクトリ構造構築エラー: ${rootPath}`, error);
    }

    return structure;
  }

  /**
   * ディレクトリノードを構築
   */
  protected async buildDirectoryNode(dirPath: string): Promise<DirectoryNode> {
    const name = path.basename(dirPath);
    const children: DirectoryNode[] = [];
    let fileCount = 0;
    let directoryCount = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        
        if (this.shouldExclude(entryPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          directoryCount++;
          const childNode = await this.buildDirectoryNode(entryPath);
          children.push(childNode);
        } else if (entry.isFile()) {
          fileCount++;
        }
      }
    } catch (error) {
      console.warn(`ディレクトリノード構築エラー: ${dirPath}`, error);
    }

    return {
      name,
      path: dirPath,
      children,
      fileCount,
      directoryCount
    };
  }

  /**
   * 除外すべきパスかどうかを判定
   */
  protected shouldExclude(filePath: string): boolean {
    return this.excludePatterns.some(pattern => {
      // 簡単なグロブパターンマッチング
      const regex = new RegExp(
        pattern
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*')
          .replace(/\?/g, '[^/]')
      );
      return regex.test(filePath);
    });
  }

  /**
   * テキストファイルかどうかを判定
   */
  protected isTextFile(extension: string): boolean {
    const textExtensions = [
      '.txt', '.md', '.json', '.js', '.ts', '.html', '.css', '.scss',
      '.yml', '.yaml', '.xml', '.csv', '.log', '.env', '.sh', '.bat'
    ];
    return textExtensions.includes(extension.toLowerCase());
  }

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
export class FileScannerUtils {
  /**
   * ファイルサイズを人間が読みやすい形式に変換
   */
  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * ファイル拡張子から推定されるファイルタイプを取得
   */
  static getFileTypeFromExtension(extension: string): string {
    const typeMap: Record<string, string> = {
      '.js': 'JavaScript',
      '.ts': 'TypeScript',
      '.json': 'JSON',
      '.md': 'Markdown',
      '.txt': 'Text',
      '.sh': 'Shell Script',
      '.py': 'Python',
      '.html': 'HTML',
      '.css': 'CSS',
      '.yml': 'YAML',
      '.yaml': 'YAML',
      '.xml': 'XML',
      '.csv': 'CSV',
      '.log': 'Log File',
      '.env': 'Environment',
      '.pem': 'Certificate',
      '.key': 'Private Key'
    };

    return typeMap[extension.toLowerCase()] || 'Unknown';
  }

  /**
   * ファイルパスから推定される用途を取得
   */
  static inferFilePurpose(filePath: string): string {
    const fileName = path.basename(filePath).toLowerCase();
    
    if (fileName.includes('test')) return 'Test';
    if (fileName.includes('config')) return 'Configuration';
    if (fileName.includes('deploy')) return 'Deployment';
    if (fileName.includes('setup')) return 'Setup';
    if (fileName.includes('install')) return 'Installation';
    if (fileName.includes('backup')) return 'Backup';
    if (fileName.includes('temp')) return 'Temporary';
    if (fileName.includes('log')) return 'Log';
    if (fileName.includes('debug')) return 'Debug';
    if (fileName.includes('sample')) return 'Sample';
    if (fileName.includes('example')) return 'Example';
    
    return 'Unknown';
  }

  /**
   * ファイル情報をCSV形式で出力
   */
  static exportToCSV(files: FileInfo[]): string {
    const headers = [
      'Path', 'Name', 'Extension', 'Size', 'Permissions', 
      'LastModified', 'Environment', 'IsDirectory', 'IsHidden'
    ];
    
    const rows = files.map(file => [
      file.path,
      file.name,
      file.extension,
      file.size.toString(),
      file.permissions,
      file.lastModified.toISOString(),
      file.environment,
      file.isDirectory.toString(),
      file.isHidden.toString()
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }

  /**
   * スキャン結果の統計情報を生成
   */
  static generateStatistics(report: FlatFileReport): Record<string, any> {
    const stats = {
      totalFiles: report.totalFiles,
      environment: report.environment,
      scanTime: report.scanTime,
      filesByExtension: {} as Record<string, number>,
      suspiciousFileCount: report.suspiciousFiles.length,
      largeFileCount: report.largeFiles.length,
      totalSize: 0,
      averageFileSize: 0
    };

    // 拡張子別統計
    for (const [ext, files] of report.filesByType) {
      stats.filesByExtension[ext] = files.length;
      stats.totalSize += files.reduce((sum, file) => sum + file.size, 0);
    }

    // 平均ファイルサイズ
    if (report.totalFiles > 0) {
      stats.averageFileSize = stats.totalSize / report.totalFiles;
    }

    return stats;
  }
}