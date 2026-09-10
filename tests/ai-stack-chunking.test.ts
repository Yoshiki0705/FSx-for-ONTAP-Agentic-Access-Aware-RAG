/**
 * Tests for buildChunkingConfiguration (v4.3 Feature 7)
 */

import { buildChunkingConfiguration } from '../lib/stacks/demo/demo-ai-stack';

describe('buildChunkingConfiguration', () => {
  test.each([
    ['FIXED_SIZE', 'FIXED_SIZE'],
    ['fixed_size', 'FIXED_SIZE'],
    ['HIERARCHICAL', 'HIERARCHICAL'],
    ['hierarchical', 'HIERARCHICAL'],
    ['SEMANTIC', 'SEMANTIC'],
    ['semantic', 'SEMANTIC'],
    ['NONE', 'NONE'],
    ['none', 'NONE'],
  ])('strategy "%s" produces chunkingStrategy "%s"', (input, expected) => {
    const result = buildChunkingConfiguration(input);
    expect(result.chunkingStrategy).toBe(expected);
  });

  test('FIXED_SIZE has correct parameters', () => {
    const result = buildChunkingConfiguration('FIXED_SIZE');
    expect(result.fixedSizeChunkingConfiguration).toEqual({
      maxTokens: 300,
      overlapPercentage: 10,
    });
  });

  test('HIERARCHICAL has parent and child level configurations', () => {
    const result = buildChunkingConfiguration('HIERARCHICAL');
    const config = result.hierarchicalChunkingConfiguration;
    expect(config.levelConfigurations).toHaveLength(2);
    expect(config.levelConfigurations[0].maxTokens).toBe(1500); // parent
    expect(config.levelConfigurations[1].maxTokens).toBe(300);  // child
    expect(config.overlapTokens).toBe(60);
  });

  test('SEMANTIC has correct parameters', () => {
    const result = buildChunkingConfiguration('SEMANTIC');
    const config = result.semanticChunkingConfiguration;
    expect(config.maxTokens).toBe(300);
    expect(config.bufferSize).toBe(1);
    expect(config.breakpointPercentileThreshold).toBe(95);
  });

  test('NONE has no additional configuration', () => {
    const result = buildChunkingConfiguration('NONE');
    expect(result).toEqual({ chunkingStrategy: 'NONE' });
    expect(result.fixedSizeChunkingConfiguration).toBeUndefined();
    expect(result.hierarchicalChunkingConfiguration).toBeUndefined();
    expect(result.semanticChunkingConfiguration).toBeUndefined();
  });

  // 不正値を FIXED_SIZE に落とすと、CfnOutput の表示（打ち間違えた文字列）と
  // 実際に配られる設定（FIXED_SIZE）が食い違ったまま運用に入る。
  test('unknown strategy throws instead of falling back', () => {
    expect(() => buildChunkingConfiguration('UNKNOWN')).toThrow(/Invalid kbChunkingStrategy/);
    expect(() => buildChunkingConfiguration('SEMANTICC')).toThrow(/FIXED_SIZE, HIERARCHICAL, SEMANTIC, NONE/);
    expect(() => buildChunkingConfiguration('')).toThrow(/Invalid kbChunkingStrategy/);
  });
});

// ========================================
// 2 つの CfnOutput が食い違わないこと
//
// 以前は KbChunkingStrategy が context の生の文字列を、KbChunkingConfig が
// 変換後の設定を出していた。打ち間違えると表示は 'SEMANTICC'、実際の設定は
// FIXED_SIZE になり、運用側は差に気づけなかった。
// ========================================
describe('KbChunkingStrategy と KbChunkingConfig の整合', () => {
  const strategies: Array<[string, string]> = [
    ['FIXED_SIZE', 'FIXED_SIZE'],
    ['semantic', 'SEMANTIC'],
    ['HIERARCHICAL', 'HIERARCHICAL'],
    ['none', 'NONE'],
  ];

  test.each(strategies)('context %s は両方の出力で %s になる', (input, expected) => {
    const config = buildChunkingConfiguration(input);
    // スタックは表示用の値も設定から取るため、この 2 つは定義上一致する
    expect(config.chunkingStrategy).toBe(expected);
    expect(JSON.parse(JSON.stringify(config)).chunkingStrategy).toBe(expected);
  });
});
