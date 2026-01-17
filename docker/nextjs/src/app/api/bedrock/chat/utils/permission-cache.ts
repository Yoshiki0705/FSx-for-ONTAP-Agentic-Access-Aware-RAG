/**
 * 権限チェック結果キャッシュユーティリティ
 * 
 * パフォーマンス向上のため、権限チェック結果を一定時間キャッシュ
 */

interface CacheEntry {
  result: any;
  timestamp: number;
  ttl: number;
}

class PermissionCache {
  private cache = new Map<string, CacheEntry>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5分

  /**
   * キャッシュキーの生成
   */
  private generateKey(userId: string, ipAddress: string, resource: string): string {
    return `${userId}:${ipAddress}:${resource}`;
  }

  /**
   * キャッシュから権限チェック結果を取得
   */
  get(userId: string, ipAddress: string, resource: string): any | null {
    const key = this.generateKey(userId, ipAddress, resource);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      // TTL期限切れ
      this.cache.delete(key);
      return null;
    }

    console.log(`🚀 権限チェック結果をキャッシュから取得: ${key}`);
    return entry.result;
  }

  /**
   * 権限チェック結果をキャッシュに保存
   */
  set(userId: string, ipAddress: string, resource: string, result: any, ttl?: number): void {
    const key = this.generateKey(userId, ipAddress, resource);
    const entry: CacheEntry = {
      result,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    };

    this.cache.set(key, entry);
    console.log(`💾 権限チェック結果をキャッシュに保存: ${key} (TTL: ${entry.ttl}ms)`);
  }

  /**
   * 特定ユーザーのキャッシュを無効化
   */
  invalidateUser(userId: string): void {
    const keysToDelete: string[] = [];
    
    for (const [key] of this.cache) {
      if (key.startsWith(`${userId}:`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    console.log(`🗑️ ユーザー ${userId} のキャッシュを無効化: ${keysToDelete.length} 件`);
  }

  /**
   * 期限切れキャッシュエントリの削除
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now > entry.timestamp + entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`🧹 期限切れキャッシュエントリを削除: ${keysToDelete.length} 件`);
    }
  }

  /**
   * 全キャッシュのクリア
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🗑️ 全キャッシュをクリア: ${size} 件`);
  }

  /**
   * キャッシュ統計情報の取得
   */
  getStats(): { size: number; entries: Array<{ key: string; age: number; ttl: number }> } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: now - entry.timestamp,
      ttl: entry.ttl
    }));

    return {
      size: this.cache.size,
      entries
    };
  }
}

// シングルトンインスタンス
export const permissionCache = new PermissionCache();

// 定期的なクリーンアップ（10分間隔）
if (typeof window === 'undefined') { // サーバーサイドでのみ実行
  setInterval(() => {
    permissionCache.cleanup();
  }, 10 * 60 * 1000);
}