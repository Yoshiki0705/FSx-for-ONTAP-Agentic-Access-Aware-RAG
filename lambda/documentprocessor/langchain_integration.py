"""
LangChain統合モジュール
Markitdownで変換されたマークダウンテキストのLangChain処理統合
"""

import json
import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
import hashlib
import re
from datetime import datetime

# LangChain imports (実際の実装では必要)
# from langchain.text_splitter import RecursiveCharacterTextSplitter, MarkdownHeaderTextSplitter
# from langchain.schema import Document
# from langchain.embeddings import BedrockEmbeddings
# from langchain.vectorstores import OpenSearchVectorSearch

logger = logging.getLogger(__name__)

@dataclass
class ChunkMetadata:
    """チャンクメタデータ"""
    chunk_id: str
    source_file: str
    chunk_index: int
    chunk_size: int
    chunk_type: str  # 'header', 'paragraph', 'list', 'code', 'table'
    header_level: Optional[int] = None
    parent_header: Optional[str] = None
    processing_method: str = 'markitdown'
    created_at: str = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow().isoformat()

@dataclass
class ProcessingResult:
    """処理結果"""
    success: bool
    chunks: List[Dict[str, Any]]
    embeddings: List[List[float]]
    metadata: Dict[str, Any]
    error: Optional[str] = None

class LangChainIntegration:
    """LangChain統合クラス"""
    
    def __init__(self, 
                 region: str = 'us-east-1',
                 embedding_model: str = 'amazon.titan-embed-text-v1',
                 chunk_size: int = 1000,
                 chunk_overlap: int = 200):
        """
        初期化
        
        Args:
            region: AWSリージョン
            embedding_model: 埋め込みモデル名
            chunk_size: チャンクサイズ
            chunk_overlap: チャンクオーバーラップ
        """
        self.region = region
        self.embedding_model = embedding_model
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
        # 実際の実装では以下を初期化
        # self.embeddings = BedrockEmbeddings(
        #     model_id=embedding_model,
        #     region_name=region
        # )
        # self.text_splitter = self._create_text_splitter()
        
        logger.info(f"LangChain統合を初期化: region={region}, model={embedding_model}")
    
    def process_markdown_content(self, 
                               markdown_content: str,
                               source_file: str,
                               processing_method: str = 'markitdown',
                               user_id: Optional[str] = None,
                               project_id: Optional[str] = None) -> ProcessingResult:
        """
        マークダウンコンテンツを処理してチャンクと埋め込みを生成
        
        Args:
            markdown_content: マークダウンテキスト
            source_file: ソースファイル名
            processing_method: 処理方法
            user_id: ユーザーID
            project_id: プロジェクトID
            
        Returns:
            ProcessingResult: 処理結果
        """
        try:
            logger.info(f"📄 マークダウンコンテンツ処理開始: {source_file}")
            
            # 1. マークダウンをチャンクに分割
            chunks = self._split_markdown_content(markdown_content, source_file, processing_method)
            
            # 2. 各チャンクの埋め込みを生成
            embeddings = self._generate_embeddings([chunk['content'] for chunk in chunks])
            
            # 3. メタデータを構築
            metadata = {
                'source_file': source_file,
                'processing_method': processing_method,
                'total_chunks': len(chunks),
                'total_characters': len(markdown_content),
                'embedding_model': self.embedding_model,
                'chunk_size': self.chunk_size,
                'chunk_overlap': self.chunk_overlap,
                'processed_at': datetime.utcnow().isoformat(),
                'user_id': user_id,
                'project_id': project_id
            }\n            \n            logger.info(f\"✅ マークダウンコンテンツ処理完了: {len(chunks)}チャンク生成\")\n            \n            return ProcessingResult(\n                success=True,\n                chunks=chunks,\n                embeddings=embeddings,\n                metadata=metadata\n            )\n            \n        except Exception as e:\n            logger.error(f\"❌ マークダウンコンテンツ処理エラー: {e}\")\n            return ProcessingResult(\n                success=False,\n                chunks=[],\n                embeddings=[],\n                metadata={},\n                error=str(e)\n            )\n    \n    def _split_markdown_content(self, \n                              markdown_content: str, \n                              source_file: str,\n                              processing_method: str) -> List[Dict[str, Any]]:\n        \"\"\"\n        マークダウンコンテンツをチャンクに分割\n        \n        Args:\n            markdown_content: マークダウンテキスト\n            source_file: ソースファイル名\n            processing_method: 処理方法\n            \n        Returns:\n            List[Dict]: チャンクリスト\n        \"\"\"\n        chunks = []\n        \n        # ヘッダーベースの分割を実行\n        header_chunks = self._split_by_headers(markdown_content)\n        \n        for i, (content, header_info) in enumerate(header_chunks):\n            # 長いチャンクをさらに分割\n            if len(content) > self.chunk_size:\n                sub_chunks = self._split_long_chunk(content)\n                for j, sub_content in enumerate(sub_chunks):\n                    chunk_id = self._generate_chunk_id(source_file, i, j)\n                    chunk_metadata = ChunkMetadata(\n                        chunk_id=chunk_id,\n                        source_file=source_file,\n                        chunk_index=len(chunks),\n                        chunk_size=len(sub_content),\n                        chunk_type=self._detect_chunk_type(sub_content),\n                        header_level=header_info.get('level'),\n                        parent_header=header_info.get('title'),\n                        processing_method=processing_method\n                    )\n                    \n                    chunks.append({\n                        'content': sub_content.strip(),\n                        'metadata': chunk_metadata.__dict__\n                    })\n            else:\n                chunk_id = self._generate_chunk_id(source_file, i)\n                chunk_metadata = ChunkMetadata(\n                    chunk_id=chunk_id,\n                    source_file=source_file,\n                    chunk_index=len(chunks),\n                    chunk_size=len(content),\n                    chunk_type=self._detect_chunk_type(content),\n                    header_level=header_info.get('level'),\n                    parent_header=header_info.get('title'),\n                    processing_method=processing_method\n                )\n                \n                chunks.append({\n                    'content': content.strip(),\n                    'metadata': chunk_metadata.__dict__\n                })\n        \n        return chunks\n    \n    def _split_by_headers(self, markdown_content: str) -> List[Tuple[str, Dict[str, Any]]]:\n        \"\"\"\n        ヘッダーに基づいてマークダウンを分割\n        \n        Args:\n            markdown_content: マークダウンテキスト\n            \n        Returns:\n            List[Tuple]: (コンテンツ, ヘッダー情報) のタプルリスト\n        \"\"\"\n        # ヘッダーパターン\n        header_pattern = r'^(#{1,6})\\s+(.+)$'\n        lines = markdown_content.split('\\n')\n        \n        chunks = []\n        current_chunk = []\n        current_header = {'level': None, 'title': None}\n        \n        for line in lines:\n            header_match = re.match(header_pattern, line)\n            \n            if header_match:\n                # 前のチャンクを保存\n                if current_chunk:\n                    chunks.append(('\\n'.join(current_chunk), current_header.copy()))\n                    current_chunk = []\n                \n                # 新しいヘッダー情報を設定\n                level = len(header_match.group(1))\n                title = header_match.group(2).strip()\n                current_header = {'level': level, 'title': title}\n                current_chunk.append(line)\n            else:\n                current_chunk.append(line)\n        \n        # 最後のチャンクを保存\n        if current_chunk:\n            chunks.append(('\\n'.join(current_chunk), current_header))\n        \n        return chunks\n    \n    def _split_long_chunk(self, content: str) -> List[str]:\n        \"\"\"\n        長いチャンクを分割\n        \n        Args:\n            content: 分割するコンテンツ\n            \n        Returns:\n            List[str]: 分割されたチャンクリスト\n        \"\"\"\n        # 実際の実装では RecursiveCharacterTextSplitter を使用\n        # splitter = RecursiveCharacterTextSplitter(\n        #     chunk_size=self.chunk_size,\n        #     chunk_overlap=self.chunk_overlap,\n        #     separators=[\"\\n\\n\", \"\\n\", \". \", \" \", \"\"]\n        # )\n        # return splitter.split_text(content)\n        \n        # モックアップ実装\n        chunks = []\n        words = content.split()\n        current_chunk = []\n        current_size = 0\n        \n        for word in words:\n            word_size = len(word) + 1  # スペース込み\n            \n            if current_size + word_size > self.chunk_size and current_chunk:\n                chunks.append(' '.join(current_chunk))\n                # オーバーラップ処理\n                overlap_words = current_chunk[-self.chunk_overlap//10:] if len(current_chunk) > self.chunk_overlap//10 else current_chunk\n                current_chunk = overlap_words + [word]\n                current_size = sum(len(w) + 1 for w in current_chunk)\n            else:\n                current_chunk.append(word)\n                current_size += word_size\n        \n        if current_chunk:\n            chunks.append(' '.join(current_chunk))\n        \n        return chunks\n    \n    def _detect_chunk_type(self, content: str) -> str:\n        \"\"\"\n        チャンクタイプを検出\n        \n        Args:\n            content: チャンクコンテンツ\n            \n        Returns:\n            str: チャンクタイプ\n        \"\"\"\n        content_lower = content.lower().strip()\n        \n        # ヘッダー\n        if re.match(r'^#{1,6}\\s+', content):\n            return 'header'\n        \n        # コードブロック\n        if '```' in content or content.startswith('    '):\n            return 'code'\n        \n        # リスト\n        if re.match(r'^[\\*\\-\\+]\\s+', content, re.MULTILINE) or re.match(r'^\\d+\\.\\s+', content, re.MULTILINE):\n            return 'list'\n        \n        # テーブル\n        if '|' in content and re.search(r'\\|.*\\|', content):\n            return 'table'\n        \n        # デフォルトは段落\n        return 'paragraph'\n    \n    def _generate_chunk_id(self, source_file: str, chunk_index: int, sub_index: Optional[int] = None) -> str:\n        \"\"\"\n        チャンクIDを生成\n        \n        Args:\n            source_file: ソースファイル名\n            chunk_index: チャンクインデックス\n            sub_index: サブインデックス\n            \n        Returns:\n            str: チャンクID\n        \"\"\"\n        base_string = f\"{source_file}_{chunk_index}\"\n        if sub_index is not None:\n            base_string += f\"_{sub_index}\"\n        \n        return hashlib.md5(base_string.encode()).hexdigest()[:16]\n    \n    def _generate_embeddings(self, texts: List[str]) -> List[List[float]]:\n        \"\"\"\n        テキストリストの埋め込みを生成\n        \n        Args:\n            texts: テキストリスト\n            \n        Returns:\n            List[List[float]]: 埋め込みリスト\n        \"\"\"\n        try:\n            logger.info(f\"🔢 埋め込み生成開始: {len(texts)}テキスト\")\n            \n            # 実際の実装では Bedrock Embeddings を使用\n            # embeddings = self.embeddings.embed_documents(texts)\n            \n            # モックアップ実装（実際の埋め込み次元は1536）\n            embeddings = []\n            for text in texts:\n                # ダミー埋め込み（実際の実装では削除）\n                mock_embedding = [0.1] * 1536  # Titan Embeddings の次元数\n                # テキストの特徴を反映したダミー値\n                text_hash = hash(text) % 1000\n                for i in range(min(10, len(mock_embedding))):\n                    mock_embedding[i] = (text_hash + i) / 1000.0\n                embeddings.append(mock_embedding)\n            \n            logger.info(f\"✅ 埋め込み生成完了: {len(embeddings)}埋め込み\")\n            return embeddings\n            \n        except Exception as e:\n            logger.error(f\"❌ 埋め込み生成エラー: {e}\")\n            raise\n    \n    def create_langchain_documents(self, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:\n        \"\"\"\n        LangChain Document オブジェクトを作成\n        \n        Args:\n            chunks: チャンクリスト\n            \n        Returns:\n            List[Dict]: LangChain Document 互換オブジェクト\n        \"\"\"\n        documents = []\n        \n        for chunk in chunks:\n            # 実際の実装では langchain.schema.Document を使用\n            # doc = Document(\n            #     page_content=chunk['content'],\n            #     metadata=chunk['metadata']\n            # )\n            \n            # モックアップ実装\n            doc = {\n                'page_content': chunk['content'],\n                'metadata': chunk['metadata'],\n                'type': 'Document'\n            }\n            documents.append(doc)\n        \n        return documents\n    \n    def get_processing_stats(self) -> Dict[str, Any]:\n        \"\"\"\n        処理統計を取得\n        \n        Returns:\n            Dict: 処理統計\n        \"\"\"\n        return {\n            'embedding_model': self.embedding_model,\n            'chunk_size': self.chunk_size,\n            'chunk_overlap': self.chunk_overlap,\n            'region': self.region,\n            'supported_chunk_types': ['header', 'paragraph', 'list', 'code', 'table']\n        }\n\n\ndef create_langchain_integration(config: Dict[str, Any]) -> LangChainIntegration:\n    \"\"\"\n    LangChain統合インスタンスを作成\n    \n    Args:\n        config: 設定辞書\n        \n    Returns:\n        LangChainIntegration: 統合インスタンス\n    \"\"\"\n    return LangChainIntegration(\n        region=config.get('region', 'us-east-1'),\n        embedding_model=config.get('embedding_model', 'amazon.titan-embed-text-v1'),\n        chunk_size=config.get('chunk_size', 1000),\n        chunk_overlap=config.get('chunk_overlap', 200)\n    )\n\n\n# テスト用のサンプル関数\ndef test_langchain_integration():\n    \"\"\"\n    LangChain統合のテスト\n    \"\"\"\n    # サンプルマークダウンコンテンツ\n    sample_markdown = \"\"\"\n# ドキュメントタイトル\n\nこれはサンプルドキュメントです。\n\n## セクション1\n\nセクション1の内容です。\n\n### サブセクション1.1\n\nサブセクションの内容です。\n\n- リスト項目1\n- リスト項目2\n- リスト項目3\n\n## セクション2\n\n```python\ndef hello_world():\n    print(\"Hello, World!\")\n```\n\n| 列1 | 列2 | 列3 |\n|-----|-----|-----|\n| A   | B   | C   |\n| D   | E   | F   |\n\"\"\"\n    \n    # LangChain統合をテスト\n    integration = LangChainIntegration()\n    result = integration.process_markdown_content(\n        markdown_content=sample_markdown,\n        source_file=\"test_document.md\",\n        processing_method=\"markitdown\"\n    )\n    \n    print(f\"処理結果: {result.success}\")\n    print(f\"チャンク数: {len(result.chunks)}\")\n    print(f\"埋め込み数: {len(result.embeddings)}\")\n    \n    for i, chunk in enumerate(result.chunks[:3]):  # 最初の3チャンクを表示\n        print(f\"\\nチャンク {i+1}:\")\n        print(f\"タイプ: {chunk['metadata']['chunk_type']}\")\n        print(f\"サイズ: {chunk['metadata']['chunk_size']}\")\n        print(f\"コンテンツ: {chunk['content'][:100]}...\")\n\n\nif __name__ == \"__main__\":\n    test_langchain_integration()\n"