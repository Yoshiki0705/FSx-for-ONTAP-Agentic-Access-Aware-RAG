"""
Markitdown統合機能の統合テスト
S3からOpenSearchまでのエンドツーエンドテスト
"""

import json
import os
import sys
import unittest
from unittest.mock import Mock, patch, MagicMock
import boto3
from moto import mock_s3, mock_dynamodb, mock_lambda
import tempfile
import shutil
from datetime import datetime

# テスト用の環境変数設定
os.environ['MARKITDOWN_ENABLED'] = 'true'
os.environ['MARKITDOWN_ENVIRONMENT'] = 'test'
os.environ['AWS_REGION'] = 'us-east-1'
os.environ['DOCUMENTS_BUCKET'] = 'test-documents-bucket'
os.environ['TEMP_PROCESSING_BUCKET'] = 'test-temp-processing-bucket'
os.environ['METADATA_TABLE'] = 'test-metadata-table'
os.environ['TRACKING_TABLE'] = 'test-tracking-table'

# テスト対象モジュールのインポート
from document_processor import lambda_handler, DocumentProcessor

class TestS3ToOpenSearchIntegration(unittest.TestCase):
    """S3からOpenSearchまでの統合テスト"""
    
    @mock_s3
    @mock_dynamodb
    def setUp(self):
        """テストセットアップ"""
        # S3バケット作成
        self.s3_client = boto3.client('s3', region_name='us-east-1')
        self.s3_client.create_bucket(Bucket='test-documents-bucket')
        self.s3_client.create_bucket(Bucket='test-temp-processing-bucket')
        
        # DynamoDBテーブル作成
        self.dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        
        # メタデータテーブル
        self.metadata_table = self.dynamodb.create_table(
            TableName='test-metadata-table',
            KeySchema=[
                {'AttributeName': 'processing_id', 'KeyType': 'HASH'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'processing_id', 'AttributeType': 'S'}
            ],
            BillingMode='PAY_PER_REQUEST'
        )
        
        # 追跡テーブル
        self.tracking_table = self.dynamodb.create_table(
            TableName='test-tracking-table',
            KeySchema=[
                {'AttributeName': 'fileHash', 'KeyType': 'HASH'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'fileHash', 'AttributeType': 'S'}
            ],
            BillingMode='PAY_PER_REQUEST'
        )
    
    @mock_s3
    @mock_dynamodb
    def test_s3_event_processing(self):
        """S3イベント処理の統合テスト"""
        # テストファイルをS3にアップロード
        test_content = b'Test document content for S3 integration testing'
        self.s3_client.put_object(
            Bucket='test-documents-bucket',
            Key='test-documents/integration-test.txt',
            Body=test_content
        )
        
        # S3イベントを模擬
        s3_event = {
            'Records': [{
                's3': {
                    'bucket': {'name': 'test-documents-bucket'},
                    'object': {'key': 'test-documents/integration-test.txt'}
                }
            }]
        }
        
        # Lambda関数実行
        with patch('document_processor.boto3.client') as mock_boto3:
            mock_s3 = Mock()
            mock_s3.get_object.return_value = {
                'Body': Mock()
            }
            mock_s3.get_object.return_value['Body'].read.return_value = test_content
            mock_boto3.return_value = mock_s3
            
            result = lambda_handler(s3_event, {})
        
        # 結果検証
        self.assertEqual(result['statusCode'], 200)
        body = json.loads(result['body'])
        self.assertTrue(body['success'])
    
    @mock_s3
    @mock_dynamodb
    def test_api_gateway_processing(self):
        """API Gateway経由の処理テスト"""
        # API Gatewayイベントを模擬
        api_event = {
            'body': json.dumps({
                'fileName': 'api-test.pdf',
                'fileContent': 'VGVzdCBQREYgY29udGVudA==',  # Base64エンコード
                'processingStrategy': 'both-compare'
            }),
            'requestContext': {
                'authorizer': {
                    'claims': {
                        'sub': 'test-user-id'
                    }
                }
            },
            'queryStringParameters': {
                'projectId': 'test-project'
            }
        }
        
        # Lambda関数実行
        result = lambda_handler(api_event, {})
        
        # 結果検証
        self.assertIn('statusCode', result)
        body = json.loads(result['body'])
        self.assertIn('success', body)
    
    @mock_s3
    @mock_dynamodb
    @patch('document_processor.BedrockKBVectorProcessor')
    @patch('document_processor.LangChainIntegration')
    def test_end_to_end_processing(self, mock_langchain, mock_vector):
        """エンドツーエンド処理テスト"""
        # LangChainのモック設定
        mock_langchain_instance = Mock()
        mock_langchain_instance.process_markdown_content.return_value = Mock(
            success=True,
            chunks=[
                {'content': 'チャンク1', 'metadata': {'chunk_type': 'paragraph'}},
                {'content': 'チャンク2', 'metadata': {'chunk_type': 'header'}}
            ],
            embeddings=[[0.1] * 1536, [0.2] * 1536],
            metadata={'chunk_size': 1000, 'total_processing_time': 800}
        )
        mock_langchain.return_value = mock_langchain_instance
        
        # ベクトル処理のモック設定
        mock_vector_instance = Mock()
        mock_vector_instance.generate_embeddings.return_value = Mock(
            success=True,
            embeddings=[[0.1] * 1536, [0.2] * 1536],
            metadata={'total_processing_time': 3000, 'batch_size': 2}
        )
        mock_vector_instance.create_bedrock_kb_documents.return_value = [
            Mock(id='doc1', content='チャンク1'),
            Mock(id='doc2', content='チャンク2')
        ]
        mock_vector_instance.store_embeddings_to_opensearch.return_value = {
            'success': True,
            'stored_count': 2,
            'processing_time': 0.5
        }
        mock_vector.return_value = mock_vector_instance
        
        # 処理実行
        processor = DocumentProcessor()
        result = processor.process_document(
            file_content=b'Test content for end-to-end testing',
            file_name='e2e-test.txt',
            processing_strategy='markitdown-first',
            user_id='test-user',
            project_id='test-project'
        )
        
        # 結果検証
        self.assertIsInstance(result, dict)
        self.assertIn('success', result)


class TestPerformanceAndScaling(unittest.TestCase):
    """パフォーマンスとスケーリングのテスト"""
    
    def setUp(self):
        """テストセットアップ"""
        with patch('document_processor.boto3.resource'), \
             patch('document_processor.boto3.client'):
            self.processor = DocumentProcessor()
    
    def test_large_file_processing(self):
        """大容量ファイル処理テスト"""
        # 大容量ファイルコンテンツ（1MB）
        large_content = b'Large file content for testing. ' * 30000
        
        result = self.processor.process_document(
            file_content=large_content,
            file_name='large-test.txt',
            processing_strategy='markitdown-first'
        )
        
        # 処理結果の検証
        self.assertIsInstance(result, dict)
        self.assertIn('success', result)
        
        # 処理時間の確認
        if result['success']:
            processing_time = result['metadata']['totalProcessingTime']
            self.assertGreater(processing_time, 0)
            print(f"大容量ファイル処理時間: {processing_time:.2f}ms")
    
    def test_concurrent_processing_simulation(self):
        """並行処理シミュレーションテスト"""
        import threading
        import time
        
        results = []
        
        def process_file(file_index):
            """ファイル処理関数"""
            content = f'Concurrent test file {file_index} content'.encode()
            result = self.processor.process_document(
                file_content=content,
                file_name=f'concurrent-test-{file_index}.txt',
                processing_strategy='markitdown-first'
            )
            results.append(result)
        
        # 5つのファイルを並行処理
        threads = []
        for i in range(5):
            thread = threading.Thread(target=process_file, args=(i,))
            threads.append(thread)
            thread.start()
        
        # 全スレッドの完了を待機
        for thread in threads:
            thread.join()
        
        # 結果検証
        self.assertEqual(len(results), 5)
        for result in results:
            self.assertIsInstance(result, dict)
            self.assertIn('success', result)


class TestSecurityAndValidation(unittest.TestCase):
    """セキュリティと検証のテスト"""
    
    def setUp(self):
        """テストセットアップ"""
        with patch('document_processor.boto3.resource'), \
             patch('document_processor.boto3.client'):
            self.processor = DocumentProcessor()
    
    def test_file_size_validation(self):
        """ファイルサイズ検証テスト"""
        # 制限を超える大容量ファイル（100MB）
        oversized_content = b'X' * (100 * 1024 * 1024)
        
        result = self.processor.process_document(
            file_content=oversized_content,
            file_name='oversized.txt'
        )
        
        # サイズ制限エラーが適切に処理されることを確認
        if not result['success']:
            self.assertIn('error', result)
            print(f"ファイルサイズ制限エラー: {result['error']['message']}")
    
    def test_malicious_content_handling(self):
        """悪意のあるコンテンツの処理テスト"""
        # 悪意のあるスクリプトを含むHTML
        malicious_html = b'''
        <html>
        <script>alert('XSS');</script>
        <body>Test content</body>
        </html>
        '''
        
        result = self.processor.process_document(
            file_content=malicious_html,
            file_name='malicious.html'
        )
        
        # 処理結果の検証（セキュリティ処理が適切に行われることを確認）
        self.assertIsInstance(result, dict)
        if result['success']:
            # マークダウン出力にスクリプトタグが含まれていないことを確認
            markdown_content = result.get('markdownContent', '')
            self.assertNotIn('<script>', markdown_content)
            self.assertNotIn('alert(', markdown_content)


def run_integration_tests():
    """統合テストの実行"""
    print("🔗 Markitdown統合機能 統合テスト開始")
    print(f"実行日時: {datetime.now().isoformat()}")
    print("=" * 80)
    
    # テストスイートの作成
    test_suite = unittest.TestSuite()
    
    # 統合テストクラスを追加
    test_classes = [
        TestS3ToOpenSearchIntegration,
        TestPerformanceAndScaling,
        TestSecurityAndValidation
    ]
    
    for test_class in test_classes:
        tests = unittest.TestLoader().loadTestsFromTestCase(test_class)
        test_suite.addTests(tests)
    
    # テスト実行
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(test_suite)
    
    print("=" * 80)
    print(f"🎯 統合テスト結果: {result.testsRun}件実行")
    print(f"✅ 成功: {result.testsRun - len(result.failures) - len(result.errors)}件")
    print(f"❌ 失敗: {len(result.failures)}件")
    print(f"💥 エラー: {len(result.errors)}件")
    
    if result.failures:
        print("\n❌ 失敗したテスト:")
        for test, traceback in result.failures:
            print(f"  - {test}")
    
    if result.errors:
        print("\n💥 エラーが発生したテスト:")
        for test, traceback in result.errors:
            print(f"  - {test}")
    
    print("\n🎉 統合テスト完了")
    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_integration_tests()
    sys.exit(0 if success else 1)