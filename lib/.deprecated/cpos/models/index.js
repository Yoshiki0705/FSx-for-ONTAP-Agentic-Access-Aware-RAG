"use strict";
/**
 * CPOS Data Models
 * データベースとアプリケーション間のデータモデル定義
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperationLogModel = exports.BackupHistoryModel = exports.SyncStateModel = exports.FileMetadataModel = void 0;
class FileMetadataModel {
    id;
    path;
    size;
    checksum;
    mimeType;
    category;
    createdAt;
    modifiedAt;
    environment;
    constructor(id, path = '', size = 0, checksum = '', mimeType = '', category, createdAt = new Date(), modifiedAt = new Date(), environment = 'local') {
        this.id = id;
        this.path = path;
        this.size = size;
        this.checksum = checksum;
        this.mimeType = mimeType;
        this.category = category;
        this.createdAt = createdAt;
        this.modifiedAt = modifiedAt;
        this.environment = environment;
    }
    static fromObject(obj) {
        return new FileMetadataModel(obj.id, obj.path, obj.size, obj.checksum, obj.mime_type, obj.category, new Date(obj.created_at), new Date(obj.modified_at), obj.environment);
    }
    toObject() {
        return {
            id: this.id,
            path: this.path,
            size: this.size,
            checksum: this.checksum,
            mime_type: this.mimeType,
            category: this.category,
            created_at: this.createdAt.toISOString(),
            modified_at: this.modifiedAt.toISOString(),
            environment: this.environment
        };
    }
}
exports.FileMetadataModel = FileMetadataModel;
class SyncStateModel {
    id;
    filePath;
    localChecksum;
    remoteChecksum;
    lastSync;
    status;
    conflicts;
    constructor(id, filePath = '', localChecksum, remoteChecksum, lastSync, status = 'pending', conflicts = '[]' // JSON string
    ) {
        this.id = id;
        this.filePath = filePath;
        this.localChecksum = localChecksum;
        this.remoteChecksum = remoteChecksum;
        this.lastSync = lastSync;
        this.status = status;
        this.conflicts = conflicts;
    }
    static fromObject(obj) {
        return new SyncStateModel(obj.id, obj.file_path, obj.local_checksum, obj.remote_checksum, obj.last_sync ? new Date(obj.last_sync) : undefined, obj.status, obj.conflicts || '[]');
    }
    toObject() {
        return {
            id: this.id,
            file_path: this.filePath,
            local_checksum: this.localChecksum,
            remote_checksum: this.remoteChecksum,
            last_sync: this.lastSync?.toISOString(),
            status: this.status,
            conflicts: this.conflicts
        };
    }
    getConflicts() {
        try {
            return JSON.parse(this.conflicts);
        }
        catch {
            return [];
        }
    }
    setConflicts(conflicts) {
        this.conflicts = JSON.stringify(conflicts);
    }
}
exports.SyncStateModel = SyncStateModel;
class BackupHistoryModel {
    id;
    backupId;
    type;
    createdAt;
    size;
    fileCount;
    status;
    metadata;
    constructor(id, backupId = '', type = 'incremental', createdAt = new Date(), size = 0, fileCount = 0, status = 'completed', metadata = '{}' // JSON string
    ) {
        this.id = id;
        this.backupId = backupId;
        this.type = type;
        this.createdAt = createdAt;
        this.size = size;
        this.fileCount = fileCount;
        this.status = status;
        this.metadata = metadata;
    }
    static fromObject(obj) {
        return new BackupHistoryModel(obj.id, obj.backup_id, obj.type, new Date(obj.created_at), obj.size, obj.file_count, obj.status, obj.metadata || '{}');
    }
    toObject() {
        return {
            id: this.id,
            backup_id: this.backupId,
            type: this.type,
            created_at: this.createdAt.toISOString(),
            size: this.size,
            file_count: this.fileCount,
            status: this.status,
            metadata: this.metadata
        };
    }
    getMetadata() {
        try {
            return JSON.parse(this.metadata);
        }
        catch {
            return {};
        }
    }
    setMetadata(metadata) {
        this.metadata = JSON.stringify(metadata);
    }
}
exports.BackupHistoryModel = BackupHistoryModel;
class OperationLogModel {
    id;
    operationType;
    status;
    startedAt;
    completedAt;
    details;
    errorMessage;
    constructor(id, operationType = '', status = 'started', startedAt = new Date(), completedAt, details = '{}', // JSON string
    errorMessage) {
        this.id = id;
        this.operationType = operationType;
        this.status = status;
        this.startedAt = startedAt;
        this.completedAt = completedAt;
        this.details = details;
        this.errorMessage = errorMessage;
    }
    static fromObject(obj) {
        return new OperationLogModel(obj.id, obj.operation_type, obj.status, new Date(obj.started_at), obj.completed_at ? new Date(obj.completed_at) : undefined, obj.details || '{}', obj.error_message);
    }
    toObject() {
        return {
            id: this.id,
            operation_type: this.operationType,
            status: this.status,
            started_at: this.startedAt.toISOString(),
            completed_at: this.completedAt?.toISOString(),
            details: this.details,
            error_message: this.errorMessage
        };
    }
    getDetails() {
        try {
            return JSON.parse(this.details);
        }
        catch {
            return {};
        }
    }
    setDetails(details) {
        this.details = JSON.stringify(details);
    }
}
exports.OperationLogModel = OperationLogModel;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7QUFJSCxNQUFhLGlCQUFpQjtJQUVuQjtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFUVCxZQUNTLEVBQVcsRUFDWCxPQUFlLEVBQUUsRUFDakIsT0FBZSxDQUFDLEVBQ2hCLFdBQW1CLEVBQUUsRUFDckIsV0FBbUIsRUFBRSxFQUNyQixRQUFpQixFQUNqQixZQUFrQixJQUFJLElBQUksRUFBRSxFQUM1QixhQUFtQixJQUFJLElBQUksRUFBRSxFQUM3QixjQUEyQixPQUFPO1FBUmxDLE9BQUUsR0FBRixFQUFFLENBQVM7UUFDWCxTQUFJLEdBQUosSUFBSSxDQUFhO1FBQ2pCLFNBQUksR0FBSixJQUFJLENBQVk7UUFDaEIsYUFBUSxHQUFSLFFBQVEsQ0FBYTtRQUNyQixhQUFRLEdBQVIsUUFBUSxDQUFhO1FBQ3JCLGFBQVEsR0FBUixRQUFRLENBQVM7UUFDakIsY0FBUyxHQUFULFNBQVMsQ0FBbUI7UUFDNUIsZUFBVSxHQUFWLFVBQVUsQ0FBbUI7UUFDN0IsZ0JBQVcsR0FBWCxXQUFXLENBQXVCO0lBQ3hDLENBQUM7SUFFSixNQUFNLENBQUMsVUFBVSxDQUFDLEdBQVE7UUFDeEIsT0FBTyxJQUFJLGlCQUFpQixDQUMxQixHQUFHLENBQUMsRUFBRSxFQUNOLEdBQUcsQ0FBQyxJQUFJLEVBQ1IsR0FBRyxDQUFDLElBQUksRUFDUixHQUFHLENBQUMsUUFBUSxFQUNaLEdBQUcsQ0FBQyxTQUFTLEVBQ2IsR0FBRyxDQUFDLFFBQVEsRUFDWixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEVBQ3hCLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsRUFDekIsR0FBRyxDQUFDLFdBQVcsQ0FDaEIsQ0FBQztJQUNKLENBQUM7SUFFRCxRQUFRO1FBQ04sT0FBTztZ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QUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRTtZQUN4QyxZQUFZLEVBQUUsSUFBSSxDQUFDLFdBQVcsRUFBRSxXQUFXLEVBQUU7WUFDN0MsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPO1lBQ3JCLGFBQWEsRUFBRSxJQUFJLENBQUMsWUFBWTtTQUNqQyxDQUFDO0lBQ0osQ0FBQztJQUVELFVBQVU7UUFDUixJQUFJLENBQUM7WUFDSCxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2xDLENBQUM7UUFBQyxNQUFNLENBQUM7WUFDUCxPQUFPLEVBQUUsQ0FBQztRQUNaLENBQUM7SUFDSCxDQUFDO0lBRUQsVUFBVSxDQUFDLE9BQVk7UUFDckIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3pDLENBQUM7Q0FDRjtBQTlDRCw4Q0E4Q0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENQT1MgRGF0YSBNb2RlbHNcbiAqIOODh+ODvOOCv+ODmeODvOOCueOBqOOCouODl+ODquOCseODvOOCt+ODp+ODs+mWk+OBruODh+ODvOOCv+ODouODh+ODq+Wumue+qVxuICovXG5cbmltcG9ydCB7IEVudmlyb25tZW50LCBCYWNrdXBUeXBlLCBTeW5jU3RhdHVzIH0gZnJvbSAnLi4vaW50ZXJmYWNlcyc7XG5cbmV4cG9ydCBjbGFzcyBGaWxlTWV0YWRhdGFNb2RlbCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHB1YmxpYyBpZD86IG51bWJlcixcbiAgICBwdWJsaWMgcGF0aDogc3RyaW5nID0gJycsXG4gICAgcHVibGljIHNpemU6IG51bWJlciA9IDAsXG4gICAgcHVibGljIGNoZWNrc3VtOiBzdHJpbmcgPSAnJyxcbiAgICBwdWJsaWMgbWltZVR5cGU6IHN0cmluZyA9ICcnLFxuICAgIHB1YmxpYyBjYXRlZ29yeT86IHN0cmluZyxcbiAgICBwdWJsaWMgY3JlYXRlZEF0OiBEYXRlID0gbmV3IERhdGUoKSxcbiAgICBwdWJsaWMgbW9kaWZpZWRBdDogRGF0ZSA9IG5ldyBEYXRlKCksXG4gICAgcHVibGljIGVudmlyb25tZW50OiBFbnZpcm9ubWVudCA9ICdsb2NhbCdcbiAgKSB7fVxuXG4gIHN0YXRpYyBmcm9tT2JqZWN0KG9iajogYW55KTogRmlsZU1ldGFkYXRhTW9kZWwge1xuICAgIHJldHVybiBuZXcgRmlsZU1ldGFkYXRhTW9kZWwoXG4gICAgICBvYmouaWQsXG4gICAgICBvYmoucGF0aCxcbiAgICAgIG9iai5zaXplLFxuICAgICAgb2JqLmNoZWNrc3VtLFxuICAgICAgb2JqLm1pbWVfdHlwZSxcbiAgICAgIG9iai5jYXRlZ29yeSxcbiAgICAgIG5ldyBEYXRlKG9iai5jcmVhdGVkX2F0KSxcbiAgICAgIG5ldyBEYXRlKG9iai5tb2RpZmllZF9hdCksXG4gICAgICBvYmouZW52aXJvbm1lbnRcbiAgICApO1xuICB9XG5cbiAgdG9PYmplY3QoKTogYW55IHtcbiAgICByZXR1cm4ge1xuICAgICAgaWQ6IHRoaXMuaWQsXG4gICAgICBwYXRoOiB0aGlzLnBhdGgsXG4gICAgICBzaXplOiB0aGlzLnNpemUsXG4gICAgICBjaGVja3N1bTogdGhpcy5jaGVja3N1bSxcbiAgICAgIG1pbWVfdHlwZTogdGhpcy5taW1lVHlwZSxcbiAgICAgIGNhdGVnb3J5OiB0aGlzLmNhdGVnb3J5LFxuICAgICAgY3JlYXRlZF9hdDogdGhpcy5jcmVhdGVkQXQudG9JU09TdHJpbmcoKSxcbiAgICAgIG1vZGlmaWVkX2F0OiB0aGlzLm1vZGlmaWVkQXQudG9JU09TdHJpbmcoKSxcbiAgICAgIGVudmlyb25tZW50OiB0aGlzLmVudmlyb25tZW50XG4gICAgfTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU3luY1N0YXRlTW9kZWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwdWJsaWMgaWQ/OiBudW1iZXIsXG4gICAgcHVibGljIGZpbGVQYXRoOiBzdHJpbmcgPSAnJyxcbiAgICBwdWJsaWMgbG9jYWxDaGVja3N1bT86IHN0cmluZyxcbiAgICBwdWJsaWMgcmVtb3RlQ2hlY2tzdW0/OiBzdHJpbmcsXG4gICAgcHVibGljIGxhc3RTeW5jPzogRGF0ZSxcbiAgICBwdWJsaWMgc3RhdHVzOiBTeW5jU3RhdHVzID0gJ3BlbmRpbmcnLFxuICAgIHB1YmxpYyBjb25mbGljdHM6IHN0cmluZyA9ICdbXScgLy8gSlNPTiBzdHJpbmdcbiAgKSB7fVxuXG4gIHN0YXRpYyBmcm9tT2JqZWN0KG9iajogYW55KTogU3luY1N0YXRlTW9kZWwge1xuICAgIHJldHVybiBuZXcgU3luY1N0YXRlTW9kZWwoXG4gICAgICBvYmouaWQsXG4gICAgICBvYmouZmlsZV9wYXRoLFxuICAgICAgb2JqLmxvY2FsX2NoZWNrc3VtLFxuICAgICAgb2JqLnJlbW90ZV9jaGVja3N1bSxcbiAgICAgIG9iai5sYXN0X3N5bmMgPyBuZXcgRGF0ZShvYmoubGFzdF9zeW5jKSA6IHVuZGVmaW5lZCxcbiAgICAgIG9iai5zdGF0dXMsXG4gICAgICBvYmouY29uZmxpY3RzIHx8ICdbXSdcbiAgICApO1xuICB9XG5cbiAgdG9PYmplY3QoKTogYW55IHtcbiAgICByZXR1cm4ge1xuICAgICAgaWQ6IHRoaXMuaWQsXG4gICAgICBmaWxlX3BhdGg6IHRoaXMuZmlsZVBhdGgsXG4gICAgICBsb2NhbF9jaGVja3N1bTogdGhpcy5sb2NhbENoZWNrc3VtLFxuICAgICAgcmVtb3RlX2NoZWNrc3VtOiB0aGlzLnJlbW90ZUNoZWNrc3VtLFxuICAgICAgbGFzdF9zeW5jOiB0aGlzLmxhc3RTeW5jPy50b0lTT1N0cmluZygpLFxuICAgICAgc3RhdHVzOiB0aGlzLnN0YXR1cyxcbiAgICAgIGNvbmZsaWN0czogdGhpcy5jb25mbGljdHNcbiAgICB9O1xuICB9XG5cbiAgZ2V0Q29uZmxpY3RzKCk6IGFueVtdIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIEpTT04ucGFyc2UodGhpcy5jb25mbGljdHMpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cbiAgfVxuXG4gIHNldENvbmZsaWN0cyhjb25mbGljdHM6IGFueVtdKTogdm9pZCB7XG4gICAgdGhpcy5jb25mbGljdHMgPSBKU09OLnN0cmluZ2lmeShjb25mbGljdHMpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBCYWNrdXBIaXN0b3J5TW9kZWwge1xuICBjb25zdHJ1Y3RvcihcbiAgICBwdWJsaWMgaWQ/OiBudW1iZXIsXG4gICAgcHVibGljIGJhY2t1cElkOiBzdHJpbmcgPSAnJyxcbiAgICBwdWJsaWMgdHlwZTogQmFja3VwVHlwZSA9ICdpbmNyZW1lbnRhbCcsXG4gICAgcHVibGljIGNyZWF0ZWRBdDogRGF0ZSA9IG5ldyBEYXRlKCksXG4gICAgcHVibGljIHNpemU6IG51bWJlciA9IDAsXG4gICAgcHVibGljIGZpbGVDb3VudDogbnVtYmVyID0gMCxcbiAgICBwdWJsaWMgc3RhdHVzOiBzdHJpbmcgPSAnY29tcGxldGVkJyxcbiAgICBwdWJsaWMgbWV0YWRhdGE6IHN0cmluZyA9ICd7fScgLy8gSlNPTiBzdHJpbmdcbiAgKSB7fVxuXG4gIHN0YXRpYyBmcm9tT2JqZWN0KG9iajogYW55KTogQmFja3VwSGlzdG9yeU1vZGVsIHtcbiAgICByZXR1cm4gbmV3IEJhY2t1cEhpc3RvcnlNb2RlbChcbiAgICAgIG9iai5pZCxcbiAgICAgIG9iai5iYWNrdXBfaWQsXG4gICAgICBvYmoudHlwZSxcbiAgICAgIG5ldyBEYXRlKG9iai5jcmVhdGVkX2F0KSxcbiAgICAgIG9iai5zaXplLFxuICAgICAgb2JqLmZpbGVfY291bnQsXG4gICAgICBvYmouc3RhdHVzLFxuICAgICAgb2JqLm1ldGFkYXRhIHx8ICd7fSdcbiAgICApO1xuICB9XG5cbiAgdG9PYmplY3QoKTogYW55IHtcbiAgICByZXR1cm4ge1xuICAgICAgaWQ6IHRoaXMuaWQsXG4gICAgICBiYWNrdXBfaWQ6IHRoaXMuYmFja3VwSWQsXG4gICAgICB0eXBlOiB0aGlzLnR5cGUsXG4gICAgICBjcmVhdGVkX2F0OiB0aGlzLmNyZWF0ZWRBdC50b0lTT1N0cmluZygpLFxuICAgICAgc2l6ZTogdGhpcy5zaXplLFxuICAgICAgZmlsZV9jb3VudDogdGhpcy5maWxlQ291bnQsXG4gICAgICBzdGF0dXM6IHRoaXMuc3RhdHVzLFxuICAgICAgbWV0YWRhdGE6IHRoaXMubWV0YWRhdGFcbiAgICB9O1xuICB9XG5cbiAgZ2V0TWV0YWRhdGEoKTogYW55IHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIEpTT04ucGFyc2UodGhpcy5tZXRhZGF0YSk7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4ge307XG4gICAgfVxuICB9XG5cbiAgc2V0TWV0YWRhdGEobWV0YWRhdGE6IGFueSk6IHZvaWQge1xuICAgIHRoaXMubWV0YWRhdGEgPSBKU09OLnN0cmluZ2lmeShtZXRhZGF0YSk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIE9wZXJhdGlvbkxvZ01vZGVsIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcHVibGljIGlkPzogbnVtYmVyLFxuICAgIHB1YmxpYyBvcGVyYXRpb25UeXBlOiBzdHJpbmcgPSAnJyxcbiAgICBwdWJsaWMgc3RhdHVzOiBzdHJpbmcgPSAnc3RhcnRlZCcsXG4gICAgcHVibGljIHN0YXJ0ZWRBdDogRGF0ZSA9IG5ldyBEYXRlKCksXG4gICAgcHVibGljIGNvbXBsZXRlZEF0PzogRGF0ZSxcbiAgICBwdWJsaWMgZGV0YWlsczogc3RyaW5nID0gJ3t9JywgLy8gSlNPTiBzdHJpbmdcbiAgICBwdWJsaWMgZXJyb3JNZXNzYWdlPzogc3RyaW5nXG4gICkge31cblxuICBzdGF0aWMgZnJvbU9iamVjdChvYmo6IGFueSk6IE9wZXJhdGlvbkxvZ01vZGVsIHtcbiAgICByZXR1cm4gbmV3IE9wZXJhdGlvbkxvZ01vZGVsKFxuICAgICAgb2JqLmlkLFxuICAgICAgb2JqLm9wZXJhdGlvbl90eXBlLFxuICAgICAgb2JqLnN0YXR1cyxcbiAgICAgIG5ldyBEYXRlKG9iai5zdGFydGVkX2F0KSxcbiAgICAgIG9iai5jb21wbGV0ZWRfYXQgPyBuZXcgRGF0ZShvYmouY29tcGxldGVkX2F0KSA6IHVuZGVmaW5lZCxcbiAgICAgIG9iai5kZXRhaWxzIHx8ICd7fScsXG4gICAgICBvYmouZXJyb3JfbWVzc2FnZVxuICAgICk7XG4gIH1cblxuICB0b09iamVjdCgpOiBhbnkge1xuICAgIHJldHVybiB7XG4gICAgICBpZDogdGhpcy5pZCxcbiAgICAgIG9wZXJhdGlvbl90eXBlOiB0aGlzLm9wZXJhdGlvblR5cGUsXG4gICAgICBzdGF0dXM6IHRoaXMuc3RhdHVzLFxuICAgICAgc3RhcnRlZF9hdDogdGhpcy5zdGFydGVkQXQudG9JU09TdHJpbmcoKSxcbiAgICAgIGNvbXBsZXRlZF9hdDogdGhpcy5jb21wbGV0ZWRBdD8udG9JU09TdHJpbmcoKSxcbiAgICAgIGRldGFpbHM6IHRoaXMuZGV0YWlscyxcbiAgICAgIGVycm9yX21lc3NhZ2U6IHRoaXMuZXJyb3JNZXNzYWdlXG4gICAgfTtcbiAgfVxuXG4gIGdldERldGFpbHMoKTogYW55IHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIEpTT04ucGFyc2UodGhpcy5kZXRhaWxzKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiB7fTtcbiAgICB9XG4gIH1cblxuICBzZXREZXRhaWxzKGRldGFpbHM6IGFueSk6IHZvaWQge1xuICAgIHRoaXMuZGV0YWlscyA9IEpTT04uc3RyaW5naWZ5KGRldGFpbHMpO1xuICB9XG59Il19