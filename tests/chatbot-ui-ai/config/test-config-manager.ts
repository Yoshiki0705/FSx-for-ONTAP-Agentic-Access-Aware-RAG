/**
 * テスト設定管理システム
 * 
 * 環境別設定の読み込み、動的更新、検証機能を提供
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { TestConfiguration, ValidationResult } from '../types/test-types';

/**
 * テスト設定管理クラス
 */
export class TestConfigManager {
  private configCache: Map<string, TestConfiguration> = new Map();
  private configPath: string;
  private defaultConfig: TestConfiguration;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'tests/chatbot-ui-ai/config');
    this.defaultConfig = this.createDefaultConfig();
  }

  /**
   * 環境別設定の読み込み
   * @param environment 環境名（dev, staging, prod等）
   * @returns テスト設定
   */
  async loadConfig(environment: string = 'dev'): Promise<TestConfiguration> {
    console.log(`⚙️  設定読み込み開始: ${environment}環境`);

    // キャッシュから取得を試行
    const cacheKey = `config_${environment}`;
    if (this.configCache.has(cacheKey)) {
      console.log(`📋 キャッシュから設定を取得: ${environment}`);
      return this.configCache.get(cacheKey)!;
    }

    try {
      // 環境固有設定ファイルの読み込み
      const configFile = path.join(this.configPath, `${environment}.json`);
      const configExists = await this.fileExists(configFile);

      let config: TestConfiguration;

      if (configExists) {
        console.log(`📄 設定ファイル読み込み: ${configFile}`);
        const configData = await fs.readFile(configFile, 'utf-8');
        const environmentConfig = JSON.parse(configData);
        
        // デフォルト設定とマージ
        config = this.mergeConfigs(this.defaultConfig, environmentConfig);
      } else {
        console.log(`⚠️  設定ファイルが見つかりません。デフォルト設定を使用: ${configFile}`);
        config = { ...this.defaultConfig };
        
        // デフォルト設定ファイルを作成
        await this.createDefaultConfigFile(environment);
      }

      // 設定の検証
      const validation = this.validateConfig(config);
      if (!validation.isValid) {
        console.warn('⚠️  設定検証で警告が発生しました:', validation.warnings);
        if (validation.errors.length > 0) {
          throw new Error(`設定検証エラー: ${validation.errors.join(', ')}`);
        }
      }

      // キャッシュに保存
      this.configCache.set(cacheKey, config);
      
      console.log(`✅ 設定読み込み完了: ${environment}環境`);
      return config;

    } catch (error) {
      console.error(`❌ 設定読み込みエラー (${environment}):`, error);
      
      // エラー時はデフォルト設定を返す
      console.log('📋 デフォルト設定にフォールバック');
      return { ...this.defaultConfig };
    }
  }

  /**
   * 設定の動的更新
   * @param configPath 設定パス（ドット記法）
   * @param value 新しい値
   * @param environment 対象環境
   */
  async updateConfig(configPath: string, value: any, environment: string = 'dev'): Promise<void> {
    console.log(`🔧 設定更新: ${configPath} = ${JSON.stringify(value)} (${environment}環境)`);

    try {
      // 現在の設定を取得
      const currentConfig = await this.loadConfig(environment);
      
      // パスに基づいて値を更新
      const updatedConfig = this.setNestedValue(currentConfig, configPath, value);
      
      // 更新された設定の検証
      const validation = this.validateConfig(updatedConfig);
      if (!validation.isValid) {
        throw new Error(`設定更新後の検証エラー: ${validation.errors.join(', ')}`);
      }

      // 設定ファイルに保存
      const configFile = path.join(this.configPath, `${environment}.json`);
      await fs.writeFile(configFile, JSON.stringify(updatedConfig, null, 2), 'utf-8');
      
      // キャッシュを更新
      const cacheKey = `config_${environment}`;
      this.configCache.set(cacheKey, updatedConfig);
      
      console.log(`✅ 設定更新完了: ${configPath}`);

    } catch (error) {
      console.error(`❌ 設定更新エラー:`, error);
      throw error;
    }
  }

  /**
   * 設定の検証
   * @param config テスト設定
   * @returns 検証結果
   */
  validateConfig(config: TestConfiguration): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // UI設定の検証
      if (config.ui) {
        if (config.ui.browserTimeout < 1000) {
          errors.push('UI.browserTimeout は1000ms以上である必要があります');
        }
        if (config.ui.browserTimeout > 300000) {
          warnings.push('UI.browserTimeout が300秒を超えています。テスト実行時間が長くなる可能性があります');
        }
      }

      // AI設定の検証
      if (config.ai) {
        if (config.ai.modelTimeout < 5000) {
          errors.push('AI.modelTimeout は5000ms以上である必要があります');
        }
        if (!config.ai.bedrockRegion) {
          errors.push('AI.bedrockRegion は必須です');
        }
        const validRegions = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-northeast-1'];
        if (config.ai.bedrockRegion && !validRegions.includes(config.ai.bedrockRegion)) {
          warnings.push(`AI.bedrockRegion '${config.ai.bedrockRegion}' は推奨リージョンではありません`);
        }
      }

      // RAG設定の検証
      if (config.rag) {
        if (config.rag.searchTimeout < 1000) {
          errors.push('RAG.searchTimeout は1000ms以上である必要があります');
        }
        if (config.rag.accuracyThreshold && (config.rag.accuracyThreshold < 0 || config.rag.accuracyThreshold > 1)) {
          errors.push('RAG.accuracyThreshold は0から1の間である必要があります');
        }
      }

      // セキュリティ設定の検証
      if (config.security) {
        if (config.security.securityTimeout < 5000) {
          errors.push('Security.securityTimeout は5000ms以上である必要があります');
        }
      }

      // パフォーマンス設定の検証
      if (config.performance) {
        if (config.performance.maxResponseTime < 1000) {
          errors.push('Performance.maxResponseTime は1000ms以上である必要があります');
        }
        if (config.performance.maxStreamingStartTime < 100) {
          errors.push('Performance.maxStreamingStartTime は100ms以上である必要があります');
        }
        if (config.performance.concurrentUsers && config.performance.concurrentUsers > 100) {
          warnings.push('Performance.concurrentUsers が100を超えています。システムリソースを確認してください');
        }
      }

      // 環境設定の検証
      if (config.environment) {
        if (!config.environment.testDataPath) {
          errors.push('Environment.testDataPath は必須です');
        }
        if (!config.environment.outputPath) {
          errors.push('Environment.outputPath は必須です');
        }
        const validLogLevels = ['debug', 'info', 'warn', 'error'];
        if (!validLogLevels.includes(config.environment.logLevel)) {
          errors.push(`Environment.logLevel は ${validLogLevels.join(', ')} のいずれかである必要があります`);
        }
      }

      console.log(`🔍 設定検証完了: エラー ${errors.length}件, 警告 ${warnings.length}件`);

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      console.error('❌ 設定検証中にエラーが発生しました:', error);
      return {
        isValid: false,
        errors: [`設定検証中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`],
        warnings
      };
    }
  }

  /**
   * 設定のリセット
   * @param environment 対象環境
   */
  async resetConfig(environment: string = 'dev'): Promise<void> {
    console.log(`🔄 設定リセット: ${environment}環境`);

    try {
      // キャッシュから削除
      const cacheKey = `config_${environment}`;
      this.configCache.delete(cacheKey);

      // デフォルト設定ファイルを作成
      await this.createDefaultConfigFile(environment);
      
      console.log(`✅ 設定リセット完了: ${environment}環境`);

    } catch (error) {
      console.error(`❌ 設定リセットエラー:`, error);
      throw error;
    }
  }

  /**
   * 利用可能な環境一覧の取得
   */
  async getAvailableEnvironments(): Promise<string[]> {
    try {
      const configDir = this.configPath;
      const dirExists = await this.fileExists(configDir);
      
      if (!dirExists) {
        console.log('📁 設定ディレクトリが存在しません。作成します');
        await fs.mkdir(configDir, { recursive: true });
        return ['dev']; // デフォルト環境のみ
      }

      const files = await fs.readdir(configDir);
      const environments = files
        .filter(file => file.endsWith('.json'))
        .map(file => path.basename(file, '.json'));

      console.log(`📋 利用可能な環境: ${environments.join(', ')}`);
      return environments;

    } catch (error) {
      console.error('❌ 環境一覧取得エラー:', error);
      return ['dev']; // エラー時はデフォルト環境のみ
    }
  }

  /**
   * 設定の比較
   * @param env1 環境1
   * @param env2 環境2
   */
  async compareConfigs(env1: string, env2: string): Promise<Record<string, any>> {
    console.log(`🔍 設定比較: ${env1} vs ${env2}`);

    try {
      const config1 = await this.loadConfig(env1);
      const config2 = await this.loadConfig(env2);

      const differences = this.findConfigDifferences(config1, config2);
      
      console.log(`📊 設定差分: ${Object.keys(differences).length}件の違いを検出`);
      return differences;

    } catch (error) {
      console.error('❌ 設定比較エラー:', error);
      throw error;
    }
  }

  /**
   * デフォルト設定の作成
   */
  private createDefaultConfig(): TestConfiguration {
    return {
      ui: {
        enableResponsiveTests: true,
        enableAccessibilityTests: true,
        browserTimeout: 30000,
        targetBrowsers: ['chromium', 'firefox', 'webkit'],
        captureScreenshots: true,
        viewportSizes: [
          { width: 375, height: 667, deviceName: 'iPhone SE' },
          { width: 768, height: 1024, deviceName: 'iPad' },
          { width: 1920, height: 1080, deviceName: 'Desktop' }
        ]
      },
      ai: {
        enableJapaneseTests: true,
        enableStreamingTests: true,
        bedrockRegion: 'us-east-1',
        modelTimeout: 30000,
        targetModels: ['anthropic.claude-3-haiku-20240307-v1:0', 'amazon.nova-lite-v1:0'],
        qualityThreshold: 0.8
      },
      rag: {
        enableContextIntegrationTests: true,
        enableVectorSearchTests: true,
        searchTimeout: 10000,
        accuracyThreshold: 0.9,
        testDataset: 'default'
      },
      security: {
        enableAuthSessionTests: true,
        enableSIDTests: true,
        securityTimeout: 15000,
        testUsers: [
          {
            userId: 'test-user-1',
            username: 'testuser1',
            permissions: ['read', 'write'],
            groups: ['users']
          }
        ],
        permissionTestCases: [
          {
            name: 'Basic Read Access',
            resource: 'documents',
            expectedPermissions: ['read'],
            testUser: 'test-user-1'
          }
        ]
      },
      performance: {
        enableScalabilityTests: true,
        enableLoadTests: true,
        maxResponseTime: 5000,
        maxStreamingStartTime: 1000,
        concurrentUsers: 10,
        loadTestDuration: 60
      },
      environment: {
        testDataPath: './test-data',
        outputPath: './test-results',
        logLevel: 'info',
        parallelExecutions: 3,
        retryCount: 2
      }
    };
  }

  /**
   * デフォルト設定ファイルの作成
   */
  private async createDefaultConfigFile(environment: string): Promise<void> {
    try {
      // 設定ディレクトリの作成
      await fs.mkdir(this.configPath, { recursive: true });

      // 設定ファイルの作成
      const configFile = path.join(this.configPath, `${environment}.json`);
      const configContent = JSON.stringify(this.defaultConfig, null, 2);
      await fs.writeFile(configFile, configContent, 'utf-8');

      console.log(`📄 デフォルト設定ファイルを作成しました: ${configFile}`);

    } catch (error) {
      console.error('❌ デフォルト設定ファイル作成エラー:', error);
      throw error;
    }
  }

  /**
   * 設定のマージ
   */
  private mergeConfigs(defaultConfig: TestConfiguration, environmentConfig: Partial<TestConfiguration>): TestConfiguration {
    return {
      ui: { ...defaultConfig.ui, ...environmentConfig.ui },
      ai: { ...defaultConfig.ai, ...environmentConfig.ai },
      rag: { ...defaultConfig.rag, ...environmentConfig.rag },
      security: { ...defaultConfig.security, ...environmentConfig.security },
      performance: { ...defaultConfig.performance, ...environmentConfig.performance },
      environment: { ...defaultConfig.environment, ...environmentConfig.environment }
    };
  }

  /**
   * ネストされた値の設定
   */
  private setNestedValue(obj: any, path: string, value: any): any {
    const keys = path.split('.');
    const result = JSON.parse(JSON.stringify(obj)); // Deep copy
    
    let current = result;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    return result;
  }

  /**
   * 設定の差分検出
   */
  private findConfigDifferences(config1: TestConfiguration, config2: TestConfiguration, prefix: string = ''): Record<string, any> {
    const differences: Record<string, any> = {};

    const compare = (obj1: any, obj2: any, currentPrefix: string) => {
      const keys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);
      
      for (const key of keys) {
        const fullKey = currentPrefix ? `${currentPrefix}.${key}` : key;
        const val1 = obj1?.[key];
        const val2 = obj2?.[key];

        if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
          compare(val1, val2, fullKey);
        } else if (val1 !== val2) {
          differences[fullKey] = {
            config1: val1,
            config2: val2
          };
        }
      }
    };

    compare(config1, config2, prefix);
    return differences;
  }

  /**
   * ファイル存在確認
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

export default TestConfigManager;