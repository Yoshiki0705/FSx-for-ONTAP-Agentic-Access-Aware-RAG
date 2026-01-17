/**
 * UI/UXテスト設定
 * 
 * 実本番環境でのUI/UXテストに関する設定を管理
 * レスポンシブデザイン、アクセシビリティ、ユーザビリティテストの設定を含む
 * 
 * @version 1.0.0
 * @author NetApp Japan Technology Team
 */

/**
 * UI/UXテスト設定インターフェース
 */
export interface UIUXTestConfig {
  // 基本設定
  testEnvironment: 'production' | 'staging' | 'development';
  region: string;
  baseUrl: string;
  
  // ビューポート設定
  viewports: {
    mobile: ViewportConfig;
    tablet: ViewportConfig;
    desktop: ViewportConfig;
    ultrawide?: ViewportConfig;
  };
  
  // パフォーマンス閾値
  performanceThresholds: {
    pageLoadTime: number;           // ms
    firstContentfulPaint: number;   // ms
    largestContentfulPaint: number; // ms
    cumulativeLayoutShift: number;  // 0-1
    firstInputDelay: number;        // ms
    interactionToNextPaint: number; // ms
  };
  
  // アクセシビリティ設定
  accessibility: {
    wcagLevel: 'A' | 'AA' | 'AAA';
    minimumContrastRatio: number;
    requireKeyboardNavigation: boolean;
    requireScreenReaderSupport: boolean;
    minimumAltTextCoverage: number; // 0-1
    testColorBlindness: boolean;
  };
  
  // ユーザビリティ設定
  usability: {
    minimumNavigationEfficiency: number;  // 0-1
    minimumFormUsability: number;         // 0-1
    minimumErrorHandling: number;         // 0-1
    minimumUserFlowCompletion: number;    // 0-1
    testUserJourneys: string[];
  };
  
  // ブラウザ設定
  browser: {
    userAgent: string;
    enableJavaScript: boolean;
    enableImages: boolean;
    enableCSS: boolean;
    networkThrottling?: NetworkThrottling;
    cpuThrottling?: number; // 1-20x
  };
  
  // テスト実行設定
  execution: {
    screenshotOnFailure: boolean;
    screenshotFormat: 'png' | 'jpeg' | 'webp';
    screenshotQuality: number; // 0-100
    maxTestDuration: number;   // seconds
    retryOnFailure: boolean;
    maxRetries: number;
  };
  
  // 安全設定
  safety: {
    readOnlyMode: boolean;
    preventDataModification: boolean;
    emergencyStopEnabled: boolean;
    maxInteractionDepth: number;
  };
}

/**
 * ビューポート設定
 */
export interface ViewportConfig {
  width: number;
  height: number;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  isLandscape: boolean;
}

/**
 * ネットワーク制限設定
 */
export interface NetworkThrottling {
  offline: boolean;
  downloadThroughput: number; // bytes/s
  uploadThroughput: number;   // bytes/s
  latency: number;            // ms
}

/**
 * 本番環境用UI/UXテスト設定
 */
export const productionUIUXConfig: UIUXTestConfig = {
  testEnvironment: 'production',
  region: 'ap-northeast-1',
  baseUrl: 'https://d1234567890.cloudfront.net', // 実際のCloudFront URL
  
  viewports: {
    mobile: {
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      isLandscape: false
    },
    tablet: {
      width: 768,
      height: 1024,
      deviceScaleFactor: 2,
      isMobile: false,
      hasTouch: true,
      isLandscape: false
    },
    desktop: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      isLandscape: true
    },
    ultrawide: {
      width: 3440,
      height: 1440,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      isLandscape: true
    }
  },
  
  performanceThresholds: {
    pageLoadTime: 3000,           // 3秒
    firstContentfulPaint: 1800,   // 1.8秒
    largestContentfulPaint: 2500, // 2.5秒
    cumulativeLayoutShift: 0.1,   // 0.1以下
    firstInputDelay: 100,         // 100ms
    interactionToNextPaint: 200   // 200ms
  },
  
  accessibility: {
    wcagLevel: 'AA',
    minimumContrastRatio: 4.5,
    requireKeyboardNavigation: true,
    requireScreenReaderSupport: true,
    minimumAltTextCoverage: 0.9,  // 90%
    testColorBlindness: true
  },
  
  usability: {
    minimumNavigationEfficiency: 0.8,   // 80%
    minimumFormUsability: 0.8,          // 80%
    minimumErrorHandling: 0.7,          // 70%
    minimumUserFlowCompletion: 0.85,    // 85%
    testUserJourneys: [
      'login-to-chat',
      'document-upload-and-query',
      'chat-history-review',
      'logout'
    ]
  },
  
  browser: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    enableJavaScript: true,
    enableImages: true,
    enableCSS: true,
    networkThrottling: {
      offline: false,
      downloadThroughput: 1.5 * 1024 * 1024, // 1.5 Mbps
      uploadThroughput: 750 * 1024,           // 750 Kbps
      latency: 40                             // 40ms
    }
  },
  
  execution: {
    screenshotOnFailure: true,
    screenshotFormat: 'png',
    screenshotQuality: 90,
    maxTestDuration: 600,     // 10分
    retryOnFailure: true,
    maxRetries: 2
  },
  
  safety: {
    readOnlyMode: true,
    preventDataModification: true,
    emergencyStopEnabled: true,
    maxInteractionDepth: 10
  }
};

/**
 * ステージング環境用UI/UXテスト設定
 */
export const stagingUIUXConfig: UIUXTestConfig = {
  ...productionUIUXConfig,
  testEnvironment: 'staging',
  baseUrl: 'https://staging.example.com',
  
  // より厳しいテスト設定
  performanceThresholds: {
    pageLoadTime: 2500,           // 2.5秒
    firstContentfulPaint: 1500,   // 1.5秒
    largestContentfulPaint: 2000, // 2秒
    cumulativeLayoutShift: 0.05,  // 0.05以下
    firstInputDelay: 50,          // 50ms
    interactionToNextPaint: 150   // 150ms
  },
  
  accessibility: {
    ...productionUIUXConfig.accessibility,
    wcagLevel: 'AAA',
    minimumContrastRatio: 7.0,
    minimumAltTextCoverage: 0.95  // 95%
  },
  
  usability: {
    ...productionUIUXConfig.usability,
    minimumNavigationEfficiency: 0.85,  // 85%
    minimumFormUsability: 0.85,         // 85%
    minimumErrorHandling: 0.8,          // 80%
    minimumUserFlowCompletion: 0.9      // 90%
  },
  
  execution: {
    ...productionUIUXConfig.execution,
    maxTestDuration: 900,         // 15分
    maxRetries: 3
  },
  
  safety: {
    ...productionUIUXConfig.safety,
    readOnlyMode: false,          // ステージングでは書き込み可能
    preventDataModification: false,
    maxInteractionDepth: 15
  }
};

/**
 * 開発環境用UI/UXテスト設定
 */
export const developmentUIUXConfig: UIUXTestConfig = {
  ...productionUIUXConfig,
  testEnvironment: 'development',
  baseUrl: 'http://localhost:3000',
  
  // 緩い設定
  performanceThresholds: {
    pageLoadTime: 5000,           // 5秒
    firstContentfulPaint: 3000,   // 3秒
    largestContentfulPaint: 4000, // 4秒
    cumulativeLayoutShift: 0.2,   // 0.2以下
    firstInputDelay: 200,         // 200ms
    interactionToNextPaint: 300   // 300ms
  },
  
  accessibility: {
    ...productionUIUXConfig.accessibility,
    wcagLevel: 'A',
    minimumContrastRatio: 3.0,
    minimumAltTextCoverage: 0.7   // 70%
  },
  
  usability: {
    ...productionUIUXConfig.usability,
    minimumNavigationEfficiency: 0.6,   // 60%
    minimumFormUsability: 0.6,          // 60%
    minimumErrorHandling: 0.5,          // 50%
    minimumUserFlowCompletion: 0.7      // 70%
  },
  
  browser: {
    ...productionUIUXConfig.browser,
    networkThrottling: undefined  // 制限なし
  },
  
  execution: {
    ...productionUIUXConfig.execution,
    maxTestDuration: 300,         // 5分
    maxRetries: 1
  },
  
  safety: {
    ...productionUIUXConfig.safety,
    readOnlyMode: false,
    preventDataModification: false,
    maxInteractionDepth: 20
  }
};

/**
 * 環境に応じた設定の取得
 */
export function getUIUXConfig(environment: string): UIUXTestConfig {
  switch (environment.toLowerCase()) {
    case 'production':
    case 'prod':
      return productionUIUXConfig;
    case 'staging':
    case 'stage':
      return stagingUIUXConfig;
    case 'development':
    case 'dev':
      return developmentUIUXConfig;
    default:
      console.warn(`未知の環境: ${environment}. 開発環境設定を使用します。`);
      return developmentUIUXConfig;
  }
}

/**
 * UI/UXテスト設定の検証
 */
export function validateUIUXConfig(config: UIUXTestConfig): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 必須フィールドの検証
  if (!config.baseUrl) {
    errors.push('ベースURLが設定されていません');
  }

  if (!config.region) {
    errors.push('リージョンが設定されていません');
  }

  // ビューポート設定の検証
  const requiredViewports = ['mobile', 'tablet', 'desktop'];
  for (const viewport of requiredViewports) {
    const viewportConfig = config.viewports[viewport as keyof typeof config.viewports];
    if (!viewportConfig) {
      errors.push(`${viewport}ビューポート設定が不足しています`);
    } else {
      if (viewportConfig.width <= 0 || viewportConfig.height <= 0) {
        errors.push(`${viewport}ビューポートのサイズが無効です`);
      }
    }
  }

  // パフォーマンス閾値の検証
  if (config.performanceThresholds.pageLoadTime <= 0) {
    errors.push('ページ読み込み時間の閾値は正の値である必要があります');
  }

  if (config.performanceThresholds.cumulativeLayoutShift < 0 || config.performanceThresholds.cumulativeLayoutShift > 1) {
    errors.push('CLS閾値は0-1の範囲である必要があります');
  }

  // アクセシビリティ設定の検証
  if (config.accessibility.minimumContrastRatio < 1) {
    errors.push('最小コントラスト比は1以上である必要があります');
  }

  if (config.accessibility.minimumAltTextCoverage < 0 || config.accessibility.minimumAltTextCoverage > 1) {
    errors.push('代替テキストカバレッジは0-1の範囲である必要があります');
  }

  // ユーザビリティ設定の検証
  const usabilityMetrics = [
    'minimumNavigationEfficiency',
    'minimumFormUsability',
    'minimumErrorHandling',
    'minimumUserFlowCompletion'
  ];

  for (const metric of usabilityMetrics) {
    const value = config.usability[metric as keyof typeof config.usability];
    if (typeof value === 'number' && (value < 0 || value > 1)) {
      errors.push(`${metric}は0-1の範囲である必要があります`);
    }
  }

  // 実行設定の検証
  if (config.execution.maxTestDuration <= 0) {
    errors.push('最大テスト時間は正の値である必要があります');
  }

  if (config.execution.maxRetries < 0) {
    errors.push('最大リトライ回数は0以上である必要があります');
  }

  // 警告の生成
  if (config.testEnvironment === 'production') {
    if (config.performanceThresholds.pageLoadTime > 3000) {
      warnings.push('本番環境でのページ読み込み時間閾値が3秒を超えています');
    }

    if (!config.safety.readOnlyMode) {
      warnings.push('本番環境で読み取り専用モードが無効になっています');
    }

    if (config.execution.maxTestDuration > 600) {
      warnings.push('本番環境でのテスト最大実行時間が10分を超えています');
    }
  }

  if (config.accessibility.wcagLevel === 'A') {
    warnings.push('WCAG準拠レベルがAに設定されています。AAまたはAAAを推奨します');
  }

  if (config.accessibility.minimumContrastRatio < 4.5) {
    warnings.push('最小コントラスト比が4.5:1を下回っています。WCAG AA準拠のため4.5:1以上を推奨します');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * UI/UXテスト設定の表示
 */
export function displayUIUXConfig(config: UIUXTestConfig): void {
  console.log('🎨 UI/UXテスト設定:');
  console.log(`   環境: ${config.testEnvironment}`);
  console.log(`   リージョン: ${config.region}`);
  console.log(`   ベースURL: ${config.baseUrl}`);
  console.log('');
  
  console.log('📱 ビューポート設定:');
  Object.entries(config.viewports).forEach(([name, viewport]) => {
    console.log(`   ${name}: ${viewport.width}x${viewport.height} (${viewport.isMobile ? 'モバイル' : 'デスクトップ'})`);
  });
  console.log('');
  
  console.log('⚡ パフォーマンス閾値:');
  console.log(`   ページ読み込み時間: ${config.performanceThresholds.pageLoadTime}ms`);
  console.log(`   First Contentful Paint: ${config.performanceThresholds.firstContentfulPaint}ms`);
  console.log(`   Largest Contentful Paint: ${config.performanceThresholds.largestContentfulPaint}ms`);
  console.log(`   Cumulative Layout Shift: ${config.performanceThresholds.cumulativeLayoutShift}`);
  console.log('');
  
  console.log('♿ アクセシビリティ設定:');
  console.log(`   WCAG準拠レベル: ${config.accessibility.wcagLevel}`);
  console.log(`   最小コントラスト比: ${config.accessibility.minimumContrastRatio}:1`);
  console.log(`   キーボードナビゲーション: ${config.accessibility.requireKeyboardNavigation ? '必須' : 'オプション'}`);
  console.log(`   スクリーンリーダー対応: ${config.accessibility.requireScreenReaderSupport ? '必須' : 'オプション'}`);
  console.log(`   代替テキストカバレッジ: ${(config.accessibility.minimumAltTextCoverage * 100).toFixed(0)}%`);
  console.log('');
  
  console.log('👤 ユーザビリティ設定:');
  console.log(`   ナビゲーション効率: ${(config.usability.minimumNavigationEfficiency * 100).toFixed(0)}%以上`);
  console.log(`   フォーム使いやすさ: ${(config.usability.minimumFormUsability * 100).toFixed(0)}%以上`);
  console.log(`   エラーハンドリング: ${(config.usability.minimumErrorHandling * 100).toFixed(0)}%以上`);
  console.log(`   ユーザーフロー完了率: ${(config.usability.minimumUserFlowCompletion * 100).toFixed(0)}%以上`);
  console.log('');
  
  console.log('🛡️ 安全設定:');
  console.log(`   読み取り専用モード: ${config.safety.readOnlyMode ? '有効' : '無効'}`);
  console.log(`   データ変更防止: ${config.safety.preventDataModification ? '有効' : '無効'}`);
  console.log(`   緊急停止機能: ${config.safety.emergencyStopEnabled ? '有効' : '無効'}`);
  console.log(`   最大操作深度: ${config.safety.maxInteractionDepth}`);
}

export default {
  productionUIUXConfig,
  stagingUIUXConfig,
  developmentUIUXConfig,
  getUIUXConfig,
  validateUIUXConfig,
  displayUIUXConfig
};