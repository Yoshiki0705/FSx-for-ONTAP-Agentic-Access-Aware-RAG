/**
 * Bedrock Guardrailsプリセット設定
 * 業界別のコンテンツフィルタリングとPII保護設定
 */
import { GuardrailContentPolicyConfig, GuardrailTopicPolicyConfig, GuardrailSensitiveInformationPolicyConfig, GuardrailWordPolicyConfig } from '../constructs/bedrock-guardrails-construct';
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
export declare const STANDARD_PRESET: GuardrailPreset;
/**
 * 金融業界向けプリセット
 * 厳格なコンプライアンス要件とPII保護
 */
export declare const FINANCIAL_PRESET: GuardrailPreset;
/**
 * 医療業界向けプリセット
 * HIPAA準拠とPHI（保護対象医療情報）保護
 */
export declare const HEALTHCARE_PRESET: GuardrailPreset;
/**
 * 教育・研究機関向けプリセット
 * 学術的自由と研究倫理のバランス
 */
export declare const EDUCATION_PRESET: GuardrailPreset;
/**
 * 公共機関向けプリセット
 * 情報公開と個人情報保護のバランス
 */
export declare const GOVERNMENT_PRESET: GuardrailPreset;
/**
 * プリセットマップ
 */
export declare const GUARDRAIL_PRESETS: Record<GuardrailPresetType, GuardrailPreset>;
/**
 * プリセット取得関数
 * @param presetType プリセットタイプ
 * @returns Guardrailプリセット設定
 */
export declare function getGuardrailPreset(presetType: GuardrailPresetType): GuardrailPreset;
