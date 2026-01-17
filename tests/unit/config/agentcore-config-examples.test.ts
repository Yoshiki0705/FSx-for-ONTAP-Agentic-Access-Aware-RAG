/**
 * AgentCore設定例ファイルのバリデーションテスト
 * 
 * @author Kiro AI
 * @date 2026-01-04
 */

import * as fs from 'fs';
import * as path from 'path';
import { AgentCoreConfigValidator } from '../../../lib/config/agentcore-config-validator';
import { AgentCoreConfig } from '../../../types/agentcore-config';

describe('AgentCore Configuration Examples', () => {
  const projectRoot = path.join(__dirname, '../../..');

  describe('cdk.context.json.example', () => {
    it('should be valid', () => {
      const configPath = path.join(projectRoot, 'cdk.context.json.example');
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      
      const result = AgentCoreConfigValidator.validate(config.agentCore as AgentCoreConfig);
      
      if (!result.valid) {
        console.error('Validation errors:', result.errors);
      }
      if (result.warnings.length > 0) {
        console.warn('Validation warnings:', result.warnings);
      }
      
      expect(result.valid).toBe(true);
    });
  });

  describe('cdk.context.json.minimal', () => {
    it('should be valid', () => {
      const configPath = path.join(projectRoot, 'cdk.context.json.minimal');
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      
      const result = AgentCoreConfigValidator.validate(config.agentCore as AgentCoreConfig);
      
      if (!result.valid) {
        console.error('Validation errors:', result.errors);
      }
      if (result.warnings.length > 0) {
        console.warn('Validation warnings:', result.warnings);
      }
      
      expect(result.valid).toBe(true);
    });
  });

  describe('cdk.context.json.production', () => {
    it('should be valid', () => {
      const configPath = path.join(projectRoot, 'cdk.context.json.production');
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      
      const result = AgentCoreConfigValidator.validate(config.agentCore as AgentCoreConfig);
      
      if (!result.valid) {
        console.error('Validation errors:', result.errors);
      }
      if (result.warnings.length > 0) {
        console.warn('Validation warnings:', result.warnings);
      }
      
      expect(result.valid).toBe(true);
    });

    it('should have production-appropriate settings', () => {
      const configPath = path.join(projectRoot, 'cdk.context.json.production');
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      const agentCore = config.agentCore as AgentCoreConfig;
      
      // 本番環境では以下が推奨される
      expect(agentCore.runtime?.lambdaConfig?.provisionedConcurrentExecutions).toBeGreaterThan(0);
      expect(agentCore.identity?.dynamoDbConfig?.pointInTimeRecovery).toBe(true);
      expect(agentCore.observability?.enabled).toBe(true);
      expect(agentCore.observability?.xrayConfig?.enableActiveTracing).toBe(true);
      expect(agentCore.policy?.enabled).toBe(true);
      expect(agentCore.policy?.cedarIntegrationConfig?.enableFormalVerification).toBe(true);
    });
  });
});
