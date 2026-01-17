/**
 * ModelAccessVerifier
 * 
 * Amazon Bedrockモデルのアクセス状態を検証するクラス
 * GetFoundationModelAvailability APIを使用してモデルの有効化状態を確認
 */

import { 
  BedrockClient, 
  GetFoundationModelAvailabilityCommand,
  ListFoundationModelAgreementOffersCommand,
  CreateFoundationModelAgreementCommand
} from '@aws-sdk/client-bedrock';

/**
 * モデルアクセス状態
 */
export interface ModelAccessStatus {
  isAccessible: boolean;
  authorizationStatus?: 'AUTHORIZED' | 'NOT_AUTHORIZED';
  entitlementAvailability?: 'AVAILABLE' | 'NOT_AVAILABLE';
  regionAvailability?: 'AVAILABLE' | 'NOT_AVAILABLE';
  errorMessage?: string;
}

/**
 * モデル有効化結果
 */
export interface ModelEnablementResult {
  success: boolean;
  status: 'enabled' | 'pending' | 'failed';
  message: string;
  estimatedWaitTime?: number; // 秒
}

export class ModelAccessVerifier {
  /**
   * モデルのアクセス状態を検証
   * @param modelId - モデルID（例: anthropic.claude-3-5-haiku-20241022-v1:0）
   * @param region - AWSリージョン（例: ap-northeast-1）
   * @returns モデルアクセス状態
   */
  static async verifyModelAccess(
    modelId: string,
    region: string
  ): Promise<ModelAccessStatus> {
    try {
      console.log(`🔍 モデルアクセス検証開始: ${modelId} (${region})`);
      
      const bedrockClient = new BedrockClient({
        region: region,
        requestHandler: {
          requestTimeout: 5000 // 5秒タイムアウト
        }
      });

      const command = new GetFoundationModelAvailabilityCommand({
        modelId: modelId
      });

      const response = await bedrockClient.send(command);

      const isAccessible = 
        response.authorizationStatus === 'AUTHORIZED' &&
        response.entitlementAvailability === 'AVAILABLE' &&
        response.regionAvailability === 'AVAILABLE';

      console.log(`✅ モデルアクセス検証完了: ${modelId}`);
      console.log(`   - 認証状態: ${response.authorizationStatus}`);
      console.log(`   - エンタイトルメント: ${response.entitlementAvailability}`);
      console.log(`   - リージョン: ${response.regionAvailability}`);

      return {
        isAccessible,
        authorizationStatus: response.authorizationStatus as 'AUTHORIZED' | 'NOT_AUTHORIZED',
        entitlementAvailability: response.entitlementAvailability as 'AVAILABLE' | 'NOT_AVAILABLE',
        regionAvailability: response.regionAvailability as 'AVAILABLE' | 'NOT_AVAILABLE'
      };
    } catch (error: any) {
      console.error(`❌ モデルアクセス検証エラー: ${modelId}`, error);
      return {
        isAccessible: false,
        errorMessage: error.message || 'モデルアクセス検証に失敗しました'
      };
    }
  }

  /**
   * モデルアクセスの有効化をポーリング
   * @param modelId - モデルID
   * @param region - AWSリージョン
   * @param maxAttempts - 最大試行回数（デフォルト: 30回 = 5分）
   * @param intervalMs - ポーリング間隔（デフォルト: 10秒）
   * @returns 有効化完了時true、タイムアウト時false
   */
  static async pollModelAccessEnabled(
    modelId: string,
    region: string,
    maxAttempts: number = 30,
    intervalMs: number = 10000
  ): Promise<boolean> {
    console.log(`⏳ モデルアクセス有効化をポーリング開始: ${modelId}`);
    console.log(`   最大試行回数: ${maxAttempts}回、間隔: ${intervalMs}ms`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`   試行 ${attempt}/${maxAttempts}...`);

      const status = await this.verifyModelAccess(modelId, region);

      if (status.isAccessible) {
        console.log(`✅ モデルアクセス有効化完了: ${modelId} (試行 ${attempt}回)`);
        return true;
      }

      if (attempt < maxAttempts) {
        console.log(`   待機中... (${intervalMs}ms)`);
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    console.log(`⏱️ モデルアクセス有効化タイムアウト: ${modelId}`);
    return false;
  }

  /**
   * モデルアクセスを有効化
   * @param modelId - モデルID
   * @param region - AWSリージョン
   * @returns 有効化結果
   */
  static async enableModelAccess(
    modelId: string,
    region: string
  ): Promise<ModelEnablementResult> {
    try {
      console.log(`🚀 モデルアクセス有効化開始: ${modelId} (${region})`);

      const bedrockClient = new BedrockClient({
        region: region,
        requestHandler: {
          requestTimeout: 10000 // 10秒タイムアウト
        }
      });

      // 1. 利用可能な契約オファーを取得
      console.log(`📋 契約オファーを取得中...`);
      const offersCommand = new ListFoundationModelAgreementOffersCommand({
        modelId: modelId
      });
      const offersResponse = await bedrockClient.send(offersCommand);

      if (!offersResponse.modelAgreementOffers || offersResponse.modelAgreementOffers.length === 0) {
        console.error(`❌ 契約オファーが見つかりません: ${modelId}`);
        return {
          success: false,
          status: 'failed',
          message: 'このモデルの契約オファーが見つかりません。AWS Bedrockコンソールから手動で有効化してください。'
        };
      }

      // 2. 最初のオファーで契約を作成
      const offer = offersResponse.modelAgreementOffers[0];
      console.log(`📝 契約を作成中... (Offer ID: ${offer.offerId})`);
      
      const createCommand = new CreateFoundationModelAgreementCommand({
        modelId: modelId,
        offerToken: offer.offerToken
      });

      await bedrockClient.send(createCommand);
      console.log(`✅ 契約作成完了: ${modelId}`);

      // 3. 有効化完了をポーリング
      console.log(`⏳ 有効化完了を待機中...`);
      const isEnabled = await this.pollModelAccessEnabled(modelId, region, 30, 10000);

      if (isEnabled) {
        return {
          success: true,
          status: 'enabled',
          message: `モデル「${modelId}」のアクセスが有効化されました。再度お試しください。`
        };
      } else {
        return {
          success: false,
          status: 'pending',
          message: `モデル「${modelId}」の有効化処理中です。しばらく待ってから再度お試しください。`,
          estimatedWaitTime: 300 // 5分
        };
      }
    } catch (error: any) {
      console.error(`❌ モデルアクセス有効化エラー: ${modelId}`, error);
      
      // エラーメッセージを分析
      const errorMessage = error.message || '';
      
      if (errorMessage.includes('AccessDenied') || errorMessage.includes('UnauthorizedOperation')) {
        return {
          success: false,
          status: 'failed',
          message: 'モデルアクセスを有効化する権限がありません。管理者に依頼してください。'
        };
      }
      
      if (errorMessage.includes('ConflictException')) {
        return {
          success: false,
          status: 'failed',
          message: 'このモデルは既に有効化処理中です。しばらく待ってから再度お試しください。'
        };
      }

      return {
        success: false,
        status: 'failed',
        message: `モデルアクセスの有効化に失敗しました: ${errorMessage}`
      };
    }
  }
}
