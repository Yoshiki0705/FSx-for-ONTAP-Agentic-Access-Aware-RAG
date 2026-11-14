# Permission-aware RAG agent for Amazon Bedrock AgentCore Runtime.
# AgentCore Runtime runs arm64 containers that serve /invocations and /ping on port 8080;
# BedrockAgentCoreApp provides both. CDK builds this with AgentRuntimeArtifact.fromAsset
# and Platform.LINUX_ARM64.
FROM public.ecr.aws/docker/library/python:3.12-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py agents.py gateway_client.py ./

RUN useradd --create-home --uid 1000 agent
USER agent

EXPOSE 8080
CMD ["python", "app.py"]
