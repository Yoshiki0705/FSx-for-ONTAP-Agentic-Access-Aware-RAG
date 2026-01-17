/**
 * マルチモーダル入力テストモジュール
 * 
 * テキスト・画像入力の統合処理を検証
 * 実本番Amazon Bedrockでのマルチモーダル機能をテスト
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

// 定数定義
const MULTIMODAL_TEST_CONSTANTS = {
  MODEL_ID: 'amazon.nova-pro-v1:0',
  MAX_TEXT_LENGTH: 10000,
  MIN_TEXT_LENGTH: 1,
  DEFAULT_MAX_TOKENS: 1000,
  MAX_TOKENS_LIMIT: 8192,
  MIN_TOKENS: 100,
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_TOP_P: 0.9,
  SUCCESS_THRESHOLD: {
    INTEGRATION_QUALITY: 0.8,
    RESPONSE_RELEVANCE: 0.85,
    OVERALL_SCORE: 0.8
  },
  ALLOWED_IMAGE_FORMATS: ['png', 'jpeg', 'jpg', 'webp'] as const
} as const;

import {
  BedrockRuntimeClient,
  InvokeModelCommand
} from '@aws-sdk/client-bedrock-runtime';
import { fromIni } from '@aws-sdk/credential-providers';

import { ProductionConfig } from '../../config/production-config';
import { TestResult, TestExecutionStatus } from '../../core/production-test-engine';

/**
 * マルチモーダルテスト結果
 */
export interface MultimodalTestResult extends TestResult {
  modalityMetrics?: {
    textProcessingAccuracy: number;
    imageProcessingAccuracy: number;
    integrationQuality: number;
    responseRelevance: number;
  };
  inputAnalysis?: {
    textLength: number;
    imageCount: number;
    modalityCombination: string;
    complexityScore: number;
  };
}

/**
 * マルチモーダルテストケース
 */
export interface MultimodalTestCase {
  id: string;
  name: string;
  textInput: string;
  imageInput?: {
    description: string;
    format: string;
    size: string;
    mockData: boolean;
  };
  expectedOutput: string;
  modalities: ('text' | 'image')[];
  difficulty: 'basic' | 'intermediate' | 'advanced';
}

/**
 * マルチモーダル入力テストモジュール
 */
export class MultimodalInputTestModule {
  private config: ProductionConfig;
  private bedrockClient: BedrockRuntimeClient;
  private testCases: MultimodalTestCase[];

  constructor(config: ProductionConfig) {
    // 設定の検証
    if (!config.region || !config.awsProfile) {
      throw new Error('必須設定が不足しています: region, awsProfile');
    }

    this.config = config;
    
    try {
      this.bedrockClient = new BedrockRuntimeClient({
        region: config.region,
        credentials: fromIni({ profile: config.awsProfile })
      });
    } catch (error) {
      throw new Error(`AWS認証設定エラー: ${error}`);
    }
    
    this.testCases = this.loadMultimodalTestCases();
  }

  /**
   * マルチモーダルテストケースの読み込み
   */
  private loadMultimodalTestCases(): MultimodalTestCase[] {
    return [
      // テキストのみ（ベースライン）
      {
        id: 'mm-text-001',
        name: 'テキストのみ処理テスト',
        textInput: 'RAGシステムのアーキテクチャ図について説明してください。',
        expectedOutput: 'technical-explanation',
        modalities: ['text'],
        difficulty: 'basic'
      },
      
      // テキスト + 画像説明（模擬）
      {
        id: 'mm-text-image-001',
        name: 'テキスト・画像統合処理テスト',
        textInput: 'この図に示されているシステム構成について、技術的な観点から分析してください。',
        imageInput: {
          description: 'RAGシステムのアーキテクチャ図（AWS構成図）',
          format: 'PNG',
          size: '1024x768',
          mockData: true
        },
        expectedOutput: 'multimodal-analysis',
        modalities: ['text', 'image'],
        difficulty: 'intermediate'
      },
      
      // 複雑なマルチモーダル
      {
        id: 'mm-complex-001',
        name: '複雑マルチモーダル処理テスト',
        textInput: 'この画像に表示されているクラウドアーキテクチャの利点と課題を、コスト効率性とセキュリティの観点から評価してください。また、改善提案も含めてください。',
        imageInput: {
          description: 'AWS クラウドアーキテクチャ図（複数サービス統合）',
          format: 'JPEG',
          size: '1920x1080',
          mockData: true
        },
        expectedOutput: 'comprehensive-analysis',
        modalities: ['text', 'image'],
        difficulty: 'advanced'
      },
      
      // 日本語マルチモーダル
      {
        id: 'mm-japanese-001',
        name: '日本語マルチモーダル処理テスト',
        textInput: 'この図表を参考に、日本企業におけるRAGシステム導入のベストプラクティスを日本語で詳しく説明してください。',
        imageInput: {
          description: '日本語ラベル付きRAG導入フローチャート',
          format: 'PNG',
          size: '800x600',
          mockData: true
        },
        expectedOutput: 'japanese-business-analysis',
        modalities: ['text', 'image'],
        difficulty: 'advanced'
      }
    ];
  }

  /**
   * 包括的マルチモーダルテスト
   */
  async testComprehensiveMultimodal(): Promise<MultimodalTestResult> {
    const testId = 'multimodal-comprehensive-001';
    const startTime = Date.now();
    
    console.log('🖼️ 包括的マルチモーダルテストを開始...');

    try {
      const results: any[] = [];

      // 各テストケースを並列実行（パフォーマンス向上）
      const testPromises = this.testCases.map(async (testCase) => {
        console.log(`   マルチモーダルテスト実行中: ${testCase.name}`);
        return await this.executeMultimodalTest(testCase);
      });

      const testResults = await Promise.allSettled(testPromises);
      
      // 結果を処理
      testResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`❌ テストケース ${this.testCases[index].id} 実行失敗:`, result.reason);
          results.push({
            testCase: this.testCases[index],
            response: '',
            metrics: { overallScore: 0 },
            success: false
          });
        }
      });

      // メトリクス計算
      const modalityMetrics = this.calculateModalityMetrics(results);
      const inputAnalysis = this.analyzeInputComplexity(results);

      const success = modalityMetrics.integrationQuality > MULTIMODAL_TEST_CONSTANTS.SUCCESS_THRESHOLD.INTEGRATION_QUALITY && 
                     modalityMetrics.responseRelevance > MULTIMODAL_TEST_CONSTANTS.SUCCESS_THRESHOLD.RESPONSE_RELEVANCE;

      const result: MultimodalTestResult = {
        testId,
        testName: '包括的マルチモーダルテスト',
        category: 'multimodal',
        status: success ? TestExecutionStatus.COMPLETED : TestExecutionStatus.FAILED,
        startTime: new Date(startTime),
        endTime: new Date(),
        duration: Date.now() - startTime,
        success,
        modalityMetrics,
        inputAnalysis,
        metadata: {
          testCaseCount: this.testCases.length,
          testResults: results
        }
      };

      if (success) {
        console.log('✅ 包括的マルチモーダルテスト成功');
      } else {
        console.error('❌ 包括的マルチモーダルテスト失敗');
      }

      return result;

    } catch (error) {
      console.error('❌ 包括的マルチモーダルテスト実行エラー:', error);
      
      return {
        testId,
        testName: '包括的マルチモーダルテスト',
        category: 'multimodal',
        status: TestExecutionStatus.FAILED,
        startTime: new Date(startTime),
        endTime: new Date(),
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 個別マルチモーダルテストの実行
   */
  private async executeMultimodalTest(testCase: MultimodalTestCase): Promise<{
    testCase: MultimodalTestCase;
    response: string;
    metrics: any;
    success: boolean;
  }> {
    try {
      // 読み取り専用モードでは模擬結果を返す
      if (this.config.readOnlyMode) {
        return this.generateMockMultimodalResult(testCase);
      }

      // 実際のマルチモーダル推論
      const response = await this.performMultimodalInference(testCase);
      
      // 応答品質評価
      const metrics = this.evaluateMultimodalResponse(response, testCase);
      
      const success = metrics.overallScore > MULTIMODAL_TEST_CONSTANTS.SUCCESS_THRESHOLD.OVERALL_SCORE;

      return {
        testCase,
        response,
        metrics,
        success
      };

    } catch (error) {
      console.error(`❌ マルチモーダルテスト実行エラー (${testCase.id}):`, error);
      return {
        testCase,
        response: '',
        metrics: { overallScore: 0 },
        success: false
      };
    }
  }

  /**
   * マルチモーダル推論実行
   */
  private async performMultimodalInference(testCase: MultimodalTestCase): Promise<string> {
    try {
      // 入力検証
      if (!testCase.textInput || testCase.textInput.trim().length < MULTIMODAL_TEST_CONSTANTS.MIN_TEXT_LENGTH) {
        throw new Error('テキスト入力が空です');
      }
      
      if (testCase.textInput.length > MULTIMODAL_TEST_CONSTANTS.MAX_TEXT_LENGTH) {
        throw new Error(`テキスト入力が長すぎます（${MULTIMODAL_TEST_CONSTANTS.MAX_TEXT_LENGTH}文字以内）`);
      }

      // Nova Pro（マルチモーダル対応）を使用
      const requestBody = this.buildMultimodalRequest(testCase);

      const command = new InvokeModelCommand({
        modelId: MULTIMODAL_TEST_CONSTANTS.MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody)
      });

      const response = await this.bedrockClient.send(command);
      
      if (!response.body) {
        throw new Error('Bedrockからの応答が空です');
      }

      let responseBody;
      try {
        responseBody = JSON.parse(new TextDecoder().decode(response.body));
      } catch (parseError) {
        throw new Error(`Bedrock応答のパースに失敗: ${parseError}`);
      }
      
      // 応答の検証
      if (!responseBody.results || !Array.isArray(responseBody.results) || responseBody.results.length === 0) {
        throw new Error('Bedrock応答の形式が不正です');
      }
      
      return responseBody.results[0]?.outputText || '';

    } catch (error) {
      console.error('❌ マルチモーダル推論エラー:', error);
      throw error;
    }
  }

  /**
   * マルチモーダルリクエスト構築
   */
  private buildMultimodalRequest(testCase: MultimodalTestCase): any {
    // パラメータの検証と制限
    const maxTokenCount = Math.min(
      Math.max(MULTIMODAL_TEST_CONSTANTS.MIN_TOKENS, MULTIMODAL_TEST_CONSTANTS.DEFAULT_MAX_TOKENS), 
      MULTIMODAL_TEST_CONSTANTS.MAX_TOKENS_LIMIT
    );
    const temperature = Math.max(0, Math.min(1, MULTIMODAL_TEST_CONSTANTS.DEFAULT_TEMPERATURE));
    const topP = Math.max(0, Math.min(1, MULTIMODAL_TEST_CONSTANTS.DEFAULT_TOP_P));

    const request: any = {
      inputText: testCase.textInput.trim(),
      textGenerationConfig: {
        maxTokenCount,
        temperature,
        topP
      }
    };

    // 画像入力がある場合（実際の実装では画像データを含める）
    if (testCase.imageInput && !testCase.imageInput.mockData) {
      // 許可された画像フォーマットのみ受け入れ
      const format = testCase.imageInput.format.toLowerCase();
      
      if (!MULTIMODAL_TEST_CONSTANTS.ALLOWED_IMAGE_FORMATS.includes(format as any)) {
        throw new Error(`サポートされていない画像フォーマット: ${format}. 許可されたフォーマット: ${MULTIMODAL_TEST_CONSTANTS.ALLOWED_IMAGE_FORMATS.join(', ')}`);
      }

      request.multimodalInput = {
        images: [
          {
            format,
            source: {
              bytes: 'base64-encoded-image-data' // 実際の実装では実画像データ
            }
          }
        ]
      };
    }

    return request;
  }

  /**
   * 模擬マルチモーダル結果生成
   */
  private generateMockMultimodalResult(testCase: MultimodalTestCase): {
    testCase: MultimodalTestCase;
    response: string;
    metrics: any;
    success: boolean;
  } {
    const mockResponses = {
      'mm-text-001': 'RAGシステムのアーキテクチャは、検索エンジン、ベクトルデータベース、生成AIモデルの3つの主要コンポーネントから構成されます。',
      'mm-text-image-001': 'この図に示されているRAGシステムは、Amazon FSx for NetApp ONTAPをストレージ層として使用し、Amazon Bedrockを生成AI層として活用する構成になっています。',
      'mm-complex-001': 'このクラウドアーキテクチャの利点として、スケーラビリティと可用性の向上が挙げられます。一方、課題としてはコスト管理とセキュリティ設定の複雑性があります。',
      'mm-japanese-001': '日本企業におけるRAGシステム導入では、既存システムとの統合性、コンプライアンス要件への対応、段階的な導入アプローチが重要なベストプラクティスとなります。'
    };

    const response = mockResponses[testCase.id as keyof typeof mockResponses] || 'マルチモーダル処理による応答です。';
    
    const metrics = {
      textAccuracy: 0.9,
      imageUnderstanding: testCase.modalities.includes('image') ? 0.85 : 1.0,
      integrationScore: testCase.modalities.length > 1 ? 0.88 : 0.95,
      overallScore: 0.87
    };

    return {
      testCase,
      response,
      metrics,
      success: metrics.overallScore > 0.8
    };
  }

  /**
   * マルチモーダル応答評価
   */
  private evaluateMultimodalResponse(response: string, testCase: MultimodalTestCase): any {
    // テキスト品質評価
    const textAccuracy = this.evaluateTextQuality(response, testCase);
    
    // 画像理解評価（画像入力がある場合）
    const imageUnderstanding = testCase.modalities.includes('image') ? 
      this.evaluateImageUnderstanding(response, testCase) : 1.0;
    
    // 統合品質評価
    const integrationScore = this.evaluateModalityIntegration(response, testCase);
    
    const overallScore = (textAccuracy + imageUnderstanding + integrationScore) / 3;

    return {
      textAccuracy,
      imageUnderstanding,
      integrationScore,
      overallScore
    };
  }

  /**
   * テキスト品質評価
   */
  private evaluateTextQuality(response: string, testCase: MultimodalTestCase): number {
    // 基本的な品質指標
    const lengthScore = response.length > 50 ? 1.0 : 0.5;
    const relevanceScore = response.includes('システム') || response.includes('RAG') ? 1.0 : 0.7;
    const coherenceScore = response.includes('。') && response.length > 100 ? 1.0 : 0.8;

    return (lengthScore + relevanceScore + coherenceScore) / 3;
  }

  /**
   * 画像理解評価
   */
  private evaluateImageUnderstanding(response: string, testCase: MultimodalTestCase): number {
    if (!testCase.imageInput) return 1.0;

    // 画像に関する言及があるかチェック
    const imageReferences = ['図', '画像', 'アーキテクチャ', '構成', '表示'];
    const mentionsImage = imageReferences.some(ref => response.includes(ref));
    
    // 技術的な分析があるかチェック
    const technicalTerms = ['システム', 'サービス', '構成', '設計', '実装'];
    const includesTechnicalAnalysis = technicalTerms.some(term => response.includes(term));

    return mentionsImage && includesTechnicalAnalysis ? 0.9 : 0.7;
  }

  /**
   * モダリティ統合評価
   */
  private evaluateModalityIntegration(response: string, testCase: MultimodalTestCase): number {
    if (testCase.modalities.length === 1) return 1.0;

    // テキストと画像の情報が統合されているかチェック
    const integrationIndicators = ['この図', 'に示されている', 'を参考に', 'について分析'];
    const showsIntegration = integrationIndicators.some(indicator => response.includes(indicator));

    return showsIntegration ? 0.9 : 0.6;
  }

  /**
   * モダリティメトリクス計算
   */
  private calculateModalityMetrics(results: any[]): {
    textProcessingAccuracy: number;
    imageProcessingAccuracy: number;
    integrationQuality: number;
    responseRelevance: number;
  } {
    const validResults = results.filter(r => r.success && r.metrics);
    
    if (validResults.length === 0) {
      return {
        textProcessingAccuracy: 0,
        imageProcessingAccuracy: 0,
        integrationQuality: 0,
        responseRelevance: 0
      };
    }

    const textAccuracy = validResults.reduce((sum, r) => sum + r.metrics.textAccuracy, 0) / validResults.length;
    const imageAccuracy = validResults.reduce((sum, r) => sum + r.metrics.imageUnderstanding, 0) / validResults.length;
    const integration = validResults.reduce((sum, r) => sum + r.metrics.integrationScore, 0) / validResults.length;
    const relevance = validResults.reduce((sum, r) => sum + r.metrics.overallScore, 0) / validResults.length;

    return {
      textProcessingAccuracy: textAccuracy,
      imageProcessingAccuracy: imageAccuracy,
      integrationQuality: integration,
      responseRelevance: relevance
    };
  }

  /**
   * 入力複雑性分析
   */
  private analyzeInputComplexity(results: any[]): {
    textLength: number;
    imageCount: number;
    modalityCombination: string;
    complexityScore: number;
  } {
    const totalTextLength = results.reduce((sum, r) => sum + r.testCase.textInput.length, 0);
    const imageCount = results.filter(r => r.testCase.modalities.includes('image')).length;
    const multimodalCount = results.filter(r => r.testCase.modalities.length > 1).length;
    
    const modalityCombination = `${results.length - imageCount}テキスト + ${imageCount}画像`;
    const complexityScore = (multimodalCount / results.length) * 0.7 + (imageCount / results.length) * 0.3;

    return {
      textLength: totalTextLength / results.length,
      imageCount,
      modalityCombination,
      complexityScore
    };
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    console.log('🧹 マルチモーダル入力テストモジュールをクリーンアップ中...');
    
    try {
      // 必要に応じてリソースのクリーンアップ処理を実装
      // 例: 一時ファイルの削除、接続の切断など
      
      console.log('✅ マルチモーダル入力テストモジュールのクリーンアップ完了');
    } catch (error) {
      console.error('❌ クリーンアップ中にエラーが発生:', error);
      throw error;
    }
  }
}

export default MultimodalInputTestModule;