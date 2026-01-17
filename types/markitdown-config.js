"use strict";
/**
 * Markitdown設定型定義
 * Microsoft Markitdownライブラリ統合用の設定インターフェース
 *
 * @version 1.0.0
 * @author Permission-aware RAG System Team
 * @since 2024-10-19
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENVIRONMENT_DEFAULTS = exports.DEFAULT_MARKITDOWN_CONFIG = exports.MarkitdownErrorCode = exports.FILE_SIZE_LIMITS = exports.FILE_FORMAT_CATEGORIES = exports.PROCESSING_STRATEGY_INFO = void 0;
exports.validateMarkitdownConfig = validateMarkitdownConfig;
exports.isFormatEnabled = isFormatEnabled;
exports.isFileSizeValid = isFileSizeValid;
exports.shouldUseMarkitdown = shouldUseMarkitdown;
exports.shouldUseLangChain = shouldUseLangChain;
exports.getProcessingOrder = getProcessingOrder;
exports.shouldPerformQualityComparison = shouldPerformQualityComparison;
exports.extractEmbeddingInfo = extractEmbeddingInfo;
exports.generateFormatConfigFromStrategy = generateFormatConfigFromStrategy;
exports.getRecommendedStrategy = getRecommendedStrategy;
exports.normalizeFormatConfig = normalizeFormatConfig;
/**
 * 処理戦略の詳細情報
 */
exports.PROCESSING_STRATEGY_INFO = {
    'markitdown-only': {
        description: 'Markitdownライブラリのみを使用した変換',
        useMarkitdown: true,
        useLangChain: false,
        requiresComparison: false,
        priority: 1
    },
    'langchain-only': {
        description: 'LangChainローダーのみを使用した変換',
        useMarkitdown: false,
        useLangChain: true,
        requiresComparison: false,
        priority: 1
    },
    'markitdown-first': {
        description: 'Markitdown優先、失敗時LangChainフォールバック',
        useMarkitdown: true,
        useLangChain: true,
        requiresComparison: false,
        priority: 2
    },
    'langchain-first': {
        description: 'LangChain優先、失敗時Markitdownフォールバック',
        useMarkitdown: true,
        useLangChain: true,
        requiresComparison: false,
        priority: 2
    },
    'both-compare': {
        description: '両方実行して品質比較による最適選択',
        useMarkitdown: true,
        useLangChain: true,
        requiresComparison: true,
        priority: 3
    },
    'auto-select': {
        description: 'ファイル特性に基づく自動選択',
        useMarkitdown: true,
        useLangChain: true,
        requiresComparison: false,
        priority: 4
    }
};
/**
 * ファイル形式のカテゴリ分類
 */
exports.FILE_FORMAT_CATEGORIES = {
    OFFICE: ['docx', 'xlsx', 'pptx'],
    DOCUMENT: ['pdf', 'html', 'xml'],
    IMAGE: ['png', 'jpg', 'jpeg', 'gif'],
    DATA: ['csv', 'tsv']
};
/**
 * ファイル形式の最大サイズ制限（バイト）
 */
exports.FILE_SIZE_LIMITS = {
    docx: 50 * 1024 * 1024, // 50MB
    xlsx: 100 * 1024 * 1024, // 100MB
    pptx: 200 * 1024 * 1024, // 200MB
    pdf: 100 * 1024 * 1024, // 100MB
    png: 20 * 1024 * 1024, // 20MB
    jpg: 20 * 1024 * 1024, // 20MB
    jpeg: 20 * 1024 * 1024, // 20MB
    gif: 10 * 1024 * 1024, // 10MB
    html: 5 * 1024 * 1024, // 5MB
    xml: 5 * 1024 * 1024, // 5MB
    csv: 50 * 1024 * 1024, // 50MB
    tsv: 50 * 1024 * 1024 // 50MB
};
/**
 * エラーコードの定義
 */
var MarkitdownErrorCode;
(function (MarkitdownErrorCode) {
    MarkitdownErrorCode["CONVERSION_FAILED"] = "CONVERSION_FAILED";
    MarkitdownErrorCode["TIMEOUT_ERROR"] = "TIMEOUT_ERROR";
    MarkitdownErrorCode["FILE_TOO_LARGE"] = "FILE_TOO_LARGE";
    MarkitdownErrorCode["UNSUPPORTED_FORMAT"] = "UNSUPPORTED_FORMAT";
    MarkitdownErrorCode["SECURITY_VIOLATION"] = "SECURITY_VIOLATION";
    MarkitdownErrorCode["MEMORY_LIMIT_EXCEEDED"] = "MEMORY_LIMIT_EXCEEDED";
    MarkitdownErrorCode["OCR_FAILED"] = "OCR_FAILED";
    MarkitdownErrorCode["NETWORK_ERROR"] = "NETWORK_ERROR";
})(MarkitdownErrorCode || (exports.MarkitdownErrorCode = MarkitdownErrorCode = {}));
/**
 * 設定値の検証関数
 */
function validateMarkitdownConfig(config) {
    const errors = [];
    // 基本設定の検証
    if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
        errors.push('enabled設定はboolean型である必要があります');
    }
    // サポートファイル形式の検証
    if (config.supportedFormats) {
        for (const [format, formatConfig] of Object.entries(config.supportedFormats)) {
            const formatErrors = validateFormatConfig(format, formatConfig);
            errors.push(...formatErrors);
        }
    }
    // パフォーマンス設定の検証
    if (config.performance) {
        if (config.performance.maxFileSizeBytes && config.performance.maxFileSizeBytes > 500 * 1024 * 1024) {
            errors.push('最大ファイルサイズは500MBを超えることはできません');
        }
        if (config.performance.memoryLimitMB && config.performance.memoryLimitMB > 3008) {
            errors.push('メモリ制限はLambdaの最大値3008MBを超えることはできません');
        }
        if (config.performance.maxConcurrentProcesses && config.performance.maxConcurrentProcesses > 10) {
            errors.push('最大同時処理数は10を超えることはできません');
        }
        if (config.performance.maxConcurrentProcesses && config.performance.maxConcurrentProcesses < 1) {
            errors.push('最大同時処理数は1以上である必要があります');
        }
    }
    // セキュリティ設定の検証
    if (config.security?.tempFileRetentionMinutes && config.security.tempFileRetentionMinutes > 1440) {
        errors.push('一時ファイル保持時間は24時間（1440分）を超えることはできません');
    }
    return errors;
}
/**
 * ファイル形式設定の検証
 */
function validateFormatConfig(format, formatConfig) {
    const errors = [];
    // 基本設定の検証
    if (typeof formatConfig.enabled !== 'boolean') {
        errors.push(`${format}: enabled設定はboolean型である必要があります`);
    }
    if (typeof formatConfig.timeout !== 'number' || formatConfig.timeout <= 0) {
        errors.push(`${format}: timeout設定は正の数値である必要があります`);
    }
    if (formatConfig.timeout > 900) { // Lambda最大実行時間
        errors.push(`${format}: timeout設定は900秒を超えることはできません`);
    }
    // 処理戦略の整合性検証
    const strategyInfo = exports.PROCESSING_STRATEGY_INFO[formatConfig.processingStrategy];
    if (!strategyInfo) {
        errors.push(`${format}: 無効な処理戦略が指定されています: ${formatConfig.processingStrategy}`);
        return errors;
    }
    // useMarkitdown/useLangChainと処理戦略の整合性チェック
    if (formatConfig.useMarkitdown !== strategyInfo.useMarkitdown) {
        errors.push(`${format}: useMarkitdown設定が処理戦略と一致しません`);
    }
    if (formatConfig.useLangChain !== strategyInfo.useLangChain) {
        errors.push(`${format}: useLangChain設定が処理戦略と一致しません`);
    }
    // 品質比較設定の整合性チェック
    if (formatConfig.enableQualityComparison && !strategyInfo.requiresComparison) {
        errors.push(`${format}: 品質比較は'both-compare'戦略でのみ有効です`);
    }
    return errors;
}
/**
 * ファイル形式が有効かチェック
 */
function isFormatEnabled(config, format) {
    return config.enabled &&
        config.supportedFormats[format]?.enabled === true;
}
/**
 * ファイルサイズが制限内かチェック
 */
function isFileSizeValid(config, format, sizeBytes) {
    const formatLimit = exports.FILE_SIZE_LIMITS[format];
    const globalLimit = config.performance.maxFileSizeBytes;
    return sizeBytes <= Math.min(formatLimit, globalLimit);
}
/**
 * ファイル形式に対してMarkitdownを使用するかチェック
 */
function shouldUseMarkitdown(config, format) {
    const formatConfig = config.supportedFormats[format];
    return config.enabled &&
        formatConfig?.enabled === true &&
        formatConfig?.useMarkitdown === true;
}
/**
 * ファイル形式に対してLangChainを使用するかチェック
 */
function shouldUseLangChain(config, format) {
    const formatConfig = config.supportedFormats[format];
    return formatConfig?.enabled === true &&
        formatConfig?.useLangChain === true;
}
/**
 * 処理戦略に基づいて実行順序を決定
 */
function getProcessingOrder(config, format) {
    const formatConfig = config.supportedFormats[format];
    if (!formatConfig?.enabled)
        return [];
    switch (formatConfig.processingStrategy) {
        case 'markitdown-only':
            return formatConfig.useMarkitdown ? ['markitdown'] : [];
        case 'langchain-only':
            return formatConfig.useLangChain ? ['langchain'] : [];
        case 'markitdown-first':
            const markitdownFirst = [];
            if (formatConfig.useMarkitdown)
                markitdownFirst.push('markitdown');
            if (formatConfig.useLangChain)
                markitdownFirst.push('langchain');
            return markitdownFirst;
        case 'langchain-first':
            const langchainFirst = [];
            if (formatConfig.useLangChain)
                langchainFirst.push('langchain');
            if (formatConfig.useMarkitdown)
                langchainFirst.push('markitdown');
            return langchainFirst;
        case 'both-compare':
            const both = [];
            if (formatConfig.useMarkitdown)
                both.push('markitdown');
            if (formatConfig.useLangChain)
                both.push('langchain');
            return both;
        case 'auto-select':
            return getAutoSelectedOrder(format);
        default:
            return [];
    }
}
/**
 * ファイル形式に基づく自動選択ロジック
 */
function getAutoSelectedOrder(format) {
    // Office文書: Markitdown優先
    if (exports.FILE_FORMAT_CATEGORIES.OFFICE.includes(format)) {
        return ['markitdown', 'langchain'];
    }
    // 画像: Markitdownのみ（OCR機能）
    if (exports.FILE_FORMAT_CATEGORIES.IMAGE.includes(format)) {
        return ['markitdown'];
    }
    // データファイル: LangChainのみ
    if (exports.FILE_FORMAT_CATEGORIES.DATA.includes(format)) {
        return ['langchain'];
    }
    // その他: LangChain優先
    return ['langchain', 'markitdown'];
}
/**
 * 品質比較が必要かチェック
 */
function shouldPerformQualityComparison(config, format) {
    const formatConfig = config.supportedFormats[format];
    return formatConfig?.enableQualityComparison === true &&
        formatConfig?.processingStrategy === 'both-compare';
}
/**
 * 処理メタデータからEmbedding情報を生成
 */
function extractEmbeddingInfo(metadata) {
    return {
        fileName: metadata.originalFileName,
        fileFormat: metadata.fileType,
        usedMarkitdown: metadata.markitdownUsed,
        usedLangChain: metadata.langchainUsed,
        finalMethod: metadata.selectedMethod,
        strategy: metadata.processingStrategy,
        processingTime: metadata.totalConversionTime,
        qualityScore: metadata.finalQualityScore,
        processedAt: metadata.endTime
    };
}
/**
 * 処理戦略から設定を自動生成
 */
function generateFormatConfigFromStrategy(strategy, timeout = 30, description = '', ocrEnabled = false) {
    const strategyInfo = exports.PROCESSING_STRATEGY_INFO[strategy];
    return {
        timeout,
        description,
        ocr: ocrEnabled,
        processingStrategy: strategy,
        useMarkitdown: strategyInfo.useMarkitdown,
        useLangChain: strategyInfo.useLangChain,
        enableQualityComparison: strategyInfo.requiresComparison
    };
}
/**
 * ファイル形式に推奨される処理戦略を取得
 */
function getRecommendedStrategy(format) {
    // Office文書: Markitdown優先
    if (exports.FILE_FORMAT_CATEGORIES.OFFICE.includes(format)) {
        return 'markitdown-first';
    }
    // 画像: Markitdownのみ（OCR機能）
    if (exports.FILE_FORMAT_CATEGORIES.IMAGE.includes(format)) {
        return 'markitdown-only';
    }
    // データファイル: LangChainのみ
    if (exports.FILE_FORMAT_CATEGORIES.DATA.includes(format)) {
        return 'langchain-only';
    }
    // PDF: 品質比較
    if (format === 'pdf') {
        return 'both-compare';
    }
    // その他: LangChain優先
    return 'langchain-first';
}
/**
 * 設定の整合性を自動修正
 */
function normalizeFormatConfig(config) {
    const strategyInfo = exports.PROCESSING_STRATEGY_INFO[config.processingStrategy];
    return {
        ...config,
        useMarkitdown: strategyInfo.useMarkitdown,
        useLangChain: strategyInfo.useLangChain,
        enableQualityComparison: strategyInfo.requiresComparison ? config.enableQualityComparison : false
    };
}
/**
 * デフォルトのMarkitdown設定
 */
exports.DEFAULT_MARKITDOWN_CONFIG = {
    enabled: true,
    supportedFormats: {
        docx: {
            enabled: true,
            timeout: 30,
            description: 'Microsoft Word文書',
            processingStrategy: 'markitdown-first',
            useMarkitdown: true,
            useLangChain: true,
            enableQualityComparison: false
        },
        xlsx: {
            enabled: true,
            timeout: 45,
            description: 'Microsoft Excel文書',
            processingStrategy: 'markitdown-first',
            useMarkitdown: true,
            useLangChain: true,
            enableQualityComparison: false
        },
        pptx: {
            enabled: true,
            timeout: 60,
            description: 'Microsoft PowerPoint文書',
            processingStrategy: 'markitdown-first',
            useMarkitdown: true,
            useLangChain: true,
            enableQualityComparison: false
        },
        pdf: {
            enabled: true,
            timeout: 120,
            ocr: true,
            description: 'PDF文書（OCR対応）',
            processingStrategy: 'both-compare',
            useMarkitdown: true,
            useLangChain: true,
            enableQualityComparison: true
        },
        png: {
            enabled: true,
            timeout: 90,
            ocr: true,
            description: 'PNG画像（OCR対応）',
            processingStrategy: 'markitdown-only',
            useMarkitdown: true,
            useLangChain: false,
            enableQualityComparison: false
        },
        jpg: {
            enabled: true,
            timeout: 90,
            ocr: true,
            description: 'JPEG画像（OCR対応）',
            processingStrategy: 'markitdown-only',
            useMarkitdown: true,
            useLangChain: false,
            enableQualityComparison: false
        },
        jpeg: {
            enabled: true,
            timeout: 90,
            ocr: true,
            description: 'JPEG画像（OCR対応）',
            processingStrategy: 'markitdown-only',
            useMarkitdown: true,
            useLangChain: false,
            enableQualityComparison: false
        },
        gif: {
            enabled: true,
            timeout: 90,
            ocr: true,
            description: 'GIF画像（OCR対応）',
            processingStrategy: 'markitdown-only',
            useMarkitdown: true,
            useLangChain: false,
            enableQualityComparison: false
        },
        html: {
            enabled: true,
            timeout: 30,
            description: 'HTML文書',
            processingStrategy: 'langchain-first',
            useMarkitdown: true,
            useLangChain: true,
            enableQualityComparison: false
        },
        xml: {
            enabled: true,
            timeout: 30,
            description: 'XML文書',
            processingStrategy: 'langchain-first',
            useMarkitdown: true,
            useLangChain: true,
            enableQualityComparison: false
        },
        csv: {
            enabled: true,
            timeout: 15,
            description: 'CSV文書',
            processingStrategy: 'langchain-only',
            useMarkitdown: false,
            useLangChain: true,
            enableQualityComparison: false
        },
        tsv: {
            enabled: true,
            timeout: 15,
            description: 'TSV文書',
            processingStrategy: 'langchain-only',
            useMarkitdown: false,
            useLangChain: true,
            enableQualityComparison: false
        }
    },
    performance: {
        maxFileSize: '10MB',
        maxFileSizeBytes: 10485760,
        memoryLimit: '1024MB',
        memoryLimitMB: 1024,
        parallelProcessing: true,
        maxConcurrentProcesses: 3
    },
    fallback: {
        enabled: true,
        useLangChainOnFailure: true,
        retryAttempts: 2,
        retryDelayMs: 1000
    },
    security: {
        validateFileType: true,
        validateFileSize: true,
        encryptTempFiles: true,
        autoDeleteTempFiles: true,
        tempFileRetentionMinutes: 30
    },
    logging: {
        level: 'info',
        enableDetailedLogs: true,
        enablePerformanceLogs: true,
        enableErrorTracking: true
    },
    quality: {
        ocrAccuracy: 'high',
        textExtractionQuality: 'high',
        preserveFormatting: true,
        preserveImages: false
    }
};
/**
 * 環境別デフォルト設定
 */
exports.ENVIRONMENT_DEFAULTS = {
    dev: {
        logging: {
            level: 'debug',
            enableDetailedLogs: true,
            enablePerformanceLogs: true,
            enableErrorTracking: true
        },
        performance: {
            maxFileSize: '5MB',
            maxFileSizeBytes: 5242880,
            memoryLimit: '512MB',
            memoryLimitMB: 512,
            parallelProcessing: false,
            maxConcurrentProcesses: 1
        }
    },
    staging: {
        logging: {
            level: 'info',
            enableDetailedLogs: true,
            enablePerformanceLogs: true,
            enableErrorTracking: true
        },
        performance: {
            maxFileSize: '10MB',
            maxFileSizeBytes: 10485760,
            memoryLimit: '1024MB',
            memoryLimitMB: 1024,
            parallelProcessing: true,
            maxConcurrentProcesses: 2
        }
    },
    prod: {
        logging: {
            level: 'warn',
            enableDetailedLogs: false,
            enablePerformanceLogs: true,
            enableErrorTracking: true
        },
        performance: {
            maxFileSize: '50MB',
            maxFileSizeBytes: 52428800,
            memoryLimit: '3008MB',
            memoryLimitMB: 3008,
            parallelProcessing: true,
            maxConcurrentProcesses: 5
        }
    }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFya2l0ZG93bi1jb25maWcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJtYXJraXRkb3duLWNvbmZpZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7R0FPRzs7O0FBK1hILDREQXNDQztBQWdERCwwQ0FHQztBQUtELDBDQUlDO0FBS0Qsa0RBS0M7QUFLRCxnREFJQztBQUtELGdEQTZCQztBQXlCRCx3RUFJQztBQTZCRCxvREFZQztBQUtELDRFQWlCQztBQUtELHdEQXVCQztBQUtELHNEQVNDO0FBM25CRDs7R0FFRztBQUNVLFFBQUEsd0JBQXdCLEdBTWhDO0lBQ0gsaUJBQWlCLEVBQUU7UUFDakIsV0FBVyxFQUFFLDBCQUEwQjtRQUN2QyxhQUFhLEVBQUUsSUFBSTtRQUNuQixZQUFZLEVBQUUsS0FBSztRQUNuQixrQkFBa0IsRUFBRSxLQUFLO1FBQ3pCLFFBQVEsRUFBRSxDQUFDO0tBQ1o7SUFDRCxnQkFBZ0IsRUFBRTtRQUNoQixXQUFXLEVBQUUsd0JBQXdCO1FBQ3JDLGFBQWEsRUFBRSxLQUFLO1FBQ3BCLFlBQVksRUFBRSxJQUFJO1FBQ2xCLGtCQUFrQixFQUFFLEtBQUs7UUFDekIsUUFBUSxFQUFFLENBQUM7S0FDWjtJQUNELGtCQUFrQixFQUFFO1FBQ2xCLFdBQVcsRUFBRSxrQ0FBa0M7UUFDL0MsYUFBYSxFQUFFLElBQUk7UUFDbkIsWUFBWSxFQUFFLElBQUk7UUFDbEIsa0JBQWtCLEVBQUUsS0FBSztRQUN6QixRQUFRLEVBQUUsQ0FBQztLQUNaO0lBQ0QsaUJBQWlCLEVBQUU7UUFDakIsV0FBVyxFQUFFLGtDQUFrQztRQUMvQyxhQUFhLEVBQUUsSUFBSTtRQUNuQixZQUFZLEVBQUUsSUFBSTtRQUNsQixrQkFBa0IsRUFBRSxLQUFLO1FBQ3pCLFFBQVEsRUFBRSxDQUFDO0tBQ1o7SUFDRCxjQUFjLEVBQUU7UUFDZCxXQUFXLEVBQUUsbUJBQW1CO1FBQ2hDLGFBQWEsRUFBRSxJQUFJO1FBQ25CLFlBQVksRUFBRSxJ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VyxFQUFFO1lBQ1gsV0FBVyxFQUFFLEtBQUs7WUFDbEIsZ0JBQWdCLEVBQUUsT0FBTztZQUN6QixXQUFXLEVBQUUsT0FBTztZQUNwQixhQUFhLEVBQUUsR0FBRztZQUNsQixrQkFBa0IsRUFBRSxLQUFLO1lBQ3pCLHNCQUFzQixFQUFFLENBQUM7U0FDMUI7S0FDRjtJQUNELE9BQU8sRUFBRTtRQUNQLE9BQU8sRUFBRTtZQUNQLEtBQUssRUFBRSxNQUFNO1lBQ2Isa0JBQWtCLEVBQUUsSUFBSTtZQUN4QixxQkFBcUIsRUFBRSxJQUFJO1lBQzNCLG1CQUFtQixFQUFFLElBQUk7U0FDMUI7UUFDRCxXQUFXLEVBQUU7WUFDWCxXQUFXLEVBQUUsTUFBTTtZQUNuQixnQkFBZ0IsRUFBRSxRQUFRO1lBQzFCLFdBQVcsRUFBRSxRQUFRO1lBQ3JCLGFBQWEsRUFBRSxJQUFJO1lBQ25CLGtCQUFrQixFQUFFLElBQUk7WUFDeEIsc0JBQXNCLEVBQUUsQ0FBQztTQUMxQjtLQUNGO0lBQ0QsSUFBSSxFQUFFO1FBQ0osT0FBTyxFQUFFO1lBQ1AsS0FBSyxFQUFFLE1BQU07WUFDYixrQkFBa0IsRUFBRSxLQUFLO1lBQ3pCLHFCQUFxQixFQUFFLElBQUk7WUFDM0IsbUJBQW1CLEVBQUUsSUFBSTtTQUMxQjtRQUNELFdBQVcsRUFBRTtZQUNYLFdBQVcsRUFBRSxNQUFNO1lBQ25CLGdCQUFnQixFQUFFLFFBQVE7WUFDMUIsV0FBVyxFQUFFLFFBQVE7WUFDckIsYUFBYSxFQUFFLElBQUk7WUFDbkIsa0JBQWtCLEVBQUUsSUFBSTtZQUN4QixzQkFBc0IsRUFBRSxDQUFDO1NBQzFCO0tBQ0Y7Q0FDRixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBNYXJraXRkb3du6Kit5a6a5Z6L5a6a576pXG4gKiBNaWNyb3NvZnQgTWFya2l0ZG93buODqeOCpOODluODqeODque1seWQiOeUqOOBruioreWumuOCpOODs+OCv+ODvOODleOCp+ODvOOCuVxuICogXG4gKiBAdmVyc2lvbiAxLjAuMFxuICogQGF1dGhvciBQZXJtaXNzaW9uLWF3YXJlIFJBRyBTeXN0ZW0gVGVhbVxuICogQHNpbmNlIDIwMjQtMTAtMTlcbiAqL1xuXG4vKipcbiAqIE1hcmtpdGRvd27ntbHlkIjoqK3lrprjga7jg6HjgqTjg7PjgqTjg7Pjgr/jg7zjg5Xjgqfjg7zjgrlcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBNYXJraXRkb3duQ29uZmlnIHtcbiAgLyoqIE1hcmtpdGRvd27mqZ/og73jga7mnInlirkv54Sh5Yq5ICovXG4gIGVuYWJsZWQ6IGJvb2xlYW47XG4gIC8qKiDjgrXjg53jg7zjg4jjgZnjgovjg5XjgqHjgqTjg6vlvaLlvI/jga7oqK3lrpogKi9cbiAgc3VwcG9ydGVkRm9ybWF0czogUmVjb3JkPHN0cmluZywgRm9ybWF0Q29uZmlnPjtcbiAgLyoqIOODkeODleOCqeODvOODnuODs+OCuemWoumAo+ioreWumiAqL1xuICBwZXJmb3JtYW5jZTogUGVyZm9ybWFuY2VDb25maWc7XG4gIC8qKiDjg5Xjgqnjg7zjg6vjg5Djg4Pjgq/mqZ/og73oqK3lrpogKi9cbiAgZmFsbGJhY2s6IEZhbGxiYWNrQ29uZmlnO1xuICAvKiog44K744Kt44Ol44Oq44OG44Kj6Kit5a6aICovXG4gIHNlY3VyaXR5OiBTZWN1cml0eUNvbmZpZztcbiAgLyoqIOODreOCsOWHuuWKm+ioreWumiAqL1xuICBsb2dnaW5nOiBMb2dnaW5nQ29uZmlnO1xuICAvKiog5aSJ5o+b5ZOB6LOq6Kit5a6aICovXG4gIHF1YWxpdHk6IFF1YWxpdHlDb25maWc7XG59XG5cbi8qKlxuICog5Yem55CG5pa55rOV44Gu5YSq5YWI6aCG5L2N6Kit5a6aXG4gKi9cbmV4cG9ydCB0eXBlIFByb2Nlc3NpbmdTdHJhdGVneSA9IFxuICB8ICdtYXJraXRkb3duLW9ubHknICAgICAgLy8gTWFya2l0ZG93buOBruOBv+S9v+eUqFxuICB8ICdsYW5nY2hhaW4tb25seScgICAgICAgLy8gTGFuZ0NoYWlu44Gu44G/5L2/55SoXG4gIHwgJ21hcmtpdGRvd24tZmlyc3QnICAgICAvLyBNYXJraXRkb3du5YSq5YWI44CB5aSx5pWX5pmCTGFuZ0NoYWluXG4gIHwgJ2xhbmdjaGFpbi1maXJzdCcgICAgICAvLyBMYW5nQ2hhaW7lhKrlhYjjgIHlpLHmlZfmmYJNYXJraXRkb3duXG4gIHwgJ2JvdGgtY29tcGFyZScgICAgICAgICAvLyDkuKHmlrnlrp/ooYzjgZfjgablk4Hos6rmr5TovINcbiAgfCAnYXV0by1zZWxlY3QnOyAgICAgICAgIC8vIOODleOCoeOCpOODq+eJueaAp+OBq+WfuuOBpeOBj+iHquWLlemBuOaKnlxuXG4vKipcbiAqIOWHpueQhuaIpueVpeOBruips+e0sOaDheWgsVxuICovXG5leHBvcnQgY29uc3QgUFJPQ0VTU0lOR19TVFJBVEVHWV9JTkZPOiBSZWNvcmQ8UHJvY2Vzc2luZ1N0cmF0ZWd5LCB7XG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG4gIHVzZU1hcmtpdGRvd246IGJvb2xlYW47XG4gIHVzZUxhbmdDaGFpbjogYm9vbGVhbjtcbiAgcmVxdWlyZXNDb21wYXJpc29uOiBib29sZWFuO1xuICBwcmlvcml0eTogbnVtYmVyO1xufT4gPSB7XG4gICdtYXJraXRkb3duLW9ubHknOiB7XG4gICAgZGVzY3JpcHRpb246ICdNYXJraXRkb3du44Op44Kk44OW44Op44Oq44Gu44G/44KS5L2/55So44GX44Gf5aSJ5o+bJyxcbiAgICB1c2VNYXJraXRkb3duOiB0cnVlLFxuICAgIHVzZUxhbmdDaGFpbjogZmFsc2UsXG4gICAgcmVxdWlyZXNDb21wYXJpc29uOiBmYWxzZSxcbiAgICBwcmlvcml0eTogMVxuICB9LFxuICAnbGFuZ2NoYWluLW9ubHknOiB7XG4gICAgZGVzY3JpcHRpb246ICdMYW5nQ2hhaW7jg63jg7zjg4Djg7zjga7jgb/jgpLkvb/nlKjjgZfjgZ/lpInmj5snLFxuICAgIHVzZU1hcmtpdGRvd246IGZhbHNlLFxuICAgIHVzZUxhbmdDaGFpbjogdHJ1ZSxcbiAgICByZXF1aXJlc0NvbXBhcmlzb246IGZhbHNlLFxuICAgIHByaW9yaXR5OiAxXG4gIH0sXG4gICdtYXJraXRkb3duLWZpcnN0Jzoge1xuICAgIGRlc2NyaXB0aW9uOiAnTWFya2l0ZG93buWEquWFiOOAgeWkseaVl+aZgkxhbmdDaGFpbuODleOCqeODvOODq+ODkOODg+OCrycsXG4gICAgdXNlTWFya2l0ZG93bjogdHJ1ZSxcbiAgICB1c2VMYW5nQ2hhaW46IHRydWUsXG4gICAgcmVxdWlyZXNDb21wYXJpc29uOiBmYWxzZSxcbiAgICBwcmlvcml0eTogMlxuICB9LFxuICAnbGFuZ2NoYWluLWZpcnN0Jzoge1xuICAgIGRlc2NyaXB0aW9uOiAnTGFuZ0NoYWlu5YSq5YWI44CB5aSx5pWX5pmCTWFya2l0ZG93buODleOCqeODvOODq+ODkOODg+OCrycsXG4gICAgdXNlTWFya2l0ZG93bjogdHJ1ZSxcbiAgICB1c2VMYW5nQ2hhaW46IHRydWUsXG4gICAgcmVxdWlyZXNDb21wYXJpc29uOiBmYWxzZSxcbiAgICBwcmlvcml0eTogMlxuICB9LFxuICAnYm90aC1jb21wYXJlJzoge1xuICAgIGRlc2NyaXB0aW9uOiAn5Lih5pa55a6f6KGM44GX44Gm5ZOB6LOq5q+U6LyD44Gr44KI44KL5pyA6YGp6YG45oqeJyxcbiAgICB1c2VNYXJraXRkb3duOiB0cnVlLFxuICAgIHVzZUxhbmdDaGFpbjogdHJ1ZSxcbiAgICByZXF1aXJlc0NvbXBhcmlzb246IHRydWUsXG4gICAgcHJpb3JpdHk6IDNcbiAgfSxcbiAgJ2F1dG8tc2VsZWN0Jzoge1xuICAgIGRlc2NyaXB0aW9uOiAn44OV44Kh44Kk44Or54m55oCn44Gr5Z+644Gl44GP6Ieq5YuV6YG45oqeJyxcbiAgICB1c2VNYXJraXRkb3duOiB0cnVlLFxuICAgIHVzZUxhbmdDaGFpbjogdHJ1ZSxcbiAgICByZXF1aXJlc0NvbXBhcmlzb246IGZhbHNlLFxuICAgIHByaW9yaXR5OiA0XG4gIH1cbn0gYXMgY29uc3Q7XG5cbi8qKlxuICog44OV44Kh44Kk44Or5b2i5byP5Yil6Kit5a6aXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRm9ybWF0Q29uZmlnIHtcbiAgLyoqIOOBk+OBruW9ouW8j+OBruWHpueQhuOCkuacieWKueOBq+OBmeOCi+OBiyAqL1xuICBlbmFibGVkOiBib29sZWFuO1xuICAvKiog5Yem55CG44K/44Kk44Og44Ki44Km44OI5pmC6ZaT77yI56eS77yJICovXG4gIHRpbWVvdXQ6IG51bWJlcjtcbiAgLyoqIE9DUuapn+iDveOCkuS9v+eUqOOBmeOCi+OBi++8iOeUu+WDj+ODu1BERueUqO+8iSAqL1xuICBvY3I/OiBib29sZWFuO1xuICAvKiog5b2i5byP44Gu6Kqs5piOICovXG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG4gIC8qKiDlh6bnkIbmlrnms5Xjga7lhKrlhYjpoIbkvY0gKi9cbiAgcHJvY2Vzc2luZ1N0cmF0ZWd5OiBQcm9jZXNzaW5nU3RyYXRlZ3k7XG4gIC8qKiBNYXJraXRkb3du44KS5L2/55So44GZ44KL44GL77yI44GT44Gu5b2i5byP44Gn77yJICovXG4gIHVzZU1hcmtpdGRvd246IGJvb2xlYW47XG4gIC8qKiBMYW5nQ2hhaW7jgpLkvb/nlKjjgZnjgovjgYvvvIjjgZPjga7lvaLlvI/jgafvvIkgKi9cbiAgdXNlTGFuZ0NoYWluOiBib29sZWFuO1xuICAvKiog5ZOB6LOq5q+U6LyD44KS6KGM44GG44GLICovXG4gIGVuYWJsZVF1YWxpdHlDb21wYXJpc29uPzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiDjg5Hjg5Xjgqnjg7zjg57jg7PjgrnoqK3lrppcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQZXJmb3JtYW5jZUNvbmZpZyB7XG4gIC8qKiDmnIDlpKfjg5XjgqHjgqTjg6vjgrXjgqTjgrrvvIjmloflrZfliJfooajoqJjvvIkgKi9cbiAgbWF4RmlsZVNpemU6IHN0cmluZztcbiAgLyoqIOacgOWkp+ODleOCoeOCpOODq+OCteOCpOOCuu+8iOODkOOCpOODiOaVsO+8iSAqL1xuICBtYXhGaWxlU2l6ZUJ5dGVzOiBudW1iZXI7XG4gIC8qKiDjg6Hjg6Ljg6rliLbpmZDvvIjmloflrZfliJfooajoqJjvvIkgKi9cbiAgbWVtb3J5TGltaXQ6IHN0cmluZztcbiAgLyoqIOODoeODouODquWItumZkO+8iE1C77yJICovXG4gIG1lbW9yeUxpbWl0TUI6IG51bWJlcjtcbiAgLyoqIOS4puWIl+WHpueQhuOCkuacieWKueOBq+OBmeOCi+OBiyAqL1xuICBwYXJhbGxlbFByb2Nlc3Npbmc6IGJvb2xlYW47XG4gIC8qKiDmnIDlpKflkIzmmYLlh6bnkIbmlbAgKi9cbiAgbWF4Q29uY3VycmVudFByb2Nlc3NlczogbnVtYmVyO1xufVxuXG4vKipcbiAqIOODleOCqeODvOODq+ODkOODg+OCr+apn+iDveioreWumlxuICovXG5leHBvcnQgaW50ZXJmYWNlIEZhbGxiYWNrQ29uZmlnIHtcbiAgLyoqIOODleOCqeODvOODq+ODkOODg+OCr+apn+iDveOCkuacieWKueOBq+OBmeOCi+OBiyAqL1xuICBlbmFibGVkOiBib29sZWFuO1xuICAvKiogTWFya2l0ZG93buWkseaVl+aZguOBq0xhbmdDaGFpbuOCkuS9v+eUqOOBmeOCi+OBiyAqL1xuICB1c2VMYW5nQ2hhaW5PbkZhaWx1cmU6IGJvb2xlYW47XG4gIC8qKiDjg6rjg4jjg6njgqTlm57mlbAgKi9cbiAgcmV0cnlBdHRlbXB0czogbnVtYmVyO1xuICAvKiog44Oq44OI44Op44Kk6ZaT6ZqU77yI44Of44Oq56eS77yJICovXG4gIHJldHJ5RGVsYXlNczogbnVtYmVyO1xufVxuXG4vKipcbiAqIOOCu+OCreODpeODquODhuOCo+ioreWumlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFNlY3VyaXR5Q29uZmlnIHtcbiAgLyoqIOODleOCoeOCpOODq+OCv+OCpOODl+aknOiovOOCkuihjOOBhuOBiyAqL1xuICB2YWxpZGF0ZUZpbGVUeXBlOiBib29sZWFuO1xuICAvKiog44OV44Kh44Kk44Or44K144Kk44K65qSc6Ki844KS6KGM44GG44GLICovXG4gIHZhbGlkYXRlRmlsZVNpemU6IGJvb2xlYW47XG4gIC8qKiDkuIDmmYLjg5XjgqHjgqTjg6vjgpLmmpflj7fljJbjgZnjgovjgYsgKi9cbiAgZW5jcnlwdFRlbXBGaWxlczogYm9vbGVhbjtcbiAgLyoqIOS4gOaZguODleOCoeOCpOODq+OCkuiHquWLleWJiumZpOOBmeOCi+OBiyAqL1xuICBhdXRvRGVsZXRlVGVtcEZpbGVzOiBib29sZWFuO1xuICAvKiog5LiA5pmC44OV44Kh44Kk44Or5L+d5oyB5pmC6ZaT77yI5YiG77yJICovXG4gIHRlbXBGaWxlUmV0ZW50aW9uTWludXRlczogbnVtYmVyO1xuICAvKiog44Oe44Or44Km44Kn44Ki44K544Kt44Oj44Oz44KS5pyJ5Yq544Gr44GZ44KL44GLICovXG4gIGVuYWJsZU1hbHdhcmVTY2FuPzogYm9vbGVhbjtcbiAgLyoqIOioseWPr+OBleOCjOOCi01JTUXjgr/jgqTjg5fjga7jg6rjgrnjg4ggKi9cbiAgYWxsb3dlZE1pbWVUeXBlcz86IHN0cmluZ1tdO1xuICAvKiog44OV44Kh44Kk44Or5YaF5a6544Gu5qSc6Ki844KS6KGM44GG44GLICovXG4gIHZhbGlkYXRlRmlsZUNvbnRlbnQ/OiBib29sZWFuO1xuICAvKiog44K744Kt44Ol44Oq44OG44Kj44Ot44Kw44KS5pyJ5Yq544Gr44GZ44KL44GLICovXG4gIGVuYWJsZVNlY3VyaXR5TG9nZ2luZz86IGJvb2xlYW47XG59XG5cbi8qKlxuICog44Ot44Kw5Ye65Yqb6Kit5a6aXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgTG9nZ2luZ0NvbmZpZyB7XG4gIC8qKiDjg63jgrDjg6zjg5njg6sgKi9cbiAgbGV2ZWw6ICdkZWJ1ZycgfCAnaW5mbycgfCAnd2FybicgfCAnZXJyb3InO1xuICAvKiog6Kmz57Sw44Ot44Kw44KS5pyJ5Yq544Gr44GZ44KL44GLICovXG4gIGVuYWJsZURldGFpbGVkTG9nczogYm9vbGVhbjtcbiAgLyoqIOODkeODleOCqeODvOODnuODs+OCueODreOCsOOCkuacieWKueOBq+OBmeOCi+OBiyAqL1xuICBlbmFibGVQZXJmb3JtYW5jZUxvZ3M6IGJvb2xlYW47XG4gIC8qKiDjgqjjg6njg7zov73ot6HjgpLmnInlirnjgavjgZnjgovjgYsgKi9cbiAgZW5hYmxlRXJyb3JUcmFja2luZzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiDlpInmj5vlk4Hos6roqK3lrppcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBRdWFsaXR5Q29uZmlnIHtcbiAgLyoqIE9DUueyvuW6puioreWumiAqL1xuICBvY3JBY2N1cmFjeTogJ2xvdycgfCAnbWVkaXVtJyB8ICdoaWdoJztcbiAgLyoqIOODhuOCreOCueODiOaKveWHuuWTgeizqiAqL1xuICB0ZXh0RXh0cmFjdGlvblF1YWxpdHk6ICdsb3cnIHwgJ21lZGl1bScgfCAnaGlnaCc7XG4gIC8qKiDjg5Xjgqnjg7zjg57jg4Pjg4jkv53mjIHjgZnjgovjgYsgKi9cbiAgcHJlc2VydmVGb3JtYXR0aW5nOiBib29sZWFuO1xuICAvKiog55S75YOP44KS5L+d5oyB44GZ44KL44GLICovXG4gIHByZXNlcnZlSW1hZ2VzOiBib29sZWFuO1xufVxuXG4vKipcbiAqIOOCteODneODvOODiOOBleOCjOOCi+ODleOCoeOCpOODq+W9ouW8j+OBruWei+Wumue+qVxuICovXG5leHBvcnQgdHlwZSBTdXBwb3J0ZWRGaWxlRm9ybWF0ID0gXG4gIHwgJ2RvY3gnICAvLyBNaWNyb3NvZnQgV29yZFxuICB8ICd4bHN4JyAgLy8gTWljcm9zb2Z0IEV4Y2VsXG4gIHwgJ3BwdHgnICAvLyBNaWNyb3NvZnQgUG93ZXJQb2ludFxuICB8ICdwZGYnICAgLy8gUERG5paH5pu4XG4gIHwgJ3BuZycgICAvLyBQTkfnlLvlg49cbiAgfCAnanBnJyAgIC8vIEpQRUfnlLvlg49cbiAgfCAnanBlZycgIC8vIEpQRUfnlLvlg49cbiAgfCAnZ2lmJyAgIC8vIEdJRueUu+WDj1xuICB8ICdodG1sJyAgLy8gSFRNTOaWh+abuFxuICB8ICd4bWwnICAgLy8gWE1M5paH5pu4XG4gIHwgJ2NzdicgICAvLyBDU1bmlofmm7hcbiAgfCAndHN2JzsgIC8vIFRTVuaWh+abuFxuXG4vKipcbiAqIOODleOCoeOCpOODq+W9ouW8j+OBruOCq+ODhuOCtOODquWIhumhnlxuICovXG5leHBvcnQgY29uc3QgRklMRV9GT1JNQVRfQ0FURUdPUklFUyA9IHtcbiAgT0ZGSUNFOiBbJ2RvY3gnLCAneGxzeCcsICdwcHR4J10gYXMgY29uc3QsXG4gIERPQ1VNRU5UOiBbJ3BkZicsICdodG1sJywgJ3htbCddIGFzIGNvbnN0LFxuICBJTUFHRTogWydwbmcnLCAnanBnJywgJ2pwZWcnLCAnZ2lmJ10gYXMgY29uc3QsXG4gIERBVEE6IFsnY3N2JywgJ3RzdiddIGFzIGNvbnN0XG59IGFzIGNvbnN0O1xuXG4vKipcbiAqIOODleOCoeOCpOODq+W9ouW8j+OBruacgOWkp+OCteOCpOOCuuWItumZkO+8iOODkOOCpOODiO+8iVxuICovXG5leHBvcnQgY29uc3QgRklMRV9TSVpFX0xJTUlUUzogUmVjb3JkPFN1cHBvcnRlZEZpbGVGb3JtYXQsIG51bWJlcj4gPSB7XG4gIGRvY3g6IDUwICogMTAyNCAqIDEwMjQsICAvLyA1ME1CXG4gIHhsc3g6IDEwMCAqIDEwMjQgKiAxMDI0LCAvLyAxMDBNQlxuICBwcHR4OiAyMDAgKiAxMDI0ICogMTAyNCwgLy8gMjAwTUJcbiAgcGRmOiAxMDAgKiAxMDI0ICogMTAyNCwgIC8vIDEwME1CXG4gIHBuZzogMjAgKiAxMDI0ICogMTAyNCwgICAvLyAyME1CXG4gIGpwZzogMjAgKiAxMDI0ICogMTAyNCwgICAvLyAyME1CXG4gIGpwZWc6IDIwICogMTAyNCAqIDEwMjQsICAvLyAyME1CXG4gIGdpZjogMTAgKiAxMDI0ICogMTAyNCwgICAvLyAxME1CXG4gIGh0bWw6IDUgKiAxMDI0ICogMTAyNCwgICAvLyA1TUJcbiAgeG1sOiA1ICogMTAyNCAqIDEwMjQsICAgIC8vIDVNQlxuICBjc3Y6IDUwICogMTAyNCAqIDEwMjQsICAgLy8gNTBNQlxuICB0c3Y6IDUwICogMTAyNCAqIDEwMjQgICAgLy8gNTBNQlxufTtcblxuLyoqXG4gKiDlh6bnkIbmlrnms5Xjga7oqbPntLDmg4XloLFcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQcm9jZXNzaW5nTWV0aG9kRGV0YWlscyB7XG4gIC8qKiDkvb/nlKjjgZXjgozjgZ/lh6bnkIbmlrnms5UgKi9cbiAgbWV0aG9kOiAnbWFya2l0ZG93bicgfCAnbGFuZ2NoYWluJztcbiAgLyoqIOWHpueQhuaZgumWk++8iOODn+ODquenku+8iSAqL1xuICBwcm9jZXNzaW5nVGltZTogbnVtYmVyO1xuICAvKiog5aSJ5o+b5b6M44Gu5paH5a2X5pWwICovXG4gIG91dHB1dExlbmd0aDogbnVtYmVyO1xuICAvKiog5ZOB6LOq44K544Kz44Ki77yIMC0xMDDvvIkgKi9cbiAgcXVhbGl0eVNjb3JlOiBudW1iZXI7XG4gIC8qKiDjgqjjg6njg7zmg4XloLHvvIjlrZjlnKjjgZnjgovloLTlkIjvvIkgKi9cbiAgZXJyb3I/OiBNYXJraXRkb3duRXJyb3I7XG4gIC8qKiDmiJDlip/jgZfjgZ/jgYsgKi9cbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgLyoqIOODoeODouODquS9v+eUqOmHj++8iE1C77yJICovXG4gIG1lbW9yeVVzYWdlPzogbnVtYmVyO1xuICAvKiogQ1BV5L2/55So546H77yIJe+8iSAqL1xuICBjcHVVc2FnZT86IG51bWJlcjtcbiAgLyoqIOWHpueQhumWi+Wni+aZguWIuyAqL1xuICBzdGFydFRpbWU6IHN0cmluZztcbiAgLyoqIOWHpueQhuWujOS6huaZguWIuyAqL1xuICBlbmRUaW1lOiBzdHJpbmc7XG4gIC8qKiDkuK3plpPlh6bnkIbjgrnjg4bjg4Pjg5fjga7oqbPntLAgKi9cbiAgcHJvY2Vzc2luZ1N0ZXBzPzogUHJvY2Vzc2luZ1N0ZXBbXTtcbn1cblxuLyoqXG4gKiDlh6bnkIbjgrnjg4bjg4Pjg5fjga7oqbPntLDmg4XloLFcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBQcm9jZXNzaW5nU3RlcCB7XG4gIC8qKiDjgrnjg4bjg4Pjg5flkI0gKi9cbiAgc3RlcE5hbWU6IHN0cmluZztcbiAgLyoqIOOCueODhuODg+ODl+mWi+Wni+aZguWIuyAqL1xuICBzdGFydFRpbWU6IHN0cmluZztcbiAgLyoqIOOCueODhuODg+ODl+WujOS6huaZguWIuyAqL1xuICBlbmRUaW1lOiBzdHJpbmc7XG4gIC8qKiDjgrnjg4bjg4Pjg5flrp/ooYzmmYLplpPvvIjjg5/jg6rnp5LvvIkgKi9cbiAgZHVyYXRpb246IG51bWJlcjtcbiAgLyoqIOOCueODhuODg+ODl+OBruaIkOWKny/lpLHmlZcgKi9cbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgLyoqIOOCueODhuODg+ODl+WbuuacieOBruODoeOCv+ODh+ODvOOCvyAqL1xuICBtZXRhZGF0YT86IFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xufVxuXG4vKipcbiAqIOaWh+abuOWHpueQhuODoeOCv+ODh+ODvOOCv1xuICovXG5leHBvcnQgaW50ZXJmYWNlIERvY3VtZW50UHJvY2Vzc2luZ01ldGFkYXRhIHtcbiAgLyoqIOWFg+ODleOCoeOCpOODq+WQjSAqL1xuICBvcmlnaW5hbEZpbGVOYW1lOiBzdHJpbmc7XG4gIC8qKiDjg5XjgqHjgqTjg6vlvaLlvI8gKi9cbiAgZmlsZVR5cGU6IFN1cHBvcnRlZEZpbGVGb3JtYXQ7XG4gIC8qKiDjg5XjgqHjgqTjg6vjgrXjgqTjgrrvvIjjg5DjgqTjg4jvvIkgKi9cbiAgZmlsZVNpemU6IG51bWJlcjtcbiAgLyoqIOS9v+eUqOOBleOCjOOBn+WHpueQhuaIpueVpSAqL1xuICBwcm9jZXNzaW5nU3RyYXRlZ3k6IFByb2Nlc3NpbmdTdHJhdGVneTtcbiAgLyoqIOacgOe1gueahOOBq+mBuOaKnuOBleOCjOOBn+WHpueQhuaWueazlSAqL1xuICBzZWxlY3RlZE1ldGhvZDogJ21hcmtpdGRvd24nIHwgJ2xhbmdjaGFpbic7XG4gIC8qKiDoqabooYzjgZXjgozjgZ/lh6bnkIbmlrnms5Xjga7oqbPntLAgKi9cbiAgYXR0ZW1wdGVkTWV0aG9kczogUHJvY2Vzc2luZ01ldGhvZERldGFpbHNbXTtcbiAgLyoqIOe3j+WkieaPm+WHpueQhuaZgumWk++8iOODn+ODquenku+8iSAqL1xuICB0b3RhbENvbnZlcnNpb25UaW1lOiBudW1iZXI7XG4gIC8qKiDlpInmj5vlvozjga7jg57jg7zjgq/jg4Djgqbjg7PmloflrZfmlbAgKi9cbiAgbWFya2Rvd25MZW5ndGg6IG51bWJlcjtcbiAgLyoqIOWHpueQhumWi+Wni+aZguWIuyAqL1xuICBzdGFydFRpbWU6IHN0cmluZztcbiAgLyoqIOWHpueQhuWujOS6huaZguWIuyAqL1xuICBlbmRUaW1lOiBzdHJpbmc7XG4gIC8qKiDjgqjjg6njg7zmg4XloLHvvIjlrZjlnKjjgZnjgovloLTlkIjvvIkgKi9cbiAgZXJyb3JzPzogc3RyaW5nW107XG4gIC8qKiDorablkYrmg4XloLHvvIjlrZjlnKjjgZnjgovloLTlkIjvvIkgKi9cbiAgd2FybmluZ3M/OiBzdHJpbmdbXTtcbiAgLyoqIE9DUuOBjOS9v+eUqOOBleOCjOOBn+OBiyAqL1xuICBvY3JVc2VkPzogYm9vbGVhbjtcbiAgLyoqIOacgOe1gueahOOBquWkieaPm+WTgeizquOCueOCs+OCou+8iDAtMTAw77yJICovXG4gIGZpbmFsUXVhbGl0eVNjb3JlPzogbnVtYmVyO1xuICAvKiogTWFya2l0ZG93buOBjOWIqeeUqOOBleOCjOOBn+OBiyAqL1xuICBtYXJraXRkb3duVXNlZDogYm9vbGVhbjtcbiAgLyoqIExhbmdDaGFpbuOBjOWIqeeUqOOBleOCjOOBn+OBiyAqL1xuICBsYW5nY2hhaW5Vc2VkOiBib29sZWFuO1xuICAvKiog5ZOB6LOq5q+U6LyD44GM5a6f6KGM44GV44KM44Gf44GLICovXG4gIHF1YWxpdHlDb21wYXJpc29uUGVyZm9ybWVkPzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiDjgqjjg6njg7zjgrPjg7zjg4njga7lrprnvqlcbiAqL1xuZXhwb3J0IGVudW0gTWFya2l0ZG93bkVycm9yQ29kZSB7XG4gIENPTlZFUlNJT05fRkFJTEVEID0gJ0NPTlZFUlNJT05fRkFJTEVEJyxcbiAgVElNRU9VVF9FUlJPUiA9ICdUSU1FT1VUX0VSUk9SJyxcbiAgRklMRV9UT09fTEFSR0UgPSAnRklMRV9UT09fTEFSR0UnLFxuICBVTlNVUFBPUlRFRF9GT1JNQVQgPSAnVU5TVVBQT1JURURfRk9STUFUJyxcbiAgU0VDVVJJVFlfVklPTEFUSU9OID0gJ1NFQ1VSSVRZX1ZJT0xBVElPTicsXG4gIE1FTU9SWV9MSU1JVF9FWENFRURFRCA9ICdNRU1PUllfTElNSVRfRVhDRUVERUQnLFxuICBPQ1JfRkFJTEVEID0gJ09DUl9GQUlMRUQnLFxuICBORVRXT1JLX0VSUk9SID0gJ05FVFdPUktfRVJST1InXG59XG5cbi8qKlxuICog44Ko44Op44O85oOF5aCx44Gu6Kmz57Sw5a6a576pXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgTWFya2l0ZG93bkVycm9yIHtcbiAgLyoqIOOCqOODqeODvOOCs+ODvOODiSAqL1xuICBjb2RlOiBNYXJraXRkb3duRXJyb3JDb2RlO1xuICAvKiog44Ko44Op44O844Oh44OD44K744O844K4ICovXG4gIG1lc3NhZ2U6IHN0cmluZztcbiAgLyoqIOips+e0sOaDheWgsSAqL1xuICBkZXRhaWxzPzogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIC8qKiDjgqjjg6njg7znmbrnlJ/mmYLliLsgKi9cbiAgdGltZXN0YW1wOiBzdHJpbmc7XG4gIC8qKiDjgrnjgr/jg4Pjgq/jg4jjg6zjg7zjgrnvvIjplovnmbrnkrDlooPjga7jgb/vvIkgKi9cbiAgc3RhY2s/OiBzdHJpbmc7XG59XG5cbi8qKlxuICogTWFya2l0ZG93buWHpueQhue1kOaenFxuICovXG5leHBvcnQgaW50ZXJmYWNlIE1hcmtpdGRvd25Qcm9jZXNzaW5nUmVzdWx0IHtcbiAgLyoqIOWHpueQhuOBjOaIkOWKn+OBl+OBn+OBiyAqL1xuICBzdWNjZXNzOiBib29sZWFuO1xuICAvKiog5aSJ5o+b44GV44KM44Gf44Oe44O844Kv44OA44Km44Oz44OG44Kt44K544OIICovXG4gIG1hcmtkb3duQ29udGVudD86IHN0cmluZztcbiAgLyoqIOWHpueQhuODoeOCv+ODh+ODvOOCvyAqL1xuICBtZXRhZGF0YTogRG9jdW1lbnRQcm9jZXNzaW5nTWV0YWRhdGE7XG4gIC8qKiDjgqjjg6njg7zmg4XloLHvvIjlpLHmlZfmmYLvvIkgKi9cbiAgZXJyb3I/OiBNYXJraXRkb3duRXJyb3I7XG59XG5cbi8qKlxuICog55Kw5aKD5YilTWFya2l0ZG93buioreWumuOCquODvOODkOODvOODqeOCpOODiVxuICovXG5leHBvcnQgaW50ZXJmYWNlIEVudmlyb25tZW50TWFya2l0ZG93bkNvbmZpZyB7XG4gIC8qKiDplovnmbrnkrDlooPnlKjoqK3lrpogKi9cbiAgZGV2PzogUGFydGlhbDxNYXJraXRkb3duQ29uZmlnPjtcbiAgLyoqIOOCueODhuODvOOCuOODs+OCsOeSsOWig+eUqOioreWumiAqL1xuICBzdGFnaW5nPzogUGFydGlhbDxNYXJraXRkb3duQ29uZmlnPjtcbiAgLyoqIOacrOeVqueSsOWig+eUqOioreWumiAqL1xuICBwcm9kPzogUGFydGlhbDxNYXJraXRkb3duQ29uZmlnPjtcbn1cblxuLyoqXG4gKiDoqK3lrprlgKTjga7mpJzoqLzplqLmlbBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlTWFya2l0ZG93bkNvbmZpZyhjb25maWc6IFBhcnRpYWw8TWFya2l0ZG93bkNvbmZpZz4pOiBzdHJpbmdbXSB7XG4gIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcblxuICAvLyDln7rmnKzoqK3lrprjga7mpJzoqLxcbiAgaWYgKGNvbmZpZy5lbmFibGVkICE9PSB1bmRlZmluZWQgJiYgdHlwZW9mIGNvbmZpZy5lbmFibGVkICE9PSAnYm9vbGVhbicpIHtcbiAgICBlcnJvcnMucHVzaCgnZW5hYmxlZOioreWumuOBr2Jvb2xlYW7lnovjgafjgYLjgovlv4XopoHjgYzjgYLjgorjgb7jgZknKTtcbiAgfVxuXG4gIC8vIOOCteODneODvOODiOODleOCoeOCpOODq+W9ouW8j+OBruaknOiovFxuICBpZiAoY29uZmlnLnN1cHBvcnRlZEZvcm1hdHMpIHtcbiAgICBmb3IgKGNvbnN0IFtmb3JtYXQsIGZvcm1hdENvbmZpZ10gb2YgT2JqZWN0LmVudHJpZXMoY29uZmlnLnN1cHBvcnRlZEZvcm1hdHMpKSB7XG4gICAgICBjb25zdCBmb3JtYXRFcnJvcnMgPSB2YWxpZGF0ZUZvcm1hdENvbmZpZyhmb3JtYXQsIGZvcm1hdENvbmZpZyk7XG4gICAgICBlcnJvcnMucHVzaCguLi5mb3JtYXRFcnJvcnMpO1xuICAgIH1cbiAgfVxuXG4gIC8vIOODkeODleOCqeODvOODnuODs+OCueioreWumuOBruaknOiovFxuICBpZiAoY29uZmlnLnBlcmZvcm1hbmNlKSB7XG4gICAgaWYgKGNvbmZpZy5wZXJmb3JtYW5jZS5tYXhGaWxlU2l6ZUJ5dGVzICYmIGNvbmZpZy5wZXJmb3JtYW5jZS5tYXhGaWxlU2l6ZUJ5dGVzID4gNTAwICogMTAyNCAqIDEwMjQpIHtcbiAgICAgIGVycm9ycy5wdXNoKCfmnIDlpKfjg5XjgqHjgqTjg6vjgrXjgqTjgrrjga81MDBNQuOCkui2heOBiOOCi+OBk+OBqOOBr+OBp+OBjeOBvuOBm+OCkycpO1xuICAgIH1cbiAgICBpZiAoY29uZmlnLnBlcmZvcm1hbmNlLm1lbW9yeUxpbWl0TUIgJiYgY29uZmlnLnBlcmZvcm1hbmNlLm1lbW9yeUxpbWl0TUIgPiAzMDA4KSB7XG4gICAgICBlcnJvcnMucHVzaCgn44Oh44Oi44Oq5Yi26ZmQ44GvTGFtYmRh44Gu5pyA5aSn5YCkMzAwOE1C44KS6LaF44GI44KL44GT44Go44Gv44Gn44GN44G+44Gb44KTJyk7XG4gICAgfVxuICAgIGlmIChjb25maWcucGVyZm9ybWFuY2UubWF4Q29uY3VycmVudFByb2Nlc3NlcyAmJiBjb25maWcucGVyZm9ybWFuY2UubWF4Q29uY3VycmVudFByb2Nlc3NlcyA+IDEwKSB7XG4gICAgICBlcnJvcnMucHVzaCgn5pyA5aSn5ZCM5pmC5Yem55CG5pWw44GvMTDjgpLotoXjgYjjgovjgZPjgajjga/jgafjgY3jgb7jgZvjgpMnKTtcbiAgICB9XG4gICAgaWYgKGNvbmZpZy5wZXJmb3JtYW5jZS5tYXhDb25jdXJyZW50UHJvY2Vzc2VzICYmIGNvbmZpZy5wZXJmb3JtYW5jZS5tYXhDb25jdXJyZW50UHJvY2Vzc2VzIDwgMSkge1xuICAgICAgZXJyb3JzLnB1c2goJ+acgOWkp+WQjOaZguWHpueQhuaVsOOBrzHku6XkuIrjgafjgYLjgovlv4XopoHjgYzjgYLjgorjgb7jgZknKTtcbiAgICB9XG4gIH1cblxuICAvLyDjgrvjgq3jg6Xjg6rjg4bjgqPoqK3lrprjga7mpJzoqLxcbiAgaWYgKGNvbmZpZy5zZWN1cml0eT8udGVtcEZpbGVSZXRlbnRpb25NaW51dGVzICYmIGNvbmZpZy5zZWN1cml0eS50ZW1wRmlsZVJldGVudGlvbk1pbnV0ZXMgPiAxNDQwKSB7XG4gICAgZXJyb3JzLnB1c2goJ+S4gOaZguODleOCoeOCpOODq+S/neaMgeaZgumWk+OBrzI05pmC6ZaT77yIMTQ0MOWIhu+8ieOCkui2heOBiOOCi+OBk+OBqOOBr+OBp+OBjeOBvuOBm+OCkycpO1xuICB9XG5cbiAgcmV0dXJuIGVycm9ycztcbn1cblxuLyoqXG4gKiDjg5XjgqHjgqTjg6vlvaLlvI/oqK3lrprjga7mpJzoqLxcbiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVGb3JtYXRDb25maWcoZm9ybWF0OiBzdHJpbmcsIGZvcm1hdENvbmZpZzogRm9ybWF0Q29uZmlnKTogc3RyaW5nW10ge1xuICBjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG5cbiAgLy8g5Z+65pys6Kit5a6a44Gu5qSc6Ki8XG4gIGlmICh0eXBlb2YgZm9ybWF0Q29uZmlnLmVuYWJsZWQgIT09ICdib29sZWFuJykge1xuICAgIGVycm9ycy5wdXNoKGAke2Zvcm1hdH06IGVuYWJsZWToqK3lrprjga9ib29sZWFu5Z6L44Gn44GC44KL5b+F6KaB44GM44GC44KK44G+44GZYCk7XG4gIH1cblxuICBpZiAodHlwZW9mIGZvcm1hdENvbmZpZy50aW1lb3V0ICE9PSAnbnVtYmVyJyB8fCBmb3JtYXRDb25maWcudGltZW91dCA8PSAwKSB7XG4gICAgZXJyb3JzLnB1c2goYCR7Zm9ybWF0fTogdGltZW91dOioreWumuOBr+ato+OBruaVsOWApOOBp+OBguOCi+W/heimgeOBjOOBguOCiuOBvuOBmWApO1xuICB9XG5cbiAgaWYgKGZvcm1hdENvbmZpZy50aW1lb3V0ID4gOTAwKSB7IC8vIExhbWJkYeacgOWkp+Wun+ihjOaZgumWk1xuICAgIGVycm9ycy5wdXNoKGAke2Zvcm1hdH06IHRpbWVvdXToqK3lrprjga85MDDnp5LjgpLotoXjgYjjgovjgZPjgajjga/jgafjgY3jgb7jgZvjgpNgKTtcbiAgfVxuXG4gIC8vIOWHpueQhuaIpueVpeOBruaVtOWQiOaAp+aknOiovFxuICBjb25zdCBzdHJhdGVneUluZm8gPSBQUk9DRVNTSU5HX1NUUkFURUdZX0lORk9bZm9ybWF0Q29uZmlnLnByb2Nlc3NpbmdTdHJhdGVneV07XG4gIGlmICghc3RyYXRlZ3lJbmZvKSB7XG4gICAgZXJyb3JzLnB1c2goYCR7Zm9ybWF0fTog54Sh5Yq544Gq5Yem55CG5oim55Wl44GM5oyH5a6a44GV44KM44Gm44GE44G+44GZOiAke2Zvcm1hdENvbmZpZy5wcm9jZXNzaW5nU3RyYXRlZ3l9YCk7XG4gICAgcmV0dXJuIGVycm9ycztcbiAgfVxuXG4gIC8vIHVzZU1hcmtpdGRvd24vdXNlTGFuZ0NoYWlu44Go5Yem55CG5oim55Wl44Gu5pW05ZCI5oCn44OB44Kn44OD44KvXG4gIGlmIChmb3JtYXRDb25maWcudXNlTWFya2l0ZG93biAhPT0gc3RyYXRlZ3lJbmZvLnVzZU1hcmtpdGRvd24pIHtcbiAgICBlcnJvcnMucHVzaChgJHtmb3JtYXR9OiB1c2VNYXJraXRkb3du6Kit5a6a44GM5Yem55CG5oim55Wl44Go5LiA6Ie044GX44G+44Gb44KTYCk7XG4gIH1cblxuICBpZiAoZm9ybWF0Q29uZmlnLnVzZUxhbmdDaGFpbiAhPT0gc3RyYXRlZ3lJbmZvLnVzZUxhbmdDaGFpbikge1xuICAgIGVycm9ycy5wdXNoKGAke2Zvcm1hdH06IHVzZUxhbmdDaGFpbuioreWumuOBjOWHpueQhuaIpueVpeOBqOS4gOiHtOOBl+OBvuOBm+OCk2ApO1xuICB9XG5cbiAgLy8g5ZOB6LOq5q+U6LyD6Kit5a6a44Gu5pW05ZCI5oCn44OB44Kn44OD44KvXG4gIGlmIChmb3JtYXRDb25maWcuZW5hYmxlUXVhbGl0eUNvbXBhcmlzb24gJiYgIXN0cmF0ZWd5SW5mby5yZXF1aXJlc0NvbXBhcmlzb24pIHtcbiAgICBlcnJvcnMucHVzaChgJHtmb3JtYXR9OiDlk4Hos6rmr5TovIPjga8nYm90aC1jb21wYXJlJ+aIpueVpeOBp+OBruOBv+acieWKueOBp+OBmWApO1xuICB9XG5cbiAgcmV0dXJuIGVycm9ycztcbn1cblxuLyoqXG4gKiDjg5XjgqHjgqTjg6vlvaLlvI/jgYzmnInlirnjgYvjg4Hjgqfjg4Pjgq9cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRm9ybWF0RW5hYmxlZChjb25maWc6IE1hcmtpdGRvd25Db25maWcsIGZvcm1hdDogU3VwcG9ydGVkRmlsZUZvcm1hdCk6IGJvb2xlYW4ge1xuICByZXR1cm4gY29uZmlnLmVuYWJsZWQgJiYgXG4gICAgICAgICBjb25maWcuc3VwcG9ydGVkRm9ybWF0c1tmb3JtYXRdPy5lbmFibGVkID09PSB0cnVlO1xufVxuXG4vKipcbiAqIOODleOCoeOCpOODq+OCteOCpOOCuuOBjOWItumZkOWGheOBi+ODgeOCp+ODg+OCr1xuICovXG5leHBvcnQgZnVuY3Rpb24gaXNGaWxlU2l6ZVZhbGlkKGNvbmZpZzogTWFya2l0ZG93bkNvbmZpZywgZm9ybWF0OiBTdXBwb3J0ZWRGaWxlRm9ybWF0LCBzaXplQnl0ZXM6IG51bWJlcik6IGJvb2xlYW4ge1xuICBjb25zdCBmb3JtYXRMaW1pdCA9IEZJTEVfU0laRV9MSU1JVFNbZm9ybWF0XTtcbiAgY29uc3QgZ2xvYmFsTGltaXQgPSBjb25maWcucGVyZm9ybWFuY2UubWF4RmlsZVNpemVCeXRlcztcbiAgcmV0dXJuIHNpemVCeXRlcyA8PSBNYXRoLm1pbihmb3JtYXRMaW1pdCwgZ2xvYmFsTGltaXQpO1xufVxuXG4vKipcbiAqIOODleOCoeOCpOODq+W9ouW8j+OBq+WvvuOBl+OBpk1hcmtpdGRvd27jgpLkvb/nlKjjgZnjgovjgYvjg4Hjgqfjg4Pjgq9cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZFVzZU1hcmtpdGRvd24oY29uZmlnOiBNYXJraXRkb3duQ29uZmlnLCBmb3JtYXQ6IFN1cHBvcnRlZEZpbGVGb3JtYXQpOiBib29sZWFuIHtcbiAgY29uc3QgZm9ybWF0Q29uZmlnID0gY29uZmlnLnN1cHBvcnRlZEZvcm1hdHNbZm9ybWF0XTtcbiAgcmV0dXJuIGNvbmZpZy5lbmFibGVkICYmIFxuICAgICAgICAgZm9ybWF0Q29uZmlnPy5lbmFibGVkID09PSB0cnVlICYmIFxuICAgICAgICAgZm9ybWF0Q29uZmlnPy51c2VNYXJraXRkb3duID09PSB0cnVlO1xufVxuXG4vKipcbiAqIOODleOCoeOCpOODq+W9ouW8j+OBq+WvvuOBl+OBpkxhbmdDaGFpbuOCkuS9v+eUqOOBmeOCi+OBi+ODgeOCp+ODg+OCr1xuICovXG5leHBvcnQgZnVuY3Rpb24gc2hvdWxkVXNlTGFuZ0NoYWluKGNvbmZpZzogTWFya2l0ZG93bkNvbmZpZywgZm9ybWF0OiBTdXBwb3J0ZWRGaWxlRm9ybWF0KTogYm9vbGVhbiB7XG4gIGNvbnN0IGZvcm1hdENvbmZpZyA9IGNvbmZpZy5zdXBwb3J0ZWRGb3JtYXRzW2Zvcm1hdF07XG4gIHJldHVybiBmb3JtYXRDb25maWc/LmVuYWJsZWQgPT09IHRydWUgJiYgXG4gICAgICAgICBmb3JtYXRDb25maWc/LnVzZUxhbmdDaGFpbiA9PT0gdHJ1ZTtcbn1cblxuLyoqXG4gKiDlh6bnkIbmiKbnlaXjgavln7rjgaXjgYTjgablrp/ooYzpoIbluo/jgpLmsbrlrppcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFByb2Nlc3NpbmdPcmRlcihjb25maWc6IE1hcmtpdGRvd25Db25maWcsIGZvcm1hdDogU3VwcG9ydGVkRmlsZUZvcm1hdCk6ICgnbWFya2l0ZG93bicgfCAnbGFuZ2NoYWluJylbXSB7XG4gIGNvbnN0IGZvcm1hdENvbmZpZyA9IGNvbmZpZy5zdXBwb3J0ZWRGb3JtYXRzW2Zvcm1hdF07XG4gIGlmICghZm9ybWF0Q29uZmlnPy5lbmFibGVkKSByZXR1cm4gW107XG5cbiAgc3dpdGNoIChmb3JtYXRDb25maWcucHJvY2Vzc2luZ1N0cmF0ZWd5KSB7XG4gICAgY2FzZSAnbWFya2l0ZG93bi1vbmx5JzpcbiAgICAgIHJldHVybiBmb3JtYXRDb25maWcudXNlTWFya2l0ZG93biA/IFsnbWFya2l0ZG93biddIDogW107XG4gICAgY2FzZSAnbGFuZ2NoYWluLW9ubHknOlxuICAgICAgcmV0dXJuIGZvcm1hdENvbmZpZy51c2VMYW5nQ2hhaW4gPyBbJ2xhbmdjaGFpbiddIDogW107XG4gICAgY2FzZSAnbWFya2l0ZG93bi1maXJzdCc6XG4gICAgICBjb25zdCBtYXJraXRkb3duRmlyc3Q6ICgnbWFya2l0ZG93bicgfCAnbGFuZ2NoYWluJylbXSA9IFtdO1xuICAgICAgaWYgKGZvcm1hdENvbmZpZy51c2VNYXJraXRkb3duKSBtYXJraXRkb3duRmlyc3QucHVzaCgnbWFya2l0ZG93bicpO1xuICAgICAgaWYgKGZvcm1hdENvbmZpZy51c2VMYW5nQ2hhaW4pIG1hcmtpdGRvd25GaXJzdC5wdXNoKCdsYW5nY2hhaW4nKTtcbiAgICAgIHJldHVybiBtYXJraXRkb3duRmlyc3Q7XG4gICAgY2FzZSAnbGFuZ2NoYWluLWZpcnN0JzpcbiAgICAgIGNvbnN0IGxhbmdjaGFpbkZpcnN0OiAoJ21hcmtpdGRvd24nIHwgJ2xhbmdjaGFpbicpW10gPSBbXTtcbiAgICAgIGlmIChmb3JtYXRDb25maWcudXNlTGFuZ0NoYWluKSBsYW5nY2hhaW5GaXJzdC5wdXNoKCdsYW5nY2hhaW4nKTtcbiAgICAgIGlmIChmb3JtYXRDb25maWcudXNlTWFya2l0ZG93bikgbGFuZ2NoYWluRmlyc3QucHVzaCgnbWFya2l0ZG93bicpO1xuICAgICAgcmV0dXJuIGxhbmdjaGFpbkZpcnN0O1xuICAgIGNhc2UgJ2JvdGgtY29tcGFyZSc6XG4gICAgICBjb25zdCBib3RoOiAoJ21hcmtpdGRvd24nIHwgJ2xhbmdjaGFpbicpW10gPSBbXTtcbiAgICAgIGlmIChmb3JtYXRDb25maWcudXNlTWFya2l0ZG93bikgYm90aC5wdXNoKCdtYXJraXRkb3duJyk7XG4gICAgICBpZiAoZm9ybWF0Q29uZmlnLnVzZUxhbmdDaGFpbikgYm90aC5wdXNoKCdsYW5nY2hhaW4nKTtcbiAgICAgIHJldHVybiBib3RoO1xuICAgIGNhc2UgJ2F1dG8tc2VsZWN0JzpcbiAgICAgIHJldHVybiBnZXRBdXRvU2VsZWN0ZWRPcmRlcihmb3JtYXQpO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gW107XG4gIH1cbn1cblxuLyoqXG4gKiDjg5XjgqHjgqTjg6vlvaLlvI/jgavln7rjgaXjgY/oh6rli5Xpgbjmip7jg63jgrjjg4Pjgq9cbiAqL1xuZnVuY3Rpb24gZ2V0QXV0b1NlbGVjdGVkT3JkZXIoZm9ybWF0OiBTdXBwb3J0ZWRGaWxlRm9ybWF0KTogKCdtYXJraXRkb3duJyB8ICdsYW5nY2hhaW4nKVtdIHtcbiAgLy8gT2ZmaWNl5paH5pu4OiBNYXJraXRkb3du5YSq5YWIXG4gIGlmIChGSUxFX0ZPUk1BVF9DQVRFR09SSUVTLk9GRklDRS5pbmNsdWRlcyhmb3JtYXQgYXMgYW55KSkge1xuICAgIHJldHVybiBbJ21hcmtpdGRvd24nLCAnbGFuZ2NoYWluJ107XG4gIH1cbiAgLy8g55S75YOPOiBNYXJraXRkb3du44Gu44G/77yIT0NS5qmf6IO977yJXG4gIGlmIChGSUxFX0ZPUk1BVF9DQVRFR09SSUVTLklNQUdFLmluY2x1ZGVzKGZvcm1hdCBhcyBhbnkpKSB7XG4gICAgcmV0dXJuIFsnbWFya2l0ZG93biddO1xuICB9XG4gIC8vIOODh+ODvOOCv+ODleOCoeOCpOODqzogTGFuZ0NoYWlu44Gu44G/XG4gIGlmIChGSUxFX0ZPUk1BVF9DQVRFR09SSUVTLkRBVEEuaW5jbHVkZXMoZm9ybWF0IGFzIGFueSkpIHtcbiAgICByZXR1cm4gWydsYW5nY2hhaW4nXTtcbiAgfVxuICAvLyDjgZ3jga7ku5Y6IExhbmdDaGFpbuWEquWFiFxuICByZXR1cm4gWydsYW5nY2hhaW4nLCAnbWFya2l0ZG93biddO1xufVxuXG4vKipcbiAqIOWTgeizquavlOi8g+OBjOW/heimgeOBi+ODgeOCp+ODg+OCr1xuICovXG5leHBvcnQgZnVuY3Rpb24gc2hvdWxkUGVyZm9ybVF1YWxpdHlDb21wYXJpc29uKGNvbmZpZzogTWFya2l0ZG93bkNvbmZpZywgZm9ybWF0OiBTdXBwb3J0ZWRGaWxlRm9ybWF0KTogYm9vbGVhbiB7XG4gIGNvbnN0IGZvcm1hdENvbmZpZyA9IGNvbmZpZy5zdXBwb3J0ZWRGb3JtYXRzW2Zvcm1hdF07XG4gIHJldHVybiBmb3JtYXRDb25maWc/LmVuYWJsZVF1YWxpdHlDb21wYXJpc29uID09PSB0cnVlICYmXG4gICAgICAgICBmb3JtYXRDb25maWc/LnByb2Nlc3NpbmdTdHJhdGVneSA9PT0gJ2JvdGgtY29tcGFyZSc7XG59XG5cbi8qKlxuICog5Yem55CG44Oh44K/44OH44O844K/44GL44KJRW1iZWRkaW5n5oOF5aCx44KS5oq95Ye6XG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRW1iZWRkaW5nUHJvY2Vzc2luZ0luZm8ge1xuICAvKiog44OV44Kh44Kk44Or5ZCNICovXG4gIGZpbGVOYW1lOiBzdHJpbmc7XG4gIC8qKiDjg5XjgqHjgqTjg6vlvaLlvI8gKi9cbiAgZmlsZUZvcm1hdDogU3VwcG9ydGVkRmlsZUZvcm1hdDtcbiAgLyoqIE1hcmtpdGRvd27jgYzkvb/nlKjjgZXjgozjgZ/jgYsgKi9cbiAgdXNlZE1hcmtpdGRvd246IGJvb2xlYW47XG4gIC8qKiBMYW5nQ2hhaW7jgYzkvb/nlKjjgZXjgozjgZ/jgYsgKi9cbiAgdXNlZExhbmdDaGFpbjogYm9vbGVhbjtcbiAgLyoqIOacgOe1gueahOOBq+mBuOaKnuOBleOCjOOBn+WHpueQhuaWueazlSAqL1xuICBmaW5hbE1ldGhvZDogJ21hcmtpdGRvd24nIHwgJ2xhbmdjaGFpbic7XG4gIC8qKiDlh6bnkIbmiKbnlaUgKi9cbiAgc3RyYXRlZ3k6IFByb2Nlc3NpbmdTdHJhdGVneTtcbiAgLyoqIOWHpueQhuaZgumWk++8iOODn+ODquenku+8iSAqL1xuICBwcm9jZXNzaW5nVGltZTogbnVtYmVyO1xuICAvKiog5ZOB6LOq44K544Kz44KiICovXG4gIHF1YWxpdHlTY29yZT86IG51bWJlcjtcbiAgLyoqIOWHpueQhuaXpeaZgiAqL1xuICBwcm9jZXNzZWRBdDogc3RyaW5nO1xufVxuXG4vKipcbiAqIOWHpueQhuODoeOCv+ODh+ODvOOCv+OBi+OCiUVtYmVkZGluZ+aDheWgseOCkueUn+aIkFxuICovXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdEVtYmVkZGluZ0luZm8obWV0YWRhdGE6IERvY3VtZW50UHJvY2Vzc2luZ01ldGFkYXRhKTogRW1iZWRkaW5nUHJvY2Vzc2luZ0luZm8ge1xuICByZXR1cm4ge1xuICAgIGZpbGVOYW1lOiBtZXRhZGF0YS5vcmlnaW5hbEZpbGVOYW1lLFxuICAgIGZpbGVGb3JtYXQ6IG1ldGFkYXRhLmZpbGVUeXBlLFxuICAgIHVzZWRNYXJraXRkb3duOiBtZXRhZGF0YS5tYXJraXRkb3duVXNlZCxcbiAgICB1c2VkTGFuZ0NoYWluOiBtZXRhZGF0YS5sYW5nY2hhaW5Vc2VkLFxuICAgIGZpbmFsTWV0aG9kOiBtZXRhZGF0YS5zZWxlY3RlZE1ldGhvZCxcbiAgICBzdHJhdGVneTogbWV0YWRhdGEucHJvY2Vzc2luZ1N0cmF0ZWd5LFxuICAgIHByb2Nlc3NpbmdUaW1lOiBtZXRhZGF0YS50b3RhbENvbnZlcnNpb25UaW1lLFxuICAgIHF1YWxpdHlTY29yZTogbWV0YWRhdGEuZmluYWxRdWFsaXR5U2NvcmUsXG4gICAgcHJvY2Vzc2VkQXQ6IG1ldGFkYXRhLmVuZFRpbWVcbiAgfTtcbn1cblxuLyoqXG4gKiDlh6bnkIbmiKbnlaXjgYvjgonoqK3lrprjgpLoh6rli5XnlJ/miJBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlRm9ybWF0Q29uZmlnRnJvbVN0cmF0ZWd5KFxuICBzdHJhdGVneTogUHJvY2Vzc2luZ1N0cmF0ZWd5LFxuICB0aW1lb3V0OiBudW1iZXIgPSAzMCxcbiAgZGVzY3JpcHRpb246IHN0cmluZyA9ICcnLFxuICBvY3JFbmFibGVkOiBib29sZWFuID0gZmFsc2Vcbik6IE9taXQ8Rm9ybWF0Q29uZmlnLCAnZW5hYmxlZCc+IHtcbiAgY29uc3Qgc3RyYXRlZ3lJbmZvID0gUFJPQ0VTU0lOR19TVFJBVEVHWV9JTkZPW3N0cmF0ZWd5XTtcbiAgXG4gIHJldHVybiB7XG4gICAgdGltZW91dCxcbiAgICBkZXNjcmlwdGlvbixcbiAgICBvY3I6IG9jckVuYWJsZWQsXG4gICAgcHJvY2Vzc2luZ1N0cmF0ZWd5OiBzdHJhdGVneSxcbiAgICB1c2VNYXJraXRkb3duOiBzdHJhdGVneUluZm8udXNlTWFya2l0ZG93bixcbiAgICB1c2VMYW5nQ2hhaW46IHN0cmF0ZWd5SW5mby51c2VMYW5nQ2hhaW4sXG4gICAgZW5hYmxlUXVhbGl0eUNvbXBhcmlzb246IHN0cmF0ZWd5SW5mby5yZXF1aXJlc0NvbXBhcmlzb25cbiAgfTtcbn1cblxuLyoqXG4gKiDjg5XjgqHjgqTjg6vlvaLlvI/jgavmjqjlpajjgZXjgozjgovlh6bnkIbmiKbnlaXjgpLlj5blvpdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFJlY29tbWVuZGVkU3RyYXRlZ3koZm9ybWF0OiBTdXBwb3J0ZWRGaWxlRm9ybWF0KTogUHJvY2Vzc2luZ1N0cmF0ZWd5IHtcbiAgLy8gT2ZmaWNl5paH5pu4OiBNYXJraXRkb3du5YSq5YWIXG4gIGlmIChGSUxFX0ZPUk1BVF9DQVRFR09SSUVTLk9GRklDRS5pbmNsdWRlcyhmb3JtYXQgYXMgYW55KSkge1xuICAgIHJldHVybiAnbWFya2l0ZG93bi1maXJzdCc7XG4gIH1cbiAgXG4gIC8vIOeUu+WDjzogTWFya2l0ZG93buOBruOBv++8iE9DUuapn+iDve+8iVxuICBpZiAoRklMRV9GT1JNQVRfQ0FURUdPUklFUy5JTUFHRS5pbmNsdWRlcyhmb3JtYXQgYXMgYW55KSkge1xuICAgIHJldHVybiAnbWFya2l0ZG93bi1vbmx5JztcbiAgfVxuICBcbiAgLy8g44OH44O844K/44OV44Kh44Kk44OrOiBMYW5nQ2hhaW7jga7jgb9cbiAgaWYgKEZJTEVfRk9STUFUX0NBVEVHT1JJRVMuREFUQS5pbmNsdWRlcyhmb3JtYXQgYXMgYW55KSkge1xuICAgIHJldHVybiAnbGFuZ2NoYWluLW9ubHknO1xuICB9XG4gIFxuICAvLyBQREY6IOWTgeizquavlOi8g1xuICBpZiAoZm9ybWF0ID09PSAncGRmJykge1xuICAgIHJldHVybiAnYm90aC1jb21wYXJlJztcbiAgfVxuICBcbiAgLy8g44Gd44Gu5LuWOiBMYW5nQ2hhaW7lhKrlhYhcbiAgcmV0dXJuICdsYW5nY2hhaW4tZmlyc3QnO1xufVxuXG4vKipcbiAqIOioreWumuOBruaVtOWQiOaAp+OCkuiHquWLleS/ruato1xuICovXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplRm9ybWF0Q29uZmlnKGNvbmZpZzogRm9ybWF0Q29uZmlnKTogRm9ybWF0Q29uZmlnIHtcbiAgY29uc3Qgc3RyYXRlZ3lJbmZvID0gUFJPQ0VTU0lOR19TVFJBVEVHWV9JTkZPW2NvbmZpZy5wcm9jZXNzaW5nU3RyYXRlZ3ldO1xuICBcbiAgcmV0dXJuIHtcbiAgICAuLi5jb25maWcsXG4gICAgdXNlTWFya2l0ZG93bjogc3RyYXRlZ3lJbmZvLnVzZU1hcmtpdGRvd24sXG4gICAgdXNlTGFuZ0NoYWluOiBzdHJhdGVneUluZm8udXNlTGFuZ0NoYWluLFxuICAgIGVuYWJsZVF1YWxpdHlDb21wYXJpc29uOiBzdHJhdGVneUluZm8ucmVxdWlyZXNDb21wYXJpc29uID8gY29uZmlnLmVuYWJsZVF1YWxpdHlDb21wYXJpc29uIDogZmFsc2VcbiAgfTtcbn1cblxuLyoqXG4gKiDjg4fjg5Xjgqnjg6vjg4jjga5NYXJraXRkb3du6Kit5a6aXG4gKi9cbmV4cG9ydCBjb25zdCBERUZBVUxUX01BUktJVERPV05fQ09ORklHOiBNYXJraXRkb3duQ29uZmlnID0ge1xuICBlbmFibGVkOiB0cnVlLFxuICBzdXBwb3J0ZWRGb3JtYXRzOiB7XG4gICAgZG9jeDogeyBcbiAgICAgIGVuYWJsZWQ6IHRydWUsIFxuICAgICAgdGltZW91dDogMzAsIFxuICAgICAgZGVzY3JpcHRpb246ICdNaWNyb3NvZnQgV29yZOaWh+abuCcsXG4gICAgICBwcm9jZXNzaW5nU3RyYXRlZ3k6ICdtYXJraXRkb3duLWZpcnN0JyxcbiAgICAgIHVzZU1hcmtpdGRvd246IHRydWUsXG4gICAgICB1c2VMYW5nQ2hhaW46IHRydWUsXG4gICAgICBlbmFibGVRdWFsaXR5Q29tcGFyaXNvbjogZmFsc2VcbiAgICB9LFxuICAgIHhsc3g6IHsgXG4gICAgICBlbmFibGVkOiB0cnVlLCBcbiAgICAgIHRpbWVvdXQ6IDQ1LCBcbiAgICAgIGRlc2NyaXB0aW9uOiAnTWljcm9zb2Z0IEV4Y2Vs5paH5pu4JyxcbiAgICAgIHByb2Nlc3NpbmdTdHJhdGVneTogJ21hcmtpdGRvd24tZmlyc3QnLFxuICAgICAgdXNlTWFya2l0ZG93bjogdHJ1ZSxcbiAgICAgIHVzZUxhbmdDaGFpbjogdHJ1ZSxcbiAgICAgIGVuYWJsZVF1YWxpdHlDb21wYXJpc29uOiBmYWxzZVxuICAgIH0sXG4gICAgcHB0eDogeyBcbiAgICAgIGVuYWJsZWQ6IHRydWUsIFxuICAgICAgdGltZW91dDogNjAsIFxuICAgICAgZGVzY3JpcHRpb246ICdNaWNyb3NvZnQgUG93ZXJQb2ludOaWh+abuCcsXG4gICAgICBwcm9jZXNzaW5nU3RyYXRlZ3k6ICdtYXJraXRkb3duLWZpcnN0JyxcbiAgICAgIHVzZU1hcmtpdGRvd246IHRydWUsXG4gICAgICB1c2VMYW5nQ2hhaW46IHRydWUsXG4gICAgICBlbmFibGVRdWFsaXR5Q29tcGFyaXNvbjogZmFsc2VcbiAgICB9LFxuICAgIHBkZjogeyBcbiAgICAgIGVuYWJsZWQ6IHRydWUsIFxuICAgICAgdGltZW91dDogMTIwLCBcbiAgICAgIG9jcjogdHJ1ZSwgXG4gICAgICBkZXNjcmlwdGlvbjogJ1BERuaWh+abuO+8iE9DUuWvvuW/nO+8iScsXG4gICAgICBwcm9jZXNzaW5nU3RyYXRlZ3k6ICdib3RoLWNvbXBhcmUnLFxuICAgICAgdXNlTWFya2l0ZG93bjogdHJ1ZSxcbiAgICAgIHVzZUxhbmdDaGFpbjogdHJ1ZSxcbiAgICAgIGVuYWJsZVF1YWxpdHlDb21wYXJpc29uOiB0cnVlXG4gICAgfSxcbiAgICBwbmc6IHsgXG4gICAgICBlbmFibGVkOiB0cnVlLCBcbiAgICAgIHRpbWVvdXQ6IDkwLCBcbiAgICAgIG9jcjogdHJ1ZSwgXG4gICAgICBkZXNjcmlwdGlvbjogJ1BOR+eUu+WDj++8iE9DUuWvvuW/nO+8iScsXG4gICAgICBwcm9jZXNzaW5nU3RyYXRlZ3k6ICdtYXJraXRkb3duLW9ubHknLFxuICAgICAgdXNlTWFya2l0ZG93bjogdHJ1ZSxcbiAgICAgIHVzZUxhbmdDaGFpbjogZmFsc2UsXG4gICAgICBlbmFibGVRdWFsaXR5Q29tcGFyaXNvbjogZmFsc2VcbiAgICB9LFxuICAgIGpwZzogeyBcbiAgICAgIGVuYWJsZWQ6IHRydWUsIFxuICAgICAgdGltZW91dDogOTAsIFxuICAgICAgb2NyOiB0cnVlLCBcbiAgICAgIGRlc2NyaXB0aW9uOiAnSlBFR+eUu+WDj++8iE9DUuWvvuW/nO+8iScsXG4gICAgICBwcm9jZXNzaW5nU3RyYXRlZ3k6ICdtYXJraXRkb3duLW9ubHknLFxuICAgICAgdXNlTWFya2l0ZG93bjogdHJ1ZSxcbiAgICAgIHVzZUxhbmdDaGFpbjogZmFsc2UsXG4gICAgICBlbmFibGVRdWFsaXR5Q29tcGFyaXNvbjogZmFsc2VcbiAgICB9LFxuICAgIGpwZWc6IHsgXG4gICAgICBlbmFibGVkOiB0cnVlLCBcbiAgICAgIHRpbWVvdXQ6IDkwLCBcbiAgICAgIG9jcjogdHJ1ZSwgXG4gICAgICBkZXNjcmlwdGlvbjogJ0pQRUfnlLvlg4/vvIhPQ1Llr77lv5zvvIknLFxuICAgICAgcHJvY2Vzc2luZ1N0cmF0ZWd5OiAnbWFya2l0ZG93bi1vbmx5JyxcbiAgICAgIHVzZU1hcmtpdGRvd246IHRydWUsXG4gICAgICB1c2VMYW5nQ2hhaW46IGZhbHNlLFxuICAgICAgZW5hYmxlUXVhbGl0eUNvbXBhcmlzb246IGZhbHNlXG4gICAgfSxcbiAgICBnaWY6IHsgXG4gICAgICBlbmFibGVkOiB0cnVlLCBcbiAgICAgIHRpbWVvdXQ6IDkwLCBcbiAgICAgIG9jcjogdHJ1ZSwgXG4gICAgICBkZXNjcmlwdGlvbjogJ0dJRueUu+WDj++8iE9DUuWvvuW/nO+8iScsXG4gICAgICBwcm9jZXNzaW5nU3RyYXRlZ3k6ICdtYXJraXRkb3duLW9ubHknLFxuICAgICAgdXNlTWFya2l0ZG93bjogdHJ1ZSxcbiAgICAgIHVzZUxhbmdDaGFpbjogZmFsc2UsXG4gICAgICBlbmFibGVRdWFsaXR5Q29tcGFyaXNvbjogZmFsc2VcbiAgICB9LFxuICAgIGh0bWw6IHsgXG4gICAgICBlbmFibGVkOiB0cnVlLCBcbiAgICAgIHRpbWVvdXQ6IDMwLCBcbiAgICAgIGRlc2NyaXB0aW9uOiAnSFRNTOaWh+abuCcsXG4gICAgICBwcm9jZXNzaW5nU3RyYXRlZ3k6ICdsYW5nY2hhaW4tZmlyc3QnLFxuICAgICAgdXNlTWFya2l0ZG93bjogdHJ1ZSxcbiAgICAgIHVzZUxhbmdDaGFpbjogdHJ1ZSxcbiAgICAgIGVuYWJsZVF1YWxpdHlDb21wYXJpc29uOiBmYWxzZVxuICAgIH0sXG4gICAgeG1sOiB7IFxuICAgICAgZW5hYmxlZDogdHJ1ZSwgXG4gICAgICB0aW1lb3V0OiAzMCwgXG4gICAgICBkZXNjcmlwdGlvbjogJ1hNTOaWh+abuCcsXG4gICAgICBwcm9jZXNzaW5nU3RyYXRlZ3k6ICdsYW5nY2hhaW4tZmlyc3QnLFxuICAgICAgdXNlTWFya2l0ZG93bjogdHJ1ZSxcbiAgICAgIHVzZUxhbmdDaGFpbjogdHJ1ZSxcbiAgICAgIGVuYWJsZVF1YWxpdHlDb21wYXJpc29uOiBmYWxzZVxuICAgIH0sXG4gICAgY3N2OiB7IFxuICAgICAgZW5hYmxlZDogdHJ1ZSwgXG4gICAgICB0aW1lb3V0OiAxNSwgXG4gICAgICBkZXNjcmlwdGlvbjogJ0NTVuaWh+abuCcsXG4gICAgICBwcm9jZXNzaW5nU3RyYXRlZ3k6ICdsYW5nY2hhaW4tb25seScsXG4gICAgICB1c2VNYXJraXRkb3duOiBmYWxzZSxcbiAgICAgIHVzZUxhbmdDaGFpbjogdHJ1ZSxcbiAgICAgIGVuYWJsZVF1YWxpdHlDb21wYXJpc29uOiBmYWxzZVxuICAgIH0sXG4gICAgdHN2OiB7IFxuICAgICAgZW5hYmxlZDogdHJ1ZSwgXG4gICAgICB0aW1lb3V0OiAxNSwgXG4gICAgICBkZXNjcmlwdGlvbjogJ1RTVuaWh+abuCcsXG4gICAgICBwcm9jZXNzaW5nU3RyYXRlZ3k6ICdsYW5nY2hhaW4tb25seScsXG4gICAgICB1c2VNYXJraXRkb3duOiBmYWxzZSxcbiAgICAgIHVzZUxhbmdDaGFpbjogdHJ1ZSxcbiAgICAgIGVuYWJsZVF1YWxpdHlDb21wYXJpc29uOiBmYWxzZVxuICAgIH1cbiAgfSxcbiAgcGVyZm9ybWFuY2U6IHtcbiAgICBtYXhGaWxlU2l6ZTogJzEwTUInLFxuICAgIG1heEZpbGVTaXplQnl0ZXM6IDEwNDg1NzYwLFxuICAgIG1lbW9yeUxpbWl0OiAnMTAyNE1CJyxcbiAgICBtZW1vcnlMaW1pdE1COiAxMDI0LFxuICAgIHBhcmFsbGVsUHJvY2Vzc2luZzogdHJ1ZSxcbiAgICBtYXhDb25jdXJyZW50UHJvY2Vzc2VzOiAzXG4gIH0sXG4gIGZhbGxiYWNrOiB7XG4gICAgZW5hYmxlZDogdHJ1ZSxcbiAgICB1c2VMYW5nQ2hhaW5PbkZhaWx1cmU6IHRydWUsXG4gICAgcmV0cnlBdHRlbXB0czogMixcbiAgICByZXRyeURlbGF5TXM6IDEwMDBcbiAgfSxcbiAgc2VjdXJpdHk6IHtcbiAgICB2YWxpZGF0ZUZpbGVUeXBlOiB0cnVlLFxuICAgIHZhbGlkYXRlRmlsZVNpemU6IHRydWUsXG4gICAgZW5jcnlwdFRlbXBGaWxlczogdHJ1ZSxcbiAgICBhdXRvRGVsZXRlVGVtcEZpbGVzOiB0cnVlLFxuICAgIHRlbXBGaWxlUmV0ZW50aW9uTWludXRlczogMzBcbiAgfSxcbiAgbG9nZ2luZzoge1xuICAgIGxldmVsOiAnaW5mbycsXG4gICAgZW5hYmxlRGV0YWlsZWRMb2dzOiB0cnVlLFxuICAgIGVuYWJsZVBlcmZvcm1hbmNlTG9nczogdHJ1ZSxcbiAgICBlbmFibGVFcnJvclRyYWNraW5nOiB0cnVlXG4gIH0sXG4gIHF1YWxpdHk6IHtcbiAgICBvY3JBY2N1cmFjeTogJ2hpZ2gnLFxuICAgIHRleHRFeHRyYWN0aW9uUXVhbGl0eTogJ2hpZ2gnLFxuICAgIHByZXNlcnZlRm9ybWF0dGluZzogdHJ1ZSxcbiAgICBwcmVzZXJ2ZUltYWdlczogZmFsc2VcbiAgfVxufTtcblxuLyoqXG4gKiDnkrDlooPliKXjg4fjg5Xjgqnjg6vjg4joqK3lrppcbiAqL1xuZXhwb3J0IGNvbnN0IEVOVklST05NRU5UX0RFRkFVTFRTOiBFbnZpcm9ubWVudE1hcmtpdGRvd25Db25maWcgPSB7XG4gIGRldjoge1xuICAgIGxvZ2dpbmc6IHtcbiAgICAgIGxldmVsOiAnZGVidWcnLFxuICAgICAgZW5hYmxlRGV0YWlsZWRMb2dzOiB0cnVlLFxuICAgICAgZW5hYmxlUGVyZm9ybWFuY2VMb2dzOiB0cnVlLFxuICAgICAgZW5hYmxlRXJyb3JUcmFja2luZzogdHJ1ZVxuICAgIH0sXG4gICAgcGVyZm9ybWFuY2U6IHtcbiAgICAgIG1heEZpbGVTaXplOiAnNU1CJyxcbiAgICAgIG1heEZpbGVTaXplQnl0ZXM6IDUyNDI4ODAsXG4gICAgICBtZW1vcnlMaW1pdDogJzUxMk1CJyxcbiAgICAgIG1lbW9yeUxpbWl0TUI6IDUxMixcbiAgICAgIHBhcmFsbGVsUHJvY2Vzc2luZzogZmFsc2UsXG4gICAgICBtYXhDb25jdXJyZW50UHJvY2Vzc2VzOiAxXG4gICAgfVxuICB9LFxuICBzdGFnaW5nOiB7XG4gICAgbG9nZ2luZzoge1xuICAgICAgbGV2ZWw6ICdpbmZvJyxcbiAgICAgIGVuYWJsZURldGFpbGVkTG9nczogdHJ1ZSxcbiAgICAgIGVuYWJsZVBlcmZvcm1hbmNlTG9nczogdHJ1ZSxcbiAgICAgIGVuYWJsZUVycm9yVHJhY2tpbmc6IHRydWVcbiAgICB9LFxuICAgIHBlcmZvcm1hbmNlOiB7XG4gICAgICBtYXhGaWxlU2l6ZTogJzEwTUInLFxuICAgICAgbWF4RmlsZVNpemVCeXRlczogMTA0ODU3NjAsXG4gICAgICBtZW1vcnlMaW1pdDogJzEwMjRNQicsXG4gICAgICBtZW1vcnlMaW1pdE1COiAxMDI0LFxuICAgICAgcGFyYWxsZWxQcm9jZXNzaW5nOiB0cnVlLFxuICAgICAgbWF4Q29uY3VycmVudFByb2Nlc3NlczogMlxuICAgIH1cbiAgfSxcbiAgcHJvZDoge1xuICAgIGxvZ2dpbmc6IHtcbiAgICAgIGxldmVsOiAnd2FybicsXG4gICAgICBlbmFibGVEZXRhaWxlZExvZ3M6IGZhbHNlLFxuICAgICAgZW5hYmxlUGVyZm9ybWFuY2VMb2dzOiB0cnVlLFxuICAgICAgZW5hYmxlRXJyb3JUcmFja2luZzogdHJ1ZVxuICAgIH0sXG4gICAgcGVyZm9ybWFuY2U6IHtcbiAgICAgIG1heEZpbGVTaXplOiAnNTBNQicsXG4gICAgICBtYXhGaWxlU2l6ZUJ5dGVzOiA1MjQyODgwMCxcbiAgICAgIG1lbW9yeUxpbWl0OiAnMzAwOE1CJyxcbiAgICAgIG1lbW9yeUxpbWl0TUI6IDMwMDgsXG4gICAgICBwYXJhbGxlbFByb2Nlc3Npbmc6IHRydWUsXG4gICAgICBtYXhDb25jdXJyZW50UHJvY2Vzc2VzOiA1XG4gICAgfVxuICB9XG59OyJdfQ==