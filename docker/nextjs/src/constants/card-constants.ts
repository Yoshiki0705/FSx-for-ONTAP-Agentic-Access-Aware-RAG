// Card data definitions and helper functions for the card-based task UI
// Requirements: 2.4, 3.4, 8.1, 8.2, 8.3

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

// --- KB Mode Cards (8 cards) ---

export const KB_CARDS: CardData[] = [
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
];

// --- Agent Mode Categories ---

export const AGENT_CATEGORIES: CategoryData[] = [
  { id: 'all', labelKey: 'cards.categories.all', mode: 'agent' },
  { id: 'financial', labelKey: 'cards.categories.financial', mode: 'agent' },
  { id: 'project', labelKey: 'cards.categories.project', mode: 'agent' },
  { id: 'hr', labelKey: 'cards.categories.hr', mode: 'agent' },
  { id: 'search', labelKey: 'cards.categories.search', mode: 'agent' },
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
