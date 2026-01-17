/**
 * ポリシーテンプレート
 * 
 * よく使用されるポリシーパターンのテンプレートを提供します。
 * テンプレートを使用することで、一貫性のあるポリシー作成が可能になります。
 */

import { ParsedPolicy } from './natural-language-parser';

// テンプレート変数
export interface TemplateVariables {
  [key: string]: string | string[] | Record<string, any>;
}

// テンプレート定義
export interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  category: 'access-control' | 'data-protection' | 'compliance' | 'custom';
  variables: string[];
  template: string;
}

export class PolicyTemplates {
  private templates: Map<string, PolicyTemplate>;

  constructor() {
    this.templates = new Map();
    this.initializeBuiltInTemplates();
  }

  /**
   * 組み込みテンプレートを初期化
   */
  private initializeBuiltInTemplates(): void {
    // 1. 基本的なアクセス許可
    this.registerTemplate({
      id: 'basic-allow',
      name: '基本的なアクセス許可',
      description: '特定のユーザーに特定のリソースへのアクセスを許可',
      category: 'access-control',
      variables: ['userId', 'operation', 'resourceType', 'resourceId'],
      template: 'ユーザー {{userId}} に {{resourceType}} {{resourceId}} への {{operation}} を許可する',
    });

    // 2. 基本的なアクセス拒否
    this.registerTemplate({
      id: 'basic-deny',
      name: '基本的なアクセス拒否',
      description: '特定のユーザーに特定のリソースへのアクセスを拒否',
      category: 'access-control',
      variables: ['userId', 'operation', 'resourceType', 'resourceId'],
      template: 'ユーザー {{userId}} に {{resourceType}} {{resourceId}} への {{operation}} を拒否する',
    });

    // 3. ロールベースアクセス
    this.registerTemplate({
      id: 'role-based-access',
      name: 'ロールベースアクセス',
      description: '特定のロールに特定のリソースへのアクセスを許可',
      category: 'access-control',
      variables: ['roleName', 'operations', 'resourceType', 'resourceId'],
      template: 'ロール {{roleName}} に {{resourceType}} {{resourceId}} への {{operations}} を許可する',
    });

    // 4. 時間ベースアクセス
    this.registerTemplate({
      id: 'time-based-access',
      name: '時間ベースアクセス',
      description: '特定の時間帯のみアクセスを許可',
      category: 'access-control',
      variables: ['userId', 'operation', 'resourceType', 'resourceId', 'startTime', 'endTime'],
      template: 'ユーザー {{userId}} に {{resourceType}} {{resourceId}} への {{operation}} を {{startTime}} から {{endTime}} の間のみ許可する',
    });

    // 5. 条件付きアクセス
    this.registerTemplate({
      id: 'conditional-access',
      name: '条件付きアクセス',
      description: '特定の条件を満たす場合のみアクセスを許可',
      category: 'access-control',
      variables: ['userId', 'operation', 'resourceType', 'resourceId', 'condition'],
      template: 'ユーザー {{userId}} に {{resourceType}} {{resourceId}} への {{operation}} を {{condition}} の場合のみ許可する',
    });

    // 6. データ分類ベースアクセス
    this.registerTemplate({
      id: 'data-classification-access',
      name: 'データ分類ベースアクセス',
      description: 'データ分類レベルに基づいてアクセスを制御',
      category: 'data-protection',
      variables: ['userId', 'operation', 'resourceType', 'classificationLevel'],
      template: 'ユーザー {{userId}} に分類レベル {{classificationLevel}} の {{resourceType}} への {{operation}} を許可する',
    });

    // 7. 部門ベースアクセス
    this.registerTemplate({
      id: 'department-based-access',
      name: '部門ベースアクセス',
      description: '同じ部門のリソースのみアクセス可能',
      category: 'access-control',
      variables: ['userId', 'operation', 'resourceType', 'department'],
      template: 'ユーザー {{userId}} に部門 {{department}} の {{resourceType}} への {{operation}} を許可する',
    });

    // 8. 読み取り専用アクセス
    this.registerTemplate({
      id: 'read-only-access',
      name: '読み取り専用アクセス',
      description: '読み取り操作のみを許可',
      category: 'access-control',
      variables: ['userId', 'resourceType', 'resourceId'],
      template: 'ユーザー {{userId}} に {{resourceType}} {{resourceId}} への読み取りのみを許可する',
    });

    // 9. 管理者フルアクセス
    this.registerTemplate({
      id: 'admin-full-access',
      name: '管理者フルアクセス',
      description: '管理者に全リソースへのフルアクセスを許可',
      category: 'access-control',
      variables: ['adminRole', 'resourceType'],
      template: 'ロール {{adminRole}} に全ての {{resourceType}} への全操作を許可する',
    });

    // 10. コンプライアンス監査ログ
    this.registerTemplate({
      id: 'compliance-audit-log',
      name: 'コンプライアンス監査ログ',
      description: '監査ログへのアクセスを監査役のみに制限',
      category: 'compliance',
      variables: ['auditorRole', 'logType'],
      template: 'ロール {{auditorRole}} に {{logType}} 監査ログへの読み取りを許可する',
    });
  }

  /**
   * テンプレートを登録
   */
  registerTemplate(template: PolicyTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * テンプレートを取得
   */
  getTemplate(templateId: string): PolicyTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * 全テンプレートを取得
   */
  getAllTemplates(): PolicyTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * カテゴリ別にテンプレートを取得
   */
  getTemplatesByCategory(category: PolicyTemplate['category']): PolicyTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.category === category);
  }

  /**
   * テンプレートから自然言語ポリシーを生成
   */
  generatePolicyFromTemplate(
    templateId: string,
    variables: TemplateVariables
  ): string {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // 必須変数チェック
    const missingVars = template.variables.filter(v => !(v in variables));
    if (missingVars.length > 0) {
      throw new Error(`Missing required variables: ${missingVars.join(', ')}`);
    }

    // テンプレート変数を置換
    let policy = template.template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      const replacement = Array.isArray(value) ? value.join(', ') : String(value);
      policy = policy.replace(new RegExp(placeholder, 'g'), replacement);
    }

    return policy;
  }

  /**
   * バッチ生成（複数テンプレートから複数ポリシー生成）
   */
  generateMultiplePolicies(
    requests: Array<{ templateId: string; variables: TemplateVariables }>
  ): string[] {
    return requests.map(req =>
      this.generatePolicyFromTemplate(req.templateId, req.variables)
    );
  }

  /**
   * テンプレートを検索
   */
  searchTemplates(query: string): PolicyTemplate[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.templates.values()).filter(
      t =>
        t.name.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * カスタムテンプレートを作成
   */
  createCustomTemplate(
    name: string,
    description: string,
    template: string,
    variables: string[]
  ): PolicyTemplate {
    const id = `custom-${Date.now()}`;
    const customTemplate: PolicyTemplate = {
      id,
      name,
      description,
      category: 'custom',
      variables,
      template,
    };

    this.registerTemplate(customTemplate);
    return customTemplate;
  }

  /**
   * テンプレートをエクスポート（JSON形式）
   */
  exportTemplates(): string {
    const templates = Array.from(this.templates.values());
    return JSON.stringify(templates, null, 2);
  }

  /**
   * テンプレートをインポート（JSON形式）
   */
  importTemplates(jsonData: string): void {
    try {
      const templates = JSON.parse(jsonData) as PolicyTemplate[];
      for (const template of templates) {
        this.registerTemplate(template);
      }
    } catch (error) {
      throw new Error(`Failed to import templates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * テンプレート使用例を生成
   */
  generateTemplateExample(templateId: string): { policy: string; variables: TemplateVariables } {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // サンプル変数を生成
    const sampleVariables: TemplateVariables = {};
    for (const variable of template.variables) {
      sampleVariables[variable] = this.generateSampleValue(variable);
    }

    // サンプルポリシーを生成
    const policy = this.generatePolicyFromTemplate(templateId, sampleVariables);

    return { policy, variables: sampleVariables };
  }

  /**
   * サンプル値を生成
   */
  private generateSampleValue(variableName: string): string {
    const sampleValues: Record<string, string> = {
      userId: 'user-12345',
      roleName: 'developer',
      adminRole: 'admin',
      auditorRole: 'auditor',
      operation: '読み取り',
      operations: '読み取り, 書き込み',
      resourceType: 'Document',
      resourceId: 'doc-67890',
      classificationLevel: '機密',
      department: '営業部',
      startTime: '09:00',
      endTime: '18:00',
      condition: 'IPアドレスが社内ネットワークの場合',
      logType: 'アクセス',
    };

    return sampleValues[variableName] || `sample-${variableName}`;
  }
}
