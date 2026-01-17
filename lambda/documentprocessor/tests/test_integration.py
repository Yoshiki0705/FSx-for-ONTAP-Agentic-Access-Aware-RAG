#!/usr/bin/env python3
"""
Markitdown統合機能の統合テスト
実際のコンポーネント間の連携をテスト
"""

import unittest
import os
import sys
import json
import tempfile
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
import boto3
from moto import mock_s3, mock_dynamodb, mock_lambda

# テスト対象モジュールのインポート
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from document_processor import DocumentProcessor
from langchain_integration import LangChainIntegration, create_langchain_integration
from vector_embedding_bedrock_kb import BedrockKBVectorProcessor, create_bedrock_kb_vector_processor
from metadata_manager import MetadataManager, create_metadata_manager
from cloudwatch_metrics import CloudWatchMetricsCollector, create_cloudwatch_metrics_collector
from structured_logging import MarkitdownLogger, create_markitdown_logger
from error_handler import FallbackHandler, ResourceMonitor
from config_loader import load_markitdown_config

# テストデータ
from test_data.sample_documents import SampleDocumentGenerator, TestScenarios

class TestMarkitdownIntegration(unittest.TestCase):
    """Markitdown統合テストクラス"""
    
    def setUp(self):
        """テストセットアップ"""
        # テスト用環境変数
        os.environ['AWS_REGION'] = 'us-east-1'
        os.environ['ENVIRONMENT'] = 'test'
        os.environ['LOG_LEVEL'] = 'DEBUG'
        
        # テスト用設定
        self.test_config = {
            'region': 'us-east-1',
            'embedding_model': 'amazon.titan-embed-text-v1',
            'namespace': 'Test/DocumentProcessor/Markitdown',
            'supportedFormats': {
                'pdf': {'enabled': True, 'processingStrategy': 'markitdown-first'},
                'txt': {'enabled': True, 'processingStrategy': 'langchain-only'},
                'docx': {'enabled': True, 'processingStrategy': 'markitdown-first'}
            }
        }
        
        # テストファイル生成
        self.test_files = SampleDocumentGenerator.generate_test_files()
    
    def tearDown(self):
        """テストクリーンアップ"""
        # 環境変数クリア
        for key in ['AWS_REGION', 'ENVIRONMENT', 'LOG_LEVEL']:
            if key in os.environ:
                del os.environ[key]

class TestEndToEndProcessing(TestMarkitdownIntegration):
    """エンドツーエンド処理テスト"""
    
    @mock_s3
    @mock_dynamodb
    def test_complete_document_processing_flow(self):
        """完全な文書処理フローテスト"""
        # AWSサービスのモック設定
        s3 = boto3.client('s3', region_name='us-east-1')
        dynamodb = boto3.client('dynamodb', region_name='us-east-1')
        
        # S3バケット作成
        bucket_name = 'test-document-bucket'
        s3.create_bucket(Bucket=bucket_name)
        
        # DynamoDBテーブル作成
        table_name = 'test-metadata-table'
        dynamodb.create_table(
            TableName=table_name,
            KeySchema=[
                {'AttributeName': 'file_id', 'KeyType': 'HASH'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'file_id', 'AttributeType': 'S'}
            ],
            BillingMode='PAY_PER_REQUEST'
        )
        
        # テストファイルをS3にアップロード
        test_file_key = 'test-files/test_simple.txt'
        s3.put_object(
            Bucket=bucket_name,
            Key=test_file_key,
            Body=self.test_files['test_simple.txt']
        )
        
        # 統合処理テスト
        with patch('document_processor.boto3') as mock_boto3, \
             patch('langchain_integration.boto3') as mock_langchain_boto3, \
             patch('vector_embedding_bedrock_kb.boto3') as mock_vector_boto3:
            
            # Bedrockモックの設定
            mock_bedrock = Mock()
            mock_bedrock.invoke_model.return_value = {
                'body': Mock()
            }
            mock_bedrock.invoke_model.return_value['body'].read.return_value = json.dumps({
                'embedding': [0.1] * 1536
            }).encode()
            
            mock_boto3.client.return_value = s3
            mock_langchain_boto3.client.return_value = mock_bedrock
            mock_vector_boto3.client.return_value = mock_bedrock
            
            # DocumentProcessor初期化
            processor = DocumentProcessor()
            
            # 処理実行
            result = processor.process_document(
                file_content=self.test_files['test_simple.txt'],
                file_name='test_simple.txt',
                user_id='test_user',
                project_id='test_project'
            )
            
            # 結果検証
            self.assertIsNotNone(result)
            # 実装に応じて詳細な検証を追加
    
    def test_multi_format_processing(self):
        """複数ファイル形式処理テスト"""
        test_cases = [
            ('test_simple.pdf', 'pdf'),
            ('test_simple.txt', 'txt'),
            ('test_japanese.txt', 'txt')
        ]
        
        for file_name, expected_format in test_cases:
            with self.subTest(file_name=file_name):
                with patch('document_processor.boto3'):
                    processor = DocumentProcessor()
                    
                    # ファイル形式判定テスト
                    detected_format = processor.get_file_format(file_name)
                    self.assertEqual(detected_format, expected_format)
    
    def test_error_recovery_flow(self):
        """エラー回復フローテスト"""
        with patch('document_processor.boto3'):
            processor = DocumentProcessor()
            
            # 空ファイルでのエラー処理テスト
            result = processor.process_document(
                file_content=self.test_files['test_empty.txt'],
                file_name='test_empty.txt'
            )
            
            # エラーが適切に処理されることを確認
            self.assertIsNotNone(result)
            # 実装に応じてエラー処理の詳細を検証

class TestComponentIntegration(TestMarkitdownIntegration):
    """コンポーネント間統合テスト"""
    
    def test_langchain_vector_integration(self):
        """LangChain-ベクトル処理統合テスト"""
        with patch('langchain_integration.boto3'), \
             patch('vector_embedding_bedrock_kb.boto3') as mock_boto3:
            
            # Bedrockモック設定
            mock_bedrock = Mock()
            mock_bedrock.invoke_model.return_value = {
                'body': Mock()
            }
            mock_bedrock.invoke_model.return_value['body'].read.return_value = json.dumps({
                'embedding': [0.1] * 1536
            }).encode()
            mock_boto3.client.return_value = mock_bedrock
            
            # LangChain統合初期化
            langchain_integration = create_langchain_integration(self.test_config)
            
            # ベクトル処理初期化
            vector_processor = create_bedrock_kb_vector_processor(self.test_config)
            
            # マークダウンコンテンツ処理
            markdown_content = self.test_files['test_simple.txt'].decode('utf-8')
            
            # LangChainでチャンク分割
            langchain_result = langchain_integration.process_markdown_content(
                markdown_content=markdown_content,
                source_file='test_simple.txt',
                processing_method='langchain'
            )
            
            self.assertTrue(langchain_result.success)
            self.assertGreater(len(langchain_result.chunks), 0)
            
            # ベクトル埋め込み生成
            texts = [chunk['content'] for chunk in langchain_result.chunks]
            vector_result = vector_processor.generate_embeddings(texts)
            
            self.assertTrue(vector_result.success)
            self.assertEqual(len(vector_result.embeddings), len(texts))
    
    def test_metadata_logging_integration(self):
        """メタデータ-ログ統合テスト"""
        with patch('metadata_manager.boto3'), \
             patch('structured_logging.logging'):
            
            # メタデータ管理初期化
            metadata_manager = create_metadata_manager(self.test_config)
            
            # ログ初期化
            logger = create_markitdown_logger()
            
            # ファイルメタデータ作成
            file_metadata = metadata_manager.create_file_metadata(
                file_name='test_simple.txt',
                file_content=self.test_files['test_simple.txt'],
                file_format='txt',
                user_id='test_user',
                project_id='test_project'
            )
            
            self.assertIsNotNone(file_metadata.file_id)
            
            # 処理開始ログ
            processing_id = logger.start_document_processing(
                file_name='test_simple.txt',
                file_size=len(self.test_files['test_simple.txt']),
                file_format='txt',
                processing_strategy='langchain-only',
                user_id='test_user',
                project_id='test_project'
            )
            
            self.assertIsNotNone(processing_id)
            self.assertEqual(logger.current_processing_id, processing_id)
    
    def test_metrics_error_integration(self):
        """メトリクス-エラーハンドリング統合テスト"""
        with patch('cloudwatch_metrics.boto3') as mock_boto3:
            
            # CloudWatchモック設定
            mock_cloudwatch = Mock()
            mock_boto3.client.return_value = mock_cloudwatch
            
            # メトリクス収集初期化
            metrics_collector = create_cloudwatch_metrics_collector(self.test_config)
            
            # エラーハンドラー初期化
            fallback_handler = FallbackHandler({
                'fallback': {
                    'enabled': True,
                    'maxRetries': 3,
                    'retryDelay': 1.0
                }
            })
            
            # エラーメトリクス送信テスト
            result = metrics_collector.put_error_metrics(
                error_type='ProcessingError',
                error_code='CONVERSION_FAILED',
                file_format='pdf',
                processing_method='markitdown'
            )
            
            self.assertTrue(result)
            mock_cloudwatch.put_metric_data.assert_called()

class TestPerformanceIntegration(TestMarkitdownIntegration):
    """パフォーマンス統合テスト"""
    
    def test_large_file_processing(self):
        """大容量ファイル処理テスト"""
        with patch('document_processor.boto3'):
            processor = DocumentProcessor()
            
            # 大容量ファイル処理
            start_time = datetime.now()
            
            result = processor.process_document(
                file_content=self.test_files['test_large.txt'],
                file_name='test_large.txt'
            )
            
            end_time = datetime.now()
            processing_time = (end_time - start_time).total_seconds() * 1000
            
            # パフォーマンス検証
            self.assertLess(processing_time, 60000)  # 60秒以内
            self.assertIsNotNone(result)
    
    def test_concurrent_processing(self):
        """並行処理テスト"""
        import threading
        import queue
        
        results = queue.Queue()
        errors = queue.Queue()
        
        def process_document(doc_id):
            try:
                with patch('document_processor.boto3'):
                    processor = DocumentProcessor()
                    
                    result = processor.process_document(
                        file_content=self.test_files['test_simple.txt'],
                        file_name=f'test_{doc_id}.txt'
                    )
                    results.put(result)
            except Exception as e:
                errors.put(e)
        
        # 5つのスレッドで並行処理
        threads = []
        for i in range(5):
            thread = threading.Thread(target=process_document, args=(i,))
            threads.append(thread)
            thread.start()
        
        # 全スレッド完了待機
        for thread in threads:
            thread.join(timeout=30)
        
        # 結果検証
        self.assertTrue(errors.empty(), f"エラーが発生: {list(errors.queue)}")
        # self.assertEqual(results.qsize(), 5)  # 実装に応じて有効化

class TestConfigurationIntegration(TestMarkitdownIntegration):
    """設定統合テスト"""
    
    def test_config_loading_integration(self):
        """設定読み込み統合テスト"""
        # テスト用設定ファイル作成
        test_config = {
            "version": "1.0.0",
            "supportedFormats": {
                "pdf": {
                    "enabled": True,
                    "processingStrategy": "markitdown-first"
                },
                "txt": {
                    "enabled": True,
                    "processingStrategy": "langchain-only"
                }
            },
            "performance": {
                "maxFileSizeBytes": 52428800,
                "maxProcessingTime": 300000
            },
            "fallback": {
                "enabled": True,
                "maxRetries": 3
            }
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(test_config, f)
            config_path = f.name
        
        try:
            # 設定ファイルパス設定
            os.environ['MARKITDOWN_CONFIG_PATH'] = config_path
            
            # 設定読み込み
            config = load_markitdown_config('test')
            
            self.assertIsNotNone(config)
            self.assertEqual(config['version'], '1.0.0')
            self.assertTrue(config['supportedFormats']['pdf']['enabled'])
            
            # 各コンポーネントでの設定使用テスト
            with patch('document_processor.boto3'), \
                 patch('langchain_integration.boto3'), \
                 patch('vector_embedding_bedrock_kb.boto3'):
                
                # DocumentProcessor
                processor = DocumentProcessor()
                self.assertIsNotNone(processor.config)
                
                # LangChain統合
                langchain_integration = create_langchain_integration(config)
                self.assertIsNotNone(langchain_integration)
                
                # ベクトル処理
                vector_processor = create_bedrock_kb_vector_processor(config)
                self.assertIsNotNone(vector_processor)
                
        finally:
            # クリーンアップ
            os.unlink(config_path)
            if 'MARKITDOWN_CONFIG_PATH' in os.environ:
                del os.environ['MARKITDOWN_CONFIG_PATH']

def run_integration_tests():
    """統合テスト実行関数"""
    # テストスイート作成
    test_suite = unittest.TestSuite()
    
    # テストクラス追加
    test_classes = [
        TestEndToEndProcessing,
        TestComponentIntegration,
        TestPerformanceIntegration,
        TestConfigurationIntegration
    ]
    
    for test_class in test_classes:
        tests = unittest.TestLoader().loadTestsFromTestCase(test_class)
        test_suite.addTests(tests)
    
    # テスト実行
    runner = unittest.TextTestRunner(
        verbosity=2,
        stream=sys.stdout,
        buffer=True
    )
    
    result = runner.run(test_suite)
    
    # 結果サマリー
    print(f"\n{'='*60}")
    print(f"統合テスト結果サマリー")
    print(f"{'='*60}")
    print(f"実行テスト数: {result.testsRun}")
    print(f"成功: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"失敗: {len(result.failures)}")
    print(f"エラー: {len(result.errors)}")
    
    if result.failures:
        print(f"\n失敗したテスト:")
        for test, traceback in result.failures:
            print(f"  - {test}")
    
    if result.errors:
        print(f"\nエラーが発生したテスト:")
        for test, traceback in result.errors:
            print(f"  - {test}")
    
    return result.wasSuccessful()

if __name__ == '__main__':
    success = run_integration_tests()
    sys.exit(0 if success else 1)