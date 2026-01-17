"use strict";
/**
 * File Scanner
 * ファイルシステムの変更監視と分析を担当
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
exports.FileScanner = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const events_1 = require("events");
class FileScanner extends events_1.EventEmitter {
    config;
    isScanning = false;
    scanInterval = null;
    fileCache = new Map();
    constructor(config) {
        super();
        this.config = config;
    }
    /**
     * ファイルスキャンを開始
     */
    async startScanning() {
        if (this.isScanning) {
            console.warn('ファイルスキャンは既に実行中です');
            return;
        }
        console.log('ファイルスキャンを開始します...');
        this.isScanning = true;
        // 初回スキャン
        await this.performFullScan();
        // 定期スキャンの設定
        if (this.config.scanInterval > 0) {
            this.scanInterval = setInterval(async () => {
                await this.performIncrementalScan();
            }, this.config.scanInterval);
        }
        this.emit('scanStarted');
    }
    /**
     * ファイルスキャンを停止
     */
    stopScanning() {
        if (!this.isScanning) {
            return;
        }
        console.log('ファイルスキャンを停止します...');
        this.isScanning = false;
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }
        this.emit('scanStopped');
    }
    /**
     * 完全スキャンを実行
     */
    async performFullScan() {
        console.log('完全スキャンを実行中...');
        const startTime = Date.now();
        let scannedFiles = 0;
        try {
            for (const watchPath of this.config.watchPaths) {
                await this.scanDirectory(watchPath, true);
                scannedFiles++;
            }
            const duration = Date.now() - startTime;
            console.log(`完全スキャン完了: ${scannedFiles} ファイル (${duration}ms)`);
            this.emit('fullScanCompleted', {
                scannedFiles,
                duration,
                timestamp: new Date()
            });
        }
        catch (error) {
            console.error('完全スキャン中にエラーが発生しました:', error);
            this.emit('scanError', error);
        }
    }
    /**
     * 増分スキャンを実行
     */
    async performIncrementalScan() {
        if (!this.isScanning) {
            return;
        }
        const startTime = Date.now();
        let changedFiles = 0;
        try {
            for (const watchPath of this.config.watchPaths) {
                const changes = await this.scanDirectory(watchPath, false);
                changedFiles += changes;
            }
            const duration = Date.now() - startTime;
            if (changedFiles > 0) {
                console.log(`増分スキャン完了: ${changedFiles} 件の変更 (${duration}ms)`);
            }
            this.emit('incrementalScanCompleted', {
                changedFiles,
                duration,
                timestamp: new Date()
            });
        }
        catch (error) {
            console.error('増分スキャン中にエラーが発生しました:', error);
            this.emit('scanError', error);
        }
    }
    /**
     * ディレクトリをスキャン
     */
    async scanDirectory(dirPath, isFullScan) {
        let changeCount = 0;
        try {
            // ディレクトリの存在確認
            const stats = await fs.stat(dirPath);
            if (!stats.isDirectory()) {
                return 0;
            }
            // ディレクトリ内のファイル一覧を取得
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                // 除外パターンのチェック
                if (this.shouldExclude(fullPath)) {
                    continue;
                }
                if (entry.isDirectory()) {
                    // サブディレクトリを再帰的にスキャン
                    changeCount += await this.scanDirectory(fullPath, isFullScan);
                }
                else if (entry.isFile()) {
                    // ファイルを処理
                    const hasChanged = await this.processFile(fullPath, isFullScan);
                    if (hasChanged) {
                        changeCount++;
                    }
                }
            }
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`ディレクトリスキャンエラー (${dirPath}):`, error);
            }
        }
        return changeCount;
    }
    /**
     * ファイルを処理
     */
    async processFile(filePath, isFullScan) {
        try {
            const stats = await fs.stat(filePath);
            // ファイルサイズチェック
            if (stats.size > this.config.maxFileSize) {
                console.warn(`ファイルサイズが上限を超えています: ${filePath} (${stats.size} bytes)`);
                return false;
            }
            // ファイルメタデータを生成
            const metadata = await this.generateFileMetadata(filePath, stats);
            // キャッシュと比較して変更を検出
            const cachedMetadata = this.fileCache.get(filePath);
            const hasChanged = isFullScan || !cachedMetadata ||
                cachedMetadata.checksum !== metadata.checksum ||
                cachedMetadata.modified.getTime() !== metadata.modified.getTime();
            if (hasChanged) {
                // キャッシュを更新
                this.fileCache.set(filePath, metadata);
                // 変更イベントを発行
                const eventType = cachedMetadata ? 'modified' : 'added';
                const changeEvent = {
                    type: eventType,
                    filePath,
                    metadata,
                    timestamp: new Date()
                };
                this.emit('fileChanged', changeEvent);
                return true;
            }
            return false;
        }
        catch (error) {
            console.error(`ファイル処理エラー (${filePath}):`, error);
            return false;
        }
    }
    /**
     * ファイルメタデータを生成
     */
    async generateFileMetadata(filePath, stats) {
        // ファイルのハッシュ値を計算
        const checksum = await this.calculateFileHash(filePath);
        // MIMEタイプを推定
        const mimeType = this.guessMimeType(filePath);
        return {
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            checksum,
            mimeType,
            tags: [],
            environment: 'local' // デフォルトはローカル環境
        };
    }
    /**
     * ファイルのハッシュ値を計算
     */
    async calculateFileHash(filePath) {
        try {
            const fileBuffer = await fs.readFile(filePath);
            const hash = crypto.createHash('sha256');
            hash.update(fileBuffer);
            return hash.digest('hex');
        }
        catch (error) {
            console.error(`ハッシュ計算エラー (${filePath}):`, error);
            return '';
        }
    }
    /**
     * MIMEタイプを推定
     */
    guessMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.ts': 'text/typescript',
            '.js': 'text/javascript',
            '.json': 'application/json',
            '.md': 'text/markdown',
            '.txt': 'text/plain',
            '.html': 'text/html',
            '.css': 'text/css',
            '.yml': 'text/yaml',
            '.yaml': 'text/yaml',
            '.xml': 'text/xml',
            '.sh': 'text/x-shellscript',
            '.py': 'text/x-python',
            '.sql': 'text/x-sql',
            '.dockerfile': 'text/x-dockerfile',
            '.gitignore': 'text/plain',
            '.env': 'text/plain'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
    /**
     * ファイルが除外対象かチェック
     */
    shouldExclude(filePath) {
        const normalizedPath = path.normalize(filePath);
        return this.config.excludePatterns.some(pattern => {
            // 簡単なグロブパターンマッチング
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(normalizedPath);
            }
            // 直接マッチング
            return normalizedPath.includes(pattern);
        });
    }
    /**
     * 削除されたファイルを検出
     */
    async detectDeletedFiles() {
        const deletedFiles = [];
        this.fileCache.forEach((metadata, filePath) => {
            (async () => {
                try {
                    await fs.access(filePath);
                }
                catch (error) {
                    if (error.code === 'ENOENT') {
                        // ファイルが削除されている
                        deletedFiles.push({
                            type: 'deleted',
                            filePath,
                            metadata,
                            timestamp: new Date()
                        });
                        // キャッシュから削除
                        this.fileCache.delete(filePath);
                    }
                }
            })();
        });
        // 削除イベントを発行
        deletedFiles.forEach(event => {
            this.emit('fileChanged', event);
        });
        return deletedFiles;
    }
    /**
     * 特定のファイルを強制スキャン
     */
    async scanFile(filePath) {
        try {
            const stats = await fs.stat(filePath);
            if (stats.isFile()) {
                const metadata = await this.generateFileMetadata(filePath, stats);
                this.fileCache.set(filePath, metadata);
                return metadata;
            }
        }
        catch (error) {
            console.error(`ファイルスキャンエラー (${filePath}):`, error);
        }
        return null;
    }
    /**
     * スキャン統計を取得
     */
    getScanStatistics() {
        return {
            isScanning: this.isScanning,
            cachedFiles: this.fileCache.size,
            watchPaths: this.config.watchPaths,
            excludePatterns: this.config.excludePatterns,
            scanInterval: this.config.scanInterval
        };
    }
    /**
     * キャッシュをクリア
     */
    clearCache() {
        this.fileCache.clear();
        console.log('ファイルキャッシュをクリアしました');
    }
}
exports.FileScanner = FileScanner;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGdEQUFrQztBQUNsQywyQ0FBNkI7QUFDN0IsK0NBQWlDO0FBQ2pDLG1DQUFzQztBQW1CdEMsTUFBYSxXQUFZLFNBQVEscUJBQVk7SUFDbkMsTUFBTSxDQUFvQjtJQUMxQixVQUFVLEdBQVksS0FBSyxDQUFDO0lBQzVCLFlBQVksR0FBMEIsSUFBSSxDQUFDO0lBQzNDLFNBQVMsR0FBOEIsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUV6RCxZQUFZLE1BQXlCO1FBQ25DLEtBQUssRUFBRSxDQUFDO1FBQ1IsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7SUFDdkIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLGFBQWE7UUFDakIsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDcEIsT0FBTyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1lBQ2pDLE9BQU87UUFDVCxDQUFDO1FBRUQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQ2pDLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDO1FBRXZCLFNBQVM7UUFDVCxNQUFNLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUU3QixZQUFZO1FBQ1osSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxJQUFJLENBQUMsWUFBWSxHQUFHLFdBQVcsQ0FBQyxLQUFLLElBQUksRUFBRTtnQkFDekMsTUFBTSxJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztZQUN0QyxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUMvQixDQUFDO1FBRUQsSUFBSSxDQUFDLElBQUksQ0FBQyxh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QUFJLENBQUMsTUFBTSxDQUFDLFVBQVU7WUFDbEMsZUFBZSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsZUFBZTtZQUM1QyxZQUFZLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZO1NBQ3ZDLENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSCxVQUFVO1FBQ1IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUN2QixPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQixDQUFDLENBQUM7SUFDbkMsQ0FBQztDQUNGO0FBMVdELGtDQTBXQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogRmlsZSBTY2FubmVyXG4gKiDjg5XjgqHjgqTjg6vjgrfjgrnjg4bjg6Djga7lpInmm7Tnm6PoppbjgajliIbmnpDjgpLmi4XlvZNcbiAqL1xuXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcy9wcm9taXNlcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgY3J5cHRvIGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xuaW1wb3J0IHsgRmlsZU1ldGFkYXRhIH0gZnJvbSAnLi4vLi4vaW50ZXJmYWNlcyc7XG5pbXBvcnQgeyBGaWxlTWV0YWRhdGFNb2RlbCB9IGZyb20gJy4uLy4uL21vZGVscyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmlsZVNjYW5uZXJDb25maWcge1xuICB3YXRjaFBhdGhzOiBzdHJpbmdbXTtcbiAgZXhjbHVkZVBhdHRlcm5zOiBzdHJpbmdbXTtcbiAgc2NhbkludGVydmFsOiBudW1iZXI7IC8vIG1pbGxpc2Vjb25kc1xuICBlbmFibGVSZWFsVGltZVdhdGNoOiBib29sZWFuO1xuICBtYXhGaWxlU2l6ZTogbnVtYmVyOyAvLyBieXRlc1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEZpbGVDaGFuZ2VFdmVudCB7XG4gIHR5cGU6ICdhZGRlZCcgfCAnbW9kaWZpZWQnIHwgJ2RlbGV0ZWQnO1xuICBmaWxlUGF0aDogc3RyaW5nO1xuICBtZXRhZGF0YT86IEZpbGVNZXRhZGF0YTtcbiAgdGltZXN0YW1wOiBEYXRlO1xufVxuXG5leHBvcnQgY2xhc3MgRmlsZVNjYW5uZXIgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xuICBwcml2YXRlIGNvbmZpZzogRmlsZVNjYW5uZXJDb25maWc7XG4gIHByaXZhdGUgaXNTY2FubmluZzogYm9vbGVhbiA9IGZhbHNlO1xuICBwcml2YXRlIHNjYW5JbnRlcnZhbDogTm9kZUpTLlRpbWVvdXQgfCBudWxsID0gbnVsbDtcbiAgcHJpdmF0ZSBmaWxlQ2FjaGU6IE1hcDxzdHJpbmcsIEZpbGVNZXRhZGF0YT4gPSBuZXcgTWFwKCk7XG5cbiAgY29uc3RydWN0b3IoY29uZmlnOiBGaWxlU2Nhbm5lckNvbmZpZykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5jb25maWcgPSBjb25maWc7XG4gIH1cblxuICAvKipcbiAgICog44OV44Kh44Kk44Or44K544Kt44Oj44Oz44KS6ZaL5aeLXG4gICAqL1xuICBhc3luYyBzdGFydFNjYW5uaW5nKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICh0aGlzLmlzU2Nhbm5pbmcpIHtcbiAgICAgIGNvbnNvbGUud2Fybign44OV44Kh44Kk44Or44K544Kt44Oj44Oz44Gv5pei44Gr5a6f6KGM5Lit44Gn44GZJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ+ODleOCoeOCpOODq+OCueOCreODo+ODs+OCkumWi+Wni+OBl+OBvuOBmS4uLicpO1xuICAgIHRoaXMuaXNTY2FubmluZyA9IHRydWU7XG5cbiAgICAvLyDliJ3lm57jgrnjgq3jg6Pjg7NcbiAgICBhd2FpdCB0aGlzLnBlcmZvcm1GdWxsU2NhbigpO1xuXG4gICAgLy8g5a6a5pyf44K544Kt44Oj44Oz44Gu6Kit5a6aXG4gICAgaWYgKHRoaXMuY29uZmlnLnNjYW5JbnRlcnZhbCA+IDApIHtcbiAgICAgIHRoaXMuc2NhbkludGVydmFsID0gc2V0SW50ZXJ2YWwoYXN5bmMgKCkgPT4ge1xuICAgICAgICBhd2FpdCB0aGlzLnBlcmZvcm1JbmNyZW1lbnRhbFNjYW4oKTtcbiAgICAgIH0sIHRoaXMuY29uZmlnLnNjYW5JbnRlcnZhbCk7XG4gICAgfVxuXG4gICAgdGhpcy5lbWl0KCdzY2FuU3RhcnRlZCcpO1xuICB9XG5cbiAgLyoqXG4gICAqIOODleOCoeOCpOODq+OCueOCreODo+ODs+OCkuWBnOatolxuICAgKi9cbiAgc3RvcFNjYW5uaW5nKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5pc1NjYW5uaW5nKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc29sZS5sb2coJ+ODleOCoeOCpOODq+OCueOCreODo+ODs+OCkuWBnOatouOBl+OBvuOBmS4uLicpO1xuICAgIHRoaXMuaXNTY2FubmluZyA9IGZhbHNlO1xuXG4gICAgaWYgKHRoaXMuc2NhbkludGVydmFsKSB7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMuc2NhbkludGVydmFsKTtcbiAgICAgIHRoaXMuc2NhbkludGVydmFsID0gbnVsbDtcbiAgICB9XG5cbiAgICB0aGlzLmVtaXQoJ3NjYW5TdG9wcGVkJyk7XG4gIH1cblxuICAvKipcbiAgICog5a6M5YWo44K544Kt44Oj44Oz44KS5a6f6KGMXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHBlcmZvcm1GdWxsU2NhbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zb2xlLmxvZygn5a6M5YWo44K544Kt44Oj44Oz44KS5a6f6KGM5LitLi4uJyk7XG4gICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICBsZXQgc2Nhbm5lZEZpbGVzID0gMDtcblxuICAgIHRyeSB7XG4gICAgICBmb3IgKGNvbnN0IHdhdGNoUGF0aCBvZiB0aGlzLmNvbmZpZy53YXRjaFBhdGhzKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuc2NhbkRpcmVjdG9yeSh3YXRjaFBhdGgsIHRydWUpO1xuICAgICAgICBzY2FubmVkRmlsZXMrKztcbiAgICAgIH1cblxuICAgICAgY29uc3QgZHVyYXRpb24gPSBEYXRlLm5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgY29uc29sZS5sb2coYOWujOWFqOOCueOCreODo+ODs+WujOS6hjogJHtzY2FubmVkRmlsZXN9IOODleOCoeOCpOODqyAoJHtkdXJhdGlvbn1tcylgKTtcbiAgICAgIFxuICAgICAgdGhpcy5lbWl0KCdmdWxsU2NhbkNvbXBsZXRlZCcsIHtcbiAgICAgICAgc2Nhbm5lZEZpbGVzLFxuICAgICAgICBkdXJhdGlvbixcbiAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcign5a6M5YWo44K544Kt44Oj44Oz5Lit44Gr44Ko44Op44O844GM55m655Sf44GX44G+44GX44GfOicsIGVycm9yKTtcbiAgICAgIHRoaXMuZW1pdCgnc2NhbkVycm9yJywgZXJyb3IpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDlopfliIbjgrnjgq3jg6Pjg7PjgpLlrp/ooYxcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgcGVyZm9ybUluY3JlbWVudGFsU2NhbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAoIXRoaXMuaXNTY2FubmluZykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgbGV0IGNoYW5nZWRGaWxlcyA9IDA7XG5cbiAgICB0cnkge1xuICAgICAgZm9yIChjb25zdCB3YXRjaFBhdGggb2YgdGhpcy5jb25maWcud2F0Y2hQYXRocykge1xuICAgICAgICBjb25zdCBjaGFuZ2VzID0gYXdhaXQgdGhpcy5zY2FuRGlyZWN0b3J5KHdhdGNoUGF0aCwgZmFsc2UpO1xuICAgICAgICBjaGFuZ2VkRmlsZXMgKz0gY2hhbmdlcztcbiAgICAgIH1cblxuICAgICAgY29uc3QgZHVyYXRpb24gPSBEYXRlLm5vdygpIC0gc3RhcnRUaW1lO1xuICAgICAgaWYgKGNoYW5nZWRGaWxlcyA+IDApIHtcbiAgICAgICAgY29uc29sZS5sb2coYOWil+WIhuOCueOCreODo+ODs+WujOS6hjogJHtjaGFuZ2VkRmlsZXN9IOS7tuOBruWkieabtCAoJHtkdXJhdGlvbn1tcylgKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5lbWl0KCdpbmNyZW1lbnRhbFNjYW5Db21wbGV0ZWQnLCB7XG4gICAgICAgIGNoYW5nZWRGaWxlcyxcbiAgICAgICAgZHVyYXRpb24sXG4gICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKVxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ+Wil+WIhuOCueOCreODo+ODs+S4reOBq+OCqOODqeODvOOBjOeZuueUn+OBl+OBvuOBl+OBnzonLCBlcnJvcik7XG4gICAgICB0aGlzLmVtaXQoJ3NjYW5FcnJvcicsIGVycm9yKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44OH44Kj44Os44Kv44OI44Oq44KS44K544Kt44Oj44OzXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHNjYW5EaXJlY3RvcnkoZGlyUGF0aDogc3RyaW5nLCBpc0Z1bGxTY2FuOiBib29sZWFuKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICBsZXQgY2hhbmdlQ291bnQgPSAwO1xuXG4gICAgdHJ5IHtcbiAgICAgIC8vIOODh+OCo+ODrOOCr+ODiOODquOBruWtmOWcqOeiuuiqjVxuICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBmcy5zdGF0KGRpclBhdGgpO1xuICAgICAgaWYgKCFzdGF0cy5pc0RpcmVjdG9yeSgpKSB7XG4gICAgICAgIHJldHVybiAwO1xuICAgICAgfVxuXG4gICAgICAvLyDjg4fjgqPjg6zjgq/jg4jjg6rlhoXjga7jg5XjgqHjgqTjg6vkuIDopqfjgpLlj5blvpdcbiAgICAgIGNvbnN0IGVudHJpZXMgPSBhd2FpdCBmcy5yZWFkZGlyKGRpclBhdGgsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KTtcblxuICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiBlbnRyaWVzKSB7XG4gICAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5qb2luKGRpclBhdGgsIGVudHJ5Lm5hbWUpO1xuXG4gICAgICAgIC8vIOmZpOWkluODkeOCv+ODvOODs+OBruODgeOCp+ODg+OCr1xuICAgICAgICBpZiAodGhpcy5zaG91bGRFeGNsdWRlKGZ1bGxQYXRoKSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGVudHJ5LmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAvLyDjgrXjg5bjg4fjgqPjg6zjgq/jg4jjg6rjgpLlho3luLDnmoTjgavjgrnjgq3jg6Pjg7NcbiAgICAgICAgICBjaGFuZ2VDb3VudCArPSBhd2FpdCB0aGlzLnNjYW5EaXJlY3RvcnkoZnVsbFBhdGgsIGlzRnVsbFNjYW4pO1xuICAgICAgICB9IGVsc2UgaWYgKGVudHJ5LmlzRmlsZSgpKSB7XG4gICAgICAgICAgLy8g44OV44Kh44Kk44Or44KS5Yem55CGXG4gICAgICAgICAgY29uc3QgaGFzQ2hhbmdlZCA9IGF3YWl0IHRoaXMucHJvY2Vzc0ZpbGUoZnVsbFBhdGgsIGlzRnVsbFNjYW4pO1xuICAgICAgICAgIGlmIChoYXNDaGFuZ2VkKSB7XG4gICAgICAgICAgICBjaGFuZ2VDb3VudCsrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBpZiAoZXJyb3IuY29kZSAhPT0gJ0VOT0VOVCcpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihg44OH44Kj44Os44Kv44OI44Oq44K544Kt44Oj44Oz44Ko44Op44O8ICgke2RpclBhdGh9KTpgLCBlcnJvcik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGNoYW5nZUNvdW50O1xuICB9XG5cbiAgLyoqXG4gICAqIOODleOCoeOCpOODq+OCkuWHpueQhlxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBwcm9jZXNzRmlsZShmaWxlUGF0aDogc3RyaW5nLCBpc0Z1bGxTY2FuOiBib29sZWFuKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHN0YXRzID0gYXdhaXQgZnMuc3RhdChmaWxlUGF0aCk7XG5cbiAgICAgIC8vIOODleOCoeOCpOODq+OCteOCpOOCuuODgeOCp+ODg+OCr1xuICAgICAgaWYgKHN0YXRzLnNpemUgPiB0aGlzLmNvbmZpZy5tYXhGaWxlU2l6ZSkge1xuICAgICAgICBjb25zb2xlLndhcm4oYOODleOCoeOCpOODq+OCteOCpOOCuuOBjOS4iumZkOOCkui2heOBiOOBpuOBhOOBvuOBmTogJHtmaWxlUGF0aH0gKCR7c3RhdHMuc2l6ZX0gYnl0ZXMpYCk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgLy8g44OV44Kh44Kk44Or44Oh44K/44OH44O844K/44KS55Sf5oiQXG4gICAgICBjb25zdCBtZXRhZGF0YSA9IGF3YWl0IHRoaXMuZ2VuZXJhdGVGaWxlTWV0YWRhdGEoZmlsZVBhdGgsIHN0YXRzKTtcbiAgICAgIFxuICAgICAgLy8g44Kt44Oj44OD44K344Ol44Go5q+U6LyD44GX44Gm5aSJ5pu044KS5qSc5Ye6XG4gICAgICBjb25zdCBjYWNoZWRNZXRhZGF0YSA9IHRoaXMuZmlsZUNhY2hlLmdldChmaWxlUGF0aCk7XG4gICAgICBjb25zdCBoYXNDaGFuZ2VkID0gaXNGdWxsU2NhbiB8fCAhY2FjaGVkTWV0YWRhdGEgfHwgXG4gICAgICAgICAgICAgICAgICAgICAgICBjYWNoZWRNZXRhZGF0YS5jaGVja3N1bSAhPT0gbWV0YWRhdGEuY2hlY2tzdW0gfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhY2hlZE1ldGFkYXRhLm1vZGlmaWVkLmdldFRpbWUoKSAhPT0gbWV0YWRhdGEubW9kaWZpZWQuZ2V0VGltZSgpO1xuXG4gICAgICBpZiAoaGFzQ2hhbmdlZCkge1xuICAgICAgICAvLyDjgq3jg6Pjg4Pjgrfjg6XjgpLmm7TmlrBcbiAgICAgICAgdGhpcy5maWxlQ2FjaGUuc2V0KGZpbGVQYXRoLCBtZXRhZGF0YSk7XG5cbiAgICAgICAgLy8g5aSJ5pu044Kk44OZ44Oz44OI44KS55m66KGMXG4gICAgICAgIGNvbnN0IGV2ZW50VHlwZSA9IGNhY2hlZE1ldGFkYXRhID8gJ21vZGlmaWVkJyA6ICdhZGRlZCc7XG4gICAgICAgIGNvbnN0IGNoYW5nZUV2ZW50OiBGaWxlQ2hhbmdlRXZlbnQgPSB7XG4gICAgICAgICAgdHlwZTogZXZlbnRUeXBlLFxuICAgICAgICAgIGZpbGVQYXRoLFxuICAgICAgICAgIG1ldGFkYXRhLFxuICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKVxuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuZW1pdCgnZmlsZUNoYW5nZWQnLCBjaGFuZ2VFdmVudCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYOODleOCoeOCpOODq+WHpueQhuOCqOODqeODvCAoJHtmaWxlUGF0aH0pOmAsIGVycm9yKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44OV44Kh44Kk44Or44Oh44K/44OH44O844K/44KS55Sf5oiQXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGdlbmVyYXRlRmlsZU1ldGFkYXRhKGZpbGVQYXRoOiBzdHJpbmcsIHN0YXRzOiBhbnkpOiBQcm9taXNlPEZpbGVNZXRhZGF0YT4ge1xuICAgIC8vIOODleOCoeOCpOODq+OBruODj+ODg+OCt+ODpeWApOOCkuioiOeul1xuICAgIGNvbnN0IGNoZWNrc3VtID0gYXdhaXQgdGhpcy5jYWxjdWxhdGVGaWxlSGFzaChmaWxlUGF0aCk7XG4gICAgXG4gICAgLy8gTUlNReOCv+OCpOODl+OCkuaOqOWumlxuICAgIGNvbnN0IG1pbWVUeXBlID0gdGhpcy5ndWVzc01pbWVUeXBlKGZpbGVQYXRoKTtcblxuICAgIHJldHVybiB7XG4gICAgICBwYXRoOiBmaWxlUGF0aCxcbiAgICAgIHNpemU6IHN0YXRzLnNpemUsXG4gICAgICBjcmVhdGVkOiBzdGF0cy5iaXJ0aHRpbWUsXG4gICAgICBtb2RpZmllZDogc3RhdHMubXRpbWUsXG4gICAgICBjaGVja3N1bSxcbiAgICAgIG1pbWVUeXBlLFxuICAgICAgdGFnczogW10sXG4gICAgICBlbnZpcm9ubWVudDogJ2xvY2FsJyAvLyDjg4fjg5Xjgqnjg6vjg4jjga/jg63jg7zjgqvjg6vnkrDlooNcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOODleOCoeOCpOODq+OBruODj+ODg+OCt+ODpeWApOOCkuioiOeul1xuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBjYWxjdWxhdGVGaWxlSGFzaChmaWxlUGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgZmlsZUJ1ZmZlciA9IGF3YWl0IGZzLnJlYWRGaWxlKGZpbGVQYXRoKTtcbiAgICAgIGNvbnN0IGhhc2ggPSBjcnlwdG8uY3JlYXRlSGFzaCgnc2hhMjU2Jyk7XG4gICAgICBoYXNoLnVwZGF0ZShmaWxlQnVmZmVyKTtcbiAgICAgIHJldHVybiBoYXNoLmRpZ2VzdCgnaGV4Jyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoYOODj+ODg+OCt+ODpeioiOeul+OCqOODqeODvCAoJHtmaWxlUGF0aH0pOmAsIGVycm9yKTtcbiAgICAgIHJldHVybiAnJztcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogTUlNReOCv+OCpOODl+OCkuaOqOWumlxuICAgKi9cbiAgcHJpdmF0ZSBndWVzc01pbWVUeXBlKGZpbGVQYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IGV4dCA9IHBhdGguZXh0bmFtZShmaWxlUGF0aCkudG9Mb3dlckNhc2UoKTtcbiAgICBcbiAgICBjb25zdCBtaW1lVHlwZXM6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7XG4gICAgICAnLnRzJzogJ3RleHQvdHlwZXNjcmlwdCcsXG4gICAgICAnLmpzJzogJ3RleHQvamF2YXNjcmlwdCcsXG4gICAgICAnLmpzb24nOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAnLm1kJzogJ3RleHQvbWFya2Rvd24nLFxuICAgICAgJy50eHQnOiAndGV4dC9wbGFpbicsXG4gICAgICAnLmh0bWwnOiAndGV4dC9odG1sJyxcbiAgICAgICcuY3NzJzogJ3RleHQvY3NzJyxcbiAgICAgICcueW1sJzogJ3RleHQveWFtbCcsXG4gICAgICAnLnlhbWwnOiAndGV4dC95YW1sJyxcbiAgICAgICcueG1sJzogJ3RleHQveG1sJyxcbiAgICAgICcuc2gnOiAndGV4dC94LXNoZWxsc2NyaXB0JyxcbiAgICAgICcucHknOiAndGV4dC94LXB5dGhvbicsXG4gICAgICAnLnNxbCc6ICd0ZXh0L3gtc3FsJyxcbiAgICAgICcuZG9ja2VyZmlsZSc6ICd0ZXh0L3gtZG9ja2VyZmlsZScsXG4gICAgICAnLmdpdGlnbm9yZSc6ICd0ZXh0L3BsYWluJyxcbiAgICAgICcuZW52JzogJ3RleHQvcGxhaW4nXG4gICAgfTtcblxuICAgIHJldHVybiBtaW1lVHlwZXNbZXh0XSB8fCAnYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtJztcbiAgfVxuXG4gIC8qKlxuICAgKiDjg5XjgqHjgqTjg6vjgYzpmaTlpJblr77osaHjgYvjg4Hjgqfjg4Pjgq9cbiAgICovXG4gIHByaXZhdGUgc2hvdWxkRXhjbHVkZShmaWxlUGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgY29uc3Qgbm9ybWFsaXplZFBhdGggPSBwYXRoLm5vcm1hbGl6ZShmaWxlUGF0aCk7XG4gICAgXG4gICAgcmV0dXJuIHRoaXMuY29uZmlnLmV4Y2x1ZGVQYXR0ZXJucy5zb21lKHBhdHRlcm4gPT4ge1xuICAgICAgLy8g57Ch5Y2Y44Gq44Kw44Ot44OW44OR44K/44O844Oz44Oe44OD44OB44Oz44KwXG4gICAgICBpZiAocGF0dGVybi5pbmNsdWRlcygnKicpKSB7XG4gICAgICAgIGNvbnN0IHJlZ2V4ID0gbmV3IFJlZ0V4cChwYXR0ZXJuLnJlcGxhY2UoL1xcKi9nLCAnLionKSk7XG4gICAgICAgIHJldHVybiByZWdleC50ZXN0KG5vcm1hbGl6ZWRQYXRoKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8g55u05o6l44Oe44OD44OB44Oz44KwXG4gICAgICByZXR1cm4gbm9ybWFsaXplZFBhdGguaW5jbHVkZXMocGF0dGVybik7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog5YmK6Zmk44GV44KM44Gf44OV44Kh44Kk44Or44KS5qSc5Ye6XG4gICAqL1xuICBhc3luYyBkZXRlY3REZWxldGVkRmlsZXMoKTogUHJvbWlzZTxGaWxlQ2hhbmdlRXZlbnRbXT4ge1xuICAgIGNvbnN0IGRlbGV0ZWRGaWxlczogRmlsZUNoYW5nZUV2ZW50W10gPSBbXTtcblxuICAgIHRoaXMuZmlsZUNhY2hlLmZvckVhY2goKG1ldGFkYXRhLCBmaWxlUGF0aCkgPT4ge1xuICAgICAgKGFzeW5jICgpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCBmcy5hY2Nlc3MoZmlsZVBhdGgpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgaWYgKGVycm9yLmNvZGUgPT09ICdFTk9FTlQnKSB7XG4gICAgICAgICAgICAvLyDjg5XjgqHjgqTjg6vjgYzliYrpmaTjgZXjgozjgabjgYTjgotcbiAgICAgICAgICAgIGRlbGV0ZWRGaWxlcy5wdXNoKHtcbiAgICAgICAgICAgICAgdHlwZTogJ2RlbGV0ZWQnLFxuICAgICAgICAgICAgICBmaWxlUGF0aCxcbiAgICAgICAgICAgICAgbWV0YWRhdGEsXG4gICAgICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIOOCreODo+ODg+OCt+ODpeOBi+OCieWJiumZpFxuICAgICAgICAgICAgdGhpcy5maWxlQ2FjaGUuZGVsZXRlKGZpbGVQYXRoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pKCk7XG4gICAgfSk7XG5cbiAgICAvLyDliYrpmaTjgqTjg5njg7Pjg4jjgpLnmbrooYxcbiAgICBkZWxldGVkRmlsZXMuZm9yRWFjaChldmVudCA9PiB7XG4gICAgICB0aGlzLmVtaXQoJ2ZpbGVDaGFuZ2VkJywgZXZlbnQpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGRlbGV0ZWRGaWxlcztcbiAgfVxuXG4gIC8qKlxuICAgKiDnibnlrprjga7jg5XjgqHjgqTjg6vjgpLlvLfliLbjgrnjgq3jg6Pjg7NcbiAgICovXG4gIGFzeW5jIHNjYW5GaWxlKGZpbGVQYXRoOiBzdHJpbmcpOiBQcm9taXNlPEZpbGVNZXRhZGF0YSB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBmcy5zdGF0KGZpbGVQYXRoKTtcbiAgICAgIGlmIChzdGF0cy5pc0ZpbGUoKSkge1xuICAgICAgICBjb25zdCBtZXRhZGF0YSA9IGF3YWl0IHRoaXMuZ2VuZXJhdGVGaWxlTWV0YWRhdGEoZmlsZVBhdGgsIHN0YXRzKTtcbiAgICAgICAgdGhpcy5maWxlQ2FjaGUuc2V0KGZpbGVQYXRoLCBtZXRhZGF0YSk7XG4gICAgICAgIHJldHVybiBtZXRhZGF0YTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcihg44OV44Kh44Kk44Or44K544Kt44Oj44Oz44Ko44Op44O8ICgke2ZpbGVQYXRofSk6YCwgZXJyb3IpO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiDjgrnjgq3jg6Pjg7PntbHoqIjjgpLlj5blvpdcbiAgICovXG4gIGdldFNjYW5TdGF0aXN0aWNzKCk6IGFueSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGlzU2Nhbm5pbmc6IHRoaXMuaXNTY2FubmluZyxcbiAgICAgIGNhY2hlZEZpbGVzOiB0aGlzLmZpbGVDYWNoZS5zaXplLFxuICAgICAgd2F0Y2hQYXRoczogdGhpcy5jb25maWcud2F0Y2hQYXRocyxcbiAgICAgIGV4Y2x1ZGVQYXR0ZXJuczogdGhpcy5jb25maWcuZXhjbHVkZVBhdHRlcm5zLFxuICAgICAgc2NhbkludGVydmFsOiB0aGlzLmNvbmZpZy5zY2FuSW50ZXJ2YWxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOOCreODo+ODg+OCt+ODpeOCkuOCr+ODquOColxuICAgKi9cbiAgY2xlYXJDYWNoZSgpOiB2b2lkIHtcbiAgICB0aGlzLmZpbGVDYWNoZS5jbGVhcigpO1xuICAgIGNvbnNvbGUubG9nKCfjg5XjgqHjgqTjg6vjgq3jg6Pjg4Pjgrfjg6XjgpLjgq/jg6rjgqLjgZfjgb7jgZfjgZ8nKTtcbiAgfVxufSJdfQ==