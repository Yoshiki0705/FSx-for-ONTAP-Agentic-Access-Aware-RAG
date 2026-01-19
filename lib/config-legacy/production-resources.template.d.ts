/**
 * 本番環境リソース設定テンプレート
 *
 * このファイルをコピーして production-resources.ts として使用し、
 * 実際の環境に応じて値を設定してください。
 */
export interface ProductionResourcesConfig {
    networking: {
        existingVpcId?: string;
        availabilityZones: string[];
        privateSubnetIds: string[];
        publicSubnetIds: string[];
    };
    storage: {
        existingDocumentsBucket?: string;
        existingEmbeddingsBucket?: string;
    };
    database: {
        existingSessionTable?: string;
    };
    security: {
        existingKmsKeyArn?: string;
    };
}
export declare const productionResourcesTemplate: ProductionResourcesConfig;
