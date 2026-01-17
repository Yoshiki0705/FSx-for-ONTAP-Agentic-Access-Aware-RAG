"use strict";
/**
 * Classification Manager
 * 分類エンジンの管理とファイルスキャナーとの統合
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
exports.ClassificationManager = void 0;
const events_1 = require("events");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class ClassificationManager extends events_1.EventEmitter {
    engine;
    databaseManager;
    stats;
    classificationQueue = [];
    isProcessing = false;
    processingInterval = null;
    constructor(engine, databaseManager) {
        super();
        this.engine = engine;
        this.databaseManager = databaseManager;
        this.stats = this.initializeStats();
    }
    /**
     * 分類マネージャーを初期化
     */
    async initialize() {
        try {
            // 分類エンジンを初期化
            await this.engine.initialize();
            // 処理キューを開始
            this.startProcessingQueue();
            console.log('分類マネージャーを初期化しました');
        }
        catch (error) {
            console.error('分類マネージャーの初期化に失敗しました:', error);
            throw error;
        }
    }
    /**
     * ファイルスキャナーと統合
     */
    integrateWithScanner(scanner) {
        // ファイル変更イベントをリッスン
        scanner.on('fileChanged', this.handleFileChanged.bind(this));
        // 分類が必要なファイルのイベントをリッスン
        scanner.on('fileNeedsClassification', this.handleFileNeedsClassification.bind(this));
        console.log('ファイルスキャナーとの統合が完了しました');
    }
    /**
     * ファイル変更イベントを処理
     */
    async handleFileChanged(event) {
        if (event.type === 'added' || event.type === 'modified') {
            await this.queueForClassification(event.filePath);
        }
    }
    /**
     * 分類が必要なファイルのイベントを処理
     */
    async handleFileNeedsClassification(event) {
        await this.queueForClassification(event.filePath);
    }
    /**
     * ファイルを分類キューに追加
     */
    async queueForClassification(filePath) {
        if (!this.classificationQueue.includes(filePath)) {
            this.classificationQueue.push(filePath);
            console.log(`分類キューに追加: ${filePath}`);
        }
    }
    /**
     * ファイルを即座に分類
     */
    async classifyFile(filePath, autoApply = false) {
        try {
            console.log(`ファイルを分類中: ${filePath}`);
            // ファイルの分類を実行
            const result = await this.engine.classifyFile(filePath);
            // 統計を更新
            this.updateStats(result, autoApply && result.confidence >= 0.7);
            // 分類イベントを発行
            const classificationEvent = {
                filePath,
                result,
                applied: false,
                timestamp: new Date()
            };
            // 自動適用の判定
            if (autoApply && result.confidence >= 0.7) {
                const applied = await this.applyClassification(filePath, result);
                classificationEvent.applied = applied;
            }
            this.emit('fileClassified', classificationEvent);
            return result;
        }
        catch (error) {
            console.error(`ファイル分類エラー (${filePath}):`, error);
            throw error;
        }
    }
    /**
     * 分類結果を適用
     */
    async applyClassification(filePath, result) {
        try {
            const targetPath = result.suggestedPath;
            const fileName = path.basename(filePath);
            const newFilePath = path.join(targetPath, fileName);
            // ターゲットディレクトリが存在しない場合は作成
            await fs.mkdir(path.dirname(newFilePath), { recursive: true });
            // ファイルが既に正しい場所にある場合はスキップ
            if (path.resolve(filePath) === path.resolve(newFilePath)) {
                console.log(`ファイルは既に正しい場所にあります: ${filePath}`);
                return true;
            }
            // ファイルを移動
            await fs.rename(filePath, newFilePath);
            // データベースのメタデータを更新
            const metadata = await this.databaseManager.getFileMetadata(filePath);
            if (metadata) {
                metadata.path = newFilePath;
                metadata.category = result.category;
                await this.databaseManager.upsertFileMetadata(metadata);
            }
            console.log(`ファイルを移動しました: ${filePath} → ${newFilePath}`);
            // 適用イベントを発行
            this.emit('classificationApplied', {
                originalPath: filePath,
                newPath: newFilePath,
                result,
                timestamp: new Date()
            });
            return true;
        }
        catch (error) {
            console.error(`分類適用エラー (${filePath}):`, error);
            return false;
        }
    }
    /**
     * 処理キューを開始
     */
    startProcessingQueue() {
        if (this.processingInterval) {
            return;
        }
        this.processingInterval = setInterval(async () => {
            await this.processQueue();
        }, 5000); // 5秒間隔で処理
    }
    /**
     * 処理キューを停止
     */
    stopProcessingQueue() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
    }
    /**
     * キューを処理
     */
    async processQueue() {
        if (this.isProcessing || this.classificationQueue.length === 0) {
            return;
        }
        this.isProcessing = true;
        try {
            // キューから最大5件を処理
            const batch = this.classificationQueue.splice(0, 5);
            for (const filePath of batch) {
                try {
                    await this.classifyFile(filePath, true); // 自動適用有効
                }
                catch (error) {
                    console.error(`キュー処理エラー (${filePath}):`, error);
                }
            }
            if (batch.length > 0) {
                console.log(`分類キューを処理しました: ${batch.length} ファイル`);
            }
        }
        finally {
            this.isProcessing = false;
        }
    }
    /**
     * 統計を初期化
     */
    initializeStats() {
        return {
            totalClassified: 0,
            autoApplied: 0,
            manualReview: 0,
            averageConfidence: 0,
            categoryDistribution: {}
        };
    }
    /**
     * 統計を更新
     */
    updateStats(result, applied) {
        this.stats.totalClassified++;
        if (applied) {
            this.stats.autoApplied++;
        }
        else {
            this.stats.manualReview++;
        }
        // 平均信頼度を更新
        const totalConfidence = this.stats.averageConfidence * (this.stats.totalClassified - 1) + result.confidence;
        this.stats.averageConfidence = totalConfidence / this.stats.totalClassified;
        // カテゴリ分布を更新
        const category = result.category || 'unknown';
        this.stats.categoryDistribution[category] = (this.stats.categoryDistribution[category] || 0) + 1;
    }
    /**
     * 複数ファイルを一括分類
     */
    async classifyBatch(filePaths, autoApply = false) {
        const results = [];
        console.log(`一括分類を開始: ${filePaths.length} ファイル`);
        for (const filePath of filePaths) {
            try {
                const result = await this.classifyFile(filePath, autoApply);
                results.push(result);
            }
            catch (error) {
                console.error(`一括分類エラー (${filePath}):`, error);
            }
        }
        console.log(`一括分類が完了: ${results.length}/${filePaths.length} ファイル`);
        return results;
    }
    /**
     * ディレクトリ全体を分類
     */
    async classifyDirectory(dirPath, recursive = true, autoApply = false) {
        const filePaths = [];
        const scanDirectory = async (currentPath) => {
            try {
                const entries = await fs.readdir(currentPath, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(currentPath, entry.name);
                    if (entry.isFile()) {
                        filePaths.push(fullPath);
                    }
                    else if (entry.isDirectory() && recursive) {
                        await scanDirectory(fullPath);
                    }
                }
            }
            catch (error) {
                console.error(`ディレクトリスキャンエラー (${currentPath}):`, error);
            }
        };
        await scanDirectory(dirPath);
        return await this.classifyBatch(filePaths, autoApply);
    }
    /**
     * 分類統計を取得
     */
    getStatistics() {
        return { ...this.stats };
    }
    /**
     * 分類エンジンの統計を取得
     */
    getEngineStatistics() {
        return this.engine.getClassificationStatistics();
    }
    /**
     * キューの状態を取得
     */
    getQueueStatus() {
        return {
            queueLength: this.classificationQueue.length,
            isProcessing: this.isProcessing
        };
    }
    /**
     * 統計をリセット
     */
    resetStatistics() {
        this.stats = this.initializeStats();
        console.log('分類統計をリセットしました');
    }
    /**
     * シャットダウン
     */
    shutdown() {
        this.stopProcessingQueue();
        console.log('分類マネージャーをシャットダウンしました');
    }
}
exports.ClassificationManager = ClassificationManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xhc3NpZmljYXRpb24tbWFuYWdlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNsYXNzaWZpY2F0aW9uLW1hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7R0FHRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxtQ0FBc0M7QUFPdEMsZ0RBQWtDO0FBQ2xDLDJDQUE2QjtBQWlCN0IsTUFBYSxxQkFBc0IsU0FBUSxxQkFBWTtJQUM3QyxNQUFNLENBQTJCO0lBQ2pDLGVBQWUsQ0FBa0I7SUFDakMsS0FBSyxDQUFzQjtJQUMzQixtQkFBbUIsR0FBYSxFQUFFLENBQUM7SUFDbkMsWUFBWSxHQUFZLEtBQUssQ0FBQztJQUM5QixrQkFBa0IsR0FBMEIsSUFBSSxDQUFDO0lBRXpELFlBQVksTUFBZ0MsRUFBRSxlQUFnQztRQUM1RSxLQUFLLEVBQUUsQ0FBQztRQUNSLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxlQUFlLEdBQUcsZUFBZSxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO0lBQ3RDLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxVQUFVO1FBQ2QsSUFBSSxDQUFDO1lBQ0gsYUFBYTtZQUNiLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUUvQixXQUFXO1lBQ1gsSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7WUFFNUIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQ2xDLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyxzQkFBc0IsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUM3QyxNQUFNLEtBQUssQ0FBQztRQUNkLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxvQkFBb0IsQ0FBQyxPQUFvQjtR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Q0wsV0FBVyxFQUFFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNO1lBQzVDLFlBQVksRUFBRSxJQUFJLENBQUMsWUFBWTtTQUNoQyxDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0gsZUFBZTtRQUNiLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1FBQ3BDLE9BQU8sQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLENBQUM7SUFDL0IsQ0FBQztJQUVEOztPQUVHO0lBQ0gsUUFBUTtRQUNOLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1FBQzNCLE9BQU8sQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsQ0FBQztJQUN0QyxDQUFDO0NBQ0Y7QUExVUQsc0RBMFVDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDbGFzc2lmaWNhdGlvbiBNYW5hZ2VyXG4gKiDliIbpoZ7jgqjjg7Pjgrjjg7Pjga7nrqHnkIbjgajjg5XjgqHjgqTjg6vjgrnjgq3jg6Pjg4rjg7zjgajjga7ntbHlkIhcbiAqL1xuXG5pbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xuaW1wb3J0IHsgRmlsZUNsYXNzaWZpY2F0aW9uRW5naW5lIH0gZnJvbSAnLi9pbmRleCc7XG5pbXBvcnQgeyBDbGFzc2lmaWNhdGlvbkVuZ2luZUZhY3RvcnkgfSBmcm9tICcuL2NsYXNzaWZpY2F0aW9uLWZhY3RvcnknO1xuaW1wb3J0IHsgRmlsZVNjYW5uZXIsIEZpbGVDaGFuZ2VFdmVudCB9IGZyb20gJy4uL2ZpbGUtc2Nhbm5lcic7XG5pbXBvcnQgeyBEYXRhYmFzZU1hbmFnZXIgfSBmcm9tICcuLi9kYXRhYmFzZSc7XG5pbXBvcnQgeyBGaWxlTWV0YWRhdGFNb2RlbCB9IGZyb20gJy4uLy4uL21vZGVscyc7XG5pbXBvcnQgeyBDbGFzc2lmaWNhdGlvblJlc3VsdCB9IGZyb20gJy4uLy4uL2ludGVyZmFjZXMnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMvcHJvbWlzZXMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuZXhwb3J0IGludGVyZmFjZSBDbGFzc2lmaWNhdGlvbkV2ZW50IHtcbiAgZmlsZVBhdGg6IHN0cmluZztcbiAgcmVzdWx0OiBDbGFzc2lmaWNhdGlvblJlc3VsdDtcbiAgYXBwbGllZDogYm9vbGVhbjtcbiAgdGltZXN0YW1wOiBEYXRlO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENsYXNzaWZpY2F0aW9uU3RhdHMge1xuICB0b3RhbENsYXNzaWZpZWQ6IG51bWJlcjtcbiAgYXV0b0FwcGxpZWQ6IG51bWJlcjtcbiAgbWFudWFsUmV2aWV3OiBudW1iZXI7XG4gIGF2ZXJhZ2VDb25maWRlbmNlOiBudW1iZXI7XG4gIGNhdGVnb3J5RGlzdHJpYnV0aW9uOiB7IFtjYXRlZ29yeTogc3RyaW5nXTogbnVtYmVyIH07XG59XG5cbmV4cG9ydCBjbGFzcyBDbGFzc2lmaWNhdGlvbk1hbmFnZXIgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICBwcml2YXRlIGVuZ2luZTogRmlsZUNsYXNzaWZpY2F0aW9uRW5naW5lO1xuICBwcml2YXRlIGRhdGFiYXNlTWFuYWdlcjogRGF0YWJhc2VNYW5hZ2VyO1xuICBwcml2YXRlIHN0YXRzOiBDbGFzc2lmaWNhdGlvblN0YXRzO1xuICBwcml2YXRlIGNsYXNzaWZpY2F0aW9uUXVldWU6IHN0cmluZ1tdID0gW107XG4gIHByaXZhdGUgaXNQcm9jZXNzaW5nOiBib29sZWFuID0gZmFsc2U7XG4gIHByaXZhdGUgcHJvY2Vzc2luZ0ludGVydmFsOiBOb2RlSlMuVGltZW91dCB8IG51bGwgPSBudWxsO1xuXG4gIGNvbnN0cnVjdG9yKGVuZ2luZTogRmlsZUNsYXNzaWZpY2F0aW9uRW5naW5lLCBkYXRhYmFzZU1hbmFnZXI6IERhdGFiYXNlTWFuYWdlcikge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5lbmdpbmUgPSBlbmdpbmU7XG4gICAgdGhpcy5kYXRhYmFzZU1hbmFnZXIgPSBkYXRhYmFzZU1hbmFnZXI7XG4gICAgdGhpcy5zdGF0cyA9IHRoaXMuaW5pdGlhbGl6ZVN0YXRzKCk7XG4gIH1cblxuICAvKipcbiAgICog5YiG6aGe44Oe44ON44O844K444Oj44O844KS5Yid5pyf5YyWXG4gICAqL1xuICBhc3luYyBpbml0aWFsaXplKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICAvLyDliIbpoZ7jgqjjg7Pjgrjjg7PjgpLliJ3mnJ/ljJZcbiAgICAgIGF3YWl0IHRoaXMuZW5naW5lLmluaXRpYWxpemUoKTtcbiAgICAgIFxuICAgICAgLy8g5Yem55CG44Kt44Ol44O844KS6ZaL5aeLXG4gICAgICB0aGlzLnN0YXJ0UHJvY2Vzc2luZ1F1ZXVlKCk7XG4gICAgICBcbiAgICAgIGNvbnNvbGUubG9nKCfliIbpoZ7jg57jg43jg7zjgrjjg6Pjg7zjgpLliJ3mnJ/ljJbjgZfjgb7jgZfjgZ8nKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcign5YiG6aGe44Oe44ON44O844K444Oj44O844Gu5Yid5pyf5YyW44Gr5aSx5pWX44GX44G+44GX44GfOicsIGVycm9yKTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg5XjgqHjgqTjg6vjgrnjgq3jg6Pjg4rjg7zjgajntbHlkIhcbiAgICovXG4gIGludGVncmF0ZVdpdGhTY2FubmVyKHNjYW5uZXI6IEZpbGVTY2FubmVyKTogdm9pZCB7XG4gICAgLy8g44OV44Kh44Kk44Or5aSJ5pu044Kk44OZ44Oz44OI44KS44Oq44OD44K544OzXG4gICAgc2Nhbm5lci5vbignZmlsZUNoYW5nZWQnLCB0aGlzLmhhbmRsZUZpbGVDaGFuZ2VkLmJpbmQodGhpcykpO1xuICAgIFxuICAgIC8vIOWIhumhnuOBjOW/heimgeOBquODleOCoeOCpOODq+OBruOCpOODmeODs+ODiOOCkuODquODg+OCueODs1xuICAgIHNjYW5uZXIub24oJ2ZpbGVOZWVkc0NsYXNzaWZpY2F0aW9uJywgdGhpcy5oYW5kbGVGaWxlTmVlZHNDbGFzc2lmaWNhdGlvbi5iaW5kKHRoaXMpKTtcbiAgICBcbiAgICBjb25zb2xlLmxvZygn44OV44Kh44Kk44Or44K544Kt44Oj44OK44O844Go44Gu57Wx5ZCI44GM5a6M5LqG44GX44G+44GX44GfJyk7XG4gIH1cblxuICAvKipcbiAgICog44OV44Kh44Kk44Or5aSJ5pu044Kk44OZ44Oz44OI44KS5Yem55CGXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGhhbmRsZUZpbGVDaGFuZ2VkKGV2ZW50OiBGaWxlQ2hhbmdlRXZlbnQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAoZXZlbnQudHlwZSA9PT0gJ2FkZGVkJyB8fCBldmVudC50eXBlID09PSAnbW9kaWZpZWQnKSB7XG4gICAgICBhd2FpdCB0aGlzLnF1ZXVlRm9yQ2xhc3NpZmljYXRpb24oZXZlbnQuZmlsZVBhdGgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDliIbpoZ7jgYzlv4XopoHjgarjg5XjgqHjgqTjg6vjga7jgqTjg5njg7Pjg4jjgpLlh6bnkIZcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlRmlsZU5lZWRzQ2xhc3NpZmljYXRpb24oZXZlbnQ6IGFueSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHRoaXMucXVldWVGb3JDbGFzc2lmaWNhdGlvbihldmVudC5maWxlUGF0aCk7XG4gIH1cblxuICAvKipcbiAgICog44OV44Kh44Kk44Or44KS5YiG6aGe44Kt44Ol44O844Gr6L+95YqgXG4gICAqL1xuICBhc3luYyBxdWV1ZUZvckNsYXNzaWZpY2F0aW9uKGZpbGVQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAoIXRoaXMuY2xhc3NpZmljYXRpb25RdWV1ZS5pbmNsdWRlcyhmaWxlUGF0aCkpIHtcbiAgICAgIHRoaXMuY2xhc3NpZmljYXRpb25RdWV1ZS5wdXNoKGZpbGVQYXRoKTtcbiAgICAgIGNvbnNvbGUubG9nKGDliIbpoZ7jgq3jg6Xjg7zjgavov73liqA6ICR7ZmlsZVBhdGh9YCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODleOCoeOCpOODq+OCkuWNs+W6p+OBq+WIhumhnlxuICAgKi9cbiAgYXN5bmMgY2xhc3NpZnlGaWxlKGZpbGVQYXRoOiBzdHJpbmcsIGF1dG9BcHBseTogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxDbGFzc2lmaWNhdGlvblJlc3VsdD4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zb2xlLmxvZyhg44OV44Kh44Kk44Or44KS5YiG6aGe5LitOiAke2ZpbGVQYXRofWApO1xuICAgICAgXG4gICAgICAvLyDjg5XjgqHjgqTjg6vjga7liIbpoZ7jgpLlrp/ooYxcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZW5naW5lLmNsYXNzaWZ5RmlsZShmaWxlUGF0aCk7XG4gICAgICBcbiAgICAgIC8vIOe1seioiOOCkuabtOaWsFxuICAgICAgdGhpcy51cGRhdGVTdGF0cyhyZXN1bHQsIGF1dG9BcHBseSAmJiByZXN1bHQuY29uZmlkZW5jZSA+PSAwLjcpO1xuICAgICAgXG4gICAgICAvLyDliIbpoZ7jgqTjg5njg7Pjg4jjgpLnmbrooYxcbiAgICAgIGNvbnN0IGNsYXNzaWZpY2F0aW9uRXZlbnQ6IENsYXNzaWZpY2F0aW9uRXZlbnQgPSB7XG4gICAgICAgIGZpbGVQYXRoLFxuICAgICAgICByZXN1bHQsXG4gICAgICAgIGFwcGxpZWQ6IGZhbHNlLFxuICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKClcbiAgICAgIH07XG4gICAgICBcbiAgICAgIC8vIOiHquWLlemBqeeUqOOBruWIpOWumlxuICAgICAgaWYgKGF1dG9BcHBseSAmJiByZXN1bHQuY29uZmlkZW5jZSA+PSAwLjcpIHtcbiAgICAgICAgY29uc3QgYXBwbGllZCA9IGF3YWl0IHRoaXMuYXBwbHlDbGFzc2lmaWNhdGlvbihmaWxlUGF0aCwgcmVzdWx0KTtcbiAgICAgICAgY2xhc3NpZmljYXRpb25FdmVudC5hcHBsaWVkID0gYXBwbGllZDtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgdGhpcy5lbWl0KCdmaWxlQ2xhc3NpZmllZCcsIGNsYXNzaWZpY2F0aW9uRXZlbnQpO1xuICAgICAgXG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGDjg5XjgqHjgqTjg6vliIbpoZ7jgqjjg6njg7wgKCR7ZmlsZVBhdGh9KTpgLCBlcnJvcik7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog5YiG6aGe57WQ5p6c44KS6YGp55SoXG4gICAqL1xuICBhc3luYyBhcHBseUNsYXNzaWZpY2F0aW9uKGZpbGVQYXRoOiBzdHJpbmcsIHJlc3VsdDogQ2xhc3NpZmljYXRpb25SZXN1bHQpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgdGFyZ2V0UGF0aCA9IHJlc3VsdC5zdWdnZXN0ZWRQYXRoO1xuICAgICAgY29uc3QgZmlsZU5hbWUgPSBwYXRoLmJhc2VuYW1lKGZpbGVQYXRoKTtcbiAgICAgIGNvbnN0IG5ld0ZpbGVQYXRoID0gcGF0aC5qb2luKHRhcmdldFBhdGgsIGZpbGVOYW1lKTtcbiAgICAgIFxuICAgICAgLy8g44K/44O844Ky44OD44OI44OH44Kj44Os44Kv44OI44Oq44GM5a2Y5Zyo44GX44Gq44GE5aC05ZCI44Gv5L2c5oiQXG4gICAgICBhd2FpdCBmcy5ta2RpcihwYXRoLmRpcm5hbWUobmV3RmlsZVBhdGgpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgIFxuICAgICAgLy8g44OV44Kh44Kk44Or44GM5pei44Gr5q2j44GX44GE5aC05omA44Gr44GC44KL5aC05ZCI44Gv44K544Kt44OD44OXXG4gICAgICBpZiAocGF0aC5yZXNvbHZlKGZpbGVQYXRoKSA9PT0gcGF0aC5yZXNvbHZlKG5ld0ZpbGVQYXRoKSkge1xuICAgICAgICBjb25zb2xlLmxvZyhg44OV44Kh44Kk44Or44Gv5pei44Gr5q2j44GX44GE5aC05omA44Gr44GC44KK44G+44GZOiAke2ZpbGVQYXRofWApO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g44OV44Kh44Kk44Or44KS56e75YuVXG4gICAgICBhd2FpdCBmcy5yZW5hbWUoZmlsZVBhdGgsIG5ld0ZpbGVQYXRoKTtcbiAgICAgIFxuICAgICAgLy8g44OH44O844K/44OZ44O844K544Gu44Oh44K/44OH44O844K/44KS5pu05pawXG4gICAgICBjb25zdCBtZXRhZGF0YSA9IGF3YWl0IHRoaXMuZGF0YWJhc2VNYW5hZ2VyLmdldEZpbGVNZXRhZGF0YShmaWxlUGF0aCk7XG4gICAgICBpZiAobWV0YWRhdGEpIHtcbiAgICAgICAgbWV0YWRhdGEucGF0aCA9IG5ld0ZpbGVQYXRoO1xuICAgICAgICBtZXRhZGF0YS5jYXRlZ29yeSA9IHJlc3VsdC5jYXRlZ29yeTtcbiAgICAgICAgYXdhaXQgdGhpcy5kYXRhYmFzZU1hbmFnZXIudXBzZXJ0RmlsZU1ldGFkYXRhKG1ldGFkYXRhKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc29sZS5sb2coYOODleOCoeOCpOODq+OCkuenu+WLleOBl+OBvuOBl+OBnzogJHtmaWxlUGF0aH0g4oaSICR7bmV3RmlsZVBhdGh9YCk7XG4gICAgICBcbiAgICAgIC8vIOmBqeeUqOOCpOODmeODs+ODiOOCkueZuuihjFxuICAgICAgdGhpcy5lbWl0KCdjbGFzc2lmaWNhdGlvbkFwcGxpZWQnLCB7XG4gICAgICAgIG9yaWdpbmFsUGF0aDogZmlsZVBhdGgsXG4gICAgICAgIG5ld1BhdGg6IG5ld0ZpbGVQYXRoLFxuICAgICAgICByZXN1bHQsXG4gICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKVxuICAgICAgfSk7XG4gICAgICBcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGDliIbpoZ7pgannlKjjgqjjg6njg7wgKCR7ZmlsZVBhdGh9KTpgLCBlcnJvcik7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOWHpueQhuOCreODpeODvOOCkumWi+Wni1xuICAgKi9cbiAgcHJpdmF0ZSBzdGFydFByb2Nlc3NpbmdRdWV1ZSgpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5wcm9jZXNzaW5nSW50ZXJ2YWwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgXG4gICAgdGhpcy5wcm9jZXNzaW5nSW50ZXJ2YWwgPSBzZXRJbnRlcnZhbChhc3luYyAoKSA9PiB7XG4gICAgICBhd2FpdCB0aGlzLnByb2Nlc3NRdWV1ZSgpO1xuICAgIH0sIDUwMDApOyAvLyA156eS6ZaT6ZqU44Gn5Yem55CGXG4gIH1cblxuICAvKipcbiAgICog5Yem55CG44Kt44Ol44O844KS5YGc5q2iXG4gICAqL1xuICBwcml2YXRlIHN0b3BQcm9jZXNzaW5nUXVldWUoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMucHJvY2Vzc2luZ0ludGVydmFsKSB7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMucHJvY2Vzc2luZ0ludGVydmFsKTtcbiAgICAgIHRoaXMucHJvY2Vzc2luZ0ludGVydmFsID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44Kt44Ol44O844KS5Yem55CGXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHByb2Nlc3NRdWV1ZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAodGhpcy5pc1Byb2Nlc3NpbmcgfHwgdGhpcy5jbGFzc2lmaWNhdGlvblF1ZXVlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBcbiAgICB0aGlzLmlzUHJvY2Vzc2luZyA9IHRydWU7XG4gICAgXG4gICAgdHJ5IHtcbiAgICAgIC8vIOOCreODpeODvOOBi+OCieacgOWkpzXku7bjgpLlh6bnkIZcbiAgICAgIGNvbnN0IGJhdGNoID0gdGhpcy5jbGFzc2lmaWNhdGlvblF1ZXVlLnNwbGljZSgwLCA1KTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBmaWxlUGF0aCBvZiBiYXRjaCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGF3YWl0IHRoaXMuY2xhc3NpZnlGaWxlKGZpbGVQYXRoLCB0cnVlKTsgLy8g6Ieq5YuV6YGp55So5pyJ5Yq5XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihg44Kt44Ol44O85Yem55CG44Ko44Op44O8ICgke2ZpbGVQYXRofSk6YCwgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBcbiAgICAgIGlmIChiYXRjaC5sZW5ndGggPiAwKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGDliIbpoZ7jgq3jg6Xjg7zjgpLlh6bnkIbjgZfjgb7jgZfjgZ86ICR7YmF0Y2gubGVuZ3RofSDjg5XjgqHjgqTjg6tgKTtcbiAgICAgIH1cbiAgICB9IGZpbmFsbHkge1xuICAgICAgdGhpcy5pc1Byb2Nlc3NpbmcgPSBmYWxzZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog57Wx6KiI44KS5Yid5pyf5YyWXG4gICAqL1xuICBwcml2YXRlIGluaXRpYWxpemVTdGF0cygpOiBDbGFzc2lmaWNhdGlvblN0YXRzIHtcbiAgICByZXR1cm4ge1xuICAgICAgdG90YWxDbGFzc2lmaWVkOiAwLFxuICAgICAgYXV0b0FwcGxpZWQ6IDAsXG4gICAgICBtYW51YWxSZXZpZXc6IDAsXG4gICAgICBhdmVyYWdlQ29uZmlkZW5jZTogMCxcbiAgICAgIGNhdGVnb3J5RGlzdHJpYnV0aW9uOiB7fVxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICog57Wx6KiI44KS5pu05pawXG4gICAqL1xuICBwcml2YXRlIHVwZGF0ZVN0YXRzKHJlc3VsdDogQ2xhc3NpZmljYXRpb25SZXN1bHQsIGFwcGxpZWQ6IGJvb2xlYW4pOiB2b2lkIHtcbiAgICB0aGlzLnN0YXRzLnRvdGFsQ2xhc3NpZmllZCsrO1xuICAgIFxuICAgIGlmIChhcHBsaWVkKSB7XG4gICAgICB0aGlzLnN0YXRzLmF1dG9BcHBsaWVkKys7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc3RhdHMubWFudWFsUmV2aWV3Kys7XG4gICAgfVxuICAgIFxuICAgIC8vIOW5s+Wdh+S/oemgvOW6puOCkuabtOaWsFxuICAgIGNvbnN0IHRvdGFsQ29uZmlkZW5jZSA9IHRoaXMuc3RhdHMuYXZlcmFnZUNvbmZpZGVuY2UgKiAodGhpcy5zdGF0cy50b3RhbENsYXNzaWZpZWQgLSAxKSArIHJlc3VsdC5jb25maWRlbmNlO1xuICAgIHRoaXMuc3RhdHMuYXZlcmFnZUNvbmZpZGVuY2UgPSB0b3RhbENvbmZpZGVuY2UgLyB0aGlzLnN0YXRzLnRvdGFsQ2xhc3NpZmllZDtcbiAgICBcbiAgICAvLyDjgqvjg4bjgrTjg6rliIbluIPjgpLmm7TmlrBcbiAgICBjb25zdCBjYXRlZ29yeSA9IHJlc3VsdC5jYXRlZ29yeSB8fCAndW5rbm93bic7XG4gICAgdGhpcy5zdGF0cy5jYXRlZ29yeURpc3RyaWJ1dGlvbltjYXRlZ29yeV0gPSAodGhpcy5zdGF0cy5jYXRlZ29yeURpc3RyaWJ1dGlvbltjYXRlZ29yeV0gfHwgMCkgKyAxO1xuICB9XG5cbiAgLyoqXG4gICAqIOikh+aVsOODleOCoeOCpOODq+OCkuS4gOaLrOWIhumhnlxuICAgKi9cbiAgYXN5bmMgY2xhc3NpZnlCYXRjaChmaWxlUGF0aHM6IHN0cmluZ1tdLCBhdXRvQXBwbHk6IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8Q2xhc3NpZmljYXRpb25SZXN1bHRbXT4ge1xuICAgIGNvbnN0IHJlc3VsdHM6IENsYXNzaWZpY2F0aW9uUmVzdWx0W10gPSBbXTtcbiAgICBcbiAgICBjb25zb2xlLmxvZyhg5LiA5ous5YiG6aGe44KS6ZaL5aeLOiAke2ZpbGVQYXRocy5sZW5ndGh9IOODleOCoeOCpOODq2ApO1xuICAgIFxuICAgIGZvciAoY29uc3QgZmlsZVBhdGggb2YgZmlsZVBhdGhzKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmNsYXNzaWZ5RmlsZShmaWxlUGF0aCwgYXV0b0FwcGx5KTtcbiAgICAgICAgcmVzdWx0cy5wdXNoKHJlc3VsdCk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKGDkuIDmi6zliIbpoZ7jgqjjg6njg7wgKCR7ZmlsZVBhdGh9KTpgLCBlcnJvcik7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIGNvbnNvbGUubG9nKGDkuIDmi6zliIbpoZ7jgYzlrozkuoY6ICR7cmVzdWx0cy5sZW5ndGh9LyR7ZmlsZVBhdGhzLmxlbmd0aH0g44OV44Kh44Kk44OrYCk7XG4gICAgXG4gICAgcmV0dXJuIHJlc3VsdHM7XG4gIH1cblxuICAvKipcbiAgICog44OH44Kj44Os44Kv44OI44Oq5YWo5L2T44KS5YiG6aGeXG4gICAqL1xuICBhc3luYyBjbGFzc2lmeURpcmVjdG9yeShkaXJQYXRoOiBzdHJpbmcsIHJlY3Vyc2l2ZTogYm9vbGVhbiA9IHRydWUsIGF1dG9BcHBseTogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxDbGFzc2lmaWNhdGlvblJlc3VsdFtdPiB7XG4gICAgY29uc3QgZmlsZVBhdGhzOiBzdHJpbmdbXSA9IFtdO1xuICAgIFxuICAgIGNvbnN0IHNjYW5EaXJlY3RvcnkgPSBhc3luYyAoY3VycmVudFBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZW50cmllcyA9IGF3YWl0IGZzLnJlYWRkaXIoY3VycmVudFBhdGgsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KTtcbiAgICAgICAgXG4gICAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgZW50cmllcykge1xuICAgICAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5qb2luKGN1cnJlbnRQYXRoLCBlbnRyeS5uYW1lKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAoZW50cnkuaXNGaWxlKCkpIHtcbiAgICAgICAgICAgIGZpbGVQYXRocy5wdXNoKGZ1bGxQYXRoKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGVudHJ5LmlzRGlyZWN0b3J5KCkgJiYgcmVjdXJzaXZlKSB7XG4gICAgICAgICAgICBhd2FpdCBzY2FuRGlyZWN0b3J5KGZ1bGxQYXRoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYOODh+OCo+ODrOOCr+ODiOODquOCueOCreODo+ODs+OCqOODqeODvCAoJHtjdXJyZW50UGF0aH0pOmAsIGVycm9yKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIFxuICAgIGF3YWl0IHNjYW5EaXJlY3RvcnkoZGlyUGF0aCk7XG4gICAgcmV0dXJuIGF3YWl0IHRoaXMuY2xhc3NpZnlCYXRjaChmaWxlUGF0aHMsIGF1dG9BcHBseSk7XG4gIH1cblxuICAvKipcbiAgICog5YiG6aGe57Wx6KiI44KS5Y+W5b6XXG4gICAqL1xuICBnZXRTdGF0aXN0aWNzKCk6IENsYXNzaWZpY2F0aW9uU3RhdHMge1xuICAgIHJldHVybiB7IC4uLnRoaXMuc3RhdHMgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDliIbpoZ7jgqjjg7Pjgrjjg7Pjga7ntbHoqIjjgpLlj5blvpdcbiAgICovXG4gIGdldEVuZ2luZVN0YXRpc3RpY3MoKTogYW55IHtcbiAgICByZXR1cm4gdGhpcy5lbmdpbmUuZ2V0Q2xhc3NpZmljYXRpb25TdGF0aXN0aWNzKCk7XG4gIH1cblxuICAvKipcbiAgICog44Kt44Ol44O844Gu54q25oWL44KS5Y+W5b6XXG4gICAqL1xuICBnZXRRdWV1ZVN0YXR1cygpOiB7IHF1ZXVlTGVuZ3RoOiBudW1iZXI7IGlzUHJvY2Vzc2luZzogYm9vbGVhbiB9IHtcbiAgICByZXR1cm4ge1xuICAgICAgcXVldWVMZW5ndGg6IHRoaXMuY2xhc3NpZmljYXRpb25RdWV1ZS5sZW5ndGgsXG4gICAgICBpc1Byb2Nlc3Npbmc6IHRoaXMuaXNQcm9jZXNzaW5nXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiDntbHoqIjjgpLjg6rjgrvjg4Pjg4hcbiAgICovXG4gIHJlc2V0U3RhdGlzdGljcygpOiB2b2lkIHtcbiAgICB0aGlzLnN0YXRzID0gdGhpcy5pbml0aWFsaXplU3RhdHMoKTtcbiAgICBjb25zb2xlLmxvZygn5YiG6aGe57Wx6KiI44KS44Oq44K744OD44OI44GX44G+44GX44GfJyk7XG4gIH1cblxuICAvKipcbiAgICog44K344Oj44OD44OI44OA44Km44OzXG4gICAqL1xuICBzaHV0ZG93bigpOiB2b2lkIHtcbiAgICB0aGlzLnN0b3BQcm9jZXNzaW5nUXVldWUoKTtcbiAgICBjb25zb2xlLmxvZygn5YiG6aGe44Oe44ON44O844K444Oj44O844KS44K344Oj44OD44OI44OA44Km44Oz44GX44G+44GX44GfJyk7XG4gIH1cbn0iXX0=