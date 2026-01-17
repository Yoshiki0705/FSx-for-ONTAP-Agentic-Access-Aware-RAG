/**
 * Cache Service
 * DynamoDBを使用した権限チェック結果のキャッシュ機能
 * 
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { CacheEntry, CacheConfig, CacheResult, DirectoryPermission } from './types';
import { getLogger } from './logger';

export class CacheService {
  private dynamoClient: DynamoDBDocumentClient;
  private config: CacheConfig;
  private logger = getLogger();

  constructor(config: CacheConfig) {
    this.config = config;
    
    const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
    this.dynamoClient = DynamoDBDocumentClient.from(client);
    
    console.log(`CacheService initialized: enabled=${config.enabled}, ttl=${config.ttlMinutes}min`);
  }

  /**
   * キャッシュキーを生成
   * Validates: Requirements 6.1
   */
  generateCacheKey(userId: string, path: string): string {
    // パスを正規化（大文字小文字、スラッシュの統一）
    let normalizedPath = path.toLowerCase().replace(/\\/g, '/');
    
    // 連続するスラッシュを1つに統一
    normalizedPath = normalizedPath.replace(/\/+/g, '/');
    
    const cacheKey = `${userId}:${normalizedPath}`;
    
    console.log(`キャッシュキー生成: ${cacheKey}`);
    return cacheKey;
  }

  /**
   * キャッシュから権限情報を取得
   * Validates: Requirements 6.3, 6.5
   */
  async getFromCache(userId: string, path: string): Promise<CacheResult<DirectoryPermission[]>> {
    if (!this.config.enabled) {
      console.log('キャッシュが無効です');
      return {
        success: false,
        fromCache: false,
        error: 'Cache disabled',
      };
    }

    const cacheKey = this.generateCacheKey(userId, path);
    console.log(`キャッシュ取得開始: ${cacheKey}`);

    try {
      const command = new GetCommand({
        TableName: this.config.tableName,
        Key: { cacheKey },
      });

      const result = await this.dynamoClient.send(command);

      if (!result.Item) {
        console.log('キャッシュエントリが見つかりません');
        this.logger.logCacheMiss(userId, path, 'Entry not found');
        return {
          success: false,
          fromCache: false,
          error: 'Cache miss',
        };
      }

      const entry = result.Item as CacheEntry;
      const currentTime = Math.floor(Date.now() / 1000);

      // TTLチェック（Requirements 6.5）
      if (entry.ttl <= currentTime) {
        console.log('キャッシュエントリが期限切れです');
        this.logger.logCacheMiss(userId, path, 'TTL expired');
        // 期限切れエントリを削除
        await this.deleteFromCache(userId, path);
        return {
          success: false,
          fromCache: false,
          error: 'Cache expired',
        };
      }

      console.log(`キャッシュヒット: ${entry.permissions.length}個の権限情報`);
      this.logger.logCacheHit(userId, path, { permissionCount: entry.permissions.length });
      return {
        success: true,
        data: entry.permissions,
        fromCache: true,
      };
    } catch (error) {
      console.error('キャッシュ取得エラー:', error);
      return {
        success: false,
        fromCache: false,
        error: `Cache get error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 権限情報をキャッシュに保存
   * Validates: Requirements 6.2
   */
  async saveToCache(
    userId: string,
    path: string,
    permissions: DirectoryPermission[],
    source: 'ontap-api' | 'ssm-powershell'
  ): Promise<CacheResult<void>> {
    if (!this.config.enabled) {
      console.log('キャッシュが無効です');
      return {
        success: false,
        fromCache: false,
        error: 'Cache disabled',
      };
    }

    const cacheKey = this.generateCacheKey(userId, path);
    const currentTime = Math.floor(Date.now() / 1000);
    const ttl = currentTime + (this.config.ttlMinutes * 60);

    console.log(`キャッシュ保存開始: ${cacheKey}, TTL=${this.config.ttlMinutes}分`);

    const entry: CacheEntry = {
      cacheKey,
      userId,
      path,
      permissions,
      timestamp: currentTime,
      ttl,
      source,
    };

    try {
      const command = new PutCommand({
        TableName: this.config.tableName,
        Item: entry,
      });

      await this.dynamoClient.send(command);

      console.log(`キャッシュ保存完了: ${permissions.length}個の権限情報`);
      this.logger.logCacheSave(userId, path, ttl, {
        permissionCount: permissions.length,
        source,
      });
      return {
        success: true,
        fromCache: false,
      };
    } catch (error) {
      console.error('キャッシュ保存エラー:', error);
      return {
        success: false,
        fromCache: false,
        error: `Cache save error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * キャッシュエントリを削除
   * Validates: Requirements 6.4
   */
  async deleteFromCache(userId: string, path: string): Promise<CacheResult<void>> {
    if (!this.config.enabled) {
      return {
        success: false,
        fromCache: false,
        error: 'Cache disabled',
      };
    }

    const cacheKey = this.generateCacheKey(userId, path);
    console.log(`キャッシュ削除開始: ${cacheKey}`);

    try {
      const command = new DeleteCommand({
        TableName: this.config.tableName,
        Key: { cacheKey },
      });

      await this.dynamoClient.send(command);

      console.log('キャッシュ削除完了');
      this.logger.logCacheDelete(userId, path);
      return {
        success: true,
        fromCache: false,
      };
    } catch (error) {
      console.error('キャッシュ削除エラー:', error);
      return {
        success: false,
        fromCache: false,
        error: `Cache delete error: ${(error as Error).message}`,
      };
    }
  }

  /**
   * キャッシュの統計情報を取得（デバッグ用）
   */
  getCacheStats(): { enabled: boolean; ttlMinutes: number; tableName: string } {
    return {
      enabled: this.config.enabled,
      ttlMinutes: this.config.ttlMinutes,
      tableName: this.config.tableName,
    };
  }

  /**
   * キャッシュ設定を更新
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('キャッシュ設定を更新しました:', this.config);
  }
}

/**
 * デフォルトキャッシュ設定
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  enabled: true,
  ttlMinutes: 5,
  tableName: process.env.PERMISSION_CACHE_TABLE || 'permission-cache',
};

/**
 * キャッシュサービスのシングルトンインスタンス
 */
let cacheServiceInstance: CacheService | null = null;

/**
 * キャッシュサービスインスタンスを取得
 */
export function getCacheService(config?: CacheConfig): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService(config || DEFAULT_CACHE_CONFIG);
  }
  return cacheServiceInstance;
}
