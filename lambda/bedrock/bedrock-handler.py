#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Amazon Bedrock LLM統合ハンドラー
日本語対応のRAG機能を提供
"""

import json
import boto3
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import os

# ログ設定
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class BedrockLLMHandler:
    """Amazon Bedrock LLMハンドラークラス"""
    
    def __init__(self):
        """初期化"""
        self.bedrock_client = boto3.client('bedrock-runtime', region_name=os.environ.get('AWS_REGION', 'us-east-1'))
        self.model_id = os.environ.get('BEDROCK_MODEL_ID', 'amazon.nova-pro-v1:0')
        
        # 入力値検証とセキュリティ強化
        try:
            self.max_tokens = max(1, min(int(os.environ.get('MAX_TOKENS', '4000')), 8192))  # 上限設定
            self.temperature = max(0.0, min(float(os.environ.get('TEMPERATURE', '0.1')), 1.0))  # 範囲制限
        except (ValueError, TypeError) as e:
            logger.warning(f"設定値が無効です。デフォルト値を使用します: {e}")
            self.max_tokens = 4000
            self.temperature = 0.1
        
        # サポートされているモデルの検証
        self._validate_model_id()
        
    def generate_response(self, query: str, context: List[Dict[str, Any]], user_id: str = None) -> Dict[str, Any]:
        """
        RAG応答を生成
        
        Args:
            query: ユーザーの質問
            context: 検索された関連文書
            user_id: ユーザーID（権限チェック用）
            
        Returns:
            生成された応答とメタデータ
        """
        try:
            # 入力値の検証とサニタイズ
            if not query or not isinstance(query, str):
                return {
                    'success': False,
                    'error': '有効な質問が指定されていません',
                    'timestamp': datetime.now().isoformat()
                }
            
            query = self._sanitize_input(query)
            
            # コンテキストを日本語で整形
            context_text = self._format_context(context)
            
            # プロンプトを構築
            prompt = self._build_prompt(query, context_text)
            
            # Bedrockに送信
            response = self._invoke_bedrock(prompt)
            
            # 応答を整形
            formatted_response = self._format_response(response, context, query)
            
            logger.info(f"RAG応答生成完了 - ユーザー: {user_id}, クエリ: {query[:50]}...")
            
            return formatted_response
            
        except Exception as e:
            logger.error(f"RAG応答生成エラー: {str(e)}")
            return {
                'success': False,
                'error': f'応答生成中にエラーが発生しました: {str(e)}',
                'timestamp': datetime.now().isoformat()
            }
    
    def _format_context(self, context: List[Dict[str, Any]]) -> str:
        """コンテキスト文書を日本語で整形"""
        if not context:
            return "関連する文書が見つかりませんでした。"
        
        formatted_context = "以下の関連文書を参考にしてください：\n\n"
        
        for i, doc in enumerate(context, 1):
            title = doc.get('title', f'文書{i}')
            content = doc.get('content', '')
            source = doc.get('source', '不明')
            score = doc.get('score', 0.0)
            
            formatted_context += f"【文書{i}: {title}】\n"
            formatted_context += f"出典: {source}\n"
            formatted_context += f"関連度: {score:.2f}\n"
            formatted_context += f"内容: {content[:500]}...\n\n"
        
        return formatted_context
    
    def _build_prompt(self, query: str, context: str) -> str:
        """日本語対応のプロンプトを構築"""
        prompt = f"""あなたは日本語で回答する親切なAIアシスタントです。以下の文書を参考にして、ユーザーの質問に正確で有用な回答を提供してください。

参考文書:
{context}

ユーザーの質問: {query}

回答の際は以下の点に注意してください：
1. 日本語で自然な回答をしてください
2. 参考文書の情報を基に回答してください
3. 情報が不足している場合は、その旨を明記してください
4. 出典を明示してください
5. 丁寧で分かりやすい説明を心がけてください

回答:"""
        
        return prompt
    
    def _invoke_bedrock(self, prompt: str) -> Dict[str, Any]:
        """Bedrockモデルを呼び出し（モデル別対応）"""
        try:
            # モデル別のリクエスト形式を選択
            if self.model_id.startswith('amazon.nova'):
                # Nova Pro用のリクエスト形式（正しいフォーマット）
                request_body = {
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "text": prompt
                                }
                            ]
                        }
                    ],
                    "inferenceConfig": {
                        "max_new_tokens": self.max_tokens,
                        "temperature": self.temperature
                    }
                }
            elif self.model_id.startswith('anthropic.claude'):
                # Claude 3用のリクエスト形式
                request_body = {
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": self.max_tokens,
                    "temperature": self.temperature,
                    "messages": [
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ]
                }
            else:
                # その他のモデル用のフォールバック
                request_body = {
                    "inputText": prompt,
                    "textGenerationConfig": {
                        "maxTokenCount": self.max_tokens,
                        "temperature": self.temperature
                    }
                }
            
            response = self.bedrock_client.invoke_model(
                modelId=self.model_id,
                body=json.dumps(request_body),
                contentType='application/json'
            )
            
            response_body = json.loads(response['body'].read())
            return response_body
            
        except Exception as e:
            logger.error(f"Bedrock呼び出しエラー: {str(e)}")
            raise
    
    def _format_response(self, bedrock_response: Dict[str, Any], context: List[Dict[str, Any]], query: str) -> Dict[str, Any]:
        """応答を整形"""
        try:
            # モデル別の応答形式に対応
            if self.model_id.startswith('amazon.nova'):
                # Nova Pro の応答形式
                output = bedrock_response.get('output', {})
                message = output.get('message', {})
                content = message.get('content', [])
                if content and len(content) > 0:
                    answer = content[0].get('text', '')
                else:
                    answer = "申し訳ございませんが、回答を生成できませんでした。"
            elif self.model_id.startswith('anthropic.claude'):
                # Claude 3の応答形式
                content = bedrock_response.get('content', [])
                if content and len(content) > 0:
                    answer = content[0].get('text', '')
                else:
                    answer = "申し訳ございませんが、回答を生成できませんでした。"
            else:
                # その他のモデル用のフォールバック
                answer = bedrock_response.get('outputText', bedrock_response.get('generated_text', ''))
                if not answer:
                    answer = "申し訳ございませんが、回答を生成できませんでした。"
            
            return {
                'success': True,
                'answer': answer,
                'sources': [
                    {
                        'title': doc.get('title', ''),
                        'source': doc.get('source', ''),
                        'score': doc.get('score', 0.0)
                    }
                    for doc in context
                ],
                'query': query,
                'timestamp': datetime.now().isoformat(),
                'model_used': self.model_id,
                'tokens_used': self._extract_token_usage(bedrock_response)
            }
            
        except Exception as e:
            logger.error(f"応答整形エラー: {str(e)}")
            return {
                'success': False,
                'error': f'応答の整形中にエラーが発生しました: {str(e)}',
                'timestamp': datetime.now().isoformat()
            }
    
    def _extract_token_usage(self, bedrock_response: Dict[str, Any]) -> int:
        """モデル別のトークン使用量を抽出"""
        if self.model_id.startswith('amazon.nova'):
            # Nova Pro のトークン使用量
            usage = bedrock_response.get('usage', {})
            return usage.get('outputTokens', 0)
        elif self.model_id.startswith('anthropic.claude'):
            # Claude 3のトークン使用量
            usage = bedrock_response.get('usage', {})
            return usage.get('output_tokens', 0)
        else:
            # その他のモデル
            return bedrock_response.get('usage', {}).get('totalTokenCount', 0)
    
    def _validate_model_id(self):
        """モデルIDの検証"""
        supported_models = [
            'amazon.nova-pro-v1:0',
            'amazon.nova-lite-v1:0',
            'anthropic.claude-3-sonnet-20240229-v1:0',
            'anthropic.claude-3-haiku-20240307-v1:0'
        ]
        
        if self.model_id not in supported_models:
            logger.warning(f"未サポートのモデルID: {self.model_id}. デフォルトのNova Proを使用します。")
            self.model_id = 'amazon.nova-pro-v1:0'
    
    def _sanitize_input(self, text: str) -> str:
        """入力テキストのサニタイズ"""
        if not isinstance(text, str):
            return ""
        
        # 最大長制限（DoS攻撃防止）
        max_input_length = 10000
        if len(text) > max_input_length:
            logger.warning(f"入力テキストが長すぎます。切り詰めます: {len(text)} -> {max_input_length}")
            text = text[:max_input_length]
        
        # 危険な文字列の除去
        import re
        # 制御文字の除去
        text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', text)
        
        return text.strip()

def lambda_handler(event, context):
    """Lambda関数のエントリーポイント"""
    try:
        # リクエストデータを解析
        body = json.loads(event.get('body', '{}'))
        query = body.get('query', '')
        context_docs = body.get('context', [])
        user_id = body.get('user_id', 'anonymous')
        
        if not query:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': False,
                    'error': 'クエリが指定されていません'
                }, ensure_ascii=False)
            }
        
        # BedrockハンドラーでRAG応答を生成
        handler = BedrockLLMHandler()
        result = handler.generate_response(query, context_docs, user_id)
        
        return {
            'statusCode': 200 if result.get('success') else 500,
            'headers': {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(result, ensure_ascii=False)
        }
        
    except Exception as e:
        logger.error(f"Lambda実行エラー: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': False,
                'error': f'内部エラーが発生しました: {str(e)}',
                'timestamp': datetime.now().isoformat()
            }, ensure_ascii=False)
        }

if __name__ == "__main__":
    # テスト用
    test_event = {
        'body': json.dumps({
            'query': 'FSx for NetApp ONTAPの特徴を教えてください',
            'context': [
                {
                    'title': 'FSx for NetApp ONTAP概要',
                    'content': 'Amazon FSx for NetApp ONTAPは、NetApp ONTAPファイルシステムを基盤とするフルマネージドサービスです。',
                    'source': 'aws-docs',
                    'score': 0.95
                }
            ],
            'user_id': 'test-user'
        })
    }
    
    result = lambda_handler(test_event, None)
    print(json.dumps(result, indent=2, ensure_ascii=False))