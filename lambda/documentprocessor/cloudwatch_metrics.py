"""
CloudWatchメトリクス収集機能
Markitdown処理のパフォーマンス、成功率、エラー率の監視
"""

import json
import logging
import os
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import boto3
from botocore.exceptions import ClientError
from datetime import datetime, timedelta
import time

logger = logging.getLogger(__name__)

@dataclass
class MetricData:
    """メトリクスデータ"""
    metric_name: str
    value: float
    unit: str
    dimensions: Dict[str, str]
    timestamp: Optional[datetime] = None

class CloudWatchMetricsCollector:
    """CloudWatchメトリクス収集クラス"""
    
    # クラス定数
    MAX_METRICS_PER_BATCH = 20
    DEFAULT_REGION = 'us-east-1'
    DEFAULT_NAMESPACE = 'RAG/DocumentProcessor/Markitdown'
    
    def __init__(self, 
                 region: str = None,
                 namespace: str = None,
                 max_retries: int = 3):
        """
        初期化
        
        Args:
            region: AWSリージョン
            namespace: CloudWatchメトリクス名前空間
            max_retries: 最大リトライ回数
        """
        self.region = region or os.environ.get('AWS_REGION') or self.DEFAULT_REGION
        self.namespace = namespace or self.DEFAULT_NAMESPACE
        self.max_retries = max_retries
        
        # CloudWatch クライアント初期化（エラーハンドリング強化）
        try:
            self.cloudwatch = boto3.client('cloudwatch', region_name=self.region)
            # 接続テスト
            self.cloudwatch.list_metrics(Namespace=self.namespace, MaxRecords=1)
        except Exception as e:
            logger.error(f"CloudWatchクライアント初期化エラー: {e}")
            raise ValueError(f"CloudWatch接続に失敗しました: {e}")
        
        logger.info(f"CloudWatchメトリクス収集を初期化: namespace={self.namespace}, region={self.region}")
    
    def put_conversion_metrics(self, 
                             file_format: str,
                             processing_method: str,
                             success: bool,
                             processing_time_ms: float,
                             file_size_bytes: int,
                             output_size_bytes: int = 0,
                             quality_score: Optional[float] = None) -> bool:
        """
        変換処理メトリクスを送信
        
        Args:
            file_format: ファイル形式
            processing_method: 処理方法（markitdown/langchain）
            success: 成功フラグ
            processing_time_ms: 処理時間（ミリ秒）
            file_size_bytes: 入力ファイルサイズ
            output_size_bytes: 出力サイズ
            quality_score: 品質スコア
            
        Returns:
            bool: 送信成功フラグ
        """
        try:
            # 入力値検証とサニタイズ
            if not self._validate_metric_inputs(file_format, processing_method, processing_time_ms, file_size_bytes):
                return False
            
            metrics = []
            
            # 基本ディメンション（サニタイズ済み）
            dimensions = {
                'FileFormat': self._sanitize_dimension_value(file_format),
                'ProcessingMethod': self._sanitize_dimension_value(processing_method),
                'Environment': os.environ.get('ENVIRONMENT', 'prod')
            }
            
            # 成功率メトリクス
            metrics.append(MetricData(
                metric_name='ConversionSuccess',
                value=1.0 if success else 0.0,
                unit='Count',
                dimensions=dimensions
            ))
            
            # 処理時間メトリクス
            metrics.append(MetricData(
                metric_name='ProcessingTime',
                value=processing_time_ms,
                unit='Milliseconds',
                dimensions=dimensions
            ))
            
            # ファイルサイズメトリクス
            metrics.append(MetricData(
                metric_name='InputFileSize',
                value=file_size_bytes,
                unit='Bytes',
                dimensions=dimensions
            ))
            
            if output_size_bytes > 0:
                metrics.append(MetricData(
                    metric_name='OutputSize',
                    value=output_size_bytes,
                    unit='Bytes',
                    dimensions=dimensions
                ))
                
                # 圧縮率メトリクス
                compression_ratio = output_size_bytes / file_size_bytes if file_size_bytes > 0 else 0
                metrics.append(MetricData(
                    metric_name='CompressionRatio',
                    value=compression_ratio,
                    unit='None',
                    dimensions=dimensions
                ))
            
            # 品質スコアメトリクス
            if quality_score is not None:
                metrics.append(MetricData(
                    metric_name='QualityScore',
                    value=quality_score,
                    unit='None',
                    dimensions=dimensions
                ))
            
            # スループットメトリクス（バイト/秒）
            if processing_time_ms > 0:
                throughput = (file_size_bytes * 1000) / processing_time_ms  # バイト/秒
                metrics.append(MetricData(
                    metric_name='ProcessingThroughput',
                    value=throughput,
                    unit='Bytes/Second',
                    dimensions=dimensions
                ))
            
            # メトリクス送信
            return self._send_metrics(metrics)
            
        except Exception as e:
            logger.error(f"❌ 変換メトリクス送信エラー: {e}")
            return False
    
    def put_embedding_metrics(self,
                            embedding_model: str,
                            total_chunks: int,
                            embedding_time_ms: float,
                            batch_size: int,
                            success_count: int,
                            error_count: int = 0) -> bool:
        """
        埋め込み生成メトリクスを送信
        
        Args:
            embedding_model: 埋め込みモデル名
            total_chunks: 総チャンク数
            embedding_time_ms: 埋め込み生成時間
            batch_size: バッチサイズ
            success_count: 成功数
            error_count: エラー数
            
        Returns:
            bool: 送信成功フラグ
        """
        try:
            metrics = []
            
            # 基本ディメンション
            dimensions = {
                'EmbeddingModel': embedding_model,
                'Environment': os.environ.get('ENVIRONMENT', 'prod')
            }
            
            # 埋め込み生成数メトリクス
            metrics.append(MetricData(
                metric_name='EmbeddingsGenerated',
                value=success_count,
                unit='Count',
                dimensions=dimensions
            ))
            
            # エラー数メトリクス
            if error_count > 0:
                metrics.append(MetricData(
                    metric_name='EmbeddingErrors',
                    value=error_count,
                    unit='Count',
                    dimensions=dimensions
                ))
            
            # 成功率メトリクス
            success_rate = (success_count / total_chunks * 100) if total_chunks > 0 else 0
            metrics.append(MetricData(
                metric_name='EmbeddingSuccessRate',
                value=success_rate,
                unit='Percent',
                dimensions=dimensions
            ))
            
            # 処理時間メトリクス
            metrics.append(MetricData(
                metric_name='EmbeddingProcessingTime',
                value=embedding_time_ms,
                unit='Milliseconds',
                dimensions=dimensions
            ))
            
            # バッチサイズメトリクス
            metrics.append(MetricData(
                metric_name='EmbeddingBatchSize',
                value=batch_size,
                unit='Count',
                dimensions=dimensions
            ))
            
            # 平均処理時間（チャンクあたり）
            if success_count > 0:
                avg_time_per_chunk = embedding_time_ms / success_count
                metrics.append(MetricData(
                    metric_name='AvgTimePerEmbedding',
                    value=avg_time_per_chunk,
                    unit='Milliseconds',
                    dimensions=dimensions
                ))
            
            # スループットメトリクス（チャンク/秒）
            if embedding_time_ms > 0:
                throughput = (success_count * 1000) / embedding_time_ms
                metrics.append(MetricData(
                    metric_name='EmbeddingThroughput',
                    value=throughput,
                    unit='Count/Second',
                    dimensions=dimensions
                ))
            
            # メトリクス送信
            return self._send_metrics(metrics)
            
        except Exception as e:
            logger.error(f"❌ 埋め込みメトリクス送信エラー: {e}")
            return False
    
    def put_storage_metrics(self,
                          storage_type: str,
                          documents_stored: int,
                          storage_time_ms: float,
                          success: bool,
                          index_name: Optional[str] = None) -> bool:
        """
        ストレージメトリクスを送信
        
        Args:
            storage_type: ストレージタイプ（opensearch/dynamodb）
            documents_stored: 格納ドキュメント数
            storage_time_ms: 格納時間
            success: 成功フラグ
            index_name: インデックス名
            
        Returns:
            bool: 送信成功フラグ
        """
        try:
            metrics = []
            
            # 基本ディメンション
            dimensions = {
                'StorageType': storage_type,
                'Environment': os.environ.get('ENVIRONMENT', 'prod')
            }
            
            if index_name:
                dimensions['IndexName'] = index_name
            
            # 格納成功メトリクス
            metrics.append(MetricData(
                metric_name='StorageSuccess',
                value=1.0 if success else 0.0,
                unit='Count',
                dimensions=dimensions
            ))
            
            # 格納ドキュメント数メトリクス
            metrics.append(MetricData(
                metric_name='DocumentsStored',
                value=documents_stored,
                unit='Count',
                dimensions=dimensions
            ))
            
            # 格納時間メトリクス
            metrics.append(MetricData(
                metric_name='StorageTime',
                value=storage_time_ms,
                unit='Milliseconds',
                dimensions=dimensions
            ))
            
            # スループットメトリクス（ドキュメント/秒）
            if storage_time_ms > 0:
                throughput = (documents_stored * 1000) / storage_time_ms
                metrics.append(MetricData(
                    metric_name='StorageThroughput',
                    value=throughput,
                    unit='Count/Second',
                    dimensions=dimensions
                ))
            
            # 平均格納時間（ドキュメントあたり）
            if documents_stored > 0:
                avg_time_per_doc = storage_time_ms / documents_stored
                metrics.append(MetricData(
                    metric_name='AvgTimePerDocument',
                    value=avg_time_per_doc,
                    unit='Milliseconds',
                    dimensions=dimensions
                ))
            
            # メトリクス送信
            return self._send_metrics(metrics)
            
        except Exception as e:
            logger.error(f"❌ ストレージメトリクス送信エラー: {e}")
            return False
    
    def put_error_metrics(self,
                        error_type: str,
                        error_code: str,
                        file_format: Optional[str] = None,
                        processing_method: Optional[str] = None) -> bool:
        """
        エラーメトリクスを送信
        
        Args:
            error_type: エラータイプ
            error_code: エラーコード
            file_format: ファイル形式
            processing_method: 処理方法
            
        Returns:
            bool: 送信成功フラグ
        """
        try:
            # 基本ディメンション
            dimensions = {
                'ErrorType': error_type,
                'ErrorCode': error_code,
                'Environment': os.environ.get('ENVIRONMENT', 'prod')
            }
            
            if file_format:
                dimensions['FileFormat'] = file_format
            
            if processing_method:
                dimensions['ProcessingMethod'] = processing_method
            
            # エラー発生メトリクス
            metric = MetricData(
                metric_name='ProcessingError',
                value=1.0,
                unit='Count',
                dimensions=dimensions
            )
            
            # メトリクス送信
            return self._send_metrics([metric])
            
        except Exception as e:
            logger.error(f"❌ エラーメトリクス送信エラー: {e}")
            return False
    
    def put_performance_metrics(self,
                              total_files_processed: int,
                              total_processing_time_ms: float,
                              memory_usage_mb: Optional[float] = None,
                              cpu_usage_percent: Optional[float] = None) -> bool:
        """
        パフォーマンスメトリクスを送信
        
        Args:
            total_files_processed: 処理ファイル数
            total_processing_time_ms: 総処理時間
            memory_usage_mb: メモリ使用量（MB）
            cpu_usage_percent: CPU使用率（%）
            
        Returns:
            bool: 送信成功フラグ
        """
        try:
            metrics = []
            
            # 基本ディメンション
            dimensions = {
                'Environment': os.environ.get('ENVIRONMENT', 'prod'),
                'FunctionName': os.environ.get('AWS_LAMBDA_FUNCTION_NAME', 'document-processor')
            }
            
            # 処理ファイル数メトリクス
            metrics.append(MetricData(
                metric_name='FilesProcessed',
                value=total_files_processed,
                unit='Count',
                dimensions=dimensions
            ))
            
            # 総処理時間メトリクス
            metrics.append(MetricData(
                metric_name='TotalProcessingTime',
                value=total_processing_time_ms,
                unit='Milliseconds',
                dimensions=dimensions
            ))
            
            # 平均処理時間メトリクス
            if total_files_processed > 0:
                avg_processing_time = total_processing_time_ms / total_files_processed
                metrics.append(MetricData(
                    metric_name='AvgProcessingTime',
                    value=avg_processing_time,
                    unit='Milliseconds',
                    dimensions=dimensions
                ))
            
            # メモリ使用量メトリクス
            if memory_usage_mb is not None:
                metrics.append(MetricData(
                    metric_name='MemoryUsage',
                    value=memory_usage_mb,
                    unit='Megabytes',
                    dimensions=dimensions
                ))
            
            # CPU使用率メトリクス
            if cpu_usage_percent is not None:
                metrics.append(MetricData(
                    metric_name='CPUUsage',
                    value=cpu_usage_percent,
                    unit='Percent',
                    dimensions=dimensions
                ))
            
            # メトリクス送信
            return self._send_metrics(metrics)
            
        except Exception as e:
            logger.error(f"❌ パフォーマンスメトリクス送信エラー: {e}")
            return False
    
    def _send_metrics(self, metrics: List[MetricData]) -> bool:
        """
        メトリクスをCloudWatchに送信（リトライ機能付き）
        
        Args:
            metrics: メトリクスデータリスト
            
        Returns:
            bool: 送信成功フラグ
        """
        if not metrics:
            return True
        
        # CloudWatch用のメトリクスデータを構築
        metric_data = self._build_metric_data(metrics)
        
        # バッチ処理で送信（リトライ機能付き）
        return self._send_metrics_with_retry(metric_data)
    
    def _build_metric_data(self, metrics: List[MetricData]) -> List[Dict[str, Any]]:
        """メトリクスデータを構築"""
        metric_data = []
        for metric in metrics:
            data = {
                'MetricName': metric.metric_name,
                'Value': metric.value,
                'Unit': metric.unit,
                'Dimensions': [
                    {'Name': key, 'Value': value}
                    for key, value in metric.dimensions.items()
                ]
            }
            
            if metric.timestamp:
                data['Timestamp'] = metric.timestamp
            
            metric_data.append(data)
        
        return metric_data
    
    def _send_metrics_with_retry(self, metric_data: List[Dict[str, Any]]) -> bool:
        """リトライ機能付きメトリクス送信"""
        for i in range(0, len(metric_data), self.MAX_METRICS_PER_BATCH):
            batch = metric_data[i:i + self.MAX_METRICS_PER_BATCH]
            
            for retry in range(self.max_retries):
                try:
                    response = self.cloudwatch.put_metric_data(
                        Namespace=self.namespace,
                        MetricData=batch
                    )
                    
                    logger.info(f"📊 CloudWatchメトリクス送信完了: {len(batch)}メトリクス")
                    break
                    
                except ClientError as e:
                    error_code = e.response['Error']['Code']
                    
                    if error_code in ['Throttling', 'ThrottlingException']:
                        if retry < self.max_retries - 1:
                            wait_time = (2 ** retry) * 0.1  # 指数バックオフ
                            logger.warning(f"CloudWatchスロットリング、{wait_time}秒後にリトライ")
                            time.sleep(wait_time)
                            continue
                    
                    logger.error(f"❌ CloudWatch API エラー ({error_code}): {e}")
                    return False
                    
                except Exception as e:
                    if retry < self.max_retries - 1:
                        logger.warning(f"メトリクス送信エラー、リトライします: {e}")
                        time.sleep(0.1 * (retry + 1))
                        continue
                    
                    logger.error(f"❌ メトリクス送信エラー: {e}")
                    return False
        
        return True
    
    def get_metrics_statistics(self,
                             metric_name: str,
                             start_time: datetime,
                             end_time: datetime,
                             period: int = 300,
                             statistics: List[str] = None) -> Dict[str, Any]:
        """
        メトリクス統計を取得
        
        Args:
            metric_name: メトリクス名
            start_time: 開始時間
            end_time: 終了時間
            period: 期間（秒）
            statistics: 統計タイプリスト
            
        Returns:
            Dict: 統計データ
        """
        try:
            if statistics is None:
                statistics = ['Average', 'Sum', 'Maximum', 'Minimum']
            
            response = self.cloudwatch.get_metric_statistics(
                Namespace=self.namespace,
                MetricName=metric_name,
                StartTime=start_time,
                EndTime=end_time,
                Period=period,
                Statistics=statistics
            )
            
            logger.info(f"📈 メトリクス統計取得完了: {metric_name}")
            return {
                'metric_name': metric_name,
                'datapoints': response.get('Datapoints', []),
                'label': response.get('Label', ''),
                'period': period,
                'statistics': statistics
            }
            
        except Exception as e:
            logger.error(f"❌ メトリクス統計取得エラー: {e}")
            return {
                'metric_name': metric_name,
                'datapoints': [],
                'error': str(e)
            }
    
    def create_custom_dashboard(self, dashboard_name: str) -> bool:
        """
        カスタムダッシュボードを作成
        
        Args:
            dashboard_name: ダッシュボード名
            
        Returns:
            bool: 作成成功フラグ
        """
        try:
            dashboard_body = {
                "widgets": [
                    {
                        "type": "metric",
                        "x": 0,
                        "y": 0,
                        "width": 12,
                        "height": 6,
                        "properties": {
                            "metrics": [
                                [self.namespace, "ConversionSuccess", "ProcessingMethod", "markitdown"],
                                [".", ".", ".", "langchain"]
                            ],
                            "period": 300,
                            "stat": "Sum",
                            "region": self.region,
                            "title": "変換成功数"
                        }
                    },
                    {
                        "type": "metric",
                        "x": 0,
                        "y": 6,
                        "width": 12,
                        "height": 6,
                        "properties": {
                            "metrics": [
                                [self.namespace, "ProcessingTime", "ProcessingMethod", "markitdown"],
                                [".", ".", ".", "langchain"]
                            ],
                            "period": 300,
                            "stat": "Average",
                            "region": self.region,
                            "title": "平均処理時間"
                        }
                    },
                    {
                        "type": "metric",
                        "x": 0,
                        "y": 12,
                        "width": 12,
                        "height": 6,
                        "properties": {
                            "metrics": [
                                [self.namespace, "EmbeddingsGenerated"],
                                [self.namespace, "EmbeddingErrors"]
                            ],
                            "period": 300,
                            "stat": "Sum",
                            "region": self.region,
                            "title": "埋め込み生成状況"
                        }
                    }
                ]
            }
            
            self.cloudwatch.put_dashboard(
                DashboardName=dashboard_name,
                DashboardBody=json.dumps(dashboard_body)
            )
            
            logger.info(f"📊 カスタムダッシュボード作成完了: {dashboard_name}")
            return True
            
        except Exception as e:
            logger.error(f"❌ ダッシュボード作成エラー: {e}")
            return False


    def _validate_metric_inputs(self, file_format: str, processing_method: str, 
                              processing_time_ms: float, file_size_bytes: int) -> bool:
        """メトリクス入力値の検証"""
        # ファイル形式の検証
        if not file_format or len(file_format) > 50:
            logger.error(f"無効なファイル形式: {file_format}")
            return False
        
        # 処理方法の検証
        valid_methods = ['markitdown', 'langchain', 'hybrid']
        if processing_method not in valid_methods:
            logger.error(f"無効な処理方法: {processing_method}")
            return False
        
        # 数値の検証
        if processing_time_ms < 0 or processing_time_ms > 3600000:  # 1時間以内
            logger.error(f"無効な処理時間: {processing_time_ms}ms")
            return False
        
        if file_size_bytes < 0 or file_size_bytes > 1073741824:  # 1GB以内
            logger.error(f"無効なファイルサイズ: {file_size_bytes}bytes")
            return False
        
        return True
    
    def _sanitize_dimension_value(self, value: str) -> str:
        """ディメンション値のサニタイズ"""
        if not value:
            return 'unknown'
        
        # 特殊文字の除去と長さ制限
        import re
        sanitized = re.sub(r'[^\w\-\.]', '_', str(value))
        return sanitized[:255]  # CloudWatchの制限
    
    def get_health_metrics(self) -> Dict[str, Any]:
        """メトリクス収集システムの健全性情報を取得"""
        return {
            'region': self.region,
            'namespace': self.namespace,
            'max_retries': self.max_retries,
            'max_batch_size': self.MAX_METRICS_PER_BATCH,
            'client_status': 'healthy' if self.cloudwatch else 'unhealthy'
        }


def create_cloudwatch_metrics_collector(config: Dict[str, Any]) -> CloudWatchMetricsCollector:
    """
    CloudWatchメトリクス収集インスタンスを作成
    
    Args:
        config: 設定辞書
        
    Returns:
        CloudWatchMetricsCollector: メトリクス収集インスタンス
    """
    return CloudWatchMetricsCollector(
        region=config.get('region'),
        namespace=config.get('namespace'),
        max_retries=config.get('max_retries', 3)
    )


# テスト用のサンプル関数
def test_cloudwatch_metrics():
    """
    CloudWatchメトリクス収集のテスト
    """
    # メトリクス収集をテスト
    collector = CloudWatchMetricsCollector()
    
    # 変換メトリクス送信テスト
    success = collector.put_conversion_metrics(
        file_format='pdf',
        processing_method='markitdown',
        success=True,
        processing_time_ms=1500.0,
        file_size_bytes=1024000,
        output_size_bytes=2048000,
        quality_score=85.5
    )
    print(f"変換メトリクス送信: {success}")
    
    # 埋め込みメトリクス送信テスト
    success = collector.put_embedding_metrics(
        embedding_model='amazon.titan-embed-text-v1',
        total_chunks=10,
        embedding_time_ms=3000.0,
        batch_size=5,
        success_count=10,
        error_count=0
    )
    print(f"埋め込みメトリクス送信: {success}")
    
    # ストレージメトリクス送信テスト
    success = collector.put_storage_metrics(
        storage_type='opensearch',
        documents_stored=10,
        storage_time_ms=500.0,
        success=True,
        index_name='documents'
    )
    print(f"ストレージメトリクス送信: {success}")


if __name__ == "__main__":
    test_cloudwatch_metrics()