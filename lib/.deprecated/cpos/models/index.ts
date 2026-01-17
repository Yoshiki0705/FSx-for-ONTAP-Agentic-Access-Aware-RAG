/**
 * CPOS Data Models
 * データベースとアプリケーション間のデータモデル定義
 */

import { Environment, BackupType, SyncStatus } from '../interfaces';

export class FileMetadataModel {
  constructor(
    public id?: number,
    public path: string = '',
    public size: number = 0,
    public checksum: string = '',
    public mimeType: string = '',
    public category?: string,
    public createdAt: Date = new Date(),
    public modifiedAt: Date = new Date(),
    public environment: Environment = 'local'
  ) {}

  static fromObject(obj: any): FileMetadataModel {
    return new FileMetadataModel(
      obj.id,
      obj.path,
      obj.size,
      obj.checksum,
      obj.mime_type,
      obj.category,
      new Date(obj.created_at),
      new Date(obj.modified_at),
      obj.environment
    );
  }

  toObject(): any {
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

export class SyncStateModel {
  constructor(
    public id?: number,
    public filePath: string = '',
    public localChecksum?: string,
    public remoteChecksum?: string,
    public lastSync?: Date,
    public status: SyncStatus = 'pending',
    public conflicts: string = '[]' // JSON string
  ) {}

  static fromObject(obj: any): SyncStateModel {
    return new SyncStateModel(
      obj.id,
      obj.file_path,
      obj.local_checksum,
      obj.remote_checksum,
      obj.last_sync ? new Date(obj.last_sync) : undefined,
      obj.status,
      obj.conflicts || '[]'
    );
  }

  toObject(): any {
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

  getConflicts(): any[] {
    try {
      return JSON.parse(this.conflicts);
    } catch {
      return [];
    }
  }

  setConflicts(conflicts: any[]): void {
    this.conflicts = JSON.stringify(conflicts);
  }
}

export class BackupHistoryModel {
  constructor(
    public id?: number,
    public backupId: string = '',
    public type: BackupType = 'incremental',
    public createdAt: Date = new Date(),
    public size: number = 0,
    public fileCount: number = 0,
    public status: string = 'completed',
    public metadata: string = '{}' // JSON string
  ) {}

  static fromObject(obj: any): BackupHistoryModel {
    return new BackupHistoryModel(
      obj.id,
      obj.backup_id,
      obj.type,
      new Date(obj.created_at),
      obj.size,
      obj.file_count,
      obj.status,
      obj.metadata || '{}'
    );
  }

  toObject(): any {
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

  getMetadata(): any {
    try {
      return JSON.parse(this.metadata);
    } catch {
      return {};
    }
  }

  setMetadata(metadata: any): void {
    this.metadata = JSON.stringify(metadata);
  }
}

export class OperationLogModel {
  constructor(
    public id?: number,
    public operationType: string = '',
    public status: string = 'started',
    public startedAt: Date = new Date(),
    public completedAt?: Date,
    public details: string = '{}', // JSON string
    public errorMessage?: string
  ) {}

  static fromObject(obj: any): OperationLogModel {
    return new OperationLogModel(
      obj.id,
      obj.operation_type,
      obj.status,
      new Date(obj.started_at),
      obj.completed_at ? new Date(obj.completed_at) : undefined,
      obj.details || '{}',
      obj.error_message
    );
  }

  toObject(): any {
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

  getDetails(): any {
    try {
      return JSON.parse(this.details);
    } catch {
      return {};
    }
  }

  setDetails(details: any): void {
    this.details = JSON.stringify(details);
  }
}