"use strict";
/**
 * 統合ファイル整理システム - EC2ファイル移動器
 *
 * EC2環境でのファイル移動機能を提供し、
 * SSH経由での安全なリモートファイル移動を実行します。
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
exports.EC2FileMover = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path = __importStar(require("path"));
const index_js_1 = require("../types/index.js");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * EC2ファイル移動器
 *
 * SSH経由でEC2環境のファイル移動を安全に実行し、
 * リモート移動結果の検証機能を提供します。
 */
class EC2FileMover {
    environment = 'ec2';
    sshConfig;
    maxRetries = 3;
    batchSize = 10; // 一度に処理するファイル数
    constructor(sshConfig) {
        this.sshConfig = sshConfig;
    }
    /**
     * 複数ファイルを一括移動
     */
    async moveFiles(files, classifications, options = {}) {
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
                    newPath: r.newPath,
                    size: r.fileSize
                })),
                failedFiles: failedMoves.map(r => ({
                    path: r.originalPath,
                    error: r.error
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
                    errors: failedMoves.map(r => ({ file: r.originalPath, error: r.error }))
                },
                environment: this.environment,
                processingTime
            };
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.MOVE_FAILED, `EC2ファイル移動に失敗しました: ${error}`, undefined, this.environment, error);
        }
    }
    /**
     * 単一ファイルを移動
     */
    async moveSingleFile(file, classification, options = {}) {
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
        }
        catch (error) {
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
    async executeBatchMove(files, classifications, options) {
        const batches = [];
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
    async executeSingleBatch(files, classifications, options, batchIndex) {
        const batchId = `batch-${batchIndex}-${Date.now()}`;
        const startTime = Date.now();
        const results = [];
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
            }
            catch (error) {
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
    async validateRemoteMoveOperation(files, classifications, options) {
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
    async executeRemoteFileMove(sourcePath, targetPath, options) {
        let command;
        if (options.copyInsteadOfMove) {
            command = `cp "${sourcePath}" "${targetPath}"`;
        }
        else {
            command = `mv "${sourcePath}" "${targetPath}"`;
        }
        await this.executeSSHCommand(command);
    }
    /**
     * リモートディレクトリの存在確認・作成
     */
    async ensureRemoteDirectoryExists(dirPath) {
        try {
            await this.executeSSHCommand(`test -d "${dirPath}"`);
        }
        catch {
            await this.executeSSHCommand(`mkdir -p "${dirPath}"`);
            console.log(`📁 リモートディレクトリ作成: ${dirPath}`);
        }
    }
    /**
     * リモートファイル名の重複を解決
     */
    async resolveRemoteFileNameConflict(targetPath, options) {
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
            let newPath;
            do {
                newPath = path.join(dir, `${baseName}_${counter}${ext}`);
                counter++;
                try {
                    await this.executeSSHCommand(`test -f "${newPath}"`);
                }
                catch {
                    break; // ファイルが存在しない場合は使用可能
                }
            } while (counter < 1000); // 無限ループ防止
            console.log(`📝 リモートファイル名重複回避: ${targetPath} → ${newPath}`);
            return newPath;
        }
        catch {
            // ファイルが存在しない場合はそのまま使用
            return targetPath;
        }
    }
    /**
     * リモートファイル権限を設定
     */
    async setRemoteFilePermissions(filePath, classification) {
        try {
            let permissions;
            switch (classification.fileType) {
                case 'script':
                    permissions = '755'; // 実行可能
                    break;
                case 'config':
                    if (filePath.includes('secret') || filePath.includes('env')) {
                        permissions = '600'; // 機密ファイル
                    }
                    else {
                        permissions = '644'; // 一般設定
                    }
                    break;
                default:
                    permissions = '644'; // デフォルト
                    break;
            }
            await this.executeSSHCommand(`chmod ${permissions} "${filePath}"`);
        }
        catch (error) {
            console.warn(`⚠️ リモート権限設定に失敗: ${filePath} - ${error}`);
        }
    }
    /**
     * リモート移動先パスを生成
     */
    generateRemoteTargetPath(file, classification) {
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
    async checkRemoteFileExists(filePath) {
        try {
            await this.executeSSHCommand(`test -f "${filePath}"`);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * リモートディスク容量確認
     */
    async checkRemoteDiskSpace(files) {
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
        }
        catch (error) {
            console.warn(`⚠️ リモートディスク容量確認に失敗: ${error}`);
        }
    }
    /**
     * リモート移動結果を検証
     */
    async verifyRemoteMoves(results) {
        console.log('🔍 リモート移動結果を検証中...');
        let verificationErrors = 0;
        const sampleSize = Math.min(10, results.length); // サンプリング検証
        const sampleResults = results.slice(0, sampleSize);
        for (const result of sampleResults) {
            try {
                await this.verifyRemoteFileMove(result.originalPath, result.newPath, result.fileSize);
            }
            catch (error) {
                verificationErrors++;
                console.warn(`⚠️ 検証エラー: ${result.newPath} - ${error}`);
            }
        }
        if (verificationErrors === 0) {
            console.log('✅ リモート移動結果検証完了: 問題なし');
        }
        else {
            console.warn(`⚠️ リモート移動結果検証で${verificationErrors}個の問題を検出`);
        }
    }
    /**
     * 単一リモートファイル移動を検証
     */
    async verifyRemoteFileMove(originalPath, newPath, expectedSize) {
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
        }
        catch (error) {
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
    async testConnection() {
        try {
            await this.executeSSHCommand('echo "connection test"');
            console.log('✅ EC2接続テスト成功');
        }
        catch (error) {
            throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.SSH_CONNECTION_FAILED, `EC2接続テストに失敗しました: ${error}`, undefined, this.environment, error);
        }
    }
    /**
     * SSH コマンドを実行
     */
    async executeSSHCommand(command) {
        const sshCommand = `ssh -i "${this.sshConfig.keyPath}" -o ConnectTimeout=${this.sshConfig.timeout / 1000} -o StrictHostKeyChecking=no -p ${this.sshConfig.port} ${this.sshConfig.user}@${this.sshConfig.host} "${command}"`;
        try {
            const result = await execAsync(sshCommand, {
                timeout: this.sshConfig.timeout,
                maxBuffer: 1024 * 1024 * 10 // 10MB
            });
            return result;
        }
        catch (error) {
            if (error.code === 'ETIMEDOUT') {
                throw new index_js_1.OrganizationError(index_js_1.OrganizationErrorType.SSH_CONNECTION_FAILED, `SSH接続がタイムアウトしました: ${this.sshConfig.host}`, undefined, this.environment, error);
            }
            throw error;
        }
    }
    /**
     * ドライラン結果を作成
     */
    createDryRunResult(files, classifications) {
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
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * EC2移動統計レポートを生成
     */
    generateEC2MoveReport(moveResult) {
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
            '- エラーなし'}

## 移動されたファイル（上位10件）
${moveResult.movedFiles.slice(0, 10).map(file => `- ${path.basename(file.originalPath)} → ${file.newPath}`).join('\n')}
${moveResult.movedFiles.length > 10 ? `\n... 他${moveResult.movedFiles.length - 10}個` : ''}

## SSH接続情報
- **ホスト**: ${this.sshConfig.host}
- **ポート**: ${this.sshConfig.port}
- **ユーザー**: ${this.sshConfig.user}
- **タイムアウト**: ${this.sshConfig.timeout}ms
`;
    }
}
exports.EC2FileMover = EC2FileMover;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWMyLWZpbGUtbW92ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJlYzItZmlsZS1tb3Zlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7O0dBS0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsaURBQXFDO0FBQ3JDLCtCQUFpQztBQUNqQywyQ0FBNkI7QUFDN0IsZ0RBUzJCO0FBRzNCLE1BQU0sU0FBUyxHQUFHLElBQUEsZ0JBQVMsRUFBQyxvQkFBSSxDQUFDLENBQUM7QUFvQ2xDOzs7OztHQUtHO0FBQ0gsTUFBYSxZQUFZO0lBQ04sV0FBVyxHQUFnQixLQUFLLENBQUM7SUFDakMsU0FBUyxDQUFZO0lBQ3JCLFVBQVUsR0FBVyxDQUFDLENBQUM7SUFDdkIsU0FBUyxHQUFXLEVBQUUsQ0FBQyxDQUFDLGVBQWU7SUFFeEQsWUFBWSxTQUFvQjtRQUM5QixJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQztJQUM3QixDQUFDO0lBRUQ7O09BRUc7SUFDSSxLQUFLLENBQUMsU0FBUyxDQUNwQixLQUFpQixFQUNqQixlQUF1QyxFQUN2QyxVQUF1QixFQUFFO1FBRXpCLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUM3QixPQUFPLENBQUMsR0FBRyxDQUFDLFlBQVksS0FBSyxDQUFDLE1BQU0sZ0JBQWdCLENBQUMsQ0FBQztRQUV0RCxJQUFJLENBQUM7WUFDSCxRQUFRO1lBQ1IsTUFBTSxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFFNUIsU0FBUztZQUNULE1BQU0sSUFBSSxDQUFDLDJCQUEyQixDQUFDLEtBQUssRUFBRSxlQUFlLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFFeEUsY0FBYztZQUNkLElBQUksT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUNuQixPQUFPLENBQUMsR0FBRyxDQUFDLDBCQUEwQixDQUFDLENBQUM7Z0JBQ3hDLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUFDLEtB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SUFBSSxDQUFDLElBQUksQ0FBQztFQUNWLFVBQVUsQ0FBQyxVQUFVLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsVUFBVSxVQUFVLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRTs7O2FBRzVFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSTthQUNuQixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUk7Y0FDbEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJO2dCQUNqQixJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU87Q0FDckMsQ0FBQztJQUNBLENBQUM7Q0FDRjtBQXhrQkQsb0NBd2tCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICog57Wx5ZCI44OV44Kh44Kk44Or5pW055CG44K344K544OG44OgIC0gRUMy44OV44Kh44Kk44Or56e75YuV5ZmoXG4gKiBcbiAqIEVDMueSsOWig+OBp+OBruODleOCoeOCpOODq+enu+WLleapn+iDveOCkuaPkOS+m+OBl+OAgVxuICogU1NI57WM55Sx44Gn44Gu5a6J5YWo44Gq44Oq44Oi44O844OI44OV44Kh44Kk44Or56e75YuV44KS5a6f6KGM44GX44G+44GZ44CCXG4gKi9cblxuaW1wb3J0IHsgZXhlYyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAndXRpbCc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgXG4gIEZpbGVNb3ZlcixcbiAgRmlsZUluZm8sXG4gIENsYXNzaWZpY2F0aW9uUmVzdWx0LFxuICBNb3ZlUmVzdWx0LFxuICBNb3ZlT3B0aW9ucyxcbiAgRW52aXJvbm1lbnQsXG4gIE9yZ2FuaXphdGlvbkVycm9yLFxuICBPcmdhbml6YXRpb25FcnJvclR5cGVcbn0gZnJvbSAnLi4vdHlwZXMvaW5kZXguanMnO1xuaW1wb3J0IHsgU1NIQ29uZmlnIH0gZnJvbSAnLi4vc2Nhbm5lcnMvZWMyLXNjYW5uZXIuanMnO1xuXG5jb25zdCBleGVjQXN5bmMgPSBwcm9taXNpZnkoZXhlYyk7XG5cbi8qKlxuICog44Oq44Oi44O844OI56e75YuV57WQ5p6cXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUmVtb3RlTW92ZVJlc3VsdCB7XG4gIC8qKiDnp7vli5XmiJDlip/jgZfjgZ/jgYsgKi9cbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgLyoqIOenu+WLleWJjeOBruODkeOCuSAqL1xuICBvcmlnaW5hbFBhdGg6IHN0cmluZztcbiAgLyoqIOenu+WLleW+jOOBruODkeOCuSAqL1xuICBuZXdQYXRoPzogc3RyaW5nO1xuICAvKiog44Ko44Op44O844Oh44OD44K744O844K4ICovXG4gIGVycm9yPzogc3RyaW5nO1xuICAvKiog56e75YuV44Gr44GL44GL44Gj44Gf5pmC6ZaT77yI44Of44Oq56eS77yJICovXG4gIG1vdmVUaW1lOiBudW1iZXI7XG4gIC8qKiDjg5XjgqHjgqTjg6vjgrXjgqTjgrogKi9cbiAgZmlsZVNpemU6IG51bWJlcjtcbn1cblxuLyoqXG4gKiDjg5Djg4Pjg4Hnp7vli5XntZDmnpxcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBCYXRjaE1vdmVSZXN1bHQge1xuICAvKiog44OQ44OD44OBSUQgKi9cbiAgYmF0Y2hJZDogc3RyaW5nO1xuICAvKiog5oiQ5Yqf44GX44Gf56e75YuV5pWwICovXG4gIHN1Y2Nlc3NDb3VudDogbnVtYmVyO1xuICAvKiog5aSx5pWX44GX44Gf56e75YuV5pWwICovXG4gIGZhaWx1cmVDb3VudDogbnVtYmVyO1xuICAvKiog5YCL5Yil57WQ5p6cICovXG4gIHJlc3VsdHM6IFJlbW90ZU1vdmVSZXN1bHRbXTtcbiAgLyoqIOe3j+WHpueQhuaZgumWkyAqL1xuICB0b3RhbFRpbWU6IG51bWJlcjtcbn1cblxuLyoqXG4gKiBFQzLjg5XjgqHjgqTjg6vnp7vli5XlmahcbiAqIFxuICogU1NI57WM55Sx44GnRUMy55Kw5aKD44Gu44OV44Kh44Kk44Or56e75YuV44KS5a6J5YWo44Gr5a6f6KGM44GX44CBXG4gKiDjg6rjg6Ljg7zjg4jnp7vli5XntZDmnpzjga7mpJzoqLzmqZ/og73jgpLmj5DkvpvjgZfjgb7jgZnjgIJcbiAqL1xuZXhwb3J0IGNsYXNzIEVDMkZpbGVNb3ZlciBpbXBsZW1lbnRzIEZpbGVNb3ZlciB7XG4gIHByaXZhdGUgcmVhZG9ubHkgZW52aXJvbm1lbnQ6IEVudmlyb25tZW50ID0gJ2VjMic7XG4gIHByaXZhdGUgcmVhZG9ubHkgc3NoQ29uZmlnOiBTU0hDb25maWc7XG4gIHByaXZhdGUgcmVhZG9ubHkgbWF4UmV0cmllczogbnVtYmVyID0gMztcbiAgcHJpdmF0ZSByZWFkb25seSBiYXRjaFNpemU6IG51bWJlciA9IDEwOyAvLyDkuIDluqbjgavlh6bnkIbjgZnjgovjg5XjgqHjgqTjg6vmlbBcblxuICBjb25zdHJ1Y3Rvcihzc2hDb25maWc6IFNTSENvbmZpZykge1xuICAgIHRoaXMuc3NoQ29uZmlnID0gc3NoQ29uZmlnO1xuICB9XG5cbiAgLyoqXG4gICAqIOikh+aVsOODleOCoeOCpOODq+OCkuS4gOaLrOenu+WLlVxuICAgKi9cbiAgcHVibGljIGFzeW5jIG1vdmVGaWxlcyhcbiAgICBmaWxlczogRmlsZUluZm9bXSwgXG4gICAgY2xhc3NpZmljYXRpb25zOiBDbGFzc2lmaWNhdGlvblJlc3VsdFtdLCBcbiAgICBvcHRpb25zOiBNb3ZlT3B0aW9ucyA9IHt9XG4gICk6IFByb21pc2U8TW92ZVJlc3VsdD4ge1xuICAgIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgY29uc29sZS5sb2coYPCfjJAgRUMy55Kw5aKD44GnJHtmaWxlcy5sZW5ndGh95YCL44Gu44OV44Kh44Kk44Or56e75YuV44KS6ZaL5aeLLi4uYCk7XG5cbiAgICB0cnkge1xuICAgICAgLy8g5o6l57aa44OG44K544OIXG4gICAgICBhd2FpdCB0aGlzLnRlc3RDb25uZWN0aW9uKCk7XG5cbiAgICAgIC8vIOenu+WLleWJjeOBruaknOiovFxuICAgICAgYXdhaXQgdGhpcy52YWxpZGF0ZVJlbW90ZU1vdmVPcGVyYXRpb24oZmlsZXMsIGNsYXNzaWZpY2F0aW9ucywgb3B0aW9ucyk7XG5cbiAgICAgIC8vIOODieODqeOCpOODqeODs+ODouODvOODieOBrueiuuiqjVxuICAgICAgaWYgKG9wdGlvbnMuZHJ5UnVuKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCfwn5SNIOODieODqeOCpOODqeODs+ODouODvOODiTog5a6f6Zqb44Gu56e75YuV44Gv6KGM44GE44G+44Gb44KTJyk7XG4gICAgICAgIHJldHVybiB0aGlzLmNyZWF0ZURyeVJ1blJlc3VsdChmaWxlcywgY2xhc3NpZmljYXRpb25zKTtcbiAgICAgIH1cblxuICAgICAgLy8g44OQ44OD44OB5Yem55CG44Gn56e75YuV5a6f6KGMXG4gICAgICBjb25zdCBiYXRjaFJlc3VsdHMgPSBhd2FpdCB0aGlzLmV4ZWN1dGVCYXRjaE1vdmUoZmlsZXMsIGNsYXNzaWZpY2F0aW9ucywgb3B0aW9ucyk7XG5cbiAgICAgIC8vIOe1kOaenOOBrumbhuioiFxuICAgICAgY29uc3QgYWxsUmVzdWx0cyA9IGJhdGNoUmVzdWx0cy5mbGF0TWFwKGJhdGNoID0+IGJhdGNoLnJlc3VsdHMpO1xuICAgICAgY29uc3Qgc3VjY2Vzc2Z1bE1vdmVzID0gYWxsUmVzdWx0cy5maWx0ZXIociA9PiByLnN1Y2Nlc3MpO1xuICAgICAgY29uc3QgZmFpbGVkTW92ZXMgPSBhbGxSZXN1bHRzLmZpbHRlcihyID0+ICFyLnN1Y2Nlc3MpO1xuXG4gICAgICBjb25zdCBwcm9jZXNzaW5nVGltZSA9IERhdGUubm93KCkgLSBzdGFydFRpbWU7XG4gICAgICBjb25zdCB0b3RhbE1vdmVkU2l6ZSA9IHN1Y2Nlc3NmdWxNb3Zlcy5yZWR1Y2UoKHN1bSwgcikgPT4gc3VtICsgci5maWxlU2l6ZSwgMCk7XG5cbiAgICAgIC8vIOenu+WLlee1kOaenOOBruaknOiovFxuICAgICAgaWYgKHN1Y2Nlc3NmdWxNb3Zlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGF3YWl0IHRoaXMudmVyaWZ5UmVtb3RlTW92ZXMoc3VjY2Vzc2Z1bE1vdmVzKTtcbiAgICAgIH1cblxuICAgICAgY29uc29sZS5sb2coYCR7c3VjY2Vzc2Z1bE1vdmVzLmxlbmd0aCA+IDAgPyAn4pyFJyA6ICfimqDvuI8nfSBFQzLjg5XjgqHjgqTjg6vnp7vli5XlrozkuoY6ICR7c3VjY2Vzc2Z1bE1vdmVzLmxlbmd0aH0vJHtmaWxlcy5sZW5ndGh95YCL5oiQ5YqfICgke3Byb2Nlc3NpbmdUaW1lfW1zKWApO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiBmYWlsZWRNb3Zlcy5sZW5ndGggPT09IDAsXG4gICAgICAgIG1vdmVkRmlsZXM6IHN1Y2Nlc3NmdWxNb3Zlcy5tYXAociA9PiAoe1xuICAgICAgICAgIG9yaWdpbmFsUGF0aDogci5vcmlnaW5hbFBhdGgsXG4gICAgICAgICAgbmV3UGF0aDogci5uZXdQYXRoISxcbiAgICAgICAgICBzaXplOiByLmZpbGVTaXplXG4gICAgICAgIH0pKSxcbiAgICAgICAgZmFpbGVkRmlsZXM6IGZhaWxlZE1vdmVzLm1hcChyID0+ICh7XG4gICAgICAgICAgcGF0aDogci5vcmlnaW5hbFBhdGgsXG4gICAgICAgICAgZXJyb3I6IHIuZXJyb3IhXG4gICAgICAgIH0pKSxcbiAgICAgICAgc3RhdGlzdGljczoge1xuICAgICAgICAgIHRvdGFsRmlsZXM6IGZpbGVzLmxlbmd0aCxcbiAgICAgICAgICBzdWNjZXNzZnVsTW92ZXM6IHN1Y2Nlc3NmdWxNb3Zlcy5sZW5ndGgsXG4gICAgICAgICAgZmFpbGVkTW92ZXM6IGZhaWxlZE1vdmVzLmxlbmd0aCxcbiAgICAgICAgICBza2lwcGVkRmlsZXM6IDAsXG4gICAgICAgICAgcHJvY2Vzc2luZ1RpbWUsXG4gICAgICAgICAgdG90YWxNb3ZlZFNpemUsXG4gICAgICAgICAgYXZlcmFnZU1vdmVUaW1lOiBzdWNjZXNzZnVsTW92ZXMubGVuZ3RoID4gMCA/IFxuICAgICAgICAgICAgc3VjY2Vzc2Z1bE1vdmVzLnJlZHVjZSgoc3VtLCByKSA9PiBzdW0gKyByLm1vdmVUaW1lLCAwKSAvIHN1Y2Nlc3NmdWxNb3Zlcy5sZW5ndGggOiAwLFxuICAgICAgICAgIGVycm9yczogZmFpbGVkTW92ZXMubWFwKHIgPT4gKHsgZmlsZTogci5vcmlnaW5hbFBhdGgsIGVycm9yOiByLmVycm9yISB9KSlcbiAgICAgICAgfSxcbiAgICAgICAgZW52aXJvbm1lbnQ6IHRoaXMuZW52aXJvbm1lbnQsXG4gICAgICAgIHByb2Nlc3NpbmdUaW1lXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgT3JnYW5pemF0aW9uRXJyb3IoXG4gICAgICAgIE9yZ2FuaXphdGlvbkVycm9yVHlwZS5NT1ZFX0ZBSUxFRCxcbiAgICAgICAgYEVDMuODleOCoeOCpOODq+enu+WLleOBq+WkseaVl+OBl+OBvuOBl+OBnzogJHtlcnJvcn1gLFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgIHRoaXMuZW52aXJvbm1lbnQsXG4gICAgICAgIGVycm9yIGFzIEVycm9yXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDljZjkuIDjg5XjgqHjgqTjg6vjgpLnp7vli5VcbiAgICovXG4gIHB1YmxpYyBhc3luYyBtb3ZlU2luZ2xlRmlsZShcbiAgICBmaWxlOiBGaWxlSW5mbywgXG4gICAgY2xhc3NpZmljYXRpb246IENsYXNzaWZpY2F0aW9uUmVzdWx0LCBcbiAgICBvcHRpb25zOiBNb3ZlT3B0aW9ucyA9IHt9XG4gICk6IFByb21pc2U8eyBzdWNjZXNzOiBib29sZWFuOyBuZXdQYXRoPzogc3RyaW5nOyBlcnJvcj86IHN0cmluZyB9PiB7XG4gICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcblxuICAgIHRyeSB7XG4gICAgICAvLyDnp7vli5XlhYjjg5Hjgrnjga7nlJ/miJBcbiAgICAgIGNvbnN0IHRhcmdldFBhdGggPSB0aGlzLmdlbmVyYXRlUmVtb3RlVGFyZ2V0UGF0aChmaWxlLCBjbGFzc2lmaWNhdGlvbik7XG4gICAgICBcbiAgICAgIC8vIOenu+WLleWFiOODh+OCo+ODrOOCr+ODiOODquOBruS9nOaIkFxuICAgICAgY29uc3QgdGFyZ2V0RGlyID0gcGF0aC5kaXJuYW1lKHRhcmdldFBhdGgpO1xuICAgICAgYXdhaXQgdGhpcy5lbnN1cmVSZW1vdGVEaXJlY3RvcnlFeGlzdHModGFyZ2V0RGlyKTtcblxuICAgICAgLy8g44OV44Kh44Kk44Or5ZCN44Gu6YeN6KSH44OB44Kn44OD44KvXG4gICAgICBjb25zdCBmaW5hbFBhdGggPSBhd2FpdCB0aGlzLnJlc29sdmVSZW1vdGVGaWxlTmFtZUNvbmZsaWN0KHRhcmdldFBhdGgsIG9wdGlvbnMpO1xuXG4gICAgICAvLyDjg5XjgqHjgqTjg6vnp7vli5Xjga7lrp/ooYxcbiAgICAgIGF3YWl0IHRoaXMuZXhlY3V0ZVJlbW90ZUZpbGVNb3ZlKGZpbGUucGF0aCwgZmluYWxQYXRoLCBvcHRpb25zKTtcblxuICAgICAgLy8g5qip6ZmQ6Kit5a6aXG4gICAgICBhd2FpdCB0aGlzLnNldFJlbW90ZUZpbGVQZXJtaXNzaW9ucyhmaW5hbFBhdGgsIGNsYXNzaWZpY2F0aW9uKTtcblxuICAgICAgLy8g56e75YuV57WQ5p6c44Gu5qSc6Ki8XG4gICAgICBhd2FpdCB0aGlzLnZlcmlmeVJlbW90ZUZpbGVNb3ZlKGZpbGUucGF0aCwgZmluYWxQYXRoLCBmaWxlLnNpemUpO1xuXG4gICAgICBjb25zdCBtb3ZlVGltZSA9IERhdGUubm93KCkgLSBzdGFydFRpbWU7XG4gICAgICBjb25zb2xlLmxvZyhg4pyFIEVDMuODleOCoeOCpOODq+enu+WLleWujOS6hjogJHtmaWxlLnBhdGh9IOKGkiAke2ZpbmFsUGF0aH0gKCR7bW92ZVRpbWV9bXMpYCk7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIG5ld1BhdGg6IGZpbmFsUGF0aFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc3QgZXJyb3JNc2cgPSBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFN0cmluZyhlcnJvcik7XG4gICAgICBjb25zb2xlLmVycm9yKGDinYwgRUMy44OV44Kh44Kk44Or56e75YuV5aSx5pWXOiAke2ZpbGUucGF0aH0gLSAke2Vycm9yTXNnfWApO1xuICAgICAgXG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgZXJyb3I6IGVycm9yTXNnXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg5Djg4Pjg4Hnp7vli5XjgpLlrp/ooYxcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZXhlY3V0ZUJhdGNoTW92ZShcbiAgICBmaWxlczogRmlsZUluZm9bXSwgXG4gICAgY2xhc3NpZmljYXRpb25zOiBDbGFzc2lmaWNhdGlvblJlc3VsdFtdLCBcbiAgICBvcHRpb25zOiBNb3ZlT3B0aW9uc1xuICApOiBQcm9taXNlPEJhdGNoTW92ZVJlc3VsdFtdPiB7XG4gICAgY29uc3QgYmF0Y2hlczogQmF0Y2hNb3ZlUmVzdWx0W10gPSBbXTtcbiAgICBcbiAgICAvLyDjg5XjgqHjgqTjg6vjgpLjg5Djg4Pjg4HjgrXjgqTjgrrjgZTjgajjgavliIblibJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZpbGVzLmxlbmd0aDsgaSArPSB0aGlzLmJhdGNoU2l6ZSkge1xuICAgICAgY29uc3QgYmF0Y2hGaWxlcyA9IGZpbGVzLnNsaWNlKGksIGkgKyB0aGlzLmJhdGNoU2l6ZSk7XG4gICAgICBjb25zdCBiYXRjaENsYXNzaWZpY2F0aW9ucyA9IGNsYXNzaWZpY2F0aW9ucy5zbGljZShpLCBpICsgdGhpcy5iYXRjaFNpemUpO1xuICAgICAgXG4gICAgICBjb25zdCBiYXRjaFJlc3VsdCA9IGF3YWl0IHRoaXMuZXhlY3V0ZVNpbmdsZUJhdGNoKGJhdGNoRmlsZXMsIGJhdGNoQ2xhc3NpZmljYXRpb25zLCBvcHRpb25zLCBpKTtcbiAgICAgIGJhdGNoZXMucHVzaChiYXRjaFJlc3VsdCk7XG4gICAgICBcbiAgICAgIC8vIOODkOODg+ODgemWk+OBruW+heapn++8iOOCteODvOODkOODvOiyoOiNt+i7vea4m++8iVxuICAgICAgaWYgKGkgKyB0aGlzLmJhdGNoU2l6ZSA8IGZpbGVzLmxlbmd0aCkge1xuICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKDEwMDApOyAvLyAx56eS5b6F5qmfXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGJhdGNoZXM7XG4gIH1cblxuICAvKipcbiAgICog5Y2Y5LiA44OQ44OD44OB44KS5a6f6KGMXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGV4ZWN1dGVTaW5nbGVCYXRjaChcbiAgICBmaWxlczogRmlsZUluZm9bXSwgXG4gICAgY2xhc3NpZmljYXRpb25zOiBDbGFzc2lmaWNhdGlvblJlc3VsdFtdLCBcbiAgICBvcHRpb25zOiBNb3ZlT3B0aW9ucyxcbiAgICBiYXRjaEluZGV4OiBudW1iZXJcbiAgKTogUHJvbWlzZTxCYXRjaE1vdmVSZXN1bHQ+IHtcbiAgICBjb25zdCBiYXRjaElkID0gYGJhdGNoLSR7YmF0Y2hJbmRleH0tJHtEYXRlLm5vdygpfWA7XG4gICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICBjb25zdCByZXN1bHRzOiBSZW1vdGVNb3ZlUmVzdWx0W10gPSBbXTtcblxuICAgIGNvbnNvbGUubG9nKGDwn5OmIOODkOODg+ODgSR7TWF0aC5mbG9vcihiYXRjaEluZGV4IC8gdGhpcy5iYXRjaFNpemUpICsgMX3jgpLlh6bnkIbkuK06ICR7ZmlsZXMubGVuZ3RofeWAi+OBruODleOCoeOCpOODq2ApO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBmaWxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgZmlsZSA9IGZpbGVzW2ldO1xuICAgICAgY29uc3QgY2xhc3NpZmljYXRpb24gPSBjbGFzc2lmaWNhdGlvbnNbaV07XG4gICAgICBjb25zdCBtb3ZlU3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgbW92ZVJlc3VsdCA9IGF3YWl0IHRoaXMubW92ZVNpbmdsZUZpbGUoZmlsZSwgY2xhc3NpZmljYXRpb24sIG9wdGlvbnMpO1xuICAgICAgICBcbiAgICAgICAgcmVzdWx0cy5wdXNoKHtcbiAgICAgICAgICBzdWNjZXNzOiBtb3ZlUmVzdWx0LnN1Y2Nlc3MsXG4gICAgICAgICAgb3JpZ2luYWxQYXRoOiBmaWxlLnBhdGgsXG4gICAgICAgICAgbmV3UGF0aDogbW92ZVJlc3VsdC5uZXdQYXRoLFxuICAgICAgICAgIGVycm9yOiBtb3ZlUmVzdWx0LmVycm9yLFxuICAgICAgICAgIG1vdmVUaW1lOiBEYXRlLm5vdygpIC0gbW92ZVN0YXJ0VGltZSxcbiAgICAgICAgICBmaWxlU2l6ZTogZmlsZS5zaXplXG4gICAgICAgIH0pO1xuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgcmVzdWx0cy5wdXNoKHtcbiAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICBvcmlnaW5hbFBhdGg6IGZpbGUucGF0aCxcbiAgICAgICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpLFxuICAgICAgICAgIG1vdmVUaW1lOiBEYXRlLm5vdygpIC0gbW92ZVN0YXJ0VGltZSxcbiAgICAgICAgICBmaWxlU2l6ZTogZmlsZS5zaXplXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHN1Y2Nlc3NDb3VudCA9IHJlc3VsdHMuZmlsdGVyKHIgPT4gci5zdWNjZXNzKS5sZW5ndGg7XG4gICAgY29uc3QgZmFpbHVyZUNvdW50ID0gcmVzdWx0cy5maWx0ZXIociA9PiAhci5zdWNjZXNzKS5sZW5ndGg7XG4gICAgY29uc3QgdG90YWxUaW1lID0gRGF0ZS5ub3coKSAtIHN0YXJ0VGltZTtcblxuICAgIGNvbnNvbGUubG9nKGDwn5OmIOODkOODg+ODgeWujOS6hjogJHtzdWNjZXNzQ291bnR9LyR7ZmlsZXMubGVuZ3RofeWAi+aIkOWKnyAoJHt0b3RhbFRpbWV9bXMpYCk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgYmF0Y2hJZCxcbiAgICAgIHN1Y2Nlc3NDb3VudCxcbiAgICAgIGZhaWx1cmVDb3VudCxcbiAgICAgIHJlc3VsdHMsXG4gICAgICB0b3RhbFRpbWVcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOODquODouODvOODiOenu+WLleaTjeS9nOOBruaknOiovFxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyB2YWxpZGF0ZVJlbW90ZU1vdmVPcGVyYXRpb24oXG4gICAgZmlsZXM6IEZpbGVJbmZvW10sIFxuICAgIGNsYXNzaWZpY2F0aW9uczogQ2xhc3NpZmljYXRpb25SZXN1bHRbXSwgXG4gICAgb3B0aW9uczogTW92ZU9wdGlvbnNcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc29sZS5sb2coJ/CflI0gRUMy56e75YuV5pON5L2c44KS5qSc6Ki85LitLi4uJyk7XG5cbiAgICAvLyDjg5XjgqHjgqTjg6vmlbDjgajliIbpoZ7ntZDmnpzmlbDjga7kuIDoh7Tnorroqo1cbiAgICBpZiAoZmlsZXMubGVuZ3RoICE9PSBjbGFzc2lmaWNhdGlvbnMubGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYOODleOCoeOCpOODq+aVsCgke2ZpbGVzLmxlbmd0aH0p44Go5YiG6aGe57WQ5p6c5pWwKCR7Y2xhc3NpZmljYXRpb25zLmxlbmd0aH0p44GM5LiA6Ie044GX44G+44Gb44KTYCk7XG4gICAgfVxuXG4gICAgLy8g44Oq44Oi44O844OI44OV44Kh44Kk44Or5a2Y5Zyo56K66KqN77yI44K144Oz44OX44Oq44Oz44Kw77yJXG4gICAgY29uc3Qgc2FtcGxlU2l6ZSA9IE1hdGgubWluKDUsIGZpbGVzLmxlbmd0aCk7XG4gICAgY29uc3Qgc2FtcGxlRmlsZXMgPSBmaWxlcy5zbGljZSgwLCBzYW1wbGVTaXplKTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IGZpbGUgb2Ygc2FtcGxlRmlsZXMpIHtcbiAgICAgIGNvbnN0IGV4aXN0cyA9IGF3YWl0IHRoaXMuY2hlY2tSZW1vdGVGaWxlRXhpc3RzKGZpbGUucGF0aCk7XG4gICAgICBpZiAoIWV4aXN0cykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYOODquODouODvOODiOODleOCoeOCpOODq+OBjOWtmOWcqOOBl+OBvuOBm+OCkzogJHtmaWxlLnBhdGh9YCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8g44Oq44Oi44O844OI44OH44Kj44K544Kv5a656YeP56K66KqNXG4gICAgYXdhaXQgdGhpcy5jaGVja1JlbW90ZURpc2tTcGFjZShmaWxlcyk7XG5cbiAgICBjb25zb2xlLmxvZygn4pyFIEVDMuenu+WLleaTjeS9nOaknOiovOWujOS6hicpO1xuICB9XG5cbiAgLyoqXG4gICAqIOODquODouODvOODiOODleOCoeOCpOODq+enu+WLleOCkuWun+ihjFxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBleGVjdXRlUmVtb3RlRmlsZU1vdmUoc291cmNlUGF0aDogc3RyaW5nLCB0YXJnZXRQYXRoOiBzdHJpbmcsIG9wdGlvbnM6IE1vdmVPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgbGV0IGNvbW1hbmQ6IHN0cmluZztcbiAgICBcbiAgICBpZiAob3B0aW9ucy5jb3B5SW5zdGVhZE9mTW92ZSkge1xuICAgICAgY29tbWFuZCA9IGBjcCBcIiR7c291cmNlUGF0aH1cIiBcIiR7dGFyZ2V0UGF0aH1cImA7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbW1hbmQgPSBgbXYgXCIke3NvdXJjZVBhdGh9XCIgXCIke3RhcmdldFBhdGh9XCJgO1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMuZXhlY3V0ZVNTSENvbW1hbmQoY29tbWFuZCk7XG4gIH1cblxuICAvKipcbiAgICog44Oq44Oi44O844OI44OH44Kj44Os44Kv44OI44Oq44Gu5a2Y5Zyo56K66KqN44O75L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGVuc3VyZVJlbW90ZURpcmVjdG9yeUV4aXN0cyhkaXJQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5leGVjdXRlU1NIQ29tbWFuZChgdGVzdCAtZCBcIiR7ZGlyUGF0aH1cImApO1xuICAgIH0gY2F0Y2gge1xuICAgICAgYXdhaXQgdGhpcy5leGVjdXRlU1NIQ29tbWFuZChgbWtkaXIgLXAgXCIke2RpclBhdGh9XCJgKTtcbiAgICAgIGNvbnNvbGUubG9nKGDwn5OBIOODquODouODvOODiOODh+OCo+ODrOOCr+ODiOODquS9nOaIkDogJHtkaXJQYXRofWApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg6rjg6Ljg7zjg4jjg5XjgqHjgqTjg6vlkI3jga7ph43opIfjgpLop6PmsbpcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgcmVzb2x2ZVJlbW90ZUZpbGVOYW1lQ29uZmxpY3QodGFyZ2V0UGF0aDogc3RyaW5nLCBvcHRpb25zOiBNb3ZlT3B0aW9ucyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMuZXhlY3V0ZVNTSENvbW1hbmQoYHRlc3QgLWYgXCIke3RhcmdldFBhdGh9XCJgKTtcbiAgICAgIFxuICAgICAgLy8g44OV44Kh44Kk44Or44GM5pei44Gr5a2Y5Zyo44GZ44KL5aC05ZCIXG4gICAgICBpZiAob3B0aW9ucy5vdmVyd3JpdGVFeGlzdGluZykge1xuICAgICAgICByZXR1cm4gdGFyZ2V0UGF0aDtcbiAgICAgIH1cblxuICAgICAgLy8g5paw44GX44GE44OV44Kh44Kk44Or5ZCN44KS55Sf5oiQXG4gICAgICBjb25zdCBkaXIgPSBwYXRoLmRpcm5hbWUodGFyZ2V0UGF0aCk7XG4gICAgICBjb25zdCBleHQgPSBwYXRoLmV4dG5hbWUodGFyZ2V0UGF0aCk7XG4gICAgICBjb25zdCBiYXNlTmFtZSA9IHBhdGguYmFzZW5hbWUodGFyZ2V0UGF0aCwgZXh0KTtcbiAgICAgIFxuICAgICAgbGV0IGNvdW50ZXIgPSAxO1xuICAgICAgbGV0IG5ld1BhdGg6IHN0cmluZztcbiAgICAgIFxuICAgICAgZG8ge1xuICAgICAgICBuZXdQYXRoID0gcGF0aC5qb2luKGRpciwgYCR7YmFzZU5hbWV9XyR7Y291bnRlcn0ke2V4dH1gKTtcbiAgICAgICAgY291bnRlcisrO1xuICAgICAgICBcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCB0aGlzLmV4ZWN1dGVTU0hDb21tYW5kKGB0ZXN0IC1mIFwiJHtuZXdQYXRofVwiYCk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIGJyZWFrOyAvLyDjg5XjgqHjgqTjg6vjgYzlrZjlnKjjgZfjgarjgYTloLTlkIjjga/kvb/nlKjlj6/og71cbiAgICAgICAgfVxuICAgICAgfSB3aGlsZSAoY291bnRlciA8IDEwMDApOyAvLyDnhKHpmZDjg6vjg7zjg5fpmLLmraJcblxuICAgICAgY29uc29sZS5sb2coYPCfk50g44Oq44Oi44O844OI44OV44Kh44Kk44Or5ZCN6YeN6KSH5Zue6YG/OiAke3RhcmdldFBhdGh9IOKGkiAke25ld1BhdGh9YCk7XG4gICAgICByZXR1cm4gbmV3UGF0aDtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIOODleOCoeOCpOODq+OBjOWtmOWcqOOBl+OBquOBhOWgtOWQiOOBr+OBneOBruOBvuOBvuS9v+eUqFxuICAgICAgcmV0dXJuIHRhcmdldFBhdGg7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODquODouODvOODiOODleOCoeOCpOODq+aoqemZkOOCkuioreWumlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBzZXRSZW1vdGVGaWxlUGVybWlzc2lvbnMoZmlsZVBhdGg6IHN0cmluZywgY2xhc3NpZmljYXRpb246IENsYXNzaWZpY2F0aW9uUmVzdWx0KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBwZXJtaXNzaW9uczogc3RyaW5nO1xuICAgICAgXG4gICAgICBzd2l0Y2ggKGNsYXNzaWZpY2F0aW9uLmZpbGVUeXBlKSB7XG4gICAgICAgIGNhc2UgJ3NjcmlwdCc6XG4gICAgICAgICAgcGVybWlzc2lvbnMgPSAnNzU1JzsgLy8g5a6f6KGM5Y+v6IO9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2NvbmZpZyc6XG4gICAgICAgICAgaWYgKGZpbGVQYXRoLmluY2x1ZGVzKCdzZWNyZXQnKSB8fCBmaWxlUGF0aC5pbmNsdWRlcygnZW52JykpIHtcbiAgICAgICAgICAgIHBlcm1pc3Npb25zID0gJzYwMCc7IC8vIOapn+WvhuODleOCoeOCpOODq1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZXJtaXNzaW9ucyA9ICc2NDQnOyAvLyDkuIDoiKzoqK3lrppcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgcGVybWlzc2lvbnMgPSAnNjQ0JzsgLy8g44OH44OV44Kp44Or44OIXG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGF3YWl0IHRoaXMuZXhlY3V0ZVNTSENvbW1hbmQoYGNobW9kICR7cGVybWlzc2lvbnN9IFwiJHtmaWxlUGF0aH1cImApO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLndhcm4oYOKaoO+4jyDjg6rjg6Ljg7zjg4jmqKnpmZDoqK3lrprjgavlpLHmlZc6ICR7ZmlsZVBhdGh9IC0gJHtlcnJvcn1gKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44Oq44Oi44O844OI56e75YuV5YWI44OR44K544KS55Sf5oiQXG4gICAqL1xuICBwcml2YXRlIGdlbmVyYXRlUmVtb3RlVGFyZ2V0UGF0aChmaWxlOiBGaWxlSW5mbywgY2xhc3NpZmljYXRpb246IENsYXNzaWZpY2F0aW9uUmVzdWx0KTogc3RyaW5nIHtcbiAgICBpZiAoY2xhc3NpZmljYXRpb24udGFyZ2V0UGF0aCkge1xuICAgICAgcmV0dXJuIGNsYXNzaWZpY2F0aW9uLnRhcmdldFBhdGg7XG4gICAgfVxuXG4gICAgLy8g44OV44Kp44O844Or44OQ44OD44KvOiDjg5XjgqHjgqTjg6vjgr/jgqTjg5fjgavln7rjgaXjgY/ln7rmnKznmoTjgarjg5HjgrnnlJ/miJBcbiAgICBjb25zdCBmaWxlTmFtZSA9IHBhdGguYmFzZW5hbWUoZmlsZS5wYXRoKTtcbiAgICBcbiAgICBzd2l0Y2ggKGNsYXNzaWZpY2F0aW9uLmZpbGVUeXBlKSB7XG4gICAgICBjYXNlICdzY3JpcHQnOlxuICAgICAgICByZXR1cm4gcGF0aC5qb2luKCcvaG9tZS91YnVudHUvZGV2ZWxvcG1lbnQvc2NyaXB0cy91dGlsaXRpZXMnLCBmaWxlTmFtZSk7XG4gICAgICBjYXNlICdkb2N1bWVudCc6XG4gICAgICAgIHJldHVybiBwYXRoLmpvaW4oJy9ob21lL3VidW50dS9kZXZlbG9wbWVudC9kb2NzL3JlcG9ydHMnLCBmaWxlTmFtZSk7XG4gICAgICBjYXNlICdjb25maWcnOlxuICAgICAgICByZXR1cm4gcGF0aC5qb2luKCcvaG9tZS91YnVudHUvZGV2ZWxvcG1lbnQvY29uZmlncycsIGZpbGVOYW1lKTtcbiAgICAgIGNhc2UgJ3Rlc3QnOlxuICAgICAgICByZXR1cm4gcGF0aC5qb2luKCcvaG9tZS91YnVudHUvdGVzdHMvbGVnYWN5JywgZmlsZU5hbWUpO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIHBhdGguam9pbignL2hvbWUvdWJ1bnR1L2FyY2hpdmUvdW5rbm93bicsIGZpbGVOYW1lKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44Oq44Oi44O844OI44OV44Kh44Kk44Or5a2Y5Zyo56K66KqNXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGNoZWNrUmVtb3RlRmlsZUV4aXN0cyhmaWxlUGF0aDogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMuZXhlY3V0ZVNTSENvbW1hbmQoYHRlc3QgLWYgXCIke2ZpbGVQYXRofVwiYCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44Oq44Oi44O844OI44OH44Kj44K544Kv5a656YeP56K66KqNXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGNoZWNrUmVtb3RlRGlza1NwYWNlKGZpbGVzOiBGaWxlSW5mb1tdKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZXhlY3V0ZVNTSENvbW1hbmQoJ2RmIC1oIC9ob21lL3VidW50dSB8IHRhaWwgLTEnKTtcbiAgICAgIGNvbnN0IGRpc2tJbmZvID0gcmVzdWx0LnN0ZG91dC50cmltKCkuc3BsaXQoL1xccysvKTtcbiAgICAgIGNvbnN0IHVzYWdlUGVyY2VudGFnZSA9IHBhcnNlSW50KGRpc2tJbmZvWzRdLnJlcGxhY2UoJyUnLCAnJykpO1xuICAgICAgXG4gICAgICBjb25zdCB0b3RhbFNpemUgPSBmaWxlcy5yZWR1Y2UoKHN1bSwgZmlsZSkgPT4gc3VtICsgZmlsZS5zaXplLCAwKTtcbiAgICAgIGNvbnN0IHRvdGFsU2l6ZU1CID0gTWF0aC5yb3VuZCh0b3RhbFNpemUgLyAxMDI0IC8gMTAyNCk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKGDwn5K+IEVDMuODh+OCo+OCueOCr+S9v+eUqOeOhzogJHt1c2FnZVBlcmNlbnRhZ2V9JSwg56e75YuV5LqI5a6aOiAke3RvdGFsU2l6ZU1CfU1CYCk7XG4gICAgICBcbiAgICAgIGlmICh1c2FnZVBlcmNlbnRhZ2UgPiA5MCkge1xuICAgICAgICBjb25zb2xlLndhcm4oJ+KaoO+4jyBFQzLjg4fjgqPjgrnjgq/kvb/nlKjnjofjgYzpq5jjgYTjgafjgZnjgILnp7vli5XliY3jgavlrrnph4/jgpLnorroqo3jgZfjgabjgY/jgaDjgZXjgYTjgIInKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS53YXJuKGDimqDvuI8g44Oq44Oi44O844OI44OH44Kj44K544Kv5a656YeP56K66KqN44Gr5aSx5pWXOiAke2Vycm9yfWApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg6rjg6Ljg7zjg4jnp7vli5XntZDmnpzjgpLmpJzoqLxcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgdmVyaWZ5UmVtb3RlTW92ZXMocmVzdWx0czogUmVtb3RlTW92ZVJlc3VsdFtdKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc29sZS5sb2coJ/CflI0g44Oq44Oi44O844OI56e75YuV57WQ5p6c44KS5qSc6Ki85LitLi4uJyk7XG5cbiAgICBsZXQgdmVyaWZpY2F0aW9uRXJyb3JzID0gMDtcbiAgICBjb25zdCBzYW1wbGVTaXplID0gTWF0aC5taW4oMTAsIHJlc3VsdHMubGVuZ3RoKTsgLy8g44K144Oz44OX44Oq44Oz44Kw5qSc6Ki8XG4gICAgY29uc3Qgc2FtcGxlUmVzdWx0cyA9IHJlc3VsdHMuc2xpY2UoMCwgc2FtcGxlU2l6ZSk7XG5cbiAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiBzYW1wbGVSZXN1bHRzKSB7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCB0aGlzLnZlcmlmeVJlbW90ZUZpbGVNb3ZlKHJlc3VsdC5vcmlnaW5hbFBhdGgsIHJlc3VsdC5uZXdQYXRoISwgcmVzdWx0LmZpbGVTaXplKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHZlcmlmaWNhdGlvbkVycm9ycysrO1xuICAgICAgICBjb25zb2xlLndhcm4oYOKaoO+4jyDmpJzoqLzjgqjjg6njg7w6ICR7cmVzdWx0Lm5ld1BhdGh9IC0gJHtlcnJvcn1gKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodmVyaWZpY2F0aW9uRXJyb3JzID09PSAwKSB7XG4gICAgICBjb25zb2xlLmxvZygn4pyFIOODquODouODvOODiOenu+WLlee1kOaenOaknOiovOWujOS6hjog5ZWP6aGM44Gq44GXJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnNvbGUud2Fybihg4pqg77iPIOODquODouODvOODiOenu+WLlee1kOaenOaknOiovOOBpyR7dmVyaWZpY2F0aW9uRXJyb3JzfeWAi+OBruWVj+mhjOOCkuaknOWHumApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDljZjkuIDjg6rjg6Ljg7zjg4jjg5XjgqHjgqTjg6vnp7vli5XjgpLmpJzoqLxcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgdmVyaWZ5UmVtb3RlRmlsZU1vdmUob3JpZ2luYWxQYXRoOiBzdHJpbmcsIG5ld1BhdGg6IHN0cmluZywgZXhwZWN0ZWRTaXplOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAvLyDnp7vli5XlhYjjg5XjgqHjgqTjg6vjga7lrZjlnKjnorroqo1cbiAgICBjb25zdCBleGlzdHMgPSBhd2FpdCB0aGlzLmNoZWNrUmVtb3RlRmlsZUV4aXN0cyhuZXdQYXRoKTtcbiAgICBpZiAoIWV4aXN0cykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGDnp7vli5XlhYjjg5XjgqHjgqTjg6vjgYzlrZjlnKjjgZfjgb7jgZvjgpM6ICR7bmV3UGF0aH1gKTtcbiAgICB9XG5cbiAgICAvLyDjg5XjgqHjgqTjg6vjgrXjgqTjgrrnorroqo1cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5leGVjdXRlU1NIQ29tbWFuZChgc3RhdCAtYyVzIFwiJHtuZXdQYXRofVwiYCk7XG4gICAgICBjb25zdCBhY3R1YWxTaXplID0gcGFyc2VJbnQocmVzdWx0LnN0ZG91dC50cmltKCkpO1xuICAgICAgXG4gICAgICBpZiAoYWN0dWFsU2l6ZSAhPT0gZXhwZWN0ZWRTaXplKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihg44OV44Kh44Kk44Or44K144Kk44K644GM5LiA6Ie044GX44G+44Gb44KTOiDmnJ/lvoXlgKQke2V4cGVjdGVkU2l6ZX0sIOWun+mamyR7YWN0dWFsU2l6ZX1gKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS53YXJuKGDimqDvuI8g44OV44Kh44Kk44Or44K144Kk44K656K66KqN44Gr5aSx5pWXOiAke25ld1BhdGh9IC0gJHtlcnJvcn1gKTtcbiAgICB9XG5cbiAgICAvLyDlhYPjg5XjgqHjgqTjg6vjgYzliYrpmaTjgZXjgozjgabjgYTjgovjgYvnorroqo3vvIjnp7vli5Xjga7loLTlkIjvvIlcbiAgICBjb25zdCBvcmlnaW5hbEV4aXN0cyA9IGF3YWl0IHRoaXMuY2hlY2tSZW1vdGVGaWxlRXhpc3RzKG9yaWdpbmFsUGF0aCk7XG4gICAgaWYgKG9yaWdpbmFsRXhpc3RzKSB7XG4gICAgICBjb25zb2xlLndhcm4oYOKaoO+4jyDlhYPjg5XjgqHjgqTjg6vjgYzmrovjgaPjgabjgYTjgb7jgZk6ICR7b3JpZ2luYWxQYXRofWApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDmjqXntprjg4bjgrnjg4hcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgdGVzdENvbm5lY3Rpb24oKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMuZXhlY3V0ZVNTSENvbW1hbmQoJ2VjaG8gXCJjb25uZWN0aW9uIHRlc3RcIicpO1xuICAgICAgY29uc29sZS5sb2coJ+KchSBFQzLmjqXntprjg4bjgrnjg4jmiJDlip8nKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgdGhyb3cgbmV3IE9yZ2FuaXphdGlvbkVycm9yKFxuICAgICAgICBPcmdhbml6YXRpb25FcnJvclR5cGUuU1NIX0NPTk5FQ1RJT05fRkFJTEVELFxuICAgICAgICBgRUMy5o6l57aa44OG44K544OI44Gr5aSx5pWX44GX44G+44GX44GfOiAke2Vycm9yfWAsXG4gICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgdGhpcy5lbnZpcm9ubWVudCxcbiAgICAgICAgZXJyb3IgYXMgRXJyb3JcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFNTSCDjgrPjg57jg7Pjg4njgpLlrp/ooYxcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZXhlY3V0ZVNTSENvbW1hbmQoY29tbWFuZDogc3RyaW5nKTogUHJvbWlzZTx7IHN0ZG91dDogc3RyaW5nOyBzdGRlcnI6IHN0cmluZyB9PiB7XG4gICAgY29uc3Qgc3NoQ29tbWFuZCA9IGBzc2ggLWkgXCIke3RoaXMuc3NoQ29uZmlnLmtleVBhdGh9XCIgLW8gQ29ubmVjdFRpbWVvdXQ9JHt0aGlzLnNzaENvbmZpZy50aW1lb3V0ISAvIDEwMDB9IC1vIFN0cmljdEhvc3RLZXlDaGVja2luZz1ubyAtcCAke3RoaXMuc3NoQ29uZmlnLnBvcnR9ICR7dGhpcy5zc2hDb25maWcudXNlcn1AJHt0aGlzLnNzaENvbmZpZy5ob3N0fSBcIiR7Y29tbWFuZH1cImA7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGV4ZWNBc3luYyhzc2hDb21tYW5kLCB7IFxuICAgICAgICB0aW1lb3V0OiB0aGlzLnNzaENvbmZpZy50aW1lb3V0LFxuICAgICAgICBtYXhCdWZmZXI6IDEwMjQgKiAxMDI0ICogMTAgLy8gMTBNQlxuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgIGlmIChlcnJvci5jb2RlID09PSAnRVRJTUVET1VUJykge1xuICAgICAgICB0aHJvdyBuZXcgT3JnYW5pemF0aW9uRXJyb3IoXG4gICAgICAgICAgT3JnYW5pemF0aW9uRXJyb3JUeXBlLlNTSF9DT05ORUNUSU9OX0ZBSUxFRCxcbiAgICAgICAgICBgU1NI5o6l57aa44GM44K/44Kk44Og44Ki44Km44OI44GX44G+44GX44GfOiAke3RoaXMuc3NoQ29uZmlnLmhvc3R9YCxcbiAgICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICAgdGhpcy5lbnZpcm9ubWVudCxcbiAgICAgICAgICBlcnJvclxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODieODqeOCpOODqeODs+e1kOaenOOCkuS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVEcnlSdW5SZXN1bHQoZmlsZXM6IEZpbGVJbmZvW10sIGNsYXNzaWZpY2F0aW9uczogQ2xhc3NpZmljYXRpb25SZXN1bHRbXSk6IE1vdmVSZXN1bHQge1xuICAgIGNvbnN0IG1vdmVkRmlsZXMgPSBmaWxlcy5tYXAoKGZpbGUsIGluZGV4KSA9PiAoe1xuICAgICAgb3JpZ2luYWxQYXRoOiBmaWxlLnBhdGgsXG4gICAgICBuZXdQYXRoOiB0aGlzLmdlbmVyYXRlUmVtb3RlVGFyZ2V0UGF0aChmaWxlLCBjbGFzc2lmaWNhdGlvbnNbaW5kZXhdKSxcbiAgICAgIHNpemU6IGZpbGUuc2l6ZVxuICAgIH0pKTtcblxuICAgIHJldHVybiB7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgbW92ZWRGaWxlcyxcbiAgICAgIGZhaWxlZEZpbGVzOiBbXSxcbiAgICAgIHN0YXRpc3RpY3M6IHtcbiAgICAgICAgdG90YWxGaWxlczogZmlsZXMubGVuZ3RoLFxuICAgICAgICBzdWNjZXNzZnVsTW92ZXM6IGZpbGVzLmxlbmd0aCxcbiAgICAgICAgZmFpbGVkTW92ZXM6IDAsXG4gICAgICAgIHNraXBwZWRGaWxlczogMCxcbiAgICAgICAgcHJvY2Vzc2luZ1RpbWU6IDAsXG4gICAgICAgIHRvdGFsTW92ZWRTaXplOiBmaWxlcy5yZWR1Y2UoKHN1bSwgZmlsZSkgPT4gc3VtICsgZmlsZS5zaXplLCAwKSxcbiAgICAgICAgYXZlcmFnZU1vdmVUaW1lOiAwLFxuICAgICAgICBlcnJvcnM6IFtdXG4gICAgICB9LFxuICAgICAgZW52aXJvbm1lbnQ6IHRoaXMuZW52aXJvbm1lbnQsXG4gICAgICBwcm9jZXNzaW5nVGltZTogMFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog5b6F5qmfXG4gICAqL1xuICBwcml2YXRlIHNsZWVwKG1zOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XG4gIH1cblxuICAvKipcbiAgICogRUMy56e75YuV57Wx6KiI44Os44Od44O844OI44KS55Sf5oiQXG4gICAqL1xuICBwdWJsaWMgZ2VuZXJhdGVFQzJNb3ZlUmVwb3J0KG1vdmVSZXN1bHQ6IE1vdmVSZXN1bHQpOiBzdHJpbmcge1xuICAgIGNvbnN0IHN0YXRzID0gbW92ZVJlc3VsdC5zdGF0aXN0aWNzO1xuICAgIGNvbnN0IHN1Y2Nlc3NSYXRlID0gTWF0aC5yb3VuZCgoc3RhdHMuc3VjY2Vzc2Z1bE1vdmVzIC8gc3RhdHMudG90YWxGaWxlcykgKiAxMDApO1xuICAgIFxuICAgIHJldHVybiBgXG4jIEVDMuODleOCoeOCpOODq+enu+WLleODrOODneODvOODiFxuXG4jIyDlrp/ooYzjgrXjg57jg6rjg7xcbi0gKirlrp/ooYzml6XmmYIqKjogJHtuZXcgRGF0ZSgpLnRvTG9jYWxlU3RyaW5nKCdqYS1KUCcpfVxuLSAqKkVDMuODm+OCueODiCoqOiAke3RoaXMuc3NoQ29uZmlnLmhvc3R9XG4tICoq5Yem55CG44OV44Kh44Kk44Or5pWwKio6ICR7c3RhdHMudG90YWxGaWxlc33lgItcbi0gKirmiJDlip8qKjogJHtzdGF0cy5zdWNjZXNzZnVsTW92ZXN95YCLXG4tICoq5aSx5pWXKio6ICR7c3RhdHMuZmFpbGVkTW92ZXN95YCLXG4tICoq5oiQ5Yqf546HKio6ICR7c3VjY2Vzc1JhdGV9JVxuLSAqKuWHpueQhuaZgumWkyoqOiAke01hdGgucm91bmQoc3RhdHMucHJvY2Vzc2luZ1RpbWUgLyAxMDAwKX3np5Jcbi0gKirnp7vli5Xjg4fjg7zjgr/jgrXjgqTjgroqKjogJHtNYXRoLnJvdW5kKHN0YXRzLnRvdGFsTW92ZWRTaXplIC8gMTAyNCAvIDEwMjQpfU1CXG5cbiMjIOODkeODleOCqeODvOODnuODs+OCuVxuLSAqKuW5s+Wdh+enu+WLleaZgumWkyoqOiAke01hdGgucm91bmQoc3RhdHMuYXZlcmFnZU1vdmVUaW1lKX1tcy/jg5XjgqHjgqTjg6tcbi0gKirjg43jg4Pjg4jjg6/jg7zjgq/jgrnjg6vjg7zjg5fjg4Pjg4gqKjogJHtNYXRoLnJvdW5kKHN0YXRzLnRvdGFsRmlsZXMgLyAoc3RhdHMucHJvY2Vzc2luZ1RpbWUgLyAxMDAwKSl944OV44Kh44Kk44OrL+enklxuXG4jIyDjgqjjg6njg7zoqbPntLBcbiR7c3RhdHMuZXJyb3JzLmxlbmd0aCA+IDAgPyBcbiAgc3RhdHMuZXJyb3JzLm1hcChlcnJvciA9PiBgLSAke2Vycm9yLmZpbGV9OiAke2Vycm9yLmVycm9yfWApLmpvaW4oJ1xcbicpIDogXG4gICctIOOCqOODqeODvOOBquOBlydcbn1cblxuIyMg56e75YuV44GV44KM44Gf44OV44Kh44Kk44Or77yI5LiK5L2NMTDku7bvvIlcbiR7bW92ZVJlc3VsdC5tb3ZlZEZpbGVzLnNsaWNlKDAsIDEwKS5tYXAoZmlsZSA9PiBcbiAgYC0gJHtwYXRoLmJhc2VuYW1lKGZpbGUub3JpZ2luYWxQYXRoKX0g4oaSICR7ZmlsZS5uZXdQYXRofWBcbikuam9pbignXFxuJyl9XG4ke21vdmVSZXN1bHQubW92ZWRGaWxlcy5sZW5ndGggPiAxMCA/IGBcXG4uLi4g5LuWJHttb3ZlUmVzdWx0Lm1vdmVkRmlsZXMubGVuZ3RoIC0gMTB95YCLYCA6ICcnfVxuXG4jIyBTU0jmjqXntprmg4XloLFcbi0gKirjg5vjgrnjg4gqKjogJHt0aGlzLnNzaENvbmZpZy5ob3N0fVxuLSAqKuODneODvOODiCoqOiAke3RoaXMuc3NoQ29uZmlnLnBvcnR9XG4tICoq44Om44O844K244O8Kio6ICR7dGhpcy5zc2hDb25maWcudXNlcn1cbi0gKirjgr/jgqTjg6DjgqLjgqbjg4gqKjogJHt0aGlzLnNzaENvbmZpZy50aW1lb3V0fW1zXG5gO1xuICB9XG59Il19