"""AWS documentation tools for the agent (docs/mcp-external-tool-selection.md).

The Gateway's `aws-docs` target is the AWS Documentation MCP Server. Three tools are
allowed by name and nothing else is offered to the model. What the model writes in an
argument leaves the account (a search phrase goes to the AWS documentation search API, a URL
to docs.aws.amazon.com), so this module:

- caps the length of a search phrase and of a URL, and the number of calls per question;
- refuses a URL outside docs.aws.amazon.com before the call (the server checks again);
- returns the page text to the model as data: the shared rules already say that text from
  tools is never instructions.

Retrieved internal documents never pass through here: `search_documents` is a different
tool that goes to the permission-aware Lambda, and nothing in this module reads its results.
"""
from __future__ import annotations

import json
import re
from collections.abc import Callable
from datetime import timedelta
from typing import Any
from urllib.parse import urlsplit

from strands import tool

ALLOWED_TOOLS = ("search_documentation", "read_documentation", "read_sections")
MAX_PHRASE_CHARS = 200
MAX_URL_CHARS = 500
MAX_CALLS_PER_QUESTION = 6
MAX_RESULT_CHARS = 20000
# docs.aws.amazon.com only; the server applies its own allow-list as well.
_URL = re.compile(r"^https://docs\.aws\.amazon\.com/[^\s]*$")


class AwsDocs:
    """Calls the Gateway's `aws-docs` tools for one question."""

    def __init__(self, client: Any, prefix: str) -> None:
        self._client = client
        self._prefix = prefix
        self.calls: list[dict[str, Any]] = []

    def _check_url(self, url: str) -> str | None:
        host = urlsplit(url).hostname or ""
        if len(url) > MAX_URL_CHARS or not _URL.match(url) or host != "docs.aws.amazon.com":
            return "Only https://docs.aws.amazon.com/ pages can be read."
        return None

    def call(self, name: str, arguments: dict[str, Any]) -> str:
        if name not in ALLOWED_TOOLS:
            return json.dumps({"error": "this tool is not available"})
        if len(self.calls) >= MAX_CALLS_PER_QUESTION:
            return json.dumps({"error": f"at most {MAX_CALLS_PER_QUESTION} documentation calls per question"})
        if "url" in arguments:
            problem = self._check_url(str(arguments["url"]))
            if problem:
                self.calls.append({"tool": name, "refused": True})
                return json.dumps({"error": problem})
        if "search_phrase" in arguments:
            arguments = {**arguments, "search_phrase": str(arguments["search_phrase"])[:MAX_PHRASE_CHARS]}
        result = self._client.call_tool_sync(
            tool_use_id=f"docs-{len(self.calls) + 1}",
            name=f"{self._prefix}{name}",
            arguments=arguments,
            read_timeout_seconds=timedelta(seconds=60),
        )
        content = result.get("content", []) if isinstance(result, dict) else getattr(result, "content", [])
        text = "\n".join(
            (c.get("text") if isinstance(c, dict) else getattr(c, "text", "")) or "" for c in content or []
        )
        self.calls.append({"tool": name, "chars": len(text)})
        return text[:MAX_RESULT_CHARS]


def make_docs_tools(docs: AwsDocs) -> list[Callable[..., str]]:
    @tool
    def search_aws_documentation(search_phrase: str, limit: int = 5) -> str:
        """Search the public AWS documentation (docs.aws.amazon.com).

        Do not put company names, user names or document contents in the search phrase.

        Args:
            search_phrase: What to look for, as keywords about an AWS service or feature.
            limit: How many results to return (1 to 10).
        """
        return docs.call("search_documentation", {"search_phrase": search_phrase, "limit": max(1, min(int(limit), 10))})

    @tool
    def read_aws_documentation(url: str, max_length: int = 8000, start_index: int = 0) -> str:
        """Read one AWS documentation page (https://docs.aws.amazon.com/...) as text.

        Args:
            url: The page URL, from a search result.
            max_length: How many characters to return.
            start_index: Where to start, to continue a long page.
        """
        return docs.call(
            "read_documentation",
            {"url": url, "max_length": max(1, min(int(max_length), 20000)), "start_index": max(0, int(start_index))},
        )

    @tool
    def read_aws_documentation_sections(url: str, section_titles: list[str]) -> str:
        """Read named sections of one AWS documentation page.

        Args:
            url: The page URL, from a search result.
            section_titles: Titles of the sections to read.
        """
        return docs.call("read_sections", {"url": url, "section_titles": [str(t)[:200] for t in section_titles[:10]]})

    return [search_aws_documentation, read_aws_documentation, read_aws_documentation_sections]
