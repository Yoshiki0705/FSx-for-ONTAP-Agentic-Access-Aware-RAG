/**
 * CPOS Core Interfaces
 * システム全体で使用するインターフェース定義
 */

export interface IFileClassifier {
  classifyFile(filePath: string, content?: string): Promise<ClassificationResult>;
  updateRules(rules: ClassificationRule[]): Promise<void>;
  getConfidence(filePath: string): Promise<number>;
}

export interface ClassificationResult {
  category: string;
  subcategory?: string;
  confidence: number;
  suggestedPath: string;
  reasoning: string[];
}

export interface ClassificationRule {
  name: string;
  pattern: string;
  contentPatterns?: string[];
  targetPath: string;
  confidence: number;
  rules?: SubRule[];
}

export interface SubRule {
  contentPattern: string;
  targetPath: string;
}

export interface ISyncManager {
  detectChanges(source: Environment, target: Environment): Promise<SyncPlan>;
  executeSync(plan: SyncPlan): Promise<SyncResult>;
  resolveConflicts(conflicts: Conflict[]): Promise<Resolution[]>;
}

export interface SyncPlan {
  additions: FileOperation[];
  modifications: FileOperation[];
  deletions: FileOperation[];
  conflicts: Conflict[];
}

export interface SyncResult {
  success: boolean;
  processedFiles: number;
  errors: string[];
  summary: string;
}

export interface FileOperation {
  type: 'add' | 'modify' | 'delete';
  sourcePath: string;
  targetPath: string;
  size: number;
  checksum: string;
}

export interface Conflict {
  filePath: string;
  type: 'content' | 'timestamp' | 'permission';
  localVersion: FileMetadata;
  remoteVersion: FileMetadata;
}

export interface Resolution {
  conflictId: string;
  action: 'keep_local' | 'keep_remote' | 'merge' | 'manual';
  result: FileMetadata;
}

export interface IBackupManager {
  createBackup(type: BackupType, paths: string[]): Promise<BackupResult>;
  listBackups(filter?: BackupFilter): Promise<BackupInfo[]>;
  restoreBackup(backupId: string, targetPath?: string): Promise<RestoreResult>;
  verifyBackup(backupId: string): Promise<VerificationResult>;
}

export type BackupType = 'incremental' | 'full' | 'archive';

export interface BackupResult {
  backupId: string;
  type: BackupType;
  size: number;
  fileCount: number;
  duration: number;
  success: boolean;
  errors: string[];
}

export interface BackupInfo {
  id: string;
  type: BackupType;
  createdAt: Date;
  size: number;
  fileCount: number;
  status: 'completed' | 'failed' | 'in_progress';
}

export interface BackupFilter {
  type?: BackupType;
  dateFrom?: Date;
  dateTo?: Date;
  status?: 'completed' | 'failed' | 'in_progress';
}

export interface RestoreResult {
  success: boolean;
  restoredFiles: number;
  errors: string[];
  duration: number;
}

export interface VerificationResult {
  valid: boolean;
  checkedFiles: number;
  corruptedFiles: string[];
  missingFiles: string[];
}

export type Environment = 'local' | 'ec2';

export interface FileMetadata {
  path: string;
  size: number;
  created: Date;
  modified: Date;
  checksum: string;
  mimeType: string;
  category?: string;
  tags: string[];
  environment: Environment;
}

export interface ProjectStructure {
  version: string;
  directories: DirectoryRule[];
  fileTypes: FileTypeRule[];
  exclusions: string[];
  customRules: CustomRule[];
}

export interface DirectoryRule {
  path: string;
  purpose: string;
  required: boolean;
  permissions: string;
  maxSize?: number;
}

export interface FileTypeRule {
  extension: string;
  category: string;
  defaultPath: string;
  rules: string[];
}

export interface CustomRule {
  name: string;
  condition: string;
  action: string;
  priority: number;
}

export interface SyncState {
  lastSync: Date;
  localChecksum: string;
  remoteChecksum: string;
  conflicts: Conflict[];
  status: SyncStatus;
}

export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'error';

export interface OperationLog {
  id: string;
  operationType: string;
  status: 'started' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  details: Record<string, any>;
  errorMessage?: string;
}

export interface CPOSConfig {
  database: {
    path: string;
    encryption: boolean;
  };
  fileScanner: {
    watchPaths: string[];
    excludePatterns: string[];
    scanInterval: number;
    enableRealTimeWatch: boolean;
  };
  classification: {
    rules: string;
    confidence: number;
    autoApply: boolean;
  };
  sync: {
    enabled: boolean;
    interval: number;
    conflictResolution: 'manual' | 'auto';
  };
  backup: {
    enabled: boolean;
    schedule: string;
    retention: number;
  };
}