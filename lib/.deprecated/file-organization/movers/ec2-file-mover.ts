/**
 * 統合ファイル整理システム - EC2ファイル移動器
 * 
 * EC2環境でのファイル移動機能を提供し、
 * SSH経由での安全なリモートファイル移動を実行します。
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { 
  FileMover,
  FileInfo,
  ClassificationResult,
  MoveResult,
  MoveOptions,
  Environment,
  OrganizationError,
  OrganizationErrorType
} from '../types/index.js';
import { SSHConfig } from '../scanners/ec2-scanner.js';

const execAsync = promisify(exec);

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
export class EC2FileMover implements FileMover {
  private readonly environment: Environment = 'ec2';
  private readonly sshConfig: SSHConfig;
  private readonly maxRetries: number = 3;
  private readonly batchSize: number = 10; // 一度に処理するファイル数

  constructor(sshConfig: SSHConfig) {
    this.sshConfig = sshConfig;
  }

  /**
   * 複数ファイルを一括移動
   */
  public async moveFiles(
    files: FileInfo[], 
    classifications: ClassificationResult[], 
    options: MoveOptions = {}
  ): Promise<MoveResult> {
    const startTime = Date.now();
    console.log(`🌐 EC2環境で${files.length}個のファイル移動を開始...`);

    try {
      // 接続テスト
      await this.testConnection();

      // 移動前の検証
      await this.validateRemoteMoveOperation(files, classifications, options);

      // ドライランモードの確認
      if (options.dryRun) {
        console.log('🔍 ドライランモード: 実際の移動は行いません');
        return this.createDryRunResult(files, classifications);
      }

      // バッチ処理で移動実行
      const batchResults = await this.executeBatchMove(files, classifications, options);

      // 結果の集計
      const allResults = batchResults.flatMap(batch => batch.results);
      const successfulMoves = allResults.filter(r => r.success);
      const failedMoves = allResults.filter(r => !r.success);

      const processingTime = Date.now() - startTime;
      const totalMovedSize = successfulMoves.reduce((sum, r) => sum + r.fileSize, 0);

      // 移動結果の検証
      if (successfulMoves.length > 0) {
        await this.verifyRemoteMoves(successfulMoves);
      }

      console.log(`${successfulMoves.length > 0 ? '✅' : '⚠️'} EC2ファイル移動完了: ${successfulMoves.length}/${files.length}個成功 (${processingTime}ms)`);

      return {
        success: failedMoves.length === 0,
        movedFiles: successfulMoves.map(r => ({
          originalPath: r.originalPath,
          newPath: r.newPath!,
          size: r.fileSize
        })),
        failedFiles: failedMoves.map(r => ({
          path: r.originalPath,
          error: r.error!
        })),
        statistics: {
          totalFiles: files.length,
          successfulMoves: successfulMoves.length,
          failedMoves: failedMoves.length,
          skippedFiles: 0,
          processingTime,
          totalMovedSize,
          averageMoveTime: successfulMoves.length > 0 ? 
            successfulMoves.reduce((sum, r) => sum + r.moveTime, 0) / successfulMoves.length : 0,
          errors: failedMoves.map(r => ({ file: r.originalPath, error: r.error! }))
        },
        environment: this.environment,
        processingTime
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.MOVE_FAILED,
        `EC2ファイル移動に失敗しました: ${error}`,
        undefined,
        this.environment,
        error as Error
      );
    }
  }

  /**
   * 単一ファイルを移動
   */
  public async moveSingleFile(
    file: FileInfo, 
    classification: ClassificationResult, 
    options: MoveOptions = {}
  ): Promise<{ success: boolean; newPath?: string; error?: string }> {
    const startTime = Date.now();

    try {
      // 移動先パスの生成
      const targetPath = this.generateRemoteTargetPath(file, classification);
      
      // 移動先ディレクトリの作成
      const targetDir = path.dirname(targetPath);
      await this.ensureRemoteDirectoryExists(targetDir);

      // ファイル名の重複チェック
      const finalPath = await this.resolveRemoteFileNameConflict(targetPath, options);

      // ファイル移動の実行
      await this.executeRemoteFileMove(file.path, finalPath, options);

      // 権限設定
      await this.setRemoteFilePermissions(finalPath, classification);

      // 移動結果の検証
      await this.verifyRemoteFileMove(file.path, finalPath, file.size);

      const moveTime = Date.now() - startTime;
      console.log(`✅ EC2ファイル移動完了: ${file.path} → ${finalPath} (${moveTime}ms)`);

      return {
        success: true,
        newPath: finalPath
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ EC2ファイル移動失敗: ${file.path} - ${errorMsg}`);
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * バッチ移動を実行
   */
  private async executeBatchMove(
    files: FileInfo[], 
    classifications: ClassificationResult[], 
    options: MoveOptions
  ): Promise<BatchMoveResult[]> {
    const batches: BatchMoveResult[] = [];
    
    // ファイルをバッチサイズごとに分割
    for (let i = 0; i < files.length; i += this.batchSize) {
      const batchFiles = files.slice(i, i + this.batchSize);
      const batchClassifications = classifications.slice(i, i + this.batchSize);
      
      const batchResult = await this.executeSingleBatch(batchFiles, batchClassifications, options, i);
      batches.push(batchResult);
      
      // バッチ間の待機（サーバー負荷軽減）
      if (i + this.batchSize < files.length) {
        await this.sleep(1000); // 1秒待機
      }
    }

    return batches;
  }

  /**
   * 単一バッチを実行
   */
  private async executeSingleBatch(
    files: FileInfo[], 
    classifications: ClassificationResult[], 
    options: MoveOptions,
    batchIndex: number
  ): Promise<BatchMoveResult> {
    const batchId = `batch-${batchIndex}-${Date.now()}`;
    const startTime = Date.now();
    const results: RemoteMoveResult[] = [];

    console.log(`📦 バッチ${Math.floor(batchIndex / this.batchSize) + 1}を処理中: ${files.length}個のファイル`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const classification = classifications[i];
      const moveStartTime = Date.now();

      try {
        const moveResult = await this.moveSingleFile(file, classification, options);
        
        results.push({
          success: moveResult.success,
          originalPath: file.path,
          newPath: moveResult.newPath,
          error: moveResult.error,
          moveTime: Date.now() - moveStartTime,
          fileSize: file.size
        });
      } catch (error) {
        results.push({
          success: false,
          originalPath: file.path,
          error: error instanceof Error ? error.message : String(error),
          moveTime: Date.now() - moveStartTime,
          fileSize: file.size
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const totalTime = Date.now() - startTime;

    console.log(`📦 バッチ完了: ${successCount}/${files.length}個成功 (${totalTime}ms)`);

    return {
      batchId,
      successCount,
      failureCount,
      results,
      totalTime
    };
  }

  /**
   * リモート移動操作の検証
   */
  private async validateRemoteMoveOperation(
    files: FileInfo[], 
    classifications: ClassificationResult[], 
    options: MoveOptions
  ): Promise<void> {
    console.log('🔍 EC2移動操作を検証中...');

    // ファイル数と分類結果数の一致確認
    if (files.length !== classifications.length) {
      throw new Error(`ファイル数(${files.length})と分類結果数(${classifications.length})が一致しません`);
    }

    // リモートファイル存在確認（サンプリング）
    const sampleSize = Math.min(5, files.length);
    const sampleFiles = files.slice(0, sampleSize);
    
    for (const file of sampleFiles) {
      const exists = await this.checkRemoteFileExists(file.path);
      if (!exists) {
        throw new Error(`リモートファイルが存在しません: ${file.path}`);
      }
    }

    // リモートディスク容量確認
    await this.checkRemoteDiskSpace(files);

    console.log('✅ EC2移動操作検証完了');
  }

  /**
   * リモートファイル移動を実行
   */
  private async executeRemoteFileMove(sourcePath: string, targetPath: string, options: MoveOptions): Promise<void> {
    let command: string;
    
    if (options.copyInsteadOfMove) {
      command = `cp "${sourcePath}" "${targetPath}"`;
    } else {
      command = `mv "${sourcePath}" "${targetPath}"`;
    }

    await this.executeSSHCommand(command);
  }

  /**
   * リモートディレクトリの存在確認・作成
   */
  private async ensureRemoteDirectoryExists(dirPath: string): Promise<void> {
    try {
      await this.executeSSHCommand(`test -d "${dirPath}"`);
    } catch {
      await this.executeSSHCommand(`mkdir -p "${dirPath}"`);
      console.log(`📁 リモートディレクトリ作成: ${dirPath}`);
    }
  }

  /**
   * リモートファイル名の重複を解決
   */
  private async resolveRemoteFileNameConflict(targetPath: string, options: MoveOptions): Promise<string> {
    try {
      await this.executeSSHCommand(`test -f "${targetPath}"`);
      
      // ファイルが既に存在する場合
      if (options.overwriteExisting) {
        return targetPath;
      }

      // 新しいファイル名を生成
      const dir = path.dirname(targetPath);
      const ext = path.extname(targetPath);
      const baseName = path.basename(targetPath, ext);
      
      let counter = 1;
      let newPath: string;
      
      do {
        newPath = path.join(dir, `${baseName}_${counter}${ext}`);
        counter++;
        
        try {
          await this.executeSSHCommand(`test -f "${newPath}"`);
        } catch {
          break; // ファイルが存在しない場合は使用可能
        }
      } while (counter < 1000); // 無限ループ防止

      console.log(`📝 リモートファイル名重複回避: ${targetPath} → ${newPath}`);
      return newPath;
    } catch {
      // ファイルが存在しない場合はそのまま使用
      return targetPath;
    }
  }

  /**
   * リモートファイル権限を設定
   */
  private async setRemoteFilePermissions(filePath: string, classification: ClassificationResult): Promise<void> {
    try {
      let permissions: string;
      
      switch (classification.fileType) {
        case 'script':
          permissions = '755'; // 実行可能
          break;
        case 'config':
          if (filePath.includes('secret') || filePath.includes('env')) {
            permissions = '600'; // 機密ファイル
          } else {
            permissions = '644'; // 一般設定
          }
          break;
        default:
          permissions = '644'; // デフォルト
          break;
      }

      await this.executeSSHCommand(`chmod ${permissions} "${filePath}"`);
    } catch (error) {
      console.warn(`⚠️ リモート権限設定に失敗: ${filePath} - ${error}`);
    }
  }

  /**
   * リモート移動先パスを生成
   */
  private generateRemoteTargetPath(file: FileInfo, classification: ClassificationResult): string {
    if (classification.targetPath) {
      return classification.targetPath;
    }

    // フォールバック: ファイルタイプに基づく基本的なパス生成
    const fileName = path.basename(file.path);
    
    switch (classification.fileType) {
      case 'script':
        return path.join('/home/ubuntu/development/scripts/utilities', fileName);
      case 'document':
        return path.join('/home/ubuntu/development/docs/reports', fileName);
      case 'config':
        return path.join('/home/ubuntu/development/configs', fileName);
      case 'test':
        return path.join('/home/ubuntu/tests/legacy', fileName);
      default:
        return path.join('/home/ubuntu/archive/unknown', fileName);
    }
  }

  /**
   * リモートファイル存在確認
   */
  private async checkRemoteFileExists(filePath: string): Promise<boolean> {
    try {
      await this.executeSSHCommand(`test -f "${filePath}"`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * リモートディスク容量確認
   */
  private async checkRemoteDiskSpace(files: FileInfo[]): Promise<void> {
    try {
      const result = await this.executeSSHCommand('df -h /home/ubuntu | tail -1');
      const diskInfo = result.stdout.trim().split(/\s+/);
      const usagePercentage = parseInt(diskInfo[4].replace('%', ''));
      
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      const totalSizeMB = Math.round(totalSize / 1024 / 1024);
      
      console.log(`💾 EC2ディスク使用率: ${usagePercentage}%, 移動予定: ${totalSizeMB}MB`);
      
      if (usagePercentage > 90) {
        console.warn('⚠️ EC2ディスク使用率が高いです。移動前に容量を確認してください。');
      }
    } catch (error) {
      console.warn(`⚠️ リモートディスク容量確認に失敗: ${error}`);
    }
  }

  /**
   * リモート移動結果を検証
   */
  private async verifyRemoteMoves(results: RemoteMoveResult[]): Promise<void> {
    console.log('🔍 リモート移動結果を検証中...');

    let verificationErrors = 0;
    const sampleSize = Math.min(10, results.length); // サンプリング検証
    const sampleResults = results.slice(0, sampleSize);

    for (const result of sampleResults) {
      try {
        await this.verifyRemoteFileMove(result.originalPath, result.newPath!, result.fileSize);
      } catch (error) {
        verificationErrors++;
        console.warn(`⚠️ 検証エラー: ${result.newPath} - ${error}`);
      }
    }

    if (verificationErrors === 0) {
      console.log('✅ リモート移動結果検証完了: 問題なし');
    } else {
      console.warn(`⚠️ リモート移動結果検証で${verificationErrors}個の問題を検出`);
    }
  }

  /**
   * 単一リモートファイル移動を検証
   */
  private async verifyRemoteFileMove(originalPath: string, newPath: string, expectedSize: number): Promise<void> {
    // 移動先ファイルの存在確認
    const exists = await this.checkRemoteFileExists(newPath);
    if (!exists) {
      throw new Error(`移動先ファイルが存在しません: ${newPath}`);
    }

    // ファイルサイズ確認
    try {
      const result = await this.executeSSHCommand(`stat -c%s "${newPath}"`);
      const actualSize = parseInt(result.stdout.trim());
      
      if (actualSize !== expectedSize) {
        throw new Error(`ファイルサイズが一致しません: 期待値${expectedSize}, 実際${actualSize}`);
      }
    } catch (error) {
      console.warn(`⚠️ ファイルサイズ確認に失敗: ${newPath} - ${error}`);
    }

    // 元ファイルが削除されているか確認（移動の場合）
    const originalExists = await this.checkRemoteFileExists(originalPath);
    if (originalExists) {
      console.warn(`⚠️ 元ファイルが残っています: ${originalPath}`);
    }
  }

  /**
   * 接続テスト
   */
  private async testConnection(): Promise<void> {
    try {
      await this.executeSSHCommand('echo "connection test"');
      console.log('✅ EC2接続テスト成功');
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.SSH_CONNECTION_FAILED,
        `EC2接続テストに失敗しました: ${error}`,
        undefined,
        this.environment,
        error as Error
      );
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
          this.environment,
          error
        );
      }
      throw error;
    }
  }

  /**
   * ドライラン結果を作成
   */
  private createDryRunResult(files: FileInfo[], classifications: ClassificationResult[]): MoveResult {
    const movedFiles = files.map((file, index) => ({
      originalPath: file.path,
      newPath: this.generateRemoteTargetPath(file, classifications[index]),
      size: file.size
    }));

    return {
      success: true,
      movedFiles,
      failedFiles: [],
      statistics: {
        totalFiles: files.length,
        successfulMoves: files.length,
        failedMoves: 0,
        skippedFiles: 0,
        processingTime: 0,
        totalMovedSize: files.reduce((sum, file) => sum + file.size, 0),
        averageMoveTime: 0,
        errors: []
      },
      environment: this.environment,
      processingTime: 0
    };
  }

  /**
   * 待機
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * EC2移動統計レポートを生成
   */
  public generateEC2MoveReport(moveResult: MoveResult): string {
    const stats = moveResult.statistics;
    const successRate = Math.round((stats.successfulMoves / stats.totalFiles) * 100);
    
    return `
# EC2ファイル移動レポート

## 実行サマリー
- **実行日時**: ${new Date().toLocaleString('ja-JP')}
- **EC2ホスト**: ${this.sshConfig.host}
- **処理ファイル数**: ${stats.totalFiles}個
- **成功**: ${stats.successfulMoves}個
- **失敗**: ${stats.failedMoves}個
- **成功率**: ${successRate}%
- **処理時間**: ${Math.round(stats.processingTime / 1000)}秒
- **移動データサイズ**: ${Math.round(stats.totalMovedSize / 1024 / 1024)}MB

## パフォーマンス
- **平均移動時間**: ${Math.round(stats.averageMoveTime)}ms/ファイル
- **ネットワークスループット**: ${Math.round(stats.totalFiles / (stats.processingTime / 1000))}ファイル/秒

## エラー詳細
${stats.errors.length > 0 ? 
  stats.errors.map(error => `- ${error.file}: ${error.error}`).join('\n') : 
  '- エラーなし'
}

## 移動されたファイル（上位10件）
${moveResult.movedFiles.slice(0, 10).map(file => 
  `- ${path.basename(file.originalPath)} → ${file.newPath}`
).join('\n')}
${moveResult.movedFiles.length > 10 ? `\n... 他${moveResult.movedFiles.length - 10}個` : ''}

## SSH接続情報
- **ホスト**: ${this.sshConfig.host}
- **ポート**: ${this.sshConfig.port}
- **ユーザー**: ${this.sshConfig.user}
- **タイムアウト**: ${this.sshConfig.timeout}ms
`;
  }
}