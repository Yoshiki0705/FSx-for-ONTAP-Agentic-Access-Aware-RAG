/**
 * 統合ファイル整理システム - 構造比較機能
 * 
 * ローカル・EC2環境間のディレクトリ構造比較機能を提供し、
 * 差分検出と整合性分析を実行します。
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { 
  Environment,
  FileInfo,
  OrganizationError,
  OrganizationErrorType
} from '../types/index.js';
import { SSHConfig } from '../scanners/ec2-scanner.js';

const execAsync = promisify(exec);

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
  type: 'missing_directory' | 'extra_directory' | 'missing_file' | 'extra_file' | 
        'permission_mismatch' | 'size_mismatch' | 'content_mismatch';
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
export class StructureComparator {
  private readonly sshConfig?: SSHConfig;

  constructor(sshConfig?: SSHConfig) {
    this.sshConfig = sshConfig;
  }

  /**
   * 環境間構造比較を実行
   */
  public async compareStructures(
    localRootPath: string = '.',
    ec2RootPath: string = '/home/ubuntu'
  ): Promise<StructureComparison> {
    const comparisonId = `comparison-${Date.now()}`;
    const startTime = Date.now();
    
    console.log('🔍 環境間構造比較を開始...');

    try {
      // 並列で両環境の構造をスキャン
      const [localStructure, ec2Structure] = await Promise.all([
        this.scanLocalStructure(localRootPath),
        this.scanEC2Structure(ec2RootPath)
      ]);

      // 構造差分を分析
      const differences = await this.analyzeDifferences(localStructure, ec2Structure);

      // 一致率を計算
      const matchPercentage = this.calculateMatchPercentage(localStructure, ec2Structure, differences);

      // サマリーを生成
      const summary = this.generateComparisonSummary(localStructure, ec2Structure, differences, startTime);

      console.log(`✅ 構造比較完了: 一致率${matchPercentage.toFixed(1)}%, 差分${differences.length}個 (${summary.processingTime}ms)`);

      return {
        comparisonId,
        comparisonTime: new Date(),
        localStructure,
        ec2Structure,
        differences,
        matchPercentage,
        summary
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.VALIDATION_FAILED,
        `構造比較に失敗しました: ${error}`,
        undefined,
        undefined,
        error as Error
      );
    }
  }

  /**
   * ローカル構造をスキャン
   */
  public async scanLocalStructure(rootPath: string): Promise<DirectoryStructure> {
    console.log(`📁 ローカル構造をスキャン中: ${rootPath}`);

    try {
      const directories: DirectoryInfo[] = [];
      const files: FileStructureInfo[] = [];

      await this.scanLocalDirectory(rootPath, rootPath, directories, files);

      return {
        environment: 'local',
        rootPath,
        directories,
        files,
        scanTime: new Date(),
        totalDirectories: directories.length,
        totalFiles: files.length
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.SCAN_FAILED,
        `ローカル構造スキャンに失敗しました: ${error}`,
        undefined,
        'local',
        error as Error
      );
    }
  }

  /**
   * EC2構造をスキャン
   */
  public async scanEC2Structure(rootPath: string): Promise<DirectoryStructure> {
    console.log(`🌐 EC2構造をスキャン中: ${rootPath}`);

    if (!this.sshConfig) {
      throw new Error('SSH設定が必要です');
    }

    try {
      const directories: DirectoryInfo[] = [];
      const files: FileStructureInfo[] = [];

      await this.scanEC2Directory(rootPath, rootPath, directories, files);

      return {
        environment: 'ec2',
        rootPath,
        directories,
        files,
        scanTime: new Date(),
        totalDirectories: directories.length,
        totalFiles: files.length
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.SCAN_FAILED,
        `EC2構造スキャンに失敗しました: ${error}`,
        undefined,
        'ec2',
        error as Error
      );
    }
  }

  /**
   * ローカルディレクトリを再帰的にスキャン
   */
  private async scanLocalDirectory(
    currentPath: string,
    rootPath: string,
    directories: DirectoryInfo[],
    files: FileStructureInfo[]
  ): Promise<void> {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      // 現在のディレクトリ情報を取得
      const stats = await fs.stat(currentPath);
      const permissions = (stats.mode & parseInt('777', 8)).toString(8);
      
      const childDirectories = entries.filter(entry => entry.isDirectory()).length;
      const childFiles = entries.filter(entry => entry.isFile()).length;

      // ディレクトリ情報を追加
      if (currentPath !== rootPath) {
        directories.push({
          path: path.relative(rootPath, currentPath),
          permissions,
          modifiedAt: stats.mtime,
          childDirectories,
          childFiles
        });
      }

      // 子要素を処理
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        if (entry.isDirectory()) {
          // 特定のディレクトリをスキップ
          if (this.shouldSkipDirectory(entry.name)) {
            continue;
          }
          
          await this.scanLocalDirectory(fullPath, rootPath, directories, files);
        } else if (entry.isFile()) {
          const fileStats = await fs.stat(fullPath);
          const filePermissions = (fileStats.mode & parseInt('777', 8)).toString(8);
          
          files.push({
            path: path.relative(rootPath, fullPath),
            size: fileStats.size,
            permissions: filePermissions,
            modifiedAt: fileStats.mtime,
            type: path.extname(entry.name) || 'unknown'
          });
        }
      }
    } catch (error) {
      console.warn(`⚠️ ローカルディレクトリスキャンエラー: ${currentPath} - ${error}`);
    }
  }

  /**
   * EC2ディレクトリを再帰的にスキャン
   */
  private async scanEC2Directory(
    currentPath: string,
    rootPath: string,
    directories: DirectoryInfo[],
    files: FileStructureInfo[]
  ): Promise<void> {
    try {
      // ディレクトリ一覧を取得
      const lsResult = await this.executeSSHCommand(`ls -la "${currentPath}" 2>/dev/null || true`);
      const lines = lsResult.stdout.split('\n').filter(line => line.trim());
      
      let childDirectories = 0;
      let childFiles = 0;

      for (const line of lines) {
        if (line.startsWith('total') || line.trim() === '') continue;
        
        const parts = line.split(/\s+/);
        if (parts.length < 9) continue;
        
        const permissions = parts[0].substring(1); // 最初の文字（d/-）を除く
        const size = parseInt(parts[4]) || 0;
        const name = parts.slice(8).join(' ');
        
        if (name === '.' || name === '..') continue;
        
        const fullPath = path.join(currentPath, name);
        const relativePath = path.relative(rootPath, fullPath);
        
        if (line.startsWith('d')) {
          // ディレクトリ
          childDirectories++;
          
          if (this.shouldSkipDirectory(name)) {
            continue;
          }
          
          directories.push({
            path: relativePath,
            permissions,
            modifiedAt: new Date(), // 簡略化
            childDirectories: 0, // 後で更新
            childFiles: 0 // 後で更新
          });
          
          // 再帰的にスキャン
          await this.scanEC2Directory(fullPath, rootPath, directories, files);
        } else {
          // ファイル
          childFiles++;
          
          files.push({
            path: relativePath,
            size,
            permissions,
            modifiedAt: new Date(), // 簡略化
            type: path.extname(name) || 'unknown'
          });
        }
      }

      // 現在のディレクトリ情報を更新
      if (currentPath !== rootPath) {
        const dirInfo = directories.find(d => d.path === path.relative(rootPath, currentPath));
        if (dirInfo) {
          dirInfo.childDirectories = childDirectories;
          dirInfo.childFiles = childFiles;
        }
      }
    } catch (error) {
      console.warn(`⚠️ EC2ディレクトリスキャンエラー: ${currentPath} - ${error}`);
    }
  }

  /**
   * 構造差分を分析
   */
  private async analyzeDifferences(
    localStructure: DirectoryStructure,
    ec2Structure: DirectoryStructure
  ): Promise<StructureDifference[]> {
    console.log('🔍 構造差分を分析中...');

    const differences: StructureDifference[] = [];

    // ディレクトリ差分の分析
    await this.analyzeDirectoryDifferences(localStructure, ec2Structure, differences);

    // ファイル差分の分析
    await this.analyzeFileDifferences(localStructure, ec2Structure, differences);

    console.log(`📊 差分分析完了: ${differences.length}個の差分を検出`);

    return differences;
  }

  /**
   * ディレクトリ差分を分析
   */
  private async analyzeDirectoryDifferences(
    localStructure: DirectoryStructure,
    ec2Structure: DirectoryStructure,
    differences: StructureDifference[]
  ): Promise<void> {
    const localDirs = new Set(localStructure.directories.map(d => d.path));
    const ec2Dirs = new Set(ec2Structure.directories.map(d => d.path));

    // ローカルにのみ存在するディレクトリ
    for (const localDir of localStructure.directories) {
      if (!ec2Dirs.has(localDir.path)) {
        differences.push({
          type: 'missing_directory',
          path: localDir.path,
          environment: 'ec2',
          details: {
            description: `EC2環境にディレクトリが存在しません: ${localDir.path}`
          },
          severity: 'medium',
          recommendedAction: 'EC2環境にディレクトリを作成してください'
        });
      }
    }

    // EC2にのみ存在するディレクトリ
    for (const ec2Dir of ec2Structure.directories) {
      if (!localDirs.has(ec2Dir.path)) {
        differences.push({
          type: 'extra_directory',
          path: ec2Dir.path,
          environment: 'ec2',
          details: {
            description: `ローカル環境にディレクトリが存在しません: ${ec2Dir.path}`
          },
          severity: 'low',
          recommendedAction: 'ローカル環境にディレクトリを作成するか、EC2から削除してください'
        });
      }
    }

    // 権限差分の確認
    for (const localDir of localStructure.directories) {
      const ec2Dir = ec2Structure.directories.find(d => d.path === localDir.path);
      if (ec2Dir && localDir.permissions !== ec2Dir.permissions) {
        differences.push({
          type: 'permission_mismatch',
          path: localDir.path,
          environment: 'ec2',
          details: {
            expected: localDir.permissions,
            actual: ec2Dir.permissions,
            description: `ディレクトリ権限が異なります: ${localDir.path}`
          },
          severity: 'medium',
          recommendedAction: `EC2環境の権限を${localDir.permissions}に変更してください`
        });
      }
    }
  }

  /**
   * ファイル差分を分析
   */
  private async analyzeFileDifferences(
    localStructure: DirectoryStructure,
    ec2Structure: DirectoryStructure,
    differences: StructureDifference[]
  ): Promise<void> {
    const localFiles = new Set(localStructure.files.map(f => f.path));
    const ec2Files = new Set(ec2Structure.files.map(f => f.path));

    // ローカルにのみ存在するファイル
    for (const localFile of localStructure.files) {
      if (!ec2Files.has(localFile.path)) {
        differences.push({
          type: 'missing_file',
          path: localFile.path,
          environment: 'ec2',
          details: {
            description: `EC2環境にファイルが存在しません: ${localFile.path}`
          },
          severity: 'high',
          recommendedAction: 'EC2環境にファイルを同期してください'
        });
      }
    }

    // EC2にのみ存在するファイル
    for (const ec2File of ec2Structure.files) {
      if (!localFiles.has(ec2File.path)) {
        differences.push({
          type: 'extra_file',
          path: ec2File.path,
          environment: 'ec2',
          details: {
            description: `ローカル環境にファイルが存在しません: ${ec2File.path}`
          },
          severity: 'medium',
          recommendedAction: 'ローカル環境にファイルを同期するか、EC2から削除してください'
        });
      }
    }

    // ファイル属性差分の確認
    for (const localFile of localStructure.files) {
      const ec2File = ec2Structure.files.find(f => f.path === localFile.path);
      if (!ec2File) continue;

      // サイズ差分
      if (localFile.size !== ec2File.size) {
        differences.push({
          type: 'size_mismatch',
          path: localFile.path,
          environment: 'ec2',
          details: {
            expected: localFile.size,
            actual: ec2File.size,
            description: `ファイルサイズが異なります: ${localFile.path}`
          },
          severity: 'high',
          recommendedAction: 'ファイル内容を確認し、同期してください'
        });
      }

      // 権限差分
      if (localFile.permissions !== ec2File.permissions) {
        differences.push({
          type: 'permission_mismatch',
          path: localFile.path,
          environment: 'ec2',
          details: {
            expected: localFile.permissions,
            actual: ec2File.permissions,
            description: `ファイル権限が異なります: ${localFile.path}`
          },
          severity: 'medium',
          recommendedAction: `EC2環境の権限を${localFile.permissions}に変更してください`
        });
      }
    }
  }

  /**
   * 一致率を計算
   */
  private calculateMatchPercentage(
    localStructure: DirectoryStructure,
    ec2Structure: DirectoryStructure,
    differences: StructureDifference[]
  ): number {
    const totalItems = localStructure.totalDirectories + localStructure.totalFiles + 
                      ec2Structure.totalDirectories + ec2Structure.totalFiles;
    
    if (totalItems === 0) return 100;
    
    const differenceCount = differences.length;
    const matchingItems = totalItems - differenceCount;
    
    return Math.max(0, (matchingItems / totalItems) * 100);
  }

  /**
   * 比較サマリーを生成
   */
  private generateComparisonSummary(
    localStructure: DirectoryStructure,
    ec2Structure: DirectoryStructure,
    differences: StructureDifference[],
    startTime: number
  ): ComparisonSummary {
    const totalItems = localStructure.totalDirectories + localStructure.totalFiles + 
                      ec2Structure.totalDirectories + ec2Structure.totalFiles;
    
    const matchingItems = totalItems - differences.length;
    const processingTime = Date.now() - startTime;

    // 重要度別統計
    const severityStats: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    differences.forEach(diff => {
      severityStats[diff.severity]++;
    });

    // タイプ別統計
    const typeStats: Record<string, number> = {};
    differences.forEach(diff => {
      typeStats[diff.type] = (typeStats[diff.type] || 0) + 1;
    });

    return {
      totalItems,
      matchingItems,
      differenceItems: differences.length,
      severityStats,
      typeStats,
      processingTime
    };
  }

  /**
   * スキップすべきディレクトリかどうか判定
   */
  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = [
      'node_modules',
      '.git',
      '.vscode',
      '.idea',
      'cdk.out',
      'dist',
      'build',
      '.next',
      'coverage',
      '.nyc_output'
    ];
    
    return skipDirs.includes(dirName) || dirName.startsWith('.');
  }

  /**
   * 構造比較レポートを生成
   */
  public generateComparisonReport(comparison: StructureComparison): string {
    const { summary, differences, matchPercentage } = comparison;
    
    // 重要度別統計
    const severityStats = Object.entries(summary.severityStats)
      .map(([level, count]) => `- **${level.toUpperCase()}**: ${count}件`)
      .join('\n');

    // タイプ別統計
    const typeStats = Object.entries(summary.typeStats)
      .map(([type, count]) => `- **${type}**: ${count}件`)
      .join('\n');

    // 重要な差分のリスト
    const criticalDifferences = differences
      .filter(d => d.severity === 'critical' || d.severity === 'high')
      .slice(0, 10)
      .map(d => `- **${d.path}**: ${d.details.description}`)
      .join('\n');

    return `
# 環境間構造比較レポート

## 比較サマリー
- **比較日時**: ${comparison.comparisonTime.toLocaleString('ja-JP')}
- **比較ID**: ${comparison.comparisonId}
- **一致率**: ${matchPercentage.toFixed(1)}%
- **総項目数**: ${summary.totalItems}個
- **一致項目**: ${summary.matchingItems}個
- **差分項目**: ${summary.differenceItems}個
- **処理時間**: ${Math.round(summary.processingTime / 1000)}秒

## 環境別統計
### ローカル環境
- **ディレクトリ数**: ${comparison.localStructure.totalDirectories}個
- **ファイル数**: ${comparison.localStructure.totalFiles}個
- **ルートパス**: ${comparison.localStructure.rootPath}

### EC2環境
- **ディレクトリ数**: ${comparison.ec2Structure.totalDirectories}個
- **ファイル数**: ${comparison.ec2Structure.totalFiles}個
- **ルートパス**: ${comparison.ec2Structure.rootPath}

## 差分統計
### 重要度別
${severityStats || '- 差分なし'}

### タイプ別
${typeStats || '- 差分なし'}

## 重要な差分（上位10件）
${criticalDifferences || '- 重要な差分なし'}

## 推奨アクション
${summary.differenceItems === 0 ? 
  '- 両環境の構造は完全に一致しています。継続的な監視を推奨します。' :
  `- ${summary.differenceItems}個の差分が検出されました。同期処理の実行を検討してください。`
}

${summary.severityStats.critical > 0 ? 
  `\n⚠️ **緊急**: ${summary.severityStats.critical}個の重要な構造問題があります。即座に対応してください。` : ''
}

## パフォーマンス統計
- **スキャン効率**: ${Math.round(summary.totalItems / (summary.processingTime / 1000))}項目/秒
- **平均処理時間**: ${Math.round(summary.processingTime / summary.totalItems)}ms/項目
`;
  }

  /**
   * SSH コマンドを実行
   */
  private async executeSSHCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    if (!this.sshConfig) {
      throw new Error('SSH設定が必要です');
    }

    const sshCommand = `ssh -i "${this.sshConfig.keyPath}" -o ConnectTimeout=${this.sshConfig.timeout! / 1000} -o StrictHostKeyChecking=no -p ${this.sshConfig.port} ${this.sshConfig.user}@${this.sshConfig.host} "${command}"`;
    
    try {
      const result = await execAsync(sshCommand, { 
        timeout: this.sshConfig.timeout,
        maxBuffer: 1024 * 1024 * 10 // 10MB
      });
      return result;
    } catch (error: any) {
      if (error.code === 'ETIMEDOUT') {
        throw new OrganizationError(
          OrganizationErrorType.SSH_CONNECTION_FAILED,
          `SSH接続がタイムアウトしました: ${this.sshConfig.host}`,
          undefined,
          'ec2',
          error
        );
      }
      throw error;
    }
  }
}