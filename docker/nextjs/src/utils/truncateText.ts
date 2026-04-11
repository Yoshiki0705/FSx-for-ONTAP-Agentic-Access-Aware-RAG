/**
 * Truncates text to a specified maximum length, appending '...' if truncated.
 *
 * @param text - The input string to truncate
 * @param maxLength - The maximum number of characters before truncation
 * @returns The original text if within maxLength, otherwise the first maxLength characters followed by '...'
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length > maxLength) {
    return text.slice(0, maxLength) + '...';
  }
  return text;
}
