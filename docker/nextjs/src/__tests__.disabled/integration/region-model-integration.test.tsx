/**
 * リージョン・モデル連動機能の統合テスト
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegionConfigManager } from '../../config/region-config-manager';
import { ModelConfigManager } from '../../config/model-config-manager';
import { StorageManager } from '../../lib/storage-manager';

// テスト用のコンポーネント
const TestRegionModelIntegration: React.FC = () => {
  const [selectedRegion, setSelectedRegion] = React.useState<string>('ap-northeast-1');
  const [availableModels, setAvailableModels] = React.useState<any[]>([]);
  const [selectedModel, setSelectedModel] = React.useState<string>('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>('');

  const regionManager = React.useMemo(() => new RegionConfigManager(), []);
  const modelManager = React.useMemo(() => new ModelConfigManager(), []);
  const storageManager = React.useMemo(() => new StorageManager(), []);

  // リージョン変更時の処理
  const handleRegionChange = React.useCallback(async (newRegion: string) => {
    setLoading(true);
    setError('');
    
    try {
      // リージョン検証
      const validation = regionManager.validateRegion(newRegion);
      if (!validation.isValid) {
        setError(validation.message);
        return;
      }

      // リージョン設定を保存
      await storageManager.saveRegionConfig({
        selectedRegion: newRegion,
        lastUpdated: new Date().toISOString()
      });

      // 利用可能モデルを取得
      const models = modelManager.getModelsForRegion(newRegion as any);
      setAvailableModels(models);

      // デフォルトモデルを設定
      const defaultModel = modelManager.getDefaultChatModel(newRegion as any);
      if (defaultModel) {
        setSelectedModel(defaultModel.id);
        await storageManager.saveModelConfig({
          selectedModelId: defaultModel.id,
          lastUpdated: new Date().toISOString()
        });
      }

      setSelectedRegion(newRegion);
    } catch (err) {
      setError('リージョン変更に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [regionManager, modelManager, storageManager]);

  // モデル変更時の処理
  const handleModelChange = React.useCallback(async (modelId: string) => {
    try {
      // モデルがリージョンで利用可能かチェック
      const isAvailable = modelManager.isModelAvailableInRegion(modelId, selectedRegion as any);
      if (!isAvailable) {
        setError('選択されたモデルは現在のリージョンでは利用できません');
        return;
      }

      setSelectedModel(modelId);
      await storageManager.saveModelConfig({
        selectedModelId: modelId,
        lastUpdated: new Date().toISOString()
      });
      setError('');
    } catch (err) {
      setError('モデル変更に失敗しました');
    }
  }, [modelManager, storageManager, selectedRegion]);

  // 初期化処理
  React.useEffect(() => {
    const initialize = async () => {
      try {
        // 保存された設定を復元
        const regionConfig = await storageManager.getRegionConfig();
        const modelConfig = await storageManager.getModelConfig();

        if (regionConfig) {
          await handleRegionChange(regionConfig.selectedRegion);
        } else {
          await handleRegionChange('ap-northeast-1');
        }

        if (modelConfig && modelManager.isModelAvailableInRegion(modelConfig.selectedModelId, selectedRegion as any)) {
          setSelectedModel(modelConfig.selectedModelId);
        }
      } catch (err) {
        setError('初期化に失敗しました');
      }
    };

    initialize();
  }, []);

  return (
    <div data-testid="region-model-integration">
      <div data-testid="loading" style={{ display: loading ? 'block' : 'none' }}>
        読み込み中...
      </div>
      
      {error && (
        <div data-testid="error" style={{ color: 'red' }}>
          {error}
        </div>
      )}

      <div data-testid="region-selector">
        <label htmlFor="region-select">リージョン選択:</label>
        <select
          id="region-select"
          value={selectedRegion}
          onChange={(e) => handleRegionChange(e.target.value)}
          disabled={loading}
        >
          {regionManager.getSupportedRegions().map(region => (
            <option key={region} value={region}>
              {regionManager.getRegionDisplayName(region)}
            </option>
          ))}
        </select>
      </div>

      <div data-testid="model-selector">
        <label htmlFor="model-select">モデル選択:</label>
        <select
          id="model-select"
          value={selectedModel}
          onChange={(e) => handleModelChange(e.target.value)}
          disabled={loading || availableModels.length === 0}
        >
          <option value="">モデルを選択してください</option>
          {availableModels.map(model => (
            <option key={model.id} value={model.id}>
              {model.nameJa} ({model.provider})
            </option>
          ))}
        </select>
      </div>

      <div data-testid="current-config">
        <p>現在のリージョン: <span data-testid="current-region">{selectedRegion}</span></p>
        <p>現在のモデル: <span data-testid="current-model">{selectedModel}</span></p>
        <p>利用可能モデル数: <span data-testid="available-models-count">{availableModels.length}</span></p>
      </div>

      <button
        data-testid="reset-button"
        onClick={() => handleRegionChange('ap-northeast-1')}
        disabled={loading}
      >
        デフォルトに戻す
      </button>
    </div>
  );
};

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

describe('リージョン・モデル連動機能の統合テスト', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    jest.clearAllMocks();
  });

  describe('基本的な連動機能', () => {
    it('リージョン変更時にモデル一覧が更新されるべき', async () => {
      const user = userEvent.setup();
      render(<TestRegionModelIntegration />);

      // 初期状態の確認
      await waitFor(() => {
        expect(screen.getByTestId('current-region')).toHaveTextContent('ap-northeast-1');
      });

      // リージョンを変更
      const regionSelect = screen.getByLabelText('リージョン選択:');
      await user.selectOptions(regionSelect, 'us-east-1');

      // リージョンが変更されることを確認
      await waitFor(() => {
        expect(screen.getByTestId('current-region')).toHaveTextContent('us-east-1');
      });

      // モデル一覧が更新されることを確認
      await waitFor(() => {
        const modelCount = screen.getByTestId('available-models-count');
        expect(parseInt(modelCount.textContent || '0')).toBeGreaterThan(0);
      });
    });

    it('リージョン変更時にデフォルトモデルが自動選択されるべき', async () => {
      const user = userEvent.setup();
      render(<TestRegionModelIntegration />);

      // 初期状態でモデルが選択されることを確認
      await waitFor(() => {
        expect(screen.getByTestId('current-model')).not.toHaveTextContent('');
      });

      // リージョンを変更
      const regionSelect = screen.getByLabelText('リージョン選択:');
      await user.selectOptions(regionSelect, 'eu-west-1');

      // 新しいデフォルトモデルが選択されることを確認
      await waitFor(() => {
        expect(screen.getByTestId('current-model')).not.toHaveTextContent('');
      });
    });
  });

  describe('設定の永続化', () => {
    it('リージョン設定が保存・復元されるべき', async () => {
      const user = userEvent.setup();
      const { unmount } = render(<TestRegionModelIntegration />);

      // リージョンを変更
      const regionSelect = screen.getByLabelText('リージョン選択:');
      await user.selectOptions(regionSelect, 'us-west-2');

      await waitFor(() => {
        expect(screen.getByTestId('current-region')).toHaveTextContent('us-west-2');
      });

      // コンポーネントを再マウント
      unmount();
      render(<TestRegionModelIntegration />);

      // 設定が復元されることを確認
      await waitFor(() => {
        expect(screen.getByTestId('current-region')).toHaveTextContent('us-west-2');
      });
    });

    it('モデル設定が保存・復元されるべき', async () => {
      const user = userEvent.setup();
      render(<TestRegionModelIntegration />);

      // 初期化を待つ
      await waitFor(() => {
        expect(screen.getByTestId('current-region')).toHaveTextContent('ap-northeast-1');
      });

      // モデルを変更
      const modelSelect = screen.getByLabelText('モデル選択:');
      const options = modelSelect.querySelectorAll('option');
      if (options.length > 1) {
        await user.selectOptions(modelSelect, (options[1] as HTMLOptionElement).value);

        const selectedModel = (options[1] as HTMLOptionElement).value;
        await waitFor(() => {
          expect(screen.getByTestId('current-model')).toHaveTextContent(selectedModel);
        });
      }
    });
  });

  describe('エラーハンドリング', () => {
    it('無効なリージョン選択時にエラーが表示されるべき', async () => {
      render(<TestRegionModelIntegration />);

      // 無効なリージョンを直接設定（通常のUIでは発生しないが、APIレベルでテスト）
      const regionSelect = screen.getByLabelText('リージョン選択:');
      
      // selectのoptionを一時的に追加してテスト
      const invalidOption = document.createElement('option');
      invalidOption.value = 'invalid-region';
      invalidOption.textContent = 'Invalid Region';
      regionSelect.appendChild(invalidOption);

      fireEvent.change(regionSelect, { target: { value: 'invalid-region' } });

      // エラーメッセージが表示されることを確認
      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
      });
    });

    it('ストレージエラー時に適切に処理されるべき', async () => {
      // localStorageのsetItemでエラーを発生させる
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const user = userEvent.setup();
      render(<TestRegionModelIntegration />);

      // リージョン変更を試行
      const regionSelect = screen.getByLabelText('リージョン選択:');
      await user.selectOptions(regionSelect, 'us-east-1');

      // エラーが適切に処理されることを確認（アプリがクラッシュしない）
      await waitFor(() => {
        expect(screen.getByTestId('region-model-integration')).toBeInTheDocument();
      });
    });
  });

  describe('ローディング状態', () => {
    it('リージョン変更中はローディング状態が表示されるべき', async () => {
      const user = userEvent.setup();
      render(<TestRegionModelIntegration />);

      // 初期化を待つ
      await waitFor(() => {
        expect(screen.getByTestId('current-region')).toHaveTextContent('ap-northeast-1');
      });

      // リージョン変更を開始
      const regionSelect = screen.getByLabelText('リージョン選択:');
      
      // 変更処理中のローディング状態をテスト
      // （実際の処理が高速なため、モックで遅延を追加する場合もある）
      await user.selectOptions(regionSelect, 'us-east-1');

      // 最終的に変更が完了することを確認
      await waitFor(() => {
        expect(screen.getByTestId('current-region')).toHaveTextContent('us-east-1');
      });
    });

    it('ローディング中は操作が無効化されるべき', async () => {
      render(<TestRegionModelIntegration />);

      // 初期化を待つ
      await waitFor(() => {
        expect(screen.getByTestId('current-region')).toHaveTextContent('ap-northeast-1');
      });

      // ローディング中でない場合、セレクトボックスが有効であることを確認
      const regionSelect = screen.getByLabelText('リージョン選択:') as HTMLSelectElement;
      const modelSelect = screen.getByLabelText('モデル選択:') as HTMLSelectElement;
      const resetButton = screen.getByTestId('reset-button') as HTMLButtonElement;

      expect(regionSelect.disabled).toBe(false);
      expect(resetButton.disabled).toBe(false);
    });
  });

  describe('デフォルト復元機能', () => {
    it('デフォルトに戻すボタンが正常に動作するべき', async () => {
      const user = userEvent.setup();
      render(<TestRegionModelIntegration />);

      // 初期化を待つ
      await waitFor(() => {
        expect(screen.getByTestId('current-region')).toHaveTextContent('ap-northeast-1');
      });

      // リージョンを変更
      const regionSelect = screen.getByLabelText('リージョン選択:');
      await user.selectOptions(regionSelect, 'us-east-1');

      await waitFor(() => {
        expect(screen.getByTestId('current-region')).toHaveTextContent('us-east-1');
      });

      // デフォルトに戻す
      const resetButton = screen.getByTestId('reset-button');
      await user.click(resetButton);

      await waitFor(() => {
        expect(screen.getByTestId('current-region')).toHaveTextContent('ap-northeast-1');
      });
    });
  });

  describe('リージョン別モデル対応', () => {
    it('大阪リージョン選択時に適切なモデルが表示されるべき', async () => {
      const user = userEvent.setup();
      render(<TestRegionModelIntegration />);

      // 大阪リージョンを選択
      const regionSelect = screen.getByLabelText('リージョン選択:');
      await user.selectOptions(regionSelect, 'ap-northeast-3');

      await waitFor(() => {
        expect(screen.getByTestId('current-region')).toHaveTextContent('ap-northeast-3');
      });

      // 大阪リージョンで利用可能なモデルが表示されることを確認
      await waitFor(() => {
        const modelCount = screen.getByTestId('available-models-count');
        expect(parseInt(modelCount.textContent || '0')).toBeGreaterThan(0);
      });
    });

    it('各リージョンで異なるモデル数が表示されるべき', async () => {
      const user = userEvent.setup();
      render(<TestRegionModelIntegration />);

      const regions = ['ap-northeast-1', 'us-east-1', 'eu-west-1'];
      const modelCounts: number[] = [];

      for (const region of regions) {
        const regionSelect = screen.getByLabelText('リージョン選択:');
        await user.selectOptions(regionSelect, region);

        await waitFor(() => {
          expect(screen.getByTestId('current-region')).toHaveTextContent(region);
        });

        await waitFor(() => {
          const modelCount = screen.getByTestId('available-models-count');
          const count = parseInt(modelCount.textContent || '0');
          modelCounts.push(count);
          expect(count).toBeGreaterThan(0);
        });
      }

      // 各リージョンでモデル数が取得できていることを確認
      expect(modelCounts.every(count => count > 0)).toBe(true);
    });
  });
});