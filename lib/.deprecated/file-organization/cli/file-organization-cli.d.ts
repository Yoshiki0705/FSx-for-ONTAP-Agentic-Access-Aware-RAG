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
export declare class FileOrganizationCLI {
    private readonly program;
    private config?;
    private sshConfig?;
    private cliConfig;
    constructor();
    /**
     * CLIを実行
     */
    run(argv: string[]): Promise<void>;
    /**
     * コマンドを設定
     */
    private setupCommands;
    /**
     * 実行コマンドを設定
     */
    private setupExecuteCommand;
    /**
     * スキャンコマンドを設定
     */
    private setupScanCommand;
    /**
     * 分類コマンドを設定
     */
    private setupClassifyCommand;
    /**
     * 移動コマンドを設定
     */
    private setupMoveCommand;
    /**
     * 同期コマンドを設定
     */
    private setupSyncCommand;
    /**
     * 検証コマンドを設定
     */
    private setupValidateCommand;
    /**
     * レポートコマンドを設定
     */
    private setupReportCommand;
    /**
     * 構造コマンドを設定
     */
    private setupStructureCommand;
    /**
     * バックアップコマンドを設定
     */
    private setupBackupCommand;
    /**
     * 権限コマンドを設定
     */
    private setupPermissionCommand;
    /**
     * 実行コマンドを処理
     */
    private executeCommand;
    /**
     * スキャンコマンドを処理
     */
    private scanCommand;
    /**
     * 分類コマンドを処理
     */
    private classifyCommand;
    /**
     * 移動コマンドを処理
     */
    private moveCommand;
    /**
     * 同期コマンドを処理
     */
    private syncCommand;
    /**
     * 検証コマンドを処理
     */
    private validateCommand;
    /**
     * レポートコマンドを処理
     */
    private reportCommand;
    /**
     * 構造作成コマンドを処理
     */
    private structureCreateCommand;
    /**
     * 構造比較コマンドを処理
     */
    private structureCompareCommand;
    /**
     * 構造検証コマンドを処理
     */
    private structureValidateCommand;
    /**
     * バックアップ作成コマンドを処理
     */
    private backupCreateCommand;
    /**
     * バックアップ復元コマンドを処理
     */
    private backupRestoreCommand;
    /**
     * バックアップ一覧コマンドを処理
     */
    private backupListCommand;
    /**
     * バックアップクリーンアップコマンドを処理
     */
    private backupCleanupCommand;
    /**
     * 権限設定コマンドを処理
     */
    private permissionSetCommand;
    /**
     * 権限検証コマンドを処理
     */
    private permissionValidateCommand;
    /**
     * 設定を読み込み
     */
    private loadConfiguration;
    /**
     * ファイル存在確認
     */
    private fileExists;
    /**
     * デフォルトCLI設定を取得
     */
    private getDefaultCLIConfig;
    /**
     * デフォルト設定を取得
     */
    private getDefaultConfig;
}
