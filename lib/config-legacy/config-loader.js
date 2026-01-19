"use strict";
/**
 * Configuration Loader
 * 環境別設定の動的読み込み機能
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadMarkitdownConfig = loadMarkitdownConfig;
exports.loadEnvironmentConfig = loadEnvironmentConfig;
exports.validateMarkitdownConfig = validateMarkitdownConfig;
exports.updateProcessingStrategy = updateProcessingStrategy;
exports.updateMultipleProcessingStrategies = updateMultipleProcessingStrategies;
exports.generateProcessingMethodReport = generateProcessingMethodReport;
exports.generateMarkitdownConfigTemplate = generateMarkitdownConfigTemplate;
exports.getRegionalDefaults = getRegionalDefaults;
const tokyo_1 = require("./environments/tokyo");
const frankfurt_1 = require("./environments/frankfurt");
const virginia_1 = require("./environments/virginia");
const markitdown_config_1 = require("../../types/markitdown-config");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Markitdown設定を読み込む
 */
function loadMarkitdownConfig(environment) {
    try {
        // メイン設定ファイルを読み込み
        const configPath = path.join(__dirname, 'markitdown-config.json');
        const configData = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configData);
        let markitdownConfig = config.markitdown || markitdown_config_1.DEFAULT_MARKITDOWN_CONFIG;
        // 環境別設定オーバーライドを適用
        if (environment) {
            const environmentOverrides = loadEnvironmentMarkitdownOverrides();
            const envConfig = environmentOverrides[environment];
            if (envConfig) {
                markitdownConfig = mergeMarkitdownConfig(markitdownConfig, envConfig);
            }
        }
        console.log(`✅ Markitdown設定を読み込みました (環境: ${environment || 'default'})`);
        return markitdownConfig;
    }
    catch (error) {
        console.warn(`⚠️ Markitdown設定の読み込みに失敗しました: ${error}`);
        console.log('デフォルト設定を使用します');
        return markitdown_config_1.DEFAULT_MARKITDOWN_CONFIG;
    }
}
/**
 * 環境別Markitdown設定オーバーライドを読み込む
 */
function loadEnvironmentMarkitdownOverrides() {
    try {
        const overridePath = path.join(__dirname, 'environments', 'markitdown-overrides.json');
        if (fs.existsSync(overridePath)) {
            const overrideData = fs.readFileSync(overridePath, 'utf8');
            return JSON.parse(overrideData);
        }
    }
    catch (error) {
        console.warn(`⚠️ 環境別Markitdown設定オーバーライドの読み込みに失敗: ${error}`);
    }
    return {};
}
/**
 * Markitdown設定をマージする
 */
function mergeMarkitdownConfig(baseConfig, override) {
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
function loadEnvironmentConfig(environment, region, projectName) {
    console.log(`📋 Loading configuration for ${environment} environment in ${region}`);
    // 地域別のベース設定を取得
    let baseConfig;
    switch (region) {
        case 'ap-northeast-1': // 東京
        case 'ap-northeast-3': // 大阪
            baseConfig = tokyo_1.tokyoConfig;
            break;
        case 'eu-central-1': // フランクフルト
        case 'eu-west-1': // アイルランド
        case 'eu-west-2': // ロンドン
        case 'eu-west-3': // パリ
            baseConfig = frankfurt_1.frankfurtConfig;
            break;
        case 'us-east-1': // バージニア
        case 'us-east-2': // オハイオ
        case 'us-west-2': // オレゴン
            baseConfig = virginia_1.virginiaConfig;
            break;
        default:
            console.warn(`⚠️ Unknown region ${region}, using Tokyo config as default`);
            baseConfig = tokyo_1.tokyoConfig;
    }
    // Markitdown設定を読み込み
    const markitdownConfig = loadMarkitdownConfig(environment);
    // 環境固有の調整
    const config = {
        ...baseConfig,
        projectName,
        environment: environment,
        region,
        // 環境別の機能調整
        features: adjustFeaturesForEnvironment(baseConfig.features, environment, markitdownConfig),
        // コンプライアンス設定の自動マッピング
        compliance: {
            enabled: true,
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
    }
    else if (environment === 'prod') {
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
function adjustFeaturesForEnvironment(baseFeatures, environment, markitdownConfig) {
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
function validateMarkitdownConfig(config) {
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
    }
    catch (error) {
        console.error(`❌ Markitdown設定の検証中にエラーが発生しました: ${error}`);
        return false;
    }
}
/**
 * 地域別のコンプライアンス規制を取得する（一時的な実装）
 */
function getComplianceForRegion(region) {
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
function updateProcessingStrategy(config, format, strategy) {
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
    }
    else {
        console.warn(`⚠️ サポートされていないファイル形式: ${format}`);
    }
    return updatedConfig;
}
/**
 * 処理戦略に基づいてMarkitdownを有効にするかを決定
 */
function shouldEnableMarkitdown(strategy) {
    return ['markitdown-only', 'markitdown-first', 'both-compare', 'auto-select'].includes(strategy);
}
/**
 * 処理戦略に基づいてLangChainを有効にするかを決定
 */
function shouldEnableLangChain(strategy) {
    return ['langchain-only', 'langchain-first', 'both-compare', 'auto-select'].includes(strategy);
}
/**
 * 複数のファイル形式の処理方法を一括変更
 */
function updateMultipleProcessingStrategies(config, updates) {
    let updatedConfig = { ...config };
    for (const [format, strategy] of Object.entries(updates)) {
        updatedConfig = updateProcessingStrategy(updatedConfig, format, strategy);
    }
    console.log(`✅ ${Object.keys(updates).length}個のファイル形式の処理戦略を更新しました`);
    return updatedConfig;
}
/**
 * 処理方法の使用状況レポートを生成
 */
function generateProcessingMethodReport(config) {
    const details = Object.entries(config.supportedFormats).map(([format, formatConfig]) => ({
        format: format,
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
function generateMarkitdownConfigTemplate() {
    console.log('📝 Markitdown設定テンプレートを生成しています...');
    const template = {
        ...markitdown_config_1.DEFAULT_MARKITDOWN_CONFIG,
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
function getRegionalDefaults(region) {
    return {
        region,
        compliance: {
            enabled: true,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZmlnLWxvYWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvbmZpZy1sb2FkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7R0FHRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXFCSCxvREF5QkM7QUEwREQsc0RBb0ZDO0FBNEZELDREQXVDQztBQTJCRCw0REFzQkM7QUFtQkQsZ0ZBWUM7QUFLRCx3RUFpQ0M7QUFLRCw0RUE2SEM7QUFLRCxrREE2RUM7QUF0b0JELGdEQUFtRDtBQUNuRCx3REFBMkQ7QUFDM0Qsc0RBQXlEO0FBR3pELHFFQU11QztBQUN2Qyx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBRTdCOztHQUVHO0FBQ0gsU0FBZ0Isb0JBQW9CLENBQUMsV0FBb0I7SUFDdkQsSUFBSSxDQUFDO1FBQ0gsaUJBQWlCO1FBQ2pCLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLHdCQUF3QixDQUFDLENBQUM7UUFDbEUsTUFBTSxVQUFVLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxVQUFVLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDdkQsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUV0QyxJQUFJLGdCQUFnQixHQUFxQixNQUFNLENBQUMsVUFBVSxJQUFJLDZDQUF5QixDQUFDO1FBRXhGLGtCQUFrQjtRQUNsQixJQUFJLFdBQVcsRUFBRSxDQUFDO1lBQ2hCLE1BQU0sb0JBQW9CLEdBQUcsa0NBQWtDLEVBQUUsQ0FBQztZQUNsRSxNQUFNLFNBQVMsR0FBRyxvQkFBb0IsQ0FBQyxXQUFnRCxDQUFDLENBQUM7WUFDekYsSUFBSSxTQUFTLEVBQUUsQ0FBQztnQkFDZCxnQkFBZ0IsR0FBRyxxQkFBcUIsQ0FBQyxnQkFBZ0IsRUFBRSxTQUFTLENBQUMsQ0FBQztZQUN4RSxDQUFDO1FBQ0gsQ0FBQztRQUVELE9BQU8sQ0FBQyxHQUFHLENBQUMsK0JB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LEVBQUUsSUFBSTthQUNmO1lBQ0QsRUFBRSxFQUFFO2dCQUNGLE9BQU8sRUFBRSxJQUFJO2dCQUNiLFNBQVMsRUFBRSxJQUFJO2dCQUNmLEdBQUcsRUFBRSxJQUFJO2dCQUNULGVBQWUsRUFBRSxJQUFJO2FBQ3RCO1lBQ0QsVUFBVSxFQUFFO2dCQUNWLFVBQVUsRUFBRSxJQUFJO2dCQUNoQixJQUFJLEVBQUUsSUFBSTtnQkFDVixNQUFNLEVBQUUsSUFBSTtnQkFDWixVQUFVLEVBQUUsSUFBSTthQUNqQjtZQUNELFVBQVUsRUFBRTtnQkFDVixXQUFXLEVBQUUsS0FBSyxFQUFFLFFBQVE7Z0JBQzVCLE9BQU8sRUFBRSxLQUFLLEVBQUUsUUFBUTtnQkFDeEIsVUFBVSxFQUFFLElBQUk7Z0JBQ2hCLFVBQVUsRUFBRSxJQUFJO2FBQ2pCO1NBQ0Y7S0FDRixDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ29uZmlndXJhdGlvbiBMb2FkZXJcbiAqIOeSsOWig+WIpeioreWumuOBruWLleeahOiqreOBv+i+vOOBv+apn+iDvVxuICovXG5cbmltcG9ydCB7IEdsb2JhbFJhZ0NvbmZpZyB9IGZyb20gJy4uLy4uL3R5cGVzL2dsb2JhbC1jb25maWcnO1xuaW1wb3J0IHsgdG9reW9Db25maWcgfSBmcm9tICcuL2Vudmlyb25tZW50cy90b2t5byc7XG5pbXBvcnQgeyBmcmFua2Z1cnRDb25maWcgfSBmcm9tICcuL2Vudmlyb25tZW50cy9mcmFua2Z1cnQnO1xuaW1wb3J0IHsgdmlyZ2luaWFDb25maWcgfSBmcm9tICcuL2Vudmlyb25tZW50cy92aXJnaW5pYSc7XG4vLyBDb21wbGlhbmNlTWFwcGVy44Gv5b6M44Gn5a6f6KOF5LqI5a6a44Gu44Gf44KB44CB5LiA5pmC55qE44Gr55u05o6l6Kit5a6aXG5pbXBvcnQgeyBDb21wbGlhbmNlUmVndWxhdGlvbiB9IGZyb20gJy4uLy4uL3R5cGVzL2dsb2JhbC1jb25maWcnO1xuaW1wb3J0IHsgXG4gIE1hcmtpdGRvd25Db25maWcsIFxuICBERUZBVUxUX01BUktJVERPV05fQ09ORklHLCBcbiAgRW52aXJvbm1lbnRNYXJraXRkb3duQ29uZmlnLFxuICBTdXBwb3J0ZWRGaWxlRm9ybWF0LFxuICBQcm9jZXNzaW5nU3RyYXRlZ3lcbn0gZnJvbSAnLi4vLi4vdHlwZXMvbWFya2l0ZG93bi1jb25maWcnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuLyoqXG4gKiBNYXJraXRkb3du6Kit5a6a44KS6Kqt44G/6L6844KAXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsb2FkTWFya2l0ZG93bkNvbmZpZyhlbnZpcm9ubWVudD86IHN0cmluZyk6IE1hcmtpdGRvd25Db25maWcge1xuICB0cnkge1xuICAgIC8vIOODoeOCpOODs+ioreWumuODleOCoeOCpOODq+OCkuiqreOBv+i+vOOBv1xuICAgIGNvbnN0IGNvbmZpZ1BhdGggPSBwYXRoLmpvaW4oX19kaXJuYW1lLCAnbWFya2l0ZG93bi1jb25maWcuanNvbicpO1xuICAgIGNvbnN0IGNvbmZpZ0RhdGEgPSBmcy5yZWFkRmlsZVN5bmMoY29uZmlnUGF0aCwgJ3V0ZjgnKTtcbiAgICBjb25zdCBjb25maWcgPSBKU09OLnBhcnNlKGNvbmZpZ0RhdGEpO1xuICAgIFxuICAgIGxldCBtYXJraXRkb3duQ29uZmlnOiBNYXJraXRkb3duQ29uZmlnID0gY29uZmlnLm1hcmtpdGRvd24gfHwgREVGQVVMVF9NQVJLSVRET1dOX0NPTkZJRztcbiAgICBcbiAgICAvLyDnkrDlooPliKXoqK3lrprjgqrjg7zjg5Djg7zjg6njgqTjg4njgpLpgannlKhcbiAgICBpZiAoZW52aXJvbm1lbnQpIHtcbiAgICAgIGNvbnN0IGVudmlyb25tZW50T3ZlcnJpZGVzID0gbG9hZEVudmlyb25tZW50TWFya2l0ZG93bk92ZXJyaWRlcygpO1xuICAgICAgY29uc3QgZW52Q29uZmlnID0gZW52aXJvbm1lbnRPdmVycmlkZXNbZW52aXJvbm1lbnQgYXMga2V5b2YgRW52aXJvbm1lbnRNYXJraXRkb3duQ29uZmlnXTtcbiAgICAgIGlmIChlbnZDb25maWcpIHtcbiAgICAgICAgbWFya2l0ZG93bkNvbmZpZyA9IG1lcmdlTWFya2l0ZG93bkNvbmZpZyhtYXJraXRkb3duQ29uZmlnLCBlbnZDb25maWcpO1xuICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBjb25zb2xlLmxvZyhg4pyFIE1hcmtpdGRvd27oqK3lrprjgpLoqq3jgb/ovrzjgb/jgb7jgZfjgZ8gKOeSsOWigzogJHtlbnZpcm9ubWVudCB8fCAnZGVmYXVsdCd9KWApO1xuICAgIHJldHVybiBtYXJraXRkb3duQ29uZmlnO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUud2Fybihg4pqg77iPIE1hcmtpdGRvd27oqK3lrprjga7oqq3jgb/ovrzjgb/jgavlpLHmlZfjgZfjgb7jgZfjgZ86ICR7ZXJyb3J9YCk7XG4gICAgY29uc29sZS5sb2coJ+ODh+ODleOCqeODq+ODiOioreWumuOCkuS9v+eUqOOBl+OBvuOBmScpO1xuICAgIHJldHVybiBERUZBVUxUX01BUktJVERPV05fQ09ORklHO1xuICB9XG59XG5cbi8qKlxuICog55Kw5aKD5YilTWFya2l0ZG93buioreWumuOCquODvOODkOODvOODqeOCpOODieOCkuiqreOBv+i+vOOCgFxuICovXG5mdW5jdGlvbiBsb2FkRW52aXJvbm1lbnRNYXJraXRkb3duT3ZlcnJpZGVzKCk6IEVudmlyb25tZW50TWFya2l0ZG93bkNvbmZpZyB7XG4gIHRyeSB7XG4gICAgY29uc3Qgb3ZlcnJpZGVQYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJ2Vudmlyb25tZW50cycsICdtYXJraXRkb3duLW92ZXJyaWRlcy5qc29uJyk7XG4gICAgaWYgKGZzLmV4aXN0c1N5bmMob3ZlcnJpZGVQYXRoKSkge1xuICAgICAgY29uc3Qgb3ZlcnJpZGVEYXRhID0gZnMucmVhZEZpbGVTeW5jKG92ZXJyaWRlUGF0aCwgJ3V0ZjgnKTtcbiAgICAgIHJldHVybiBKU09OLnBhcnNlKG92ZXJyaWRlRGF0YSk7XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUud2Fybihg4pqg77iPIOeSsOWig+WIpU1hcmtpdGRvd27oqK3lrprjgqrjg7zjg5Djg7zjg6njgqTjg4njga7oqq3jgb/ovrzjgb/jgavlpLHmlZc6ICR7ZXJyb3J9YCk7XG4gIH1cbiAgcmV0dXJuIHt9O1xufVxuXG4vKipcbiAqIE1hcmtpdGRvd27oqK3lrprjgpLjg57jg7zjgrjjgZnjgotcbiAqL1xuZnVuY3Rpb24gbWVyZ2VNYXJraXRkb3duQ29uZmlnKFxuICBiYXNlQ29uZmlnOiBNYXJraXRkb3duQ29uZmlnLCBcbiAgb3ZlcnJpZGU6IFBhcnRpYWw8TWFya2l0ZG93bkNvbmZpZz5cbik6IE1hcmtpdGRvd25Db25maWcge1xuICByZXR1cm4ge1xuICAgIC4uLmJhc2VDb25maWcsXG4gICAgLi4ub3ZlcnJpZGUsXG4gICAgc3VwcG9ydGVkRm9ybWF0czoge1xuICAgICAgLi4uYmFzZUNvbmZpZy5zdXBwb3J0ZWRGb3JtYXRzLFxuICAgICAgLi4uKG92ZXJyaWRlLnN1cHBvcnRlZEZvcm1hdHMgfHwge30pXG4gICAgfSxcbiAgICBwZXJmb3JtYW5jZToge1xuICAgICAgLi4uYmFzZUNvbmZpZy5wZXJmb3JtYW5jZSxcbiAgICAgIC4uLihvdmVycmlkZS5wZXJmb3JtYW5jZSB8fCB7fSlcbiAgICB9LFxuICAgIGZhbGxiYWNrOiB7XG4gICAgICAuLi5iYXNlQ29uZmlnLmZhbGxiYWNrLFxuICAgICAgLi4uKG92ZXJyaWRlLmZhbGxiYWNrIHx8IHt9KVxuICAgIH0sXG4gICAgc2VjdXJpdHk6IHtcbiAgICAgIC4uLmJhc2VDb25maWcuc2VjdXJpdHksXG4gICAgICAuLi4ob3ZlcnJpZGUuc2VjdXJpdHkgfHwge30pXG4gICAgfSxcbiAgICBsb2dnaW5nOiB7XG4gICAgICAuLi5iYXNlQ29uZmlnLmxvZ2dpbmcsXG4gICAgICAuLi4ob3ZlcnJpZGUubG9nZ2luZyB8fCB7fSlcbiAgICB9LFxuICAgIHF1YWxpdHk6IHtcbiAgICAgIC4uLmJhc2VDb25maWcucXVhbGl0eSxcbiAgICAgIC4uLihvdmVycmlkZS5xdWFsaXR5IHx8IHt9KVxuICAgIH1cbiAgfTtcbn1cblxuLyoqXG4gKiDnkrDlooPliKXoqK3lrprjgpLoqq3jgb/ovrzjgoBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGxvYWRFbnZpcm9ubWVudENvbmZpZyhcbiAgZW52aXJvbm1lbnQ6IHN0cmluZyxcbiAgcmVnaW9uOiBzdHJpbmcsXG4gIHByb2plY3ROYW1lOiBzdHJpbmdcbik6IEdsb2JhbFJhZ0NvbmZpZyB7XG4gIGNvbnNvbGUubG9nKGDwn5OLIExvYWRpbmcgY29uZmlndXJhdGlvbiBmb3IgJHtlbnZpcm9ubWVudH0gZW52aXJvbm1lbnQgaW4gJHtyZWdpb259YCk7XG5cbiAgLy8g5Zyw5Z+f5Yil44Gu44OZ44O844K56Kit5a6a44KS5Y+W5b6XXG4gIGxldCBiYXNlQ29uZmlnOiBHbG9iYWxSYWdDb25maWc7XG5cbiAgc3dpdGNoIChyZWdpb24pIHtcbiAgICBjYXNlICdhcC1ub3J0aGVhc3QtMSc6IC8vIOadseS6rFxuICAgIGNhc2UgJ2FwLW5vcnRoZWFzdC0zJzogLy8g5aSn6ZiqXG4gICAgICBiYXNlQ29uZmlnID0gdG9reW9Db25maWc7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdldS1jZW50cmFsLTEnOiAvLyDjg5Xjg6njg7Pjgq/jg5Xjg6vjg4hcbiAgICBjYXNlICdldS13ZXN0LTEnOiAvLyDjgqLjgqTjg6vjg6njg7Pjg4lcbiAgICBjYXNlICdldS13ZXN0LTInOiAvLyDjg63jg7Pjg4njg7NcbiAgICBjYXNlICdldS13ZXN0LTMnOiAvLyDjg5Hjg6pcbiAgICAgIGJhc2VDb25maWcgPSBmcmFua2Z1cnRDb25maWc7XG4gICAgICBicmVhaztcbiAgICBjYXNlICd1cy1lYXN0LTEnOiAvLyDjg5Djg7zjgrjjg4vjgqJcbiAgICBjYXNlICd1cy1lYXN0LTInOiAvLyDjgqrjg4/jgqTjgqpcbiAgICBjYXNlICd1cy13ZXN0LTInOiAvLyDjgqrjg6zjgrTjg7NcbiAgICAgIGJhc2VDb25maWcgPSB2aXJnaW5pYUNvbmZpZztcbiAgICAgIGJyZWFrO1xuICAgIGRlZmF1bHQ6XG4gICAgICBjb25zb2xlLndhcm4oYOKaoO+4jyBVbmtub3duIHJlZ2lvbiAke3JlZ2lvbn0sIHVzaW5nIFRva3lvIGNvbmZpZyBhcyBkZWZhdWx0YCk7XG4gICAgICBiYXNlQ29uZmlnID0gdG9reW9Db25maWc7XG4gIH1cblxuICAvLyBNYXJraXRkb3du6Kit5a6a44KS6Kqt44G/6L6844G/XG4gIGNvbnN0IG1hcmtpdGRvd25Db25maWcgPSBsb2FkTWFya2l0ZG93bkNvbmZpZyhlbnZpcm9ubWVudCk7XG4gIFxuICAvLyDnkrDlooPlm7rmnInjga7oqr/mlbRcbiAgY29uc3QgY29uZmlnOiBHbG9iYWxSYWdDb25maWcgPSB7XG4gICAgLi4uYmFzZUNvbmZpZyxcbiAgICBwcm9qZWN0TmFtZSxcbiAgICBlbnZpcm9ubWVudDogZW52aXJvbm1lbnQgYXMgJ2RldicgfCAnc3RhZ2luZycgfCAncHJvZCcsXG4gICAgcmVnaW9uLFxuICAgIC8vIOeSsOWig+WIpeOBruapn+iDveiqv+aVtFxuICAgIGZlYXR1cmVzOiBhZGp1c3RGZWF0dXJlc0ZvckVudmlyb25tZW50KGJhc2VDb25maWcuZmVhdHVyZXMsIGVudmlyb25tZW50LCBtYXJraXRkb3duQ29uZmlnKSxcbiAgICAvLyDjgrPjg7Pjg5fjg6njgqTjgqLjg7PjgrnoqK3lrprjga7oh6rli5Xjg57jg4Pjg5Tjg7PjgrBcbiAgICBjb21wbGlhbmNlOiB7XG4gICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgcmVndWxhdGlvbnM6IGdldENvbXBsaWFuY2VGb3JSZWdpb24ocmVnaW9uKSxcbiAgICAgIGRhdGFQcm90ZWN0aW9uOiB7XG4gICAgICAgIGVuY3J5cHRpb25BdFJlc3Q6IHRydWUsXG4gICAgICAgIGVuY3J5cHRpb25JblRyYW5zaXQ6IHRydWUsXG4gICAgICAgIGRhdGFDbGFzc2lmaWNhdGlvbjogdHJ1ZSxcbiAgICAgICAgYWNjZXNzTG9nZ2luZzogdHJ1ZSxcbiAgICAgICAgZGF0YVJldGVudGlvbjoge1xuICAgICAgICAgIGRlZmF1bHRSZXRlbnRpb25EYXlzOiAzNjUsXG4gICAgICAgICAgcGVyc29uYWxEYXRhUmV0ZW50aW9uRGF5czogMzY1LFxuICAgICAgICAgIGxvZ1JldGVudGlvbkRheXM6IDM2NSxcbiAgICAgICAgICBiYWNrdXBSZXRlbnRpb25EYXlzOiAzNjVcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGF1ZGl0TG9nZ2luZzogdHJ1ZVxuICAgIH1cbiAgfTtcblxuICAvLyDnkrDlooPliKXjga7ov73liqDoqr/mlbRcbiAgaWYgKGVudmlyb25tZW50ID09PSAnZGV2Jykge1xuICAgIC8vIOmWi+eZuueSsOWig+OBp+OBr+S4gOmDqOapn+iDveOCkueEoeWKueWMluOBl+OBpuOCs+OCueODiOOCkuWJiua4m1xuICAgIGNvbmZpZy5mZWF0dXJlcy5tb25pdG9yaW5nLnhyYXkgPSBmYWxzZTtcbiAgICBjb25maWcuZmVhdHVyZXMuc3RvcmFnZS5iYWNrdXAgPSBmYWxzZTtcbiAgICBjb25maWcuZmVhdHVyZXMuZW50ZXJwcmlzZS5tdWx0aVRlbmFudCA9IGZhbHNlO1xuICAgIGNvbmZpZy5mZWF0dXJlcy5lbnRlcnByaXNlLmJpbGxpbmcgPSBmYWxzZTtcbiAgfSBlbHNlIGlmIChlbnZpcm9ubWVudCA9PT0gJ3Byb2QnKSB7XG4gICAgLy8g5pys55Wq55Kw5aKD44Gn44Gv5YWo5qmf6IO944KS5pyJ5Yq55YyWXG4gICAgY29uZmlnLmZlYXR1cmVzLm1vbml0b3JpbmcueHJheSA9IHRydWU7XG4gICAgY29uZmlnLmZlYXR1cmVzLnN0b3JhZ2UuYmFja3VwID0gdHJ1ZTtcbiAgICBjb25maWcuZmVhdHVyZXMuZW50ZXJwcmlzZS5tdWx0aVRlbmFudCA9IHRydWU7XG4gICAgY29uZmlnLmZlYXR1cmVzLmVudGVycHJpc2UuYmlsbGluZyA9IHRydWU7XG4gIH1cblxuICBjb25zb2xlLmxvZyhg4pyFIENvbmZpZ3VyYXRpb24gbG9hZGVkIHN1Y2Nlc3NmdWxseWApO1xuICBjb25zb2xlLmxvZyhgICAgUHJvamVjdDogJHtjb25maWcucHJvamVjdE5hbWV9YCk7XG4gIGNvbnNvbGUubG9nKGAgICBFbnZpcm9ubWVudDogJHtjb25maWcuZW52aXJvbm1lbnR9YCk7XG4gIGNvbnNvbGUubG9nKGAgICBSZWdpb246ICR7Y29uZmlnLnJlZ2lvbn1gKTtcbiAgY29uc29sZS5sb2coYCAgIENvbXBsaWFuY2U6ICR7Y29uZmlnLmNvbXBsaWFuY2UucmVndWxhdGlvbnMuam9pbignLCAnKX1gKTtcblxuICByZXR1cm4gY29uZmlnO1xufVxuXG4vKipcbiAqIOeSsOWig+OBq+W/nOOBmOOBn+apn+iDveioreWumuOBruiqv+aVtFxuICovXG5mdW5jdGlvbiBhZGp1c3RGZWF0dXJlc0ZvckVudmlyb25tZW50KFxuICBiYXNlRmVhdHVyZXM6IEdsb2JhbFJhZ0NvbmZpZ1snZmVhdHVyZXMnXSxcbiAgZW52aXJvbm1lbnQ6IHN0cmluZyxcbiAgbWFya2l0ZG93bkNvbmZpZz86IE1hcmtpdGRvd25Db25maWdcbik6IEdsb2JhbFJhZ0NvbmZpZ1snZmVhdHVyZXMnXSB7XG4gIGNvbnN0IGZlYXR1cmVzID0geyAuLi5iYXNlRmVhdHVyZXMgfTtcblxuICAvLyBNYXJraXRkb3du6Kit5a6a44KS57Wx5ZCIXG4gIGlmIChtYXJraXRkb3duQ29uZmlnKSB7XG4gICAgZmVhdHVyZXMuYWkgPSB7XG4gICAgICAuLi5mZWF0dXJlcy5haSxcbiAgICAgIG1hcmtpdGRvd246IG1hcmtpdGRvd25Db25maWcuZW5hYmxlZCxcbiAgICAgIGNvbmZpZzogbWFya2l0ZG93bkNvbmZpZ1xuICAgIH07XG4gIH1cblxuICBzd2l0Y2ggKGVudmlyb25tZW50KSB7XG4gICAgY2FzZSAnZGV2JzpcbiAgICAgIC8vIOmWi+eZuueSsOWigzog5Z+65pys5qmf6IO944Gu44G/XG4gICAgICBmZWF0dXJlcy5uZXR3b3JraW5nLmxvYWRCYWxhbmNlciA9IGZhbHNlO1xuICAgICAgZmVhdHVyZXMubmV0d29ya2luZy5jZG4gPSBmYWxzZTtcbiAgICAgIGZlYXR1cmVzLnNlY3VyaXR5LndhZiA9IGZhbHNlO1xuICAgICAgZmVhdHVyZXMuc3RvcmFnZS5iYWNrdXAgPSBmYWxzZTtcbiAgICAgIGZlYXR1cmVzLnN0b3JhZ2UubGlmZWN5Y2xlID0gZmFsc2U7XG4gICAgICBmZWF0dXJlcy5kYXRhYmFzZS5yZHMgPSBmYWxzZTtcbiAgICAgIGZlYXR1cmVzLmNvbXB1dGUuZWNzID0gZmFsc2U7XG4gICAgICBmZWF0dXJlcy5jb21wdXRlLnNjYWxpbmcgPSBmYWxzZTtcbiAgICAgIGZlYXR1cmVzLmFwaS5ncmFwaHFsID0gZmFsc2U7XG4gICAgICBmZWF0dXJlcy5hcGkud2Vic29ja2V0ID0gZmFsc2U7XG4gICAgICBmZWF0dXJlcy5tb25pdG9yaW5nLnhyYXkgPSBmYWxzZTtcbiAgICAgIGZlYXR1cmVzLm1vbml0b3JpbmcuYWxhcm1zID0gZmFsc2U7XG4gICAgICBmZWF0dXJlcy5lbnRlcnByaXNlLm11bHRpVGVuYW50ID0gZmFsc2U7XG4gICAgICBmZWF0dXJlcy5lbnRlcnByaXNlLmJpbGxpbmcgPSBmYWxzZTtcbiAgICAgIGZlYXR1cmVzLmVudGVycHJpc2UuY29tcGxpYW5jZSA9IGZhbHNlO1xuICAgICAgZmVhdHVyZXMuZW50ZXJwcmlzZS5nb3Zlcm5hbmNlID0gZmFsc2U7XG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ3N0YWdpbmcnOlxuICAgICAgLy8g44K544OG44O844K444Oz44Kw55Kw5aKDOiDmnKznlarlkIznrYnvvIjjgqjjg7Pjgr/jg7zjg5fjg6njgqTjgrrmqZ/og73pmaTjgY/vvIlcbiAgICAgIGZlYXR1cmVzLm5ldHdvcmtpbmcubG9hZEJhbGFuY2VyID0gdHJ1ZTtcbiAgICAgIGZlYXR1cmVzLm5ldHdvcmtpbmcuY2RuID0gdHJ1ZTtcbiAgICAgIGZlYXR1cmVzLnNlY3VyaXR5LndhZiA9IHRydWU7XG4gICAgICBmZWF0dXJlcy5zdG9yYWdlLmJhY2t1cCA9IHRydWU7XG4gICAgICBmZWF0dXJlcy5zdG9yYWdlLmxpZmVjeWNsZSA9IHRydWU7XG4gICAgICBmZWF0dXJlcy5kYXRhYmFzZS5yZHMgPSBmYWxzZTsgLy8g44Kq44OX44K344On44OzXG4gICAgICBmZWF0dXJlcy5jb21wdXRlLmVjcyA9IGZhbHNlOyAvLyDjgqrjg5fjgrfjg6fjg7NcbiAgICAgIGZlYXR1cmVzLmNvbXB1dGUuc2NhbGluZyA9IHRydWU7XG4gICAgICBmZWF0dXJlcy5hcGkuZ3JhcGhxbCA9IGZhbHNlOyAvLyDjgqrjg5fjgrfjg6fjg7NcbiAgICAgIGZlYXR1cmVzLmFwaS53ZWJzb2NrZXQgPSBmYWxzZTsgLy8g44Kq44OX44K344On44OzXG4gICAgICBmZWF0dXJlcy5tb25pdG9yaW5nLnhyYXkgPSB0cnVlO1xuICAgICAgZmVhdHVyZXMubW9uaXRvcmluZy5hbGFybXMgPSB0cnVlO1xuICAgICAgZmVhdHVyZXMuZW50ZXJwcmlzZS5tdWx0aVRlbmFudCA9IGZhbHNlO1xuICAgICAgZmVhdHVyZXMuZW50ZXJwcmlzZS5iaWxsaW5nID0gZmFsc2U7XG4gICAgICBmZWF0dXJlcy5lbnRlcnByaXNlLmNvbXBsaWFuY2UgPSB0cnVlO1xuICAgICAgZmVhdHVyZXMuZW50ZXJwcmlzZS5nb3Zlcm5hbmNlID0gdHJ1ZTtcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAncHJvZCc6XG4gICAgICAvLyDmnKznlarnkrDlooM6IOWFqOapn+iDveacieWKuVxuICAgICAgZmVhdHVyZXMubmV0d29ya2luZy5sb2FkQmFsYW5jZXIgPSB0cnVlO1xuICAgICAgZmVhdHVyZXMubmV0d29ya2luZy5jZG4gPSB0cnVlO1xuICAgICAgZmVhdHVyZXMuc2VjdXJpdHkud2FmID0gdHJ1ZTtcbiAgICAgIGZlYXR1cmVzLnN0b3JhZ2UuYmFja3VwID0gdHJ1ZTtcbiAgICAgIGZlYXR1cmVzLnN0b3JhZ2UubGlmZWN5Y2xlID0gdHJ1ZTtcbiAgICAgIGZlYXR1cmVzLmRhdGFiYXNlLnJkcyA9IHRydWU7XG4gICAgICBmZWF0dXJlcy5jb21wdXRlLmVjcyA9IHRydWU7XG4gICAgICBmZWF0dXJlcy5jb21wdXRlLnNjYWxpbmcgPSB0cnVlO1xuICAgICAgZmVhdHVyZXMuYXBpLmdyYXBocWwgPSB0cnVlO1xuICAgICAgZmVhdHVyZXMuYXBpLndlYnNvY2tldCA9IHRydWU7XG4gICAgICBmZWF0dXJlcy5tb25pdG9yaW5nLnhyYXkgPSB0cnVlO1xuICAgICAgZmVhdHVyZXMubW9uaXRvcmluZy5hbGFybXMgPSB0cnVlO1xuICAgICAgZmVhdHVyZXMuZW50ZXJwcmlzZS5tdWx0aVRlbmFudCA9IHRydWU7XG4gICAgICBmZWF0dXJlcy5lbnRlcnByaXNlLmJpbGxpbmcgPSB0cnVlO1xuICAgICAgZmVhdHVyZXMuZW50ZXJwcmlzZS5jb21wbGlhbmNlID0gdHJ1ZTtcbiAgICAgIGZlYXR1cmVzLmVudGVycHJpc2UuZ292ZXJuYW5jZSA9IHRydWU7XG4gICAgICBicmVhaztcblxuICAgIGRlZmF1bHQ6XG4gICAgICBjb25zb2xlLndhcm4oYOKaoO+4jyBVbmtub3duIGVudmlyb25tZW50ICR7ZW52aXJvbm1lbnR9LCB1c2luZyBkZWZhdWx0IHNldHRpbmdzYCk7XG4gIH1cblxuICByZXR1cm4gZmVhdHVyZXM7XG59XG5cbi8qKlxuICogTWFya2l0ZG93buioreWumuOCkuaknOiovOOBmeOCi1xuICovXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVNYXJraXRkb3duQ29uZmlnKGNvbmZpZzogTWFya2l0ZG93bkNvbmZpZyk6IGJvb2xlYW4ge1xuICB0cnkge1xuICAgIC8vIOWfuuacrOioreWumuOBruaknOiovFxuICAgIGlmICh0eXBlb2YgY29uZmlnLmVuYWJsZWQgIT09ICdib29sZWFuJykge1xuICAgICAgY29uc29sZS5lcnJvcign4p2MIE1hcmtpdGRvd27oqK3lrprjgqjjg6njg7w6IGVuYWJsZWQg44GvIGJvb2xlYW4g44Gn44GC44KL5b+F6KaB44GM44GC44KK44G+44GZJyk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8g44K144Od44O844OI44GV44KM44KL44OV44Kh44Kk44Or5b2i5byP44Gu5qSc6Ki8XG4gICAgaWYgKCFjb25maWcuc3VwcG9ydGVkRm9ybWF0cyB8fCB0eXBlb2YgY29uZmlnLnN1cHBvcnRlZEZvcm1hdHMgIT09ICdvYmplY3QnKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCfinYwgTWFya2l0ZG93buioreWumuOCqOODqeODvDogc3VwcG9ydGVkRm9ybWF0cyDjgYzmraPjgZfjgY/oqK3lrprjgZXjgozjgabjgYTjgb7jgZvjgpMnKTtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyDjg5Hjg5Xjgqnjg7zjg57jg7PjgrnoqK3lrprjga7mpJzoqLxcbiAgICBpZiAoY29uZmlnLnBlcmZvcm1hbmNlLm1heEZpbGVTaXplQnl0ZXMgPD0gMCkge1xuICAgICAgY29uc29sZS5lcnJvcign4p2MIE1hcmtpdGRvd27oqK3lrprjgqjjg6njg7w6IG1heEZpbGVTaXplQnl0ZXMg44Gv5q2j44Gu5pWw44Gn44GC44KL5b+F6KaB44GM44GC44KK44G+44GZJyk7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKGNvbmZpZy5wZXJmb3JtYW5jZS5tZW1vcnlMaW1pdE1CIDw9IDApIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ+KdjCBNYXJraXRkb3du6Kit5a6a44Ko44Op44O8OiBtZW1vcnlMaW1pdE1CIOOBr+ato+OBruaVsOOBp+OBguOCi+W/heimgeOBjOOBguOCiuOBvuOBmScpO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIOOCv+OCpOODoOOCouOCpuODiOioreWumuOBruaknOiovFxuICAgIGZvciAoY29uc3QgW2Zvcm1hdCwgZm9ybWF0Q29uZmlnXSBvZiBPYmplY3QuZW50cmllcyhjb25maWcuc3VwcG9ydGVkRm9ybWF0cykpIHtcbiAgICAgIGlmIChmb3JtYXRDb25maWcudGltZW91dCA8PSAwKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYOKdjCBNYXJraXRkb3du6Kit5a6a44Ko44Op44O8OiAke2Zvcm1hdH0g44Gu44K/44Kk44Og44Ki44Km44OI5YCk44GM54Sh5Yq544Gn44GZYCk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zb2xlLmxvZygn4pyFIE1hcmtpdGRvd27oqK3lrprjga7mpJzoqLzjgYzlrozkuobjgZfjgb7jgZfjgZ8nKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKGDinYwgTWFya2l0ZG93buioreWumuOBruaknOiovOS4reOBq+OCqOODqeODvOOBjOeZuueUn+OBl+OBvuOBl+OBnzogJHtlcnJvcn1gKTtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuLyoqXG4gKiDlnLDln5/liKXjga7jgrPjg7Pjg5fjg6njgqTjgqLjg7Pjgrnopo/liLbjgpLlj5blvpfjgZnjgovvvIjkuIDmmYLnmoTjgarlrp/oo4XvvIlcbiAqL1xuZnVuY3Rpb24gZ2V0Q29tcGxpYW5jZUZvclJlZ2lvbihyZWdpb246IHN0cmluZyk6IENvbXBsaWFuY2VSZWd1bGF0aW9uW10ge1xuICBzd2l0Y2ggKHJlZ2lvbikge1xuICAgIGNhc2UgJ2FwLW5vcnRoZWFzdC0xJzogLy8g5p2x5LqsXG4gICAgY2FzZSAnYXAtbm9ydGhlYXN0LTMnOiAvLyDlpKfpmKpcbiAgICAgIHJldHVybiBbJ0ZJU0MnXTtcbiAgICBjYXNlICdldS1jZW50cmFsLTEnOiAvLyDjg5Xjg6njg7Pjgq/jg5Xjg6vjg4hcbiAgICBjYXNlICdldS13ZXN0LTEnOiAvLyDjgqLjgqTjg6vjg6njg7Pjg4lcbiAgICBjYXNlICdldS13ZXN0LTInOiAvLyDjg63jg7Pjg4njg7NcbiAgICBjYXNlICdldS13ZXN0LTMnOiAvLyDjg5Hjg6pcbiAgICAgIHJldHVybiBbJ0dEUFInXTtcbiAgICBjYXNlICd1cy1lYXN0LTEnOiAvLyDjg5Djg7zjgrjjg4vjgqJcbiAgICBjYXNlICd1cy1lYXN0LTInOiAvLyDjgqrjg4/jgqTjgqpcbiAgICBjYXNlICd1cy13ZXN0LTInOiAvLyDjgqrjg6zjgrTjg7NcbiAgICAgIHJldHVybiBbJ1NPWCcsICdISVBBQSddO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gWydHRFBSJ107IC8vIOODh+ODleOCqeODq+ODiOOBr0dEUFJcbiAgfVxufVxuXG4vKipcbiAqIOODleOCoeOCpOODq+W9ouW8j+OBruWHpueQhuaWueazleOCkuWLleeahOOBq+WkieabtOOBmeOCi1xuICovXG5leHBvcnQgZnVuY3Rpb24gdXBkYXRlUHJvY2Vzc2luZ1N0cmF0ZWd5KFxuICBjb25maWc6IE1hcmtpdGRvd25Db25maWcsXG4gIGZvcm1hdDogU3VwcG9ydGVkRmlsZUZvcm1hdCxcbiAgc3RyYXRlZ3k6IFByb2Nlc3NpbmdTdHJhdGVneVxuKTogTWFya2l0ZG93bkNvbmZpZyB7XG4gIGNvbnN0IHVwZGF0ZWRDb25maWcgPSB7IC4uLmNvbmZpZyB9O1xuICBcbiAgaWYgKHVwZGF0ZWRDb25maWcuc3VwcG9ydGVkRm9ybWF0c1tmb3JtYXRdKSB7XG4gICAgdXBkYXRlZENvbmZpZy5zdXBwb3J0ZWRGb3JtYXRzW2Zvcm1hdF0gPSB7XG4gICAgICAuLi51cGRhdGVkQ29uZmlnLnN1cHBvcnRlZEZvcm1hdHNbZm9ybWF0XSxcbiAgICAgIHByb2Nlc3NpbmdTdHJhdGVneTogc3RyYXRlZ3ksXG4gICAgICB1c2VNYXJraXRkb3duOiBzaG91bGRFbmFibGVNYXJraXRkb3duKHN0cmF0ZWd5KSxcbiAgICAgIHVzZUxhbmdDaGFpbjogc2hvdWxkRW5hYmxlTGFuZ0NoYWluKHN0cmF0ZWd5KSxcbiAgICAgIGVuYWJsZVF1YWxpdHlDb21wYXJpc29uOiBzdHJhdGVneSA9PT0gJ2JvdGgtY29tcGFyZSdcbiAgICB9O1xuICAgIFxuICAgIGNvbnNvbGUubG9nKGDinIUgJHtmb3JtYXR944Gu5Yem55CG5oim55Wl44KSJHtzdHJhdGVneX3jgavlpInmm7TjgZfjgb7jgZfjgZ9gKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zb2xlLndhcm4oYOKaoO+4jyDjgrXjg53jg7zjg4jjgZXjgozjgabjgYTjgarjgYTjg5XjgqHjgqTjg6vlvaLlvI86ICR7Zm9ybWF0fWApO1xuICB9XG4gIFxuICByZXR1cm4gdXBkYXRlZENvbmZpZztcbn1cblxuLyoqXG4gKiDlh6bnkIbmiKbnlaXjgavln7rjgaXjgYTjgaZNYXJraXRkb3du44KS5pyJ5Yq544Gr44GZ44KL44GL44KS5rG65a6aXG4gKi9cbmZ1bmN0aW9uIHNob3VsZEVuYWJsZU1hcmtpdGRvd24oc3RyYXRlZ3k6IFByb2Nlc3NpbmdTdHJhdGVneSk6IGJvb2xlYW4ge1xuICByZXR1cm4gWydtYXJraXRkb3duLW9ubHknLCAnbWFya2l0ZG93bi1maXJzdCcsICdib3RoLWNvbXBhcmUnLCAnYXV0by1zZWxlY3QnXS5pbmNsdWRlcyhzdHJhdGVneSk7XG59XG5cbi8qKlxuICog5Yem55CG5oim55Wl44Gr5Z+644Gl44GE44GmTGFuZ0NoYWlu44KS5pyJ5Yq544Gr44GZ44KL44GL44KS5rG65a6aXG4gKi9cbmZ1bmN0aW9uIHNob3VsZEVuYWJsZUxhbmdDaGFpbihzdHJhdGVneTogUHJvY2Vzc2luZ1N0cmF0ZWd5KTogYm9vbGVhbiB7XG4gIHJldHVybiBbJ2xhbmdjaGFpbi1vbmx5JywgJ2xhbmdjaGFpbi1maXJzdCcsICdib3RoLWNvbXBhcmUnLCAnYXV0by1zZWxlY3QnXS5pbmNsdWRlcyhzdHJhdGVneSk7XG59XG5cbi8qKlxuICog6KSH5pWw44Gu44OV44Kh44Kk44Or5b2i5byP44Gu5Yem55CG5pa55rOV44KS5LiA5ous5aSJ5pu0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1cGRhdGVNdWx0aXBsZVByb2Nlc3NpbmdTdHJhdGVnaWVzKFxuICBjb25maWc6IE1hcmtpdGRvd25Db25maWcsXG4gIHVwZGF0ZXM6IFJlY29yZDxTdXBwb3J0ZWRGaWxlRm9ybWF0LCBQcm9jZXNzaW5nU3RyYXRlZ3k+XG4pOiBNYXJraXRkb3duQ29uZmlnIHtcbiAgbGV0IHVwZGF0ZWRDb25maWcgPSB7IC4uLmNvbmZpZyB9O1xuICBcbiAgZm9yIChjb25zdCBbZm9ybWF0LCBzdHJhdGVneV0gb2YgT2JqZWN0LmVudHJpZXModXBkYXRlcykgYXMgW1N1cHBvcnRlZEZpbGVGb3JtYXQsIFByb2Nlc3NpbmdTdHJhdGVneV1bXSkge1xuICAgIHVwZGF0ZWRDb25maWcgPSB1cGRhdGVQcm9jZXNzaW5nU3RyYXRlZ3kodXBkYXRlZENvbmZpZywgZm9ybWF0LCBzdHJhdGVneSk7XG4gIH1cbiAgXG4gIGNvbnNvbGUubG9nKGDinIUgJHtPYmplY3Qua2V5cyh1cGRhdGVzKS5sZW5ndGh95YCL44Gu44OV44Kh44Kk44Or5b2i5byP44Gu5Yem55CG5oim55Wl44KS5pu05paw44GX44G+44GX44GfYCk7XG4gIHJldHVybiB1cGRhdGVkQ29uZmlnO1xufVxuXG4vKipcbiAqIOWHpueQhuaWueazleOBruS9v+eUqOeKtuazgeODrOODneODvOODiOOCkueUn+aIkFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVQcm9jZXNzaW5nTWV0aG9kUmVwb3J0KGNvbmZpZzogTWFya2l0ZG93bkNvbmZpZyk6IHtcbiAgc3VtbWFyeToge1xuICAgIHRvdGFsRm9ybWF0czogbnVtYmVyO1xuICAgIG1hcmtpdGRvd25Pbmx5Rm9ybWF0czogbnVtYmVyO1xuICAgIGxhbmdjaGFpbk9ubHlGb3JtYXRzOiBudW1iZXI7XG4gICAgaHlicmlkRm9ybWF0czogbnVtYmVyO1xuICAgIHF1YWxpdHlDb21wYXJpc29uRm9ybWF0czogbnVtYmVyO1xuICB9O1xuICBkZXRhaWxzOiBBcnJheTx7XG4gICAgZm9ybWF0OiBTdXBwb3J0ZWRGaWxlRm9ybWF0O1xuICAgIHN0cmF0ZWd5OiBQcm9jZXNzaW5nU3RyYXRlZ3k7XG4gICAgdXNlTWFya2l0ZG93bjogYm9vbGVhbjtcbiAgICB1c2VMYW5nQ2hhaW46IGJvb2xlYW47XG4gICAgcXVhbGl0eUNvbXBhcmlzb246IGJvb2xlYW47XG4gIH0+O1xufSB7XG4gIGNvbnN0IGRldGFpbHMgPSBPYmplY3QuZW50cmllcyhjb25maWcuc3VwcG9ydGVkRm9ybWF0cykubWFwKChbZm9ybWF0LCBmb3JtYXRDb25maWddKSA9PiAoe1xuICAgIGZvcm1hdDogZm9ybWF0IGFzIFN1cHBvcnRlZEZpbGVGb3JtYXQsXG4gICAgc3RyYXRlZ3k6IGZvcm1hdENvbmZpZy5wcm9jZXNzaW5nU3RyYXRlZ3ksXG4gICAgdXNlTWFya2l0ZG93bjogZm9ybWF0Q29uZmlnLnVzZU1hcmtpdGRvd24sXG4gICAgdXNlTGFuZ0NoYWluOiBmb3JtYXRDb25maWcudXNlTGFuZ0NoYWluLFxuICAgIHF1YWxpdHlDb21wYXJpc29uOiBmb3JtYXRDb25maWcuZW5hYmxlUXVhbGl0eUNvbXBhcmlzb24gfHwgZmFsc2VcbiAgfSkpO1xuXG4gIGNvbnN0IHN1bW1hcnkgPSB7XG4gICAgdG90YWxGb3JtYXRzOiBkZXRhaWxzLmxlbmd0aCxcbiAgICBtYXJraXRkb3duT25seUZvcm1hdHM6IGRldGFpbHMuZmlsdGVyKGQgPT4gZC51c2VNYXJraXRkb3duICYmICFkLnVzZUxhbmdDaGFpbikubGVuZ3RoLFxuICAgIGxhbmdjaGFpbk9ubHlGb3JtYXRzOiBkZXRhaWxzLmZpbHRlcihkID0+ICFkLnVzZU1hcmtpdGRvd24gJiYgZC51c2VMYW5nQ2hhaW4pLmxlbmd0aCxcbiAgICBoeWJyaWRGb3JtYXRzOiBkZXRhaWxzLmZpbHRlcihkID0+IGQudXNlTWFya2l0ZG93biAmJiBkLnVzZUxhbmdDaGFpbikubGVuZ3RoLFxuICAgIHF1YWxpdHlDb21wYXJpc29uRm9ybWF0czogZGV0YWlscy5maWx0ZXIoZCA9PiBkLnF1YWxpdHlDb21wYXJpc29uKS5sZW5ndGhcbiAgfTtcblxuICByZXR1cm4geyBzdW1tYXJ5LCBkZXRhaWxzIH07XG59XG5cbi8qKlxuICogTWFya2l0ZG93buioreWumuODhuODs+ODl+ODrOODvOODiOOCkueUn+aIkOOBmeOCi1xuICovXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVNYXJraXRkb3duQ29uZmlnVGVtcGxhdGUoKTogTWFya2l0ZG93bkNvbmZpZyB7XG4gIGNvbnNvbGUubG9nKCfwn5OdIE1hcmtpdGRvd27oqK3lrprjg4bjg7Pjg5fjg6zjg7zjg4jjgpLnlJ/miJDjgZfjgabjgYTjgb7jgZkuLi4nKTtcbiAgXG4gIGNvbnN0IHRlbXBsYXRlOiBNYXJraXRkb3duQ29uZmlnID0ge1xuICAgIC4uLkRFRkFVTFRfTUFSS0lURE9XTl9DT05GSUcsXG4gICAgLy8g44OG44Oz44OX44Os44O844OI55So44Gu44Kz44Oh44Oz44OI5LuY44GN6Kit5a6aXG4gICAgc3VwcG9ydGVkRm9ybWF0czoge1xuICAgICAgZG9jeDogeyBcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSwgXG4gICAgICAgIHRpbWVvdXQ6IDMwLCBcbiAgICAgICAgZGVzY3JpcHRpb246ICdNaWNyb3NvZnQgV29yZOaWh+abuCAtIOS4gOiIrOeahOOBquODk+OCuOODjeOCueaWh+abuCcsXG4gICAgICAgIHByb2Nlc3NpbmdTdHJhdGVneTogJ21hcmtpdGRvd24tZmlyc3QnLFxuICAgICAgICB1c2VNYXJraXRkb3duOiB0cnVlLFxuICAgICAgICB1c2VMYW5nQ2hhaW46IHRydWUsXG4gICAgICAgIGVuYWJsZVF1YWxpdHlDb21wYXJpc29uOiBmYWxzZVxuICAgICAgfSxcbiAgICAgIHhsc3g6IHsgXG4gICAgICAgIGVuYWJsZWQ6IHRydWUsIFxuICAgICAgICB0aW1lb3V0OiA0NSwgXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnTWljcm9zb2Z0IEV4Y2Vs5paH5pu4IC0g44K544OX44Os44OD44OJ44K344O844OI44Go44OH44O844K/JyxcbiAgICAgICAgcHJvY2Vzc2luZ1N0cmF0ZWd5OiAnbWFya2l0ZG93bi1maXJzdCcsXG4gICAgICAgIHVzZU1hcmtpdGRvd246IHRydWUsXG4gICAgICAgIHVzZUxhbmdDaGFpbjogdHJ1ZSxcbiAgICAgICAgZW5hYmxlUXVhbGl0eUNvbXBhcmlzb246IGZhbHNlXG4gICAgICB9LFxuICAgICAgcHB0eDogeyBcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSwgXG4gICAgICAgIHRpbWVvdXQ6IDYwLCBcbiAgICAgICAgZGVzY3JpcHRpb246ICdNaWNyb3NvZnQgUG93ZXJQb2ludOaWh+abuCAtIOODl+ODrOOCvOODs+ODhuODvOOCt+ODp+ODsycsXG4gICAgICAgIHByb2Nlc3NpbmdTdHJhdGVneTogJ21hcmtpdGRvd24tZmlyc3QnLFxuICAgICAgICB1c2VNYXJraXRkb3duOiB0cnVlLFxuICAgICAgICB1c2VMYW5nQ2hhaW46IHRydWUsXG4gICAgICAgIGVuYWJsZVF1YWxpdHlDb21wYXJpc29uOiBmYWxzZVxuICAgICAgfSxcbiAgICAgIHBkZjogeyBcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSwgXG4gICAgICAgIHRpbWVvdXQ6IDEyMCwgXG4gICAgICAgIG9jcjogdHJ1ZSwgXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnUERG5paH5pu4IC0gT0NS5qmf6IO944Gn44K544Kt44Oj44Oz5paH5pu444Gr44KC5a++5b+cJyxcbiAgICAgICAgcHJvY2Vzc2luZ1N0cmF0ZWd5OiAnYm90aC1jb21wYXJlJyxcbiAgICAgICAgdXNlTWFya2l0ZG93bjogdHJ1ZSxcbiAgICAgICAgdXNlTGFuZ0NoYWluOiB0cnVlLFxuICAgICAgICBlbmFibGVRdWFsaXR5Q29tcGFyaXNvbjogdHJ1ZVxuICAgICAgfSxcbiAgICAgIHBuZzogeyBcbiAgICAgICAgZW5hYmxlZDogZmFsc2UsIFxuICAgICAgICB0aW1lb3V0OiA5MCwgXG4gICAgICAgIG9jcjogdHJ1ZSwgXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnUE5H55S75YOPIC0g6auY5ZOB6LOq55S75YOP44CBT0NS5b+F6KaB5pmC44Gu44G/5pyJ5Yq55YyWJyxcbiAgICAgICAgcHJvY2Vzc2luZ1N0cmF0ZWd5OiAnbWFya2l0ZG93bi1vbmx5JyxcbiAgICAgICAgdXNlTWFya2l0ZG93bjogdHJ1ZSxcbiAgICAgICAgdXNlTGFuZ0NoYWluOiBmYWxzZSxcbiAgICAgICAgZW5hYmxlUXVhbGl0eUNvbXBhcmlzb246IGZhbHNlXG4gICAgICB9LFxuICAgICAganBnOiB7IFxuICAgICAgICBlbmFibGVkOiBmYWxzZSwgXG4gICAgICAgIHRpbWVvdXQ6IDkwLCBcbiAgICAgICAgb2NyOiB0cnVlLCBcbiAgICAgICAgZGVzY3JpcHRpb246ICdKUEVH55S75YOPIC0g5LiA6Iis55qE44Gq55S75YOP5b2i5byP44CBT0NS5b+F6KaB5pmC44Gu44G/5pyJ5Yq55YyWJyxcbiAgICAgICAgcHJvY2Vzc2luZ1N0cmF0ZWd5OiAnbWFya2l0ZG93bi1vbmx5JyxcbiAgICAgICAgdXNlTWFya2l0ZG93bjogdHJ1ZSxcbiAgICAgICAgdXNlTGFuZ0NoYWluOiBmYWxzZSxcbiAgICAgICAgZW5hYmxlUXVhbGl0eUNvbXBhcmlzb246IGZhbHNlXG4gICAgICB9LFxuICAgICAganBlZzogeyBcbiAgICAgICAgZW5hYmxlZDogZmFsc2UsIFxuICAgICAgICB0aW1lb3V0OiA5MCwgXG4gICAgICAgIG9jcjogdHJ1ZSwgXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnSlBFR+eUu+WDjyAtIOS4gOiIrOeahOOBqueUu+WDj+W9ouW8j+OAgU9DUuW/heimgeaZguOBruOBv+acieWKueWMlicsXG4gICAgICAgIHByb2Nlc3NpbmdTdHJhdGVneTogJ21hcmtpdGRvd24tb25seScsXG4gICAgICAgIHVzZU1hcmtpdGRvd246IHRydWUsXG4gICAgICAgIHVzZUxhbmdDaGFpbjogZmFsc2UsXG4gICAgICAgIGVuYWJsZVF1YWxpdHlDb21wYXJpc29uOiBmYWxzZVxuICAgICAgfSxcbiAgICAgIGdpZjogeyBcbiAgICAgICAgZW5hYmxlZDogZmFsc2UsIFxuICAgICAgICB0aW1lb3V0OiA5MCwgXG4gICAgICAgIG9jcjogdHJ1ZSwgXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnR0lG55S75YOPIC0g44Ki44OL44Oh44O844K344On44Oz55S75YOP44CBT0NS5b+F6KaB5pmC44Gu44G/5pyJ5Yq55YyWJyxcbiAgICAgICAgcHJvY2Vzc2luZ1N0cmF0ZWd5OiAnbWFya2l0ZG93bi1vbmx5JyxcbiAgICAgICAgdXNlTWFya2l0ZG93bjogdHJ1ZSxcbiAgICAgICAgdXNlTGFuZ0NoYWluOiBmYWxzZSxcbiAgICAgICAgZW5hYmxlUXVhbGl0eUNvbXBhcmlzb246IGZhbHNlXG4gICAgICB9LFxuICAgICAgaHRtbDogeyBcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSwgXG4gICAgICAgIHRpbWVvdXQ6IDMwLCBcbiAgICAgICAgZGVzY3JpcHRpb246ICdIVE1M5paH5pu4IC0g44Km44Kn44OW44Oa44O844K444Go44Oe44O844Kv44Ki44OD44OXJyxcbiAgICAgICAgcHJvY2Vzc2luZ1N0cmF0ZWd5OiAnbGFuZ2NoYWluLWZpcnN0JyxcbiAgICAgICAgdXNlTWFya2l0ZG93bjogdHJ1ZSxcbiAgICAgICAgdXNlTGFuZ0NoYWluOiB0cnVlLFxuICAgICAgICBlbmFibGVRdWFsaXR5Q29tcGFyaXNvbjogZmFsc2VcbiAgICAgIH0sXG4gICAgICB4bWw6IHsgXG4gICAgICAgIGVuYWJsZWQ6IHRydWUsIFxuICAgICAgICB0aW1lb3V0OiAzMCwgXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnWE1M5paH5pu4IC0g5qeL6YCg5YyW44OH44O844K/JyxcbiAgICAgICAgcHJvY2Vzc2luZ1N0cmF0ZWd5OiAnbGFuZ2NoYWluLWZpcnN0JyxcbiAgICAgICAgdXNlTWFya2l0ZG93bjogdHJ1ZSxcbiAgICAgICAgdXNlTGFuZ0NoYWluOiB0cnVlLFxuICAgICAgICBlbmFibGVRdWFsaXR5Q29tcGFyaXNvbjogZmFsc2VcbiAgICAgIH0sXG4gICAgICBjc3Y6IHsgXG4gICAgICAgIGVuYWJsZWQ6IHRydWUsIFxuICAgICAgICB0aW1lb3V0OiAxNSwgXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnQ1NW5paH5pu4IC0g44Kr44Oz44Oe5Yy65YiH44KK44OH44O844K/JyxcbiAgICAgICAgcHJvY2Vzc2luZ1N0cmF0ZWd5OiAnbGFuZ2NoYWluLW9ubHknLFxuICAgICAgICB1c2VNYXJraXRkb3duOiBmYWxzZSxcbiAgICAgICAgdXNlTGFuZ0NoYWluOiB0cnVlLFxuICAgICAgICBlbmFibGVRdWFsaXR5Q29tcGFyaXNvbjogZmFsc2VcbiAgICAgIH0sXG4gICAgICB0c3Y6IHsgXG4gICAgICAgIGVuYWJsZWQ6IHRydWUsIFxuICAgICAgICB0aW1lb3V0OiAxNSwgXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnVFNW5paH5pu4IC0g44K/44OW5Yy65YiH44KK44OH44O844K/JyxcbiAgICAgICAgcHJvY2Vzc2luZ1N0cmF0ZWd5OiAnbGFuZ2NoYWluLW9ubHknLFxuICAgICAgICB1c2VNYXJraXRkb3duOiBmYWxzZSxcbiAgICAgICAgdXNlTGFuZ0NoYWluOiB0cnVlLFxuICAgICAgICBlbmFibGVRdWFsaXR5Q29tcGFyaXNvbjogZmFsc2VcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgY29uc29sZS5sb2coJ+KchSBNYXJraXRkb3du6Kit5a6a44OG44Oz44OX44Os44O844OI44GM55Sf5oiQ44GV44KM44G+44GX44GfJyk7XG4gIHJldHVybiB0ZW1wbGF0ZTtcbn1cblxuLyoqXG4gKiDlnLDln5/liKXjga7jg4fjg5Xjgqnjg6vjg4joqK3lrprjgpLlj5blvpdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFJlZ2lvbmFsRGVmYXVsdHMocmVnaW9uOiBzdHJpbmcpOiBQYXJ0aWFsPEdsb2JhbFJhZ0NvbmZpZz4ge1xuICByZXR1cm4ge1xuICAgIHJlZ2lvbixcbiAgICBjb21wbGlhbmNlOiB7XG4gICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgcmVndWxhdGlvbnM6IGdldENvbXBsaWFuY2VGb3JSZWdpb24ocmVnaW9uKSxcbiAgICAgIGRhdGFQcm90ZWN0aW9uOiB7XG4gICAgICAgIGVuY3J5cHRpb25BdFJlc3Q6IHRydWUsXG4gICAgICAgIGVuY3J5cHRpb25JblRyYW5zaXQ6IHRydWUsXG4gICAgICAgIGRhdGFDbGFzc2lmaWNhdGlvbjogdHJ1ZSxcbiAgICAgICAgYWNjZXNzTG9nZ2luZzogdHJ1ZSxcbiAgICAgICAgZGF0YVJldGVudGlvbjoge1xuICAgICAgICAgIGRlZmF1bHRSZXRlbnRpb25EYXlzOiAzNjUsXG4gICAgICAgICAgcGVyc29uYWxEYXRhUmV0ZW50aW9uRGF5czogMzY1LFxuICAgICAgICAgIGxvZ1JldGVudGlvbkRheXM6IDM2NSxcbiAgICAgICAgICBiYWNrdXBSZXRlbnRpb25EYXlzOiAzNjVcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGF1ZGl0TG9nZ2luZzogdHJ1ZVxuICAgIH0sXG4gICAgLy8g5Zyw5Z+f5Yil44Gu44OH44OV44Kp44Or44OI6Kit5a6aXG4gICAgZmVhdHVyZXM6IHtcbiAgICAgIG5ldHdvcmtpbmc6IHtcbiAgICAgICAgdnBjOiB0cnVlLFxuICAgICAgICBsb2FkQmFsYW5jZXI6IHRydWUsXG4gICAgICAgIGNkbjogdHJ1ZSxcbiAgICAgICAgY3VzdG9tRG9tYWluOiB1bmRlZmluZWRcbiAgICAgIH0sXG4gICAgICBzZWN1cml0eToge1xuICAgICAgICB3YWY6IHRydWUsXG4gICAgICAgIGNvZ25pdG86IHRydWUsXG4gICAgICAgIGVuY3J5cHRpb246IHRydWUsXG4gICAgICAgIGNvbXBsaWFuY2U6IHRydWVcbiAgICAgIH0sXG4gICAgICBzdG9yYWdlOiB7XG4gICAgICAgIGZzeDogdHJ1ZSxcbiAgICAgICAgczM6IHRydWUsXG4gICAgICAgIGJhY2t1cDogdHJ1ZSxcbiAgICAgICAgbGlmZWN5Y2xlOiB0cnVlXG4gICAgICB9LFxuICAgICAgZGF0YWJhc2U6IHtcbiAgICAgICAgZHluYW1vZGI6IHRydWUsXG4gICAgICAgIG9wZW5zZWFyY2g6IHRydWUsXG4gICAgICAgIHJkczogZmFsc2UsIC8vIOOCquODl+OCt+ODp+ODs1xuICAgICAgICBtaWdyYXRpb246IHRydWVcbiAgICAgIH0sXG4gICAgICBjb21wdXRlOiB7XG4gICAgICAgIGxhbWJkYTogdHJ1ZSxcbiAgICAgICAgZWNzOiBmYWxzZSwgLy8g44Kq44OX44K344On44OzXG4gICAgICAgIHNjYWxpbmc6IHRydWVcbiAgICAgIH0sXG4gICAgICBhcGk6IHtcbiAgICAgICAgcmVzdEFwaTogdHJ1ZSxcbiAgICAgICAgZ3JhcGhxbDogZmFsc2UsIC8vIOOCquODl+OCt+ODp+ODs1xuICAgICAgICB3ZWJzb2NrZXQ6IGZhbHNlLCAvLyDjgqrjg5fjgrfjg6fjg7NcbiAgICAgICAgZnJvbnRlbmQ6IHRydWVcbiAgICAgIH0sXG4gICAgICBhaToge1xuICAgICAgICBiZWRyb2NrOiB0cnVlLFxuICAgICAgICBlbWJlZGRpbmc6IHRydWUsXG4gICAgICAgIHJhZzogdHJ1ZSxcbiAgICAgICAgbW9kZWxNYW5hZ2VtZW50OiB0cnVlXG4gICAgICB9LFxuICAgICAgbW9uaXRvcmluZzoge1xuICAgICAgICBjbG91ZHdhdGNoOiB0cnVlLFxuICAgICAgICB4cmF5OiB0cnVlLFxuICAgICAgICBhbGFybXM6IHRydWUsXG4gICAgICAgIGRhc2hib2FyZHM6IHRydWVcbiAgICAgIH0sXG4gICAgICBlbnRlcnByaXNlOiB7XG4gICAgICAgIG11bHRpVGVuYW50OiBmYWxzZSwgLy8g44Kq44OX44K344On44OzXG4gICAgICAgIGJpbGxpbmc6IGZhbHNlLCAvLyDjgqrjg5fjgrfjg6fjg7NcbiAgICAgICAgY29tcGxpYW5jZTogdHJ1ZSxcbiAgICAgICAgZ292ZXJuYW5jZTogdHJ1ZVxuICAgICAgfVxuICAgIH1cbiAgfTtcbn0iXX0=