/**
 * Cedar統合機能
 * 
 * Cedar Policy Languageとの統合により、形式的検証と高度な競合検出を提供します。
 * Cedarの型システムとスキーマ検証を活用します。
 */

import { CedarPolicy } from './cedar-converter';
import { ParsedPolicy } from './natural-language-parser';

// Cedar検証結果
export interface CedarValidationResult {
  isValid: boolean;
  errors: CedarValidationError[];
  warnings: CedarValidationWarning[];
  formalVerification?: FormalVerificationResult;
}

// Cedar検証エラー
export interface CedarValidationError {
  code: string;
  message: string;
  location?: {
    line: number;
    column: number;
  };
  severity: 'error' | 'warning';
}

// Cedar検証警告
export interface CedarValidationWarning {
  code: string;
  message: string;
  suggestion: string;
}

// 形式的検証結果
export interface FormalVerificationResult {
  isConsistent: boolean;
  isComplete: boolean;
  hasDeadCode: boolean;
  reachabilityAnalysis: ReachabilityAnalysis;
  conflictAnalysis: ConflictAnalysis;
}

// 到達可能性分析
export interface ReachabilityAnalysis {
  reachablePolicies: string[];
  unreachablePolicies: string[];
  shadowedPolicies: string[];
}

// 競合分析
export interface ConflictAnalysis {
  conflicts: PolicyConflict[];
  redundancies: PolicyRedundancy[];
  gaps: PolicyGap[];
}

// ポリシー競合
export interface PolicyConflict {
  policy1Id: string;
  policy2Id: string;
  conflictType: 'allow-deny' | 'overlapping-conditions' | 'contradictory-rules';
  description: string;
  resolution: string;
}

// ポリシー冗長性
export interface PolicyRedundancy {
  policyId: string;
  redundantWith: string[];
  reason: string;
}

// ポリシーギャップ
export interface PolicyGap {
  principal: string;
  action: string;
  resource: string;
  description: string;
}

// Cedar統合設定
export interface CedarIntegrationConfig {
  enableFormalVerification: boolean;
  enableSchemaValidation: boolean;
  enableConflictDetection: boolean;
  strictMode: boolean;
}

export class CedarIntegration {
  private config: CedarIntegrationConfig;

  constructor(config: Partial<CedarIntegrationConfig> = {}) {
    this.config = {
      enableFormalVerification: config.enableFormalVerification ?? true,
      enableSchemaValidation: config.enableSchemaValidation ?? true,
      enableConflictDetection: config.enableConflictDetection ?? true,
      strictMode: config.strictMode ?? true,
    };
  }

  /**
   * Cedarポリシーを検証
   */
  validateCedarPolicy(policy: CedarPolicy): CedarValidationResult {
    const errors: CedarValidationError[] = [];
    const warnings: CedarValidationWarning[] = [];

    // 基本構文検証
    this.validateSyntax(policy, errors);

    // スキーマ検証
    if (this.config.enableSchemaValidation) {
      this.validateSchema(policy, errors, warnings);
    }

    // 型検証
    this.validateTypes(policy, errors);

    // セマンティック検証
    this.validateSemantics(policy, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 複数ポリシーの形式的検証
   */
  performFormalVerification(policies: CedarPolicy[]): FormalVerificationResult {
    // 一貫性チェック
    const isConsistent = this.checkConsistency(policies);

    // 完全性チェック
    const isComplete = this.checkCompleteness(policies);

    // デッドコード検出
    const hasDeadCode = this.detectDeadCode(policies);

    // 到達可能性分析
    const reachabilityAnalysis = this.analyzeReachability(policies);

    // 競合分析
    const conflictAnalysis = this.analyzeConflicts(policies);

    return {
      isConsistent,
      isComplete,
      hasDeadCode,
      reachabilityAnalysis,
      conflictAnalysis,
    };
  }

  /**
   * 構文検証
   */
  private validateSyntax(policy: CedarPolicy, errors: CedarValidationError[]): void {
    // Effect検証
    if (!['permit', 'forbid'].includes(policy.effect)) {
      errors.push({
        code: 'INVALID_EFFECT',
        message: `Invalid effect: ${policy.effect}. Must be 'permit' or 'forbid'`,
        severity: 'error',
      });
    }

    // ID検証
    if (!policy.id || !/^[a-zA-Z0-9_-]+$/.test(policy.id)) {
      errors.push({
        code: 'INVALID_ID',
        message: 'Policy ID must contain only alphanumeric characters, hyphens, and underscores',
        severity: 'error',
      });
    }

    // Principal検証
    if (!this.isValidEntityReference(policy.principal)) {
      errors.push({
        code: 'INVALID_PRINCIPAL',
        message: `Invalid principal format: ${policy.principal}`,
        severity: 'error',
      });
    }

    // Action検証
    if (!this.isValidActionReference(policy.action)) {
      errors.push({
        code: 'INVALID_ACTION',
        message: `Invalid action format: ${policy.action}`,
        severity: 'error',
      });
    }

    // Resource検証
    if (!this.isValidEntityReference(policy.resource)) {
      errors.push({
        code: 'INVALID_RESOURCE',
        message: `Invalid resource format: ${policy.resource}`,
        severity: 'error',
      });
    }
  }

  /**
   * スキーマ検証
   */
  private validateSchema(
    policy: CedarPolicy,
    errors: CedarValidationError[],
    warnings: CedarValidationWarning[]
  ): void {
    // Entity型の存在確認
    const principalType = this.extractEntityType(policy.principal);
    if (!this.isKnownEntityType(principalType)) {
      warnings.push({
        code: 'UNKNOWN_PRINCIPAL_TYPE',
        message: `Unknown principal type: ${principalType}`,
        suggestion: 'Ensure the entity type is defined in your Cedar schema',
      });
    }

    const resourceType = this.extractEntityType(policy.resource);
    if (!this.isKnownEntityType(resourceType)) {
      warnings.push({
        code: 'UNKNOWN_RESOURCE_TYPE',
        message: `Unknown resource type: ${resourceType}`,
        suggestion: 'Ensure the entity type is defined in your Cedar schema',
      });
    }

    // Action型の存在確認
    const actions = this.extractActions(policy.action);
    for (const action of actions) {
      if (!this.isKnownAction(action)) {
        warnings.push({
          code: 'UNKNOWN_ACTION',
          message: `Unknown action: ${action}`,
          suggestion: 'Ensure the action is defined in your Cedar schema',
        });
      }
    }
  }

  /**
   * 型検証
   */
  private validateTypes(policy: CedarPolicy, errors: CedarValidationError[]): void {
    // Conditions型検証
    if (policy.conditions) {
      const typeErrors = this.validateConditionTypes(policy.conditions);
      errors.push(...typeErrors);
    }

    // Annotations型検証
    if (policy.annotations) {
      for (const [key, value] of Object.entries(policy.annotations)) {
        if (typeof value !== 'string') {
          errors.push({
            code: 'INVALID_ANNOTATION_TYPE',
            message: `Annotation '${key}' must be a string`,
            severity: 'error',
          });
        }
      }
    }
  }

  /**
   * セマンティック検証
   */
  private validateSemantics(policy: CedarPolicy, warnings: CedarValidationWarning[]): void {
    // 過度に広範なポリシー
    if (this.isTooPermissive(policy)) {
      warnings.push({
        code: 'OVERLY_PERMISSIVE',
        message: 'Policy is overly permissive',
        suggestion: 'Consider adding more specific conditions to limit the scope',
      });
    }

    // 到達不可能なポリシー
    if (this.isUnreachable(policy)) {
      warnings.push({
        code: 'UNREACHABLE_POLICY',
        message: 'Policy may be unreachable due to conflicting policies',
        suggestion: 'Review policy ordering and conditions',
      });
    }
  }

  /**
   * 一貫性チェック
   */
  private checkConsistency(policies: CedarPolicy[]): boolean {
    // Allow/Deny競合チェック
    for (let i = 0; i < policies.length; i++) {
      for (let j = i + 1; j < policies.length; j++) {
        if (this.hasAllowDenyConflict(policies[i], policies[j])) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 完全性チェック
   */
  private checkCompleteness(policies: CedarPolicy[]): boolean {
    // 全ての重要なアクセスパターンがカバーされているかチェック
    const criticalPatterns = this.getCriticalAccessPatterns();
    
    for (const pattern of criticalPatterns) {
      if (!this.isCoveredByPolicies(pattern, policies)) {
        return false;
      }
    }

    return true;
  }

  /**
   * デッドコード検出
   */
  private detectDeadCode(policies: CedarPolicy[]): boolean {
    for (const policy of policies) {
      if (this.isDeadCode(policy, policies)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 到達可能性分析
   */
  private analyzeReachability(policies: CedarPolicy[]): ReachabilityAnalysis {
    const reachable: string[] = [];
    const unreachable: string[] = [];
    const shadowed: string[] = [];

    for (const policy of policies) {
      if (this.isReachable(policy, policies)) {
        reachable.push(policy.id);
      } else {
        unreachable.push(policy.id);
      }

      if (this.isShadowed(policy, policies)) {
        shadowed.push(policy.id);
      }
    }

    return {
      reachablePolicies: reachable,
      unreachablePolicies: unreachable,
      shadowedPolicies: shadowed,
    };
  }

  /**
   * 競合分析
   */
  private analyzeConflicts(policies: CedarPolicy[]): ConflictAnalysis {
    const conflicts: PolicyConflict[] = [];
    const redundancies: PolicyRedundancy[] = [];
    const gaps: PolicyGap[] = [];

    // 競合検出
    for (let i = 0; i < policies.length; i++) {
      for (let j = i + 1; j < policies.length; j++) {
        const conflict = this.detectConflict(policies[i], policies[j]);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    // 冗長性検出
    for (const policy of policies) {
      const redundancy = this.detectRedundancy(policy, policies);
      if (redundancy) {
        redundancies.push(redundancy);
      }
    }

    // ギャップ検出
    gaps.push(...this.detectGaps(policies));

    return {
      conflicts,
      redundancies,
      gaps,
    };
  }

  /**
   * Entity参照の妥当性チェック
   */
  private isValidEntityReference(ref: string): boolean {
    // 基本形式: Type::"identifier"
    const basicPattern = /^[A-Za-z][A-Za-z0-9]*::"[^"]+"/;
    // 配列形式: [Type::"id1", Type::"id2"]
    const arrayPattern = /^\[([A-Za-z][A-Za-z0-9]*::"[^"]+"(,\s*)?)+\]$/;

    return basicPattern.test(ref) || arrayPattern.test(ref);
  }

  /**
   * Action参照の妥当性チェック
   */
  private isValidActionReference(ref: string): boolean {
    // Action形式: Action::"operation" または [Action::"op1", Action::"op2"]
    return this.isValidEntityReference(ref);
  }

  /**
   * Entity型を抽出
   */
  private extractEntityType(ref: string): string {
    const match = ref.match(/^([A-Za-z][A-Za-z0-9]*)::/);
    return match ? match[1] : '';
  }

  /**
   * Actionを抽出
   */
  private extractActions(ref: string): string[] {
    const actions: string[] = [];
    const matches = ref.matchAll(/Action::"([^"]+)"/g);
    
    for (const match of matches) {
      actions.push(match[1]);
    }

    return actions;
  }

  /**
   * 既知のEntity型かチェック
   */
  private isKnownEntityType(type: string): boolean {
    const knownTypes = ['User', 'Role', 'Group', 'Document', 'Resource', 'Action'];
    return knownTypes.includes(type);
  }

  /**
   * 既知のActionかチェック
   */
  private isKnownAction(action: string): boolean {
    const knownActions = ['read', 'write', 'delete', 'update', 'create', 'list'];
    return knownActions.includes(action);
  }

  /**
   * Condition型を検証
   */
  private validateConditionTypes(conditions: string): CedarValidationError[] {
    const errors: CedarValidationError[] = [];
    
    // 簡易的な型チェック（実際のCedarエンジンではより厳密）
    if (conditions.includes('context.') && !conditions.includes('==') && !conditions.includes('!=')) {
      errors.push({
        code: 'INVALID_CONDITION_OPERATOR',
        message: 'Condition must use valid comparison operators',
        severity: 'error',
      });
    }

    return errors;
  }

  /**
   * 過度に広範なポリシーかチェック
   */
  private isTooPermissive(policy: CedarPolicy): boolean {
    return (
      policy.effect === 'permit' &&
      (policy.action.includes('*') || policy.resource.includes('*'))
    );
  }

  /**
   * 到達不可能なポリシーかチェック
   */
  private isUnreachable(policy: CedarPolicy): boolean {
    // 簡易実装（実際はより複雑な分析が必要）
    return false;
  }

  /**
   * Allow/Deny競合をチェック
   */
  private hasAllowDenyConflict(policy1: CedarPolicy, policy2: CedarPolicy): boolean {
    return (
      policy1.effect !== policy2.effect &&
      policy1.principal === policy2.principal &&
      policy1.resource === policy2.resource &&
      this.hasOverlappingActions(policy1.action, policy2.action)
    );
  }

  /**
   * Actionの重複をチェック
   */
  private hasOverlappingActions(action1: string, action2: string): boolean {
    const actions1 = this.extractActions(action1);
    const actions2 = this.extractActions(action2);

    return actions1.some(a => actions2.includes(a));
  }

  /**
   * 重要なアクセスパターンを取得
   */
  private getCriticalAccessPatterns(): Array<{ principal: string; action: string; resource: string }> {
    return [
      { principal: 'User', action: 'read', resource: 'Document' },
      { principal: 'User', action: 'write', resource: 'Document' },
      { principal: 'Admin', action: 'delete', resource: 'Document' },
    ];
  }

  /**
   * パターンがポリシーでカバーされているかチェック
   */
  private isCoveredByPolicies(
    pattern: { principal: string; action: string; resource: string },
    policies: CedarPolicy[]
  ): boolean {
    return policies.some(policy => this.coversPattern(policy, pattern));
  }

  /**
   * ポリシーがパターンをカバーしているかチェック
   */
  private coversPattern(
    policy: CedarPolicy,
    pattern: { principal: string; action: string; resource: string }
  ): boolean {
    return (
      policy.principal.includes(pattern.principal) &&
      policy.action.includes(pattern.action) &&
      policy.resource.includes(pattern.resource)
    );
  }

  /**
   * デッドコードかチェック
   */
  private isDeadCode(policy: CedarPolicy, allPolicies: CedarPolicy[]): boolean {
    // 他のポリシーに完全に覆われている場合はデッドコード
    return allPolicies.some(
      other =>
        other.id !== policy.id &&
        this.subsumes(other, policy)
    );
  }

  /**
   * policy1がpolicy2を包含するかチェック
   */
  private subsumes(policy1: CedarPolicy, policy2: CedarPolicy): boolean {
    return (
      policy1.effect === policy2.effect &&
      this.isMoreGeneral(policy1.principal, policy2.principal) &&
      this.isMoreGeneral(policy1.action, policy2.action) &&
      this.isMoreGeneral(policy1.resource, policy2.resource)
    );
  }

  /**
   * ref1がref2より一般的かチェック
   */
  private isMoreGeneral(ref1: string, ref2: string): boolean {
    return ref1.includes('*') || ref1 === ref2;
  }

  /**
   * 到達可能かチェック
   */
  private isReachable(policy: CedarPolicy, allPolicies: CedarPolicy[]): boolean {
    // 簡易実装
    return !this.isDeadCode(policy, allPolicies);
  }

  /**
   * シャドウされているかチェック
   */
  private isShadowed(policy: CedarPolicy, allPolicies: CedarPolicy[]): boolean {
    // より優先度の高いポリシーに覆われている場合
    return allPolicies.some(
      other =>
        other.id !== policy.id &&
        this.shadows(other, policy)
    );
  }

  /**
   * policy1がpolicy2をシャドウするかチェック
   */
  private shadows(policy1: CedarPolicy, policy2: CedarPolicy): boolean {
    return this.subsumes(policy1, policy2);
  }

  /**
   * 競合を検出
   */
  private detectConflict(policy1: CedarPolicy, policy2: CedarPolicy): PolicyConflict | null {
    if (this.hasAllowDenyConflict(policy1, policy2)) {
      return {
        policy1Id: policy1.id,
        policy2Id: policy2.id,
        conflictType: 'allow-deny',
        description: 'One policy permits while the other forbids the same action',
        resolution: 'Review and consolidate policies, or add more specific conditions',
      };
    }

    return null;
  }

  /**
   * 冗長性を検出
   */
  private detectRedundancy(policy: CedarPolicy, allPolicies: CedarPolicy[]): PolicyRedundancy | null {
    const redundantWith = allPolicies
      .filter(other => other.id !== policy.id && this.isRedundant(policy, other))
      .map(p => p.id);

    if (redundantWith.length > 0) {
      return {
        policyId: policy.id,
        redundantWith,
        reason: 'Policy is covered by other policies',
      };
    }

    return null;
  }

  /**
   * 冗長かチェック
   */
  private isRedundant(policy1: CedarPolicy, policy2: CedarPolicy): boolean {
    return this.subsumes(policy2, policy1);
  }

  /**
   * ギャップを検出
   */
  private detectGaps(policies: CedarPolicy[]): PolicyGap[] {
    const gaps: PolicyGap[] = [];
    const criticalPatterns = this.getCriticalAccessPatterns();

    for (const pattern of criticalPatterns) {
      if (!this.isCoveredByPolicies(pattern, policies)) {
        gaps.push({
          principal: pattern.principal,
          action: pattern.action,
          resource: pattern.resource,
          description: `No policy covers ${pattern.principal} performing ${pattern.action} on ${pattern.resource}`,
        });
      }
    }

    return gaps;
  }
}
