"""
Pipecat Voice Agent for AgentCore Runtime
STT (Nova Sonic) → LLM (Claude) → TTS (Nova Sonic) パイプラインを定義する。
WebRTC メディアストリーム入出力で AgentCore Runtime 上にデプロイされる。
"""

import os
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# AgentCore Runtime 環境変数
BEDROCK_REGION = os.environ.get("AWS_REGION", "ap-northeast-1")
KB_ID = os.environ.get("BEDROCK_KB_ID", "")
NOVA_SONIC_MODEL_ID = "amazon.nova-sonic-v1:0"
CLAUDE_MODEL_ID = os.environ.get("LLM_MODEL_ID", "anthropic.claude-sonnet-4-20250514")


class RAGTool:
    """
    Permission-aware RAG 検索を MCP ツールとして定義。
    ユーザー ID（WebRTC セッションから取得）を Permission Filter に渡す。
    """

    name = "rag_search"
    description = "Search the knowledge base with permission-aware filtering"

    def __init__(self, kb_id: str, region: str):
        self.kb_id = kb_id
        self.region = region

    async def execute(self, query: str, user_id: str, language: str = "ja") -> dict[str, Any]:
        """
        RAG 検索を実行する。
        Permission Filter は Phase 1 と同一ロジック:
        1. userId → DynamoDB (user-access) → SID/UID/GID 取得
        2. 検索結果の metadata.json から allowed_sids/allowed_uids を取得
        3. ユーザーの SID/UID/GID と照合し、アクセス権のない結果を除外
        """
        import boto3

        bedrock_agent = boto3.client(
            "bedrock-agent-runtime", region_name=self.region
        )

        try:
            # Bedrock KB 検索
            response = bedrock_agent.retrieve(
                knowledgeBaseId=self.kb_id,
                retrievalQuery={"text": query},
                retrievalConfiguration={
                    "vectorSearchConfiguration": {
                        "numberOfResults": 10,
                    }
                },
            )

            results = response.get("retrievalResults", [])

            # Permission Filter 適用
            filtered_results = await self._apply_permission_filter(
                results, user_id
            )

            if not filtered_results:
                return {
                    "results": [],
                    "citations": [],
                    "filteredCount": len(results),
                    "message": "アクセス可能な検索結果がありません",
                }

            return {
                "results": [
                    {
                        "content": r.get("content", {}).get("text", ""),
                        "uri": r.get("location", {})
                        .get("s3Location", {})
                        .get("uri", ""),
                        "score": r.get("score", 0),
                    }
                    for r in filtered_results
                ],
                "citations": [
                    {
                        "uri": r.get("location", {})
                        .get("s3Location", {})
                        .get("uri", ""),
                    }
                    for r in filtered_results
                ],
                "filteredCount": len(results) - len(filtered_results),
            }

        except Exception as e:
            logger.error(f"RAG search error: {e}")
            return {
                "results": [],
                "citations": [],
                "filteredCount": 0,
                "error": str(e),
            }

    async def _apply_permission_filter(
        self, results: list, user_id: str
    ) -> list:
        """
        Phase 1 と同一の Permission Filter ロジックを適用する。
        入力方式（WebRTC 音声由来 / REST 音声由来 / テキスト入力）に関わらず
        同一の結果を返す。
        """
        import boto3

        dynamodb = boto3.resource("dynamodb", region_name=self.region)
        table = dynamodb.Table(os.environ.get("USER_ACCESS_TABLE_NAME", "user-access"))

        try:
            response = table.get_item(Key={"userId": user_id})
            item = response.get("Item")

            if not item:
                # Fail-Closed: ユーザーエントリなし → 全結果除外
                return []

            user_sids = set()
            if item.get("userSID"):
                user_sids.add(item["userSID"])
            if item.get("groupSIDs"):
                user_sids.update(item["groupSIDs"])

            user_uid = item.get("uid") or item.get("UID")
            user_gid = item.get("gid") or item.get("GID")
            unix_groups = set(item.get("unixGroups", []))

            filtered = []
            for result in results:
                metadata = result.get("metadata", {})
                allowed_sids = set(metadata.get("allowed_sids", []))
                allowed_uids = set(metadata.get("allowed_uids", []))
                allowed_gids = set(metadata.get("allowed_gids", []))

                # アクセス権チェック
                has_access = False

                # SID ベースチェック
                if allowed_sids and user_sids.intersection(allowed_sids):
                    has_access = True
                # UID ベースチェック
                elif allowed_uids and user_uid and str(user_uid) in allowed_uids:
                    has_access = True
                # GID ベースチェック
                elif allowed_gids and (
                    (user_gid and str(user_gid) in allowed_gids)
                    or unix_groups.intersection(allowed_gids)
                ):
                    has_access = True
                # メタデータにアクセス制御情報がない場合はアクセス許可
                elif not allowed_sids and not allowed_uids and not allowed_gids:
                    has_access = True

                if has_access:
                    filtered.append(result)

            return filtered

        except Exception as e:
            logger.error(f"Permission filter error: {e}")
            # Fail-Closed: エラー時は全結果除外
            return []


class VoiceAgent:
    """
    Pipecat ベースの音声エージェント。
    STT → LLM → TTS パイプラインを AgentCore Runtime 上でオーケストレーション。
    """

    def __init__(self):
        self.rag_tool = RAGTool(kb_id=KB_ID, region=BEDROCK_REGION)
        self.system_prompt = self._build_system_prompt()

    def _build_system_prompt(self) -> str:
        return """You are a helpful voice assistant for a Permission-aware RAG system.
You help users find information from their accessible documents.
Always respond in the same language as the user's input.
When searching for information, use the rag_search tool.
Keep responses concise and natural for voice interaction.
If no accessible results are found, inform the user politely."""

    async def process_turn(self, transcript: str, user_id: str, language: str = "ja") -> str:
        """
        1 ターンの音声対話を処理する。
        STT 結果（transcript）を受け取り、RAG 検索 → LLM → 応答テキストを返す。
        """
        import boto3

        # RAG 検索
        rag_result = await self.rag_tool.execute(
            query=transcript, user_id=user_id, language=language
        )

        # コンテキスト構築
        context = ""
        if rag_result.get("results"):
            context = "\n\n".join(
                [r["content"] for r in rag_result["results"][:5]]
            )

        # LLM 呼び出し
        bedrock = boto3.client("bedrock-runtime", region_name=BEDROCK_REGION)

        messages = [
            {
                "role": "user",
                "content": [{"text": transcript}],
            }
        ]

        system_text = self.system_prompt
        if context:
            system_text += f"\n\nRelevant context from knowledge base:\n{context}"
        if rag_result.get("message"):
            system_text += f"\n\nNote: {rag_result['message']}"

        try:
            response = bedrock.converse(
                modelId=CLAUDE_MODEL_ID,
                messages=messages,
                system=[{"text": system_text}],
            )

            output = response.get("output", {})
            content = output.get("message", {}).get("content", [])
            if content and content[0].get("text"):
                return content[0]["text"]
            return "申し訳ございません。応答を生成できませんでした。"

        except Exception as e:
            logger.error(f"LLM invocation error: {e}")
            return "エラーが発生しました。もう一度お試しください。"


# AgentCore Runtime エントリポイント
agent = VoiceAgent()


async def handler(event: dict, context: Any) -> dict:
    """
    AgentCore Runtime ハンドラー。
    WebRTC セッションからの音声入力を処理する。
    """
    transcript = event.get("transcript", "")
    user_id = event.get("userId", "")
    language = event.get("language", "ja")

    if not transcript:
        return {"response": "", "error": "No transcript provided"}

    response_text = await agent.process_turn(
        transcript=transcript, user_id=user_id, language=language
    )

    return {
        "response": response_text,
        "language": language,
    }
