/**
 * Model defaults.
 *
 * There are no model IDs here any more. Which model each tier uses (light / standard /
 * heavy / fallback / voice), how a model is called in the region, and which models are
 * retired come from the model catalog (`src/lib/model-catalog`), which reads them from
 * the Bedrock APIs. The tiers are configured as family patterns through the stack
 * (`modelFamily*` context). An empty model ID anywhere means "the standard tier".
 */

export const DEFAULT_REGION = 'ap-northeast-1';
