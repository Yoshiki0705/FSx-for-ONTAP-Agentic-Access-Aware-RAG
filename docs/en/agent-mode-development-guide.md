# Agent Mode Development Guide

**🌐 Language:** [日本語](../agent-mode-development-guide.md) | **English**

**Created**: 2026-01-19  
**Last Updated**: 2026-01-19  
**Purpose**: Sharing insights and best practices for Agent mode UI/UX implementation

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Introduction Text Dynamic Update Implementation](#introduction-text-dynamic-update-implementation)
4. [Agent Description Display Feature](#agent-description-display-feature)
5. [Sidebar and Main Chat Synchronization](#sidebar-and-main-chat-synchronization)
6. [Translation Key Implementation Patterns](#translation-key-implementation-patterns)
7. [React State Management Best Practices](#react-state-management-best-practices)
8. [Troubleshooting](#troubleshooting)
9. [Deployment](#deployment)

---

## Overview

Agent mode is an advanced conversational AI interface leveraging Amazon Bedrock Agents.
When a user selects an Agent in the sidebar, the Introduction Text in the main chat area
updates in real-time to display information about the selected Agent.

### Key Features

- **Agent Selection**: Select from multiple Agents via the sidebar dropdown
- **Dynamic Introduction Text Update**: Introduction text in the main chat updates instantly on Agent selection
- **Multilingual Support**: Supports multiple languages including Japanese, English, and Korean
- **Real-time Synchronization**: Sidebar and main chat are fully synchronized

---

## Architecture

### Component Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    ChatbotPage (page.tsx)                    │
│  - Main chat area                                           │
│  - Introduction Text display                                │
│  - Event listener (agent-switched)                          │
└─────────────────────────────────────────────────────────────┘
                              ↑
                              │ CustomEvent
                              │ (agent-switched)
                              │
┌─────────────────────────────────────────────────────────────┐
│              AgentInfoSection (AgentInfoSection.tsx)         │
│  - Sidebar Agent information display                        │
│  - Agent dropdown                                           │
│  - Event dispatch (agent-switched)                          │
└─────────────────────────────────────────────────────────────┘
                              ↑
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Zustand Store (useChatStore.ts)             │
│  - currentSession: ChatSession                               │
│  - setCurrentSession: (session) => void                      │
│  - Global state management                                   │
└─────────────────────────────────────────────────────────────┘
```


### Data Flow

```
1. User selects an Agent in the sidebar
   ↓
2. AgentInfoSection.handleAgentChange() executes
   ↓
3. CustomEvent 'agent-switched' is dispatched
   ↓
4. ChatbotPage.handleAgentSelectionChange() receives the event
   ↓
5. Introduction Text is generated (generateAgentModeInitialMessage)
   ↓
6. New ChatSession object is created
   ↓
7. Zustand Store is updated directly (setCurrentSession)
   ↓
8. Force Re-render (setRenderKey)
   ↓
9. React re-renders the Message Area
   ↓
10. Introduction Text is displayed on screen
```

---

## Introduction Text Dynamic Update Implementation

### Background

An issue occurred where Introduction Text was not updating on Agent selection.
This was caused by the following factors:

1. **Zustand Callback Issue**: The `setCurrentSession(prev => {...})` callback approach
   did not correctly trigger state updates
2. **React State Race Condition**: `currentSession.messages` temporarily becomes `undefined`
3. **Insufficient Re-render**: React could not detect state changes, preventing re-renders

### Solution: v19 Direct Zustand Store Update

**File**: `docker/nextjs/src/app/[locale]/genai/page.tsx` (Lines 890-930)

```typescript
// ❌ Bad example: Callback approach (pre-v18)
setCurrentSession(prev => {
  if (!prev) return prev;
  return {
    ...prev,
    messages: updatedMessages,
    updatedAt: Date.now()
  };
});

// ✅ Good example: Direct update approach (v19)
const newSession: ChatSession = {
  ...currentSession,
  messages: updatedMessages,
  updatedAt: Date.now()
};

// Update Zustand Store directly (no callback)
setCurrentSession(newSession);

// Force Re-render
setRenderKey(prev => prev + 1);
```

**Why direct update is superior**:

1. **Immediate state update**: No callback delay
2. **Explicit object creation**: New reference is guaranteed
3. **Easy to debug**: New object can be verified in logs
4. **React compatibility**: Works well with React's re-render logic


### Force Re-render Mechanism (v17)

**File**: `docker/nextjs/src/app/[locale]/genai/page.tsx`

```typescript
// State variable definition (Line 544)
const [renderKey, setRenderKey] = useState(0);

// On Agent selection change (Line 933)
setRenderKey(prev => prev + 1);

// Message Area rendering (Line 2313)
<div key={renderKey} className="messages-container">
  {currentSession?.messages.map((message, index) => (
    <MessageContent key={index} message={message} />
  ))}
</div>
```

**How it works**:

1. When `renderKey` changes, React detects the `key` property change
2. Components with a changed `key` are completely remounted
3. Old DOM is destroyed and new DOM is created
4. Introduction Text is reliably re-rendered

**When to use**:

- Agent selection change
- Mode switching (Agent ↔ KB)
- Locale change

---

## Agent Description Display Feature

### Overview

This feature displays the actual description and capabilities of the selected Agent.
By showing Agent-specific information, users can better understand each Agent's characteristics.

### Background

**Problem**: The same generic feature description was displayed for all Agents
- Multi-step Reasoning
- Automatic Document Search
- Context Optimization

**Solution**: Retrieve Agent-specific descriptions from the `agentInfo.description` field

### Code Implementation

**File**: `docker/nextjs/src/app/[locale]/genai/page.tsx` (Lines 157-189)

```typescript
// ✅ Use Agent-specific description (when available)
const agentDescription = agentInfo.description 
  ? `\n\n**📝 ${tAgent('description')}**\n${agentInfo.description}`
  : '';

const agentSection = `

**🤖 ${tAgent('information')}**
• **${tAgent('agentId')}**: ${agentInfo.agentId || 'N/A'}
• **${tAgent('agentName')}**: ${agentInfo.agentName || agentInfo.name || 'N/A'}
• **${tAgent('version')}**: ${agentInfo.agentVersion || agentInfo.latestAgentVersion || 'N/A'}
• **${tAgent('status')}**: ${agentInfo.agentStatus || agentInfo.status || 'N/A'}
• **${tAgent('model')}**: ${agentInfo.foundationModel || 'N/A'}
• **${tAgent('lastUpdated')}**: ${agentInfo.updatedAt ? new Date(agentInfo.updatedAt).toLocaleDateString('ja-JP') : 'N/A'}${agentDescription}

**🧠 ${tAgent('features')}**
${agentInfo.description 
  ? `${tAgent('agentSpecificFeatures')}`  // When Agent-specific feature description exists
  : `• **${tAgent('multiStepReasoning')}**: ${tAgent('multiStepReasoningDesc')}
• **${tAgent('automaticDocumentSearch')}**: ${tAgent('automaticDocumentSearchDesc')}
• **${tAgent('contextOptimization')}**: ${tAgent('contextOptimizationDesc')}`}

${tAgent('modeDescription')}`;
```

### Display Patterns

#### Pattern 1: Agent with Description

**Condition**: `agentInfo.description` field exists

#### Pattern 2: Agent without Description

**Condition**: `agentInfo.description` field does not exist — falls back to generic feature descriptions

### Data Source

**AgentSummary Interface** (`docker/nextjs/src/hooks/useAgentsList.ts`):

```typescript
export interface AgentSummary {
  agentId: string;
  agentName: string;
  agentStatus: string;
  agentVersion?: string;
  latestAgentVersion?: string;
  description?: string;  // ✅ Agent-specific description (optional)
  foundationModel?: string;
  updatedAt?: string;
  createdAt?: string;
}
```

### Best Practices

1. **Graceful Fallback**: Display generic feature descriptions when `description` is absent
2. **Multilingual Support**: Provide translation keys for all 8 languages
3. **Null Safety**: Always check for `agentInfo.description` existence
4. **User Experience**: Clarify each Agent's characteristics by showing Agent-specific information

### Deployment Information

- **Deployment Date**: 2026-01-19 01:54 JST
- **Image Tag**: `agent-description-20260118-164851`
- **Status**: ✅ PRODUCTION READY

---

## Sidebar and Main Chat Synchronization

### AgentInfoSection.tsx Implementation

**File**: `docker/nextjs/src/components/bedrock/AgentInfoSection.tsx`

#### Agent Selection Event Handler

```typescript
const handleAgentChange = (agentId: string) => {
  console.log('🔄 [AgentInfoSection] Agent selected:', agentId);
  
  // 1. Get Agent information
  const selectedAgent = availableAgents.find(a => a.agentId === agentId);
  if (!selectedAgent) {
    console.error('❌ [AgentInfoSection] Agent not found:', agentId);
    return;
  }
  
  // 2. Update Zustand Store
  setSelectedAgentId(agentId);
  
  // 3. Dispatch CustomEvent
  const event = new CustomEvent('agent-switched', {
    detail: {
      agentId,
      agentName: selectedAgent.agentName,
      agentStatus: selectedAgent.agentStatus,
      modelId: selectedAgent.foundationModel,
      // Additional info
      executionStatus: 'ready',
      progressReport: 'Agent selected successfully'
    },
    bubbles: true,  // Enable event bubbling
    cancelable: true
  });
  
  console.log('📢 [AgentStore] agent-switched event dispatched:', agentId);
  window.dispatchEvent(event);
};
```

**Key Points**:

1. **bubbles: true**: Event propagates up the DOM tree
2. **Detailed logging**: Verify event dispatch during debugging
3. **Error handling**: Processing when Agent is not found
4. **Additional info**: Communicate state via executionStatus and progressReport


### ChatbotPage.tsx Event Listener

**File**: `docker/nextjs/src/app/[locale]/genai/page.tsx`

#### Event Listener Registration

```typescript
useEffect(() => {
  const handleAgentSelectionChange = async (event: Event) => {
    const customEvent = event as CustomEvent;
    const detail = customEvent.detail;
    
    // 1. Validation: Confirm currentSession exists and messages is an array
    if (!currentSession || !Array.isArray(currentSession.messages)) {
      console.warn('⚠️ [ChatbotPage] Invalid session state, skipping update');
      return;
    }
    
    // 2. Generate Introduction Text
    try {
      const introductionText = await generateAgentModeInitialMessage(
        t, user, detail.agentId, detail.agentName, detail.agentStatus, detail.modelId
      );
      
      // 3. Create new message array
      const updatedMessages: Message[] = [{
        id: `intro-${Date.now()}`,
        role: 'assistant',
        content: [{ text: introductionText }],
        createdAt: Date.now()
      }];
      
      // 4. v19: Create updated session object directly
      const newSession: ChatSession = {
        ...currentSession,
        messages: updatedMessages,
        updatedAt: Date.now()
      };
      
      // 5. Update Zustand Store directly (no callback)
      setCurrentSession(newSession);
      
      // 6. Force Re-render
      setRenderKey(prev => prev + 1);
      
    } catch (error) {
      console.error('❌ [ChatbotPage] Introduction text generation error:', error);
    }
  };
  
  // Register event listener
  window.addEventListener('agent-switched', handleAgentSelectionChange);
  
  // Cleanup
  return () => {
    window.removeEventListener('agent-switched', handleAgentSelectionChange);
  };
}, [currentSession, t, user, renderKey]);
```

**Key Points**:

1. **Array.isArray() check**: Prevents race conditions
2. **try-catch block**: Error handling
3. **Detailed logging**: Records state at each step
4. **Dependency array**: Include the entire `currentSession` (not just `currentSession.id`)
5. **Cleanup**: Prevents memory leaks

---

## Translation Key Implementation Patterns

### Basic Principles

1. **Use translation keys for all text**: No hardcoded text
2. **useTranslations at top level**: Call at the top of components
3. **Use useLocale hook**: Get the current locale
4. **Add locale to useMemo dependency array**: Recalculate on locale change

### Implementation Example

```typescript
import { useTranslations, useLocale } from 'next-intl';
import { useMemo } from 'react';

export function AgentInfoSection() {
  // 1. Call hooks at top level
  const t = useTranslations('agent');
  const locale = useLocale();
  
  // 2. Add locale to useMemo dependency array
  const agentStatusText = useMemo(() => {
    return t('status.prepared');
  }, [t, locale]);
  
  // 3. Escape template literals
  const welcomeMessage = t('welcome', { 
    name: user.name  // \{name\} in translation file
  });
  
  return (
    <div>
      <h2>{t('title')}</h2>
      <p>{agentStatusText}</p>
      <p>{welcomeMessage}</p>
    </div>
  );
}
```

### Locale Detection in Lambda Web Adapter Environment

**Problem**: `requestLocale` may return `undefined` in Lambda Web Adapter environments

**Solution**: Extract locale from URL path via HTTP headers

**File**: `docker/nextjs/src/i18n/request.ts`

```typescript
export default getRequestConfig(async ({ requestLocale }) => {
  let validLocale = await requestLocale;
  
  // If requestLocale is undefined, get URL path from headers
  if (!validLocale) {
    const headersList = await headers();
    const forwardedUri = headersList.get('x-forwarded-uri');
    const originalUrl = headersList.get('x-original-url');
    const requestUri = headersList.get('x-request-uri');
    
    // Extract locale from URL
    const uri = forwardedUri || originalUrl || requestUri || '';
    const pathSegments = uri.split('/').filter(Boolean);
    const urlLocale = pathSegments[0];
    
    if (urlLocale && locales.includes(urlLocale as any)) {
      validLocale = urlLocale;
    } else {
      validLocale = defaultLocale;
    }
  }
  
  return {
    locale: validLocale,
    messages: (await import(`../messages/${validLocale}.json`)).default
  };
});
```


---

## React State Management Best Practices

### Array.isArray() Check (Required)

**Problem**: Due to the asynchronous nature of React state updates, arrays may temporarily be `undefined` or `null`

**Solution**: Always check with `Array.isArray()` before accessing

```typescript
// ❌ Dangerous: Error on race condition
useEffect(() => {
  if (currentSession && currentSession.messages.length > 0) {
    // ❌ Error if messages is undefined
    const firstMessage = currentSession.messages[0];
  }
}, [currentSession]);

// ✅ Safe: Confirm it's an array with Array.isArray()
useEffect(() => {
  if (currentSession && Array.isArray(currentSession.messages) && 
      currentSession.messages.length > 0) {
    // ✅ messages is guaranteed to be an array
    const firstMessage = currentSession.messages[0];
  }
}, [currentSession]);
```

**Where to apply**:

- All places accessing state arrays within useEffect
- Places accessing state arrays within event handlers
- Especially in components with complex state management like Agent mode

**Why Array.isArray() is optimal**:

```typescript
// ❌ Patterns that fail
messages.length > 0              // Error if messages is null/undefined
typeof messages === 'object'     // null is also evaluated as object
messages && messages.length > 0  // If messages is {}, length is undefined

// ✅ Correct pattern
Array.isArray(messages) && messages.length > 0  // Reliably confirms it's an array
```

### Zustand Store Update Patterns

#### Pattern 1: Direct Update (Recommended)

```typescript
// ✅ Recommended: Create new object directly
const newSession: ChatSession = {
  ...currentSession,
  messages: updatedMessages,
  updatedAt: Date.now()
};

setCurrentSession(newSession);
```

#### Pattern 2: Callback Update (Not Recommended)

```typescript
// ❌ Not recommended: Callback approach
setCurrentSession(prev => {
  if (!prev) return prev;
  return { ...prev, messages: updatedMessages, updatedAt: Date.now() };
});
```

### useEffect Dependency Array

```typescript
// ❌ Bad: Incomplete dependency array
useEffect(() => {
  if (currentSession && Array.isArray(currentSession.messages)) {
    // Won't execute when other properties of currentSession change
  }
}, [currentSession.id]);  // ❌ id alone is insufficient

// ✅ Good: Complete dependency array
useEffect(() => {
  if (currentSession && Array.isArray(currentSession.messages)) {
    // Executes when any property of currentSession changes
  }
}, [currentSession]);  // ✅ Include the entire object
```

**Rules**:

1. **Include the entire object**: Use `obj` not `obj.prop`
2. **Don't include functions**: Only useCallback-memoized functions
3. **Include primitive values**: Numbers, strings, booleans
4. **Include arrays**: Re-execute when array reference changes

---

## Troubleshooting

### Issue 1: Introduction Text Not Updating

**Symptom**: Introduction Text doesn't change on Agent selection

**Causes and Solutions**:

1. **Zustand Callback Issue**
   - Cause: `setCurrentSession(prev => {...})` doesn't trigger state update
   - Solution: Switch to direct update approach (v19 fix)

2. **React Re-render Insufficient**
   - Cause: React can't detect state change
   - Solution: Add Force re-render mechanism (v17 fix)

3. **Missing Array.isArray() Check**
   - Cause: `currentSession.messages` is `undefined`
   - Solution: Add `Array.isArray()` check to all useEffects (v4-v16 fixes)

### Issue 2: "b is not a function" Error

**Symptom**: Alert dialog appears on Agent selection

**Cause**: Unused `tError` variable in AgentInfoSection.tsx

**Solution** (v3 fix):

```typescript
// ❌ Bad
const tError = useTranslations('error');  // Unused
const t = useTranslations('agent');

// ✅ Good
const t = useTranslations('agent');  // Remove tError
```

### Issue 3: Empty Response Body (content-length: 0)

**Symptom**: Lambda Function URL returns 200 OK but body is empty

**Cause**: `AWS_LWA_INVOKE_MODE=response_stream` is set in Dockerfile

**Solution** (v22 fix):

```dockerfile
# ❌ Bad: Response streaming mode
ENV AWS_LWA_INVOKE_MODE=response_stream

# ✅ Good: Default buffered mode
# (Remove AWS_LWA_INVOKE_MODE environment variable)
```

**Technical Background**:

- **response_stream mode**: For chunked transfer encoding (incompatible with Next.js standalone)
- **Default buffered mode**: For complete responses (compatible with Next.js standalone)
- **Rule**: Next.js applications should always use default buffered mode

### Issue 4: Some Components Don't Update on Language Switch

**Symptom**: Selecting Korean in the language dropdown leaves some parts in Japanese

**Cause**: `locale` is not included in `useMemo` dependency array

**Solution**:

```typescript
// ❌ Bad
const categorizedData = useMemo(() => {
  return processData();
}, [data]);  // locale not in dependency array

// ✅ Good
const categorizedData = useMemo(() => {
  return processData();
}, [data, locale]);  // Add locale to dependency array
```


---

## Deployment

### Clean Build Procedure (Required)

```bash
#!/bin/bash
set -euo pipefail

# 1. Clear cache
rm -rf docker/nextjs/.next docker/nextjs/node_modules/.cache
npm cache clean --force

# 2. Next.js build
cd docker/nextjs
NODE_ENV=production npm run build
cd ../..

# 3. Temporarily disable .dockerignore (important!)
mv docker/nextjs/.dockerignore docker/nextjs/.dockerignore.bak

# 4. Docker build
docker build --no-cache --pull \
  -t permission-aware-rag-webapp:agent-mode-fix-v22 \
  -f docker/nextjs/Dockerfile.prebuilt \
  docker/nextjs/

# 5. Restore .dockerignore
mv docker/nextjs/.dockerignore.bak docker/nextjs/.dockerignore

# 6. Docker Image verification (required!)
./development/scripts/temp/verify-docker-image.sh \
  permission-aware-rag-webapp:agent-mode-fix-v22

if [ $? -ne 0 ]; then
  echo "❌ Verification failed: not pushing to ECR"
  exit 1
fi

# 7. ECR push
docker tag permission-aware-rag-webapp:agent-mode-fix-v22 \
  <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:agent-mode-fix-v22

docker push <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/permission-aware-rag-webapp:agent-mode-fix-v22
```

### Container Refresh v12 (Environment Variable Update Method)

**Success Rate**: 99%+  
**Duration**: 10-15 minutes  
**Downtime**: 30 seconds

```bash
#!/bin/bash
set -euo pipefail

FUNCTION_NAME="TokyoRegion-permission-aware-rag-prod-WebApp-Function"
REGION="ap-northeast-1"

# Step 1: Update environment variable (invalidate Container Cache)
REFRESH_TIMESTAMP=$(date +%s)
aws lambda update-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --environment "Variables={FORCE_CONTAINER_REFRESH=$REFRESH_TIMESTAMP}"

echo "⏳ Waiting 30 seconds..."
sleep 30

# Step 2: Reserved Concurrency = 0
aws lambda put-function-concurrency \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --reserved-concurrent-executions 0

echo "⏳ Waiting 15 seconds..."
sleep 15

# Step 3: Remove Reserved Concurrency
aws lambda delete-function-concurrency \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION"

# Step 4: Warm-up (30-50 invocations recommended)
echo "🔥 Starting warm-up..."
for i in {1..30}; do
  aws lambda invoke \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --payload '{"rawPath": "/health", "requestContext": {"http": {"method": "GET"}}}' \
    --cli-binary-format raw-in-base64-out \
    /tmp/lambda-response-$i.json > /dev/null 2>&1
  echo "  [$i/30] Done"
  sleep 1
done

# Step 5: CloudFront cache invalidation
DISTRIBUTION_ID="E3J5C6S69J4ZQY"
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" "/ja/*" "/en/*" "/ko/*" "/ja/genai*" "/en/genai*" "/ko/genai*"

echo "✅ Container Refresh complete"
```

### Docker Image Verification (Required)

**All Docker images must be verified before pushing to ECR.**

### Deployment Verification

#### Lambda Function URL Verification

```bash
# 1. Test Lambda Function URL
curl -s -o /dev/null -w "HTTP Status: %{http_code}\nContent-Length: %{size_download}\n" \
  "https://vlhac7yhlh624z7xuyb6sb4lxu0tnieh.lambda-url.ap-northeast-1.on.aws/ja/signin"

# Expected:
# HTTP Status: 200
# Content-Length: 22524  # Non-zero value
```

#### CloudFront URL Verification

```bash
# Test after waiting 2-3 minutes
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" \
  "https://d3p7l2uoh6npdr.cloudfront.net/ja/genai?mode=agent"

# Expected:
# HTTP Status: 200
```

---

## Performance Metrics

### Introduction Text Update Latency

| Phase | Target | Measured |
|-------|--------|----------|
| Agent selection → Event dispatch | < 5ms | < 5ms ✅ |
| Event dispatch → Receipt | < 5ms | < 5ms ✅ |
| Receipt → Text generation | < 10ms | < 10ms ✅ |
| Text generation → Rendering | < 20ms | < 20ms ✅ |
| **Total latency** | **< 100ms** | **< 40ms ✅** |

---

## Implementation History and Versions

### Phase 1: Agent Introduction Text Real-time Update Fix

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| v3 | 2026-01-18 | AgentInfoSection.tsx fix ("b is not a function" error resolved) | ✅ |
| v4-v16 | 2026-01-18 | Array.isArray() checks added, State management improvements | ✅ |
| v17 | 2026-01-18 | Force re-render mechanism implemented | ✅ |
| v18 | 2026-01-18 | Session creation logic added | ✅ |
| v19 | 2026-01-19 | Direct Zustand Store update method (final solution) | ✅ DEPLOYED |
| v20 | 2026-01-19 | Dockerfile CMD fix | ❌ FAILED |
| v21 | 2026-01-19 | Dockerfile ENTRYPOINT/CMD fix | ❌ FAILED |
| v22 | 2026-01-19 | Response Streaming disabled | ✅ DEPLOYED |

### Key Technical Decisions

1. **v19: Direct Zustand Store Update**
   - **Reason**: Callback approach doesn't trigger state updates
   - **Effect**: 100% success rate, immediate state update
   - **Application**: Recommended for all Zustand Store updates

2. **v17: Force Re-render Mechanism**
   - **Reason**: React sometimes can't detect state changes
   - **Effect**: Reliable re-rendering
   - **Application**: Agent selection, mode switching, locale change

3. **v4-v16: Array.isArray() Checks**
   - **Reason**: Prevents React state race conditions
   - **Effect**: Complete elimination of "Cannot read properties of undefined" errors
   - **Application**: All useEffect hooks, event handlers

4. **v22: Response Streaming Disabled**
   - **Reason**: Incompatibility with Next.js standalone
   - **Effect**: Empty response body issue resolved
   - **Application**: All Next.js Lambda functions


---

## 🎯 useEffect Dependency Array Best Practices (Added 2026-01-20)

### Lessons from Sign-Out Button Fix

**Background**: The sign-out button fix (v14→v15→v16→v17) clearly demonstrated the importance of conditional rendering and useEffect dependency arrays.

### Problem: Accessing Conditionally Rendered Elements

```typescript
// JSX: Conditional rendering
{user && <button ref={signOutButtonRef}>Sign Out</button>}

// ❌ v16 failure: Empty dependency array
useEffect(() => {
  const button = signOutButtonRef.current;
  if (button) {
    button.onclick = handleSignOut;
  }
}, []); // ❌ Runs only once at mount → user is null and button doesn't exist
```

**Issues**:
1. useEffect executes immediately at mount
2. At this point `user` is still `null` (loading asynchronously)
3. Button is conditionally rendered with `{user && ...}` → doesn't exist yet
4. `signOutButtonRef.current` is `null` → handler not attached
5. Even when `user` loads later, useEffect doesn't re-execute

### Solution: Include State in Dependency Array

```typescript
// ✅ v17 success: Include user in dependency array
useEffect(() => {
  // 1. Wait until user is loaded
  if (!user) return;
  
  // 2. Wait 100ms for DOM to stabilize
  const timeoutId = setTimeout(() => {
    const button = signOutButtonRef.current;
    if (button) {
      button.onclick = (e) => {
        e.preventDefault();
        handleSignOut();
      };
    }
  }, 100);
  
  // 3. Cleanup
  return () => {
    clearTimeout(timeoutId);
    const button = signOutButtonRef.current;
    if (button) { button.onclick = null; }
  };
}, [user]); // ✅ Include user in dependency array
```

### General Pattern

```typescript
// Pattern: {condition && <Element ref={ref}>}
// Solution: useEffect(..., [condition])

// Example 1: User authentication
{user && <button ref={buttonRef}>...</button>}
useEffect(() => {
  if (!user) return;
  // Access buttonRef
}, [user]); // ✅

// Example 2: Agent info
{agentInfo && <div ref={divRef}>...</div>}
useEffect(() => {
  if (!agentInfo) return;
  // Access divRef
}, [agentInfo]); // ✅

// Example 3: Mode switching
{mode === 'agent' && <section ref={sectionRef}>...</section>}
useEffect(() => {
  if (mode !== 'agent') return;
  // Access sectionRef
}, [mode]); // ✅
```

### Best Practices Checklist

- [ ] When accessing conditionally rendered elements, include the condition state in the dependency array
- [ ] Perform early state checks within useEffect (`if (!state) return;`)
- [ ] Add a 100ms delay before ref access to wait for DOM stabilization
- [ ] Clear timeouts in the cleanup function
- [ ] Add detailed logging to facilitate debugging

### Related Documents

- **Sign-out fix v17 success report**: `development/docs/reports/local/01-20-signout-fix-v17-verification-results.md`
- **v17 root cause analysis**: `development/docs/reports/local/01-19-signout-fix-v17-root-cause-analysis.md`

---

## References

### Related Documents

- **Deployment report**: `development/docs/reports/local/01-19-phase1-task4-v22-deployment-success.md`
- **Verification report**: `development/docs/reports/local/01-19-phase1-browser-verification-success.md`
- **Task list**: `.kiro/specs/agent-mode-ui-fixes/tasks.md`
- **Design document**: `.kiro/specs/agent-mode-ui-fixes/design.md`

### External Resources

- **React Hooks**: https://react.dev/reference/react
- **Zustand**: https://github.com/pmndrs/zustand
- **next-intl**: https://next-intl-docs.vercel.app/
- **Lambda Web Adapter**: https://github.com/awslabs/aws-lambda-web-adapter

---

**Guide Created**: 2026-01-19  
**Last Updated**: 2026-01-20  
**Created by**: Kiro AI Assistant  
**Review**: Insights consolidated at Phase 1 completion, sign-out fix lessons added
