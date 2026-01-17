/**
 * 本番環境リソース設定テンプレート
 * 
 * このファイルをコピーして production-resources.ts として使用し、
 * 実際の環境に応じて値を設定してください。
 */

export interface ProductionResourcesConfig {
  // ネットワーク設定
  networking: {
    existingVpcId?: string;
    availabilityZones: string[];
    privateSubnetIds: string[];
    publicSubnetIds: string[];
  };

  // ストレージ設定
  storage: {
    existingDocumentsBucket?: string;
    existingEmbeddingsBucket?: string;
  };

  // データベース設定
  database: {
    existingSessionTable?: string;
  };

  // セキュリティ設定
  security: {
    existingKmsKeyArn?: string;
  };
}

// テンプレート設定（実際の値に置き換えてください）
export const productionResourcesTemplate: ProductionResourcesConfig = {
  networking: {
    existingVpcId: process.env.EXISTING_VPC_ID,
    availabilityZones: ['ap-northeast-1a', 'ap-northeast-1c', 'ap-northeast-1d'],
    privateSubnetIds: process.env.EXISTING_PRIVATE_SUBNET_IDS?.split(',') || [],
    publicSubnetIds: process.env.EXISTING_PUBLIC_SUBNET_IDS?.split(',') || [],
  },

  storage: {
    existingDocumentsBucket: process.env.EXISTING_DOCUMENTS_BUCKET,
    existingEmbeddingsBucket: process.env.EXISTING_EMBEDDINGS_BUCKET,
  },

  database: {
    existingSessionTable: process.env.EXISTING_SESSION_TABLE,
  },

  security: {
    existingKmsKeyArn: process.env.EXISTING_KMS_KEY_ARN,
  },
};