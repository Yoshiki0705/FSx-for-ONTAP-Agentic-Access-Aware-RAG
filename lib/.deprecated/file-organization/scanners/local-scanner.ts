/**
 * 統合ファイル整理システム - ローカル環境スキャナー
 * 
 * ローカル環境（macOS/Linux）でのファイルスキャン機能を提供します。
 * 20+個の平置きファイルを検出し、適切な分類のための情報を収集します。
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { BaseFileScanner } from '../core/file-scanner.js';
import { 
  FileInfo, 
  Environment,
  OrganizationError,
  OrganizationErrorType
} from '../types/index.js';

/**
 * ローカル環境ファイルスキャナー
 * 
 * macOS/Linux環境でのファイルシステムアクセスを行い、
 * ローカル固有のファイル情報を収集します。
 */
export class LocalFileScanner extends BaseFileScanner {
  private readonly rootPath: string;

  constructor(
    rootPath: string = process.cwd(),
    excludePatterns: string[] = [
      'node_modules/**',
      '.git/**',
      'cdk.out/**',
      'dist/**',
      'build/**',
      '.DS_Store',
      'Thumbs.db',
      '*.swp',
      '*.swo',
      '*~'
    ]
  ) {
    super('local', excludePatterns);
    this.rootPath = path.resolve(rootPath);
  }

  /**
   * ローカル環境の平置きファイルを特別に検出
   * 
   * 要件1.1, 5.1, 5.2, 5.3, 5.4, 5.5に対応
   */
  public async detectLocalFlatFiles(): Promise<FileInfo[]> {
    try {
      console.log(`ローカル環境の平置きファイルをスキャン中: ${this.rootPath}`);
      
      const entries = await fs.readdir(this.rootPath, { withFileTypes: true });
      const flatFiles: FileInfo[] = [];

      for (const entry of entries) {
        if (entry.isFile() && !entry.name.startsWith('.')) {
          const filePath = path.join(this.rootPath, entry.name);
          
          // 除外パターンのチェック
          if (this.shouldExclude(filePath)) {
            continue;
          }

          const fileInfo = await this.getFileInfo(filePath);
          if (fileInfo) {
            flatFiles.push(fileInfo);
            console.log(`平置きファイル検出: ${entry.name} (${this.formatFileSize(fileInfo.size)})`);
          }
        }
      }

      console.log(`ローカル環境で ${flatFiles.length} 個の平置きファイルを検出しました`);
      return flatFiles;
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.SCAN_FAILED,
        `ローカル環境の平置きファイル検出に失敗しました: ${this.rootPath}`,
        this.rootPath,
        'local',
        error as Error
      );
    }
  }

  /**
   * ローカル環境固有のファイル分析
   */
  public async analyzeLocalFiles(): Promise<{
    configFiles: FileInfo[];
    testFiles: FileInfo[];
    tempFiles: FileInfo[];
    scriptFiles: FileInfo[];
    documentFiles: FileInfo[];
  }> {
    const flatFiles = await this.detectLocalFlatFiles();
    
    const analysis = {
      configFiles: [] as FileInfo[],
      testFiles: [] as FileInfo[],
      tempFiles: [] as FileInfo[],
      scriptFiles: [] as FileInfo[],
      documentFiles: [] as FileInfo[]
    };

    for (const file of flatFiles) {
      if (this.isConfigFile(file)) {
        analysis.configFiles.push(file);
      } else if (this.isTestFile(file)) {
        analysis.testFiles.push(file);
      } else if (this.isTempFile(file)) {
        analysis.tempFiles.push(file);
      } else if (this.isScriptFile(file)) {
        analysis.scriptFiles.push(file);
      } else if (this.isDocumentFile(file)) {
        analysis.documentFiles.push(file);
      }
    }

    return analysis;
  }

  /**
   * 開発環境固有ファイルの検出
   */
  public async detectDevelopmentFiles(): Promise<FileInfo[]> {
    const developmentPatterns = [
      '.env.template',
      '.env.local',
      '.env.development',
      'config.*.ts',
      'test-*.json',
      '*-payload.json',
      'response.json',
      'validate-*.ts',
      'debug-*.log',
      'temp_*',
      '*.tmp'
    ];

    const allFiles = await this.detectLocalFlatFiles();
    return allFiles.filter(file => 
      developmentPatterns.some(pattern => this.matchesPattern(file.name, pattern))
    );
  }

  /**
   * 相対パスを取得（ローカル環境用）
   */
  protected getRelativePath(filePath: string): string {
    return path.relative(this.rootPath, filePath);
  }

  /**
   * ファイル権限を取得（Unix系システム用）
   */
  protected getPermissions(stats: any): string {
    if (os.platform() === 'win32') {
      // Windows環境では簡易的な権限表示
      return stats.mode & parseInt('200', 8) ? '644' : '444';
    }
    
    // Unix系システムでの8進数権限表示
    return (stats.mode & parseInt('777', 8)).toString(8);
  }

  /**
   * 設定ファイルかどうかを判定
   */
  private isConfigFile(file: FileInfo): boolean {
    const configPatterns = [
      /^config\./i,
      /\.config\./i,
      /^package\.json$/i,
      /^tsconfig\.json$/i,
      /^cdk\.json$/i,
      /^jest\.config\./i,
      /^webpack\.config\./i,
      /^\.env/i
    ];

    return configPatterns.some(pattern => pattern.test(file.name));
  }

  /**
   * テストファイルかどうかを判定
   */
  private isTestFile(file: FileInfo): boolean {
    const testPatterns = [
      /^test-.*\.json$/i,
      /.*-test\.json$/i,
      /.*-payload\.json$/i,
      /.*\.test\./i,
      /.*\.spec\./i,
      /^mock/i
    ];

    return testPatterns.some(pattern => pattern.test(file.name));
  }

  /**
   * 一時ファイルかどうかを判定
   */
  private isTempFile(file: FileInfo): boolean {
    const tempPatterns = [
      /^response\.json$/i,
      /^temp_/i,
      /\.tmp$/i,
      /\.temp$/i,
      /^output\./i,
      /^debug/i,
      /\.log$/i
    ];

    return tempPatterns.some(pattern => pattern.test(file.name));
  }

  /**
   * スクリプトファイルかどうかを判定
   */
  private isScriptFile(file: FileInfo): boolean {
    return file.extension === '.sh' || 
           file.extension === '.bat' || 
           file.extension === '.cmd';
  }

  /**
   * ドキュメントファイルかどうかを判定
   */
  private isDocumentFile(file: FileInfo): boolean {
    const docExtensions = ['.md', '.txt', '.doc', '.docx', '.pdf'];
    return docExtensions.includes(file.extension);
  }

  /**
   * パターンマッチング
   */
  private matchesPattern(fileName: string, pattern: string): boolean {
    const regex = new RegExp(
      pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
    );
    return regex.test(fileName);
  }

  /**
   * ファイルサイズをフォーマット
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * ローカル環境の詳細情報を取得
   */
  public async getEnvironmentInfo(): Promise<{
    platform: string;
    architecture: string;
    nodeVersion: string;
    workingDirectory: string;
    homeDirectory: string;
    totalFiles: number;
    flatFiles: number;
  }> {
    const flatFiles = await this.detectLocalFlatFiles();
    const allFiles = await this.scanDirectory(this.rootPath);

    return {
      platform: os.platform(),
      architecture: os.arch(),
      nodeVersion: process.version,
      workingDirectory: this.rootPath,
      homeDirectory: os.homedir(),
      totalFiles: allFiles.length,
      flatFiles: flatFiles.length
    };
  }

  /**
   * ローカル環境のヘルスチェック
   */
  public async performHealthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'error';
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // ディスク容量チェック
      const stats = await fs.stat(this.rootPath);
      
      // 平置きファイル数チェック
      const flatFiles = await this.detectLocalFlatFiles();
      if (flatFiles.length > 20) {
        issues.push(`平置きファイルが多すぎます: ${flatFiles.length}個`);
        recommendations.push('ファイル整理システムの実行を推奨します');
      }

      // 権限チェック
      try {
        await fs.access(this.rootPath, fs.constants.R_OK | fs.constants.W_OK);
      } catch {
        issues.push('ディレクトリへの読み書き権限がありません');
        recommendations.push('ディレクトリ権限を確認してください');
      }

      // 大きなファイルチェック
      const largeFiles = flatFiles.filter(file => file.size > 10 * 1024 * 1024); // 10MB
      if (largeFiles.length > 0) {
        issues.push(`大きなファイルが平置きされています: ${largeFiles.length}個`);
        recommendations.push('大きなファイルは適切なディレクトリに移動してください');
      }

      const status = issues.length === 0 ? 'healthy' : 
                    issues.length <= 2 ? 'warning' : 'error';

      return { status, issues, recommendations };
    } catch (error) {
      return {
        status: 'error',
        issues: [`ヘルスチェック実行エラー: ${error}`],
        recommendations: ['システム管理者に連絡してください']
      };
    }
  }
}