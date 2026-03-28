// Card data definitions and helper functions for the card-based task UI
// Requirements: 2.4, 3.4, 8.1, 8.2, 8.3, 6.1, 6.2, 6.3, 6.4, 6.5

export interface AgentCategoryConfig {
  agentNamePattern: string;
  matchKeywords: string[];
  instruction: string;
  foundationModel: string;
  description: string;
}

export const AGENT_CATEGORY_MAP: Record<string, AgentCategoryConfig> = {
  financial: {
    agentNamePattern: 'financial-analysis-agent',
    matchKeywords: ['financial', 'finance', '財務', 'accounting'],
    instruction: `あなたは財務分析専門のAIエージェントです。
ユーザーの質問に対して、必ずpermissionAwareSearch機能を使って文書を検索してから回答してください。
財務レポート、予算、経費に関する質問に正確で簡潔な日本語の回答を生成してください。
permissionAwareSearchを使わずに回答しないでください。`,
    foundationModel: 'anthropic.claude-3-haiku-20240307-v1:0',
    description: '財務レポート分析・予算管理専門Agent',
  },
  project: {
    agentNamePattern: 'project-management-agent',
    matchKeywords: ['project', 'プロジェクト', 'milestone', 'task'],
    instruction: `あなたはプロジェクト管理専門のAIエージェントです。
ユーザーの質問に対して、必ずpermissionAwareSearch機能を使って文書を検索してから回答してください。
プロジェクト進捗、マイルストーン、タスク管理に関する質問に正確で簡潔な日本語の回答を生成してください。
permissionAwareSearchを使わずに回答しないでください。`,
    foundationModel: 'anthropic.claude-3-haiku-20240307-v1:0',
    description: 'プロジェクト進捗管理・マイルストーン追跡Agent',
  },
  hr: {
    agentNamePattern: 'hr-policy-agent',
    matchKeywords: ['hr', 'human-resource', '人事', 'policy', 'compliance'],
    instruction: `あなたは人事ポリシー専門のAIエージェントです。
ユーザーの質問に対して、必ずpermissionAwareSearch機能を使って文書を検索してから回答してください。
人事規定、コンプライアンス、福利厚生に関する質問に正確で簡潔な日本語の回答を生成してください。
permissionAwareSearchを使わずに回答しないでください。`,
    foundationModel: 'anthropic.claude-3-haiku-20240307-v1:0',
    description: '人事ポリシー・コンプライアンス確認Agent',
  },
  search: {
    agentNamePattern: 'cross-search-agent',
    matchKeywords: ['search', '検索', 'cross', 'data', 'analysis'],
    instruction: `あなたは文書横断検索専門のAIエージェントです。
ユーザーの質問に対して、必ずpermissionAwareSearch機能を使って文書を検索してから回答してください。
複数文書にまたがる情報を統合し、正確で簡潔な日本語の回答を生成してください。
permissionAwareSearchを使わずに回答しないでください。`,
    foundationModel: 'anthropic.claude-3-haiku-20240307-v1:0',
    description: '文書横断検索・データ分析Agent',
  },
  presentation: {
    agentNamePattern: 'presentation-creator-agent',
    matchKeywords: ['presentation', 'プレゼン', 'slide', 'スライド', 'pptx'],
    instruction: `あなたはプレゼンテーション資料作成専門のAIエージェントです。
ユーザーの質問に対して、必ずpermissionAwareSearch機能を使って社内文書を検索し、
その情報を基にプレゼンテーション資料の構成案（タイトル、各スライドの見出し・要点・話者ノート）を生成してください。
Markdown形式で出力し、各スライドを## で区切ってください。
permissionAwareSearchを使わずに回答しないでください。`,
    foundationModel: 'anthropic.claude-3-haiku-20240307-v1:0',
    description: '社内データを基にプレゼンテーション構成案を自動生成するAgent',
  },
  approval: {
    agentNamePattern: 'approval-document-agent',
    matchKeywords: ['approval', '稟議', '申請', 'ringi', 'request', '起案'],
    instruction: `あなたは稟議書・申請書類作成専門のAIエージェントです。
ユーザーの質問に対して、必ずpermissionAwareSearch機能を使って関連する社内規定・過去の稟議書を検索し、
その情報を基に稟議書のドラフト（件名、申請理由、予算、期待効果、リスク、承認者）を生成してください。
社内フォーマットに準拠した構造化された日本語の文書を出力してください。
permissionAwareSearchを使わずに回答しないでください。`,
    foundationModel: 'anthropic.claude-3-haiku-20240307-v1:0',
    description: '社内規定に基づく稟議書・申請書類のドラフト自動生成Agent',
  },
  minutes: {
    agentNamePattern: 'meeting-minutes-agent',
    matchKeywords: ['minutes', '議事録', 'meeting', '会議', 'summary', 'サマリー'],
    instruction: `あなたは議事録・会議サマリー作成専門のAIエージェントです。
ユーザーの質問に対して、必ずpermissionAwareSearch機能を使って関連する会議資料・プロジェクト文書を検索し、
その情報を基に構造化された議事録（日時、参加者、議題、決定事項、アクションアイテム、次回予定）を生成してください。
permissionAwareSearchを使わずに回答しないでください。`,
    foundationModel: 'anthropic.claude-3-haiku-20240307-v1:0',
    description: '会議内容を構造化して議事録・サマリーを自動生成するAgent',
  },
  report: {
    agentNamePattern: 'report-generator-agent',
    matchKeywords: ['report', 'レポート', '報告書', 'monthly', '月次', 'quarterly', '四半期'],
    instruction: `あなたは定期レポート・報告書作成専門のAIエージェントです。
ユーザーの質問に対して、必ずpermissionAwareSearch機能を使って社内データ・過去のレポートを検索し、
その情報を基に構造化されたレポート（エグゼクティブサマリー、主要指標、分析、課題、推奨アクション）を生成してください。
permissionAwareSearchを使わずに回答しないでください。`,
    foundationModel: 'anthropic.claude-3-haiku-20240307-v1:0',
    description: '社内データから定期レポート・報告書を自動生成するAgent',
  },
  contract: {
    agentNamePattern: 'contract-review-agent',
    matchKeywords: ['contract', '契約', 'review', 'レビュー', 'draft', 'ドラフト', 'NDA'],
    instruction: `あなたは契約書レビュー・ドラフト作成専門のAIエージェントです。
ユーザーの質問に対して、必ずpermissionAwareSearch機能を使って既存の契約テンプレート・社内規定を検索し、
その情報を基に契約書のドラフト作成またはリスク指摘（条項ごとのリスク評価、修正提案）を行ってください。
permissionAwareSearchを使わずに回答しないでください。`,
    foundationModel: 'anthropic.claude-3-haiku-20240307-v1:0',
    description: '契約テンプレートを基にドラフト作成・リスク指摘を行うAgent',
  },
  onboarding: {
    agentNamePattern: 'onboarding-guide-agent',
    matchKeywords: ['onboarding', 'オンボーディング', '新入社員', 'guide', 'ガイド', '入社'],
    instruction: `あなたはオンボーディング資料作成専門のAIエージェントです。
ユーザーの質問に対して、必ずpermissionAwareSearch機能を使って社内規定・部署情報・FAQ文書を検索し、
その情報を基に新入社員向けのガイド資料（部署概要、業務フロー、ツール一覧、FAQ、連絡先）を生成してください。
permissionAwareSearchを使わずに回答しないでください。`,
    foundationModel: 'anthropic.claude-3-haiku-20240307-v1:0',
    description: '新入社員向けの部署別ガイド・FAQ資料を自動生成するAgent',
  },
};

export interface WorkflowStep {
  id: string;
  titleKey: string;
  descriptionKey: string;
  order: number;
  status?: 'pending' | 'active' | 'completed' | 'error';
}

export interface CardData {
  id: string;
  icon: string;
  titleKey: string;
  descriptionKey: string;
  promptTemplateKey: string;
  category: string;
  mode: 'kb' | 'agent';
  agentId?: string;
  workflowType?: 'single' | 'multi';
  steps?: WorkflowStep[];
}

export interface CategoryData {
  id: string;
  labelKey: string;
  mode: 'kb' | 'agent';
}

// --- KB Mode Cards (8 existing + 6 output-oriented = 14 cards) ---

export const KB_CARDS: CardData[] = [
  // === 調査系カード（既存8枚） ===
  {
    id: 'kb-doc-search',
    icon: '🔍',
    titleKey: 'cards.kb.docSearch.title',
    descriptionKey: 'cards.kb.docSearch.description',
    promptTemplateKey: 'cards.kb.docSearch.prompt',
    category: 'search',
    mode: 'kb',
  },
  {
    id: 'kb-doc-summary',
    icon: '📝',
    titleKey: 'cards.kb.docSummary.title',
    descriptionKey: 'cards.kb.docSummary.description',
    promptTemplateKey: 'cards.kb.docSummary.prompt',
    category: 'summary',
    mode: 'kb',
  },
  {
    id: 'kb-quiz-gen',
    icon: '📚',
    titleKey: 'cards.kb.quizGen.title',
    descriptionKey: 'cards.kb.quizGen.description',
    promptTemplateKey: 'cards.kb.quizGen.prompt',
    category: 'learning',
    mode: 'kb',
  },
  {
    id: 'kb-compare',
    icon: '⚖️',
    titleKey: 'cards.kb.compare.title',
    descriptionKey: 'cards.kb.compare.description',
    promptTemplateKey: 'cards.kb.compare.prompt',
    category: 'analysis',
    mode: 'kb',
  },
  {
    id: 'kb-keyword-search',
    icon: '🏷️',
    titleKey: 'cards.kb.keywordSearch.title',
    descriptionKey: 'cards.kb.keywordSearch.description',
    promptTemplateKey: 'cards.kb.keywordSearch.prompt',
    category: 'search',
    mode: 'kb',
  },
  {
    id: 'kb-report-summary',
    icon: '📊',
    titleKey: 'cards.kb.reportSummary.title',
    descriptionKey: 'cards.kb.reportSummary.description',
    promptTemplateKey: 'cards.kb.reportSummary.prompt',
    category: 'summary',
    mode: 'kb',
  },
  {
    id: 'kb-qa-gen',
    icon: '❓',
    titleKey: 'cards.kb.qaGen.title',
    descriptionKey: 'cards.kb.qaGen.description',
    promptTemplateKey: 'cards.kb.qaGen.prompt',
    category: 'learning',
    mode: 'kb',
  },
  {
    id: 'kb-trend-analysis',
    icon: '📈',
    titleKey: 'cards.kb.trendAnalysis.title',
    descriptionKey: 'cards.kb.trendAnalysis.description',
    promptTemplateKey: 'cards.kb.trendAnalysis.prompt',
    category: 'analysis',
    mode: 'kb',
  },
  // === アウトプット指向カード（新規6枚） ===
  {
    id: 'kb-presentation',
    icon: '🎬',
    titleKey: 'cards.kb.presentation.title',
    descriptionKey: 'cards.kb.presentation.description',
    promptTemplateKey: 'cards.kb.presentation.prompt',
    category: 'output',
    mode: 'kb',
  },
  {
    id: 'kb-approval',
    icon: '📋',
    titleKey: 'cards.kb.approval.title',
    descriptionKey: 'cards.kb.approval.description',
    promptTemplateKey: 'cards.kb.approval.prompt',
    category: 'output',
    mode: 'kb',
  },
  {
    id: 'kb-minutes',
    icon: '🗒️',
    titleKey: 'cards.kb.minutes.title',
    descriptionKey: 'cards.kb.minutes.description',
    promptTemplateKey: 'cards.kb.minutes.prompt',
    category: 'output',
    mode: 'kb',
  },
  {
    id: 'kb-report-gen',
    icon: '📑',
    titleKey: 'cards.kb.reportGen.title',
    descriptionKey: 'cards.kb.reportGen.description',
    promptTemplateKey: 'cards.kb.reportGen.prompt',
    category: 'output',
    mode: 'kb',
  },
  {
    id: 'kb-contract',
    icon: '📄',
    titleKey: 'cards.kb.contract.title',
    descriptionKey: 'cards.kb.contract.description',
    promptTemplateKey: 'cards.kb.contract.prompt',
    category: 'output',
    mode: 'kb',
  },
  {
    id: 'kb-onboarding',
    icon: '🎓',
    titleKey: 'cards.kb.onboarding.title',
    descriptionKey: 'cards.kb.onboarding.description',
    promptTemplateKey: 'cards.kb.onboarding.prompt',
    category: 'output',
    mode: 'kb',
  },
];

// --- Agent Mode Cards (8 cards) ---

export const AGENT_CARDS: CardData[] = [
  {
    id: 'agent-financial',
    icon: '📊',
    titleKey: 'cards.agent.financial.title',
    descriptionKey: 'cards.agent.financial.description',
    promptTemplateKey: 'cards.agent.financial.prompt',
    category: 'financial',
    mode: 'agent',
  },
  {
    id: 'agent-project',
    icon: '📝',
    titleKey: 'cards.agent.project.title',
    descriptionKey: 'cards.agent.project.description',
    promptTemplateKey: 'cards.agent.project.prompt',
    category: 'project',
    mode: 'agent',
  },
  {
    id: 'agent-cross-search',
    icon: '🔍',
    titleKey: 'cards.agent.crossSearch.title',
    descriptionKey: 'cards.agent.crossSearch.description',
    promptTemplateKey: 'cards.agent.crossSearch.prompt',
    category: 'search',
    mode: 'agent',
  },
  {
    id: 'agent-hr',
    icon: '📋',
    titleKey: 'cards.agent.hr.title',
    descriptionKey: 'cards.agent.hr.description',
    promptTemplateKey: 'cards.agent.hr.prompt',
    category: 'hr',
    mode: 'agent',
  },
  {
    id: 'agent-risk',
    icon: '⚠️',
    titleKey: 'cards.agent.risk.title',
    descriptionKey: 'cards.agent.risk.description',
    promptTemplateKey: 'cards.agent.risk.prompt',
    category: 'financial',
    mode: 'agent',
  },
  {
    id: 'agent-milestone',
    icon: '🎯',
    titleKey: 'cards.agent.milestone.title',
    descriptionKey: 'cards.agent.milestone.description',
    promptTemplateKey: 'cards.agent.milestone.prompt',
    category: 'project',
    mode: 'agent',
  },
  {
    id: 'agent-compliance',
    icon: '🔐',
    titleKey: 'cards.agent.compliance.title',
    descriptionKey: 'cards.agent.compliance.description',
    promptTemplateKey: 'cards.agent.compliance.prompt',
    category: 'hr',
    mode: 'agent',
  },
  {
    id: 'agent-data-analysis',
    icon: '📉',
    titleKey: 'cards.agent.dataAnalysis.title',
    descriptionKey: 'cards.agent.dataAnalysis.description',
    promptTemplateKey: 'cards.agent.dataAnalysis.prompt',
    category: 'search',
    mode: 'agent',
  },
  {
    id: 'agent-presentation',
    icon: '📊',
    titleKey: 'cards.agent.presentation.title',
    descriptionKey: 'cards.agent.presentation.description',
    promptTemplateKey: 'cards.agent.presentation.prompt',
    category: 'presentation',
    mode: 'agent',
  },
  {
    id: 'agent-approval',
    icon: '📋',
    titleKey: 'cards.agent.approval.title',
    descriptionKey: 'cards.agent.approval.description',
    promptTemplateKey: 'cards.agent.approval.prompt',
    category: 'approval',
    mode: 'agent',
  },
  {
    id: 'agent-minutes',
    icon: '📝',
    titleKey: 'cards.agent.minutes.title',
    descriptionKey: 'cards.agent.minutes.description',
    promptTemplateKey: 'cards.agent.minutes.prompt',
    category: 'minutes',
    mode: 'agent',
  },
  {
    id: 'agent-report',
    icon: '📈',
    titleKey: 'cards.agent.report.title',
    descriptionKey: 'cards.agent.report.description',
    promptTemplateKey: 'cards.agent.report.prompt',
    category: 'report',
    mode: 'agent',
  },
  {
    id: 'agent-contract',
    icon: '📄',
    titleKey: 'cards.agent.contract.title',
    descriptionKey: 'cards.agent.contract.description',
    promptTemplateKey: 'cards.agent.contract.prompt',
    category: 'contract',
    mode: 'agent',
  },
  {
    id: 'agent-onboarding',
    icon: '🎓',
    titleKey: 'cards.agent.onboarding.title',
    descriptionKey: 'cards.agent.onboarding.description',
    promptTemplateKey: 'cards.agent.onboarding.prompt',
    category: 'onboarding',
    mode: 'agent',
  },
];

// --- All Cards ---

export const ALL_CARDS: CardData[] = [...KB_CARDS, ...AGENT_CARDS];

// --- KB Mode Categories ---

export const KB_CATEGORIES: CategoryData[] = [
  { id: 'all', labelKey: 'cards.categories.all', mode: 'kb' },
  { id: 'search', labelKey: 'cards.categories.search', mode: 'kb' },
  { id: 'summary', labelKey: 'cards.categories.summary', mode: 'kb' },
  { id: 'learning', labelKey: 'cards.categories.learning', mode: 'kb' },
  { id: 'analysis', labelKey: 'cards.categories.analysis', mode: 'kb' },
  { id: 'output', labelKey: 'cards.categories.output', mode: 'kb' },
];

// --- Agent Mode Categories ---

export const AGENT_CATEGORIES: CategoryData[] = [
  { id: 'all', labelKey: 'cards.categories.all', mode: 'agent' },
  { id: 'financial', labelKey: 'cards.categories.financial', mode: 'agent' },
  { id: 'project', labelKey: 'cards.categories.project', mode: 'agent' },
  { id: 'hr', labelKey: 'cards.categories.hr', mode: 'agent' },
  { id: 'search', labelKey: 'cards.categories.search', mode: 'agent' },
  { id: 'presentation', labelKey: 'cards.categories.presentation', mode: 'agent' },
  { id: 'approval', labelKey: 'cards.categories.approval', mode: 'agent' },
  { id: 'minutes', labelKey: 'cards.categories.minutes', mode: 'agent' },
  { id: 'report', labelKey: 'cards.categories.report', mode: 'agent' },
  { id: 'contract', labelKey: 'cards.categories.contract', mode: 'agent' },
  { id: 'onboarding', labelKey: 'cards.categories.onboarding', mode: 'agent' },
];

// --- Helper Functions ---

export function getCardsByMode(mode: 'kb' | 'agent'): CardData[] {
  return mode === 'kb' ? KB_CARDS : AGENT_CARDS;
}

export function getCategoriesByMode(mode: 'kb' | 'agent'): CategoryData[] {
  return mode === 'kb' ? KB_CATEGORIES : AGENT_CATEGORIES;
}

export function filterCardsByCategory(cards: CardData[], category: string): CardData[] {
  if (category === 'all') return cards;
  return cards.filter((card) => card.category === category);
}

export function sortCardsByFavorites(cards: CardData[], favorites: string[]): CardData[] {
  const favoriteSet = new Set(favorites);
  const favoriteCards = cards.filter((card) => favoriteSet.has(card.id));
  const nonFavoriteCards = cards.filter((card) => !favoriteSet.has(card.id));
  return [...favoriteCards, ...nonFavoriteCards];
}
