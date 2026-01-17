/**
 * Environment Manager
 * 環境別設定の管理と暗号化対応
 */

import { ConfigurationManager, CPOSConfig, EnvironmentConfig } from './index';
import { EncryptionManager } from '../../utils/encryption';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface EnvironmentSettings {
  name: string;
  encrypted: boolean;
  configPath: string;
  secretsPath?: string;
}

export class EnvironmentManager {
  private configManager: ConfigurationManager;
  private encryptionManager: EncryptionManager;
  private environments: Map<string, EnvironmentSettings> = new Map();
  private currentEnvironment: string = 'local';

  constructor() {
    this.configManager = new ConfigurationManager();
    this.encryptionManager = new EncryptionManager();
    
    // デフォルト環境を設定
    this.setupDefaultEnvironments();
  }

  /**
   * デフォルト環境を設定
   */
  private setupDefaultEnvironments(): void {
    this.environments.set('local', {
      name: 'local',
      encrypted: false,
      configPath: './config/local.config.json'
    });

    this.environments.set('development', {
      name: 'development',
      encrypted: false,
      configPath: './config/development.config.json'
    });

    this.environments.set('staging', {
      name: 'staging',
      encrypted: true,
      configPath: './config/staging.config.json.enc',
      secretsPath: './config/staging.secrets.json.enc'
    });

    this.environments.set('production', {
      name: 'production',
      encrypted: true,
      configPath: './config/production.config.json.enc',
      secretsPath: './config/production.secrets.json.enc'
    });

    this.environments.set('ec2', {
      name: 'ec2',
      encrypted: true,
      configPath: './config/ec2.config.json.enc',
      secretsPath: './config/ec2.secrets.json.enc'
    });
  }

  /**
   * 現在の環境を設定
   */
  setCurrentEnvironment(environment: string): void {
    if (!this.environments.has(environment)) {
      throw new Error(`未知の環境です: ${environment}`);
    }
    this.currentEnvironment = environment;
  }

  /**
   * 現在の環境を取得
   */
  getCurrentEnvironment(): string {
    return this.currentEnvironment;
  }

  /**
   * 環境設定を読み込み
   */
  async loadEnvironmentConfig(environment?: string): Promise<CPOSConfig> {
    const env = environment || this.currentEnvironment;
    const envSettings = this.environments.get(env);
    
    if (!envSettings) {
      throw new Error(`環境設定が見つかりません: ${env}`);
    }

    try {
      let configData: string;

      if (envSettings.encrypted) {
        // 暗号化された設定ファイルを読み込み
        const password = await this.getEnvironmentPassword(env);
        configData = await this.encryptionManager.decryptFile(envSettings.configPath, password);
      } else {
        // 平文の設定ファイルを読み込み
        configData = await fs.readFile(envSettings.configPath, 'utf-8');
      }

      const config: CPOSConfig = JSON.parse(configData);

      // シークレット情報を読み込み（存在する場合）
      if (envSettings.secretsPath) {
        const secrets = await this.loadSecrets(env);
        const mergedConfig = this.mergeSecrets(config, secrets);
        return mergedConfig;
      }


    } catch (error) {
      console.warn(`環境設定の読み込みに失敗しました (${env}): ${error.message}`);
      console.log('デフォルト設定を使用します');
      return this.configManager.getDefaultConfig();
    }
  }

  /**
   * 環境設定を保存
   */
  async saveEnvironmentConfig(config: CPOSConfig, environment?: string): Promise<void> {
    const env = environment || this.currentEnvironment;
    const envSettings = this.environments.get(env);
    
    if (!envSettings) {
      throw new Error(`環境設定が見つかりません: ${env}`);
    }

    // シークレット情報を分離
    const { config: publicConfig, secrets } = this.separateSecrets(config);

    const configDir = path.dirname(envSettings.configPath);
    await fs.mkdir(configDir, { recursive: true });

    if (envSettings.encrypted) {
      // 暗号化して保存
      const password = await this.getEnvironmentPassword(env);
      await this.encryptionManager.encryptFile(
        envSettings.configPath,
        JSON.stringify(publicConfig, null, 2),
        password
      );

      // シークレット情報も暗号化して保存
      if (envSettings.secretsPath && Object.keys(secrets).length > 0) {
        await this.encryptionManager.encryptFile(
          envSettings.secretsPath,
          JSON.stringify(secrets, null, 2),
          password
        );
      }
    } else {
      // 平文で保存
      await fs.writeFile(envSettings.configPath, JSON.stringify(publicConfig, null, 2));
    }
  }

  /**
   * シークレット情報を読み込み
   */
  private async loadSecrets(environment: string): Promise<any> {
    const envSettings = this.environments.get(environment);
    
    if (!envSettings?.secretsPath) {
      return {};
    }

    try {
      const password = await this.getEnvironmentPassword(environment);
      const secretsData = await this.encryptionManager.decryptFile(envSettings.secretsPath, password);
      return JSON.parse(secretsData);
    } catch (error) {
      console.warn(`シークレット情報の読み込みに失敗しました: ${error.message}`);
      return {};
    }
  }

  /**
   * 設定からシークレット情報を分離
   */
  private separateSecrets(config: CPOSConfig): { config: CPOSConfig; secrets: any } {
    const secrets: any = {};
    const publicConfig = JSON.parse(JSON.stringify(config)); // Deep copy

    // EC2環境のシークレット情報を分離
    if (publicConfig.environments.ec2.keyPath) {
      secrets.ec2KeyPath = publicConfig.environments.ec2.keyPath;
      publicConfig.environments.ec2.keyPath = '${EC2_KEY_PATH}';
    }

    if (publicConfig.environments.ec2.host) {
      secrets.ec2Host = publicConfig.environments.ec2.host;
      publicConfig.environments.ec2.host = '${EC2_HOST}';
    }

    return { config: publicConfig, secrets };
  }

  /**
   * シークレット情報を設定にマージ
   */
  private mergeSecrets(config: CPOSConfig, secrets: any): CPOSConfig {
    const mergedConfig = JSON.parse(JSON.stringify(config)); // Deep copy

    // 環境変数またはシークレットから値を復元
    if (secrets.ec2KeyPath) {
      mergedConfig.environments.ec2.keyPath = secrets.ec2KeyPath;
    } else if (process.env.EC2_KEY_PATH) {
      mergedConfig.environments.ec2.keyPath = process.env.EC2_KEY_PATH;
    }

    if (secrets.ec2Host) {
      mergedConfig.environments.ec2.host = secrets.ec2Host;
    } else if (process.env.EC2_HOST) {
      mergedConfig.environments.ec2.host = process.env.EC2_HOST;
    }

    return mergedConfig;
  }

  /**
   * 環境用のパスワードを取得
   */
  private async getEnvironmentPassword(environment: string): Promise<string> {
    // 環境変数からパスワードを取得
    const envVar = `CPOS_${environment.toUpperCase()}_PASSWORD`;
    const password = process.env[envVar];

    if (!password) {
      throw new Error(`環境変数 ${envVar} が設定されていません`);
    }

    // パスワードの強度をチェック
    const validation = this.encryptionManager.validatePassword(password);
    if (!validation.valid) {
      throw new Error(`パスワードが要件を満たしていません: ${validation.message}`);
    }

    return password;
  }

  /**
   * 環境設定を初期化
   */
  async initializeEnvironment(environment: string, password?: string): Promise<void> {
    const envSettings = this.environments.get(environment);
    
    if (!envSettings) {
      throw new Error(`未知の環境です: ${environment}`);
    }

    // 設定ファイルが存在しない場合は作成
    try {
      await fs.access(envSettings.configPath);
    } catch {
      console.log(`環境 ${environment} の設定ファイルを作成します`);
      
      const defaultConfig = this.configManager.getDefaultConfig();
      
      if (envSettings.encrypted) {
        if (!password) {
          password = this.encryptionManager.generatePassword();
          console.log(`生成されたパスワード (${environment}): ${password}`);
          console.log(`環境変数 CPOS_${environment.toUpperCase()}_PASSWORD に設定してください`);
        }
        
        await this.encryptionManager.encryptFile(
          envSettings.configPath,
          JSON.stringify(defaultConfig, null, 2),
          password
        );
      } else {
        const configDir = path.dirname(envSettings.configPath);
        await fs.mkdir(configDir, { recursive: true });
        await fs.writeFile(envSettings.configPath, JSON.stringify(defaultConfig, null, 2));
      }
    }
  }

  /**
   * 利用可能な環境一覧を取得
   */
  getAvailableEnvironments(): string[] {
    return Array.from(this.environments.keys());
  }

  /**
   * 環境設定の詳細を取得
   */
  getEnvironmentSettings(environment: string): EnvironmentSettings | undefined {
    return this.environments.get(environment);
  }

  /**
   * 設定ファイルの存在確認
   */
  async checkEnvironmentConfig(environment: string): Promise<boolean> {
    const envSettings = this.environments.get(environment);
    
    if (!envSettings) {
      return false;
    }

    try {
      await fs.access(envSettings.configPath);
      return true;
    } catch {
      return false;
    }
  }
}