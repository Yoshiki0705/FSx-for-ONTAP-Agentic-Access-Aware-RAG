/**
 * チャットボット機能テストモジュール
 * 
 * 実本番Amazon Bedrockでの応答生成品質テスト
 * 日本語応答の精度、ストリーミング機能、RAG連携を検証
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand
} from '@aws-sdk/client-bedrock-runtime';

import {
  OpenSearchServerlessClient,
  SearchCommand
} from '@aws-sdk/client-opensearchserverless';

import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand
} from '@aws-sdk/client-dynamodb';

import { ProductionConfig } from '../../config/production-config';
import { TestResult, TestExecutionStatus } from '../../core/production-test-engine';

/**
 * チャットボットテスト結果インターフェース
 */
export interface ChatbotTestResult extends TestResult {
  responseDetails?: {
    responseText: string;
    responseTime: number;
    tokenCount: number;
    modelUsed: string;
    isStreaming: boolean;
    japaneseQuality: number; // 0-1の品質スコア
  };
  ragDetails?: {
    documentsFound: number;
    relevantDocuments: number;
    citationsIncluded: boolean;
    sourceAccuracy: number;
  };
  performanceMetrics?: {
    latency: number;
    throughput: number;
    errorRate: number;
    resourceUsage: number;
  };
}

/**
 * テスト質問データ
 */
export interface TestQuestion {
  id: string;
  question: string;
  category: 'general' | 'document-based' | 'technical' | 'conversational';
  expectedKeywords: string[];
  expectedDocuments?: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  language: 'japanese' | 'english';
}

/**
 * 日本語品質評価基準
 */
export interface JapaneseQualityMetrics {
  grammar: number;        // 文法の正確性
  naturalness: number;    // 自然さ
  politeness: number;     // 敬語・丁寧語の適切性
  clarity: number;        // 明確性
  completeness: number;   // 回答の完全性
}

/**
 * チャットボット機能テストモジュールクラス
 */
export class ChatbotTestModule {
  private config: ProductionConfig;
  private bedrockClient: BedrockRuntimeClient;
  private openSearchClient: OpenSearchServerlessClient;
  private dynamoClient: DynamoDBClient;
  private testQuestions: TestQuestion[];

  constructor(config: ProductionConfig) {\n    this.config = config;\n    \n    const clientConfig = {\n      region: config.region,\n      credentials: { profile: config.awsProfile }\n    };\n\n    this.bedrockClient = new BedrockRuntimeClient(clientConfig);\n    this.openSearchClient = new OpenSearchServerlessClient(clientConfig);\n    this.dynamoClient = new DynamoDBClient(clientConfig);\n    \n    // テスト質問データの初期化\n    this.testQuestions = this.loadTestQuestions();\n  }\n\n  /**\n   * テスト質問データの読み込み\n   */\n  private loadTestQuestions(): TestQuestion[] {\n    return [\n      {\n        id: 'jp-general-001',\n        question: 'こんにちは。このシステムについて教えてください。',\n        category: 'general',\n        expectedKeywords: ['システム', 'RAG', '文書検索', 'AI'],\n        difficulty: 'easy',\n        language: 'japanese'\n      },\n      {\n        id: 'jp-general-002',\n        question: 'どのような機能がありますか？',\n        category: 'general',\n        expectedKeywords: ['機能', '検索', 'チャット', '文書'],\n        difficulty: 'easy',\n        language: 'japanese'\n      },\n      {\n        id: 'jp-document-001',\n        question: 'NetAppのストレージソリューションについて詳しく教えてください。',\n        category: 'document-based',\n        expectedKeywords: ['NetApp', 'ストレージ', 'ONTAP', 'FSx'],\n        expectedDocuments: ['netapp-storage-guide', 'fsx-ontap-overview'],\n        difficulty: 'medium',\n        language: 'japanese'\n      },\n      {\n        id: 'jp-technical-001',\n        question: 'Amazon FSx for NetApp ONTAPの設定方法を教えてください。',\n        category: 'technical',\n        expectedKeywords: ['FSx', 'ONTAP', '設定', 'AWS'],\n        expectedDocuments: ['fsx-setup-guide', 'ontap-configuration'],\n        difficulty: 'hard',\n        language: 'japanese'\n      },\n      {\n        id: 'jp-conversational-001',\n        question: '先ほどの質問に関連して、パフォーマンスの最適化についても教えてください。',\n        category: 'conversational',\n        expectedKeywords: ['パフォーマンス', '最適化', '設定'],\n        difficulty: 'medium',\n        language: 'japanese'\n      },\n      {\n        id: 'jp-complex-001',\n        question: 'マルチプロトコル環境でのFSx for NetApp ONTAPの運用における、セキュリティとパフォーマンスのバランスを取るためのベストプラクティスを、具体的な設定例とともに詳しく説明してください。',\n        category: 'technical',\n        expectedKeywords: ['マルチプロトコル', 'セキュリティ', 'パフォーマンス', 'ベストプラクティス'],\n        expectedDocuments: ['security-best-practices', 'performance-tuning'],\n        difficulty: 'hard',\n        language: 'japanese'\n      }\n    ];\n  }\n\n  /**\n   * 日本語応答品質テスト\n   */\n  async testJapaneseResponseQuality(): Promise<ChatbotTestResult> {\n    const testId = 'chatbot-japanese-001';\n    const startTime = Date.now();\n    \n    console.log('🗾 日本語応答品質テストを開始...');\n\n    try {\n      const testQuestion = this.testQuestions.find(q => q.id === 'jp-general-001');\n      \n      if (!testQuestion) {\n        throw new Error('テスト質問が見つかりません');\n      }\n\n      // 実本番Bedrockでの応答生成\n      const responseResult = await this.generateResponse(\n        testQuestion.question,\n        'anthropic.claude-3-haiku-20240307-v1:0'\n      );\n\n      // 日本語品質の評価\n      const qualityMetrics = await this.evaluateJapaneseQuality(\n        responseResult.responseText,\n        testQuestion\n      );\n\n      const success = qualityMetrics.grammar >= 0.7 && \n                     qualityMetrics.naturalness >= 0.7 &&\n                     responseResult.responseTime < 10000;\n\n      const result: ChatbotTestResult = {\n        testId,\n        testName: '日本語応答品質テスト',\n        category: 'chatbot',\n        status: success ? TestExecutionStatus.COMPLETED : TestExecutionStatus.FAILED,\n        startTime: new Date(startTime),\n        endTime: new Date(),\n        duration: Date.now() - startTime,\n        success,\n        responseDetails: {\n          responseText: responseResult.responseText,\n          responseTime: responseResult.responseTime,\n          tokenCount: responseResult.tokenCount,\n          modelUsed: 'anthropic.claude-3-haiku-20240307-v1:0',\n          isStreaming: false,\n          japaneseQuality: this.calculateOverallQuality(qualityMetrics)\n        },\n        metadata: {\n          question: testQuestion.question,\n          qualityMetrics: qualityMetrics,\n          expectedKeywords: testQuestion.expectedKeywords,\n          keywordMatches: this.countKeywordMatches(responseResult.responseText, testQuestion.expectedKeywords)\n        }\n      };\n\n      if (success) {\n        console.log('✅ 日本語応答品質テスト成功');\n        console.log(`   品質スコア: ${(result.responseDetails!.japaneseQuality * 100).toFixed(1)}%`);\n        console.log(`   応答時間: ${responseResult.responseTime}ms`);\n      } else {\n        console.error('❌ 日本語応答品質テスト失敗');\n      }\n\n      return result;\n\n    } catch (error) {\n      console.error('❌ 日本語応答品質テスト実行エラー:', error);\n      \n      return {\n        testId,\n        testName: '日本語応答品質テスト',\n        category: 'chatbot',\n        status: TestExecutionStatus.FAILED,\n        startTime: new Date(startTime),\n        endTime: new Date(),\n        duration: Date.now() - startTime,\n        success: false,\n        error: error instanceof Error ? error.message : String(error)\n      };\n    }\n  }\n\n  /**\n   * 文書関連応答テスト\n   */\n  async testDocumentBasedResponse(): Promise<ChatbotTestResult> {\n    const testId = 'chatbot-document-001';\n    const startTime = Date.now();\n    \n    console.log('📄 文書関連応答テストを開始...');\n\n    try {\n      const testQuestion = this.testQuestions.find(q => q.id === 'jp-document-001');\n      \n      if (!testQuestion) {\n        throw new Error('テスト質問が見つかりません');\n      }\n\n      // 関連文書の検索\n      const documentsResult = await this.searchRelevantDocuments(\n        testQuestion.question\n      );\n\n      // RAG機能を使用した応答生成\n      const responseResult = await this.generateRAGResponse(\n        testQuestion.question,\n        documentsResult.documents\n      );\n\n      // 文書関連性の評価\n      const relevanceScore = this.evaluateDocumentRelevance(\n        responseResult.responseText,\n        documentsResult.documents,\n        testQuestion.expectedKeywords\n      );\n\n      const success = documentsResult.documents.length > 0 &&\n                     relevanceScore >= 0.7 &&\n                     responseResult.responseTime < 15000;\n\n      const result: ChatbotTestResult = {\n        testId,\n        testName: '文書関連応答テスト',\n        category: 'chatbot',\n        status: success ? TestExecutionStatus.COMPLETED : TestExecutionStatus.FAILED,\n        startTime: new Date(startTime),\n        endTime: new Date(),\n        duration: Date.now() - startTime,\n        success,\n        responseDetails: {\n          responseText: responseResult.responseText,\n          responseTime: responseResult.responseTime,\n          tokenCount: responseResult.tokenCount,\n          modelUsed: responseResult.modelUsed,\n          isStreaming: false,\n          japaneseQuality: 0.8 // 簡略化\n        },\n        ragDetails: {\n          documentsFound: documentsResult.documents.length,\n          relevantDocuments: documentsResult.relevantCount,\n          citationsIncluded: this.checkCitationsIncluded(responseResult.responseText),\n          sourceAccuracy: relevanceScore\n        },\n        metadata: {\n          question: testQuestion.question,\n          searchQuery: documentsResult.searchQuery,\n          documentsRetrieved: documentsResult.documents.map(doc => doc.title || doc.id),\n          expectedDocuments: testQuestion.expectedDocuments\n        }\n      };\n\n      if (success) {\n        console.log('✅ 文書関連応答テスト成功');\n        console.log(`   関連文書数: ${documentsResult.documents.length}`);\n        console.log(`   関連性スコア: ${(relevanceScore * 100).toFixed(1)}%`);\n      } else {\n        console.error('❌ 文書関連応答テスト失敗');\n      }\n\n      return result;\n\n    } catch (error) {\n      console.error('❌ 文書関連応答テスト実行エラー:', error);\n      \n      return {\n        testId,\n        testName: '文書関連応答テスト',\n        category: 'chatbot',\n        status: TestExecutionStatus.FAILED,\n        startTime: new Date(startTime),\n        endTime: new Date(),\n        duration: Date.now() - startTime,\n        success: false,\n        error: error instanceof Error ? error.message : String(error)\n      };\n    }\n  }"} 
ToolResult: SUCCESS - Created the tests/production-testing/modules/chatbot/chatbot-test-module.ts file.

<function_calls>
<invoke name="fsAppend">
<parameter name="path">tests/production-testing/modules/chatbot/chatbot-test-module.ts 
 /**
   * ストリーミング応答テスト
   */
  async testStreamingResponse(): Promise<ChatbotTestResult> {
    const testId = 'chatbot-streaming-001';
    const startTime = Date.now();
    
    console.log('🌊 ストリーミング応答テストを開始...');

    try {
      const testQuestion = this.testQuestions.find(q => q.id === 'jp-technical-001');
      
      if (!testQuestion) {
        throw new Error('テスト質問が見つかりません');
      }

      // ストリーミング応答の生成
      const streamingResult = await this.generateStreamingResponse(
        testQuestion.question,
        'anthropic.claude-3-haiku-20240307-v1:0'
      );

      // ストリーミング品質の評価
      const streamingQuality = this.evaluateStreamingQuality(streamingResult);

      const success = streamingResult.chunks.length > 0 &&
                     streamingResult.totalTime < 20000 &&
                     streamingQuality.consistency >= 0.8;

      const result: ChatbotTestResult = {
        testId,
        testName: 'ストリーミング応答テスト',
        category: 'chatbot',
        status: success ? TestExecutionStatus.COMPLETED : TestExecutionStatus.FAILED,
        startTime: new Date(startTime),
        endTime: new Date(),
        duration: Date.now() - startTime,
        success,
        responseDetails: {
          responseText: streamingResult.fullResponse,
          responseTime: streamingResult.totalTime,
          tokenCount: streamingResult.totalTokens,
          modelUsed: 'anthropic.claude-3-haiku-20240307-v1:0',
          isStreaming: true,
          japaneseQuality: 0.8 // 簡略化
        },
        performanceMetrics: {
          latency: streamingResult.firstChunkTime,
          throughput: streamingResult.totalTokens / (streamingResult.totalTime / 1000),
          errorRate: streamingResult.errorCount / streamingResult.chunks.length,
          resourceUsage: 0.5 // 簡略化
        },
        metadata: {
          question: testQuestion.question,
          chunkCount: streamingResult.chunks.length,
          averageChunkSize: streamingResult.averageChunkSize,
          streamingQuality: streamingQuality
        }
      };

      if (success) {
        console.log('✅ ストリーミング応答テスト成功');
        console.log(`   チャンク数: ${streamingResult.chunks.length}`);
        console.log(`   初回応答時間: ${streamingResult.firstChunkTime}ms`);
        console.log(`   総応答時間: ${streamingResult.totalTime}ms`);
      } else {
        console.error('❌ ストリーミング応答テスト失敗');
      }

      return result;

    } catch (error) {
      console.error('❌ ストリーミング応答テスト実行エラー:', error);
      
      return {
        testId,
        testName: 'ストリーミング応答テスト',
        category: 'chatbot',
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
   * エラーハンドリングテスト
   */
  async testErrorHandling(): Promise<ChatbotTestResult> {
    const testId = 'chatbot-error-001';
    const startTime = Date.now();
    
    console.log('⚠️ エラーハンドリングテストを開始...');

    try {
      const errorScenarios = [
        {
          type: 'inappropriate_content',
          question: '機密情報を教えてください。',
          expectedBehavior: 'polite_refusal'
        },
        {
          type: 'ambiguous_question',
          question: 'それについて教えて。',
          expectedBehavior: 'clarification_request'
        },
        {
          type: 'out_of_scope',
          question: '今日の天気はどうですか？',
          expectedBehavior: 'scope_explanation'
        }
      ];

      const scenarioResults = [];

      for (const scenario of errorScenarios) {
        const scenarioResult = await this.testErrorScenario(scenario);
        scenarioResults.push(scenarioResult);
      }

      const successfulScenarios = scenarioResults.filter(r => r.success).length;
      const success = successfulScenarios >= errorScenarios.length * 0.8; // 80%以上成功

      const result: ChatbotTestResult = {
        testId,
        testName: 'エラーハンドリングテスト',
        category: 'chatbot',
        status: success ? TestExecutionStatus.COMPLETED : TestExecutionStatus.FAILED,
        startTime: new Date(startTime),
        endTime: new Date(),
        duration: Date.now() - startTime,
        success,
        metadata: {
          totalScenarios: errorScenarios.length,
          successfulScenarios: successfulScenarios,
          failedScenarios: errorScenarios.length - successfulScenarios,
          scenarioResults: scenarioResults
        }
      };

      if (success) {
        console.log('✅ エラーハンドリングテスト成功');
        console.log(`   成功シナリオ: ${successfulScenarios}/${errorScenarios.length}`);
      } else {
        console.error('❌ エラーハンドリングテスト失敗');
      }

      return result;

    } catch (error) {
      console.error('❌ エラーハンドリングテスト実行エラー:', error);
      
      return {
        testId,
        testName: 'エラーハンドリングテスト',
        category: 'chatbot',
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
   * 複雑な質問への応答テスト
   */
  async testComplexQuestionHandling(): Promise<ChatbotTestResult> {
    const testId = 'chatbot-complex-001';
    const startTime = Date.now();
    
    console.log('🧠 複雑な質問への応答テストを開始...');

    try {
      const complexQuestion = this.testQuestions.find(q => q.id === 'jp-complex-001');
      
      if (!complexQuestion) {
        throw new Error('複雑なテスト質問が見つかりません');
      }

      // 複雑な質問に対する応答生成
      const responseResult = await this.generateResponse(
        complexQuestion.question,
        'anthropic.claude-3-sonnet-20240229-v1:0' // より高性能なモデルを使用
      );

      // 応答の複雑性評価
      const complexityAnalysis = this.analyzeResponseComplexity(
        responseResult.responseText,
        complexQuestion
      );

      const success = complexityAnalysis.depth >= 0.7 &&
                     complexityAnalysis.accuracy >= 0.8 &&
                     complexityAnalysis.structure >= 0.7;

      const result: ChatbotTestResult = {
        testId,
        testName: '複雑な質問への応答テスト',
        category: 'chatbot',
        status: success ? TestExecutionStatus.COMPLETED : TestExecutionStatus.FAILED,
        startTime: new Date(startTime),
        endTime: new Date(),
        duration: Date.now() - startTime,
        success,
        responseDetails: {
          responseText: responseResult.responseText,
          responseTime: responseResult.responseTime,
          tokenCount: responseResult.tokenCount,
          modelUsed: 'anthropic.claude-3-sonnet-20240229-v1:0',
          isStreaming: false,
          japaneseQuality: complexityAnalysis.languageQuality
        },
        metadata: {
          question: complexQuestion.question,
          complexityAnalysis: complexityAnalysis,
          expectedKeywords: complexQuestion.expectedKeywords,
          keywordCoverage: this.calculateKeywordCoverage(
            responseResult.responseText, 
            complexQuestion.expectedKeywords
          )
        }
      };

      if (success) {
        console.log('✅ 複雑な質問への応答テスト成功');
        console.log(`   応答の深度: ${(complexityAnalysis.depth * 100).toFixed(1)}%`);
        console.log(`   応答の正確性: ${(complexityAnalysis.accuracy * 100).toFixed(1)}%`);
      } else {
        console.error('❌ 複雑な質問への応答テスト失敗');
      }

      return result;

    } catch (error) {
      console.error('❌ 複雑な質問への応答テスト実行エラー:', error);
      
      return {
        testId,
        testName: '複雑な質問への応答テスト',
        category: 'chatbot',
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
   * 実本番Bedrockでの応答生成
   */
  private async generateResponse(
    question: string,
    modelId: string
  ): Promise<{
    responseText: string;
    responseTime: number;
    tokenCount: number;
  }> {
    const startTime = Date.now();

    try {
      const requestBody = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: question
          }
        ]
      };

      const command = new InvokeModelCommand({
        modelId: modelId,
        body: JSON.stringify(requestBody),
        contentType: 'application/json'
      });

      const response = await this.bedrockClient.send(command);
      const responseTime = Date.now() - startTime;

      if (!response.body) {
        throw new Error('Bedrockからの応答が空です');
      }

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const responseText = responseBody.content?.[0]?.text || '';
      const tokenCount = responseBody.usage?.output_tokens || 0;

      return {
        responseText,
        responseTime,
        tokenCount
      };

    } catch (error) {
      console.error('Bedrock応答生成エラー:', error);
      throw error;
    }
  }

  /**
   * 関連文書の検索
   */
  private async searchRelevantDocuments(
    question: string
  ): Promise<{
    documents: any[];
    relevantCount: number;
    searchQuery: string;
  }> {
    try {
      // 検索クエリの構築
      const searchQuery = this.buildSearchQuery(question);

      const searchBody = {
        query: {
          multi_match: {
            query: searchQuery,
            fields: ['title', 'content', 'description', 'tags']
          }
        },
        size: 10,
        _source: ['id', 'title', 'content', 'tags', 'metadata']
      };

      const searchCommand = new SearchCommand({
        index: this.config.resources.openSearchIndex,
        body: searchBody
      });

      const response = await this.openSearchClient.send(searchCommand);
      const hits = response.body?.hits?.hits || [];
      
      const documents = hits.map((hit: any) => hit._source);
      const relevantCount = this.countRelevantDocuments(documents, question);

      return {
        documents,
        relevantCount,
        searchQuery
      };

    } catch (error) {
      console.error('文書検索エラー:', error);
      return {
        documents: [],
        relevantCount: 0,
        searchQuery: question
      };
    }
  }

  /**
   * RAG機能を使用した応答生成
   */
  private async generateRAGResponse(
    question: string,
    documents: any[]
  ): Promise<{
    responseText: string;
    responseTime: number;
    tokenCount: number;
    modelUsed: string;
  }> {
    const startTime = Date.now();

    try {
      // 文書コンテキストの構築
      const documentContext = this.buildDocumentContext(documents);
      
      const ragPrompt = `以下の文書を参考にして、質問に答えてください。回答には参考にした文書の情報を含めてください。

参考文書:
${documentContext}

質問: ${question}

回答:`;

      const requestBody = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: ragPrompt
          }
        ]
      };

      const command = new InvokeModelCommand({
        modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
        body: JSON.stringify(requestBody),
        contentType: 'application/json'
      });

      const response = await this.bedrockClient.send(command);
      const responseTime = Date.now() - startTime;

      if (!response.body) {
        throw new Error('RAG応答生成でBedrockからの応答が空です');
      }

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const responseText = responseBody.content?.[0]?.text || '';
      const tokenCount = responseBody.usage?.output_tokens || 0;

      return {
        responseText,
        responseTime,
        tokenCount,
        modelUsed: 'anthropic.claude-3-haiku-20240307-v1:0'
      };

    } catch (error) {
      console.error('RAG応答生成エラー:', error);
      throw error;
    }
  }

  /**
   * ストリーミング応答の生成
   */
  private async generateStreamingResponse(
    question: string,
    modelId: string
  ): Promise<{
    fullResponse: string;
    chunks: string[];
    totalTime: number;
    firstChunkTime: number;
    totalTokens: number;
    averageChunkSize: number;
    errorCount: number;
  }> {
    const startTime = Date.now();
    let firstChunkTime = 0;
    let fullResponse = '';
    const chunks: string[] = [];
    let totalTokens = 0;
    let errorCount = 0;

    try {
      const requestBody = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: question
          }
        ]
      };

      const command = new InvokeModelWithResponseStreamCommand({
        modelId: modelId,
        body: JSON.stringify(requestBody),
        contentType: 'application/json'
      });

      const response = await this.bedrockClient.send(command);

      if (response.body) {
        for await (const chunk of response.body) {
          try {
            if (chunk.chunk?.bytes) {
              const chunkData = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes));
              
              if (chunkData.type === 'content_block_delta' && chunkData.delta?.text) {
                const chunkText = chunkData.delta.text;
                chunks.push(chunkText);
                fullResponse += chunkText;
                
                if (firstChunkTime === 0) {
                  firstChunkTime = Date.now() - startTime;
                }
              }
              
              if (chunkData.usage?.output_tokens) {
                totalTokens = chunkData.usage.output_tokens;
              }
            }
          } catch (chunkError) {
            errorCount++;
            console.warn('ストリーミングチャンク処理エラー:', chunkError);
          }
        }
      }

      const totalTime = Date.now() - startTime;
      const averageChunkSize = chunks.length > 0 ? fullResponse.length / chunks.length : 0;

      return {
        fullResponse,
        chunks,
        totalTime,
        firstChunkTime,
        totalTokens,
        averageChunkSize,
        errorCount
      };

    } catch (error) {
      console.error('ストリーミング応答生成エラー:', error);
      throw error;
    }
  }"} 
ToolResult: SUCCESS - Appended the text to the tests/production-testing/modules/chatbot/chatbot-test-module.ts file.

<function_calls>
<invoke name="fsAppend">
<parameter name="path">tests/production-testing/modules/chatbot/chatbot-test-module.ts 
 /**
   * 日本語品質の評価
   */
  private async evaluateJapaneseQuality(
    responseText: string,
    testQuestion: TestQuestion
  ): Promise<JapaneseQualityMetrics> {
    // 簡略化された日本語品質評価
    // 実際の実装では、より詳細な自然言語処理を行う
    
    const metrics: JapaneseQualityMetrics = {
      grammar: this.evaluateGrammar(responseText),
      naturalness: this.evaluateNaturalness(responseText),
      politeness: this.evaluatePoliteness(responseText),
      clarity: this.evaluateClarity(responseText),
      completeness: this.evaluateCompleteness(responseText, testQuestion)
    };

    return metrics;
  }

  /**
   * 文法の評価
   */
  private evaluateGrammar(text: string): number {
    // 基本的な文法チェック
    let score = 1.0;
    
    // 文の終わりの句読点チェック
    const sentences = text.split(/[。！？]/);
    const properEndings = text.match(/[。！？]/g)?.length || 0;
    if (sentences.length > 1 && properEndings < sentences.length - 1) {
      score -= 0.2;
    }
    
    // ひらがな・カタカナ・漢字のバランスチェック
    const hiragana = (text.match(/[ひらがな]/g) || []).length;
    const katakana = (text.match(/[カタカナ]/g) || []).length;
    const kanji = (text.match(/[一-龯]/g) || []).length;
    
    if (hiragana === 0 && katakana === 0 && kanji === 0) {
      score -= 0.5; // 日本語でない可能性
    }
    
    return Math.max(0, score);
  }

  /**
   * 自然さの評価
   */
  private evaluateNaturalness(text: string): number {
    let score = 0.8; // ベーススコア
    
    // 自然な日本語表現のパターンチェック
    const naturalPatterns = [
      /です。?$/,
      /ます。?$/,
      /である。?$/,
      /ください/,
      /について/,
      /に関して/
    ];
    
    const matchCount = naturalPatterns.filter(pattern => pattern.test(text)).length;
    score += (matchCount / naturalPatterns.length) * 0.2;
    
    return Math.min(1.0, score);
  }

  /**
   * 丁寧さの評価
   */
  private evaluatePoliteness(text: string): number {
    let score = 0.5; // ベーススコア
    
    // 丁寧語・敬語のパターン
    const politePatterns = [
      /です/g,
      /ます/g,
      /ございます/g,
      /いたします/g,
      /させていただ/g
    ];
    
    let politeCount = 0;
    politePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) politeCount += matches.length;
    });
    
    // 文の数に対する丁寧語の比率
    const sentences = text.split(/[。！？]/).length;
    if (sentences > 1) {
      score = Math.min(1.0, politeCount / sentences);
    }
    
    return score;
  }

  /**
   * 明確性の評価
   */
  private evaluateClarity(text: string): number {
    let score = 0.8; // ベーススコア
    
    // 明確性を示す要素
    if (text.includes('具体的に')) score += 0.1;
    if (text.includes('例えば')) score += 0.1;
    if (text.includes('つまり')) score += 0.05;
    if (text.includes('まず')) score += 0.05;
    
    // 曖昧な表現の減点
    if (text.includes('かもしれません')) score -= 0.05;
    if (text.includes('と思います')) score -= 0.05;
    
    return Math.min(1.0, Math.max(0, score));
  }

  /**
   * 完全性の評価
   */
  private evaluateCompleteness(text: string, testQuestion: TestQuestion): number {
    let score = 0.5; // ベーススコア
    
    // 期待されるキーワードの含有率
    const keywordMatches = this.countKeywordMatches(text, testQuestion.expectedKeywords);
    const keywordScore = keywordMatches / testQuestion.expectedKeywords.length;
    
    score += keywordScore * 0.5;
    
    return Math.min(1.0, score);
  }

  /**
   * 全体的な品質スコアの計算
   */
  private calculateOverallQuality(metrics: JapaneseQualityMetrics): number {
    const weights = {
      grammar: 0.25,
      naturalness: 0.25,
      politeness: 0.2,
      clarity: 0.15,
      completeness: 0.15
    };

    return (
      metrics.grammar * weights.grammar +
      metrics.naturalness * weights.naturalness +
      metrics.politeness * weights.politeness +
      metrics.clarity * weights.clarity +
      metrics.completeness * weights.completeness
    );
  }

  /**
   * キーワードマッチ数のカウント
   */
  private countKeywordMatches(text: string, keywords: string[]): number {
    return keywords.filter(keyword => text.includes(keyword)).length;
  }

  /**
   * 文書関連性の評価
   */
  private evaluateDocumentRelevance(
    responseText: string,
    documents: any[],
    expectedKeywords: string[]
  ): number {
    let relevanceScore = 0;

    // 文書内容の引用確認
    documents.forEach(doc => {
      if (doc.title && responseText.includes(doc.title)) {
        relevanceScore += 0.2;
      }
      
      if (doc.content) {
        const contentWords = doc.content.split(/\s+/).slice(0, 10);
        const mentionedWords = contentWords.filter(word => responseText.includes(word));
        relevanceScore += (mentionedWords.length / contentWords.length) * 0.3;
      }
    });

    // 期待キーワードの含有確認
    const keywordScore = this.countKeywordMatches(responseText, expectedKeywords) / expectedKeywords.length;
    relevanceScore += keywordScore * 0.5;

    return Math.min(1.0, relevanceScore);
  }

  /**
   * 引用の含有確認
   */
  private checkCitationsIncluded(responseText: string): boolean {
    const citationPatterns = [
      /参考[：:]/,
      /出典[：:]/,
      /引用[：:]/,
      /\[.*\]/,
      /「.*」/,
      /によると/,
      /に記載/
    ];

    return citationPatterns.some(pattern => pattern.test(responseText));
  }

  /**
   * ストリーミング品質の評価
   */
  private evaluateStreamingQuality(streamingResult: any): {
    consistency: number;
    smoothness: number;
    completeness: number;
  } {
    const consistency = streamingResult.errorCount === 0 ? 1.0 : 
                       Math.max(0, 1.0 - (streamingResult.errorCount / streamingResult.chunks.length));
    
    const smoothness = streamingResult.chunks.length > 0 ? 
                      Math.min(1.0, streamingResult.averageChunkSize / 50) : 0;
    
    const completeness = streamingResult.fullResponse.length > 100 ? 1.0 : 
                        streamingResult.fullResponse.length / 100;

    return {
      consistency,
      smoothness,
      completeness
    };
  }

  /**
   * エラーシナリオのテスト
   */
  private async testErrorScenario(scenario: any): Promise<{
    success: boolean;
    responseText: string;
    behaviorMatch: boolean;
  }> {
    try {
      const responseResult = await this.generateResponse(
        scenario.question,
        'anthropic.claude-3-haiku-20240307-v1:0'
      );

      const behaviorMatch = this.checkExpectedBehavior(
        responseResult.responseText,
        scenario.expectedBehavior
      );

      return {
        success: behaviorMatch,
        responseText: responseResult.responseText,
        behaviorMatch
      };

    } catch (error) {
      return {
        success: false,
        responseText: '',
        behaviorMatch: false
      };
    }
  }

  /**
   * 期待される動作の確認
   */
  private checkExpectedBehavior(responseText: string, expectedBehavior: string): boolean {
    switch (expectedBehavior) {
      case 'polite_refusal':
        return /申し訳|恐れ入り|お答えできません|提供できません/.test(responseText);
      
      case 'clarification_request':
        return /詳しく|具体的に|どの|何について|明確に/.test(responseText);
      
      case 'scope_explanation':
        return /専門|範囲|対象|システム|文書/.test(responseText);
      
      default:
        return false;
    }
  }

  /**
   * 応答の複雑性分析
   */
  private analyzeResponseComplexity(
    responseText: string,
    testQuestion: TestQuestion
  ): {
    depth: number;
    accuracy: number;
    structure: number;
    languageQuality: number;
  } {
    // 応答の深度評価
    const depth = this.evaluateResponseDepth(responseText);
    
    // 正確性評価
    const accuracy = this.evaluateResponseAccuracy(responseText, testQuestion);
    
    // 構造評価
    const structure = this.evaluateResponseStructure(responseText);
    
    // 言語品質評価
    const languageQuality = this.evaluateLanguageQuality(responseText);

    return {
      depth,
      accuracy,
      structure,
      languageQuality
    };
  }

  /**
   * 応答の深度評価
   */
  private evaluateResponseDepth(text: string): number {
    let score = 0.5;
    
    // 詳細説明の指標
    if (text.length > 500) score += 0.2;
    if (text.includes('具体的には')) score += 0.1;
    if (text.includes('例えば')) score += 0.1;
    if (text.includes('詳細')) score += 0.1;
    
    return Math.min(1.0, score);
  }

  /**
   * 応答の正確性評価
   */
  private evaluateResponseAccuracy(text: string, testQuestion: TestQuestion): number {
    const keywordCoverage = this.calculateKeywordCoverage(text, testQuestion.expectedKeywords);
    return keywordCoverage;
  }

  /**
   * 応答の構造評価
   */
  private evaluateResponseStructure(text: string): number {
    let score = 0.5;
    
    // 構造化された応答の指標
    const paragraphs = text.split('\n\n').length;
    if (paragraphs > 1) score += 0.2;
    
    if (/1\.|2\.|3\./.test(text)) score += 0.2; // 番号付きリスト
    if (/・|•/.test(text)) score += 0.1; // 箇条書き
    
    return Math.min(1.0, score);
  }

  /**
   * 言語品質評価
   */
  private evaluateLanguageQuality(text: string): number {
    // 簡略化された言語品質評価
    return this.evaluateNaturalness(text);
  }

  /**
   * キーワードカバレッジの計算
   */
  private calculateKeywordCoverage(text: string, keywords: string[]): number {
    if (keywords.length === 0) return 1.0;
    
    const matchedKeywords = keywords.filter(keyword => text.includes(keyword));
    return matchedKeywords.length / keywords.length;
  }

  /**
   * 検索クエリの構築
   */
  private buildSearchQuery(question: string): string {
    // 質問から重要なキーワードを抽出
    const stopWords = ['は', 'が', 'を', 'に', 'で', 'と', 'の', 'について', 'ください', 'です', 'ます'];
    const words = question.split(/\s+/).filter(word => 
      word.length > 1 && !stopWords.includes(word)
    );
    
    return words.join(' ');
  }

  /**
   * 関連文書数のカウント
   */
  private countRelevantDocuments(documents: any[], question: string): number {
    const questionKeywords = this.buildSearchQuery(question).split(' ');
    
    return documents.filter(doc => {
      const docText = (doc.title || '') + ' ' + (doc.content || '');
      return questionKeywords.some(keyword => docText.includes(keyword));
    }).length;
  }

  /**
   * 文書コンテキストの構築
   */
  private buildDocumentContext(documents: any[]): string {
    return documents.slice(0, 3).map((doc, index) => {
      const title = doc.title || `文書${index + 1}`;
      const content = doc.content ? doc.content.substring(0, 300) + '...' : '';
      return `【${title}】\n${content}`;
    }).join('\n\n');
  }

  /**
   * 全チャットボットテストの実行
   */
  async runAllChatbotTests(): Promise<ChatbotTestResult[]> {
    console.log('🚀 全チャットボット機能テストを実行中...');

    const tests = [
      this.testJapaneseResponseQuality(),
      this.testDocumentBasedResponse(),
      this.testStreamingResponse(),
      this.testErrorHandling(),
      this.testComplexQuestionHandling()
    ];

    const results = await Promise.allSettled(tests);
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          testId: `chatbot-error-${index}`,
          testName: `チャットボットテスト${index + 1}`,
          category: 'chatbot',
          status: TestExecutionStatus.FAILED,
          startTime: new Date(),
          endTime: new Date(),
          duration: 0,
          success: false,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason)
        };
      }
    });
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    console.log('🧹 チャットボットテストモジュールをクリーンアップ中...');
    // 必要に応じてクリーンアップ処理を実装
    console.log('✅ チャットボットテストモジュールのクリーンアップ完了');
  }
}

export default ChatbotTestModule;