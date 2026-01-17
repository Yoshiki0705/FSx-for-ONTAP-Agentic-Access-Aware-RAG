/**
 * 設定永続化システム
 * ユーザーのリージョン選択設定をローカルストレージに保存・復元
 */

import { SupportedRegion, RegionConfigManager } from '../config/region-config-manager';
import { ModelConfigManager, BedrockModelInfo } from '../config/model-config-manager';

// ストレージキー定数
const STORAGE_KEYS = {
  REGION_SETTINGS: 'chatbot-region-settings',
  MODEL_SETTINGS: 'chatbot-model-settings',
  USER_PREFERENCES: 'chatbot-user-preferences',
  SETTINGS_VERSION: 'chatbot-settings-version'
} as const;

// 設定データのバージョン管理
const CURRENT_SETTINGS_VERSION = '1.0.0';

// ユーザー設定インターフェース
export interface UserRegionSettings {
  selectedRegion: SupportedRegion;
  selectedChatModel?: string;
  selectedEmbeddingModel?: string;
  autoSaveEnabled: boolean;
  lastUpdated: string;
  version: string;
}

// モデル設定インターフェース
export interface UserModelSettings {
  chatModelPreferences: {
    [region in SupportedRegion]?: string;
  };
  embeddingModelPreferences: {
    [region in SupportedRegion]?: string;
  };
  fallbackEnabled: boolean;
  lastUpdated: string;
  version: string;
}

// ユーザー全般設定
export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: 'ja' | 'en';
  showAdvancedOptions: boolean;
  enableNotifications: boolean;
  lastUpdated: string;
  version: string;
}

// 設定検証結果
export interface SettingsValidationResult {
  isValid: boolean;
  hasWarnings: boolean;
  errors: string[];
  warnings: string[];
  correctedSettings?: UserRegionSettings;
}

// ストレージ操作結果
export interface StorageOperationResult {
  success: boolean;
  message: string;
  data?: any;
  warnings?: string[];
}

/**
 * 設定永続化管理クラス
 * ローカルストレージを使用した設定の保存・復元・検証機能を提供
 */
export class StorageManager {
  // デフォルト設定
  private static readonly DEFAULT_REGION_SETTINGS: UserRegionSettings = {
    selectedRegion: 'ap-northeast-1',
    autoSaveEnabled: true,
    lastUpdated: new Date().toISOString(),
    version: CURRENT_SETTINGS_VERSION
  };

  private static readonly DEFAULT_MODEL_SETTINGS: UserModelSettings = {
    chatModelPreferences: {},
    embeddingModelPreferences: {},
    fallbackEnabled: true,
    lastUpdated: new Date().toISOString(),
    version: CURRENT_SETTINGS_VERSION
  };

  private static readonly DEFAULT_USER_PREFERENCES: UserPreferences = {
    theme: 'auto',
    language: 'ja',
    showAdvancedOptions: false,
    enableNotifications: true,
    lastUpdated: new Date().toISOString(),
    version: CURRENT_SETTINGS_VERSION
  };

  /**
   * ローカルストレージが利用可能かチェック
   */
  private static isLocalStorageAvailable(): boolean {
    try {
      if (typeof window === 'undefined') return false;
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 安全なJSON解析
   */
  private static safeJsonParse<T>(jsonString: string | null, fallback: T): T {
    if (!jsonString) return fallback;
    
    try {
      const parsed = JSON.parse(jsonString);
      return parsed || fallback;
    } catch (error) {
      console.warn('[StorageManager] JSON解析エラー:', error);
      return fallback;
    }
  }

  /**
   * 安全なJSON文字列化
   */
  private static safeJsonStringify(data: any): string | null {
    try {
      return JSON.stringify(data);
    } catch (error) {
      console.error('[StorageManager] JSON文字列化エラー:', error);
      return null;
    }
  }

  // ===== リージョン設定の管理 =====

  /**
   * リージョン設定を保存
   */
  public static saveRegionSettings(settings: Partial<UserRegionSettings>): StorageOperationResult {
    if (!this.isLocalStorageAvailable()) {
      return {
        success: false,
        message: 'ローカルストレージが利用できません。'
      };
    }

    try {
      // 現在の設定を取得してマージ
      const currentSettings = this.loadRegionSettings().data || this.DEFAULT_REGION_SETTINGS;
      const updatedSettings: UserRegionSettings = {
        ...currentSettings,
        ...settings,
        lastUpdated: new Date().toISOString(),
        version: CURRENT_SETTINGS_VERSION
      };

      // 設定の検証
      const validation = this.validateRegionSettings(updatedSettings);
      if (!validation.isValid) {
        return {
          success: false,
          message: `設定の検証に失敗しました: ${validation.errors.join(', ')}`,
          warnings: validation.warnings
        };
      }

      // 修正された設定があれば使用
      const finalSettings = validation.correctedSettings || updatedSettings;

      // ローカルストレージに保存
      const jsonString = this.safeJsonStringify(finalSettings);
      if (!jsonString) {
        return {
          success: false,
          message: '設定データの変換に失敗しました。'
        };
      }

      localStorage.setItem(STORAGE_KEYS.REGION_SETTINGS, jsonString);

      console.log('[StorageManager] リージョン設定を保存しました:', finalSettings);

      return {
        success: true,
        message: 'リージョン設定を保存しました。',
        data: finalSettings,
        warnings: validation.warnings
      };
    } catch (error) {
      console.error('[StorageManager] リージョン設定保存エラー:', error);
      return {
        success: false,
        message: `設定の保存に失敗しました: ${error}`
      };
    }
  }

  /**
   * リージョン設定を復元
   */
  public static loadRegionSettings(): StorageOperationResult {
    if (!this.isLocalStorageAvailable()) {
      return {
        success: true,
        message: 'ローカルストレージが利用できないため、デフォルト設定を使用します。',
        data: this.DEFAULT_REGION_SETTINGS
      };
    }

    try {
      const jsonString = localStorage.getItem(STORAGE_KEYS.REGION_SETTINGS);
      const settings = this.safeJsonParse(jsonString, this.DEFAULT_REGION_SETTINGS);

      // 設定の検証
      const validation = this.validateRegionSettings(settings);
      
      if (!validation.isValid) {
        console.warn('[StorageManager] 保存された設定が無効です。デフォルト設定を使用します。');
        return {
          success: true,
          message: '保存された設定が無効のため、デフォルト設定を使用します。',
          data: this.DEFAULT_REGION_SETTINGS,
          warnings: validation.errors
        };
      }

      const finalSettings = validation.correctedSettings || settings;

      // 修正があった場合は再保存
      if (validation.correctedSettings) {
        this.saveRegionSettings(validation.correctedSettings);
      }

      return {
        success: true,
        message: 'リージョン設定を復元しました。',
        data: finalSettings,
        warnings: validation.warnings
      };
    } catch (error) {
      console.error('[StorageManager] リージョン設定復元エラー:', error);
      return {
        success: true,
        message: 'エラーが発生したため、デフォルト設定を使用します。',
        data: this.DEFAULT_REGION_SETTINGS
      };
    }
  }

  /**
   * リージョン設定をクリア
   */
  public static clearRegionSettings(): StorageOperationResult {
    if (!this.isLocalStorageAvailable()) {
      return {
        success: true,
        message: 'ローカルストレージが利用できません。'
      };
    }

    try {
      localStorage.removeItem(STORAGE_KEYS.REGION_SETTINGS);
      console.log('[StorageManager] リージョン設定をクリアしました。');
      
      return {
        success: true,
        message: 'リージョン設定をクリアしました。'
      };
    } catch (error) {
      console.error('[StorageManager] リージョン設定クリアエラー:', error);
      return {
        success: false,
        message: `設定のクリアに失敗しました: ${error}`
      };
    }
  }

  // ===== モデル設定の管理 =====

  /**
   * モデル設定を保存
   */
  public static saveModelSettings(settings: Partial<UserModelSettings>): StorageOperationResult {
    if (!this.isLocalStorageAvailable()) {
      return {
        success: false,
        message: 'ローカルストレージが利用できません。'
      };
    }

    try {
      const currentSettings = this.loadModelSettings().data || this.DEFAULT_MODEL_SETTINGS;
      const updatedSettings: UserModelSettings = {
        ...currentSettings,
        ...settings,
        lastUpdated: new Date().toISOString(),
        version: CURRENT_SETTINGS_VERSION
      };

      const jsonString = this.safeJsonStringify(updatedSettings);
      if (!jsonString) {
        return {
          success: false,
          message: 'モデル設定データの変換に失敗しました。'
        };
      }

      localStorage.setItem(STORAGE_KEYS.MODEL_SETTINGS, jsonString);

      return {
        success: true,
        message: 'モデル設定を保存しました。',
        data: updatedSettings
      };
    } catch (error) {
      console.error('[StorageManager] モデル設定保存エラー:', error);
      return {
        success: false,
        message: `モデル設定の保存に失敗しました: ${error}`
      };
    }
  }

  /**
   * モデル設定を復元
   */
  public static loadModelSettings(): StorageOperationResult {
    if (!this.isLocalStorageAvailable()) {
      return {
        success: true,
        message: 'ローカルストレージが利用できないため、デフォルト設定を使用します。',
        data: this.DEFAULT_MODEL_SETTINGS
      };
    }

    try {
      const jsonString = localStorage.getItem(STORAGE_KEYS.MODEL_SETTINGS);
      const settings = this.safeJsonParse(jsonString, this.DEFAULT_MODEL_SETTINGS);

      return {
        success: true,
        message: 'モデル設定を復元しました。',
        data: settings
      };
    } catch (error) {
      console.error('[StorageManager] モデル設定復元エラー:', error);
      return {
        success: true,
        message: 'エラーが発生したため、デフォルト設定を使用します。',
        data: this.DEFAULT_MODEL_SETTINGS
      };
    }
  }

  // ===== ユーザー設定の管理 =====

  /**
   * ユーザー設定を保存
   */
  public static saveUserPreferences(preferences: Partial<UserPreferences>): StorageOperationResult {
    if (!this.isLocalStorageAvailable()) {
      return {
        success: false,
        message: 'ローカルストレージが利用できません。'
      };
    }

    try {
      const currentPreferences = this.loadUserPreferences().data || this.DEFAULT_USER_PREFERENCES;
      const updatedPreferences: UserPreferences = {
        ...currentPreferences,
        ...preferences,
        lastUpdated: new Date().toISOString(),
        version: CURRENT_SETTINGS_VERSION
      };

      const jsonString = this.safeJsonStringify(updatedPreferences);
      if (!jsonString) {
        return {
          success: false,
          message: 'ユーザー設定データの変換に失敗しました。'
        };
      }

      localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, jsonString);

      return {
        success: true,
        message: 'ユーザー設定を保存しました。',
        data: updatedPreferences
      };
    } catch (error) {
      console.error('[StorageManager] ユーザー設定保存エラー:', error);
      return {
        success: false,
        message: `ユーザー設定の保存に失敗しました: ${error}`
      };
    }
  }

  /**
   * ユーザー設定を復元
   */
  public static loadUserPreferences(): StorageOperationResult {
    if (!this.isLocalStorageAvailable()) {
      return {
        success: true,
        message: 'ローカルストレージが利用できないため、デフォルト設定を使用します。',
        data: this.DEFAULT_USER_PREFERENCES
      };
    }

    try {
      const jsonString = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
      const preferences = this.safeJsonParse(jsonString, this.DEFAULT_USER_PREFERENCES);

      return {
        success: true,
        message: 'ユーザー設定を復元しました。',
        data: preferences
      };
    } catch (error) {
      console.error('[StorageManager] ユーザー設定復元エラー:', error);
      return {
        success: true,
        message: 'エラーが発生したため、デフォルト設定を使用します。',
        data: this.DEFAULT_USER_PREFERENCES
      };
    }
  }

  // ===== 設定検証機能 =====

  /**
   * リージョン設定の妥当性をチェック
   */
  public static validateRegionSettings(settings: UserRegionSettings): SettingsValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let correctedSettings: UserRegionSettings | undefined;

    // 必須フィールドの確認
    if (!settings.selectedRegion) {
      errors.push('選択されたリージョンが指定されていません。');
    }

    if (!settings.version) {
      warnings.push('設定バージョンが指定されていません。');
    }

    // リージョンの妥当性チェック
    if (settings.selectedRegion) {
      const regionValidation = RegionConfigManager.validateRegion(settings.selectedRegion);
      
      if (!regionValidation.isValid) {
        errors.push(`無効なリージョンが指定されています: ${regionValidation.message}`);
        
        // 自動修正
        correctedSettings = {
          ...settings,
          selectedRegion: regionValidation.fallbackRegion!
        };
        warnings.push(`リージョンを${RegionConfigManager.getRegionDisplayName(regionValidation.fallbackRegion!)}に自動修正しました。`);
      }
    }

    // モデル設定の妥当性チェック
    if (settings.selectedChatModel && settings.selectedRegion) {
      const modelValidation = ModelConfigManager.validateModelRegionCombination(
        settings.selectedChatModel, 
        settings.selectedRegion
      );
      
      if (!modelValidation.isValid) {
        warnings.push(`選択されたチャットモデルは現在のリージョンでは利用できません: ${modelValidation.message}`);
        
        // 自動修正
        const fallbackModel = ModelConfigManager.getDefaultChatModel(settings.selectedRegion);
        if (fallbackModel) {
          correctedSettings = correctedSettings || { ...settings };
          correctedSettings.selectedChatModel = fallbackModel.id;
          warnings.push(`チャットモデルを${fallbackModel.nameJa}に自動修正しました。`);
        }
      }
    }

    // バージョン互換性チェック
    if (settings.version && settings.version !== CURRENT_SETTINGS_VERSION) {
      warnings.push(`設定バージョンが古い可能性があります。現在: ${settings.version}, 最新: ${CURRENT_SETTINGS_VERSION}`);
    }

    return {
      isValid: errors.length === 0,
      hasWarnings: warnings.length > 0,
      errors,
      warnings,
      correctedSettings
    };
  }

  // ===== ユーティリティ機能 =====

  /**
   * 全設定をクリア
   */
  public static clearAllSettings(): StorageOperationResult {
    if (!this.isLocalStorageAvailable()) {
      return {
        success: true,
        message: 'ローカルストレージが利用できません。'
      };
    }

    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });

      console.log('[StorageManager] 全設定をクリアしました。');
      
      return {
        success: true,
        message: '全設定をクリアしました。'
      };
    } catch (error) {
      console.error('[StorageManager] 全設定クリアエラー:', error);
      return {
        success: false,
        message: `設定のクリアに失敗しました: ${error}`
      };
    }
  }

  /**
   * ストレージ使用量を取得
   */
  public static getStorageUsage(): {
    totalSize: number;
    itemSizes: { [key: string]: number };
    isAvailable: boolean;
  } {
    if (!this.isLocalStorageAvailable()) {
      return {
        totalSize: 0,
        itemSizes: {},
        isAvailable: false
      };
    }

    const itemSizes: { [key: string]: number } = {};
    let totalSize = 0;

    Object.values(STORAGE_KEYS).forEach(key => {
      const item = localStorage.getItem(key);
      const size = item ? new Blob([item]).size : 0;
      itemSizes[key] = size;
      totalSize += size;
    });

    return {
      totalSize,
      itemSizes,
      isAvailable: true
    };
  }

  /**
   * 設定のエクスポート
   */
  public static exportSettings(): StorageOperationResult {
    try {
      const regionSettings = this.loadRegionSettings();
      const modelSettings = this.loadModelSettings();
      const userPreferences = this.loadUserPreferences();

      const exportData = {
        regionSettings: regionSettings.data,
        modelSettings: modelSettings.data,
        userPreferences: userPreferences.data,
        exportedAt: new Date().toISOString(),
        version: CURRENT_SETTINGS_VERSION
      };

      return {
        success: true,
        message: '設定をエクスポートしました。',
        data: exportData
      };
    } catch (error) {
      console.error('[StorageManager] 設定エクスポートエラー:', error);
      return {
        success: false,
        message: `設定のエクスポートに失敗しました: ${error}`
      };
    }
  }

  /**
   * 設定のインポート
   */
  public static importSettings(importData: any): StorageOperationResult {
    try {
      const warnings: string[] = [];

      // リージョン設定のインポート
      if (importData.regionSettings) {
        const regionResult = this.saveRegionSettings(importData.regionSettings);
        if (!regionResult.success) {
          warnings.push(`リージョン設定のインポートに失敗: ${regionResult.message}`);
        }
        if (regionResult.warnings) {
          warnings.push(...regionResult.warnings);
        }
      }

      // モデル設定のインポート
      if (importData.modelSettings) {
        const modelResult = this.saveModelSettings(importData.modelSettings);
        if (!modelResult.success) {
          warnings.push(`モデル設定のインポートに失敗: ${modelResult.message}`);
        }
      }

      // ユーザー設定のインポート
      if (importData.userPreferences) {
        const preferencesResult = this.saveUserPreferences(importData.userPreferences);
        if (!preferencesResult.success) {
          warnings.push(`ユーザー設定のインポートに失敗: ${preferencesResult.message}`);
        }
      }

      return {
        success: true,
        message: '設定をインポートしました。',
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      console.error('[StorageManager] 設定インポートエラー:', error);
      return {
        success: false,
        message: `設定のインポートに失敗しました: ${error}`
      };
    }
  }

  // ===== 設定検証と修復機能の強化 =====

  /**
   * サポート外リージョンが保存されている場合の自動修復
   */
  public static repairUnsupportedRegionSettings(): StorageOperationResult {
    try {
      const loadResult = this.loadRegionSettings();
      if (!loadResult.success || !loadResult.data) {
        return {
          success: false,
          message: '設定の読み込みに失敗しました。'
        };
      }

      const settings = loadResult.data;
      const warnings: string[] = [];
      let wasRepaired = false;

      // リージョンの検証と修復
      const regionValidation = RegionConfigManager.validateRegion(settings.selectedRegion);
      if (!regionValidation.isValid) {
        const fallbackRegion = regionValidation.fallbackRegion || 'ap-northeast-1';
        settings.selectedRegion = fallbackRegion;
        warnings.push(`サポート外リージョンを${RegionConfigManager.getRegionDisplayName(fallbackRegion)}に修復しました。`);
        wasRepaired = true;
      }

      // チャットモデルの検証と修復
      if (settings.selectedChatModel) {
        const modelValidation = ModelConfigManager.validateModelRegionCombination(
          settings.selectedChatModel,
          settings.selectedRegion
        );
        
        if (!modelValidation.isValid) {
          const fallbackModel = ModelConfigManager.getDefaultChatModel(settings.selectedRegion);
          if (fallbackModel) {
            settings.selectedChatModel = fallbackModel.id;
            warnings.push(`利用不可能なチャットモデルを${fallbackModel.nameJa || fallbackModel.name}に修復しました。`);
            wasRepaired = true;
          }
        }
      }

      // 埋め込みモデルの検証と修復
      if (settings.selectedEmbeddingModel) {
        const modelValidation = ModelConfigManager.validateModelRegionCombination(
          settings.selectedEmbeddingModel,
          settings.selectedRegion
        );
        
        if (!modelValidation.isValid) {
          const fallbackModel = ModelConfigManager.getDefaultEmbeddingModel(settings.selectedRegion);
          if (fallbackModel) {
            settings.selectedEmbeddingModel = fallbackModel.id;
            warnings.push(`利用不可能な埋め込みモデルを${fallbackModel.nameJa || fallbackModel.name}に修復しました。`);
            wasRepaired = true;
          }
        }
      }

      // 修復が必要だった場合は保存
      if (wasRepaired) {
        const saveResult = this.saveRegionSettings(settings);
        if (!saveResult.success) {
          return {
            success: false,
            message: '修復した設定の保存に失敗しました。',
            warnings
          };
        }

        console.log('[StorageManager] 設定を自動修復しました:', settings);
      }

      return {
        success: true,
        message: wasRepaired ? '設定を自動修復しました。' : '設定に問題はありませんでした。',
        data: settings,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      console.error('[StorageManager] 設定修復エラー:', error);
      return {
        success: false,
        message: `設定の修復に失敗しました: ${error}`
      };
    }
  }

  /**
   * 破損した設定データの安全な処理
   */
  public static handleCorruptedSettings(): StorageOperationResult {
    try {
      const warnings: string[] = [];
      let wasCorrupted = false;

      // 各設定の破損チェックと修復
      Object.values(STORAGE_KEYS).forEach(key => {
        try {
          const item = localStorage.getItem(key);
          if (item) {
            JSON.parse(item); // JSON解析テスト
          }
        } catch (error) {
          console.warn(`[StorageManager] 破損した設定を検出: ${key}`);
          localStorage.removeItem(key);
          warnings.push(`破損した設定「${key}」を削除しました。`);
          wasCorrupted = true;
        }
      });

      // 破損が検出された場合はデフォルト設定で初期化
      if (wasCorrupted) {
        this.saveRegionSettings(this.DEFAULT_REGION_SETTINGS);
        this.saveModelSettings(this.DEFAULT_MODEL_SETTINGS);
        this.saveUserPreferences(this.DEFAULT_USER_PREFERENCES);
        warnings.push('デフォルト設定で初期化しました。');
      }

      return {
        success: true,
        message: wasCorrupted ? '破損した設定を修復しました。' : '設定に破損はありませんでした。',
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      console.error('[StorageManager] 破損設定処理エラー:', error);
      return {
        success: false,
        message: `破損設定の処理に失敗しました: ${error}`
      };
    }
  }

  /**
   * 設定の整合性チェック
   */
  public static checkSettingsIntegrity(): {
    isHealthy: boolean;
    issues: string[];
    recommendations: string[];
    repairActions: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const repairActions: string[] = [];

    try {
      // ローカルストレージの可用性チェック
      if (!this.isLocalStorageAvailable()) {
        issues.push('ローカルストレージが利用できません。');
        recommendations.push('ブラウザの設定を確認してください。');
        return { isHealthy: false, issues, recommendations, repairActions };
      }

      // リージョン設定の整合性チェック
      const regionResult = this.loadRegionSettings();
      if (regionResult.success && regionResult.data) {
        const validation = this.validateRegionSettings(regionResult.data);
        if (!validation.isValid) {
          issues.push(...validation.errors);
          repairActions.push('repairUnsupportedRegionSettings()を実行してください。');
        }
        if (validation.hasWarnings) {
          issues.push(...validation.warnings);
        }
      } else {
        issues.push('リージョン設定の読み込みに失敗しました。');
        repairActions.push('handleCorruptedSettings()を実行してください。');
      }

      // ストレージ使用量チェック
      const usage = this.getStorageUsage();
      if (usage.totalSize > 1024 * 1024) { // 1MB以上
        issues.push('ストレージ使用量が多すぎます。');
        recommendations.push('不要な設定をクリアすることを検討してください。');
      }

      // バージョン互換性チェック
      if (regionResult.success && regionResult.data) {
        if (regionResult.data.version !== CURRENT_SETTINGS_VERSION) {
          issues.push(`設定バージョンが古い可能性があります。現在: ${regionResult.data.version}, 最新: ${CURRENT_SETTINGS_VERSION}`);
          recommendations.push('設定を最新バージョンに更新することを推奨します。');
        }
      }

      return {
        isHealthy: issues.length === 0,
        issues,
        recommendations,
        repairActions
      };
    } catch (error) {
      console.error('[StorageManager] 整合性チェックエラー:', error);
      return {
        isHealthy: false,
        issues: [`整合性チェック中にエラーが発生しました: ${error}`],
        recommendations: ['設定をリセットすることを検討してください。'],
        repairActions: ['clearAllSettings()を実行してください。']
      };
    }
  }

  /**
   * 自動修復の実行
   */
  public static performAutoRepair(): StorageOperationResult {
    try {
      const warnings: string[] = [];
      
      // 破損設定の処理
      const corruptionResult = this.handleCorruptedSettings();
      if (!corruptionResult.success) {
        return corruptionResult;
      }
      if (corruptionResult.warnings) {
        warnings.push(...corruptionResult.warnings);
      }

      // サポート外リージョンの修復
      const regionResult = this.repairUnsupportedRegionSettings();
      if (!regionResult.success) {
        warnings.push(`リージョン修復に失敗: ${regionResult.message}`);
      }
      if (regionResult.warnings) {
        warnings.push(...regionResult.warnings);
      }

      // 整合性の最終チェック
      const integrityCheck = this.checkSettingsIntegrity();
      if (!integrityCheck.isHealthy) {
        warnings.push('自動修復後も一部の問題が残っています。');
        warnings.push(...integrityCheck.issues);
      }

      return {
        success: true,
        message: '自動修復を実行しました。',
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      console.error('[StorageManager] 自動修復エラー:', error);
      return {
        success: false,
        message: `自動修復に失敗しました: ${error}`
      };
    }
  }

  /**
   * 設定の健全性レポート生成
   */
  public static generateHealthReport(): {
    timestamp: string;
    overallHealth: 'healthy' | 'warning' | 'critical';
    storageInfo: ReturnType<typeof StorageManager.getStorageUsage>;
    integrityCheck: ReturnType<typeof StorageManager.checkSettingsIntegrity>;
    settingsInfo: {
      regionSettings: { exists: boolean; valid: boolean; lastUpdated?: string };
      modelSettings: { exists: boolean; valid: boolean; lastUpdated?: string };
      userPreferences: { exists: boolean; valid: boolean; lastUpdated?: string };
    };
    recommendations: string[];
  } {
    const timestamp = new Date().toISOString();
    const storageInfo = this.getStorageUsage();
    const integrityCheck = this.checkSettingsIntegrity();
    const recommendations: string[] = [];

    // 各設定の状態チェック
    const regionResult = this.loadRegionSettings();
    const modelResult = this.loadModelSettings();
    const preferencesResult = this.loadUserPreferences();

    const settingsInfo = {
      regionSettings: {
        exists: regionResult.success && !!regionResult.data,
        valid: regionResult.success && !!regionResult.data && this.validateRegionSettings(regionResult.data).isValid,
        lastUpdated: regionResult.data?.lastUpdated
      },
      modelSettings: {
        exists: modelResult.success && !!modelResult.data,
        valid: modelResult.success && !!modelResult.data,
        lastUpdated: modelResult.data?.lastUpdated
      },
      userPreferences: {
        exists: preferencesResult.success && !!preferencesResult.data,
        valid: preferencesResult.success && !!preferencesResult.data,
        lastUpdated: preferencesResult.data?.lastUpdated
      }
    };

    // 全体的な健全性の判定
    let overallHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (!integrityCheck.isHealthy) {
      overallHealth = integrityCheck.issues.some(issue => 
        issue.includes('破損') || issue.includes('失敗') || issue.includes('エラー')
      ) ? 'critical' : 'warning';
    }

    // 推奨事項の生成
    if (!storageInfo.isAvailable) {
      recommendations.push('ローカルストレージが利用できません。ブラウザの設定を確認してください。');
      overallHealth = 'critical';
    }

    if (!settingsInfo.regionSettings.valid) {
      recommendations.push('リージョン設定に問題があります。自動修復を実行してください。');
      overallHealth = overallHealth === 'healthy' ? 'warning' : overallHealth;
    }

    if (storageInfo.totalSize > 512 * 1024) { // 512KB以上
      recommendations.push('ストレージ使用量が多めです。定期的なクリーンアップを検討してください。');
    }

    recommendations.push(...integrityCheck.recommendations);

    return {
      timestamp,
      overallHealth,
      storageInfo,
      integrityCheck,
      settingsInfo,
      recommendations
    };
  }
}