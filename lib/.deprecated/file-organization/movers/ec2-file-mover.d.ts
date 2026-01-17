/**
 * 統合ファイル整理システム - EC2ファイル移動器
 *
 * EC2環境でのファイル移動機能を提供し、
 * SSH経由での安全なリモートファイル移動を実行します。
 */
import { FileMover, FileInfo, ClassificationResult, MoveResult, MoveOptions } from '../types/index.js';
import { SSHConfig } from '../scanners/ec2-scanner.js';
/**
 * リモート移動結果
 */
export interface RemoteMoveResult {
    /** 移動成功したか */
    success: boolean;
    /** 移動前のパス */
    originalPath: string;
    /** 移動後のパス */
    newPath?: string;
    /** エラーメッセージ */
    error?: string;
    /** 移動にかかった時間（ミリ秒） */
    moveTime: number;
    /** ファイルサイズ */
    fileSize: number;
}
/**
 * バッチ移動結果
 */
export interface BatchMoveResult {
    /** バッチID */
    batchId: string;
    /** 成功した移動数 */
    successCount: number;
    /** 失敗した移動数 */
    failureCount: number;
    /** 個別結果 */
    results: RemoteMoveResult[];
    /** 総処理時間 */
    totalTime: number;
}
/**
 * EC2ファイル移動器
 *
 * SSH経由でEC2環境のファイル移動を安全に実行し、
 * リモート移動結果の検証機能を提供します。
 */
export declare class EC2FileMover implements FileMover {
    private readonly environment;
    private readonly sshConfig;
    private readonly maxRetries;
    private readonly batchSize;
    constructor(sshConfig: SSHConfig);
    /**
     * 複数ファイルを一括移動
     */
    moveFiles(files: FileInfo[], classifications: ClassificationResult[], options?: MoveOptions): Promise<MoveResult>;
    /**
     * 単一ファイルを移動
     */
    moveSingleFile(file: FileInfo, classification: ClassificationResult, options?: MoveOptions): Promise<{
        success: boolean;
        newPath?: string;
        error?: string;
    }>;
    /**
     * バッチ移動を実行
     */
    private executeBatchMove;
    /**
     * 単一バッチを実行
     */
    private executeSingleBatch;
    /**
     * リモート移動操作の検証
     */
    private validateRemoteMoveOperation;
    /**
     * リモートファイル移動を実行
     */
    private executeRemoteFileMove;
    /**
     * リモートディレクトリの存在確認・作成
     */
    private ensureRemoteDirectoryExists;
    /**
     * リモートファイル名の重複を解決
     */
    private resolveRemoteFileNameConflict;
    /**
     * リモートファイル権限を設定
     */
    private setRemoteFilePermissions;
    /**
     * リモート移動先パスを生成
     */
    private generateRemoteTargetPath;
    /**
     * リモートファイル存在確認
     */
    private checkRemoteFileExists;
    /**
     * リモートディスク容量確認
     */
    private checkRemoteDiskSpace;
    /**
     * リモート移動結果を検証
     */
    private verifyRemoteMoves;
    /**
     * 単一リモートファイル移動を検証
     */
    private verifyRemoteFileMove;
    /**
     * 接続テスト
     */
    private testConnection;
    /**
     * SSH コマンドを実行
     */
    private executeSSHCommand;
    /**
     * ドライラン結果を作成
     */
    private createDryRunResult;
    /**
     * 待機
     */
    private sleep;
    /**
     * EC2移動統計レポートを生成
     */
    generateEC2MoveReport(moveResult: MoveResult): string;
}
