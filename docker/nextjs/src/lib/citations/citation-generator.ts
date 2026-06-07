/**
 * Citation Generator — RAG応答からソース帰属情報を生成
 *
 * KB Retrieve結果からinline citation markers ([1], [2]) を生成し、
 * 各citationにPermission Boundary Typeを付与する。
 *
 * @see .kiro/specs/claude-platform-integration/requirements.md — Requirement 3, 4
 */

import type { Citation, CitedResponse, PermissionBoundaryType } from '@/types/permission-boundary';

/**
 * KB Retrieve結果の1件を表すインターフェース
 */
export interface RetrieveResult {
  /** ドキュメント名（ファイル名） */
  fileName: string;
  /** チャンクテキスト */
  content: string;
  /** S3 source URI */
  sourceUri?: string;
  /** 検索スコア (0.0-1.0) */
  score?: number;
  /** ソースタイプ */
  sourceType?: 'kb' | 'web';
}

/**
 * 検索結果からCitation配列を生成する。
 *
 * - 同一ドキュメントの複数チャンクは1つのCitationに統合
 * - 各Citationにexcerpt（最初の200文字）を付与
 * - Permission Boundary TypeはsourceTypeに基づいて決定
 */
export function generateCitations(results: RetrieveResult[]): Citation[] {
  const citationMap = new Map<string, Citation>();
  let index = 1;

  for (const result of results) {
    const key = result.fileName;

    if (citationMap.has(key)) {
      // 同一ドキュメントの追加チャンク — excerptは更新しない（最初のチャンクを使用）
      continue;
    }

    const sourceType = result.sourceType || 'kb';
    const boundaryType: PermissionBoundaryType = sourceType === 'web' ? 'reference' : 'verified';

    citationMap.set(key, {
      index,
      sourceType,
      boundaryType,
      sourceName: result.fileName,
      sourcePath: result.sourceUri,
      excerpt: result.content.substring(0, 200),
      relevanceScore: result.score ?? 0,
      permissionVerified: sourceType === 'kb', // KB results are always permission-verified
    });

    index++;
  }

  return Array.from(citationMap.values());
}

/**
 * モデル応答テキストにinline citation markers を挿入する。
 *
 * 応答テキスト内でソースドキュメント名が言及されている箇所に [N] を付与。
 * ドキュメント名が明示されていない場合は末尾にcitation listを追加。
 */
export function insertCitationMarkers(
  responseText: string,
  citations: Citation[],
): string {
  let annotatedText = responseText;

  // Strategy: ドキュメント名の言及箇所に [N] を挿入
  for (const citation of citations) {
    const docNamePattern = citation.sourceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Use replace directly — avoid test() + replace() with g flag (lastIndex side effect)
    const replaced = annotatedText.replace(
      new RegExp(`(${docNamePattern})`, 'g'),
      `$1 [${citation.index}]`,
    );
    annotatedText = replaced;
  }

  return annotatedText;
}

/**
 * 応答末尾にCitation参照リストを追加する。
 */
export function appendCitationList(
  responseText: string,
  citations: Citation[],
): string {
  if (citations.length === 0) return responseText;

  const citationLines = citations.map((c) => {
    const typeLabel = c.boundaryType === 'verified' ? '🔒' : '🌐';
    return `[${c.index}] ${typeLabel} ${c.sourceName}`;
  });

  return `${responseText}\n\n---\n**Sources:**\n${citationLines.join('\n')}`;
}

/**
 * 完全なCitedResponseを構築する。
 */
export function buildCitedResponse(
  responseText: string,
  retrieveResults: RetrieveResult[],
  modelId: string,
): CitedResponse {
  const citations = generateCitations(retrieveResults);
  const annotatedText = appendCitationList(responseText, citations);

  const boundaryTypes = [...new Set(citations.map(c => c.boundaryType))];

  return {
    text: annotatedText,
    citations,
    boundaryTypes,
    modelId,
  };
}
