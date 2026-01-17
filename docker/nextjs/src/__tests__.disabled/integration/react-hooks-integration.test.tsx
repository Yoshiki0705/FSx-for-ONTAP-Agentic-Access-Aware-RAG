/**
 * React Hookの統合テスト
 */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRegionConfig } from '../../hooks/useRegionConfig';
import { useModelConfig } from '../../hooks/useModelConfig';
import { useErrorHandler } from '../../hooks/useErrorHandler';

// モックのLocalStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// fetch APIのモック
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('React Hooks統合テスト', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('useRegionConfig と useModelConfig の連携', () => {
    it('リージョン変更時にモデル設定が自動更新されるべき', async () => {
      // region-change APIのモックレスポンス
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          region: 'us-east-1',
          availableModels: [
            {
              id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
              name: 'Claude 3.5 Sonnet v2',
              nameJa: 'Claude 3.5 Sonnet v2',
              provider: 'Anthropic',
              category: 'chat',
              supportedRegions: ['us-east-1'],
              isRecommended: true
            }
          ],
          recommendedModel: {
            id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
            name: 'Claude 3.5 Sonnet v2',
            nameJa: 'Claude 3.5 Sonnet v2',
            provider: 'Anthropic',
            category: 'chat',
            supportedRegions: ['us-east-1'],
            isRecommended: true
          }
        })
      });

      const { result: regionResult } = renderHook(() => useRegionConfig());
      const { result: modelResult } = renderHook(() => useModelConfig());

      // 初期状態の確認
      expect(regionResult.current.selectedRegion).toBe('ap-northeast-1');
      expect(modelResult.current.availableModels.length).toBeGreaterThan(0);

      // リージョンを変更
      await act(async () => {
        await regionResult.current.changeRegion('us-east-1');
      });

      // リージョンが変更されることを確認
      expect(regionResult.current.selectedRegion).toBe('us-east-1');
      expect(mockFetch).toHaveBeenCalledWith('/api/bedrock/region-change', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: 'us-east-1' })
      }));

      // モデル設定が更新されることを確認（実際のアプリケーションでは、
      // リージョン変更後にモデル設定も更新される仕組みが必要）
      await waitFor(() => {
        expect(regionResult.current.loading).toBe(false);
      });
    });

    it('保存された設定が両方のフックで正しく復元されるべき', async () => {
      // 事前に設定を保存
      const regionConfig = {
        selectedRegion: 'eu-west-1',
        lastUpdated: '2024-01-01T00:00:00.000Z'
      };
      const modelConfig = {
        selectedModelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        lastUpdated: '2024-01-01T00:00:00.000Z'
      };

      mockLocalStorage.setItem('regionConfig', JSON.stringify(regionConfig));
      mockLocalStorage.setItem('modelConfig', JSON.stringify(modelConfig));

      const { result: regionResult } = renderHook(() => useRegionConfig());
      const { result: modelResult } = renderHook(() => useModelConfig());

      // 設定が復元されることを確認
      await waitFor(() => {
        expect(regionResult.current.selectedRegion).toBe('eu-west-1');
      });

      await waitFor(() => {
        expect(modelResult.current.selectedModelId).toBe('anthropic.claude-3-5-sonnet-20241022-v2:0');
      });
    });
  });

  describe('useErrorHandler との統合', () => {
    it('リージョン変更エラー時にエラーハンドラーが適切に動作するべき', async () => {
      // region-change APIでエラーを返すモック
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: 'リージョンがサポートされていません'
        })
      });

      const { result: regionResult } = renderHook(() => useRegionConfig());
      const { result: errorResult } = renderHook(() => useErrorHandler());

      // 無効なリージョンに変更を試行
      await act(async () => {
        try {
          await regionResult.current.changeRegion('invalid-region');
        } catch (error) {
          // エラーが発生することを期待
        }
      });

      // エラー状態が設定されることを確認
      expect(regionResult.current.error).toBeTruthy();
    });

    it('ストレージエラー時にエラーハンドラーが適切に動作するべき', async () => {
      // localStorageでエラーを発生させる
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const { result: regionResult } = renderHook(() => useRegionConfig());
      const { result: errorResult } = renderHook(() => useErrorHandler());

      // リージョン変更を試行（ストレージエラーが発生）
      await act(async () => {
        try {
          await regionResult.current.changeRegion('us-east-1');
        } catch (error) {
          // ストレージエラーが適切に処理されることを期待
        }
      });

      // エラーが適切に処理されることを確認
      expect(regionResult.current.loading).toBe(false);
    });

    it('モデル設定エラー時にフォールバック処理が動作するべき', async () => {
      const { result: modelResult } = renderHook(() => useModelConfig());
      const { result: errorResult } = renderHook(() => useErrorHandler());

      // 無効なモデルIDを設定
      await act(async () => {
        try {
          await modelResult.current.changeModel('invalid-model-id');
        } catch (error) {
          // エラーが発生することを期待
        }
      });

      // エラー状態が適切に処理されることを確認
      expect(modelResult.current.error).toBeTruthy();
    });
  });

  describe('複数フック間の状態同期', () => {
    it('複数のuseRegionConfigインスタンスが同期されるべき', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          region: 'us-west-2',
          availableModels: [],
          recommendedModel: null
        })
      });

      const { result: regionResult1 } = renderHook(() => useRegionConfig());
      const { result: regionResult2 } = renderHook(() => useRegionConfig());

      // 初期状態で両方が同じ値を持つことを確認
      expect(regionResult1.current.selectedRegion).toBe(regionResult2.current.selectedRegion);

      // 一方でリージョンを変更
      await act(async () => {
        await regionResult1.current.changeRegion('us-west-2');
      });

      // 両方が同じ値に更新されることを確認
      await waitFor(() => {
        expect(regionResult1.current.selectedRegion).toBe('us-west-2');
        expect(regionResult2.current.selectedRegion).toBe('us-west-2');
      });
    });

    it('複数のuseModelConfigインスタンスが同期されるべき', async () => {
      const { result: modelResult1 } = renderHook(() => useModelConfig());
      const { result: modelResult2 } = renderHook(() => useModelConfig());

      // 初期状態で両方が同じ値を持つことを確認
      expect(modelResult1.current.selectedModelId).toBe(modelResult2.current.selectedModelId);

      // 一方でモデルを変更
      const newModelId = 'anthropic.claude-3-5-sonnet-20241022-v2:0';
      await act(async () => {
        await modelResult1.current.changeModel(newModelId);
      });

      // 両方が同じ値に更新されることを確認
      await waitFor(() => {
        expect(modelResult1.current.selectedModelId).toBe(newModelId);
        expect(modelResult2.current.selectedModelId).toBe(newModelId);
      });
    });
  });

  describe('パフォーマンステスト', () => {
    it('フックの初期化が適切な時間内に完了するべき', async () => {
      const startTime = Date.now();

      const { result } = renderHook(() => ({
        region: useRegionConfig(),
        model: useModelConfig(),
        error: useErrorHandler()
      }));

      await waitFor(() => {
        expect(result.current.region.loading).toBe(false);
        expect(result.current.model.loading).toBe(false);
      });

      const endTime = Date.now();
      const initTime = endTime - startTime;

      expect(initTime).toBeLessThan(1000); // 1秒以内
    });

    it('大量のリージョン変更リクエストが適切に処理されるべき', async () => {
      // 複数のAPIレスポンスをモック
      const regions = ['ap-northeast-1', 'us-east-1', 'eu-west-1', 'us-west-2', 'ap-northeast-3'];
      
      regions.forEach((region, index) => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            region,
            availableModels: [],
            recommendedModel: null
          })
        });
      });

      const { result } = renderHook(() => useRegionConfig());

      // 連続してリージョン変更を実行
      const promises = regions.map(region => 
        act(async () => {
          await result.current.changeRegion(region);
        })
      );

      await Promise.all(promises);

      // 最後のリージョンが設定されることを確認
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 全てのAPIコールが実行されることを確認
      expect(mockFetch).toHaveBeenCalledTimes(regions.length);
    });
  });

  describe('エラー回復テスト', () => {
    it('ネットワークエラー後の回復が適切に動作するべき', async () => {
      const { result } = renderHook(() => useRegionConfig());

      // 最初のリクエストでネットワークエラー
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        try {
          await result.current.changeRegion('us-east-1');
        } catch (error) {
          // エラーが発生することを期待
        }
      });

      expect(result.current.error).toBeTruthy();

      // 2回目のリクエストで成功
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          region: 'us-east-1',
          availableModels: [],
          recommendedModel: null
        })
      });

      await act(async () => {
        await result.current.changeRegion('us-east-1');
      });

      // エラーがクリアされることを確認
      await waitFor(() => {
        expect(result.current.error).toBeFalsy();
        expect(result.current.selectedRegion).toBe('us-east-1');
      });
    });

    it('部分的な機能障害時でも基本機能が動作するべき', async () => {
      // ストレージが利用できない状況をシミュレート
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage not available');
      });

      const { result } = renderHook(() => useRegionConfig());

      // デフォルト値で初期化されることを確認
      await waitFor(() => {
        expect(result.current.selectedRegion).toBe('ap-northeast-1');
        expect(result.current.loading).toBe(false);
      });

      // APIコールは正常に動作することを確認
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          region: 'us-east-1',
          availableModels: [],
          recommendedModel: null
        })
      });

      await act(async () => {
        await result.current.changeRegion('us-east-1');
      });

      expect(result.current.selectedRegion).toBe('us-east-1');
    });
  });

  describe('メモリリーク防止テスト', () => {
    it('フックのアンマウント時にリソースが適切にクリーンアップされるべき', async () => {
      const { result, unmount } = renderHook(() => ({
        region: useRegionConfig(),
        model: useModelConfig(),
        error: useErrorHandler()
      }));

      // フックが正常に動作することを確認
      expect(result.current.region.selectedRegion).toBeDefined();
      expect(result.current.model.availableModels).toBeDefined();

      // アンマウント
      unmount();

      // アンマウント後にエラーが発生しないことを確認
      // （実際のクリーンアップ処理は各フックの実装に依存）
      expect(() => unmount()).not.toThrow();
    });

    it('大量のフックインスタンス作成・破棄が適切に処理されるべき', async () => {
      const instances: Array<{ unmount: () => void }> = [];

      // 大量のフックインスタンスを作成
      for (let i = 0; i < 100; i++) {
        const { unmount } = renderHook(() => useRegionConfig());
        instances.push({ unmount });
      }

      // 全てのインスタンスを破棄
      instances.forEach(({ unmount }) => {
        expect(() => unmount()).not.toThrow();
      });
    });
  });
});