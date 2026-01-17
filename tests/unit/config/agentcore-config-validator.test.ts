/**
 * AgentCore設定バリデーターのテスト
 * 
 * @author Kiro AI
 * @date 2026-01-04
 */

import { AgentCoreConfigValidator } from '../../../lib/config/agentcore-config-validator';
import { AgentCoreConfig } from '../../../types/agentcore-config';

describe('AgentCoreConfigValidator', () => {
  describe('validate', () => {
    it('should pass validation for empty config', () => {
      const config: AgentCoreConfig = {};
      const result = AgentCoreConfigValidator.validate(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass validation for disabled AgentCore', () => {
      const config: AgentCoreConfig = {
        enabled: false,
        runtime: { enabled: true }, // これは無視される
      };
      const result = AgentCoreConfigValidator.validate(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    describe('Runtime validation', () => {
      it('should fail for invalid Lambda timeout', () => {
        const config: AgentCoreConfig = {
          runtime: {
            enabled: true,
            lambdaConfig: {
              timeout: 1000, // > 900
            },
          },
        };
        const result = AgentCoreConfigValidator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Runtime Lambda timeout must be between 1 and 900 seconds');
      });

      it('should fail for invalid Lambda memorySize', () => {
        const config: AgentCoreConfig = {
          runtime: {
            enabled: true,
            lambdaConfig: {
              memorySize: 100, // < 128
            },
          },
        };
        const result = AgentCoreConfigValidator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Runtime Lambda memorySize must be between 128 and 10240 MB');
      });

      it('should fail for non-multiple-of-64 memorySize', () => {
        const config: AgentCoreConfig = {
          runtime: {
            enabled: true,
            lambdaConfig: {
              memorySize: 1000, // not a multiple of 64
            },
          },
        };
        const result = AgentCoreConfigValidator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Runtime Lambda memorySize must be a multiple of 64 MB');
      });

      it('should warn for high Lambda timeout', () => {
        const config: AgentCoreConfig = {
          runtime: {
            enabled: true,
            lambdaConfig: {
              timeout: 600,
            },
          },
        };
        const result = AgentCoreConfigValidator.validate(config);
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain('Runtime Lambda timeout > 300 seconds may increase costs');
      });

      it('should fail for invalid EventBridge schedule expression', () => {
        const config: AgentCoreConfig = {
          runtime: {
            enabled: true,
            eventBridgeConfig: {
              enabled: true,
              scheduleExpression: 'invalid',
            },
          },
        };
        const result = AgentCoreConfigValidator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Runtime EventBridge scheduleExpression must start with "rate(" or "cron("');
      });
    });

    describe('Gateway validation', () => {
      it('should fail for invalid openApiSpecPath', () => {
        const config: AgentCoreConfig = {
          gateway: {
            enabled: true,
            restApiConversionConfig: {
              openApiSpecPath: 'invalid-path',
            },
          },
        };
        const result = AgentCoreConfigValidator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Gateway openApiSpecPath must be S3 URI (s3://...) or local path (./... or /...)');
      });

      it('should fail for invalid Lambda ARN', () => {
        const config: AgentCoreConfig = {
          gateway: {
            enabled: true,
            lambdaFunctionConversionConfig: {
              functionArns: ['invalid-arn'],
            },
          },
        };
        const result = AgentCoreConfigValidator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Gateway functionArns[0] is not a valid Lambda ARN: invalid-arn');
      });

      it('should fail for invalid MCP server endpoint', () => {
        const config: AgentCoreConfig = {
          gateway: {
            enabled: true,
            mcpServerIntegrationConfig: {
              serverEndpoints: [
                {
                  name: 'test',
                  endpoint: 'invalid-url',
                  authType: 'NONE',
                },
              ],
            },
          },
        };
        const result = AgentCoreConfigValidator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Gateway serverEndpoints[0] endpoint must be HTTP or HTTPS URL');
      });
    });

    describe('Memory validation', () => {
      it('should fail when no strategy is enabled', () => {
        const config: AgentCoreConfig = {
          memory: {
            enabled: true,
            memoryStrategyConfig: {
              enableSemantic: false,
              enableSummary: false,
              enableUserPreference: false,
            },
          },
        };
        const result = AgentCoreConfigValidator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Memory must have at least one strategy enabled (Semantic, Summary, or UserPreference)');
      });

      it('should fail for invalid KMS Key ARN', () => {
        const config: AgentCoreConfig = {
          memory: {
            enabled: true,
            kmsConfig: {
              keyArn: 'invalid-arn',
            },
          },
        };
        const result = AgentCoreConfigValidator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Memory KMS keyArn must be a valid KMS Key ARN');
      });
    });

    describe('Identity validation', () => {
      it('should fail for invalid DynamoDB capacity', () => {
        const config: AgentCoreConfig = {
          identity: {
            enabled: true,
            dynamoDbConfig: {
              readCapacity: 0,
            },
          },
        };
        const result = AgentCoreConfigValidator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Identity DynamoDB readCapacity must be >= 1');
      });

      it('should fail for invalid RBAC defaultRole', () => {
        const config: AgentCoreConfig = {
          identity: {
            enabled: true,
            rbacConfig: {
              defaultRole: 'InvalidRole' as any,
            },
          },
        };
        const result = AgentCoreConfigValidator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Identity RBAC defaultRole must be Admin, User, or ReadOnly');
      });
    });

    describe('Browser validation', () => {
      it('should fail for invalid Puppeteer timeout', () => {
        const config: AgentCoreConfig = {
          browser: {
            enabled: true,
            puppeteerConfig: {
              timeout: 500000, // > 300000
            },
          },
        };
        const result = AgentCoreConfigValidator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Browser Puppeteer timeout must be between 1000 and 300000 ms (1-300 seconds)');
      });

      it('should fail for invalid viewport dimensions', () => {
        const config: AgentCoreConfig = {
          browser: {
            enabled: true,
            puppeteerConfig: {
              defaultViewport: {
                width: 50, // < 100
                height: 50, // < 100
              },
            },
          },
        };
        const result = AgentCoreConfigValidator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Browser Puppeteer viewport width must be between 100 and 3840 pixels');
        expect(result.errors).toContain('Browser Puppeteer viewport height must be between 100 and 2160 pixels');
      });
    });

    describe('Code Interpreter validation', () => {
      it('should fail for invalid timeout', () => {
        const config: AgentCoreConfig = {
          codeInterpreter: {
            enabled: true,
            executionConfig: {
              timeout: 500, // > 300
            },
          },
        };
        const result = AgentCoreConfigValidator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Code Interpreter timeout must be between 1 and 300 seconds');
      });

      it('should fail for empty allowedLanguages', () => {
        const config: AgentCoreConfig = {
          codeInterpreter: {
            enabled: true,
            executionConfig: {
              allowedLanguages: [],
            },
          },
        };
        const result = AgentCoreConfigValidator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Code Interpreter allowedLanguages must not be empty');
      });
    });

    describe('Observability validation', () => {
      it('should fail for invalid X-Ray samplingRate', () => {
        const config: AgentCoreConfig = {
          observability: {
            enabled: true,
            xrayConfig: {
              samplingRate: 1.5, // > 1.0
            },
          },
        };
        const result = AgentCoreConfigValidator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Observability X-Ray samplingRate must be between 0.0 and 1.0');
      });

      it('should fail for invalid email address', () => {
        const config: AgentCoreConfig = {
          observability: {
            enabled: true,
            cloudWatchConfig: {
              alarmEmail: 'invalid-email',
            },
          },
        };
        const result = AgentCoreConfigValidator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Observability CloudWatch alarmEmail must be a valid email address');
      });
    });

    describe('Evaluations validation', () => {
      it('should fail for invalid evaluationFrequency', () => {
        const config: AgentCoreConfig = {
          evaluations: {
            enabled: true,
            qualityMetricsConfig: {
              evaluationFrequency: 'invalid' as any,
            },
          },
        };
        const result = AgentCoreConfigValidator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Evaluations evaluationFrequency must be realtime, hourly, or daily');
      });

      it('should fail for invalid A/B test confidenceLevel', () => {
        const config: AgentCoreConfig = {
          evaluations: {
            enabled: true,
            abTestConfig: {
              confidenceLevel: 1.5, // > 0.99
            },
          },
        };
        const result = AgentCoreConfigValidator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Evaluations A/B test confidenceLevel must be between 0.5 and 0.99');
      });
    });

    describe('Policy validation', () => {
      it('should warn for non-standard policy template', () => {
        const config: AgentCoreConfig = {
          policy: {
            enabled: true,
            naturalLanguagePolicyConfig: {
              defaultPolicyTemplate: 'custom-template',
            },
          },
        };
        const result = AgentCoreConfigValidator.validate(config);
        expect(result.valid).toBe(true);
        expect(result.warnings).toContain("Policy defaultPolicyTemplate 'custom-template' is not a standard template (standard, strict, permissive)");
      });
    });

    describe('Complex validation scenarios', () => {
      it('should pass validation for valid full configuration', () => {
        const config: AgentCoreConfig = {
          enabled: true,
          runtime: {
            enabled: true,
            lambdaConfig: {
              timeout: 30,
              memorySize: 2048,
            },
          },
          gateway: {
            enabled: true,
            restApiConversionConfig: {
              openApiSpecPath: 's3://my-bucket/openapi.yaml',
            },
          },
          memory: {
            enabled: true,
            memoryStrategyConfig: {
              enableSemantic: true,
            },
          },
          identity: {
            enabled: true,
            rbacConfig: {
              defaultRole: 'User',
            },
          },
          browser: {
            enabled: true,
            puppeteerConfig: {
              timeout: 30000,
            },
          },
          codeInterpreter: {
            enabled: true,
            executionConfig: {
              timeout: 60,
              allowedLanguages: ['python'],
            },
          },
          observability: {
            enabled: true,
            xrayConfig: {
              samplingRate: 0.1,
            },
          },
          evaluations: {
            enabled: true,
            qualityMetricsConfig: {
              evaluationFrequency: 'hourly',
            },
          },
          policy: {
            enabled: true,
            naturalLanguagePolicyConfig: {
              defaultPolicyTemplate: 'standard',
            },
          },
        };
        const result = AgentCoreConfigValidator.validate(config);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should collect multiple errors from different sections', () => {
        const config: AgentCoreConfig = {
          runtime: {
            enabled: true,
            lambdaConfig: {
              timeout: 1000, // invalid
            },
          },
          memory: {
            enabled: true,
            memoryStrategyConfig: {
              enableSemantic: false,
              enableSummary: false,
              enableUserPreference: false, // invalid
            },
          },
          browser: {
            enabled: true,
            puppeteerConfig: {
              timeout: 500000, // invalid
            },
          },
        };
        const result = AgentCoreConfigValidator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(2);
      });
    });
  });
});
