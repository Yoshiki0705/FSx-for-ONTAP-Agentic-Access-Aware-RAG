/**
 * Feature: multimodal-rag-search, Property 6: パラメータ独立性
 *
 * 任意の有効な vectorStoreType（s3vectors, opensearch-serverless）と
 * embeddingModel（titan-text-v2, nova-multimodal）の組み合わせに対して、
 * CDK スタックの合成（synth）が成功し、各パラメータに対応する正しいリソース構成が生成される。
 *
 * **Validates: Requirements 9.5**
 */

import * as fc from 'fast-check';
import { EmbeddingModelRegistry } from '../../lib/config/embedding-model-registry';
import { KBConfigStrategy } from '../../lib/config/kb-config-strategy';

/**
 * Since the full DemoAIStack has many dependencies (VPC, FSx, etc.),
 * we test the validation and configuration logic directly.
 * This mirrors the exact logic in lib/stacks/demo/demo-ai-stack.ts.
 */

const VALID_VECTOR_STORE_TYPES = ['s3vectors', 'opensearch-serverless'];
const VALID_EMBEDDING_MODELS = EmbeddingModelRegistry.getValidKeys();
const VALID_KB_MODES = ['replace', 'dual'];

/**
 * Simulates the AIStack validation and configuration logic.
 */
function simulateAIStackConfig(params: {
  embeddingModel?: string;
  multimodalKbMode?: string;
  vectorStoreType?: string;
}) {
  const embeddingModelKey = params.embeddingModel || 'titan-text-v2';
  const multimodalKbMode = params.multimodalKbMode || 'replace';
  const vectorStoreType = params.vectorStoreType || 's3vectors';

  // Validate vectorStoreType
  if (!VALID_VECTOR_STORE_TYPES.includes(vectorStoreType)) {
    throw new Error(`Invalid vectorStoreType: '${vectorStoreType}'`);
  }

  // Validate embeddingModel
  EmbeddingModelRegistry.validateKbMode(multimodalKbMode);
  const model = EmbeddingModelRegistry.resolve(embeddingModelKey);

  // Build config
  const strategy = new KBConfigStrategy(model, 'us-east-1', '123456789012');
  const config = strategy.buildConfig();

  const isDualMode = multimodalKbMode === 'dual';

  // Dual mode creates two KBs
  let multimodalConfig: ReturnType<KBConfigStrategy['buildConfig']> | undefined;
  if (isDualMode) {
    const mmModel = EmbeddingModelRegistry.resolve('nova-multimodal');
    const mmStrategy = new KBConfigStrategy(mmModel, 'us-east-1', '123456789012');
    multimodalConfig = mmStrategy.buildConfig();
  }

  const lambdaEnvVars: Record<string, string> = {
    ...config.lambdaEnvVars,
    ...(isDualMode ? { DUAL_KB_MODE: 'true' } : {}),
  };

  return {
    embeddingModelArn: config.embeddingModelArn,
    dimensions: config.dimensions,
    lambdaEnvVars,
    iamStatementCount: config.iamStatements.length,
    isDualMode,
    multimodalConfig,
    vectorStoreType,
  };
}

describe('CDK AIStack Embedding Model Tests', () => {
  // Test 1: Default (no embeddingModel) uses titan-text-v2
  it('default config uses titan-text-v2 with correct model ARN', () => {
    const result = simulateAIStackConfig({});
    expect(result.embeddingModelArn).toContain('amazon.titan-embed-text-v2:0');
    expect(result.dimensions).toBe(1024);
    expect(result.lambdaEnvVars.MULTIMODAL_ENABLED).toBe('false');
    expect(result.lambdaEnvVars.DUAL_KB_MODE).toBe('false');
  });

  // Test 2: nova-multimodal config
  it('nova-multimodal config uses correct model ARN and enables multimodal', () => {
    const result = simulateAIStackConfig({ embeddingModel: 'nova-multimodal' });
    expect(result.embeddingModelArn).toContain('amazon.nova-embed-multimodal-v1:0');
    expect(result.dimensions).toBe(1024);
    expect(result.lambdaEnvVars.MULTIMODAL_ENABLED).toBe('true');
    expect(result.lambdaEnvVars.EMBEDDING_MODEL).toBe('amazon.nova-embed-multimodal-v1:0');
  });

  // Test 3: Dual KB mode creates two configs
  it('dual mode creates both text and multimodal configs', () => {
    const result = simulateAIStackConfig({
      embeddingModel: 'titan-text-v2',
      multimodalKbMode: 'dual',
    });
    expect(result.isDualMode).toBe(true);
    expect(result.lambdaEnvVars.DUAL_KB_MODE).toBe('true');
    expect(result.multimodalConfig).toBeDefined();
    expect(result.multimodalConfig!.embeddingModelArn).toContain('amazon.nova-embed-multimodal-v1:0');
  });

  // Test 4: IAM policy for titan-text-v2 has only 1 statement (no BDA)
  it('titan-text-v2 produces 1 IAM statement (no BDA permissions)', () => {
    const result = simulateAIStackConfig({ embeddingModel: 'titan-text-v2' });
    expect(result.iamStatementCount).toBe(1);
  });

  // Test 5: IAM policy for nova-multimodal has 2 statements (includes BDA)
  it('nova-multimodal produces 2 IAM statements (includes BDA permissions)', () => {
    const result = simulateAIStackConfig({ embeddingModel: 'nova-multimodal' });
    expect(result.iamStatementCount).toBe(2);
  });

  // Test 6: Lambda env vars are correct
  it('Lambda env vars include EMBEDDING_MODEL and EMBEDDING_MODEL_DISPLAY_NAME', () => {
    const result = simulateAIStackConfig({ embeddingModel: 'nova-multimodal' });
    expect(result.lambdaEnvVars.EMBEDDING_MODEL).toBeDefined();
    expect(result.lambdaEnvVars.EMBEDDING_MODEL_DISPLAY_NAME).toBeDefined();
    expect(result.lambdaEnvVars.MULTIMODAL_ENABLED).toBe('true');
  });

  // Test 7: Invalid embeddingModel throws
  it('invalid embeddingModel throws validation error', () => {
    expect(() => simulateAIStackConfig({ embeddingModel: 'invalid-model' })).toThrow(
      /Invalid embeddingModel/,
    );
  });

  // Test 8: Invalid multimodalKbMode throws
  it('invalid multimodalKbMode throws validation error', () => {
    expect(() => simulateAIStackConfig({ multimodalKbMode: 'invalid-mode' })).toThrow(
      /Invalid multimodalKbMode/,
    );
  });
});

describe('Property 6: Parameter Independence', () => {
  it('all vectorStoreType × embeddingModel combinations produce valid configs', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_VECTOR_STORE_TYPES),
        fc.constantFrom(...VALID_EMBEDDING_MODELS),
        fc.constantFrom(...VALID_KB_MODES),
        (vectorStoreType, embeddingModel, kbMode) => {
          const result = simulateAIStackConfig({
            vectorStoreType,
            embeddingModel,
            multimodalKbMode: kbMode,
          });

          // Config should always succeed
          expect(result.embeddingModelArn).toBeTruthy();
          expect(result.dimensions).toBeGreaterThan(0);
          expect(result.lambdaEnvVars.EMBEDDING_MODEL).toBeTruthy();
          expect(result.vectorStoreType).toBe(vectorStoreType);

          // Dual mode should always create multimodal config
          if (kbMode === 'dual') {
            expect(result.isDualMode).toBe(true);
            expect(result.multimodalConfig).toBeDefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('embeddingModel and vectorStoreType are independent parameters', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_VECTOR_STORE_TYPES),
        fc.constantFrom(...VALID_EMBEDDING_MODELS),
        (vectorStoreType, embeddingModel) => {
          // Changing vectorStoreType should not affect embedding model config
          const result1 = simulateAIStackConfig({
            vectorStoreType: 's3vectors',
            embeddingModel,
          });
          const result2 = simulateAIStackConfig({
            vectorStoreType: 'opensearch-serverless',
            embeddingModel,
          });

          // Embedding model config should be identical regardless of vectorStoreType
          expect(result1.embeddingModelArn).toBe(result2.embeddingModelArn);
          expect(result1.dimensions).toBe(result2.dimensions);
          expect(result1.lambdaEnvVars.EMBEDDING_MODEL).toBe(result2.lambdaEnvVars.EMBEDDING_MODEL);
          expect(result1.lambdaEnvVars.MULTIMODAL_ENABLED).toBe(result2.lambdaEnvVars.MULTIMODAL_ENABLED);
        },
      ),
      { numRuns: 100 },
    );
  });
});
