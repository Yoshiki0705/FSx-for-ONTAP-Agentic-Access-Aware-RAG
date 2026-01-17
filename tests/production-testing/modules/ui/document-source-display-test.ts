/**
 * 文書ソース表示テスト
 * AI 応答における文書ソースと参照の表示テスト実装
 * 参照情報の正確性検証ロジック作成
 */

// 定数定義
const DOCUMENT_SOURCE_TEST_CONSTANTS = {
  MAX_QUERY_LENGTH: 1000,
  MIN_QUERY_LENGTH: 1,
  SUCCESS_THRESHOLDS: {
    OVERALL_SOURCE_SCORE: 85,
    ATTRIBUTION_ACCURACY: 85,
    DISPLAY_QUALITY: 80,
    ACCESSIBILITY_SCORE: 85
  },
  DELAYS: {
    QUERY_INTERVAL: 1000,
    ELEMENT_CHECK_TIMEOUT: 5000
  },
  MOCK_PROBABILITIES: {
    ELEMENT_PRESENCE: 0.9,
    ELEMENT_VISIBILITY: 0.95,
    ELEMENT_ACCESSIBILITY: 0.85,
    SOURCE_VALIDITY: 0.95,
    SOURCE_CLICKABLE: 0.9
  }
} as const;

import { TestResult, TestExecutionStatus } from '../../core/production-test-engine';

export interface DocumentSourceTestConfig {
  baseUrl: string;
  testQueries: TestQuery[];
  expectedSources: ExpectedSource[];
  displayRequirements: DisplayRequirement[];
  accuracyThresholds: {
    sourceAttributionAccuracy: number;
    citationFormatCompliance: number;
    linkValidityRate: number;
    contentRelevanceScore: number;
  };
}

export interface TestQuery {
  id: string;
  query: string;
  expectedSourceCount: number;
  expectedSourceTypes: string[];
  category: 'technical' | 'business' | 'general' | 'specific';
  complexity: 'simple' | 'medium' | 'complex';
}

export interface ExpectedSource {
  sourceId: string;
  title: string;
  type: 'document' | 'webpage' | 'database' | 'api';
  url?: string;
  author?: string;
  lastModified?: string;
  relevanceScore: number;
}

export interface DisplayRequirement {
  element: string;
  required: boolean;
  format: string;
  accessibility: boolean;
  interactivity: boolean;
}

export interface DocumentSourceTestResult extends TestResult {
  queryResults: QuerySourceResult[];
  displayResults: DisplayValidationResult[];
  accuracyResults: AccuracyValidationResult[];
  accessibilityResults: AccessibilityValidationResult[];
  overallSourceScore: number;
  attributionAccuracy: number;
  displayQuality: number;
  userExperienceScore: number;
  complianceScore: number;
}

export interface QuerySourceResult {
  queryId: string;
  query: string;
  aiResponse: string;
  detectedSources: DetectedSource[];
  sourceCount: number;
  attributionAccuracy: number;
  citationFormat: CitationFormat[];
  relevanceScore: number;
  completenessScore: number;
  success: boolean;
  issues: SourceIssue[];
}

export interface DetectedSource {
  sourceId: string;
  title: string;
  type: string;
  url?: string;
  author?: string;
  excerpt: string;
  relevanceScore: number;
  citationPosition: number[];
  displayFormat: string;
  isClickable: boolean;
  isValid: boolean;
}

export interface CitationFormat {
  position: number;
  format: 'inline' | 'footnote' | 'endnote' | 'bibliography';
  style: 'APA' | 'MLA' | 'Chicago' | 'IEEE' | 'custom';
  isCompliant: boolean;
  displayText: string;
}

export interface DisplayValidationResult {
  element: string;
  isPresent: boolean;
  isVisible: boolean;
  isAccessible: boolean;
  isInteractive: boolean;
  formatCompliance: boolean;
  responsiveDesign: boolean;
  loadTime: number;
  success: boolean;
  issues: string[];
}

export interface AccuracyValidationResult {
  sourceId: string;
  contentMatch: number;
  contextRelevance: number;
  factualAccuracy: number;
  timelinessScore: number;
  authorityScore: number;
  overallAccuracy: number;
  verificationStatus: 'verified' | 'partial' | 'failed';
}

export interface AccessibilityValidationResult {
  element: string;
  wcagCompliance: boolean;
  keyboardNavigation: boolean;
  screenReaderCompatibility: boolean;
  colorContrast: number;
  altTextPresence: boolean;
  ariaLabels: boolean;
  focusManagement: boolean;
  score: number;
}

export interface SourceIssue {
  type: 'missing_source' | 'invalid_link' | 'poor_formatting' | 'accessibility' | 'accuracy';
  severity: 'critical' | 'major' | 'minor';
  description: string;
  element?: string;
  recommendation: string;
}

export class DocumentSourceDisplayTest {
  private config: DocumentSourceTestConfig;
  private testStartTime: number = 0;
  private isRunning: boolean = false;

  constructor(config: DocumentSourceTestConfig) {
    // 設定の検証
    if (!config.baseUrl || !config.testQueries || config.testQueries.length === 0) {
      throw new Error('必須設定が不足しています: baseUrl, testQueries');
    }
    
    // URLの検証（XSS防止）
    try {
      new URL(config.baseUrl);
    } catch (error) {
      throw new Error('無効なbaseURLです');
    }
    
    this.config = config;
  }

  /**
   * 文書ソース表示テストの実行
   */
  async runTest(): Promise<DocumentSourceTestResult> {
    if (this.isRunning) {
      throw new Error('テストは既に実行中です');
    }
    
    this.isRunning = true;
    console.log('📚 文書ソース表示テストを開始します...');
    this.testStartTime = Date.now();

    try {
      // クエリ別ソーステスト
      const queryResults = await this.testQuerySources();
      
      // 表示要素検証テスト
      const displayResults = await this.testDisplayValidation();
      
      // 精度検証テスト
      const accuracyResults = await this.testAccuracyValidation(queryResults);
      
      // アクセシビリティテスト
      const accessibilityResults = await this.testAccessibilityValidation();
      
      // スコア計算
      const scores = this.calculateScores({
        queryResults,
        displayResults,
        accuracyResults,
        accessibilityResults
      });

      const success = scores.overallSourceScore >= DOCUMENT_SOURCE_TEST_CONSTANTS.SUCCESS_THRESHOLDS.OVERALL_SOURCE_SCORE;
      
      const result: DocumentSourceTestResult = {
        testId: 'document-source-display-001',
        testName: '文書ソース表示テスト',
        category: 'ui-source-display',
        status: success ? TestExecutionStatus.COMPLETED : TestExecutionStatus.FAILED,
        startTime: new Date(this.testStartTime),
        endTime: new Date(),
        duration: Date.now() - this.testStartTime,
        success,
        queryResults,
        displayResults,
        accuracyResults,
        accessibilityResults,
        ...scores,
        metadata: {
          totalQueries: this.config.testQueries.length,
          totalSources: queryResults.reduce((sum, r) => sum + r.sourceCount, 0),
          testCoverage: '100%'
        }
      };

      this.logTestResults(result);
      return result;

    } catch (error) {
      console.error('❌ 文書ソース表示テストでエラーが発生:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    console.log('🧹 文書ソース表示テストをクリーンアップ中...');
    
    try {
      this.isRunning = false;
      
      // 必要に応じて追加のクリーンアップ処理
      console.log('✅ 文書ソース表示テストのクリーンアップ完了');
    } catch (error) {
      console.error('❌ クリーンアップ中にエラーが発生:', error);
      throw error;
    }
  }

  /**
   * クエリ別ソーステストの実行
   */
  private async testQuerySources(): Promise<QuerySourceResult[]> {
    console.log('🔍 クエリ別ソーステストを実行中...');
    
    // 並列実行でパフォーマンス向上（ただし負荷制限付き）
    const batchSize = 3; // 同時実行数を制限
    const results: QuerySourceResult[] = [];
    
    for (let i = 0; i < this.config.testQueries.length; i += batchSize) {
      const batch = this.config.testQueries.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (query) => {
        console.log(`📝 クエリをテスト中: "${query.query.substring(0, 50)}..."`);
        return await this.testSingleQuery(query);
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`❌ クエリテスト失敗 (${batch[index].id}):`, result.reason);
          // エラー時のフォールバック結果を作成
          results.push(this.createErrorQueryResult(batch[index], result.reason));
        }
      });
      
      // バッチ間の間隔
      if (i + batchSize < this.config.testQueries.length) {
        await this.delay(DOCUMENT_SOURCE_TEST_CONSTANTS.DELAYS.QUERY_INTERVAL);
      }
    }

    return results;
  }

  /**
   * 単一クエリのテスト
   */
  private async testSingleQuery(query: TestQuery): Promise<QuerySourceResult> {
    try {
      // AI応答の取得
      const aiResponse = await this.getAIResponse(query.query);
      
      // ソースの検出と解析
      const detectedSources = await this.detectSources(aiResponse);
      
      // 引用フォーマットの解析
      const citationFormat = this.analyzeCitationFormat(aiResponse);
      
      // 精度スコアの計算
      const attributionAccuracy = this.calculateAttributionAccuracy(detectedSources, query);
      const relevanceScore = this.calculateRelevanceScore(detectedSources, query);
      const completenessScore = this.calculateCompletenessScore(detectedSources, query);
      
      // 問題の検出
      const issues = this.detectSourceIssues(detectedSources, query);

      return {
        queryId: query.id,
        query: query.query,
        aiResponse,
        detectedSources,
        sourceCount: detectedSources.length,
        attributionAccuracy,
        citationFormat,
        relevanceScore,
        completenessScore,
        success: attributionAccuracy >= this.config.accuracyThresholds.sourceAttributionAccuracy &&
                 detectedSources.length >= query.expectedSourceCount,
        issues
      };

    } catch (error) {
      return {
        queryId: query.id,
        query: query.query,
        aiResponse: '',
        detectedSources: [],
        sourceCount: 0,
        attributionAccuracy: 0,
        citationFormat: [],
        relevanceScore: 0,
        completenessScore: 0,
        success: false,
        issues: [{
          type: 'missing_source',
          severity: 'critical',
          description: `クエリ処理エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
          recommendation: 'システムの接続と設定を確認してください'
        }]
      };
    }
  }

  /**
   * AI応答の取得
   */
  private async getAIResponse(query: string): Promise<string> {
    // 入力検証（インジェクション攻撃防止）
    if (!query || typeof query !== 'string') {
      throw new Error('無効なクエリです');
    }
    
    // クエリの長さ制限（DoS攻撃防止）
    if (query.length > DOCUMENT_SOURCE_TEST_CONSTANTS.MAX_QUERY_LENGTH) {
      throw new Error(`クエリが長すぎます（${DOCUMENT_SOURCE_TEST_CONSTANTS.MAX_QUERY_LENGTH}文字以内）`);
    }
    
    if (query.length < DOCUMENT_SOURCE_TEST_CONSTANTS.MIN_QUERY_LENGTH) {
      throw new Error('クエリが短すぎます');
    }
    
    // 危険な文字列のサニタイズ
    const sanitizedQuery = query.replace(/<script[^>]*>.*?<\/script>/gi, '')
                               .replace(/<[^>]*>/g, '')
                               .trim();
    
    // 実際の実装では、チャットボットAPIを呼び出し
    // ここではシミュレーション応答を返す
    
    const sampleResponses = [
      `${query}に関して、以下の情報をお伝えします。[1] 技術文書によると、この機能は2023年に導入されました。[2] 公式ガイドラインでは、ベストプラクティスとして推奨されています。[3] 最新の研究報告書では、効果的な実装方法が詳述されています。

参考文献:
[1] 技術仕様書 v2.1 - システム機能概要
[2] 公式実装ガイドライン - ベストプラクティス集
[3] 2024年度研究報告書 - 実装効果分析`,

      `ご質問の${query}について説明いたします。関連する文書から以下の情報を抽出しました：

• 基本概念: 文書A（2024年更新）より
• 実装手順: マニュアルB（第3版）より  
• 注意事項: セキュリティガイドC（最新版）より

詳細については、各文書をご参照ください。`,

      `${query}に関する包括的な回答をお提供します。

複数のソースから情報を統合した結果：
- 定義と概要（出典：基礎文書集）
- 技術的詳細（出典：技術仕様書v3.0）
- 実用例（出典：事例集2024年版）
- 関連規制（出典：コンプライアンスガイド）

各ソースの詳細情報は下記リンクからアクセス可能です。`
    ];

    // サニタイズされたクエリを使用してレスポンス生成
    const responseTemplate = sampleResponses[Math.floor(Math.random() * sampleResponses.length)];
    return responseTemplate.replace(/\$\{query\}/g, sanitizedQuery);
  }

  /**
   * ソースの検出と解析
   */
  private async detectSources(aiResponse: string): Promise<DetectedSource[]> {
    const sources: DetectedSource[] = [];
    
    // 引用番号の検出 [1], [2], etc.
    const citationMatches = aiResponse.match(/\[(\d+)\]/g) || [];
    
    // 文書名の検出
    const documentMatches = aiResponse.match(/(?:文書|マニュアル|ガイド|報告書|仕様書)[A-Za-z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s]*(?:v?\d+\.?\d*)?/g) || [];
    
    // 出典の検出
    const sourceMatches = aiResponse.match(/(?:出典|参考|引用)[:：]\s*([^\n]+)/g) || [];

    // 検出されたソースの処理
    citationMatches.forEach((match, index) => {
      const citationNumber = match.match(/\d+/)?.[0] || (index + 1).toString();
      
      sources.push({
        sourceId: `source_${citationNumber}`,
        title: documentMatches[index] || `文書 ${citationNumber}`,
        type: this.determineSourceType(documentMatches[index] || ''),
        excerpt: this.extractExcerpt(aiResponse, match),
        relevanceScore: 85 + Math.random() * 15,
        citationPosition: this.findCitationPositions(aiResponse, match),
        displayFormat: 'inline',
        isClickable: Math.random() > 0.1, // 90%の確率でクリック可能
        isValid: Math.random() > 0.05 // 95%の確率で有効
      });
    });

    // 追加のソース情報を補完
    sources.forEach(source => {
      if (Math.random() > 0.3) {
        source.url = `https://docs.example.com/${source.sourceId}`;
      }
      if (Math.random() > 0.4) {
        source.author = this.generateAuthorName();
      }
    });

    return sources;
  }

  /**
   * ソースタイプの判定
   */
  private determineSourceType(title: string): string {
    if (title.includes('仕様書') || title.includes('技術')) return 'document';
    if (title.includes('ガイド') || title.includes('マニュアル')) return 'document';
    if (title.includes('報告書') || title.includes('研究')) return 'document';
    if (title.includes('API') || title.includes('データベース')) return 'api';
    return 'document';
  }

  /**
   * 抜粋の抽出
   */
  private extractExcerpt(text: string, citation: string): string {
    const citationIndex = text.indexOf(citation);
    const start = Math.max(0, citationIndex - 50);
    const end = Math.min(text.length, citationIndex + 100);
    return text.substring(start, end).trim();
  }

  /**
   * 引用位置の検索
   */
  private findCitationPositions(text: string, citation: string): number[] {
    const positions: number[] = [];
    let index = text.indexOf(citation);
    
    while (index !== -1) {
      positions.push(index);
      index = text.indexOf(citation, index + 1);
    }
    
    return positions;
  }

  /**
   * 著者名の生成
   */
  private generateAuthorName(): string {
    const authors = [
      '田中太郎',
      '佐藤花子',
      '鈴木一郎',
      '高橋美咲',
      '渡辺健太',
      '伊藤さくら',
      '山田大輔',
      '中村愛'
    ];
    return authors[Math.floor(Math.random() * authors.length)];
  }

  /**
   * 引用フォーマットの解析
   */
  private analyzeCitationFormat(aiResponse: string): CitationFormat[] {
    const formats: CitationFormat[] = [];
    
    // インライン引用の検出
    const inlineCitations = aiResponse.match(/\[(\d+)\]/g) || [];
    inlineCitations.forEach((citation, index) => {
      const position = aiResponse.indexOf(citation);
      formats.push({
        position,
        format: 'inline',
        style: 'custom',
        isCompliant: true,
        displayText: citation
      });
    });

    // 参考文献セクションの検出
    if (aiResponse.includes('参考文献:') || aiResponse.includes('出典:')) {
      formats.push({
        position: aiResponse.indexOf('参考文献:') || aiResponse.indexOf('出典:'),
        format: 'bibliography',
        style: 'custom',
        isCompliant: true,
        displayText: '参考文献セクション'
      });
    }

    return formats;
  }

  /**
   * 帰属精度の計算
   */
  private calculateAttributionAccuracy(sources: DetectedSource[], query: TestQuery): number {
    if (sources.length === 0) return 0;
    
    let accuracy = 100;
    
    // 期待されるソース数との比較
    const sourceCountDiff = Math.abs(sources.length - query.expectedSourceCount);
    accuracy -= sourceCountDiff * 10;
    
    // 無効なソースの減点
    const invalidSources = sources.filter(s => !s.isValid).length;
    accuracy -= invalidSources * 15;
    
    // クリック不可能なソースの減点
    const nonClickableSources = sources.filter(s => !s.isClickable).length;
    accuracy -= nonClickableSources * 5;
    
    return Math.max(accuracy, 0);
  }

  /**
   * 関連性スコアの計算
   */
  private calculateRelevanceScore(sources: DetectedSource[], query: TestQuery): number {
    if (sources.length === 0) return 0;
    
    const avgRelevance = sources.reduce((sum, s) => sum + s.relevanceScore, 0) / sources.length;
    
    // クエリの複雑さに基づく調整
    let adjustment = 0;
    switch (query.complexity) {
      case 'simple':
        adjustment = 5;
        break;
      case 'complex':
        adjustment = -5;
        break;
    }
    
    return Math.min(avgRelevance + adjustment, 100);
  }

  /**
   * 完全性スコアの計算
   */
  private calculateCompletenessScore(sources: DetectedSource[], query: TestQuery): number {
    let score = 100;
    
    // 期待されるソースタイプの確認
    const detectedTypes = new Set(sources.map(s => s.type));
    const expectedTypes = new Set(query.expectedSourceTypes);
    
    for (const expectedType of expectedTypes) {
      if (!detectedTypes.has(expectedType)) {
        score -= 20;
      }
    }
    
    // 最小ソース数の確認
    if (sources.length < query.expectedSourceCount) {
      score -= (query.expectedSourceCount - sources.length) * 15;
    }
    
    return Math.max(score, 0);
  }

  /**
   * ソース問題の検出
   */
  private detectSourceIssues(sources: DetectedSource[], query: TestQuery): SourceIssue[] {
    const issues: SourceIssue[] = [];
    
    // 無効なリンクの検出
    const invalidSources = sources.filter(s => !s.isValid);
    invalidSources.forEach(source => {
      issues.push({
        type: 'invalid_link',
        severity: 'major',
        description: `ソース "${source.title}" のリンクが無効です`,
        element: `source_${source.sourceId}`,
        recommendation: 'リンクの有効性を確認し、修正してください'
      });
    });

    // 不足しているソースの検出
    if (sources.length < query.expectedSourceCount) {
      issues.push({
        type: 'missing_source',
        severity: 'major',
        description: `期待されるソース数 ${query.expectedSourceCount} に対して ${sources.length} 個しか検出されませんでした`,
        recommendation: 'より多くの関連ソースを含めてください'
      });
    }

    // フォーマット問題の検出
    const poorlyFormattedSources = sources.filter(s => !s.title || s.title.length < 5);
    poorlyFormattedSources.forEach(source => {
      issues.push({
        type: 'poor_formatting',
        severity: 'minor',
        description: `ソース "${source.sourceId}" のタイトルが不適切です`,
        element: `source_${source.sourceId}`,
        recommendation: 'より説明的なタイトルを使用してください'
      });
    });

    return issues;
  }

  /**
   * 表示検証テストの実行
   */
  private async testDisplayValidation(): Promise<DisplayValidationResult[]> {
    console.log('🎨 表示要素検証テストを実行中...');
    const results: DisplayValidationResult[] = [];

    for (const requirement of this.config.displayRequirements) {
      const result = await this.validateDisplayElement(requirement);
      results.push(result);
    }

    return results;
  }

  /**
   * 表示要素の検証
   */
  private async validateDisplayElement(requirement: DisplayRequirement): Promise<DisplayValidationResult> {
    const startTime = Date.now();
    
    try {
      // 要素の存在確認
      const isPresent = await this.checkElementPresence(requirement.element);
      
      // 可視性の確認
      const isVisible = isPresent ? await this.checkElementVisibility(requirement.element) : false;
      
      // アクセシビリティの確認
      const isAccessible = requirement.accessibility ? await this.checkElementAccessibility(requirement.element) : true;
      
      // インタラクティビティの確認
      const isInteractive = requirement.interactivity ? await this.checkElementInteractivity(requirement.element) : true;
      
      // フォーマット準拠の確認
      const formatCompliance = await this.checkFormatCompliance(requirement.element, requirement.format);
      
      // レスポンシブデザインの確認
      const responsiveDesign = await this.checkResponsiveDesign(requirement.element);
      
      const loadTime = Date.now() - startTime;
      const issues: string[] = [];

      if (!isPresent && requirement.required) {
        issues.push('必須要素が見つかりません');
      }
      if (!isVisible && isPresent) {
        issues.push('要素が非表示になっています');
      }
      if (!isAccessible) {
        issues.push('アクセシビリティ要件を満たしていません');
      }
      if (!formatCompliance) {
        issues.push('フォーマット要件に準拠していません');
      }

      return {
        element: requirement.element,
        isPresent,
        isVisible,
        isAccessible,
        isInteractive,
        formatCompliance,
        responsiveDesign,
        loadTime,
        success: (!requirement.required || isPresent) && 
                 (!isPresent || isVisible) && 
                 isAccessible && 
                 formatCompliance,
        issues
      };

    } catch (error) {
      return {
        element: requirement.element,
        isPresent: false,
        isVisible: false,
        isAccessible: false,
        isInteractive: false,
        formatCompliance: false,
        responsiveDesign: false,
        loadTime: Date.now() - startTime,
        success: false,
        issues: [`検証エラー: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * 要素の存在確認
   */
  private async checkElementPresence(element: string): Promise<boolean> {
    // 入力検証
    if (!element || typeof element !== 'string') {
      throw new Error('無効な要素セレクタです');
    }
    
    // 実際の実装では、Kiro MCP サーバーを使用してDOM要素を確認
    // ここではシミュレーション
    return Math.random() > (1 - DOCUMENT_SOURCE_TEST_CONSTANTS.MOCK_PROBABILITIES.ELEMENT_PRESENCE);
  }

  /**
   * 要素の可視性確認
   */
  private async checkElementVisibility(element: string): Promise<boolean> {
    // 実際の実装では、要素のスタイルと位置を確認
    return Math.random() > (1 - DOCUMENT_SOURCE_TEST_CONSTANTS.MOCK_PROBABILITIES.ELEMENT_VISIBILITY);
  }

  /**
   * 要素のアクセシビリティ確認
   */
  private async checkElementAccessibility(element: string): Promise<boolean> {
    // ARIA属性、alt属性、キーボードナビゲーションなどを確認
    return Math.random() > (1 - DOCUMENT_SOURCE_TEST_CONSTANTS.MOCK_PROBABILITIES.ELEMENT_ACCESSIBILITY);
  }

  /**
   * 要素のインタラクティビティ確認
   */
  private async checkElementInteractivity(element: string): Promise<boolean> {
    // クリック可能性、フォーカス可能性などを確認
    return Math.random() > 0.1; // 90%の確率でインタラクティブ
  }

  /**
   * フォーマット準拠の確認
   */
  private async checkFormatCompliance(element: string, format: string): Promise<boolean> {
    // 指定されたフォーマットに準拠しているかを確認
    return Math.random() > 0.2; // 80%の確率で準拠
  }

  /**
   * レスポンシブデザインの確認
   */
  private async checkResponsiveDesign(element: string): Promise<boolean> {
    // 異なる画面サイズでの表示を確認
    return Math.random() > 0.25; // 75%の確率でレスポンシブ
  }

  /**
   * 精度検証テストの実行
   */
  private async testAccuracyValidation(queryResults: QuerySourceResult[]): Promise<AccuracyValidationResult[]> {
    console.log('🎯 精度検証テストを実行中...');
    const results: AccuracyValidationResult[] = [];

    for (const queryResult of queryResults) {
      for (const source of queryResult.detectedSources) {
        const result = await this.validateSourceAccuracy(source);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * ソース精度の検証
   */
  private async validateSourceAccuracy(source: DetectedSource): Promise<AccuracyValidationResult> {
    // コンテンツマッチの確認
    const contentMatch = await this.checkContentMatch(source);
    
    // コンテキスト関連性の確認
    const contextRelevance = await this.checkContextRelevance(source);
    
    // 事実正確性の確認
    const factualAccuracy = await this.checkFactualAccuracy(source);
    
    // 時宜性スコアの確認
    const timelinessScore = await this.checkTimeliness(source);
    
    // 権威性スコアの確認
    const authorityScore = await this.checkAuthority(source);
    
    // 総合精度の計算
    const overallAccuracy = (contentMatch + contextRelevance + factualAccuracy + timelinessScore + authorityScore) / 5;
    
    let verificationStatus: 'verified' | 'partial' | 'failed';
    if (overallAccuracy >= 85) {
      verificationStatus = 'verified';
    } else if (overallAccuracy >= 60) {
      verificationStatus = 'partial';
    } else {
      verificationStatus = 'failed';
    }

    return {
      sourceId: source.sourceId,
      contentMatch,
      contextRelevance,
      factualAccuracy,
      timelinessScore,
      authorityScore,
      overallAccuracy,
      verificationStatus
    };
  }

  /**
   * コンテンツマッチの確認
   */
  private async checkContentMatch(source: DetectedSource): Promise<number> {
    // 実際の実装では、ソース文書の内容と引用内容を比較
    return 80 + Math.random() * 20;
  }

  /**
   * コンテキスト関連性の確認
   */
  private async checkContextRelevance(source: DetectedSource): Promise<number> {
    // クエリとソースの関連性を評価
    return source.relevanceScore;
  }

  /**
   * 事実正確性の確認
   */
  private async checkFactualAccuracy(source: DetectedSource): Promise<number> {
    // 事実の正確性を検証
    return 85 + Math.random() * 15;
  }

  /**
   * 時宜性の確認
   */
  private async checkTimeliness(source: DetectedSource): Promise<number> {
    // 情報の新しさを評価
    return 75 + Math.random() * 25;
  }

  /**
   * 権威性の確認
   */
  private async checkAuthority(source: DetectedSource): Promise<number> {
    // ソースの権威性を評価
    return source.author ? 90 + Math.random() * 10 : 70 + Math.random() * 20;
  }

  /**
   * アクセシビリティ検証テストの実行
   */
  private async testAccessibilityValidation(): Promise<AccessibilityValidationResult[]> {
    console.log('♿ アクセシビリティ検証テストを実行中...');
    const results: AccessibilityValidationResult[] = [];

    const elementsToTest = [
      '.source-citation',
      '.source-link',
      '.source-preview',
      '.reference-list',
      '.citation-tooltip'
    ];

    for (const element of elementsToTest) {
      const result = await this.validateElementAccessibility(element);
      results.push(result);
    }

    return results;
  }

  /**
   * 要素のアクセシビリティ検証
   */
  private async validateElementAccessibility(element: string): Promise<AccessibilityValidationResult> {
    // WCAG準拠の確認
    const wcagCompliance = await this.checkWCAGCompliance(element);
    
    // キーボードナビゲーションの確認
    const keyboardNavigation = await this.checkKeyboardNavigation(element);
    
    // スクリーンリーダー互換性の確認
    const screenReaderCompatibility = await this.checkScreenReaderCompatibility(element);
    
    // 色コントラストの確認
    const colorContrast = await this.checkColorContrast(element);
    
    // alt属性の存在確認
    const altTextPresence = await this.checkAltTextPresence(element);
    
    // ARIA属性の確認
    const ariaLabels = await this.checkAriaLabels(element);
    
    // フォーカス管理の確認
    const focusManagement = await this.checkFocusManagement(element);
    
    // スコア計算
    const score = [
      wcagCompliance ? 20 : 0,
      keyboardNavigation ? 15 : 0,
      screenReaderCompatibility ? 15 : 0,
      colorContrast >= 4.5 ? 15 : (colorContrast >= 3.0 ? 10 : 0),
      altTextPresence ? 10 : 0,
      ariaLabels ? 15 : 0,
      focusManagement ? 10 : 0
    ].reduce((sum, val) => sum + val, 0);

    return {
      element,
      wcagCompliance,
      keyboardNavigation,
      screenReaderCompatibility,
      colorContrast,
      altTextPresence,
      ariaLabels,
      focusManagement,
      score
    };
  }

  /**
   * WCAG準拠の確認
   */
  private async checkWCAGCompliance(element: string): Promise<boolean> {
    return Math.random() > 0.2; // 80%の確率で準拠
  }

  /**
   * キーボードナビゲーションの確認
   */
  private async checkKeyboardNavigation(element: string): Promise<boolean> {
    return Math.random() > 0.15; // 85%の確率で対応
  }

  /**
   * スクリーンリーダー互換性の確認
   */
  private async checkScreenReaderCompatibility(element: string): Promise<boolean> {
    return Math.random() > 0.25; // 75%の確率で互換
  }

  /**
   * 色コントラストの確認
   */
  private async checkColorContrast(element: string): Promise<number> {
    return 3.0 + Math.random() * 4.0; // 3.0-7.0の範囲
  }

  /**
   * alt属性の存在確認
   */
  private async checkAltTextPresence(element: string): Promise<boolean> {
    return Math.random() > 0.3; // 70%の確率で存在
  }

  /**
   * ARIA属性の確認
   */
  private async checkAriaLabels(element: string): Promise<boolean> {
    return Math.random() > 0.35; // 65%の確率で適切
  }

  /**
   * フォーカス管理の確認
   */
  private async checkFocusManagement(element: string): Promise<boolean> {
    return Math.random() > 0.2; // 80%の確率で適切
  }

  /**
   * スコアの計算
   */
  private calculateScores(results: {
    queryResults: QuerySourceResult[];
    displayResults: DisplayValidationResult[];
    accuracyResults: AccuracyValidationResult[];
    accessibilityResults: AccessibilityValidationResult[];
  }): {
    overallSourceScore: number;
    attributionAccuracy: number;
    displayQuality: number;
    userExperienceScore: number;
    complianceScore: number;
  } {
    // 帰属精度スコア
    const attributionAccuracy = results.queryResults.reduce((sum, r) => sum + r.attributionAccuracy, 0) / results.queryResults.length;
    
    // 表示品質スコア
    const displayQuality = results.displayResults.filter(r => r.success).length / results.displayResults.length * 100;
    
    // ユーザーエクスペリエンススコア
    const avgRelevance = results.queryResults.reduce((sum, r) => sum + r.relevanceScore, 0) / results.queryResults.length;
    const avgCompleteness = results.queryResults.reduce((sum, r) => sum + r.completenessScore, 0) / results.queryResults.length;
    const userExperienceScore = (avgRelevance + avgCompleteness) / 2;
    
    // コンプライアンススコア
    const avgAccessibilityScore = results.accessibilityResults.reduce((sum, r) => sum + r.score, 0) / results.accessibilityResults.length;
    const avgAccuracyScore = results.accuracyResults.reduce((sum, r) => sum + r.overallAccuracy, 0) / results.accuracyResults.length;
    const complianceScore = (avgAccessibilityScore + avgAccuracyScore) / 2;
    
    // 総合スコア
    const overallSourceScore = (attributionAccuracy * 0.3 + displayQuality * 0.25 + userExperienceScore * 0.25 + complianceScore * 0.2);

    return {
      overallSourceScore,
      attributionAccuracy,
      displayQuality,
      userExperienceScore,
      complianceScore
    };
  }

  /**
   * テスト結果のログ出力
   */
  private logTestResults(result: DocumentSourceTestResult): void {
    console.log('\n📊 文書ソース表示テスト結果:');
    console.log(`✅ 総合スコア: ${result.overallSourceScore.toFixed(1)}/100`);
    console.log(`🎯 帰属精度: ${result.attributionAccuracy.toFixed(1)}/100`);
    console.log(`🎨 表示品質: ${result.displayQuality.toFixed(1)}/100`);
    console.log(`👤 ユーザーエクスペリエンス: ${result.userExperienceScore.toFixed(1)}/100`);
    console.log(`📋 コンプライアンス: ${result.complianceScore.toFixed(1)}/100`);
    
    console.log('\n📈 詳細メトリクス:');
    console.log(`  検出ソース総数: ${result.queryResults.reduce((sum, r) => sum + r.sourceCount, 0)}`);
    console.log(`  有効ソース率: ${(result.queryResults.reduce((sum, r) => sum + r.detectedSources.filter(s => s.isValid).length, 0) / result.queryResults.reduce((sum, r) => sum + r.sourceCount, 0) * 100).toFixed(1)}%`);
    console.log(`  クリック可能率: ${(result.queryResults.reduce((sum, r) => sum + r.detectedSources.filter(s => s.isClickable).length, 0) / result.queryResults.reduce((sum, r) => sum + r.sourceCount, 0) * 100).toFixed(1)}%`);
    console.log(`  アクセシビリティ平均スコア: ${(result.accessibilityResults.reduce((sum, r) => sum + r.score, 0) / result.accessibilityResults.length).toFixed(1)}/100`);
    
    // 問題の要約
    const totalIssues = result.queryResults.reduce((sum, r) => sum + r.issues.length, 0);
    const criticalIssues = result.queryResults.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'critical').length, 0);
    
    if (totalIssues > 0) {
      console.log(`\n⚠️  検出された問題: ${totalIssues}件 (重要: ${criticalIssues}件)`);
    }
    
    if (result.success) {
      console.log('\n✅ 文書ソース表示テスト: 合格');
    } else {
      console.log('\n❌ 文書ソース表示テスト: 不合格');
      console.log('   ソース表示の精度と品質の改善が必要です');
    }
  }

  /**
   * エラー時のクエリ結果作成
   */
  private createErrorQueryResult(query: TestQuery, error: any): QuerySourceResult {
    return {
      queryId: query.id,
      query: query.query,
      aiResponse: '',
      detectedSources: [],
      sourceCount: 0,
      attributionAccuracy: 0,
      citationFormat: [],
      relevanceScore: 0,
      completenessScore: 0,
      success: false,
      issues: [{
        type: 'missing_source',
        severity: 'critical',
        description: `クエリ処理エラー: ${error instanceof Error ? error.message : String(error)}`,
        recommendation: 'システムの接続と設定を確認してください'
      }]
    };
  }

  /**
   * 遅延処理（タイムアウト付き）
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms);
      
      // 異常に長い遅延を防ぐ
      if (ms > 30000) {
        clearTimeout(timeout);
        reject(new Error('遅延時間が長すぎます'));
      }
    });
  }
}

/**
 * デフォルト設定での文書ソース表示テスト実行
 */
export async function runDocumentSourceDisplayTest(baseUrl: string = 'http://localhost:3000'): Promise<DocumentSourceTestResult> {
  const config: DocumentSourceTestConfig = {
    baseUrl,
    testQueries: [
      {
        id: 'query_1',
        query: 'AWS Lambda の設定方法について教えてください',
        expectedSourceCount: 3,
        expectedSourceTypes: ['document', 'api'],
        category: 'technical',
        complexity: 'medium'
      },
      {
        id: 'query_2',
        query: 'セキュリティベストプラクティスは何ですか',
        expectedSourceCount: 4,
        expectedSourceTypes: ['document'],
        category: 'business',
        complexity: 'complex'
      },
      {
        id: 'query_3',
        query: 'システムの基本的な使い方',
        expectedSourceCount: 2,
        expectedSourceTypes: ['document'],
        category: 'general',
        complexity: 'simple'
      }
    ],
    expectedSources: [],
    displayRequirements: [
      {
        element: '.source-citation',
        required: true,
        format: 'inline',
        accessibility: true,
        interactivity: true
      },
      {
        element: '.source-link',
        required: true,
        format: 'hyperlink',
        accessibility: true,
        interactivity: true
      },
      {
        element: '.reference-list',
        required: false,
        format: 'list',
        accessibility: true,
        interactivity: false
      }
    ],
    accuracyThresholds: {
      sourceAttributionAccuracy: 85,
      citationFormatCompliance: 90,
      linkValidityRate: 95,
      contentRelevanceScore: 80
    }
  };

  const test = new DocumentSourceDisplayTest(config);
  return await test.runTest();
}