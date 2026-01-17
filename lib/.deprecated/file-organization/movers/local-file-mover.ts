/**
 * 統合ファイル整理システム - ローカルファイル移動器
 * 
 * ローカル環境でのファイル移動機能を提供し、
 * Agent Steering準拠の構造への安全な移動を実行します。
 */

import * as fs from 'fs/promises';
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

/**
 * 移動進捗情報
 */
export interface MoveProgress {
  /** 現在の処理ファイル */
  currentFile: string;
  /** 処理済みファイル数 */
  processedFiles: number;
  /** 総ファイル数 */
  totalFiles: number;
  /** 進捗率（0-100） */
  progressPercentage: number;
  /** 成功したファイル数 */
  successfulMoves: number;
  /** 失敗したファイル数 */
  failedMoves: number;
  /** 開始時刻 */
  startTime: Date;
  /** 推定残り時間（ミリ秒） */
  estimatedTimeRemaining?: number;
}

/**
 * 移動統計情報
 */
export interface MoveStatistics {
  /** 総処理ファイル数 */
  totalFiles: number;
  /** 成功したファイル数 */
  successfulMoves: number;
  /** 失敗したファイル数 */
  failedMoves: number;
  /** スキップしたファイル数 */
  skippedFiles: number;
  /** 処理時間（ミリ秒） */
  processingTime: number;
  /** 移動したファイルサイズ合計（バイト） */
  totalMovedSize: number;
  /** 平均移動時間（ミリ秒/ファイル） */
  averageMoveTime: number;
  /** エラー詳細 */
  errors: Array<{ file: string; error: string }>;
}

/**
 * ローカルファイル移動器
 * 
 * ローカル環境でのファイル移動を安全に実行し、
 * 進捗追跡と詳細な統計情報を提供します。
 */
export class LocalFileMover implements FileMover {
  private readonly environment: Environment = 'local';
  private moveProgress?: MoveProgress;
  private progressCallback?: (progress: MoveProgress) => void;

  /**
   * 複数ファイルを一括移動
   */
  public async moveFiles(
    files: FileInfo[], 
    classifications: ClassificationResult[], 
    options: MoveOptions = {}
  ): Promise<MoveResult> {
    const startTime = Date.now();
    console.log(`📁 ローカル環境で${files.length}個のファイル移動を開始...`);

    // 進捗追跡の初期化
    this.initializeProgress(files, startTime);

    try {
      const results: Array<{ file: FileInfo; success: boolean; error?: string; newPath?: string }> = [];
      const errors: string[] = [];
      let totalMovedSize = 0;

      // ドライランモードの確認
      if (options.dryRun) {
        console.log('🔍 ドライランモード: 実際の移動は行いません');
        return this.createDryRunResult(files, classifications);
      }

      // 移動前の検証
      await this.validateMoveOperation(files, classifications, options);

      // ファイルを順次移動
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const classification = classifications[i];

        try {
          // 進捗更新
          this.updateProgress(file.path, i);

          // 個別ファイル移動
          const moveResult = await this.moveSingleFile(file, classification, options);
          
          if (moveResult.success) {
            results.push({
              file,
              success: true,
              newPath: moveResult.newPath
            });
            totalMovedSize += file.size;
            console.log(`✅ 移動完了: ${file.path} → ${moveResult.newPath}`);
          } else {
            results.push({
              file,
              success: false,
              error: moveResult.error
            });
            errors.push(`${file.path}: ${moveResult.error}`);
            console.warn(`⚠️ 移動失敗: ${file.path} - ${moveResult.error}`);
          }
        } catch (error) {
          const errorMsg = `予期しないエラー: ${error}`;
          results.push({
            file,
            success: false,
            error: errorMsg
          });
          errors.push(`${file.path}: ${errorMsg}`);
          console.error(`❌ 移動エラー: ${file.path} - ${errorMsg}`);
        }
      }

      const processingTime = Date.now() - startTime;
      const successfulMoves = results.filter(r => r.success).length;
      const failedMoves = results.filter(r => !r.success).length;

      // 統計情報の生成
      const statistics: MoveStatistics = {
        totalFiles: files.length,
        successfulMoves,
        failedMoves,
        skippedFiles: 0,
        processingTime,
        totalMovedSize,
        averageMoveTime: successfulMoves > 0 ? processingTime / successfulMoves : 0,
        errors: results
          .filter(r => !r.success)
          .map(r => ({ file: r.file.path, error: r.error || '不明なエラー' }))
      };

      console.log(`${successfulMoves > 0 ? '✅' : '⚠️'} ローカルファイル移動完了: ${successfulMoves}/${files.length}個成功 (${processingTime}ms)`);

      return {
        success: failedMoves === 0,
        movedFiles: results.filter(r => r.success).map(r => ({
          originalPath: r.file.path,
          newPath: r.newPath!,
          size: r.file.size
        })),
        failedFiles: results.filter(r => !r.success).map(r => ({
          path: r.file.path,
          error: r.error!
        })),
        statistics,
        environment: this.environment,
        processingTime
      };
    } catch (error) {
      throw new OrganizationError(
        OrganizationErrorType.MOVE_FAILED,
        `ローカルファイル移動に失敗しました: ${error}`,
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
    try {
      // 移動先パスの生成
      const targetPath = this.generateTargetPath(file, classification);
      
      // 移動先ディレクトリの作成
      const targetDir = path.dirname(targetPath);
      await this.ensureDirectoryExists(targetDir);

      // ファイル名の重複チェック
      const finalPath = await this.resolveFileNameConflict(targetPath, options);

      // ファイル移動の実行
      await this.executeFileMove(file.path, finalPath, options);

      // 権限設定
      await this.setFilePermissions(finalPath, classification);

      return {
        success: true,
        newPath: finalPath
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 移動操作の検証
   */
  public async validateMoveOperation(
    files: FileInfo[], 
    classifications: ClassificationResult[], 
    options: MoveOptions
  ): Promise<void> {
    console.log('🔍 移動操作を検証中...');

    // ファイル数と分類結果数の一致確認
    if (files.length !== classifications.length) {
      throw new Error(`ファイル数(${files.length})と分類結果数(${classifications.length})が一致しません`);
    }

    // ファイル存在確認
    for (const file of files) {
      try {
        await fs.access(file.path);
      } catch {
        throw new Error(`ファイルが存在しません: ${file.path}`);
      }
    }

    // 分類結果の妥当性確認
    for (const classification of classifications) {
      if (!classification.targetPath) {
        throw new Error(`移動先パスが設定されていません: ${classification.filePath}`);
      }
      
      if (classification.confidence < 0.5) {
        console.warn(`⚠️ 分類信頼度が低いファイル: ${classification.filePath} (${classification.confidence})`);
      }
    }

    // ディスク容量確認
    await this.checkDiskSpace(files);

    console.log('✅ 移動操作検証完了');
  }

  /**
   * 進捗コールバックを設定
   */
  public setProgressCallback(callback: (progress: MoveProgress) => void): void {
    this.progressCallback = callback;
  }

  /**
   * 現在の進捗を取得
   */
  public getCurrentProgress(): MoveProgress | undefined {
    return this.moveProgress;
  }

  /**
   * 移動をキャンセル（実装簡略化）
   */
  public async cancelMove(): Promise<void> {
    console.log('⏹️ ファイル移動をキャンセル中...');
    // 実際の実装では、進行中の移動を安全に停止する
  }

  /**
   * 移動先パスを生成
   */
  private generateTargetPath(file: FileInfo, classification: ClassificationResult): string {
    if (classification.targetPath) {
      return classification.targetPath;
    }

    // フォールバック: ファイルタイプに基づく基本的なパス生成
    const fileName = path.basename(file.path);
    
    switch (classification.fileType) {
      case 'script':
        return path.join('development/scripts/utilities', fileName);
      case 'document':
        return path.join('development/docs/reports', fileName);
      case 'config':
        return path.join('development/configs', fileName);
      case 'test':
        return path.join('tests/legacy', fileName);
      default:
        return path.join('archive/unknown', fileName);
    }
  }

  /**
   * ディレクトリの存在確認・作成
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
      console.log(`📁 ディレクトリ作成: ${dirPath}`);
    }
  }

  /**
   * ファイル名の重複を解決
   */
  private async resolveFileNameConflict(targetPath: string, options: MoveOptions): Promise<string> {
    try {
      await fs.access(targetPath);
      
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
          await fs.access(newPath);
        } catch {
          break; // ファイルが存在しない場合は使用可能
        }
      } while (counter < 1000); // 無限ループ防止

      console.log(`📝 ファイル名重複回避: ${targetPath} → ${newPath}`);
      return newPath;
    } catch {
      // ファイルが存在しない場合はそのまま使用
      return targetPath;
    }
  }

  /**
   * ファイル移動を実行
   */
  private async executeFileMove(sourcePath: string, targetPath: string, options: MoveOptions): Promise<void> {
    if (options.copyInsteadOfMove) {
      await fs.copyFile(sourcePath, targetPath);
      console.log(`📋 ファイルコピー: ${sourcePath} → ${targetPath}`);
    } else {
      await fs.rename(sourcePath, targetPath);
    }
  }

  /**
   * ファイル権限を設定
   */
  private async setFilePermissions(filePath: string, classification: ClassificationResult): Promise<void> {
    try {
      let permissions: number;
      
      switch (classification.fileType) {
        case 'script':
          permissions = 0o755; // 実行可能
          break;
        case 'config':
          if (filePath.includes('secret') || filePath.includes('env')) {
            permissions = 0o600; // 機密ファイル
          } else {
            permissions = 0o644; // 一般設定
          }
          break;
        default:
          permissions = 0o644; // デフォルト
          break;
      }

      await fs.chmod(filePath, permissions);
    } catch (error) {
      console.warn(`⚠️ 権限設定に失敗: ${filePath} - ${error}`);
    }
  }

  /**
   * ディスク容量をチェック
   */
  private async checkDiskSpace(files: FileInfo[]): Promise<void> {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const totalSizeMB = Math.round(totalSize / 1024 / 1024);
    
    console.log(`💾 移動予定ファイルサイズ: ${totalSizeMB}MB`);
    
    // 簡易的な容量チェック（実際の実装ではより詳細な確認が必要）
    if (totalSize > 1024 * 1024 * 1024) { // 1GB以上
      console.warn('⚠️ 大容量ファイルの移動です。十分な空き容量があることを確認してください。');
    }
  }

  /**
   * 進捗追跡を初期化
   */
  private initializeProgress(files: FileInfo[], startTime: number): void {
    this.moveProgress = {
      currentFile: '',
      processedFiles: 0,
      totalFiles: files.length,
      progressPercentage: 0,
      successfulMoves: 0,
      failedMoves: 0,
      startTime: new Date(startTime)
    };
  }

  /**
   * 進捗を更新
   */
  private updateProgress(currentFile: string, processedFiles: number): void {
    if (!this.moveProgress) return;

    this.moveProgress.currentFile = currentFile;
    this.moveProgress.processedFiles = processedFiles;
    this.moveProgress.progressPercentage = Math.round((processedFiles / this.moveProgress.totalFiles) * 100);

    // 推定残り時間の計算
    if (processedFiles > 0) {
      const elapsedTime = Date.now() - this.moveProgress.startTime.getTime();
      const averageTimePerFile = elapsedTime / processedFiles;
      const remainingFiles = this.moveProgress.totalFiles - processedFiles;
      this.moveProgress.estimatedTimeRemaining = Math.round(averageTimePerFile * remainingFiles);
    }

    // コールバック実行
    if (this.progressCallback) {
      this.progressCallback(this.moveProgress);
    }
  }

  /**
   * ドライラン結果を作成
   */
  private createDryRunResult(files: FileInfo[], classifications: ClassificationResult[]): MoveResult {
    const movedFiles = files.map((file, index) => ({
      originalPath: file.path,
      newPath: this.generateTargetPath(file, classifications[index]),
      size: file.size
    }));

    const statistics: MoveStatistics = {
      totalFiles: files.length,
      successfulMoves: files.length,
      failedMoves: 0,
      skippedFiles: 0,
      processingTime: 0,
      totalMovedSize: files.reduce((sum, file) => sum + file.size, 0),
      averageMoveTime: 0,
      errors: []
    };

    return {
      success: true,
      movedFiles,
      failedFiles: [],
      statistics,
      environment: this.environment,
      processingTime: 0
    };
  }

  /**
   * 移動結果を検証
   */
  public async verifyMoveResults(moveResult: MoveResult): Promise<{
    verified: boolean;
    missingFiles: string[];
    corruptedFiles: string[];
    permissionIssues: string[];
  }> {
    console.log('🔍 移動結果を検証中...');

    const missingFiles: string[] = [];
    const corruptedFiles: string[] = [];
    const permissionIssues: string[] = [];

    for (const movedFile of moveResult.movedFiles) {
      try {
        // ファイル存在確認
        const stats = await fs.stat(movedFile.newPath);
        
        // ファイルサイズ確認
        if (stats.size !== movedFile.size) {
          corruptedFiles.push(`${movedFile.newPath} (サイズ不一致: 期待値${movedFile.size}, 実際${stats.size})`);
        }

        // 権限確認（簡易）
        try {
          await fs.access(movedFile.newPath, fs.constants.R_OK);
        } catch {
          permissionIssues.push(`${movedFile.newPath} (読み取り権限なし)`);
        }
      } catch {
        missingFiles.push(movedFile.newPath);
      }
    }

    const verified = missingFiles.length === 0 && corruptedFiles.length === 0 && permissionIssues.length === 0;

    if (verified) {
      console.log('✅ 移動結果検証完了: 問題なし');
    } else {
      console.warn(`⚠️ 移動結果検証で問題を検出: 不足${missingFiles.length}個, 破損${corruptedFiles.length}個, 権限${permissionIssues.length}個`);
    }

    return {
      verified,
      missingFiles,
      corruptedFiles,
      permissionIssues
    };
  }

  /**
   * 移動統計レポートを生成
   */
  public generateMoveReport(moveResult: MoveResult): string {
    const stats = moveResult.statistics;
    const successRate = Math.round((stats.successfulMoves / stats.totalFiles) * 100);
    
    return `
# ローカルファイル移動レポート

## 実行サマリー
- **実行日時**: ${new Date().toLocaleString('ja-JP')}
- **処理ファイル数**: ${stats.totalFiles}個
- **成功**: ${stats.successfulMoves}個
- **失敗**: ${stats.failedMoves}個
- **成功率**: ${successRate}%
- **処理時間**: ${Math.round(stats.processingTime / 1000)}秒
- **移動データサイズ**: ${Math.round(stats.totalMovedSize / 1024 / 1024)}MB

## パフォーマンス
- **平均移動時間**: ${Math.round(stats.averageMoveTime)}ms/ファイル
- **スループット**: ${Math.round(stats.totalFiles / (stats.processingTime / 1000))}ファイル/秒

## エラー詳細
${stats.errors.length > 0 ? 
  stats.errors.map(error => `- ${error.file}: ${error.error}`).join('\n') : 
  '- エラーなし'
}

## 移動されたファイル
${moveResult.movedFiles.slice(0, 10).map(file => 
  `- ${path.basename(file.originalPath)} → ${file.newPath}`
).join('\n')}
${moveResult.movedFiles.length > 10 ? `\n... 他${moveResult.movedFiles.length - 10}個` : ''}
`;
  }
}