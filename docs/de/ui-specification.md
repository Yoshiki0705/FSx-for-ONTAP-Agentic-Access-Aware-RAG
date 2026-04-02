# Chatbot UI-Spezifikation

**🌐 Language:** [日本語](../ui-specification.md) | [English](../en/ui-specification.md) | [한국어](../ko/ui-specification.md) | [简体中文](../zh-CN/ui-specification.md) | [繁體中文](../zh-TW/ui-specification.md) | [Français](../fr/ui-specification.md) | **Deutsch** | [Español](../es/ui-specification.md)

**Created**: 2026-03-26  
**Audience**: Developers & Operators  
**Application**: Permission-aware RAG Chatbot

---

## Überblick

Dieses Dokument beschreibt die Spezifikationen jedes UI-Elements des RAG-Chatbots und seine Integration mit dem Backend.

---

## 1. Sidebar — User Information Section

### Display Content

| Item | Data Source | Description |
|------|------------|-------------|
| Username | Cognito JWT | Email address at sign-in |
| Role | Cognito JWT | `admin` or `user` |

### Access Permission Display

| Item | Data Source | Description |
|------|------------|-------------|
| Directory | `/api/fsx/directories` | SID-based accessible directories |
| Read | Same as above | `✅` if SID data exists |
| Write | Same as above | `✅` only if user has Domain Admins SID |

### How Accessible Directories Work

The Introduction Message displays three types of directory information.

| Item | Icon | Data Source | Description |
|------|------|------------|-------------|
| FSx Accessible Directories | 📁 | DynamoDB SID → SID_DIRECTORY_MAP | Directories accessible at the file level on FSx ONTAP |
| RAG Searchable Directories | 🔍 | SID matching in S3 `.metadata.json` | Directories of documents matching SID in KB search |
| Embedding Target Directories | 📚 | All `.metadata.json` in S3 bucket | All directories indexed in KB |

#### Display Examples by User

| User | FSx Access | RAG Search | Embedding Target |
|------|-----------|---------|----------------|
| admin@example.com | `public/`, `confidential/`, `restricted/` | `public/`, `confidential/`, `restricted/` | `public/`, `confidential/`, `restricted/` (displayed) |
| user@example.com | `public/` | `public/` | Hidden (hides the existence of inaccessible directories for security) |

Embedding Target Directories are not displayed to general users (to avoid revealing the existence of directories they cannot access). The 📚 Embedding Target Directories are only displayed when the RAG Searchable Directories and Embedding Target Directories are identical, as is the case for administrators.

#### Data Retrieval Flow

```
/api/fsx/directories?username={email}
  ↓
1. DynamoDB user-access → Retrieve user SID
  ↓
2. FSx directories: SID → Calculated via SID_DIRECTORY_MAP
  ↓
3. RAG/Embedding directories: Scan .metadata.json in S3 bucket
   - Match allowed_group_sids of each file against user SID
   - Match → RAG accessible
   - All directories → Embedding target
  ↓
4. Return three types of directory information
```

#### SID to Directory Mapping

| SID | Name | Accessible Directories |
|-----|------|----------------------|
| `S-1-1-0` | Everyone | `public/` |
| `S-1-5-21-...-512` | Domain Admins | `confidential/`, `restricted/` |
| `S-1-5-21-...-1100` | Engineering | `restricted/` |

#### Display Examples by User

| User | Owned SIDs | Displayed Directories |
|------|-----------|----------------------|
| admin@example.com | Everyone + Domain Admins | `public/`, `confidential/`, `restricted/` |
| user@example.com | Everyone only | `public/` |

#### Environment Type Display

| directoryType | Display | Condition |
|--------------|---------|-----------|
| `sid-based` | 🔐 SID-based access permissions | Successfully retrieved from DynamoDB SID data |
| `actual` | 🟢 FSx for ONTAP production environment | Retrieved directly from FSx API (future support) |
| `fallback` | ⚠️ Simulation environment | DynamoDB error |
| `no-table` | ⚠️ Simulation environment | USER_ACCESS_TABLE_NAME not set |

### Adding a New Directory

1. Upload documents and `.metadata.json` to S3
2. Set appropriate SIDs in `allowed_group_sids` of `.metadata.json`
3. Sync the Bedrock KB data source
4. Add mapping to `SID_DIRECTORY_MAP` in `/api/fsx/directories`

```typescript
// docker/nextjs/src/app/api/fsx/directories/route.ts
const SID_DIRECTORY_MAP: Record<string, string[]> = {
  'S-1-1-0': ['public/'],
  'S-1-5-21-...-512': ['confidential/', 'restricted/'],
  'S-1-5-21-...-1100': ['restricted/'],
  // Add a new directory:
  'S-1-5-21-...-1200': ['engineering-docs/'],
};
```

---

## 2. Sidebar — Bedrock Region Section

### Display Content

| Item | Data Source | Description |
|------|------------|-------------|
| Region Name | `RegionConfigManager` | Display name of the selected region |
| Region ID | `regionStore` | e.g., `ap-northeast-1` |
| Model Count | `/api/bedrock/region-info` | Number of available models in the selected region |

### Region Change Flow

```
User selects a region
  ↓
RegionSelector → /api/bedrock/change-region (POST)
  ↓
Update Cookie bedrock_region
  ↓
Page reload
  ↓
/api/bedrock/region-info → Retrieve model list for the new region
  ↓
/api/bedrock/models → Update model selector
```

### Model Count by Region (as of 2026-03-25)

| Region | Model Count | Notes |
|--------|------------|-------|
| Tokyo (ap-northeast-1) | 57 | Primary |
| Osaka (ap-northeast-3) | 9 | |
| Singapore (ap-southeast-1) | 18 | |
| Sydney (ap-southeast-2) | 59 | |
| Mumbai (ap-south-1) | 58 | |
| Seoul (ap-northeast-2) | 19 | |
| Ireland (eu-west-1) | 50 | |
| Frankfurt (eu-central-1) | 29 | |
| London (eu-west-2) | 52 | |
| Paris (eu-west-3) | 25 | |
| Virginia (us-east-1) | 96 | |
| Oregon (us-west-2) | 103 | Most |
| Ohio (us-east-2) | 76 | |
| São Paulo (sa-east-1) | 43 | |

> Model counts are the result of `ListFoundationModels(byOutputModality=TEXT)`. When new models are added, update `REGION_MODEL_COUNTS` in `/api/bedrock/region-info`.

---

## 3. AI Model Selection Section

### Retrieving the Model List

```
/api/bedrock/models (GET)
  ↓
ListFoundationModels API (byOutputModality=TEXT)
  ↓
Auto-detect provider via provider-patterns.ts
  ↓
Return all models (including Unknown providers)
```

### Supported Providers (13)

amazon, anthropic, cohere, deepseek, google, minimax, mistral, moonshot, nvidia, openai, qwen, twelvelabs, zai

### Processing on Model Selection

The Converse API call method varies depending on the selected model ID when using the KB Retrieve API.

| Model ID Pattern | Processing |
|-----------------|-----------|
| `apac.xxx` / `us.xxx` / `eu.xxx` | Used as-is as an inference profile |
| `anthropic.xxx` | Called directly on-demand |
| `google.xxx`, `qwen.xxx`, `deepseek.xxx`, etc. | Called directly on-demand |
| `amazon.nova-pro-v1:0`, etc. (no prefix) | Falls back to Claude Haiku |
| Legacy models | Auto-fallback (Nova Lite → Claude Haiku) |

### Fallback Chain

```
Selected model → (failure) → apac.amazon.nova-lite-v1:0 → (failure) → anthropic.claude-3-haiku-20240307-v1:0
```

Automatically tries the next model when Legacy model errors, on-demand unavailable errors, or ValidationException occur.

---

## 4. Chat Area — Introduction Message

### Display Content

An initial message automatically generated after sign-in.

| Section | Content |
|---------|---------|
| Greeting | Welcome message including the username |
| Access Permissions | Username, role, accessible directories |
| Environment Type | SID-based / FSx production / Simulation |
| Permission Details | Read / Write / Execute availability |
| Available Features | Document search and Q&A, permission-based access control |

### Multilingual Support

Supports 8 languages (ja, en, de, es, fr, ko, zh-CN, zh-TW). Translation keys are defined in the `introduction` section of `docker/nextjs/src/messages/{locale}.json`.

---

## 5. Chat Area — RAG Search Flow

### Two-Stage Method (Retrieve + Converse)

```
User question
  ↓
/api/bedrock/kb/retrieve (POST)
  ↓
Step 1: DynamoDB user-access → Retrieve user SID
  ↓
Step 2: Bedrock KB Retrieve API → Vector search (with metadata)
  ↓
Step 3: SID Filtering
  - Match document's allowed_group_sids against user SID
  - Match → ALLOW, Mismatch → DENY
  ↓
Step 4: Converse API → Generate response using only permitted documents
  ↓
Return response + Citation + filterLog
```

### Why Not Use the RetrieveAndGenerate API

The RetrieveAndGenerate API does not include `allowed_group_sids` from `.metadata.json` in the citation's `metadata` field. Since the Retrieve API correctly returns metadata, the two-stage method is adopted.

### Frontend Fallback

If the KB Retrieve API returns a 500 error, the frontend falls back to the regular Bedrock Chat API (`/api/bedrock/chat`). In this case, a general AI response is returned without referencing KB documents.

---

## 6. API List

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/bedrock/kb/retrieve` | POST | RAG search + SID filtering + response generation |
| `/api/bedrock/chat` | POST | Regular chat (no KB, for fallback) |
| `/api/bedrock/models` | GET | Available model list |
| `/api/bedrock/region-info` | GET | Region information + model count |
| `/api/bedrock/change-region` | POST | Change region (Cookie update) |
| `/api/fsx/directories` | GET | User's accessible directories (SID-based) |
| `/api/auth/signin` | POST | Cognito authentication |
| `/api/auth/session` | GET | Session information |
| `/api/auth/signout` | POST | Sign out |
| `/api/health` | GET | Health check |

---

## 7. Environment Variables

Environment variables set for the Lambda function.

| Variable Name | Description | Example |
|--------------|-------------|---------|
| `DATA_BUCKET_NAME` | KB data source S3 bucket name | `perm-rag-demo-demo-kb-data-${ACCOUNT_ID}` |
| `BEDROCK_KB_ID` | Knowledge Base ID | `3ZZMK6YA0Q` |
| `BEDROCK_REGION` | Bedrock region | `ap-northeast-1` |
| `USER_ACCESS_TABLE_NAME` | DynamoDB user-access table name | `perm-rag-demo-demo-user-access` |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID | `ap-northeast-1_xxxxx` |
| `COGNITO_CLIENT_ID` | Cognito Client ID | `xxxxx` |
| `ENABLE_PERMISSION_CHECK` | Enable permission check | `true` |

---

## 8. Troubleshooting

### Chat Does Not Return Document Information

| Symptom | Cause | Resolution |
|---------|-------|------------|
| No information returned for all users | KB not synced or BEDROCK_KB_ID not set | Run `sync-kb-datasource.sh`, check environment variables |
| Confidential information not returned even for admin | SID data not registered | Run `setup-user-access.sh` |
| Response returned but no Citation | Fallback Chat API is being used | Check Lambda logs for 500 errors |
| "No documents found with access permissions" | No SID match | Check SID data in DynamoDB and SIDs in metadata |

### 500 Error on Model Selection

| Symptom | Cause | Resolution |
|---------|-------|------------|
| 500 on specific model | Legacy model or on-demand unavailable | Handled by auto-fallback |
| 500 on all models | Lambda timeout | Set Lambda timeout to 30 seconds or more |

### Directory Display Shows "❓ Unknown Environment"

| Symptom | Cause | Resolution |
|---------|-------|------------|
| Unknown environment displayed | `directoryType` has an unsupported value | Check switch cases in `page.tsx` |
| Directories are empty | SID data not registered | Run `setup-user-access.sh` |


---

## 8. KB/Agent Mode Switching

### Overview

A KB/Agent mode toggle is placed in the header, allowing seamless switching between two modes.

```
┌─────────────────────────────────────────────────────────┐
│ ≡  RAG System  [📚 KB] [🤖 Agent]  ➕  Nova Pro  🇯🇵  │
│                                                         │
│    📚 Knowledge Base  ← Changes dynamically by mode     │
│    🤖 Agent                                             │
└─────────────────────────────────────────────────────────┘
```

### Mode Switching Mechanism

| Item | Description |
|------|-------------|
| Toggle Position | Right side of the title in the header |
| State Management | `useState` + URL parameter (`?mode=agent`) |
| Persistence | Persisted via URL parameter (bookmarkable) |
| Default | KB mode (no `?mode` parameter) |

### Behavior by Mode

| Feature | KB Mode | Agent Mode |
|---------|---------|------------|
| Sidebar | KBModeSidebar (inline) | AgentModeSidebar (component) |
| Model List | `/api/bedrock/region-info` (all models) | `/api/bedrock/agent-models` (Agent-compatible models only) |
| Model Retrieval Method | Static config + API | Bedrock `ListFoundationModels` API (`ON_DEMAND` + `TEXT` filter) |
| Chat API | `/api/bedrock/kb/retrieve` | `/api/bedrock/kb/retrieve` (with `agentMode=true` flag) |
| SID Filtering | ✅ Yes | ✅ Yes (hybrid method) |
| Header Badge | 📚 Knowledge Base (blue) | 🤖 Agent (purple) |
| Operation Mode Display | 📚 Knowledge Base | 🤖 Agent |

### Agent Mode Hybrid Method

Agent mode adopts a hybrid method to achieve Permission-aware RAG.

```
User question
  │
  ▼
KB Retrieve API (vector search)
  │
  ▼
SID Filtering (same pipeline as KB mode)
  │ User SID ∩ Document SID → Allow/Deny
  ▼
Only permitted documents as context
  │
  ▼
Converse API (with Agent system prompt)
  │ "Respond using multi-step reasoning and document search as an AI agent"
  ▼
Response + Citation display
```

**Why the hybrid method:**
- The Bedrock Agent InvokeAgent API does not allow SID filtering on the application side
- The KB Retrieve API returns metadata (`allowed_group_sids`), enabling SID filtering
- The existing SID filtering pipeline can be reused as-is

### Dynamic Retrieval of Agent-Compatible Models

Agent-compatible models are dynamically retrieved from the Bedrock API rather than being hardcoded.

```
/api/bedrock/agent-models?region=ap-northeast-1
  │
  ▼
BedrockClient.ListFoundationModels({
  byOutputModality: 'TEXT',
  byInferenceType: 'ON_DEMAND',
})
  │
  ▼
Filter:
  - TEXT input + TEXT output
  - ON_DEMAND inference support
  - Exclude Embedding models
  │
  ▼
Agent-compatible model list (no maintenance required)
```

### AgentModeSidebar Structure

Workflow selection has been integrated into the central card grid, so it has been removed from the sidebar. The sidebar consists of Agent information display and a collapsible system management section.

```
┌─────────────────────────┐
│ Workflow Information     │
│  [Agent Selection ▼]    │
│  Agent ID: 1YZW9MRRSA   │
│  Agent Name: presentation│
│  Status: ✅ PREPARED     │
│  Description: Based on..│
│  [🚀 Create New] [🗑️ Delete]│
├─────────────────────────┤
│ ▶ ⚙️ System Management  │  ← CollapsiblePanel (collapsed by default)
│   Region Settings        │
│   AI Model Selection     │
│   Features               │
│   Chat History           │
└─────────────────────────┘
```

![Agent Mode Sidebar](screenshots/agent-mode-sidebar.png)

### Workflow Selection

Workflow selection is integrated into the central card grid (see Section 9). When a card is clicked, the Bedrock Agent corresponding to the category is automatically searched and dynamically created, and the prompt is automatically set in the chat input field (`agent-workflow-selected` custom event).

### Agent Invocation Flow (Full Implementation)

```
User question or workflow selection
  │
  ▼
InvokeAgent API (Bedrock Agent Runtime)
  │ Agent ID + Alias ID + Session ID
  │ Streaming response
  ▼
Agent multi-step reasoning
  ├── KB search (internal to Agent)
  ├── Action Group invocation (when configured)
  └── Response generation
  │
  ▼
Success → Agent response + Citation (extracted from trace)
  │
  ▼ Fallback on failure
KB Retrieve API → SID Filtering → Converse API
  │ (Hybrid method, Permission-aware guaranteed)
  ▼
Response + Citation display
```

### Related Files

| File | Role |
|------|------|
| `docker/nextjs/src/app/[locale]/genai/page.tsx` | Mode toggle, conditional sidebar rendering |
| `docker/nextjs/src/components/bedrock/AgentModeSidebar.tsx` | Agent mode sidebar |
| `docker/nextjs/src/components/bedrock/AgentInfoSection.tsx` | Agent selection & information display |
| `docker/nextjs/src/components/bedrock/ModelSelector.tsx` | Model selection (`mode` property for KB/Agent switching) |
| `docker/nextjs/src/app/api/bedrock/agent-models/route.ts` | Agent-compatible model API (dynamic retrieval) |
| `docker/nextjs/src/app/api/bedrock/agent/route.ts` | Agent API (invoke, create, delete, list) |
| `docker/nextjs/src/hooks/useAgentMode.ts` | Mode switching logic |
| `docker/nextjs/src/hooks/useAgentsList.ts` | Agent list retrieval |
| `docker/nextjs/src/store/useAgentStore.ts` | Agent state management (Zustand) |

---

## 9. Card-Based Task-Oriented UI

### Overview

A feature that displays a card grid in the initial state of the chat area (when no user messages exist). In KB mode, 14 purpose-specific cards (document search, summary creation, etc.) are presented, and in Agent mode, 14 workflow cards (financial analysis, project management, presentation creation, etc.) are presented, allowing users to input prompts with a single click.

![KB Mode Card Grid](screenshots/kb-mode-cards-full.png)

```
┌─────────────────────────────────────────────────────────────┐
│ ≡  RAG System  [📚 KB] [🤖 Agent]  ➕  Nova Pro  🇯🇵      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─ InfoBanner ──────────────────────────────────────────┐  │
│  │ admin@example.com | admin | 📁 3 directories  ▼      │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  [All] [Search] [Summary] [Learning] [Analysis] ← CategoryFilter │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │ 🔍       │ │ 📝       │ │ 📚       │                    │
│  │ Document  │ │ Summary  │ │ Quiz     │  ← TaskCard       │
│  │ Search    │ │ Creation │ │ Generator│                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │ ⚖️       │ │ 🏷️       │ │ 📊       │                    │
│  │ Compare  │ │ Keyword  │ │ Report   │                    │
│  │ Analysis │ │ Search   │ │ Summary  │                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Component Structure

| Component | File Path | Role |
|-----------|----------|------|
| CardGrid | `docker/nextjs/src/components/cards/CardGrid.tsx` | Main container. Integrates InfoBanner, CategoryFilter, and TaskCard; handles card display, filtering, and favorite sorting by mode |
| TaskCard | `docker/nextjs/src/components/cards/TaskCard.tsx` | Individual card component (shared by KB/Agent). Displays icon, title, description, and favorite toggle |
| InfoBanner | `docker/nextjs/src/components/cards/InfoBanner.tsx` | Permission information banner. Displays existing Introduction Text information in a compact collapsible/expandable format |
| CategoryFilter | `docker/nextjs/src/components/cards/CategoryFilter.tsx` | Category filter chips. Filters cards by mode-specific categories |

#### Component Hierarchy

```
CardGrid
├── InfoBanner          # Permission information banner (collapsible/expandable)
├── CategoryFilter      # Category filter chips
└── TaskCard × N        # Individual cards (grid display)
    └── Favorite button  # ★/☆ toggle
```

#### CardGrid Props

```typescript
interface CardGridProps {
  mode: 'kb' | 'agent';
  locale: string;
  onCardClick: (promptTemplate: string, label: string) => void;
  username: string;
  role: string;
  userDirectories: any | null;
}
```

#### TaskCard Props

```typescript
interface TaskCardProps {
  card: CardData;
  isFavorite: boolean;
  onFavoriteToggle: (cardId: string) => void;
  onClick: (promptTemplate: string, label: string) => void;
  locale: string;
}
```

### Card Data

Card data is centrally managed in `docker/nextjs/src/constants/card-constants.ts`.

#### CardData Type Definition

```typescript
interface CardData {
  id: string;                // Unique identifier (e.g., 'kb-doc-search')
  icon: string;              // emoji (e.g., '🔍')
  titleKey: string;          // Translation key (e.g., 'cards.kb.docSearch.title')
  descriptionKey: string;    // Translation key (e.g., 'cards.kb.docSearch.description')
  promptTemplateKey: string; // Translation key (e.g., 'cards.kb.docSearch.prompt')
  category: string;          // Category ID (e.g., 'search')
  mode: 'kb' | 'agent';     // Display mode
}
```

#### KB Mode Card List (14 cards)

##### Research Category (8 cards)

| ID | Icon | Category | Purpose |
|----|------|---------|---------|
| `kb-doc-search` | 🔍 | search | Document search |
| `kb-doc-summary` | 📝 | summary | Summary creation |
| `kb-quiz-gen` | 📚 | learning | Quiz generation |
| `kb-compare` | ⚖️ | analysis | Comparative analysis |
| `kb-keyword-search` | 🏷️ | search | Keyword search |
| `kb-report-summary` | 📊 | summary | Report summary |
| `kb-qa-gen` | ❓ | learning | Q&A generation |
| `kb-trend-analysis` | 📈 | analysis | Trend analysis |

##### Output Category (6 cards)

| ID | Icon | Category | Purpose |
|----|------|---------|---------|
| `kb-presentation` | 🎬 | output | Presentation creation |
| `kb-approval` | 📋 | output | Approval document creation |
| `kb-minutes` | 🗒️ | output | Meeting minutes creation |
| `kb-report-gen` | 📑 | output | Automated report generation |
| `kb-contract` | 📄 | output | Contract review |
| `kb-onboarding` | 🎓 | output | Onboarding materials |

#### Agent Mode Card List (14 cards)

##### Research Category (8 cards)

| ID | Icon | Category | Purpose |
|----|------|---------|---------|
| `agent-financial` | 📊 | financial | Financial report analysis |
| `agent-project` | 📝 | project | Project progress check |
| `agent-cross-search` | 🔍 | search | Cross-document search |
| `agent-hr` | 📋 | hr | HR policy check |
| `agent-risk` | ⚠️ | financial | Risk analysis |
| `agent-milestone` | 🎯 | project | Milestone management |
| `agent-compliance` | 🔐 | hr | Compliance check |
| `agent-data-analysis` | 📉 | search | Data analysis |

##### Output Category (6 cards)

| ID | Icon | Category | Purpose |
|----|------|---------|---------|
| `agent-presentation` | 📊 | presentation | Presentation creation |
| `agent-approval` | 📋 | approval | Approval document creation |
| `agent-minutes` | 📝 | minutes | Meeting minutes creation |
| `agent-report` | 📈 | report | Report creation |
| `agent-contract` | 📄 | contract | Contract review |
| `agent-onboarding` | 🎓 | onboarding | Onboarding materials creation |

![Agent Mode Card Grid](screenshots/agent-mode-card-grid.png)

### Display Conditions

CardGrid display is controlled by the presence of user messages.

| Condition | Display Content |
|-----------|----------------|
| No user messages (`messages` has 0 entries with `role === 'user'`) | CardGrid displayed |
| User messages exist (`role === 'user'` has 1 or more entries) | Normal message list display + "🔄 Return to workflow selection" button |
| "New Chat" button click | Create new session → CardGrid re-displayed |
| "🔄 Return to workflow selection" button click | Create new session → CardGrid re-displayed |

```typescript
// Display switching logic in page.tsx
const hasUserMessages = currentSession?.messages?.some(m => m.role === 'user') ?? false;

{!hasUserMessages ? (
  <CardGrid
    mode={agentMode ? 'agent' : 'kb'}
    locale={memoizedLocale}
    onCardClick={(prompt, label) => {
      setInputText(prompt);
      if (agentMode) {
        window.dispatchEvent(new CustomEvent('agent-workflow-selected', {
          detail: { prompt, label }
        }));
      }
    }}
    username={user?.email || ''}
    role={user?.role || ''}
    userDirectories={userDirectories}
  />
) : (
  // Existing message list display
  currentSession?.messages?.map(...)
)}
```

### "Return to Workflow Selection" Button

During a chat (when one or more user messages exist), a "🔄 Return to workflow selection" button is displayed above the chat input area. Clicking it creates a new session and returns to the card grid.

![Chat Response + Citation + Back Button](screenshots/kb-mode-chat-citation.png)

| Item | Description |
|------|-------------|
| Display Condition | `currentSession.messages` has 1 or more entries with `role === 'user'` |
| Position | Above the chat input area |
| Behavior | Creates a new ChatSession and sets it with `setCurrentSession`. The card grid is re-displayed |
| Style | Text link style (`text-blue-600`), with 🔄 icon |

### Favorites Management

#### Zustand Store

**File**: `docker/nextjs/src/store/useFavoritesStore.ts`

```typescript
interface FavoritesStore {
  favorites: string[];                        // Favorite card ID list
  toggleFavorite: (cardId: string) => void;   // Favorite toggle (add/remove)
  isFavorite: (cardId: string) => boolean;    // Favorite check
}
```

| Item | Description |
|------|-------------|
| Persistence Method | Zustand `persist` middleware + localStorage |
| localStorage Key | `card-favorites-storage` |
| Fallback | In-memory only when localStorage is unavailable (retained during session) |
| Sort Behavior | Favorite cards are displayed at the top of the grid. Relative order within each group is maintained |

#### Sort Logic

```typescript
// card-constants.ts
function sortCardsByFavorites(cards: CardData[], favorites: string[]): CardData[] {
  const favoriteSet = new Set(favorites);
  const favoriteCards = cards.filter((card) => favoriteSet.has(card.id));
  const nonFavoriteCards = cards.filter((card) => !favoriteSet.has(card.id));
  return [...favoriteCards, ...nonFavoriteCards];
}
```

### Category Filtering

#### KB Mode Categories

| Category ID | Translation Key | Display Name (en) |
|------------|----------------|-------------------|
| `all` | `cards.categories.all` | All |
| `search` | `cards.categories.search` | Search |
| `summary` | `cards.categories.summary` | Summary |
| `learning` | `cards.categories.learning` | Learning |
| `analysis` | `cards.categories.analysis` | Analysis |
| `output` | `cards.categories.output` | Document Creation |

#### Agent Mode Categories

| Category ID | Translation Key | Display Name (en) |
|------------|----------------|-------------------|
| `all` | `cards.categories.all` | All |
| `financial` | `cards.categories.financial` | Financial |
| `project` | `cards.categories.project` | Project |
| `hr` | `cards.categories.hr` | HR |
| `search` | `cards.categories.search` | Search |
| `presentation` | `cards.categories.presentation` | Document Creation |
| `approval` | `cards.categories.approval` | Approval |
| `minutes` | `cards.categories.minutes` | Minutes |
| `report` | `cards.categories.report` | Report |
| `contract` | `cards.categories.contract` | Contract |
| `onboarding` | `cards.categories.onboarding` | Onboarding |

#### Filtering Behavior

| Action | Behavior |
|--------|----------|
| Category selection | Display only cards matching the selected category |
| "All" selection | Display all cards for the current mode |
| Mode switch (KB↔Agent) | Reset category selection to "All" |

### InfoBanner

Consolidates existing Introduction Text information into a compact banner.

#### Collapsed State (Default)

Single line display: `Username | Role | 📁 Access to N directories`

#### Expanded State

| Display Item | Description |
|-------------|-------------|
| Username | Email address from Cognito JWT |
| Role | `admin` or `user` |
| SID | User's security identifier |
| Directory List | Three types: FSx / RAG / Embedding |
| Permission Details | Read ✅/❌, Write ✅/❌, Execute ✅/❌ |

All information contained in the existing Introduction Text (username, role, SID, directory list, permission details) is preserved.

#### InfoBanner Props

```typescript
interface InfoBannerProps {
  username: string;
  role: string;
  userDirectories: any | null;
  locale: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
}
```

### Translation

Supports all 8 languages. Translation keys are defined in the `cards` namespace within `messages/{locale}.json` for each language.

| Language | Locale | Translation File |
|----------|--------|-----------------|
| Japanese | `ja` | `docker/nextjs/src/messages/ja.json` |
| English | `en` | `docker/nextjs/src/messages/en.json` |
| Chinese (Simplified) | `zh-CN` | `docker/nextjs/src/messages/zh-CN.json` |
| Chinese (Traditional) | `zh-TW` | `docker/nextjs/src/messages/zh-TW.json` |
| Korean | `ko` | `docker/nextjs/src/messages/ko.json` |
| French | `fr` | `docker/nextjs/src/messages/fr.json` |
| German | `de` | `docker/nextjs/src/messages/de.json` |
| Spanish | `es` | `docker/nextjs/src/messages/es.json` |

#### Translation Key Structure

```json
{
  "cards": {
    "categories": {
      "all": "All",
      "search": "Search",
      "summary": "Summary",
      "learning": "Learning",
      "analysis": "Analysis",
      "output": "Document Creation",
      "financial": "Financial",
      "project": "Project",
      "hr": "HR",
      "presentation": "Document Creation",
      "approval": "Approval",
      "minutes": "Minutes",
      "report": "Report",
      "contract": "Contract",
      "onboarding": "Onboarding"
    },
    "kb": {
      "docSearch": { "title": "...", "description": "...", "prompt": "..." },
      "docSummary": { "title": "...", "description": "...", "prompt": "..." },
      "quizGen": { "title": "...", "description": "...", "prompt": "..." },
      "compare": { "title": "...", "description": "...", "prompt": "..." },
      "keywordSearch": { "title": "...", "description": "...", "prompt": "..." },
      "reportSummary": { "title": "...", "description": "...", "prompt": "..." },
      "qaGen": { "title": "...", "description": "...", "prompt": "..." },
      "trendAnalysis": { "title": "...", "description": "...", "prompt": "..." },
      "presentation": { "title": "...", "description": "...", "prompt": "..." },
      "approval": { "title": "...", "description": "...", "prompt": "..." },
      "minutes": { "title": "...", "description": "...", "prompt": "..." },
      "reportGen": { "title": "...", "description": "...", "prompt": "..." },
      "contract": { "title": "...", "description": "...", "prompt": "..." },
      "onboarding": { "title": "...", "description": "...", "prompt": "..." }
    },
    "agent": {
      "financial": { "title": "...", "description": "...", "prompt": "..." },
      "project": { "title": "...", "description": "...", "prompt": "..." },
      "crossSearch": { "title": "...", "description": "...", "prompt": "..." },
      "hr": { "title": "...", "description": "...", "prompt": "..." },
      "risk": { "title": "...", "description": "...", "prompt": "..." },
      "milestone": { "title": "...", "description": "...", "prompt": "..." },
      "compliance": { "title": "...", "description": "...", "prompt": "..." },
      "dataAnalysis": { "title": "...", "description": "...", "prompt": "..." },
      "presentation": { "title": "...", "description": "...", "prompt": "..." },
      "approval": { "title": "...", "description": "...", "prompt": "..." },
      "minutes": { "title": "...", "description": "...", "prompt": "..." },
      "report": { "title": "...", "description": "...", "prompt": "..." },
      "contract": { "title": "...", "description": "...", "prompt": "..." },
      "onboarding": { "title": "...", "description": "...", "prompt": "..." }
    },
    "infoBanner": {
      "directoriesCount": "Access to {count} directories",
      "showDetails": "Show details",
      "hideDetails": "Hide details",
      "user": "User",
      "role": "Role",
      "sid": "SID",
      "directories": "Directories",
      "permissions": "Permissions",
      "read": "Read",
      "write": "Write",
      "execute": "Execute",
      "available": "Available",
      "unavailable": "Unavailable"
    },
    "favorites": {
      "addToFavorites": "Add to favorites",
      "removeFromFavorites": "Remove from favorites"
    }
  }
}
```

### Related Files

| File | Role |
|------|------|
| `docker/nextjs/src/components/cards/CardGrid.tsx` | Card grid main container |
| `docker/nextjs/src/components/cards/TaskCard.tsx` | Individual card component (shared by KB/Agent) |
| `docker/nextjs/src/components/cards/InfoBanner.tsx` | Permission information banner (collapsible/expandable) |
| `docker/nextjs/src/components/cards/CategoryFilter.tsx` | Category filter chips |
| `docker/nextjs/src/constants/card-constants.ts` | Card data definitions, helper functions, AGENT_CATEGORY_MAP |
| `docker/nextjs/src/store/useFavoritesStore.ts` | Favorites management Zustand store |
| `docker/nextjs/src/services/cardAgentBindingService.ts` | Agent search, dynamic creation, card binding service |
| `docker/nextjs/src/store/useCardAgentMappingStore.ts` | Card-Agent mapping persistence |
| `docker/nextjs/src/messages/{locale}.json` | Translation files (`cards` namespace) |
| `docker/nextjs/src/app/[locale]/genai/page.tsx` | CardGrid integration, display condition control, back button |


---

## 10. Sidebar Layout Redesign

### Overview

Redesign of the Agent mode sidebar to make System Settings (region, model selection, etc.) collapsible, with the workflow section placed at the top of the sidebar.

### Layout Structure

In both KB mode and Agent mode, the system management section (region, model selection, etc.) is collapsible.

#### KB Mode

```
┌─────────────────────────┐
│ User Information         │
│  admin@example.com       │
│  (administrator)         │
├─────────────────────────┤
│ Access Permissions       │
│  📁 Directory ✅ Read    │
├─────────────────────────┤
│ ▶ ⚙️ System Management  │  ← CollapsiblePanel (collapsible)
│   Bedrock Region         │
│   AI Model Selection     │
│   Chat History           │
│   KB Features            │
└─────────────────────────┘
```

#### Agent Mode

```
┌─────────────────────────┐
│ Workflow Information     │
│  [Agent Selection ▼]    │
│  Agent ID / Agent Name   │
│  Status / Description    │
│  [🚀 Create New] [🗑️ Delete]│
├─────────────────────────┤
│ ▶ ⚙️ System Management  │  ← CollapsiblePanel (collapsed by default)
│   Region Settings        │
│   AI Model Selection     │
│   Features               │
│   Chat History           │
└─────────────────────────┘
```

### New Components

| Component | File Path | Role |
|-----------|----------|------|
| CollapsiblePanel | `docker/nextjs/src/components/ui/CollapsiblePanel.tsx` | Collapsible/expandable panel. Wraps the System Settings section |
| WorkflowSection | `docker/nextjs/src/components/ui/WorkflowSection.tsx` | Workflow card list. Displayed at the top of the sidebar in Agent mode |

### State Management

| Store | File Path | Role |
|-------|----------|------|
| useSidebarStore | `docker/nextjs/src/store/useSidebarStore.ts` | Sidebar collapse state management (Zustand + localStorage persistence) |

### Behavior Specification

| Item | Description |
|------|-------------|
| Default State | System Settings: collapsed (both KB/Agent modes) |
| Persistence | localStorage via Zustand persist middleware |
| KB Mode | User information + Access permissions + Collapsible system management |
| Agent Mode | Agent information (selection, creation, deletion) + Collapsible system management |


---

## 11. Dynamic Agent-Card Binding

### Overview

A feature that searches for an Agent corresponding to a category when a card is clicked, and dynamically creates one if it doesn't exist, binding it to the card.

### Flow

```
Card click
  │
  ▼
cardAgentBindingService
  │ 1. Determine category via AGENT_CATEGORY_MAP
  │ 2. Search for existing Agent (name matching)
  │ 3. If not found → Dynamically create via Bedrock CreateAgent API
  │ 4. Persist card-Agent mapping
  ▼
Execute via Agent InvokeAgent API
```

### AGENT_CATEGORY_MAP (10 Categories)

A mapping that defines the correspondence between card categories and Agents. Each category has an Agent name prefix, system prompt, and recommended model configured.

| Category | Agent Name Prefix | Purpose |
|----------|------------------|---------|
| financial | FinancialAnalysis | Financial report analysis & risk analysis |
| project | ProjectManagement | Project progress & milestone management |
| hr | HRPolicy | HR policy & compliance |
| search | DocumentSearch | Cross-document search & data analysis |
| presentation | PresentationDraft | Presentation creation |
| approval | ApprovalDocument | Approval document creation |
| minutes | MeetingMinutes | Meeting minutes creation |
| report | ReportGeneration | Report creation |
| contract | ContractReview | Contract review |
| onboarding | OnboardingGuide | Onboarding |

### Related Files

| File | Role |
|------|------|
| `docker/nextjs/src/services/cardAgentBindingService.ts` | Agent search, dynamic creation, card binding service |
| `docker/nextjs/src/store/useCardAgentMappingStore.ts` | Card-Agent mapping persistence (Zustand + localStorage) |
| `docker/nextjs/src/app/api/bedrock/agent/route.ts` | Agent CRUD API (create, list, delete, invoke) |


---

## 12. Output-Oriented Workflow Cards

### Overview

Expands Agent mode cards to a total of 14 cards: 8 "Research" + 6 "Output". Output cards are designed for generating specific deliverables (presentations, approval documents, meeting minutes, reports, contracts, onboarding materials).

### Agent Mode Card List (14 cards)

#### Research Category (Existing 8 cards)

| ID | Icon | Category | Purpose |
|----|------|---------|---------|
| `agent-financial` | 📊 | financial | Financial report analysis |
| `agent-project` | 📝 | project | Project progress check |
| `agent-cross-search` | 🔍 | search | Cross-document search |
| `agent-hr` | 📋 | hr | HR policy check |
| `agent-risk` | ⚠️ | financial | Risk analysis |
| `agent-milestone` | 🎯 | project | Milestone management |
| `agent-compliance` | 🔐 | hr | Compliance check |
| `agent-data-analysis` | 📉 | search | Data analysis |

#### Output Category (New 6 cards)

| ID | Icon | Category | Purpose |
|----|------|---------|---------|
| `agent-presentation` | 🎤 | presentation | Presentation creation |
| `agent-approval` | 📑 | approval | Approval document creation |
| `agent-minutes` | 🗒️ | minutes | Meeting minutes creation |
| `agent-report` | 📈 | report | Report creation |
| `agent-contract` | 📄 | contract | Contract review |
| `agent-onboarding` | 🎓 | onboarding | Onboarding materials creation |

### Card Click Behavior

1. Reference `AGENT_CATEGORY_MAP` from the card's category
2. `cardAgentBindingService` searches for or dynamically creates the corresponding Agent
3. Persist mapping in `useCardAgentMappingStore`
4. Execute prompt via Agent InvokeAgent API


---

## 13. Citation Display — File Path Display and Access Level Badge

### Overview

The CitationDisplay component (`docker/nextjs/src/components/chat/CitationDisplay.tsx`) displays the FSx file path and access level badge for each source document in RAG search results.

### File Path Display

Extracts and displays the file path on FSx from the S3 URI. By including the directory path rather than just the file name, it prevents confusion when files with the same name exist in different folders.

| Display Format | Example |
|---------------|---------|
| S3 URI | `s3://bucket-alias/confidential/financial-report.md` |
| Display Path | `confidential/financial-report.md` |

```typescript
// Extract FSx file path from S3 URI
function extractFilePath(s3Uri: string, fileName: string): string {
  if (!s3Uri) return fileName;
  const withoutProtocol = s3Uri.replace(/^s3:\/\/[^/]+\//, '');
  return withoutProtocol || fileName;
}
```

### Access Level Badge

| `access_level` Value | Badge Color | Display Label | Meaning |
|---------------------|-------------|--------------|---------|
| `public` | Green | Accessible to all | Everyone SID — accessible to all users |
| `confidential` | Red | Admins only | Accessible only to Domain Admins SID |
| `restricted` | Yellow | Specific groups | Specific groups (e.g., Engineering + Domain Admins) |
| Other / Not set | Yellow | (raw value displayed as-is) | Uncategorized access level |

If `access_level` is not set (`metadata.access_level` does not exist), the badge itself is not displayed.

### Data Source

Badge labels are retrieved from the `access_level` field in the `.metadata.json` accompanying documents on S3.

```json
{
  "metadataAttributes": {
    "access_level": "public",
    "allowed_group_sids": ["S-1-1-0"]
  }
}
```

`access_level` is a classification label for documents (for display purposes), and actual access control is performed by SID filtering using `allowed_group_sids`. In other words:

- **`access_level`**: Used for badge display in the UI (visual classification)
- **`allowed_group_sids`**: Used for server-side SID matching (actual permission control)

The two are independent, and changing `access_level` does not affect access control.

### Label Customization

When adding a new `access_level` value, add a case to the `getAccessLevelLabel()` function in `CitationDisplay.tsx`.

```typescript
// docker/nextjs/src/components/chat/CitationDisplay.tsx
function getAccessLevelLabel(accessLevel: string): string {
  switch (accessLevel) {
    case 'public':
      return 'Accessible to all';
    case 'confidential':
      return 'Admins only';
    case 'restricted':
      return 'Specific groups';
    // Add a new access level:
    case 'internal':
      return 'Internal only';
    default:
      return accessLevel; // Display undefined values as-is
  }
}
```

To change badge colors, edit the Tailwind CSS classes corresponding to the conditional branches (`access_level === 'public'`, etc.) in the same file.


---

## 10. Agent Directory — Agent Management Screen

**Last Updated**: 2026-03-29

### Overview

Agent Directory (`/[locale]/genai/agents`) is a dedicated screen for listing and managing Bedrock Agents in a catalog format. It is designed with reference to the Bedrock Engineer Agent Directory UX pattern.

### Access Method

- URL: `/{locale}/genai/agents` (e.g., `/ja/genai/agents`, `/en/genai/agents`)
- Access via the "📋 Agent List" link in the header
- Access via the "Agent List" tab in the navigation bar

![Agent Directory — List Screen with Enterprise Tabs](screenshots/agent-directory-enterprise.png)

### Navigation Bar

Three tabs are displayed at the top of the screen.

| Tab | Destination | Description |
|-----|------------|-------------|
| Agent Mode | `/genai?mode=agent` | Agent mode card grid screen |
| Agent List | `/genai/agents` | Agent Directory (current screen) |
| KB Mode | `/genai` | KB mode card grid screen |

A dark mode toggle (☀️/🌙) and language switch dropdown are placed on the right side of the navigation bar.

### Agent List (Grid View)

#### Search & Filtering

| Feature | Description |
|---------|-------------|
| Text Search | Case-insensitive partial match search against Agent name and description |
| Category Filter | 10 categories (financial, project, hr, search, presentation, approval, minutes, report, contract, onboarding) + "All" |

Search and category filter can be combined (AND condition).

#### Agent Card

Each card displays the following information.

| Item | Description |
|------|-------------|
| Agent Name | Bedrock Agent name |
| Status Badge | Ready (green) / Creating/Preparing (blue + spinner) / Failed (red) / Other (gray) |
| Description | Agent description (up to 2 lines) |
| Category Tag | Auto-inferred from Agent name/description via keyword matching (purple tag) |

Clicking a card navigates to the detail panel.

#### Status Badge Color Mapping

| Status | Color | Spinner |
|--------|-------|---------|
| PREPARED | Green | None |
| CREATING / PREPARING | Blue | Yes |
| FAILED | Red | None |
| NOT_PREPARED / DELETING / VERSIONING / UPDATING | Gray | None |

### Agent Detail Panel

A detail screen displayed when an Agent card is clicked.

#### Display Items

| Item | Data Source |
|------|------------|
| Agent ID | `GetAgentCommand` |
| Agent Name | Same as above |
| Description | Same as above |
| Status | Same as above |
| Model | `foundationModel` |
| Version | `agentVersion` |
| Created Date | `createdAt` (locale-aware date display) |
| Last Updated | `updatedAt` (locale-aware date display) |
| System Prompt | `instruction` (collapsible) |
| Action Groups | `actionGroups[]` (list display) |

#### Action Buttons

| Button | Behavior |
|--------|----------|
| Use in Chat | Sets `useAgentStore.selectedAgentId` and navigates to `/genai?mode=agent` |
| Edit | Switches to inline edit form |
| Export | Downloads Agent configuration as a JSON file (when `enableAgentSharing`) |
| Upload to Shared Bucket | Uploads Agent configuration to S3 shared bucket (when `enableAgentSharing`) |
| Create Schedule | Sets up cron periodic execution with EventBridge Scheduler (when `enableAgentSchedules`) |
| Delete | Confirmation dialog including Agent name → Execute Delete API |

![Agent Detail Panel (with Export, Sharing, and Schedule features)](screenshots/agent-detail-panel.png)

### Agent Edit Form

A form displayed when the "Edit" button is clicked in the detail panel.

| Field | Type | Validation |
|-------|------|-----------|
| Agent Name | Text input | Minimum 3 characters required |
| Description | Text input | Optional |
| System Prompt | Text area | Optional |
| Model | Dropdown | Select from 7 models |

On save, `Update API` → `PrepareAgent` is executed. On error, form input content is preserved.

### Agent Creation Form (Create from Template)

Displayed when "Create from Template" is clicked on a template card, or when an Agent has not been created when clicking a card in Agent mode.

#### Template List (10 Categories)

| Category | Agent Name Pattern | Model |
|----------|-------------------|-------|
| financial | financial-analysis-agent | Claude 3 Haiku |
| project | project-management-agent | Claude 3 Haiku |
| hr | hr-policy-agent | Claude 3 Haiku |
| search | cross-search-agent | Claude 3 Haiku |
| presentation | presentation-creator-agent | Claude 3 Haiku |
| approval | approval-document-agent | Claude 3 Haiku |
| minutes | meeting-minutes-agent | Claude 3 Haiku |
| report | report-generator-agent | Claude 3 Haiku |
| contract | contract-review-agent | Claude 3 Haiku |
| onboarding | onboarding-guide-agent | Claude 3 Haiku |

Template values are pre-filled, but all fields (Agent name, description, system prompt, model) can be edited before creation.

![Agent Creation Form](screenshots/agent-creator-form.png)

#### Creation Flow

```
Template selection → Display creation form (values are editable)
  → Click "Create and Deploy"
  → CreateAgent → PrepareAgent → CreateAgentAlias
  → Progress display (Creating → Preparing → Complete)
  → Automatically added to Agent list
```

#### Creation Flow from Agent Mode Card

```
Click card in Agent mode
  → Check cache → Search for existing Agent (keyword matching)
  → If not found: Redirect to /genai/agents?create={category}
  → Agent Directory creation form opens automatically
  → After creation, return to Agent list
```

### API Integration

Agent Directory shares the existing `/api/bedrock/agent` API and does not add new endpoints.

| Action | Request | Purpose |
|--------|---------|---------|
| `list` | `POST {action: 'list'}` | Retrieve Agent list |
| `get` | `POST {action: 'get', agentId}` | Retrieve Agent details |
| `create` | `POST {action: 'create', agentName, instruction, foundationModel, description, attachActionGroup}` | Create Agent from template |
| `update` | `POST {action: 'update', agentId, agentName, description, instruction, foundationModel}` | Save Agent edits |
| `delete` | `POST {action: 'delete', agentId}` | Delete Agent |

### State Management

| Store | Purpose | Persistence |
|-------|---------|-------------|
| `useAgentDirectoryStore` | Agent list, selected Agent, search query, category, view mode, creation progress | None (fetched from API each time) |
| `useAgentStore` | `selectedAgentId` (Agent used in Chat screen) | localStorage |
| `useCardAgentMappingStore` | Card ID → Agent ID mapping | localStorage |

### i18n Support

Supports 8 languages (ja, en, ko, zh-CN, zh-TW, fr, de, es) under the `agentDirectory` namespace. Translation keys are defined in both `messages/{locale}.json` and `src/messages/{locale}.json`.

### Component Structure

```
AgentDirectoryPage (page.tsx)
├── NavigationBar          # Agent Mode / Agent List / KB Mode tabs
├── ThemeToggle            # Dark mode toggle
├── LanguageSwitcher       # Language switch
└── AgentDirectory         # Main container
    ├── TabBar                      # Agent List / Shared Agents / Schedule Tasks
    ├── ImportButton                # JSON import button
    ├── SearchBar + CategoryFilter  # Search & filter
    ├── AgentCard[]                 # Agent card grid
    ├── AgentTemplateSection        # Template list
    │   └── TemplateCard[]          # Template cards
    ├── AgentDetailPanel            # Agent detail display
    │   ├── ScheduleForm            # Schedule settings
    │   └── ExecutionHistoryList    # Execution history
    ├── AgentEditor                 # Agent edit form
    │   ├── ActionGroupSelector     # Tool selection
    │   ├── GuardrailSettings       # Guardrail settings
    │   └── InferenceProfileSelector # Inference profile selection
    ├── AgentCreator                # Agent creation form
    │   ├── ActionGroupSelector     # Tool selection
    │   ├── GuardrailSettings       # Guardrail settings
    │   └── InferenceProfileSelector # Inference profile selection
    ├── ImportDialog                # JSON import dialog
    └── SharedConfigPreview         # Shared Agent configuration preview
```

### Error Handling

| Error Case | Response |
|-----------|----------|
| Agent list retrieval failure | Error message + retry button |
| Agent detail retrieval failure | Error message, return to grid view |
| Agent creation failure | Error display in progress bar, form input preserved |
| Agent update failure | Error message, form input preserved |
| Agent deletion failure | Error message |
| Filter results 0 items | "No matching Agents found" message |


---

## 11. Sidebar — Chat History Settings

**Last Updated**: 2026-03-29

### Overview

Chat history save settings are displayed as an independent section in the sidebar, common to both KB mode and Agent mode (placed above the System Management CollapsiblePanel).

### Display Content

| State | Icon | Text | Background Color |
|-------|------|------|-----------------|
| Save enabled | 💾 | "Save History" + "Auto-save" | Green (`bg-green-100`) |
| Save disabled | 🚫 | "History Disabled" + "Session only" | Gray (`bg-gray-50`) |

### Data Flow

```
Toggle button click
  → useChatStore.setSaveHistory(!saveHistory)
  → If saveHistory === true:
    → saveChatHistory() is automatically executed after message send
    → Saved to DynamoDB chat-history table
```

### Differences Between KB Mode and Agent Mode

| Item | KB Mode | Agent Mode |
|------|---------|------------|
| Sidebar Position | Below FSx directory information | Below Agent information section |
| Store | `useChatStore.saveHistory` | `useChatStore.saveHistory` (shared) |
| Save Destination | DynamoDB | DynamoDB (shared) |

#### KB Mode Sidebar

![KB Mode Sidebar](screenshots/kb-mode-sidebar.png)

#### Agent Mode Sidebar

![Agent Mode Sidebar](screenshots/agent-mode-sidebar.png)

---

## 12. Message Input Area

**Last Updated**: 2026-03-29

### Layout

```
[➕] [Text input field                              ] [Send button]
```

| Element | Description |
|---------|-------------|
| ➕ Button | Starts a new chat session. Returns to the card grid |
| Text Input | Message input. Disabled during sending |
| Send Button | Sends message. Disabled when input is empty or during sending |

During a chat, a "🔄 Return to workflow selection" link is displayed above the input area.


---

## Screenshot Capture Guide

When capturing screenshots for documentation, follow the steps below to capture each screen.

### Required Screenshots

| File Name | Screen | Capture Steps |
|-----------|--------|--------------|
| `agent-directory-enterprise.png` | Agent Directory list (with enterprise tabs) | Access `/ja/genai/agents` |
| `agent-directory-shared-tab.png` | Shared Agents tab | Click "Shared Agents" tab in Agent Directory |
| `agent-directory-schedules-tab.png` | Schedule Tasks tab | Click "Schedule Tasks" tab in Agent Directory |
| `agent-creator-form.png` | Agent creation form | Click "Create from Template" on a template |
| `agent-detail-panel.png` | Agent detail panel | Click an Agent card in the Agent list |
| `agent-mode-card-grid.png` | Agent mode card grid | Access `/ja/genai?mode=agent` |
| `kb-mode-cards-full.png` | KB mode card grid | Access `/ja/genai` |
| `kb-mode-chat-citation.png` | Chat response + Citation | Send a question in KB mode |

Save location: `docs/screenshots/`


---

## 14. Enterprise Agent Features (Optional)

**Last Updated**: 2026-03-30

### Overview

A set of enterprise-oriented Agent management features that can be enabled via optional parameters during CDK deployment.

### How to Enable

```bash
# Enable Agent sharing feature
npx cdk deploy --all -c enableAgentSharing=true

# Enable Agent scheduled execution feature
npx cdk deploy --all -c enableAgentSchedules=true

# Enable both
npx cdk deploy --all -c enableAgent=true -c enableAgentSharing=true -c enableAgentSchedules=true
```

### 5 Features

| # | Feature | CDK Parameter | Additional Resources |
|---|---------|--------------|---------------------|
| 1 | Agent Tool Selection UI | None (UI feature only) | None |
| 2 | Guardrails UI Settings | `enableGuardrails` | Bedrock Guardrail |
| 3 | Application Inference Profiles | None (UI feature only) | None |
| 4 | Organization Sharing | `enableAgentSharing` | S3 bucket (`${prefix}-shared-agents`) |
| 5 | Background Agent | `enableAgentSchedules` | Lambda + DynamoDB + EventBridge Scheduler |

### 1. Agent Tool Selection UI

Adds Action Group (tool) selection checkboxes to the Agent creation and edit forms. Users can select from PermissionAwareSearch, Browser, and CodeInterpreter.

### 2. Guardrails UI Settings

Adds a guardrail enable toggle and ID selection dropdown to the Agent creation and edit forms. Dynamically retrieved from the Bedrock ListGuardrails API.

### 3. Application Inference Profiles

Adds inference profile selection and cost tag (department/project) input to the Agent creation and edit forms.

### 4. Organization Sharing (`enableAgentSharing`)

JSON export/import functionality for Agent configurations and S3 shared bucket.

- "Export" and "Upload to Shared Bucket" buttons in the Agent detail panel
- "Import" button and JSON file upload dialog in Agent Directory
- "Shared Agents" tab to list, preview, and import shared configurations from the S3 bucket

CDK Resources: S3 bucket (S3 managed encryption, 90-day Intelligent-Tiering)

### 5. Background Agent (`enableAgentSchedules`)

Periodic Agent execution via EventBridge Scheduler + Lambda.

- "Schedule Settings" section in the Agent detail panel (cron expression input, prompt configuration)
- "Schedule Tasks" tab to list all schedules and display execution history
- Manual execution button

CDK Resources:
- Lambda function (`${prefix}-agent-scheduler`, Node.js 22.x, 5-minute timeout)
- DynamoDB execution history table (`${prefix}-agent-executions`, with GSI, 90-day TTL)

### Agent Directory Tab UI

When enterprise features are enabled, three tabs are displayed in Agent Directory.

| Tab | Content |
|-----|---------|
| Agent List | Existing Agent card grid + templates |
| Shared Agents | List of Agent configurations in S3 shared bucket (when `enableAgentSharing`) |
| Schedule Tasks | Schedule list for all Agents + execution history (when `enableAgentSchedules`) |

#### Shared Agents Tab

![Shared Agents Tab](screenshots/agent-directory-shared-tab.png)

#### Schedule Tasks Tab

![Schedule Tasks Tab](screenshots/agent-directory-schedules-tab.png)

### API List

| Endpoint | Action | Description |
|----------|--------|-------------|
| `/api/bedrock/agent` | `listActionGroups` | List Action Groups attached to Agent |
| `/api/bedrock/agent` | `listAvailableActionGroups` | List available Action Group templates |
| `/api/bedrock/agent` | `listGuardrails` | List guardrails |
| `/api/bedrock/agent` | `listInferenceProfiles` | List inference profiles |
| `/api/bedrock/agent-sharing` | `exportConfig` / `importConfig` | Agent configuration JSON export/import |
| `/api/bedrock/agent-sharing` | `uploadSharedConfig` / `listSharedConfigs` / `downloadSharedConfig` | S3 shared bucket operations |
| `/api/bedrock/agent-schedules` | `createSchedule` / `updateSchedule` / `deleteSchedule` / `listSchedules` | EventBridge Scheduler CRUD |
| `/api/bedrock/agent-schedules` | `getExecutionHistory` / `manualTrigger` | Execution history retrieval & manual execution |


---

## 14. AD Sign-In UI — SAML Federation Support

### Overview

When AD SAML federation is enabled (`enableAdFederation=true`), an "Sign in with AD" button is added to the sign-in page to support the SAML flow via Cognito Hosted UI.

### Display Conditions

| Condition | Display Content |
|-----------|----------------|
| `COGNITO_DOMAIN` environment variable is set | "Sign in with AD" button + existing email/password form |
| `COGNITO_DOMAIN` environment variable is not set | Existing email/password form only (backward compatibility) |

### Button Specification

| Item | Description |
|------|-------------|
| Label | `signin.adSignIn` translation key (Japanese: "ADでサインイン", English: "Sign in with AD") |
| Description Text | `signin.adSignInDesc` translation key (Japanese: "Active Directory認証を使用", English: "Use Active Directory authentication") |
| Placement | Above the email/password form, separated by a divider (`signin.orDivider`: "or") |
| Style | Primary button (same style as the existing sign-in button) |

### SAML Redirect URL Construction

Redirects to the following URL when the "Sign in with AD" button is clicked:

```
https://{COGNITO_DOMAIN}.auth.{COGNITO_REGION}.amazoncognito.com/oauth2/authorize
  ?identity_provider={IDP_NAME}
  &response_type=code
  &client_id={COGNITO_CLIENT_ID}
  &redirect_uri={encodeURIComponent(CALLBACK_URL + '/api/auth/callback')}
  &scope=openid+email+profile
```

| Parameter | Environment Variable | Description |
|-----------|---------------------|-------------|
| `COGNITO_DOMAIN` | `COGNITO_DOMAIN` | Cognito Hosted UI domain prefix |
| `COGNITO_REGION` | `COGNITO_REGION` | Cognito region |
| `COGNITO_CLIENT_ID` | `COGNITO_CLIENT_ID` | User Pool Client ID |
| `CALLBACK_URL` | `CALLBACK_URL` | OAuth callback URL |
| `IDP_NAME` | `IDP_NAME` | SAML IdP name (default: `ActiveDirectory`) |

### OAuth Callback Flow

The `/api/auth/callback` route receives the authorization code and performs the following:

1. Exchange the authorization code for tokens at the Cognito Token Endpoint
2. Retrieve user attributes (email, custom:role, custom:ad_groups) from the ID token
3. ID token-based role determination (`custom:role === 'admin'` or `custom:ad_groups` contains admin group → `administrator`)
4. Set session Cookie
5. Redirect to the chat screen (`/[locale]/genai`)

### ID Token-Based Role Determination

| Condition | Result |
|-----------|--------|
| `custom:role === 'admin'` | `administrator` |
| `custom:ad_groups` contains admin group | `administrator` |
| Otherwise | `user` |

### Multilingual Support (8 Languages)

| Translation Key | ja | en |
|----------------|----|----|
| `signin.adSignIn` | ADでサインイン | Sign in with AD |
| `signin.adSignInDesc` | Active Directory認証を使用 | Use Active Directory authentication |
| `signin.orDivider` | または | or |
| `signin.emailSignIn` | メール/パスワードでサインイン | Sign in with email/password |

### Related Files

| File | Role |
|------|------|
| `docker/nextjs/components/login-form.tsx` | Sign-in form (AD button added) |
| `docker/nextjs/src/app/api/auth/callback/route.ts` | OAuth callback API |
| `docker/nextjs/src/messages/{locale}.json` | Translation files (`signin` namespace) |


---

## Image Upload UI (Advanced RAG Features)

### ImageUploadZone

A drag-and-drop area and file picker button placed within the chat input area.

| Item | Specification |
|------|--------------|
| Placement | Inside the chat input form, to the left of the text input |
| Supported Formats | JPEG, PNG, GIF, WebP |
| Size Limit | 3MB |
| During Drag | Drop area highlighted (`border-blue-500 bg-blue-50`) |
| Error Display | Unsupported format → `imageUpload.invalidFormat`, Exceeds 3MB → `imageUpload.fileTooLarge` |
| i18n Keys | `imageUpload.dropzone`, `imageUpload.selectFile` |

### ImagePreview

Preview display of attached images. Placed above the input area.

| Item | Specification |
|------|--------------|
| Size | 80×80px, `object-cover` |
| Delete Button | "×" button in the upper right |

### ImageThumbnail

Image thumbnail within the chat message bubble.

| Item | Specification |
|------|--------------|
| Max Size | 200×200px, `object-contain` |
| alt Attribute | `imageUpload.uploadedImage` (i18n translation value) |
| Loading | Skeleton loader (`animate-pulse`) |
| Click | Full-size display in ImageModal |

### ImageModal

Full-size image display modal.

| Item | Specification |
|------|--------------|
| Max Size | 90vw × 90vh |
| Close | "×" button + background click |

---

## Knowledge Base Connection UI (Advanced RAG Features)

### KBSelector

Knowledge Base selection component within the Agent creation and edit forms.

| Item | Specification |
|------|--------------|
| Display Items | KB name, description, status badge, data source count |
| Status Badge Colors | ACTIVE → green, CREATING → blue, FAILED → red |
| Selection Restriction | Checkbox enabled only for ACTIVE |
| Multiple Selection | Supported (highlighted on selection) |
| Loading | Skeleton loader (3 rows) |
| Error | Error message + retry button |
| i18n Keys | `kbSelector.*` |

### ConnectedKBList

Connected KB list display within the Agent detail panel.

| Item | Specification |
|------|--------------|
| Display Items | KB name, description, status badge |
| When 0 items | Display `kbSelector.noKBConnected` message |

---

## Smart Routing UI (Advanced RAG Features)

### RoutingToggle

Smart Routing ON/OFF toggle placed in the sidebar settings section.

| Item | Specification |
|------|--------------|
| Placement | KB mode sidebar, below ModelSelector |
| Toggle | `role="switch"`, `aria-checked` |
| When ON | Display lightweight model name / high-performance model name pair (blue background) |
| When OFF | Model pair not displayed |
| Persistence | localStorage (`smart-routing-enabled` key) |
| Default | OFF |
| i18n Keys | `smartRouting.*` |

### ResponseMetadata

Model information display below assistant messages.

| Item | Specification |
|------|--------------|
| Model Name | Clickable (popover with details) |
| Auto Badge | Blue (`bg-blue-100`), when Smart Routing ON + auto-selected |
| Manual Badge | Gray (`bg-gray-100`), when manually overridden |
| Camera Icon | 📷, when image analysis is used |
| Tooltip | Classification result (simple/complex) + confidence |

### ModelSelector Extension

Adds an "Auto" option at the top of the model list when Smart Routing is ON.

| Item | Specification |
|------|--------------|
| Auto Option | ⚡ icon + `smartRouting.auto` label |
| When Selected | `isAutoMode = true` (Zustand store) |
| When Manually Selected | `isAutoMode = false` (manual override) |
| When Smart Routing OFF | Auto option hidden (no change to existing behavior) |

### Related Files

| File | Role |
|------|------|
| `docker/nextjs/src/types/image-upload.ts` | Image upload type definitions |
| `docker/nextjs/src/types/kb-selector.ts` | KB connection UI type definitions |
| `docker/nextjs/src/types/smart-routing.ts` | Smart Routing type definitions |
| `docker/nextjs/src/messages/{locale}.json` | Translation files (`imageUpload`, `kbSelector`, `smartRouting` namespaces) |