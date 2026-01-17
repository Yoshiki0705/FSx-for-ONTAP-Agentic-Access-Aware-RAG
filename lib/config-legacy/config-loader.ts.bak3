/**
 * Configuration Loader
 * 環境別設定の動的読み込み機能
 */

import { GlobalRagConfig } from '../types/global-config';
import { tokyoConfig } from './environments/tokyo';
import { frankfurtConfig } from './environments/frankfurt';
import { virginiaConfig } from './environments/virginia';
// ComplianceMapperは後で実装予定のため、一時的に直接設定
import { ComplianceRegulation } from '../types/global-config';
import { 
  MarkitdownConfig, 
  DEFAULT_MARKITDOWN_CONFIG, 
  EnvironmentMarkitdownConfig,
  SupportedFileFormat,
  ProcessingStrategy
} from '../types/markitdown-config';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Markitdown設定を読み込む
 */
export function loadMarkitdownConfig(environment?: string): MarkitdownConfig {
  try {
    // メイン設定ファイルを読み込み
    const configPath = path.join(__dirname, 'markitdown-config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    let markitdownConfig: MarkitdownConfig = config.markitdown || DEFAULT_MARKITDOWN_CONFIG;
    
    // 環境別設定オーバーライドを適用
    if (environment) {
      const environmentOverrides = loadEnvironmentMarkitdownOverrides();
      const envConfig = environmentOverrides[environment as keyof EnvironmentMarkitdownConfig];
      if (envConfig) {
        markitdownConfig = mergeMarkitdownConfig(markitdownConfig, envConfig);
      }
    }
    
    console.log(`✅ Markitdown設定を読み込みました (環境: ${environment || 'default'})`);
    return markitdownConfig;
  } catch (error) {
    console.warn(`⚠️ Markitdown設定の読み込みに失敗しました: ${error}`);
    console.log('デフォルト設定を使用します');
    return DEFAULT_MARKITDOWN_CONFIG;
  }
}

/**
 * 環境別Markitdown設定オーバーライドを読み込む
 */
function loadEnvironmentMarkitdownOverrides(): EnvironmentMarkitdownConfig {
  try {
    const overridePath = path.join(__dirname, 'environments', 'markitdown-overrides.json');
    if (fs.existsSync(overridePath)) {
      const overrideData = fs.readFileSync(overridePath, 'utf8');
      return JSON.parse(overrideData);
    }
  } catch (error) {
    console.warn(`⚠️ 環境別Markitdown設定オーバーライドの読み込みに失敗: ${error}`);
  }
  return {};
}

/**
 * Markitdown設定をマージする
 */
function mergeMarkitdownConfig(
  baseConfig: MarkitdownConfig, 
  override: Partial<MarkitdownConfig>
): MarkitdownConfig {
  return {
    ...baseConfig,
    ...override,
    supportedFormats: {
      ...baseConfig.supportedFormats,
      ...(override.supportedFormats || {})
    },
    performance: {
      ...baseConfig.performance,
      ...(override.performance || {})
    },
    fallback: {
      ...baseConfig.fallback,
      ...(override.fallback || {})
    },
    security: {
      ...baseConfig.security,
      ...(override.security || {})
    },
    logging: {
      ...baseConfig.logging,
      ...(override.logging || {})
    },
    quality: {
      ...baseConfig.quality,
      ...(override.quality || {})
    }
  };
}

/**
 * 環境別設定を読み込む
 */
export function loadEnvironmentConfig(
  environment: string,
  region: string,
  projectName: string
): GlobalRagConfig {
  console.log(`📋 Loading configuration for ${environment} environment in ${region}`);

  // 地域別のベース設定を取得
  let baseConfig: GlobalRagConfig;

  switch (region) {
    case 'ap-northeast-1': // 東京
    case 'ap-northeast-3': // 大阪
      baseConfig = tokyoConfig;
      break;
    case 'eu-central-1': // フランクフルト
    case 'eu-west-1': // アイルランド
    case 'eu-west-2': // ロンドン
    case 'eu-west-3': // パリ
      baseConfig = frankfurtConfig;
      break;
    case 'us-east-1': // バージニア
    case 'us-east-2': // オハイオ
    case 'us-west-2': // オレゴン
      baseConfig = virginiaConfig;
      break;
    default:
      console.warn(`⚠️ Unknown region ${region}, using Tokyo config as default`);
      baseConfig = tokyoConfig;
  }

  // Markitdown設定を読み込み
  const markitdownConfig = loadMarkitdownConfig(environment);
  
  // 環境固有の調整
  const config: GlobalRagConfig = {
    ...baseConfig,
    projectName,
    environment: environment as 'dev' | 'staging' | 'prod',
    region,
    // 環境別の機能調整
    features: adjustFeaturesForEnvironment(baseConfig.features, environment, markitdownConfig),
    // コンプライアンス設定の自動マッピング
    compliance: {
      regulations: getComplianceForRegion(region),
      dataProtection: {
        encryptionAtRest: true,
        encryptionInTransit: true,
        dataClassification: true,
        accessLogging: true,
        dataRetention: {
          defaultRetentionDays: 365,
          personalDataRetentionDays: 365,
          logRetentionDays: 365,
          backupRetentionDays: 365
        }
      },
      auditLogging: true
    }
  };

  // 環境別の追加調整
  if (environment === 'dev') {
    // 開発環境では一部機能を無効化してコストを削減
    config.features.monitoring.xray = false;
    config.features.storage.backup = false;
    config.features.enterprise.multiTenant = false;
    config.features.enterprise.billing = false;
  } else if (environment === 'prod') {
    // 本番環境では全機能を有効化
    config.features.monitoring.xray = true;
    config.features.storage.backup = true;
    config.features.enterprise.multiTenant = true;
    config.features.enterprise.billing = true;
  }

  console.log(`✅ Configuration loaded successfully`);
  console.log(`   Project: ${config.projectName}`);
  console.log(`   Environment: ${config.environment}`);
  console.log(`   Region: ${config.region}`);
  console.log(`   Compliance: ${config.compliance.regulations.join(', ')}`);

  return config;
}

/**
 * 環境に応じた機能設定の調整
 */
function adjustFeaturesForEnvironment(
  baseFeatures: GlobalRagConfig['features'],
  environment: string,
  markitdownConfig?: MarkitdownConfig
): GlobalRagConfig['features'] {
  const features = { ...baseFeatures };

  // Markitdown設定を統合
  if (markitdownConfig) {
    features.ai = {
      ...features.ai,
      markitdown: markitdownConfig.enabled,
      config: markitdownConfig
    };
  }

  switch (environment) {
    case 'dev':
      // 開発環境: 基本機能のみ
      features.networking.loadBalancer = false;
      features.networking.cdn = false;
      features.security.waf = false;
      features.storage.backup = false;
      features.storage.lifecycle = false;
      features.database.rds = false;
      features.compute.ecs = false;
      features.compute.scaling = false;
      features.api.graphql = false;
      features.api.websocket = false;
      features.monitoring.xray = false;
      features.monitoring.alarms = false;
      features.enterprise.multiTenant = false;
      features.enterprise.billing = false;
      features.enterprise.compliance = false;
      features.enterprise.governance = false;
      break;

    case 'staging':
      // ステージング環境: 本番同等（エンタープライズ機能除く）
      features.networking.loadBalancer = true;
      features.networking.cdn = true;
      features.security.waf = true;
      features.storage.backup = true;
      features.storage.lifecycle = true;
      features.database.rds = false; // オプション
      features.compute.ecs = false; // オプション
      features.compute.scaling = true;
      features.api.graphql = false; // オプション
      features.api.websocket = false; // オプション
      features.monitoring.xray = true;
      features.monitoring.alarms = true;
      features.enterprise.multiTenant = false;
      features.enterprise.billing = false;
      features.enterprise.compliance = true;
      features.enterprise.governance = true;
      break;

    case 'prod':
      // 本番環境: 全機能有効
      features.networking.loadBalancer = true;
      features.networking.cdn = true;
      features.security.waf = true;
      features.storage.backup = true;
      features.storage.lifecycle = true;
      features.database.rds = true;
      features.compute.ecs = true;
      features.compute.scaling = true;
      features.api.graphql = true;
      features.api.websocket = true;
      features.monitoring.xray = true;
      features.monitoring.alarms = true;
      features.enterprise.multiTenant = true;
      features.enterprise.billing = true;
      features.enterprise.compliance = true;
      features.enterprise.governance = true;
      break;

    default:
      console.warn(`⚠️ Unknown environment ${environment}, using default settings`);
  }

  return features;
}

/**
 * Markitdown設定を検証する
 */
export function validateMarkitdownConfig(config: MarkitdownConfig): boolean {
  try {
    // 基本設定の検証
    if (typeof config.enabled !== 'boolean') {
      console.error('❌ Markitdown設定エラー: enabled は boolean である必要があります');
      return false;
    }

    // サポートされるファイル形式の検証
    if (!config.supportedFormats || typeof config.supportedFormats !== 'object') {
      console.error('❌ Markitdown設定エラー: supportedFormats が正しく設定されていません');
      return false;
    }

    // パフォーマンス設定の検証
    if (config.performance.maxFileSizeBytes <= 0) {
      console.error('❌ Markitdown設定エラー: maxFileSizeBytes は正の数である必要があります');
      return false;
    }

    if (config.performance.memoryLimitMB <= 0) {
      console.error('❌ Markitdown設定エラー: memoryLimitMB は正の数である必要があります');
      return false;
    }

    // タイムアウト設定の検証
    for (const [format, formatConfig] of Object.entries(config.supportedFormats)) {
      if (formatConfig.timeout <= 0) {
        console.error(`❌ Markitdown設定エラー: ${format} のタイムアウト値が無効です`);
        return false;
      }
    }

    console.log('✅ Markitdown設定の検証が完了しました');
    return true;
  } catch (error) {
    console.error(`❌ Markitdown設定の検証中にエラーが発生しました: ${error}`);
    return false;
  }
}

/**
 * 地域別のコンプライアンス規制を取得する（一時的な実装）
 */
function getComplianceForRegion(region: string): ComplianceRegulation[] {
  switch (region) {
    case 'ap-northeast-1': // 東京
    case 'ap-northeast-3': // 大阪
      return ['FISC'];
    case 'eu-central-1': // フランクフルト
    case 'eu-west-1': // アイルランド
    case 'eu-west-2': // ロンドン
    case 'eu-west-3': // パリ
      return ['GDPR'];
    case 'us-east-1': // バージニア
    case 'us-east-2': // オハイオ
    case 'us-west-2': // オレゴン
      return ['SOX', 'HIPAA'];
    default:
      return ['GDPR']; // デフォルトはGDPR
  }
}

/**
 * ファイル形式の処理方法を動的に変更する
 */
export function updateProcessingStrategy(
  config: MarkitdownConfig,
  format: SupportedFileFormat,
  strategy: ProcessingStrategy
): MarkitdownConfig {
  const updatedConfig = { ...config };
  
  if (updatedConfig.supportedFormats[format]) {
    updatedConfig.supportedFormats[format] = {
      ...updatedConfig.supportedFormats[format],
      processingStrategy: strategy,
      useMarkitdown: shouldEnableMarkitdown(strategy),
      useLangChain: shouldEnableLangChain(strategy),
      enableQualityComparison: strategy === 'both-compare'
    };
    
    console.log(`✅ ${format}の処理戦略を${strategy}に変更しました`);
  } else {
    console.warn(`⚠️ サポートされていないファイル形式: ${format}`);
  }
  
  return updatedConfig;
}

/**
 * 処理戦略に基づいてMarkitdownを有効にするかを決定
 */
function shouldEnableMarkitdown(strategy: ProcessingStrategy): boolean {
  return ['markitdown-only', 'markitdown-first', 'both-compare', 'auto-select'].includes(strategy);
}

/**
 * 処理戦略に基づいてLangChainを有効にするかを決定
 */
function shouldEnableLangChain(strategy: ProcessingStrategy): boolean {
  return ['langchain-only', 'langchain-first', 'both-compare', 'auto-select'].includes(strategy);
}

/**
 * 複数のファイル形式の処理方法を一括変更
 */
export function updateMultipleProcessingStrategies(
  config: MarkitdownConfig,
  updates: Record<SupportedFileFormat, ProcessingStrategy>
): MarkitdownConfig {
  let updatedConfig = { ...config };
  
  for (const [format, strategy] of Object.entries(updates) as [SupportedFileFormat, ProcessingStrategy][]) {
    updatedConfig = updateProcessingStrategy(updatedConfig, format, strategy);
  }
  
  console.log(`✅ ${Object.keys(updates).length}個のファイル形式の処理戦略を更新しました`);
  return updatedConfig;
}

/**
 * 処理方法の使用状況レポートを生成
 */
export function generateProcessingMethodReport(config: MarkitdownConfig): {
  summary: {
    totalFormats: number;
    markitdownOnlyFormats: number;
    langchainOnlyFormats: number;
    hybridFormats: number;
    qualityComparisonFormats: number;
  };
  details: Array<{
    format: SupportedFileFormat;
    strategy: ProcessingStrategy;
    useMarkitdown: boolean;
    useLangChain: boolean;
    qualityComparison: boolean;
  }>;
} {
  const details = Object.entries(config.supportedFormats).map(([format, formatConfig]) => ({
    format: format as SupportedFileFormat,
    strategy: formatConfig.processingStrategy,
    useMarkitdown: formatConfig.useMarkitdown,
    useLangChain: formatConfig.useLangChain,
    qualityComparison: formatConfig.enableQualityComparison || false
  }));

  const summary = {
    totalFormats: details.length,
    markitdownOnlyFormats: details.filter(d => d.useMarkitdown && !d.useLangChain).length,
    langchainOnlyFormats: details.filter(d => !d.useMarkitdown && d.useLangChain).length,
    hybridFormats: details.filter(d => d.useMarkitdown && d.useLangChain).length,
    qualityComparisonFormats: details.filter(d => d.qualityComparison).length
  };

  return { summary, details };
}

/**
 * Markitdown設定テンプレートを生成する
 */
export function generateMarkitdownConfigTemplate(): MarkitdownConfig {
  console.log('📝 Markitdown設定テンプレートを生成しています...');
  
  const template: MarkitdownConfig = {
    ...DEFAULT_MARKITDOWN_CONFIG,
    // テンプレート用のコメント付き設定
    supportedFormats: {
      docx: { 
        enabled: true, 
        timeout: 30, 
        description: 'Microsoft Word文書 - 一般的なビジネス文書',
        processingStrategy: 'markitdown-first',
        useMarkitdown: true,
        useLangChain: true,
        enableQualityComparison: false
      },
      xlsx: { 
        enabled: true, 
        timeout: 45, 
        description: 'Microsoft Excel文書 - スプレッドシートとデータ',
        processingStrategy: 'markitdown-first',
        useMarkitdown: true,
        useLangChain: true,
        enableQualityComparison: false
      },
      pptx: { 
        enabled: true, 
        timeout: 60, 
        description: 'Microsoft PowerPoint文書 - プレゼンテーション',
        processingStrategy: 'markitdown-first',
        useMarkitdown: true,
        useLangChain: true,
        enableQualityComparison: false
      },
      pdf: { 
        enabled: true, 
        timeout: 120, 
        ocr: true, 
        description: 'PDF文書 - OCR機能でスキャン文書にも対応',
        processingStrategy: 'both-compare',
        useMarkitdown: true,
        useLangChain: true,
        enableQualityComparison: true
      },
      png: { 
        enabled: false, 
        timeout: 90, 
        ocr: true, 
        description: 'PNG画像 - 高品質画像、OCR必要時のみ有効化',
        processingStrategy: 'markitdown-only',
        useMarkitdown: true,
        useLangChain: false,
        enableQualityComparison: false
      },
      jpg: { 
        enabled: false, 
        timeout: 90, 
        ocr: true, 
        description: 'JPEG画像 - 一般的な画像形式、OCR必要時のみ有効化',
        processingStrategy: 'markitdown-only',
        useMarkitdown: true,
        useLangChain: false,
        enableQualityComparison: false
      },
      jpeg: { 
        enabled: false, 
        timeout: 90, 
        ocr: true, 
        description: 'JPEG画像 - 一般的な画像形式、OCR必要時のみ有効化',
        processingStrategy: 'markitdown-only',
        useMarkitdown: true,
        useLangChain: false,
        enableQualityComparison: false
      },
      gif: { 
        enabled: false, 
        timeout: 90, 
        ocr: true, 
        description: 'GIF画像 - アニメーション画像、OCR必要時のみ有効化',
        processingStrategy: 'markitdown-only',
        useMarkitdown: true,
        useLangChain: false,
        enableQualityComparison: false
      },
      html: { 
        enabled: true, 
        timeout: 30, 
        description: 'HTML文書 - ウェブページとマークアップ',
        processingStrategy: 'langchain-first',
        useMarkitdown: true,
        useLangChain: true,
        enableQualityComparison: false
      },
      xml: { 
        enabled: true, 
        timeout: 30, 
        description: 'XML文書 - 構造化データ',
        processingStrategy: 'langchain-first',
        useMarkitdown: true,
        useLangChain: true,
        enableQualityComparison: false
      },
      csv: { 
        enabled: true, 
        timeout: 15, 
        description: 'CSV文書 - カンマ区切りデータ',
        processingStrategy: 'langchain-only',
        useMarkitdown: false,
        useLangChain: true,
        enableQualityComparison: false
      },
      tsv: { 
        enabled: true, 
        timeout: 15, 
        description: 'TSV文書 - タブ区切りデータ',
        processingStrategy: 'langchain-only',
        useMarkitdown: false,
        useLangChain: true,
        enableQualityComparison: false
      }
    }
  };

  console.log('✅ Markitdown設定テンプレートが生成されました');
  return template;
}

/**
 * 地域別のデフォルト設定を取得
 */
export function getRegionalDefaults(region: string): Partial<GlobalRagConfig> {
  return {
    region,
    compliance: {
      regulations: getComplianceForRegion(region),
      dataProtection: {
        encryptionAtRest: true,
        encryptionInTransit: true,
        dataClassification: true,
        accessLogging: true,
        dataRetention: {
          defaultRetentionDays: 365,
          personalDataRetentionDays: 365,
          logRetentionDays: 365,
          backupRetentionDays: 365
        }
      },
      auditLogging: true
    },
    // 地域別のデフォルト設定
    features: {
      networking: {
        vpc: true,
        loadBalancer: true,
        cdn: true,
        customDomain: undefined
      },
      security: {
        waf: true,
        cognito: true,
        encryption: true,
        compliance: true
      },
      storage: {
        fsx: true,
        s3: true,
        backup: true,
        lifecycle: true
      },
      database: {
        dynamodb: true,
        opensearch: true,
        rds: false, // オプション
        migration: true
      },
      compute: {
        lambda: true,
        ecs: false, // オプション
        scaling: true
      },
      api: {
        restApi: true,
        graphql: false, // オプション
        websocket: false, // オプション
        frontend: true
      },
      ai: {
        bedrock: true,
        embedding: true,
        rag: true,
        modelManagement: true
      },
      monitoring: {
        cloudwatch: true,
        xray: true,
        alarms: true,
        dashboards: true
      },
      enterprise: {
        multiTenant: false, // オプション
        billing: false, // オプション
        compliance: true,
        governance: true
      }
    }
  };
}