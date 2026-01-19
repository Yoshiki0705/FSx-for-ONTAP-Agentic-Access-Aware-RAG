/**
 * WebAppスタンドアローンモード設定
 *
 * WebAppStackを独立してデプロイする際の設定を定義します。
 * 他のスタック（Networking, Security）に依存せず、
 * 必要なリソースを自動作成します。
 */
import { WebAppStackConfig } from '../interfaces/webapp-stack-config';
/**
 * 東京リージョン - WebAppスタンドアローン設定
 */
export declare const tokyoWebAppStandaloneConfig: WebAppStackConfig;
/**
 * 東京リージョン - WebAppスタンドアローン設定（既存VPC使用）
 */
export declare const tokyoWebAppStandaloneWithExistingVpcConfig: WebAppStackConfig;
/**
 * 東京リージョン - WebAppスタンドアローン設定（ECRのみ）
 */
export declare const tokyoWebAppStandaloneEcrOnlyConfig: WebAppStackConfig;
/**
 * 東京リージョン - WebAppスタンドアローン設定（デバッグモード）
 */
export declare const tokyoWebAppStandaloneDebugConfig: WebAppStackConfig;
