/**
 * AIスタック（削除予定 - EmbeddingStackに統合）
 * 
 * 注意: このスタックは独立したスタックとしては使用されません。
 * Bedrock Agent機能はEmbeddingStackに統合されています。
 * 
 * モジュラーアーキテクチャの6つの統合スタック:
 * 1. NetworkingStack - ネットワーク基盤
 * 2. SecurityStack - セキュリティ統合
 * 3. DataStack - データ・ストレージ統合
 * 4. EmbeddingStack - Embedding処理・バッチワークロード・AI統合（Bedrock Agent含む）
 * 5. WebAppStack - API・フロントエンド統合
 * 6. OperationsStack - 監視・エンタープライズ統合
 * 
 * @deprecated EmbeddingStackを使用してください
 */

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface AIStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
}

/**
 * @deprecated このスタックは使用されません。EmbeddingStackを使用してください。
 */
export class AIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AIStackProps) {
    super(scope, id, props);

    // 警告メッセージ
    new cdk.CfnOutput(this, 'DeprecationWarning', {
      value: 'このスタックは非推奨です。EmbeddingStackを使用してください。',
      description: 'Deprecation Warning',
    });
  }
}
