/**
 * 統合ファイル整理システム - ディレクトリ構造作成
 * 
 * Agent Steering file-placement-guidelinesに準拠した
 * 統一ディレクトリ構造を作成する機能を提供します。
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { 
  ClassificationConfig,
  Environment,
  OrganizationError,
  OrganizationErrorType
} from '../types/index.js';
import { SSHConfig } from '../scanners/ec2-scanner.js';

const execAsync = promisify(exec);

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
export class DirectoryCreator {
  private readonly config: ClassificationConfig;
  private readonly sshConfig?: SSHConfig;

  constructor(config: ClassificationConfig, sshConfig?: SSHConfig) {
    this.config = config;
    this.sshConfig = sshConfig;
  }

  /**
   * ローカル環境でディレクトリ構造を作成
   */
  public async createLocalDirectoryStructure(basePath: string = '.'): Promise<DirectoryCreationResult> {
    const startTime = Date.now();
    console.log(`📁 ローカル環境でディレクトリ構造を作成中: ${basePath}`);

    try {
      const createdPaths: string[] = [];
      const errors: string[] = [];

      // 必須ディレクトリの作成
      const requiredDirectories = this.getRequiredDirectories();
      
      for (const dirPath of requiredDirectories) {
        try {
          const fullPath = path.resolve(basePath, dirPath);
          await fs.mkdir(fullPath, { recursive: true });
          
          // 権限設定
          await this.setLocalDirectoryPermissions(fullPath, dirPath);
          
          createdPaths.push(fullPath);
          console.log(`✅ ディレクトリ作成: ${dirPath}`);
        } catch (error) {
          const errorMsg = `ディレクトリ作成エラー: ${dirPath} - ${error}`;
          errors.push(errorMsg);
          console.warn(errorMsg);
        }
      }

      // README ファイルの作成
      await this.createDirectoryReadmeFiles(basePath, 'local', errors);

      const processingTime = Date.now() - startTime;
      console.log(`✅ ローカルディレクトリ構造作成完了: ${createdPaths.length}個 (${processingTime}ms)`);

      return {
        createdDirectories: createdPaths.length,
        createdPaths,
        errors,
        success: errors.length === 0,
        environment: 'local',
        processingTime
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.MOVE_FAILED,
        `ローカルディレクトリ構造作成に失敗しました: ${error}`,
        basePath,
        'local',
        error as Error
      );
    }
  }

  /**
   * EC2環境でディレクトリ構造を作成
   */
  public async createEC2DirectoryStructure(basePath: string): Promise<DirectoryCreationResult> {
    if (!this.sshConfig) {
      throw new OrganizationError(
        OrganizationErrorType.SSH_CONNECTION_FAILED,
        'SSH設定が提供されていません',
        undefined,
        'ec2'
      );
    }

    const startTime = Date.now();
    console.log(`📁 EC2環境でディレクトリ構造を作成中: ${basePath}`);

    try {
      const createdPaths: string[] = [];
      const errors: string[] = [];

      // 必須ディレクトリの作成
      const requiredDirectories = this.getRequiredDirectories();
      
      for (const dirPath of requiredDirectories) {
        try {
          const fullPath = path.posix.join(basePath, dirPath);
          await this.executeSSHCommand(`mkdir -p "${fullPath}"`);
          
          // 権限設定
          await this.setEC2DirectoryPermissions(fullPath, dirPath);
          
          createdPaths.push(fullPath);
          console.log(`✅ EC2ディレクトリ作成: ${dirPath}`);
        } catch (error) {
          const errorMsg = `EC2ディレクトリ作成エラー: ${dirPath} - ${error}`;
          errors.push(errorMsg);
          console.warn(errorMsg);
        }
      }

      // README ファイルの作成
      await this.createDirectoryReadmeFiles(basePath, 'ec2', errors);

      const processingTime = Date.now() - startTime;
      console.log(`✅ EC2ディレクトリ構造作成完了: ${createdPaths.length}個 (${processingTime}ms)`);

      return {
        createdDirectories: createdPaths.length,
        createdPaths,
        errors,
        success: errors.length === 0,
        environment: 'ec2',
        processingTime
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.SSH_CONNECTION_FAILED,
        `EC2ディレクトリ構造作成に失敗しました: ${error}`,
        basePath,
        'ec2',
        error as Error
      );
    }
  }

  /**
   * 統合ディレクトリ構造作成
   */
  public async createIntegratedDirectoryStructure(
    localBasePath: string = '.',
    ec2BasePath: string
  ): Promise<{
    local: DirectoryCreationResult;
    ec2: DirectoryCreationResult;
    success: boolean;
  }> {
    console.log('🏗️  統合ディレクトリ構造を作成中...');

    try {
      // 並列でディレクトリ構造を作成
      const [localResult, ec2Result] = await Promise.allSettled([
        this.createLocalDirectoryStructure(localBasePath),
        this.createEC2DirectoryStructure(ec2BasePath)
      ]);

      const local = localResult.status === 'fulfilled' ? localResult.value : 
        this.createErrorResult('local', localResult.reason);
      
      const ec2 = ec2Result.status === 'fulfilled' ? ec2Result.value : 
        this.createErrorResult('ec2', ec2Result.reason);

      const success = local.success && ec2.success;
      
      console.log(`✅ 統合ディレクトリ構造作成完了: ${success ? '成功' : '部分的成功'}`);

      return { local, ec2, success };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.MOVE_FAILED,
        `統合ディレクトリ構造作成に失敗しました: ${error}`,
        undefined,
        undefined,
        error as Error
      );
    }
  }

  /**
   * 必須ディレクトリ一覧を取得
   */
  private getRequiredDirectories(): string[] {
    return [
      // development/ 配下
      'development/scripts/deployment',
      'development/scripts/analysis',
      'development/scripts/maintenance',
      'development/scripts/utilities',
      'development/scripts/legacy',
      'development/docs/reports',
      'development/docs/guides',
      'development/docs/legacy',
      'development/configs/environments',
      'development/configs/security',
      'development/configs/secrets',
      'development/configs/legacy',
      'development/logs/deployment',
      'development/logs/analysis',
      'development/logs/maintenance',
      'development/logs/organization',
      'development/temp/working',
      'development/temp/cache',
      'development/temp/build',

      // docs/ 配下（公開用）
      'docs/troubleshooting',
      'docs/deployment',
      'docs/guides',
      'docs/legacy',

      // config/ 配下（公開用）
      'config/samples',
      'config/legacy',

      // tests/ 配下
      'tests/unit',
      'tests/integration',
      'tests/payloads',
      'tests/legacy',

      // archive/ 配下
      'archive/legacy-files',
      'archive/old-projects',
      'archive/backup-files'
    ];
  }

  /**
   * ローカル環境でのディレクトリ権限設定
   */
  private async setLocalDirectoryPermissions(dirPath: string, relativePath: string): Promise<void> {
    try {
      let permissions = '755'; // デフォルト

      // 機密ディレクトリは制限された権限
      if (relativePath.includes('secrets') || relativePath.includes('security')) {
        permissions = '700';
      }
      // 一時ディレクトリは書き込み可能
      else if (relativePath.includes('temp') || relativePath.includes('logs')) {
        permissions = '755';
      }

      await fs.chmod(dirPath, parseInt(permissions, 8));
    } catch (error) {
      console.warn(`ローカルディレクトリ権限設定エラー: ${dirPath}`, error);
    }
  }

  /**
   * EC2環境でのディレクトリ権限設定
   */
  private async setEC2DirectoryPermissions(dirPath: string, relativePath: string): Promise<void> {
    try {
      let permissions = '755'; // デフォルト

      // 機密ディレクトリは制限された権限
      if (relativePath.includes('secrets') || relativePath.includes('security')) {
        permissions = '700';
      }
      // 一時ディレクトリは書き込み可能
      else if (relativePath.includes('temp') || relativePath.includes('logs')) {
        permissions = '755';
      }

      await this.executeSSHCommand(`chmod ${permissions} "${dirPath}"`);
    } catch (error) {
      console.warn(`EC2ディレクトリ権限設定エラー: ${dirPath}`, error);
    }
  }

  /**
   * ディレクトリ用READMEファイルを作成
   */
  private async createDirectoryReadmeFiles(
    basePath: string,
    environment: Environment,
    errors: string[]
  ): Promise<void> {
    const readmeContents = this.getReadmeContents();

    for (const [dirPath, content] of Object.entries(readmeContents)) {
      try {
        const fullDirPath = environment === 'local' ? 
          path.resolve(basePath, dirPath) : 
          path.posix.join(basePath, dirPath);
        
        const readmePath = environment === 'local' ?
          path.join(fullDirPath, 'README.md') :
          path.posix.join(fullDirPath, 'README.md');

        if (environment === 'local') {
          await fs.writeFile(readmePath, content);
          await fs.chmod(readmePath, 0o644);
        } else {
          await this.executeSSHCommand(`cat > "${readmePath}" << 'EOF'\n${content}\nEOF`);
          await this.executeSSHCommand(`chmod 644 "${readmePath}"`);
        }

        console.log(`📝 README作成: ${dirPath}/README.md`);
      } catch (error) {
        errors.push(`README作成エラー: ${dirPath} - ${error}`);
      }
    }
  }

  /**
   * README内容を取得
   */
  private getReadmeContents(): Record<string, string> {
    return {
      'development/scripts': `# 開発・運用スクリプト

## ディレクトリ構成

- \`deployment/\`: デプロイメント関連スクリプト
- \`analysis/\`: 分析・確認スクリプト
- \`maintenance/\`: メンテナンススクリプト
- \`utilities/\`: ユーティリティスクリプト
- \`legacy/\`: レガシースクリプト

## 使用方法

各ディレクトリ内のスクリプトは実行権限が設定されています。

## 注意事項

これらのスクリプトは環境固有の情報を含むため、公開リポジトリには含めないでください。
`,

      'development/docs': `# 開発ドキュメント

## ディレクトリ構成

- \`reports/\`: プロジェクトレポート・進捗報告
- \`guides/\`: 内部ガイド・手順書
- \`legacy/\`: 古いドキュメント

## 注意事項

これらのドキュメントは開発プロセス固有の情報を含むため、公開リポジトリには含めないでください。
`,

      'development/configs': `# 環境固有設定ファイル

## ディレクトリ構成

- \`environments/\`: 環境別設定
- \`security/\`: セキュリティ関連設定
- \`secrets/\`: 機密設定（権限600）
- \`legacy/\`: 古い設定ファイル

## セキュリティ

機密情報を含むファイルは適切な権限で保護されています。
`,

      'docs': `# Permission-aware RAG System ドキュメント

## ディレクトリ構成

- \`troubleshooting/\`: トラブルシューティング
- \`deployment/\`: デプロイメント関連
- \`guides/\`: ガイド・手順書
- \`legacy/\`: 古いドキュメント

## 公開用ドキュメント

これらのドキュメントは汎用的な内容で、公開リポジトリに含めることができます。
`,

      'tests': `# テストファイル

## ディレクトリ構成

- \`unit/\`: 単体テスト
- \`integration/\`: 統合テスト
- \`payloads/\`: テストペイロード・データ
- \`legacy/\`: 古いテストファイル

## テスト実行

各テストは適切なテストランナーで実行してください。
`,

      'archive': `# アーカイブファイル

## ディレクトリ構成

- \`legacy-files/\`: 古いファイル
- \`old-projects/\`: 古いプロジェクト
- \`backup-files/\`: バックアップファイル

## 注意事項

アーカイブされたファイルは定期的に見直し、不要なものは削除してください。
`
    };
  }

  /**
   * SSH コマンドを実行
   */
  private async executeSSHCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    if (!this.sshConfig) {
      throw new Error('SSH設定が提供されていません');
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

  /**
   * エラー結果を作成
   */
  private createErrorResult(environment: Environment, reason: any): DirectoryCreationResult {
    return {
      createdDirectories: 0,
      createdPaths: [],
      errors: [reason instanceof Error ? reason.message : String(reason)],
      success: false,
      environment,
      processingTime: 0
    };
  }

  /**
   * ディレクトリ構造の検証
   */
  public async validateDirectoryStructure(
    basePath: string,
    environment: Environment
  ): Promise<{
    valid: boolean;
    missingDirectories: string[];
    extraDirectories: string[];
    permissionIssues: string[];
  }> {
    try {
      const requiredDirectories = this.getRequiredDirectories();
      const missingDirectories: string[] = [];
      const permissionIssues: string[] = [];

      for (const dirPath of requiredDirectories) {
        const fullPath = environment === 'local' ? 
          path.resolve(basePath, dirPath) : 
          path.posix.join(basePath, dirPath);

        try {
          if (environment === 'local') {
            await fs.access(fullPath);
            
            // 権限チェック
            const stats = await fs.stat(fullPath);
            const permissions = (stats.mode & parseInt('777', 8)).toString(8);
            
            if (dirPath.includes('secrets') && permissions !== '700') {
              permissionIssues.push(`${dirPath}: 期待権限700, 実際${permissions}`);
            }
          } else {
            await this.executeSSHCommand(`test -d "${fullPath}"`);
            
            // 権限チェック
            const { stdout } = await this.executeSSHCommand(`stat -c "%a" "${fullPath}"`);
            const permissions = stdout.trim();
            
            if (dirPath.includes('secrets') && permissions !== '700') {
              permissionIssues.push(`${dirPath}: 期待権限700, 実際${permissions}`);
            }
          }
        } catch {
          missingDirectories.push(dirPath);
        }
      }

      const valid = missingDirectories.length === 0 && permissionIssues.length === 0;

      return {
        valid,
        missingDirectories,
        extraDirectories: [], // 実装簡略化
        permissionIssues
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.VALIDATION_FAILED,
        `ディレクトリ構造検証に失敗しました: ${error}`,
        basePath,
        environment,
        error as Error
      );
    }
  }

  /**
   * 環境に応じたディレクトリ構造を作成
   */
  public async createEnvironmentStructure(basePath: string, environment: Environment = 'local'): Promise<DirectoryCreationResult> {
    try {
      console.log(`🏗️ 環境ディレクトリ構造作成開始: ${environment}`);
      
      if (environment === 'local') {
        return await this.createLocalDirectoryStructure(basePath);
      } else {
        return await this.createEC2DirectoryStructure(basePath);
      }
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.DIRECTORY_CREATION_FAILED,
        `環境ディレクトリ構造作成に失敗しました: ${error}`,
        basePath,
        environment,
        error as Error
      );
    }
  }
}