/**
 * The text of a model response, from every text block.
 *
 * Reading only `content[0]` loses the answer when a model puts another block first:
 * on 2026-11-15 in ap-northeast-1, Claude Haiku 5.5 answered a KB question with a
 * non-empty response whose first block had no text, and the app showed an empty answer.
 * Works for both the Converse `output.message.content` and the Messages API `content`.
 */
export function joinText(content: ReadonlyArray<unknown> | undefined | null): string {
  if (!Array.isArray(content)) return '';
  return content
    .map((b) => {
      const block = b as { type?: string; text?: unknown };
      if (block.type !== undefined && block.type !== 'text') return '';
      return typeof block.text === 'string' ? block.text : '';
    })
    .join('');
}
