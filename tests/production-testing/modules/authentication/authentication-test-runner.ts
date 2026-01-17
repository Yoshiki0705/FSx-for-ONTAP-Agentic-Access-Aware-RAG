/**
 * 認証テスト実行ランナー
 * 
 * 実本番Cognitoでの認証テストを安全に実行
 * テスト結果の収集と報告を行う
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import AuthenticationTestModule, { AuthTestResult } from './authentication-test-module';
import ProductionTestEngine, { TestDefinition, TestSuite } from '../../core/production-test-engine';
import { ProductionConfig } from '../../config/production-config';

/**
 * 認証テスト実行ランナークラス
 */
export class AuthenticationTestRunner {
  private config: ProductionConfig;
  private testModule: AuthenticationTestModule;
  private testEngine: ProductionTestEngine;

  constructor(config: ProductionConfig, testEngine: ProductionTestEngine) {
    this.config = config;
    this.testEngine = testEngine;
    this.testModule = new AuthenticationTestModule(config);
  }

  /**
   * 認証テストスイートの作成
   */
  createAuthenticationTestSuite(): TestSuite {
    const testDefinitions: TestDefinition[] = [
      // 基本認証テスト
      {
        testId: 'auth-valid-001',
        testName: '有効な認証情報での認証テスト',
        category: 'authentication',
        description: '実本番Cognitoで有効な認証情報を使用した認証成功テスト',
        timeout: 30000, // 30秒
        retryCount: 2,
        dependencies: [],
        execute: async (engine) => {
          return await this.testModule.testValidAuthentication();
        }
      },
      {
        testId: 'auth-invalid-001',
        testName: '無効な認証情報での認証拒否テスト',
        category: 'authentication',
        description: '実本番Cognitoで無効な認証情報を使用した認証拒否テスト',
        timeout: 30000,
        retryCount: 2,
        dependencies: [],
        execute: async (engine) => {
          return await this.testModule.testInvalidAuthentication();
        }
      },
      {
        testId: 'auth-session-001',
        testName: 'セッション管理テスト',
        category: 'authentication',
        description: '実本番DynamoDBでのセッション作成・検証・終了テスト',
        timeout: 60000, // 60秒
        retryCount: 1,
        dependencies: ['auth-valid-001'],
        execute: async (engine) => {
          return await this.testModule.testSessionManagement();
        }
      },
      {
        testId: 'auth-mfa-001',
        testName: 'MFA機能テスト',
        category: 'authentication',
        description: '実本番CognitoでのMFA（多要素認証）機能テスト',
        timeout: 45000, // 45秒
        retryCount: 1,
        dependencies: [],
        execute: async (engine) => {
          return await this.testModule.testMFAAuthentication();
        }
      },
      {
        testId: 'auth-flow-001',
        testName: '認証フロー完全性テスト',
        category: 'authentication',
        description: '認証から認証情報取得、セッション終了までの完全なフローテスト',
        timeout: 90000, // 90秒
        retryCount: 1,
        dependencies: ['auth-valid-001', 'auth-session-001'],
        execute: async (engine) => {
          return await this.testModule.testAuthenticationFlow();
        }
      },
      
      // SIDベース認証テスト
      {
        testId: 'auth-sid-comprehensive-001',
        testName: 'SIDベース認証包括テスト',
        category: 'authentication',
        description: 'testuser, admin, testuser0-49のSIDベース認証包括テスト',
        timeout: 300000, // 5分
        retryCount: 1,
        dependencies: ['auth-valid-001'],
        execute: async (engine) => {
          return await this.executeSIDAuthenticationTests(engine);
        }
      },
      
      // マルチリージョン認証テスト
      {
        testId: 'auth-multi-region-001',
        testName: 'マルチリージョン認証テスト',
        category: 'authentication',
        description: '東京-大阪リージョン間認証一貫性とフェイルオーバーテスト',
        timeout: 180000, // 3分
        retryCount: 1,
        dependencies: ['auth-valid-001'],
        execute: async (engine) => {
          return await this.executeMultiRegionAuthTests(engine);
        }
      }
    ];

    return {
      suiteId: 'authentication-test-suite',
      suiteName: '認証システムテストスイート',
      description: '実本番Amazon Cognitoユーザープールでの認証機能包括テスト',
      tests: testDefinitions,
      configuration: {
        parallel: false, // 認証テストは順次実行
        maxConcurrency: 1,
        failFast: false, // 一つのテストが失敗しても他のテストを継続
        continueOnError: true
      }
    };
  }

  /**
   * 認証テストの実行
   */
  async runAuthenticationTests(): Promise<{
    success: boolean;
    results: Map<string, AuthTestResult>;
    summary: {
      totalTests: number;
      passedTests: number;
      failedTests: number;
      skippedTests: number;
      successRate: number;
      totalDuration: number;
    };
  }> {
    console.log('🚀 認証システムテストスイートを実行開始...');

    try {
      // テストスイートの作成
      const testSuite = this.createAuthenticationTestSuite();

      // テストエンジンでの実行
      const results = await this.testEngine.executeTestSuite(testSuite);

      // 結果の集計
      const summary = this.generateTestSummary(results);

      console.log('📊 認証テスト実行結果:');
      console.log(`   総テスト数: ${summary.totalTests}`);
      console.log(`   成功: ${summary.passedTests}`);
      console.log(`   失敗: ${summary.failedTests}`);
      console.log(`   スキップ: ${summary.skippedTests}`);
      console.log(`   成功率: ${(summary.successRate * 100).toFixed(1)}%`);
      console.log(`   総実行時間: ${summary.totalDuration}ms`);

      const success = summary.failedTests === 0;

      if (success) {
        console.log('✅ 認証システムテストスイート実行完了 - 全テスト成功');
      } else {
        console.log('⚠️ 認証システムテストスイート実行完了 - 一部テスト失敗');
      }

      return {
        success,
        results: results as Map<string, AuthTestResult>,
        summary
      };

    } catch (error) {
      console.error('❌ 認証テスト実行エラー:', error);
      throw error;
    }
  }

  /**
   * テスト結果サマリーの生成
   */
  private generateTestSummary(results: Map<string, any>): {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    successRate: number;
    totalDuration: number;
  } {
    const resultsArray = Array.from(results.values());
    
    const totalTests = resultsArray.length;
    const passedTests = resultsArray.filter(r => r.success).length;
    const failedTests = resultsArray.filter(r => !r.success && r.status !== 'SKIPPED').length;
    const skippedTests = resultsArray.filter(r => r.status === 'SKIPPED').length;
    const successRate = totalTests > 0 ? passedTests / totalTests : 0;
    const totalDuration = resultsArray.reduce((sum, r) => sum + (r.duration || 0), 0);

    return {
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      successRate,
      totalDuration
    };
  }

  /**
   * 詳細レポートの生成
   */
  async generateDetailedReport(results: Map<string, AuthTestResult>): Promise<string> {
    const timestamp = new Date().toISOString();
    const summary = this.generateTestSummary(results);

    let report = `# 認証システムテスト詳細レポート\n\n`;
    report += `**実行日時**: ${timestamp}\n`;
    report += `**テスト環境**: AWS東京リージョン本番環境 (${this.config.region})\n`;
    report += `**Cognitoユーザープール**: ${this.config.resources.cognitoUserPool}\n\n`;

    report += `## 実行サマリー\n\n`;
    report += `- **総テスト数**: ${summary.totalTests}\n`;
    report += `- **成功**: ${summary.passedTests}\n`;
    report += `- **失敗**: ${summary.failedTests}\n`;
    report += `- **スキップ**: ${summary.skippedTests}\n`;
    report += `- **成功率**: ${(summary.successRate * 100).toFixed(1)}%\n`;
    report += `- **総実行時間**: ${summary.totalDuration}ms\n\n`;

    report += `## テスト結果詳細\n\n`;

    for (const [testId, result] of results) {
      const status = result.success ? '✅ 成功' : '❌ 失敗';
      const duration = result.duration || 0;

      report += `### ${result.testName} (${testId})\n\n`;
      report += `- **ステータス**: ${status}\n`;
      report += `- **実行時間**: ${duration}ms\n`;
      report += `- **開始時刻**: ${result.startTime?.toISOString()}\n`;
      report += `- **終了時刻**: ${result.endTime?.toISOString()}\n`;

      if (result.error) {
        report += `- **エラー**: ${result.error}\n`;
      }

      if (result.authDetails) {
        report += `- **認証詳細**:\n`;
        report += `  - トークンタイプ: ${result.authDetails.tokenType || 'N/A'}\n`;
        report += `  - 有効期限: ${result.authDetails.expiresIn || 'N/A'}秒\n`;
      }

      if (result.sessionDetails) {
        report += `- **セッション詳細**:\n`;
        report += `  - セッション作成: ${result.sessionDetails.sessionCreated ? '成功' : '失敗'}\n`;
        report += `  - セッション検証: ${result.sessionDetails.sessionValid ? '成功' : '失敗'}\n`;
      }

      if (result.mfaDetails) {
        report += `- **MFA詳細**:\n`;
        report += `  - MFA要求: ${result.mfaDetails.mfaRequired ? 'あり' : 'なし'}\n`;
        report += `  - チャレンジタイプ: ${result.mfaDetails.challengeType || 'N/A'}\n`;
      }

      report += `\n`;
    }

    return report;
  }

  /**
   * SIDベース認証テストの実行
   */
  private async executeSIDAuthenticationTests(engine: ProductionTestEngine): Promise<AuthTestResult> {
    try {
      console.log('🔐 SIDベース認証テスト実行中...');
      
      // SIDベース認証テストモジュールを動的インポート
      const { SIDBasedAuthTestModule } = await import('./sid-based-auth-test');
      const sidModule = new SIDBasedAuthTestModule(this.config);
      
      const results = await sidModule.runAllSIDAuthenticationTests();
      
      // 結果の集約
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;
      
      return {
        testId: 'auth-sid-comprehensive-001',
        testName: 'SIDベース認証包括テスト',
        category: 'authentication',
        status: successCount === totalCount ? 'COMPLETED' : 'FAILED',
        startTime: new Date(),
        endTime: new Date(),
        duration: results.reduce((sum, r) => sum + (r.duration || 0), 0),
        success: successCount === totalCount,
        metadata: { 
          sidTestCount: totalCount,
          successCount,
          failedCount: totalCount - successCount,
          detailedResults: results
        }
      };
      
    } catch (error) {
      console.error('❌ SIDベース認証テスト実行エラー:', error);
      return this.createFailureResult('auth-sid-comprehensive-001', 'SIDベース認証包括テスト', error);
    }
  }

  /**
   * マルチリージョン認証テストの実行
   */
  private async executeMultiRegionAuthTests(engine: ProductionTestEngine): Promise<AuthTestResult> {
    try {
      console.log('🌏 マルチリージョン認証テスト実行中...');
      
      // マルチリージョン認証テストモジュールを動的インポート
      const { MultiRegionAuthTestModule } = await import('./multi-region-auth-test');
      const multiRegionModule = new MultiRegionAuthTestModule(this.config);
      
      const results = await multiRegionModule.runAllMultiRegionAuthTests();
      
      // 結果の集約
      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;
      
      return {
        testId: 'auth-multi-region-001',
        testName: 'マルチリージョン認証テスト',
        category: 'authentication',
        status: successCount === totalCount ? 'COMPLETED' : 'FAILED',
        startTime: new Date(),
        endTime: new Date(),
        duration: results.reduce((sum, r) => sum + (r.duration || 0), 0),
        success: successCount === totalCount,
        metadata: { 
          multiRegionTestCount: totalCount,
          successCount,
          failedCount: totalCount - successCount,
          detailedResults: results
        }
      };
      
    } catch (error) {
      console.error('❌ マルチリージョン認証テスト実行エラー:', error);
      return this.createFailureResult('auth-multi-region-001', 'マルチリージョン認証テスト', error);
    }
  }

  /**
   * 失敗結果の作成ヘルパー
   */
  private createFailureResult(testId: string, testName: string, error: any): AuthTestResult {
    return {
      testId,
      testName,
      category: 'authentication',
      status: 'FAILED',
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    console.log('🧹 認証テストランナーをクリーンアップ中...');
    await this.testModule.cleanup();
    console.log('✅ 認証テストランナーのクリーンアップ完了');
  }
}

export default AuthenticationTestRunner;