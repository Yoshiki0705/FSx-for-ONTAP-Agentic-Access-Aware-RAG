"use strict";
/**
 * 統合ファイル整理システム - ローカルファイル移動器
 *
 * ローカル環境でのファイル移動機能を提供し、
 * Agent Steering準拠の構造への安全な移動を実行します。
 */
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
exports.LocalFileMover = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const index_js_1 = require("../types/index.js");
/**
 * ローカルファイル移動器
 *
 * ローカル環境でのファイル移動を安全に実行し、
 * 進捗追跡と詳細な統計情報を提供します。
 */
class LocalFileMover {
    environment = 'local';
    moveProgress;
    progressCallback;
    /**
     * 複数ファイルを一括移動
     */
    async moveFiles(files, classifications, options = {}) {
        const startTime = Date.now();
        console.log(`📁 ローカル環境で${files.length}個のファイル移動を開始...`);
        // 進捗追跡の初期化
        this.initializeProgress(files, startTime);
        try {
            const results = [];
            const errors = [];
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
                    }
                    else {
                        results.push({
                            file,
                            success: false,
                            error: moveResult.error
                        });
                        errors.push(`${file.path}: ${moveResult.error}`);
                        console.warn(`⚠️ 移動失敗: ${file.path} - ${moveResult.error}`);
                    }
                }
                catch (error) {
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
            const statistics = {
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
                    newPath: r.newPath,
                    size: r.file.size
                })),
                failedFiles: results.filter(r => !r.success).map(r => ({
                    path: r.file.path,
                    error: r.error
                })),
                statistics,
                environment: this.environment,
                processingTime
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.MOVE_FAILED, `ローカルファイル移動に失敗しました: ${error}`, undefined, this.environment, error);
        }
    }
    /**
     * 単一ファイルを移動
     */
    async moveSingleFile(file, classification, options = {}) {
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
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * 移動操作の検証
     */
    async validateMoveOperation(files, classifications, options) {
        console.log('🔍 移動操作を検証中...');
        // ファイル数と分類結果数の一致確認
        if (files.length !== classifications.length) {
            throw new Error(`ファイル数(${files.length})と分類結果数(${classifications.length})が一致しません`);
        }
        // ファイル存在確認
        for (const file of files) {
            try {
                await fs.access(file.path);
            }
            catch {
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
    setProgressCallback(callback) {
        this.progressCallback = callback;
    }
    /**
     * 現在の進捗を取得
     */
    getCurrentProgress() {
        return this.moveProgress;
    }
    /**
     * 移動をキャンセル（実装簡略化）
     */
    async cancelMove() {
        console.log('⏹️ ファイル移動をキャンセル中...');
        // 実際の実装では、進行中の移動を安全に停止する
    }
    /**
     * 移動先パスを生成
     */
    generateTargetPath(file, classification) {
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
    async ensureDirectoryExists(dirPath) {
        try {
            await fs.access(dirPath);
        }
        catch {
            await fs.mkdir(dirPath, { recursive: true });
            console.log(`📁 ディレクトリ作成: ${dirPath}`);
        }
    }
    /**
     * ファイル名の重複を解決
     */
    async resolveFileNameConflict(targetPath, options) {
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
            let newPath;
            do {
                newPath = path.join(dir, `${baseName}_${counter}${ext}`);
                counter++;
                try {
                    await fs.access(newPath);
                }
                catch {
                    break; // ファイルが存在しない場合は使用可能
                }
            } while (counter < 1000); // 無限ループ防止
            console.log(`📝 ファイル名重複回避: ${targetPath} → ${newPath}`);
            return newPath;
        }
        catch {
            // ファイルが存在しない場合はそのまま使用
            return targetPath;
        }
    }
    /**
     * ファイル移動を実行
     */
    async executeFileMove(sourcePath, targetPath, options) {
        if (options.copyInsteadOfMove) {
            await fs.copyFile(sourcePath, targetPath);
            console.log(`📋 ファイルコピー: ${sourcePath} → ${targetPath}`);
        }
        else {
            await fs.rename(sourcePath, targetPath);
        }
    }
    /**
     * ファイル権限を設定
     */
    async setFilePermissions(filePath, classification) {
        try {
            let permissions;
            switch (classification.fileType) {
                case 'script':
                    permissions = 0o755; // 実行可能
                    break;
                case 'config':
                    if (filePath.includes('secret') || filePath.includes('env')) {
                        permissions = 0o600; // 機密ファイル
                    }
                    else {
                        permissions = 0o644; // 一般設定
                    }
                    break;
                default:
                    permissions = 0o644; // デフォルト
                    break;
            }
            await fs.chmod(filePath, permissions);
        }
        catch (error) {
            console.warn(`⚠️ 権限設定に失敗: ${filePath} - ${error}`);
        }
    }
    /**
     * ディスク容量をチェック
     */
    async checkDiskSpace(files) {
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
    initializeProgress(files, startTime) {
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
    updateProgress(currentFile, processedFiles) {
        if (!this.moveProgress)
            return;
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
    createDryRunResult(files, classifications) {
        const movedFiles = files.map((file, index) => ({
            originalPath: file.path,
            newPath: this.generateTargetPath(file, classifications[index]),
            size: file.size
        }));
        const statistics = {
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
    async verifyMoveResults(moveResult) {
        console.log('🔍 移動結果を検証中...');
        const missingFiles = [];
        const corruptedFiles = [];
        const permissionIssues = [];
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
                }
                catch {
                    permissionIssues.push(`${movedFile.newPath} (読み取り権限なし)`);
                }
            }
            catch {
                missingFiles.push(movedFile.newPath);
            }
        }
        const verified = missingFiles.length === 0 && corruptedFiles.length === 0 && permissionIssues.length === 0;
        if (verified) {
            console.log('✅ 移動結果検証完了: 問題なし');
        }
        else {
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
    generateMoveReport(moveResult) {
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
            '- エラーなし'}

## 移動されたファイル
${moveResult.movedFiles.slice(0, 10).map(file => `- ${path.basename(file.originalPath)} → ${file.newPath}`).join('\n')}
${moveResult.movedFiles.length > 10 ? `\n... 他${moveResult.movedFiles.length - 10}個` : ''}
`;
    }
}
exports.LocalFileMover = LocalFileMover;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9jYWwtZmlsZS1tb3Zlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImxvY2FsLWZpbGUtbW92ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7OztHQUtHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGdEQUFrQztBQUNsQywyQ0FBNkI7QUFDN0IsZ0RBUzJCO0FBOEMzQjs7Ozs7R0FLRztBQUNILE1BQWEsY0FBYztJQUNSLFdBQVcsR0FBZ0IsT0FBTyxDQUFDO0lBQzVDLFlBQVksQ0FBZ0I7SUFDNUIsZ0JBQWdCLENBQW9DO0lBRTVEOztPQUVHO0lBQ0ksS0FBSyxDQUFDLFNBQVMsQ0FDcEIsS0FBaUIsRUFDakIsZUFBdUMsRUFDdkMsVUFBdUIsRUFBRTtRQUV6QixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDN0IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEtBQUssQ0FBQyxNQUFNLGdCQUFnQixDQUFDLENBQUM7UUFFdkQsV0FBVztRQUNYLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFFMUMsSUFBSSxDQUFDO1lBQ0gsTUFBTSxPQUFPLEdBQWtGLEVBQUUsQ0FBQztZQUNsRyxNQUFNLE1BQU0sR0FBYSxFQUFFLENBQUM7WUFDNUIsSUFBSSxjQUFjLEdBQUcsQ0FBQyxDQUFDO1lBRXZCLGNBQWM7WUFDZCxJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDbkIsT0FBTyxDQUFDLEdBQUcsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO2dCQUN4QyxPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLEVBQUUsZUFBZSxDQUFDLENBQUM7WUFDekQsQ0FBQztZQUVELFNBQVM7WUFDVCxNQUFNLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLEVBQUUsZUFBZSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBRWxFLFlBQVk7WUFDWixLQUFLLElB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SSxDQUFDLENBQUMsQ0FBQztZQUN6RSxTQUNGOzs7RUFHRSxVQUFVLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQzlDLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUMxRCxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7RUFDVixVQUFVLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLFVBQVUsVUFBVSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUU7Q0FDeEYsQ0FBQztJQUNBLENBQUM7Q0FDRjtBQTlmRCx3Q0E4ZkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIOe1seWQiOODleOCoeOCpOODq+aVtOeQhuOCt+OCueODhuODoCAtIOODreODvOOCq+ODq+ODleOCoeOCpOODq+enu+WLleWZqFxuICogXG4gKiDjg63jg7zjgqvjg6vnkrDlooPjgafjga7jg5XjgqHjgqTjg6vnp7vli5XmqZ/og73jgpLmj5DkvpvjgZfjgIFcbiAqIEFnZW50IFN0ZWVyaW5n5rqW5oug44Gu5qeL6YCg44G444Gu5a6J5YWo44Gq56e75YuV44KS5a6f6KGM44GX44G+44GZ44CCXG4gKi9cblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMvcHJvbWlzZXMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IFxuICBGaWxlTW92ZXIsXG4gIEZpbGVJbmZvLFxuICBDbGFzc2lmaWNhdGlvblJlc3VsdCxcbiAgTW92ZVJlc3VsdCxcbiAgTW92ZU9wdGlvbnMsXG4gIEVudmlyb25tZW50LFxuICBPcmdhbml6YXRpb25FcnJvcixcbiAgT3JnYW5pemF0aW9uRXJyb3JUeXBlXG59IGZyb20gJy4uL3R5cGVzL2luZGV4LmpzJztcblxuLyoqXG4gKiDnp7vli5XpgLLmjZfmg4XloLFcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBNb3ZlUHJvZ3Jlc3Mge1xuICAvKiog54++5Zyo44Gu5Yem55CG44OV44Kh44Kk44OrICovXG4gIGN1cnJlbnRGaWxlOiBzdHJpbmc7XG4gIC8qKiDlh6bnkIbmuIjjgb/jg5XjgqHjgqTjg6vmlbAgKi9cbiAgcHJvY2Vzc2VkRmlsZXM6IG51bWJlcjtcbiAgLyoqIOe3j+ODleOCoeOCpOODq+aVsCAqL1xuICB0b3RhbEZpbGVzOiBudW1iZXI7XG4gIC8qKiDpgLLmjZfnjofvvIgwLTEwMO+8iSAqL1xuICBwcm9ncmVzc1BlcmNlbnRhZ2U6IG51bWJlcjtcbiAgLyoqIOaIkOWKn+OBl+OBn+ODleOCoeOCpOODq+aVsCAqL1xuICBzdWNjZXNzZnVsTW92ZXM6IG51bWJlcjtcbiAgLyoqIOWkseaVl+OBl+OBn+ODleOCoeOCpOODq+aVsCAqL1xuICBmYWlsZWRNb3ZlczogbnVtYmVyO1xuICAvKiog6ZaL5aeL5pmC5Yi7ICovXG4gIHN0YXJ0VGltZTogRGF0ZTtcbiAgLyoqIOaOqOWumuaui+OCiuaZgumWk++8iOODn+ODquenku+8iSAqL1xuICBlc3RpbWF0ZWRUaW1lUmVtYWluaW5nPzogbnVtYmVyO1xufVxuXG4vKipcbiAqIOenu+WLlee1seioiOaDheWgsVxuICovXG5leHBvcnQgaW50ZXJmYWNlIE1vdmVTdGF0aXN0aWNzIHtcbiAgLyoqIOe3j+WHpueQhuODleOCoeOCpOODq+aVsCAqL1xuICB0b3RhbEZpbGVzOiBudW1iZXI7XG4gIC8qKiDmiJDlip/jgZfjgZ/jg5XjgqHjgqTjg6vmlbAgKi9cbiAgc3VjY2Vzc2Z1bE1vdmVzOiBudW1iZXI7XG4gIC8qKiDlpLHmlZfjgZfjgZ/jg5XjgqHjgqTjg6vmlbAgKi9cbiAgZmFpbGVkTW92ZXM6IG51bWJlcjtcbiAgLyoqIOOCueOCreODg+ODl+OBl+OBn+ODleOCoeOCpOODq+aVsCAqL1xuICBza2lwcGVkRmlsZXM6IG51bWJlcjtcbiAgLyoqIOWHpueQhuaZgumWk++8iOODn+ODquenku+8iSAqL1xuICBwcm9jZXNzaW5nVGltZTogbnVtYmVyO1xuICAvKiog56e75YuV44GX44Gf44OV44Kh44Kk44Or44K144Kk44K65ZCI6KiI77yI44OQ44Kk44OI77yJICovXG4gIHRvdGFsTW92ZWRTaXplOiBudW1iZXI7XG4gIC8qKiDlubPlnYfnp7vli5XmmYLplpPvvIjjg5/jg6rnp5Iv44OV44Kh44Kk44Or77yJICovXG4gIGF2ZXJhZ2VNb3ZlVGltZTogbnVtYmVyO1xuICAvKiog44Ko44Op44O86Kmz57SwICovXG4gIGVycm9yczogQXJyYXk8eyBmaWxlOiBzdHJpbmc7IGVycm9yOiBzdHJpbmcgfT47XG59XG5cbi8qKlxuICog44Ot44O844Kr44Or44OV44Kh44Kk44Or56e75YuV5ZmoXG4gKiBcbiAqIOODreODvOOCq+ODq+eSsOWig+OBp+OBruODleOCoeOCpOODq+enu+WLleOCkuWuieWFqOOBq+Wun+ihjOOBl+OAgVxuICog6YCy5o2X6L+96Leh44Go6Kmz57Sw44Gq57Wx6KiI5oOF5aCx44KS5o+Q5L6b44GX44G+44GZ44CCXG4gKi9cbmV4cG9ydCBjbGFzcyBMb2NhbEZpbGVNb3ZlciBpbXBsZW1lbnRzIEZpbGVNb3ZlciB7XG4gIHByaXZhdGUgcmVhZG9ubHkgZW52aXJvbm1lbnQ6IEVudmlyb25tZW50ID0gJ2xvY2FsJztcbiAgcHJpdmF0ZSBtb3ZlUHJvZ3Jlc3M/OiBNb3ZlUHJvZ3Jlc3M7XG4gIHByaXZhdGUgcHJvZ3Jlc3NDYWxsYmFjaz86IChwcm9ncmVzczogTW92ZVByb2dyZXNzKSA9PiB2b2lkO1xuXG4gIC8qKlxuICAgKiDopIfmlbDjg5XjgqHjgqTjg6vjgpLkuIDmi6znp7vli5VcbiAgICovXG4gIHB1YmxpYyBhc3luYyBtb3ZlRmlsZXMoXG4gICAgZmlsZXM6IEZpbGVJbmZvW10sIFxuICAgIGNsYXNzaWZpY2F0aW9uczogQ2xhc3NpZmljYXRpb25SZXN1bHRbXSwgXG4gICAgb3B0aW9uczogTW92ZU9wdGlvbnMgPSB7fVxuICApOiBQcm9taXNlPE1vdmVSZXN1bHQ+IHtcbiAgICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuICAgIGNvbnNvbGUubG9nKGDwn5OBIOODreODvOOCq+ODq+eSsOWig+OBpyR7ZmlsZXMubGVuZ3RofeWAi+OBruODleOCoeOCpOODq+enu+WLleOCkumWi+Wniy4uLmApO1xuXG4gICAgLy8g6YCy5o2X6L+96Leh44Gu5Yid5pyf5YyWXG4gICAgdGhpcy5pbml0aWFsaXplUHJvZ3Jlc3MoZmlsZXMsIHN0YXJ0VGltZSk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0czogQXJyYXk8eyBmaWxlOiBGaWxlSW5mbzsgc3VjY2VzczogYm9vbGVhbjsgZXJyb3I/OiBzdHJpbmc7IG5ld1BhdGg/OiBzdHJpbmcgfT4gPSBbXTtcbiAgICAgIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgICAgIGxldCB0b3RhbE1vdmVkU2l6ZSA9IDA7XG5cbiAgICAgIC8vIOODieODqeOCpOODqeODs+ODouODvOODieOBrueiuuiqjVxuICAgICAgaWYgKG9wdGlvbnMuZHJ5UnVuKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCfwn5SNIOODieODqeOCpOODqeODs+ODouODvOODiTog5a6f6Zqb44Gu56e75YuV44Gv6KGM44GE44G+44Gb44KTJyk7XG4gICAgICAgIHJldHVybiB0aGlzLmNyZWF0ZURyeVJ1blJlc3VsdChmaWxlcywgY2xhc3NpZmljYXRpb25zKTtcbiAgICAgIH1cblxuICAgICAgLy8g56e75YuV5YmN44Gu5qSc6Ki8XG4gICAgICBhd2FpdCB0aGlzLnZhbGlkYXRlTW92ZU9wZXJhdGlvbihmaWxlcywgY2xhc3NpZmljYXRpb25zLCBvcHRpb25zKTtcblxuICAgICAgLy8g44OV44Kh44Kk44Or44KS6aCG5qyh56e75YuVXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZpbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGZpbGUgPSBmaWxlc1tpXTtcbiAgICAgICAgY29uc3QgY2xhc3NpZmljYXRpb24gPSBjbGFzc2lmaWNhdGlvbnNbaV07XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAvLyDpgLLmjZfmm7TmlrBcbiAgICAgICAgICB0aGlzLnVwZGF0ZVByb2dyZXNzKGZpbGUucGF0aCwgaSk7XG5cbiAgICAgICAgICAvLyDlgIvliKXjg5XjgqHjgqTjg6vnp7vli5VcbiAgICAgICAgICBjb25zdCBtb3ZlUmVzdWx0ID0gYXdhaXQgdGhpcy5tb3ZlU2luZ2xlRmlsZShmaWxlLCBjbGFzc2lmaWNhdGlvbiwgb3B0aW9ucyk7XG4gICAgICAgICAgXG4gICAgICAgICAgaWYgKG1vdmVSZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHtcbiAgICAgICAgICAgICAgZmlsZSxcbiAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgbmV3UGF0aDogbW92ZVJlc3VsdC5uZXdQYXRoXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRvdGFsTW92ZWRTaXplICs9IGZpbGUuc2l6ZTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGDinIUg56e75YuV5a6M5LqGOiAke2ZpbGUucGF0aH0g4oaSICR7bW92ZVJlc3VsdC5uZXdQYXRofWApO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHRzLnB1c2goe1xuICAgICAgICAgICAgICBmaWxlLFxuICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgZXJyb3I6IG1vdmVSZXN1bHQuZXJyb3JcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZXJyb3JzLnB1c2goYCR7ZmlsZS5wYXRofTogJHttb3ZlUmVzdWx0LmVycm9yfWApO1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGDimqDvuI8g56e75YuV5aSx5pWXOiAke2ZpbGUucGF0aH0gLSAke21vdmVSZXN1bHQuZXJyb3J9YCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnN0IGVycm9yTXNnID0gYOS6iOacn+OBl+OBquOBhOOCqOODqeODvDogJHtlcnJvcn1gO1xuICAgICAgICAgIHJlc3VsdHMucHVzaCh7XG4gICAgICAgICAgICBmaWxlLFxuICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICBlcnJvcjogZXJyb3JNc2dcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBlcnJvcnMucHVzaChgJHtmaWxlLnBhdGh9OiAke2Vycm9yTXNnfWApO1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYOKdjCDnp7vli5Xjgqjjg6njg7w6ICR7ZmlsZS5wYXRofSAtICR7ZXJyb3JNc2d9YCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgcHJvY2Vzc2luZ1RpbWUgPSBEYXRlLm5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgY29uc3Qgc3VjY2Vzc2Z1bE1vdmVzID0gcmVzdWx0cy5maWx0ZXIociA9PiByLnN1Y2Nlc3MpLmxlbmd0aDtcbiAgICAgIGNvbnN0IGZhaWxlZE1vdmVzID0gcmVzdWx0cy5maWx0ZXIociA9PiAhci5zdWNjZXNzKS5sZW5ndGg7XG5cbiAgICAgIC8vIOe1seioiOaDheWgseOBrueUn+aIkFxuICAgICAgY29uc3Qgc3RhdGlzdGljczogTW92ZVN0YXRpc3RpY3MgPSB7XG4gICAgICAgIHRvdGFsRmlsZXM6IGZpbGVzLmxlbmd0aCxcbiAgICAgICAgc3VjY2Vzc2Z1bE1vdmVzLFxuICAgICAgICBmYWlsZWRNb3ZlcyxcbiAgICAgICAgc2tpcHBlZEZpbGVzOiAwLFxuICAgICAgICBwcm9jZXNzaW5nVGltZSxcbiAgICAgICAgdG90YWxNb3ZlZFNpemUsXG4gICAgICAgIGF2ZXJhZ2VNb3ZlVGltZTogc3VjY2Vzc2Z1bE1vdmVzID4gMCA/IHByb2Nlc3NpbmdUaW1lIC8gc3VjY2Vzc2Z1bE1vdmVzIDogMCxcbiAgICAgICAgZXJyb3JzOiByZXN1bHRzXG4gICAgICAgICAgLmZpbHRlcihyID0+ICFyLnN1Y2Nlc3MpXG4gICAgICAgICAgLm1hcChyID0+ICh7IGZpbGU6IHIuZmlsZS5wYXRoLCBlcnJvcjogci5lcnJvciB8fCAn5LiN5piO44Gq44Ko44Op44O8JyB9KSlcbiAgICAgIH07XG5cbiAgICAgIGNvbnNvbGUubG9nKGAke3N1Y2Nlc3NmdWxNb3ZlcyA+IDAgPyAn4pyFJyA6ICfimqDvuI8nfSDjg63jg7zjgqvjg6vjg5XjgqHjgqTjg6vnp7vli5XlrozkuoY6ICR7c3VjY2Vzc2Z1bE1vdmVzfS8ke2ZpbGVzLmxlbmd0aH3lgIvmiJDlip8gKCR7cHJvY2Vzc2luZ1RpbWV9bXMpYCk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IGZhaWxlZE1vdmVzID09PSAwLFxuICAgICAgICBtb3ZlZEZpbGVzOiByZXN1bHRzLmZpbHRlcihyID0+IHIuc3VjY2VzcykubWFwKHIgPT4gKHtcbiAgICAgICAgICBvcmlnaW5hbFBhdGg6IHIuZmlsZS5wYXRoLFxuICAgICAgICAgIG5ld1BhdGg6IHIubmV3UGF0aCEsXG4gICAgICAgICAgc2l6ZTogci5maWxlLnNpemVcbiAgICAgICAgfSkpLFxuICAgICAgICBmYWlsZWRGaWxlczogcmVzdWx0cy5maWx0ZXIociA9PiAhci5zdWNjZXNzKS5tYXAociA9PiAoe1xuICAgICAgICAgIHBhdGg6IHIuZmlsZS5wYXRoLFxuICAgICAgICAgIGVycm9yOiByLmVycm9yIVxuICAgICAgICB9KSksXG4gICAgICAgIHN0YXRpc3RpY3MsXG4gICAgICAgIGVudmlyb25tZW50OiB0aGlzLmVudmlyb25tZW50LFxuICAgICAgICBwcm9jZXNzaW5nVGltZVxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuTU9WRV9GQUlMRUQsXG4gICAgICAgIGDjg63jg7zjgqvjg6vjg5XjgqHjgqTjg6vnp7vli5XjgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7ZXJyb3J9YCxcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICB0aGlzLmVudmlyb25tZW50LFxuICAgICAgICBlcnJvciBhcyBFcnJvclxuICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog5Y2Y5LiA44OV44Kh44Kk44Or44KS56e75YuVXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgbW92ZVNpbmdsZUZpbGUoXG4gICAgZmlsZTogRmlsZUluZm8sIFxuICAgIGNsYXNzaWZpY2F0aW9uOiBDbGFzc2lmaWNhdGlvblJlc3VsdCwgXG4gICAgb3B0aW9uczogTW92ZU9wdGlvbnMgPSB7fVxuICApOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbmV3UGF0aD86IHN0cmluZzsgZXJyb3I/OiBzdHJpbmcgfT4ge1xuICAgIHRyeSB7XG4gICAgICAvLyDnp7vli5XlhYjjg5Hjgrnjga7nlJ/miJBcbiAgICAgIGNvbnN0IHRhcmdldFBhdGggPSB0aGlzLmdlbmVyYXRlVGFyZ2V0UGF0aChmaWxlLCBjbGFzc2lmaWNhdGlvbik7XG4gICAgICBcbiAgICAgIC8vIOenu+WLleWFiOODh+OCo+ODrOOCr+ODiOODquOBruS9nOaIkFxuICAgICAgY29uc3QgdGFyZ2V0RGlyID0gcGF0aC5kaXJuYW1lKHRhcmdldFBhdGgpO1xuICAgICAgYXdhaXQgdGhpcy5lbnN1cmVEaXJlY3RvcnlFeGlzdHModGFyZ2V0RGlyKTtcblxuICAgICAgLy8g44OV44Kh44Kk44Or5ZCN44Gu6YeN6KSH44OB44Kn44OD44KvXG4gICAgICBjb25zdCBmaW5hbFBhdGggPSBhd2FpdCB0aGlzLnJlc29sdmVGaWxlTmFtZUNvbmZsaWN0KHRhcmdldFBhdGgsIG9wdGlvbnMpO1xuXG4gICAgICAvLyDjg5XjgqHjgqTjg6vnp7vli5Xjga7lrp/ooYxcbiAgICAgIGF3YWl0IHRoaXMuZXhlY3V0ZUZpbGVNb3ZlKGZpbGUucGF0aCwgZmluYWxQYXRoLCBvcHRpb25zKTtcblxuICAgICAgLy8g5qip6ZmQ6Kit5a6aXG4gICAgICBhd2FpdCB0aGlzLnNldEZpbGVQZXJtaXNzaW9ucyhmaW5hbFBhdGgsIGNsYXNzaWZpY2F0aW9uKTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgbmV3UGF0aDogZmluYWxQYXRoXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgZXJyb3I6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKVxuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog56e75YuV5pON5L2c44Gu5qSc6Ki8XG4gICAqL1xuICBwdWJsaWMgYXN5bmMgdmFsaWRhdGVNb3ZlT3BlcmF0aW9uKFxuICAgIGZpbGVzOiBGaWxlSW5mb1tdLCBcbiAgICBjbGFzc2lmaWNhdGlvbnM6IENsYXNzaWZpY2F0aW9uUmVzdWx0W10sIFxuICAgIG9wdGlvbnM6IE1vdmVPcHRpb25zXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnNvbGUubG9nKCfwn5SNIOenu+WLleaTjeS9nOOCkuaknOiovOS4rS4uLicpO1xuXG4gICAgLy8g44OV44Kh44Kk44Or5pWw44Go5YiG6aGe57WQ5p6c5pWw44Gu5LiA6Ie056K66KqNXG4gICAgaWYgKGZpbGVzLmxlbmd0aCAhPT0gY2xhc3NpZmljYXRpb25zLmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGDjg5XjgqHjgqTjg6vmlbAoJHtmaWxlcy5sZW5ndGh9KeOBqOWIhumhnue1kOaenOaVsCgke2NsYXNzaWZpY2F0aW9ucy5sZW5ndGh9KeOBjOS4gOiHtOOBl+OBvuOBm+OCk2ApO1xuICAgIH1cblxuICAgIC8vIOODleOCoeOCpOODq+WtmOWcqOeiuuiqjVxuICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgZnMuYWNjZXNzKGZpbGUucGF0aCk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGDjg5XjgqHjgqTjg6vjgYzlrZjlnKjjgZfjgb7jgZvjgpM6ICR7ZmlsZS5wYXRofWApO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIOWIhumhnue1kOaenOOBruWmpeW9k+aAp+eiuuiqjVxuICAgIGZvciAoY29uc3QgY2xhc3NpZmljYXRpb24gb2YgY2xhc3NpZmljYXRpb25zKSB7XG4gICAgICBpZiAoIWNsYXNzaWZpY2F0aW9uLnRhcmdldFBhdGgpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGDnp7vli5XlhYjjg5HjgrnjgYzoqK3lrprjgZXjgozjgabjgYTjgb7jgZvjgpM6ICR7Y2xhc3NpZmljYXRpb24uZmlsZVBhdGh9YCk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmIChjbGFzc2lmaWNhdGlvbi5jb25maWRlbmNlIDwgMC41KSB7XG4gICAgICAgIGNvbnNvbGUud2Fybihg4pqg77iPIOWIhumhnuS/oemgvOW6puOBjOS9juOBhOODleOCoeOCpOODqzogJHtjbGFzc2lmaWNhdGlvbi5maWxlUGF0aH0gKCR7Y2xhc3NpZmljYXRpb24uY29uZmlkZW5jZX0pYCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8g44OH44Kj44K544Kv5a656YeP56K66KqNXG4gICAgYXdhaXQgdGhpcy5jaGVja0Rpc2tTcGFjZShmaWxlcyk7XG5cbiAgICBjb25zb2xlLmxvZygn4pyFIOenu+WLleaTjeS9nOaknOiovOWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIOmAsuaNl+OCs+ODvOODq+ODkOODg+OCr+OCkuioreWumlxuICAgKi9cbiAgcHVibGljIHNldFByb2dyZXNzQ2FsbGJhY2soY2FsbGJhY2s6IChwcm9ncmVzczogTW92ZVByb2dyZXNzKSA9PiB2b2lkKTogdm9pZCB7XG4gICAgdGhpcy5wcm9ncmVzc0NhbGxiYWNrID0gY2FsbGJhY2s7XG4gIH1cblxuICAvKipcbiAgICog54++5Zyo44Gu6YCy5o2X44KS5Y+W5b6XXG4gICAqL1xuICBwdWJsaWMgZ2V0Q3VycmVudFByb2dyZXNzKCk6IE1vdmVQcm9ncmVzcyB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMubW92ZVByb2dyZXNzO1xuICB9XG5cbiAgLyoqXG4gICAqIOenu+WLleOCkuOCreODo+ODs+OCu+ODq++8iOWun+ijheewoeeVpeWMlu+8iVxuICAgKi9cbiAgcHVibGljIGFzeW5jIGNhbmNlbE1vdmUoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc29sZS5sb2coJ+KPue+4jyDjg5XjgqHjgqTjg6vnp7vli5XjgpLjgq3jg6Pjg7Pjgrvjg6vkuK0uLi4nKTtcbiAgICAvLyDlrp/pmpvjga7lrp/oo4Xjgafjga/jgIHpgLLooYzkuK3jga7np7vli5XjgpLlronlhajjgavlgZzmraLjgZnjgotcbiAgfVxuXG4gIC8qKlxuICAgKiDnp7vli5XlhYjjg5HjgrnjgpLnlJ/miJBcbiAgICovXG4gIHByaXZhdGUgZ2VuZXJhdGVUYXJnZXRQYXRoKGZpbGU6IEZpbGVJbmZvLCBjbGFzc2lmaWNhdGlvbjogQ2xhc3NpZmljYXRpb25SZXN1bHQpOiBzdHJpbmcge1xuICAgIGlmIChjbGFzc2lmaWNhdGlvbi50YXJnZXRQYXRoKSB7XG4gICAgICByZXR1cm4gY2xhc3NpZmljYXRpb24udGFyZ2V0UGF0aDtcbiAgICB9XG5cbiAgICAvLyDjg5Xjgqnjg7zjg6vjg5Djg4Pjgq86IOODleOCoeOCpOODq+OCv+OCpOODl+OBq+WfuuOBpeOBj+WfuuacrOeahOOBquODkeOCueeUn+aIkFxuICAgIGNvbnN0IGZpbGVOYW1lID0gcGF0aC5iYXNlbmFtZShmaWxlLnBhdGgpO1xuICAgIFxuICAgIHN3aXRjaCAoY2xhc3NpZmljYXRpb24uZmlsZVR5cGUpIHtcbiAgICAgIGNhc2UgJ3NjcmlwdCc6XG4gICAgICAgIHJldHVybiBwYXRoLmpvaW4oJ2RldmVsb3BtZW50L3NjcmlwdHMvdXRpbGl0aWVzJywgZmlsZU5hbWUpO1xuICAgICAgY2FzZSAnZG9jdW1lbnQnOlxuICAgICAgICByZXR1cm4gcGF0aC5qb2luKCdkZXZlbG9wbWVudC9kb2NzL3JlcG9ydHMnLCBmaWxlTmFtZSk7XG4gICAgICBjYXNlICdjb25maWcnOlxuICAgICAgICByZXR1cm4gcGF0aC5qb2luKCdkZXZlbG9wbWVudC9jb25maWdzJywgZmlsZU5hbWUpO1xuICAgICAgY2FzZSAndGVzdCc6XG4gICAgICAgIHJldHVybiBwYXRoLmpvaW4oJ3Rlc3RzL2xlZ2FjeScsIGZpbGVOYW1lKTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBwYXRoLmpvaW4oJ2FyY2hpdmUvdW5rbm93bicsIGZpbGVOYW1lKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44OH44Kj44Os44Kv44OI44Oq44Gu5a2Y5Zyo56K66KqN44O75L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGVuc3VyZURpcmVjdG9yeUV4aXN0cyhkaXJQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgZnMuYWNjZXNzKGRpclBhdGgpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgYXdhaXQgZnMubWtkaXIoZGlyUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICBjb25zb2xlLmxvZyhg8J+TgSDjg4fjgqPjg6zjgq/jg4jjg6rkvZzmiJA6ICR7ZGlyUGF0aH1gKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44OV44Kh44Kk44Or5ZCN44Gu6YeN6KSH44KS6Kej5rG6XG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHJlc29sdmVGaWxlTmFtZUNvbmZsaWN0KHRhcmdldFBhdGg6IHN0cmluZywgb3B0aW9uczogTW92ZU9wdGlvbnMpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBmcy5hY2Nlc3ModGFyZ2V0UGF0aCk7XG4gICAgICBcbiAgICAgIC8vIOODleOCoeOCpOODq+OBjOaXouOBq+WtmOWcqOOBmeOCi+WgtOWQiFxuICAgICAgaWYgKG9wdGlvbnMub3ZlcndyaXRlRXhpc3RpbmcpIHtcbiAgICAgICAgcmV0dXJuIHRhcmdldFBhdGg7XG4gICAgICB9XG5cbiAgICAgIC8vIOaWsOOBl+OBhOODleOCoeOCpOODq+WQjeOCkueUn+aIkFxuICAgICAgY29uc3QgZGlyID0gcGF0aC5kaXJuYW1lKHRhcmdldFBhdGgpO1xuICAgICAgY29uc3QgZXh0ID0gcGF0aC5leHRuYW1lKHRhcmdldFBhdGgpO1xuICAgICAgY29uc3QgYmFzZU5hbWUgPSBwYXRoLmJhc2VuYW1lKHRhcmdldFBhdGgsIGV4dCk7XG4gICAgICBcbiAgICAgIGxldCBjb3VudGVyID0gMTtcbiAgICAgIGxldCBuZXdQYXRoOiBzdHJpbmc7XG4gICAgICBcbiAgICAgIGRvIHtcbiAgICAgICAgbmV3UGF0aCA9IHBhdGguam9pbihkaXIsIGAke2Jhc2VOYW1lfV8ke2NvdW50ZXJ9JHtleHR9YCk7XG4gICAgICAgIGNvdW50ZXIrKztcbiAgICAgICAgXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgYXdhaXQgZnMuYWNjZXNzKG5ld1BhdGgpO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICBicmVhazsgLy8g44OV44Kh44Kk44Or44GM5a2Y5Zyo44GX44Gq44GE5aC05ZCI44Gv5L2/55So5Y+v6IO9XG4gICAgICAgIH1cbiAgICAgIH0gd2hpbGUgKGNvdW50ZXIgPCAxMDAwKTsgLy8g54Sh6ZmQ44Or44O844OX6Ziy5q2iXG5cbiAgICAgIGNvbnNvbGUubG9nKGDwn5OdIOODleOCoeOCpOODq+WQjemHjeikh+WbnumBvzogJHt0YXJnZXRQYXRofSDihpIgJHtuZXdQYXRofWApO1xuICAgICAgcmV0dXJuIG5ld1BhdGg7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyDjg5XjgqHjgqTjg6vjgYzlrZjlnKjjgZfjgarjgYTloLTlkIjjga/jgZ3jga7jgb7jgb7kvb/nlKhcbiAgICAgIHJldHVybiB0YXJnZXRQYXRoO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg5XjgqHjgqTjg6vnp7vli5XjgpLlrp/ooYxcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZXhlY3V0ZUZpbGVNb3ZlKHNvdXJjZVBhdGg6IHN0cmluZywgdGFyZ2V0UGF0aDogc3RyaW5nLCBvcHRpb25zOiBNb3ZlT3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmIChvcHRpb25zLmNvcHlJbnN0ZWFkT2ZNb3ZlKSB7XG4gICAgICBhd2FpdCBmcy5jb3B5RmlsZShzb3VyY2VQYXRoLCB0YXJnZXRQYXRoKTtcbiAgICAgIGNvbnNvbGUubG9nKGDwn5OLIOODleOCoeOCpOODq+OCs+ODlOODvDogJHtzb3VyY2VQYXRofSDihpIgJHt0YXJnZXRQYXRofWApO1xuICAgIH0gZWxzZSB7XG4gICAgICBhd2FpdCBmcy5yZW5hbWUoc291cmNlUGF0aCwgdGFyZ2V0UGF0aCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODleOCoeOCpOODq+aoqemZkOOCkuioreWumlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBzZXRGaWxlUGVybWlzc2lvbnMoZmlsZVBhdGg6IHN0cmluZywgY2xhc3NpZmljYXRpb246IENsYXNzaWZpY2F0aW9uUmVzdWx0KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBwZXJtaXNzaW9uczogbnVtYmVyO1xuICAgICAgXG4gICAgICBzd2l0Y2ggKGNsYXNzaWZpY2F0aW9uLmZpbGVUeXBlKSB7XG4gICAgICAgIGNhc2UgJ3NjcmlwdCc6XG4gICAgICAgICAgcGVybWlzc2lvbnMgPSAwbzc1NTsgLy8g5a6f6KGM5Y+v6IO9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2NvbmZpZyc6XG4gICAgICAgICAgaWYgKGZpbGVQYXRoLmluY2x1ZGVzKCdzZWNyZXQnKSB8fCBmaWxlUGF0aC5pbmNsdWRlcygnZW52JykpIHtcbiAgICAgICAgICAgIHBlcm1pc3Npb25zID0gMG82MDA7IC8vIOapn+WvhuODleOCoeOCpOODq1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZXJtaXNzaW9ucyA9IDBvNjQ0OyAvLyDkuIDoiKzoqK3lrppcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgcGVybWlzc2lvbnMgPSAwbzY0NDsgLy8g44OH44OV44Kp44Or44OIXG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IGZzLmNobW9kKGZpbGVQYXRoLCBwZXJtaXNzaW9ucyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUud2Fybihg4pqg77iPIOaoqemZkOioreWumuOBq+WkseaVlzogJHtmaWxlUGF0aH0gLSAke2Vycm9yfWApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg4fjgqPjgrnjgq/lrrnph4/jgpLjg4Hjgqfjg4Pjgq9cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgY2hlY2tEaXNrU3BhY2UoZmlsZXM6IEZpbGVJbmZvW10pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCB0b3RhbFNpemUgPSBmaWxlcy5yZWR1Y2UoKHN1bSwgZmlsZSkgPT4gc3VtICsgZmlsZS5zaXplLCAwKTtcbiAgICBjb25zdCB0b3RhbFNpemVNQiA9IE1hdGgucm91bmQodG90YWxTaXplIC8gMTAyNCAvIDEwMjQpO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKGDwn5K+IOenu+WLleS6iOWumuODleOCoeOCpOODq+OCteOCpOOCujogJHt0b3RhbFNpemVNQn1NQmApO1xuICAgIFxuICAgIC8vIOewoeaYk+eahOOBquWuuemHj+ODgeOCp+ODg+OCr++8iOWun+mam+OBruWun+ijheOBp+OBr+OCiOOCiuips+e0sOOBqueiuuiqjeOBjOW/heimge+8iVxuICAgIGlmICh0b3RhbFNpemUgPiAxMDI0ICogMTAyNCAqIDEwMjQpIHsgLy8gMUdC5Lul5LiKXG4gICAgICBjb25zb2xlLndhcm4oJ+KaoO+4jyDlpKflrrnph4/jg5XjgqHjgqTjg6vjga7np7vli5XjgafjgZnjgILljYHliIbjgarnqbrjgY3lrrnph4/jgYzjgYLjgovjgZPjgajjgpLnorroqo3jgZfjgabjgY/jgaDjgZXjgYTjgIInKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog6YCy5o2X6L+96Leh44KS5Yid5pyf5YyWXG4gICAqL1xuICBwcml2YXRlIGluaXRpYWxpemVQcm9ncmVzcyhmaWxlczogRmlsZUluZm9bXSwgc3RhcnRUaW1lOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLm1vdmVQcm9ncmVzcyA9IHtcbiAgICAgIGN1cnJlbnRGaWxlOiAnJyxcbiAgICAgIHByb2Nlc3NlZEZpbGVzOiAwLFxuICAgICAgdG90YWxGaWxlczogZmlsZXMubGVuZ3RoLFxuICAgICAgcHJvZ3Jlc3NQZXJjZW50YWdlOiAwLFxuICAgICAgc3VjY2Vzc2Z1bE1vdmVzOiAwLFxuICAgICAgZmFpbGVkTW92ZXM6IDAsXG4gICAgICBzdGFydFRpbWU6IG5ldyBEYXRlKHN0YXJ0VGltZSlcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOmAsuaNl+OCkuabtOaWsFxuICAgKi9cbiAgcHJpdmF0ZSB1cGRhdGVQcm9ncmVzcyhjdXJyZW50RmlsZTogc3RyaW5nLCBwcm9jZXNzZWRGaWxlczogbnVtYmVyKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLm1vdmVQcm9ncmVzcykgcmV0dXJuO1xuXG4gICAgdGhpcy5tb3ZlUHJvZ3Jlc3MuY3VycmVudEZpbGUgPSBjdXJyZW50RmlsZTtcbiAgICB0aGlzLm1vdmVQcm9ncmVzcy5wcm9jZXNzZWRGaWxlcyA9IHByb2Nlc3NlZEZpbGVzO1xuICAgIHRoaXMubW92ZVByb2dyZXNzLnByb2dyZXNzUGVyY2VudGFnZSA9IE1hdGgucm91bmQoKHByb2Nlc3NlZEZpbGVzIC8gdGhpcy5tb3ZlUHJvZ3Jlc3MudG90YWxGaWxlcykgKiAxMDApO1xuXG4gICAgLy8g5o6o5a6a5q6L44KK5pmC6ZaT44Gu6KiI566XXG4gICAgaWYgKHByb2Nlc3NlZEZpbGVzID4gMCkge1xuICAgICAgY29uc3QgZWxhcHNlZFRpbWUgPSBEYXRlLm5vdygpIC0gdGhpcy5tb3ZlUHJvZ3Jlc3Muc3RhcnRUaW1lLmdldFRpbWUoKTtcbiAgICAgIGNvbnN0IGF2ZXJhZ2VUaW1lUGVyRmlsZSA9IGVsYXBzZWRUaW1lIC8gcHJvY2Vzc2VkRmlsZXM7XG4gICAgICBjb25zdCByZW1haW5pbmdGaWxlcyA9IHRoaXMubW92ZVByb2dyZXNzLnRvdGFsRmlsZXMgLSBwcm9jZXNzZWRGaWxlcztcbiAgICAgIHRoaXMubW92ZVByb2dyZXNzLmVzdGltYXRlZFRpbWVSZW1haW5pbmcgPSBNYXRoLnJvdW5kKGF2ZXJhZ2VUaW1lUGVyRmlsZSAqIHJlbWFpbmluZ0ZpbGVzKTtcbiAgICB9XG5cbiAgICAvLyDjgrPjg7zjg6vjg5Djg4Pjgq/lrp/ooYxcbiAgICBpZiAodGhpcy5wcm9ncmVzc0NhbGxiYWNrKSB7XG4gICAgICB0aGlzLnByb2dyZXNzQ2FsbGJhY2sodGhpcy5tb3ZlUHJvZ3Jlc3MpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg4njg6njgqTjg6njg7PntZDmnpzjgpLkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlRHJ5UnVuUmVzdWx0KGZpbGVzOiBGaWxlSW5mb1tdLCBjbGFzc2lmaWNhdGlvbnM6IENsYXNzaWZpY2F0aW9uUmVzdWx0W10pOiBNb3ZlUmVzdWx0IHtcbiAgICBjb25zdCBtb3ZlZEZpbGVzID0gZmlsZXMubWFwKChmaWxlLCBpbmRleCkgPT4gKHtcbiAgICAgIG9yaWdpbmFsUGF0aDogZmlsZS5wYXRoLFxuICAgICAgbmV3UGF0aDogdGhpcy5nZW5lcmF0ZVRhcmdldFBhdGgoZmlsZSwgY2xhc3NpZmljYXRpb25zW2luZGV4XSksXG4gICAgICBzaXplOiBmaWxlLnNpemVcbiAgICB9KSk7XG5cbiAgICBjb25zdCBzdGF0aXN0aWNzOiBNb3ZlU3RhdGlzdGljcyA9IHtcbiAgICAgIHRvdGFsRmlsZXM6IGZpbGVzLmxlbmd0aCxcbiAgICAgIHN1Y2Nlc3NmdWxNb3ZlczogZmlsZXMubGVuZ3RoLFxuICAgICAgZmFpbGVkTW92ZXM6IDAsXG4gICAgICBza2lwcGVkRmlsZXM6IDAsXG4gICAgICBwcm9jZXNzaW5nVGltZTogMCxcbiAgICAgIHRvdGFsTW92ZWRTaXplOiBmaWxlcy5yZWR1Y2UoKHN1bSwgZmlsZSkgPT4gc3VtICsgZmlsZS5zaXplLCAwKSxcbiAgICAgIGF2ZXJhZ2VNb3ZlVGltZTogMCxcbiAgICAgIGVycm9yczogW11cbiAgICB9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBtb3ZlZEZpbGVzLFxuICAgICAgZmFpbGVkRmlsZXM6IFtdLFxuICAgICAgc3RhdGlzdGljcyxcbiAgICAgIGVudmlyb25tZW50OiB0aGlzLmVudmlyb25tZW50LFxuICAgICAgcHJvY2Vzc2luZ1RpbWU6IDBcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOenu+WLlee1kOaenOOCkuaknOiovFxuICAgKi9cbiAgcHVibGljIGFzeW5jIHZlcmlmeU1vdmVSZXN1bHRzKG1vdmVSZXN1bHQ6IE1vdmVSZXN1bHQpOiBQcm9taXNlPHtcbiAgICB2ZXJpZmllZDogYm9vbGVhbjtcbiAgICBtaXNzaW5nRmlsZXM6IHN0cmluZ1tdO1xuICAgIGNvcnJ1cHRlZEZpbGVzOiBzdHJpbmdbXTtcbiAgICBwZXJtaXNzaW9uSXNzdWVzOiBzdHJpbmdbXTtcbiAgfT4ge1xuICAgIGNvbnNvbGUubG9nKCfwn5SNIOenu+WLlee1kOaenOOCkuaknOiovOS4rS4uLicpO1xuXG4gICAgY29uc3QgbWlzc2luZ0ZpbGVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IGNvcnJ1cHRlZEZpbGVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IHBlcm1pc3Npb25Jc3N1ZXM6IHN0cmluZ1tdID0gW107XG5cbiAgICBmb3IgKGNvbnN0IG1vdmVkRmlsZSBvZiBtb3ZlUmVzdWx0Lm1vdmVkRmlsZXMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIC8vIOODleOCoeOCpOODq+WtmOWcqOeiuuiqjVxuICAgICAgICBjb25zdCBzdGF0cyA9IGF3YWl0IGZzLnN0YXQobW92ZWRGaWxlLm5ld1BhdGgpO1xuICAgICAgICBcbiAgICAgICAgLy8g44OV44Kh44Kk44Or44K144Kk44K656K66KqNXG4gICAgICAgIGlmIChzdGF0cy5zaXplICE9PSBtb3ZlZEZpbGUuc2l6ZSkge1xuICAgICAgICAgIGNvcnJ1cHRlZEZpbGVzLnB1c2goYCR7bW92ZWRGaWxlLm5ld1BhdGh9ICjjgrXjgqTjgrrkuI3kuIDoh7Q6IOacn+W+heWApCR7bW92ZWRGaWxlLnNpemV9LCDlrp/pmpske3N0YXRzLnNpemV9KWApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8g5qip6ZmQ56K66KqN77yI57Ch5piT77yJXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgYXdhaXQgZnMuYWNjZXNzKG1vdmVkRmlsZS5uZXdQYXRoLCBmcy5jb25zdGFudHMuUl9PSyk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIHBlcm1pc3Npb25Jc3N1ZXMucHVzaChgJHttb3ZlZEZpbGUubmV3UGF0aH0gKOiqreOBv+WPluOCiuaoqemZkOOBquOBlylgKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIG1pc3NpbmdGaWxlcy5wdXNoKG1vdmVkRmlsZS5uZXdQYXRoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB2ZXJpZmllZCA9IG1pc3NpbmdGaWxlcy5sZW5ndGggPT09IDAgJiYgY29ycnVwdGVkRmlsZXMubGVuZ3RoID09PSAwICYmIHBlcm1pc3Npb25Jc3N1ZXMubGVuZ3RoID09PSAwO1xuXG4gICAgaWYgKHZlcmlmaWVkKSB7XG4gICAgICBjb25zb2xlLmxvZygn4pyFIOenu+WLlee1kOaenOaknOiovOWujOS6hjog5ZWP6aGM44Gq44GXJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUud2Fybihg4pqg77iPIOenu+WLlee1kOaenOaknOiovOOBp+WVj+mhjOOCkuaknOWHujog5LiN6LazJHttaXNzaW5nRmlsZXMubGVuZ3RofeWAiywg56C05pCNJHtjb3JydXB0ZWRGaWxlcy5sZW5ndGh95YCLLCDmqKnpmZAke3Blcm1pc3Npb25Jc3N1ZXMubGVuZ3RofeWAi2ApO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICB2ZXJpZmllZCxcbiAgICAgIG1pc3NpbmdGaWxlcyxcbiAgICAgIGNvcnJ1cHRlZEZpbGVzLFxuICAgICAgcGVybWlzc2lvbklzc3Vlc1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog56e75YuV57Wx6KiI44Os44Od44O844OI44KS55Sf5oiQXG4gICAqL1xuICBwdWJsaWMgZ2VuZXJhdGVNb3ZlUmVwb3J0KG1vdmVSZXN1bHQ6IE1vdmVSZXN1bHQpOiBzdHJpbmcge1xuICAgIGNvbnN0IHN0YXRzID0gbW92ZVJlc3VsdC5zdGF0aXN0aWNzO1xuICAgIGNvbnN0IHN1Y2Nlc3NSYXRlID0gTWF0aC5yb3VuZCgoc3RhdHMuc3VjY2Vzc2Z1bE1vdmVzIC8gc3RhdHMudG90YWxGaWxlcykgKiAxMDApO1xuICAgIFxuICAgIHJldHVybiBgXG4jIOODreODvOOCq+ODq+ODleOCoeOCpOODq+enu+WLleODrOODneODvOODiFxuXG4jIyDlrp/ooYzjgrXjg57jg6rjg7xcbi0gKirlrp/ooYzml6XmmYIqKjogJHtuZXcgRGF0ZSgpLnRvTG9jYWxlU3RyaW5nKCdqYS1KUCcpfVxuLSAqKuWHpueQhuODleOCoeOCpOODq+aVsCoqOiAke3N0YXRzLnRvdGFsRmlsZXN95YCLXG4tICoq5oiQ5YqfKio6ICR7c3RhdHMuc3VjY2Vzc2Z1bE1vdmVzfeWAi1xuLSAqKuWkseaVlyoqOiAke3N0YXRzLmZhaWxlZE1vdmVzfeWAi1xuLSAqKuaIkOWKn+eOhyoqOiAke3N1Y2Nlc3NSYXRlfSVcbi0gKirlh6bnkIbmmYLplpMqKjogJHtNYXRoLnJvdW5kKHN0YXRzLnByb2Nlc3NpbmdUaW1lIC8gMTAwMCl956eSXG4tICoq56e75YuV44OH44O844K/44K144Kk44K6Kio6ICR7TWF0aC5yb3VuZChzdGF0cy50b3RhbE1vdmVkU2l6ZSAvIDEwMjQgLyAxMDI0KX1NQlxuXG4jIyDjg5Hjg5Xjgqnjg7zjg57jg7Pjgrlcbi0gKirlubPlnYfnp7vli5XmmYLplpMqKjogJHtNYXRoLnJvdW5kKHN0YXRzLmF2ZXJhZ2VNb3ZlVGltZSl9bXMv44OV44Kh44Kk44OrXG4tICoq44K544Or44O844OX44OD44OIKio6ICR7TWF0aC5yb3VuZChzdGF0cy50b3RhbEZpbGVzIC8gKHN0YXRzLnByb2Nlc3NpbmdUaW1lIC8gMTAwMCkpfeODleOCoeOCpOODqy/np5JcblxuIyMg44Ko44Op44O86Kmz57SwXG4ke3N0YXRzLmVycm9ycy5sZW5ndGggPiAwID8gXG4gIHN0YXRzLmVycm9ycy5tYXAoZXJyb3IgPT4gYC0gJHtlcnJvci5maWxlfTogJHtlcnJvci5lcnJvcn1gKS5qb2luKCdcXG4nKSA6IFxuICAnLSDjgqjjg6njg7zjgarjgZcnXG59XG5cbiMjIOenu+WLleOBleOCjOOBn+ODleOCoeOCpOODq1xuJHttb3ZlUmVzdWx0Lm1vdmVkRmlsZXMuc2xpY2UoMCwgMTApLm1hcChmaWxlID0+IFxuICBgLSAke3BhdGguYmFzZW5hbWUoZmlsZS5vcmlnaW5hbFBhdGgpfSDihpIgJHtmaWxlLm5ld1BhdGh9YFxuKS5qb2luKCdcXG4nKX1cbiR7bW92ZVJlc3VsdC5tb3ZlZEZpbGVzLmxlbmd0aCA+IDEwID8gYFxcbi4uLiDku5Yke21vdmVSZXN1bHQubW92ZWRGaWxlcy5sZW5ndGggLSAxMH3lgItgIDogJyd9XG5gO1xuICB9XG59Il19