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

  test('unknown strategy defaults to FIXED_SIZE', () => {
    const result = buildChunkingConfiguration('UNKNOWN');
    expect(result.chunkingStrategy).toBe('FIXED_SIZE');
    expect(result.fixedSizeChunkingConfiguration).toBeDefined();
  });
});
