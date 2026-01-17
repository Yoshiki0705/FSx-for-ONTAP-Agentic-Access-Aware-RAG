/**
 * WebAppStack設定アダプター
 * EnvironmentConfigをWebAppStackConfigに変換
 */

import { EnvironmentConfig } from '../interfaces/environment-config';
import { WebAppStackConfig } from '../../stacks/integrated/webapp-stack';

/**
 * EnvironmentConfigをWebAppStackConfigに変換
 * WebAppStackConfigは柔軟な型定義のため、EnvironmentConfigをそのまま返す
 */
export function adaptWebAppConfig(envConfig: EnvironmentConfig): WebAppStackConfig {
  return envConfig as any; // WebAppStackConfigは[key: string]: anyを許可
}
