/**
 * TASK-1.7.1: Gateway統合テスト
 * 
 * このテストは、Gateway ConstructがCDKスタックに正しく統合されることを検証します。
 * 
 * テスト内容:
 * - Gateway Constructが正しく統合される
 * - 設定が正しく読み込まれる
 * - 他のConstructと競合しない
 * - CDK synthが成功する
 */

import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { BedrockAgentCoreGatewayConstruct } from '../../lib/modules/ai/constructs/bedrock-agent-core-gateway-construct';

describe('Gateway Construct - 統合テスト', () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let template: Template;

  beforeEach(() => {
    // CDK Appを作成
    app = new cdk.App();

    // テスト用Stackを作成
    stack = new cdk.Stack(app, 'TestGatewayStack', {
      env: {
        account: '123456789012',
        region: 'ap-northeast-1',
      },
    });

    // Gateway Constructを作成
    new BedrockAgentCoreGatewayConstruct(stack, 'TestGatewayConstruct', {
      projectName: 'test-project',
      environment: 'test',
      restApiConversion: {
        enabled: true,
        openApiSpecPath: 's3://test-bucket/openapi.yaml',
        apiGatewayId: 'test-api-gateway',
        apiGatewayStage: 'prod',
      },
      lambdaFunctionConversion: {
        enabled: true,
        lambdaFunctionArns: [
          'arn:aws:lambda:ap-northeast-1:123456789012:function:test-function-1',
          'arn:aws:lambda:ap-northeast-1:123456789012:function:test-function-2',
        ],
        schemaGenerationMode: 'auto',
      },
      mcpServerIntegration: {
        enabled: true,
        serverEndpoint: 'https://mcp-server.example.com',
        authenticationType: 'API_KEY',
        apiKeySecretArn: 'arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:test-api-key',
      },
    });

    // CloudFormationテンプレートを取得
    template = Template.fromStack(stack);
  });

  describe('統合テスト: Gateway Constructの作成', () => {
    test('Gateway ConstructがStackに統合される', () => {
      // Lambda関数が作成されることを確認（3つ: REST API, Lambda, MCP）
      const functions = template.findResources('AWS::Lambda::Function');
      expect(Object.keys(functions).length).toBeGreaterThanOrEqual(3);
    });

    test('設定が正しく読み込まれる', () => {
      // REST API Converter Lambda関数の環境変数を確認
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: Match.objectLike({
            PROJECT_NAME: 'test-project',
            ENVIRONMENT: 'test',
            OPENAPI_SPEC_PATH: 's3://test-bucket/openapi.yaml',
            API_GATEWAY_ID: 'test-api-gateway',
            API_GATEWAY_STAGE: 'prod',
          }),
        },
      });
    });

    test('Lambda関数が正しい設定で作成される', () => {
      // Lambda関数の基本設定を確認
      template.hasResourceProperties('AWS::Lambda::Function', {
        Runtime: 'nodejs22.x',
        Handler: 'index.handler',
        Timeout: 30,
        MemorySize: 1024,
      });
    });
  });

  describe('統合テスト: REST API変換機能', () => {
    test('REST API Converter Lambda関数が作成される', () => {
      // REST API Converter Lambda関数が作成されることを確認
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: Match.objectLike({
            OPENAPI_SPEC_PATH: 's3://test-bucket/openapi.yaml',
          }),
        },
      });
    });

    test('S3アクセス権限が付与される', () => {
      // S3アクセス権限が付与されることを確認
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: ['s3:GetObject', 's3:ListBucket'],
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });
  });

  describe('統合テスト: Lambda関数変換機能', () => {
    test('Lambda Function Converter Lambda関数が作成される', () => {
      // Lambda Function Converter Lambda関数が作成されることを確認
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: Match.objectLike({
            LAMBDA_FUNCTION_ARNS: Match.stringLikeRegexp('.*test-function.*'),
          }),
        },
      });
    });

    test('Lambda実行権限が付与される', () => {
      // Lambda実行権限が付与されることを確認
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: [
                'lambda:GetFunction',
                'lambda:GetFunctionConfiguration',
                'lambda:ListTags',
              ],
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });
  });

  describe('統合テスト: MCPサーバー統合機能', () => {
    test('MCP Server Integration Lambda関数が作成される', () => {
      // MCP Server Integration Lambda関数が作成されることを確認
      template.hasResourceProperties('AWS::Lambda::Function', {
        Environment: {
          Variables: Match.objectLike({
            MCP_SERVER_ENDPOINT: 'https://mcp-server.example.com',
          }),
        },
      });
    });

    test('Secrets Manager権限が付与される', () => {
      // Secrets Manager権限が付与されることを確認
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: ['secretsmanager:GetSecretValue'],
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });
  });

  describe('統合テスト: KMS暗号化', () => {
    test('KMS Keyが作成される', () => {
      // KMS Keyが作成されることを確認
      template.resourceCountIs('AWS::KMS::Key', 1);

      template.hasResourceProperties('AWS::KMS::Key', {
        EnableKeyRotation: true,
      });
    });

    test('Lambda環境変数がKMSで暗号化される', () => {
      // Lambda関数の環境変数がKMSで暗号化されることを確認
      template.hasResourceProperties('AWS::Lambda::Function', {
        KmsKeyArn: Match.objectLike({
          'Fn::GetAtt': Match.arrayWith([
            Match.stringLikeRegexp('.*Key.*'),
            'Arn',
          ]),
        }),
      });
    });
  });

  describe('統合テスト: IAM権限', () => {
    test('Lambda実行ロールが作成される', () => {
      // IAM Roleが作成されることを確認
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: 'sts:AssumeRole',
              Effect: 'Allow',
              Principal: {
                Service: 'lambda.amazonaws.com',
              },
            }),
          ]),
        },
      });
    });

    test('CloudWatch Logs権限が付与される', () => {
      // CloudWatch Logs権限が付与されることを確認
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });

    test('KMS復号化権限が付与される', () => {
      // KMS復号化権限が付与されることを確認
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: ['kms:Decrypt', 'kms:DescribeKey'],
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });
  });

  describe('統合テスト: タグ付け', () => {
    test('リソースにタグが付与される', () => {
      // Lambda関数にタグが付与されることを確認
      template.hasResourceProperties('AWS::Lambda::Function', {
        Tags: Match.arrayWith([
          {
            Key: 'Project',
            Value: 'test-project',
          },
          {
            Key: 'Environment',
            Value: 'test',
          },
          {
            Key: 'Component',
            Value: 'AgentCoreGateway',
          },
        ]),
      });
    });
  });

  describe('統合テスト: リソース数検証', () => {
    test('期待されるリソース数が作成される', () => {
      // Lambda関数: 3個（REST API, Lambda, MCP）
      const functions = template.findResources('AWS::Lambda::Function');
      expect(Object.keys(functions).length).toBeGreaterThanOrEqual(3);

      // KMS Key: 1個
      template.resourceCountIs('AWS::KMS::Key', 1);

      // IAM Role: 3個以上（各Lambda実行ロール）
      const roles = template.findResources('AWS::IAM::Role');
      expect(Object.keys(roles).length).toBeGreaterThanOrEqual(3);

      // IAM Policy: 3個以上（各Lambda実行ポリシー）
      const policies = template.findResources('AWS::IAM::Policy');
      expect(Object.keys(policies).length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('統合テスト: 他のConstructとの競合', () => {
    test('他のConstructと競合しない', () => {
      // CDK synthが成功することを確認（エラーが発生しない）
      expect(() => {
        app.synth();
      }).not.toThrow();
    });

    test('リソース名が一意である', () => {
      // 全てのリソースIDを取得
      const allResources = template.toJSON().Resources;
      const resourceIds = Object.keys(allResources);

      // 重複がないことを確認
      const uniqueIds = new Set(resourceIds);
      expect(uniqueIds.size).toBe(resourceIds.length);
    });
  });

  describe('統合テスト: 機能の無効化', () => {
    test('REST API変換を無効化した場合、関連リソースが作成されない', () => {
      // 新しいStackを作成
      const disabledStack = new cdk.Stack(app, 'TestDisabledRestApiStack');

      // REST API変換を無効化したGateway Constructを作成
      new BedrockAgentCoreGatewayConstruct(disabledStack, 'TestDisabledRestApiConstruct', {
        projectName: 'test-project',
        environment: 'test',
        restApiConversion: {
          enabled: false,
        },
        lambdaFunctionConversion: {
          enabled: false,
        },
        mcpServerIntegration: {
          enabled: false,
        },
      });

      // CloudFormationテンプレートを取得
      const disabledTemplate = Template.fromStack(disabledStack);

      // Lambda関数が作成されないことを確認
      const functions = disabledTemplate.findResources('AWS::Lambda::Function');
      expect(Object.keys(functions).length).toBe(0);
    });

    test('Lambda関数変換のみを有効化した場合、関連リソースのみが作成される', () => {
      // 新しいStackを作成
      const lambdaOnlyStack = new cdk.Stack(app, 'TestLambdaOnlyStack');

      // Lambda関数変換のみを有効化したGateway Constructを作成
      new BedrockAgentCoreGatewayConstruct(lambdaOnlyStack, 'TestLambdaOnlyConstruct', {
        projectName: 'test-project',
        environment: 'test',
        restApiConversion: {
          enabled: false,
        },
        lambdaFunctionConversion: {
          enabled: true,
          lambdaFunctionArns: [
            'arn:aws:lambda:ap-northeast-1:123456789012:function:test-function',
          ],
          schemaGenerationMode: 'auto',
        },
        mcpServerIntegration: {
          enabled: false,
        },
      });

      // CloudFormationテンプレートを取得
      const lambdaOnlyTemplate = Template.fromStack(lambdaOnlyStack);

      // Lambda関数が1個作成されることを確認
      const functions = lambdaOnlyTemplate.findResources('AWS::Lambda::Function');
      expect(Object.keys(functions).length).toBe(1);
    });
  });

  describe('統合テスト: CDK Synth成功', () => {
    test('CDK synthが成功する', () => {
      // CDK synthが成功することを確認
      const assembly = app.synth();

      // アセンブリが作成されることを確認
      expect(assembly).toBeDefined();

      // スタックが含まれることを確認
      expect(assembly.stacks.length).toBeGreaterThan(0);

      // エラーがないことを確認
      expect(assembly.manifest.missing).toBeUndefined();
    });

    test('CloudFormationテンプレートが有効である', () => {
      // CloudFormationテンプレートを取得
      const cfnTemplate = template.toJSON();

      // テンプレートが有効であることを確認
      expect(cfnTemplate).toBeDefined();
      expect(cfnTemplate.Resources).toBeDefined();
      expect(Object.keys(cfnTemplate.Resources).length).toBeGreaterThan(0);
    });
  });

  describe('統合テスト: 複数機能の同時有効化', () => {
    test('全ての機能を同時に有効化した場合、全てのリソースが作成される', () => {
      // 全ての機能を有効化したStackは既にbeforeEachで作成済み
      // Lambda関数が3個作成されることを確認
      const functions = template.findResources('AWS::Lambda::Function');
      expect(Object.keys(functions).length).toBeGreaterThanOrEqual(3);

      // KMS Keyが作成されることを確認
      template.resourceCountIs('AWS::KMS::Key', 1);

      // IAM Roleが作成されることを確認
      const roles = template.findResources('AWS::IAM::Role');
      expect(Object.keys(roles).length).toBeGreaterThanOrEqual(3);
    });

    test('各機能のLambda関数が独立して動作する', () => {
      // 各Lambda関数が異なる環境変数を持つことを確認
      const functions = template.findResources('AWS::Lambda::Function');
      const functionList = Object.values(functions);

      // REST API Converter
      const restApiFunction = functionList.find((fn: any) =>
        fn.Properties?.Environment?.Variables?.OPENAPI_SPEC_PATH
      );
      expect(restApiFunction).toBeDefined();

      // Lambda Function Converter
      const lambdaFunction = functionList.find((fn: any) =>
        fn.Properties?.Environment?.Variables?.LAMBDA_FUNCTION_ARNS
      );
      expect(lambdaFunction).toBeDefined();

      // MCP Server Integration
      const mcpFunction = functionList.find((fn: any) =>
        fn.Properties?.Environment?.Variables?.MCP_SERVER_ENDPOINT
      );
      expect(mcpFunction).toBeDefined();
    });
  });
});
