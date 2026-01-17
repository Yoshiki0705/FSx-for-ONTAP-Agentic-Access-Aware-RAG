"""
Bedrock Knowledge Base設定管理モジュール
環境別設定とバリデーション機能
"""

import os
import json
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict
from bedrock_kb_types import EmbeddingConfig, AWSRegion, EmbeddingModel, ValidationError

@dataclass
class BedrockKBSettings:
    """Bedrock KB設定クラス"""
    # 基本設定
    region: AWSRegion = 'us-east-1'
    embedding_model: EmbeddingModel = 'amazon.titan-embed-text-v1'
    opensearch_endpoint: Optional[str] = None
    opensearch_index: str = 'bedrock-knowledge-base-default-index'
    
    # パフォーマンス設定
    max_retries: int = 3
    request_timeout: int = 30
    batch_size: int = 25
    enable_cache: bool = True
    
    # セキュリティ設定
    validate_inputs: bool = True
    sanitize_text: bool = True
    max_text_length: int = 8000
    
    # ログ設定
    log_level: str = 'INFO'
    enable_structured_logging: bool = True
    log_performance_metrics: bool = True

class ConfigManager:
    """設定管理クラス"""
    
    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path
        self._settings: Optional[BedrockKBSettings] = None
    
    def load_config(self, environment: str = 'prod') -> BedrockKBSettings:
        """環境別設定の読み込み"""
        # デフォルト設定
        settings = BedrockKBSettings()
        
        # 設定ファイルからの読み込み
        if self.config_path and os.path.exists(self.config_path):
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    config_data = json.load(f)
                    
                # 環境別設定の適用
                if environment in config_data:
                    env_config = config_data[environment]
                    for key, value in env_config.items():
                        if hasattr(settings, key):
                            setattr(settings, key, value)
                            
            except Exception as e:
                raise ValidationError(f"設定ファイル読み込みエラー: {e}")
        
        # 環境変数からの上書き
        settings = self._apply_env_overrides(settings)
        
        # 設定検証
        self._validate_settings(settings)
        
        self._settings = settings
        return settings
    
    def _apply_env_overrides(self, settings: BedrockKBSettings) -> BedrockKBSettings:
        """環境変数による設定上書き"""
        env_mappings = {
            'AWS_REGION': 'region',
            'EMBEDDING_MODEL': 'embedding_model',
            'OPENSEARCH_ENDPOINT': 'opensearch_endpoint',
            'OPENSEARCH_INDEX': 'opensearch_index',
            'BEDROCK_MAX_RETRIES': 'max_retries',
            'BEDROCK_TIMEOUT': 'request_timeout',
            'EMBEDDING_BATCH_SIZE': 'batch_size',
            'ENABLE_EMBEDDING_CACHE': 'enable_cache',
            'VALIDATE_INPUTS': 'validate_inputs',
            'SANITIZE_TEXT': 'sanitize_text',
            'MAX_TEXT_LENGTH': 'max_text_length',
            'LOG_LEVEL': 'log_level'
        }
        
        for env_var, attr_name in env_mappings.items():
            env_value = os.environ.get(env_var)
            if env_value is not None:
                # 型変換
                if attr_name in ['max_retries', 'request_timeout', 'batch_size', 'max_text_length']:
                    try:
                        env_value = int(env_value)
                    except ValueError:
                        continue
                elif attr_name in ['enable_cache', 'validate_inputs', 'sanitize_text']:
                    env_value = env_value.lower() in ('true', '1', 'yes', 'on')
                
                setattr(settings, attr_name, env_value)
        
        return settings
    
    def _validate_settings(self, settings: BedrockKBSettings) -> None:
        """設定値の検証"""
        # 必須フィールドの検証
        if not settings.region:
            raise ValidationError("リージョンが設定されていません")
        
        if not settings.embedding_model:
            raise ValidationError("埋め込みモデルが設定されていません")
        
        # 数値範囲の検証
        if settings.max_retries < 0 or settings.max_retries > 10:
            raise ValidationError(f"max_retries は 0-10 の範囲で設定してください: {settings.max_retries}")
        
        if settings.request_timeout < 1 or settings.request_timeout > 300:
            raise ValidationError(f"request_timeout は 1-300 の範囲で設定してください: {settings.request_timeout}")
        
        if settings.batch_size < 1 or settings.batch_size > 100:
            raise ValidationError(f"batch_size は 1-100 の範囲で設定してください: {settings.batch_size}")
        
        if settings.max_text_length < 100 or settings.max_text_length > 50000:
            raise ValidationError(f"max_text_length は 100-50000 の範囲で設定してください: {settings.max_text_length}")
        
        # OpenSearchエンドポイントの検証
        if settings.opensearch_endpoint:
            if not settings.opensearch_endpoint.startswith('https://'):
                raise ValidationError("OpenSearchエンドポイントはHTTPS URLである必要があります")
        
        # インデックス名の検証
        if not settings.opensearch_index or len(settings.opensearch_index.strip()) == 0:
            raise ValidationError("OpenSearchインデックス名が無効です")
    
    def get_embedding_config(self) -> EmbeddingConfig:
        """埋め込み設定の取得"""
        if not self._settings:
            raise ValueError("設定が読み込まれていません")
        
        return EmbeddingConfig(
            region=self._settings.region,
            embedding_model=self._settings.embedding_model,
            opensearch_endpoint=self._settings.opensearch_endpoint,
            opensearch_index=self._settings.opensearch_index,
            max_retries=self._settings.max_retries,
            request_timeout=self._settings.request_timeout,
            batch_size=self._settings.batch_size,
            enable_cache=self._settings.enable_cache
        )
    
    def export_config(self, file_path: str) -> None:
        """設定のエクスポート"""
        if not self._settings:
            raise ValueError("設定が読み込まれていません")
        
        config_dict = asdict(self._settings)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(config_dict, f, indent=2, ensure_ascii=False)

# グローバル設定管理インスタンス
_config_manager = ConfigManager()

def get_config_manager() -> ConfigManager:
    """設定管理インスタンスの取得"""
    return _config_manager

def load_bedrock_kb_config(environment: str = 'prod', config_path: Optional[str] = None) -> BedrockKBSettings:
    """Bedrock KB設定の読み込み"""
    if config_path:
        manager = ConfigManager(config_path)
    else:
        manager = get_config_manager()
    
    return manager.load_config(environment)