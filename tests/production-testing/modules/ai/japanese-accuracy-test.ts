/**
 * 日本語サポート精度テストモジュール
 * 
 * 95%以上の日本語精度検証を実行
 * 実本番Amazon Bedrockでの日本語処理能力を包括的にテスト
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand
} from '@aws-sdk/client-bedrock-runtime';
import { fromIni } from '@aws-sdk/credential-providers';

import { ProductionConfig } from '../../config/production-config';
import { TestResult, TestExecutionStatus } from '../../core/production-test-engine';

/**
 * 日本語精度テスト結果
 */
export interface JapaneseAccuracyTestResult extends TestResult {
  accuracyMetrics?: {
    overallAccuracy: number;
    grammarAccuracy: number;
    vocabularyAccuracy: number;
    contextAccuracy: number;
    formalityAccuracy: number;
  };
  testCategories?: {
    [category: string]: {
      score: number;
      details: string;
    };
  };
}

/**
 * 日本語テストケース
 */
export interface JapaneseTestCase {
  id: string;
  category: string;
  prompt: string;
  expectedElements: string[];
  grammarPoints: string[];
  formalityLevel: 'casual' | 'polite' | 'formal';
  difficulty: 'basic' | 'intermediate' | 'advanced';
}

/**
 * 日本語サポート精度テストモジュール
 */
export class JapaneseAccuracyTestModule {
  private config: ProductionConfig;
  private bedrockClient: BedrockRuntimeClient;
  private testCases: JapaneseTestCase[];

  constructor(config: ProductionConfig) {
    this.config = config;
    
    this.bedrockClient = new BedrockRuntimeClient({
      region: config.region,
      credentials: fromIni({ profile: config.awsProfile })
    });
    
    this.testCases = this.loadJapaneseTestCases();
  }

  /**
   * 日本語テストケースの読み込み
   */
  private loadJapaneseTestCases(): JapaneseTestCase[] {
    return [
      // 基本的な敬語テスト
      {
        id: 'jp-keigo-001',
        category: 'keigo-basic',
        prompt: 'お客様への報告書を作成してください。プロジェクトの進捗について丁寧に説明してください。',
        expectedElements: ['です・ます調', '敬語表現', '丁寧語'],
        grammarPoints: ['です', 'ます', 'ございます'],
        formalityLevel: 'formal',
        difficulty: 'intermediate'
      },
      
      // ビジネス日本語テスト
      {
        id: 'jp-business-001',
        category: 'business-japanese',
        prompt: 'RAGシステムの導入効果について、経営陣向けの提案資料を作成してください。',
        expectedElements: ['ビジネス用語', '論理的構成', '数値的根拠'],
        grammarPoints: ['である調', '専門用語', '提案表現'],
        formalityLevel: 'formal',
        difficulty: 'advanced'
      },
      
      // 技術文書テスト
      {
        id: 'jp-technical-001',
        category: 'technical-japanese',
        prompt: 'Amazon FSx for NetApp ONTAPの技術仕様について、エンジニア向けに詳細に説明してください。',
        expectedElements: ['技術用語', '正確な表現', '具体的説明'],
        grammarPoints: ['専門用語', '説明文', '技術表現'],
        formalityLevel: 'polite',
        difficulty: 'advanced'
      },
      
      // 日常会話テスト
      {
        id: 'jp-casual-001',
        category: 'casual-conversation',
        prompt: 'チャットボットの使い方について、初心者にもわかりやすく教えてください。',
        expectedElements: ['わかりやすい表現', '親しみやすさ', '具体例'],
        grammarPoints: ['です・ます調', '平易な語彙', '例示表現'],
        formalityLevel: 'polite',
        difficulty: 'basic'
      },
      
      // 複雑な文法テスト
      {
        id: 'jp-grammar-001',
        category: 'complex-grammar',
        prompt: 'もしAIシステムが完全に自動化されたとしても、人間の判断が必要な場面について考察してください。',
        expectedElements: ['仮定表現', '複文構造', '論理的思考'],
        grammarPoints: ['もし〜としても', '〜について', '〜が必要'],
        formalityLevel: 'formal',
        difficulty: 'advanced'
      }
    ];
  }

  /**
   * 包括的日本語精度テスト
   */
  async testComprehensiveJapaneseAccuracy(): Promise<JapaneseAccuracyTestResult> {
    const testId = 'jp-accuracy-comprehensive-001';
    const startTime = Date.now();
    
    console.log('🇯🇵 包括的日本語精度テストを開始...');

    try {
      const categoryResults: { [category: string]: { score: number; details: string } } = {};
      let totalScore = 0;
      let testCount = 0;

      // 各テストケースを実行
      for (const testCase of this.testCases) {
        console.log(`   テスト実行中: ${testCase.category}`);
        
        const caseResult = await this.executeJapaneseTest(testCase);
        categoryResults[testCase.category] = caseResult;
        
        totalScore += caseResult.score;
        testCount++;
      }

      const overallAccuracy = totalScore / testCount;
      
      // 詳細な精度メトリクスを計算
      const accuracyMetrics = this.calculateDetailedAccuracy(categoryResults);
      
      const success = overallAccuracy >= 0.95; // 95%以上の精度要求

      const result: JapaneseAccuracyTestResult = {
        testId,
        testName: '包括的日本語精度テスト',
        category: 'japanese-accuracy',
        status: success ? TestExecutionStatus.COMPLETED : TestExecutionStatus.FAILED,
        startTime: new Date(startTime),
        endTime: new Date(),
        duration: Date.now() - startTime,
        success,
        accuracyMetrics,
        testCategories: categoryResults,
        metadata: {
          targetAccuracy: 0.95,
          actualAccuracy: overallAccuracy,
          testCaseCount: testCount
        }
      };

      if (success) {
        console.log(`✅ 包括的日本語精度テスト成功 (精度: ${(overallAccuracy * 100).toFixed(1)}%)`);
      } else {
        console.error(`❌ 包括的日本語精度テスト失敗 (精度: ${(overallAccuracy * 100).toFixed(1)}%)`);
      }

      return result;

    } catch (error) {
      console.error('❌ 包括的日本語精度テスト実行エラー:', error);
      
      return {
        testId,
        testName: '包括的日本語精度テスト',
        category: 'japanese-accuracy',
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
   * 個別日本語テストの実行
   */
  private async executeJapaneseTest(testCase: JapaneseTestCase): Promise<{
    score: number;
    details: string;
  }> {
    try {
      // 読み取り専用モードでは模擬応答を使用
      if (this.config.readOnlyMode) {
        return this.generateMockJapaneseTestResult(testCase);
      }

      // 実際のBedrock推論（Nova Proを使用）
      const requestBody = {
        inputText: testCase.prompt,
        textGenerationConfig: {
          maxTokenCount: 1000,
          temperature: 0.7,
          topP: 0.9
        }
      };

      const command = new InvokeModelCommand({
        modelId: 'amazon.nova-pro-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody)
      });

      const response = await this.bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const generatedText = responseBody.results?.[0]?.outputText || '';

      // 日本語精度を評価
      const score = this.evaluateJapaneseAccuracy(generatedText, testCase);
      const details = this.generateEvaluationDetails(generatedText, testCase, score);

      return { score, details };

    } catch (error) {
      console.error(`❌ 日本語テスト実行エラー (${testCase.id}):`, error);
      return {
        score: 0,
        details: `テスト実行エラー: ${error}`
      };
    }
  }

  /**
   * 模擬日本語テスト結果生成
   */
  private generateMockJapaneseTestResult(testCase: JapaneseTestCase): {
    score: number;
    details: string;
  } {
    // カテゴリ別の模擬スコア
    const mockScores = {
      'keigo-basic': 0.92,
      'business-japanese': 0.96,
      'technical-japanese': 0.94,
      'casual-conversation': 0.98,
      'complex-grammar': 0.89
    };

    const score = mockScores[testCase.category as keyof typeof mockScores] || 0.90;
    const details = `模擬テスト結果: ${testCase.category} - スコア ${(score * 100).toFixed(1)}%`;

    return { score, details };
  }

  /**
   * 日本語精度評価
   */
  private evaluateJapaneseAccuracy(text: string, testCase: JapaneseTestCase): number {
    let totalScore = 0;
    let criteriaCount = 0;

    // 1. 文法ポイントの評価
    const grammarScore = this.evaluateGrammarPoints(text, testCase.grammarPoints);
    totalScore += grammarScore;
    criteriaCount++;

    // 2. 期待要素の評価
    const elementsScore = this.evaluateExpectedElements(text, testCase.expectedElements);
    totalScore += elementsScore;
    criteriaCount++;

    // 3. 敬語レベルの評価
    const formalityScore = this.evaluateFormalityLevel(text, testCase.formalityLevel);
    totalScore += formalityScore;
    criteriaCount++;

    // 4. 日本語文字使用率の評価
    const characterScore = this.evaluateJapaneseCharacterUsage(text);
    totalScore += characterScore;
    criteriaCount++;

    return totalScore / criteriaCount;
  }

  /**
   * 文法ポイント評価
   */
  private evaluateGrammarPoints(text: string, grammarPoints: string[]): number {
    const foundPoints = grammarPoints.filter(point => text.includes(point));
    return foundPoints.length / grammarPoints.length;
  }

  /**
   * 期待要素評価
   */
  private evaluateExpectedElements(text: string, expectedElements: string[]): number {
    let score = 0;
    
    for (const element of expectedElements) {
      switch (element) {
        case 'です・ます調':
          score += text.includes('です') || text.includes('ます') ? 1 : 0;
          break;
        case 'ビジネス用語':
          score += /効果|効率|改善|最適化|導入/.test(text) ? 1 : 0;
          break;
        case '技術用語':
          score += /システム|アーキテクチャ|インフラ|API/.test(text) ? 1 : 0;
          break;
        default:
          score += 0.5; // 部分点
      }
    }
    
    return score / expectedElements.length;
  }

  /**
   * 敬語レベル評価
   */
  private evaluateFormalityLevel(text: string, expectedLevel: string): number {
    const formalPatterns = /ございます|いたします|させていただき/;
    const politePatterns = /です|ます|でしょう/;
    const casualPatterns = /だ|である|〜ね|〜よ/;

    switch (expectedLevel) {
      case 'formal':
        return formalPatterns.test(text) ? 1.0 : (politePatterns.test(text) ? 0.7 : 0.3);
      case 'polite':
        return politePatterns.test(text) ? 1.0 : 0.5;
      case 'casual':
        return casualPatterns.test(text) ? 1.0 : (politePatterns.test(text) ? 0.8 : 0.4);
      default:
        return 0.5;
    }
  }

  /**
   * 日本語文字使用率評価
   */
  private evaluateJapaneseCharacterUsage(text: string): number {
    const hiragana = (text.match(/[\u3040-\u309F]/g) || []).length;
    const katakana = (text.match(/[\u30A0-\u30FF]/g) || []).length;
    const kanji = (text.match(/[\u4E00-\u9FAF]/g) || []).length;
    
    const japaneseChars = hiragana + katakana + kanji;
    const totalChars = text.length;
    const ratio = japaneseChars / totalChars;

    // 適切な日本語使用率（70-95%）を評価
    if (ratio >= 0.7 && ratio <= 0.95) {
      return 1.0;
    } else if (ratio >= 0.5) {
      return 0.8;
    } else {
      return 0.4;
    }
  }

  /**
   * 詳細精度メトリクス計算
   */
  private calculateDetailedAccuracy(categoryResults: { [category: string]: { score: number; details: string } }): {
    overallAccuracy: number;
    grammarAccuracy: number;
    vocabularyAccuracy: number;
    contextAccuracy: number;
    formalityAccuracy: number;
  } {
    const scores = Object.values(categoryResults).map(r => r.score);
    const overallAccuracy = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    // カテゴリ別精度を計算
    const grammarAccuracy = categoryResults['complex-grammar']?.score || 0.9;
    const vocabularyAccuracy = categoryResults['technical-japanese']?.score || 0.9;
    const contextAccuracy = categoryResults['business-japanese']?.score || 0.9;
    const formalityAccuracy = categoryResults['keigo-basic']?.score || 0.9;

    return {
      overallAccuracy,
      grammarAccuracy,
      vocabularyAccuracy,
      contextAccuracy,
      formalityAccuracy
    };
  }

  /**
   * 評価詳細生成
   */
  private generateEvaluationDetails(text: string, testCase: JapaneseTestCase, score: number): string {
    return `カテゴリ: ${testCase.category}, スコア: ${(score * 100).toFixed(1)}%, ` +
           `敬語レベル: ${testCase.formalityLevel}, 難易度: ${testCase.difficulty}`;
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    console.log('🧹 日本語精度テストモジュールをクリーンアップ中...');
    console.log('✅ 日本語精度テストモジュールのクリーンアップ完了');
  }
}

export default JapaneseAccuracyTestModule;