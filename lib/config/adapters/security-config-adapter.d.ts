/**
 * SecurityConfig アダプター
 *
 * EnvironmentConfigのsecurity設定をSecurityConfigインターフェースに変換
 * 本番環境に必要な完全なセキュリティ設定を提供
 */
import { SecurityConfig } from '../../modules/security/interfaces/security-config';
/**
 * EnvironmentConfigからSecurityConfigを生成（完全実装）
 */
export declare function adaptSecurityConfig(envConfig: any): SecurityConfig;
