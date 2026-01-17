/**
 * Bedrock Agent Core Policy Lambda Function
 * 
 * 自然言語ポリシー、Cedar統合、ポリシー管理機能を提供します。
 */

import { NaturalLanguageParser, ParsedPolicy } from './natural-language-parser';
import { CedarConverter, CedarPolicy } from './cedar-converter';
import { PolicyTemplates, TemplateVariables } from './policy-templates';
import { PolicyValidator, ValidationResult } from './policy-validator';
import { CedarIntegration, CedarValidationResult, FormalVerificationResult } from './cedar-integration';
import { PolicyManager, StoredPolicy, PolicySearchQuery, AuditLogEntry } from './policy-manager';

// Lambda Event型定義
interface PolicyEvent {
  action:
    | 'parse-policy'
    | 'convert-to-cedar'
    | 'validate-policy'
    | 'get-templates'
    | 'generate-from-template'
    | 'detect-conflicts'
    | 'parse-and-convert'
    | 'full-pipeline'
    | 'validate-cedar'
    | 'formal-verification'
    | 'create-policy'
    | 'get-policy'
    | 'update-policy'
    | 'delete-policy'
    | 'search-policies'
    | 'activate-policy'
    | 'deactivate-policy'
    | 'approve-policy'
    | 'reject-policy'
    | 'get-audit-logs'
    | 'get-policy-versions';
  payload: any;
}

// Lambda Response型定義
interface PolicyResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    timestamp: string;
    action: string;
    processingTime: number;
  };
}

// グローバルインスタンス（Lambda再利用のため）
let parser: NaturalLanguageParser;
let converter: CedarConverter;
let templates: PolicyTemplates;
let validator: PolicyValidator;
let cedarIntegration: CedarIntegration;
let policyManager: PolicyManager;

/**
 * Lambda Handler
 */
export async function handler(event: PolicyEvent): Promise<PolicyResponse> {
  const startTime = Date.now();

  try {
    // インスタンス初期化（初回のみ）
    if (!parser) parser = new NaturalLanguageParser();
    if (!converter) converter = new CedarConverter();
    if (!templates) templates = new PolicyTemplates();
    if (!validator) validator = new PolicyValidator();
    if (!cedarIntegration) cedarIntegration = new CedarIntegration();
    if (!policyManager) {
      policyManager = new PolicyManager({
        policyBucket: process.env.POLICY_BUCKET || '',
        policyTable: process.env.POLICY_TABLE || '',
        auditLogTable: process.env.AUDIT_LOG_TABLE || '',
        enableVersioning: true,
        enableAuditLogging: true,
        requireApproval: process.env.REQUIRE_APPROVAL === 'true',
      });
    }

    console.log(`Processing action: ${event.action}`);

    let result: any;

    switch (event.action) {
      case 'parse-policy':
        result = await handleParsePolicy(event.payload);
        break;

      case 'convert-to-cedar':
        result = handleConvertToCedar(event.payload);
        break;

      case 'validate-policy':
        result = handleValidatePolicy(event.payload);
        break;

      case 'get-templates':
        result = handleGetTemplates(event.payload);
        break;

      case 'generate-from-template':
        result = handleGenerateFromTemplate(event.payload);
        break;

      case 'detect-conflicts':
        result = handleDetectConflicts(event.payload);
        break;

      case 'parse-and-convert':
        result = await handleParseAndConvert(event.payload);
        break;

      case 'full-pipeline':
        result = await handleFullPipeline(event.payload);
        break;

      case 'validate-cedar':
        result = handleValidateCedar(event.payload);
        break;

      case 'formal-verification':
        result = handleFormalVerification(event.payload);
        break;

      case 'create-policy':
        result = await handleCreatePolicy(event.payload);
        break;

      case 'get-policy':
        result = await handleGetPolicy(event.payload);
        break;

      case 'update-policy':
        result = await handleUpdatePolicy(event.payload);
        break;

      case 'delete-policy':
        result = await handleDeletePolicy(event.payload);
        break;

      case 'search-policies':
        result = await handleSearchPolicies(event.payload);
        break;

      case 'activate-policy':
        result = await handleActivatePolicy(event.payload);
        break;

      case 'deactivate-policy':
        result = await handleDeactivatePolicy(event.payload);
        break;

      case 'approve-policy':
        result = await handleApprovePolicy(event.payload);
        break;

      case 'reject-policy':
        result = await handleRejectPolicy(event.payload);
        break;

      case 'get-audit-logs':
        result = await handleGetAuditLogs(event.payload);
        break;

      case 'get-policy-versions':
        result = await handleGetPolicyVersions(event.payload);
        break;

      default:
        throw new Error(`Unknown action: ${event.action}`);
    }

    const processingTime = Date.now() - startTime;

    return {
      success: true,
      data: result,
      metadata: {
        timestamp: new Date().toISOString(),
        action: event.action,
        processingTime,
      },
    };
  } catch (error) {
    console.error('Error processing policy:', error);

    const processingTime = Date.now() - startTime;

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        timestamp: new Date().toISOString(),
        action: event.action,
        processingTime,
      },
    };
  }
}

/**
 * 自然言語ポリシーをパース
 */
async function handleParsePolicy(payload: {
  policy: string;
  language?: string;
}): Promise<ParsedPolicy> {
  const { policy, language = 'ja' } = payload;

  if (!policy) {
    throw new Error('Policy text is required');
  }

  return await parser.parsePolicy(policy, language);
}

/**
 * パースされたポリシーをCedarに変換
 */
function handleConvertToCedar(payload: {
  parsedPolicy: ParsedPolicy;
  policyId: string;
  generateText?: boolean;
}): { cedarPolicy: CedarPolicy; cedarText?: string } {
  const { parsedPolicy, policyId, generateText = false } = payload;

  if (!parsedPolicy || !policyId) {
    throw new Error('Parsed policy and policy ID are required');
  }

  const cedarPolicy = converter.convertToCedar(parsedPolicy, policyId);

  const result: { cedarPolicy: CedarPolicy; cedarText?: string } = {
    cedarPolicy,
  };

  if (generateText) {
    result.cedarText = converter.generateCedarText(cedarPolicy);
  }

  return result;
}

/**
 * ポリシーを検証
 */
function handleValidatePolicy(payload: {
  policy: ParsedPolicy | CedarPolicy;
  type: 'parsed' | 'cedar';
}): ValidationResult {
  const { policy, type } = payload;

  if (!policy || !type) {
    throw new Error('Policy and type are required');
  }

  if (type === 'parsed') {
    return validator.validateParsedPolicy(policy as ParsedPolicy);
  } else {
    return validator.validateCedarPolicy(policy as CedarPolicy);
  }
}

/**
 * テンプレート一覧を取得
 */
function handleGetTemplates(payload: {
  category?: string;
  search?: string;
}): any {
  const { category, search } = payload;

  if (search) {
    return templates.searchTemplates(search);
  }

  if (category) {
    return templates.getTemplatesByCategory(category as any);
  }

  return templates.getAllTemplates();
}

/**
 * テンプレートからポリシーを生成
 */
function handleGenerateFromTemplate(payload: {
  templateId: string;
  variables: TemplateVariables;
}): { policy: string } {
  const { templateId, variables } = payload;

  if (!templateId || !variables) {
    throw new Error('Template ID and variables are required');
  }

  const policy = templates.generatePolicyFromTemplate(templateId, variables);

  return { policy };
}

/**
 * ポリシー競合を検出
 */
function handleDetectConflicts(payload: {
  policies: ParsedPolicy[];
}): any {
  const { policies } = payload;

  if (!policies || !Array.isArray(policies)) {
    throw new Error('Policies array is required');
  }

  return validator.detectConflicts(policies);
}

/**
 * パースとCedar変換を一度に実行
 */
async function handleParseAndConvert(payload: {
  policy: string;
  policyId: string;
  language?: string;
  generateText?: boolean;
}): Promise<{
  parsedPolicy: ParsedPolicy;
  cedarPolicy: CedarPolicy;
  cedarText?: string;
  validation: ValidationResult;
}> {
  const { policy, policyId, language = 'ja', generateText = false } = payload;

  // 1. パース
  const parsedPolicy = await parser.parsePolicy(policy, language);

  // 2. 検証
  const validation = validator.validateParsedPolicy(parsedPolicy);

  // 3. Cedar変換
  const cedarPolicy = converter.convertToCedar(parsedPolicy, policyId);

  const result: {
    parsedPolicy: ParsedPolicy;
    cedarPolicy: CedarPolicy;
    cedarText?: string;
    validation: ValidationResult;
  } = {
    parsedPolicy,
    cedarPolicy,
    validation,
  };

  if (generateText) {
    result.cedarText = converter.generateCedarText(cedarPolicy);
  }

  return result;
}

/**
 * フルパイプライン実行（テンプレート → パース → 検証 → Cedar変換）
 */
async function handleFullPipeline(payload: {
  templateId?: string;
  variables?: TemplateVariables;
  policy?: string;
  policyId: string;
  language?: string;
}): Promise<{
  naturalLanguagePolicy: string;
  parsedPolicy: ParsedPolicy;
  cedarPolicy: CedarPolicy;
  cedarText: string;
  validation: ValidationResult;
}> {
  const { templateId, variables, policy, policyId, language = 'ja' } = payload;

  // 1. 自然言語ポリシー取得（テンプレートまたは直接指定）
  let naturalLanguagePolicy: string;
  if (templateId && variables) {
    naturalLanguagePolicy = templates.generatePolicyFromTemplate(templateId, variables);
  } else if (policy) {
    naturalLanguagePolicy = policy;
  } else {
    throw new Error('Either templateId+variables or policy is required');
  }

  // 2. パース
  const parsedPolicy = await parser.parsePolicy(naturalLanguagePolicy, language);

  // 3. 検証
  const validation = validator.validateParsedPolicy(parsedPolicy);

  // 4. Cedar変換
  const cedarPolicy = converter.convertToCedar(parsedPolicy, policyId);
  const cedarText = converter.generateCedarText(cedarPolicy);

  return {
    naturalLanguagePolicy,
    parsedPolicy,
    cedarPolicy,
    cedarText,
    validation,
  };
}


/**
 * Cedarポリシーを検証
 */
function handleValidateCedar(payload: {
  cedarPolicy: CedarPolicy;
}): CedarValidationResult {
  const { cedarPolicy } = payload;

  if (!cedarPolicy) {
    throw new Error('Cedar policy is required');
  }

  return cedarIntegration.validateCedarPolicy(cedarPolicy);
}

/**
 * 形式的検証を実行
 */
function handleFormalVerification(payload: {
  policies: CedarPolicy[];
}): FormalVerificationResult {
  const { policies } = payload;

  if (!policies || !Array.isArray(policies)) {
    throw new Error('Policies array is required');
  }

  return cedarIntegration.performFormalVerification(policies);
}

/**
 * ポリシーを作成
 */
async function handleCreatePolicy(payload: {
  policy: StoredPolicy;
  userId: string;
  reason?: string;
}): Promise<{ policyId: string; version: number }> {
  const { policy, userId, reason } = payload;

  if (!policy || !userId) {
    throw new Error('Policy and userId are required');
  }

  return await policyManager.createPolicy(policy, userId, reason);
}

/**
 * ポリシーを取得
 */
async function handleGetPolicy(payload: {
  policyId: string;
  version?: number;
}): Promise<StoredPolicy | null> {
  const { policyId, version } = payload;

  if (!policyId) {
    throw new Error('Policy ID is required');
  }

  return await policyManager.getPolicy(policyId, version);
}

/**
 * ポリシーを更新
 */
async function handleUpdatePolicy(payload: {
  policyId: string;
  updates: Partial<StoredPolicy>;
  userId: string;
  reason?: string;
}): Promise<{ policyId: string; version: number }> {
  const { policyId, updates, userId, reason } = payload;

  if (!policyId || !updates || !userId) {
    throw new Error('Policy ID, updates, and userId are required');
  }

  return await policyManager.updatePolicy(policyId, updates, userId, reason);
}

/**
 * ポリシーを削除
 */
async function handleDeletePolicy(payload: {
  policyId: string;
  userId: string;
  reason?: string;
}): Promise<{ success: boolean }> {
  const { policyId, userId, reason } = payload;

  if (!policyId || !userId) {
    throw new Error('Policy ID and userId are required');
  }

  await policyManager.deletePolicy(policyId, userId, reason);

  return { success: true };
}

/**
 * ポリシーを検索
 */
async function handleSearchPolicies(payload: PolicySearchQuery): Promise<any> {
  return await policyManager.searchPolicies(payload);
}

/**
 * ポリシーをアクティブ化
 */
async function handleActivatePolicy(payload: {
  policyId: string;
  userId: string;
}): Promise<{ success: boolean }> {
  const { policyId, userId } = payload;

  if (!policyId || !userId) {
    throw new Error('Policy ID and userId are required');
  }

  await policyManager.activatePolicy(policyId, userId);

  return { success: true };
}

/**
 * ポリシーを非アクティブ化
 */
async function handleDeactivatePolicy(payload: {
  policyId: string;
  userId: string;
}): Promise<{ success: boolean }> {
  const { policyId, userId } = payload;

  if (!policyId || !userId) {
    throw new Error('Policy ID and userId are required');
  }

  await policyManager.deactivatePolicy(policyId, userId);

  return { success: true };
}

/**
 * ポリシーを承認
 */
async function handleApprovePolicy(payload: {
  policyId: string;
  userId: string;
}): Promise<{ success: boolean }> {
  const { policyId, userId } = payload;

  if (!policyId || !userId) {
    throw new Error('Policy ID and userId are required');
  }

  await policyManager.approvePolicy(policyId, userId);

  return { success: true };
}

/**
 * ポリシーを却下
 */
async function handleRejectPolicy(payload: {
  policyId: string;
  userId: string;
  reason: string;
}): Promise<{ success: boolean }> {
  const { policyId, userId, reason } = payload;

  if (!policyId || !userId || !reason) {
    throw new Error('Policy ID, userId, and reason are required');
  }

  await policyManager.rejectPolicy(policyId, userId, reason);

  return { success: true };
}

/**
 * 監査ログを取得
 */
async function handleGetAuditLogs(payload: {
  policyId: string;
  limit?: number;
}): Promise<AuditLogEntry[]> {
  const { policyId, limit } = payload;

  if (!policyId) {
    throw new Error('Policy ID is required');
  }

  return await policyManager.getAuditLogs(policyId, limit);
}

/**
 * ポリシーバージョン履歴を取得
 */
async function handleGetPolicyVersions(payload: {
  policyId: string;
}): Promise<any> {
  const { policyId } = payload;

  if (!policyId) {
    throw new Error('Policy ID is required');
  }

  return await policyManager.getPolicyVersions(policyId);
}
