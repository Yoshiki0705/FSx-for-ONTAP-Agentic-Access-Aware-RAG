/**
 * メッセージキューイングシステム
 * オフライン時のメッセージをIndexedDBに保存し、オンライン復旧時に自動送信
 */

const DB_NAME = 'rag-chatbot-db';
const DB_VERSION = 1;
const STORE_NAME = 'messages';

export interface QueuedMessage {
  id?: number;
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

/**
 * IndexedDBを開く
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * メッセージをキューに追加
 */
export async function queueMessage(data: any): Promise<number> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const message: QueuedMessage = {
      data,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
    };

    const request = store.add(message);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as number);
  });
}

/**
 * キューからメッセージを取得
 */
export async function getQueuedMessages(): Promise<QueuedMessage[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * メッセージをキューから削除
 */
export async function deleteQueuedMessage(id: number): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * メッセージのリトライカウントを更新
 */
export async function updateRetryCount(id: number): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onerror = () => reject(getRequest.error);
    getRequest.onsuccess = () => {
      const message = getRequest.result as QueuedMessage;
      if (message) {
        message.retryCount += 1;
        const updateRequest = store.put(message);
        updateRequest.onerror = () => reject(updateRequest.error);
        updateRequest.onsuccess = () => resolve();
      } else {
        resolve();
      }
    };
  });
}

/**
 * キューをクリア
 */
export async function clearQueue(): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * キュー内のメッセージ数を取得
 */
export async function getQueueCount(): Promise<number> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * キューイングされたメッセージを送信
 */
export async function processQueue(): Promise<{
  success: number;
  failed: number;
  errors: Array<{ id: number; error: string }>;
}> {
  const messages = await getQueuedMessages();
  let success = 0;
  let failed = 0;
  const errors: Array<{ id: number; error: string }> = [];

  for (const message of messages) {
    if (!message.id) continue;

    // 最大リトライ回数を超えた場合はスキップ
    if (message.retryCount >= message.maxRetries) {
      await deleteQueuedMessage(message.id);
      failed++;
      errors.push({
        id: message.id,
        error: '最大リトライ回数を超えました',
      });
      continue;
    }

    try {
      // メッセージを送信
      const response = await fetch('/api/bedrock/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message.data),
      });

      if (response.ok) {
        // 送信成功
        await deleteQueuedMessage(message.id);
        success++;
      } else {
        // 送信失敗 - リトライカウントを更新
        await updateRetryCount(message.id);
        failed++;
        errors.push({
          id: message.id,
          error: `HTTPエラー: ${response.status}`,
        });
      }
    } catch (error) {
      // ネットワークエラー - リトライカウントを更新
      await updateRetryCount(message.id);
      failed++;
      errors.push({
        id: message.id,
        error: error instanceof Error ? error.message : '不明なエラー',
      });
    }
  }

  return { success, failed, errors };
}

/**
 * バックグラウンド同期を登録
 */
export async function registerBackgroundSync(): Promise<void> {
  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    try {
      const registration = await navigator.serviceWorker.ready;
      // Background Sync APIが利用可能な場合のみ実行
      if ('sync' in registration) {
        await (registration as any).sync.register('sync-messages');
      }
    } catch (error) {
      console.error('バックグラウンド同期の登録に失敗:', error);
    }
  }
}
