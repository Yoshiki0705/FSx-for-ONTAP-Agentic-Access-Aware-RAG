/**
 * Tests for buildParsingSettings (foundation-model parsing for the Knowledge Base data source)
 */
import {
  buildParsingSettings,
  DEFAULT_KB_PARSING_MODEL_ID,
  KB_PARSING_PROMPT_MAX_LENGTH,
} from '../lib/stacks/demo/demo-ai-stack';

const REGION = 'ap-northeast-1';
const ACCOUNT = '111122223333';

describe('buildParsingSettings', () => {
  test('DEFAULT leaves the default parser and grants nothing', () => {
    const r = buildParsingSettings('DEFAULT', DEFAULT_KB_PARSING_MODEL_ID, undefined, REGION, ACCOUNT);
    expect(r.parsingConfiguration).toBeUndefined();
    expect(r.invokeModelResources).toEqual([]);
    expect(r.inferenceProfileArns).toEqual([]);
  });

  test('strategy is case-insensitive', () => {
    expect(buildParsingSettings('default', DEFAULT_KB_PARSING_MODEL_ID, undefined, REGION, ACCOUNT).parsingConfiguration).toBeUndefined();
    expect(buildParsingSettings('bedrock_foundation_model', DEFAULT_KB_PARSING_MODEL_ID, undefined, REGION, ACCOUNT).parsingConfiguration?.parsingStrategy)
      .toBe('BEDROCK_FOUNDATION_MODEL');
  });

  test('an inference profile id gives a profile ARN and grants the profile plus its base model', () => {
    const r = buildParsingSettings('BEDROCK_FOUNDATION_MODEL', 'jp.anthropic.claude-haiku-4-5-20251001-v1:0', undefined, REGION, ACCOUNT);
    expect(r.parsingConfiguration).toEqual({
      parsingStrategy: 'BEDROCK_FOUNDATION_MODEL',
      bedrockFoundationModelConfiguration: {
        modelArn: `arn:aws:bedrock:${REGION}:${ACCOUNT}:inference-profile/jp.anthropic.claude-haiku-4-5-20251001-v1:0`,
      },
    });
    expect(r.invokeModelResources).toEqual([
      `arn:aws:bedrock:${REGION}:${ACCOUNT}:inference-profile/jp.anthropic.claude-haiku-4-5-20251001-v1:0`,
      'arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0',
    ]);
    // CreateDataSource makes Bedrock call GetInferenceProfile with the KB role (found on a live deploy)
    expect(r.inferenceProfileArns).toEqual([`arn:aws:bedrock:${REGION}:${ACCOUNT}:inference-profile/jp.anthropic.claude-haiku-4-5-20251001-v1:0`]);
  });

  test('a plain model id gives a foundation-model ARN in this region only', () => {
    const r = buildParsingSettings('BEDROCK_FOUNDATION_MODEL', 'anthropic.claude-3-haiku-20240307-v1:0', undefined, REGION, ACCOUNT);
    const arn = `arn:aws:bedrock:${REGION}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0`;
    expect(r.parsingConfiguration?.bedrockFoundationModelConfiguration.modelArn).toBe(arn);
    expect(r.invokeModelResources).toEqual([arn]);
    expect(r.inferenceProfileArns).toEqual([]);
  });

  test('the prompt is passed through as parsingPromptText', () => {
    const r = buildParsingSettings('BEDROCK_FOUNDATION_MODEL', DEFAULT_KB_PARSING_MODEL_ID, '表は Markdown で出す', REGION, ACCOUNT);
    expect(r.parsingConfiguration?.bedrockFoundationModelConfiguration.parsingPrompt).toEqual({ parsingPromptText: '表は Markdown で出す' });
  });

  test('BEDROCK_DATA_AUTOMATION and unknown values throw at synth time', () => {
    expect(() => buildParsingSettings('BEDROCK_DATA_AUTOMATION', DEFAULT_KB_PARSING_MODEL_ID, undefined, REGION, ACCOUNT)).toThrow(/US West \(Oregon\)/);
    expect(() => buildParsingSettings('FOUNDATON_MODEL', DEFAULT_KB_PARSING_MODEL_ID, undefined, REGION, ACCOUNT)).toThrow(/Invalid kbParsingStrategy/);
  });

  test('an empty or over-long prompt and a malformed model id throw', () => {
    expect(() => buildParsingSettings('BEDROCK_FOUNDATION_MODEL', DEFAULT_KB_PARSING_MODEL_ID, '', REGION, ACCOUNT)).toThrow(/kbParsingPrompt/);
    expect(() => buildParsingSettings('BEDROCK_FOUNDATION_MODEL', DEFAULT_KB_PARSING_MODEL_ID, 'x'.repeat(KB_PARSING_PROMPT_MAX_LENGTH + 1), REGION, ACCOUNT)).toThrow(/kbParsingPrompt/);
    expect(() => buildParsingSettings('BEDROCK_FOUNDATION_MODEL', 'a/b', undefined, REGION, ACCOUNT)).toThrow(/Invalid kbParsingModelId/);
  });
});
