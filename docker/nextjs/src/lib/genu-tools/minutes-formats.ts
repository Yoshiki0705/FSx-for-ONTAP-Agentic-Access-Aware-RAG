/**
 * Output formats for minutes. `minutes` is the structured minutes; the others follow the
 * styles of the GenU meeting minutes tool that fit a text output. `custom` takes the user's
 * own instruction. No imports: the screen uses this list too.
 */
export const MINUTES_FORMATS = ['minutes', 'transcript', 'summary', 'faq', 'custom'] as const;
export type MinutesFormat = (typeof MINUTES_FORMATS)[number];
export const MAX_MINUTES_INSTRUCTION = 1000;
