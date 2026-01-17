"""
Bedrock Knowledge Base互換型定義
型安全性とコード品質向上のための型定義モジュール
"""

from typing import Dict, List, Any, Optional, Union, Literal, TypedDict
from dataclasses import dataclass
from enum import Enum

# リテラル型定義
EmbeddingModel = Literal[
    'amazon.titan-embed-text-v1',
    'amazon.titan-embed-text-v2:0',
    'cohere.embed-english-v3',
    'cohere.embed-multilingual-v3'
]

AWSRegion = Literal[
    'us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1',
    'ap-northeast-1', 'ap-southeast-1', 'ap-southeast-2'
]

ChunkType = Literal['paragraph', 'header', 'list', 'code', 'table']

class ProcessingStatus(Enum):
    """処理ステータス"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class BedrockKBMetadata(TypedDict, total=False):
    """Bedrock KB標準メタデータ型"""
    source: str
    parentText: str

class EnhancedMetadata(TypedDict, total=False):
    """拡張メタデータ型"""
    # Bedrock Knowledge Base標準フィールド
    x_amz_bedrock_kb_category: str
    AMAZON_BEDROCK_METADATA: str
    x_amz_bedrock_kb_lastModifiedDateTime: str
    x_amz_bedrock_kb_createdDate: str
    x_amz_bedrock_kb_source_uri: str
    x_amz_bedrock_kb_document_page_number: int
    x_amz_bedrock_kb_size: str
    x_amz_bedrock_kb_title: str
    AMAZON_BEDROCK_TEXT_CHUNK: str
    x_amz_bedrock_kb_author: str
    
    # カスタムフィールド
    document_id: str
    embedding_model: str
    embedding_dimension: int
    indexed_at: str
    chunk_index: int
    chunk_type: ChunkType

@dataclass(frozen=True)
class EmbeddingConfig:
    """埋め込み設定（イミュータブル）"""
    region: AWSRegion
    embedding_model: EmbeddingModel
    opensearch_endpoint: Optional[str]
    opensearch_index: str
    max_retries: int = 3
    request_timeout: int = 30
    batch_size: int = 25
    enable_cache: bool = True

@dataclass
class ProcessingMetrics:
    """処理メトリクス"""
    total_texts: int
    total_embeddings: int
    processing_time: float
    cache_hits: int
    error_count: int
    throughput: float
    
    @property
    def cache_hit_rate(self) -> float:
        """キャッシュヒット率"""
        return self.cache_hits / self.total_texts if self.total_texts > 0 else 0.0
    
    @property
    def error_rate(self) -> float:
        """エラー率"""
        return self.error_count / self.total_texts if self.total_texts > 0 else 0.0

class ValidationError(Exception):
    """検証エラー"""
    pass

class BedrockAPIError(Exception):
    """Bedrock API エラー"""
    def __init__(self, message: str, error_code: str, retry_after: Optional[int] = None):
        super().__init__(message)
        self.error_code = error_code
        self.retry_after = retry_after

class OpenSearchError(Exception):
    """OpenSearch エラー"""
    pass