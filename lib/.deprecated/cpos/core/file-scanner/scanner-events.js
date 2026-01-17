"use strict";
/**
 * File Scanner Event Handlers
 * ファイルスキャナーのイベントハンドラー
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
exports.FileScannerEventHandler = void 0;
const models_1 = require("../../models");
class FileScannerEventHandler {
    scanner;
    databaseManager;
    eventLog = [];
    maxEventLogSize = 1000;
    constructor(scanner, databaseManager) {
        this.scanner = scanner;
        this.databaseManager = databaseManager;
        this.setupEventHandlers();
    }
    /**
     * イベントハンドラーを設定
     */
    setupEventHandlers() {
        // ファイル変更イベント
        this.scanner.on('fileChanged', this.handleFileChanged.bind(this));
        // スキャン開始イベント
        this.scanner.on('scanStarted', this.handleScanStarted.bind(this));
        // スキャン停止イベント
        this.scanner.on('scanStopped', this.handleScanStopped.bind(this));
        // 完全スキャン完了イベント
        this.scanner.on('fullScanCompleted', this.handleFullScanCompleted.bind(this));
        // 増分スキャン完了イベント
        this.scanner.on('incrementalScanCompleted', this.handleIncrementalScanCompleted.bind(this));
        // スキャンエラーイベント
        this.scanner.on('scanError', this.handleScanError.bind(this));
    }
    /**
     * ファイル変更イベントを処理
     */
    async handleFileChanged(event) {
        try {
            // イベントログに追加
            this.addToEventLog(event);
            // データベースに保存
            if (event.metadata) {
                const fileMetadata = new models_1.FileMetadataModel(undefined, event.metadata.path, event.metadata.size, event.metadata.checksum, event.metadata.mimeType, event.metadata.category, event.metadata.created, event.metadata.modified, event.metadata.environment);
                await this.databaseManager.upsertFileMetadata(fileMetadata);
            }
            // ログ出力
            console.log(`ファイル${this.getEventTypeText(event.type)}: ${event.filePath}`);
            // 分類が必要なファイルの場合は分類イベントを発行
            if (event.type === 'added' || event.type === 'modified') {
                this.scanner.emit('fileNeedsClassification', {
                    filePath: event.filePath,
                    metadata: event.metadata
                });
            }
        }
        catch (error) {
            console.error('ファイル変更イベント処理エラー:', error);
        }
    }
    /**
     * スキャン開始イベントを処理
     */
    handleScanStarted() {
        console.log('📁 ファイルスキャンが開始されました');
        this.logOperation('scan_started', 'ファイルスキャン開始');
    }
    /**
     * スキャン停止イベントを処理
     */
    handleScanStopped() {
        console.log('⏹️  ファイルスキャンが停止されました');
        this.logOperation('scan_stopped', 'ファイルスキャン停止');
    }
    /**
     * 完全スキャン完了イベントを処理
     */
    handleFullScanCompleted(result) {
        console.log(`✅ 完全スキャン完了: ${result.scannedFiles} ファイル (${result.duration}ms)`);
        this.logOperation('full_scan_completed', `完全スキャン完了: ${result.scannedFiles} ファイル`, result);
    }
    /**
     * 増分スキャン完了イベントを処理
     */
    handleIncrementalScanCompleted(result) {
        if (result.changedFiles > 0) {
            console.log(`🔄 増分スキャン完了: ${result.changedFiles} 件の変更 (${result.duration}ms)`);
            this.logOperation('incremental_scan_completed', `増分スキャン完了: ${result.changedFiles} 件の変更`, result);
        }
    }
    /**
     * スキャンエラーイベントを処理
     */
    handleScanError(error) {
        console.error('❌ スキャンエラー:', error.message);
        this.logOperation('scan_error', `スキャンエラー: ${error.message}`, { error: error.message });
    }
    /**
     * イベントログに追加
     */
    addToEventLog(event) {
        this.eventLog.push(event);
        // ログサイズ制限
        if (this.eventLog.length > this.maxEventLogSize) {
            this.eventLog = this.eventLog.slice(-this.maxEventLogSize);
        }
    }
    /**
     * 操作ログを記録
     */
    async logOperation(operationType, description, details) {
        try {
            const operationLog = new (await Promise.resolve().then(() => __importStar(require('../../models')))).OperationLogModel(undefined, operationType, 'completed', new Date(), new Date(), JSON.stringify(details || {}), undefined);
            await this.databaseManager.insertOperationLog(operationLog);
        }
        catch (error) {
            console.error('操作ログ記録エラー:', error);
        }
    }
    /**
     * イベントタイプのテキストを取得
     */
    getEventTypeText(type) {
        switch (type) {
            case 'added': return '追加';
            case 'modified': return '変更';
            case 'deleted': return '削除';
            default: return type;
        }
    }
    /**
     * 最近のイベントログを取得
     */
    getRecentEvents(limit = 50) {
        return this.eventLog.slice(-limit);
    }
    /**
     * 特定のファイルのイベント履歴を取得
     */
    getFileEventHistory(filePath) {
        return this.eventLog.filter(event => event.filePath === filePath);
    }
    /**
     * イベント統計を取得
     */
    getEventStatistics() {
        const stats = {
            totalEvents: this.eventLog.length,
            addedFiles: 0,
            modifiedFiles: 0,
            deletedFiles: 0,
            recentActivity: this.eventLog.slice(-10)
        };
        this.eventLog.forEach(event => {
            switch (event.type) {
                case 'added':
                    stats.addedFiles++;
                    break;
                case 'modified':
                    stats.modifiedFiles++;
                    break;
                case 'deleted':
                    stats.deletedFiles++;
                    break;
            }
        });
        return stats;
    }
    /**
     * イベントログをクリア
     */
    clearEventLog() {
        this.eventLog = [];
        console.log('イベントログをクリアしました');
    }
}
exports.FileScannerEventHandler = FileScannerEventHandler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2Nhbm5lci1ldmVudHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzY2FubmVyLWV2ZW50cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUlILHlDQUFpRDtBQUVqRCxNQUFhLHVCQUF1QjtJQUMxQixPQUFPLENBQWM7SUFDckIsZUFBZSxDQUFrQjtJQUNqQyxRQUFRLEdBQXNCLEVBQUUsQ0FBQztJQUNqQyxlQUFlLEdBQVcsSUFBSSxDQUFDO0lBRXZDLFlBQVksT0FBb0IsRUFBRSxlQUFnQztRQUNoRSxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUN2QixJQUFJLENBQUMsZUFBZSxHQUFHLGVBQWUsQ0FBQztRQUN2QyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztJQUM1QixDQUFDO0lBRUQ7O09BRUc7SUFDSyxrQkFBa0I7UUFDeEIsYUFBYTtRQUNiLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFFbEUsYUFBYTtRQUNiLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFFbEUsYUFBYTtRQUNiLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFFbEUsZUFBZTtRQUNmLElBQUksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLG1CQUFtQixFQUFFLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUU5RSxlQUFlO1FBQ2YsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsMEJBQTBCLEVBQUUsSUFBSSxDQUFDLDhCQUE4QixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBRTVGLGNBQWM7UUFDZCxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUNoRSxDQUFDO0lBRUQ7O09BRUc7SUFDSyxLQUFLLENBQUMsaUJBQWlCLENBQUMsS0FBc0I7UUFDcEQsSUFBSSxDQUFDO1lBQ0gsWUFBWTtZQUNaLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7WUFFMUIsWUFBWTtZQUNaLElBQUksS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUNuQixNQUFNLFlBQVksR0FBRyxJQUFJLDBCQUFpQixDQUN4QyxTQUFTLEVBQ1QsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQ25CLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUNuQixLQUFLLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFDdkIsS0FBSyxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQ3ZCLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUN2QixLQUFLLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFDdEIsS0FBSyxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQ3ZCLEtBQUssQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUMzQixDQUFDO2dCQUVGLE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FBQyxrQkFBa0IsQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUM5RCxDQUFDO1lBRUQsT0FBTztZQUNQLE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBRTNFLDBCQUEwQjtZQUMxQixJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssT0FBTyxJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssVUFBVSxFQUFFLENBQUM7Z0JBQ3hELElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLHlCQUF5QixFQUFFO29CQUMzQyxRQUFRLEVBQUUsS0FBSyxDQUFDLFFBQVE7b0JBQ3hCLFFBQVEsRUFBRSxLQUFLLENBQUMsUUFBUTtpQkFDekIsQ0FBQyxDQUFDO1lBQ0wsQ0FBQztRQUVILENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUMzQyxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0ssaUJBQWlCO1FBQ3ZCLE9BQU8sQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsQ0FBQztRQUNuQyxJQUFJLENBQUMsWUFBWSxDQUFDLGNBQWMsRUFBRSxZQUFZLENBQUMsQ0FBQztJQUNsRCxDQUFDO0lBRUQ7O09BRUc7SUFDSyxpQkFBaUI7UUFDdkIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBQ3BDLElBQUksQ0FBQyxZQUFZLENBQUMsY0FBYyxFQUFFLFlBQVksQ0FBQyxDQUFDO0lBQ2xELENBQUM7SUFFRDs7T0FFRztJQUNLLHVCQUF1QixDQUFDLE1BQVc7UUFDekMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLE1BQU0sQ0FBQyxZQUFZLFVBQVUsTUFBTSxDQUFDLFFBQVEsS0FBSyxDQUFDLENBQUM7UUFDOUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxxQkFBcUIsRUFBRSxhQUFhLE1BQU0sQ0FBQyxZQUFZLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQztJQUM1RixDQUFDO0lBRUQ7O09BRUc7SUFDSyw4QkFBOEIsQ0FBQyxNQUFXO1FBQ2hELElBQUksTUFBTSxDQUFDLFlBQVksR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUM1QixPQUFPLENBQUMsR0FBRyxDQUFDLGdCQUFnQixNQUFNLENBQUMsWUFBWSxVQUFVLE1BQU0sQ0FBQyxRQUFRLEtBQUssQ0FBQyxDQUFDO1lBQy9FLElBQUksQ0FBQyxZQUFZLENBQUMsNEJBQTRCLEVBQUUsYUFBYSxNQUFNLENBQUMsWUFBWSxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDbkcsQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNLLGVBQWUsQ0FBQyxLQUFZO1FBQ2xDLE9BQU8sQ0FBQyxLQUFLLENBQUMsWUFBWSxFQUFFLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUMzQyxJQUFJLENBQUMsWUFBWSxDQUFDLFlBQVksRUFBRSxZQUFZLEtBQUssQ0FBQyxPQUFPLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztJQUN6RixDQUFDO0lBRUQ7O09BRUc7SUFDSyxhQUFhLENBQUMsS0FBc0I7UUFDMUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFMUIsVUFBVTtRQUNWLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQ2hELElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDN0QsQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNLLEtBQUssQ0FBQyxZQUFZLENBQUMsYUFBcUIsRUFBRSxXQUFtQixFQUFFLE9BQWE7UUFDbEYsSUFBSSxDQUFDO1lBQ0gsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLHdEQUFhLGNBQWMsR0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQ3ZFLFNBQVMsRUFDVCxhQUFhLEVBQ2IsV0FBVyxFQUNYLElBQUksSUFBSSxFQUFFLEVBQ1YsSUFBSSxJQUFJLEVBQUUsRUFDVixJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sSUFBSSxFQUFFLENBQUMsRUFDN0IsU0FBUyxDQUNWLENBQUM7WUFFRixNQUFNLElBQUksQ0FBQyxlQUFlLENBQUMsa0JBQWtCLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDOUQsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixPQUFPLENBQUMsS0FBSyxDQUFDLFlBQVksRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNyQyxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0ssZ0JBQWdCLENBQUMsSUFBWTtRQUNuQyxRQUFRLElBQUksRUFBRSxDQUFDO1lBQ2IsS0FBSyxPQUFPLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQztZQUMxQixLQUFLLFVBQVUsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDO1lBQzdCLEtBQUssU0FBUyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUM7WUFDNUIsT0FBTyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUM7UUFDdkIsQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNILGVBQWUsQ0FBQyxRQUFnQixFQUFFO1FBQ2hDLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNyQyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxtQkFBbUIsQ0FBQyxRQUFnQjtRQUNsQyxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLFFBQVEsS0FBSyxRQUFRLENBQUMsQ0FBQztJQUNwRSxDQUFDO0lBRUQ7O09BRUc7SUFDSCxrQkFBa0I7UUFDaEIsTUFBTSxLQUFLLEdBQUc7WUFDWixXQUFXLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNO1lBQ2pDLFVBQVUsRUFBRSxDQUFDO1lBQ2IsYUFBYSxFQUFFLENBQUM7WUFDaEIsWUFBWSxFQUFFLENBQUM7WUFDZixjQUFjLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUM7U0FDekMsQ0FBQztRQUVGLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQzVCLFFBQVEsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNuQixLQUFLLE9BQU87b0JBQUUsS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDO29CQUFDLE1BQU07Z0JBQ3hDLEtBQUssVUFBVTtvQkFBRSxLQUFLLENBQUMsYUFBYSxFQUFFLENBQUM7b0JBQUMsTUFBTTtnQkFDOUMsS0FBSyxTQUFTO29CQUFFLEtBQUssQ0FBQyxZQUFZLEVBQUUsQ0FBQztvQkFBQyxNQUFNO1lBQzlDLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVEOztPQUVHO0lBQ0gsYUFBYTtRQUNYLElBQUksQ0FBQyxRQUFRLEdBQUcsRUFBRSxDQUFDO1FBQ25CLE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztJQUNoQyxDQUFDO0NBQ0Y7QUEvTUQsMERBK01DIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBGaWxlIFNjYW5uZXIgRXZlbnQgSGFuZGxlcnNcbiAqIOODleOCoeOCpOODq+OCueOCreODo+ODiuODvOOBruOCpOODmeODs+ODiOODj+ODs+ODieODqeODvFxuICovXG5cbmltcG9ydCB7IEZpbGVTY2FubmVyLCBGaWxlQ2hhbmdlRXZlbnQgfSBmcm9tICcuL2luZGV4JztcbmltcG9ydCB7IERhdGFiYXNlTWFuYWdlciB9IGZyb20gJy4uL2RhdGFiYXNlJztcbmltcG9ydCB7IEZpbGVNZXRhZGF0YU1vZGVsIH0gZnJvbSAnLi4vLi4vbW9kZWxzJztcblxuZXhwb3J0IGNsYXNzIEZpbGVTY2FubmVyRXZlbnRIYW5kbGVyIHtcbiAgcHJpdmF0ZSBzY2FubmVyOiBGaWxlU2Nhbm5lcjtcbiAgcHJpdmF0ZSBkYXRhYmFzZU1hbmFnZXI6IERhdGFiYXNlTWFuYWdlcjtcbiAgcHJpdmF0ZSBldmVudExvZzogRmlsZUNoYW5nZUV2ZW50W10gPSBbXTtcbiAgcHJpdmF0ZSBtYXhFdmVudExvZ1NpemU6IG51bWJlciA9IDEwMDA7XG5cbiAgY29uc3RydWN0b3Ioc2Nhbm5lcjogRmlsZVNjYW5uZXIsIGRhdGFiYXNlTWFuYWdlcjogRGF0YWJhc2VNYW5hZ2VyKSB7XG4gICAgdGhpcy5zY2FubmVyID0gc2Nhbm5lcjtcbiAgICB0aGlzLmRhdGFiYXNlTWFuYWdlciA9IGRhdGFiYXNlTWFuYWdlcjtcbiAgICB0aGlzLnNldHVwRXZlbnRIYW5kbGVycygpO1xuICB9XG5cbiAgLyoqXG4gICAqIOOCpOODmeODs+ODiOODj+ODs+ODieODqeODvOOCkuioreWumlxuICAgKi9cbiAgcHJpdmF0ZSBzZXR1cEV2ZW50SGFuZGxlcnMoKTogdm9pZCB7XG4gICAgLy8g44OV44Kh44Kk44Or5aSJ5pu044Kk44OZ44Oz44OIXG4gICAgdGhpcy5zY2FubmVyLm9uKCdmaWxlQ2hhbmdlZCcsIHRoaXMuaGFuZGxlRmlsZUNoYW5nZWQuYmluZCh0aGlzKSk7XG4gICAgXG4gICAgLy8g44K544Kt44Oj44Oz6ZaL5aeL44Kk44OZ44Oz44OIXG4gICAgdGhpcy5zY2FubmVyLm9uKCdzY2FuU3RhcnRlZCcsIHRoaXMuaGFuZGxlU2NhblN0YXJ0ZWQuYmluZCh0aGlzKSk7XG4gICAgXG4gICAgLy8g44K544Kt44Oj44Oz5YGc5q2i44Kk44OZ44Oz44OIXG4gICAgdGhpcy5zY2FubmVyLm9uKCdzY2FuU3RvcHBlZCcsIHRoaXMuaGFuZGxlU2NhblN0b3BwZWQuYmluZCh0aGlzKSk7XG4gICAgXG4gICAgLy8g5a6M5YWo44K544Kt44Oj44Oz5a6M5LqG44Kk44OZ44Oz44OIXG4gICAgdGhpcy5zY2FubmVyLm9uKCdmdWxsU2NhbkNvbXBsZXRlZCcsIHRoaXMuaGFuZGxlRnVsbFNjYW5Db21wbGV0ZWQuYmluZCh0aGlzKSk7XG4gICAgXG4gICAgLy8g5aKX5YiG44K544Kt44Oj44Oz5a6M5LqG44Kk44OZ44Oz44OIXG4gICAgdGhpcy5zY2FubmVyLm9uKCdpbmNyZW1lbnRhbFNjYW5Db21wbGV0ZWQnLCB0aGlzLmhhbmRsZUluY3JlbWVudGFsU2NhbkNvbXBsZXRlZC5iaW5kKHRoaXMpKTtcbiAgICBcbiAgICAvLyDjgrnjgq3jg6Pjg7Pjgqjjg6njg7zjgqTjg5njg7Pjg4hcbiAgICB0aGlzLnNjYW5uZXIub24oJ3NjYW5FcnJvcicsIHRoaXMuaGFuZGxlU2NhbkVycm9yLmJpbmQodGhpcykpO1xuICB9XG5cbiAgLyoqXG4gICAqIOODleOCoeOCpOODq+WkieabtOOCpOODmeODs+ODiOOCkuWHpueQhlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBoYW5kbGVGaWxlQ2hhbmdlZChldmVudDogRmlsZUNoYW5nZUV2ZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdHJ5IHtcbiAgICAgIC8vIOOCpOODmeODs+ODiOODreOCsOOBq+i/veWKoFxuICAgICAgdGhpcy5hZGRUb0V2ZW50TG9nKGV2ZW50KTtcblxuICAgICAgLy8g44OH44O844K/44OZ44O844K544Gr5L+d5a2YXG4gICAgICBpZiAoZXZlbnQubWV0YWRhdGEpIHtcbiAgICAgICAgY29uc3QgZmlsZU1ldGFkYXRhID0gbmV3IEZpbGVNZXRhZGF0YU1vZGVsKFxuICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICBldmVudC5tZXRhZGF0YS5wYXRoLFxuICAgICAgICAgIGV2ZW50Lm1ldGFkYXRhLnNpemUsXG4gICAgICAgICAgZXZlbnQubWV0YWRhdGEuY2hlY2tzdW0sXG4gICAgICAgICAgZXZlbnQubWV0YWRhdGEubWltZVR5cGUsXG4gICAgICAgICAgZXZlbnQubWV0YWRhdGEuY2F0ZWdvcnksXG4gICAgICAgICAgZXZlbnQubWV0YWRhdGEuY3JlYXRlZCxcbiAgICAgICAgICBldmVudC5tZXRhZGF0YS5tb2RpZmllZCxcbiAgICAgICAgICBldmVudC5tZXRhZGF0YS5lbnZpcm9ubWVudFxuICAgICAgICApO1xuXG4gICAgICAgIGF3YWl0IHRoaXMuZGF0YWJhc2VNYW5hZ2VyLnVwc2VydEZpbGVNZXRhZGF0YShmaWxlTWV0YWRhdGEpO1xuICAgICAgfVxuXG4gICAgICAvLyDjg63jgrDlh7rliptcbiAgICAgIGNvbnNvbGUubG9nKGDjg5XjgqHjgqTjg6ske3RoaXMuZ2V0RXZlbnRUeXBlVGV4dChldmVudC50eXBlKX06ICR7ZXZlbnQuZmlsZVBhdGh9YCk7XG5cbiAgICAgIC8vIOWIhumhnuOBjOW/heimgeOBquODleOCoeOCpOODq+OBruWgtOWQiOOBr+WIhumhnuOCpOODmeODs+ODiOOCkueZuuihjFxuICAgICAgaWYgKGV2ZW50LnR5cGUgPT09ICdhZGRlZCcgfHwgZXZlbnQudHlwZSA9PT0gJ21vZGlmaWVkJykge1xuICAgICAgICB0aGlzLnNjYW5uZXIuZW1pdCgnZmlsZU5lZWRzQ2xhc3NpZmljYXRpb24nLCB7XG4gICAgICAgICAgZmlsZVBhdGg6IGV2ZW50LmZpbGVQYXRoLFxuICAgICAgICAgIG1ldGFkYXRhOiBldmVudC5tZXRhZGF0YVxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCfjg5XjgqHjgqTjg6vlpInmm7TjgqTjg5njg7Pjg4jlh6bnkIbjgqjjg6njg7w6JywgZXJyb3IpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjgrnjgq3jg6Pjg7Pplovlp4vjgqTjg5njg7Pjg4jjgpLlh6bnkIZcbiAgICovXG4gIHByaXZhdGUgaGFuZGxlU2NhblN0YXJ0ZWQoKTogdm9pZCB7XG4gICAgY29uc29sZS5sb2coJ/Cfk4Eg44OV44Kh44Kk44Or44K544Kt44Oj44Oz44GM6ZaL5aeL44GV44KM44G+44GX44GfJyk7XG4gICAgdGhpcy5sb2dPcGVyYXRpb24oJ3NjYW5fc3RhcnRlZCcsICfjg5XjgqHjgqTjg6vjgrnjgq3jg6Pjg7Pplovlp4snKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrnjgq3jg6Pjg7PlgZzmraLjgqTjg5njg7Pjg4jjgpLlh6bnkIZcbiAgICovXG4gIHByaXZhdGUgaGFuZGxlU2NhblN0b3BwZWQoKTogdm9pZCB7XG4gICAgY29uc29sZS5sb2coJ+KPue+4jyAg44OV44Kh44Kk44Or44K544Kt44Oj44Oz44GM5YGc5q2i44GV44KM44G+44GX44GfJyk7XG4gICAgdGhpcy5sb2dPcGVyYXRpb24oJ3NjYW5fc3RvcHBlZCcsICfjg5XjgqHjgqTjg6vjgrnjgq3jg6Pjg7PlgZzmraInKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlrozlhajjgrnjgq3jg6Pjg7PlrozkuobjgqTjg5njg7Pjg4jjgpLlh6bnkIZcbiAgICovXG4gIHByaXZhdGUgaGFuZGxlRnVsbFNjYW5Db21wbGV0ZWQocmVzdWx0OiBhbnkpOiB2b2lkIHtcbiAgICBjb25zb2xlLmxvZyhg4pyFIOWujOWFqOOCueOCreODo+ODs+WujOS6hjogJHtyZXN1bHQuc2Nhbm5lZEZpbGVzfSDjg5XjgqHjgqTjg6sgKCR7cmVzdWx0LmR1cmF0aW9ufW1zKWApO1xuICAgIHRoaXMubG9nT3BlcmF0aW9uKCdmdWxsX3NjYW5fY29tcGxldGVkJywgYOWujOWFqOOCueOCreODo+ODs+WujOS6hjogJHtyZXN1bHQuc2Nhbm5lZEZpbGVzfSDjg5XjgqHjgqTjg6tgLCByZXN1bHQpO1xuICB9XG5cbiAgLyoqXG4gICAqIOWil+WIhuOCueOCreODo+ODs+WujOS6huOCpOODmeODs+ODiOOCkuWHpueQhlxuICAgKi9cbiAgcHJpdmF0ZSBoYW5kbGVJbmNyZW1lbnRhbFNjYW5Db21wbGV0ZWQocmVzdWx0OiBhbnkpOiB2b2lkIHtcbiAgICBpZiAocmVzdWx0LmNoYW5nZWRGaWxlcyA+IDApIHtcbiAgICAgIGNvbnNvbGUubG9nKGDwn5SEIOWil+WIhuOCueOCreODo+ODs+WujOS6hjogJHtyZXN1bHQuY2hhbmdlZEZpbGVzfSDku7bjga7lpInmm7QgKCR7cmVzdWx0LmR1cmF0aW9ufW1zKWApO1xuICAgICAgdGhpcy5sb2dPcGVyYXRpb24oJ2luY3JlbWVudGFsX3NjYW5fY29tcGxldGVkJywgYOWil+WIhuOCueOCreODo+ODs+WujOS6hjogJHtyZXN1bHQuY2hhbmdlZEZpbGVzfSDku7bjga7lpInmm7RgLCByZXN1bHQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjgrnjgq3jg6Pjg7Pjgqjjg6njg7zjgqTjg5njg7Pjg4jjgpLlh6bnkIZcbiAgICovXG4gIHByaXZhdGUgaGFuZGxlU2NhbkVycm9yKGVycm9yOiBFcnJvcik6IHZvaWQge1xuICAgIGNvbnNvbGUuZXJyb3IoJ+KdjCDjgrnjgq3jg6Pjg7Pjgqjjg6njg7w6JywgZXJyb3IubWVzc2FnZSk7XG4gICAgdGhpcy5sb2dPcGVyYXRpb24oJ3NjYW5fZXJyb3InLCBg44K544Kt44Oj44Oz44Ko44Op44O8OiAke2Vycm9yLm1lc3NhZ2V9YCwgeyBlcnJvcjogZXJyb3IubWVzc2FnZSB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgqTjg5njg7Pjg4jjg63jgrDjgavov73liqBcbiAgICovXG4gIHByaXZhdGUgYWRkVG9FdmVudExvZyhldmVudDogRmlsZUNoYW5nZUV2ZW50KTogdm9pZCB7XG4gICAgdGhpcy5ldmVudExvZy5wdXNoKGV2ZW50KTtcbiAgICBcbiAgICAvLyDjg63jgrDjgrXjgqTjgrrliLbpmZBcbiAgICBpZiAodGhpcy5ldmVudExvZy5sZW5ndGggPiB0aGlzLm1heEV2ZW50TG9nU2l6ZSkge1xuICAgICAgdGhpcy5ldmVudExvZyA9IHRoaXMuZXZlbnRMb2cuc2xpY2UoLXRoaXMubWF4RXZlbnRMb2dTaXplKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog5pON5L2c44Ot44Kw44KS6KiY6YyyXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGxvZ09wZXJhdGlvbihvcGVyYXRpb25UeXBlOiBzdHJpbmcsIGRlc2NyaXB0aW9uOiBzdHJpbmcsIGRldGFpbHM/OiBhbnkpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgb3BlcmF0aW9uTG9nID0gbmV3IChhd2FpdCBpbXBvcnQoJy4uLy4uL21vZGVscycpKS5PcGVyYXRpb25Mb2dNb2RlbChcbiAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICBvcGVyYXRpb25UeXBlLFxuICAgICAgICAnY29tcGxldGVkJyxcbiAgICAgICAgbmV3IERhdGUoKSxcbiAgICAgICAgbmV3IERhdGUoKSxcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoZGV0YWlscyB8fCB7fSksXG4gICAgICAgIHVuZGVmaW5lZFxuICAgICAgKTtcblxuICAgICAgYXdhaXQgdGhpcy5kYXRhYmFzZU1hbmFnZXIuaW5zZXJ0T3BlcmF0aW9uTG9nKG9wZXJhdGlvbkxvZyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ+aTjeS9nOODreOCsOiomOmMsuOCqOODqeODvDonLCBlcnJvcik7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOOCpOODmeODs+ODiOOCv+OCpOODl+OBruODhuOCreOCueODiOOCkuWPluW+l1xuICAgKi9cbiAgcHJpdmF0ZSBnZXRFdmVudFR5cGVUZXh0KHR5cGU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICBjYXNlICdhZGRlZCc6IHJldHVybiAn6L+95YqgJztcbiAgICAgIGNhc2UgJ21vZGlmaWVkJzogcmV0dXJuICflpInmm7QnO1xuICAgICAgY2FzZSAnZGVsZXRlZCc6IHJldHVybiAn5YmK6ZmkJztcbiAgICAgIGRlZmF1bHQ6IHJldHVybiB0eXBlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDmnIDov5Hjga7jgqTjg5njg7Pjg4jjg63jgrDjgpLlj5blvpdcbiAgICovXG4gIGdldFJlY2VudEV2ZW50cyhsaW1pdDogbnVtYmVyID0gNTApOiBGaWxlQ2hhbmdlRXZlbnRbXSB7XG4gICAgcmV0dXJuIHRoaXMuZXZlbnRMb2cuc2xpY2UoLWxpbWl0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDnibnlrprjga7jg5XjgqHjgqTjg6vjga7jgqTjg5njg7Pjg4jlsaXmrbTjgpLlj5blvpdcbiAgICovXG4gIGdldEZpbGVFdmVudEhpc3RvcnkoZmlsZVBhdGg6IHN0cmluZyk6IEZpbGVDaGFuZ2VFdmVudFtdIHtcbiAgICByZXR1cm4gdGhpcy5ldmVudExvZy5maWx0ZXIoZXZlbnQgPT4gZXZlbnQuZmlsZVBhdGggPT09IGZpbGVQYXRoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgqTjg5njg7Pjg4jntbHoqIjjgpLlj5blvpdcbiAgICovXG4gIGdldEV2ZW50U3RhdGlzdGljcygpOiBhbnkge1xuICAgIGNvbnN0IHN0YXRzID0ge1xuICAgICAgdG90YWxFdmVudHM6IHRoaXMuZXZlbnRMb2cubGVuZ3RoLFxuICAgICAgYWRkZWRGaWxlczogMCxcbiAgICAgIG1vZGlmaWVkRmlsZXM6IDAsXG4gICAgICBkZWxldGVkRmlsZXM6IDAsXG4gICAgICByZWNlbnRBY3Rpdml0eTogdGhpcy5ldmVudExvZy5zbGljZSgtMTApXG4gICAgfTtcblxuICAgIHRoaXMuZXZlbnRMb2cuZm9yRWFjaChldmVudCA9PiB7XG4gICAgICBzd2l0Y2ggKGV2ZW50LnR5cGUpIHtcbiAgICAgICAgY2FzZSAnYWRkZWQnOiBzdGF0cy5hZGRlZEZpbGVzKys7IGJyZWFrO1xuICAgICAgICBjYXNlICdtb2RpZmllZCc6IHN0YXRzLm1vZGlmaWVkRmlsZXMrKzsgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2RlbGV0ZWQnOiBzdGF0cy5kZWxldGVkRmlsZXMrKzsgYnJlYWs7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gc3RhdHM7XG4gIH1cblxuICAvKipcbiAgICog44Kk44OZ44Oz44OI44Ot44Kw44KS44Kv44Oq44KiXG4gICAqL1xuICBjbGVhckV2ZW50TG9nKCk6IHZvaWQge1xuICAgIHRoaXMuZXZlbnRMb2cgPSBbXTtcbiAgICBjb25zb2xlLmxvZygn44Kk44OZ44Oz44OI44Ot44Kw44KS44Kv44Oq44Ki44GX44G+44GX44GfJyk7XG4gIH1cbn0iXX0=