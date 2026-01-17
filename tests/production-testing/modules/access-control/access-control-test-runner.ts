/**
 * アクセス権限テスト実行ランナー
 * 
 * 実本番IAM/OpenSearchでのアクセス権限テストを安全に実行
 * テスト結果の収集と報告を行う
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import AccessControlTestModule, { AccessControlTestResult } from './access-control-test-module';
import ProductionTestEngine, { TestDefinition, TestSuite } from '../../core/production-test-engine';
import { ProductionConfig } from '../../config/production-config';

/**
 * アクセス権限テスト実行ランナークラス
 */
export class AccessControlTestRunner {
  private config: ProductionConfig;
  private testModule: AccessControlTestModule;
  private testEngine: ProductionTestEngine;

  constructor(config: ProductionConfig, testEngine: ProductionTestEngine) {
    this.config = config;
    this.testEngine = testEngine;
    this.testModule = new AccessControlTestModule(config);
  }

  /**
   * アクセス権限テストスイートの作成
   */
  createAccessControlTestSuite(): TestSuite {
    const testDefinitions: TestDefinition[] = [
      {
        testId: 'access-authorized-001',
        testName: '権限を持つユーザーの文書検索テスト',
        category: 'access-control',
        description: '実本番OpenSearchで権限を持つユーザーの文書アクセステスト',
        timeout: 45000, // 45秒
        retryCount: 2,
        dependencies: [],
        execute: async (engine) => {
          return await this.testModule.testAuthorizedDocumentAccess();
        }
      },
      {
        testId: 'access-unauthorized-001',
        testName: '権限を持たないユーザーのアクセス拒否テスト',
        category: 'access-control',
        description: '実本番OpenSearchで権限を持たないユーザーのアクセス拒否テスト',
        timeout: 45000,
        retryCount: 2,
        dependencies: [],
        execute: async (engine) => {
          return await this.testModule.testUnauthorizedDocumentAccess();
        }
      },
      {
        testId: 'access-admin-001',
        testName: '管理者権限テスト',
        category: 'access-control',
        description: '管理者ユーザーの全文書アクセス権限テスト',
        timeout: 60000, // 60秒
        retryCount: 1,
        dependencies: ['access-authorized-001'],
        execute: async (engine) => {
          return await this.testModule.testAdminPermissions();
        }
      },
      {
        testId: 'access-multigroup-001',
        testName: '複数グループ所属ユーザーの権限統合テスト',
        category: 'access-control',
        description: '複数グループに所属するユーザーの権限統合機能テスト',
        timeout: 60000,
        retryCount: 1,
        dependencies: ['access-authorized-001'],
        execute: async (engine) => {
          return await this.testModule.testMultiGroupPermissions();
        }
      },
      {
        testId: 'access-iam-role-001',
        testName: 'IAMロールベースアクセス制御テスト',
        category: 'access-control',
        description: '実本番IAMロールでのアクセス制御機能テスト',
        timeout: 45000,
        retryCount: 2,
        dependencies: [],
        execute: async (engine) => {
          return await this.testModule.testIAMRoleBasedAccess();
        }
      }
    ];

    return {
      suiteId: 'access-control-test-suite',
      suiteName: 'アクセス権限テストスイート',
      description: '実本番IAMロールとOpenSearch Serverlessでの権限ベースアクセス制御包括テスト',
      tests: testDefinitions,
      configuration: {
        parallel: false, // アクセス権限テストは順次実行
        maxConcurrency: 1,
        failFast: false, // 一つのテストが失敗しても他のテストを継続
        continueOnError: true
      }
    };
  }

  /**
   * アクセス権限テストの実行
   */
  async runAccessControlTests(): Promise<{
    success: boolean;
    results: Map<string, AccessControlTestResult>;
    summary: {
      totalTests: number;
      passedTests: number;
      failedTests: number;
      skippedTests: number;
      successRate: number;
      totalDuration: number;
      securityScore: number;
    };
  }> {
    console.log('🚀 アクセス権限テストスイートを実行開始...');

    try {
      // テストスイートの作成
      const testSuite = this.createAccessControlTestSuite();

      // テストエンジンでの実行
      const results = await this.testEngine.executeTestSuite(testSuite);

      // 結果の集計
      const summary = this.generateTestSummary(results);

      console.log('📊 アクセス権限テスト実行結果:');
      console.log(`   総テスト数: ${summary.totalTests}`);
      console.log(`   成功: ${summary.passedTests}`);
      console.log(`   失敗: ${summary.failedTests}`);
      console.log(`   スキップ: ${summary.skippedTests}`);
      console.log(`   成功率: ${(summary.successRate * 100).toFixed(1)}%`);
      console.log(`   セキュリティスコア: ${(summary.securityScore * 100).toFixed(1)}%`);
      console.log(`   総実行時間: ${summary.totalDuration}ms`);

      const success = summary.failedTests === 0;

      if (success) {
        console.log('✅ アクセス権限テストスイート実行完了 - 全テスト成功');
      } else {
        console.log('⚠️ アクセス権限テストスイート実行完了 - 一部テスト失敗');
      }

      return {
        success,
        results: results as Map<string, AccessControlTestResult>,
        summary
      };

    } catch (error) {
      console.error('❌ アクセス権限テスト実行エラー:', error);
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
    securityScore: number;
  } {
    const resultsArray = Array.from(results.values());
    
    const totalTests = resultsArray.length;
    const passedTests = resultsArray.filter(r => r.success).length;
    const failedTests = resultsArray.filter(r => !r.success && r.status !== 'SKIPPED').length;
    const skippedTests = resultsArray.filter(r => r.status === 'SKIPPED').length;
    const successRate = totalTests > 0 ? passedTests / totalTests : 0;
    const totalDuration = resultsArray.reduce((sum, r) => sum + (r.duration || 0), 0);
    
    // セキュリティスコアの計算（権限テストの重要度を考慮）
    const securityScore = this.calculateSecurityScore(resultsArray);

    return {
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      successRate,
      totalDuration,
      securityScore
    };
  }

  /**
   * セキュリティスコアの計算
   */
  private calculateSecurityScore(results: any[]): number {
    const weights = {
      'access-authorized-001': 0.2,    // 正当なアクセス
      'access-unauthorized-001': 0.3,  // 不正アクセス防止（重要）
      'access-admin-001': 0.2,         // 管理者権限
      'access-multigroup-001': 0.15,   // 複数グループ権限
      'access-iam-role-001': 0.15      // IAMロール
    };

    let totalScore = 0;
    let totalWeight = 0;

    results.forEach(result => {
      const weight = weights[result.testId as keyof typeof weights] || 0.1;
      totalWeight += weight;
      
      if (result.success) {
        totalScore += weight;
      }
    });

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * 詳細レポートの生成
   */
  async generateDetailedReport(results: Map<string, AccessControlTestResult>): Promise<string> {
    const timestamp = new Date().toISOString();
    const summary = this.generateTestSummary(results);

    let report = `# アクセス権限テスト詳細レポート\n\n`;
    report += `**実行日時**: ${timestamp}\n`;
    report += `**テスト環境**: AWS東京リージョン本番環境 (${this.config.region})\n`;
    report += `**OpenSearchドメイン**: ${this.config.resources.openSearchDomain}\n`;
    report += `**DynamoDBテーブル**: ${this.config.resources.dynamoDBTables.sessions}\n\n`;

    report += `## 実行サマリー\n\n`;
    report += `- **総テスト数**: ${summary.totalTests}\n`;
    report += `- **成功**: ${summary.passedTests}\n`;
    report += `- **失敗**: ${summary.failedTests}\n`;
    report += `- **スキップ**: ${summary.skippedTests}\n`;
    report += `- **成功率**: ${(summary.successRate * 100).toFixed(1)}%\n`;
    report += `- **セキュリティスコア**: ${(summary.securityScore * 100).toFixed(1)}%\n`;
    report += `- **総実行時間**: ${summary.totalDuration}ms\n\n`;

    // セキュリティ評価
    report += `## セキュリティ評価\n\n`;
    if (summary.securityScore >= 0.9) {
      report += `🟢 **優秀**: アクセス制御が適切に機能しています\n`;
    } else if (summary.securityScore >= 0.7) {
      report += `🟡 **良好**: 軽微な改善点があります\n`;
    } else {
      report += `🔴 **要改善**: セキュリティ上の問題が検出されました\n`;
    }
    report += `\n`;

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

      if (result.accessDetails) {
        report += `- **アクセス詳細**:\n`;
        report += `  - アクセス権限: ${result.accessDetails.hasAccess ? 'あり' : 'なし'}\n`;
        report += `  - 権限レベル: ${result.accessDetails.permissionLevel}\n`;
        report += `  - アクセス可能文書: ${result.accessDetails.allowedDocuments}件\n`;
        report += `  - アクセス拒否文書: ${result.accessDetails.deniedDocuments}件\n`;
        report += `  - ユーザーグループ: ${result.accessDetails.userGroups.join(', ')}\n`;
      }

      if (result.searchResults) {
        report += `- **検索結果詳細**:\n`;
        report += `  - 総文書数: ${result.searchResults.totalDocuments}件\n`;
        report += `  - アクセス可能: ${result.searchResults.accessibleDocuments}件\n`;
        report += `  - 制限文書: ${result.searchResults.restrictedDocuments}件\n`;
        report += `  - 検索クエリ: "${result.searchResults.searchQuery}"\n`;
      }

      if (result.roleDetails) {
        report += `- **IAMロール詳細**:\n`;
        report += `  - ロール名: ${result.roleDetails.roleName}\n`;
        report += `  - ポリシー数: ${result.roleDetails.policies.length}\n`;
        report += `  - 権限数: ${result.roleDetails.permissions.length}\n`;
      }

      report += `\n`;
    }

    // 推奨事項
    report += `## 推奨事項\n\n`;
    report += this.generateRecommendations(results);

    return report;
  }

  /**
   * 推奨事項の生成
   */
  private generateRecommendations(results: Map<string, AccessControlTestResult>): string {
    let recommendations = '';
    const failedTests = Array.from(results.values()).filter(r => !r.success);

    if (failedTests.length === 0) {
      recommendations += `✅ 全てのアクセス制御テストが成功しました。現在の設定を維持してください。\n\n`;
    } else {
      recommendations += `以下の改善を推奨します:\n\n`;
      
      failedTests.forEach(test => {
        switch (test.testId) {
          case 'access-authorized-001':
            recommendations += `- **正当なアクセス**: OpenSearchの権限設定を確認し、適切なユーザーがアクセスできるよう調整してください\n`;
            break;
          case 'access-unauthorized-001':
            recommendations += `- **不正アクセス防止**: セキュリティ設定を強化し、権限のないユーザーのアクセスを確実に拒否してください\n`;
            break;
          case 'access-admin-001':
            recommendations += `- **管理者権限**: 管理者ユーザーの権限設定を確認し、必要な文書にアクセスできるよう設定してください\n`;
            break;
          case 'access-multigroup-001':
            recommendations += `- **複数グループ権限**: グループ権限の統合ロジックを確認し、適切に動作するよう修正してください\n`;
            break;
          case 'access-iam-role-001':
            recommendations += `- **IAMロール**: IAMロールとポリシーの設定を確認し、必要な権限が付与されているか確認してください\n`;
            break;
        }
      });
    }

    recommendations += `\n### セキュリティベストプラクティス\n\n`;
    recommendations += `- 定期的な権限監査の実施\n`;
    recommendations += `- 最小権限の原則の適用\n`;
    recommendations += `- アクセスログの継続的な監視\n`;
    recommendations += `- 権限変更時の影響評価\n`;

    return recommendations;
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    console.log('🧹 アクセス権限テストランナーをクリーンアップ中...');
    await this.testModule.cleanup();
    console.log('✅ アクセス権限テストランナーのクリーンアップ完了');
  }
}

export default AccessControlTestRunner;