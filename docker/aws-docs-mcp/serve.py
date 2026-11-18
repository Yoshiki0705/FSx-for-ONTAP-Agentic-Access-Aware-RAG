"""AWS Documentation MCP Server on AgentCore Runtime (docs/mcp-external-tool-selection.md).

The package's own `main()` serves stdio. AgentCore Runtime with the MCP protocol expects a
Streamable HTTP server at 0.0.0.0:8000/mcp, so this serves the same server object that way,
stateless (the three tools need no session state). The tools, including the check that
URLs and redirects stay on docs.aws.amazon.com, are the package's, unchanged.
"""
import os

os.environ.setdefault("AWS_DOCUMENTATION_PARTITION", "aws")
os.environ.setdefault("FASTMCP_LOG_LEVEL", "WARNING")

from awslabs.aws_documentation_mcp_server.server_aws import mcp  # noqa: E402

if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="0.0.0.0", port=8000, stateless_http=True)
