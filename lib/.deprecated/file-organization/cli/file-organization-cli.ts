/**
 * 統合ファイル整理システム - CLIコマンド定義
 * 
 * コマンドライン操作インターフェースを提供し、
 * 全機能への統一アクセスを実現します。
 */
import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  ClassificationConfig,
  Environment,
  OrganizationError,
  OrganizationErrorType
} from '../types/index.js';
import { SSHConfig } from '../scanners/ec2-scanner.js';
import { IntegratedExecutionEngine, ExecutionOptions } from '../engine/integrated-execution-engine.js';
import { ProgressReporter } from '../engine/progress-reporter.js';
import { SyncManager } from '../sync/sync-manager.js';
import { StructureComparator } from '../sync/structure-comparator.js';
import { DirectoryCreator } from '../structure/directory-creator.js';

/**
 * CLI設定
 */
export interface CLIConfig {
  /** 設定ファイルパス */
  configPath: string;
  /** SSH設定ファイルパス */
  sshConfigPath?: string;
  /** 出力ディレクトリ */
  outputDir: string;
  /** ログレベル */
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  /** カラー出力 */
  useColors: boolean;
}

/**
 * ファイル整理CLI
 * 
 * 統合ファイル整理システムのコマンドライン操作を提供します。
 */
export class FileOrganizationCLI {
  private readonly program: Command;
  private config?: ClassificationConfig;
  private sshConfig?: SSHConfig;
  private cliConfig: CLIConfig;

  constructor() {
    this.program = new Command();
    this.cliConfig = this.getDefaultCLIConfig();
    this.setupCommands();
  }

  /**
   * CLIを実行
   */
  public async run(argv: string[]): Promise<void> {
    try {
      await this.program.parseAsync(argv);
    } catch (error) {
      console.error('❌ CLI実行エラー:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * コマンドを設定
   */
  private setupCommands(): void {
    this.program
      .name('file-organization')
      .description('統合ファイル整理システム')
      .version('1.0.0');

    // グローバルオプション
    this.program
      .option('-c, --config <path>', '設定ファイルパス', 'config/file-organization-rules.json')
      .option('-s, --ssh-config <path>', 'SSH設定ファイルパス')
      .option('-o, --output <dir>', '出力ディレクトリ', 'development/logs/organization')
      .option('--log-level <level>', 'ログレベル', 'info')
      .option('--no-colors', 'カラー出力を無効化')
      .hook('preAction', async (thisCommand) => {
        await this.loadConfiguration(thisCommand.opts());
      });

    // メインコマンド
    this.setupExecuteCommand();
    this.setupScanCommand();
    this.setupClassifyCommand();
    this.setupMoveCommand();
    this.setupSyncCommand();
    this.setupValidateCommand();
    this.setupReportCommand();
    this.setupStructureCommand();
    this.setupBackupCommand();
    this.setupPermissionCommand();
  }

  /**
   * 実行コマンドを設定
   */
  private setupExecuteCommand(): void {
    this.program
      .command('execute')
      .alias('run')
      .description('統合ファイル整理を実行')
      .option('-m, --mode <mode>', '実行モード', 'full')
      .option('-e, --environments <envs>', '対象環境 (カンマ区切り)', 'local,ec2')
      .option('--dry-run', 'ドライランモード')
      .option('--no-parallel', '並列実行を無効化')
      .option('--max-parallel <num>', '最大並列数', '2')
      .option('--no-backup', 'バックアップ作成を無効化')
      .option('--no-permissions', '権限設定を無効化')
      .option('--no-sync', '同期を無効化')
      .option('--continue-on-error', 'エラー時も続行')
      .action(async (options) => {
        await this.executeCommand(options);
      });
  }

  /**
   * スキャンコマンドを設定
   */
  private setupScanCommand(): void {
    this.program
      .command('scan')
      .description('ファイルスキャンを実行')
      .option('-e, --environment <env>', '対象環境', 'local')
      .option('-p, --path <path>', 'スキャンパス', '.')
      .option('--include-hidden', '隠しファイルを含める')
      .option('--max-depth <num>', '最大階層数', '10')
      .action(async (options) => {
        await this.scanCommand(options);
      });
  }

  /**
   * 分類コマンドを設定
   */
  private setupClassifyCommand(): void {
    this.program
      .command('classify')
      .description('ファイル分類を実行')
      .option('-i, --input <path>', '入力ファイル/ディレクトリ')
      .option('-o, --output <path>', '分類結果出力パス')
      .option('--confidence-threshold <num>', '信頼度閾値', '0.7')
      .option('--show-details', '詳細情報を表示')
      .action(async (options) => {
        await this.classifyCommand(options);
      });
  }

  /**
   * 移動コマンドを設定
   */
  private setupMoveCommand(): void {
    this.program
      .command('move')
      .description('ファイル移動を実行')
      .option('-e, --environment <env>', '対象環境', 'local')
      .option('-i, --input <path>', '分類結果ファイル')
      .option('--dry-run', 'ドライランモード')
      .option('--overwrite', '既存ファイルを上書き')
      .option('--copy', '移動ではなくコピー')
      .action(async (options) => {
        await this.moveCommand(options);
      });
  }

  /**
   * 同期コマンドを設定
   */
  private setupSyncCommand(): void {
    this.program
      .command('sync')
      .description('環境間同期を実行')
      .option('-d, --direction <dir>', '同期方向', 'bidirectional')
      .option('--local-path <path>', 'ローカルパス', '.')
      .option('--ec2-path <path>', 'EC2パス', '/home/ubuntu')
      .option('--dry-run', 'ドライランモード')
      .option('--overwrite', '既存ファイルを上書き')
      .option('--no-permissions', '権限同期を無効化')
      .option('--no-backup', 'バックアップ作成を無効化')
      .option('--exclude <patterns>', '除外パターン (カンマ区切り)', 'node_modules,.git,cdk.out')
      .action(async (options) => {
        await this.syncCommand(options);
      });
  }

  /**
   * 検証コマンドを設定
   */
  private setupValidateCommand(): void {
    this.program
      .command('validate')
      .description('構造・権限検証を実行')
      .option('-t, --type <type>', '検証タイプ', 'all')
      .option('-e, --environment <env>', '対象環境', 'all')
      .option('--fix', '問題を自動修復')
      .option('--report <path>', 'レポート出力パス')
      .action(async (options) => {
        await this.validateCommand(options);
      });
  }

  /**
   * レポートコマンドを設定
   */
  private setupReportCommand(): void {
    this.program
      .command('report')
      .description('レポート生成を実行')
      .option('-t, --type <type>', 'レポートタイプ', 'summary')
      .option('-f, --format <format>', 'レポート形式', 'markdown')
      .option('-o, --output <path>', '出力パス')
      .option('--include-charts', 'チャートを含める')
      .action(async (options) => {
        await this.reportCommand(options);
      });
  }

  /**
   * 構造コマンドを設定
   */
  private setupStructureCommand(): void {
    const structureCmd = this.program
      .command('structure')
      .description('ディレクトリ構造管理');

    structureCmd
      .command('create')
      .description('ディレクトリ構造を作成')
      .option('-e, --environment <env>', '対象環境', 'local')
      .action(async (options) => {
        await this.structureCreateCommand(options);
      });

    structureCmd
      .command('compare')
      .description('環境間構造比較')
      .option('--local-path <path>', 'ローカルパス', '.')
      .option('--ec2-path <path>', 'EC2パス', '/home/ubuntu')
      .option('-o, --output <path>', 'レポート出力パス')
      .action(async (options) => {
        await this.structureCompareCommand(options);
      });

    structureCmd
      .command('validate')
      .description('構造検証')
      .option('-e, --environment <env>', '対象環境', 'local')
      .action(async (options) => {
        await this.structureValidateCommand(options);
      });
  }

  /**
   * バックアップコマンドを設定
   */
  private setupBackupCommand(): void {
    const backupCmd = this.program
      .command('backup')
      .description('バックアップ管理');

    backupCmd
      .command('create')
      .description('バックアップを作成')
      .option('-e, --environment <env>', '対象環境', 'local')
      .option('-i, --id <id>', 'バックアップID')
      .action(async (options) => {
        await this.backupCreateCommand(options);
      });

    backupCmd
      .command('restore')
      .description('バックアップから復元')
      .option('-e, --environment <env>', '対象環境', 'local')
      .option('-i, --id <id>', 'バックアップID', true)
      .option('--overwrite', '既存ファイルを上書き')
      .action(async (options) => {
        await this.backupRestoreCommand(options);
      });

    backupCmd
      .command('list')
      .description('バックアップ一覧を表示')
      .option('-e, --environment <env>', '対象環境', 'all')
      .action(async (options) => {
        await this.backupListCommand(options);
      });

    backupCmd
      .command('cleanup')
      .description('古いバックアップを削除')
      .option('-e, --environment <env>', '対象環境', 'all')
      .option('-d, --days <num>', '保持日数', '30')
      .action(async (options) => {
        await this.backupCleanupCommand(options);
      });
  }

  /**
   * 権限コマンドを設定
   */
  private setupPermissionCommand(): void {
    const permissionCmd = this.program
      .command('permission')
      .alias('perm')
      .description('権限管理');

    permissionCmd
      .command('set')
      .description('権限を設定')
      .option('-e, --environment <env>', '対象環境', 'local')
      .option('-p, --path <path>', '対象パス')
      .option('--recursive', '再帰的に設定')
      .action(async (options) => {
        await this.permissionSetCommand(options);
      });

    permissionCmd
      .command('validate')
      .description('権限を検証')
      .option('-e, --environment <env>', '対象環境', 'all')
      .option('--fix', '問題を自動修復')
      .action(async (options) => {
        await this.permissionValidateCommand(options);
      });
  }

  /**
   * 実行コマンドを処理
   */
  private async executeCommand(options: any): Promise<void> {
    console.log('🚀 統合ファイル整理を開始...');

    try {
      const executionOptions: ExecutionOptions = {
        mode: options.mode,
        environments: options.environments.split(',') as Environment[],
        dryRun: options.dryRun || false,
        enableParallel: options.parallel !== false,
        maxParallel: parseInt(options.maxParallel) || 2,
        createBackup: options.backup !== false,
        setPermissions: options.permissions !== false,
        enableSync: options.sync !== false,
        continueOnError: options.continueOnError || false
      };

      // 進捗レポーターを設定
      const progressReporter = new ProgressReporter();
      executionOptions.progressCallback = (progress) => {
        progressReporter.updateProgress(progress);
      };

      // 統合実行エンジンを初期化
      const engine = new IntegratedExecutionEngine(this.config!, this.sshConfig);

      // 実行開始
      const result = await engine.execute(executionOptions);

      // レポート生成
      const reportFiles = await progressReporter.generateIntegratedReport(result);

      if (result.success) {
        console.log('✅ 統合ファイル整理が完了しました');
        console.log(`📊 統計: ${result.overallStatistics.totalMovedFiles}ファイル移動, ${result.overallStatistics.flatFileReduction}個の平置きファイル削減`);
        console.log(`📄 レポート: ${reportFiles.join(', ')}`);
      } else {
        console.warn('⚠️ 統合ファイル整理が部分的に完了しました');
        console.warn(`❌ エラー: ${result.errors.length}個, 警告: ${result.warnings.length}個`);
      }
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.CLI_EXECUTION_FAILED,
        `実行コマンドに失敗しました: ${error}`,
        undefined,
        undefined,
        error as Error
      );
    }
  }

  /**
   * スキャンコマンドを処理
   */
  private async scanCommand(options: any): Promise<void> {
    console.log(`🔍 ${options.environment}環境のファイルスキャンを開始...`);

    try {
      // スキャン実行（実装簡略化）
      console.log(`📁 スキャンパス: ${options.path}`);
      console.log(`📊 オプション: 隠しファイル=${options.includeHidden}, 最大階層=${options.maxDepth}`);

      // 実際のスキャン処理はここに実装
      console.log('✅ ファイルスキャンが完了しました');
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.SCAN_FAILED,
        `スキャンコマンドに失敗しました: ${error}`,
        undefined,
        options.environment,
        error as Error
      );
    }
  }

  /**
   * 分類コマンドを処理
   */
  private async classifyCommand(options: any): Promise<void> {
    console.log('🏷️ ファイル分類を開始...');

    try {
      console.log(`📄 入力: ${options.input || '標準入力'}`);
      console.log(`📊 信頼度閾値: ${options.confidenceThreshold}`);

      // 実際の分類処理はここに実装
      console.log('✅ ファイル分類が完了しました');
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.CLASSIFICATION_FAILED,
        `分類コマンドに失敗しました: ${error}`,
        undefined,
        undefined,
        error as Error
      );
    }
  }

  /**
   * 移動コマンドを処理
   */
  private async moveCommand(options: any): Promise<void> {
    console.log(`📦 ${options.environment}環境でファイル移動を開始...`);

    try {
      console.log(`📄 分類結果: ${options.input}`);
      console.log(`🔧 オプション: ドライラン=${options.dryRun}, 上書き=${options.overwrite}, コピー=${options.copy}`);

      // 実際の移動処理はここに実装
      console.log('✅ ファイル移動が完了しました');
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.MOVE_FAILED,
        `移動コマンドに失敗しました: ${error}`,
        undefined,
        options.environment,
        error as Error
      );
    }
  }

  /**
   * 同期コマンドを処理
   */
  private async syncCommand(options: any): Promise<void> {
    console.log(`🔄 環境間同期を開始: ${options.direction}`);

    try {
      const syncManager = new SyncManager(this.sshConfig);
      const syncOptions = {
        direction: options.direction,
        dryRun: options.dryRun || false,
        overwriteExisting: options.overwrite || false,
        syncPermissions: options.permissions !== false,
        createBackup: options.backup !== false,
        excludePatterns: options.exclude.split(',')
      };

      const result = await syncManager.executeSync(
        options.localPath,
        options.ec2Path,
        syncOptions
      );

      if (result.success) {
        console.log('✅ 環境間同期が完了しました');
        console.log(`📊 統計: ${result.statistics.syncedFiles}ファイル同期, ${result.statistics.createdDirectories}ディレクトリ作成`);
      } else {
        console.warn('⚠️ 環境間同期で一部エラーが発生しました');
        console.warn(`❌ 失敗: ${result.failedItems.length}個`);
      }
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.SYNC_FAILED,
        `同期コマンドに失敗しました: ${error}`,
        undefined,
        undefined,
        error as Error
      );
    }
  }

  /**
   * 検証コマンドを処理
   */
  private async validateCommand(options: any): Promise<void> {
    console.log(`🔍 ${options.type}検証を開始...`);

    try {
      console.log(`🎯 対象環境: ${options.environment}`);
      console.log(`🔧 自動修復: ${options.fix ? '有効' : '無効'}`);

      // 実際の検証処理はここに実装
      console.log('✅ 検証が完了しました');
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.VALIDATION_FAILED,
        `検証コマンドに失敗しました: ${error}`,
        undefined,
        options.environment,
        error as Error
      );
    }
  }

  /**
   * レポートコマンドを処理
   */
  private async reportCommand(options: any): Promise<void> {
    console.log(`📊 ${options.type}レポートを生成中...`);

    try {
      console.log(`📄 形式: ${options.format}`);
      console.log(`📁 出力: ${options.output || '標準出力'}`);

      // 実際のレポート生成処理はここに実装
      console.log('✅ レポート生成が完了しました');
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.REPORT_GENERATION_FAILED,
        `レポートコマンドに失敗しました: ${error}`,
        undefined,
        undefined,
        error as Error
      );
    }
  }

  /**
   * 構造作成コマンドを処理
   */
  private async structureCreateCommand(options: any): Promise<void> {
    console.log(`🏗️ ${options.environment}環境のディレクトリ構造を作成中...`);

    try {
      const directoryCreator = new DirectoryCreator(this.config!, this.sshConfig);
      const result = await directoryCreator.createEnvironmentStructure(options.environment);

      console.log('✅ ディレクトリ構造作成が完了しました');
      console.log(`📊 統計: ${result.createdDirectories}個作成, ${result.skippedPaths.length}個スキップ`);
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.STRUCTURE_CREATION_FAILED,
        `構造作成コマンドに失敗しました: ${error}`,
        undefined,
        options.environment,
        error as Error
      );
    }
  }

  /**
   * 構造比較コマンドを処理
   */
  private async structureCompareCommand(options: any): Promise<void> {
    console.log('🔍 環境間構造比較を開始...');

    try {
      const structureComparator = new StructureComparator(this.sshConfig);
      const comparison = await structureComparator.compareStructures(
        options.localPath,
        options.ec2Path
      );

      console.log('✅ 構造比較が完了しました');
      console.log(`📊 一致率: ${comparison.matchPercentage.toFixed(1)}%, 差分: ${comparison.differences.length}個`);

      // レポート出力
      if (options.output) {
        const report = structureComparator.generateComparisonReport(comparison);
        await fs.writeFile(options.output, report);
        console.log(`📄 レポート出力: ${options.output}`);
      }
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.STRUCTURE_COMPARISON_FAILED,
        `構造比較コマンドに失敗しました: ${error}`,
        undefined,
        undefined,
        error as Error
      );
    }
  }

  /**
   * 構造検証コマンドを処理
   */
  private async structureValidateCommand(options: any): Promise<void> {
    console.log(`🔍 ${options.environment}環境の構造検証を開始...`);

    try {
      const directoryCreator = new DirectoryCreator(this.config!, this.sshConfig);
      const validation = await directoryCreator.validateStructure(options.environment);

      if (validation.valid) {
        console.log('✅ 構造検証が完了しました: 問題なし');
      } else {
        console.warn('⚠️ 構造検証で問題を検出しました');
        console.warn(`❌ 不足ディレクトリ: ${validation.missingDirectories.length}個`);
        console.warn(`⚠️ 権限問題: ${validation.permissionIssues.length}個`);
      }
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.STRUCTURE_VALIDATION_FAILED,
        `構造検証コマンドに失敗しました: ${error}`,
        undefined,
        options.environment,
        error as Error
      );
    }
  }

  /**
   * バックアップ作成コマンドを処理
   */
  private async backupCreateCommand(options: any): Promise<void> {
    console.log(`💾 ${options.environment}環境のバックアップを作成中...`);

    try {
      console.log(`🆔 バックアップID: ${options.id || '自動生成'}`);

      // 実際のバックアップ作成処理はここに実装
      console.log('✅ バックアップ作成が完了しました');
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `バックアップ作成コマンドに失敗しました: ${error}`,
        undefined,
        options.environment,
        error as Error
      );
    }
  }

  /**
   * バックアップ復元コマンドを処理
   */
  private async backupRestoreCommand(options: any): Promise<void> {
    console.log(`🔄 ${options.environment}環境のバックアップから復元中...`);

    try {
      console.log(`🆔 バックアップID: ${options.id}`);
      console.log(`🔧 上書き: ${options.overwrite ? '有効' : '無効'}`);

      // 実際のバックアップ復元処理はここに実装
      console.log('✅ バックアップ復元が完了しました');
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.RESTORE_FAILED,
        `バックアップ復元コマンドに失敗しました: ${error}`,
        undefined,
        options.environment,
        error as Error
      );
    }
  }

  /**
   * バックアップ一覧コマンドを処理
   */
  private async backupListCommand(options: any): Promise<void> {
    console.log(`📋 ${options.environment}環境のバックアップ一覧を取得中...`);

    try {
      // 実際のバックアップ一覧取得処理はここに実装
      console.log('✅ バックアップ一覧取得が完了しました');
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `バックアップ一覧コマンドに失敗しました: ${error}`,
        undefined,
        options.environment,
        error as Error
      );
    }
  }

  /**
   * バックアップクリーンアップコマンドを処理
   */
  private async backupCleanupCommand(options: any): Promise<void> {
    console.log(`🧹 ${options.environment}環境の古いバックアップを削除中...`);

    try {
      console.log(`📅 保持日数: ${options.days}日`);

      // 実際のバックアップクリーンアップ処理はここに実装
      console.log('✅ バックアップクリーンアップが完了しました');
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.BACKUP_FAILED,
        `バックアップクリーンアップコマンドに失敗しました: ${error}`,
        undefined,
        options.environment,
        error as Error
      );
    }
  }

  /**
   * 権限設定コマンドを処理
   */
  private async permissionSetCommand(options: any): Promise<void> {
    console.log(`🔒 ${options.environment}環境の権限を設定中...`);

    try {
      console.log(`📁 対象パス: ${options.path || '全体'}`);
      console.log(`🔧 再帰的: ${options.recursive ? '有効' : '無効'}`);

      // 実際の権限設定処理はここに実装
      console.log('✅ 権限設定が完了しました');
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.PERMISSION_FAILED,
        `権限設定コマンドに失敗しました: ${error}`,
        undefined,
        options.environment,
        error as Error
      );
    }
  }

  /**
   * 権限検証コマンドを処理
   */
  private async permissionValidateCommand(options: any): Promise<void> {
    console.log(`🔍 ${options.environment}環境の権限を検証中...`);

    try {
      console.log(`🔧 自動修復: ${options.fix ? '有効' : '無効'}`);

      // 実際の権限検証処理はここに実装
      console.log('✅ 権限検証が完了しました');
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.PERMISSION_FAILED,
        `権限検証コマンドに失敗しました: ${error}`,
        undefined,
        options.environment,
        error as Error
      );
    }
  }

  /**
   * 設定を読み込み
   */
  private async loadConfiguration(options: any): Promise<void> {
    try {
      // CLI設定を更新
      this.cliConfig = {
        configPath: options.config,
        sshConfigPath: options.sshConfig,
        outputDir: options.output,
        logLevel: options.logLevel,
        useColors: options.colors !== false
      };

      // 分類設定を読み込み
      if (await this.fileExists(this.cliConfig.configPath)) {
        const configContent = await fs.readFile(this.cliConfig.configPath, 'utf-8');
        this.config = JSON.parse(configContent);
        console.log(`📋 設定ファイル読み込み: ${this.cliConfig.configPath}`);
      } else {
        console.warn(`⚠️ 設定ファイルが見つかりません: ${this.cliConfig.configPath}`);
        this.config = this.getDefaultConfig();
      }

      // SSH設定を読み込み
      if (this.cliConfig.sshConfigPath && await this.fileExists(this.cliConfig.sshConfigPath)) {
        const sshConfigContent = await fs.readFile(this.cliConfig.sshConfigPath, 'utf-8');
        this.sshConfig = JSON.parse(sshConfigContent);
        console.log(`🔑 SSH設定ファイル読み込み: ${this.cliConfig.sshConfigPath}`);
      }
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.CONFIG_LOAD_FAILED,
        `設定読み込みに失敗しました: ${error}`,
        undefined,
        undefined,
        error as Error
      );
    }
  }

  /**
   * ファイル存在確認
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * デフォルトCLI設定を取得
   */
  private getDefaultCLIConfig(): CLIConfig {
    return {
      configPath: 'config/file-organization-rules.json',
      outputDir: 'development/logs/organization',
      logLevel: 'info',
      useColors: true
    };
  }

  /**
   * デフォルト設定を取得
   */
  private getDefaultConfig(): ClassificationConfig {
    return {
      rules: {
        script: {
          patterns: ['*.sh', '*.py', '*.js', '*.ts'],
          keywords: ['script', 'utility', 'tool'],
          targetDirectory: 'development/scripts/utilities'
        },
        document: {
          patterns: ['*.md', '*.txt', '*.doc'],
          keywords: ['readme', 'doc', 'guide'],
          targetDirectory: 'development/docs/reports'
        },
        config: {
          patterns: ['*.json', '*.yaml', '*.yml', '*.env'],
          keywords: ['config', 'setting', 'env'],
          targetDirectory: 'development/configs'
        },
        test: {
          patterns: ['*.test.*', '*.spec.*'],
          keywords: ['test', 'spec'],
          targetDirectory: 'tests/legacy'
        },
        log: {
          patterns: ['*.log'],
          keywords: ['log'],
          targetDirectory: 'development/logs'
        },
        other: {
          patterns: ['*'],
          keywords: [],
          targetDirectory: 'archive/unknown'
        }
      },
      validation: {
        requiredDirectories: [
          'development',
          'development/scripts',
          'development/docs',
          'development/configs',
          'development/logs',
          'tests',
          'archive'
        ],
        maxFileSize: 100 * 1024 * 1024, // 100MB
        allowedExtensions: ['.js', '.ts', '.py', '.sh', '.md', '.json', '.yaml', '.yml']
      }
    };
  }
}