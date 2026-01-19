/**
 * ネットワーキング設定のデフォルト値
 */
import { NetworkingConfig } from '../modules/networking';
export declare const DEFAULT_NETWORKING_CONFIG: NetworkingConfig;
/**
 * 環境別設定のファクトリー関数
 */
export declare function createNetworkingConfig(environment: 'dev' | 'staging' | 'prod' | 'test', overrides?: Partial<NetworkingConfig>): NetworkingConfig;
