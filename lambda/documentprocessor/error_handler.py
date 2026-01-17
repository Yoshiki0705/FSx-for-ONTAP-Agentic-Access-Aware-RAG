"""
エラーハンドリングとフォールバック機構
Markitdown統合でのエラー処理とフォールバック戦略
"""

import logging
import time
from typing import Dict, Any, Tuple, Optional, Callable
from datetime import datetime
from enum import Enum

logger = logging.getLogger(__name__)

class ErrorType(Enum):
    """エラータイプの定義"""
    CONVERSION_FAILED = "CONVERSION_FAILED"
    TIMEOUT_ERROR = "TIMEOUT_ERROR"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT"
    SECURITY_VIOLATION = "SECURITY_VIOLATION"
    MEMORY_LIMIT_EXCEEDED = "MEMORY_LIMIT_EXCEEDED"
    OCR_FAILED = "OCR_FAILED"
    NETWORK_ERROR = "NETWORK_ERROR"
    INVALID_FILE_CONTENT = "INVALID_FILE_CONTENT"
    PROCESSING_INTERRUPTED = "PROCESSING_INTERRUPTED"

class ProcessingError(Exception):
    """処理エラーの基底クラス"""
    
    def __init__(self, error_type: ErrorType, message: str, details: Optional[Dict] = None):
        self.error_type = error_type
        self.message = message
        self.details = details or {}
        self.timestamp = datetime.now().isoformat()
        super().__init__(message)

class TimeoutError(ProcessingError):
    """タイムアウトエラー"""
    
    def __init__(self, message: str, timeout_seconds: int):
        super().__init__(ErrorType.TIMEOUT_ERROR, message, {'timeout_seconds': timeout_seconds})

class FileSizeError(ProcessingError):
    """ファイルサイズエラー"""
    
    def __init__(self, message: str, file_size: int, max_size: int):
        super().__init__(ErrorType.FILE_TOO_LARGE, message, {
            'file_size': file_size,
            'max_size': max_size
        })

class ConversionError(ProcessingError):
    """変換エラー"""
    
    def __init__(self, message: str, method: str, original_error: Optional[Exception] = None):
        details = {'method': method}
        if original_error:
            details['original_error'] = str(original_error)
            details['original_error_type'] = type(original_error).__name__
        super().__init__(ErrorType.CONVERSION_FAILED, message, details)

class FallbackHandler:
    """フォールバック処理ハンドラー"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.fallback_config = config.get('fallback', {})
        self.retry_attempts = self.fallback_config.get('retryAttempts', 2)
        self.retry_delay_ms = self.fallback_config.get('retryDelayMs', 1000)
        self.use_langchain_on_failure = self.fallback_config.get('useLangChainOnFailure', True)
    
    def execute_with_fallback(self, 
                            primary_func: Callable,
                            fallback_func: Optional[Callable],
                            file_content: bytes,
                            file_format: str,
                            file_name: str,
                            timeout_seconds: Optional[int] = None) -> Tuple[bool, str, Dict]:
        """
        フォールバック機能付きで処理を実行
        
        Args:
            primary_func: 主要な処理関数
            fallback_func: フォールバック処理関数
            file_content: ファイル内容
            file_format: ファイル形式
            file_name: ファイル名
            timeout_seconds: タイムアウト時間
        
        Returns:
            (成功フラグ, 変換結果, メタデータ)
        """
        start_time = datetime.now()
        attempts = []
        
        # 主要処理の実行
        success, content, metadata = self._execute_with_retry(
            primary_func, file_content, file_name, timeout_seconds
        )
        attempts.append(metadata)
        
        if success:
            logger.info(f"主要処理が成功: {file_name}")
            return True, content, self._create_final_metadata(attempts, metadata['method'], start_time)
        
        # フォールバック処理の実行
        if fallback_func and self.use_langchain_on_failure:
            logger.info(f"フォールバック処理を開始: {file_name}")
            
            success, content, fallback_metadata = self._execute_with_retry(
                fallback_func, file_content, file_name, timeout_seconds
            )
            attempts.append(fallback_metadata)
            
            if success:
                logger.info(f"フォールバック処理が成功: {file_name}")
                return True, content, self._create_final_metadata(attempts, fallback_metadata['method'], start_time)
        
        # すべての処理が失敗
        logger.error(f"すべての処理が失敗: {file_name}")
        return False, "", self._create_final_metadata(attempts, 'none', start_time, has_error=True)
    
    def _execute_with_retry(self, 
                          func: Callable,
                          file_content: bytes,
                          file_name: str,
                          timeout_seconds: Optional[int] = None) -> Tuple[bool, str, Dict]:
        """リトライ機能付きで処理を実行"""
        
        for attempt in range(self.retry_attempts + 1):
            try:
                if timeout_seconds:
                    # タイムアウト付き実行
                    return self._execute_with_timeout(func, file_content, file_name, timeout_seconds)
                else:
                    # 通常実行
                    return func(file_content, file_name)
                    
            except ProcessingError as e:
                logger.warning(f"処理エラー (試行 {attempt + 1}/{self.retry_attempts + 1}): {e.message}")
                
                # リトライ不可能なエラーの場合は即座に失敗
                if e.error_type in [ErrorType.FILE_TOO_LARGE, ErrorType.UNSUPPORTED_FORMAT, 
                                  ErrorType.SECURITY_VIOLATION, ErrorType.INVALID_FILE_CONTENT]:
                    return False, "", {
                        'method': getattr(func, '__name__', 'unknown'),
                        'success': False,
                        'error': e.message,
                        'error_type': e.error_type.value,
                        'attempts': attempt + 1
                    }
                
                # 最後の試行でない場合はリトライ
                if attempt < self.retry_attempts:
                    time.sleep(self.retry_delay_ms / 1000.0)
                    continue
                else:
                    return False, "", {
                        'method': getattr(func, '__name__', 'unknown'),
                        'success': False,
                        'error': e.message,
                        'error_type': e.error_type.value,
                        'attempts': attempt + 1
                    }
                    
            except Exception as e:
                logger.error(f"予期しないエラー (試行 {attempt + 1}/{self.retry_attempts + 1}): {e}")
                
                # 最後の試行でない場合はリトライ
                if attempt < self.retry_attempts:
                    time.sleep(self.retry_delay_ms / 1000.0)
                    continue
                else:
                    return False, "", {
                        'method': getattr(func, '__name__', 'unknown'),
                        'success': False,
                        'error': str(e),
                        'error_type': 'UNEXPECTED_ERROR',
                        'attempts': attempt + 1
                    }
        
        # ここには到達しないはず
        return False, "", {
            'method': getattr(func, '__name__', 'unknown'),
            'success': False,
            'error': 'リトライ回数を超過しました',
            'error_type': 'RETRY_EXCEEDED'
        }
    
    def _execute_with_timeout(self, 
                            func: Callable,
                            file_content: bytes,
                            file_name: str,
                            timeout_seconds: int) -> Tuple[bool, str, Dict]:
        """タイムアウト付きで処理を実行"""
        import signal
        
        def timeout_handler(signum, frame):
            raise TimeoutError(f"処理がタイムアウトしました: {timeout_seconds}秒", timeout_seconds)
        
        # タイムアウトハンドラーを設定
        old_handler = signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(timeout_seconds)
        
        try:
            result = func(file_content, file_name)
            signal.alarm(0)  # タイマーをクリア
            return result
        finally:
            signal.signal(signal.SIGALRM, old_handler)  # 元のハンドラーを復元
    
    def _create_final_metadata(self, 
                             attempts: list,
                             final_method: str,
                             start_time: datetime,
                             has_error: bool = False) -> Dict:
        """最終的なメタデータを作成"""
        end_time = datetime.now()
        total_time = (end_time - start_time).total_seconds() * 1000
        
        return {
            'startTime': start_time.isoformat(),
            'endTime': end_time.isoformat(),
            'totalProcessingTime': total_time,
            'finalMethod': final_method,
            'attemptedMethods': attempts,
            'totalAttempts': len(attempts),
            'fallbackUsed': len(attempts) > 1,
            'hasError': has_error,
            'retryCount': sum(attempt.get('attempts', 1) - 1 for attempt in attempts)
        }

class ResourceMonitor:
    """リソース監視クラス"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.performance_config = config.get('performance', {})
        self.max_memory_mb = self.performance_config.get('memoryLimitMB', 1024)
        self.max_file_size_bytes = self.performance_config.get('maxFileSizeBytes', 10485760)
    
    def validate_file_size(self, file_content: bytes, file_name: str) -> None:
        """ファイルサイズの検証"""
        file_size = len(file_content)
        
        if file_size > self.max_file_size_bytes:
            raise FileSizeError(
                f"ファイルサイズが制限を超過: {file_size} > {self.max_file_size_bytes}",
                file_size,
                self.max_file_size_bytes
            )
        
        logger.debug(f"ファイルサイズ検証OK: {file_name} ({file_size} bytes)")
    
    def validate_memory_usage(self) -> None:
        """メモリ使用量の検証"""
        try:
            import psutil
            process = psutil.Process()
            memory_mb = process.memory_info().rss / 1024 / 1024
            
            if memory_mb > self.max_memory_mb:
                raise ProcessingError(
                    ErrorType.MEMORY_LIMIT_EXCEEDED,
                    f"メモリ使用量が制限を超過: {memory_mb:.1f}MB > {self.max_memory_mb}MB",
                    {'current_memory_mb': memory_mb, 'limit_mb': self.max_memory_mb}
                )
            
            logger.debug(f"メモリ使用量OK: {memory_mb:.1f}MB / {self.max_memory_mb}MB")
            
        except ImportError:
            logger.warning("psutilが利用できないため、メモリ監視をスキップします")
        except Exception as e:
            logger.warning(f"メモリ監視エラー: {e}")
    
    def validate_file_content(self, file_content: bytes, file_name: str, file_format: str) -> None:
        """ファイル内容の基本検証"""
        if not file_content:
            raise ProcessingError(
                ErrorType.INVALID_FILE_CONTENT,
                "ファイル内容が空です",
                {'file_name': file_name}
            )
        
        # ファイル形式別の基本検証
        if file_format in ['docx', 'xlsx', 'pptx']:
            # Office文書はZIPベースなので、ZIP署名をチェック
            if not file_content.startswith(b'PK'):
                logger.warning(f"Office文書の署名が不正: {file_name}")
        
        elif file_format == 'pdf':
            # PDF署名をチェック
            if not file_content.startswith(b'%PDF'):
                logger.warning(f"PDF文書の署名が不正: {file_name}")
        
        elif file_format in ['png', 'jpg', 'jpeg', 'gif']:
            # 画像ファイルの基本署名をチェック
            image_signatures = {
                'png': b'\x89PNG',
                'jpg': b'\xff\xd8\xff',
                'jpeg': b'\xff\xd8\xff',
                'gif': b'GIF'
            }
            
            expected_sig = image_signatures.get(file_format)
            if expected_sig and not file_content.startswith(expected_sig):
                logger.warning(f"画像ファイルの署名が不正: {file_name}")
        
        logger.debug(f"ファイル内容検証OK: {file_name}")

def create_error_response(error: Exception, file_name: str, processing_method: str = None) -> Dict:
    """エラーレスポンスを作成"""
    error_info = {
        'success': False,
        'fileName': file_name,
        'error': {
            'message': str(error),
            'type': type(error).__name__,
            'timestamp': datetime.now().isoformat()
        },
        'metadata': {
            'processingMethod': processing_method,
            'hasError': True
        }
    }
    
    # ProcessingErrorの場合は詳細情報を追加
    if isinstance(error, ProcessingError):
        error_info['error'].update({
            'errorType': error.error_type.value,
            'details': error.details
        })
    
    return error_info

def log_processing_error(error: Exception, file_name: str, context: Dict = None):
    """処理エラーのログ出力"""
    context = context or {}
    
    if isinstance(error, ProcessingError):
        logger.error(f"処理エラー [{error.error_type.value}]: {file_name} - {error.message}")
        if error.details:
            logger.error(f"エラー詳細: {error.details}")
    else:
        logger.error(f"予期しないエラー: {file_name} - {error}")
    
    if context:
        logger.error(f"コンテキスト: {context}")

def handle_partial_conversion_error(partial_content: str, error: Exception, file_name: str) -> Tuple[bool, str, Dict]:
    """部分的変換エラーの処理"""
    logger.warning(f"部分的変換エラーが発生: {file_name} - {error}")
    
    if partial_content and len(partial_content.strip()) > 0:
        # 部分的な結果がある場合は、警告付きで成功として扱う
        warning_content = f"""# {file_name}

⚠️ **警告**: この文書の変換中に部分的なエラーが発生しました。

**エラー詳細**: {str(error)}

---

## 変換された内容

{partial_content}

---

*注意: この変換結果は不完全な可能性があります。*
"""
        
        metadata = {
            'success': True,
            'partialConversion': True,
            'warning': str(error),
            'outputLength': len(warning_content),
            'qualityScore': 50  # 部分的変換なので品質スコアは低め
        }
        
        logger.info(f"部分的変換として処理: {file_name}")
        return True, warning_content, metadata
    
    else:
        # 有用な内容がない場合は失敗として扱う
        metadata = {
            'success': False,
            'error': str(error),
            'partialConversion': False
        }
        
        logger.error(f"部分的変換も失敗: {file_name}")
        return False, "", metadata