"use strict";
/**
 * Database Manager
 * SQLiteデータベースの初期化と管理を担当
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
exports.DatabaseManager = void 0;
// SQLite3の代わりにファイルベースの簡易実装を使用
// 本格的な実装では better-sqlite3 を推奨
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const models_1 = require("../../models");
class DatabaseManager {
    initialized = false;
    dbPath;
    dataStore = new Map();
    constructor(dbPath = './data/cpos.db') {
        this.dbPath = dbPath;
    }
    /**
     * データベースを初期化
     */
    async initialize() {
        try {
            // データベースディレクトリを作成
            const dbDir = path.dirname(this.dbPath);
            await fs.mkdir(dbDir, { recursive: true });
            // 既存のデータを読み込み（存在する場合）
            try {
                const existingData = await fs.readFile(this.dbPath, 'utf-8');
                const parsedData = JSON.parse(existingData);
                this.dataStore = new Map(Object.entries(parsedData));
            }
            catch {
                // ファイルが存在しない場合は新規作成
                this.dataStore = new Map();
            }
            this.initialized = true;
            console.log('データベースの初期化が完了しました');
        }
        catch (error) {
            console.error('データベースの初期化に失敗しました:', error);
            throw error;
        }
    }
    /**
     * データベースが初期化されているかチェック
     */
    checkInitialized() {
        if (!this.initialized) {
            throw new Error('データベースが初期化されていません。initialize()を先に実行してください。');
        }
    }
    /**
     * データを永続化
     */
    async persist() {
        const data = Object.fromEntries(this.dataStore);
        await fs.writeFile(this.dbPath, JSON.stringify(data, null, 2));
    }
    /**
     * データベース接続を閉じる
     */
    async close() {
        if (this.initialized) {
            await this.persist();
            this.initialized = false;
        }
    }
    /**
     * ファイルメタデータを挿入または更新
     */
    async upsertFileMetadata(metadata) {
        this.checkInitialized();
        const key = `file_metadata:${metadata.path}`;
        this.dataStore.set(key, metadata.toObject());
        await this.persist();
    }
    /**
     * ファイルメタデータを取得
     */
    async getFileMetadata(filePath) {
        this.checkInitialized();
        const key = `file_metadata:${filePath}`;
        const data = this.dataStore.get(key);
        return data ? models_1.FileMetadataModel.fromObject(data) : null;
    }
    /**
     * 環境別のファイルメタデータを取得
     */
    async getFileMetadataByEnvironment(environment) {
        this.checkInitialized();
        const results = [];
        this.dataStore.forEach((value, key) => {
            if (key.startsWith('file_metadata:') && value.environment === environment) {
                results.push(models_1.FileMetadataModel.fromObject(value));
            }
        });
        return results.sort((a, b) => a.path.localeCompare(b.path));
    }
    /**
     * 同期状態を挿入または更新
     */
    async upsertSyncState(syncState) {
        this.checkInitialized();
        const key = `sync_state:${syncState.filePath}`;
        this.dataStore.set(key, syncState.toObject());
        await this.persist();
    }
    /**
     * 同期状態を取得
     */
    async getSyncState(filePath) {
        this.checkInitialized();
        const key = `sync_state:${filePath}`;
        const data = this.dataStore.get(key);
        return data ? models_1.SyncStateModel.fromObject(data) : null;
    }
    /**
     * バックアップ履歴を挿入
     */
    async insertBackupHistory(backup) {
        this.checkInitialized();
        const key = `backup_history:${backup.backupId}`;
        this.dataStore.set(key, backup.toObject());
        await this.persist();
    }
    /**
     * バックアップ履歴を取得
     */
    async getBackupHistory(limit = 50) {
        this.checkInitialized();
        const results = [];
        this.dataStore.forEach((value, key) => {
            if (key.startsWith('backup_history:')) {
                results.push(models_1.BackupHistoryModel.fromObject(value));
            }
        });
        return results
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);
    }
    /**
     * 操作ログを挿入
     */
    async insertOperationLog(log) {
        this.checkInitialized();
        const id = Date.now().toString();
        log.id = parseInt(id);
        const key = `operation_log:${id}`;
        this.dataStore.set(key, log.toObject());
        await this.persist();
    }
    /**
     * 操作ログを更新
     */
    async updateOperationLog(id, status, completedAt, errorMessage) {
        this.checkInitialized();
        const key = `operation_log:${id}`;
        const existing = this.dataStore.get(key);
        if (existing) {
            existing.status = status;
            if (completedAt)
                existing.completed_at = completedAt.toISOString();
            if (errorMessage)
                existing.error_message = errorMessage;
            this.dataStore.set(key, existing);
            await this.persist();
        }
    }
    /**
     * 操作ログを取得
     */
    async getOperationLogs(limit = 100) {
        this.checkInitialized();
        const results = [];
        this.dataStore.forEach((value, key) => {
            if (key.startsWith('operation_log:')) {
                results.push(models_1.OperationLogModel.fromObject(value));
            }
        });
        return results
            .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
            .slice(0, limit);
    }
    /**
     * データベースの統計情報を取得
     */
    async getStatistics() {
        this.checkInitialized();
        const stats = {
            fileCount: 0,
            syncStateCount: 0,
            backupCount: 0,
            operationLogCount: 0
        };
        this.dataStore.forEach((value, key) => {
            if (key.startsWith('file_metadata:'))
                stats.fileCount++;
            else if (key.startsWith('sync_state:'))
                stats.syncStateCount++;
            else if (key.startsWith('backup_history:'))
                stats.backupCount++;
            else if (key.startsWith('operation_log:'))
                stats.operationLogCount++;
        });
        return stats;
    }
}
exports.DatabaseManager = DatabaseManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILDhCQUE4QjtBQUM5Qiw4QkFBOEI7QUFDOUIsZ0RBQWtDO0FBQ2xDLDJDQUE2QjtBQUM3Qix5Q0FBd0c7QUFFeEcsTUFBYSxlQUFlO0lBQ2xCLFdBQVcsR0FBWSxLQUFLLENBQUM7SUFDN0IsTUFBTSxDQUFTO0lBQ2YsU0FBUyxHQUFxQixJQUFJLEdBQUcsRUFBRSxDQUFDO0lBRWhELFlBQVksU0FBaUIsZ0JBQWdCO1FBQzNDLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0lBQ3ZCLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxVQUFVO1FBQ2QsSUFBSSxDQUFDO1lBQ0gsa0JBQWtCO1lBQ2xCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3hDLE1BQU0sRUFBRSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUUzQyxzQkFBc0I7WUFDdEIsSUFBSSxDQUFDO2dCQUNILE1BQU0sWUFBWSxHQUFHLE1BQU0sRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUM3RCxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUM1QyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztZQUN2RCxDQUFDO1lBQUMsTUFBTSxDQUFDO2dCQUNQLG9CQUFvQjtnQkFDcEIsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO1lBQzdC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Q0FBQztRQUV4QixNQUFNLEtBQUssR0FBRztZQUNaLFNBQVMsRUFBRSxDQUFDO1lBQ1osY0FBYyxFQUFFLENBQUM7WUFDakIsV0FBVyxFQUFFLENBQUM7WUFDZCxpQkFBaUIsRUFBRSxDQUFDO1NBQ3JCLENBQUM7UUFFRixJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUUsRUFBRTtZQUNwQyxJQUFJLEdBQUcsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUM7Z0JBQUUsS0FBSyxDQUFDLFNBQVMsRUFBRSxDQUFDO2lCQUNuRCxJQUFJLEdBQUcsQ0FBQyxVQUFVLENBQUMsYUFBYSxDQUFDO2dCQUFFLEtBQUssQ0FBQyxjQUFjLEVBQUUsQ0FBQztpQkFDMUQsSUFBSSxHQUFHLENBQUMsVUFBVSxDQUFDLGlCQUFpQixDQUFDO2dCQUFFLEtBQUssQ0FBQyxXQUFXLEVBQUUsQ0FBQztpQkFDM0QsSUFBSSxHQUFHLENBQUMsVUFBVSxDQUFDLGdCQUFnQixDQUFDO2dCQUFFLEtBQUssQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBQ3ZFLENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0NBQ0Y7QUFyT0QsMENBcU9DIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBEYXRhYmFzZSBNYW5hZ2VyXG4gKiBTUUxpdGXjg4fjg7zjgr/jg5njg7zjgrnjga7liJ3mnJ/ljJbjgajnrqHnkIbjgpLmi4XlvZNcbiAqL1xuXG4vLyBTUUxpdGUz44Gu5Luj44KP44KK44Gr44OV44Kh44Kk44Or44OZ44O844K544Gu57Ch5piT5a6f6KOF44KS5L2/55SoXG4vLyDmnKzmoLznmoTjgarlrp/oo4Xjgafjga8gYmV0dGVyLXNxbGl0ZTMg44KS5o6o5aWoXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcy9wcm9taXNlcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgRmlsZU1ldGFkYXRhTW9kZWwsIFN5bmNTdGF0ZU1vZGVsLCBCYWNrdXBIaXN0b3J5TW9kZWwsIE9wZXJhdGlvbkxvZ01vZGVsIH0gZnJvbSAnLi4vLi4vbW9kZWxzJztcblxuZXhwb3J0IGNsYXNzIERhdGFiYXNlTWFuYWdlciB7XG4gIHByaXZhdGUgaW5pdGlhbGl6ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcbiAgcHJpdmF0ZSBkYlBhdGg6IHN0cmluZztcbiAgcHJpdmF0ZSBkYXRhU3RvcmU6IE1hcDxzdHJpbmcsIGFueT4gPSBuZXcgTWFwKCk7XG5cbiAgY29uc3RydWN0b3IoZGJQYXRoOiBzdHJpbmcgPSAnLi9kYXRhL2Nwb3MuZGInKSB7XG4gICAgdGhpcy5kYlBhdGggPSBkYlBhdGg7XG4gIH1cblxuICAvKipcbiAgICog44OH44O844K/44OZ44O844K544KS5Yid5pyf5YyWXG4gICAqL1xuICBhc3luYyBpbml0aWFsaXplKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRyeSB7XG4gICAgICAvLyDjg4fjg7zjgr/jg5njg7zjgrnjg4fjgqPjg6zjgq/jg4jjg6rjgpLkvZzmiJBcbiAgICAgIGNvbnN0IGRiRGlyID0gcGF0aC5kaXJuYW1lKHRoaXMuZGJQYXRoKTtcbiAgICAgIGF3YWl0IGZzLm1rZGlyKGRiRGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblxuICAgICAgLy8g5pei5a2Y44Gu44OH44O844K/44KS6Kqt44G/6L6844G/77yI5a2Y5Zyo44GZ44KL5aC05ZCI77yJXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBleGlzdGluZ0RhdGEgPSBhd2FpdCBmcy5yZWFkRmlsZSh0aGlzLmRiUGF0aCwgJ3V0Zi04Jyk7XG4gICAgICAgIGNvbnN0IHBhcnNlZERhdGEgPSBKU09OLnBhcnNlKGV4aXN0aW5nRGF0YSk7XG4gICAgICAgIHRoaXMuZGF0YVN0b3JlID0gbmV3IE1hcChPYmplY3QuZW50cmllcyhwYXJzZWREYXRhKSk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLy8g44OV44Kh44Kk44Or44GM5a2Y5Zyo44GX44Gq44GE5aC05ZCI44Gv5paw6KaP5L2c5oiQXG4gICAgICAgIHRoaXMuZGF0YVN0b3JlID0gbmV3IE1hcCgpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmluaXRpYWxpemVkID0gdHJ1ZTtcbiAgICAgIGNvbnNvbGUubG9nKCfjg4fjg7zjgr/jg5njg7zjgrnjga7liJ3mnJ/ljJbjgYzlrozkuobjgZfjgb7jgZfjgZ8nKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcign44OH44O844K/44OZ44O844K544Gu5Yid5pyf5YyW44Gr5aSx5pWX44GX44G+44GX44GfOicsIGVycm9yKTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg4fjg7zjgr/jg5njg7zjgrnjgYzliJ3mnJ/ljJbjgZXjgozjgabjgYTjgovjgYvjg4Hjgqfjg4Pjgq9cbiAgICovXG4gIHByaXZhdGUgY2hlY2tJbml0aWFsaXplZCgpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuaW5pdGlhbGl6ZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcign44OH44O844K/44OZ44O844K544GM5Yid5pyf5YyW44GV44KM44Gm44GE44G+44Gb44KT44CCaW5pdGlhbGl6ZSgp44KS5YWI44Gr5a6f6KGM44GX44Gm44GP44Gg44GV44GE44CCJyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIOODh+ODvOOCv+OCkuawuOe2muWMllxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBwZXJzaXN0KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGRhdGEgPSBPYmplY3QuZnJvbUVudHJpZXModGhpcy5kYXRhU3RvcmUpO1xuICAgIGF3YWl0IGZzLndyaXRlRmlsZSh0aGlzLmRiUGF0aCwgSlNPTi5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgMikpO1xuICB9XG5cbiAgLyoqXG4gICAqIOODh+ODvOOCv+ODmeODvOOCueaOpee2muOCkumWieOBmOOCi1xuICAgKi9cbiAgYXN5bmMgY2xvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKHRoaXMuaW5pdGlhbGl6ZWQpIHtcbiAgICAgIGF3YWl0IHRoaXMucGVyc2lzdCgpO1xuICAgICAgdGhpcy5pbml0aWFsaXplZCA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDjg5XjgqHjgqTjg6vjg6Hjgr/jg4fjg7zjgr/jgpLmjL/lhaXjgb7jgZ/jga/mm7TmlrBcbiAgICovXG4gIGFzeW5jIHVwc2VydEZpbGVNZXRhZGF0YShtZXRhZGF0YTogRmlsZU1ldGFkYXRhTW9kZWwpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmNoZWNrSW5pdGlhbGl6ZWQoKTtcbiAgICBcbiAgICBjb25zdCBrZXkgPSBgZmlsZV9tZXRhZGF0YToke21ldGFkYXRhLnBhdGh9YDtcbiAgICB0aGlzLmRhdGFTdG9yZS5zZXQoa2V5LCBtZXRhZGF0YS50b09iamVjdCgpKTtcbiAgICBhd2FpdCB0aGlzLnBlcnNpc3QoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDjg5XjgqHjgqTjg6vjg6Hjgr/jg4fjg7zjgr/jgpLlj5blvpdcbiAgICovXG4gIGFzeW5jIGdldEZpbGVNZXRhZGF0YShmaWxlUGF0aDogc3RyaW5nKTogUHJvbWlzZTxGaWxlTWV0YWRhdGFNb2RlbCB8IG51bGw+IHtcbiAgICB0aGlzLmNoZWNrSW5pdGlhbGl6ZWQoKTtcbiAgICBcbiAgICBjb25zdCBrZXkgPSBgZmlsZV9tZXRhZGF0YToke2ZpbGVQYXRofWA7XG4gICAgY29uc3QgZGF0YSA9IHRoaXMuZGF0YVN0b3JlLmdldChrZXkpO1xuICAgIFxuICAgIHJldHVybiBkYXRhID8gRmlsZU1ldGFkYXRhTW9kZWwuZnJvbU9iamVjdChkYXRhKSA6IG51bGw7XG4gIH1cblxuICAvKipcbiAgICog55Kw5aKD5Yil44Gu44OV44Kh44Kk44Or44Oh44K/44OH44O844K/44KS5Y+W5b6XXG4gICAqL1xuICBhc3luYyBnZXRGaWxlTWV0YWRhdGFCeUVudmlyb25tZW50KGVudmlyb25tZW50OiAnbG9jYWwnIHwgJ2VjMicpOiBQcm9taXNlPEZpbGVNZXRhZGF0YU1vZGVsW10+IHtcbiAgICB0aGlzLmNoZWNrSW5pdGlhbGl6ZWQoKTtcbiAgICBcbiAgICBjb25zdCByZXN1bHRzOiBGaWxlTWV0YWRhdGFNb2RlbFtdID0gW107XG4gICAgXG4gICAgdGhpcy5kYXRhU3RvcmUuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuICAgICAgaWYgKGtleS5zdGFydHNXaXRoKCdmaWxlX21ldGFkYXRhOicpICYmIHZhbHVlLmVudmlyb25tZW50ID09PSBlbnZpcm9ubWVudCkge1xuICAgICAgICByZXN1bHRzLnB1c2goRmlsZU1ldGFkYXRhTW9kZWwuZnJvbU9iamVjdCh2YWx1ZSkpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIFxuICAgIHJldHVybiByZXN1bHRzLnNvcnQoKGEsIGIpID0+IGEucGF0aC5sb2NhbGVDb21wYXJlKGIucGF0aCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIOWQjOacn+eKtuaFi+OCkuaMv+WFpeOBvuOBn+OBr+abtOaWsFxuICAgKi9cbiAgYXN5bmMgdXBzZXJ0U3luY1N0YXRlKHN5bmNTdGF0ZTogU3luY1N0YXRlTW9kZWwpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmNoZWNrSW5pdGlhbGl6ZWQoKTtcbiAgICBcbiAgICBjb25zdCBrZXkgPSBgc3luY19zdGF0ZToke3N5bmNTdGF0ZS5maWxlUGF0aH1gO1xuICAgIHRoaXMuZGF0YVN0b3JlLnNldChrZXksIHN5bmNTdGF0ZS50b09iamVjdCgpKTtcbiAgICBhd2FpdCB0aGlzLnBlcnNpc3QoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDlkIzmnJ/nirbmhYvjgpLlj5blvpdcbiAgICovXG4gIGFzeW5jIGdldFN5bmNTdGF0ZShmaWxlUGF0aDogc3RyaW5nKTogUHJvbWlzZTxTeW5jU3RhdGVNb2RlbCB8IG51bGw+IHtcbiAgICB0aGlzLmNoZWNrSW5pdGlhbGl6ZWQoKTtcbiAgICBcbiAgICBjb25zdCBrZXkgPSBgc3luY19zdGF0ZToke2ZpbGVQYXRofWA7XG4gICAgY29uc3QgZGF0YSA9IHRoaXMuZGF0YVN0b3JlLmdldChrZXkpO1xuICAgIFxuICAgIHJldHVybiBkYXRhID8gU3luY1N0YXRlTW9kZWwuZnJvbU9iamVjdChkYXRhKSA6IG51bGw7XG4gIH1cblxuICAvKipcbiAgICog44OQ44OD44Kv44Ki44OD44OX5bGl5q2044KS5oy/5YWlXG4gICAqL1xuICBhc3luYyBpbnNlcnRCYWNrdXBIaXN0b3J5KGJhY2t1cDogQmFja3VwSGlzdG9yeU1vZGVsKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5jaGVja0luaXRpYWxpemVkKCk7XG4gICAgXG4gICAgY29uc3Qga2V5ID0gYGJhY2t1cF9oaXN0b3J5OiR7YmFja3VwLmJhY2t1cElkfWA7XG4gICAgdGhpcy5kYXRhU3RvcmUuc2V0KGtleSwgYmFja3VwLnRvT2JqZWN0KCkpO1xuICAgIGF3YWl0IHRoaXMucGVyc2lzdCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIOODkOODg+OCr+OCouODg+ODl+WxpeattOOCkuWPluW+l1xuICAgKi9cbiAgYXN5bmMgZ2V0QmFja3VwSGlzdG9yeShsaW1pdDogbnVtYmVyID0gNTApOiBQcm9taXNlPEJhY2t1cEhpc3RvcnlNb2RlbFtdPiB7XG4gICAgdGhpcy5jaGVja0luaXRpYWxpemVkKCk7XG4gICAgXG4gICAgY29uc3QgcmVzdWx0czogQmFja3VwSGlzdG9yeU1vZGVsW10gPSBbXTtcbiAgICBcbiAgICB0aGlzLmRhdGFTdG9yZS5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiB7XG4gICAgICBpZiAoa2V5LnN0YXJ0c1dpdGgoJ2JhY2t1cF9oaXN0b3J5OicpKSB7XG4gICAgICAgIHJlc3VsdHMucHVzaChCYWNrdXBIaXN0b3J5TW9kZWwuZnJvbU9iamVjdCh2YWx1ZSkpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIFxuICAgIHJldHVybiByZXN1bHRzXG4gICAgICAuc29ydCgoYSwgYikgPT4gYi5jcmVhdGVkQXQuZ2V0VGltZSgpIC0gYS5jcmVhdGVkQXQuZ2V0VGltZSgpKVxuICAgICAgLnNsaWNlKDAsIGxpbWl0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDmk43kvZzjg63jgrDjgpLmjL/lhaVcbiAgICovXG4gIGFzeW5jIGluc2VydE9wZXJhdGlvbkxvZyhsb2c6IE9wZXJhdGlvbkxvZ01vZGVsKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5jaGVja0luaXRpYWxpemVkKCk7XG4gICAgXG4gICAgY29uc3QgaWQgPSBEYXRlLm5vdygpLnRvU3RyaW5nKCk7XG4gICAgbG9nLmlkID0gcGFyc2VJbnQoaWQpO1xuICAgIGNvbnN0IGtleSA9IGBvcGVyYXRpb25fbG9nOiR7aWR9YDtcbiAgICB0aGlzLmRhdGFTdG9yZS5zZXQoa2V5LCBsb2cudG9PYmplY3QoKSk7XG4gICAgYXdhaXQgdGhpcy5wZXJzaXN0KCk7XG4gIH1cblxuICAvKipcbiAgICog5pON5L2c44Ot44Kw44KS5pu05pawXG4gICAqL1xuICBhc3luYyB1cGRhdGVPcGVyYXRpb25Mb2coaWQ6IG51bWJlciwgc3RhdHVzOiBzdHJpbmcsIGNvbXBsZXRlZEF0PzogRGF0ZSwgZXJyb3JNZXNzYWdlPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5jaGVja0luaXRpYWxpemVkKCk7XG4gICAgXG4gICAgY29uc3Qga2V5ID0gYG9wZXJhdGlvbl9sb2c6JHtpZH1gO1xuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5kYXRhU3RvcmUuZ2V0KGtleSk7XG4gICAgXG4gICAgaWYgKGV4aXN0aW5nKSB7XG4gICAgICBleGlzdGluZy5zdGF0dXMgPSBzdGF0dXM7XG4gICAgICBpZiAoY29tcGxldGVkQXQpIGV4aXN0aW5nLmNvbXBsZXRlZF9hdCA9IGNvbXBsZXRlZEF0LnRvSVNPU3RyaW5nKCk7XG4gICAgICBpZiAoZXJyb3JNZXNzYWdlKSBleGlzdGluZy5lcnJvcl9tZXNzYWdlID0gZXJyb3JNZXNzYWdlO1xuICAgICAgXG4gICAgICB0aGlzLmRhdGFTdG9yZS5zZXQoa2V5LCBleGlzdGluZyk7XG4gICAgICBhd2FpdCB0aGlzLnBlcnNpc3QoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog5pON5L2c44Ot44Kw44KS5Y+W5b6XXG4gICAqL1xuICBhc3luYyBnZXRPcGVyYXRpb25Mb2dzKGxpbWl0OiBudW1iZXIgPSAxMDApOiBQcm9taXNlPE9wZXJhdGlvbkxvZ01vZGVsW10+IHtcbiAgICB0aGlzLmNoZWNrSW5pdGlhbGl6ZWQoKTtcbiAgICBcbiAgICBjb25zdCByZXN1bHRzOiBPcGVyYXRpb25Mb2dNb2RlbFtdID0gW107XG4gICAgXG4gICAgdGhpcy5kYXRhU3RvcmUuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuICAgICAgaWYgKGtleS5zdGFydHNXaXRoKCdvcGVyYXRpb25fbG9nOicpKSB7XG4gICAgICAgIHJlc3VsdHMucHVzaChPcGVyYXRpb25Mb2dNb2RlbC5mcm9tT2JqZWN0KHZhbHVlKSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgXG4gICAgcmV0dXJuIHJlc3VsdHNcbiAgICAgIC5zb3J0KChhLCBiKSA9PiBiLnN0YXJ0ZWRBdC5nZXRUaW1lKCkgLSBhLnN0YXJ0ZWRBdC5nZXRUaW1lKCkpXG4gICAgICAuc2xpY2UoMCwgbGltaXQpO1xuICB9XG5cbiAgLyoqXG4gICAqIOODh+ODvOOCv+ODmeODvOOCueOBrue1seioiOaDheWgseOCkuWPluW+l1xuICAgKi9cbiAgYXN5bmMgZ2V0U3RhdGlzdGljcygpOiBQcm9taXNlPGFueT4ge1xuICAgIHRoaXMuY2hlY2tJbml0aWFsaXplZCgpO1xuICAgIFxuICAgIGNvbnN0IHN0YXRzID0ge1xuICAgICAgZmlsZUNvdW50OiAwLFxuICAgICAgc3luY1N0YXRlQ291bnQ6IDAsXG4gICAgICBiYWNrdXBDb3VudDogMCxcbiAgICAgIG9wZXJhdGlvbkxvZ0NvdW50OiAwXG4gICAgfTtcblxuICAgIHRoaXMuZGF0YVN0b3JlLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgIGlmIChrZXkuc3RhcnRzV2l0aCgnZmlsZV9tZXRhZGF0YTonKSkgc3RhdHMuZmlsZUNvdW50Kys7XG4gICAgICBlbHNlIGlmIChrZXkuc3RhcnRzV2l0aCgnc3luY19zdGF0ZTonKSkgc3RhdHMuc3luY1N0YXRlQ291bnQrKztcbiAgICAgIGVsc2UgaWYgKGtleS5zdGFydHNXaXRoKCdiYWNrdXBfaGlzdG9yeTonKSkgc3RhdHMuYmFja3VwQ291bnQrKztcbiAgICAgIGVsc2UgaWYgKGtleS5zdGFydHNXaXRoKCdvcGVyYXRpb25fbG9nOicpKSBzdGF0cy5vcGVyYXRpb25Mb2dDb3VudCsrO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHN0YXRzO1xuICB9XG59Il19