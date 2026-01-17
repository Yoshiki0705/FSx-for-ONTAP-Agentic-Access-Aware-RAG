"""
Document Processor Lambda Function with Markitdown Integration
Markitdown統合対応ドキュメント処理Lambda関数
"""

import json
import os
import logging
import traceback
from datetime import datetime
from typing import Dict, Any, Optional, Tuple, List
import boto3
from botocore.exceptions import ClientError

# Markitdown関連のインポート（実際の実装時に追加）
# from markitdown import MarkItDown

# 設定読み込み
from config_loader import load_markitdown_config, get_processing_order, should_use_markitdown, should_use_langchain

# エラーハンドリング
from error_handler import (
    FallbackHandler, ResourceMonitor, ProcessingError, ErrorType,
    create_error_response, log_processing_error, handle_partial_conversion_error
)

# LangChain統合
from langchain_integration import LangChainIntegration, create_langchain_integration

# ベクトル埋め込み処理（Bedrock KB互換）
from vector_embedding_bedrock_kb import BedrockKBVectorProcessor, create_bedrock_kb_vector_processor

# メタデータ管理
from metadata_manager import MetadataManager, create_metadata_manager

# CloudWatchメトリクス収集
from cloudwatch_metrics import CloudWatchMetricsCollector, create_cloudwatch_metrics_collector

# 構造化ログ出力
from structured_logging import MarkitdownLogger, create_markitdown_logger

# ログ設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS クライアント初期化
s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')

# 環境変数
MARKITDOWN_ENABLED = os.environ.get('MARKITDOWN_ENABLED', 'true').lower() == 'true'
MARKITDOWN_ENVIRONMENT = os.environ.get('MARKITDOWN_ENVIRONMENT', 'prod')
TRACKING_TABLE_NAME = os.environ.get('MARKITDOWN_TRACKING_TABLE', 'EmbeddingProcessingTracking')
LOG_LEVEL = os.environ.get('MARKITDOWN_LOG_LEVEL', 'info').upper()

# ログレベル設定
if LOG_LEVEL in ['DEBUG', 'INFO', 'WARNING', 'ERROR']:
    logger.setLevel(getattr(logging, LOG_LEVEL))

class DocumentProcessor:
    """ドキュメント処理クラス"""
    
    def __init__(self):
        """初期化"""
        self.config = None
        self.tracking_table = None
        self.fallback_handler = None
        self.resource_monitor = None
        self.langchain_integration = None
        self.vector_processor = None
        self.metadata_manager = None
        self.metrics_collector = None
        self.structured_logger = None
        self._initialize_config()
        self._initialize_tracking()
        self._initialize_handlers()
        self._initialize_langchain()
        self._initialize_vector_processor()
        self._initialize_metadata_manager()
        self._initialize_metrics_collector()
        self._initialize_structured_logger()
    
    def _initialize_config(self):
        """Markitdown設定の初期化"""
        try:
            self.config = load_markitdown_config(MARKITDOWN_ENVIRONMENT)
            logger.info(f"Markitdown設定を読み込みました (環境: {MARKITDOWN_ENVIRONMENT})")
        except Exception as e:
            logger.error(f"Markitdown設定の読み込みに失敗: {e}")
            # デフォルト設定を使用
            self.config = {
                'enabled': False,
                'supportedFormats': {},
                'fallback': {'enabled': True, 'useLangChainOnFailure': True}
            }
    
    def _initialize_tracking(self):
        """追跡テーブルの初期化"""
        try:
            self.tracking_table = dynamodb.Table(TRACKING_TABLE_NAME)
            logger.info(f"追跡テーブルを初期化しました: {TRACKING_TABLE_NAME}")
        except Exception as e:
            logger.warning(f"追跡テーブルの初期化に失敗: {e}")
            self.tracking_table = None
    
    def _initialize_handlers(self):
        """ハンドラーの初期化"""
        try:
            self.fallback_handler = FallbackHandler(self.config)
            self.resource_monitor = ResourceMonitor(self.config)
            logger.info("エラーハンドリングとリソース監視を初期化しました")
        except Exception as e:
            logger.error(f"ハンドラーの初期化に失敗: {e}")
            # フォールバック用の基本ハンドラーを作成
            self.fallback_handler = None
            self.resource_monitor = None
    
    def _initialize_langchain(self):
        """LangChain統合の初期化"""
        try:
            langchain_config = {
                'region': os.environ.get('AWS_REGION', 'us-east-1'),
                'embedding_model': os.environ.get('EMBEDDING_MODEL', 'amazon.titan-embed-text-v1'),
                'chunk_size': int(os.environ.get('CHUNK_SIZE', '1000')),
                'chunk_overlap': int(os.environ.get('CHUNK_OVERLAP', '200'))
            }
            
            self.langchain_integration = create_langchain_integration(langchain_config)
            logger.info("LangChain統合を初期化しました")
        except Exception as e:
            logger.error(f"LangChain統合の初期化に失敗: {e}")
            self.langchain_integration = None
    
    def _initialize_vector_processor(self):
        """ベクトル埋め込み処理の初期化"""
        try:
            vector_config = {
                'region': os.environ.get('AWS_REGION', 'us-east-1'),
                'embedding_model': os.environ.get('EMBEDDING_MODEL', 'amazon.titan-embed-text-v1'),
                'opensearch_endpoint': os.environ.get('OPENSEARCH_ENDPOINT'),
                'opensearch_index': os.environ.get('OPENSEARCH_INDEX', 'documents')
            }
            
            self.vector_processor = create_bedrock_kb_vector_processor(vector_config)
            logger.info("ベクトル埋め込み処理を初期化しました")
        except Exception as e:
            logger.error(f"ベクトル埋め込み処理の初期化に失敗: {e}")
            self.vector_processor = None
    
    def _initialize_metadata_manager(self):
        """メタデータ管理の初期化"""
        try:
            metadata_config = {
                'region': os.environ.get('AWS_REGION', 'us-east-1'),
                'metadata_table': os.environ.get('METADATA_TABLE', 'DocumentProcessingMetadata'),
                'tracking_table': os.environ.get('TRACKING_TABLE', 'EmbeddingProcessingTracking')
            }
            
            self.metadata_manager = create_metadata_manager(metadata_config)
            logger.info("メタデータ管理を初期化しました")
        except Exception as e:
            logger.error(f"メタデータ管理の初期化に失敗: {e}")
            self.metadata_manager = None
    
    def _initialize_metrics_collector(self):
        """CloudWatchメトリクス収集の初期化"""
        try:
            metrics_config = {
                'region': os.environ.get('AWS_REGION', 'us-east-1'),
                'namespace': os.environ.get('CLOUDWATCH_NAMESPACE', 'RAG/DocumentProcessor/Markitdown')
            }
            
            self.metrics_collector = create_cloudwatch_metrics_collector(metrics_config)
            logger.info("CloudWatchメトリクス収集を初期化しました")
        except Exception as e:
            logger.error(f"CloudWatchメトリクス収集の初期化に失敗: {e}")
            self.metrics_collector = None
    
    def _initialize_structured_logger(self):
        """構造化ログの初期化"""
        try:
            self.structured_logger = create_markitdown_logger()
            logger.info("構造化ログを初期化しました")
        except Exception as e:
            logger.error(f"構造化ログの初期化に失敗: {e}")
            self.structured_logger = None
    
    def get_file_format(self, file_name: str) -> Optional[str]:
        """ファイル形式を判定"""
        if not file_name:
            return None
        
        extension = file_name.lower().split('.')[-1] if '.' in file_name else ''
        
        # サポートされているファイル形式のマッピング
        format_mapping = {
            'docx': 'docx',
            'xlsx': 'xlsx', 
            'pptx': 'pptx',
            'pdf': 'pdf',
            'png': 'png',
            'jpg': 'jpg',
            'jpeg': 'jpeg',
            'gif': 'gif',
            'html': 'html',
            'htm': 'html',
            'xml': 'xml',
            'csv': 'csv',
            'tsv': 'tsv'
        }
        
        return format_mapping.get(extension)
    
    def is_format_supported(self, file_format: str) -> bool:
        """ファイル形式がサポートされているかチェック"""
        if not self.config or not MARKITDOWN_ENABLED:
            return False
        
        return (file_format in self.config.get('supportedFormats', {}) and 
                self.config['supportedFormats'][file_format].get('enabled', False))
    
    def process_with_markitdown(self, file_content: bytes, file_format: str, file_name: str) -> Tuple[bool, str, Dict]:
        """Markitdownを使用した文書変換"""
        from format_processors import get_format_processor
        
        processor = get_format_processor(file_format, self.config)
        if not processor:
            return False, "", {
                'method': 'markitdown',
                'success': False,
                'error': f'サポートされていないファイル形式: {file_format}'
            }
        
        return processor.process_with_markitdown(file_content, file_name)
    
    def process_with_langchain(self, file_content: bytes, file_format: str, file_name: str) -> Tuple[bool, str, Dict]:
        """LangChainを使用した文書変換"""
        from format_processors import get_format_processor
        
        processor = get_format_processor(file_format, self.config)
        if not processor:
            return False, "", {
                'method': 'langchain',
                'success': False,
                'error': f'サポートされていないファイル形式: {file_format}'
            }
        
        return processor.process_with_langchain(file_content, file_name)
    
    def compare_quality(self, markitdown_result: Dict, langchain_result: Dict) -> str:
        """品質比較を行い、最適な結果を選択"""
        markitdown_score = markitdown_result.get('qualityScore', 0)
        langchain_score = langchain_result.get('qualityScore', 0)
        
        # 品質スコアに基づく選択
        if markitdown_score > langchain_score:
            logger.info(f"品質比較結果: Markitdown選択 (スコア: {markitdown_score} vs {langchain_score})")
            return 'markitdown'
        else:
            logger.info(f"品質比較結果: LangChain選択 (スコア: {langchain_score} vs {markitdown_score})")
            return 'langchain'
    
    def save_tracking_info(self, file_hash: str, file_name: str, file_format: str, 
                          processing_strategy: str, final_method: str, 
                          attempted_methods: List[Dict], total_time: float,
                          markdown_length: int, has_error: bool = False, 
                          error_message: str = None):
        """処理追跡情報をDynamoDBに保存"""
        if not self.tracking_table:
            logger.warning("追跡テーブルが利用できません")
            return
        
        try:
            now = datetime.now()
            ttl = int(now.timestamp()) + (90 * 24 * 60 * 60)  # 90日後に自動削除
            
            item = {
                'fileHash': file_hash,
                'processedAt': now.isoformat(),
                'fileName': file_name,
                'fileFormat': file_format,
                'processingStrategy': processing_strategy,
                'usedMarkitdown': any(m['method'] == 'markitdown' for m in attempted_methods),
                'usedLangChain': any(m['method'] == 'langchain' for m in attempted_methods),
                'finalMethod': final_method,
                'processingTime': int(total_time),
                'markdownLength': markdown_length,
                'hasError': has_error,
                'ttl': ttl,
                'createdAt': now.isoformat(),
                'updatedAt': now.isoformat()
            }
            
            if error_message:
                item['errorMessage'] = error_message
            
            # 品質スコアの追加
            final_method_data = next((m for m in attempted_methods if m['method'] == final_method), None)
            if final_method_data and 'qualityScore' in final_method_data:
                item['qualityScore'] = final_method_data['qualityScore']
            
            self.tracking_table.put_item(Item=item)
            logger.info(f"追跡情報を保存しました: {file_name}")
            
        except Exception as e:
            logger.error(f"追跡情報の保存に失敗: {e}")
    
    def process_document(self, file_content: bytes, file_name: str, 
                        processing_strategy: Optional[str] = None,
                        user_id: Optional[str] = None,
                        project_id: Optional[str] = None) -> Dict[str, Any]:
        """メインの文書処理関数（エラーハンドリング・フォールバック対応）"""
        start_time = datetime.now()
        file_format = self.get_file_format(file_name)
        file_hash = f"{file_name}-{len(file_content)}-{start_time.timestamp()}"
        
        # 構造化ログ開始
        processing_log_id = None
        if self.structured_logger:
            try:
                processing_log_id = self.structured_logger.start_document_processing(
                    file_name=file_name,
                    file_size=len(file_content),
                    file_format=file_format or 'unknown',
                    processing_strategy=processing_strategy or 'auto',
                    user_id=user_id,
                    project_id=project_id
                )
            except Exception as e:
                logger.warning(f"構造化ログ開始に失敗: {e}")
        
        # ファイルメタデータ作成
        file_metadata = None
        processing_metadata = None
        if self.metadata_manager:
            try:
                file_metadata = self.metadata_manager.create_file_metadata(
                    file_name=file_name,
                    file_content=file_content,
                    file_format=file_format or 'unknown',
                    user_id=user_id,
                    project_id=project_id
                )
                
                processing_metadata = self.metadata_manager.create_processing_metadata(
                    file_id=file_metadata.file_id,
                    processing_strategy=processing_strategy or 'auto'
                )
            except Exception as e:
                logger.warning(f"メタデータ作成に失敗: {e}")
        
        result = {
            'success': False,
            'fileName': file_name,
            'fileFormat': file_format,
            'processingStrategy': processing_strategy,
            'finalMethod': None,
            'markdownContent': '',
            'metadata': {
                'startTime': start_time.isoformat(),
                'attemptedMethods': [],
                'totalProcessingTime': 0
            },
            'error': None
        }
        
        try:
            # リソース監視による事前検証
            if self.resource_monitor:
                self.resource_monitor.validate_file_size(file_content, file_name)
                self.resource_monitor.validate_memory_usage()
                self.resource_monitor.validate_file_content(file_content, file_name, file_format or 'unknown')
            
            # ファイル形式チェック
            if not file_format:
                raise ProcessingError(
                    ErrorType.UNSUPPORTED_FORMAT,
                    f"サポートされていないファイル形式: {file_name}"
                )
            
            if not self.is_format_supported(file_format):
                raise ProcessingError(
                    ErrorType.UNSUPPORTED_FORMAT,
                    f"無効化されているファイル形式: {file_format}"
                )
            
            # 処理戦略の決定
            if not processing_strategy:
                processing_order = get_processing_order(self.config, file_format)
            else:
                # カスタム戦略の処理
                if processing_strategy == 'markitdown-only':
                    processing_order = ['markitdown'] if should_use_markitdown(self.config, file_format) else []
                elif processing_strategy == 'langchain-only':
                    processing_order = ['langchain'] if should_use_langchain(self.config, file_format) else []
                elif processing_strategy == 'markitdown-first':
                    processing_order = ['markitdown', 'langchain']
                elif processing_strategy == 'langchain-first':
                    processing_order = ['langchain', 'markitdown']
                elif processing_strategy == 'both-compare':
                    processing_order = ['markitdown', 'langchain']
                else:
                    processing_order = get_processing_order(self.config, file_format)
            
            if not processing_order:
                raise ProcessingError(
                    ErrorType.UNSUPPORTED_FORMAT,
                    f"利用可能な処理方法がありません: {file_format}"
                )
            
            result['processingStrategy'] = processing_strategy or 'auto'
            
            # フォールバック機構を使用した処理実行
            if self.fallback_handler and len(processing_order) >= 2:
                # フォールバック機能を使用
                primary_method = processing_order[0]
                fallback_method = processing_order[1] if len(processing_order) > 1 else None
                
                primary_func = self.process_with_markitdown if primary_method == 'markitdown' else self.process_with_langchain
                fallback_func = self.process_with_langchain if fallback_method == 'langchain' else self.process_with_markitdown if fallback_method == 'markitdown' else None
                
                # タイムアウト設定を取得
                format_config = self.config.get('supportedFormats', {}).get(file_format, {})
                timeout_seconds = format_config.get('timeout', 60)
                
                success, final_content, final_metadata = self.fallback_handler.execute_with_fallback(
                    primary_func, fallback_func, file_content, file_format, file_name, timeout_seconds
                )
                
                if success:
                    final_method = final_metadata.get('finalMethod', primary_method)
                    attempted_methods = final_metadata.get('attemptedMethods', [])
                else:
                    raise ProcessingError(
                        ErrorType.CONVERSION_FAILED,
                        "フォールバック処理も含めてすべての処理が失敗しました"
                    )
            
            else:
                # 従来の順次実行モード
                attempted_methods = []
                final_content = ""
                final_method = None
            
            # 品質比較モードの場合は両方実行
            if processing_strategy == 'both-compare' and len(processing_order) >= 2:
                markitdown_result = None
                langchain_result = None
                
                # Markitdown実行
                if 'markitdown' in processing_order:
                    success, content, metadata = self.process_with_markitdown(file_content, file_format, file_name)
                    attempted_methods.append(metadata)
                    if success:
                        markitdown_result = {'content': content, 'metadata': metadata}
                
                # LangChain実行
                if 'langchain' in processing_order:
                    success, content, metadata = self.process_with_langchain(file_content, file_format, file_name)
                    attempted_methods.append(metadata)
                    if success:
                        langchain_result = {'content': content, 'metadata': metadata}
                
                # 品質比較
                if markitdown_result and langchain_result:
                    final_method = self.compare_quality(markitdown_result['metadata'], langchain_result['metadata'])
                    final_content = markitdown_result['content'] if final_method == 'markitdown' else langchain_result['content']
                elif markitdown_result:
                    final_method = 'markitdown'
                    final_content = markitdown_result['content']
                elif langchain_result:
                    final_method = 'langchain'
                    final_content = langchain_result['content']
                else:
                    raise Exception("両方の処理方法が失敗しました")
            
            else:
                # 順次実行モード
                for method in processing_order:
                    if method == 'markitdown':
                        success, content, metadata = self.process_with_markitdown(file_content, file_format, file_name)
                    elif method == 'langchain':
                        success, content, metadata = self.process_with_langchain(file_content, file_format, file_name)
                    else:
                        continue
                    
                    attempted_methods.append(metadata)
                    
                    # 構造化ログ: 変換試行
                    if self.structured_logger:
                        try:
                            self.structured_logger.log_conversion_attempt(
                                method=method,
                                duration_ms=metadata.get('processingTime', 0),
                                success=success,
                                file_format=file_format,
                                output_size=metadata.get('outputLength', 0),
                                quality_score=metadata.get('qualityScore')
                            )
                        except Exception as e:
                            logger.warning(f"変換試行ログに失敗: {e}")
                    
                    if success:
                        final_content = content
                        final_method = method
                        break
                
                if not final_method:
                    raise Exception("すべての処理方法が失敗しました")
            
            # LangChain統合処理（チャンキングと埋め込み生成）
            langchain_result = None
            if self.langchain_integration and final_content:
                try:
                    langchain_result = self.langchain_integration.process_markdown_content(
                        markdown_content=final_content,
                        source_file=file_name,
                        processing_method=final_method,
                        user_id=None,  # TODO: 実際のユーザーIDを取得
                        project_id=None  # TODO: 実際のプロジェクトIDを取得
                    )
                    logger.info(f"LangChain処理完了: {len(langchain_result.chunks)}チャンク, {len(langchain_result.embeddings)}埋め込み")
                    
                    # 構造化ログ: LangChain処理
                    if self.structured_logger:
                        try:
                            self.structured_logger.log_langchain_processing(
                                chunks_generated=len(langchain_result.chunks),
                                duration_ms=langchain_result.metadata.get('total_processing_time', 0),
                                success=langchain_result.success,
                                chunk_strategy='recursive_character',
                                average_chunk_size=sum(len(chunk['content']) for chunk in langchain_result.chunks) / len(langchain_result.chunks) if langchain_result.chunks else 0
                            )
                        except Exception as e:
                            logger.warning(f"LangChain処理ログに失敗: {e}")
                            
                except Exception as e:
                    logger.warning(f"LangChain処理に失敗: {e}")
                    langchain_result = None
            
            # 結果の設定
            end_time = datetime.now()
            total_time = (end_time - start_time).total_seconds() * 1000
            
            result.update({
                'success': True,
                'finalMethod': final_method,
                'markdownContent': final_content,
                'metadata': {
                    'startTime': start_time.isoformat(),
                    'endTime': end_time.isoformat(),
                    'attemptedMethods': attempted_methods,
                    'totalProcessingTime': total_time
                }
            })
            
            # ベクトル埋め込み生成とOpenSearch格納
            vector_result = None
            opensearch_result = None
            
            if self.vector_processor and langchain_result and langchain_result.success:
                try:\n                    # 埋め込み生成\n                    texts = [chunk['content'] for chunk in langchain_result.chunks]\n                    vector_result = self.vector_processor.generate_embeddings(texts)\n                    \n                    if vector_result.success:\n                        # Bedrock KB互換OpenSearchドキュメント作成\n                        opensearch_docs = self.vector_processor.create_bedrock_kb_documents(\n                            chunks=langchain_result.chunks,\n                            embeddings=vector_result.embeddings,\n                            source_file=file_name,
                            source_uri=f"\\\\file\\{file_name}",  # ファイルパス形式
                            author=user_id or "system",
                            file_size=len(file_content),
                            parent_chunks=None  # 必要に応じて親チャンクを設定\n                        )\n                        \n                        # OpenSearchに格納\n                        opensearch_result = self.vector_processor.store_embeddings_to_opensearch(opensearch_docs)\n                        \n                        logger.info(f\"ベクトル処理完了: {len(vector_result.embeddings)}埋め込み, OpenSearch格納: {opensearch_result.get('stored_count', 0)}\")\n                    \n                except Exception as e:\n                    logger.warning(f\"ベクトル処理に失敗: {e}\")\n                    vector_result = None\n                    opensearch_result = None\n            \n            # LangChain結果を追加\n            if langchain_result and langchain_result.success:\n                result['langchainProcessing'] = {\n                    'success': True,\n                    'chunks': langchain_result.chunks,\n                    'embeddings': langchain_result.embeddings,\n                    'metadata': langchain_result.metadata\n                }\n            elif langchain_result:\n                result['langchainProcessing'] = {\n                    'success': False,\n                    'error': langchain_result.error\n                }\n            \n            # ベクトル処理結果を追加\n            if vector_result and vector_result.success:\n                result['vectorProcessing'] = {\n                    'success': True,\n                    'embeddings_count': len(vector_result.embeddings),\n                    'embedding_dimension': len(vector_result.embeddings[0]) if vector_result.embeddings else 0,\n                    'metadata': vector_result.metadata\n                }\n            elif vector_result:\n                result['vectorProcessing'] = {\n                    'success': False,\n                    'error': vector_result.error\n                }\n            \n            # OpenSearch格納結果を追加\n            if opensearch_result:\n                result['opensearchStorage'] = opensearch_result
            
            # メタデータ更新
            if self.metadata_manager and processing_metadata:
                try:
                    # 変換メタデータ作成
                    for method_data in attempted_methods:
                        if method_data.get('success'):
                            self.metadata_manager.create_conversion_metadata(
                                processing_id=processing_metadata.processing_id,
                                method=method_data['method'],
                                input_size=len(file_content),
                                output_size=method_data.get('outputLength', 0),
                                conversion_time=method_data.get('processingTime', 0),
                                quality_score=method_data.get('qualityScore'),
                                success=True
                            )
                    
                    # LangChain処理メタデータ
                    if langchain_result and langchain_result.success:
                        self.metadata_manager.create_chunking_metadata(
                            processing_id=processing_metadata.processing_id,
                            total_chunks=len(langchain_result.chunks),
                            chunk_size=langchain_result.metadata.get('chunk_size', 0),
                            chunk_overlap=langchain_result.metadata.get('chunk_overlap', 0),
                            chunking_strategy='recursive_character',
                            chunking_time=langchain_result.metadata.get('total_processing_time', 0),
                            average_chunk_size=sum(len(chunk['content']) for chunk in langchain_result.chunks) / len(langchain_result.chunks) if langchain_result.chunks else 0
                        )
                    
                    # ベクトル処理メタデータ
                    if vector_result and vector_result.success:
                        self.metadata_manager.create_embedding_metadata(
                            processing_id=processing_metadata.processing_id,
                            embedding_model=vector_result.metadata.get('embedding_model', ''),
                            embedding_dimension=vector_result.metadata.get('embedding_dimension', 0),
                            total_embeddings=vector_result.metadata.get('total_embeddings', 0),
                            embedding_time=vector_result.metadata.get('total_processing_time', 0),
                            batch_size=vector_result.metadata.get('batch_size', 0),
                            average_embedding_time=vector_result.metadata.get('average_batch_time', 0)
                        )
                    
                    # OpenSearch格納メタデータ
                    if opensearch_result and opensearch_result.get('success'):
                        self.metadata_manager.create_storage_metadata(
                            processing_id=processing_metadata.processing_id,
                            storage_type='opensearch',
                            stored_documents=opensearch_result.get('stored_count', 0),
                            storage_time=opensearch_result.get('processing_time', 0),
                            index_name=opensearch_result.get('index')
                        )
                    
                    # 処理メタデータ更新
                    self.metadata_manager.update_processing_metadata(
                        processing_metadata=processing_metadata,
                        attempted_methods=attempted_methods,
                        final_method=final_method,
                        success=True
                    )
                except Exception as e:
                    logger.warning(f"メタデータ更新に失敗: {e}")
            
            # 追跡情報の保存
            self.save_tracking_info(
                file_hash, file_name, file_format, 
                result['processingStrategy'], final_method,
                attempted_methods, total_time, len(final_content)
            )
            
            # CloudWatchメトリクス送信
            if self.metrics_collector:
                try:
                    # 変換メトリクス送信
                    self.metrics_collector.put_conversion_metrics(
                        file_format=file_format or 'unknown',
                        processing_method=final_method,
                        success=True,
                        processing_time_ms=total_time,
                        file_size_bytes=len(file_content),
                        output_size_bytes=len(final_content),
                        quality_score=next((m.get('qualityScore') for m in attempted_methods if m.get('success')), None)
                    )
                    
                    # 埋め込みメトリクス送信
                    if vector_result and vector_result.success:
                        self.metrics_collector.put_embedding_metrics(
                            embedding_model=vector_result.metadata.get('embedding_model', ''),
                            total_chunks=vector_result.metadata.get('total_embeddings', 0),
                            embedding_time_ms=vector_result.metadata.get('total_processing_time', 0),
                            batch_size=vector_result.metadata.get('batch_size', 0),
                            success_count=vector_result.metadata.get('total_embeddings', 0),
                            error_count=0
                        )
                    
                    # ストレージメトリクス送信
                    if opensearch_result and opensearch_result.get('success'):
                        self.metrics_collector.put_storage_metrics(
                            storage_type='opensearch',
                            documents_stored=opensearch_result.get('stored_count', 0),
                            storage_time_ms=opensearch_result.get('processing_time', 0) * 1000,
                            success=True,
                            index_name=opensearch_result.get('index')
                        )
                    
                    # パフォーマンスメトリクス送信
                    self.metrics_collector.put_performance_metrics(
                        total_files_processed=1,
                        total_processing_time_ms=total_time
                    )
                    
                except Exception as e:
                    logger.warning(f"CloudWatchメトリクス送信に失敗: {e}")
            
            # メタデータ情報を結果に追加
            if file_metadata and processing_metadata:
                result['metadata']['fileId'] = file_metadata.file_id
                result['metadata']['processingId'] = processing_metadata.processing_id
                result['metadata']['fileHash'] = file_metadata.file_hash
            
            # 構造化ログ: 処理完了
            if self.structured_logger:
                try:
                    self.structured_logger.complete_document_processing(
                        total_duration_ms=total_time,
                        success=True,
                        processing_method=final_method,
                        output_size=len(final_content),
                        quality_score=next((m.get('qualityScore') for m in attempted_methods if m.get('success')), None)
                    )
                except Exception as e:
                    logger.warning(f"処理完了ログに失敗: {e}")
            
            logger.info(f"文書処理完了: {file_name} ({final_method}, {total_time:.2f}ms)")
            
        except Exception as e:
            end_time = datetime.now()
            total_time = (end_time - start_time).total_seconds() * 1000
            
            error_msg = str(e)
            result.update({
                'success': False,
                'error': {
                    'message': error_msg,
                    'type': type(e).__name__,
                    'timestamp': end_time.isoformat()
                },
                'metadata': {
                    'startTime': start_time.isoformat(),
                    'endTime': end_time.isoformat(),
                    'attemptedMethods': result['metadata'].get('attemptedMethods', []),
                    'totalProcessingTime': total_time
                }
            })
            
            # エラー時のCloudWatchメトリクス送信
            if self.metrics_collector:
                try:
                    error_type = type(e).__name__
                    error_code = getattr(e, 'code', 'UNKNOWN_ERROR')
                    
                    self.metrics_collector.put_error_metrics(
                        error_type=error_type,
                        error_code=error_code,
                        file_format=file_format,
                        processing_method='none'
                    )
                    
                    # 失敗した変換メトリクス送信
                    self.metrics_collector.put_conversion_metrics(
                        file_format=file_format or 'unknown',
                        processing_method='none',
                        success=False,
                        processing_time_ms=total_time,
                        file_size_bytes=len(file_content),
                        output_size_bytes=0
                    )
                except Exception as metrics_error:
                    logger.warning(f"エラー時メトリクス送信に失敗: {metrics_error}")
            
            # エラー時のメタデータ更新
            if self.metadata_manager and processing_metadata:
                try:
                    self.metadata_manager.update_processing_metadata(
                        processing_metadata=processing_metadata,
                        attempted_methods=result['metadata'].get('attemptedMethods', []),
                        final_method='none',
                        success=False,
                        error_message=error_msg
                    )
                except Exception as meta_error:
                    logger.warning(f"エラー時メタデータ更新に失敗: {meta_error}")
            
            # エラー情報の追跡保存
            self.save_tracking_info(
                file_hash, file_name, file_format or 'unknown',
                result['processingStrategy'] or 'unknown', 'none',
                result['metadata']['attemptedMethods'], total_time, 0,
                has_error=True, error_message=error_msg
            )
            
            # 構造化ログ: エラー
            if self.structured_logger:
                try:
                    self.structured_logger.log_error(
                        operation='document_processing',
                        error=e,
                        file_name=file_name
                    )
                except Exception as log_error:
                    logger.warning(f"エラーログ出力に失敗: {log_error}")
            
            logger.error(f"文書処理失敗: {file_name} - {error_msg}")
        
        return result

# グローバルインスタンス
processor = DocumentProcessor()

def lambda_handler(event, context):
    """Lambda関数のエントリーポイント"""
    logger.info(f"Document Processor Lambda開始 - Event: {json.dumps(event, default=str)}")
    
    try:
        # イベントからファイル情報を取得
        # TODO: 実際のイベント構造に合わせて調整
        if 'Records' in event:
            # S3イベントの場合
            record = event['Records'][0]
            bucket = record['s3']['bucket']['name']
            key = record['s3']['object']['key']
            
            # S3からファイルを取得
            response = s3_client.get_object(Bucket=bucket, Key=key)
            file_content = response['Body'].read()
            file_name = key.split('/')[-1]
            
        elif 'body' in event:
            # API Gatewayイベントの場合
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
            file_name = body.get('fileName')
            file_content = body.get('fileContent', '').encode() if isinstance(body.get('fileContent'), str) else body.get('fileContent', b'')
            processing_strategy = body.get('processingStrategy')
            
        else:
            # 直接呼び出しの場合
            file_name = event.get('fileName')
            file_content = event.get('fileContent', '').encode() if isinstance(event.get('fileContent'), str) else event.get('fileContent', b'')
            processing_strategy = event.get('processingStrategy')
        
        if not file_name or not file_content:
            raise ValueError("ファイル名またはファイル内容が指定されていません")
        
        # 文書処理実行
        result = processor.process_document(
            file_content=file_content,
            file_name=file_name,
            processing_strategy=processing_strategy
        )
        
        # レスポンス作成
        response = {
            'statusCode': 200 if result['success'] else 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(result, default=str, ensure_ascii=False)
        }
        
        logger.info(f"Document Processor Lambda完了 - Status: {response['statusCode']}")
        return response
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Document Processor Lambda エラー: {error_msg}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': False,
                'error': {
                    'message': error_msg,
                    'type': type(e).__name__,
                    'timestamp': datetime.now().isoformat()
                }
            }, default=str, ensure_ascii=False)
        }