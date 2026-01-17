/**
 * CPOS Data Models
 * データベースとアプリケーション間のデータモデル定義
 */
import { Environment, BackupType, SyncStatus } from '../interfaces';
export declare class FileMetadataModel {
    id?: number;
    path: string;
    size: number;
    checksum: string;
    mimeType: string;
    category?: string;
    createdAt: Date;
    modifiedAt: Date;
    environment: Environment;
    constructor(id?: number, path?: string, size?: number, checksum?: string, mimeType?: string, category?: string, createdAt?: Date, modifiedAt?: Date, environment?: Environment);
    static fromObject(obj: any): FileMetadataModel;
    toObject(): any;
}
export declare class SyncStateModel {
    id?: number;
    filePath: string;
    localChecksum?: string;
    remoteChecksum?: string;
    lastSync?: Date;
    status: SyncStatus;
    conflicts: string;
    constructor(id?: number, filePath?: string, localChecksum?: string, remoteChecksum?: string, lastSync?: Date, status?: SyncStatus, conflicts?: string);
    static fromObject(obj: any): SyncStateModel;
    toObject(): any;
    getConflicts(): any[];
    setConflicts(conflicts: any[]): void;
}
export declare class BackupHistoryModel {
    id?: number;
    backupId: string;
    type: BackupType;
    createdAt: Date;
    size: number;
    fileCount: number;
    status: string;
    metadata: string;
    constructor(id?: number, backupId?: string, type?: BackupType, createdAt?: Date, size?: number, fileCount?: number, status?: string, metadata?: string);
    static fromObject(obj: any): BackupHistoryModel;
    toObject(): any;
    getMetadata(): any;
    setMetadata(metadata: any): void;
}
export declare class OperationLogModel {
    id?: number;
    operationType: string;
    status: string;
    startedAt: Date;
    completedAt?: Date;
    details: string;
    errorMessage?: string;
    constructor(id?: number, operationType?: string, status?: string, startedAt?: Date, completedAt?: Date, details?: string, // JSON string
    errorMessage?: string);
    static fromObject(obj: any): OperationLogModel;
    toObject(): any;
    getDetails(): any;
    setDetails(details: any): void;
}
