"""
Markitdown統合機能の包括的テストスイート
Task 1-5で実装された全機能のテスト
"""

import json
import os
import sys
import unittest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
import tempfile
import shutil

# テスト用の環境変数設定
os.environ['MARKITDOWN_ENABLED'] = 'true'
os.environ['MARKITDOWN_ENVIRONMENT'] = 'test'
os.environ['LOG_LEVEL'] = 'DEBUG'
os.environ['AWS_REGION'] = 'us-east-1'

# テスト対象モジュールのインポート
from config_loader import load_markitdown_config, get_processing_order
from format_processors import get_format_processor
from langchain_integration import LangChainIntegration
from vector_embedding_bedrock_kb import BedrockKBVectorProcessor
from metadata_manager import MetadataManager
from cloudwatch_metrics import CloudWatchMetricsCollector
from structured_logging import MarkitdownLogger
from document_processor import DocumentProcessor

class TestMarkitdownConfig(unittest.TestCase):
    """Markitdown設定のテスト"""
    
    def setUp(self):
        """テストセットアップ"""
        self.test_config_dir = tempfile.mkdtemp()
        self.test_config_file = os.path.join(self.test_config_dir, 'markitdown-config.json')
        
        # テスト用設定ファイル作成
        test_config = {
            "enabled": True,
            "supportedFormats": {
                "pdf": {
                    "enabled": True,
                    "processingStrategy": "markitdown-first",
                    "timeout": 60,
                    "ocrEnabled": True
                },
                "docx": {
                    "enabled": True,
                    "processingStrategy": "both-compare",
                    "timeout": 30,
                    "ocrEnabled": False
                }
            },
            "fallback": {
                "enabled": True,
                "useLangChainOnFailure": True,
                "maxRetries": 2
            }
        }
        
        with open(self.test_config_file, 'w') as f:
            json.dump(test_config, f)
    
    def tearDown(self):
        """テストクリーンアップ"""
        shutil.rmtree(self.test_config_dir)
    
    def test_config_loading(self):
        """設定読み込みテスト"""
        with patch('config_loader.CONFIG_FILE_PATH', self.test_config_file):
            config = load_markitdown_config('test')
            
            self.assertTrue(config['enabled'])
            self.assertIn('pdf', config['supportedFormats'])
            self.assertEqual(config['supportedFormats']['pdf']['processingStrategy'], 'markitdown-first')
    
    def test_processing_order(self):
        """処理順序決定テスト"""
        with patch('config_loader.CONFIG_FILE_PATH', self.test_config_file):
            config = load_markitdown_config('test')
            
            # markitdown-first戦略
            order = get_processing_order(config, 'pdf')
            self.assertEqual(order, ['markitdown', 'langchain'])
            
            # both-compare戦略
            order = get_processing_order(config, 'docx')
            self.assertEqual(order, ['markitdown', 'langchain'])


class TestFormatProcessors(unittest.TestCase):
    """ファイル形式別処理のテスト"""
    
    def setUp(self):
        """テストセットアップ"""
        self.config = {
            "supportedFormats": {
                "pdf": {"enabled": True, "ocrEnabled": True},
                "docx": {"enabled": True, "ocrEnabled": False}
            }
        }
    
    def test_pdf_processor(self):
        """PDF処理テスト"""
        processor = get_format_processor('pdf', self.config)
        self.assertIsNotNone(processor)
        
        # モックPDFコンテンツでテスト
        pdf_content = b'%PDF-1.4 Mock PDF content'
        success, content, metadata = processor.process_with_markitdown(pdf_content, 'test.pdf')
        
        # 基本的な結果検証
        self.assertIsInstance(success, bool)
        self.assertIsInstance(content, str)
        self.assertIsInstance(metadata, dict)
        self.assertIn('method', metadata)
    
    def test_docx_processor(self):
        """DOCX処理テスト"""
        processor = get_format_processor('docx', self.config)
        self.assertIsNotNone(processor)
        
        # モックDOCXコンテンツでテスト
        docx_content = b'PK\x03\x04Mock DOCX content'
        success, content, metadata = processor.process_with_markitdown(docx_content, 'test.docx')
        
        # 基本的な結果検証
        self.assertIsInstance(success, bool)
        self.assertIsInstance(content, str)
        self.assertIsInstance(metadata, dict)
    
    def test_unsupported_format(self):
        """サポートされていない形式のテスト"""
        processor = get_format_processor('xyz', self.config)
        self.assertIsNone(processor)


class TestLangChainIntegration(unittest.TestCase):
    """LangChain統合のテスト"""
    
    def setUp(self):
        """テストセットアップ"""
        self.integration = LangChainIntegration()
    
    def test_markdown_processing(self):
        """マークダウン処理テスト"""
        markdown_content = """
# テストドキュメント

これはテスト用のマークダウンドキュメントです。

## セクション1

セクション1の内容です。

### サブセクション1.1

- リスト項目1
- リスト項目2

## セクション2

```python
def hello():
    print("Hello, World!")
```
"""
        
        result = self.integration.process_markdown_content(
            markdown_content=markdown_content,
            source_file='test.md',
            processing_method='markitdown'
        )
        
        self.assertTrue(result.success)
        self.assertGreater(len(result.chunks), 0)
        self.assertEqual(len(result.chunks), len(result.embeddings))
        
        # チャンクタイプの検証
        chunk_types = [chunk['metadata']['chunk_type'] for chunk in result.chunks]
        self.assertIn('header', chunk_types)
        self.assertIn('paragraph', chunk_types)
    
    def test_chunk_splitting(self):
        """チャンク分割テスト"""
        long_content = "これは長いテキストです。" * 100
        
        result = self.integration.process_markdown_content(
            markdown_content=long_content,
            source_file='long_test.md',
            processing_method='markitdown'
        )
        
        self.assertTrue(result.success)
        # 長いコンテンツは複数のチャンクに分割される
        self.assertGreater(len(result.chunks), 1)


class TestVectorEmbedding(unittest.TestCase):
    """ベクトル埋め込みのテスト"""
    
    def setUp(self):
        """テストセットアップ"""
        self.processor = BedrockKBVectorProcessor()
    
    @patch('vector_embedding_bedrock_kb.boto3.client')
    def test_embedding_generation(self, mock_boto3):
        """埋め込み生成テスト"""
        # Bedrockクライアントのモック
        mock_bedrock = Mock()
        mock_boto3.return_value = mock_bedrock
        
        # モックレスポンス
        mock_response = {
            'body': Mock()
        }
        mock_response['body'].read.return_value = json.dumps({
            'embedding': [0.1] * 1536
        }).encode()
        mock_bedrock.invoke_model.return_value = mock_response
        
        texts = ["テストテキスト1", "テストテキスト2"]
        result = self.processor.generate_embeddings(texts)
        
        self.assertTrue(result.success)
        self.assertEqual(len(result.embeddings), 2)
        self.assertEqual(len(result.embeddings[0]), 1536)
    
    def test_bedrock_kb_document_creation(self):
        """Bedrock KB互換ドキュメント作成テスト"""
        chunks = [
            {
                'content': 'テストチャンク1',
                'metadata': {'chunk_type': 'paragraph', 'chunk_index': 0}
            },
            {
                'content': 'テストチャンク2',
                'metadata': {'chunk_type': 'header', 'chunk_index': 1}
            }
        ]
        
        embeddings = [[0.1] * 1536, [0.2] * 1536]
        
        documents = self.processor.create_bedrock_kb_documents(
            chunks=chunks,
            embeddings=embeddings,
            source_file='test.pdf',
            source_uri='\\\\file\\test.pdf',
            author='test@example.com',
            file_size=1024000
        )
        
        self.assertEqual(len(documents), 2)
        
        # Bedrock KB標準フィールドの検証
        doc = documents[0]
        self.assertEqual(doc.metadata['x-amz-bedrock-kb-category'], 'File')
        self.assertIn('AMAZON_BEDROCK_METADATA', doc.metadata)
        self.assertEqual(doc.metadata['x-amz-bedrock-kb-source-uri'], '\\\\file\\test.pdf')
        self.assertEqual(doc.metadata['AMAZON_BEDROCK_TEXT_CHUNK'], 'テストチャンク1')
        self.assertEqual(doc.metadata['x-amz-bedrock-kb-author'], 'test@example.com')


class TestMetadataManager(unittest.TestCase):
    """メタデータ管理のテスト"""
    
    def setUp(self):
        """テストセットアップ"""
        # DynamoDBのモック
        with patch('metadata_manager.boto3.resource'):
            self.manager = MetadataManager()
    
    def test_file_metadata_creation(self):
        """ファイルメタデータ作成テスト"""
        file_content = b'Test file content'
        
        metadata = self.manager.create_file_metadata(
            file_name='test.pdf',
            file_content=file_content,
            file_format='pdf',
            user_id='test_user',
            project_id='test_project'
        )
        
        self.assertIsNotNone(metadata.file_id)
        self.assertEqual(metadata.original_name, 'test.pdf')
        self.assertEqual(metadata.file_format, 'pdf')
        self.assertEqual(metadata.file_size, len(file_content))
        self.assertEqual(metadata.user_id, 'test_user')
    
    def test_processing_metadata_creation(self):
        """処理メタデータ作成テスト"""
        metadata = self.manager.create_processing_metadata(
            file_id='test_file_id',
            processing_strategy='markitdown-first'
        )
        
        self.assertIsNotNone(metadata.processing_id)
        self.assertEqual(metadata.file_id, 'test_file_id')
        self.assertEqual(metadata.processing_strategy, 'markitdown-first')
        self.assertFalse(metadata.success)  # 初期状態は失敗


class TestCloudWatchMetrics(unittest.TestCase):
    """CloudWatchメトリクスのテスト"""
    
    def setUp(self):
        """テストセットアップ"""
        with patch('cloudwatch_metrics.boto3.client'):
            self.collector = CloudWatchMetricsCollector()
    
    @patch('cloudwatch_metrics.boto3.client')
    def test_conversion_metrics(self, mock_boto3):
        """変換メトリクス送信テスト"""
        mock_cloudwatch = Mock()
        mock_boto3.return_value = mock_cloudwatch
        
        success = self.collector.put_conversion_metrics(
            file_format='pdf',
            processing_method='markitdown',
            success=True,
            processing_time_ms=1500.0,
            file_size_bytes=1024000,
            output_size_bytes=2048000,
            quality_score=85.5
        )
        
        self.assertTrue(success)
        # CloudWatch API呼び出しの検証
        mock_cloudwatch.put_metric_data.assert_called()
    
    @patch('cloudwatch_metrics.boto3.client')
    def test_embedding_metrics(self, mock_boto3):
        """埋め込みメトリクス送信テスト"""
        mock_cloudwatch = Mock()
        mock_boto3.return_value = mock_cloudwatch
        
        success = self.collector.put_embedding_metrics(
            embedding_model='amazon.titan-embed-text-v1',
            total_chunks=10,
            embedding_time_ms=3000.0,
            batch_size=5,
            success_count=10,
            error_count=0
        )
        
        self.assertTrue(success)
        mock_cloudwatch.put_metric_data.assert_called()


class TestStructuredLogging(unittest.TestCase):
    """構造化ログのテスト"""
    
    def setUp(self):
        """テストセットアップ"""
        self.logger = MarkitdownLogger()
    
    def test_document_processing_logging(self):
        """ドキュメント処理ログテスト"""
        processing_id = self.logger.start_document_processing(
            file_name='test.pdf',
            file_size=1024000,
            file_format='pdf',
            processing_strategy='markitdown-first',
            user_id='test_user'
        )
        
        self.assertIsNotNone(processing_id)
        self.assertEqual(self.logger.current_processing_id, processing_id)
    
    def test_conversion_attempt_logging(self):
        """変換試行ログテスト"""
        # 処理開始
        self.logger.start_document_processing(
            file_name='test.pdf',
            file_size=1024000,
            file_format='pdf',
            processing_strategy='markitdown-first'
        )
        
        # 変換試行ログ（例外が発生しないことを確認）
        try:
            self.logger.log_conversion_attempt(
                method='markitdown',
                duration_ms=1500.0,
                success=True,
                file_format='pdf',
                output_size=2048000,
                quality_score=85.5
            )
        except Exception as e:
            self.fail(f"変換試行ログでエラーが発生: {e}")


class TestDocumentProcessorIntegration(unittest.TestCase):
    """Document Processor統合テスト"""
    
    def setUp(self):
        """テストセットアップ"""
        # 各種サービスのモック
        with patch('document_processor.boto3.resource'), \
             patch('document_processor.boto3.client'):
            self.processor = DocumentProcessor()
    
    def test_document_processing_flow(self):
        """ドキュメント処理フロー統合テスト"""
        # テストファイルコンテンツ
        file_content = b'Test document content for integration testing'
        file_name = 'integration_test.txt'
        
        # 処理実行
        result = self.processor.process_document(
            file_content=file_content,
            file_name=file_name,
            processing_strategy='markitdown-first',
            user_id='test_user',
            project_id='test_project'
        )
        
        # 基本的な結果検証
        self.assertIsInstance(result, dict)
        self.assertIn('success', result)
        self.assertIn('fileName', result)
        self.assertIn('metadata', result)
        
        # メタデータの検証
        metadata = result['metadata']
        self.assertIn('startTime', metadata)
        self.assertIn('totalProcessingTime', metadata)


class TestErrorHandling(unittest.TestCase):
    """エラーハンドリングのテスト"""
    
    def setUp(self):
        """テストセットアップ"""
        with patch('document_processor.boto3.resource'), \
             patch('document_processor.boto3.client'):
            self.processor = DocumentProcessor()
    
    def test_unsupported_file_format(self):
        """サポートされていないファイル形式のテスト"""
        file_content = b'Unsupported file content'
        file_name = 'test.xyz'  # サポートされていない拡張子
        
        result = self.processor.process_document(
            file_content=file_content,
            file_name=file_name
        )
        
        # エラーが適切に処理されることを確認
        self.assertFalse(result['success'])
        self.assertIn('error', result)
    
    def test_empty_file_content(self):
        """空ファイルのテスト"""
        file_content = b''
        file_name = 'empty.pdf'
        
        result = self.processor.process_document(
            file_content=file_content,
            file_name=file_name
        )
        
        # 空ファイルの処理結果を確認
        self.assertIsInstance(result, dict)
        self.assertIn('success', result)


def run_unit_tests():
    """単体テストの実行"""
    print("🧪 Markitdown統合機能 単体テスト開始")
    print(f"実行日時: {datetime.now().isoformat()}")
    print("=" * 80)
    
    # テストスイートの作成
    test_suite = unittest.TestSuite()
    
    # 各テストクラスを追加
    test_classes = [
        TestMarkitdownConfig,
        TestFormatProcessors,
        TestLangChainIntegration,
        TestVectorEmbedding,
        TestMetadataManager,
        TestCloudWatchMetrics,
        TestStructuredLogging,
        TestDocumentProcessorIntegration,
        TestErrorHandling
    ]
    
    for test_class in test_classes:
        tests = unittest.TestLoader().loadTestsFromTestCase(test_class)
        test_suite.addTests(tests)
    
    # テスト実行
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(test_suite)
    
    print("=" * 80)
    print(f"🎯 テスト結果: {result.testsRun}件実行")
    print(f"✅ 成功: {result.testsRun - len(result.failures) - len(result.errors)}件")
    print(f"❌ 失敗: {len(result.failures)}件")
    print(f"💥 エラー: {len(result.errors)}件")
    
    if result.failures:
        print("\n❌ 失敗したテスト:")
        for test, traceback in result.failures:
            print(f"  - {test}: {traceback}")
    
    if result.errors:
        print("\n💥 エラーが発生したテスト:")
        for test, traceback in result.errors:
            print(f"  - {test}: {traceback}")
    
    print("\n🎉 単体テスト完了")
    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_unit_tests()
    sys.exit(0 if success else 1)