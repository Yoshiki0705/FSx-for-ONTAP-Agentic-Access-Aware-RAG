/**
 * NetworkingConfig アダプター
 *
 * EnvironmentConfigのnetworking設定をNetworkingConfigインターフェースに変換
 */
import { NetworkingConfig } from '../../modules/networking/interfaces/networking-config';
/**
 * EnvironmentConfigからNetworkingConfigを生成
 */
export declare function adaptNetworkingConfig(envConfig: any): NetworkingConfig;
