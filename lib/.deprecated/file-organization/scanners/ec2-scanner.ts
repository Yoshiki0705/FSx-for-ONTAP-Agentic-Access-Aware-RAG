/**
 * 統合ファイル整理システム - EC2環境スキャナー
 * 
 * EC2環境（Ubuntu）でのSSH接続によるリモートファイルスキャン機能を提供します。
 * 270個の平置きファイルとホームディレクトリの整理対象ファイルを検出します。
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { BaseFileScanner } from '../core/file-scanner.js';
import { 
  FileInfo, 
  Environment,
  OrganizationError,
  OrganizationErrorType
} from '../types/index.js';

const execAsync = promisify(exec);

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
export class EC2FileScanner extends BaseFileScanner {
  private readonly sshConfig: SSHConfig;
  private readonly projectPath: string;
  private readonly homeDirectory: string;

  constructor(
    sshConfig: SSHConfig,
    projectPath: string = '/home/ubuntu/rag/Permission-aware-RAG-FSxN-CDK-master',
    homeDirectory: string = '/home/ubuntu',
    excludePatterns: string[] = [
      'node_modules/**',
      '.git/**',
      'cdk.out/**',
      'dist/**',
      'build/**',
      '.npm/**',
      '.cache/**'
    ]
  ) {
    super('ec2', excludePatterns);
    this.sshConfig = {
      port: 22,
      timeout: 30000,
      ...sshConfig
    };
    this.projectPath = projectPath;
    this.homeDirectory = homeDirectory;
  }

  /**
   * EC2環境の平置きファイルを検出
   * 
   * 要件1.2, 6.1, 6.2, 6.3, 6.4, 6.5に対応
   */
  public async detectEC2FlatFiles(): Promise<FileInfo[]> {
    try {
      console.log(`EC2環境の平置きファイルをスキャン中: ${this.projectPath}`);
      
      // 調査スクリプトと同じコマンドを使用
      const command = `find "${this.projectPath}" -maxdepth 1 -type f ! -name '.*' -exec ls -la {} \\; 2>/dev/null || true`;
      const { stdout } = await this.executeSSHCommand(command);
      
      const files: FileInfo[] = [];
      const lines = stdout.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const match = line.match(/^([d\-rwx]+)\s+\d+\s+\w+\s+\w+\s+(\d+)\s+\w+\s+\d+\s+[\d:]+\s+(.+)$/);
        if (match) {
          const [, permissions, sizeStr, fullPath] = match;
          const fileName = path.basename(fullPath);
          const size = parseInt(sizeStr, 10);
          
          // ディレクトリは除外
          if (!permissions.startsWith('d')) {
            files.push({
              name: fileName,
              path: fullPath,
              size,
              extension: path.extname(fileName),
              isDirectory: false,
              permissions,
              lastModified: new Date(),
              environment: 'ec2',
              relativePath: path.relative(this.projectPath, fullPath)
            });
          }
        }
      }
      
      console.log(`EC2プロジェクトディレクトリで ${files.length} 個の平置きファイルを検出しました`);
      
      return files;
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.SSH_CONNECTION_FAILED,
        `EC2環境の平置きファイル検出に失敗しました: ${error}`,
        this.projectPath,
        'ec2',
        error as Error
      );
    }
  }

  /**
   * EC2ホームディレクトリの平置きファイルを検出
   */
  public async detectHomeFlatFiles(): Promise<FileInfo[]> {
    try {
      console.log(`EC2ホームディレクトリの平置きファイルをスキャン中: ${this.homeDirectory}`);
      
      // 調査スクリプトと同じコマンドを使用
      const command = `find "${this.homeDirectory}" -maxdepth 1 -type f ! -name '.*' -exec ls -la {} \\; 2>/dev/null || true`;
      const { stdout } = await this.executeSSHCommand(command);
      
      const files: FileInfo[] = [];
      const lines = stdout.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const match = line.match(/^([d\-rwx]+)\s+\d+\s+\w+\s+\w+\s+(\d+)\s+\w+\s+\d+\s+[\d:]+\s+(.+)$/);
        if (match) {
          const [, permissions, sizeStr, fullPath] = match;
          const fileName = path.basename(fullPath);
          const size = parseInt(sizeStr, 10);
          
          // ディレクトリは除外
          if (!permissions.startsWith('d')) {
            files.push({
              name: fileName,
              path: fullPath,
              size,
              extension: path.extname(fileName),
              isDirectory: false,
              permissions,
              lastModified: new Date(),
              environment: 'ec2',
              relativePath: path.relative(this.homeDirectory, fullPath)
            });
          }
        }
      }
      
      console.log(`EC2ホームディレクトリで ${files.length} 個の平置きファイルを検出しました`);
      
      return files;
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.SSH_CONNECTION_FAILED,
        `EC2ホームディレクトリの平置きファイル検出に失敗しました: ${error}`,
        this.homeDirectory,
        'ec2',
        error as Error
      );
    }
  }

  /**
   * 古いプロジェクトディレクトリを検出
   */
  public async detectOldProjectDirectories(): Promise<FileInfo[]> {
    try {
      const command = `find ${this.homeDirectory} -maxdepth 2 -type d -name "*-old" -o -name "*-backup" -o -name "*-archive" -o -name "*Permission-aware-RAG*" | grep -v "${this.projectPath}"`;
      
      const { stdout } = await this.executeSSHCommand(command);
      const directories = stdout.trim().split('\n').filter(line => line.length > 0);
      
      const oldProjects: FileInfo[] = [];
      
      for (const dirPath of directories) {
        const fileInfo = await this.getRemoteFileInfo(dirPath);
        if (fileInfo && fileInfo.isDirectory) {
          oldProjects.push(fileInfo);
        }
      }
      
      console.log(`EC2環境で ${oldProjects.length} 個の古いプロジェクトディレクトリを検出しました`);
      
      return oldProjects;
    } catch (error) {
      console.warn('古いプロジェクトディレクトリの検出でエラーが発生しました:', error);
      return [];
    }
  }

  /**
   * リモートディレクトリをスキャン
   */
  private async scanRemoteDirectory(remotePath: string, flatFilesOnly: boolean = false): Promise<FileInfo[]> {
    try {
      let command: string;
      if (flatFilesOnly) {
        // 平置きファイルのみを検出（隠しファイルを除く）
        command = `find "${remotePath}" -maxdepth 1 -type f ! -name '.*' -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/cdk.out/*" 2>/dev/null | head -1000`;
      } else {
        // 全ファイルを検出
        command = `find "${remotePath}" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/cdk.out/*" 2>/dev/null | head -1000`;
      }
      
      const { stdout } = await this.executeSSHCommand(command);
      const filePaths = stdout.trim().split('\n').filter(line => line.length > 0);
      
      const files: FileInfo[] = [];
      
      for (const filePath of filePaths) {
        // 平置きファイルのみの場合、ディレクトリ直下のファイルのみを対象
        if (flatFilesOnly) {
          // リモートパスの相対パス計算（POSIX形式）
          const normalizedRemotePath = remotePath.endsWith('/') ? remotePath.slice(0, -1) : remotePath;
          const relativePath = filePath.replace(normalizedRemotePath + '/', '');
          if (relativePath.includes('/')) {
            continue; // サブディレクトリのファイルはスキップ
          }
        }
        
        const fileInfo = await this.getRemoteFileInfo(filePath);
        if (fileInfo && (!flatFilesOnly || !fileInfo.isDirectory)) {
          files.push(fileInfo);
        }
      }
      
      return files;
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.SSH_CONNECTION_FAILED,
        `リモートディレクトリスキャンに失敗しました: ${remotePath}`,
        remotePath,
        'ec2',
        error as Error
      );
    }
  }

  /**
   * リモートファイル情報を取得
   */
  private async getRemoteFileInfo(filePath: string): Promise<FileInfo | null> {
    try {
      // stat コマンドでファイル情報を取得
      const statCommand = `stat -c "%n|%s|%Y|%A|%F" "${filePath}" 2>/dev/null || echo "ERROR"`;
      const { stdout } = await this.executeSSHCommand(statCommand);
      
      if (stdout.trim() === 'ERROR' || !stdout.trim()) {
        return null;
      }
      
      const [name, sizeStr, mtimeStr, permissions, fileType] = stdout.trim().split('|');
      
      const fileName = path.basename(filePath);
      const extension = path.extname(filePath);
      const size = parseInt(sizeStr, 10);
      const lastModified = new Date(parseInt(mtimeStr, 10) * 1000);
      const isDirectory = fileType.includes('directory');
      const isHidden = fileName.startsWith('.');
      
      // 小さなテキストファイルの内容を取得
      let content: string | undefined;
      if (!isDirectory && size < 1024 && this.isTextFile(extension)) {
        try {
          const catCommand = `cat "${filePath}" 2>/dev/null | head -20`;
          const { stdout: fileContent } = await this.executeSSHCommand(catCommand);
          content = fileContent;
        } catch {
          // 内容読み込みエラーは無視
        }
      }
      
      return {
        path: filePath,
        name: fileName,
        extension: extension.toLowerCase(),
        size,
        permissions: this.parseUnixPermissions(permissions),
        lastModified,
        content,
        environment: 'ec2',
        relativePath: this.getRelativePath(filePath),
        isDirectory,
        isHidden
      };
    } catch (error) {
      console.warn(`リモートファイル情報取得エラー: ${filePath}`, error);
      return null;
    }
  }

  /**
   * SSH コマンドを実行
   */
  private async executeSSHCommand(command: string): Promise<{ stdout: string; stderr: string }> {
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

  /**
   * Unix権限文字列を8進数に変換
   */
  private parseUnixPermissions(permStr: string): string {
    if (permStr.length !== 10) {
      return '644'; // デフォルト値
    }
    
    const owner = permStr.slice(1, 4);
    const group = permStr.slice(4, 7);
    const other = permStr.slice(7, 10);
    
    const convertPerm = (perm: string): number => {
      let value = 0;
      if (perm[0] === 'r') value += 4;
      if (perm[1] === 'w') value += 2;
      if (perm[2] === 'x') value += 1;
      return value;
    };
    
    return `${convertPerm(owner)}${convertPerm(group)}${convertPerm(other)}`;
  }

  /**
   * 相対パスを取得（EC2環境用）
   */
  protected getRelativePath(filePath: string): string {
    if (filePath.startsWith(this.projectPath)) {
      return path.relative(this.projectPath, filePath);
    } else if (filePath.startsWith(this.homeDirectory)) {
      return path.relative(this.homeDirectory, filePath);
    }
    return filePath;
  }

  /**
   * ファイル権限を取得（EC2環境用）
   */
  protected getPermissions(stats: any): string {
    // EC2環境では getRemoteFileInfo で既に処理済み
    return '644';
  }

  /**
   * SSH接続テスト
   */
  public async testConnection(): Promise<boolean> {
    try {
      const { stdout } = await this.executeSSHCommand('echo "connection_test"');
      return stdout.trim() === 'connection_test';
    } catch (error) {
      console.error('SSH接続テストに失敗しました:', error);
      return false;
    }
  }

  /**
   * EC2環境の詳細情報を取得
   */
  public async getEnvironmentInfo(): Promise<{
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
  }> {
    try {
      const commands = {
        hostname: 'hostname',
        platform: 'uname -s',
        architecture: 'uname -m',
        uptime: 'uptime',
        diskUsage: `df -h ${this.projectPath} | tail -1 | awk '{print $5}'`,
        memoryUsage: "free | grep Mem | awk '{printf \"%.1f%%\", $3/$2 * 100.0}'"
      };

      const results: any = {};
      
      for (const [key, command] of Object.entries(commands)) {
        try {
          const { stdout } = await this.executeSSHCommand(command);
          results[key] = stdout.trim();
        } catch {
          results[key] = 'Unknown';
        }
      }

      const flatFiles = await this.detectEC2FlatFiles();
      const allFiles = await this.scanRemoteDirectory(this.projectPath);

      return {
        ...results,
        projectPath: this.projectPath,
        homeDirectory: this.homeDirectory,
        totalFiles: allFiles.length,
        flatFiles: flatFiles.length
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.SSH_CONNECTION_FAILED,
        `EC2環境情報の取得に失敗しました: ${error}`,
        undefined,
        'ec2',
        error as Error
      );
    }
  }

  /**
   * EC2環境のヘルスチェック
   */
  public async performHealthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'error';
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // SSH接続テスト
      const connectionOk = await this.testConnection();
      if (!connectionOk) {
        issues.push('SSH接続に失敗しました');
        recommendations.push('SSH設定とネットワーク接続を確認してください');
        return { status: 'error', issues, recommendations };
      }

      // 平置きファイル数チェック
      const flatFiles = await this.detectEC2FlatFiles();
      if (flatFiles.length > 50) {
        issues.push(`平置きファイルが多すぎます: ${flatFiles.length}個`);
        recommendations.push('ファイル整理システムの実行を推奨します');
      }

      // ディスク使用量チェック
      const { stdout: diskUsage } = await this.executeSSHCommand(`df ${this.projectPath} | tail -1 | awk '{print $5}' | sed 's/%//'`);
      const diskUsagePercent = parseInt(diskUsage.trim(), 10);
      if (diskUsagePercent > 80) {
        issues.push(`ディスク使用量が高すぎます: ${diskUsagePercent}%`);
        recommendations.push('不要なファイルを削除してください');
      }

      // プロジェクトディレクトリアクセスチェック
      try {
        await this.executeSSHCommand(`test -r ${this.projectPath} && test -w ${this.projectPath}`);
      } catch {
        issues.push('プロジェクトディレクトリへの読み書き権限がありません');
        recommendations.push('ディレクトリ権限を確認してください');
      }

      const status = issues.length === 0 ? 'healthy' : 
                    issues.length <= 2 ? 'warning' : 'error';

      return { status, issues, recommendations };
    } catch (error) {
      return {
        status: 'error',
        issues: [`ヘルスチェック実行エラー: ${error}`],
        recommendations: ['SSH接続設定を確認してください']
      };
    }
  }

  /**
   * リモートディレクトリの存在確認
   */
  public async verifyDirectoryExists(remotePath: string): Promise<boolean> {
    try {
      const command = `test -d "${remotePath}" && echo "exists" || echo "not_exists"`;
      const { stdout } = await this.executeSSHCommand(command);
      return stdout.trim() === 'exists';
    } catch (error) {
      console.warn(`ディレクトリ存在確認エラー: ${remotePath}`, error);
      return false;
    }
  }

  /**
   * リモートディレクトリの作成
   */
  public async createRemoteDirectory(remotePath: string, permissions: string = '755'): Promise<boolean> {
    try {
      const command = `mkdir -p "${remotePath}" && chmod ${permissions} "${remotePath}"`;
      await this.executeSSHCommand(command);
      return true;
    } catch (error) {
      console.error(`リモートディレクトリ作成エラー: ${remotePath}`, error);
      return false;
    }
  }

  /**
   * リモートディレクトリの書き込み権限確認
   */
  public async verifyWritePermission(remotePath: string): Promise<boolean> {
    try {
      const testFile = `${remotePath}/.write_test_${Date.now()}`;
      const command = `touch "${testFile}" && rm "${testFile}" && echo "writable" || echo "not_writable"`;
      const { stdout } = await this.executeSSHCommand(command);
      return stdout.trim() === 'writable';
    } catch (error) {
      console.warn(`書き込み権限確認エラー: ${remotePath}`, error);
      return false;
    }
  }

  /**
   * EC2環境でのファイル分析
   */
  public async analyzeEC2Files(): Promise<{
    scriptFiles: FileInfo[];
    documentFiles: FileInfo[];
    configFiles: FileInfo[];
    oldProjects: FileInfo[];
    largeFiles: FileInfo[];
  }> {
    const flatFiles = await this.detectEC2FlatFiles();
    const oldProjects = await this.detectOldProjectDirectories();
    
    const analysis = {
      scriptFiles: [] as FileInfo[],
      documentFiles: [] as FileInfo[],
      configFiles: [] as FileInfo[],
      oldProjects,
      largeFiles: [] as FileInfo[]
    };

    for (const file of flatFiles) {
      if (file.extension === '.sh') {
        analysis.scriptFiles.push(file);
      } else if (['.md', '.txt', '.doc'].includes(file.extension)) {
        analysis.documentFiles.push(file);
      } else if (['.json', '.js', '.ts', '.yml', '.yaml'].includes(file.extension)) {
        analysis.configFiles.push(file);
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB以上
        analysis.largeFiles.push(file);
      }
    }

    return analysis;
  }
}