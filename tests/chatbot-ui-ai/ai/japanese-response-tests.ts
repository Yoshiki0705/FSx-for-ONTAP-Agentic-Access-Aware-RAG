/**
 * 日本語応答品質テスト
 * 
 * AI応答の日本語品質を包括的に評価
 * - 文法・語彙チェック
 * - 文脈理解テスト
 * - 多言語対応テスト
 * - 敬語・丁寧語テスト
 * - 技術用語適切性テスト
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { fromIni } from '@aws-sdk/credential-providers';
import { TestResult, TestConfiguration } from '../types/test-types';

/**
 * 日本語応答品質テストクラス
 */
export class JapaneseResponseTests {
  private client: BedrockRuntimeClient;
  private config: TestConfiguration;
  private testResults: TestResult[] = [];

  constructor(config: TestConfiguration) {
    this.config = config;
    this.client = new BedrockRuntimeClient({
      region: config.ai.bedrockRegion,
      credentials: fromIni({ profile: process.env.AWS_PROFILE || 'user01' })
    });
  }

  /**
   * 全ての日本語応答品質テストを実行
   */
  async runAllTests(): Promise<TestResult[]> {
    console.log('🇯🇵 日本語応答品質テスト開始');
    this.testResults = [];

    const tests = [
      { name: '日本語文法テスト', method: this.testJapaneseGrammar.bind(this) },
      { name: '語彙使用テスト', method: this.testVocabularyUsage.bind(this) },
      { name: '文脈理解テスト', method: this.testContextUnderstanding.bind(this) },
      { name: '多言語対応テスト', method: this.testMultilingualSupport.bind(this) },
      { name: '敬語・丁寧語テスト', method: this.testPoliteLanguage.bind(this) },
      { name: '技術用語適切性テスト', method: this.testTechnicalTerms.bind(this) },
      { name: '文章構造テスト', method: this.testSentenceStructure.bind(this) },
      { name: '読みやすさテスト', method: this.testReadability.bind(this) }
    ];

    for (const test of tests) {
      try {
        console.log(`  🔍 実行中: ${test.name}`);
        const result = await test.method();
        this.testResults.push(result);
        
        if (result.status === 'passed') {
          console.log(`  ✅ 成功: ${test.name}`);
        } else {
          console.log(`  ❌ 失敗: ${test.name} - ${result.error}`);
        }
      } catch (error) {
        const errorResult: TestResult = {
          testName: test.name,
          category: 'AI',
          status: 'failed',
          duration: 0,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
          priority: 'high'
        };
        this.testResults.push(errorResult);
        console.log(`  ❌ エラー: ${test.name} - ${error}`);
      }
    }

    const summary = this.generateTestSummary();
    console.log(`🇯🇵 日本語応答品質テスト完了: ${summary.passed}/${summary.total} 成功`);
    
    return this.testResults;
  }

  /**
   * 日本語文法テスト
   */
  async testJapaneseGrammar(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const grammarTests = [
        {
          prompt: 'Amazon FSx for NetApp ONTAPの特徴について説明してください。',
          expectedPatterns: ['です', 'ます', '。', '、'],
          description: '基本的な丁寧語と句読点の使用'
        },
        {
          prompt: 'RAGシステムの仕組みを詳しく教えてください。',
          expectedPatterns: ['システム', '仕組み', 'について', 'により'],
          description: '技術説明における適切な助詞の使用'
        },
        {
          prompt: 'サーバーレスアーキテクチャのメリットとデメリットを比較してください。',
          expectedPatterns: ['メリット', 'デメリット', '一方で', 'しかし'],
          description: '比較表現における適切な接続詞の使用'
        }
      ];

      const results = [];
      for (const test of grammarTests) {
        const response = await this.getAIResponse(test.prompt);
        const grammarScore = this.analyzeGrammar(response, test.expectedPatterns);
        
        results.push({
          prompt: test.prompt,
          response: response.substring(0, 200) + '...',
          grammarScore,
          expectedPatterns: test.expectedPatterns,
          foundPatterns: this.findPatterns(response, test.expectedPatterns),
          success: grammarScore > 80
        });
      }

      const allSuccessful = results.every(r => r.success);
      const averageGrammarScore = results.reduce((sum, r) => sum + r.grammarScore, 0) / results.length;

      return {
        testName: '日本語文法テスト',
        category: 'AI',
        status: allSuccessful ? 'passed' : 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        priority: 'high',
        details: {
          testedPrompts: grammarTests.length,
          successfulTests: results.filter(r => r.success).length,
          averageGrammarScore,
          results
        }
      };

    } catch (error) {
      return {
        testName: '日本語文法テスト',
        category: 'AI',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        priority: 'high'
      };
    }
  }

  /**
   * 語彙使用テスト
   */
  async testVocabularyUsage(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const vocabularyTests = [
        {
          prompt: 'クラウドコンピューティングの基本概念を初心者向けに説明してください。',
          expectedLevel: 'beginner',
          avoidTerms: ['アーキテクチャ', 'インフラストラクチャ', 'オーケストレーション'],
          preferTerms: ['仕組み', 'システム', '方法']
        },
        {
          prompt: 'AWS Lambdaの技術的な実装詳細について専門的に説明してください。',
          expectedLevel: 'expert',
          preferTerms: ['アーキテクチャ', 'ランタイム', 'コンテナ', 'オーケストレーション'],
          avoidTerms: ['簡単に', 'なんとなく', 'だいたい']
        }
      ];

      const results = [];
      for (const test of vocabularyTests) {
        const response = await this.getAIResponse(test.prompt);
        const vocabularyScore = this.analyzeVocabulary(response, test);
        
        results.push({
          prompt: test.prompt,
          expectedLevel: test.expectedLevel,
          vocabularyScore,
          appropriateTermsUsed: this.countTermUsage(response, test.preferTerms),
          inappropriateTermsUsed: this.countTermUsage(response, test.avoidTerms),
          success: vocabularyScore > 75
        });
      }

      const allSuccessful = results.every(r => r.success);
      const averageVocabularyScore = results.reduce((sum, r) => sum + r.vocabularyScore, 0) / results.length;

      return {
        testName: '語彙使用テスト',
        category: 'AI',
        status: allSuccessful ? 'passed' : 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        priority: 'high',
        details: {
          testedLevels: vocabularyTests.length,
          successfulTests: results.filter(r => r.success).length,
          averageVocabularyScore,
          results
        }
      };

    } catch (error) {
      return {
        testName: '語彙使用テスト',
        category: 'AI',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        priority: 'high'
      };
    }
  }
  
/**
   * 文脈理解テスト
   */
  async testContextUnderstanding(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const contextTests = [
        {
          context: 'ユーザーは初心者のエンジニアです。',
          prompt: 'Dockerコンテナについて教えてください。',
          expectedApproach: 'beginner-friendly',
          checkPoints: ['基本的な', '簡単に', '例えば', 'まず']
        },
        {
          context: 'ユーザーは経験豊富なシステムアーキテクトです。',
          prompt: 'マイクロサービスアーキテクチャの設計原則について説明してください。',
          expectedApproach: 'technical-detailed',
          checkPoints: ['アーキテクチャ', '設計パターン', '実装', '最適化']
        }
      ];

      const results = [];
      for (const test of contextTests) {
        const fullPrompt = `${test.context}\n\n${test.prompt}`;
        const response = await this.getAIResponse(fullPrompt);
        const contextScore = this.analyzeContextAdaptation(response, test);
        
        results.push({
          context: test.context,
          prompt: test.prompt,
          expectedApproach: test.expectedApproach,
          contextScore,
          adaptationFound: this.checkContextAdaptation(response, test.checkPoints),
          success: contextScore > 70
        });
      }

      const allSuccessful = results.every(r => r.success);
      const averageContextScore = results.reduce((sum, r) => sum + r.contextScore, 0) / results.length;

      return {
        testName: '文脈理解テスト',
        category: 'AI',
        status: allSuccessful ? 'passed' : 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        priority: 'high',
        details: {
          testedContexts: contextTests.length,
          successfulTests: results.filter(r => r.success).length,
          averageContextScore,
          results
        }
      };

    } catch (error) {
      return {
        testName: '文脈理解テスト',
        category: 'AI',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        priority: 'high'
      };
    }
  }

  /**
   * 多言語対応テスト
   */
  async testMultilingualSupport(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const multilingualTests = [
        {
          prompt: 'Please explain AWS Lambda in Japanese.',
          expectedLanguage: 'japanese',
          shouldContain: ['AWS Lambda', 'サーバーレス', '関数', '実行']
        },
        {
          prompt: '英語の技術用語を含めて、クラウドストレージについて説明してください。',
          expectedLanguage: 'mixed',
          shouldContain: ['クラウドストレージ', 'Cloud Storage', 'データ', 'アクセス']
        }
      ];

      const results = [];
      for (const test of multilingualTests) {
        const response = await this.getAIResponse(test.prompt);
        const languageScore = this.analyzeLanguageUsage(response, test);
        
        results.push({
          prompt: test.prompt,
          expectedLanguage: test.expectedLanguage,
          languageScore,
          containsExpectedTerms: this.checkTermsPresence(response, test.shouldContain),
          success: languageScore > 75
        });
      }

      const allSuccessful = results.every(r => r.success);
      const averageLanguageScore = results.reduce((sum, r) => sum + r.languageScore, 0) / results.length;

      return {
        testName: '多言語対応テスト',
        category: 'AI',
        status: allSuccessful ? 'passed' : 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        priority: 'medium',
        details: {
          testedLanguages: multilingualTests.length,
          successfulTests: results.filter(r => r.success).length,
          averageLanguageScore,
          results
        }
      };

    } catch (error) {
      return {
        testName: '多言語対応テスト',
        category: 'AI',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        priority: 'medium'
      };
    }
  }

  /**
   * 敬語・丁寧語テスト
   */
  async testPoliteLanguage(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const politeLanguageTests = [
        {
          prompt: 'お客様向けの説明として、AWSのセキュリティ機能について教えてください。',
          expectedLevel: 'very-polite',
          requiredPatterns: ['です', 'ます', 'いたします', 'ございます'],
          avoidPatterns: ['だ', 'である', 'する']
        },
        {
          prompt: '社内向けの技術資料として、Lambda関数の最適化方法を説明してください。',
          expectedLevel: 'business-polite',
          requiredPatterns: ['です', 'ます', 'します'],
          avoidPatterns: ['だ', 'である']
        }
      ];

      const results = [];
      for (const test of politeLanguageTests) {
        const response = await this.getAIResponse(test.prompt);
        const politenessScore = this.analyzePoliteness(response, test);
        
        results.push({
          prompt: test.prompt,
          expectedLevel: test.expectedLevel,
          politenessScore,
          requiredPatternsFound: this.countPatternMatches(response, test.requiredPatterns),
          avoidPatternsFound: this.countPatternMatches(response, test.avoidPatterns),
          success: politenessScore > 80
        });
      }

      const allSuccessful = results.every(r => r.success);
      const averagePolitenessScore = results.reduce((sum, r) => sum + r.politenessScore, 0) / results.length;

      return {
        testName: '敬語・丁寧語テスト',
        category: 'AI',
        status: allSuccessful ? 'passed' : 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        priority: 'high',
        details: {
          testedLevels: politeLanguageTests.length,
          successfulTests: results.filter(r => r.success).length,
          averagePolitenessScore,
          results
        }
      };

    } catch (error) {
      return {
        testName: '敬語・丁寧語テスト',
        category: 'AI',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        priority: 'high'
      };
    }
  }

  /**
   * 技術用語適切性テスト
   */
  async testTechnicalTerms(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const technicalTermTests = [
        {
          prompt: 'コンテナオーケストレーションについて説明してください。',
          expectedTerms: ['コンテナ', 'オーケストレーション', 'Kubernetes', 'Docker'],
          appropriateUsage: ['適切な日本語訳', '英語併記', '説明付き']
        },
        {
          prompt: 'サーバーレスアーキテクチャのメリットを教えてください。',
          expectedTerms: ['サーバーレス', 'アーキテクチャ', 'スケーリング', 'コスト効率'],
          appropriateUsage: ['文脈に応じた使用', '初心者向け説明']
        }
      ];

      const results = [];
      for (const test of technicalTermTests) {
        const response = await this.getAIResponse(test.prompt);
        const termUsageScore = this.analyzeTechnicalTermUsage(response, test);
        
        results.push({
          prompt: test.prompt,
          expectedTerms: test.expectedTerms,
          termUsageScore,
          termsFound: this.findTechnicalTerms(response, test.expectedTerms),
          appropriateUsage: this.checkTermAppropriateUsage(response, test.appropriateUsage),
          success: termUsageScore > 75
        });
      }

      const allSuccessful = results.every(r => r.success);
      const averageTermUsageScore = results.reduce((sum, r) => sum + r.termUsageScore, 0) / results.length;

      return {
        testName: '技術用語適切性テスト',
        category: 'AI',
        status: allSuccessful ? 'passed' : 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        priority: 'high',
        details: {
          testedTermSets: technicalTermTests.length,
          successfulTests: results.filter(r => r.success).length,
          averageTermUsageScore,
          results
        }
      };

    } catch (error) {
      return {
        testName: '技術用語適切性テスト',
        category: 'AI',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        priority: 'high'
      };
    }
  }

  /**
   * 文章構造テスト
   */
  async testSentenceStructure(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const structureTests = [
        {
          prompt: 'AWS CDKを使ったインフラ構築の手順を説明してください。',
          expectedStructure: 'step-by-step',
          checkPoints: ['まず', '次に', '最後に', '手順', 'ステップ']
        },
        {
          prompt: 'マイクロサービスとモノリシックアーキテクチャを比較してください。',
          expectedStructure: 'comparison',
          checkPoints: ['一方で', 'しかし', '対して', '比較', 'メリット', 'デメリット']
        }
      ];

      const results = [];
      for (const test of structureTests) {
        const response = await this.getAIResponse(test.prompt);
        const structureScore = this.analyzeTextStructure(response, test);
        
        results.push({
          prompt: test.prompt,
          expectedStructure: test.expectedStructure,
          structureScore,
          structureElementsFound: this.findStructureElements(response, test.checkPoints),
          logicalFlow: this.checkLogicalFlow(response),
          success: structureScore > 75
        });
      }

      const allSuccessful = results.every(r => r.success);
      const averageStructureScore = results.reduce((sum, r) => sum + r.structureScore, 0) / results.length;

      return {
        testName: '文章構造テスト',
        category: 'AI',
        status: allSuccessful ? 'passed' : 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        priority: 'medium',
        details: {
          testedStructures: structureTests.length,
          successfulTests: results.filter(r => r.success).length,
          averageStructureScore,
          results
        }
      };

    } catch (error) {
      return {
        testName: '文章構造テスト',
        category: 'AI',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        priority: 'medium'
      };
    }
  }

  /**
   * 読みやすさテスト
   */
  async testReadability(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const readabilityTests = [
        {
          prompt: '初心者向けにクラウドコンピューティングを説明してください。',
          targetAudience: 'beginner',
          maxSentenceLength: 50,
          preferredElements: ['例', '具体的', '分かりやすく']
        },
        {
          prompt: 'DevOpsエンジニア向けにCI/CDパイプラインの設計について説明してください。',
          targetAudience: 'expert',
          maxSentenceLength: 80,
          preferredElements: ['実装', '最適化', '効率的']
        }
      ];

      const results = [];
      for (const test of readabilityTests) {
        const response = await this.getAIResponse(test.prompt);
        const readabilityScore = this.analyzeReadability(response, test);
        
        results.push({
          prompt: test.prompt,
          targetAudience: test.targetAudience,
          readabilityScore,
          averageSentenceLength: this.calculateAverageSentenceLength(response),
          complexityLevel: this.assessComplexityLevel(response),
          success: readabilityScore > 75
        });
      }

      const allSuccessful = results.every(r => r.success);
      const averageReadabilityScore = results.reduce((sum, r) => sum + r.readabilityScore, 0) / results.length;

      return {
        testName: '読みやすさテスト',
        category: 'AI',
        status: allSuccessful ? 'passed' : 'failed',
        duration: Date.now() - startTime,
        timestamp: new Date(),
        priority: 'medium',
        details: {
          testedAudiences: readabilityTests.length,
          successfulTests: results.filter(r => r.success).length,
          averageReadabilityScore,
          results
        }
      };

    } catch (error) {
      return {
        testName: '読みやすさテスト',
        category: 'AI',
        status: 'failed',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        priority: 'medium'
      };
    }
  }

  // ヘルパーメソッド

  /**
   * AI応答を取得
   */
  private async getAIResponse(prompt: string): Promise<string> {
    const command = new InvokeModelCommand({
      modelId: this.config.ai.models.claude,
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      }),
      contentType: "application/json",
      accept: "application/json"
    });

    const response = await this.client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.content[0].text;
  }

  /**
   * 文法分析
   */
  private analyzeGrammar(text: string, expectedPatterns: string[]): number {
    let score = 0;
    const totalPatterns = expectedPatterns.length;
    
    for (const pattern of expectedPatterns) {
      if (text.includes(pattern)) {
        score += 100 / totalPatterns;
      }
    }
    
    // 基本的な文法チェック
    const sentences = text.split(/[。！？]/);
    const properSentences = sentences.filter(s => s.trim().length > 0);
    const grammarScore = properSentences.length > 0 ? 100 : 0;
    
    return Math.min(100, (score + grammarScore) / 2);
  }

  /**
   * パターン検索
   */
  private findPatterns(text: string, patterns: string[]): string[] {
    return patterns.filter(pattern => text.includes(pattern));
  }

  /**
   * 語彙分析
   */
  private analyzeVocabulary(text: string, test: any): number {
    let score = 100;
    
    // 適切な用語の使用をチェック
    const preferTermsFound = this.countTermUsage(text, test.preferTerms || []);
    const avoidTermsFound = this.countTermUsage(text, test.avoidTerms || []);
    
    // スコア計算
    score += preferTermsFound * 10;
    score -= avoidTermsFound * 15;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * 用語使用回数カウント
   */
  private countTermUsage(text: string, terms: string[]): number {
    return terms.reduce((count, term) => {
      const regex = new RegExp(term, 'gi');
      const matches = text.match(regex);
      return count + (matches ? matches.length : 0);
    }, 0);
  }

  /**
   * 文脈適応分析
   */
  private analyzeContextAdaptation(text: string, test: any): number {
    const checkPoints = test.checkPoints || [];
    const foundPoints = this.checkContextAdaptation(text, checkPoints);
    return (foundPoints / Math.max(1, checkPoints.length)) * 100;
  }

  /**
   * 文脈適応チェック
   */
  private checkContextAdaptation(text: string, checkPoints: string[]): number {
    return checkPoints.filter(point => text.includes(point)).length;
  }

  /**
   * 言語使用分析
   */
  private analyzeLanguageUsage(text: string, test: any): number {
    const shouldContain = test.shouldContain || [];
    const containsCount = this.checkTermsPresence(text, shouldContain);
    return (containsCount / Math.max(1, shouldContain.length)) * 100;
  }

  /**
   * 用語存在チェック
   */
  private checkTermsPresence(text: string, terms: string[]): number {
    return terms.filter(term => text.includes(term)).length;
  }

  /**
   * 丁寧語分析
   */
  private analyzePoliteness(text: string, test: any): number {
    const requiredFound = this.countPatternMatches(text, test.requiredPatterns || []);
    const avoidFound = this.countPatternMatches(text, test.avoidPatterns || []);
    
    let score = (requiredFound / Math.max(1, test.requiredPatterns?.length || 1)) * 100;
    score -= (avoidFound * 20); // ペナルティ
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * パターンマッチ数カウント
   */
  private countPatternMatches(text: string, patterns: string[]): number {
    return patterns.reduce((count, pattern) => {
      const regex = new RegExp(pattern, 'g');
      const matches = text.match(regex);
      return count + (matches ? matches.length : 0);
    }, 0);
  }

  /**
   * 技術用語使用分析
   */
  private analyzeTechnicalTermUsage(text: string, test: any): number {
    const expectedTerms = test.expectedTerms || [];
    const termsFound = this.findTechnicalTerms(text, expectedTerms);
    return (termsFound.length / Math.max(1, expectedTerms.length)) * 100;
  }

  /**
   * 技術用語検索
   */
  private findTechnicalTerms(text: string, terms: string[]): string[] {
    return terms.filter(term => text.includes(term));
  }

  /**
   * 用語適切性チェック
   */
  private checkTermAppropriateUsage(text: string, criteria: string[]): boolean {
    // 簡単な適切性チェック（実際の実装ではより詳細な分析が必要）
    return criteria.some(criterion => text.length > 100); // 基本的な長さチェック
  }

  /**
   * 文章構造分析
   */
  private analyzeTextStructure(text: string, test: any): number {
    const checkPoints = test.checkPoints || [];
    const elementsFound = this.findStructureElements(text, checkPoints);
    return (elementsFound.length / Math.max(1, checkPoints.length)) * 100;
  }

  /**
   * 構造要素検索
   */
  private findStructureElements(text: string, elements: string[]): string[] {
    return elements.filter(element => text.includes(element));
  }

  /**
   * 論理的流れチェック
   */
  private checkLogicalFlow(text: string): boolean {
    // 基本的な論理的流れのチェック
    const sentences = text.split(/[。！？]/).filter(s => s.trim().length > 0);
    return sentences.length >= 3; // 最低3文以上
  }

  /**
   * 読みやすさ分析
   */
  private analyzeReadability(text: string, test: any): number {
    const avgSentenceLength = this.calculateAverageSentenceLength(text);
    const maxLength = test.maxSentenceLength || 60;
    
    let score = 100;
    if (avgSentenceLength > maxLength) {
      score -= (avgSentenceLength - maxLength) * 2;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * 平均文長計算
   */
  private calculateAverageSentenceLength(text: string): number {
    const sentences = text.split(/[。！？]/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return 0;
    
    const totalLength = sentences.reduce((sum, sentence) => sum + sentence.length, 0);
    return totalLength / sentences.length;
  }

  /**
   * 複雑度レベル評価
   */
  private assessComplexityLevel(text: string): string {
    const avgSentenceLength = this.calculateAverageSentenceLength(text);
    
    if (avgSentenceLength < 30) return 'simple';
    if (avgSentenceLength < 60) return 'moderate';
    return 'complex';
  }

  /**
   * テスト結果サマリー生成
   */
  private generateTestSummary(): { total: number; passed: number; failed: number } {
    const total = this.testResults.length;
    const passed = this.testResults.filter(r => r.status === 'passed').length;
    const failed = total - passed;
    
    return { total, passed, failed };
  }
}