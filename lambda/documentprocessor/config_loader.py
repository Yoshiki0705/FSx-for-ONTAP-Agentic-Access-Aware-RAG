"""
Markitdown設定ローダー (Lambda用)
Lambda環境でのMarkitdown設定読み込み機能
"""

import json
import os
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# デフォルト設定
DEFAULT_MARKITDOWN_CONFIG = {
    "enabled": True,
    "supportedFormats": {
        "docx": {
            "enabled": True,
            "timeout": 30,
            "description": "Microsoft Word文書",
            "processingStrategy": "markitdown-first",
            "useMarkitdown": True,
            "useLangChain": True,
            "enableQualityComparison": False
        },
        "xlsx": {
            "enabled": True,
            "timeout": 45,
            "description": "Microsoft Excel文書",
            "processingStrategy": "markitdown-first",
            "useMarkitdown": True,
            "useLangChain": True,
            "enableQualityComparison": False
        },
        "pptx": {
            "enabled": True,
            "timeout": 60,
            "description": "Microsoft PowerPoint文書",
            "processingStrategy": "markitdown-first",
            "useMarkitdown": True,
            "useLangChain": True,
            "enableQualityComparison": False
        },
        "pdf": {
            "enabled": True,
            "timeout": 120,
            "ocr": True,
            "description": "PDF文書（OCR対応）",
            "processingStrategy": "both-compare",
            "useMarkitdown": True,
            "useLangChain": True,
            "enableQualityComparison": True
        },
        "png": {
            "enabled": True,
            "timeout": 90,
            "ocr": True,
            "description": "PNG画像（OCR対応）",
            "processingStrategy": "markitdown-only",
            "useMarkitdown": True,
            "useLangChain": False,
            "enableQualityComparison": False
        },
        "jpg": {
            "enabled": True,
            "timeout": 90,
            "ocr": True,
            "description": "JPEG画像（OCR対応）",
            "processingStrategy": "markitdown-only",
            "useMarkitdown": True,
            "useLangChain": False,
            "enableQualityComparison": False
        },
        "jpeg": {
            "enabled": True,
            "timeout": 90,
            "ocr": True,
            "description": "JPEG画像（OCR対応）",
            "processingStrategy": "markitdown-only",
            "useMarkitdown": True,
            "useLangChain": False,
            "enableQualityComparison": False
        },
        "gif": {
            "enabled": True,
            "timeout": 90,
            "ocr": True,
            "description": "GIF画像（OCR対応）",
            "processingStrategy": "markitdown-only",
            "useMarkitdown": True,
            "useLangChain": False,
            "enableQualityComparison": False
        },
        "html": {
            "enabled": True,
            "timeout": 30,
            "description": "HTML文書",
            "processingStrategy": "langchain-first",
            "useMarkitdown": True,
            "useLangChain": True,
            "enableQualityComparison": False
        },
        "xml": {
            "enabled": True,
            "timeout": 30,
            "description": "XML文書",
            "processingStrategy": "langchain-first",
            "useMarkitdown": True,
            "useLangChain": True,
            "enableQualityComparison": False
        },
        "csv": {
            "enabled": True,
            "timeout": 15,
            "description": "CSV文書",
            "processingStrategy": "langchain-only",
            "useMarkitdown": False,
            "useLangChain": True,
            "enableQualityComparison": False
        },
        "tsv": {
            "enabled": True,
            "timeout": 15,
            "description": "TSV文書",
            "processingStrategy": "langchain-only",
            "useMarkitdown": False,
            "useLangChain": True,
            "enableQualityComparison": False
        }
    },
    "performance": {
        "maxFileSize": "10MB",
        "maxFileSizeBytes": 10485760,
        "memoryLimit": "1024MB",
        "memoryLimitMB": 1024,
        "parallelProcessing": True,
        "maxConcurrentProcesses": 3
    },
    "fallback": {
        "enabled": True,
        "useLangChainOnFailure": True,
        "retryAttempts": 2,
        "retryDelayMs": 1000
    },
    "security": {
        "validateFileType": True,
        "validateFileSize": True,
        "encryptTempFiles": True,
        "autoDeleteTempFiles": True,
        "tempFileRetentionMinutes": 30
    },
    "logging": {
        "level": "info",
        "enableDetailedLogs": True,
        "enablePerformanceLogs": True,
        "enableErrorTracking": True
    },
    "quality": {
        "ocrAccuracy": "high",
        "textExtractionQuality": "high",
        "preserveFormatting": True,
        "preserveImages": False
    }
}

# 環境別オーバーライド設定
ENVIRONMENT_OVERRIDES = {
    "dev": {
        "supportedFormats": {
            "docx": {
                "processingStrategy": "markitdown-only",
                "useMarkitdown": True,
                "useLangChain": False
            },
            "pdf": {
                "processingStrategy": "langchain-only",
                "useMarkitdown": False,
                "useLangChain": True,
                "ocr": False
            },
            "png": {"enabled": False},
            "jpg": {"enabled": False},
            "jpeg": {"enabled": False},
            "gif": {"enabled": False}
        },
        "performance": {
            "maxFileSize": "5MB",
            "maxFileSizeBytes": 5242880,
            "parallelProcessing": False,
            "maxConcurrentProcesses": 1
        },
        "logging": {
            "level": "debug",
            "enableDetailedLogs": True
        }
    },
    "staging": {
        "performance": {
            "maxFileSize": "8MB",
            "maxFileSizeBytes": 8388608,
            "parallelProcessing": True,
            "maxConcurrentProcesses": 2
        },
        "logging": {
            "level": "info",
            "enableDetailedLogs": True
        }
    },
    "prod": {
        "performance": {
            "maxFileSize": "10MB",
            "maxFileSizeBytes": 10485760,
            "parallelProcessing": True,
            "maxConcurrentProcesses": 3
        },
        "fallback": {
            "retryAttempts": 3,
            "retryDelayMs": 2000
        },
        "security": {
            "tempFileRetentionMinutes": 15
           
    },
        "logging": {
            "level": "warn",
            "enableDetailedLogs": False
        }
    }
}

def deep_merge(base_dict: Dict, override_dict: Dict) -> Dict:
    """辞書の深いマージ"""
    result = base_dict.copy()
    
    for key, value in override_dict.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    
    return result

def load_markitdown_config(environment: str = "prod") -> Dict[str, Any]:
    """
    Markitdown設定を読み込む
    
    Args:
        environment: 環境名 (dev, staging, prod)
    
    Returns:
        Markitdown設定辞書
    """
    try:
        # 環境変数から設定パスを取得
        config_path = os.environ.get('MARKITDOWN_CONFIG_PATH')
        
        # 基本設定を開始点とする
        config = DEFAULT_MARKITDOWN_CONFIG.copy()
        
        # 外部設定ファイルがある場合は読み込み
        if config_path and os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    external_config = json.load(f)
                    if 'markitdown' in external_config:
                        config = deep_merge(config, external_config['markitdown'])
                        logger.info(f"外部設定ファイルを読み込みました: {config_path}")
            except Exception as e:
                logger.warning(f"外部設定ファイルの読み込みに失敗: {e}")
        
        # 環境別オーバーライドを適用
        if environment in ENVIRONMENT_OVERRIDES:
            config = deep_merge(config, ENVIRONMENT_OVERRIDES[environment])
            logger.info(f"環境別設定を適用しました: {environment}")
        
        # 環境変数からの個別設定オーバーライド
        if os.environ.get('MARKITDOWN_ENABLED'):
            config['enabled'] = os.environ.get('MARKITDOWN_ENABLED').lower() == 'true'
        
        if os.environ.get('MARKITDOWN_MAX_FILE_SIZE'):
            try:
                max_size = int(os.environ.get('MARKITDOWN_MAX_FILE_SIZE'))
                config['performance']['maxFileSizeBytes'] = max_size
                # MB表記も更新
                config['performance']['maxFileSize'] = f"{max_size // (1024*1024)}MB"
            except ValueError:
                logger.warning("MARKITDOWN_MAX_FILE_SIZE環境変数の値が無効です")
        
        if os.environ.get('MARKITDOWN_PARALLEL_PROCESSING'):
            config['performance']['parallelProcessing'] = os.environ.get('MARKITDOWN_PARALLEL_PROCESSING').lower() == 'true'
        
        if os.environ.get('MARKITDOWN_MAX_CONCURRENT'):
            try:
                config['performance']['maxConcurrentProcesses'] = int(os.environ.get('MARKITDOWN_MAX_CONCURRENT'))
            except ValueError:
                logger.warning("MARKITDOWN_MAX_CONCURRENT環境変数の値が無効です")
        
        logger.info(f"Markitdown設定を読み込みました (環境: {environment})")
        return config
        
    except Exception as e:
        logger.error(f"Markitdown設定の読み込みに失敗: {e}")
        logger.info("デフォルト設定を使用します")
        return DEFAULT_MARKITDOWN_CONFIG

def should_use_markitdown(config: Dict[str, Any], file_format: str) -> bool:
    """
    ファイル形式に対してMarkitdownを使用するかチェック
    
    Args:
        config: Markitdown設定
        file_format: ファイル形式
    
    Returns:
        Markitdownを使用するかのブール値
    """
    if not config.get('enabled', False):
        return False
    
    format_config = config.get('supportedFormats', {}).get(file_format, {})
    return (format_config.get('enabled', False) and 
            format_config.get('useMarkitdown', False))

def should_use_langchain(config: Dict[str, Any], file_format: str) -> bool:
    """
    ファイル形式に対してLangChainを使用するかチェック
    
    Args:
        config: Markitdown設定
        file_format: ファイル形式
    
    Returns:
        LangChainを使用するかのブール値
    """
    format_config = config.get('supportedFormats', {}).get(file_format, {})
    return (format_config.get('enabled', False) and 
            format_config.get('useLangChain', False))

def get_processing_order(config: Dict[str, Any], file_format: str) -> List[str]:
    """
    処理戦略に基づいて実行順序を決定
    
    Args:
        config: Markitdown設定
        file_format: ファイル形式
    
    Returns:
        処理方法のリスト
    """
    format_config = config.get('supportedFormats', {}).get(file_format, {})
    
    if not format_config.get('enabled', False):
        return []
    
    strategy = format_config.get('processingStrategy', 'auto-select')
    
    if strategy == 'markitdown-only':
        return ['markitdown'] if format_config.get('useMarkitdown', False) else []
    elif strategy == 'langchain-only':
        return ['langchain'] if format_config.get('useLangChain', False) else []
    elif strategy == 'markitdown-first':
        order = []
        if format_config.get('useMarkitdown', False):
            order.append('markitdown')
        if format_config.get('useLangChain', False):
            order.append('langchain')
        return order
    elif strategy == 'langchain-first':
        order = []
        if format_config.get('useLangChain', False):
            order.append('langchain')
        if format_config.get('useMarkitdown', False):
            order.append('markitdown')
        return order
    elif strategy == 'both-compare':
        order = []
        if format_config.get('useMarkitdown', False):
            order.append('markitdown')
        if format_config.get('useLangChain', False):
            order.append('langchain')
        return order
    elif strategy == 'auto-select':
        return get_auto_selected_order(file_format, format_config)
    else:
        logger.warning(f"不明な処理戦略: {strategy}")
        return []

def get_auto_selected_order(file_format: str, format_config: Dict) -> List[str]:
    """
    ファイル形式に基づく自動選択ロジック
    
    Args:
        file_format: ファイル形式
        format_config: ファイル形式設定
    
    Returns:
        処理方法のリスト
    """
    # Office文書: Markitdown優先
    if file_format in ['docx', 'xlsx', 'pptx']:
        order = []
        if format_config.get('useMarkitdown', False):
            order.append('markitdown')
        if format_config.get('useLangChain', False):
            order.append('langchain')
        return order
    
    # 画像: Markitdownのみ（OCR機能）
    elif file_format in ['png', 'jpg', 'jpeg', 'gif']:
        return ['markitdown'] if format_config.get('useMarkitdown', False) else []
    
    # データファイル: LangChainのみ
    elif file_format in ['csv', 'tsv']:
        return ['langchain'] if format_config.get('useLangChain', False) else []
    
    # その他: LangChain優先
    else:
        order = []
        if format_config.get('useLangChain', False):
            order.append('langchain')
        if format_config.get('useMarkitdown', False):
            order.append('markitdown')
        return order

def should_perform_quality_comparison(config: Dict[str, Any], file_format: str) -> bool:
    """
    品質比較が必要かチェック
    
    Args:
        config: Markitdown設定
        file_format: ファイル形式
    
    Returns:
        品質比較が必要かのブール値
    """
    format_config = config.get('supportedFormats', {}).get(file_format, {})
    return (format_config.get('enableQualityComparison', False) and
            format_config.get('processingStrategy') == 'both-compare')

def validate_config(config: Dict[str, Any]) -> List[str]:
    """
    設定の検証
    
    Args:
        config: Markitdown設定
    
    Returns:
        エラーメッセージのリスト
    """
    errors = []
    
    # 基本設定の検証
    if not isinstance(config.get('enabled'), bool):
        errors.append("enabled は boolean である必要があります")
    
    # パフォーマンス設定の検証
    performance = config.get('performance', {})
    if performance.get('maxFileSizeBytes', 0) <= 0:
        errors.append("maxFileSizeBytes は正の数である必要があります")
    
    if performance.get('memoryLimitMB', 0) <= 0:
        errors.append("memoryLimitMB は正の数である必要があります")
    
    if performance.get('maxConcurrentProcesses', 0) <= 0:
        errors.append("maxConcurrentProcesses は正の数である必要があります")
    
    # サポートされるファイル形式の検証
    supported_formats = config.get('supportedFormats', {})
    for format_name, format_config in supported_formats.items():
        if not isinstance(format_config, dict):
            errors.append(f"{format_name} の設定が辞書ではありません")
            continue
        
        if format_config.get('timeout', 0) <= 0:
            errors.append(f"{format_name} のタイムアウト値が無効です")
    
    return errors

def get_config_summary(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    設定のサマリーを取得
    
    Args:
        config: Markitdown設定
    
    Returns:
        設定サマリー
    """
    enabled_formats = []
    markitdown_formats = []
    langchain_formats = []
    
    for format_name, format_config in config.get('supportedFormats', {}).items():
        if format_config.get('enabled', False):
            enabled_formats.append(format_name)
            
            if format_config.get('useMarkitdown', False):
                markitdown_formats.append(format_name)
            
            if format_config.get('useLangChain', False):
                langchain_formats.append(format_name)
    
    return {
        'enabled': config.get('enabled', False),
        'totalFormats': len(config.get('supportedFormats', {})),
        'enabledFormats': len(enabled_formats),
        'markitdownFormats': len(markitdown_formats),
        'langchainFormats': len(langchain_formats),
        'enabledFormatsList': enabled_formats,
        'maxFileSize': config.get('performance', {}).get('maxFileSize', 'Unknown'),
        'parallelProcessing': config.get('performance', {}).get('parallelProcessing', False),
        'fallbackEnabled': config.get('fallback', {}).get('enabled', False)
    }