import { AlertTriangle, Banknote, BarChart3, BookOpen, Building2, Car, Clapperboard, ClipboardList, Cpu, Factory, FileText, Files, FlaskConical, Gavel, GraduationCap, HardHat, HeartPulse, HelpCircle, Landmark, Leaf, Library, Lock, Plane, RadioTower, Scale, Search, ShieldCheck, ShoppingCart, StickyNote, Tag, Target, TrendingDown, TrendingUp, Truck, Users, Wheat, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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
    foundationModel: 'anthropic.claude-haiku-4-5-20251001-v1:0',
    description: '財務レポート分析・予算管理専門Agent',
  },
  project: {
    agentNamePattern: 'project-management-agent',
    matchKeywords: ['project', 'プロジェクト', 'milestone', 'task'],
    instruction: `あなたはプロジェクト管理専門のAIエージェントです。
ユーザーの質問に対して、必ずpermissionAwareSearch機能を使って文書を検索してから回答してください。
プロジェクト進捗、マイルストーン、タスク管理に関する質問に正確で簡潔な日本語の回答を生成してください。
permissionAwareSearchを使わずに回答しないでください。`,
    foundationModel: 'anthropic.claude-haiku-4-5-20251001-v1:0',
    description: 'プロジェクト進捗管理・マイルストーン追跡Agent',
  },
  hr: {
    agentNamePattern: 'hr-policy-agent',
    matchKeywords: ['hr', 'human-resource', '人事', 'policy', 'compliance'],
    instruction: `あなたは人事ポリシー専門のAIエージェントです。
ユーザーの質問に対して、必ずpermissionAwareSearch機能を使って文書を検索してから回答してください。
人事規定、コンプライアンス、福利厚生に関する質問に正確で簡潔な日本語の回答を生成してください。
permissionAwareSearchを使わずに回答しないでください。`,
    foundationModel: 'anthropic.claude-haiku-4-5-20251001-v1:0',
    description: '人事ポリシー・コンプライアンス確認Agent',
  },
  search: {
    agentNamePattern: 'cross-search-agent',
    matchKeywords: ['search', '検索', 'cross', 'data', 'analysis'],
    instruction: `あなたは文書横断検索専門のAIエージェントです。
ユーザーの質問に対して、必ずpermissionAwareSearch機能を使って文書を検索してから回答してください。
複数文書にまたがる情報を統合し、正確で簡潔な日本語の回答を生成してください。
permissionAwareSearchを使わずに回答しないでください。`,
    foundationModel: 'anthropic.claude-haiku-4-5-20251001-v1:0',
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
    foundationModel: 'anthropic.claude-haiku-4-5-20251001-v1:0',
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
    foundationModel: 'anthropic.claude-haiku-4-5-20251001-v1:0',
    description: '社内規定に基づく稟議書・申請書類のドラフト自動生成Agent',
  },
  minutes: {
    agentNamePattern: 'meeting-minutes-agent',
    matchKeywords: ['minutes', '議事録', 'meeting', '会議', 'summary', 'サマリー'],
    instruction: `あなたは議事録・会議サマリー作成専門のAIエージェントです。
ユーザーの質問に対して、必ずpermissionAwareSearch機能を使って関連する会議資料・プロジェクト文書を検索し、
その情報を基に構造化された議事録（日時、参加者、議題、決定事項、アクションアイテム、次回予定）を生成してください。
permissionAwareSearchを使わずに回答しないでください。`,
    foundationModel: 'anthropic.claude-haiku-4-5-20251001-v1:0',
    description: '会議内容を構造化して議事録・サマリーを自動生成するAgent',
  },
  report: {
    agentNamePattern: 'report-generator-agent',
    matchKeywords: ['report', 'レポート', '報告書', 'monthly', '月次', 'quarterly', '四半期'],
    instruction: `あなたは定期レポート・報告書作成専門のAIエージェントです。
ユーザーの質問に対して、必ずpermissionAwareSearch機能を使って社内データ・過去のレポートを検索し、
その情報を基に構造化されたレポート（エグゼクティブサマリー、主要指標、分析、課題、推奨アクション）を生成してください。
permissionAwareSearchを使わずに回答しないでください。`,
    foundationModel: 'anthropic.claude-haiku-4-5-20251001-v1:0',
    description: '社内データから定期レポート・報告書を自動生成するAgent',
  },
  contract: {
    agentNamePattern: 'contract-review-agent',
    matchKeywords: ['contract', '契約', 'review', 'レビュー', 'draft', 'ドラフト', 'NDA'],
    instruction: `あなたは契約書レビュー・ドラフト作成専門のAIエージェントです。
ユーザーの質問に対して、必ずpermissionAwareSearch機能を使って既存の契約テンプレート・社内規定を検索し、
その情報を基に契約書のドラフト作成またはリスク指摘（条項ごとのリスク評価、修正提案）を行ってください。
permissionAwareSearchを使わずに回答しないでください。`,
    foundationModel: 'anthropic.claude-haiku-4-5-20251001-v1:0',
    description: '契約テンプレートを基にドラフト作成・リスク指摘を行うAgent',
  },
  onboarding: {
    agentNamePattern: 'onboarding-guide-agent',
    matchKeywords: ['onboarding', 'オンボーディング', '新入社員', 'guide', 'ガイド', '入社'],
    instruction: `あなたはオンボーディング資料作成専門のAIエージェントです。
ユーザーの質問に対して、必ずpermissionAwareSearch機能を使って社内規定・部署情報・FAQ文書を検索し、
その情報を基に新入社員向けのガイド資料（部署概要、業務フロー、ツール一覧、FAQ、連絡先）を生成してください。
permissionAwareSearchを使わずに回答しないでください。`,
    foundationModel: 'anthropic.claude-haiku-4-5-20251001-v1:0',
    description: '新入社員向けの部署別ガイド・FAQ資料を自動生成するAgent',
  },
  // --- 公共セクター向けテンプレート ---
  publicDocument: {
    agentNamePattern: 'public-document-agent',
    matchKeywords: ['公文書', '通達', '通知', '公共', 'official', 'government', '行政'],
    instruction: `あなたは公文書・行政文書作成専門のAIエージェントです。
ユーザーの質問に対して、必ずpermissionAwareSearch機能を使って関連する規定・過去の通達・法令情報を検索し、
その情報を基に公文書のドラフト（件名、宛先、本文、根拠法令、施行日、担当部署）を生成してください。
行政文書の形式・用語に準拠した構造化された日本語の文書を出力してください。
permissionAwareSearchを使わずに回答しないでください。`,
    foundationModel: 'anthropic.claude-haiku-4-5-20251001-v1:0',
    description: '規定・法令に基づく公文書・通達のドラフト自動生成Agent（公共セクター向け）',
  },
  policyBrief: {
    agentNamePattern: 'policy-brief-agent',
    matchKeywords: ['政策', '概要', 'policy', 'brief', '要約', '議会', '答弁'],
    instruction: `あなたは政策概要・議会答弁資料作成専門のAIエージェントです。
ユーザーの質問に対して、必ずpermissionAwareSearch機能を使って関連する政策文書・統計データ・過去の答弁を検索し、
その情報を基に政策概要（背景、課題、施策内容、期待効果、予算、スケジュール）または
議会答弁資料（質問要旨、回答案、根拠データ、補足説明）を生成してください。
permissionAwareSearchを使わずに回答しないでください。`,
    foundationModel: 'anthropic.claude-haiku-4-5-20251001-v1:0',
    description: '政策概要・議会答弁資料の自動生成Agent（公共セクター向け）',
  },
  // --- 医療セクター向けテンプレート ---
  medicalGuideline: {
    agentNamePattern: 'medical-guideline-agent',
    matchKeywords: ['診療', 'ガイドライン', '手順書', '医療', 'clinical', 'guideline', 'medical', '処方'],
    instruction: `あなたは診療ガイドライン・医療手順書検索専門のAIエージェントです。
ユーザーの質問に対して、必ずpermissionAwareSearch機能を使って診療ガイドライン・手順書・薬剤情報を検索し、
その情報を基に正確で簡潔な回答を生成してください。
重要: 医療診断や処方の推奨は行わないでください。あくまでガイドラインの参照情報を提供してください。
患者固有の判断は必ず担当医師に委ねてください。
permissionAwareSearchを使わずに回答しないでください。`,
    foundationModel: 'anthropic.claude-haiku-4-5-20251001-v1:0',
    description: '診療ガイドライン・手順書の検索・参照Agent（医療セクター向け、診断禁止）',
  },
  // --- 法務セクター向けテンプレート ---
  legalCompliance: {
    agentNamePattern: 'legal-compliance-agent',
    matchKeywords: ['法務', 'コンプライアンス', '契約', 'legal', 'compliance', 'NDA', '規制', 'GDPR'],
    instruction: `あなたは法務・コンプライアンス専門のAIエージェントです。
ユーザーの質問に対して、必ずpermissionAwareSearch機能を使って契約書テンプレート・コンプライアンスチェックリスト・社内規定を検索し、
その情報を基に契約条項のリスク評価、コンプライアンス確認事項、法的留意点を回答してください。
重要: 法的助言は行わないでください。あくまで社内文書に基づく参考情報を提供してください。
最終判断は必ず法務部門または弁護士に委ねてください。
permissionAwareSearchを使わずに回答しないでください。`,
    foundationModel: 'anthropic.claude-haiku-4-5-20251001-v1:0',
    description: '契約書レビュー・コンプライアンスチェック支援Agent（法務セクター向け、法的助言禁止）',
  },
  // --- 保険セクター向けテンプレート ---
  insuranceClaim: {
    agentNamePattern: 'insurance-claim-agent',
    matchKeywords: ['保険', '査定', '請求', 'insurance', 'claim', '損害', '見積'],
    instruction: `あなたは保険査定・請求処理支援専門のAIエージェントです。
ユーザーの質問に対して、必ずpermissionAwareSearch機能を使って過去の査定レポート・見積書・査定基準を検索し、
その情報を基に類似事例の参照、査定ポイントの整理、必要書類の確認を支援してください。
permissionAwareSearchを使わずに回答しないでください。`,
    foundationModel: 'anthropic.claude-haiku-4-5-20251001-v1:0',
    description: '保険査定・請求処理の過去事例参照・支援Agent（保険セクター向け）',
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
  icon: LucideIcon;
  titleKey: string;
  descriptionKey: string;
  promptTemplateKey: string;
  category: string;
  mode: 'kb' | 'agent';
  agentId?: string;
  workflowType?: 'single' | 'multi';
  steps?: WorkflowStep[];
  /** Industry id (KB mode industry cards only). Undefined for the general-purpose cards. */
  industry?: string;
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
    icon: Search,
    titleKey: 'cards.kb.docSearch.title',
    descriptionKey: 'cards.kb.docSearch.description',
    promptTemplateKey: 'cards.kb.docSearch.prompt',
    category: 'search',
    mode: 'kb',
  },
  {
    id: 'kb-doc-summary',
    icon: FileText,
    titleKey: 'cards.kb.docSummary.title',
    descriptionKey: 'cards.kb.docSummary.description',
    promptTemplateKey: 'cards.kb.docSummary.prompt',
    category: 'summary',
    mode: 'kb',
  },
  {
    id: 'kb-quiz-gen',
    icon: Library,
    titleKey: 'cards.kb.quizGen.title',
    descriptionKey: 'cards.kb.quizGen.description',
    promptTemplateKey: 'cards.kb.quizGen.prompt',
    category: 'learning',
    mode: 'kb',
  },
  {
    id: 'kb-compare',
    icon: Scale,
    titleKey: 'cards.kb.compare.title',
    descriptionKey: 'cards.kb.compare.description',
    promptTemplateKey: 'cards.kb.compare.prompt',
    category: 'analysis',
    mode: 'kb',
  },
  {
    id: 'kb-keyword-search',
    icon: Tag,
    titleKey: 'cards.kb.keywordSearch.title',
    descriptionKey: 'cards.kb.keywordSearch.description',
    promptTemplateKey: 'cards.kb.keywordSearch.prompt',
    category: 'search',
    mode: 'kb',
  },
  {
    id: 'kb-report-summary',
    icon: BarChart3,
    titleKey: 'cards.kb.reportSummary.title',
    descriptionKey: 'cards.kb.reportSummary.description',
    promptTemplateKey: 'cards.kb.reportSummary.prompt',
    category: 'summary',
    mode: 'kb',
  },
  {
    id: 'kb-qa-gen',
    icon: HelpCircle,
    titleKey: 'cards.kb.qaGen.title',
    descriptionKey: 'cards.kb.qaGen.description',
    promptTemplateKey: 'cards.kb.qaGen.prompt',
    category: 'learning',
    mode: 'kb',
  },
  {
    id: 'kb-trend-analysis',
    icon: TrendingUp,
    titleKey: 'cards.kb.trendAnalysis.title',
    descriptionKey: 'cards.kb.trendAnalysis.description',
    promptTemplateKey: 'cards.kb.trendAnalysis.prompt',
    category: 'analysis',
    mode: 'kb',
  },
  // === アウトプット指向カード（新規6枚） ===
  {
    id: 'kb-presentation',
    icon: Clapperboard,
    titleKey: 'cards.kb.presentation.title',
    descriptionKey: 'cards.kb.presentation.description',
    promptTemplateKey: 'cards.kb.presentation.prompt',
    category: 'output',
    mode: 'kb',
  },
  {
    id: 'kb-approval',
    icon: ClipboardList,
    titleKey: 'cards.kb.approval.title',
    descriptionKey: 'cards.kb.approval.description',
    promptTemplateKey: 'cards.kb.approval.prompt',
    category: 'output',
    mode: 'kb',
  },
  {
    id: 'kb-minutes',
    icon: StickyNote,
    titleKey: 'cards.kb.minutes.title',
    descriptionKey: 'cards.kb.minutes.description',
    promptTemplateKey: 'cards.kb.minutes.prompt',
    category: 'output',
    mode: 'kb',
  },
  {
    id: 'kb-report-gen',
    icon: Files,
    titleKey: 'cards.kb.reportGen.title',
    descriptionKey: 'cards.kb.reportGen.description',
    promptTemplateKey: 'cards.kb.reportGen.prompt',
    category: 'output',
    mode: 'kb',
  },
  {
    id: 'kb-contract',
    icon: FileText,
    titleKey: 'cards.kb.contract.title',
    descriptionKey: 'cards.kb.contract.description',
    promptTemplateKey: 'cards.kb.contract.prompt',
    category: 'output',
    mode: 'kb',
  },
  {
    id: 'kb-onboarding',
    icon: GraduationCap,
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
    icon: BarChart3,
    titleKey: 'cards.agent.financial.title',
    descriptionKey: 'cards.agent.financial.description',
    promptTemplateKey: 'cards.agent.financial.prompt',
    category: 'financial',
    mode: 'agent',
  },
  {
    id: 'agent-project',
    icon: FileText,
    titleKey: 'cards.agent.project.title',
    descriptionKey: 'cards.agent.project.description',
    promptTemplateKey: 'cards.agent.project.prompt',
    category: 'project',
    mode: 'agent',
  },
  {
    id: 'agent-cross-search',
    icon: Search,
    titleKey: 'cards.agent.crossSearch.title',
    descriptionKey: 'cards.agent.crossSearch.description',
    promptTemplateKey: 'cards.agent.crossSearch.prompt',
    category: 'search',
    mode: 'agent',
  },
  {
    id: 'agent-hr',
    icon: ClipboardList,
    titleKey: 'cards.agent.hr.title',
    descriptionKey: 'cards.agent.hr.description',
    promptTemplateKey: 'cards.agent.hr.prompt',
    category: 'hr',
    mode: 'agent',
  },
  {
    id: 'agent-risk',
    icon: AlertTriangle,
    titleKey: 'cards.agent.risk.title',
    descriptionKey: 'cards.agent.risk.description',
    promptTemplateKey: 'cards.agent.risk.prompt',
    category: 'financial',
    mode: 'agent',
  },
  {
    id: 'agent-milestone',
    icon: Target,
    titleKey: 'cards.agent.milestone.title',
    descriptionKey: 'cards.agent.milestone.description',
    promptTemplateKey: 'cards.agent.milestone.prompt',
    category: 'project',
    mode: 'agent',
  },
  {
    id: 'agent-compliance',
    icon: Lock,
    titleKey: 'cards.agent.compliance.title',
    descriptionKey: 'cards.agent.compliance.description',
    promptTemplateKey: 'cards.agent.compliance.prompt',
    category: 'hr',
    mode: 'agent',
  },
  {
    id: 'agent-data-analysis',
    icon: TrendingDown,
    titleKey: 'cards.agent.dataAnalysis.title',
    descriptionKey: 'cards.agent.dataAnalysis.description',
    promptTemplateKey: 'cards.agent.dataAnalysis.prompt',
    category: 'search',
    mode: 'agent',
  },
  {
    id: 'agent-presentation',
    icon: BarChart3,
    titleKey: 'cards.agent.presentation.title',
    descriptionKey: 'cards.agent.presentation.description',
    promptTemplateKey: 'cards.agent.presentation.prompt',
    category: 'presentation',
    mode: 'agent',
  },
  {
    id: 'agent-approval',
    icon: ClipboardList,
    titleKey: 'cards.agent.approval.title',
    descriptionKey: 'cards.agent.approval.description',
    promptTemplateKey: 'cards.agent.approval.prompt',
    category: 'approval',
    mode: 'agent',
  },
  {
    id: 'agent-minutes',
    icon: FileText,
    titleKey: 'cards.agent.minutes.title',
    descriptionKey: 'cards.agent.minutes.description',
    promptTemplateKey: 'cards.agent.minutes.prompt',
    category: 'minutes',
    mode: 'agent',
  },
  {
    id: 'agent-report',
    icon: TrendingUp,
    titleKey: 'cards.agent.report.title',
    descriptionKey: 'cards.agent.report.description',
    promptTemplateKey: 'cards.agent.report.prompt',
    category: 'report',
    mode: 'agent',
  },
  {
    id: 'agent-contract',
    icon: FileText,
    titleKey: 'cards.agent.contract.title',
    descriptionKey: 'cards.agent.contract.description',
    promptTemplateKey: 'cards.agent.contract.prompt',
    category: 'contract',
    mode: 'agent',
  },
  {
    id: 'agent-onboarding',
    icon: GraduationCap,
    titleKey: 'cards.agent.onboarding.title',
    descriptionKey: 'cards.agent.onboarding.description',
    promptTemplateKey: 'cards.agent.onboarding.prompt',
    category: 'onboarding',
    mode: 'agent',
  },
];

// --- Industry Cards (KB mode) ---
// Three cards per industry (find / draft / check). Strings live under cards.industries.* and cards.industry.* in messages/*.json.
export interface IndustryData {
  id: string;
  icon: LucideIcon;
  labelKey: string;
}
export const INDUSTRIES: IndustryData[] = [
  { id: 'government', icon: Landmark, labelKey: 'cards.industries.government' },
  { id: 'healthcare', icon: HeartPulse, labelKey: 'cards.industries.healthcare' },
  { id: 'legal', icon: Gavel, labelKey: 'cards.industries.legal' },
  { id: 'insurance', icon: ShieldCheck, labelKey: 'cards.industries.insurance' },
  { id: 'manufacturing', icon: Factory, labelKey: 'cards.industries.manufacturing' },
  { id: 'construction', icon: HardHat, labelKey: 'cards.industries.construction' },
  { id: 'education', icon: BookOpen, labelKey: 'cards.industries.education' },
  { id: 'financial', icon: Banknote, labelKey: 'cards.industries.financial' },
  { id: 'media', icon: Clapperboard, labelKey: 'cards.industries.media' },
  { id: 'semiconductor', icon: Cpu, labelKey: 'cards.industries.semiconductor' },
  { id: 'lifesciences', icon: FlaskConical, labelKey: 'cards.industries.lifesciences' },
  { id: 'energy', icon: Zap, labelKey: 'cards.industries.energy' },
  { id: 'automotive', icon: Car, labelKey: 'cards.industries.automotive' },
  { id: 'retail', icon: ShoppingCart, labelKey: 'cards.industries.retail' },
  { id: 'logistics', icon: Truck, labelKey: 'cards.industries.logistics' },
  { id: 'telecom', icon: RadioTower, labelKey: 'cards.industries.telecom' },
  { id: 'agrifood', icon: Wheat, labelKey: 'cards.industries.agrifood' },
  { id: 'realestate', icon: Building2, labelKey: 'cards.industries.realestate' },
  { id: 'hr', icon: Users, labelKey: 'cards.industries.hr' },
  { id: 'esg', icon: Leaf, labelKey: 'cards.industries.esg' },
  { id: 'travel', icon: Plane, labelKey: 'cards.industries.travel' },
];
function industryCards(industry: IndustryData, icons: [LucideIcon, LucideIcon, LucideIcon]): CardData[] {
  const slots = [['find', 'search'], ['draft', 'output'], ['check', 'analysis']] as const;
  return slots.map(([slot, category], i) => ({
    id: `kb-ind-${industry.id}-${slot}`,
    icon: icons[i],
    titleKey: `cards.industry.${industry.id}.${slot}.title`,
    descriptionKey: `cards.industry.${industry.id}.${slot}.description`,
    promptTemplateKey: `cards.industry.${industry.id}.${slot}.prompt`,
    category,
    mode: 'kb' as const,
    industry: industry.id,
  }));
}
const INDUSTRY_SLOT_ICONS: [LucideIcon, LucideIcon, LucideIcon] = [Search, FileText, ClipboardList];
export const INDUSTRY_CARDS: CardData[] = INDUSTRIES.flatMap((industry) => industryCards(industry, INDUSTRY_SLOT_ICONS));
export function getIndustryCards(industryId: string): CardData[] {
  return INDUSTRY_CARDS.filter((card) => card.industry === industryId);
}
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
