/**
 * ポリシー検証機能
 * 
 * ポリシーの妥当性を検証し、潜在的な問題を検出します。
 * セキュリティリスク、競合、ベストプラクティス違反などをチェックします。
 */

import { ParsedPolicy } from './natural-language-parser';
import { CedarPolicy } from './cedar-converter';

// 検証結果
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
  score: number; // 0-100
}

// 検証エラー
export interface ValidationError {
  code: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  field?: string;
}

// 検証警告
export interface ValidationWarning {
  code: string;
  message: string;
  recommendation: string;
}

// 検証設定
export interface ValidatorConfig {
  strictMode: boolean;
  checkConflicts: boolean;
  checkBestPractices: boolean;
  checkSecurity: boolean;
}

export class PolicyValidator {
  private config: ValidatorConfig;

  constructor(config: Partial<ValidatorConfig> = {}) {
    this.config = {
      strictMode: config.strictMode ?? true,
      checkConflicts: config.checkConflicts ?? true,
      checkBestPractices: config.checkBestPractices ?? true,
      checkSecurity: config.checkSecurity ?? true,
    };
  }

  /**
   * パースされたポリシーを検証
   */
  validateParsedPolicy(policy: ParsedPolicy): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // 基本検証
    this.validateBasicStructure(policy, errors);

    // セキュリティ検証
    if (this.config.checkSecurity) {
      this.validateSecurity(policy, errors, warnings);
    }

    // ベストプラクティス検証
    if (this.config.checkBestPractices) {
      this.validateBestPractices(policy, warnings, suggestions);
    }

    // 信頼度チェック
    this.validateConfidence(policy, warnings);

    // スコア計算
    const score = this.calculateScore(errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      score,
    };
  }

  /**
   * Cedarポリシーを検証
   */
  validateCedarPolicy(policy: CedarPolicy): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // Cedar構文検証
    this.validateCedarSyntax(policy, errors);

    // Cedar特有の検証
    this.validateCedarSpecific(policy, warnings, suggestions);

    // スコア計算
    const score = this.calculateScore(errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      score,
    };
  }

  /**
   * 基本構造を検証
   */
  private validateBasicStructure(policy: ParsedPolicy, errors: ValidationError[]): void {
    // Principal検証
    if (!policy.principal || !policy.principal.type || !policy.principal.identifier) {
      errors.push({
        code: 'INVALID_PRINCIPAL',
        message: 'Principal is missing or invalid',
        severity: 'critical',
        field: 'principal',
      });
    }

    // Action検証
    if (!policy.action || !policy.action.type) {
      errors.push({
        code: 'INVALID_ACTION',
        message: 'Action type is missing',
        severity: 'critical',
        field: 'action.type',
      });
    }

    if (!policy.action || !policy.action.operations || policy.action.operations.length === 0) {
      errors.push({
        code: 'NO_OPERATIONS',
        message: 'No operations specified',
        severity: 'high',
        field: 'action.operations',
      });
    }

    // Resource検証
    if (!policy.resource || !policy.resource.type || !policy.resource.identifier) {
      errors.push({
        code: 'INVALID_RESOURCE',
        message: 'Resource is missing or invalid',
        severity: 'critical',
        field: 'resource',
      });
    }

    // Metadata検証
    if (!policy.metadata || !policy.metadata.description) {
      errors.push({
        code: 'MISSING_DESCRIPTION',
        message: 'Policy description is required',
        severity: 'medium',
        field: 'metadata.description',
      });
    }
  }

  /**
   * セキュリティを検証
   */
  private validateSecurity(
    policy: ParsedPolicy,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // 過度に広範なアクセス許可チェック
    if (policy.action.type === 'allow' && policy.action.operations.includes('*')) {
      warnings.push({
        code: 'OVERLY_PERMISSIVE',
        message: 'Policy allows all operations (*)',
        recommendation: 'Specify explicit operations instead of using wildcard',
      });
    }

    // 全リソースへのアクセスチェック
    if (policy.resource.identifier === '*') {
      warnings.push({
        code: 'ALL_RESOURCES',
        message: 'Policy applies to all resources',
        recommendation: 'Limit scope to specific resources',
      });
    }

    // 条件なしの拒否ポリシーチェック
    if (policy.action.type === 'deny' && (!policy.conditions || policy.conditions.length === 0)) {
      warnings.push({
        code: 'UNCONDITIONAL_DENY',
        message: 'Deny policy without conditions may be too restrictive',
        recommendation: 'Consider adding conditions to make the policy more specific',
      });
    }

    // 機密操作チェック
    const sensitiveOperations = ['delete', 'destroy', 'terminate', 'drop'];
    const hasSensitiveOp = policy.action.operations.some(op =>
      sensitiveOperations.some(sensitive => op.toLowerCase().includes(sensitive))
    );

    if (hasSensitiveOp && policy.action.type === 'allow') {
      warnings.push({
        code: 'SENSITIVE_OPERATION',
        message: 'Policy allows sensitive operations',
        recommendation: 'Add additional conditions or require approval workflow',
      });
    }
  }

  /**
   * ベストプラクティスを検証
   */
  private validateBestPractices(
    policy: ParsedPolicy,
    warnings: ValidationWarning[],
    suggestions: string[]
  ): void {
    // 説明の長さチェック
    if (policy.metadata.description.length < 20) {
      suggestions.push('ポリシーの説明をより詳細にすることを推奨します');
    }

    // 条件の使用推奨
    if (!policy.conditions || policy.conditions.length === 0) {
      suggestions.push('条件を追加してポリシーをより具体的にすることを検討してください');
    }

    // Principal typeの推奨
    if (policy.principal.type === 'user') {
      suggestions.push('個別ユーザーではなくロールやグループの使用を検討してください');
    }

    // 操作数チェック
    if (policy.action.operations.length > 10) {
      warnings.push({
        code: 'TOO_MANY_OPERATIONS',
        message: 'Policy specifies many operations',
        recommendation: 'Consider splitting into multiple policies for better maintainability',
      });
    }
  }

  /**
   * 信頼度を検証
   */
  private validateConfidence(policy: ParsedPolicy, warnings: ValidationWarning[]): void {
    const confidence = policy.metadata.confidence;

    if (confidence < 0.7) {
      warnings.push({
        code: 'LOW_CONFIDENCE',
        message: `Low confidence score: ${confidence}`,
        recommendation: 'Review and refine the natural language policy for clarity',
      });
    } else if (confidence < 0.85) {
      warnings.push({
        code: 'MEDIUM_CONFIDENCE',
        message: `Medium confidence score: ${confidence}`,
        recommendation: 'Consider reviewing the policy for potential ambiguities',
      });
    }
  }

  /**
   * Cedar構文を検証
   */
  private validateCedarSyntax(policy: CedarPolicy, errors: ValidationError[]): void {
    // Effect検証
    if (!['permit', 'forbid'].includes(policy.effect)) {
      errors.push({
        code: 'INVALID_EFFECT',
        message: `Invalid effect: ${policy.effect}`,
        severity: 'critical',
        field: 'effect',
      });
    }

    // ID検証
    if (!policy.id || policy.id.trim() === '') {
      errors.push({
        code: 'MISSING_ID',
        message: 'Policy ID is required',
        severity: 'critical',
        field: 'id',
      });
    }

    // Principal形式検証
    if (!this.isValidCedarEntity(policy.principal)) {
      errors.push({
        code: 'INVALID_CEDAR_PRINCIPAL',
        message: 'Principal does not match Cedar entity format',
        severity: 'high',
        field: 'principal',
      });
    }

    // Resource形式検証
    if (!this.isValidCedarEntity(policy.resource)) {
      errors.push({
        code: 'INVALID_CEDAR_RESOURCE',
        message: 'Resource does not match Cedar entity format',
        severity: 'high',
        field: 'resource',
      });
    }
  }

  /**
   * Cedar特有の検証
   */
  private validateCedarSpecific(
    policy: CedarPolicy,
    warnings: ValidationWarning[],
    suggestions: string[]
  ): void {
    // Annotationsの推奨
    if (!policy.annotations || Object.keys(policy.annotations).length === 0) {
      suggestions.push('Annotationsを追加してポリシーのメタデータを記録することを推奨します');
    }

    // Conditionsの複雑さチェック
    if (policy.conditions && policy.conditions.length > 200) {
      warnings.push({
        code: 'COMPLEX_CONDITIONS',
        message: 'Policy has complex conditions',
        recommendation: 'Consider simplifying conditions or splitting into multiple policies',
      });
    }
  }

  /**
   * Cedar Entity形式を検証
   */
  private isValidCedarEntity(entity: string): boolean {
    const basicPattern = /^[A-Za-z]+::"[^"]+"/;
    const arrayPattern = /^\[.*\]$/;
    return basicPattern.test(entity) || arrayPattern.test(entity);
  }

  /**
   * スコアを計算
   */
  private calculateScore(errors: ValidationError[], warnings: ValidationWarning[]): number {
    let score = 100;

    // エラーによる減点
    for (const error of errors) {
      switch (error.severity) {
        case 'critical':
          score -= 25;
          break;
        case 'high':
          score -= 15;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    }

    // 警告による減点
    score -= warnings.length * 3;

    return Math.max(0, score);
  }

  /**
   * 複数ポリシー間の競合を検出
   */
  detectConflicts(policies: ParsedPolicy[]): Array<{
    policy1: number;
    policy2: number;
    conflictType: string;
    description: string;
  }> {
    const conflicts: Array<{
      policy1: number;
      policy2: number;
      conflictType: string;
      description: string;
    }> = [];

    for (let i = 0; i < policies.length; i++) {
      for (let j = i + 1; j < policies.length; j++) {
        const conflict = this.checkPolicyConflict(policies[i], policies[j]);
        if (conflict) {
          conflicts.push({
            policy1: i,
            policy2: j,
            conflictType: conflict.type,
            description: conflict.description,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * 2つのポリシー間の競合をチェック
   */
  private checkPolicyConflict(
    policy1: ParsedPolicy,
    policy2: ParsedPolicy
  ): { type: string; description: string } | null {
    // 同じPrincipalとResourceを対象としているかチェック
    const samePrincipal =
      policy1.principal.type === policy2.principal.type &&
      policy1.principal.identifier === policy2.principal.identifier;

    const sameResource =
      policy1.resource.type === policy2.resource.type &&
      policy1.resource.identifier === policy2.resource.identifier;

    if (!samePrincipal || !sameResource) {
      return null;
    }

    // Allow/Deny競合チェック
    if (policy1.action.type !== policy2.action.type) {
      const hasCommonOperation = policy1.action.operations.some(op =>
        policy2.action.operations.includes(op)
      );

      if (hasCommonOperation) {
        return {
          type: 'ALLOW_DENY_CONFLICT',
          description: 'One policy allows while another denies the same operation',
        };
      }
    }

    return null;
  }

  /**
   * バッチ検証
   */
  validateMultiplePolicies(policies: ParsedPolicy[]): ValidationResult[] {
    return policies.map(policy => this.validateParsedPolicy(policy));
  }

  /**
   * 検証レポートを生成
   */
  generateValidationReport(results: ValidationResult[]): string {
    let report = '# ポリシー検証レポート\n\n';

    const totalPolicies = results.length;
    const validPolicies = results.filter(r => r.isValid).length;
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / totalPolicies;

    report += `## サマリー\n`;
    report += `- 総ポリシー数: ${totalPolicies}\n`;
    report += `- 有効なポリシー: ${validPolicies}\n`;
    report += `- 平均スコア: ${avgScore.toFixed(2)}\n\n`;

    report += `## 詳細\n\n`;
    results.forEach((result, index) => {
      report += `### ポリシー ${index + 1}\n`;
      report += `- スコア: ${result.score}\n`;
      report += `- エラー数: ${result.errors.length}\n`;
      report += `- 警告数: ${result.warnings.length}\n`;

      if (result.errors.length > 0) {
        report += `\n#### エラー\n`;
        result.errors.forEach(error => {
          report += `- [${error.severity}] ${error.code}: ${error.message}\n`;
        });
      }

      if (result.warnings.length > 0) {
        report += `\n#### 警告\n`;
        result.warnings.forEach(warning => {
          report += `- ${warning.code}: ${warning.message}\n`;
        });
      }

      report += `\n`;
    });

    return report;
  }
}
