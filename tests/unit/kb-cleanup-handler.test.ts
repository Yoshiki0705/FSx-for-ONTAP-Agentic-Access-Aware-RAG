/**
 * The KB cleanup Lambda deletes data sources before the Knowledge Base goes.
 * When a delete ends in DELETE_UNSUCCESSFUL it switches the data source to RETAIN and deletes again.
 * That update must send back the data source's own vectorIngestionConfiguration: leaving it out is read
 * as removing the chunking and parsing settings, and Bedrock refuses ("cannot be updated once created").
 * Found on a live teardown (the data source stayed and the Knowledge Base could not be deleted).
 *
 * The handler is inline code in the template, so it is taken from the synthesized template and run
 * here with a fake Bedrock client.
 */
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as vm from 'vm';
import { DemoAIStack } from '../../lib/stacks/demo/demo-ai-stack';

function inlineHandlerSource(): string {
  const app = new cdk.App();
  const stack = new DemoAIStack(app, 'TestAI', {
    projectName: 'testproj',
    environment: 'dev',
    userAccessTableName: 'test-user-access',
    userAccessTableArn: 'arn:aws:dynamodb:ap-northeast-1:123456789012:table/test-user-access',
    env: { account: '123456789012', region: 'ap-northeast-1' },
  });
  const fns = Object.values(Template.fromStack(stack).toJSON().Resources as Record<string, any>).filter(
    (r) => r.Type === 'AWS::Lambda::Function' && String(r.Properties?.FunctionName).includes('kb-cleanup'),
  );
  expect(fns).toHaveLength(1);
  return fns[0].Properties.Code.ZipFile as string;
}

const INGESTION = {
  chunkingConfiguration: { chunkingStrategy: 'FIXED_SIZE', fixedSizeChunkingConfiguration: { maxTokens: 300, overlapPercentage: 10 } },
  parsingConfiguration: { parsingStrategy: 'BEDROCK_FOUNDATION_MODEL', bedrockFoundationModelConfiguration: { modelArn: 'arn:aws:bedrock:ap-northeast-1:123456789012:inference-profile/jp.x' } },
};

async function runDelete(dataSource: Record<string, any>, { enforce }: { enforce: boolean }) {
  const updates: any[] = [];
  let deletes = 0;
  let status = 'AVAILABLE';
  class Cmd { constructor(public input: any) {} }
  const make = (name: string) => ({ [name]: class extends Cmd {} })[name];
  const sdk: any = {
    ListDataSourcesCommand: make('ListDataSourcesCommand'),
    DeleteDataSourceCommand: make('DeleteDataSourceCommand'),
    GetDataSourceCommand: make('GetDataSourceCommand'),
    UpdateDataSourceCommand: make('UpdateDataSourceCommand'),
    BedrockAgentClient: class {
      async send(cmd: any) {
        switch (cmd.constructor.name) {
          case 'ListDataSourcesCommand':
            return { dataSourceSummaries: [{ dataSourceId: 'DS1', status }] };
          case 'DeleteDataSourceCommand':
            deletes++;
            if (deletes === 1) status = 'DELETE_UNSUCCESSFUL'; // the vector store could not be emptied
            else status = 'DELETED';
            return {};
          case 'GetDataSourceCommand':
            if (status === 'DELETED') { const e: any = new Error('gone'); e.name = 'ResourceNotFoundException'; throw e; }
            return { dataSource: { ...dataSource, status } };
          case 'UpdateDataSourceCommand': {
            updates.push(cmd.input);
            // Bedrock treats a missing vectorIngestionConfiguration as removing it, which is not allowed.
            if (enforce && dataSource.vectorIngestionConfiguration && !cmd.input.vectorIngestionConfiguration) {
              throw new Error('vectorIngestionConfiguration.chunkingConfiguration cannot be updated once created.');
            }
            return {};
          }
        }
        throw new Error('unexpected ' + cmd.constructor.name);
      }
    },
  };
  const responses: any[] = [];
  const sandbox: any = {
    require: (m: string) => (m === '@aws-sdk/client-bedrock-agent' ? sdk : require(m)),
    exports: {},
    console: { log() {}, warn() {} },
    process: { env: { AWS_REGION: 'ap-northeast-1' } },
    // The inline code answers CloudFormation over HTTPS; capture that instead.
    URL,
    setTimeout: (fn: () => void) => { fn(); return 0; }, // skip the waits
  };
  const src = inlineHandlerSource().replace(/async function sendCfnResponse[\s\S]*?\n}\n/, 'async function sendCfnResponse(e, s) { __responses.push(s); }\n');
  sandbox.__responses = responses;
  vm.runInNewContext(src, sandbox);
  await sandbox.exports.handler({
    RequestType: 'Delete', ResourceProperties: { KnowledgeBaseId: 'KB1' }, ResponseURL: 'https://example.invalid/x',
  });
  return { updates, deletes, responses, finalStatus: status };
}

describe('KB cleanup Lambda', () => {
  it('sends the existing chunking and parsing settings when it switches a data source to RETAIN', async () => {
    const r = await runDelete({
      name: 'ds', dataSourceConfiguration: { type: 'S3' }, vectorIngestionConfiguration: INGESTION,
    }, { enforce: true });
    expect(r.updates).toHaveLength(1);
    expect(r.updates[0].dataDeletionPolicy).toBe('RETAIN');
    expect(r.updates[0].vectorIngestionConfiguration).toEqual(INGESTION);
    expect(r.deletes).toBe(2);
    expect(r.finalStatus).toBe('DELETED');
    expect(r.responses).toEqual(['SUCCESS']);
  });

  it('still works for a data source that has no ingestion configuration', async () => {
    const r = await runDelete({ name: 'ds', dataSourceConfiguration: { type: 'S3' } }, { enforce: true });
    expect(r.updates[0].vectorIngestionConfiguration).toBeUndefined();
    expect(r.finalStatus).toBe('DELETED');
  });
});
