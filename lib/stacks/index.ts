/**
 * CDK Stacks Index
 * 
 * デモスタック系統（lib/stacks/demo/）に一本化。
 * 全てのデプロイは bin/demo-app.ts をエントリーポイントとして使用。
 * 
 * 旧integrated/ルートレベルスタックは lib/stacks/.deprecated/ に移動済み。
 */

export { DemoWafStack } from './demo/demo-waf-stack';
export { DemoNetworkingStack } from './demo/demo-networking-stack';
export { DemoSecurityStack } from './demo/demo-security-stack';
export { DemoStorageStack } from './demo/demo-storage-stack';
export { DemoAIStack } from './demo/demo-ai-stack';
export { DemoWebAppStack } from './demo/demo-webapp-stack';
export { DemoEmbeddingStack } from './demo/demo-embedding-stack';
