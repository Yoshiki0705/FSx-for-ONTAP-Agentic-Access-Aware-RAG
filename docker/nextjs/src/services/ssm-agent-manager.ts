/**
 * SSM Agent ID管理サービス
 * UI操作と連動してSSMパラメータを自動管理
 */

import { SSMClient, GetParameterCommand, PutParameterCommand, DeleteParameterCommand } from '@aws-sdk/client-ssm';

export interface SSMAgentManagerConfig {
  region: string;
  environment: string;
  ssmPrefix: string;
}

export class SSMAgentManager {
  private ssmClient: SSMClient;
  private config: SSMAgentManagerConfig;

  constructor(config: SSMAgentManagerConfig) {
    this.config = config;
    this.ssmClient = new SSMClient({ region: config.region });
  }

  /**
   * Agent ID取得
   */
  async getAgentId(): Promise<string | null> {
    const parameterName = `${this.config.ssmPrefix}/${this.config.environment}/agent-id`;
    
    try {
      const command = new GetParameterCommand({
        Name: parameterName,
        WithDecryption: true
      });
      
      const response = await this.ssmClient.send(command);
      return response.Parameter?.Value || null;
    } catch (error) {
      console.warn(`SSM Parameter not found: ${parameterName}`, error);
      return null;
    }
  }

  /**
   * Agent ID登録（Agent作成時に自動実行）
   */
  async registerAgentId(agentId: string, agentName?: string): Promise<void> {
    const parameterName = `${this.config.ssmPrefix}/${this.config.environment}/agent-id`;
    const description = `Bedrock Agent ID for ${this.config.environment} environment${agentName ? ` (${agentName})` : ''}`;
    
    try {
      const command = new PutParameterCommand({
        Name: parameterName,
        Value: agentId,
        Type: 'SecureString',
        Description: description,
        Overwrite: true,
        Tags: [
          {
            Key: 'Environment',
            Value: this.config.environment
          },
          {
            Key: 'Service',
            Value: 'BedrockAgent'
          },
          {
            Key: 'ManagedBy',
            Value: 'UI-AutoSync'
          }
        ]
      });
      
      await this.ssmClient.send(command);
      console.log(`✅ Agent ID registered to SSM: ${agentId}`);
    } catch (error) {
      console.error(`❌ Failed to register Agent ID to SSM: ${agentId}`, error);
      throw error;
    }
  }

  /**
   * Agent ID削除（Agent削除時に自動実行）
   */
  async unregisterAgentId(): Promise<void> {
    const parameterName = `${this.config.ssmPrefix}/${this.config.environment}/agent-id`;
    
    try {
      // パラメータの存在確認
      const currentAgentId = await this.getAgentId();
      if (!currentAgentId) {
        console.log(`ℹ️ SSM Parameter already deleted: ${parameterName}`);
        return;
      }
      
      const command = new DeleteParameterCommand({
        Name: parameterName
      });
      
      await this.ssmClient.send(command);
      console.log(`✅ Agent ID unregistered from SSM: ${currentAgentId}`);
    } catch (error) {
      console.error(`❌ Failed to unregister Agent ID from SSM`, error);
      throw error;
    }
  }

  /**
   * Agent ID更新（Agent更新時に自動実行）
   */
  async updateAgentId(newAgentId: string, agentName?: string): Promise<void> {
    const currentAgentId = await this.getAgentId();
    
    if (currentAgentId === newAgentId) {
      console.log(`ℹ️ Agent ID unchanged: ${newAgentId}`);
      return;
    }
    
    await this.registerAgentId(newAgentId, agentName);
    console.log(`✅ Agent ID updated: ${currentAgentId} → ${newAgentId}`);
  }

  /**
   * 同期状態確認
   */
  async verifySyncStatus(expectedAgentId?: string): Promise<{
    isSync: boolean;
    ssmAgentId: string | null;
    expectedAgentId?: string;
    message: string;
  }> {
    const ssmAgentId = await this.getAgentId();
    
    if (!ssmAgentId) {
      return {
        isSync: false,
        ssmAgentId: null,
        expectedAgentId,
        message: 'SSMパラメータにAgent IDが登録されていません'
      };
    }
    
    if (expectedAgentId && ssmAgentId !== expectedAgentId) {
      return {
        isSync: false,
        ssmAgentId,
        expectedAgentId,
        message: `Agent IDが不一致です。SSM: ${ssmAgentId}, 期待値: ${expectedAgentId}`
      };
    }
    
    return {
      isSync: true,
      ssmAgentId,
      expectedAgentId,
      message: 'Agent IDが正常に同期されています'
    };
  }
}

/**
 * 環境別SSMAgentManagerファクトリー
 */
export class SSMAgentManagerFactory {
  private static instances = new Map<string, SSMAgentManager>();
  
  static getInstance(environment: string = 'prod'): SSMAgentManager {
    if (!this.instances.has(environment)) {
      const config: SSMAgentManagerConfig = {
        region: process.env.AWS_REGION || 'ap-northeast-1',
        environment,
        ssmPrefix: '/bedrock-agent'
      };
      
      this.instances.set(environment, new SSMAgentManager(config));
    }
    
    return this.instances.get(environment)!;
  }
  
  static clearCache(): void {
    this.instances.clear();
  }
}