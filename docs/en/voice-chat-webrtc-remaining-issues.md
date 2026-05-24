# Voice Chat WebRTC (Phase 2) — Remaining Issues Checklist

**🌐 Language:** [日本語](../voice-chat-webrtc-remaining-issues.md) | **English**

**Created**: 2026-06  
**Status**: Implementation Complete / Deployment Verification Incomplete

---

## 🔴 Blockers (E2E Testing Not Possible)

- [ ] **AgentCore Runtime Voice Agent Not Deployed**
  - AgentCore Runtime is not supported by CloudFormation
  - Manual deployment via CLI/SDK required
  - Procedure: See `docs/deployment-troubleshooting.md` Section 19
  - Dependency: Pipecat Agent Docker image build

- [ ] **Pipecat Agent Docker Image Not Built/Pushed**
  - Build the image from `docker/pipecat-agent/` directory and push to ECR
  - Use `docker buildx build --provenance=false --sbom=false --platform linux/amd64 --push`
  - Prerequisite for AgentCore Runtime agent creation
  - **Required before production**: Authentication, rate limiting, CORS tightening, sanitized logging, input validation
    - Reference: [Pipecat AgentCore WebRTC KVS Example](https://github.com/pipecat-ai/pipecat-examples/tree/main/deployment/aws-agentcore-webrtc-kvs)

---

## 🟡 Pending Verification (To Be Done After AgentCore Runtime Deployment)

- [ ] **WebRTC E2E Flow Verification**
  - Browser → KVS Signaling → AgentCore Runtime → Pipecat → RAG → Voice Response
  - Prerequisite: AgentCore Runtime agent is running

- [ ] **KVS TURN Relay Verification**
  - TURN relay connection test in NAT/firewall environments
  - Testing in corporate network environments required

- [ ] **Fallback Mechanism Verification**
  - Confirm automatic fallback to REST-based (Phase 1) when WebRTC connection fails
  - Test method: Start voice chat with AgentCore Runtime stopped

- [ ] **Voice → Transcription → RAG Search → Voice Response Flow Verification**
  - End-to-end voice RAG pipeline
  - Confirm Permission Filter is correctly applied via voice path

---

## 🟢 Improvement Items (Functional but for Quality Enhancement)

- [ ] **Add Voice Metrics to CloudWatch Dashboard**
  - Add Voice Chat-related widgets to MonitoringConstruct
  - Metrics: WebRTC connection success rate, fallback occurrence rate, voice latency, session duration

- [ ] **Add useVoiceCapability Unit Tests**
  - Test that `canUseVoice` returns `true` in "prompt" state
  - Test that it returns `false` in "denied" state
  - Test fallback behavior when browser API is not supported

- [ ] **Add Comments to MessageInput.tsx**
  - Comment noting that VoiceButton is rendered directly in `genai/page.tsx`
  - Note that MessageInput is not currently used on the main page

- [ ] **Verify pre-deploy-setup.sh CodeBuild buildspec**
  - Confirm the fixed `docker buildx build --provenance=false --sbom=false --push` works correctly in CodeBuild environment
  - Confirm `docker buildx create --use` is available in CodeBuild Standard 7.0

---

## 📋 Fixed Items

- [x] **Docker Image OCI Format Issue** — Fixed to `docker buildx build --provenance=false --sbom=false --push`
- [x] **pre-deploy-setup.sh Local Build** — Apple Silicon section also fixed to buildx + provenance=false
- [x] **pre-deploy-setup.sh CodeBuild buildspec** — Changed from `DOCKER_BUILDKIT=0` + `docker build` to `docker buildx build --provenance=false --sbom=false --push`
- [x] **Manifest Verification Step Added** — Added step to verify `imageManifestMediaType` after push
- [x] **useVoiceCapability "prompt" State Bug** — Fixed "prompt" → `null` mapping, `canUseVoice` condition corrected
- [x] **VoiceButton Page Integration** — Rendered directly in `genai/page.tsx`
- [x] **CDK Image Tag Cache** — Documented explicit tag usage
- [x] **AgentCore Runtime CFn Limitation** — Removed from CDK template, documented CLI/SDK manual deployment procedure

---

## 🔗 Related Documents

- [Deployment Troubleshooting](deployment-troubleshooting.md) — Section 16-19
- [CHANGELOG](../CHANGELOG.md) — [4.2.0] Voice Chat Phase 2 section
- [README Implementation Overview](../README.md) — Row 18.1

## 🔗 External References

- [Pipecat AgentCore WebRTC KVS Example](https://github.com/pipecat-ai/pipecat-examples/tree/main/deployment/aws-agentcore-webrtc-kvs) — KVS managed TURN, production-readiness concerns (authentication, rate limiting, CORS, logging, input validation)
- [Deploy voice agents with Pipecat and Amazon Bedrock AgentCore Runtime – Part 1](https://aws.amazon.com/blogs/machine-learning/deploy-voice-agents-with-pipecat-and-amazon-bedrock-agentcore-runtime-part-1/) — WebSocket/WebRTC/telephony transport explanation
- [AWS Transfer Family + FSx for ONTAP S3 Access Points](https://docs.aws.amazon.com/transfer/latest/userguide/fsx-s3-access-points.html) — Prerequisites, limitations
