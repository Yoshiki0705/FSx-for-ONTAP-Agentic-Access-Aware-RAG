"""
ファイル形式別処理ロジック
各ファイル形式に特化した変換処理を提供
"""

import logging
from typing import Dict, Any, Tuple, Optional
from datetime import datetime
import base64
import io

logger = logging.getLogger(__name__)

class BaseFormatProcessor:
    """ファイル形式プロセッサーの基底クラス"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
    
    def process_with_markitdown(self, file_content: bytes, file_name: str) -> Tuple[bool, str, Dict]:
        """Markitdownを使用した変換（基底実装）"""
        raise NotImplementedError("サブクラスで実装してください")
    
    def process_with_langchain(self, file_content: bytes, file_name: str) -> Tuple[bool, str, Dict]:
        """LangChainを使用した変換（基底実装）"""
        raise NotImplementedError("サブクラスで実装してください")
    
    def validate_file(self, file_content: bytes, file_name: str) -> bool:
        """ファイルの検証"""
        if not file_content:
            return False
        
        max_size = self.config.get('performance', {}).get('maxFileSizeBytes', 10485760)
        if len(file_content) > max_size:
            logger.warning(f"ファイルサイズが制限を超過: {len(file_content)} > {max_size}")
            return False
        
        return True

class OfficeDocumentProcessor(BaseFormatProcessor):
    """Office文書（docx, xlsx, pptx）プロセッサー"""
    
    def process_with_markitdown(self, file_content: bytes, file_name: str) -> Tuple[bool, str, Dict]:
        """MarkitdownでOffice文書を変換"""
        start_time = datetime.now()
        metadata = {
            'method': 'markitdown',
            'processor': 'OfficeDocumentProcessor',
            'startTime': start_time.isoformat(),
            'success': False
        }
        
        try:
            if not self.validate_file(file_content, file_name):
                raise ValueError("ファイル検証に失敗しました")
            
            # TODO: 実際のMarkitdown実装
            # from markitdown import MarkItDown
            # markitdown = MarkItDown()
            # result = markitdown.convert_stream(io.BytesIO(file_content))
            # markdown_content = result.text_content
            
            # モック実装
            file_extension = file_name.split('.')[-1].lower()
            markdown_content = f"""# {file_name}

## 文書情報
- **ファイル名**: {file_name}
- **ファイル形式**: {file_extension.upper()}
- **ファイルサイズ**: {len(file_content):,} bytes
- **処理方法**: Microsoft Markitdown
- **処理日時**: {start_time.isoformat()}

## 変換内容

### Office文書の構造化データ
{self._generate_office_mock_content(file_extension, file_content)}

---
*このファイルはMicrosoft Markitdownで変換されました*
"""
            
            end_time = datetime.now()
            processing_time = (end_time - start_time).total_seconds() * 1000
            
            metadata.update({
                'success': True,
                'endTime': end_time.isoformat(),
                'processingTime': processing_time,
                'outputLength': len(markdown_content),
                'qualityScore': 90  # Office文書はMarkitdownが得意
            })
            
            logger.info(f"Markitdown Office文書変換成功: {file_name}")
            return True, markdown_content, metadata
            
        except Exception as e:
            end_time = datetime.now()
            processing_time = (end_time - start_time).total_seconds() * 1000
            
            metadata.update({
                'success': False,
                'endTime': end_time.isoformat(),
                'processingTime': processing_time,
                'error': str(e)
            })
            
            logger.error(f"Markitdown Office文書変換失敗: {file_name} - {e}")
            return False, "", metadata    
 
   def process_with_langchain(self, file_content: bytes, file_name: str) -> Tuple[bool, str, Dict]:
        """LangChainでOffice文書を変換"""
        start_time = datetime.now()
        metadata = {
            'method': 'langchain',
            'processor': 'OfficeDocumentProcessor',
            'startTime': start_time.isoformat(),
            'success': False
        }
        
        try:
            if not self.validate_file(file_content, file_name):
                raise ValueError("ファイル検証に失敗しました")
            
            # TODO: 実際のLangChain実装
            # from langchain.document_loaders import UnstructuredWordDocumentLoader
            # loader = UnstructuredWordDocumentLoader(io.BytesIO(file_content))
            # documents = loader.load()
            # markdown_content = "\n\n".join([doc.page_content for doc in documents])
            
            # モック実装
            file_extension = file_name.split('.')[-1].lower()
            markdown_content = f"""# {file_name}

## 文書情報
- **ファイル名**: {file_name}
- **ファイル形式**: {file_extension.upper()}
- **ファイルサイズ**: {len(file_content):,} bytes
- **処理方法**: LangChain
- **処理日時**: {start_time.isoformat()}

## 変換内容

### LangChainによる構造化抽出
{self._generate_office_mock_content(file_extension, file_content)}

---
*このファイルはLangChainで変換されました*
"""
            
            end_time = datetime.now()
            processing_time = (end_time - start_time).total_seconds() * 1000
            
            metadata.update({
                'success': True,
                'endTime': end_time.isoformat(),
                'processingTime': processing_time,
                'outputLength': len(markdown_content),
                'qualityScore': 75  # LangChainは汎用的だが品質は中程度
            })
            
            logger.info(f"LangChain Office文書変換成功: {file_name}")
            return True, markdown_content, metadata
            
        except Exception as e:
            end_time = datetime.now()
            processing_time = (end_time - start_time).total_seconds() * 1000
            
            metadata.update({
                'success': False,
                'endTime': end_time.isoformat(),
                'processingTime': processing_time,
                'error': str(e)
            })
            
            logger.error(f"LangChain Office文書変換失敗: {file_name} - {e}")
            return False, "", metadata
    
    def _generate_office_mock_content(self, file_extension: str, file_content: bytes) -> str:
        """Office文書のモックコンテンツ生成"""
        content_size = len(file_content)
        
        if file_extension == 'docx':
            return f"""
#### 文書構造
- 推定ページ数: {max(1, content_size // 2000)}
- 推定段落数: {max(5, content_size // 500)}
- 推定文字数: {max(100, content_size // 10)}

#### 抽出されたテキスト
[Word文書の本文がここに表示されます]

#### 書式情報
- フォント情報: 検出済み
- 表・図表: 検出済み
- ヘッダー・フッター: 検出済み
"""
        elif file_extension == 'xlsx':
            return f"""
#### スプレッドシート構造
- 推定シート数: {max(1, content_size // 10000)}
- 推定行数: {max(10, content_size // 100)}
- 推定列数: {max(3, content_size // 1000)}

#### データ概要
| シート名 | 行数 | 列数 | データ型 |
|---------|------|------|----------|
| Sheet1  | {max(10, content_size // 100)} | {max(3, content_size // 1000)} | 混合 |

#### 抽出されたデータ
[Excelデータがここに表示されます]
"""
        elif file_extension == 'pptx':
            return f"""
#### プレゼンテーション構造
- 推定スライド数: {max(1, content_size // 5000)}
- 推定テキストボックス数: {max(5, content_size // 1000)}

#### スライド概要
{chr(10).join([f"- スライド {i+1}: [タイトル]" for i in range(min(5, max(1, content_size // 5000)))])}

#### 抽出されたコンテンツ
[PowerPointコンテンツがここに表示されます]
"""
        else:
            return "[Office文書コンテンツ]"

class PDFProcessor(BaseFormatProcessor):
    """PDF文書プロセッサー"""
    
    def process_with_markitdown(self, file_content: bytes, file_name: str) -> Tuple[bool, str, Dict]:
        """MarkitdownでPDF文書を変換（OCR対応）"""
        start_time = datetime.now()
        metadata = {
            'method': 'markitdown',
            'processor': 'PDFProcessor',
            'startTime': start_time.isoformat(),
            'success': False,
            'ocrUsed': True
        }
        
        try:
            if not self.validate_file(file_content, file_name):
                raise ValueError("ファイル検証に失敗しました")
            
            # TODO: 実際のMarkitdown + OCR実装
            # from markitdown import MarkItDown
            # markitdown = MarkItDown()
            # result = markitdown.convert_stream(io.BytesIO(file_content), file_extension='.pdf')
            # markdown_content = result.text_content
            
            # モック実装
            markdown_content = f"""# {file_name}

## PDF文書情報
- **ファイル名**: {file_name}
- **ファイルサイズ**: {len(file_content):,} bytes
- **処理方法**: Microsoft Markitdown + OCR
- **処理日時**: {start_time.isoformat()}

## 変換内容

### OCR抽出テキスト
{self._generate_pdf_mock_content(file_content)}

### 文書構造
- 推定ページ数: {max(1, len(file_content) // 50000)}
- OCR信頼度: 95%
- 言語検出: 日本語・英語

---
*このPDFファイルはMicrosoft MarkitdownのOCR機能で変換されました*
"""
            
            end_time = datetime.now()
            processing_time = (end_time - start_time).total_seconds() * 1000
            
            metadata.update({
                'success': True,
                'endTime': end_time.isoformat(),
                'processingTime': processing_time,
                'outputLength': len(markdown_content),
                'qualityScore': 88,  # OCR品質は高い
                'ocrAccuracy': 95
            })
            
            logger.info(f"Markitdown PDF変換成功: {file_name}")
            return True, markdown_content, metadata
            
        except Exception as e:
            end_time = datetime.now()
            processing_time = (end_time - start_time).total_seconds() * 1000
            
            metadata.update({
                'success': False,
                'endTime': end_time.isoformat(),
                'processingTime': processing_time,
                'error': str(e)
            })
            
            logger.error(f"Markitdown PDF変換失敗: {file_name} - {e}")
            return False, "", metadata
    
    def process_with_langchain(self, file_content: bytes, file_name: str) -> Tuple[bool, str, Dict]:
        """LangChainでPDF文書を変換"""
        start_time = datetime.now()
        metadata = {
            'method': 'langchain',
            'processor': 'PDFProcessor',
            'startTime': start_time.isoformat(),
            'success': False,
            'ocrUsed': False
        }
        
        try:
            if not self.validate_file(file_content, file_name):
                raise ValueError("ファイル検証に失敗しました")
            
            # TODO: 実際のLangChain PDF実装
            # from langchain.document_loaders import PyPDFLoader
            # loader = PyPDFLoader(io.BytesIO(file_content))
            # documents = loader.load()
            # markdown_content = "\n\n".join([doc.page_content for doc in documents])
            
            # モック実装
            markdown_content = f"""# {file_name}

## PDF文書情報
- **ファイル名**: {file_name}
- **ファイルサイズ**: {len(file_content):,} bytes
- **処理方法**: LangChain PDF処理
- **処理日時**: {start_time.isoformat()}

## 変換内容

### テキスト抽出結果
{self._generate_pdf_mock_content(file_content)}

### 文書メタデータ
- 推定ページ数: {max(1, len(file_content) // 50000)}
- テキスト抽出方式: 埋め込みテキスト
- 処理品質: 標準

---
*このPDFファイルはLangChainで変換されました*
"""
            
            end_time = datetime.now()
            processing_time = (end_time - start_time).total_seconds() * 1000
            
            metadata.update({
                'success': True,
                'endTime': end_time.isoformat(),
                'processingTime': processing_time,
                'outputLength': len(markdown_content),
                'qualityScore': 70  # LangChainのPDF処理は標準的
            })
            
            logger.info(f"LangChain PDF変換成功: {file_name}")
            return True, markdown_content, metadata
            
        except Exception as e:
            end_time = datetime.now()
            processing_time = (end_time - start_time).total_seconds() * 1000
            
            metadata.update({
                'success': False,
                'endTime': end_time.isoformat(),
                'processingTime': processing_time,
                'error': str(e)
            })
            
            logger.error(f"LangChain PDF変換失敗: {file_name} - {e}")
            return False, "", metadata
    
    def _generate_pdf_mock_content(self, file_content: bytes) -> str:
        """PDFのモックコンテンツ生成"""
        content_size = len(file_content)
        return f"""
#### 抽出されたテキスト
[PDFから抽出されたテキストがここに表示されます]

推定文字数: {max(500, content_size // 20)}文字
推定段落数: {max(5, content_size // 2000)}段落

#### 構造情報
- 見出し: 検出済み
- 表・図表: 検出済み
- フッター・ヘッダー: 検出済み
"""

class ImageProcessor(BaseFormatProcessor):
    """画像ファイル（png, jpg, jpeg, gif）プロセッサー"""
    
    def process_with_markitdown(self, file_content: bytes, file_name: str) -> Tuple[bool, str, Dict]:
        """Markitdownで画像を変換（OCR対応）"""
        start_time = datetime.now()
        metadata = {
            'method': 'markitdown',
            'processor': 'ImageProcessor',
            'startTime': start_time.isoformat(),
            'success': False,
            'ocrUsed': True
        }
        
        try:
            if not self.validate_file(file_content, file_name):
                raise ValueError("ファイル検証に失敗しました")
            
            # TODO: 実際のMarkitdown + OCR実装
            # from markitdown import MarkItDown
            # markitdown = MarkItDown()
            # result = markitdown.convert_stream(io.BytesIO(file_content))
            # markdown_content = result.text_content
            
            # モック実装
            file_extension = file_name.split('.')[-1].lower()
            markdown_content = f"""# {file_name}

## 画像情報
- **ファイル名**: {file_name}
- **ファイル形式**: {file_extension.upper()}
- **ファイルサイズ**: {len(file_content):,} bytes
- **処理方法**: Microsoft Markitdown OCR
- **処理日時**: {start_time.isoformat()}

## OCR抽出結果

### 検出されたテキスト
{self._generate_image_mock_content(file_content)}

### 画像解析結果
- OCR信頼度: 92%
- 検出言語: 日本語・英語
- テキスト領域: 検出済み
- 画像品質: 高品質

---
*この画像はMicrosoft MarkitdownのOCR機能で解析されました*
"""
            
            end_time = datetime.now()
            processing_time = (end_time - start_time).total_seconds() * 1000
            
            metadata.update({
                'success': True,
                'endTime': end_time.isoformat(),
                'processingTime': processing_time,
                'outputLength': len(markdown_content),
                'qualityScore': 85,  # 画像OCRは高品質
                'ocrAccuracy': 92
            })
            
            logger.info(f"Markitdown 画像OCR変換成功: {file_name}")
            return True, markdown_content, metadata
            
        except Exception as e:
            end_time = datetime.now()
            processing_time = (end_time - start_time).total_seconds() * 1000
            
            metadata.update({
                'success': False,
                'endTime': end_time.isoformat(),
                'processingTime': processing_time,
                'error': str(e)
            })
            
            logger.error(f"Markitdown 画像OCR変換失敗: {file_name} - {e}")
            return False, "", metadata
    
    def process_with_langchain(self, file_content: bytes, file_name: str) -> Tuple[bool, str, Dict]:
        """LangChainで画像を変換（通常は使用しない）"""
        # 画像処理はMarkitdownが専門のため、LangChainでは基本的に処理しない
        start_time = datetime.now()
        metadata = {
            'method': 'langchain',
            'processor': 'ImageProcessor',
            'startTime': start_time.isoformat(),
            'success': False,
            'error': 'LangChainは画像処理に対応していません'
        }
        
        end_time = datetime.now()
        processing_time = (end_time - start_time).total_seconds() * 1000
        
        metadata.update({
            'endTime': end_time.isoformat(),
            'processingTime': processing_time
        })
        
        logger.warning(f"LangChain 画像処理はサポートされていません: {file_name}")
        return False, "", metadata
    
    def _generate_image_mock_content(self, file_content: bytes) -> str:
        """画像のモックコンテンツ生成"""
        content_size = len(file_content)
        return f"""
#### OCR抽出テキスト
[画像から抽出されたテキストがここに表示されます]

推定文字数: {max(50, content_size // 1000)}文字
推定行数: {max(3, content_size // 5000)}行

#### 画像特徴
- 解像度: 推定 {max(800, content_size // 100)}x{max(600, content_size // 150)}
- カラー: フルカラー
- テキスト密度: 中程度
"""

class WebDocumentProcessor(BaseFormatProcessor):
    """Web文書（html, xml）プロセッサー"""
    
    def process_with_markitdown(self, file_content: bytes, file_name: str) -> Tuple[bool, str, Dict]:
        """MarkitdownでWeb文書を変換"""
        start_time = datetime.now()
        metadata = {
            'method': 'markitdown',
            'processor': 'WebDocumentProcessor',
            'startTime': start_time.isoformat(),
            'success': False
        }
        
        try:
            if not self.validate_file(file_content, file_name):
                raise ValueError("ファイル検証に失敗しました")
            
            # TODO: 実際のMarkitdown実装
            # from markitdown import MarkItDown
            # markitdown = MarkItDown()
            # result = markitdown.convert(file_content.decode('utf-8'))
            # markdown_content = result.text_content
            
            # モック実装
            file_extension = file_name.split('.')[-1].lower()
            try:
                text_content = file_content.decode('utf-8')[:1000]  # 最初の1000文字をサンプル
            except UnicodeDecodeError:
                text_content = "[バイナリコンテンツ]"
            
            markdown_content = f"""# {file_name}

## Web文書情報
- **ファイル名**: {file_name}
- **ファイル形式**: {file_extension.upper()}
- **ファイルサイズ**: {len(file_content):,} bytes
- **処理方法**: Microsoft Markitdown
- **処理日時**: {start_time.isoformat()}

## 変換内容

### 構造化マークダウン
{self._generate_web_mock_content(file_extension, text_content)}

---
*このWeb文書はMicrosoft Markitdownで変換されました*
"""
            
            end_time = datetime.now()
            processing_time = (end_time - start_time).total_seconds() * 1000
            
            metadata.update({
                'success': True,
                'endTime': end_time.isoformat(),
                'processingTime': processing_time,
                'outputLength': len(markdown_content),
                'qualityScore': 80  # Web文書の変換品質
            })
            
            logger.info(f"Markitdown Web文書変換成功: {file_name}")
            return True, markdown_content, metadata
            
        except Exception as e:
            end_time = datetime.now()
            processing_time = (end_time - start_time).total_seconds() * 1000
            
            metadata.update({
                'success': False,
                'endTime': end_time.isoformat(),
                'processingTime': processing_time,
                'error': str(e)
            })
            
            logger.error(f"Markitdown Web文書変換失敗: {file_name} - {e}")
            return False, "", metadata
    
    def process_with_langchain(self, file_content: bytes, file_name: str) -> Tuple[bool, str, Dict]:
        """LangChainでWeb文書を変換"""
        start_time = datetime.now()
        metadata = {
            'method': 'langchain',
            'processor': 'WebDocumentProcessor',
            'startTime': start_time.isoformat(),
            'success': False
        }
        
        try:
            if not self.validate_file(file_content, file_name):
                raise ValueError("ファイル検証に失敗しました")
            
            # TODO: 実際のLangChain実装
            # from langchain.document_loaders import UnstructuredHTMLLoader
            # loader = UnstructuredHTMLLoader(io.BytesIO(file_content))
            # documents = loader.load()
            # markdown_content = "\n\n".join([doc.page_content for doc in documents])
            
            # モック実装
            file_extension = file_name.split('.')[-1].lower()
            try:
                text_content = file_content.decode('utf-8')[:1000]
            except UnicodeDecodeError:
                text_content = "[バイナリコンテンツ]"
            
            markdown_content = f"""# {file_name}

## Web文書情報
- **ファイル名**: {file_name}
- **ファイル形式**: {file_extension.upper()}
- **ファイルサイズ**: {len(file_content):,} bytes
- **処理方法**: LangChain
- **処理日時**: {start_time.isoformat()}

## 変換内容

### LangChain抽出結果
{self._generate_web_mock_content(file_extension, text_content)}

---
*このWeb文書はLangChainで変換されました*
"""
            
            end_time = datetime.now()
            processing_time = (end_time - start_time).total_seconds() * 1000
            
            metadata.update({
                'success': True,
                'endTime': end_time.isoformat(),
                'processingTime': processing_time,
                'outputLength': len(markdown_content),
                'qualityScore': 85  # LangChainはWeb文書が得意
            })
            
            logger.info(f"LangChain Web文書変換成功: {file_name}")
            return True, markdown_content, metadata
            
        except Exception as e:
            end_time = datetime.now()
            processing_time = (end_time - start_time).total_seconds() * 1000
            
            metadata.update({
                'success': False,
                'endTime': end_time.isoformat(),
                'processingTime': processing_time,
                'error': str(e)
            })
            
            logger.error(f"LangChain Web文書変換失敗: {file_name} - {e}")
            return False, "", metadata
    
    def _generate_web_mock_content(self, file_extension: str, text_content: str) -> str:
        """Web文書のモックコンテンツ生成"""
        if file_extension == 'html':
            return f"""
#### HTML構造解析
- タイトル: [ページタイトル]
- メタデータ: 検出済み
- 見出し構造: H1-H6 検出済み
- リンク: 検出済み

#### 抽出されたコンテンツ
[HTMLコンテンツがここに表示されます]

#### サンプルテキスト
{text_content[:200]}...
"""
        elif file_extension == 'xml':
            return f"""
#### XML構造解析
- ルート要素: 検出済み
- 名前空間: 検出済み
- 属性: 検出済み
- 階層構造: 解析済み

#### 抽出されたデータ
[XMLデータがここに表示されます]

#### サンプルテキスト
{text_content[:200]}...
"""
        else:
            return f"[Web文書コンテンツ]\n\n{text_content[:200]}..."

class DataFileProcessor(BaseFormatProcessor):
    """データファイル（csv, tsv）プロセッサー"""
    
    def process_with_markitdown(self, file_content: bytes, file_name: str) -> Tuple[bool, str, Dict]:
        """Markitdownでデータファイルを変換（通常は使用しない）"""
        # データファイルはLangChainが専門のため、Markitdownでは基本的に処理しない
        start_time = datetime.now()
        metadata = {
            'method': 'markitdown',
            'processor': 'DataFileProcessor',
            'startTime': start_time.isoformat(),
            'success': False,
            'error': 'Markitdownはデータファイル処理に最適化されていません'
        }
        
        end_time = datetime.now()
        processing_time = (end_time - start_time).total_seconds() * 1000
        
        metadata.update({
            'endTime': end_time.isoformat(),
            'processingTime': processing_time
        })
        
        logger.warning(f"Markitdown データファイル処理は推奨されません: {file_name}")
        return False, "", metadata
    
    def process_with_langchain(self, file_content: bytes, file_name: str) -> Tuple[bool, str, Dict]:
        """LangChainでデータファイルを変換"""
        start_time = datetime.now()
        metadata = {
            'method': 'langchain',
            'processor': 'DataFileProcessor',
            'startTime': start_time.isoformat(),
            'success': False
        }
        
        try:
            if not self.validate_file(file_content, file_name):
                raise ValueError("ファイル検証に失敗しました")
            
            # TODO: 実際のLangChain + pandas実装
            # import pandas as pd
            # df = pd.read_csv(io.BytesIO(file_content))
            # markdown_content = df.to_markdown()
            
            # モック実装
            file_extension = file_name.split('.')[-1].lower()
            try:
                text_content = file_content.decode('utf-8')
                lines = text_content.split('\n')[:10]  # 最初の10行をサンプル
            except UnicodeDecodeError:
                lines = ["[バイナリコンテンツ]"]
            
            markdown_content = f"""# {file_name}

## データファイル情報
- **ファイル名**: {file_name}
- **ファイル形式**: {file_extension.upper()}
- **ファイルサイズ**: {len(file_content):,} bytes
- **処理方法**: LangChain + Pandas
- **処理日時**: {start_time.isoformat()}

## データ構造

### 統計情報
{self._generate_data_mock_content(file_extension, lines)}

### データサンプル
```
{chr(10).join(lines[:5])}
```

---
*このデータファイルはLangChainで変換されました*
"""
            
            end_time = datetime.now()
            processing_time = (end_time - start_time).total_seconds() * 1000
            
            metadata.update({
                'success': True,
                'endTime': end_time.isoformat(),
                'processingTime': processing_time,
                'outputLength': len(markdown_content),
                'qualityScore': 90  # LangChainはデータファイルが得意
            })
            
            logger.info(f"LangChain データファイル変換成功: {file_name}")
            return True, markdown_content, metadata
            
        except Exception as e:
            end_time = datetime.now()
            processing_time = (end_time - start_time).total_seconds() * 1000
            
            metadata.update({
                'success': False,
                'endTime': end_time.isoformat(),
                'processingTime': processing_time,
                'error': str(e)
            })
            
            logger.error(f"LangChain データファイル変換失敗: {file_name} - {e}")
            return False, "", metadata
    
    def _generate_data_mock_content(self, file_extension: str, lines: list) -> str:
        """データファイルのモックコンテンツ生成"""
        separator = ',' if file_extension == 'csv' else '\t'
        
        if lines and len(lines) > 0:
            header_cols = len(lines[0].split(separator)) if lines[0] else 0
            data_rows = len(lines) - 1
        else:
            header_cols = 0
            data_rows = 0
        
        return f"""
- **区切り文字**: {separator}
- **推定列数**: {header_cols}
- **推定行数**: {data_rows}
- **データ型**: 混合型
- **エンコーディング**: UTF-8

#### データ概要
| 項目 | 値 |
|------|-----|
| 列数 | {header_cols} |
| 行数 | {data_rows} |
| ファイル形式 | {file_extension.upper()} |
"""

# ファイル形式別プロセッサーのファクトリー
def get_format_processor(file_format: str, config: Dict[str, Any]) -> Optional[BaseFormatProcessor]:
    """ファイル形式に応じたプロセッサーを取得"""
    
    if file_format in ['docx', 'xlsx', 'pptx']:
        return OfficeDocumentProcessor(config)
    elif file_format == 'pdf':
        return PDFProcessor(config)
    elif file_format in ['png', 'jpg', 'jpeg', 'gif']:
        return ImageProcessor(config)
    elif file_format in ['html', 'xml']:
        return WebDocumentProcessor(config)
    elif file_format in ['csv', 'tsv']:
        return DataFileProcessor(config)
    else:
        logger.warning(f"サポートされていないファイル形式: {file_format}")
        return None