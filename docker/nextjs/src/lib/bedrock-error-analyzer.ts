/**
 * BedrockErrorAnalyzer
 * 
 * Amazon Bedrockエラーを分析し、ユーザーフレンドリーなエラーメッセージと
 * 利用可能なアクションを生成するクラス
 */

import { ModelAccessVerifier } from './model-access-verifier';
import { UserPermissionsManager } from './user-permissions';

/**
 * エラーアクション
 */
export interface ErrorAction {
  type: 'request_admin' | 'enable_model' | 'change_region' | 'retry';
  label: string;
  enabled: boolean;
  requiresPermission?: 'admin' | 'user';
}

/**
 * エラー分析結果
 */
export interface ErrorAnalysisResult {
  type: 'model_access' | 'region_unavailable' | 'rate_limit' | 'quota' | 'other';
  message: string;
  availableActions: ErrorAction[];
  originalError?: string;
}

/**
 * Bedrockエラーアナライザー
 */
export class BedrockErrorAnalyzer {
  /**
   * エラーパターン: モデルアクセス関連
   */
  private static readonly ACCESS_ERROR_PATTERNS = [
    'AccessDeniedException',
    'ValidationException',
    'ResourceNotFoundException',
    'Internal server error',
    'InternalServerError',
    'model access',
    'not authorized',
    'not available',
    'not enabled'
  ];

  /**
   * エラーパターン: レート制限
   */
  private static readonly RATE_LIMIT_PATTERNS = [
    'throttling',
    'rate limit',
    'ThrottlingException',
    'TooManyRequestsException'
  ];

  /**
   * エラーパターン: クォータ制限
   */
  private static readonly QUOTA_PATTERNS = [
    'quota',
    'limit exceeded',
    'ServiceQuotaExceededException'
  ];

  /**
   * Bedrockエラーを分析
   * @param error - キャッチされたエラーオブジェクト
   * @param modelId - モデルID
   * @param region - AWSリージョン
   * @param userId - ユーザーID
   * @returns エラー分析結果
   */
  static async analyzeBedrockError(
    error: any,
    modelId: string,
    region: string,
    userId: string
  ): Promise<ErrorAnalysisResult> {
    try {
      console.log(`🔍 Bedrockエラー分析開始: ${modelId}`);
      
      const errorMessage = (error.message || '').toLowerCase();
      const errorCode = (error.name || error.code || '').toLowerCase();

      // レート制限エラー
      if (this.isRateLimitError(errorMessage, errorCode)) {
        return this.generateRateLimitError();
      }

      // クォータ制限エラー
      if (this.isQuotaError(errorMessage, errorCode)) {
        return this.generateQuotaError();
      }

      // モデルアクセス関連エラーの可能性
      if (this.shouldVerifyModelAccess(errorMessage, errorCode)) {
        console.log(`🔍 モデルアクセス検証を実行...`);
        
        // モデルアクセス状態を検証
        const accessStatus = await ModelAccessVerifier.verifyModelAccess(modelId, region);
        
        // モデルが未有効化の場合
        if (!accessStatus.isAccessible) {
          // リージョン未対応の場合
          if (accessStatus.regionAvailability === 'NOT_AVAILABLE') {
            return this.generateRegionUnavailableError(modelId, region);
          }
          
          // モデル未有効化の場合
          return await this.generateModelAccessError(
            modelId,
            region,
            userId,
            accessStatus,
            error.message
          );
        }
      }

      // その他のエラー
      return this.generateGenericError(error.message);
    } catch (analysisError: any) {
      console.error(`❌ エラー分析失敗:`, analysisError);
      // 分析失敗時は元のエラーメッセージを返す
      return this.generateGenericError(error.message);
    }
  }

  /**
   * モデルアクセス検証が必要か判定
   */
  private static shouldVerifyModelAccess(errorMessage: string, errorCode: string): boolean {
    return this.ACCESS_ERROR_PATTERNS.some(pattern =>
      errorMessage.includes(pattern.toLowerCase()) ||
      errorCode.includes(pattern.toLowerCase())
    );
  }

  /**
   * レート制限エラーか判定
   */
  private static isRateLimitError(errorMessage: string, errorCode: string): boolean {
    return this.RATE_LIMIT_PATTERNS.some(pattern =>
      errorMessage.includes(pattern.toLowerCase()) ||
      errorCode.includes(pattern.toLowerCase())
    );
  }

  /**
   * クォータ制限エラーか判定
   */
  private static isQuotaError(errorMessage: string, errorCode: string): boolean {
    return this.QUOTA_PATTERNS.some(pattern =>
      errorMessage.includes(pattern.toLowerCase()) ||
      errorCode.includes(pattern.toLowerCase())
    );
  }

  /**
   * モデルアクセスエラーメッセージを生成
   */
  private static async generateModelAccessError(
    modelId: string,
    region: string,
    userId: string,
    accessStatus: any,
    originalError: string
  ): Promise<ErrorAnalysisResult> {
    const modelName = modelId.split('.')[1] || modelId;
    const providerName = modelId.split('.')[0] || 'Unknown';
    const consoleUrl = `https://console.aws.amazon.com/bedrock/home?region=${region}#/modelaccess`;

    // ユーザー権限を取得
    const permissions = await UserPermissionsManager.getUserPermissions(userId);

    // 利用可能なアクションを決定
    const actions: ErrorAction[] = [];

    if (permissions.canEnableModels) {
      actions.push({
        type: 'enable_model',
        label: 'モデルアクセスを申請',
        enabled: true,
        requiresPermission: 'admin'
      });
    }

    if (permissions.canRequestAdmin) {
      actions.push({
        type: 'request_admin',
        label: '管理者に有効化を依頼',
        enabled: true,
        requiresPermission: 'user'
      });
    }

    const message = `🔒 モデルアクセスエラー: ${modelName}

このモデルへのアクセスが有効化されていません。

📋 対処方法:
1. AWS Bedrockコンソールにアクセス
   ${consoleUrl}
2. リージョンを「${region}」に設定
3. 「Model access」または「モデルアクセス」を選択
4. 「${providerName}」プロバイダーのモデルを有効化
5. アクセス許可の承認を待つ（数分かかる場合があります）

💡 ヒント: 一部のモデルは特定のリージョンでのみ利用可能です。

認証状態: ${accessStatus.authorizationStatus || 'UNKNOWN'}
エンタイトルメント: ${accessStatus.entitlementAvailability || 'UNKNOWN'}`;

    return {
      type: 'model_access',
      message,
      availableActions: actions,
      originalError
    };
  }

  /**
   * リージョン未対応エラーメッセージを生成
   */
  private static generateRegionUnavailableError(
    modelId: string,
    region: string
  ): ErrorAnalysisResult {
    const modelName = modelId.split('.')[1] || modelId;

    const message = `🌍 リージョンエラー: このモデルは現在のリージョンで利用できません

モデル「${modelName}」はリージョン「${region}」で利用できません。

📋 対処方法:
1. 利用可能なリージョンに変更してください
2. 推奨リージョン: us-east-1, us-west-2, eu-west-1

💡 ヒント: リージョンセレクターから別のリージョンを選択してください。`;

    return {
      type: 'region_unavailable',
      message,
      availableActions: [
        {
          type: 'change_region',
          label: 'リージョンを変更',
          enabled: true
        }
      ]
    };
  }

  /**
   * レート制限エラーメッセージを生成
   */
  private static generateRateLimitError(): ErrorAnalysisResult {
    const message = `⏱️ レート制限エラー: リクエストが多すぎます

しばらく待ってから再試行してください。

📋 対処方法:
1. 30秒〜1分待ってから再試行
2. リクエスト頻度を減らす
3. 問題が続く場合は、AWS Bedrockのクォータを確認

💡 ヒント: 連続してリクエストを送信すると、レート制限に達する可能性があります。`;

    return {
      type: 'rate_limit',
      message,
      availableActions: [
        {
          type: 'retry',
          label: '再試行',
          enabled: true
        }
      ]
    };
  }

  /**
   * クォータ制限エラーメッセージを生成
   */
  private static generateQuotaError(): ErrorAnalysisResult {
    const message = `📊 クォータ制限エラー: 使用量制限に達しました

AWS Bedrockコンソールでクォータを確認してください。

📋 対処方法:
1. AWS Service Quotasコンソールにアクセス
2. Amazon Bedrockのクォータを確認
3. 必要に応じてクォータ引き上げをリクエスト

💡 ヒント: クォータ引き上げには数日かかる場合があります。`;

    return {
      type: 'quota',
      message,
      availableActions: []
    };
  }

  /**
   * 汎用エラーメッセージを生成
   */
  private static generateGenericError(originalError: string): ErrorAnalysisResult {
    const message = `❌ チャット処理中にエラーが発生しました

${originalError}

📋 対処方法:
1. しばらく待ってから再試行
2. 問題が続く場合は、管理者に連絡してください`;

    return {
      type: 'other',
      message,
      availableActions: [
        {
          type: 'retry',
          label: '再試行',
          enabled: true
        }
      ],
      originalError
    };
  }
}
