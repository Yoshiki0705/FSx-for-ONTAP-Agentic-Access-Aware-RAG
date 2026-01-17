"use strict";
/**
 * CPOS (Continuous Project Organization System) Main Entry Point
 * 継続的プロジェクト整理システムのメインエントリーポイント
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cpos = exports.CPOSSystem = void 0;
const configuration_1 = require("./core/configuration");
const environment_manager_1 = require("./core/configuration/environment-manager");
const database_1 = require("./core/database");
const encryption_1 = require("./utils/encryption");
const scanner_factory_1 = require("./core/file-scanner/scanner-factory");
const scanner_events_1 = require("./core/file-scanner/scanner-events");
const classification_factory_1 = require("./core/classification/classification-factory");
const classification_manager_1 = require("./core/classification/classification-manager");
const validator_factory_1 = require("./core/structure-validator/validator-factory");
class CPOSSystem {
    configManager;
    environmentManager;
    databaseManager;
    encryptionManager;
    fileScanner = null;
    scannerEventHandler = null;
    classificationEngine = null;
    classificationManager = null;
    structureValidator = null;
    initialized = false;
    constructor() {
        this.configManager = new configuration_1.ConfigurationManager();
        this.environmentManager = new environment_manager_1.EnvironmentManager();
        this.databaseManager = new database_1.DatabaseManager();
        this.encryptionManager = new encryption_1.EncryptionManager();
    }
    /**
     * システムを初期化
     */
    async initialize(environment = 'local') {
        try {
            console.log('CPOS システムを初期化中...');
            // 環境を設定
            this.environmentManager.setCurrentEnvironment(environment);
            // 環境設定を読み込み
            const config = await this.environmentManager.loadEnvironmentConfig();
            console.log(`環境 ${environment} の設定を読み込みました`);
            // データベースを初期化
            await this.databaseManager.initialize();
            console.log('データベースの初期化が完了しました');
            // 設定を検証
            if (!this.configManager.validateConfig(config)) {
                throw new Error('設定の検証に失敗しました');
            }
            // ファイルスキャナーを初期化
            this.fileScanner = scanner_factory_1.FileScannerFactory.createFromConfig(config);
            this.scannerEventHandler = new scanner_events_1.FileScannerEventHandler(this.fileScanner, this.databaseManager);
            console.log('ファイルスキャナーを初期化しました');
            // 分類エンジンを初期化
            this.classificationEngine = classification_factory_1.ClassificationEngineFactory.createFromConfig(config);
            this.classificationManager = new classification_manager_1.ClassificationManager(this.classificationEngine, this.databaseManager);
            await this.classificationManager.initialize();
            // スキャナーと分類マネージャーを統合
            this.classificationManager.integrateWithScanner(this.fileScanner);
            console.log('分類エンジンを初期化しました');
            // 構造検証機能を初期化
            this.structureValidator = validator_factory_1.StructureValidatorFactory.createFromConfig(config);
            await this.structureValidator.initialize();
            console.log('構造検証機能を初期化しました');
            this.initialized = true;
            console.log('CPOS システムの初期化が完了しました');
            // システム統計を表示
            await this.displaySystemStatistics();
        }
        catch (error) {
            console.error('CPOS システムの初期化に失敗しました:', error);
            throw error;
        }
    }
    /**
     * システムが初期化されているかチェック
     */
    checkInitialized() {
        if (!this.initialized) {
            throw new Error('システムが初期化されていません。initialize()を先に実行してください。');
        }
    }
    /**
     * 現在の設定を取得
     */
    getConfig() {
        this.checkInitialized();
        return this.configManager.getConfig();
    }
    /**
     * 環境マネージャーを取得
     */
    getEnvironmentManager() {
        return this.environmentManager;
    }
    /**
     * データベースマネージャーを取得
     */
    getDatabaseManager() {
        this.checkInitialized();
        return this.databaseManager;
    }
    /**
     * 暗号化マネージャーを取得
     */
    getEncryptionManager() {
        return this.encryptionManager;
    }
    /**
     * ファイルスキャナーを取得
     */
    getFileScanner() {
        return this.fileScanner;
    }
    /**
     * スキャナーイベントハンドラーを取得
     */
    getScannerEventHandler() {
        return this.scannerEventHandler;
    }
    /**
     * 分類エンジンを取得
     */
    getClassificationEngine() {
        return this.classificationEngine;
    }
    /**
     * 分類マネージャーを取得
     */
    getClassificationManager() {
        return this.classificationManager;
    }
    /**
     * 構造検証機能を取得
     */
    getStructureValidator() {
        return this.structureValidator;
    }
    /**
     * ファイルスキャンを開始
     */
    async startFileScanning() {
        this.checkInitialized();
        if (!this.fileScanner) {
            throw new Error('ファイルスキャナーが初期化されていません');
        }
        await this.fileScanner.startScanning();
        console.log('ファイルスキャンを開始しました');
    }
    /**
     * ファイルスキャンを停止
     */
    stopFileScanning() {
        if (this.fileScanner) {
            this.fileScanner.stopScanning();
            console.log('ファイルスキャンを停止しました');
        }
    }
    /**
     * ファイルを分類
     */
    async classifyFile(filePath, autoApply = false) {
        this.checkInitialized();
        if (!this.classificationManager) {
            throw new Error('分類マネージャーが初期化されていません');
        }
        return await this.classificationManager.classifyFile(filePath, autoApply);
    }
    /**
     * ディレクトリ全体を分類
     */
    async classifyDirectory(dirPath, recursive = true, autoApply = false) {
        this.checkInitialized();
        if (!this.classificationManager) {
            throw new Error('分類マネージャーが初期化されていません');
        }
        return await this.classificationManager.classifyDirectory(dirPath, recursive, autoApply);
    }
    /**
     * 分類統計を取得
     */
    getClassificationStatistics() {
        this.checkInitialized();
        if (!this.classificationManager) {
            return null;
        }
        return this.classificationManager.getStatistics();
    }
    /**
     * プロジェクト構造を検証
     */
    async validateProjectStructure() {
        this.checkInitialized();
        if (!this.structureValidator) {
            throw new Error('構造検証機能が初期化されていません');
        }
        return await this.structureValidator.validateStructure();
    }
    /**
     * 構造違反を自動修正
     */
    async autoFixStructure() {
        this.checkInitialized();
        if (!this.structureValidator) {
            throw new Error('構造検証機能が初期化されていません');
        }
        const validationResult = await this.structureValidator.validateStructure();
        return await this.structureValidator.autoFix(validationResult.suggestions);
    }
    /**
     * システム統計を表示
     */
    async displaySystemStatistics() {
        try {
            const stats = await this.databaseManager.getStatistics();
            console.log('=== CPOS システム統計 ===');
            console.log(`ファイル数: ${stats.fileCount}`);
            console.log(`同期状態数: ${stats.syncStateCount}`);
            console.log(`バックアップ数: ${stats.backupCount}`);
            console.log(`操作ログ数: ${stats.operationLogCount}`);
            if (this.fileScanner) {
                const scanStats = this.fileScanner.getScanStatistics();
                console.log(`キャッシュファイル数: ${scanStats.cachedFiles}`);
                console.log(`監視パス数: ${scanStats.watchPaths.length}`);
            }
            if (this.classificationManager) {
                const classStats = this.classificationManager.getStatistics();
                console.log(`分類済みファイル数: ${classStats.totalClassified}`);
                console.log(`自動適用数: ${classStats.autoApplied}`);
                console.log(`平均信頼度: ${classStats.averageConfidence.toFixed(2)}`);
            }
            console.log('========================');
        }
        catch (error) {
            console.warn('統計情報の取得に失敗しました:', error.message);
        }
    }
    /**
     * システムをシャットダウン
     */
    async shutdown() {
        try {
            console.log('CPOS システムをシャットダウン中...');
            // ファイルスキャンを停止
            this.stopFileScanning();
            // 分類マネージャーをシャットダウン
            if (this.classificationManager) {
                this.classificationManager.shutdown();
            }
            // データベース接続を閉じる
            await this.databaseManager.close();
            this.initialized = false;
            console.log('CPOS システムのシャットダウンが完了しました');
        }
        catch (error) {
            console.error('システムのシャットダウンに失敗しました:', error);
            throw error;
        }
    }
    /**
     * システムの健全性をチェック
     */
    async healthCheck() {
        const issues = [];
        try {
            // 初期化状態をチェック
            if (!this.initialized) {
                issues.push('システムが初期化されていません');
            }
            // データベース接続をチェック
            try {
                await this.databaseManager.getStatistics();
            }
            catch (error) {
                issues.push(`データベース接続エラー: ${error.message}`);
            }
            // 設定ファイルをチェック
            try {
                const config = this.configManager.getConfig();
                if (!this.configManager.validateConfig(config)) {
                    issues.push('設定ファイルが無効です');
                }
            }
            catch (error) {
                issues.push(`設定エラー: ${error.message}`);
            }
            // 環境設定をチェック
            const currentEnv = this.environmentManager.getCurrentEnvironment();
            const envExists = await this.environmentManager.checkEnvironmentConfig(currentEnv);
            if (!envExists) {
                issues.push(`環境設定ファイルが見つかりません: ${currentEnv}`);
            }
            return {
                healthy: issues.length === 0,
                issues
            };
        }
        catch (error) {
            issues.push(`健全性チェック中にエラーが発生しました: ${error.message}`);
            return {
                healthy: false,
                issues
            };
        }
    }
    /**
     * システム情報を取得
     */
    getSystemInfo() {
        return {
            version: '1.0.0',
            initialized: this.initialized,
            currentEnvironment: this.environmentManager.getCurrentEnvironment(),
            availableEnvironments: this.environmentManager.getAvailableEnvironments(),
            timestamp: new Date().toISOString()
        };
    }
}
exports.CPOSSystem = CPOSSystem;
// エクスポート
__exportStar(require("./interfaces"), exports);
__exportStar(require("./models"), exports);
__exportStar(require("./core/configuration"), exports);
__exportStar(require("./core/configuration/environment-manager"), exports);
__exportStar(require("./core/database"), exports);
__exportStar(require("./utils/encryption"), exports);
__exportStar(require("./core/file-scanner"), exports);
__exportStar(require("./core/file-scanner/scanner-factory"), exports);
__exportStar(require("./core/file-scanner/scanner-events"), exports);
__exportStar(require("./core/classification"), exports);
__exportStar(require("./core/classification/classification-factory"), exports);
__exportStar(require("./core/classification/classification-manager"), exports);
__exportStar(require("./core/structure-validator"), exports);
__exportStar(require("./core/structure-validator/validator-factory"), exports);
// デフォルトインスタンス
exports.cpos = new CPOSSystem();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7Ozs7Ozs7Ozs7Ozs7OztBQUVILHdEQUE0RDtBQUM1RCxrRkFBOEU7QUFDOUUsOENBQWtEO0FBQ2xELG1EQUF1RDtBQUV2RCx5RUFBeUU7QUFDekUsdUVBQTZFO0FBRTdFLHlGQUEyRjtBQUMzRix5RkFBcUY7QUFFckYsb0ZBQXlGO0FBRXpGLE1BQWEsVUFBVTtJQUNiLGFBQWEsQ0FBdUI7SUFDcEMsa0JBQWtCLENBQXFCO0lBQ3ZDLGVBQWUsQ0FBa0I7SUFDakMsaUJBQWlCLENBQW9CO0lBQ3JDLFdBQVcsR0FBdUIsSUFBSSxDQUFDO0lBQ3ZDLG1CQUFtQixHQUFtQyxJQUFJLENBQUM7SUFDM0Qsb0JBQW9CLEdBQW9DLElBQUksQ0FBQztJQUM3RCxxQkFBcUIsR0FBaUMsSUFBSSxDQUFDO0lBQzNELGtCQUFrQixHQUF1QyxJQUFJLENBQUM7SUFDOUQsV0FBVyxHQUFZLEtBQUssQ0FBQztJQUVyQztRQUNFLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxvQ0FBb0IsRUFBRSxDQUFDO1FBQ2hELElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLHdDQUFrQixFQUFFLENBQUM7UUFDbkQsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLDBCQUFlLEVBQUUsQ0FBQztRQUM3QyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSw4QkFBaUIsRUFBRSxDQUFDO0lBQ25ELENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxVQUFVLENBQUMsY0FBc0IsT0FBTztRQUM1QyxJQUFJLENBQUM7WUFDSCxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDLENBQUM7WUFFakMsUUFBUTtZQUNSLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxxQkFBcUIsQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUUzRCxZQUFZO1lBQ1osTUFBTSxNQUFN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LE1BQU0sQ0FBQyxJQUFJLENBQUMscUJBQXFCLFVBQVUsRUFBRSxDQUFDLENBQUM7WUFDakQsQ0FBQztZQUVELE9BQU87Z0JBQ0wsT0FBTyxFQUFFLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQztnQkFDNUIsTUFBTTthQUNQLENBQUM7UUFDSixDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLE1BQU0sQ0FBQyxJQUFJLENBQUMsd0JBQXdCLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQ3JELE9BQU87Z0JBQ0wsT0FBTyxFQUFFLEtBQUs7Z0JBQ2QsTUFBTTthQUNQLENBQUM7UUFDSixDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsYUFBYTtRQUNYLE9BQU87WUFDTCxPQUFPLEVBQUUsT0FBTztZQUNoQixXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVc7WUFDN0Isa0JBQWtCLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLHFCQUFxQixFQUFFO1lBQ25FLHFCQUFxQixFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyx3QkFBd0IsRUFBRTtZQUN6RSxTQUFTLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUU7U0FDcEMsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQW5XRCxnQ0FtV0M7QUFFRCxTQUFTO0FBQ1QsK0NBQTZCO0FBQzdCLDJDQUF5QjtBQUN6Qix1REFBcUM7QUFDckMsMkVBQXlEO0FBQ3pELGtEQUFnQztBQUNoQyxxREFBbUM7QUFDbkMsc0RBQW9DO0FBQ3BDLHNFQUFvRDtBQUNwRCxxRUFBbUQ7QUFDbkQsd0RBQXNDO0FBQ3RDLCtFQUE2RDtBQUM3RCwrRUFBNkQ7QUFDN0QsNkRBQTJDO0FBQzNDLCtFQUE2RDtBQUU3RCxjQUFjO0FBQ0QsUUFBQSxJQUFJLEdBQUcsSUFBSSxVQUFVLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ1BPUyAoQ29udGludW91cyBQcm9qZWN0IE9yZ2FuaXphdGlvbiBTeXN0ZW0pIE1haW4gRW50cnkgUG9pbnRcbiAqIOe2mee2mueahOODl+ODreOCuOOCp+OCr+ODiOaVtOeQhuOCt+OCueODhuODoOOBruODoeOCpOODs+OCqOODs+ODiOODquODvOODneOCpOODs+ODiFxuICovXG5cbmltcG9ydCB7IENvbmZpZ3VyYXRpb25NYW5hZ2VyIH0gZnJvbSAnLi9jb3JlL2NvbmZpZ3VyYXRpb24nO1xuaW1wb3J0IHsgRW52aXJvbm1lbnRNYW5hZ2VyIH0gZnJvbSAnLi9jb3JlL2NvbmZpZ3VyYXRpb24vZW52aXJvbm1lbnQtbWFuYWdlcic7XG5pbXBvcnQgeyBEYXRhYmFzZU1hbmFnZXIgfSBmcm9tICcuL2NvcmUvZGF0YWJhc2UnO1xuaW1wb3J0IHsgRW5jcnlwdGlvbk1hbmFnZXIgfSBmcm9tICcuL3V0aWxzL2VuY3J5cHRpb24nO1xuaW1wb3J0IHsgRmlsZVNjYW5uZXIgfSBmcm9tICcuL2NvcmUvZmlsZS1zY2FubmVyJztcbmltcG9ydCB7IEZpbGVTY2FubmVyRmFjdG9yeSB9IGZyb20gJy4vY29yZS9maWxlLXNjYW5uZXIvc2Nhbm5lci1mYWN0b3J5JztcbmltcG9ydCB7IEZpbGVTY2FubmVyRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi9jb3JlL2ZpbGUtc2Nhbm5lci9zY2FubmVyLWV2ZW50cyc7XG5pbXBvcnQgeyBGaWxlQ2xhc3NpZmljYXRpb25FbmdpbmUgfSBmcm9tICcuL2NvcmUvY2xhc3NpZmljYXRpb24nO1xuaW1wb3J0IHsgQ2xhc3NpZmljYXRpb25FbmdpbmVGYWN0b3J5IH0gZnJvbSAnLi9jb3JlL2NsYXNzaWZpY2F0aW9uL2NsYXNzaWZpY2F0aW9uLWZhY3RvcnknO1xuaW1wb3J0IHsgQ2xhc3NpZmljYXRpb25NYW5hZ2VyIH0gZnJvbSAnLi9jb3JlL2NsYXNzaWZpY2F0aW9uL2NsYXNzaWZpY2F0aW9uLW1hbmFnZXInO1xuaW1wb3J0IHsgRGlyZWN0b3J5U3RydWN0dXJlVmFsaWRhdG9yIH0gZnJvbSAnLi9jb3JlL3N0cnVjdHVyZS12YWxpZGF0b3InO1xuaW1wb3J0IHsgU3RydWN0dXJlVmFsaWRhdG9yRmFjdG9yeSB9IGZyb20gJy4vY29yZS9zdHJ1Y3R1cmUtdmFsaWRhdG9yL3ZhbGlkYXRvci1mYWN0b3J5JztcblxuZXhwb3J0IGNsYXNzIENQT1NTeXN0ZW0ge1xuICBwcml2YXRlIGNvbmZpZ01hbmFnZXI6IENvbmZpZ3VyYXRpb25NYW5hZ2VyO1xuICBwcml2YXRlIGVudmlyb25tZW50TWFuYWdlcjogRW52aXJvbm1lbnRNYW5hZ2VyO1xuICBwcml2YXRlIGRhdGFiYXNlTWFuYWdlcjogRGF0YWJhc2VNYW5hZ2VyO1xuICBwcml2YXRlIGVuY3J5cHRpb25NYW5hZ2VyOiBFbmNyeXB0aW9uTWFuYWdlcjtcbiAgcHJpdmF0ZSBmaWxlU2Nhbm5lcjogRmlsZVNjYW5uZXIgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBzY2FubmVyRXZlbnRIYW5kbGVyOiBGaWxlU2Nhbm5lckV2ZW50SGFuZGxlciB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIGNsYXNzaWZpY2F0aW9uRW5naW5lOiBGaWxlQ2xhc3NpZmljYXRpb25FbmdpbmUgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBjbGFzc2lmaWNhdGlvbk1hbmFnZXI6IENsYXNzaWZpY2F0aW9uTWFuYWdlciB8IG51bGwgPSBudWxsO1xuICBwcml2YXRlIHN0cnVjdHVyZVZhbGlkYXRvcjogRGlyZWN0b3J5U3RydWN0dXJlVmFsaWRhdG9yIHwgbnVsbCA9IG51bGw7XG4gIHByaXZhdGUgaW5pdGlhbGl6ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmNvbmZpZ01hbmFnZXIgPSBuZXcgQ29uZmlndXJhdGlvbk1hbmFnZXIoKTtcbiAgICB0aGlzLmVudmlyb25tZW50TWFuYWdlciA9IG5ldyBFbnZpcm9ubWVudE1hbmFnZXIoKTtcbiAgICB0aGlzLmRhdGFiYXNlTWFuYWdlciA9IG5ldyBEYXRhYmFzZU1hbmFnZXIoKTtcbiAgICB0aGlzLmVuY3J5cHRpb25NYW5hZ2VyID0gbmV3IEVuY3J5cHRpb25NYW5hZ2VyKCk7XG4gIH1cblxuICAvKipcbiAgICog44K344K544OG44Og44KS5Yid5pyf5YyWXG4gICAqL1xuICBhc3luYyBpbml0aWFsaXplKGVudmlyb25tZW50OiBzdHJpbmcgPSAnbG9jYWwnKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnNvbGUubG9nKCdDUE9TIOOCt+OCueODhuODoOOCkuWIneacn+WMluS4rS4uLicpO1xuXG4gICAgICAvLyDnkrDlooPjgpLoqK3lrppcbiAgICAgIHRoaXMuZW52aXJvbm1lbnRNYW5hZ2VyLnNldEN1cnJlbnRFbnZpcm9ubWVudChlbnZpcm9ubWVudCk7XG5cbiAgICAgIC8vIOeSsOWig+ioreWumuOCkuiqreOBv+i+vOOBv1xuICAgICAgY29uc3QgY29uZmlnID0gYXdhaXQgdGhpcy5lbnZpcm9ubWVudE1hbmFnZXIubG9hZEVudmlyb25tZW50Q29uZmlnKCk7XG4gICAgICBjb25zb2xlLmxvZyhg55Kw5aKDICR7ZW52aXJvbm1lbnR9IOOBruioreWumuOCkuiqreOBv+i+vOOBv+OBvuOBl+OBn2ApO1xuXG4gICAgICAvLyDjg4fjg7zjgr/jg5njg7zjgrnjgpLliJ3mnJ/ljJZcbiAgICAgIGF3YWl0IHRoaXMuZGF0YWJhc2VNYW5hZ2VyLmluaXRpYWxpemUoKTtcbiAgICAgIGNvbnNvbGUubG9nKCfjg4fjg7zjgr/jg5njg7zjgrnjga7liJ3mnJ/ljJbjgYzlrozkuobjgZfjgb7jgZfjgZ8nKTtcblxuICAgICAgLy8g6Kit5a6a44KS5qSc6Ki8XG4gICAgICBpZiAoIXRoaXMuY29uZmlnTWFuYWdlci52YWxpZGF0ZUNvbmZpZyhjb25maWcpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcign6Kit5a6a44Gu5qSc6Ki844Gr5aSx5pWX44GX44G+44GX44GfJyk7XG4gICAgICB9XG5cbiAgICAgIC8vIOODleOCoeOCpOODq+OCueOCreODo+ODiuODvOOCkuWIneacn+WMllxuICAgICAgdGhpcy5maWxlU2Nhbm5lciA9IEZpbGVTY2FubmVyRmFjdG9yeS5jcmVhdGVGcm9tQ29uZmlnKGNvbmZpZyk7XG4gICAgICB0aGlzLnNjYW5uZXJFdmVudEhhbmRsZXIgPSBuZXcgRmlsZVNjYW5uZXJFdmVudEhhbmRsZXIodGhpcy5maWxlU2Nhbm5lciwgdGhpcy5kYXRhYmFzZU1hbmFnZXIpO1xuICAgICAgY29uc29sZS5sb2coJ+ODleOCoeOCpOODq+OCueOCreODo+ODiuODvOOCkuWIneacn+WMluOBl+OBvuOBl+OBnycpO1xuXG4gICAgICAvLyDliIbpoZ7jgqjjg7Pjgrjjg7PjgpLliJ3mnJ/ljJZcbiAgICAgIHRoaXMuY2xhc3NpZmljYXRpb25FbmdpbmUgPSBDbGFzc2lmaWNhdGlvbkVuZ2luZUZhY3RvcnkuY3JlYXRlRnJvbUNvbmZpZyhjb25maWcpO1xuICAgICAgdGhpcy5jbGFzc2lmaWNhdGlvbk1hbmFnZXIgPSBuZXcgQ2xhc3NpZmljYXRpb25NYW5hZ2VyKHRoaXMuY2xhc3NpZmljYXRpb25FbmdpbmUsIHRoaXMuZGF0YWJhc2VNYW5hZ2VyKTtcbiAgICAgIGF3YWl0IHRoaXMuY2xhc3NpZmljYXRpb25NYW5hZ2VyLmluaXRpYWxpemUoKTtcbiAgICAgIFxuICAgICAgLy8g44K544Kt44Oj44OK44O844Go5YiG6aGe44Oe44ON44O844K444Oj44O844KS57Wx5ZCIXG4gICAgICB0aGlzLmNsYXNzaWZpY2F0aW9uTWFuYWdlci5pbnRlZ3JhdGVXaXRoU2Nhbm5lcih0aGlzLmZpbGVTY2FubmVyKTtcbiAgICAgIGNvbnNvbGUubG9nKCfliIbpoZ7jgqjjg7Pjgrjjg7PjgpLliJ3mnJ/ljJbjgZfjgb7jgZfjgZ8nKTtcblxuICAgICAgLy8g5qeL6YCg5qSc6Ki85qmf6IO944KS5Yid5pyf5YyWXG4gICAgICB0aGlzLnN0cnVjdHVyZVZhbGlkYXRvciA9IFN0cnVjdHVyZVZhbGlkYXRvckZhY3RvcnkuY3JlYXRlRnJvbUNvbmZpZyhjb25maWcpO1xuICAgICAgYXdhaXQgdGhpcy5zdHJ1Y3R1cmVWYWxpZGF0b3IuaW5pdGlhbGl6ZSgpO1xuICAgICAgY29uc29sZS5sb2coJ+ani+mAoOaknOiovOapn+iDveOCkuWIneacn+WMluOBl+OBvuOBl+OBnycpO1xuXG4gICAgICB0aGlzLmluaXRpYWxpemVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUubG9nKCdDUE9TIOOCt+OCueODhuODoOOBruWIneacn+WMluOBjOWujOS6huOBl+OBvuOBl+OBnycpO1xuXG4gICAgICAvLyDjgrfjgrnjg4bjg6DntbHoqIjjgpLooajnpLpcbiAgICAgIGF3YWl0IHRoaXMuZGlzcGxheVN5c3RlbVN0YXRpc3RpY3MoKTtcblxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCdDUE9TIOOCt+OCueODhuODoOOBruWIneacn+WMluOBq+WkseaVl+OBl+OBvuOBl+OBnzonLCBlcnJvcik7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44K344K544OG44Og44GM5Yid5pyf5YyW44GV44KM44Gm44GE44KL44GL44OB44Kn44OD44KvXG4gICAqL1xuICBwcml2YXRlIGNoZWNrSW5pdGlhbGl6ZWQoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmluaXRpYWxpemVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ+OCt+OCueODhuODoOOBjOWIneacn+WMluOBleOCjOOBpuOBhOOBvuOBm+OCk+OAgmluaXRpYWxpemUoKeOCkuWFiOOBq+Wun+ihjOOBl+OBpuOBj+OBoOOBleOBhOOAgicpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDnj77lnKjjga7oqK3lrprjgpLlj5blvpdcbiAgICovXG4gIGdldENvbmZpZygpIHtcbiAgICB0aGlzLmNoZWNrSW5pdGlhbGl6ZWQoKTtcbiAgICByZXR1cm4gdGhpcy5jb25maWdNYW5hZ2VyLmdldENvbmZpZygpO1xuICB9XG5cbiAgLyoqXG4gICAqIOeSsOWig+ODnuODjeODvOOCuOODo+ODvOOCkuWPluW+l1xuICAgKi9cbiAgZ2V0RW52aXJvbm1lbnRNYW5hZ2VyKCk6IEVudmlyb25tZW50TWFuYWdlciB7XG4gICAgcmV0dXJuIHRoaXMuZW52aXJvbm1lbnRNYW5hZ2VyO1xuICB9XG5cbiAgLyoqXG4gICAqIOODh+ODvOOCv+ODmeODvOOCueODnuODjeODvOOCuOODo+ODvOOCkuWPluW+l1xuICAgKi9cbiAgZ2V0RGF0YWJhc2VNYW5hZ2VyKCk6IERhdGFiYXNlTWFuYWdlciB7XG4gICAgdGhpcy5jaGVja0luaXRpYWxpemVkKCk7XG4gICAgcmV0dXJuIHRoaXMuZGF0YWJhc2VNYW5hZ2VyO1xuICB9XG5cbiAgLyoqXG4gICAqIOaal+WPt+WMluODnuODjeODvOOCuOODo+ODvOOCkuWPluW+l1xuICAgKi9cbiAgZ2V0RW5jcnlwdGlvbk1hbmFnZXIoKTogRW5jcnlwdGlvbk1hbmFnZXIge1xuICAgIHJldHVybiB0aGlzLmVuY3J5cHRpb25NYW5hZ2VyO1xuICB9XG5cbiAgLyoqXG4gICAqIOODleOCoeOCpOODq+OCueOCreODo+ODiuODvOOCkuWPluW+l1xuICAgKi9cbiAgZ2V0RmlsZVNjYW5uZXIoKTogRmlsZVNjYW5uZXIgfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5maWxlU2Nhbm5lcjtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrnjgq3jg6Pjg4rjg7zjgqTjg5njg7Pjg4jjg4/jg7Pjg4njg6njg7zjgpLlj5blvpdcbiAgICovXG4gIGdldFNjYW5uZXJFdmVudEhhbmRsZXIoKTogRmlsZVNjYW5uZXJFdmVudEhhbmRsZXIgfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5zY2FubmVyRXZlbnRIYW5kbGVyO1xuICB9XG5cbiAgLyoqXG4gICAqIOWIhumhnuOCqOODs+OCuOODs+OCkuWPluW+l1xuICAgKi9cbiAgZ2V0Q2xhc3NpZmljYXRpb25FbmdpbmUoKTogRmlsZUNsYXNzaWZpY2F0aW9uRW5naW5lIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuY2xhc3NpZmljYXRpb25FbmdpbmU7XG4gIH1cblxuICAvKipcbiAgICog5YiG6aGe44Oe44ON44O844K444Oj44O844KS5Y+W5b6XXG4gICAqL1xuICBnZXRDbGFzc2lmaWNhdGlvbk1hbmFnZXIoKTogQ2xhc3NpZmljYXRpb25NYW5hZ2VyIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuY2xhc3NpZmljYXRpb25NYW5hZ2VyO1xuICB9XG5cbiAgLyoqXG4gICAqIOani+mAoOaknOiovOapn+iDveOCkuWPluW+l1xuICAgKi9cbiAgZ2V0U3RydWN0dXJlVmFsaWRhdG9yKCk6IERpcmVjdG9yeVN0cnVjdHVyZVZhbGlkYXRvciB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLnN0cnVjdHVyZVZhbGlkYXRvcjtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg5XjgqHjgqTjg6vjgrnjgq3jg6Pjg7PjgpLplovlp4tcbiAgICovXG4gIGFzeW5jIHN0YXJ0RmlsZVNjYW5uaW5nKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuY2hlY2tJbml0aWFsaXplZCgpO1xuICAgIFxuICAgIGlmICghdGhpcy5maWxlU2Nhbm5lcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCfjg5XjgqHjgqTjg6vjgrnjgq3jg6Pjg4rjg7zjgYzliJ3mnJ/ljJbjgZXjgozjgabjgYTjgb7jgZvjgpMnKTtcbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLmZpbGVTY2FubmVyLnN0YXJ0U2Nhbm5pbmcoKTtcbiAgICBjb25zb2xlLmxvZygn44OV44Kh44Kk44Or44K544Kt44Oj44Oz44KS6ZaL5aeL44GX44G+44GX44GfJyk7XG4gIH1cblxuICAvKipcbiAgICog44OV44Kh44Kk44Or44K544Kt44Oj44Oz44KS5YGc5q2iXG4gICAqL1xuICBzdG9wRmlsZVNjYW5uaW5nKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLmZpbGVTY2FubmVyKSB7XG4gICAgICB0aGlzLmZpbGVTY2FubmVyLnN0b3BTY2FubmluZygpO1xuICAgICAgY29uc29sZS5sb2coJ+ODleOCoeOCpOODq+OCueOCreODo+ODs+OCkuWBnOatouOBl+OBvuOBl+OBnycpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg5XjgqHjgqTjg6vjgpLliIbpoZ5cbiAgICovXG4gIGFzeW5jIGNsYXNzaWZ5RmlsZShmaWxlUGF0aDogc3RyaW5nLCBhdXRvQXBwbHk6IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8YW55PiB7XG4gICAgdGhpcy5jaGVja0luaXRpYWxpemVkKCk7XG4gICAgXG4gICAgaWYgKCF0aGlzLmNsYXNzaWZpY2F0aW9uTWFuYWdlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCfliIbpoZ7jg57jg43jg7zjgrjjg6Pjg7zjgYzliJ3mnJ/ljJbjgZXjgozjgabjgYTjgb7jgZvjgpMnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYXdhaXQgdGhpcy5jbGFzc2lmaWNhdGlvbk1hbmFnZXIuY2xhc3NpZnlGaWxlKGZpbGVQYXRoLCBhdXRvQXBwbHkpO1xuICB9XG5cbiAgLyoqXG4gICAqIOODh+OCo+ODrOOCr+ODiOODquWFqOS9k+OCkuWIhumhnlxuICAgKi9cbiAgYXN5bmMgY2xhc3NpZnlEaXJlY3RvcnkoZGlyUGF0aDogc3RyaW5nLCByZWN1cnNpdmU6IGJvb2xlYW4gPSB0cnVlLCBhdXRvQXBwbHk6IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8YW55W10+IHtcbiAgICB0aGlzLmNoZWNrSW5pdGlhbGl6ZWQoKTtcbiAgICBcbiAgICBpZiAoIXRoaXMuY2xhc3NpZmljYXRpb25NYW5hZ2VyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ+WIhumhnuODnuODjeODvOOCuOODo+ODvOOBjOWIneacn+WMluOBleOCjOOBpuOBhOOBvuOBm+OCkycpO1xuICAgIH1cblxuICAgIHJldHVybiBhd2FpdCB0aGlzLmNsYXNzaWZpY2F0aW9uTWFuYWdlci5jbGFzc2lmeURpcmVjdG9yeShkaXJQYXRoLCByZWN1cnNpdmUsIGF1dG9BcHBseSk7XG4gIH1cblxuICAvKipcbiAgICog5YiG6aGe57Wx6KiI44KS5Y+W5b6XXG4gICAqL1xuICBnZXRDbGFzc2lmaWNhdGlvblN0YXRpc3RpY3MoKTogYW55IHtcbiAgICB0aGlzLmNoZWNrSW5pdGlhbGl6ZWQoKTtcbiAgICBcbiAgICBpZiAoIXRoaXMuY2xhc3NpZmljYXRpb25NYW5hZ2VyKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5jbGFzc2lmaWNhdGlvbk1hbmFnZXIuZ2V0U3RhdGlzdGljcygpO1xuICB9XG5cbiAgLyoqXG4gICAqIOODl+ODreOCuOOCp+OCr+ODiOani+mAoOOCkuaknOiovFxuICAgKi9cbiAgYXN5bmMgdmFsaWRhdGVQcm9qZWN0U3RydWN0dXJlKCk6IFByb21pc2U8YW55PiB7XG4gICAgdGhpcy5jaGVja0luaXRpYWxpemVkKCk7XG4gICAgXG4gICAgaWYgKCF0aGlzLnN0cnVjdHVyZVZhbGlkYXRvcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCfmp4vpgKDmpJzoqLzmqZ/og73jgYzliJ3mnJ/ljJbjgZXjgozjgabjgYTjgb7jgZvjgpMnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYXdhaXQgdGhpcy5zdHJ1Y3R1cmVWYWxpZGF0b3IudmFsaWRhdGVTdHJ1Y3R1cmUoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDmp4vpgKDpgZXlj43jgpLoh6rli5Xkv67mraNcbiAgICovXG4gIGFzeW5jIGF1dG9GaXhTdHJ1Y3R1cmUoKTogUHJvbWlzZTxhbnk+IHtcbiAgICB0aGlzLmNoZWNrSW5pdGlhbGl6ZWQoKTtcbiAgICBcbiAgICBpZiAoIXRoaXMuc3RydWN0dXJlVmFsaWRhdG9yKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ+ani+mAoOaknOiovOapn+iDveOBjOWIneacn+WMluOBleOCjOOBpuOBhOOBvuOBm+OCkycpO1xuICAgIH1cblxuICAgIGNvbnN0IHZhbGlkYXRpb25SZXN1bHQgPSBhd2FpdCB0aGlzLnN0cnVjdHVyZVZhbGlkYXRvci52YWxpZGF0ZVN0cnVjdHVyZSgpO1xuICAgIHJldHVybiBhd2FpdCB0aGlzLnN0cnVjdHVyZVZhbGlkYXRvci5hdXRvRml4KHZhbGlkYXRpb25SZXN1bHQuc3VnZ2VzdGlvbnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCt+OCueODhuODoOe1seioiOOCkuihqOekulxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBkaXNwbGF5U3lzdGVtU3RhdGlzdGljcygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCB0aGlzLmRhdGFiYXNlTWFuYWdlci5nZXRTdGF0aXN0aWNzKCk7XG4gICAgICBjb25zb2xlLmxvZygnPT09IENQT1Mg44K344K544OG44Og57Wx6KiIID09PScpO1xuICAgICAgY29uc29sZS5sb2coYOODleOCoeOCpOODq+aVsDogJHtzdGF0cy5maWxlQ291bnR9YCk7XG4gICAgICBjb25zb2xlLmxvZyhg5ZCM5pyf54q25oWL5pWwOiAke3N0YXRzLnN5bmNTdGF0ZUNvdW50fWApO1xuICAgICAgY29uc29sZS5sb2coYOODkOODg+OCr+OCouODg+ODl+aVsDogJHtzdGF0cy5iYWNrdXBDb3VudH1gKTtcbiAgICAgIGNvbnNvbGUubG9nKGDmk43kvZzjg63jgrDmlbA6ICR7c3RhdHMub3BlcmF0aW9uTG9nQ291bnR9YCk7XG4gICAgICBcbiAgICAgIGlmICh0aGlzLmZpbGVTY2FubmVyKSB7XG4gICAgICAgIGNvbnN0IHNjYW5TdGF0cyA9IHRoaXMuZmlsZVNjYW5uZXIuZ2V0U2NhblN0YXRpc3RpY3MoKTtcbiAgICAgICAgY29uc29sZS5sb2coYOOCreODo+ODg+OCt+ODpeODleOCoeOCpOODq+aVsDogJHtzY2FuU3RhdHMuY2FjaGVkRmlsZXN9YCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGDnm6Poppbjg5HjgrnmlbA6ICR7c2NhblN0YXRzLndhdGNoUGF0aHMubGVuZ3RofWApO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5jbGFzc2lmaWNhdGlvbk1hbmFnZXIpIHtcbiAgICAgICAgY29uc3QgY2xhc3NTdGF0cyA9IHRoaXMuY2xhc3NpZmljYXRpb25NYW5hZ2VyLmdldFN0YXRpc3RpY3MoKTtcbiAgICAgICAgY29uc29sZS5sb2coYOWIhumhnua4iOOBv+ODleOCoeOCpOODq+aVsDogJHtjbGFzc1N0YXRzLnRvdGFsQ2xhc3NpZmllZH1gKTtcbiAgICAgICAgY29uc29sZS5sb2coYOiHquWLlemBqeeUqOaVsDogJHtjbGFzc1N0YXRzLmF1dG9BcHBsaWVkfWApO1xuICAgICAgICBjb25zb2xlLmxvZyhg5bmz5Z2H5L+h6aC85bqmOiAke2NsYXNzU3RhdHMuYXZlcmFnZUNvbmZpZGVuY2UudG9GaXhlZCgyKX1gKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coJz09PT09PT09PT09PT09PT09PT09PT09PScpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLndhcm4oJ+e1seioiOaDheWgseOBruWPluW+l+OBq+WkseaVl+OBl+OBvuOBl+OBnzonLCBlcnJvci5tZXNzYWdlKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44K344K544OG44Og44KS44K344Oj44OD44OI44OA44Km44OzXG4gICAqL1xuICBhc3luYyBzaHV0ZG93bigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgY29uc29sZS5sb2coJ0NQT1Mg44K344K544OG44Og44KS44K344Oj44OD44OI44OA44Km44Oz5LitLi4uJyk7XG5cbiAgICAgIC8vIOODleOCoeOCpOODq+OCueOCreODo+ODs+OCkuWBnOatolxuICAgICAgdGhpcy5zdG9wRmlsZVNjYW5uaW5nKCk7XG5cbiAgICAgIC8vIOWIhumhnuODnuODjeODvOOCuOODo+ODvOOCkuOCt+ODo+ODg+ODiOODgOOCpuODs1xuICAgICAgaWYgKHRoaXMuY2xhc3NpZmljYXRpb25NYW5hZ2VyKSB7XG4gICAgICAgIHRoaXMuY2xhc3NpZmljYXRpb25NYW5hZ2VyLnNodXRkb3duKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIOODh+ODvOOCv+ODmeODvOOCueaOpee2muOCkumWieOBmOOCi1xuICAgICAgYXdhaXQgdGhpcy5kYXRhYmFzZU1hbmFnZXIuY2xvc2UoKTtcblxuICAgICAgdGhpcy5pbml0aWFsaXplZCA9IGZhbHNlO1xuICAgICAgY29uc29sZS5sb2coJ0NQT1Mg44K344K544OG44Og44Gu44K344Oj44OD44OI44OA44Km44Oz44GM5a6M5LqG44GX44G+44GX44GfJyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ+OCt+OCueODhuODoOOBruOCt+ODo+ODg+ODiOODgOOCpuODs+OBq+WkseaVl+OBl+OBvuOBl+OBnzonLCBlcnJvcik7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44K344K544OG44Og44Gu5YGl5YWo5oCn44KS44OB44Kn44OD44KvXG4gICAqL1xuICBhc3luYyBoZWFsdGhDaGVjaygpOiBQcm9taXNlPHsgaGVhbHRoeTogYm9vbGVhbjsgaXNzdWVzOiBzdHJpbmdbXSB9PiB7XG4gICAgY29uc3QgaXNzdWVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIOWIneacn+WMlueKtuaFi+OCkuODgeOCp+ODg+OCr1xuICAgICAgaWYgKCF0aGlzLmluaXRpYWxpemVkKSB7XG4gICAgICAgIGlzc3Vlcy5wdXNoKCfjgrfjgrnjg4bjg6DjgYzliJ3mnJ/ljJbjgZXjgozjgabjgYTjgb7jgZvjgpMnKTtcbiAgICAgIH1cblxuICAgICAgLy8g44OH44O844K/44OZ44O844K55o6l57aa44KS44OB44Kn44OD44KvXG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCB0aGlzLmRhdGFiYXNlTWFuYWdlci5nZXRTdGF0aXN0aWNzKCk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBpc3N1ZXMucHVzaChg44OH44O844K/44OZ44O844K55o6l57aa44Ko44Op44O8OiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICB9XG5cbiAgICAgIC8vIOioreWumuODleOCoeOCpOODq+OCkuODgeOCp+ODg+OCr1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgY29uZmlnID0gdGhpcy5jb25maWdNYW5hZ2VyLmdldENvbmZpZygpO1xuICAgICAgICBpZiAoIXRoaXMuY29uZmlnTWFuYWdlci52YWxpZGF0ZUNvbmZpZyhjb25maWcpKSB7XG4gICAgICAgICAgaXNzdWVzLnB1c2goJ+ioreWumuODleOCoeOCpOODq+OBjOeEoeWKueOBp+OBmScpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBpc3N1ZXMucHVzaChg6Kit5a6a44Ko44Op44O8OiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICB9XG5cbiAgICAgIC8vIOeSsOWig+ioreWumuOCkuODgeOCp+ODg+OCr1xuICAgICAgY29uc3QgY3VycmVudEVudiA9IHRoaXMuZW52aXJvbm1lbnRNYW5hZ2VyLmdldEN1cnJlbnRFbnZpcm9ubWVudCgpO1xuICAgICAgY29uc3QgZW52RXhpc3RzID0gYXdhaXQgdGhpcy5lbnZpcm9ubWVudE1hbmFnZXIuY2hlY2tFbnZpcm9ubWVudENvbmZpZyhjdXJyZW50RW52KTtcbiAgICAgIGlmICghZW52RXhpc3RzKSB7XG4gICAgICAgIGlzc3Vlcy5wdXNoKGDnkrDlooPoqK3lrprjg5XjgqHjgqTjg6vjgYzopovjgaTjgYvjgorjgb7jgZvjgpM6ICR7Y3VycmVudEVudn1gKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgaGVhbHRoeTogaXNzdWVzLmxlbmd0aCA9PT0gMCxcbiAgICAgICAgaXNzdWVzXG4gICAgICB9O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBpc3N1ZXMucHVzaChg5YGl5YWo5oCn44OB44Kn44OD44Kv5Lit44Gr44Ko44Op44O844GM55m655Sf44GX44G+44GX44GfOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBoZWFsdGh5OiBmYWxzZSxcbiAgICAgICAgaXNzdWVzXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjgrfjgrnjg4bjg6Dmg4XloLHjgpLlj5blvpdcbiAgICovXG4gIGdldFN5c3RlbUluZm8oKTogYW55IHtcbiAgICByZXR1cm4ge1xuICAgICAgdmVyc2lvbjogJzEuMC4wJyxcbiAgICAgIGluaXRpYWxpemVkOiB0aGlzLmluaXRpYWxpemVkLFxuICAgICAgY3VycmVudEVudmlyb25tZW50OiB0aGlzLmVudmlyb25tZW50TWFuYWdlci5nZXRDdXJyZW50RW52aXJvbm1lbnQoKSxcbiAgICAgIGF2YWlsYWJsZUVudmlyb25tZW50czogdGhpcy5lbnZpcm9ubWVudE1hbmFnZXIuZ2V0QXZhaWxhYmxlRW52aXJvbm1lbnRzKCksXG4gICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgIH07XG4gIH1cbn1cblxuLy8g44Ko44Kv44K544Od44O844OIXG5leHBvcnQgKiBmcm9tICcuL2ludGVyZmFjZXMnO1xuZXhwb3J0ICogZnJvbSAnLi9tb2RlbHMnO1xuZXhwb3J0ICogZnJvbSAnLi9jb3JlL2NvbmZpZ3VyYXRpb24nO1xuZXhwb3J0ICogZnJvbSAnLi9jb3JlL2NvbmZpZ3VyYXRpb24vZW52aXJvbm1lbnQtbWFuYWdlcic7XG5leHBvcnQgKiBmcm9tICcuL2NvcmUvZGF0YWJhc2UnO1xuZXhwb3J0ICogZnJvbSAnLi91dGlscy9lbmNyeXB0aW9uJztcbmV4cG9ydCAqIGZyb20gJy4vY29yZS9maWxlLXNjYW5uZXInO1xuZXhwb3J0ICogZnJvbSAnLi9jb3JlL2ZpbGUtc2Nhbm5lci9zY2FubmVyLWZhY3RvcnknO1xuZXhwb3J0ICogZnJvbSAnLi9jb3JlL2ZpbGUtc2Nhbm5lci9zY2FubmVyLWV2ZW50cyc7XG5leHBvcnQgKiBmcm9tICcuL2NvcmUvY2xhc3NpZmljYXRpb24nO1xuZXhwb3J0ICogZnJvbSAnLi9jb3JlL2NsYXNzaWZpY2F0aW9uL2NsYXNzaWZpY2F0aW9uLWZhY3RvcnknO1xuZXhwb3J0ICogZnJvbSAnLi9jb3JlL2NsYXNzaWZpY2F0aW9uL2NsYXNzaWZpY2F0aW9uLW1hbmFnZXInO1xuZXhwb3J0ICogZnJvbSAnLi9jb3JlL3N0cnVjdHVyZS12YWxpZGF0b3InO1xuZXhwb3J0ICogZnJvbSAnLi9jb3JlL3N0cnVjdHVyZS12YWxpZGF0b3IvdmFsaWRhdG9yLWZhY3RvcnknO1xuXG4vLyDjg4fjg5Xjgqnjg6vjg4jjgqTjg7Pjgrnjgr/jg7PjgrlcbmV4cG9ydCBjb25zdCBjcG9zID0gbmV3IENQT1NTeXN0ZW0oKTsiXX0=