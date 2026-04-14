/**
 * KB Config Strategy
 *
 * Registry から取得したモデル定義に基づいて、
 * KB の IAM ポリシー、Lambda 環境変数、CfnOutput を動的に構成する。
 */

import * as iam from 'aws-cdk-lib/aws-iam';
import { EmbeddingModelDefinition } from './embedding-model-registry';

export interface KBConfigOutput {
  /** 埋め込みモデル ARN */
  embeddingModelArn: string;
  /** ベクトル次元数 */
  dimensions: number;
  /** モデル固有の IAM ポリシーステートメント */
  iamStatements: iam.PolicyStatement[];
  /** Lambda 環境変数 */
  lambdaEnvVars: Record<string, string>;
  /** CfnOutput 値 */
  cfnOutputs: Record<string, string>;
}

export class KBConfigStrategy {
  constructor(
    private model: EmbeddingModelDefinition,
    private region: string,
    private accountId: string,
  ) {}

  /**
   * KB 構成全体を生成する（モデル非依存）
   */
  buildConfig(): KBConfigOutput {
    return {
      embeddingModelArn: `arn:aws:bedrock:${this.region}::foundation-model/${this.model.modelId}`,
      dimensions: this.model.dimensions,
      iamStatements: this.buildIamStatements(),
      lambdaEnvVars: this.buildLambdaEnvVars(),
      cfnOutputs: this.buildCfnOutputs(),
    };
  }

  /**
   * モデル固有の IAM ポリシーステートメントを生成する。
   * 最小権限の原則に従い、モデル定義の modalities と requiresBdaParser に基づいて
   * IAM アクションを動的に決定する。
   */
  buildIamStatements(): iam.PolicyStatement[] {
    const statements: iam.PolicyStatement[] = [];

    // 埋め込みモデルの InvokeModel 権限
    statements.push(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/${this.model.modelId}`,
        ],
      }),
    );

    // BDA Parser 権限（requiresBdaParser=true のモデルのみ）
    if (this.model.requiresBdaParser) {
      statements.push(
        new iam.PolicyStatement({
          actions: [
            'bedrock:InvokeDataAutomationAsync',
            'bedrock:GetDataAutomationStatus',
          ],
          resources: ['*'],
        }),
      );
    }

    return statements;
  }

  /**
   * Lambda 環境変数を生成する。
   */
  buildLambdaEnvVars(): Record<string, string> {
    const isMultimodal = this.model.modalities.length > 1;
    return {
      EMBEDDING_MODEL: this.model.modelId,
      MULTIMODAL_ENABLED: String(isMultimodal),
      EMBEDDING_MODEL_DISPLAY_NAME: this.model.displayName,
      DUAL_KB_MODE: 'false',
    };
  }

  /**
   * CfnOutput 値を生成する。
   */
  private buildCfnOutputs(): Record<string, string> {
    const isMultimodal = this.model.modalities.length > 1;
    return {
      EmbeddingModelId: this.model.modelId,
      EmbeddingModelDisplayName: this.model.displayName,
      MultimodalEnabled: String(isMultimodal),
      VectorDimensions: String(this.model.dimensions),
      EmbeddingModelNote: 'Embedding model is a deploy-time configuration. Changing it requires KB re-creation and full data re-ingestion.',
    };
  }
}
