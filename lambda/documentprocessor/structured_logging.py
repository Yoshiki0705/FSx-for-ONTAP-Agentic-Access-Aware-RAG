"""
構造化ログ出力機能
Markitdown統合処理の詳細ログとトレーシング
"""

import json
import logging
import os
import uuid
from typing import Dict, Any, Optional
from datetime import datetime
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)

@dataclass
class LogContext:
    """ログコンテキスト"""
    correlation_id: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    request_id: Optional[str] = None
    environment: str = 'prod'

class MarkitdownLogger:
    """Markitdown統合用構造化ログクラス"""
    
    def __init__(self, service_name: str = 'document-processor'):
        """
        初期化
        
        Args:
            service_name: サービス名
        """
        self.service_name = service_name
        self.environment = os.environ.get('ENVIRONMENT', 'prod')
        self.log_level = os.environ.get('LOG_LEVEL', 'INFO').upper()
        
        # ログ設定
        self._setup_logger()
        
    def _setup_logger(self):
        """ログ設定の初期化"""
        # 構造化ログフォーマッター
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        # ハンドラー設定
        if not logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            logger.setLevel(getattr(logging, self.log_level))
    
    def start_document_processing(self, 
                                file_name: str,
                                file_size: int,
                                file_format: str,
                                processing_strategy: str,
                                user_id: Optional[str] = None,
                                project_id: Optional[str] = None) -> str:
        """
        文書処理開始ログ
        
        Args:
            file_name: ファイル名
            file_size: ファイルサイズ
            file_format: ファイル形式
            processing_strategy: 処理戦略
            user_id: ユーザーID
            project_id: プロジェクトID
            
        Returns:
            str: 処理ID
        """
        processing_id = str(uuid.uuid4())
        
        log_data = {
            'event_type': 'document_processing_start',
            'processing_id': processing_id,
            'service': self.service_name,
            'environment': self.environment,
            'timestamp': datetime.utcnow().isoformat(),
            'file_info': {
                'name': file_name,
                'size_bytes': file_size,
                'format': file_format
            },
            'processing_config': {
                'strategy': processing_strategy
            },
            'user_context': {
                'user_id': user_id,
                'project_id': project_id
            }
        }
        
        logger.info(f"🚀 文書処理開始 | {json.dumps(log_data, ensure_ascii=False)}")
        return processing_id
    
    def log_conversion_attempt(self,
                             method: str,
                             duration_ms: float,
                             success: bool,
                             file_format: str,
                             output_size: int = 0,
                             quality_score: Optional[float] = None,
                             error_message: Optional[str] = None):
        """
        変換試行ログ
        
        Args:
            method: 変換方法
            duration_ms: 処理時間
            success: 成功フラグ
            file_format: ファイル形式
            output_size: 出力サイズ
            quality_score: 品質スコア
            error_message: エラーメッセージ
        """
        log_data = {
            'event_type': 'conversion_attempt',
            'service': self.service_name,
            'timestamp': datetime.utcnow().isoformat(),
            'conversion_info': {
                'method': method,
                'file_format': file_format,
                'duration_ms': duration_ms,
                'success': success,
                'output_size_bytes': output_size,
                'quality_score': quality_score
            }
        }
        
        if error_message:
            log_data['error'] = {'message': error_message}
        
        if success:
            logger.info(f"✅ 変換成功 | {json.dumps(log_data, ensure_ascii=False)}")
        else:
            logger.warning(f"❌ 変換失敗 | {json.dumps(log_data, ensure_ascii=False)}")
    
    def log_langchain_processing(self,
                                chunks_generated: int,
                                duration_ms: float,
                                success: bool,
                                chunk_strategy: str,
                                average_chunk_size: float):
        """
        LangChain処理ログ
        
        Args:
            chunks_generated: 生成チャンク数
            duration_ms: 処理時間
            success: 成功フラグ
            chunk_strategy: チャンキング戦略
            average_chunk_size: 平均チャンクサイズ
        """
        log_data = {
            'event_type': 'langchain_processing',
            'service': self.service_name,
            'timestamp': datetime.utcnow().isoformat(),
            'langchain_info': {
                'chunks_generated': chunks_generated,
                'duration_ms': duration_ms,
                'success': success,
                'chunk_strategy': chunk_strategy,
                'average_chunk_size': average_chunk_size
            }
        }
        
        if success:
            logger.info(f"🔗 LangChain処理完了 | {json.dumps(log_data, ensure_ascii=False)}")
        else:
            logger.error(f"❌ LangChain処理失敗 | {json.dumps(log_data, ensure_ascii=False)}")
    
    def log_embedding_generation(self,
                               model_name: str,
                               embeddings_count: int,
                               duration_ms: float,
                               success: bool,
                               batch_size: int,
                               error_message: Optional[str] = None):
        """
        埋め込み生成ログ
        
        Args:
            model_name: モデル名
            embeddings_count: 埋め込み数
            duration_ms: 処理時間
            success: 成功フラグ
            batch_size: バッチサイズ
            error_message: エラーメッセージ
        """
        log_data = {
            'event_type': 'embedding_generation',
            'service': self.service_name,
            'timestamp': datetime.utcnow().isoformat(),
            'embedding_info': {
                'model_name': model_name,
                'embeddings_count': embeddings_count,
                'duration_ms': duration_ms,
                'success': success,
                'batch_size': batch_size
            }
        }
        
        if error_message:
            log_data['error'] = {'message': error_message}
        
        if success:
            logger.info(f"🔢 埋め込み生成完了 | {json.dumps(log_data, ensure_ascii=False)}")
        else:
            logger.error(f"❌ 埋め込み生成失敗 | {json.dumps(log_data, ensure_ascii=False)}")
    
    def log_storage_operation(self,
                            storage_type: str,
                            documents_stored: int,
                            duration_ms: float,
                            success: bool,
                            index_name: Optional[str] = None):
        """
        ストレージ操作ログ
        
        Args:
            storage_type: ストレージタイプ
            documents_stored: 格納ドキュメント数
            duration_ms: 処理時間
            success: 成功フラグ
            index_name: インデックス名
        """
        log_data = {
            'event_type': 'storage_operation',
            'service': self.service_name,
            'timestamp': datetime.utcnow().isoformat(),
            'storage_info': {
                'storage_type': storage_type,
                'documents_stored': documents_stored,
                'duration_ms': duration_ms,
                'success': success,
                'index_name': index_name
            }
        }
        
        if success:
            logger.info(f"💾 ストレージ操作完了 | {json.dumps(log_data, ensure_ascii=False)}")
        else:
            logger.error(f"❌ ストレージ操作失敗 | {json.dumps(log_data, ensure_ascii=False)}")
    
    def log_processing_completion(self,
                                processing_id: str,
                                total_duration_ms: float,
                                success: bool,
                                final_method: str,
                                attempts_count: int,
                                output_size: int = 0):
        """
        処理完了ログ
        
        Args:
            processing_id: 処理ID
            total_duration_ms: 総処理時間
            success: 成功フラグ
            final_method: 最終処理方法
            attempts_count: 試行回数
            output_size: 出力サイズ
        """
        log_data = {
            'event_type': 'document_processing_completion',
            'processing_id': processing_id,
            'service': self.service_name,
            'timestamp': datetime.utcnow().isoformat(),
            'completion_info': {
                'total_duration_ms': total_duration_ms,
                'success': success,
                'final_method': final_method,
                'attempts_count': attempts_count,
                'output_size_bytes': output_size
            }
        }
        
        if success:
            logger.info(f"🎉 文書処理完了 | {json.dumps(log_data, ensure_ascii=False)}")
        else:
            logger.error(f"❌ 文書処理失敗 | {json.dumps(log_data, ensure_ascii=False)}")
    
    def log_error(self,
                 error_type: str,
                 error_message: str,
                 context: Optional[Dict[str, Any]] = None):
        """
        エラーログ
        
        Args:
            error_type: エラータイプ
            error_message: エラーメッセージ
            context: コンテキスト情報
        """
        log_data = {
            'event_type': 'error',
            'service': self.service_name,
            'timestamp': datetime.utcnow().isoformat(),
            'error_info': {
                'type': error_type,
                'message': error_message,
                'context': context or {}
            }
        }
        
        logger.error(f"💥 エラー発生 | {json.dumps(log_data, ensure_ascii=False)}")


def create_markitdown_logger(service_name: str = 'document-processor') -> MarkitdownLogger:
    """
    Markitdown統合用ログインスタンスを作成
    
    Args:
        service_name: サービス名
        
    Returns:
        MarkitdownLogger: ログインスタンス
    """
    return MarkitdownLogger(service_name)


# テスト用のサンプル関数
def test_structured_logging():
    """
    構造化ログのテスト
    """
    # ログインスタンス作成
    markitdown_logger = create_markitdown_logger()
    
    # 文書処理開始
    processing_id = markitdown_logger.start_document_processing(
        file_name="test_document.pdf",
        file_size=1024000,
        file_format="pdf",
        processing_strategy="both-compare",
        user_id="test_user",
        project_id="test_project"
    )
    
    # 変換試行ログ
    markitdown_logger.log_conversion_attempt(
        method="markitdown",
        duration_ms=1500.0,
        success=True,
        file_format="pdf",
        output_size=2048000,
        quality_score=85.5
    )
    
    # LangChain処理ログ
    markitdown_logger.log_langchain_processing(
        chunks_generated=10,
        duration_ms=800.0,
        success=True,
        chunk_strategy="recursive_character",
        average_chunk_size=1024.0
    )
    
    # 処理完了ログ
    markitdown_logger.log_processing_completion(
        processing_id=processing_id,
        total_duration_ms=3000.0,
        success=True,
        final_method="markitdown",
        attempts_count=1,
        output_size=2048000
    )
    
    print("構造化ログテスト完了")


if __name__ == "__main__":
    test_structured_logging()