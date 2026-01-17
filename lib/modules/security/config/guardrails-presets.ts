/**
 * Bedrock Guardrailsプリセット設定
 * 業界別のコンテンツフィルタリングとPII保護設定
 */

import {
  GuardrailContentPolicyConfig,
  GuardrailTopicPolicyConfig,
  GuardrailSensitiveInformationPolicyConfig,
  GuardrailWordPolicyConfig,
} from '../constructs/bedrock-guardrails-construct';

export type GuardrailPresetType = 'standard' | 'financial' | 'healthcare' | 'education' | 'government';

export interface GuardrailPreset {
  /**
   * プリセット名
   */
  name: string;

  /**
   * プリセット説明
   */
  description: string;

  /**
   * コンテンツポリシー設定
   */
  contentPolicyConfig: GuardrailContentPolicyConfig;

  /**
   * トピックポリシー設定
   */
  topicPolicyConfig?: GuardrailTopicPolicyConfig;

  /**
   * 機密情報ポリシー設定
   */
  sensitiveInformationPolicyConfig: GuardrailSensitiveInformationPolicyConfig;

  /**
   * ワードポリシー設定
   */
  wordPolicyConfig?: GuardrailWordPolicyConfig;

  /**
   * ブロックされた入力メッセージ
   */
  blockedInputMessaging: string;

  /**
   * ブロックされた出力メッセージ
   */
  blockedOutputsMessaging: string;
}

/**
 * 一般企業向けプリセット（標準）
 * 基本的なコンテンツフィルタリングとPII保護
 */
export const STANDARD_PRESET: GuardrailPreset = {
  name: 'standard',
  description: '一般企業向け標準設定 - 基本的なコンテンツフィルタリングとPII保護',
  contentPolicyConfig: {
    filtersConfig: [
      {
        type: 'SEXUAL',
        inputStrength: 'MEDIUM',
        outputStrength: 'MEDIUM',
      },
      {
        type: 'VIOLENCE',
        inputStrength: 'MEDIUM',
        outputStrength: 'MEDIUM',
      },
      {
        type: 'HATE',
        inputStrength: 'HIGH',
        outputStrength: 'HIGH',
      },
      {
        type: 'INSULTS',
        inputStrength: 'MEDIUM',
        outputStrength: 'MEDIUM',
      },
      {
        type: 'MISCONDUCT',
        inputStrength: 'MEDIUM',
        outputStrength: 'MEDIUM',
      },
      {
        type: 'PROMPT_ATTACK',
        inputStrength: 'HIGH',
        outputStrength: 'NONE',
      },
    ],
  },
  sensitiveInformationPolicyConfig: {
    piiEntitiesConfig: [
      { type: 'EMAIL', action: 'ANONYMIZE' },
      { type: 'PHONE', action: 'ANONYMIZE' },
      { type: 'NAME', action: 'ANONYMIZE' },
      { type: 'ADDRESS', action: 'ANONYMIZE' },
      { type: 'PASSWORD', action: 'BLOCK' },
      { type: 'AWS_ACCESS_KEY', action: 'BLOCK' },
      { type: 'AWS_SECRET_KEY', action: 'BLOCK' },
      { type: 'CREDIT_DEBIT_CARD_NUMBER', action: 'BLOCK' },
      { type: 'CREDIT_DEBIT_CARD_CVV', action: 'BLOCK' },
    ],
  },
  wordPolicyConfig: {
    managedWordListsConfig: [{ type: 'PROFANITY' }],
  },
  blockedInputMessaging:
    '申し訳ございません。この内容は企業ポリシーに違反するため処理できません。',
  blockedOutputsMessaging:
    '申し訳ございません。この回答は企業ポリシーに違反するため提供できません。',
};

/**
 * 金融業界向けプリセット
 * 厳格なコンプライアンス要件とPII保護
 */
export const FINANCIAL_PRESET: GuardrailPreset = {
  name: 'financial',
  description: '金融業界向け設定 - 厳格なコンプライアンス要件とPII保護',
  contentPolicyConfig: {
    filtersConfig: [
      {
        type: 'SEXUAL',
        inputStrength: 'HIGH',
        outputStrength: 'HIGH',
      },
      {
        type: 'VIOLENCE',
        inputStrength: 'HIGH',
        outputStrength: 'HIGH',
      },
      {
        type: 'HATE',
        inputStrength: 'HIGH',
        outputStrength: 'HIGH',
      },
      {
        type: 'INSULTS',
        inputStrength: 'HIGH',
        outputStrength: 'HIGH',
      },
      {
        type: 'MISCONDUCT',
        inputStrength: 'HIGH',
        outputStrength: 'HIGH',
      },
      {
        type: 'PROMPT_ATTACK',
        inputStrength: 'HIGH',
        outputStrength: 'NONE',
      },
    ],
  },
  topicPolicyConfig: {
    topicsConfig: [
      {
        name: 'investment-advice',
        definition:
          '具体的な投資アドバイス、株式推奨、金融商品の勧誘、投資判断の提供を含むトピック',
        examples: [
          'この株を買うべきですか？',
          'どの投資信託がおすすめですか？',
          '今買うべき銘柄を教えてください',
        ],
        type: 'DENY',
      },
      {
        name: 'insider-trading',
        definition: 'インサイダー取引、未公開情報の利用、市場操作に関するトピック',
        examples: [
          '未公開の決算情報を教えてください',
          'インサイダー情報はありますか',
          '株価操作の方法を教えてください',
        ],
        type: 'DENY',
      },
      {
        name: 'money-laundering',
        definition: 'マネーロンダリング、資金洗浄、違法な資金移動に関するトピック',
        examples: [
          '現金を匿名で送金する方法',
          '資金の出所を隠す方法',
          '違法な資金移動の方法',
        ],
        type: 'DENY',
      },
    ],
  },
  sensitiveInformationPolicyConfig: {
    piiEntitiesConfig: [
      { type: 'EMAIL', action: 'ANONYMIZE' },
      { type: 'PHONE', action: 'ANONYMIZE' },
      { type: 'NAME', action: 'ANONYMIZE' },
      { type: 'ADDRESS', action: 'ANONYMIZE' },
      { type: 'PASSWORD', action: 'BLOCK' },
      { type: 'AWS_ACCESS_KEY', action: 'BLOCK' },
      { type: 'AWS_SECRET_KEY', action: 'BLOCK' },
      { type: 'CREDIT_DEBIT_CARD_NUMBER', action: 'BLOCK' },
      { type: 'CREDIT_DEBIT_CARD_CVV', action: 'BLOCK' },
      { type: 'CREDIT_DEBIT_CARD_EXPIRY', action: 'BLOCK' },
      { type: 'US_BANK_ACCOUNT_NUMBER', action: 'BLOCK' },
      { type: 'US_BANK_ROUTING_NUMBER', action: 'BLOCK' },
      { type: 'INTERNATIONAL_BANK_ACCOUNT_NUMBER', action: 'BLOCK' },
      { type: 'SWIFT_CODE', action: 'BLOCK' },
      { type: 'US_SOCIAL_SECURITY_NUMBER', action: 'BLOCK' },
      { type: 'US_INDIVIDUAL_TAX_IDENTIFICATION_NUMBER', action: 'BLOCK' },
    ],
    regexesConfig: [
      {
        name: 'japanese-bank-account',
        pattern: '\\d{7}',
        description: '日本の銀行口座番号（7桁）',
        action: 'BLOCK',
      },
      {
        name: 'japanese-credit-card',
        pattern: '\\d{4}-\\d{4}-\\d{4}-\\d{4}',
        description: '日本のクレジットカード番号',
        action: 'BLOCK',
      },
    ],
  },
  wordPolicyConfig: {
    managedWordListsConfig: [{ type: 'PROFANITY' }],
  },
  blockedInputMessaging:
    '申し訳ございません。この内容は金融規制およびコンプライアンス要件に違反するため処理できません。',
  blockedOutputsMessaging:
    '申し訳ございません。この回答は金融規制およびコンプライアンス要件に違反するため提供できません。',
};

/**
 * 医療業界向けプリセット
 * HIPAA準拠とPHI（保護対象医療情報）保護
 */
export const HEALTHCARE_PRESET: GuardrailPreset = {
  name: 'healthcare',
  description: '医療業界向け設定 - HIPAA準拠とPHI保護',
  contentPolicyConfig: {
    filtersConfig: [
      {
        type: 'SEXUAL',
        inputStrength: 'HIGH',
        outputStrength: 'HIGH',
      },
      {
        type: 'VIOLENCE',
        inputStrength: 'HIGH',
        outputStrength: 'HIGH',
      },
      {
        type: 'HATE',
        inputStrength: 'HIGH',
        outputStrength: 'HIGH',
      },
      {
        type: 'INSULTS',
        inputStrength: 'HIGH',
        outputStrength: 'HIGH',
      },
      {
        type: 'MISCONDUCT',
        inputStrength: 'HIGH',
        outputStrength: 'HIGH',
      },
      {
        type: 'PROMPT_ATTACK',
        inputStrength: 'HIGH',
        outputStrength: 'NONE',
      },
    ],
  },
  topicPolicyConfig: {
    topicsConfig: [
      {
        name: 'medical-diagnosis',
        definition: '具体的な医学的診断、治療法の推奨、処方薬の提案を含むトピック',
        examples: [
          'この症状は何の病気ですか？',
          'どの薬を飲むべきですか？',
          '治療法を教えてください',
        ],
        type: 'DENY',
      },
      {
        name: 'emergency-medical',
        definition: '緊急医療対応、救急処置、生命に関わる状況への対処を含むトピック',
        examples: [
          '心臓発作の対処法を教えてください',
          '出血を止める方法',
          '意識不明の人への対処',
        ],
        type: 'DENY',
      },
      {
        name: 'prescription-drugs',
        definition: '処方薬の入手方法、薬物の不正使用、医薬品の違法取引に関するトピック',
        examples: [
          '処方箋なしで薬を買う方法',
          '薬物の不正使用方法',
          '違法な医薬品の入手',
        ],
        type: 'DENY',
      },
    ],
  },
  sensitiveInformationPolicyConfig: {
    piiEntitiesConfig: [
      { type: 'EMAIL', action: 'ANONYMIZE' },
      { type: 'PHONE', action: 'ANONYMIZE' },
      { type: 'NAME', action: 'ANONYMIZE' },
      { type: 'ADDRESS', action: 'ANONYMIZE' },
      { type: 'AGE', action: 'ANONYMIZE' },
      { type: 'PASSWORD', action: 'BLOCK' },
      { type: 'AWS_ACCESS_KEY', action: 'BLOCK' },
      { type: 'AWS_SECRET_KEY', action: 'BLOCK' },
      { type: 'US_SOCIAL_SECURITY_NUMBER', action: 'BLOCK' },
      { type: 'CA_HEALTH_NUMBER', action: 'BLOCK' },
      { type: 'CA_SOCIAL_INSURANCE_NUMBER', action: 'BLOCK' },
      { type: 'UK_NATIONAL_HEALTH_SERVICE_NUMBER', action: 'BLOCK' },
      { type: 'UK_NATIONAL_INSURANCE_NUMBER', action: 'BLOCK' },
    ],
    regexesConfig: [
      {
        name: 'japanese-health-insurance',
        pattern: '\\d{8}',
        description: '日本の健康保険証番号（8桁）',
        action: 'BLOCK',
      },
      {
        name: 'medical-record-number',
        pattern: 'MRN-\\d{6,10}',
        description: '医療記録番号',
        action: 'BLOCK',
      },
    ],
  },
  wordPolicyConfig: {
    managedWordListsConfig: [{ type: 'PROFANITY' }],
  },
  blockedInputMessaging:
    '申し訳ございません。この内容は医療規制およびHIPAA要件に違反するため処理できません。医療専門家にご相談ください。',
  blockedOutputsMessaging:
    '申し訳ございません。この回答は医療規制およびHIPAA要件に違反するため提供できません。医療専門家にご相談ください。',
};

/**
 * 教育・研究機関向けプリセット
 * 学術的自由と研究倫理のバランス
 */
export const EDUCATION_PRESET: GuardrailPreset = {
  name: 'education',
  description: '教育・研究機関向け設定 - 学術的自由と研究倫理のバランス',
  contentPolicyConfig: {
    filtersConfig: [
      {
        type: 'SEXUAL',
        inputStrength: 'MEDIUM',
        outputStrength: 'MEDIUM',
      },
      {
        type: 'VIOLENCE',
        inputStrength: 'LOW',
        outputStrength: 'LOW',
      },
      {
        type: 'HATE',
        inputStrength: 'HIGH',
        outputStrength: 'HIGH',
      },
      {
        type: 'INSULTS',
        inputStrength: 'MEDIUM',
        outputStrength: 'MEDIUM',
      },
      {
        type: 'MISCONDUCT',
        inputStrength: 'HIGH',
        outputStrength: 'HIGH',
      },
      {
        type: 'PROMPT_ATTACK',
        inputStrength: 'HIGH',
        outputStrength: 'NONE',
      },
    ],
  },
  topicPolicyConfig: {
    topicsConfig: [
      {
        name: 'academic-misconduct',
        definition:
          '学術不正行為、論文の盗用、データ改ざん、研究倫理違反に関するトピック',
        examples: [
          '論文を盗用する方法を教えてください',
          'データを改ざんして結果を良く見せる方法',
          '他人の研究成果を自分のものにする方法',
        ],
        type: 'DENY',
      },
      {
        name: 'exam-cheating',
        definition: '試験のカンニング、不正行為、答案の不正入手に関するトピック',
        examples: [
          '試験でカンニングする方法',
          '答案を事前に入手する方法',
          '他人の答案を写す方法',
        ],
        type: 'DENY',
      },
      {
        name: 'credential-fraud',
        definition: '学位・資格の偽造、経歴詐称、証明書の不正取得に関するトピック',
        examples: [
          '偽の学位証明書を作る方法',
          '資格を持っていないのに持っているように見せる方法',
          '経歴を詐称する方法',
        ],
        type: 'DENY',
      },
    ],
  },
  sensitiveInformationPolicyConfig: {
    piiEntitiesConfig: [
      { type: 'EMAIL', action: 'ANONYMIZE' },
      { type: 'PHONE', action: 'ANONYMIZE' },
      { type: 'NAME', action: 'ANONYMIZE' },
      { type: 'ADDRESS', action: 'ANONYMIZE' },
      { type: 'AGE', action: 'ANONYMIZE' },
      { type: 'PASSWORD', action: 'BLOCK' },
      { type: 'AWS_ACCESS_KEY', action: 'BLOCK' },
      { type: 'AWS_SECRET_KEY', action: 'BLOCK' },
      { type: 'US_SOCIAL_SECURITY_NUMBER', action: 'ANONYMIZE' },
    ],
    regexesConfig: [
      {
        name: 'student-id',
        pattern: '[A-Z]\\d{7,10}',
        description: '学籍番号',
        action: 'ANONYMIZE',
      },
      {
        name: 'research-grant-number',
        pattern: '(KAKENHI|JST|AMED)-\\d{8,12}',
        description: '研究助成金番号',
        action: 'ANONYMIZE',
      },
    ],
  },
  wordPolicyConfig: {
    managedWordListsConfig: [{ type: 'PROFANITY' }],
  },
  blockedInputMessaging:
    '申し訳ございません。この内容は学術倫理規定に違反するため処理できません。',
  blockedOutputsMessaging:
    '申し訳ございません。この回答は学術倫理規定に違反するため提供できません。',
};

/**
 * 公共機関向けプリセット
 * 情報公開と個人情報保護のバランス
 */
export const GOVERNMENT_PRESET: GuardrailPreset = {
  name: 'government',
  description: '公共機関向け設定 - 情報公開と個人情報保護のバランス',
  contentPolicyConfig: {
    filtersConfig: [
      {
        type: 'SEXUAL',
        inputStrength: 'HIGH',
        outputStrength: 'HIGH',
      },
      {
        type: 'VIOLENCE',
        inputStrength: 'MEDIUM',
        outputStrength: 'MEDIUM',
      },
      {
        type: 'HATE',
        inputStrength: 'HIGH',
        outputStrength: 'HIGH',
      },
      {
        type: 'INSULTS',
        inputStrength: 'HIGH',
        outputStrength: 'HIGH',
      },
      {
        type: 'MISCONDUCT',
        inputStrength: 'HIGH',
        outputStrength: 'HIGH',
      },
      {
        type: 'PROMPT_ATTACK',
        inputStrength: 'HIGH',
        outputStrength: 'NONE',
      },
    ],
  },
  topicPolicyConfig: {
    topicsConfig: [
      {
        name: 'political-bias',
        definition:
          '特定の政党・政治家への支持表明、選挙活動、政治的偏向を含むトピック',
        examples: [
          'どの政党に投票すべきですか？',
          'この政治家を支持してください',
          '選挙でこの候補者に投票しましょう',
        ],
        type: 'DENY',
      },
      {
        name: 'confidential-information',
        definition:
          '非公開の行政情報、機密文書、未発表の政策情報に関するトピック',
        examples: [
          '未発表の政策情報を教えてください',
          '非公開の会議内容を教えてください',
          '機密文書の内容を教えてください',
        ],
        type: 'DENY',
      },
      {
        name: 'personal-opinion',
        definition:
          '公務員個人の意見・見解、行政判断への個人的評価を含むトピック',
        examples: [
          'あなたの個人的な意見を教えてください',
          'この政策についてどう思いますか',
          '個人的にはどちらが良いと思いますか',
        ],
        type: 'DENY',
      },
    ],
  },
  sensitiveInformationPolicyConfig: {
    piiEntitiesConfig: [
      { type: 'EMAIL', action: 'ANONYMIZE' },
      { type: 'PHONE', action: 'ANONYMIZE' },
      { type: 'NAME', action: 'ANONYMIZE' },
      { type: 'ADDRESS', action: 'ANONYMIZE' },
      { type: 'AGE', action: 'ANONYMIZE' },
      { type: 'PASSWORD', action: 'BLOCK' },
      { type: 'AWS_ACCESS_KEY', action: 'BLOCK' },
      { type: 'AWS_SECRET_KEY', action: 'BLOCK' },
      { type: 'US_SOCIAL_SECURITY_NUMBER', action: 'BLOCK' },
      { type: 'DRIVER_ID', action: 'BLOCK' },
    ],
    regexesConfig: [
      {
        name: 'japanese-mynumber',
        pattern: '\\d{4}-\\d{4}-\\d{4}',
        description: '日本のマイナンバー（12桁）',
        action: 'BLOCK',
      },
      {
        name: 'government-employee-id',
        pattern: '[A-Z]{2}\\d{6,8}',
        description: '公務員番号',
        action: 'ANONYMIZE',
      },
    ],
  },
  wordPolicyConfig: {
    managedWordListsConfig: [{ type: 'PROFANITY' }],
  },
  blockedInputMessaging:
    '申し訳ございません。この内容は行政情報管理規定に違反するため処理できません。',
  blockedOutputsMessaging:
    '申し訳ございません。この回答は行政情報管理規定に違反するため提供できません。',
};

/**
 * プリセットマップ
 */
export const GUARDRAIL_PRESETS: Record<GuardrailPresetType, GuardrailPreset> = {
  standard: STANDARD_PRESET,
  financial: FINANCIAL_PRESET,
  healthcare: HEALTHCARE_PRESET,
  education: EDUCATION_PRESET,
  government: GOVERNMENT_PRESET,
};

/**
 * プリセット取得関数
 * @param presetType プリセットタイプ
 * @returns Guardrailプリセット設定
 */
export function getGuardrailPreset(presetType: GuardrailPresetType): GuardrailPreset {
  return GUARDRAIL_PRESETS[presetType];
}
