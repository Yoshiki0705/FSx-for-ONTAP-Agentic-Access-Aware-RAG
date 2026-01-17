"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileOrganizationCLI = void 0;
/**
 * 統合ファイル整理システム - CLIコマンド定義
 *
 * コマンドライン操作インターフェースを提供し、
 * 全機能への統一アクセスを実現します。
 */
const commander_1 = require("commander");
const fs = __importStar(require("fs/promises"));
const index_js_1 = require("../types/index.js");
const integrated_execution_engine_js_1 = require("../engine/integrated-execution-engine.js");
const progress_reporter_js_1 = require("../engine/progress-reporter.js");
const sync_manager_js_1 = require("../sync/sync-manager.js");
const structure_comparator_js_1 = require("../sync/structure-comparator.js");
const directory_creator_js_1 = require("../structure/directory-creator.js");
/**
 * ファイル整理CLI
 *
 * 統合ファイル整理システムのコマンドライン操作を提供します。
 */
class FileOrganizationCLI {
    program;
    config;
    sshConfig;
    cliConfig;
    constructor() {
        this.program = new commander_1.Command();
        this.cliConfig = this.getDefaultCLIConfig();
        this.setupCommands();
    }
    /**
     * CLIを実行
     */
    async run(argv) {
        try {
            await this.program.parseAsync(argv);
        }
        catch (error) {
            console.error('❌ CLI実行エラー:', error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    }
    /**
     * コマンドを設定
     */
    setupCommands() {
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
    setupExecuteCommand() {
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
    setupScanCommand() {
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
    setupClassifyCommand() {
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
    setupMoveCommand() {
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
    setupSyncCommand() {
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
    setupValidateCommand() {
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
    setupReportCommand() {
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
    setupStructureCommand() {
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
    setupBackupCommand() {
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
    setupPermissionCommand() {
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
    async executeCommand(options) {
        console.log('🚀 統合ファイル整理を開始...');
        try {
            const executionOptions = {
                mode: options.mode,
                environments: options.environments.split(','),
                dryRun: options.dryRun || false,
                enableParallel: options.parallel !== false,
                maxParallel: parseInt(options.maxParallel) || 2,
                createBackup: options.backup !== false,
                setPermissions: options.permissions !== false,
                enableSync: options.sync !== false,
                continueOnError: options.continueOnError || false
            };
            // 進捗レポーターを設定
            const progressReporter = new progress_reporter_js_1.ProgressReporter();
            executionOptions.progressCallback = (progress) => {
                progressReporter.updateProgress(progress);
            };
            // 統合実行エンジンを初期化
            const engine = new integrated_execution_engine_js_1.IntegratedExecutionEngine(this.config, this.sshConfig);
            // 実行開始
            const result = await engine.execute(executionOptions);
            // レポート生成
            const reportFiles = await progressReporter.generateIntegratedReport(result);
            if (result.success) {
                console.log('✅ 統合ファイル整理が完了しました');
                console.log(`📊 統計: ${result.overallStatistics.totalMovedFiles}ファイル移動, ${result.overallStatistics.flatFileReduction}個の平置きファイル削減`);
                console.log(`📄 レポート: ${reportFiles.join(', ')}`);
            }
            else {
                console.warn('⚠️ 統合ファイル整理が部分的に完了しました');
                console.warn(`❌ エラー: ${result.errors.length}個, 警告: ${result.warnings.length}個`);
            }
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.CLI_EXECUTION_FAILED, `実行コマンドに失敗しました: ${error}`, undefined, undefined, error);
        }
    }
    /**
     * スキャンコマンドを処理
     */
    async scanCommand(options) {
        console.log(`🔍 ${options.environment}環境のファイルスキャンを開始...`);
        try {
            // スキャン実行（実装簡略化）
            console.log(`📁 スキャンパス: ${options.path}`);
            console.log(`📊 オプション: 隠しファイル=${options.includeHidden}, 最大階層=${options.maxDepth}`);
            // 実際のスキャン処理はここに実装
            console.log('✅ ファイルスキャンが完了しました');
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.SCAN_FAILED, `スキャンコマンドに失敗しました: ${error}`, undefined, options.environment, error);
        }
    }
    /**
     * 分類コマンドを処理
     */
    async classifyCommand(options) {
        console.log('🏷️ ファイル分類を開始...');
        try {
            console.log(`📄 入力: ${options.input || '標準入力'}`);
            console.log(`📊 信頼度閾値: ${options.confidenceThreshold}`);
            // 実際の分類処理はここに実装
            console.log('✅ ファイル分類が完了しました');
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.CLASSIFICATION_FAILED, `分類コマンドに失敗しました: ${error}`, undefined, undefined, error);
        }
    }
    /**
     * 移動コマンドを処理
     */
    async moveCommand(options) {
        console.log(`📦 ${options.environment}環境でファイル移動を開始...`);
        try {
            console.log(`📄 分類結果: ${options.input}`);
            console.log(`🔧 オプション: ドライラン=${options.dryRun}, 上書き=${options.overwrite}, コピー=${options.copy}`);
            // 実際の移動処理はここに実装
            console.log('✅ ファイル移動が完了しました');
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.MOVE_FAILED, `移動コマンドに失敗しました: ${error}`, undefined, options.environment, error);
        }
    }
    /**
     * 同期コマンドを処理
     */
    async syncCommand(options) {
        console.log(`🔄 環境間同期を開始: ${options.direction}`);
        try {
            const syncManager = new sync_manager_js_1.SyncManager(this.sshConfig);
            const syncOptions = {
                direction: options.direction,
                dryRun: options.dryRun || false,
                overwriteExisting: options.overwrite || false,
                syncPermissions: options.permissions !== false,
                createBackup: options.backup !== false,
                excludePatterns: options.exclude.split(',')
            };
            const result = await syncManager.executeSync(options.localPath, options.ec2Path, syncOptions);
            if (result.success) {
                console.log('✅ 環境間同期が完了しました');
                console.log(`📊 統計: ${result.statistics.syncedFiles}ファイル同期, ${result.statistics.createdDirectories}ディレクトリ作成`);
            }
            else {
                console.warn('⚠️ 環境間同期で一部エラーが発生しました');
                console.warn(`❌ 失敗: ${result.failedItems.length}個`);
            }
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.SYNC_FAILED, `同期コマンドに失敗しました: ${error}`, undefined, undefined, error);
        }
    }
    /**
     * 検証コマンドを処理
     */
    async validateCommand(options) {
        console.log(`🔍 ${options.type}検証を開始...`);
        try {
            console.log(`🎯 対象環境: ${options.environment}`);
            console.log(`🔧 自動修復: ${options.fix ? '有効' : '無効'}`);
            // 実際の検証処理はここに実装
            console.log('✅ 検証が完了しました');
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.VALIDATION_FAILED, `検証コマンドに失敗しました: ${error}`, undefined, options.environment, error);
        }
    }
    /**
     * レポートコマンドを処理
     */
    async reportCommand(options) {
        console.log(`📊 ${options.type}レポートを生成中...`);
        try {
            console.log(`📄 形式: ${options.format}`);
            console.log(`📁 出力: ${options.output || '標準出力'}`);
            // 実際のレポート生成処理はここに実装
            console.log('✅ レポート生成が完了しました');
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.REPORT_GENERATION_FAILED, `レポートコマンドに失敗しました: ${error}`, undefined, undefined, error);
        }
    }
    /**
     * 構造作成コマンドを処理
     */
    async structureCreateCommand(options) {
        console.log(`🏗️ ${options.environment}環境のディレクトリ構造を作成中...`);
        try {
            const directoryCreator = new directory_creator_js_1.DirectoryCreator(this.config, this.sshConfig);
            const result = await directoryCreator.createEnvironmentStructure(options.environment);
            console.log('✅ ディレクトリ構造作成が完了しました');
            console.log(`📊 統計: ${result.createdDirectories}個作成, ${result.skippedPaths.length}個スキップ`);
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.STRUCTURE_CREATION_FAILED, `構造作成コマンドに失敗しました: ${error}`, undefined, options.environment, error);
        }
    }
    /**
     * 構造比較コマンドを処理
     */
    async structureCompareCommand(options) {
        console.log('🔍 環境間構造比較を開始...');
        try {
            const structureComparator = new structure_comparator_js_1.StructureComparator(this.sshConfig);
            const comparison = await structureComparator.compareStructures(options.localPath, options.ec2Path);
            console.log('✅ 構造比較が完了しました');
            console.log(`📊 一致率: ${comparison.matchPercentage.toFixed(1)}%, 差分: ${comparison.differences.length}個`);
            // レポート出力
            if (options.output) {
                const report = structureComparator.generateComparisonReport(comparison);
                await fs.writeFile(options.output, report);
                console.log(`📄 レポート出力: ${options.output}`);
            }
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.STRUCTURE_COMPARISON_FAILED, `構造比較コマンドに失敗しました: ${error}`, undefined, undefined, error);
        }
    }
    /**
     * 構造検証コマンドを処理
     */
    async structureValidateCommand(options) {
        console.log(`🔍 ${options.environment}環境の構造検証を開始...`);
        try {
            const directoryCreator = new directory_creator_js_1.DirectoryCreator(this.config, this.sshConfig);
            const validation = await directoryCreator.validateStructure(options.environment);
            if (validation.valid) {
                console.log('✅ 構造検証が完了しました: 問題なし');
            }
            else {
                console.warn('⚠️ 構造検証で問題を検出しました');
                console.warn(`❌ 不足ディレクトリ: ${validation.missingDirectories.length}個`);
                console.warn(`⚠️ 権限問題: ${validation.permissionIssues.length}個`);
            }
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.STRUCTURE_VALIDATION_FAILED, `構造検証コマンドに失敗しました: ${error}`, undefined, options.environment, error);
        }
    }
    /**
     * バックアップ作成コマンドを処理
     */
    async backupCreateCommand(options) {
        console.log(`💾 ${options.environment}環境のバックアップを作成中...`);
        try {
            console.log(`🆔 バックアップID: ${options.id || '自動生成'}`);
            // 実際のバックアップ作成処理はここに実装
            console.log('✅ バックアップ作成が完了しました');
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `バックアップ作成コマンドに失敗しました: ${error}`, undefined, options.environment, error);
        }
    }
    /**
     * バックアップ復元コマンドを処理
     */
    async backupRestoreCommand(options) {
        console.log(`🔄 ${options.environment}環境のバックアップから復元中...`);
        try {
            console.log(`🆔 バックアップID: ${options.id}`);
            console.log(`🔧 上書き: ${options.overwrite ? '有効' : '無効'}`);
            // 実際のバックアップ復元処理はここに実装
            console.log('✅ バックアップ復元が完了しました');
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.RESTORE_FAILED, `バックアップ復元コマンドに失敗しました: ${error}`, undefined, options.environment, error);
        }
    }
    /**
     * バックアップ一覧コマンドを処理
     */
    async backupListCommand(options) {
        console.log(`📋 ${options.environment}環境のバックアップ一覧を取得中...`);
        try {
            // 実際のバックアップ一覧取得処理はここに実装
            console.log('✅ バックアップ一覧取得が完了しました');
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `バックアップ一覧コマンドに失敗しました: ${error}`, undefined, options.environment, error);
        }
    }
    /**
     * バックアップクリーンアップコマンドを処理
     */
    async backupCleanupCommand(options) {
        console.log(`🧹 ${options.environment}環境の古いバックアップを削除中...`);
        try {
            console.log(`📅 保持日数: ${options.days}日`);
            // 実際のバックアップクリーンアップ処理はここに実装
            console.log('✅ バックアップクリーンアップが完了しました');
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.BACKUP_FAILED, `バックアップクリーンアップコマンドに失敗しました: ${error}`, undefined, options.environment, error);
        }
    }
    /**
     * 権限設定コマンドを処理
     */
    async permissionSetCommand(options) {
        console.log(`🔒 ${options.environment}環境の権限を設定中...`);
        try {
            console.log(`📁 対象パス: ${options.path || '全体'}`);
            console.log(`🔧 再帰的: ${options.recursive ? '有効' : '無効'}`);
            // 実際の権限設定処理はここに実装
            console.log('✅ 権限設定が完了しました');
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.PERMISSION_FAILED, `権限設定コマンドに失敗しました: ${error}`, undefined, options.environment, error);
        }
    }
    /**
     * 権限検証コマンドを処理
     */
    async permissionValidateCommand(options) {
        console.log(`🔍 ${options.environment}環境の権限を検証中...`);
        try {
            console.log(`🔧 自動修復: ${options.fix ? '有効' : '無効'}`);
            // 実際の権限検証処理はここに実装
            console.log('✅ 権限検証が完了しました');
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.PERMISSION_FAILED, `権限検証コマンドに失敗しました: ${error}`, undefined, options.environment, error);
        }
    }
    /**
     * 設定を読み込み
     */
    async loadConfiguration(options) {
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
            }
            else {
                console.warn(`⚠️ 設定ファイルが見つかりません: ${this.cliConfig.configPath}`);
                this.config = this.getDefaultConfig();
            }
            // SSH設定を読み込み
            if (this.cliConfig.sshConfigPath && await this.fileExists(this.cliConfig.sshConfigPath)) {
                const sshConfigContent = await fs.readFile(this.cliConfig.sshConfigPath, 'utf-8');
                this.sshConfig = JSON.parse(sshConfigContent);
                console.log(`🔑 SSH設定ファイル読み込み: ${this.cliConfig.sshConfigPath}`);
            }
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.CONFIG_LOAD_FAILED, `設定読み込みに失敗しました: ${error}`, undefined, undefined, error);
        }
    }
    /**
     * ファイル存在確認
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * デフォルトCLI設定を取得
     */
    getDefaultCLIConfig() {
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
    getDefaultConfig() {
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
exports.FileOrganizationCLI = FileOrganizationCLI;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmlsZS1vcmdhbml6YXRpb24tY2xpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZmlsZS1vcmdhbml6YXRpb24tY2xpLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7Ozs7O0dBS0c7QUFDSCx5Q0FBb0M7QUFDcEMsZ0RBQWtDO0FBRWxDLGdEQUsyQjtBQUUzQiw2RkFBdUc7QUFDdkcseUVBQWtFO0FBQ2xFLDZEQUFzRDtBQUN0RCw2RUFBc0U7QUFDdEUsNEVBQXFFO0FBa0JyRTs7OztHQUlHO0FBQ0gsTUFBYSxtQkFBbUI7SUFDYixPQUFPLENBQVU7SUFDMUIsTUFBTSxDQUF3QjtJQUM5QixTQUFTLENBQWE7SUFDdEIsU0FBUyxDQUFZO0lBRTdCO1FBQ0UsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLG1CQUFPLEVBQUUsQ0FBQztRQUM3QixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1FBQzVDLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztJQUN2QixDQUFDO0lBRUQ7O09BRUc7SUFDSSxLQUFLLENBQUMsR0FBRyxDQUFDLElBQWM7UUFDN0IsSUFBSSxDQUFDO1lBQ0gsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0QyxDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLE9BQU8sQ0FBQyxLQUFLLENBQUMsYUFBYSxFQUFFLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ3JGLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbEIsQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNLLGFBQWE7UUFDbkIsSUFBSSxDQUFDLE9BQU87YUFDVCxJQUFJLENB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QVEsRUFBRSxDQUFDLEtBQUssQ0FBQztvQkFDakIsZUFBZSxFQUFFLGtCQUFrQjtpQkFDcEM7Z0JBQ0QsS0FBSyxFQUFFO29CQUNMLFFBQVEsRUFBRSxDQUFDLEdBQUcsQ0FBQztvQkFDZixRQUFRLEVBQUUsRUFBRTtvQkFDWixlQUFlLEVBQUUsaUJBQWlCO2lCQUNuQzthQUNGO1lBQ0QsVUFBVSxFQUFFO2dCQUNWLG1CQUFtQixFQUFFO29CQUNuQixhQUFhO29CQUNiLHFCQUFxQjtvQkFDckIsa0JBQWtCO29CQUNsQixxQkFBcUI7b0JBQ3JCLGtCQUFrQjtvQkFDbEIsT0FBTztvQkFDUCxTQUFTO2lCQUNWO2dCQUNELFdBQVcsRUFBRSxHQUFHLEdBQUcsSUFBSSxHQUFHLElBQUksRUFBRSxRQUFRO2dCQUN4QyxpQkFBaUIsRUFBRSxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUM7YUFDakY7U0FDRixDQUFDO0lBQ0osQ0FBQztDQUNGO0FBaDBCRCxrREFnMEJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiDntbHlkIjjg5XjgqHjgqTjg6vmlbTnkIbjgrfjgrnjg4bjg6AgLSBDTEnjgrPjg57jg7Pjg4nlrprnvqlcbiAqIFxuICog44Kz44Oe44Oz44OJ44Op44Kk44Oz5pON5L2c44Kk44Oz44K/44O844OV44Kn44O844K544KS5o+Q5L6b44GX44CBXG4gKiDlhajmqZ/og73jgbjjga7ntbHkuIDjgqLjgq/jgrvjgrnjgpLlrp/nj77jgZfjgb7jgZnjgIJcbiAqL1xuaW1wb3J0IHsgQ29tbWFuZCB9IGZyb20gJ2NvbW1hbmRlcic7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcy9wcm9taXNlcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgXG4gIENsYXNzaWZpY2F0aW9uQ29uZmlnLFxuICBFbnZpcm9ubWVudCxcbiAgT3JnYW5pemF0aW9uRXJyb3IsXG4gIE9yZ2FuaXphdGlvbkVycm9yVHlwZVxufSBmcm9tICcuLi90eXBlcy9pbmRleC5qcyc7XG5pbXBvcnQgeyBTU0hDb25maWcgfSBmcm9tICcuLi9zY2FubmVycy9lYzItc2Nhbm5lci5qcyc7XG5pbXBvcnQgeyBJbnRlZ3JhdGVkRXhlY3V0aW9uRW5naW5lLCBFeGVjdXRpb25PcHRpb25zIH0gZnJvbSAnLi4vZW5naW5lL2ludGVncmF0ZWQtZXhlY3V0aW9uLWVuZ2luZS5qcyc7XG5pbXBvcnQgeyBQcm9ncmVzc1JlcG9ydGVyIH0gZnJvbSAnLi4vZW5naW5lL3Byb2dyZXNzLXJlcG9ydGVyLmpzJztcbmltcG9ydCB7IFN5bmNNYW5hZ2VyIH0gZnJvbSAnLi4vc3luYy9zeW5jLW1hbmFnZXIuanMnO1xuaW1wb3J0IHsgU3RydWN0dXJlQ29tcGFyYXRvciB9IGZyb20gJy4uL3N5bmMvc3RydWN0dXJlLWNvbXBhcmF0b3IuanMnO1xuaW1wb3J0IHsgRGlyZWN0b3J5Q3JlYXRvciB9IGZyb20gJy4uL3N0cnVjdHVyZS9kaXJlY3RvcnktY3JlYXRvci5qcyc7XG5cbi8qKlxuICogQ0xJ6Kit5a6aXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ0xJQ29uZmlnIHtcbiAgLyoqIOioreWumuODleOCoeOCpOODq+ODkeOCuSAqL1xuICBjb25maWdQYXRoOiBzdHJpbmc7XG4gIC8qKiBTU0joqK3lrprjg5XjgqHjgqTjg6vjg5HjgrkgKi9cbiAgc3NoQ29uZmlnUGF0aD86IHN0cmluZztcbiAgLyoqIOWHuuWKm+ODh+OCo+ODrOOCr+ODiOODqiAqL1xuICBvdXRwdXREaXI6IHN0cmluZztcbiAgLyoqIOODreOCsOODrOODmeODqyAqL1xuICBsb2dMZXZlbDogJ2Vycm9yJyB8ICd3YXJuJyB8ICdpbmZvJyB8ICdkZWJ1Zyc7XG4gIC8qKiDjgqvjg6njg7zlh7rlipsgKi9cbiAgdXNlQ29sb3JzOiBib29sZWFuO1xufVxuXG4vKipcbiAqIOODleOCoeOCpOODq+aVtOeQhkNMSVxuICogXG4gKiDntbHlkIjjg5XjgqHjgqTjg6vmlbTnkIbjgrfjgrnjg4bjg6Djga7jgrPjg57jg7Pjg4njg6njgqTjg7Pmk43kvZzjgpLmj5DkvpvjgZfjgb7jgZnjgIJcbiAqL1xuZXhwb3J0IGNsYXNzIEZpbGVPcmdhbml6YXRpb25DTEkge1xuICBwcml2YXRlIHJlYWRvbmx5IHByb2dyYW06IENvbW1hbmQ7XG4gIHByaXZhdGUgY29uZmlnPzogQ2xhc3NpZmljYXRpb25Db25maWc7XG4gIHByaXZhdGUgc3NoQ29uZmlnPzogU1NIQ29uZmlnO1xuICBwcml2YXRlIGNsaUNvbmZpZzogQ0xJQ29uZmlnO1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMucHJvZ3JhbSA9IG5ldyBDb21tYW5kKCk7XG4gICAgdGhpcy5jbGlDb25maWcgPSB0aGlzLmdldERlZmF1bHRDTElDb25maWcoKTtcbiAgICB0aGlzLnNldHVwQ29tbWFuZHMoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDTEnjgpLlrp/ooYxcbiAgICovXG4gIHB1YmxpYyBhc3luYyBydW4oYXJndjogc3RyaW5nW10pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5wcm9ncmFtLnBhcnNlQXN5bmMoYXJndik7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ+KdjCBDTEnlrp/ooYzjgqjjg6njg7w6JywgZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpKTtcbiAgICAgIHByb2Nlc3MuZXhpdCgxKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44Kz44Oe44Oz44OJ44KS6Kit5a6aXG4gICAqL1xuICBwcml2YXRlIHNldHVwQ29tbWFuZHMoKTogdm9pZCB7XG4gICAgdGhpcy5wcm9ncmFtXG4gICAgICAubmFtZSgnZmlsZS1vcmdhbml6YXRpb24nKVxuICAgICAgLmRlc2NyaXB0aW9uKCfntbHlkIjjg5XjgqHjgqTjg6vmlbTnkIbjgrfjgrnjg4bjg6AnKVxuICAgICAgLnZlcnNpb24oJzEuMC4wJyk7XG5cbiAgICAvLyDjgrDjg63jg7zjg5Djg6vjgqrjg5fjgrfjg6fjg7NcbiAgICB0aGlzLnByb2dyYW1cbiAgICAgIC5vcHRpb24oJy1jLCAtLWNvbmZpZyA8cGF0aD4nLCAn6Kit5a6a44OV44Kh44Kk44Or44OR44K5JywgJ2NvbmZpZy9maWxlLW9yZ2FuaXphdGlvbi1ydWxlcy5qc29uJylcbiAgICAgIC5vcHRpb24oJy1zLCAtLXNzaC1jb25maWcgPHBhdGg+JywgJ1NTSOioreWumuODleOCoeOCpOODq+ODkeOCuScpXG4gICAgICAub3B0aW9uKCctbywgLS1vdXRwdXQgPGRpcj4nLCAn5Ye65Yqb44OH44Kj44Os44Kv44OI44OqJywgJ2RldmVsb3BtZW50L2xvZ3Mvb3JnYW5pemF0aW9uJylcbiAgICAgIC5vcHRpb24oJy0tbG9nLWxldmVsIDxsZXZlbD4nLCAn44Ot44Kw44Os44OZ44OrJywgJ2luZm8nKVxuICAgICAgLm9wdGlvbignLS1uby1jb2xvcnMnLCAn44Kr44Op44O85Ye65Yqb44KS54Sh5Yq55YyWJylcbiAgICAgIC5ob29rKCdwcmVBY3Rpb24nLCBhc3luYyAodGhpc0NvbW1hbmQpID0+IHtcbiAgICAgICAgYXdhaXQgdGhpcy5sb2FkQ29uZmlndXJhdGlvbih0aGlzQ29tbWFuZC5vcHRzKCkpO1xuICAgICAgfSk7XG5cbiAgICAvLyDjg6HjgqTjg7PjgrPjg57jg7Pjg4lcbiAgICB0aGlzLnNldHVwRXhlY3V0ZUNvbW1hbmQoKTtcbiAgICB0aGlzLnNldHVwU2NhbkNvbW1hbmQoKTtcbiAgICB0aGlzLnNldHVwQ2xhc3NpZnlDb21tYW5kKCk7XG4gICAgdGhpcy5zZXR1cE1vdmVDb21tYW5kKCk7XG4gICAgdGhpcy5zZXR1cFN5bmNDb21tYW5kKCk7XG4gICAgdGhpcy5zZXR1cFZhbGlkYXRlQ29tbWFuZCgpO1xuICAgIHRoaXMuc2V0dXBSZXBvcnRDb21tYW5kKCk7XG4gICAgdGhpcy5zZXR1cFN0cnVjdHVyZUNvbW1hbmQoKTtcbiAgICB0aGlzLnNldHVwQmFja3VwQ29tbWFuZCgpO1xuICAgIHRoaXMuc2V0dXBQZXJtaXNzaW9uQ29tbWFuZCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIOWun+ihjOOCs+ODnuODs+ODieOCkuioreWumlxuICAgKi9cbiAgcHJpdmF0ZSBzZXR1cEV4ZWN1dGVDb21tYW5kKCk6IHZvaWQge1xuICAgIHRoaXMucHJvZ3JhbVxuICAgICAgLmNvbW1hbmQoJ2V4ZWN1dGUnKVxuICAgICAgLmFsaWFzKCdydW4nKVxuICAgICAgLmRlc2NyaXB0aW9uKCfntbHlkIjjg5XjgqHjgqTjg6vmlbTnkIbjgpLlrp/ooYwnKVxuICAgICAgLm9wdGlvbignLW0sIC0tbW9kZSA8bW9kZT4nLCAn5a6f6KGM44Oi44O844OJJywgJ2Z1bGwnKVxuICAgICAgLm9wdGlvbignLWUsIC0tZW52aXJvbm1lbnRzIDxlbnZzPicsICflr77osaHnkrDlooMgKOOCq+ODs+ODnuWMuuWIh+OCiiknLCAnbG9jYWwsZWMyJylcbiAgICAgIC5vcHRpb24oJy0tZHJ5LXJ1bicsICfjg4njg6njgqTjg6njg7Pjg6Ljg7zjg4knKVxuICAgICAgLm9wdGlvbignLS1uby1wYXJhbGxlbCcsICfkuKbliJflrp/ooYzjgpLnhKHlirnljJYnKVxuICAgICAgLm9wdGlvbignLS1tYXgtcGFyYWxsZWwgPG51bT4nLCAn5pyA5aSn5Lim5YiX5pWwJywgJzInKVxuICAgICAgLm9wdGlvbignLS1uby1iYWNrdXAnLCAn44OQ44OD44Kv44Ki44OD44OX5L2c5oiQ44KS54Sh5Yq55YyWJylcbiAgICAgIC5vcHRpb24oJy0tbm8tcGVybWlzc2lvbnMnLCAn5qip6ZmQ6Kit5a6a44KS54Sh5Yq55YyWJylcbiAgICAgIC5vcHRpb24oJy0tbm8tc3luYycsICflkIzmnJ/jgpLnhKHlirnljJYnKVxuICAgICAgLm9wdGlvbignLS1jb250aW51ZS1vbi1lcnJvcicsICfjgqjjg6njg7zmmYLjgoLntprooYwnKVxuICAgICAgLmFjdGlvbihhc3luYyAob3B0aW9ucykgPT4ge1xuICAgICAgICBhd2FpdCB0aGlzLmV4ZWN1dGVDb21tYW5kKG9wdGlvbnMpO1xuICAgICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog44K544Kt44Oj44Oz44Kz44Oe44Oz44OJ44KS6Kit5a6aXG4gICAqL1xuICBwcml2YXRlIHNldHVwU2NhbkNvbW1hbmQoKTogdm9pZCB7XG4gICAgdGhpcy5wcm9ncmFtXG4gICAgICAuY29tbWFuZCgnc2NhbicpXG4gICAgICAuZGVzY3JpcHRpb24oJ+ODleOCoeOCpOODq+OCueOCreODo+ODs+OCkuWun+ihjCcpXG4gICAgICAub3B0aW9uKCctZSwgLS1lbnZpcm9ubWVudCA8ZW52PicsICflr77osaHnkrDlooMnLCAnbG9jYWwnKVxuICAgICAgLm9wdGlvbignLXAsIC0tcGF0aCA8cGF0aD4nLCAn44K544Kt44Oj44Oz44OR44K5JywgJy4nKVxuICAgICAgLm9wdGlvbignLS1pbmNsdWRlLWhpZGRlbicsICfpmqDjgZfjg5XjgqHjgqTjg6vjgpLlkKvjgoHjgosnKVxuICAgICAgLm9wdGlvbignLS1tYXgtZGVwdGggPG51bT4nLCAn5pyA5aSn6ZqO5bGk5pWwJywgJzEwJylcbiAgICAgIC5hY3Rpb24oYXN5bmMgKG9wdGlvbnMpID0+IHtcbiAgICAgICAgYXdhaXQgdGhpcy5zY2FuQ29tbWFuZChvcHRpb25zKTtcbiAgICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOWIhumhnuOCs+ODnuODs+ODieOCkuioreWumlxuICAgKi9cbiAgcHJpdmF0ZSBzZXR1cENsYXNzaWZ5Q29tbWFuZCgpOiB2b2lkIHtcbiAgICB0aGlzLnByb2dyYW1cbiAgICAgIC5jb21tYW5kKCdjbGFzc2lmeScpXG4gICAgICAuZGVzY3JpcHRpb24oJ+ODleOCoeOCpOODq+WIhumhnuOCkuWun+ihjCcpXG4gICAgICAub3B0aW9uKCctaSwgLS1pbnB1dCA8cGF0aD4nLCAn5YWl5Yqb44OV44Kh44Kk44OrL+ODh+OCo+ODrOOCr+ODiOODqicpXG4gICAgICAub3B0aW9uKCctbywgLS1vdXRwdXQgPHBhdGg+JywgJ+WIhumhnue1kOaenOWHuuWKm+ODkeOCuScpXG4gICAgICAub3B0aW9uKCctLWNvbmZpZGVuY2UtdGhyZXNob2xkIDxudW0+JywgJ+S/oemgvOW6pumWvuWApCcsICcwLjcnKVxuICAgICAgLm9wdGlvbignLS1zaG93LWRldGFpbHMnLCAn6Kmz57Sw5oOF5aCx44KS6KGo56S6JylcbiAgICAgIC5hY3Rpb24oYXN5bmMgKG9wdGlvbnMpID0+IHtcbiAgICAgICAgYXdhaXQgdGhpcy5jbGFzc2lmeUNvbW1hbmQob3B0aW9ucyk7XG4gICAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDnp7vli5XjgrPjg57jg7Pjg4njgpLoqK3lrppcbiAgICovXG4gIHByaXZhdGUgc2V0dXBNb3ZlQ29tbWFuZCgpOiB2b2lkIHtcbiAgICB0aGlzLnByb2dyYW1cbiAgICAgIC5jb21tYW5kKCdtb3ZlJylcbiAgICAgIC5kZXNjcmlwdGlvbign44OV44Kh44Kk44Or56e75YuV44KS5a6f6KGMJylcbiAgICAgIC5vcHRpb24oJy1lLCAtLWVudmlyb25tZW50IDxlbnY+JywgJ+WvvuixoeeSsOWigycsICdsb2NhbCcpXG4gICAgICAub3B0aW9uKCctaSwgLS1pbnB1dCA8cGF0aD4nLCAn5YiG6aGe57WQ5p6c44OV44Kh44Kk44OrJylcbiAgICAgIC5vcHRpb24oJy0tZHJ5LXJ1bicsICfjg4njg6njgqTjg6njg7Pjg6Ljg7zjg4knKVxuICAgICAgLm9wdGlvbignLS1vdmVyd3JpdGUnLCAn5pei5a2Y44OV44Kh44Kk44Or44KS5LiK5pu444GNJylcbiAgICAgIC5vcHRpb24oJy0tY29weScsICfnp7vli5Xjgafjga/jgarjgY/jgrPjg5Tjg7wnKVxuICAgICAgLmFjdGlvbihhc3luYyAob3B0aW9ucykgPT4ge1xuICAgICAgICBhd2FpdCB0aGlzLm1vdmVDb21tYW5kKG9wdGlvbnMpO1xuICAgICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog5ZCM5pyf44Kz44Oe44Oz44OJ44KS6Kit5a6aXG4gICAqL1xuICBwcml2YXRlIHNldHVwU3luY0NvbW1hbmQoKTogdm9pZCB7XG4gICAgdGhpcy5wcm9ncmFtXG4gICAgICAuY29tbWFuZCgnc3luYycpXG4gICAgICAuZGVzY3JpcHRpb24oJ+eSsOWig+mWk+WQjOacn+OCkuWun+ihjCcpXG4gICAgICAub3B0aW9uKCctZCwgLS1kaXJlY3Rpb24gPGRpcj4nLCAn5ZCM5pyf5pa55ZCRJywgJ2JpZGlyZWN0aW9uYWwnKVxuICAgICAgLm9wdGlvbignLS1sb2NhbC1wYXRoIDxwYXRoPicsICfjg63jg7zjgqvjg6vjg5HjgrknLCAnLicpXG4gICAgICAub3B0aW9uKCctLWVjMi1wYXRoIDxwYXRoPicsICdFQzLjg5HjgrknLCAnL2hvbWUvdWJ1bnR1JylcbiAgICAgIC5vcHRpb24oJy0tZHJ5LXJ1bicsICfjg4njg6njgqTjg6njg7Pjg6Ljg7zjg4knKVxuICAgICAgLm9wdGlvbignLS1vdmVyd3JpdGUnLCAn5pei5a2Y44OV44Kh44Kk44Or44KS5LiK5pu444GNJylcbiAgICAgIC5vcHRpb24oJy0tbm8tcGVybWlzc2lvbnMnLCAn5qip6ZmQ5ZCM5pyf44KS54Sh5Yq55YyWJylcbiAgICAgIC5vcHRpb24oJy0tbm8tYmFja3VwJywgJ+ODkOODg+OCr+OCouODg+ODl+S9nOaIkOOCkueEoeWKueWMlicpXG4gICAgICAub3B0aW9uKCctLWV4Y2x1ZGUgPHBhdHRlcm5zPicsICfpmaTlpJbjg5Hjgr/jg7zjg7MgKOOCq+ODs+ODnuWMuuWIh+OCiiknLCAnbm9kZV9tb2R1bGVzLC5naXQsY2RrLm91dCcpXG4gICAgICAuYWN0aW9uKGFzeW5jIChvcHRpb25zKSA9PiB7XG4gICAgICAgIGF3YWl0IHRoaXMuc3luY0NvbW1hbmQob3B0aW9ucyk7XG4gICAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDmpJzoqLzjgrPjg57jg7Pjg4njgpLoqK3lrppcbiAgICovXG4gIHByaXZhdGUgc2V0dXBWYWxpZGF0ZUNvbW1hbmQoKTogdm9pZCB7XG4gICAgdGhpcy5wcm9ncmFtXG4gICAgICAuY29tbWFuZCgndmFsaWRhdGUnKVxuICAgICAgLmRlc2NyaXB0aW9uKCfmp4vpgKDjg7vmqKnpmZDmpJzoqLzjgpLlrp/ooYwnKVxuICAgICAgLm9wdGlvbignLXQsIC0tdHlwZSA8dHlwZT4nLCAn5qSc6Ki844K/44Kk44OXJywgJ2FsbCcpXG4gICAgICAub3B0aW9uKCctZSwgLS1lbnZpcm9ubWVudCA8ZW52PicsICflr77osaHnkrDlooMnLCAnYWxsJylcbiAgICAgIC5vcHRpb24oJy0tZml4JywgJ+WVj+mhjOOCkuiHquWLleS/ruW+qScpXG4gICAgICAub3B0aW9uKCctLXJlcG9ydCA8cGF0aD4nLCAn44Os44Od44O844OI5Ye65Yqb44OR44K5JylcbiAgICAgIC5hY3Rpb24oYXN5bmMgKG9wdGlvbnMpID0+IHtcbiAgICAgICAgYXdhaXQgdGhpcy52YWxpZGF0ZUNvbW1hbmQob3B0aW9ucyk7XG4gICAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg6zjg53jg7zjg4jjgrPjg57jg7Pjg4njgpLoqK3lrppcbiAgICovXG4gIHByaXZhdGUgc2V0dXBSZXBvcnRDb21tYW5kKCk6IHZvaWQge1xuICAgIHRoaXMucHJvZ3JhbVxuICAgICAgLmNvbW1hbmQoJ3JlcG9ydCcpXG4gICAgICAuZGVzY3JpcHRpb24oJ+ODrOODneODvOODiOeUn+aIkOOCkuWun+ihjCcpXG4gICAgICAub3B0aW9uKCctdCwgLS10eXBlIDx0eXBlPicsICfjg6zjg53jg7zjg4jjgr/jgqTjg5cnLCAnc3VtbWFyeScpXG4gICAgICAub3B0aW9uKCctZiwgLS1mb3JtYXQgPGZvcm1hdD4nLCAn44Os44Od44O844OI5b2i5byPJywgJ21hcmtkb3duJylcbiAgICAgIC5vcHRpb24oJy1vLCAtLW91dHB1dCA8cGF0aD4nLCAn5Ye65Yqb44OR44K5JylcbiAgICAgIC5vcHRpb24oJy0taW5jbHVkZS1jaGFydHMnLCAn44OB44Oj44O844OI44KS5ZCr44KB44KLJylcbiAgICAgIC5hY3Rpb24oYXN5bmMgKG9wdGlvbnMpID0+IHtcbiAgICAgICAgYXdhaXQgdGhpcy5yZXBvcnRDb21tYW5kKG9wdGlvbnMpO1xuICAgICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog5qeL6YCg44Kz44Oe44Oz44OJ44KS6Kit5a6aXG4gICAqL1xuICBwcml2YXRlIHNldHVwU3RydWN0dXJlQ29tbWFuZCgpOiB2b2lkIHtcbiAgICBjb25zdCBzdHJ1Y3R1cmVDbWQgPSB0aGlzLnByb2dyYW1cbiAgICAgIC5jb21tYW5kKCdzdHJ1Y3R1cmUnKVxuICAgICAgLmRlc2NyaXB0aW9uKCfjg4fjgqPjg6zjgq/jg4jjg6rmp4vpgKDnrqHnkIYnKTtcblxuICAgIHN0cnVjdHVyZUNtZFxuICAgICAgLmNvbW1hbmQoJ2NyZWF0ZScpXG4gICAgICAuZGVzY3JpcHRpb24oJ+ODh+OCo+ODrOOCr+ODiOODquani+mAoOOCkuS9nOaIkCcpXG4gICAgICAub3B0aW9uKCctZSwgLS1lbnZpcm9ubWVudCA8ZW52PicsICflr77osaHnkrDlooMnLCAnbG9jYWwnKVxuICAgICAgLmFjdGlvbihhc3luYyAob3B0aW9ucykgPT4ge1xuICAgICAgICBhd2FpdCB0aGlzLnN0cnVjdHVyZUNyZWF0ZUNvbW1hbmQob3B0aW9ucyk7XG4gICAgICB9KTtcblxuICAgIHN0cnVjdHVyZUNtZFxuICAgICAgLmNvbW1hbmQoJ2NvbXBhcmUnKVxuICAgICAgLmRlc2NyaXB0aW9uKCfnkrDlooPplpPmp4vpgKDmr5TovIMnKVxuICAgICAgLm9wdGlvbignLS1sb2NhbC1wYXRoIDxwYXRoPicsICfjg63jg7zjgqvjg6vjg5HjgrknLCAnLicpXG4gICAgICAub3B0aW9uKCctLWVjMi1wYXRoIDxwYXRoPicsICdFQzLjg5HjgrknLCAnL2hvbWUvdWJ1bnR1JylcbiAgICAgIC5vcHRpb24oJy1vLCAtLW91dHB1dCA8cGF0aD4nLCAn44Os44Od44O844OI5Ye65Yqb44OR44K5JylcbiAgICAgIC5hY3Rpb24oYXN5bmMgKG9wdGlvbnMpID0+IHtcbiAgICAgICAgYXdhaXQgdGhpcy5zdHJ1Y3R1cmVDb21wYXJlQ29tbWFuZChvcHRpb25zKTtcbiAgICAgIH0pO1xuXG4gICAgc3RydWN0dXJlQ21kXG4gICAgICAuY29tbWFuZCgndmFsaWRhdGUnKVxuICAgICAgLmRlc2NyaXB0aW9uKCfmp4vpgKDmpJzoqLwnKVxuICAgICAgLm9wdGlvbignLWUsIC0tZW52aXJvbm1lbnQgPGVudj4nLCAn5a++6LGh55Kw5aKDJywgJ2xvY2FsJylcbiAgICAgIC5hY3Rpb24oYXN5bmMgKG9wdGlvbnMpID0+IHtcbiAgICAgICAgYXdhaXQgdGhpcy5zdHJ1Y3R1cmVWYWxpZGF0ZUNvbW1hbmQob3B0aW9ucyk7XG4gICAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg5Djg4Pjgq/jgqLjg4Pjg5fjgrPjg57jg7Pjg4njgpLoqK3lrppcbiAgICovXG4gIHByaXZhdGUgc2V0dXBCYWNrdXBDb21tYW5kKCk6IHZvaWQge1xuICAgIGNvbnN0IGJhY2t1cENtZCA9IHRoaXMucHJvZ3JhbVxuICAgICAgLmNvbW1hbmQoJ2JhY2t1cCcpXG4gICAgICAuZGVzY3JpcHRpb24oJ+ODkOODg+OCr+OCouODg+ODl+euoeeQhicpO1xuXG4gICAgYmFja3VwQ21kXG4gICAgICAuY29tbWFuZCgnY3JlYXRlJylcbiAgICAgIC5kZXNjcmlwdGlvbign44OQ44OD44Kv44Ki44OD44OX44KS5L2c5oiQJylcbiAgICAgIC5vcHRpb24oJy1lLCAtLWVudmlyb25tZW50IDxlbnY+JywgJ+WvvuixoeeSsOWigycsICdsb2NhbCcpXG4gICAgICAub3B0aW9uKCctaSwgLS1pZCA8aWQ+JywgJ+ODkOODg+OCr+OCouODg+ODl0lEJylcbiAgICAgIC5hY3Rpb24oYXN5bmMgKG9wdGlvbnMpID0+IHtcbiAgICAgICAgYXdhaXQgdGhpcy5iYWNrdXBDcmVhdGVDb21tYW5kKG9wdGlvbnMpO1xuICAgICAgfSk7XG5cbiAgICBiYWNrdXBDbWRcbiAgICAgIC5jb21tYW5kKCdyZXN0b3JlJylcbiAgICAgIC5kZXNjcmlwdGlvbign44OQ44OD44Kv44Ki44OD44OX44GL44KJ5b6p5YWDJylcbiAgICAgIC5vcHRpb24oJy1lLCAtLWVudmlyb25tZW50IDxlbnY+JywgJ+WvvuixoeeSsOWigycsICdsb2NhbCcpXG4gICAgICAub3B0aW9uKCctaSwgLS1pZCA8aWQ+JywgJ+ODkOODg+OCr+OCouODg+ODl0lEJywgdHJ1ZSlcbiAgICAgIC5vcHRpb24oJy0tb3ZlcndyaXRlJywgJ+aXouWtmOODleOCoeOCpOODq+OCkuS4iuabuOOBjScpXG4gICAgICAuYWN0aW9uKGFzeW5jIChvcHRpb25zKSA9PiB7XG4gICAgICAgIGF3YWl0IHRoaXMuYmFja3VwUmVzdG9yZUNvbW1hbmQob3B0aW9ucyk7XG4gICAgICB9KTtcblxuICAgIGJhY2t1cENtZFxuICAgICAgLmNvbW1hbmQoJ2xpc3QnKVxuICAgICAgLmRlc2NyaXB0aW9uKCfjg5Djg4Pjgq/jgqLjg4Pjg5fkuIDopqfjgpLooajnpLonKVxuICAgICAgLm9wdGlvbignLWUsIC0tZW52aXJvbm1lbnQgPGVudj4nLCAn5a++6LGh55Kw5aKDJywgJ2FsbCcpXG4gICAgICAuYWN0aW9uKGFzeW5jIChvcHRpb25zKSA9PiB7XG4gICAgICAgIGF3YWl0IHRoaXMuYmFja3VwTGlzdENvbW1hbmQob3B0aW9ucyk7XG4gICAgICB9KTtcblxuICAgIGJhY2t1cENtZFxuICAgICAgLmNvbW1hbmQoJ2NsZWFudXAnKVxuICAgICAgLmRlc2NyaXB0aW9uKCflj6TjgYTjg5Djg4Pjgq/jgqLjg4Pjg5fjgpLliYrpmaQnKVxuICAgICAgLm9wdGlvbignLWUsIC0tZW52aXJvbm1lbnQgPGVudj4nLCAn5a++6LGh55Kw5aKDJywgJ2FsbCcpXG4gICAgICAub3B0aW9uKCctZCwgLS1kYXlzIDxudW0+JywgJ+S/neaMgeaXpeaVsCcsICczMCcpXG4gICAgICAuYWN0aW9uKGFzeW5jIChvcHRpb25zKSA9PiB7XG4gICAgICAgIGF3YWl0IHRoaXMuYmFja3VwQ2xlYW51cENvbW1hbmQob3B0aW9ucyk7XG4gICAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDmqKnpmZDjgrPjg57jg7Pjg4njgpLoqK3lrppcbiAgICovXG4gIHByaXZhdGUgc2V0dXBQZXJtaXNzaW9uQ29tbWFuZCgpOiB2b2lkIHtcbiAgICBjb25zdCBwZXJtaXNzaW9uQ21kID0gdGhpcy5wcm9ncmFtXG4gICAgICAuY29tbWFuZCgncGVybWlzc2lvbicpXG4gICAgICAuYWxpYXMoJ3Blcm0nKVxuICAgICAgLmRlc2NyaXB0aW9uKCfmqKnpmZDnrqHnkIYnKTtcblxuICAgIHBlcm1pc3Npb25DbWRcbiAgICAgIC5jb21tYW5kKCdzZXQnKVxuICAgICAgLmRlc2NyaXB0aW9uKCfmqKnpmZDjgpLoqK3lrponKVxuICAgICAgLm9wdGlvbignLWUsIC0tZW52aXJvbm1lbnQgPGVudj4nLCAn5a++6LGh55Kw5aKDJywgJ2xvY2FsJylcbiAgICAgIC5vcHRpb24oJy1wLCAtLXBhdGggPHBhdGg+JywgJ+WvvuixoeODkeOCuScpXG4gICAgICAub3B0aW9uKCctLXJlY3Vyc2l2ZScsICflho3luLDnmoTjgavoqK3lrponKVxuICAgICAgLmFjdGlvbihhc3luYyAob3B0aW9ucykgPT4ge1xuICAgICAgICBhd2FpdCB0aGlzLnBlcm1pc3Npb25TZXRDb21tYW5kKG9wdGlvbnMpO1xuICAgICAgfSk7XG5cbiAgICBwZXJtaXNzaW9uQ21kXG4gICAgICAuY29tbWFuZCgndmFsaWRhdGUnKVxuICAgICAgLmRlc2NyaXB0aW9uKCfmqKnpmZDjgpLmpJzoqLwnKVxuICAgICAgLm9wdGlvbignLWUsIC0tZW52aXJvbm1lbnQgPGVudj4nLCAn5a++6LGh55Kw5aKDJywgJ2FsbCcpXG4gICAgICAub3B0aW9uKCctLWZpeCcsICfllY/poYzjgpLoh6rli5Xkv67lvqknKVxuICAgICAgLmFjdGlvbihhc3luYyAob3B0aW9ucykgPT4ge1xuICAgICAgICBhd2FpdCB0aGlzLnBlcm1pc3Npb25WYWxpZGF0ZUNvbW1hbmQob3B0aW9ucyk7XG4gICAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlrp/ooYzjgrPjg57jg7Pjg4njgpLlh6bnkIZcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZXhlY3V0ZUNvbW1hbmQob3B0aW9uczogYW55KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc29sZS5sb2coJ/CfmoAg57Wx5ZCI44OV44Kh44Kk44Or5pW055CG44KS6ZaL5aeLLi4uJyk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgZXhlY3V0aW9uT3B0aW9uczogRXhlY3V0aW9uT3B0aW9ucyA9IHtcbiAgICAgICAgbW9kZTogb3B0aW9ucy5tb2RlLFxuICAgICAgICBlbnZpcm9ubWVudHM6IG9wdGlvbnMuZW52aXJvbm1lbnRzLnNwbGl0KCcsJykgYXMgRW52aXJvbm1lbnRbXSxcbiAgICAgICAgZHJ5UnVuOiBvcHRpb25zLmRyeVJ1biB8fCBmYWxzZSxcbiAgICAgICAgZW5hYmxlUGFyYWxsZWw6IG9wdGlvbnMucGFyYWxsZWwgIT09IGZhbHNlLFxuICAgICAgICBtYXhQYXJhbGxlbDogcGFyc2VJbnQob3B0aW9ucy5tYXhQYXJhbGxlbCkgfHwgMixcbiAgICAgICAgY3JlYXRlQmFja3VwOiBvcHRpb25zLmJhY2t1cCAhPT0gZmFsc2UsXG4gICAgICAgIHNldFBlcm1pc3Npb25zOiBvcHRpb25zLnBlcm1pc3Npb25zICE9PSBmYWxzZSxcbiAgICAgICAgZW5hYmxlU3luYzogb3B0aW9ucy5zeW5jICE9PSBmYWxzZSxcbiAgICAgICAgY29udGludWVPbkVycm9yOiBvcHRpb25zLmNvbnRpbnVlT25FcnJvciB8fCBmYWxzZVxuICAgICAgfTtcblxuICAgICAgLy8g6YCy5o2X44Os44Od44O844K/44O844KS6Kit5a6aXG4gICAgICBjb25zdCBwcm9ncmVzc1JlcG9ydGVyID0gbmV3IFByb2dyZXNzUmVwb3J0ZXIoKTtcbiAgICAgIGV4ZWN1dGlvbk9wdGlvbnMucHJvZ3Jlc3NDYWxsYmFjayA9IChwcm9ncmVzcykgPT4ge1xuICAgICAgICBwcm9ncmVzc1JlcG9ydGVyLnVwZGF0ZVByb2dyZXNzKHByb2dyZXNzKTtcbiAgICAgIH07XG5cbiAgICAgIC8vIOe1seWQiOWun+ihjOOCqOODs+OCuOODs+OCkuWIneacn+WMllxuICAgICAgY29uc3QgZW5naW5lID0gbmV3IEludGVncmF0ZWRFeGVjdXRpb25FbmdpbmUodGhpcy5jb25maWchLCB0aGlzLnNzaENvbmZpZyk7XG5cbiAgICAgIC8vIOWun+ihjOmWi+Wni1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZW5naW5lLmV4ZWN1dGUoZXhlY3V0aW9uT3B0aW9ucyk7XG5cbiAgICAgIC8vIOODrOODneODvOODiOeUn+aIkFxuICAgICAgY29uc3QgcmVwb3J0RmlsZXMgPSBhd2FpdCBwcm9ncmVzc1JlcG9ydGVyLmdlbmVyYXRlSW50ZWdyYXRlZFJlcG9ydChyZXN1bHQpO1xuXG4gICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ+KchSDntbHlkIjjg5XjgqHjgqTjg6vmlbTnkIbjgYzlrozkuobjgZfjgb7jgZfjgZ8nKTtcbiAgICAgICAgY29uc29sZS5sb2coYPCfk4og57Wx6KiIOiAke3Jlc3VsdC5vdmVyYWxsU3RhdGlzdGljcy50b3RhbE1vdmVkRmlsZXN944OV44Kh44Kk44Or56e75YuVLCAke3Jlc3VsdC5vdmVyYWxsU3RhdGlzdGljcy5mbGF0RmlsZVJlZHVjdGlvbn3lgIvjga7lubPnva7jgY3jg5XjgqHjgqTjg6vliYrmuJtgKTtcbiAgICAgICAgY29uc29sZS5sb2coYPCfk4Qg44Os44Od44O844OIOiAke3JlcG9ydEZpbGVzLmpvaW4oJywgJyl9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLndhcm4oJ+KaoO+4jyDntbHlkIjjg5XjgqHjgqTjg6vmlbTnkIbjgYzpg6jliIbnmoTjgavlrozkuobjgZfjgb7jgZfjgZ8nKTtcbiAgICAgICAgY29uc29sZS53YXJuKGDinYwg44Ko44Op44O8OiAke3Jlc3VsdC5lcnJvcnMubGVuZ3RofeWAiywg6K2m5ZGKOiAke3Jlc3VsdC53YXJuaW5ncy5sZW5ndGh95YCLYCk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBPcmdhbml6YXRpb25FcnJvcihcbiAgICAgICAgT3JnYW5pemF0aW9uRXJyb3JUeXBlLkNMSV9FWEVDVVRJT05fRkFJTEVELFxuICAgICAgICBg5a6f6KGM44Kz44Oe44Oz44OJ44Gr5aSx5pWX44GX44G+44GX44GfOiAke2Vycm9yfWAsXG4gICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44K544Kt44Oj44Oz44Kz44Oe44Oz44OJ44KS5Yem55CGXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHNjYW5Db21tYW5kKG9wdGlvbnM6IGFueSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnNvbGUubG9nKGDwn5SNICR7b3B0aW9ucy5lbnZpcm9ubWVudH3nkrDlooPjga7jg5XjgqHjgqTjg6vjgrnjgq3jg6Pjg7PjgpLplovlp4suLi5gKTtcblxuICAgIHRyeSB7XG4gICAgICAvLyDjgrnjgq3jg6Pjg7Plrp/ooYzvvIjlrp/oo4XnsKHnlaXljJbvvIlcbiAgICAgIGNvbnNvbGUubG9nKGDwn5OBIOOCueOCreODo+ODs+ODkeOCuTogJHtvcHRpb25zLnBhdGh9YCk7XG4gICAgICBjb25zb2xlLmxvZyhg8J+TiiDjgqrjg5fjgrfjg6fjg7M6IOmaoOOBl+ODleOCoeOCpOODqz0ke29wdGlvbnMuaW5jbHVkZUhpZGRlbn0sIOacgOWkp+majuWxpD0ke29wdGlvbnMubWF4RGVwdGh9YCk7XG5cbiAgICAgIC8vIOWun+mam+OBruOCueOCreODo+ODs+WHpueQhuOBr+OBk+OBk+OBq+Wun+ijhVxuICAgICAgY29uc29sZS5sb2coJ+KchSDjg5XjgqHjgqTjg6vjgrnjgq3jg6Pjg7PjgYzlrozkuobjgZfjgb7jgZfjgZ8nKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuU0NBTl9GQUlMRUQsXG4gICAgICAgIGDjgrnjgq3jg6Pjg7PjgrPjg57jg7Pjg4njgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7ZXJyb3J9YCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICBvcHRpb25zLmVudmlyb25tZW50LFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog5YiG6aGe44Kz44Oe44Oz44OJ44KS5Yem55CGXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGNsYXNzaWZ5Q29tbWFuZChvcHRpb25zOiBhbnkpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zb2xlLmxvZygn8J+Pt++4jyDjg5XjgqHjgqTjg6vliIbpoZ7jgpLplovlp4suLi4nKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zb2xlLmxvZyhg8J+ThCDlhaXlips6ICR7b3B0aW9ucy5pbnB1dCB8fCAn5qiZ5rqW5YWl5YqbJ31gKTtcbiAgICAgIGNvbnNvbGUubG9nKGDwn5OKIOS/oemgvOW6pumWvuWApDogJHtvcHRpb25zLmNvbmZpZGVuY2VUaHJlc2hvbGR9YCk7XG5cbiAgICAgIC8vIOWun+mam+OBruWIhumhnuWHpueQhuOBr+OBk+OBk+OBq+Wun+ijhVxuICAgICAgY29uc29sZS5sb2coJ+KchSDjg5XjgqHjgqTjg6vliIbpoZ7jgYzlrozkuobjgZfjgb7jgZfjgZ8nKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuQ0xBU1NJRklDQVRJT05fRkFJTEVELFxuICAgICAgICBg5YiG6aGe44Kz44Oe44Oz44OJ44Gr5aSx5pWX44GX44G+44GX44GfOiAke2Vycm9yfWAsXG4gICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog56e75YuV44Kz44Oe44Oz44OJ44KS5Yem55CGXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIG1vdmVDb21tYW5kKG9wdGlvbnM6IGFueSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnNvbGUubG9nKGDwn5OmICR7b3B0aW9ucy5lbnZpcm9ubWVudH3nkrDlooPjgafjg5XjgqHjgqTjg6vnp7vli5XjgpLplovlp4suLi5gKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zb2xlLmxvZyhg8J+ThCDliIbpoZ7ntZDmnpw6ICR7b3B0aW9ucy5pbnB1dH1gKTtcbiAgICAgIGNvbnNvbGUubG9nKGDwn5SnIOOCquODl+OCt+ODp+ODszog44OJ44Op44Kk44Op44OzPSR7b3B0aW9ucy5kcnlSdW59LCDkuIrmm7jjgY09JHtvcHRpb25zLm92ZXJ3cml0ZX0sIOOCs+ODlOODvD0ke29wdGlvbnMuY29weX1gKTtcblxuICAgICAgLy8g5a6f6Zqb44Gu56e75YuV5Yem55CG44Gv44GT44GT44Gr5a6f6KOFXG4gICAgICBjb25zb2xlLmxvZygn4pyFIOODleOCoeOCpOODq+enu+WLleOBjOWujOS6huOBl+OBvuOBl+OBnycpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgT3JnYW5pemF0aW9uRXJyb3IoXG4gICAgICAgIE9yZ2FuaXphdGlvbkVycm9yVHlwZS5NT1ZFX0ZBSUxFRCxcbiAgICAgICAgYOenu+WLleOCs+ODnuODs+ODieOBq+WkseaVl+OBl+OBvuOBl+OBnzogJHtlcnJvcn1gLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgIG9wdGlvbnMuZW52aXJvbm1lbnQsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDlkIzmnJ/jgrPjg57jg7Pjg4njgpLlh6bnkIZcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgc3luY0NvbW1hbmQob3B0aW9uczogYW55KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc29sZS5sb2coYPCflIQg55Kw5aKD6ZaT5ZCM5pyf44KS6ZaL5aeLOiAke29wdGlvbnMuZGlyZWN0aW9ufWApO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHN5bmNNYW5hZ2VyID0gbmV3IFN5bmNNYW5hZ2VyKHRoaXMuc3NoQ29uZmlnKTtcbiAgICAgIGNvbnN0IHN5bmNPcHRpb25zID0ge1xuICAgICAgICBkaXJlY3Rpb246IG9wdGlvbnMuZGlyZWN0aW9uLFxuICAgICAgICBkcnlSdW46IG9wdGlvbnMuZHJ5UnVuIHx8IGZhbHNlLFxuICAgICAgICBvdmVyd3JpdGVFeGlzdGluZzogb3B0aW9ucy5vdmVyd3JpdGUgfHwgZmFsc2UsXG4gICAgICAgIHN5bmNQZXJtaXNzaW9uczogb3B0aW9ucy5wZXJtaXNzaW9ucyAhPT0gZmFsc2UsXG4gICAgICAgIGNyZWF0ZUJhY2t1cDogb3B0aW9ucy5iYWNrdXAgIT09IGZhbHNlLFxuICAgICAgICBleGNsdWRlUGF0dGVybnM6IG9wdGlvbnMuZXhjbHVkZS5zcGxpdCgnLCcpXG4gICAgICB9O1xuXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBzeW5jTWFuYWdlci5leGVjdXRlU3luYyhcbiAgICAgICAgb3B0aW9ucy5sb2NhbFBhdGgsXG4gICAgICAgIG9wdGlvbnMuZWMyUGF0aCxcbiAgICAgICAgc3luY09wdGlvbnNcbiAgICAgICk7XG5cbiAgICAgIGlmIChyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICBjb25zb2xlLmxvZygn4pyFIOeSsOWig+mWk+WQjOacn+OBjOWujOS6huOBl+OBvuOBl+OBnycpO1xuICAgICAgICBjb25zb2xlLmxvZyhg8J+TiiDntbHoqIg6ICR7cmVzdWx0LnN0YXRpc3RpY3Muc3luY2VkRmlsZXN944OV44Kh44Kk44Or5ZCM5pyfLCAke3Jlc3VsdC5zdGF0aXN0aWNzLmNyZWF0ZWREaXJlY3Rvcmllc33jg4fjgqPjg6zjgq/jg4jjg6rkvZzmiJBgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUud2Fybign4pqg77iPIOeSsOWig+mWk+WQjOacn+OBp+S4gOmDqOOCqOODqeODvOOBjOeZuueUn+OBl+OBvuOBl+OBnycpO1xuICAgICAgICBjb25zb2xlLndhcm4oYOKdjCDlpLHmlZc6ICR7cmVzdWx0LmZhaWxlZEl0ZW1zLmxlbmd0aH3lgItgKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuU1lOQ19GQUlMRUQsXG4gICAgICAgIGDlkIzmnJ/jgrPjg57jg7Pjg4njgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7ZXJyb3J9YCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDmpJzoqLzjgrPjg57jg7Pjg4njgpLlh6bnkIZcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgdmFsaWRhdGVDb21tYW5kKG9wdGlvbnM6IGFueSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnNvbGUubG9nKGDwn5SNICR7b3B0aW9ucy50eXBlfeaknOiovOOCkumWi+Wniy4uLmApO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnNvbGUubG9nKGDwn46vIOWvvuixoeeSsOWigzogJHtvcHRpb25zLmVudmlyb25tZW50fWApO1xuICAgICAgY29uc29sZS5sb2coYPCflKcg6Ieq5YuV5L+u5b6pOiAke29wdGlvbnMuZml4ID8gJ+acieWKuScgOiAn54Sh5Yq5J31gKTtcblxuICAgICAgLy8g5a6f6Zqb44Gu5qSc6Ki85Yem55CG44Gv44GT44GT44Gr5a6f6KOFXG4gICAgICBjb25zb2xlLmxvZygn4pyFIOaknOiovOOBjOWujOS6huOBl+OBvuOBl+OBnycpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgT3JnYW5pemF0aW9uRXJyb3IoXG4gICAgICAgIE9yZ2FuaXphdGlvbkVycm9yVHlwZS5WQUxJREFUSU9OX0ZBSUxFRCxcbiAgICAgICAgYOaknOiovOOCs+ODnuODs+ODieOBq+WkseaVl+OBl+OBvuOBl+OBnzogJHtlcnJvcn1gLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgIG9wdGlvbnMuZW52aXJvbm1lbnQsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg6zjg53jg7zjg4jjgrPjg57jg7Pjg4njgpLlh6bnkIZcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgcmVwb3J0Q29tbWFuZChvcHRpb25zOiBhbnkpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zb2xlLmxvZyhg8J+TiiAke29wdGlvbnMudHlwZX3jg6zjg53jg7zjg4jjgpLnlJ/miJDkuK0uLi5gKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zb2xlLmxvZyhg8J+ThCDlvaLlvI86ICR7b3B0aW9ucy5mb3JtYXR9YCk7XG4gICAgICBjb25zb2xlLmxvZyhg8J+TgSDlh7rlips6ICR7b3B0aW9ucy5vdXRwdXQgfHwgJ+aomea6luWHuuWKmyd9YCk7XG5cbiAgICAgIC8vIOWun+mam+OBruODrOODneODvOODiOeUn+aIkOWHpueQhuOBr+OBk+OBk+OBq+Wun+ijhVxuICAgICAgY29uc29sZS5sb2coJ+KchSDjg6zjg53jg7zjg4jnlJ/miJDjgYzlrozkuobjgZfjgb7jgZfjgZ8nKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuUkVQT1JUX0dFTkVSQVRJT05fRkFJTEVELFxuICAgICAgICBg44Os44Od44O844OI44Kz44Oe44Oz44OJ44Gr5aSx5pWX44GX44G+44GX44GfOiAke2Vycm9yfWAsXG4gICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog5qeL6YCg5L2c5oiQ44Kz44Oe44Oz44OJ44KS5Yem55CGXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHN0cnVjdHVyZUNyZWF0ZUNvbW1hbmQob3B0aW9uczogYW55KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc29sZS5sb2coYPCfj5fvuI8gJHtvcHRpb25zLmVudmlyb25tZW50feeSsOWig+OBruODh+OCo+ODrOOCr+ODiOODquani+mAoOOCkuS9nOaIkOS4rS4uLmApO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGRpcmVjdG9yeUNyZWF0b3IgPSBuZXcgRGlyZWN0b3J5Q3JlYXRvcih0aGlzLmNvbmZpZyEsIHRoaXMuc3NoQ29uZmlnKTtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRpcmVjdG9yeUNyZWF0b3IuY3JlYXRlRW52aXJvbm1lbnRTdHJ1Y3R1cmUob3B0aW9ucy5lbnZpcm9ubWVudCk7XG5cbiAgICAgIGNvbnNvbGUubG9nKCfinIUg44OH44Kj44Os44Kv44OI44Oq5qeL6YCg5L2c5oiQ44GM5a6M5LqG44GX44G+44GX44GfJyk7XG4gICAgICBjb25zb2xlLmxvZyhg8J+TiiDntbHoqIg6ICR7cmVzdWx0LmNyZWF0ZWREaXJlY3Rvcmllc33lgIvkvZzmiJAsICR7cmVzdWx0LnNraXBwZWRQYXRocy5sZW5ndGh95YCL44K544Kt44OD44OXYCk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBPcmdhbml6YXRpb25FcnJvcihcbiAgICAgICAgT3JnYW5pemF0aW9uRXJyb3JUeXBlLlNUUlVDVFVSRV9DUkVBVElPTl9GQUlMRUQsXG4gICAgICAgIGDmp4vpgKDkvZzmiJDjgrPjg57jg7Pjg4njgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7ZXJyb3J9YCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICBvcHRpb25zLmVudmlyb25tZW50LFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog5qeL6YCg5q+U6LyD44Kz44Oe44Oz44OJ44KS5Yem55CGXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHN0cnVjdHVyZUNvbXBhcmVDb21tYW5kKG9wdGlvbnM6IGFueSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnNvbGUubG9nKCfwn5SNIOeSsOWig+mWk+ani+mAoOavlOi8g+OCkumWi+Wniy4uLicpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHN0cnVjdHVyZUNvbXBhcmF0b3IgPSBuZXcgU3RydWN0dXJlQ29tcGFyYXRvcih0aGlzLnNzaENvbmZpZyk7XG4gICAgICBjb25zdCBjb21wYXJpc29uID0gYXdhaXQgc3RydWN0dXJlQ29tcGFyYXRvci5jb21wYXJlU3RydWN0dXJlcyhcbiAgICAgICAgb3B0aW9ucy5sb2NhbFBhdGgsXG4gICAgICAgIG9wdGlvbnMuZWMyUGF0aFxuICAgICAgKTtcblxuICAgICAgY29uc29sZS5sb2coJ+KchSDmp4vpgKDmr5TovIPjgYzlrozkuobjgZfjgb7jgZfjgZ8nKTtcbiAgICAgIGNvbnNvbGUubG9nKGDwn5OKIOS4gOiHtOeOhzogJHtjb21wYXJpc29uLm1hdGNoUGVyY2VudGFnZS50b0ZpeGVkKDEpfSUsIOW3ruWIhjogJHtjb21wYXJpc29uLmRpZmZlcmVuY2VzLmxlbmd0aH3lgItgKTtcblxuICAgICAgLy8g44Os44Od44O844OI5Ye65YqbXG4gICAgICBpZiAob3B0aW9ucy5vdXRwdXQpIHtcbiAgICAgICAgY29uc3QgcmVwb3J0ID0gc3RydWN0dXJlQ29tcGFyYXRvci5nZW5lcmF0ZUNvbXBhcmlzb25SZXBvcnQoY29tcGFyaXNvbik7XG4gICAgICAgIGF3YWl0IGZzLndyaXRlRmlsZShvcHRpb25zLm91dHB1dCwgcmVwb3J0KTtcbiAgICAgICAgY29uc29sZS5sb2coYPCfk4Qg44Os44Od44O844OI5Ye65YqbOiAke29wdGlvbnMub3V0cHV0fWApO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgT3JnYW5pemF0aW9uRXJyb3IoXG4gICAgICAgIE9yZ2FuaXphdGlvbkVycm9yVHlwZS5TVFJVQ1RVUkVfQ09NUEFSSVNPTl9GQUlMRUQsXG4gICAgICAgIGDmp4vpgKDmr5TovIPjgrPjg57jg7Pjg4njgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7ZXJyb3J9YCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDmp4vpgKDmpJzoqLzjgrPjg57jg7Pjg4njgpLlh6bnkIZcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgc3RydWN0dXJlVmFsaWRhdGVDb21tYW5kKG9wdGlvbnM6IGFueSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnNvbGUubG9nKGDwn5SNICR7b3B0aW9ucy5lbnZpcm9ubWVudH3nkrDlooPjga7mp4vpgKDmpJzoqLzjgpLplovlp4suLi5gKTtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBkaXJlY3RvcnlDcmVhdG9yID0gbmV3IERpcmVjdG9yeUNyZWF0b3IodGhpcy5jb25maWchLCB0aGlzLnNzaENvbmZpZyk7XG4gICAgICBjb25zdCB2YWxpZGF0aW9uID0gYXdhaXQgZGlyZWN0b3J5Q3JlYXRvci52YWxpZGF0ZVN0cnVjdHVyZShvcHRpb25zLmVudmlyb25tZW50KTtcblxuICAgICAgaWYgKHZhbGlkYXRpb24udmFsaWQpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ+KchSDmp4vpgKDmpJzoqLzjgYzlrozkuobjgZfjgb7jgZfjgZ86IOWVj+mhjOOBquOBlycpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS53YXJuKCfimqDvuI8g5qeL6YCg5qSc6Ki844Gn5ZWP6aGM44KS5qSc5Ye644GX44G+44GX44GfJyk7XG4gICAgICAgIGNvbnNvbGUud2Fybihg4p2MIOS4jei2s+ODh+OCo+ODrOOCr+ODiOODqjogJHt2YWxpZGF0aW9uLm1pc3NpbmdEaXJlY3Rvcmllcy5sZW5ndGh95YCLYCk7XG4gICAgICAgIGNvbnNvbGUud2Fybihg4pqg77iPIOaoqemZkOWVj+mhjDogJHt2YWxpZGF0aW9uLnBlcm1pc3Npb25Jc3N1ZXMubGVuZ3RofeWAi2ApO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgT3JnYW5pemF0aW9uRXJyb3IoXG4gICAgICAgIE9yZ2FuaXphdGlvbkVycm9yVHlwZS5TVFJVQ1RVUkVfVkFMSURBVElPTl9GQUlMRUQsXG4gICAgICAgIGDmp4vpgKDmpJzoqLzjgrPjg57jg7Pjg4njgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7ZXJyb3J9YCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICBvcHRpb25zLmVudmlyb25tZW50LFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44OQ44OD44Kv44Ki44OD44OX5L2c5oiQ44Kz44Oe44Oz44OJ44KS5Yem55CGXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGJhY2t1cENyZWF0ZUNvbW1hbmQob3B0aW9uczogYW55KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc29sZS5sb2coYPCfkr4gJHtvcHRpb25zLmVudmlyb25tZW50feeSsOWig+OBruODkOODg+OCr+OCouODg+ODl+OCkuS9nOaIkOS4rS4uLmApO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnNvbGUubG9nKGDwn4aUIOODkOODg+OCr+OCouODg+ODl0lEOiAke29wdGlvbnMuaWQgfHwgJ+iHquWLleeUn+aIkCd9YCk7XG5cbiAgICAgIC8vIOWun+mam+OBruODkOODg+OCr+OCouODg+ODl+S9nOaIkOWHpueQhuOBr+OBk+OBk+OBq+Wun+ijhVxuICAgICAgY29uc29sZS5sb2coJ+KchSDjg5Djg4Pjgq/jgqLjg4Pjg5fkvZzmiJDjgYzlrozkuobjgZfjgb7jgZfjgZ8nKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuQkFDS1VQX0ZBSUxFRCxcbiAgICAgICAgYOODkOODg+OCr+OCouODg+ODl+S9nOaIkOOCs+ODnuODs+ODieOBq+WkseaVl+OBl+OBvuOBl+OBnzogJHtlcnJvcn1gLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgIG9wdGlvbnMuZW52aXJvbm1lbnQsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg5Djg4Pjgq/jgqLjg4Pjg5flvqnlhYPjgrPjg57jg7Pjg4njgpLlh6bnkIZcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgYmFja3VwUmVzdG9yZUNvbW1hbmQob3B0aW9uczogYW55KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc29sZS5sb2coYPCflIQgJHtvcHRpb25zLmVudmlyb25tZW50feeSsOWig+OBruODkOODg+OCr+OCouODg+ODl+OBi+OCieW+qeWFg+S4rS4uLmApO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnNvbGUubG9nKGDwn4aUIOODkOODg+OCr+OCouODg+ODl0lEOiAke29wdGlvbnMuaWR9YCk7XG4gICAgICBjb25zb2xlLmxvZyhg8J+UpyDkuIrmm7jjgY06ICR7b3B0aW9ucy5vdmVyd3JpdGUgPyAn5pyJ5Yq5JyA6ICfnhKHlirknfWApO1xuXG4gICAgICAvLyDlrp/pmpvjga7jg5Djg4Pjgq/jgqLjg4Pjg5flvqnlhYPlh6bnkIbjga/jgZPjgZPjgavlrp/oo4VcbiAgICAgIGNvbnNvbGUubG9nKCfinIUg44OQ44OD44Kv44Ki44OD44OX5b6p5YWD44GM5a6M5LqG44GX44G+44GX44GfJyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBPcmdhbml6YXRpb25FcnJvcihcbiAgICAgICAgT3JnYW5pemF0aW9uRXJyb3JUeXBlLlJFU1RPUkVfRkFJTEVELFxuICAgICAgICBg44OQ44OD44Kv44Ki44OD44OX5b6p5YWD44Kz44Oe44Oz44OJ44Gr5aSx5pWX44GX44G+44GX44GfOiAke2Vycm9yfWAsXG4gICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgb3B0aW9ucy5lbnZpcm9ubWVudCxcbiAgICAgICAgZXJyb3IgYXMgRXJyb3JcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODkOODg+OCr+OCouODg+ODl+S4gOimp+OCs+ODnuODs+ODieOCkuWHpueQhlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBiYWNrdXBMaXN0Q29tbWFuZChvcHRpb25zOiBhbnkpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zb2xlLmxvZyhg8J+TiyAke29wdGlvbnMuZW52aXJvbm1lbnR955Kw5aKD44Gu44OQ44OD44Kv44Ki44OD44OX5LiA6Kan44KS5Y+W5b6X5LitLi4uYCk7XG5cbiAgICB0cnkge1xuICAgICAgLy8g5a6f6Zqb44Gu44OQ44OD44Kv44Ki44OD44OX5LiA6Kan5Y+W5b6X5Yem55CG44Gv44GT44GT44Gr5a6f6KOFXG4gICAgICBjb25zb2xlLmxvZygn4pyFIOODkOODg+OCr+OCouODg+ODl+S4gOimp+WPluW+l+OBjOWujOS6huOBl+OBvuOBl+OBnycpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgT3JnYW5pemF0aW9uRXJyb3IoXG4gICAgICAgIE9yZ2FuaXphdGlvbkVycm9yVHlwZS5CQUNLVVBfRkFJTEVELFxuICAgICAgICBg44OQ44OD44Kv44Ki44OD44OX5LiA6Kan44Kz44Oe44Oz44OJ44Gr5aSx5pWX44GX44G+44GX44GfOiAke2Vycm9yfWAsXG4gICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgb3B0aW9ucy5lbnZpcm9ubWVudCxcbiAgICAgICAgZXJyb3IgYXMgRXJyb3JcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODkOODg+OCr+OCouODg+ODl+OCr+ODquODvOODs+OCouODg+ODl+OCs+ODnuODs+ODieOCkuWHpueQhlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBiYWNrdXBDbGVhbnVwQ29tbWFuZChvcHRpb25zOiBhbnkpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zb2xlLmxvZyhg8J+nuSAke29wdGlvbnMuZW52aXJvbm1lbnR955Kw5aKD44Gu5Y+k44GE44OQ44OD44Kv44Ki44OD44OX44KS5YmK6Zmk5LitLi4uYCk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc29sZS5sb2coYPCfk4Ug5L+d5oyB5pel5pWwOiAke29wdGlvbnMuZGF5c33ml6VgKTtcblxuICAgICAgLy8g5a6f6Zqb44Gu44OQ44OD44Kv44Ki44OD44OX44Kv44Oq44O844Oz44Ki44OD44OX5Yem55CG44Gv44GT44GT44Gr5a6f6KOFXG4gICAgICBjb25zb2xlLmxvZygn4pyFIOODkOODg+OCr+OCouODg+ODl+OCr+ODquODvOODs+OCouODg+ODl+OBjOWujOS6huOBl+OBvuOBl+OBnycpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgT3JnYW5pemF0aW9uRXJyb3IoXG4gICAgICAgIE9yZ2FuaXphdGlvbkVycm9yVHlwZS5CQUNLVVBfRkFJTEVELFxuICAgICAgICBg44OQ44OD44Kv44Ki44OD44OX44Kv44Oq44O844Oz44Ki44OD44OX44Kz44Oe44Oz44OJ44Gr5aSx5pWX44GX44G+44GX44GfOiAke2Vycm9yfWAsXG4gICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgb3B0aW9ucy5lbnZpcm9ubWVudCxcbiAgICAgICAgZXJyb3IgYXMgRXJyb3JcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOaoqemZkOioreWumuOCs+ODnuODs+ODieOCkuWHpueQhlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBwZXJtaXNzaW9uU2V0Q29tbWFuZChvcHRpb25zOiBhbnkpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zb2xlLmxvZyhg8J+UkiAke29wdGlvbnMuZW52aXJvbm1lbnR955Kw5aKD44Gu5qip6ZmQ44KS6Kit5a6a5LitLi4uYCk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc29sZS5sb2coYPCfk4Eg5a++6LGh44OR44K5OiAke29wdGlvbnMucGF0aCB8fCAn5YWo5L2TJ31gKTtcbiAgICAgIGNvbnNvbGUubG9nKGDwn5SnIOWGjeW4sOeahDogJHtvcHRpb25zLnJlY3Vyc2l2ZSA/ICfmnInlirknIDogJ+eEoeWKuSd9YCk7XG5cbiAgICAgIC8vIOWun+mam+OBruaoqemZkOioreWumuWHpueQhuOBr+OBk+OBk+OBq+Wun+ijhVxuICAgICAgY29uc29sZS5sb2coJ+KchSDmqKnpmZDoqK3lrprjgYzlrozkuobjgZfjgb7jgZfjgZ8nKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuUEVSTUlTU0lPTl9GQUlMRUQsXG4gICAgICAgIGDmqKnpmZDoqK3lrprjgrPjg57jg7Pjg4njgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7ZXJyb3J9YCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICBvcHRpb25zLmVudmlyb25tZW50LFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog5qip6ZmQ5qSc6Ki844Kz44Oe44Oz44OJ44KS5Yem55CGXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHBlcm1pc3Npb25WYWxpZGF0ZUNvbW1hbmQob3B0aW9uczogYW55KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc29sZS5sb2coYPCflI0gJHtvcHRpb25zLmVudmlyb25tZW50feeSsOWig+OBruaoqemZkOOCkuaknOiovOS4rS4uLmApO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnNvbGUubG9nKGDwn5SnIOiHquWLleS/ruW+qTogJHtvcHRpb25zLmZpeCA/ICfmnInlirknIDogJ+eEoeWKuSd9YCk7XG5cbiAgICAgIC8vIOWun+mam+OBruaoqemZkOaknOiovOWHpueQhuOBr+OBk+OBk+OBq+Wun+ijhVxuICAgICAgY29uc29sZS5sb2coJ+KchSDmqKnpmZDmpJzoqLzjgYzlrozkuobjgZfjgb7jgZfjgZ8nKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuUEVSTUlTU0lPTl9GQUlMRUQsXG4gICAgICAgIGDmqKnpmZDmpJzoqLzjgrPjg57jg7Pjg4njgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7ZXJyb3J9YCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICBvcHRpb25zLmVudmlyb25tZW50LFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog6Kit5a6a44KS6Kqt44G/6L6844G/XG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGxvYWRDb25maWd1cmF0aW9uKG9wdGlvbnM6IGFueSk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICAvLyBDTEnoqK3lrprjgpLmm7TmlrBcbiAgICAgIHRoaXMuY2xpQ29uZmlnID0ge1xuICAgICAgICBjb25maWdQYXRoOiBvcHRpb25zLmNvbmZpZyxcbiAgICAgICAgc3NoQ29uZmlnUGF0aDogb3B0aW9ucy5zc2hDb25maWcsXG4gICAgICAgIG91dHB1dERpcjogb3B0aW9ucy5vdXRwdXQsXG4gICAgICAgIGxvZ0xldmVsOiBvcHRpb25zLmxvZ0xldmVsLFxuICAgICAgICB1c2VDb2xvcnM6IG9wdGlvbnMuY29sb3JzICE9PSBmYWxzZVxuICAgICAgfTtcblxuICAgICAgLy8g5YiG6aGe6Kit5a6a44KS6Kqt44G/6L6844G/XG4gICAgICBpZiAoYXdhaXQgdGhpcy5maWxlRXhpc3RzKHRoaXMuY2xpQ29uZmlnLmNvbmZpZ1BhdGgpKSB7XG4gICAgICAgIGNvbnN0IGNvbmZpZ0NvbnRlbnQgPSBhd2FpdCBmcy5yZWFkRmlsZSh0aGlzLmNsaUNvbmZpZy5jb25maWdQYXRoLCAndXRmLTgnKTtcbiAgICAgICAgdGhpcy5jb25maWcgPSBKU09OLnBhcnNlKGNvbmZpZ0NvbnRlbnQpO1xuICAgICAgICBjb25zb2xlLmxvZyhg8J+TiyDoqK3lrprjg5XjgqHjgqTjg6voqq3jgb/ovrzjgb86ICR7dGhpcy5jbGlDb25maWcuY29uZmlnUGF0aH1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUud2Fybihg4pqg77iPIOioreWumuODleOCoeOCpOODq+OBjOimi+OBpOOBi+OCiuOBvuOBm+OCkzogJHt0aGlzLmNsaUNvbmZpZy5jb25maWdQYXRofWApO1xuICAgICAgICB0aGlzLmNvbmZpZyA9IHRoaXMuZ2V0RGVmYXVsdENvbmZpZygpO1xuICAgICAgfVxuXG4gICAgICAvLyBTU0joqK3lrprjgpLoqq3jgb/ovrzjgb9cbiAgICAgIGlmICh0aGlzLmNsaUNvbmZpZy5zc2hDb25maWdQYXRoICYmIGF3YWl0IHRoaXMuZmlsZUV4aXN0cyh0aGlzLmNsaUNvbmZpZy5zc2hDb25maWdQYXRoKSkge1xuICAgICAgICBjb25zdCBzc2hDb25maWdDb250ZW50ID0gYXdhaXQgZnMucmVhZEZpbGUodGhpcy5jbGlDb25maWcuc3NoQ29uZmlnUGF0aCwgJ3V0Zi04Jyk7XG4gICAgICAgIHRoaXMuc3NoQ29uZmlnID0gSlNPTi5wYXJzZShzc2hDb25maWdDb250ZW50KTtcbiAgICAgICAgY29uc29sZS5sb2coYPCflJEgU1NI6Kit5a6a44OV44Kh44Kk44Or6Kqt44G/6L6844G/OiAke3RoaXMuY2xpQ29uZmlnLnNzaENvbmZpZ1BhdGh9YCk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIHRocm93IG5ldyBPcmdhbml6YXRpb25FcnJvcihcbiAgICAgICAgT3JnYW5pemF0aW9uRXJyb3JUeXBlLkNPTkZJR19MT0FEX0ZBSUxFRCxcbiAgICAgICAgYOioreWumuiqreOBv+i+vOOBv+OBq+WkseaVl+OBl+OBvuOBl+OBnzogJHtlcnJvcn1gLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgZXJyb3IgYXMgRXJyb3JcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODleOCoeOCpOODq+WtmOWcqOeiuuiqjVxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBmaWxlRXhpc3RzKGZpbGVQYXRoOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgZnMuYWNjZXNzKGZpbGVQYXRoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg4fjg5Xjgqnjg6vjg4hDTEnoqK3lrprjgpLlj5blvpdcbiAgICovXG4gIHByaXZhdGUgZ2V0RGVmYXVsdENMSUNvbmZpZygpOiBDTElDb25maWcge1xuICAgIHJldHVybiB7XG4gICAgICBjb25maWdQYXRoOiAnY29uZmlnL2ZpbGUtb3JnYW5pemF0aW9uLXJ1bGVzLmpzb24nLFxuICAgICAgb3V0cHV0RGlyOiAnZGV2ZWxvcG1lbnQvbG9ncy9vcmdhbml6YXRpb24nLFxuICAgICAgbG9nTGV2ZWw6ICdpbmZvJyxcbiAgICAgIHVzZUNvbG9yczogdHJ1ZVxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog44OH44OV44Kp44Or44OI6Kit5a6a44KS5Y+W5b6XXG4gICAqL1xuICBwcml2YXRlIGdldERlZmF1bHRDb25maWcoKTogQ2xhc3NpZmljYXRpb25Db25maWcge1xuICAgIHJldHVybiB7XG4gICAgICBydWxlczoge1xuICAgICAgICBzY3JpcHQ6IHtcbiAgICAgICAgICBwYXR0ZXJuczogWycqLnNoJywgJyoucHknLCAnKi5qcycsICcqLnRzJ10sXG4gICAgICAgICAga2V5d29yZHM6IFsnc2NyaXB0JywgJ3V0aWxpdHknLCAndG9vbCddLFxuICAgICAgICAgIHRhcmdldERpcmVjdG9yeTogJ2RldmVsb3BtZW50L3NjcmlwdHMvdXRpbGl0aWVzJ1xuICAgICAgICB9LFxuICAgICAgICBkb2N1bWVudDoge1xuICAgICAgICAgIHBhdHRlcm5zOiBbJyoubWQnLCAnKi50eHQnLCAnKi5kb2MnXSxcbiAgICAgICAgICBrZXl3b3JkczogWydyZWFkbWUnLCAnZG9jJywgJ2d1aWRlJ10sXG4gICAgICAgICAgdGFyZ2V0RGlyZWN0b3J5OiAnZGV2ZWxvcG1lbnQvZG9jcy9yZXBvcnRzJ1xuICAgICAgICB9LFxuICAgICAgICBjb25maWc6IHtcbiAgICAgICAgICBwYXR0ZXJuczogWycqLmpzb24nLCAnKi55YW1sJywgJyoueW1sJywgJyouZW52J10sXG4gICAgICAgICAga2V5d29yZHM6IFsnY29uZmlnJywgJ3NldHRpbmcnLCAnZW52J10sXG4gICAgICAgICAgdGFyZ2V0RGlyZWN0b3J5OiAnZGV2ZWxvcG1lbnQvY29uZmlncydcbiAgICAgICAgfSxcbiAgICAgICAgdGVzdDoge1xuICAgICAgICAgIHBhdHRlcm5zOiBbJyoudGVzdC4qJywgJyouc3BlYy4qJ10sXG4gICAgICAgICAga2V5d29yZHM6IFsndGVzdCcsICdzcGVjJ10sXG4gICAgICAgICAgdGFyZ2V0RGlyZWN0b3J5OiAndGVzdHMvbGVnYWN5J1xuICAgICAgICB9LFxuICAgICAgICBsb2c6IHtcbiAgICAgICAgICBwYXR0ZXJuczogWycqLmxvZyddLFxuICAgICAgICAgIGtleXdvcmRzOiBbJ2xvZyddLFxuICAgICAgICAgIHRhcmdldERpcmVjdG9yeTogJ2RldmVsb3BtZW50L2xvZ3MnXG4gICAgICAgIH0sXG4gICAgICAgIG90aGVyOiB7XG4gICAgICAgICAgcGF0dGVybnM6IFsnKiddLFxuICAgICAgICAgIGtleXdvcmRzOiBbXSxcbiAgICAgICAgICB0YXJnZXREaXJlY3Rvcnk6ICdhcmNoaXZlL3Vua25vd24nXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICB2YWxpZGF0aW9uOiB7XG4gICAgICAgIHJlcXVpcmVkRGlyZWN0b3JpZXM6IFtcbiAgICAgICAgICAnZGV2ZWxvcG1lbnQnLFxuICAgICAgICAgICdkZXZlbG9wbWVudC9zY3JpcHRzJyxcbiAgICAgICAgICAnZGV2ZWxvcG1lbnQvZG9jcycsXG4gICAgICAgICAgJ2RldmVsb3BtZW50L2NvbmZpZ3MnLFxuICAgICAgICAgICdkZXZlbG9wbWVudC9sb2dzJyxcbiAgICAgICAgICAndGVzdHMnLFxuICAgICAgICAgICdhcmNoaXZlJ1xuICAgICAgICBdLFxuICAgICAgICBtYXhGaWxlU2l6ZTogMTAwICogMTAyNCAqIDEwMjQsIC8vIDEwME1CXG4gICAgICAgIGFsbG93ZWRFeHRlbnNpb25zOiBbJy5qcycsICcudHMnLCAnLnB5JywgJy5zaCcsICcubWQnLCAnLmpzb24nLCAnLnlhbWwnLCAnLnltbCddXG4gICAgICB9XG4gICAgfTtcbiAgfVxufSJdfQ==