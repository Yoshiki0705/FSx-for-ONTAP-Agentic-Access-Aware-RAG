/**
 * ベクトルストア設定
 *
 * OpenSearch ServerlessまたはS3 Vectorsの設定を定義
 */
/**
 * ベクトルストアタイプ
 */
export type VectorStoreType = 'OPENSEARCH_SERVERLESS' | 'S3_VECTORS';
/**
 * ベクトルストア設定インターフェース
 */
export interface VectorStoreConfig {
    /** ベクトルストアタイプ */
    type: VectorStoreType;
    /** OpenSearch Serverless設定（type='OPENSEARCH_SERVERLESS'の場合） */
    opensearch?: {
        collectionName?: string;
        indexName?: string;
        vectorField?: string;
        textField?: string;
        metadataField?: string;
    };
    /** S3 Vectors設定（type='S3_VECTORS'の場合） */
    s3Vectors?: {
        bucketName?: string;
        prefix?: string;
    };
}
/**
 * デフォルトのベクトルストア設定
 */
export declare const DEFAULT_VECTOR_STORE_CONFIG: VectorStoreConfig;
