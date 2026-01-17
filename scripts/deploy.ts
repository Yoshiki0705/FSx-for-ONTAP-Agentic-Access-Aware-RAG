#!/usr/bin/env ts-node

/**
 * FSx統合システム デプロイメントスクリプト
 * アカウント非依存でFSx-Serverless統合スタックをデプロイ
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ConfigValidator } from '../lib/config/validation/config-validator';
import { FsxIntegrationConfig } from '../lib/config/interfaces/environment-config';

interface DeploymentOptions {
  environment: string;
  configPath?: string;
  dryRun?: boolean;
  skipValidation?: boolean;
  stackName?: string;
  region?: string;
  profile?: string;
  verbose?: boolean;
}

class FsxIntegrationDeploymentManager {
  private options: DeploymentOptions;
  private config: FsxIntegrationConfig;

  constructor(options: DeploymentOptions) {
    this.options = options;
    this.config = this.loadConfiguration();
  }

  /**
   * メインデプロイメント処理
   */
  async deploy(): Promise<void> {
    try {
      console.log('🚀 Starting FSx Integration deployment process...');
      console.log(`Environment: ${this.options.environment}`);
      console.log(`Region: ${this.config.region}`);
      
      // 設定の検証
      if (!this.options.skipValidation) {
        await this.validateConfiguration();
      }

      // 前提条件のチェック
      await this.checkPrerequisites();

      // CDKブートストラップ
      await this.bootstrapCdk();

      // スタックのデプロイ
      if (this.options.dryRun) {
        await this.performDryRun();
      } else {
        await this.deployStacks();
      }

      console.log('✅ FSx Integration deployment completed successfully!');
      
      // デプロイ後の情報表示
      await this.showDeploymentInfo();
      
    } catch (error) {
      console.error('❌ FSx Integration deployment failed:', error);
      process.exit(1);
    }
  }

  /**
   * 設定ファイルの読み込み
   */
  private loadConfiguration(): FsxIntegrationConfig {
    const configPath = this.options.configPath || `config/environments/${this.options.environment}.json`;
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(configContent) as FsxIntegrationConfig;
    } catch (error) {
      throw new Error(`Failed to parse configuration file: ${error}`);
    }
  }

  /**
   * 設定の検証
   */
  private async validateConfiguration(): Promise<void> {
    console.log('🔍 Validating FSx Integration configuration...');
    
    const validation = ConfigValidator.validateFsxIntegrationConfig(this.config);
    
    if (!validation.isValid) {
      console.error('❌ Configuration validation failed:');
      validation.errors.forEach(error => console.error(`  - ${error}`));
      throw new Error('Configuration validation failed');
    }

    if (validation.warnings.length > 0) {
      console.warn('⚠️ Configuration warnings:');
      validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }

    // 互換性チェック
    const compatibility = ConfigValidator.validateFsxServerlessCompatibility(this.config);
    if (compatibility.warnings.length > 0) {
      console.warn('⚠️ Compatibility warnings:');
      compatibility.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }

    // 最適化提案
    const suggestions = ConfigValidator.getFsxOptimizationSuggestions(this.config);
    if (suggestions.length > 0) {
      console.log('💡 Optimization suggestions:');
      suggestions.forEach(suggestion => console.log(`  - ${suggestion}`));
    }

    console.log('✅ Configuration validation completed');
  }

  /**
   * 前提条件のチェック
   */
  private async checkPrerequisites(): Promise<void> {
    console.log('🔍 Checking prerequisites...');

    // AWS CLI確認
    try {
      execSync('aws --version', { stdio: 'pipe' });
    } catch (error) {
      throw new Error('AWS CLI is not installed or not accessible');
    }

    // CDK CLI確認
    try {
      execSync('npx cdk --version', { stdio: 'pipe' });
    } catch (error) {
      throw new Error('CDK CLI is not installed or not accessible');
    }

    // AWS認証確認
    try {
      const profile = this.options.profile ? `--profile ${this.options.profile}` : '';
      execSync(`aws sts get-caller-identity ${profile}`, { stdio: 'pipe' });
    } catch (error) {
      throw new Error('AWS credentials are not configured or invalid');
    }

    // リージョン確認
    if (this.options.region && this.options.region !== this.config.region) {
      console.warn(`⚠️ Region mismatch: CLI option (${this.options.region}) vs config (${this.config.region})`);
    }

    console.log('✅ Prerequisites check completed');
  }

  /**
   * CDKブートストラップ
   */
  private async bootstrapCdk(): Promise<void> {
    console.log('🚀 Bootstrapping CDK...');

    const region = this.options.region || this.config.region;
    const profile = this.options.profile ? `--profile ${this.options.profile}` : '';
    
    try {
      const command = `npx cdk bootstrap aws://${this.config.accountId}/${region} ${profile}`;
      
      if (this.options.verbose) {
        console.log(`Executing: ${command}`);
      }

      execSync(command, { 
        stdio: this.options.verbose ? 'inherit' : 'pipe',
        cwd: process.cwd()
      });
      
      console.log('✅ CDK bootstrap completed');
    } catch (error) {
      throw new Error(`CDK bootstrap failed: ${error}`);
    }
  }

  /**
   * ドライラン実行
   */
  private async performDryRun(): Promise<void> {
    console.log('🔍 Performing dry run...');

    const region = this.options.region || this.config.region;
    const profile = this.options.profile ? `--profile ${this.options.profile}` : '';
    const stackName = this.options.stackName || `${this.config.projectName}-${this.config.environment}-fsx-integration`;
    
    try {
      const command = `npx cdk diff ${stackName} --region ${region} ${profile}`;
      
      if (this.options.verbose) {
        console.log(`Executing: ${command}`);
      }

      execSync(command, { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      console.log('✅ Dry run completed');
    } catch (error) {
      console.warn('⚠️ Dry run completed with differences or warnings');
    }
  }

  /**
   * スタックのデプロイ
   */
  private async deployStacks(): Promise<void> {
    console.log('🚀 Deploying FSx Integration stacks...');

    const region = this.options.region || this.config.region;
    const profile = this.options.profile ? `--profile ${this.options.profile}` : '';
    const stackName = this.options.stackName || `${this.config.projectName}-${this.config.environment}-fsx-integration`;
    
    try {
      const command = `npx cdk deploy ${stackName} --region ${region} ${profile} --require-approval never`;
      
      if (this.options.verbose) {
        console.log(`Executing: ${command}`);
      }

      execSync(command, { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      
      console.log('✅ Stack deployment completed');
    } catch (error) {
      throw new Error(`Stack deployment failed: ${error}`);
    }
  }

  /**
   * デプロイ後の情報表示
   */
  private async showDeploymentInfo(): Promise<void> {
    console.log('\n📋 FSx Integration Deployment Information:');
    console.log(`Environment: ${this.config.environment}`);
    console.log(`Region: ${this.config.region}`);
    console.log(`Project: ${this.config.projectName}`);
    
    if (this.config.fsx?.enabled) {
      console.log('\n🗄️ FSx for ONTAP Resources:');
      this.config.fsx.fileSystems.forEach((fs, index) => {
        if (fs.enabled) {
          console.log(`  - FileSystem ${index + 1}: ${fs.name}`);
          console.log(`    Storage: ${fs.storageCapacity} GB`);
          console.log(`    Throughput: ${fs.throughputCapacity} MB/s`);
          console.log(`    Deployment: ${fs.deploymentType}`);
        }
      });
    }

    if (this.config.serverless?.enabled) {
      console.log('\n⚡ Serverless Resources:');
      
      if (this.config.serverless.stepFunctions.enabled) {
        console.log(`  - Step Functions: ${this.config.serverless.stepFunctions.workflows.filter(w => w.enabled).length} workflows`);
      }
      
      if (this.config.serverless.eventBridge.enabled) {
        console.log(`  - EventBridge: ${this.config.serverless.eventBridge.rules.filter(r => r.enabled).length} rules`);
      }
      
      if (this.config.serverless.sqs.enabled) {
        console.log(`  - SQS: ${this.config.serverless.sqs.queues.filter(q => q.enabled).length} queues`);
      }
      
      if (this.config.serverless.sns.enabled) {
        console.log(`  - SNS: ${this.config.serverless.sns.topics.filter(t => t.enabled).length} topics`);
      }
      
      console.log(`  - Lambda: ${this.config.serverless.lambda.functions.filter(f => f.enabled).length} functions`);
    }

    console.log('\n🔗 Useful Commands:');
    console.log(`  View outputs: npx cdk list --long`);
    console.log(`  View resources: aws cloudformation describe-stacks --stack-name ${this.config.projectName}-${this.config.environment}-fsx-integration`);
    console.log(`  Destroy stack: npx cdk destroy ${this.config.projectName}-${this.config.environment}-fsx-integration`);
  }
}

// CLI実行部分
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: ts-node scripts/deploy-fsx-integration.ts <environment> [options]');
    console.error('');
    console.error('Options:');
    console.error('  --config <path>        Configuration file path');
    console.error('  --dry-run             Perform dry run only');
    console.error('  --skip-validation     Skip configuration validation');
    console.error('  --stack-name <name>   Override stack name');
    console.error('  --region <region>     Override region');
    console.error('  --profile <profile>   AWS profile to use');
    console.error('  --verbose             Verbose output');
    console.error('');
    console.error('Examples:');
    console.error('  ts-node scripts/deploy-fsx-integration.ts development');
    console.error('  ts-node scripts/deploy-fsx-integration.ts production --dry-run');
    console.error('  ts-node scripts/deploy-fsx-integration.ts staging --region ap-northeast-1');
    process.exit(1);
  }

  const environment = args[0];
  const options: DeploymentOptions = { environment };

  // オプション解析
  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--config':
        options.configPath = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--skip-validation':
        options.skipValidation = true;
        break;
      case '--stack-name':
        options.stackName = args[++i];
        break;
      case '--region':
        options.region = args[++i];
        break;
      case '--profile':
        options.profile = args[++i];
        break;
      case '--verbose':
        options.verbose = true;
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }

  // デプロイ実行
  const deploymentManager = new FsxIntegrationDeploymentManager(options);
  deploymentManager.deploy().catch(error => {
    console.error('❌ FSx Integration deployment failed:', error.message);
    process.exit(1);
  });
}