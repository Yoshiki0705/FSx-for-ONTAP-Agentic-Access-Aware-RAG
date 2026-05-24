# Voice Chat User Guide

**🌐 Language:** [日本語](../voice-chat-user-guide.md) | **English**

## Overview

The voice chat feature allows you to ask questions via microphone, with AI responding in both voice and text. It integrates with the existing RAG search pipeline (including permission filtering), delivering the same quality search results through voice as you would get with text input.

---

## Requirements

- Deployed with `enableVoiceChat=true`
- Browser supports microphone access (Chrome, Firefox, Safari, Edge)
- HTTPS connection (HTTPS is required for microphone access)

---

## How to Use

### Step 1: Find the Microphone Button

A 🎤 microphone button appears to the right of the chat input area.

> **If not visible**: Either deployed with `enableVoiceChat=false`, or your browser does not support microphone access.

### Step 2: Start Voice Input

1. Click the 🎤 microphone button
2. Browser requests microphone access permission → **Click "Allow"**
3. The microphone button changes to a red pulse animation (recording)
4. A waveform animation is displayed

### Step 3: Speak Your Question

Speak your question into the microphone. Examples:
- "Please summarize this document"
- "What are the key points of the sales report?"
- "Tell me about the security policy"

### Step 4: Stop Recording

Recording stops by any of the following:
- Click the 🎤 microphone button again
- 30 seconds of silence (auto-stop)
- Keyboard shortcut: `Ctrl+Shift+V` (Mac: `Cmd+Shift+V`)

### Step 5: Receive the Response

- **Text**: The response streams into the chat area
- **Voice**: The response plays through your speakers
- **Citation**: Source FSx file paths and access level badges are displayed

---

## Communication Modes

### REST Mode (Default)

- Operates with `voiceChatMode=rest`
- Communicates with Nova Sonic API via Lambda
- Moderate latency (buffering + batch processing)

### WebRTC Mode (Phase 2)

- Operates with `voiceChatMode=webrtc`
- Real-time bidirectional streaming via AgentCore Runtime
- Low latency (peer-to-peer UDP communication)
- Automatically falls back to REST mode if WebRTC connection fails

#### WebRTC Mode Connection Status Display

| Display | Meaning |
|---------|---------|
| "Establishing real-time connection..." | WebRTC connection in progress |
| "Connected in real-time mode" | WebRTC connection successful |
| "Continuing in standard mode" | Fell back to REST mode |
| "Connection quality degraded" | Packet loss >5% or RTT >500ms |

---

## Audio Playback Controls

The following controls appear during response audio playback:

- ⏸️ **Pause**: Pause audio playback (text display continues)
- ▶️ **Resume**: Resume audio playback
- 🔊 **Volume**: Adjust volume with slider
- ⏹️ **Stop**: Completely stop audio playback

> **Important**: Stopping audio playback does not stop text display.

---

## KB Mode / Agent Mode

Voice chat works in both modes:

| Mode | Behavior |
|------|----------|
| KB Mode | Voice question → Text conversion → Bedrock KB search → Response (text + voice) |
| Single Agent | Voice question → Text conversion → Selected Agent execution → Response (text + voice) |
| Multi-Agent | Voice question → Text conversion → Supervisor Agent → Response (text + voice) |

---

## Permission Filtering

Voice chat applies **the same permission filtering as text input**:

- Documents accessible only to administrators are answered only to administrators
- General users receive answers based on public documents only
- SID/UID/GID-based filtering is applied to voice search results as well

---

## Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Microphone button not visible | `enableVoiceChat=false` | Check CDK parameters |
| "Microphone access denied" | Microphone blocked in browser settings | Browser settings → Site settings → Change microphone to "Allow" |
| "Cannot connect to voice service" | WebSocket/WebRTC connection failure | Check network connection. You can continue with text input |
| "Could not recognize speech" | Speech unclear or silent | Speak again more clearly |
| "Cannot connect to real-time mode" | WebRTC connection timeout | Automatically continues in REST mode. Retry with "Reconnect" button |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+V` (Mac: `Cmd+Shift+V`) | Start/stop voice input |

---

## Supported Languages

Voice chat supports the following 8 languages:

- 🇯🇵 日本語
- 🇺🇸 English
- 🇰🇷 한국어
- 🇨🇳 简体中文
- 🇹🇼 繁體中文
- 🇫🇷 Français
- 🇩🇪 Deutsch
- 🇪🇸 Español

UI text (button labels, error messages, etc.) is displayed in the user's selected language. Speech recognition and synthesis also operate according to the selected language via Nova Sonic's multilingual support.

---

## Estimated Cost

- Input: Approximately $0.0019/min
- Output: Approximately $0.0076/min
- Estimated monthly: $70–$100 (typical usage)

---

## Technical Specifications

| Item | Value |
|------|-------|
| Audio input sample rate | 16kHz |
| Audio output sample rate | 24kHz |
| Channels | 1 (mono) |
| Chunk interval | 100ms |
| Silence timeout | 30 seconds |
| Auto-reconnect | Up to 3 times |
| WebRTC connection timeout | 15 seconds |
| Fallback threshold | 3 consecutive failures |

---

## Voice Data Handling Policy

### Data Storage and Retention

| Item | Handling |
|------|----------|
| Voice input data | **Not stored**. Streamed from browser, processed by Bedrock API, then discarded |
| Text transcription results | Retained as chat history (same treatment as text chat) |
| Voice output data | **Not stored**. Discarded after playback in browser |
| Session metadata | Recorded in CloudWatch Logs (user ID, timestamp, latency) |

### Privacy Notes

- Voice data is processed through the Amazon Bedrock API. It follows Bedrock's data processing policy
- Voice data is not used for model training (see [AWS Service Terms](https://aws.amazon.com/service-terms/))
- Voice input content is converted to text and then processed through the standard RAG pipeline (including SID filtering)
- In WebRTC mode (Phase 2), voice data passes through KVS Signaling Channel but is not persistently stored

### Regulatory Compliance Considerations

When using voice chat in healthcare, public sector, or financial sectors:

| Requirement | Recommended Action |
|-------------|-------------------|
| Voice recording prohibition | No recording by default. No additional configuration needed |
| Conversation content auditing | Text transcription results are recorded in CloudWatch Logs |
| PII in voice input | Guardrails PII detection is applied after text conversion |
| User notification | Recommend displaying "Voice is not stored" when voice chat starts |
| Opt-out | Feature can be disabled entirely with `enableVoiceChat=false` |

> **⚠️ Disclaimer**: This section is a technical implementation description and does not substitute for legal or regulatory judgment. Consult your organization's legal and compliance departments regarding regulatory requirements for voice data handling.
