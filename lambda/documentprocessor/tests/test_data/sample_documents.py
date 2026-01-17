#!/usr/bin/env python3
"""
テスト用サンプルドキュメント生成
様々なファイル形式のテストデータを生成
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from pathlib import Path
import hashlib

# ログ設定
logger = logging.getLogger(__name__)

@dataclass
class DocumentMetadata:
    """ドキュメントメタデータ"""
    file_name: str
    file_size: int
    content_hash: str
    file_type: str
    encoding: str = 'utf-8'

class SampleDocumentGenerator:
    """サンプルドキュメント生成クラス"""
    
    # ファイルサイズ制限（バイト）
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    MIN_FILE_SIZE = 1  # 1バイト
    
    @staticmethod
    def generate_pdf_content() -> bytes:
        """PDFサンプルコンテンツ生成"""
        # 最小限のPDFファイル構造
        pdf_content = b"""%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Markitdown Test Document) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000274 00000 n 
0000000369 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
447
%%EOF"""
        return pdf_content
    
    @staticmethod
    def generate_text_content() -> bytes:
        """テキストサンプルコンテンツ生成"""
        text_content = """# Markitdown統合テストドキュメント

## 概要
このドキュメントはMarkitdown統合機能のテスト用に作成されたサンプルファイルです。

## セクション1: 基本テキスト
これは基本的なテキストコンテンツです。
複数行にわたって記述されています。

## セクション2: リスト
- 項目1
- 項目2
- 項目3

### サブセクション2.1: 番号付きリスト
1. 最初の項目
2. 二番目の項目
3. 三番目の項目

## セクション3: コードブロック
```python
def hello_world():
    print("Hello, Markitdown!")
    return True
```

## セクション4: テーブル
| 列1 | 列2 | 列3 |
|-----|-----|-----|
| A   | B   | C   |
| 1   | 2   | 3   |

## まとめ
このドキュメントはMarkitdown統合テストの一部として使用されます。
"""
        return text_content.encode('utf-8')
    
    @staticmethod
    def generate_large_content(target_size_mb: float = 1.0) -> bytes:
        """大きなファイル用コンテンツ生成（サイズ指定可能）"""
        base_content = """# 大容量テストドキュメント

## セクション {section_num}
これは大容量ファイルテスト用のセクション{section_num}です。
このセクションには十分な量のテキストコンテンツが含まれています。

### サブセクション {section_num}.1
詳細な説明がここに記載されています。
複数の段落にわたって情報が記述されています。

### サブセクション {section_num}.2
追加の情報とデータがここに含まれています。
テスト用の長いテキストコンテンツです。

"""
        
        target_size_bytes = int(target_size_mb * 1024 * 1024)
        base_size = len(base_content.format(section_num=1).encode('utf-8'))
        sections_needed = max(1, target_size_bytes // base_size)
        
        # メモリ効率を考慮してリスト結合を使用
        content_parts = []
        for i in range(1, min(sections_needed + 1, 1000)):  # 最大1000セクション
            content_parts.append(base_content.format(section_num=i))
        
        full_content = ''.join(content_parts)
        result = full_content.encode('utf-8')
        
        # サイズ制限チェック
        if len(result) > SampleDocumentGenerator.MAX_FILE_SIZE:
            logger.warning(f"生成されたファイルが制限サイズを超過: {len(result)} bytes")
            # 制限サイズに切り詰め
            result = result[:SampleDocumentGenerator.MAX_FILE_SIZE]
        
        return result
    
    @staticmethod
    def generate_test_files() -> Dict[str, DocumentMetadata]:
        """全テストファイルを生成（メタデータ付き）"""
        files_data = {
            'test_simple.pdf': SampleDocumentGenerator.generate_pdf_content(),
            'test_simple.txt': SampleDocumentGenerator.generate_text_content(),
            'test_large.txt': SampleDocumentGenerator.generate_large_content(),
            'test_empty.txt': b'',
            'test_japanese.txt': """# 日本語テストドキュメント

## 概要
これは日本語コンテンツのテストファイルです。

## 内容
- 日本語の文字列処理テスト
- UTF-8エンコーディングの確認
- マルチバイト文字の処理確認

## 結論
日本語コンテンツが正しく処理されることを確認します。
""".encode('utf-8')
        }
        
        # メタデータ付きで返却
        result = {}
        for file_name, content in files_data.items():
            # ファイルサイズ検証
            if len(content) > SampleDocumentGenerator.MAX_FILE_SIZE:
                logger.warning(f"ファイルサイズが制限を超過: {file_name} ({len(content)} bytes)")
                continue
            
            # ハッシュ計算
            content_hash = hashlib.sha256(content).hexdigest()
            
            # ファイルタイプ判定
            file_type = SampleDocumentGenerator._detect_file_type(file_name, content)
            
            result[file_name] = DocumentMetadata(
                file_name=file_name,
                file_size=len(content),
                content_hash=content_hash,
                file_type=file_type,
                encoding='utf-8' if file_name.endswith('.txt') else 'binary'
            )
        
        return result
    
    @staticmethod
    def _detect_file_type(file_name: str, content: bytes) -> str:
        """ファイルタイプを検出"""
        if file_name.endswith('.pdf'):
            return 'application/pdf'
        elif file_name.endswith('.txt'):
            return 'text/plain'
        else:
            return 'application/octet-stream'

@dataclass
class TestScenario:
    """テストシナリオデータクラス"""
    name: str
    file_name: str
    expected_success: bool
    expected_method: Optional[str] = None
    expected_error: Optional[str] = None
    timeout: int = 30
    max_processing_time: Optional[int] = None
    max_memory_usage: Optional[int] = None

class TestScenarios:
    """テストシナリオ定義クラス"""
    
    @staticmethod
    def get_basic_scenarios() -> List[TestScenario]:
        """基本テストシナリオ"""
        return [
            TestScenario(
                name='PDF基本処理テスト',
                file_name='test_simple.pdf',
                expected_success=True,
                expected_method='markitdown',
                timeout=30
            ),
            TestScenario(
                name='テキスト基本処理テスト',
                file_name='test_simple.txt',
                expected_success=True,
                expected_method='langchain',
                timeout=15
            ),
            TestScenario(
                name='日本語処理テスト',
                file_name='test_japanese.txt',
                expected_success=True,
                expected_method='langchain',
                timeout=20
            )
        ]
    
    @staticmethod
    def get_error_scenarios() -> List[TestScenario]:
        """エラーハンドリングテストシナリオ"""
        return [
            TestScenario(
                name='空ファイル処理テスト',
                file_name='test_empty.txt',
                expected_success=False,
                expected_error='EMPTY_FILE'
            ),
            TestScenario(
                name='存在しないファイルテスト',
                file_name='nonexistent.pdf',
                expected_success=False,
                expected_error='FILE_NOT_FOUND'
            )
        ]
    
    @staticmethod
    def get_performance_scenarios() -> List[TestScenario]:
        """パフォーマンステストシナリオ"""
        return [
            TestScenario(
                name='大容量ファイル処理テスト',
                file_name='test_large.txt',
                expected_success=True,
                max_processing_time=60000,  # 60秒
                max_memory_usage=512  # 512MB
            )
        ]

def save_test_files(output_dir: str = 'test_files') -> Dict[str, DocumentMetadata]:
    """テストファイルをディスクに保存"""
    try:
        # 出力ディレクトリの作成（セキュアな権限設定）
        output_path = Path(output_dir)
        output_path.mkdir(mode=0o755, parents=True, exist_ok=True)
        
        test_files_metadata = SampleDocumentGenerator.generate_test_files()
        saved_files = {}
        
        for file_name, metadata in test_files_metadata.items():
            try:
                # パストラバーサル攻撃防止
                safe_file_name = os.path.basename(file_name)
                file_path = output_path / safe_file_name
                
                # ファイル生成（実際のコンテンツを再生成）
                if file_name == 'test_simple.pdf':
                    content = SampleDocumentGenerator.generate_pdf_content()
                elif file_name == 'test_simple.txt':
                    content = SampleDocumentGenerator.generate_text_content()
                elif file_name == 'test_large.txt':
                    content = SampleDocumentGenerator.generate_large_content()
                elif file_name == 'test_empty.txt':
                    content = b''
                elif file_name == 'test_japanese.txt':
                    content = """# 日本語テストドキュメント

## 概要
これは日本語コンテンツのテストファイルです。

## 内容
- 日本語の文字列処理テスト
- UTF-8エンコーディングの確認
- マルチバイト文字の処理確認

## 結論
日本語コンテンツが正しく処理されることを確認します。
""".encode('utf-8')
                else:
                    logger.warning(f"未知のファイル形式: {file_name}")
                    continue
                
                # ファイル書き込み（セキュアな権限設定）
                with open(file_path, 'wb') as f:
                    f.write(content)
                
                # ファイル権限設定
                file_path.chmod(0o644)
                
                # 実際のファイルサイズでメタデータ更新
                actual_size = file_path.stat().st_size
                metadata.file_size = actual_size
                
                saved_files[str(file_path)] = metadata
                logger.info(f"テストファイル作成: {file_path} ({actual_size} bytes)")
                
            except Exception as e:
                logger.error(f"ファイル作成エラー {file_name}: {e}")
                continue
        
        return saved_files
        
    except Exception as e:
        logger.error(f"テストファイル保存エラー: {e}")
        raise

def generate_test_report(saved_files: Dict[str, DocumentMetadata]) -> None:
    """テスト生成レポートを出力"""
    print("\n" + "="*60)
    print("📊 テストファイル生成レポート")
    print("="*60)
    
    print(f"\n生成されたファイル数: {len(saved_files)}")
    total_size = sum(metadata.file_size for metadata in saved_files.values())
    print(f"総ファイルサイズ: {total_size:,} bytes ({total_size/1024/1024:.2f} MB)")
    
    print("\n📁 ファイル詳細:")
    for file_path, metadata in saved_files.items():
        print(f"  - {metadata.file_name}")
        print(f"    パス: {file_path}")
        print(f"    サイズ: {metadata.file_size:,} bytes")
        print(f"    タイプ: {metadata.file_type}")
        print(f"    ハッシュ: {metadata.content_hash[:16]}...")
        print()

def main():
    """メイン実行関数"""
    try:
        # ログ設定
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        logger.info("🚀 テストファイル生成開始")
        
        # テストファイル生成
        saved_files = save_test_files()
        
        # レポート生成
        generate_test_report(saved_files)
        
        # シナリオ情報出力
        print("\n🧪 基本テストシナリオ:")
        for scenario in TestScenarios.get_basic_scenarios():
            print(f"  - {scenario.name} (期待結果: {scenario.expected_method})")
        
        print("\n❌ エラーテストシナリオ:")
        for scenario in TestScenarios.get_error_scenarios():
            print(f"  - {scenario.name} (期待エラー: {scenario.expected_error})")
        
        print("\n⚡ パフォーマンステストシナリオ:")
        for scenario in TestScenarios.get_performance_scenarios():
            print(f"  - {scenario.name} (制限時間: {scenario.max_processing_time}ms)")
        
        logger.info("✅ テストファイル生成完了")
        
    except Exception as e:
        logger.error(f"❌ テストファイル生成エラー: {e}")
        raise

if __name__ == '__main__':
    main()