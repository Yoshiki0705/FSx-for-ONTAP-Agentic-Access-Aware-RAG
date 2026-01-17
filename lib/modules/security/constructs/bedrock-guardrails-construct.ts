/**
 * Bedrock Guardrailsコンストラクト
 * エンタープライズグレードのコンテンツフィルタリングとPII保護
 */

import * as cdk from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import { Construct } from 'constructs';

export interface BedrockGuardrailsConstructProps {
  /**
   * Bedrock Guardrailsを有効化するか
   * @default false
   */
  enabled?: boolean;

  /**
   * プロジェクト名
   */
  projectName: string;

  /**
   * 環境名
   */
  environment: string;

  /**
   * Guardrail名
   */
  guardrailName: string;

  /**
   * Guardrail説明
   */
  description?: string;

  /**
   * コンテンツフィルタ設定
   */
  contentPolicyConfig?: GuardrailContentPolicyConfig;

  /**
   * トピックポリシー設定
   */
  topicPolicyConfig?: GuardrailTopicPolicyConfig;

  /**
   * 機密情報（PII）ポリシー設定
   */
  sensitiveInformationPolicyConfig?: GuardrailSensitiveInformationPolicyConfig;

  /**
   * ワードポリシー設定
   */
  wordPolicyConfig?: GuardrailWordPolicyConfig;

  /**
   * ブロックされた入力メッセージ
   * @default "申し訳ございません。この内容は処理できません。"
   */
  blockedInputMessaging?: string;

  /**
   * ブロックされた出力メッセージ
   * @default "申し訳ございません。この回答は提供できません。"
   */
  blockedOutputsMessaging?: string;
}

export interface GuardrailContentPolicyConfig {
  /**
   * 有害コンテンツフィルタ
   */
  filtersConfig: GuardrailContentFilter[];
}

export interface GuardrailContentFilter {
  /**
   * フィルタタイプ
   * SEXUAL: 性的コンテンツ
   * VIOLENCE: 暴力的コンテンツ
   * HATE: ヘイトスピーチ
   * INSULTS: 侮辱的コンテンツ
   * MISCONDUCT: 不正行為
   * PROMPT_ATTACK: プロンプトインジェクション攻撃
   */
  type: 'SEXUAL' | 'VIOLENCE' | 'HATE' | 'INSULTS' | 'MISCONDUCT' | 'PROMPT_ATTACK';

  /**
   * 入力フィルタ強度
   * NONE: フィルタなし
   * LOW: 低
   * MEDIUM: 中
   * HIGH: 高
   */
  inputStrength: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

  /**
   * 出力フィルタ強度
   */
  outputStrength: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface GuardrailTopicPolicyConfig {
  /**
   * トピック設定
   */
  topicsConfig: GuardrailTopic[];
}

export interface GuardrailTopic {
  /**
   * トピック名
   */
  name: string;

  /**
   * トピック定義
   */
  definition: string;

  /**
   * トピック例
   */
  examples?: string[];

  /**
   * トピックタイプ
   * DENY: 拒否
   */
  type: 'DENY';
}

export interface GuardrailSensitiveInformationPolicyConfig {
  /**
   * PII（個人識別情報）エンティティ設定
   */
  piiEntitiesConfig?: GuardrailPiiEntity[];

  /**
   * 正規表現パターン設定
   */
  regexesConfig?: GuardrailRegex[];
}

export interface GuardrailPiiEntity {
  /**
   * PIIエンティティタイプ
   * ADDRESS: 住所
   * AGE: 年齢
   * AWS_ACCESS_KEY: AWSアクセスキー
   * AWS_SECRET_KEY: AWSシークレットキー
   * CA_HEALTH_NUMBER: カナダ健康番号
   * CA_SOCIAL_INSURANCE_NUMBER: カナダ社会保険番号
   * CREDIT_DEBIT_CARD_CVV: クレジットカードCVV
   * CREDIT_DEBIT_CARD_EXPIRY: クレジットカード有効期限
   * CREDIT_DEBIT_CARD_NUMBER: クレジットカード番号
   * DRIVER_ID: 運転免許証番号
   * EMAIL: メールアドレス
   * INTERNATIONAL_BANK_ACCOUNT_NUMBER: 国際銀行口座番号
   * IP_ADDRESS: IPアドレス
   * LICENSE_PLATE: ナンバープレート
   * MAC_ADDRESS: MACアドレス
   * NAME: 氏名
   * PASSWORD: パスワード
   * PHONE: 電話番号
   * PIN: PIN番号
   * SWIFT_CODE: SWIFTコード
   * UK_NATIONAL_HEALTH_SERVICE_NUMBER: 英国NHS番号
   * UK_NATIONAL_INSURANCE_NUMBER: 英国国民保険番号
   * UK_UNIQUE_TAXPAYER_REFERENCE_NUMBER: 英国納税者番号
   * URL: URL
   * USERNAME: ユーザー名
   * US_BANK_ACCOUNT_NUMBER: 米国銀行口座番号
   * US_BANK_ROUTING_NUMBER: 米国銀行ルーティング番号
   * US_INDIVIDUAL_TAX_IDENTIFICATION_NUMBER: 米国個人納税者番号
   * US_PASSPORT_NUMBER: 米国パスポート番号
   * US_SOCIAL_SECURITY_NUMBER: 米国社会保障番号
   * VEHICLE_IDENTIFICATION_NUMBER: 車両識別番号
   */
  type: string;

  /**
   * アクション
   * BLOCK: ブロック
   * ANONYMIZE: 匿名化
   */
  action: 'BLOCK' | 'ANONYMIZE';
}

export interface GuardrailRegex {
  /**
   * 正規表現名
   */
  name: string;

  /**
   * 正規表現パターン
   */
  pattern: string;

  /**
   * 説明
   */
  description?: string;

  /**
   * アクション
   */
  action: 'BLOCK' | 'ANONYMIZE';
}

export interface GuardrailWordPolicyConfig {
  /**
   * 管理対象ワードリスト設定
   */
  managedWordListsConfig?: GuardrailManagedWordList[];

  /**
   * カスタムワード設定
   */
  wordsConfig?: GuardrailWord[];
}

export interface GuardrailManagedWordList {
  /**
   * 管理対象ワードリストタイプ
   * PROFANITY: 冒涜的な言葉
   */
  type: 'PROFANITY';
}

export interface GuardrailWord {
  /**
   * ブロックするワード
   */
  text: string;
}

export class BedrockGuardrailsConstruct extends Construct {
  /**
   * Bedrock Guardrail
   */
  public readonly guardrail?: bedrock.CfnGuardrail;

  /**
   * Guardrail ARN
   */
  public readonly guardrailArn?: string;

  /**
   * Guardrail ID
   */
  public readonly guardrailId?: string;

  /**
   * Guardrail Version
   */
  public readonly guardrailVersion?: string;

  constructor(scope: Construct, id: string, props: BedrockGuardrailsConstructProps) {
    super(scope, id);

    // enabledフラグがfalseの場合、何も作成しない
    if (!props.enabled) {
      return;
    }

    // Bedrock Guardrail作成
    this.guardrail = this.createGuardrail(props);

    // ARN・ID設定
    this.guardrailArn = this.guardrail.attrGuardrailArn;
    this.guardrailId = this.guardrail.attrGuardrailId;
    this.guardrailVersion = this.guardrail.attrVersion;

    // CloudFormation出力
    new cdk.CfnOutput(this, 'GuardrailArn', {
      value: this.guardrailArn,
      description: 'Bedrock Guardrail ARN',
      exportName: `${props.projectName}-${props.environment}-guardrail-arn`,
    });

    new cdk.CfnOutput(this, 'GuardrailId', {
      value: this.guardrailId,
      description: 'Bedrock Guardrail ID',
      exportName: `${props.projectName}-${props.environment}-guardrail-id`,
    });

    new cdk.CfnOutput(this, 'GuardrailVersion', {
      value: this.guardrailVersion,
      description: 'Bedrock Guardrail Version',
      exportName: `${props.projectName}-${props.environment}-guardrail-version`,
    });
  }

  /**
   * Bedrock Guardrail作成
   */
  private createGuardrail(props: BedrockGuardrailsConstructProps): bedrock.CfnGuardrail {
    const guardrail = new bedrock.CfnGuardrail(this, 'Guardrail', {
      name: props.guardrailName,
      description: props.description,
      blockedInputMessaging:
        props.blockedInputMessaging || '申し訳ございません。この内容は処理できません。',
      blockedOutputsMessaging:
        props.blockedOutputsMessaging || '申し訳ございません。この回答は提供できません。',
    });

    // コンテンツポリシー設定
    if (props.contentPolicyConfig) {
      guardrail.contentPolicyConfig = {
        filtersConfig: props.contentPolicyConfig.filtersConfig.map((filter) => ({
          type: filter.type,
          inputStrength: filter.inputStrength,
          outputStrength: filter.outputStrength,
        })),
      };
    }

    // トピックポリシー設定
    if (props.topicPolicyConfig) {
      guardrail.topicPolicyConfig = {
        topicsConfig: props.topicPolicyConfig.topicsConfig.map((topic) => ({
          name: topic.name,
          definition: topic.definition,
          examples: topic.examples,
          type: topic.type,
        })),
      };
    }

    // 機密情報ポリシー設定
    if (props.sensitiveInformationPolicyConfig) {
      const sensitiveInfoConfig: any = {};

      if (props.sensitiveInformationPolicyConfig.piiEntitiesConfig) {
        sensitiveInfoConfig.piiEntitiesConfig =
          props.sensitiveInformationPolicyConfig.piiEntitiesConfig.map((entity) => ({
            type: entity.type,
            action: entity.action,
          }));
      }

      if (props.sensitiveInformationPolicyConfig.regexesConfig) {
        sensitiveInfoConfig.regexesConfig =
          props.sensitiveInformationPolicyConfig.regexesConfig.map((regex) => ({
            name: regex.name,
            pattern: regex.pattern,
            description: regex.description,
            action: regex.action,
          }));
      }

      guardrail.sensitiveInformationPolicyConfig = sensitiveInfoConfig;
    }

    // ワードポリシー設定
    if (props.wordPolicyConfig) {
      const wordConfig: any = {};

      if (props.wordPolicyConfig.managedWordListsConfig) {
        wordConfig.managedWordListsConfig =
          props.wordPolicyConfig.managedWordListsConfig.map((list) => ({
            type: list.type,
          }));
      }

      if (props.wordPolicyConfig.wordsConfig) {
        wordConfig.wordsConfig = props.wordPolicyConfig.wordsConfig.map(
          (word) => ({
            text: word.text,
          })
        );
      }

      guardrail.wordPolicyConfig = wordConfig;
    }

    return guardrail;
  }
}
