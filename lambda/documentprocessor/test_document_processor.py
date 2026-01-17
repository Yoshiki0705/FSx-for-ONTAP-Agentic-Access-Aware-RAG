"""
Document Processor Lambda関数のテストスクリプト
Markitdown統合機能のテスト
"""

import json
import os
import sys
from datetime import datetime

# テスト用の環境変数設定
os.environ['MARKITDOWN_ENABLED'] = 'true'
os.environ['MARKITDOWN_ENVIRONMENT'] = 'dev'
os.environ['MARKITDOWN_TRACKING_TABLE'] = 'EmbeddingProcessingTracking'
os.environ['MARKITDOWN_LOG_LEVEL'] = 'debug'

# Lambda関数をインポート
from document_processor import lambda_handler

def test_office_document():
    """Office文書のテスト"""
    print("🧪 Office文書処理テスト開始...")
    
    test_event = {
        "fileName": "test-document.docx",
        "fileContent": b"Mock Word document content for testing",
        "processingStrategy": "markitdown-first"
    }
    
    test_context = {
        "function_name": "document-processor-test",
        "remaining_time_in_millis": lambda: 30000
    }
    
    result = lambda_handler(test_event, test_context)
    
    print(f"ステータス: {result['statusCode']}")
    body = json.loads(result['body'])
    
    if body['success']:
        print("✅ Office文書処理成功")
        print(f"   最終処理方法: {body['finalMethod']}")
        print(f"   処理時間: {body['metadata']['totalProcessingTime']:.2f}ms")
        print(f"   マークダウン長: {len(body['markdownContent'])}文字")
    else:
        print("❌ Office文書処理失敗")
        print(f"   エラー: {body['error']['message']}")
    
    print()

def test_pdf_document():
    """PDF文書のテスト"""
    print("🧪 PDF文書処理テスト開始...")
    
    test_event = {
        "fileName": "test-document.pdf",
        "fileContent": b"%PDF-1.4 Mock PDF content for testing",
        "processingStrategy": "both-compare"
    }
    
    test_context = {
        "function_name": "document-processor-test",
        "remaining_time_in_millis": lambda: 30000
    }
    
    result = lambda_handler(test_event, test_context)
    
    print(f"ステータス: {result['statusCode']}")
    body = json.loads(result['body'])
    
    if body['success']:
        print("✅ PDF文書処理成功")
        print(f"   最終処理方法: {body['finalMethod']}")
        print(f"   処理時間: {body['metadata']['totalProcessingTime']:.2f}ms")
        print(f"   試行回数: {len(body['metadata']['attemptedMethods'])}")
        
        # 品質比較結果の表示
        for method_data in body['metadata']['attemptedMethods']:
            method = method_data.get('method', 'unknown')
            score = method_data.get('qualityScore', 0)
            print(f"   {method}: 品質スコア {score}")
    else:
        print("❌ PDF文書処理失敗")
        print(f"   エラー: {body['error']['message']}")
    
    print()

def test_image_file():
    """画像ファイルのテスト"""
    print("🧪 画像ファイル処理テスト開始...")
    
    # PNG署名を含むモックデータ
    png_signature = b'\x89PNG\r\n\x1a\n'
    test_event = {
        "fileName": "test-image.png",
        "fileContent": png_signature + b"Mock PNG image content for testing",
        "processingStrategy": "markitdown-only"
    }
    
    test_context = {
        "function_name": "document-processor-test",
        "remaining_time_in_millis": lambda: 30000
    }
    
    result = lambda_handler(test_event, test_context)
    
    print(f"ステータス: {result['statusCode']}")
    body = json.loads(result['body'])
    
    if body['success']:
        print("✅ 画像ファイル処理成功")
        print(f"   最終処理方法: {body['finalMethod']}")
        print(f"   処理時間: {body['metadata']['totalProcessingTime']:.2f}ms")
        
        # OCR使用確認
        for method_data in body['metadata']['attemptedMethods']:
            if method_data.get('ocrUsed'):
                print(f"   OCR使用: ✅ (精度: {method_data.get('ocrAccuracy', 'N/A')}%)")
    else:
        print("❌ 画像ファイル処理失敗")
        print(f"   エラー: {body['error']['message']}")
    
    print()

def test_data_file():
    """データファイルのテスト"""
    print("🧪 データファイル処理テスト開始...")
    
    csv_content = """名前,年齢,職業
田中太郎,30,エンジニア
佐藤花子,25,デザイナー
鈴木次郎,35,マネージャー"""
    
    test_event = {
        "fileName": "test-data.csv",
        "fileContent": csv_content.encode('utf-8'),
        "processingStrategy": "langchain-only"
    }
    
    test_context = {
        "function_name": "document-processor-test",
        "remaining_time_in_millis": lambda: 30000
    }
    
    result = lambda_handler(test_event, test_context)
    
    print(f"ステータス: {result['statusCode']}")
    body = json.loads(result['body'])
    
    if body['success']:
        print("✅ データファイル処理成功")
        print(f"   最終処理方法: {body['finalMethod']}")
        print(f"   処理時間: {body['metadata']['totalProcessingTime']:.2f}ms")
    else:
        print("❌ データファイル処理失敗")
        print(f"   エラー: {body['error']['message']}")
    
    print()

def test_error_handling():
    """エラーハンドリングのテスト"""
    print("🧪 エラーハンドリングテスト開始...")
    
    # サポートされていないファイル形式
    test_event = {
        "fileName": "test-document.xyz",
        "fileContent": b"Unsupported file format content",
        "processingStrategy": "auto"
    }
    
    test_context = {
        "function_name": "document-processor-test",
        "remaining_time_in_millis": lambda: 30000
    }
    
    result = lambda_handler(test_event, test_context)
    
    print(f"ステータス: {result['statusCode']}")
    body = json.loads(result['body'])
    
    if not body['success']:
        print("✅ エラーハンドリング成功（期待通りの失敗）")
        print(f"   エラータイプ: {body['error']['type']}")
        print(f"   エラーメッセージ: {body['error']['message']}")
    else:
        print("❌ エラーハンドリング失敗（成功すべきでない）")
    
    print()

def test_fallback_mechanism():
    """フォールバック機構のテスト"""
    print("🧪 フォールバック機構テスト開始...")
    
    test_event = {
        "fileName": "test-document.html",
        "fileContent": b"<html><body><h1>Test HTML</h1><p>Content</p></body></html>",
        "processingStrategy": "markitdown-first"
    }
    
    test_context = {
        "function_name": "document-processor-test",
        "remaining_time_in_millis": lambda: 30000
    }
    
    result = lambda_handler(test_event, test_context)
    
    print(f"ステータス: {result['statusCode']}")
    body = json.loads(result['body'])
    
    if body['success']:
        print("✅ フォールバック機構テスト成功")
        print(f"   最終処理方法: {body['finalMethod']}")
        print(f"   試行回数: {len(body['metadata']['attemptedMethods'])}")
        
        # フォールバック使用確認
        if body['metadata'].get('fallbackUsed'):
            print("   フォールバック使用: ✅")
        else:
            print("   フォールバック使用: ❌（主要処理が成功）")
    else:
        print("❌ フォールバック機構テスト失敗")
        print(f"   エラー: {body['error']['message']}")
    
    print()

def run_all_tests():
    """全テストの実行"""
    print("🚀 Document Processor Lambda関数テスト開始")
    print(f"実行日時: {datetime.now().isoformat()}")
    print("=" * 60)
    
    # 各テストを実行
    test_office_document()
    test_pdf_document()
    test_image_file()
    test_data_file()
    test_error_handling()
    test_fallback_mechanism()
    
    print("=" * 60)
    print("🎉 Document Processor Lambda関数テスト完了")

if __name__ == "__main__":
    run_all_tests()