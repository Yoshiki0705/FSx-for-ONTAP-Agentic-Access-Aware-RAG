"""
Document Processor Lambda Function Entry Point
Markitdown統合対応ドキュメント処理Lambda関数のエントリーポイント
"""

from document_processor import lambda_handler

# Lambda関数のエントリーポイント
# AWS Lambdaはこの関数を呼び出します
handler = lambda_handler

# 直接実行時のテスト用
if __name__ == "__main__":
    # テスト用のイベント
    test_event = {
        "fileName": "test-document.docx",
        "fileContent": b"Test file content",
        "processingStrategy": "markitdown-first"
    }
    
    test_context = {
        "function_name": "document-processor-test",
        "function_version": "1",
        "invoked_function_arn": "arn:aws:lambda:us-east-1:123456789012:function:document-processor-test",
        "memory_limit_in_mb": "1024",
        "remaining_time_in_millis": lambda: 30000
    }
    
    # テスト実行
    result = lambda_handler(test_event, test_context)
    print("Test Result:", result)