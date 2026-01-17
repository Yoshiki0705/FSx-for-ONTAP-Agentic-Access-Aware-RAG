/**
 * セキュリティテストモジュール
 * 
 * 実本番環境でのセキュリティテスト機能を提供
 * HTTPS暗号化、攻撃耐性、セキュリティ監視のテストを実行
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

import { ProductionConfig } from '../../config/production-config';
import ProductionTestEngine, { TestResult, TestExecutionStatus } from '../../core/production-test-engine';
import { 
  productionSecurityConfig, 
  HttpsEncryptionTestConfig, 
  AttackResistanceTestConfig, 
  SecurityMonitoringTestConfig 
} from './security-config';
import * as https from 'https';
import * as tls from 'tls';
import axios from 'axios';

/**
 * セキュリティテスト結果インターフェース
 */
export interface SecurityTestResult extends TestResult {
  securityMetrics: {
    httpsCompliance: boolean;
    certificateValid: boolean;
    securityHeadersPresent: boolean;
    wafProtectionActive: boolean;
    attacksBlocked: number;
    vulnerabilitiesFound: number;
    securityScore: number;
  };
  
  detailedResults: {
    httpsEncryption?: Map<string, any>;
    attackResistance?: Map<string, any>;
    securityMonitoring?: Map<string, any>;
  };
}

/**
 * セキュリティテストモジュールクラス
 */
export class SecurityTestModule {
  private config: ProductionConfig;
  private testEngine: ProductionTestEngine;
  private securityConfig: any;

  constructor(config: ProductionConfig, testEngine: ProductionTestEngine) {
    this.config = config;
    this.testEngine = testEngine;
    this.securityConfig = productionSecurityConfig;
  }

  /**
   * セキュリティテストの初期化
   */
  async initialize(): Promise<void> {
    console.log('🔒 セキュリティテストモジュールを初期化中...');
    
    try {
      // テストエンジンの初期化確認
      if (!this.testEngine.isInitialized()) {
        throw new Error('テストエンジンが初期化されていません');
      }
      
      // セキュリティ設定の検証
      await this.validateSecurityConfiguration();
      
      // 本番環境接続の確認
      await this.verifyProductionConnectivity();
      
      console.log('✅ セキュリティテストモジュール初期化完了');
      
    } catch (error) {
      console.error('❌ セキュリティテストモジュール初期化エラー:', error);
      throw error;
    }
  }

  /**
   * セキュリティテストの実行
   */
  async runSecurityTests(): Promise<SecurityTestResult> {
    console.log('🚀 セキュリティテスト実行開始...');
    
    const startTime = Date.now();
    const testResults = new Map<string, any>();
    let overallSuccess = true;
    const errors: string[] = [];

    try {
      // 1. HTTPS暗号化テスト
      console.log('🔐 HTTPS暗号化テスト実行中...');
      const httpsResults = await this.runHttpsEncryptionTests();
      testResults.set('https_encryption', httpsResults);
      
      if (!httpsResults.success) {
        overallSuccess = false;
        errors.push('HTTPS暗号化テストに失敗しました');
      }

      // 2. 攻撃耐性テスト
      console.log('🛡️ 攻撃耐性テスト実行中...');
      const attackResults = await this.runAttackResistanceTests();
      testResults.set('attack_resistance', attackResults);
      
      if (!attackResults.success) {
        overallSuccess = false;
        errors.push('攻撃耐性テストに失敗しました');
      }

      // 3. セキュリティ監視テスト
      console.log('👁️ セキュリティ監視テスト実行中...');
      const monitoringResults = await this.runSecurityMonitoringTests();
      testResults.set('security_monitoring', monitoringResults);
      
      if (!monitoringResults.success) {
        overallSuccess = false;
        errors.push('セキュリティ監視テストに失敗しました');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // セキュリティメトリクスの計算
      const securityMetrics = this.calculateSecurityMetrics(testResults);

      const result: SecurityTestResult = {
        testId: `security-test-${Date.now()}`,
        testName: 'セキュリティテスト',
        status: overallSuccess ? TestExecutionStatus.COMPLETED : TestExecutionStatus.FAILED,
        success: overallSuccess,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        duration,
        results: testResults,
        securityMetrics,
        detailedResults: {
          httpsEncryption: testResults.get('https_encryption')?.details,
          attackResistance: testResults.get('attack_resistance')?.details,
          securityMonitoring: testResults.get('security_monitoring')?.details
        },
        errors: errors.length > 0 ? errors : undefined
      };

      console.log('📊 セキュリティテスト完了:');
      console.log(`   セキュリティスコア: ${(securityMetrics.securityScore * 100).toFixed(1)}%`);
      console.log(`   HTTPS準拠: ${securityMetrics.httpsCompliance ? '✓' : '✗'}`);
      console.log(`   証明書有効: ${securityMetrics.certificateValid ? '✓' : '✗'}`);
      console.log(`   WAF保護: ${securityMetrics.wafProtectionActive ? '✓' : '✗'}`);
      console.log(`   ブロック攻撃数: ${securityMetrics.attacksBlocked}`);
      console.log(`   脆弱性発見数: ${securityMetrics.vulnerabilitiesFound}`);

      return result;

    } catch (error) {
      console.error('❌ セキュリティテスト実行エラー:', error);
      
      const endTime = Date.now();
      return {
        testId: `security-test-${Date.now()}`,
        testName: 'セキュリティテスト',
        status: TestExecutionStatus.FAILED,
        success: false,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        duration: endTime - startTime,
        results: testResults,
        securityMetrics: {
          httpsCompliance: false,
          certificateValid: false,
          securityHeadersPresent: false,
          wafProtectionActive: false,
          attacksBlocked: 0,
          vulnerabilitiesFound: 0,
          securityScore: 0
        },
        detailedResults: {},
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }  
/**
   * HTTPS暗号化テストの実行
   */
  private async runHttpsEncryptionTests(): Promise<any> {
    const httpsConfig = this.securityConfig.httpsEncryption as HttpsEncryptionTestConfig;
    const results = new Map<string, any>();
    let overallSuccess = true;

    try {
      // 1. HTTPS リダイレクトテスト
      const redirectResult = await this.testHttpsRedirect(httpsConfig);
      results.set('https_redirect', redirectResult);
      if (!redirectResult.success) overallSuccess = false;

      // 2. TLS証明書検証テスト
      const certificateResult = await this.testTlsCertificate(httpsConfig);
      results.set('tls_certificate', certificateResult);
      if (!certificateResult.success) overallSuccess = false;

      // 3. セキュリティヘッダーテスト
      const headersResult = await this.testSecurityHeaders(httpsConfig);
      results.set('security_headers', headersResult);
      if (!headersResult.success) overallSuccess = false;

      // 4. 暗号化プロトコルテスト
      const protocolResult = await this.testEncryptionProtocols(httpsConfig);
      results.set('encryption_protocols', protocolResult);
      if (!protocolResult.success) overallSuccess = false;

      return {
        success: overallSuccess,
        details: results,
        summary: {
          totalTests: results.size,
          passedTests: Array.from(results.values()).filter(r => r.success).length,
          failedTests: Array.from(results.values()).filter(r => !r.success).length
        }
      };

    } catch (error) {
      console.error('HTTPS暗号化テストエラー:', error);
      return {
        success: false,
        details: results,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 攻撃耐性テストの実行
   */
  private async runAttackResistanceTests(): Promise<any> {
    const attackConfig = this.securityConfig.attackResistance as AttackResistanceTestConfig;
    const results = new Map<string, any>();
    let overallSuccess = true;
    let attacksBlocked = 0;

    try {
      // 1. SQLインジェクション攻撃テスト
      if (attackConfig.sqlInjectionTests.enabled) {
        const sqlResult = await this.testSqlInjectionProtection(attackConfig);
        results.set('sql_injection_protection', sqlResult);
        if (!sqlResult.success) overallSuccess = false;
        attacksBlocked += sqlResult.blockedAttacks || 0;
      }

      // 2. XSS攻撃テスト
      if (attackConfig.xssTests.enabled) {
        const xssResult = await this.testXssProtection(attackConfig);
        results.set('xss_protection', xssResult);
        if (!xssResult.success) overallSuccess = false;
        attacksBlocked += xssResult.blockedAttacks || 0;
      }

      // 3. 不正APIアクセステスト
      if (attackConfig.unauthorizedApiTests.enabled) {
        const apiResult = await this.testUnauthorizedApiAccess(attackConfig);
        results.set('unauthorized_api_access', apiResult);
        if (!apiResult.success) overallSuccess = false;
      }

      // 4. セッションハイジャック攻撃テスト
      if (attackConfig.sessionHijackingTests.enabled) {
        const sessionResult = await this.testSessionHijackingProtection(attackConfig);
        results.set('session_hijacking_protection', sessionResult);
        if (!sessionResult.success) overallSuccess = false;
      }

      // 5. レート制限テスト
      if (attackConfig.rateLimitTests.enabled) {
        const rateLimitResult = await this.testRateLimit(attackConfig);
        results.set('rate_limit', rateLimitResult);
        if (!rateLimitResult.success) overallSuccess = false;
      }

      return {
        success: overallSuccess,
        details: results,
        attacksBlocked,
        summary: {
          totalTests: results.size,
          passedTests: Array.from(results.values()).filter(r => r.success).length,
          failedTests: Array.from(results.values()).filter(r => !r.success).length,
          totalAttacksBlocked: attacksBlocked
        }
      };

    } catch (error) {
      console.error('攻撃耐性テストエラー:', error);
      return {
        success: false,
        details: results,
        attacksBlocked,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * セキュリティ監視テストの実行
   */
  private async runSecurityMonitoringTests(): Promise<any> {
    const monitoringConfig = this.securityConfig.securityMonitoring as SecurityMonitoringTestConfig;
    const results = new Map<string, any>();
    let overallSuccess = true;

    try {
      // 1. CloudTrailログ記録テスト
      const cloudTrailResult = await this.testCloudTrailLogging(monitoringConfig);
      results.set('cloudtrail_logging', cloudTrailResult);
      if (!cloudTrailResult.success) overallSuccess = false;

      // 2. 異常アクセスパターン検出テスト
      if (monitoringConfig.anomalyDetection.enabled) {
        const anomalyResult = await this.testAnomalyDetection(monitoringConfig);
        results.set('anomaly_detection', anomalyResult);
        if (!anomalyResult.success) overallSuccess = false;
      }

      // 3. セキュリティアラートテスト
      if (monitoringConfig.securityAlerts.enabled) {
        const alertResult = await this.testSecurityAlerts(monitoringConfig);
        results.set('security_alerts', alertResult);
        if (!alertResult.success) overallSuccess = false;
      }

      // 4. ログ分析テスト
      if (monitoringConfig.logAnalysis.enabled) {
        const logAnalysisResult = await this.testLogAnalysis(monitoringConfig);
        results.set('log_analysis', logAnalysisResult);
        if (!logAnalysisResult.success) overallSuccess = false;
      }

      return {
        success: overallSuccess,
        details: results,
        summary: {
          totalTests: results.size,
          passedTests: Array.from(results.values()).filter(r => r.success).length,
          failedTests: Array.from(results.values()).filter(r => !r.success).length
        }
      };

    } catch (error) {
      console.error('セキュリティ監視テストエラー:', error);
      return {
        success: false,
        details: results,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * HTTPSリダイレクトテスト
   */
  private async testHttpsRedirect(config: HttpsEncryptionTestConfig): Promise<any> {
    const results = [];
    
    for (const endpoint of config.testEndpoints) {
      try {
        const httpUrl = `http://${config.cloudFrontDistribution.domainName}${endpoint}`;
        
        const response = await axios.get(httpUrl, {
          maxRedirects: 0,
          validateStatus: (status) => status >= 200 && status < 400
        });
        
        const isRedirect = response.status >= 300 && response.status < 400;
        const locationHeader = response.headers.location;
        const isHttpsRedirect = locationHeader && locationHeader.startsWith('https://');
        
        results.push({
          endpoint,
          httpUrl,
          status: response.status,
          isRedirect,
          isHttpsRedirect,
          locationHeader,
          success: isRedirect && isHttpsRedirect
        });
        
      } catch (error) {
        results.push({
          endpoint,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    return {
      success: successCount === results.length,
      results,
      summary: {
        totalEndpoints: results.length,
        successfulRedirects: successCount,
        failedRedirects: results.length - successCount
      }
    };
  }

  /**
   * TLS証明書検証テスト
   */
  private async testTlsCertificate(config: HttpsEncryptionTestConfig): Promise<any> {
    return new Promise((resolve) => {
      const options = {
        host: config.cloudFrontDistribution.domainName,
        port: 443,
        method: 'GET',
        path: '/',
        rejectUnauthorized: true
      };

      const req = https.request(options, (res) => {
        const cert = res.socket.getPeerCertificate();
        
        const now = new Date();
        const validFrom = new Date(cert.valid_from);
        const validTo = new Date(cert.valid_to);
        
        const isValid = now >= validFrom && now <= validTo;
        const subjectMatches = cert.subject.CN === config.tlsCertificate.expectedSubject ||
                              cert.subjectaltname?.includes(config.cloudFrontDistribution.domainName);
        
        resolve({
          success: isValid && subjectMatches,
          certificate: {
            subject: cert.subject,
            issuer: cert.issuer,
            validFrom: cert.valid_from,
            validTo: cert.valid_to,
            fingerprint: cert.fingerprint,
            serialNumber: cert.serialNumber,
            subjectAltName: cert.subjectaltname
          },
          validation: {
            isValid,
            subjectMatches,
            daysUntilExpiry: Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          error: error.message
        });
      });

      req.end();
    });
  }

  /**
   * セキュリティヘッダーテスト
   */
  private async testSecurityHeaders(config: HttpsEncryptionTestConfig): Promise<any> {
    const results = [];
    
    for (const endpoint of config.testEndpoints) {
      try {
        const url = `https://${config.cloudFrontDistribution.domainName}${endpoint}`;
        const response = await axios.get(url);
        
        const headers = response.headers;
        const headerChecks = {
          strictTransportSecurity: {
            present: !!headers['strict-transport-security'],
            value: headers['strict-transport-security'],
            expected: config.securityHeaders.strictTransportSecurity.enabled
          },
          contentSecurityPolicy: {
            present: !!headers['content-security-policy'],
            value: headers['content-security-policy'],
            expected: config.securityHeaders.contentSecurityPolicy.enabled
          },
          xFrameOptions: {
            present: !!headers['x-frame-options'],
            value: headers['x-frame-options'],
            expected: config.securityHeaders.xFrameOptions.enabled
          },
          xContentTypeOptions: {
            present: !!headers['x-content-type-options'],
            value: headers['x-content-type-options'],
            expected: config.securityHeaders.xContentTypeOptions.enabled
          },
          referrerPolicy: {
            present: !!headers['referrer-policy'],
            value: headers['referrer-policy'],
            expected: config.securityHeaders.referrerPolicy.enabled
          }
        };
        
        const allHeadersPresent = Object.values(headerChecks).every(check => 
          !check.expected || check.present
        );
        
        results.push({
          endpoint,
          url,
          success: allHeadersPresent,
          headers: headerChecks
        });
        
      } catch (error) {
        results.push({
          endpoint,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    return {
      success: successCount === results.length,
      results,
      summary: {
        totalEndpoints: results.length,
        endpointsWithAllHeaders: successCount,
        endpointsMissingHeaders: results.length - successCount
      }
    };
  }

  /**
   * 暗号化プロトコルテスト
   */
  private async testEncryptionProtocols(config: HttpsEncryptionTestConfig): Promise<any> {
    const results = [];
    
    for (const protocol of config.tlsCertificate.supportedProtocols) {
      try {
        const options = {
          host: config.cloudFrontDistribution.domainName,
          port: 443,
          secureProtocol: this.mapTlsVersion(protocol)
        };
        
        const result = await this.testTlsConnection(options);
        results.push({
          protocol,
          supported: result.success,
          details: result
        });
        
      } catch (error) {
        results.push({
          protocol,
          supported: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    const supportedCount = results.filter(r => r.supported).length;
    
    return {
      success: supportedCount > 0,
      results,
      summary: {
        totalProtocols: results.length,
        supportedProtocols: supportedCount,
        unsupportedProtocols: results.length - supportedCount
      }
    };
  }

  /**
   * TLSバージョンのマッピング
   */
  private mapTlsVersion(version: string): string {
    const mapping: Record<string, string> = {
      'TLSv1.2': 'TLSv1_2_method',
      'TLSv1.3': 'TLS_method'
    };
    return mapping[version] || 'TLS_method';
  }

  /**
   * TLS接続テスト
   */
  private async testTlsConnection(options: any): Promise<any> {
    return new Promise((resolve) => {
      const socket = tls.connect(options, () => {
        const protocol = socket.getProtocol();
        const cipher = socket.getCipher();
        
        resolve({
          success: true,
          protocol,
          cipher,
          authorized: socket.authorized
        });
        
        socket.end();
      });
      
      socket.on('error', (error) => {
        resolve({
          success: false,
          error: error.message
        });
      });
      
      socket.setTimeout(10000, () => {
        socket.destroy();
        resolve({
          success: false,
          error: 'Connection timeout'
        });
      });
    });
  }  /**
   
* SQLインジェクション保護テスト
   */
  private async testSqlInjectionProtection(config: AttackResistanceTestConfig): Promise<any> {
    const results = [];
    let blockedAttacks = 0;
    
    for (const endpoint of config.sqlInjectionTests.targetEndpoints) {
      for (const payload of config.sqlInjectionTests.testPayloads) {
        try {
          const url = `https://${this.securityConfig.httpsEncryption.cloudFrontDistribution.domainName}${endpoint}`;
          
          const response = await axios.post(url, {
            query: payload,
            message: payload
          }, {
            timeout: 10000,
            validateStatus: () => true // すべてのステータスコードを受け入れ
          });
          
          const isBlocked = response.status === config.sqlInjectionTests.expectedBlockResponse;
          if (isBlocked) blockedAttacks++;
          
          results.push({
            endpoint,
            payload: payload.substring(0, 50) + '...', // ログ用に短縮
            status: response.status,
            isBlocked,
            success: isBlocked
          });
          
          // 攻撃間隔を空ける
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          results.push({
            endpoint,
            payload: payload.substring(0, 50) + '...',
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    return {
      success: successCount === results.length,
      results,
      blockedAttacks,
      summary: {
        totalAttempts: results.length,
        blockedAttempts: successCount,
        allowedAttempts: results.length - successCount
      }
    };
  }

  /**
   * XSS保護テスト
   */
  private async testXssProtection(config: AttackResistanceTestConfig): Promise<any> {
    const results = [];
    let blockedAttacks = 0;
    
    for (const endpoint of config.xssTests.targetEndpoints) {
      for (const payload of config.xssTests.testPayloads) {
        try {
          const url = `https://${this.securityConfig.httpsEncryption.cloudFrontDistribution.domainName}${endpoint}`;
          
          const response = await axios.post(url, {
            content: payload,
            message: payload
          }, {
            timeout: 10000,
            validateStatus: () => true
          });
          
          const isBlocked = response.status === config.xssTests.expectedBlockResponse;
          if (isBlocked) blockedAttacks++;
          
          results.push({
            endpoint,
            payload: payload.substring(0, 50) + '...',
            status: response.status,
            isBlocked,
            success: isBlocked
          });
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          results.push({
            endpoint,
            payload: payload.substring(0, 50) + '...',
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    return {
      success: successCount === results.length,
      results,
      blockedAttacks,
      summary: {
        totalAttempts: results.length,
        blockedAttempts: successCount,
        allowedAttempts: results.length - successCount
      }
    };
  }

  /**
   * 不正APIアクセステスト
   */
  private async testUnauthorizedApiAccess(config: AttackResistanceTestConfig): Promise<any> {
    const results = [];
    
    for (const endpoint of config.unauthorizedApiTests.testEndpoints) {
      for (const token of config.unauthorizedApiTests.invalidTokens) {
        try {
          const url = `https://${this.securityConfig.httpsEncryption.cloudFrontDistribution.domainName}${endpoint}`;
          
          const headers: any = {};
          if (token) {
            headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
          }
          
          const response = await axios.get(url, {
            headers,
            timeout: 10000,
            validateStatus: () => true
          });
          
          const isRejected = response.status === config.unauthorizedApiTests.expectedResponse;
          
          results.push({
            endpoint,
            token: token ? 'invalid_token_***' : 'no_token',
            status: response.status,
            isRejected,
            success: isRejected
          });
          
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          results.push({
            endpoint,
            token: token ? 'invalid_token_***' : 'no_token',
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    return {
      success: successCount === results.length,
      results,
      summary: {
        totalAttempts: results.length,
        rejectedAttempts: successCount,
        allowedAttempts: results.length - successCount
      }
    };
  }

  /**
   * セッションハイジャック保護テスト
   */
  private async testSessionHijackingProtection(config: AttackResistanceTestConfig): Promise<any> {
    const results = [];
    
    for (const scenario of config.sessionHijackingTests.testScenarios) {
      for (const tokenPattern of config.sessionHijackingTests.sessionTokenPatterns) {
        try {
          const url = `https://${this.securityConfig.httpsEncryption.cloudFrontDistribution.domainName}/api/auth/verify`;
          
          const response = await axios.post(url, {
            sessionToken: tokenPattern,
            scenario: scenario
          }, {
            timeout: 10000,
            validateStatus: () => true
          });
          
          const isRejected = response.status === 401 || response.status === 403;
          
          results.push({
            scenario,
            tokenPattern: 'hijacked_token_***',
            status: response.status,
            isRejected,
            success: isRejected
          });
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          results.push({
            scenario,
            tokenPattern: 'hijacked_token_***',
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    return {
      success: successCount === results.length,
      results,
      summary: {
        totalAttempts: results.length,
        rejectedAttempts: successCount,
        allowedAttempts: results.length - successCount
      }
    };
  }

  /**
   * レート制限テスト
   */
  private async testRateLimit(config: AttackResistanceTestConfig): Promise<any> {
    const url = `https://${this.securityConfig.httpsEncryption.cloudFrontDistribution.domainName}/api/health`;
    const results = [];
    let throttledRequests = 0;
    
    const startTime = Date.now();
    const endTime = startTime + config.rateLimitTests.testDuration;
    
    console.log(`レート制限テスト開始: ${config.rateLimitTests.requestsPerMinute}req/min で ${config.rateLimitTests.testDuration/1000}秒間`);
    
    while (Date.now() < endTime) {
      try {
        const response = await axios.get(url, {
          timeout: 5000,
          validateStatus: () => true
        });
        
        const isThrottled = response.status === 429 || response.status === 503;
        if (isThrottled) throttledRequests++;
        
        results.push({
          timestamp: Date.now(),
          status: response.status,
          isThrottled
        });
        
        // リクエスト間隔の調整（1分間に指定回数のリクエスト）
        const intervalMs = 60000 / config.rateLimitTests.requestsPerMinute;
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        
      } catch (error) {
        results.push({
          timestamp: Date.now(),
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    const totalRequests = results.length;
    const successfulRequests = results.filter(r => !r.isThrottled && !r.error).length;
    
    return {
      success: config.rateLimitTests.expectedThrottling ? throttledRequests > 0 : throttledRequests === 0,
      results: results.slice(-10), // 最後の10件のみ保存
      summary: {
        totalRequests,
        successfulRequests,
        throttledRequests,
        errorRequests: results.filter(r => r.error).length,
        testDuration: config.rateLimitTests.testDuration,
        averageRequestsPerMinute: (totalRequests / (config.rateLimitTests.testDuration / 60000)).toFixed(2)
      }
    };
  }

  /**
   * CloudTrailログ記録テスト
   */
  private async testCloudTrailLogging(config: SecurityMonitoringTestConfig): Promise<any> {
    try {
      // CloudTrailの設定確認（読み取り専用）
      const cloudTrailStatus = await this.testEngine.executeAwsCommand('cloudtrail', 'describe-trails', {
        trailNameList: [config.cloudTrail.trailName]
      });
      
      if (!cloudTrailStatus || cloudTrailStatus.length === 0) {
        return {
          success: false,
          error: 'CloudTrailが見つかりません'
        };
      }
      
      const trail = cloudTrailStatus[0];
      
      // ログ記録状況の確認
      const loggingStatus = await this.testEngine.executeAwsCommand('cloudtrail', 'get-trail-status', {
        Name: config.cloudTrail.trailName
      });
      
      return {
        success: loggingStatus.IsLogging,
        trail: {
          name: trail.Name,
          s3BucketName: trail.S3BucketName,
          includeGlobalServiceEvents: trail.IncludeGlobalServiceEvents,
          isMultiRegionTrail: trail.IsMultiRegionTrail,
          isLogging: loggingStatus.IsLogging,
          latestDeliveryTime: loggingStatus.LatestDeliveryTime
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 異常検出テスト
   */
  private async testAnomalyDetection(config: SecurityMonitoringTestConfig): Promise<any> {
    try {
      // CloudWatchメトリクスの確認
      const metrics = await this.testEngine.executeAwsCommand('cloudwatch', 'get-metric-statistics', {
        Namespace: 'AWS/CloudFront',
        MetricName: 'Requests',
        Dimensions: [
          {
            Name: 'DistributionId',
            Value: this.securityConfig.httpsEncryption.cloudFrontDistribution.distributionId
          }
        ],
        StartTime: new Date(Date.now() - config.anomalyDetection.monitoringPeriod),
        EndTime: new Date(),
        Period: 300,
        Statistics: ['Sum', 'Average']
      });
      
      const totalRequests = metrics.Datapoints?.reduce((sum: number, point: any) => sum + point.Sum, 0) || 0;
      const averageRequests = totalRequests / (metrics.Datapoints?.length || 1);
      
      const isAnomalous = averageRequests > config.anomalyDetection.thresholds.requestsPerMinute;
      
      return {
        success: true,
        anomalyDetected: isAnomalous,
        metrics: {
          totalRequests,
          averageRequests,
          dataPoints: metrics.Datapoints?.length || 0,
          threshold: config.anomalyDetection.thresholds.requestsPerMinute
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * セキュリティアラートテスト
   */
  private async testSecurityAlerts(config: SecurityMonitoringTestConfig): Promise<any> {
    try {
      // SNSトピックの確認
      const topics = await this.testEngine.executeAwsCommand('sns', 'list-topics');
      
      const securityTopic = topics.Topics?.find((topic: any) => 
        config.securityAlerts.notificationTargets.some(target => 
          topic.TopicArn.includes(target)
        )
      );
      
      if (!securityTopic) {
        return {
          success: false,
          error: 'セキュリティアラート用SNSトピックが見つかりません'
        };
      }
      
      // サブスクリプションの確認
      const subscriptions = await this.testEngine.executeAwsCommand('sns', 'list-subscriptions-by-topic', {
        TopicArn: securityTopic.TopicArn
      });
      
      return {
        success: true,
        topic: securityTopic,
        subscriptions: subscriptions.Subscriptions?.length || 0,
        alertTypes: config.securityAlerts.alertTypes
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * ログ分析テスト
   */
  private async testLogAnalysis(config: SecurityMonitoringTestConfig): Promise<any> {
    try {
      // CloudWatch Logsの確認
      const logGroups = await this.testEngine.executeAwsCommand('logs', 'describe-log-groups', {
        logGroupNamePrefix: config.cloudTrail.logGroupName
      });
      
      if (!logGroups.logGroups || logGroups.logGroups.length === 0) {
        return {
          success: false,
          error: 'セキュリティログ用CloudWatch Logsグループが見つかりません'
        };
      }
      
      const logGroup = logGroups.logGroups[0];
      
      // 最近のログストリームの確認
      const logStreams = await this.testEngine.executeAwsCommand('logs', 'describe-log-streams', {
        logGroupName: logGroup.logGroupName,
        orderBy: 'LastEventTime',
        descending: true,
        limit: 5
      });
      
      return {
        success: true,
        logGroup: {
          name: logGroup.logGroupName,
          retentionInDays: logGroup.retentionInDays,
          storedBytes: logGroup.storedBytes
        },
        recentStreams: logStreams.logStreams?.length || 0,
        analysisPatterns: config.logAnalysis.analysisPatterns
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * セキュリティメトリクスの計算
   */
  private calculateSecurityMetrics(testResults: Map<string, any>): any {
    const httpsResult = testResults.get('https_encryption');
    const attackResult = testResults.get('attack_resistance');
    const monitoringResult = testResults.get('security_monitoring');
    
    const httpsCompliance = httpsResult?.success || false;
    const certificateValid = httpsResult?.details?.get('tls_certificate')?.success || false;
    const securityHeadersPresent = httpsResult?.details?.get('security_headers')?.success || false;
    const wafProtectionActive = attackResult?.success || false;
    const attacksBlocked = attackResult?.attacksBlocked || 0;
    
    // 脆弱性の計算
    let vulnerabilitiesFound = 0;
    if (!httpsCompliance) vulnerabilitiesFound++;
    if (!certificateValid) vulnerabilitiesFound++;
    if (!securityHeadersPresent) vulnerabilitiesFound++;
    if (!wafProtectionActive) vulnerabilitiesFound++;
    
    // セキュリティスコアの計算（0-1の範囲）
    const maxScore = 4;
    const currentScore = maxScore - vulnerabilitiesFound;
    const securityScore = Math.max(0, currentScore / maxScore);
    
    return {
      httpsCompliance,
      certificateValid,
      securityHeadersPresent,
      wafProtectionActive,
      attacksBlocked,
      vulnerabilitiesFound,
      securityScore
    };
  }

  /**
   * セキュリティ設定の検証
   */
  private async validateSecurityConfiguration(): Promise<void> {
    if (!this.securityConfig.httpsEncryption?.cloudFrontDistribution?.domainName) {
      throw new Error('CloudFrontドメイン名が設定されていません');
    }
    
    if (!this.securityConfig.attackResistance?.wafConfiguration?.webAclId) {
      console.warn('WAF WebACL IDが設定されていません。攻撃耐性テストが制限される可能性があります。');
    }
    
    if (!this.securityConfig.securityMonitoring?.cloudTrail?.trailName) {
      console.warn('CloudTrail名が設定されていません。セキュリティ監視テストが制限される可能性があります。');
    }
  }

  /**
   * 本番環境接続の確認
   */
  private async verifyProductionConnectivity(): Promise<void> {
    try {
      const url = `https://${this.securityConfig.httpsEncryption.cloudFrontDistribution.domainName}/api/health`;
      const response = await axios.get(url, { timeout: 10000 });
      
      if (response.status !== 200) {
        throw new Error(`本番環境への接続確認に失敗: ${response.status}`);
      }
      
      console.log('✅ 本番環境への接続確認完了');
      
    } catch (error) {
      throw new Error(`本番環境への接続に失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    console.log('🧹 セキュリティテストモジュールをクリーンアップ中...');
    
    try {
      // 特別なクリーンアップ処理は不要（読み取り専用テストのため）
      console.log('✅ セキュリティテストモジュールのクリーンアップ完了');
      
    } catch (error) {
      console.warn('⚠️ セキュリティテストモジュールのクリーンアップ中にエラー:', error);
    }
  }
}

export default SecurityTestModule;