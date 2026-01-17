/**
 * Cedar変換機能
 * 
 * パースされた構造化ポリシーをCedar Policy Language形式に変換します。
 * Cedar形式により形式的検証が可能になります。
 */

import { ParsedPolicy } from './natural-language-parser';

// Cedar変換結果
export interface CedarPolicy {
  id: string;
  effect: 'permit' | 'forbid';
  principal: string;
  action: string;
  resource: string;
  conditions?: string;
  annotations?: Record<string, string>;
}

// Cedar変換設定
export interface CedarConverterConfig {
  strictMode: boolean;
  includeAnnotations: boolean;
  validateSyntax: boolean;
}

export class CedarConverter {
  private config: CedarConverterConfig;

  constructor(config: Partial<CedarConverterConfig> = {}) {
    this.config = {
      strictMode: config.strictMode ?? true,
      includeAnnotations: config.includeAnnotations ?? true,
      validateSyntax: config.validateSyntax ?? true,
    };
  }

  /**
   * パースされたポリシーをCedar形式に変換
   */
  convertToCedar(parsedPolicy: ParsedPolicy, policyId: string): CedarPolicy {
    // Effect変換
    const effect = this.convertEffect(parsedPolicy.action.type);

    // Principal変換
    const principal = this.convertPrincipal(parsedPolicy.principal);

    // Action変換
    const action = this.convertAction(parsedPolicy.action.operations);

    // Resource変換
    const resource = this.convertResource(parsedPolicy.resource);

    // Conditions変換
    const conditions = parsedPolicy.conditions
      ? this.convertConditions(parsedPolicy.conditions)
      : undefined;

    // Annotations作成
    const annotations = this.config.includeAnnotations
      ? this.createAnnotations(parsedPolicy)
      : undefined;

    const cedarPolicy: CedarPolicy = {
      id: policyId,
      effect,
      principal,
      action,
      resource,
      conditions,
      annotations,
    };

    // 構文検証
    if (this.config.validateSyntax) {
      this.validateCedarSyntax(cedarPolicy);
    }

    return cedarPolicy;
  }

  /**
   * Effectを変換
   */
  private convertEffect(actionType: 'allow' | 'deny'): 'permit' | 'forbid' {
    return actionType === 'allow' ? 'permit' : 'forbid';
  }

  /**
   * Principalを変換
   */
  private convertPrincipal(principal: ParsedPolicy['principal']): string {
    const { type, identifier } = principal;

    switch (type) {
      case 'user':
        return `User::"${identifier}"`;
      case 'role':
        return `Role::"${identifier}"`;
      case 'group':
        return `Group::"${identifier}"`;
      default:
        throw new Error(`Unknown principal type: ${type}`);
    }
  }

  /**
   * Actionを変換
   */
  private convertAction(operations: string[]): string {
    if (operations.length === 0) {
      throw new Error('No operations specified');
    }

    if (operations.length === 1) {
      return `Action::"${operations[0]}"`;
    }

    // 複数操作の場合
    const actionList = operations.map(op => `"${op}"`).join(', ');
    return `[${actionList}]`;
  }

  /**
   * Resourceを変換
   */
  private convertResource(resource: ParsedPolicy['resource']): string {
    const { type, identifier, attributes } = resource;

    let resourceStr = `${type}::"${identifier}"`;

    // 属性がある場合
    if (attributes && Object.keys(attributes).length > 0) {
      const attrStr = Object.entries(attributes)
        .map(([key, value]) => `${key}: "${value}"`)
        .join(', ');
      resourceStr += ` { ${attrStr} }`;
    }

    return resourceStr;
  }

  /**
   * Conditionsを変換
   */
  private convertConditions(conditions: ParsedPolicy['conditions']): string {
    if (!conditions || conditions.length === 0) {
      return '';
    }

    const conditionStrs = conditions.map(cond => {
      const { attribute, operator, value } = cond;
      return this.convertSingleCondition(attribute, operator, value);
    });

    return conditionStrs.join(' && ');
  }

  /**
   * 単一条件を変換
   */
  private convertSingleCondition(
    attribute: string,
    operator: string,
    value: any
  ): string {
    const valueStr = typeof value === 'string' ? `"${value}"` : value;

    switch (operator) {
      case 'equals':
        return `context.${attribute} == ${valueStr}`;
      case 'notEquals':
        return `context.${attribute} != ${valueStr}`;
      case 'in':
        return `context.${attribute} in ${valueStr}`;
      case 'notIn':
        return `!(context.${attribute} in ${valueStr})`;
      case 'greaterThan':
        return `context.${attribute} > ${valueStr}`;
      case 'lessThan':
        return `context.${attribute} < ${valueStr}`;
      default:
        throw new Error(`Unknown operator: ${operator}`);
    }
  }

  /**
   * Annotationsを作成
   */
  private createAnnotations(parsedPolicy: ParsedPolicy): Record<string, string> {
    return {
      description: parsedPolicy.metadata.description,
      confidence: parsedPolicy.metadata.confidence.toString(),
      language: parsedPolicy.metadata.language,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Cedar構文を検証
   */
  private validateCedarSyntax(cedarPolicy: CedarPolicy): void {
    // ID検証
    if (!cedarPolicy.id || cedarPolicy.id.trim() === '') {
      throw new Error('Policy ID is required');
    }

    // Effect検証
    if (!['permit', 'forbid'].includes(cedarPolicy.effect)) {
      throw new Error(`Invalid effect: ${cedarPolicy.effect}`);
    }

    // Principal検証
    if (!cedarPolicy.principal || !this.isValidCedarEntity(cedarPolicy.principal)) {
      throw new Error(`Invalid principal: ${cedarPolicy.principal}`);
    }

    // Action検証
    if (!cedarPolicy.action) {
      throw new Error('Action is required');
    }

    // Resource検証
    if (!cedarPolicy.resource || !this.isValidCedarEntity(cedarPolicy.resource)) {
      throw new Error(`Invalid resource: ${cedarPolicy.resource}`);
    }
  }

  /**
   * Cedar Entity形式を検証
   */
  private isValidCedarEntity(entity: string): boolean {
    // 基本形式: Type::"identifier"
    const basicPattern = /^[A-Za-z]+::"[^"]+"/;
    // 配列形式: [Action::"op1", Action::"op2"]
    const arrayPattern = /^\[.*\]$/;

    return basicPattern.test(entity) || arrayPattern.test(entity);
  }

  /**
   * Cedar Policy Languageテキストを生成
   */
  generateCedarText(cedarPolicy: CedarPolicy): string {
    let cedarText = '';

    // Annotations
    if (cedarPolicy.annotations && this.config.includeAnnotations) {
      for (const [key, value] of Object.entries(cedarPolicy.annotations)) {
        cedarText += `@${key}("${value}")\n`;
      }
    }

    // Policy本体
    cedarText += `${cedarPolicy.effect}(\n`;
    cedarText += `  principal == ${cedarPolicy.principal},\n`;
    cedarText += `  action in ${cedarPolicy.action},\n`;
    cedarText += `  resource == ${cedarPolicy.resource}`;

    // Conditions
    if (cedarPolicy.conditions) {
      cedarText += `\n)\nwhen {\n  ${cedarPolicy.conditions}\n};`;
    } else {
      cedarText += `\n);`;
    }

    return cedarText;
  }

  /**
   * バッチ変換
   */
  convertMultipleToCedar(
    parsedPolicies: ParsedPolicy[],
    baseId: string = 'policy'
  ): CedarPolicy[] {
    return parsedPolicies.map((policy, index) => {
      const policyId = `${baseId}-${index + 1}`;
      return this.convertToCedar(policy, policyId);
    });
  }

  /**
   * Cedar Policy Setを生成（複数ポリシー）
   */
  generateCedarPolicySet(cedarPolicies: CedarPolicy[]): string {
    return cedarPolicies
      .map(policy => this.generateCedarText(policy))
      .join('\n\n');
  }
}
