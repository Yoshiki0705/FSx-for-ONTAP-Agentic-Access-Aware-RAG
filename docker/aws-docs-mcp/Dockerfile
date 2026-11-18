# AWS Documentation MCP Server for AgentCore Runtime (MCP protocol, 0.0.0.0:8000/mcp).
# The server and every dependency are exact versions (requirements.txt). CDK builds this with
# AgentRuntimeArtifact.fromAsset and Platform.LINUX_ARM64.
FROM public.ecr.aws/docker/library/python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY serve.py .
RUN useradd --create-home --uid 1000 mcp
USER mcp
EXPOSE 8000
CMD ["python", "serve.py"]
