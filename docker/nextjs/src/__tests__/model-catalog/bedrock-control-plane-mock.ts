/**
 * A stand-in for `@aws-sdk/client-bedrock` that serves the recorded Tokyo responses, so
 * the model catalog runs for real in tests without calling AWS. Use as:
 *
 *   vi.mock('@aws-sdk/client-bedrock', () => import('../model-catalog/bedrock-control-plane-mock'));
 */
import fixture from './tokyo-2026-11-15.json';

class Cmd {
  constructor(public input: unknown) {}
}
export class ListFoundationModelsCommand extends Cmd {}
export class ListInferenceProfilesCommand extends Cmd {}
export class GetFoundationModelAvailabilityCommand extends Cmd {}

export class BedrockClient {
  constructor(_config?: unknown) {}
  async send(cmd: unknown) {
    if (cmd instanceof ListFoundationModelsCommand) {
      return {
        modelSummaries: fixture.models.map((m) => ({
          ...m,
          modelLifecycle: { status: m.lifecycleStatus, startOfLifeTime: new Date(m.startOfLifeTime as string) },
        })),
      };
    }
    if (cmd instanceof ListInferenceProfilesCommand) {
      return {
        inferenceProfileSummaries: fixture.profiles.map((p) => ({
          inferenceProfileId: p.inferenceProfileId,
          status: p.status,
          models: p.modelArns.map((modelArn) => ({ modelArn })),
        })),
      };
    }
    return { agreementAvailability: { status: 'AVAILABLE' }, authorizationStatus: 'AUTHORIZED' };
  }
}
