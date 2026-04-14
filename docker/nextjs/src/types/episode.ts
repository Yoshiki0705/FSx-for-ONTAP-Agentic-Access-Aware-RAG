/**
 * エピソード記憶（Episodic Memory）型定義
 *
 * AgentCore Memory の episodicMemoryStrategy から取得されるエピソードデータの型。
 * 各エピソードは1つのタスク実行に対応し、goal, steps, actions, outcome, reflection を含む。
 */

export interface EpisodeStep {
  /** ステップ番号 */
  order: number;
  /** 推論内容 */
  reasoning: string;
}

export interface EpisodeAction {
  /** アクション名 */
  name: string;
  /** アクション入力 */
  input?: string;
  /** アクション結果 */
  result?: string;
}

export interface EpisodeOutcome {
  /** ステータス: success | partial | failure */
  status: 'success' | 'partial' | 'failure';
  /** 結果サマリー */
  summary: string;
}

export interface Episode {
  /** エピソードID (AgentCore Memory の memoryRecordId) */
  id: string;
  /** 目標 (goal) */
  goal: string;
  /** 推論ステップ */
  steps: EpisodeStep[];
  /** 実行アクション */
  actions: EpisodeAction[];
  /** 結果 */
  outcome: EpisodeOutcome;
  /** 振り返り */
  reflection: string;
  /** 作成日時 */
  createdAt: string;
  /** 関連度スコア（検索結果時のみ） */
  score?: number;
  /** メタデータ */
  metadata?: Record<string, unknown>;
}
