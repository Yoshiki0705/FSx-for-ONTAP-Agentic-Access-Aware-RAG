"use strict";
/**
 * Environment Manager
 * 環境別設定の管理と暗号化対応
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvironmentManager = void 0;
const index_1 = require("./index");
const encryption_1 = require("../../utils/encryption");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class EnvironmentManager {
    configManager;
    encryptionManager;
    environments = new Map();
    currentEnvironment = 'local';
    constructor() {
        this.configManager = new index_1.ConfigurationManager();
        this.encryptionManager = new encryption_1.EncryptionManager();
        // デフォルト環境を設定
        this.setupDefaultEnvironments();
    }
    /**
     * デフォルト環境を設定
     */
    setupDefaultEnvironments() {
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
    setCurrentEnvironment(environment) {
        if (!this.environments.has(environment)) {
            throw new Error(`未知の環境です: ${environment}`);
        }
        this.currentEnvironment = environment;
    }
    /**
     * 現在の環境を取得
     */
    getCurrentEnvironment() {
        return this.currentEnvironment;
    }
    /**
     * 環境設定を読み込み
     */
    async loadEnvironmentConfig(environment) {
        const env = environment || this.currentEnvironment;
        const envSettings = this.environments.get(env);
        if (!envSettings) {
            throw new Error(`環境設定が見つかりません: ${env}`);
        }
        try {
            let configData;
            if (envSettings.encrypted) {
                // 暗号化された設定ファイルを読み込み
                const password = await this.getEnvironmentPassword(env);
                configData = await this.encryptionManager.decryptFile(envSettings.configPath, password);
            }
            else {
                // 平文の設定ファイルを読み込み
                configData = await fs.readFile(envSettings.configPath, 'utf-8');
            }
            const config = JSON.parse(configData);
            // シークレット情報を読み込み（存在する場合）
            if (envSettings.secretsPath) {
                const secrets = await this.loadSecrets(env);
                const mergedConfig = this.mergeSecrets(config, secrets);
                return mergedConfig;
            }
        }
        catch (error) {
            console.warn(`環境設定の読み込みに失敗しました (${env}): ${error.message}`);
            console.log('デフォルト設定を使用します');
            return this.configManager.getDefaultConfig();
        }
    }
    /**
     * 環境設定を保存
     */
    async saveEnvironmentConfig(config, environment) {
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
            await this.encryptionManager.encryptFile(envSettings.configPath, JSON.stringify(publicConfig, null, 2), password);
            // シークレット情報も暗号化して保存
            if (envSettings.secretsPath && Object.keys(secrets).length > 0) {
                await this.encryptionManager.encryptFile(envSettings.secretsPath, JSON.stringify(secrets, null, 2), password);
            }
        }
        else {
            // 平文で保存
            await fs.writeFile(envSettings.configPath, JSON.stringify(publicConfig, null, 2));
        }
    }
    /**
     * シークレット情報を読み込み
     */
    async loadSecrets(environment) {
        const envSettings = this.environments.get(environment);
        if (!envSettings?.secretsPath) {
            return {};
        }
        try {
            const password = await this.getEnvironmentPassword(environment);
            const secretsData = await this.encryptionManager.decryptFile(envSettings.secretsPath, password);
            return JSON.parse(secretsData);
        }
        catch (error) {
            console.warn(`シークレット情報の読み込みに失敗しました: ${error.message}`);
            return {};
        }
    }
    /**
     * 設定からシークレット情報を分離
     */
    separateSecrets(config) {
        const secrets = {};
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
    mergeSecrets(config, secrets) {
        const mergedConfig = JSON.parse(JSON.stringify(config)); // Deep copy
        // 環境変数またはシークレットから値を復元
        if (secrets.ec2KeyPath) {
            mergedConfig.environments.ec2.keyPath = secrets.ec2KeyPath;
        }
        else if (process.env.EC2_KEY_PATH) {
            mergedConfig.environments.ec2.keyPath = process.env.EC2_KEY_PATH;
        }
        if (secrets.ec2Host) {
            mergedConfig.environments.ec2.host = secrets.ec2Host;
        }
        else if (process.env.EC2_HOST) {
            mergedConfig.environments.ec2.host = process.env.EC2_HOST;
        }
        return mergedConfig;
    }
    /**
     * 環境用のパスワードを取得
     */
    async getEnvironmentPassword(environment) {
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
    async initializeEnvironment(environment, password) {
        const envSettings = this.environments.get(environment);
        if (!envSettings) {
            throw new Error(`未知の環境です: ${environment}`);
        }
        // 設定ファイルが存在しない場合は作成
        try {
            await fs.access(envSettings.configPath);
        }
        catch {
            console.log(`環境 ${environment} の設定ファイルを作成します`);
            const defaultConfig = this.configManager.getDefaultConfig();
            if (envSettings.encrypted) {
                if (!password) {
                    password = this.encryptionManager.generatePassword();
                    console.log(`生成されたパスワード (${environment}): ${password}`);
                    console.log(`環境変数 CPOS_${environment.toUpperCase()}_PASSWORD に設定してください`);
                }
                await this.encryptionManager.encryptFile(envSettings.configPath, JSON.stringify(defaultConfig, null, 2), password);
            }
            else {
                const configDir = path.dirname(envSettings.configPath);
                await fs.mkdir(configDir, { recursive: true });
                await fs.writeFile(envSettings.configPath, JSON.stringify(defaultConfig, null, 2));
            }
        }
    }
    /**
     * 利用可能な環境一覧を取得
     */
    getAvailableEnvironments() {
        return Array.from(this.environments.keys());
    }
    /**
     * 環境設定の詳細を取得
     */
    getEnvironmentSettings(environment) {
        return this.environments.get(environment);
    }
    /**
     * 設定ファイルの存在確認
     */
    async checkEnvironmentConfig(environment) {
        const envSettings = this.environments.get(environment);
        if (!envSettings) {
            return false;
        }
        try {
            await fs.access(envSettings.configPath);
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.EnvironmentManager = EnvironmentManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW52aXJvbm1lbnQtbWFuYWdlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImVudmlyb25tZW50LW1hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7R0FHRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxtQ0FBOEU7QUFDOUUsdURBQTJEO0FBQzNELGdEQUFrQztBQUNsQywyQ0FBNkI7QUFTN0IsTUFBYSxrQkFBa0I7SUFDckIsYUFBYSxDQUF1QjtJQUNwQyxpQkFBaUIsQ0FBb0I7SUFDckMsWUFBWSxHQUFxQyxJQUFJLEdBQUcsRUFBRSxDQUFDO0lBQzNELGtCQUFrQixHQUFXLE9BQU8sQ0FBQztJQUU3QztRQUNFLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSw0QkFBb0IsRUFBRSxDQUFDO1FBQ2hELElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLDhCQUFpQixFQUFFLENBQUM7UUFFakQsYUFBYTtRQUNiLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO0lBQ2xDLENBQUM7SUFFRDs7T0FFRztJQUNLLHdCQUF3QjtRQUM5QixJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUU7WUFDN0IsSUFBSSxFQUFFLE9BQU87WUFDYixTQUFTLEVBQUUsS0FBSztZQUNoQixVQUFVLEVBQUUsNEJBQTRCO1NBQ3pDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRTtZQUNuQyxJQUFJLEVBQUUsYUFBYTtZQUNuQixTQUFTLEVBQUUsS0FBSztZQUNoQixVQUFVLEVBQUUsa0NBQWtDO1NBQy9DLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRTtZQUMvQixJQUFJLEVBQUUsU0FBUztZQUNmLFNBQVMsRUFBRSxJQUFJO1lBQ2YsVUFBVSxFQUFFLGtDQUFrQztZQUM5QyxXQUFXLEVBQUUsbUNBQW1DO1NBQ2pELENB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T0FFRztJQUNILHdCQUF3QjtRQUN0QixPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFFRDs7T0FFRztJQUNILHNCQUFzQixDQUFDLFdBQW1CO1FBQ3hDLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLHNCQUFzQixDQUFDLFdBQW1CO1FBQzlDLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRXZELElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUNqQixPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7UUFFRCxJQUFJLENBQUM7WUFDSCxNQUFNLEVBQUUsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3hDLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUFDLE1BQU0sQ0FBQztZQUNQLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztJQUNILENBQUM7Q0FDRjtBQTlTRCxnREE4U0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEVudmlyb25tZW50IE1hbmFnZXJcbiAqIOeSsOWig+WIpeioreWumuOBrueuoeeQhuOBqOaal+WPt+WMluWvvuW/nFxuICovXG5cbmltcG9ydCB7IENvbmZpZ3VyYXRpb25NYW5hZ2VyLCBDUE9TQ29uZmlnLCBFbnZpcm9ubWVudENvbmZpZyB9IGZyb20gJy4vaW5kZXgnO1xuaW1wb3J0IHsgRW5jcnlwdGlvbk1hbmFnZXIgfSBmcm9tICcuLi8uLi91dGlscy9lbmNyeXB0aW9uJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzL3Byb21pc2VzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRW52aXJvbm1lbnRTZXR0aW5ncyB7XG4gIG5hbWU6IHN0cmluZztcbiAgZW5jcnlwdGVkOiBib29sZWFuO1xuICBjb25maWdQYXRoOiBzdHJpbmc7XG4gIHNlY3JldHNQYXRoPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgRW52aXJvbm1lbnRNYW5hZ2VyIHtcbiAgcHJpdmF0ZSBjb25maWdNYW5hZ2VyOiBDb25maWd1cmF0aW9uTWFuYWdlcjtcbiAgcHJpdmF0ZSBlbmNyeXB0aW9uTWFuYWdlcjogRW5jcnlwdGlvbk1hbmFnZXI7XG4gIHByaXZhdGUgZW52aXJvbm1lbnRzOiBNYXA8c3RyaW5nLCBFbnZpcm9ubWVudFNldHRpbmdzPiA9IG5ldyBNYXAoKTtcbiAgcHJpdmF0ZSBjdXJyZW50RW52aXJvbm1lbnQ6IHN0cmluZyA9ICdsb2NhbCc7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5jb25maWdNYW5hZ2VyID0gbmV3IENvbmZpZ3VyYXRpb25NYW5hZ2VyKCk7XG4gICAgdGhpcy5lbmNyeXB0aW9uTWFuYWdlciA9IG5ldyBFbmNyeXB0aW9uTWFuYWdlcigpO1xuICAgIFxuICAgIC8vIOODh+ODleOCqeODq+ODiOeSsOWig+OCkuioreWumlxuICAgIHRoaXMuc2V0dXBEZWZhdWx0RW52aXJvbm1lbnRzKCk7XG4gIH1cblxuICAvKipcbiAgICog44OH44OV44Kp44Or44OI55Kw5aKD44KS6Kit5a6aXG4gICAqL1xuICBwcml2YXRlIHNldHVwRGVmYXVsdEVudmlyb25tZW50cygpOiB2b2lkIHtcbiAgICB0aGlzLmVudmlyb25tZW50cy5zZXQoJ2xvY2FsJywge1xuICAgICAgbmFtZTogJ2xvY2FsJyxcbiAgICAgIGVuY3J5cHRlZDogZmFsc2UsXG4gICAgICBjb25maWdQYXRoOiAnLi9jb25maWcvbG9jYWwuY29uZmlnLmpzb24nXG4gICAgfSk7XG5cbiAgICB0aGlzLmVudmlyb25tZW50cy5zZXQoJ2RldmVsb3BtZW50Jywge1xuICAgICAgbmFtZTogJ2RldmVsb3BtZW50JyxcbiAgICAgIGVuY3J5cHRlZDogZmFsc2UsXG4gICAgICBjb25maWdQYXRoOiAnLi9jb25maWcvZGV2ZWxvcG1lbnQuY29uZmlnLmpzb24nXG4gICAgfSk7XG5cbiAgICB0aGlzLmVudmlyb25tZW50cy5zZXQoJ3N0YWdpbmcnLCB7XG4gICAgICBuYW1lOiAnc3RhZ2luZycsXG4gICAgICBlbmNyeXB0ZWQ6IHRydWUsXG4gICAgICBjb25maWdQYXRoOiAnLi9jb25maWcvc3RhZ2luZy5jb25maWcuanNvbi5lbmMnLFxuICAgICAgc2VjcmV0c1BhdGg6ICcuL2NvbmZpZy9zdGFnaW5nLnNlY3JldHMuanNvbi5lbmMnXG4gICAgfSk7XG5cbiAgICB0aGlzLmVudmlyb25tZW50cy5zZXQoJ3Byb2R1Y3Rpb24nLCB7XG4gICAgICBuYW1lOiAncHJvZHVjdGlvbicsXG4gICAgICBlbmNyeXB0ZWQ6IHRydWUsXG4gICAgICBjb25maWdQYXRoOiAnLi9jb25maWcvcHJvZHVjdGlvbi5jb25maWcuanNvbi5lbmMnLFxuICAgICAgc2VjcmV0c1BhdGg6ICcuL2NvbmZpZy9wcm9kdWN0aW9uLnNlY3JldHMuanNvbi5lbmMnXG4gICAgfSk7XG5cbiAgICB0aGlzLmVudmlyb25tZW50cy5zZXQoJ2VjMicsIHtcbiAgICAgIG5hbWU6ICdlYzInLFxuICAgICAgZW5jcnlwdGVkOiB0cnVlLFxuICAgICAgY29uZmlnUGF0aDogJy4vY29uZmlnL2VjMi5jb25maWcuanNvbi5lbmMnLFxuICAgICAgc2VjcmV0c1BhdGg6ICcuL2NvbmZpZy9lYzIuc2VjcmV0cy5qc29uLmVuYydcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDnj77lnKjjga7nkrDlooPjgpLoqK3lrppcbiAgICovXG4gIHNldEN1cnJlbnRFbnZpcm9ubWVudChlbnZpcm9ubWVudDogc3RyaW5nKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmVudmlyb25tZW50cy5oYXMoZW52aXJvbm1lbnQpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYOacquefpeOBrueSsOWig+OBp+OBmTogJHtlbnZpcm9ubWVudH1gKTtcbiAgICB9XG4gICAgdGhpcy5jdXJyZW50RW52aXJvbm1lbnQgPSBlbnZpcm9ubWVudDtcbiAgfVxuXG4gIC8qKlxuICAgKiDnj77lnKjjga7nkrDlooPjgpLlj5blvpdcbiAgICovXG4gIGdldEN1cnJlbnRFbnZpcm9ubWVudCgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLmN1cnJlbnRFbnZpcm9ubWVudDtcbiAgfVxuXG4gIC8qKlxuICAgKiDnkrDlooPoqK3lrprjgpLoqq3jgb/ovrzjgb9cbiAgICovXG4gIGFzeW5jIGxvYWRFbnZpcm9ubWVudENvbmZpZyhlbnZpcm9ubWVudD86IHN0cmluZyk6IFByb21pc2U8Q1BPU0NvbmZpZz4ge1xuICAgIGNvbnN0IGVudiA9IGVudmlyb25tZW50IHx8IHRoaXMuY3VycmVudEVudmlyb25tZW50O1xuICAgIGNvbnN0IGVudlNldHRpbmdzID0gdGhpcy5lbnZpcm9ubWVudHMuZ2V0KGVudik7XG4gICAgXG4gICAgaWYgKCFlbnZTZXR0aW5ncykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGDnkrDlooPoqK3lrprjgYzopovjgaTjgYvjgorjgb7jgZvjgpM6ICR7ZW52fWApO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBsZXQgY29uZmlnRGF0YTogc3RyaW5nO1xuXG4gICAgICBpZiAoZW52U2V0dGluZ3MuZW5jcnlwdGVkKSB7XG4gICAgICAgIC8vIOaal+WPt+WMluOBleOCjOOBn+ioreWumuODleOCoeOCpOODq+OCkuiqreOBv+i+vOOBv1xuICAgICAgICBjb25zdCBwYXNzd29yZCA9IGF3YWl0IHRoaXMuZ2V0RW52aXJvbm1lbnRQYXNzd29yZChlbnYpO1xuICAgICAgICBjb25maWdEYXRhID0gYXdhaXQgdGhpcy5lbmNyeXB0aW9uTWFuYWdlci5kZWNyeXB0RmlsZShlbnZTZXR0aW5ncy5jb25maWdQYXRoLCBwYXNzd29yZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyDlubPmlofjga7oqK3lrprjg5XjgqHjgqTjg6vjgpLoqq3jgb/ovrzjgb9cbiAgICAgICAgY29uZmlnRGF0YSA9IGF3YWl0IGZzLnJlYWRGaWxlKGVudlNldHRpbmdzLmNvbmZpZ1BhdGgsICd1dGYtOCcpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjb25maWc6IENQT1NDb25maWcgPSBKU09OLnBhcnNlKGNvbmZpZ0RhdGEpO1xuXG4gICAgICAvLyDjgrfjg7zjgq/jg6zjg4Pjg4jmg4XloLHjgpLoqq3jgb/ovrzjgb/vvIjlrZjlnKjjgZnjgovloLTlkIjvvIlcbiAgICAgIGlmIChlbnZTZXR0aW5ncy5zZWNyZXRzUGF0aCkge1xuICAgICAgICBjb25zdCBzZWNyZXRzID0gYXdhaXQgdGhpcy5sb2FkU2VjcmV0cyhlbnYpO1xuICAgICAgICBjb25zdCBtZXJnZWRDb25maWcgPSB0aGlzLm1lcmdlU2VjcmV0cyhjb25maWcsIHNlY3JldHMpO1xuICAgICAgICByZXR1cm4gbWVyZ2VkQ29uZmlnO1xuICAgICAgfVxuXG5cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS53YXJuKGDnkrDlooPoqK3lrprjga7oqq3jgb/ovrzjgb/jgavlpLHmlZfjgZfjgb7jgZfjgZ8gKCR7ZW52fSk6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgIGNvbnNvbGUubG9nKCfjg4fjg5Xjgqnjg6vjg4joqK3lrprjgpLkvb/nlKjjgZfjgb7jgZknKTtcbiAgICAgIHJldHVybiB0aGlzLmNvbmZpZ01hbmFnZXIuZ2V0RGVmYXVsdENvbmZpZygpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDnkrDlooPoqK3lrprjgpLkv53lrZhcbiAgICovXG4gIGFzeW5jIHNhdmVFbnZpcm9ubWVudENvbmZpZyhjb25maWc6IENQT1NDb25maWcsIGVudmlyb25tZW50Pzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZW52ID0gZW52aXJvbm1lbnQgfHwgdGhpcy5jdXJyZW50RW52aXJvbm1lbnQ7XG4gICAgY29uc3QgZW52U2V0dGluZ3MgPSB0aGlzLmVudmlyb25tZW50cy5nZXQoZW52KTtcbiAgICBcbiAgICBpZiAoIWVudlNldHRpbmdzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYOeSsOWig+ioreWumuOBjOimi+OBpOOBi+OCiuOBvuOBm+OCkzogJHtlbnZ9YCk7XG4gICAgfVxuXG4gICAgLy8g44K344O844Kv44Os44OD44OI5oOF5aCx44KS5YiG6ZuiXG4gICAgY29uc3QgeyBjb25maWc6IHB1YmxpY0NvbmZpZywgc2VjcmV0cyB9ID0gdGhpcy5zZXBhcmF0ZVNlY3JldHMoY29uZmlnKTtcblxuICAgIGNvbnN0IGNvbmZpZ0RpciA9IHBhdGguZGlybmFtZShlbnZTZXR0aW5ncy5jb25maWdQYXRoKTtcbiAgICBhd2FpdCBmcy5ta2Rpcihjb25maWdEaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXG4gICAgaWYgKGVudlNldHRpbmdzLmVuY3J5cHRlZCkge1xuICAgICAgLy8g5pqX5Y+35YyW44GX44Gm5L+d5a2YXG4gICAgICBjb25zdCBwYXNzd29yZCA9IGF3YWl0IHRoaXMuZ2V0RW52aXJvbm1lbnRQYXNzd29yZChlbnYpO1xuICAgICAgYXdhaXQgdGhpcy5lbmNyeXB0aW9uTWFuYWdlci5lbmNyeXB0RmlsZShcbiAgICAgICAgZW52U2V0dGluZ3MuY29uZmlnUGF0aCxcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkocHVibGljQ29uZmlnLCBudWxsLCAyKSxcbiAgICAgICAgcGFzc3dvcmRcbiAgICAgICk7XG5cbiAgICAgIC8vIOOCt+ODvOOCr+ODrOODg+ODiOaDheWgseOCguaal+WPt+WMluOBl+OBpuS/neWtmFxuICAgICAgaWYgKGVudlNldHRpbmdzLnNlY3JldHNQYXRoICYmIE9iamVjdC5rZXlzKHNlY3JldHMpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgYXdhaXQgdGhpcy5lbmNyeXB0aW9uTWFuYWdlci5lbmNyeXB0RmlsZShcbiAgICAgICAgICBlbnZTZXR0aW5ncy5zZWNyZXRzUGF0aCxcbiAgICAgICAgICBKU09OLnN0cmluZ2lmeShzZWNyZXRzLCBudWxsLCAyKSxcbiAgICAgICAgICBwYXNzd29yZFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyDlubPmlofjgafkv53lrZhcbiAgICAgIGF3YWl0IGZzLndyaXRlRmlsZShlbnZTZXR0aW5ncy5jb25maWdQYXRoLCBKU09OLnN0cmluZ2lmeShwdWJsaWNDb25maWcsIG51bGwsIDIpKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog44K344O844Kv44Os44OD44OI5oOF5aCx44KS6Kqt44G/6L6844G/XG4gICAqL1xuICBwcml2YXRlIGFzeW5jIGxvYWRTZWNyZXRzKGVudmlyb25tZW50OiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IGVudlNldHRpbmdzID0gdGhpcy5lbnZpcm9ubWVudHMuZ2V0KGVudmlyb25tZW50KTtcbiAgICBcbiAgICBpZiAoIWVudlNldHRpbmdzPy5zZWNyZXRzUGF0aCkge1xuICAgICAgcmV0dXJuIHt9O1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBwYXNzd29yZCA9IGF3YWl0IHRoaXMuZ2V0RW52aXJvbm1lbnRQYXNzd29yZChlbnZpcm9ubWVudCk7XG4gICAgICBjb25zdCBzZWNyZXRzRGF0YSA9IGF3YWl0IHRoaXMuZW5jcnlwdGlvbk1hbmFnZXIuZGVjcnlwdEZpbGUoZW52U2V0dGluZ3Muc2VjcmV0c1BhdGgsIHBhc3N3b3JkKTtcbiAgICAgIHJldHVybiBKU09OLnBhcnNlKHNlY3JldHNEYXRhKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS53YXJuKGDjgrfjg7zjgq/jg6zjg4Pjg4jmg4XloLHjga7oqq3jgb/ovrzjgb/jgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgIHJldHVybiB7fTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICog6Kit5a6a44GL44KJ44K344O844Kv44Os44OD44OI5oOF5aCx44KS5YiG6ZuiXG4gICAqL1xuICBwcml2YXRlIHNlcGFyYXRlU2VjcmV0cyhjb25maWc6IENQT1NDb25maWcpOiB7IGNvbmZpZzogQ1BPU0NvbmZpZzsgc2VjcmV0czogYW55IH0ge1xuICAgIGNvbnN0IHNlY3JldHM6IGFueSA9IHt9O1xuICAgIGNvbnN0IHB1YmxpY0NvbmZpZyA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoY29uZmlnKSk7IC8vIERlZXAgY29weVxuXG4gICAgLy8gRUMy55Kw5aKD44Gu44K344O844Kv44Os44OD44OI5oOF5aCx44KS5YiG6ZuiXG4gICAgaWYgKHB1YmxpY0NvbmZpZy5lbnZpcm9ubWVudHMuZWMyLmtleVBhdGgpIHtcbiAgICAgIHNlY3JldHMuZWMyS2V5UGF0aCA9IHB1YmxpY0NvbmZpZy5lbnZpcm9ubWVudHMuZWMyLmtleVBhdGg7XG4gICAgICBwdWJsaWNDb25maWcuZW52aXJvbm1lbnRzLmVjMi5rZXlQYXRoID0gJyR7RUMyX0tFWV9QQVRIfSc7XG4gICAgfVxuXG4gICAgaWYgKHB1YmxpY0NvbmZpZy5lbnZpcm9ubWVudHMuZWMyLmhvc3QpIHtcbiAgICAgIHNlY3JldHMuZWMySG9zdCA9IHB1YmxpY0NvbmZpZy5lbnZpcm9ubWVudHMuZWMyLmhvc3Q7XG4gICAgICBwdWJsaWNDb25maWcuZW52aXJvbm1lbnRzLmVjMi5ob3N0ID0gJyR7RUMyX0hPU1R9JztcbiAgICB9XG5cbiAgICByZXR1cm4geyBjb25maWc6IHB1YmxpY0NvbmZpZywgc2VjcmV0cyB9O1xuICB9XG5cbiAgLyoqXG4gICAqIOOCt+ODvOOCr+ODrOODg+ODiOaDheWgseOCkuioreWumuOBq+ODnuODvOOCuFxuICAgKi9cbiAgcHJpdmF0ZSBtZXJnZVNlY3JldHMoY29uZmlnOiBDUE9TQ29uZmlnLCBzZWNyZXRzOiBhbnkpOiBDUE9TQ29uZmlnIHtcbiAgICBjb25zdCBtZXJnZWRDb25maWcgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGNvbmZpZykpOyAvLyBEZWVwIGNvcHlcblxuICAgIC8vIOeSsOWig+WkieaVsOOBvuOBn+OBr+OCt+ODvOOCr+ODrOODg+ODiOOBi+OCieWApOOCkuW+qeWFg1xuICAgIGlmIChzZWNyZXRzLmVjMktleVBhdGgpIHtcbiAgICAgIG1lcmdlZENvbmZpZy5lbnZpcm9ubWVudHMuZWMyLmtleVBhdGggPSBzZWNyZXRzLmVjMktleVBhdGg7XG4gICAgfSBlbHNlIGlmIChwcm9jZXNzLmVudi5FQzJfS0VZX1BBVEgpIHtcbiAgICAgIG1lcmdlZENvbmZpZy5lbnZpcm9ubWVudHMuZWMyLmtleVBhdGggPSBwcm9jZXNzLmVudi5FQzJfS0VZX1BBVEg7XG4gICAgfVxuXG4gICAgaWYgKHNlY3JldHMuZWMySG9zdCkge1xuICAgICAgbWVyZ2VkQ29uZmlnLmVudmlyb25tZW50cy5lYzIuaG9zdCA9IHNlY3JldHMuZWMySG9zdDtcbiAgICB9IGVsc2UgaWYgKHByb2Nlc3MuZW52LkVDMl9IT1NUKSB7XG4gICAgICBtZXJnZWRDb25maWcuZW52aXJvbm1lbnRzLmVjMi5ob3N0ID0gcHJvY2Vzcy5lbnYuRUMyX0hPU1Q7XG4gICAgfVxuXG4gICAgcmV0dXJuIG1lcmdlZENvbmZpZztcbiAgfVxuXG4gIC8qKlxuICAgKiDnkrDlooPnlKjjga7jg5Hjgrnjg6/jg7zjg4njgpLlj5blvpdcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgZ2V0RW52aXJvbm1lbnRQYXNzd29yZChlbnZpcm9ubWVudDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICAvLyDnkrDlooPlpInmlbDjgYvjgonjg5Hjgrnjg6/jg7zjg4njgpLlj5blvpdcbiAgICBjb25zdCBlbnZWYXIgPSBgQ1BPU18ke2Vudmlyb25tZW50LnRvVXBwZXJDYXNlKCl9X1BBU1NXT1JEYDtcbiAgICBjb25zdCBwYXNzd29yZCA9IHByb2Nlc3MuZW52W2VudlZhcl07XG5cbiAgICBpZiAoIXBhc3N3b3JkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYOeSsOWig+WkieaVsCAke2VudlZhcn0g44GM6Kit5a6a44GV44KM44Gm44GE44G+44Gb44KTYCk7XG4gICAgfVxuXG4gICAgLy8g44OR44K544Ov44O844OJ44Gu5by35bqm44KS44OB44Kn44OD44KvXG4gICAgY29uc3QgdmFsaWRhdGlvbiA9IHRoaXMuZW5jcnlwdGlvbk1hbmFnZXIudmFsaWRhdGVQYXNzd29yZChwYXNzd29yZCk7XG4gICAgaWYgKCF2YWxpZGF0aW9uLnZhbGlkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYOODkeOCueODr+ODvOODieOBjOimgeS7tuOCkua6gOOBn+OBl+OBpuOBhOOBvuOBm+OCkzogJHt2YWxpZGF0aW9uLm1lc3NhZ2V9YCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHBhc3N3b3JkO1xuICB9XG5cbiAgLyoqXG4gICAqIOeSsOWig+ioreWumuOCkuWIneacn+WMllxuICAgKi9cbiAgYXN5bmMgaW5pdGlhbGl6ZUVudmlyb25tZW50KGVudmlyb25tZW50OiBzdHJpbmcsIHBhc3N3b3JkPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZW52U2V0dGluZ3MgPSB0aGlzLmVudmlyb25tZW50cy5nZXQoZW52aXJvbm1lbnQpO1xuICAgIFxuICAgIGlmICghZW52U2V0dGluZ3MpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihg5pyq55+l44Gu55Kw5aKD44Gn44GZOiAke2Vudmlyb25tZW50fWApO1xuICAgIH1cblxuICAgIC8vIOioreWumuODleOCoeOCpOODq+OBjOWtmOWcqOOBl+OBquOBhOWgtOWQiOOBr+S9nOaIkFxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBmcy5hY2Nlc3MoZW52U2V0dGluZ3MuY29uZmlnUGF0aCk7XG4gICAgfSBjYXRjaCB7XG4gICAgICBjb25zb2xlLmxvZyhg55Kw5aKDICR7ZW52aXJvbm1lbnR9IOOBruioreWumuODleOCoeOCpOODq+OCkuS9nOaIkOOBl+OBvuOBmWApO1xuICAgICAgXG4gICAgICBjb25zdCBkZWZhdWx0Q29uZmlnID0gdGhpcy5jb25maWdNYW5hZ2VyLmdldERlZmF1bHRDb25maWcoKTtcbiAgICAgIFxuICAgICAgaWYgKGVudlNldHRpbmdzLmVuY3J5cHRlZCkge1xuICAgICAgICBpZiAoIXBhc3N3b3JkKSB7XG4gICAgICAgICAgcGFzc3dvcmQgPSB0aGlzLmVuY3J5cHRpb25NYW5hZ2VyLmdlbmVyYXRlUGFzc3dvcmQoKTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhg55Sf5oiQ44GV44KM44Gf44OR44K544Ov44O844OJICgke2Vudmlyb25tZW50fSk6ICR7cGFzc3dvcmR9YCk7XG4gICAgICAgICAgY29uc29sZS5sb2coYOeSsOWig+WkieaVsCBDUE9TXyR7ZW52aXJvbm1lbnQudG9VcHBlckNhc2UoKX1fUEFTU1dPUkQg44Gr6Kit5a6a44GX44Gm44GP44Gg44GV44GEYCk7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIGF3YWl0IHRoaXMuZW5jcnlwdGlvbk1hbmFnZXIuZW5jcnlwdEZpbGUoXG4gICAgICAgICAgZW52U2V0dGluZ3MuY29uZmlnUGF0aCxcbiAgICAgICAgICBKU09OLnN0cmluZ2lmeShkZWZhdWx0Q29uZmlnLCBudWxsLCAyKSxcbiAgICAgICAgICBwYXNzd29yZFxuICAgICAgICApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgY29uZmlnRGlyID0gcGF0aC5kaXJuYW1lKGVudlNldHRpbmdzLmNvbmZpZ1BhdGgpO1xuICAgICAgICBhd2FpdCBmcy5ta2Rpcihjb25maWdEaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICBhd2FpdCBmcy53cml0ZUZpbGUoZW52U2V0dGluZ3MuY29uZmlnUGF0aCwgSlNPTi5zdHJpbmdpZnkoZGVmYXVsdENvbmZpZywgbnVsbCwgMikpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiDliKnnlKjlj6/og73jgarnkrDlooPkuIDopqfjgpLlj5blvpdcbiAgICovXG4gIGdldEF2YWlsYWJsZUVudmlyb25tZW50cygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5lbnZpcm9ubWVudHMua2V5cygpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDnkrDlooPoqK3lrprjga7oqbPntLDjgpLlj5blvpdcbiAgICovXG4gIGdldEVudmlyb25tZW50U2V0dGluZ3MoZW52aXJvbm1lbnQ6IHN0cmluZyk6IEVudmlyb25tZW50U2V0dGluZ3MgfCB1bmRlZmluZWQge1xuICAgIHJldHVybiB0aGlzLmVudmlyb25tZW50cy5nZXQoZW52aXJvbm1lbnQpO1xuICB9XG5cbiAgLyoqXG4gICAqIOioreWumuODleOCoeOCpOODq+OBruWtmOWcqOeiuuiqjVxuICAgKi9cbiAgYXN5bmMgY2hlY2tFbnZpcm9ubWVudENvbmZpZyhlbnZpcm9ubWVudDogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgY29uc3QgZW52U2V0dGluZ3MgPSB0aGlzLmVudmlyb25tZW50cy5nZXQoZW52aXJvbm1lbnQpO1xuICAgIFxuICAgIGlmICghZW52U2V0dGluZ3MpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgZnMuYWNjZXNzKGVudlNldHRpbmdzLmNvbmZpZ1BhdGgpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG59Il19