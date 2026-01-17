"use strict";
/**
 * Bedrock Guardrailsプリセット設定
 * 業界別のコンテンツフィルタリングとPII保護設定
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GUARDRAIL_PRESETS = exports.GOVERNMENT_PRESET = exports.EDUCATION_PRESET = exports.HEALTHCARE_PRESET = exports.FINANCIAL_PRESET = exports.STANDARD_PRESET = void 0;
exports.getGuardrailPreset = getGuardrailPreset;
/**
 * 一般企業向けプリセット（標準）
 * 基本的なコンテンツフィルタリングとPII保護
 */
exports.STANDARD_PRESET = {
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
    blockedInputMessaging: '申し訳ございません。この内容は企業ポリシーに違反するため処理できません。',
    blockedOutputsMessaging: '申し訳ございません。この回答は企業ポリシーに違反するため提供できません。',
};
/**
 * 金融業界向けプリセット
 * 厳格なコンプライアンス要件とPII保護
 */
exports.FINANCIAL_PRESET = {
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
                definition: '具体的な投資アドバイス、株式推奨、金融商品の勧誘、投資判断の提供を含むトピック',
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
    blockedInputMessaging: '申し訳ございません。この内容は金融規制およびコンプライアンス要件に違反するため処理できません。',
    blockedOutputsMessaging: '申し訳ございません。この回答は金融規制およびコンプライアンス要件に違反するため提供できません。',
};
/**
 * 医療業界向けプリセット
 * HIPAA準拠とPHI（保護対象医療情報）保護
 */
exports.HEALTHCARE_PRESET = {
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
    blockedInputMessaging: '申し訳ございません。この内容は医療規制およびHIPAA要件に違反するため処理できません。医療専門家にご相談ください。',
    blockedOutputsMessaging: '申し訳ございません。この回答は医療規制およびHIPAA要件に違反するため提供できません。医療専門家にご相談ください。',
};
/**
 * 教育・研究機関向けプリセット
 * 学術的自由と研究倫理のバランス
 */
exports.EDUCATION_PRESET = {
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
                definition: '学術不正行為、論文の盗用、データ改ざん、研究倫理違反に関するトピック',
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
    blockedInputMessaging: '申し訳ございません。この内容は学術倫理規定に違反するため処理できません。',
    blockedOutputsMessaging: '申し訳ございません。この回答は学術倫理規定に違反するため提供できません。',
};
/**
 * 公共機関向けプリセット
 * 情報公開と個人情報保護のバランス
 */
exports.GOVERNMENT_PRESET = {
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
                definition: '特定の政党・政治家への支持表明、選挙活動、政治的偏向を含むトピック',
                examples: [
                    'どの政党に投票すべきですか？',
                    'この政治家を支持してください',
                    '選挙でこの候補者に投票しましょう',
                ],
                type: 'DENY',
            },
            {
                name: 'confidential-information',
                definition: '非公開の行政情報、機密文書、未発表の政策情報に関するトピック',
                examples: [
                    '未発表の政策情報を教えてください',
                    '非公開の会議内容を教えてください',
                    '機密文書の内容を教えてください',
                ],
                type: 'DENY',
            },
            {
                name: 'personal-opinion',
                definition: '公務員個人の意見・見解、行政判断への個人的評価を含むトピック',
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
    blockedInputMessaging: '申し訳ございません。この内容は行政情報管理規定に違反するため処理できません。',
    blockedOutputsMessaging: '申し訳ございません。この回答は行政情報管理規定に違反するため提供できません。',
};
/**
 * プリセットマップ
 */
exports.GUARDRAIL_PRESETS = {
    standard: exports.STANDARD_PRESET,
    financial: exports.FINANCIAL_PRESET,
    healthcare: exports.HEALTHCARE_PRESET,
    education: exports.EDUCATION_PRESET,
    government: exports.GOVERNMENT_PRESET,
};
/**
 * プリセット取得関数
 * @param presetType プリセットタイプ
 * @returns Guardrailプリセット設定
 */
function getGuardrailPreset(presetType) {
    return exports.GUARDRAIL_PRESETS[presetType];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3VhcmRyYWlscy1wcmVzZXRzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZ3VhcmRyYWlscy1wcmVzZXRzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O0dBR0c7OztBQWlsQkgsZ0RBRUM7QUE5aEJEOzs7R0FHRztBQUNVLFFBQUEsZUFBZSxHQUFvQjtJQUM5QyxJQUFJLEVBQUUsVUFBVTtJQUNoQixXQUFXLEVBQUUscUNBQXFDO0lBQ2xELG1CQUFtQixFQUFFO1FBQ25CLGFBQWEsRUFBRTtZQUNiO2dCQUNFLElBQUksRUFBRSxRQUFRO2dCQUNkLGFBQWEsRUFBRSxRQUFRO2dCQUN2QixjQUFjLEVBQUUsUUFBUTthQUN6QjtZQUNEO2dCQUNFLElBQUksRUFBRSxVQUFVO2dCQUNoQixhQUFhLEVBQUUsUUFBUTtnQkFDdkIsY0FBYyxFQUFFLFFBQVE7YUFDekI7WUFDRDtnQkFDRSxJQUFJLEVBQUUsTUFBTTtnQkFDWixhQUFhLEVBQUUsTUFBTTtnQkFDckIsY0FBYyxFQUFFLE1BQU07YUFDdkI7WUFDRDtnQkFDRSxJQUFJLEVBQUUsU0FBUztnQkFDZixhQUFhLEVBQUUsUUFBUTtnQkFDdkIsY0FBYyxFQUFFLFFBQVE7YUFDekI7WUFDRDtnQkFDRSxJQUFJLEVBQUUsWUFBWTtnQkFDbEIsYUFBYSxFQUFFLFFBQVE7Z0JBQ3ZCLGNBQWMsRUFBRSxRQUFRO2FBQ3pCO1lBQ0Q7Z0JBQ0UsSUFBSSxFQUFFLGVBQWU7Z0JBQ3JCLGFBQWEsRUFBRSxNQUFNO2dCQUNyQixjQUFjLEVBQUUsTUFBTTthQUN2QjtTQUNGO0tBQ0Y7SUFDRCxnQ0FBZ0MsRUFBRTtRQUNoQyxpQkFBaUIsRUFBRTtZQUNqQixFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRTtZQUN0QyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRTtZQUN0QyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFF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dCI6WyIvKipcbiAqIEJlZHJvY2sgR3VhcmRyYWlsc+ODl+ODquOCu+ODg+ODiOioreWumlxuICog5qWt55WM5Yil44Gu44Kz44Oz44OG44Oz44OE44OV44Kj44Or44K/44Oq44Oz44Kw44GoUElJ5L+d6K236Kit5a6aXG4gKi9cblxuaW1wb3J0IHtcbiAgR3VhcmRyYWlsQ29udGVudFBvbGljeUNvbmZpZyxcbiAgR3VhcmRyYWlsVG9waWNQb2xpY3lDb25maWcsXG4gIEd1YXJkcmFpbFNlbnNpdGl2ZUluZm9ybWF0aW9uUG9saWN5Q29uZmlnLFxuICBHdWFyZHJhaWxXb3JkUG9saWN5Q29uZmlnLFxufSBmcm9tICcuLi9jb25zdHJ1Y3RzL2JlZHJvY2stZ3VhcmRyYWlscy1jb25zdHJ1Y3QnO1xuXG5leHBvcnQgdHlwZSBHdWFyZHJhaWxQcmVzZXRUeXBlID0gJ3N0YW5kYXJkJyB8ICdmaW5hbmNpYWwnIHwgJ2hlYWx0aGNhcmUnIHwgJ2VkdWNhdGlvbicgfCAnZ292ZXJubWVudCc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgR3VhcmRyYWlsUHJlc2V0IHtcbiAgLyoqXG4gICAqIOODl+ODquOCu+ODg+ODiOWQjVxuICAgKi9cbiAgbmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiDjg5fjg6rjgrvjg4Pjg4joqqzmmI5cbiAgICovXG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIOOCs+ODs+ODhuODs+ODhOODneODquOCt+ODvOioreWumlxuICAgKi9cbiAgY29udGVudFBvbGljeUNvbmZpZzogR3VhcmRyYWlsQ29udGVudFBvbGljeUNvbmZpZztcblxuICAvKipcbiAgICog44OI44OU44OD44Kv44Od44Oq44K344O86Kit5a6aXG4gICAqL1xuICB0b3BpY1BvbGljeUNvbmZpZz86IEd1YXJkcmFpbFRvcGljUG9saWN5Q29uZmlnO1xuXG4gIC8qKlxuICAgKiDmqZ/lr4bmg4XloLHjg53jg6rjgrfjg7zoqK3lrppcbiAgICovXG4gIHNlbnNpdGl2ZUluZm9ybWF0aW9uUG9saWN5Q29uZmlnOiBHdWFyZHJhaWxTZW5zaXRpdmVJbmZvcm1hdGlvblBvbGljeUNvbmZpZztcblxuICAvKipcbiAgICog44Ov44O844OJ44Od44Oq44K344O86Kit5a6aXG4gICAqL1xuICB3b3JkUG9saWN5Q29uZmlnPzogR3VhcmRyYWlsV29yZFBvbGljeUNvbmZpZztcblxuICAvKipcbiAgICog44OW44Ot44OD44Kv44GV44KM44Gf5YWl5Yqb44Oh44OD44K744O844K4XG4gICAqL1xuICBibG9ja2VkSW5wdXRNZXNzYWdpbmc6IHN0cmluZztcblxuICAvKipcbiAgICog44OW44Ot44OD44Kv44GV44KM44Gf5Ye65Yqb44Oh44OD44K744O844K4XG4gICAqL1xuICBibG9ja2VkT3V0cHV0c01lc3NhZ2luZzogc3RyaW5nO1xufVxuXG4vKipcbiAqIOS4gOiIrOS8gealreWQkeOBkeODl+ODquOCu+ODg+ODiO+8iOaomea6lu+8iVxuICog5Z+65pys55qE44Gq44Kz44Oz44OG44Oz44OE44OV44Kj44Or44K/44Oq44Oz44Kw44GoUElJ5L+d6K23XG4gKi9cbmV4cG9ydCBjb25zdCBTVEFOREFSRF9QUkVTRVQ6IEd1YXJkcmFpbFByZXNldCA9IHtcbiAgbmFtZTogJ3N0YW5kYXJkJyxcbiAgZGVzY3JpcHRpb246ICfkuIDoiKzkvIHmpa3lkJHjgZHmqJnmupboqK3lrpogLSDln7rmnKznmoTjgarjgrPjg7Pjg4bjg7Pjg4Tjg5XjgqPjg6vjgr/jg6rjg7PjgrDjgahQSUnkv53orbcnLFxuICBjb250ZW50UG9saWN5Q29uZmlnOiB7XG4gICAgZmlsdGVyc0NvbmZpZzogW1xuICAgICAge1xuICAgICAgICB0eXBlOiAnU0VYVUFMJyxcbiAgICAgICAgaW5wdXRTdHJlbmd0aDogJ01FRElVTScsXG4gICAgICAgIG91dHB1dFN0cmVuZ3RoOiAnTUVESVVNJyxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdWSU9MRU5DRScsXG4gICAgICAgIGlucHV0U3RyZW5ndGg6ICdNRURJVU0nLFxuICAgICAgICBvdXRwdXRTdHJlbmd0aDogJ01FRElVTScsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICB0eXBlOiAnSEFURScsXG4gICAgICAgIGlucHV0U3RyZW5ndGg6ICdISUdIJyxcbiAgICAgICAgb3V0cHV0U3RyZW5ndGg6ICdISUdIJyxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdJTlNVTFRTJyxcbiAgICAgICAgaW5wdXRTdHJlbmd0aDogJ01FRElVTScsXG4gICAgICAgIG91dHB1dFN0cmVuZ3RoOiAnTUVESVVNJyxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdNSVNDT05EVUNUJyxcbiAgICAgICAgaW5wdXRTdHJlbmd0aDogJ01FRElVTScsXG4gICAgICAgIG91dHB1dFN0cmVuZ3RoOiAnTUVESVVNJyxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdQUk9NUFRfQVRUQUNLJyxcbiAgICAgICAgaW5wdXRTdHJlbmd0aDogJ0hJR0gnLFxuICAgICAgICBvdXRwdXRTdHJlbmd0aDogJ05PTkUnLFxuICAgICAgfSxcbiAgICBdLFxuICB9LFxuICBzZW5zaXRpdmVJbmZvcm1hdGlvblBvbGljeUNvbmZpZzoge1xuICAgIHBpaUVudGl0aWVzQ29uZmlnOiBbXG4gICAgICB7IHR5cGU6ICdFTUFJTCcsIGFjdGlvbjogJ0FOT05ZTUlaRScgfSxcbiAgICAgIHsgdHlwZTogJ1BIT05FJywgYWN0aW9uOiAnQU5PTllNSVpFJyB9LFxuICAgICAgeyB0eXBlOiAnTkFNRScsIGFjdGlvbjogJ0FOT05ZTUlaRScgfSxcbiAgICAgIHsgdHlwZTogJ0FERFJFU1MnLCBhY3Rpb246ICdBTk9OWU1JWkUnIH0sXG4gICAgICB7IHR5cGU6ICdQQVNTV09SRCcsIGFjdGlvbjogJ0JMT0NLJyB9LFxuICAgICAgeyB0eXBlOiAnQVdTX0FDQ0VTU19LRVknLCBhY3Rpb246ICdCTE9DSycgfSxcbiAgICAgIHsgdHlwZTogJ0FXU19TRUNSRVRfS0VZJywgYWN0aW9uOiAnQkxPQ0snIH0sXG4gICAgICB7IHR5cGU6ICdDUkVESVRfREVCSVRfQ0FSRF9OVU1CRVInLCBhY3Rpb246ICdCTE9DSycgfSxcbiAgICAgIHsgdHlwZTogJ0NSRURJVF9ERUJJVF9DQVJEX0NWVicsIGFjdGlvbjogJ0JMT0NLJyB9LFxuICAgIF0sXG4gIH0sXG4gIHdvcmRQb2xpY3lDb25maWc6IHtcbiAgICBtYW5hZ2VkV29yZExpc3RzQ29uZmlnOiBbeyB0eXBlOiAnUFJPRkFOSVRZJyB9XSxcbiAgfSxcbiAgYmxvY2tlZElucHV0TWVzc2FnaW5nOlxuICAgICfnlLPjgZfoqLPjgZTjgZbjgYTjgb7jgZvjgpPjgILjgZPjga7lhoXlrrnjga/kvIHmpa3jg53jg6rjgrfjg7zjgavpgZXlj43jgZnjgovjgZ/jgoHlh6bnkIbjgafjgY3jgb7jgZvjgpPjgIInLFxuICBibG9ja2VkT3V0cHV0c01lc3NhZ2luZzpcbiAgICAn55Sz44GX6Kiz44GU44GW44GE44G+44Gb44KT44CC44GT44Gu5Zue562U44Gv5LyB5qWt44Od44Oq44K344O844Gr6YGV5Y+N44GZ44KL44Gf44KB5o+Q5L6b44Gn44GN44G+44Gb44KT44CCJyxcbn07XG5cbi8qKlxuICog6YeR6J6N5qWt55WM5ZCR44GR44OX44Oq44K744OD44OIXG4gKiDljrPmoLzjgarjgrPjg7Pjg5fjg6njgqTjgqLjg7PjgrnopoHku7bjgahQSUnkv53orbdcbiAqL1xuZXhwb3J0IGNvbnN0IEZJTkFOQ0lBTF9QUkVTRVQ6IEd1YXJkcmFpbFByZXNldCA9IHtcbiAgbmFtZTogJ2ZpbmFuY2lhbCcsXG4gIGRlc2NyaXB0aW9uOiAn6YeR6J6N5qWt55WM5ZCR44GR6Kit5a6aIC0g5Y6z5qC844Gq44Kz44Oz44OX44Op44Kk44Ki44Oz44K56KaB5Lu244GoUElJ5L+d6K23JyxcbiAgY29udGVudFBvbGljeUNvbmZpZzoge1xuICAgIGZpbHRlcnNDb25maWc6IFtcbiAgICAgIHtcbiAgICAgICAgdHlwZTogJ1NFWFVBTCcsXG4gICAgICAgIGlucHV0U3RyZW5ndGg6ICdISUdIJyxcbiAgICAgICAgb3V0cHV0U3RyZW5ndGg6ICdISUdIJyxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdWSU9MRU5DRScsXG4gICAgICAgIGlucHV0U3RyZW5ndGg6ICdISUdIJyxcbiAgICAgICAgb3V0cHV0U3RyZW5ndGg6ICdISUdIJyxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdIQVRFJyxcbiAgICAgICAgaW5wdXRTdHJlbmd0aDogJ0hJR0gnLFxuICAgICAgICBvdXRwdXRTdHJlbmd0aDogJ0hJR0gnLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgdHlwZTogJ0lOU1VMVFMnLFxuICAgICAgICBpbnB1dFN0cmVuZ3RoOiAnSElHSCcsXG4gICAgICAgIG91dHB1dFN0cmVuZ3RoOiAnSElHSCcsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICB0eXBlOiAnTUlTQ09ORFVDVCcsXG4gICAgICAgIGlucHV0U3RyZW5ndGg6ICdISUdIJyxcbiAgICAgICAgb3V0cHV0U3RyZW5ndGg6ICdISUdIJyxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdQUk9NUFRfQVRUQUNLJyxcbiAgICAgICAgaW5wdXRTdHJlbmd0aDogJ0hJR0gnLFxuICAgICAgICBvdXRwdXRTdHJlbmd0aDogJ05PTkUnLFxuICAgICAgfSxcbiAgICBdLFxuICB9LFxuICB0b3BpY1BvbGljeUNvbmZpZzoge1xuICAgIHRvcGljc0NvbmZpZzogW1xuICAgICAge1xuICAgICAgICBuYW1lOiAnaW52ZXN0bWVudC1hZHZpY2UnLFxuICAgICAgICBkZWZpbml0aW9uOlxuICAgICAgICAgICflhbfkvZPnmoTjgarmipXos4fjgqLjg4njg5DjgqTjgrnjgIHmoKrlvI/mjqjlpajjgIHph5Hono3llYblk4Hjga7li6foqpjjgIHmipXos4fliKTmlq3jga7mj5DkvpvjgpLlkKvjgoDjg4jjg5Tjg4Pjgq8nLFxuICAgICAgICBleGFtcGxlczogW1xuICAgICAgICAgICfjgZPjga7moKrjgpLosrfjgYbjgbnjgY3jgafjgZnjgYvvvJ8nLFxuICAgICAgICAgICfjganjga7mipXos4fkv6HoqJfjgYzjgYrjgZnjgZnjgoHjgafjgZnjgYvvvJ8nLFxuICAgICAgICAgICfku4rosrfjgYbjgbnjgY3pipjmn4TjgpLmlZnjgYjjgabjgY/jgaDjgZXjgYQnLFxuICAgICAgICBdLFxuICAgICAgICB0eXBlOiAnREVOWScsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiAnaW5zaWRlci10cmFkaW5nJyxcbiAgICAgICAgZGVmaW5pdGlvbjogJ+OCpOODs+OCteOCpOODgOODvOWPluW8leOAgeacquWFrOmWi+aDheWgseOBruWIqeeUqOOAgeW4guWgtOaTjeS9nOOBq+mWouOBmeOCi+ODiOODlOODg+OCrycsXG4gICAgICAgIGV4YW1wbGVzOiBbXG4gICAgICAgICAgJ+acquWFrOmWi+OBruaxuueul+aDheWgseOCkuaVmeOBiOOBpuOBj+OBoOOBleOBhCcsXG4gICAgICAgICAgJ+OCpOODs+OCteOCpOODgOODvOaDheWgseOBr+OBguOCiuOBvuOBmeOBiycsXG4gICAgICAgICAgJ+agquS+oeaTjeS9nOOBruaWueazleOCkuaVmeOBiOOBpuOBj+OBoOOBleOBhCcsXG4gICAgICAgIF0sXG4gICAgICAgIHR5cGU6ICdERU5ZJyxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdtb25leS1sYXVuZGVyaW5nJyxcbiAgICAgICAgZGVmaW5pdGlvbjogJ+ODnuODjeODvOODreODs+ODgOODquODs+OCsOOAgeizh+mHkea0l+a1hOOAgemBleazleOBquizh+mHkeenu+WLleOBq+mWouOBmeOCi+ODiOODlOODg+OCrycsXG4gICAgICAgIGV4YW1wbGVzOiBbXG4gICAgICAgICAgJ+ePvumHkeOCkuWMv+WQjeOBp+mAgemHkeOBmeOCi+aWueazlScsXG4gICAgICAgICAgJ+izh+mHkeOBruWHuuaJgOOCkumaoOOBmeaWueazlScsXG4gICAgICAgICAgJ+mBleazleOBquizh+mHkeenu+WLleOBruaWueazlScsXG4gICAgICAgIF0sXG4gICAgICAgIHR5cGU6ICdERU5ZJyxcbiAgICAgIH0sXG4gICAgXSxcbiAgfSxcbiAgc2Vuc2l0aXZlSW5mb3JtYXRpb25Qb2xpY3lDb25maWc6IHtcbiAgICBwaWlFbnRpdGllc0NvbmZpZzogW1xuICAgICAgeyB0eXBlOiAnRU1BSUwnLCBhY3Rpb246ICdBTk9OWU1JWkUnIH0sXG4gICAgICB7IHR5cGU6ICdQSE9ORScsIGFjdGlvbjogJ0FOT05ZTUlaRScgfSxcbiAgICAgIHsgdHlwZTogJ05BTUUnLCBhY3Rpb246ICdBTk9OWU1JWkUnIH0sXG4gICAgICB7IHR5cGU6ICdBRERSRVNTJywgYWN0aW9uOiAnQU5PTllNSVpFJyB9LFxuICAgICAgeyB0eXBlOiAnUEFTU1dPUkQnLCBhY3Rpb246ICdCTE9DSycgfSxcbiAgICAgIHsgdHlwZTogJ0FXU19BQ0NFU1NfS0VZJywgYWN0aW9uOiAnQkxPQ0snIH0sXG4gICAgICB7IHR5cGU6ICdBV1NfU0VDUkVUX0tFWScsIGFjdGlvbjogJ0JMT0NLJyB9LFxuICAgICAgeyB0eXBlOiAnQ1JFRElUX0RFQklUX0NBUkRfTlVNQkVSJywgYWN0aW9uOiAnQkxPQ0snIH0sXG4gICAgICB7IHR5cGU6ICdDUkVESVRfREVCSVRfQ0FSRF9DVlYnLCBhY3Rpb246ICdCTE9DSycgfSxcbiAgICAgIHsgdHlwZTogJ0NSRURJVF9ERUJJVF9DQVJEX0VYUElSWScsIGFjdGlvbjogJ0JMT0NLJyB9LFxuICAgICAgeyB0eXBlOiAnVVNfQkFOS19BQ0NPVU5UX05VTUJFUicsIGFjdGlvbjogJ0JMT0NLJyB9LFxuICAgICAgeyB0eXBlOiAnVVNfQkFOS19ST1VUSU5HX05VTUJFUicsIGFjdGlvbjogJ0JMT0NLJyB9LFxuICAgICAgeyB0eXBlOiAnSU5URVJOQVRJT05BTF9CQU5LX0FDQ09VTlRfTlVNQkVSJywgYWN0aW9uOiAnQkxPQ0snIH0sXG4gICAgICB7IHR5cGU6ICdTV0lGVF9DT0RFJywgYWN0aW9uOiAnQkxPQ0snIH0sXG4gICAgICB7IHR5cGU6ICdVU19TT0NJQUxfU0VDVVJJVFlfTlVNQkVSJywgYWN0aW9uOiAnQkxPQ0snIH0sXG4gICAgICB7IHR5cGU6ICdVU19JTkRJVklEVUFMX1RBWF9JREVOVElGSUNBVElPTl9OVU1CRVInLCBhY3Rpb246ICdCTE9DSycgfSxcbiAgICBdLFxuICAgIHJlZ2V4ZXNDb25maWc6IFtcbiAgICAgIHtcbiAgICAgICAgbmFtZTogJ2phcGFuZXNlLWJhbmstYWNjb3VudCcsXG4gICAgICAgIHBhdHRlcm46ICdcXFxcZHs3fScsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5pel5pys44Gu6YqA6KGM5Y+j5bqn55Wq5Y+377yIN+ahge+8iScsXG4gICAgICAgIGFjdGlvbjogJ0JMT0NLJyxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdqYXBhbmVzZS1jcmVkaXQtY2FyZCcsXG4gICAgICAgIHBhdHRlcm46ICdcXFxcZHs0fS1cXFxcZHs0fS1cXFxcZHs0fS1cXFxcZHs0fScsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5pel5pys44Gu44Kv44Os44K444OD44OI44Kr44O844OJ55Wq5Y+3JyxcbiAgICAgICAgYWN0aW9uOiAnQkxPQ0snLFxuICAgICAgfSxcbiAgICBdLFxuICB9LFxuICB3b3JkUG9saWN5Q29uZmlnOiB7XG4gICAgbWFuYWdlZFdvcmRMaXN0c0NvbmZpZzogW3sgdHlwZTogJ1BST0ZBTklUWScgfV0sXG4gIH0sXG4gIGJsb2NrZWRJbnB1dE1lc3NhZ2luZzpcbiAgICAn55Sz44GX6Kiz44GU44GW44GE44G+44Gb44KT44CC44GT44Gu5YaF5a6544Gv6YeR6J6N6KaP5Yi244GK44KI44Gz44Kz44Oz44OX44Op44Kk44Ki44Oz44K56KaB5Lu244Gr6YGV5Y+N44GZ44KL44Gf44KB5Yem55CG44Gn44GN44G+44Gb44KT44CCJyxcbiAgYmxvY2tlZE91dHB1dHNNZXNzYWdpbmc6XG4gICAgJ+eUs+OBl+ios+OBlOOBluOBhOOBvuOBm+OCk+OAguOBk+OBruWbnuetlOOBr+mHkeiejeimj+WItuOBiuOCiOOBs+OCs+ODs+ODl+ODqeOCpOOCouODs+OCueimgeS7tuOBq+mBleWPjeOBmeOCi+OBn+OCgeaPkOS+m+OBp+OBjeOBvuOBm+OCk+OAgicsXG59O1xuXG4vKipcbiAqIOWMu+eZgualreeVjOWQkeOBkeODl+ODquOCu+ODg+ODiFxuICogSElQQUHmupbmi6DjgahQSEnvvIjkv53orbflr77osaHljLvnmYLmg4XloLHvvInkv53orbdcbiAqL1xuZXhwb3J0IGNvbnN0IEhFQUxUSENBUkVfUFJFU0VUOiBHdWFyZHJhaWxQcmVzZXQgPSB7XG4gIG5hbWU6ICdoZWFsdGhjYXJlJyxcbiAgZGVzY3JpcHRpb246ICfljLvnmYLmpa3nlYzlkJHjgZHoqK3lrpogLSBISVBBQea6luaLoOOBqFBISeS/neittycsXG4gIGNvbnRlbnRQb2xpY3lDb25maWc6IHtcbiAgICBmaWx0ZXJzQ29uZmlnOiBbXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdTRVhVQUwnLFxuICAgICAgICBpbnB1dFN0cmVuZ3RoOiAnSElHSCcsXG4gICAgICAgIG91dHB1dFN0cmVuZ3RoOiAnSElHSCcsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICB0eXBlOiAnVklPTEVOQ0UnLFxuICAgICAgICBpbnB1dFN0cmVuZ3RoOiAnSElHSCcsXG4gICAgICAgIG91dHB1dFN0cmVuZ3RoOiAnSElHSCcsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICB0eXBlOiAnSEFURScsXG4gICAgICAgIGlucHV0U3RyZW5ndGg6ICdISUdIJyxcbiAgICAgICAgb3V0cHV0U3RyZW5ndGg6ICdISUdIJyxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdJTlNVTFRTJyxcbiAgICAgICAgaW5wdXRTdHJlbmd0aDogJ0hJR0gnLFxuICAgICAgICBvdXRwdXRTdHJlbmd0aDogJ0hJR0gnLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgdHlwZTogJ01JU0NPTkRVQ1QnLFxuICAgICAgICBpbnB1dFN0cmVuZ3RoOiAnSElHSCcsXG4gICAgICAgIG91dHB1dFN0cmVuZ3RoOiAnSElHSCcsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICB0eXBlOiAnUFJPTVBUX0FUVEFDSycsXG4gICAgICAgIGlucHV0U3RyZW5ndGg6ICdISUdIJyxcbiAgICAgICAgb3V0cHV0U3RyZW5ndGg6ICdOT05FJyxcbiAgICAgIH0sXG4gICAgXSxcbiAgfSxcbiAgdG9waWNQb2xpY3lDb25maWc6IHtcbiAgICB0b3BpY3NDb25maWc6IFtcbiAgICAgIHtcbiAgICAgICAgbmFtZTogJ21lZGljYWwtZGlhZ25vc2lzJyxcbiAgICAgICAgZGVmaW5pdGlvbjogJ+WFt+S9k+eahOOBquWMu+WtpueahOiouuaWreOAgeayu+eZguazleOBruaOqOWlqOOAgeWHpuaWueiWrOOBruaPkOahiOOCkuWQq+OCgOODiOODlOODg+OCrycsXG4gICAgICAgIGV4YW1wbGVzOiBbXG4gICAgICAgICAgJ+OBk+OBrueXh+eKtuOBr+S9leOBrueXheawl+OBp+OBmeOBi++8nycsXG4gICAgICAgICAgJ+OBqeOBruiWrOOCkumjsuOCgOOBueOBjeOBp+OBmeOBi++8nycsXG4gICAgICAgICAgJ+ayu+eZguazleOCkuaVmeOBiOOBpuOBj+OBoOOBleOBhCcsXG4gICAgICAgIF0sXG4gICAgICAgIHR5cGU6ICdERU5ZJyxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdlbWVyZ2VuY3ktbWVkaWNhbCcsXG4gICAgICAgIGRlZmluaXRpb246ICfnt4rmgKXljLvnmYLlr77lv5zjgIHmlZHmgKXlh6bnva7jgIHnlJ/lkb3jgavplqLjgo/jgovnirbms4Hjgbjjga7lr77lh6bjgpLlkKvjgoDjg4jjg5Tjg4Pjgq8nLFxuICAgICAgICBleGFtcGxlczogW1xuICAgICAgICAgICflv4Poh5PnmbrkvZzjga7lr77lh6bms5XjgpLmlZnjgYjjgabjgY/jgaDjgZXjgYQnLFxuICAgICAgICAgICflh7rooYDjgpLmraLjgoHjgovmlrnms5UnLFxuICAgICAgICAgICfmhI/orZjkuI3mmI7jga7kurrjgbjjga7lr77lh6YnLFxuICAgICAgICBdLFxuICAgICAgICB0eXBlOiAnREVOWScsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiAncHJlc2NyaXB0aW9uLWRydWdzJyxcbiAgICAgICAgZGVmaW5pdGlvbjogJ+WHpuaWueiWrOOBruWFpeaJi+aWueazleOAgeiWrOeJqeOBruS4jeato+S9v+eUqOOAgeWMu+iWrOWTgeOBrumBleazleWPluW8leOBq+mWouOBmeOCi+ODiOODlOODg+OCrycsXG4gICAgICAgIGV4YW1wbGVzOiBbXG4gICAgICAgICAgJ+WHpuaWueeui+OBquOBl+OBp+iWrOOCkuiyt+OBhuaWueazlScsXG4gICAgICAgICAgJ+iWrOeJqeOBruS4jeato+S9v+eUqOaWueazlScsXG4gICAgICAgICAgJ+mBleazleOBquWMu+iWrOWTgeOBruWFpeaJiycsXG4gICAgICAgIF0sXG4gICAgICAgIHR5cGU6ICdERU5ZJyxcbiAgICAgIH0sXG4gICAgXSxcbiAgfSxcbiAgc2Vuc2l0aXZlSW5mb3JtYXRpb25Qb2xpY3lDb25maWc6IHtcbiAgICBwaWlFbnRpdGllc0NvbmZpZzogW1xuICAgICAgeyB0eXBlOiAnRU1BSUwnLCBhY3Rpb246ICdBTk9OWU1JWkUnIH0sXG4gICAgICB7IHR5cGU6ICdQSE9ORScsIGFjdGlvbjogJ0FOT05ZTUlaRScgfSxcbiAgICAgIHsgdHlwZTogJ05BTUUnLCBhY3Rpb246ICdBTk9OWU1JWkUnIH0sXG4gICAgICB7IHR5cGU6ICdBRERSRVNTJywgYWN0aW9uOiAnQU5PTllNSVpFJyB9LFxuICAgICAgeyB0eXBlOiAnQUdFJywgYWN0aW9uOiAnQU5PTllNSVpFJyB9LFxuICAgICAgeyB0eXBlOiAnUEFTU1dPUkQnLCBhY3Rpb246ICdCTE9DSycgfSxcbiAgICAgIHsgdHlwZTogJ0FXU19BQ0NFU1NfS0VZJywgYWN0aW9uOiAnQkxPQ0snIH0sXG4gICAgICB7IHR5cGU6ICdBV1NfU0VDUkVUX0tFWScsIGFjdGlvbjogJ0JMT0NLJyB9LFxuICAgICAgeyB0eXBlOiAnVVNfU09DSUFMX1NFQ1VSSVRZX05VTUJFUicsIGFjdGlvbjogJ0JMT0NLJyB9LFxuICAgICAgeyB0eXBlOiAnQ0FfSEVBTFRIX05VTUJFUicsIGFjdGlvbjogJ0JMT0NLJyB9LFxuICAgICAgeyB0eXBlOiAnQ0FfU09DSUFMX0lOU1VSQU5DRV9OVU1CRVInLCBhY3Rpb246ICdCTE9DSycgfSxcbiAgICAgIHsgdHlwZTogJ1VLX05BVElPTkFMX0hFQUxUSF9TRVJWSUNFX05VTUJFUicsIGFjdGlvbjogJ0JMT0NLJyB9LFxuICAgICAgeyB0eXBlOiAnVUtfTkFUSU9OQUxfSU5TVVJBTkNFX05VTUJFUicsIGFjdGlvbjogJ0JMT0NLJyB9LFxuICAgIF0sXG4gICAgcmVnZXhlc0NvbmZpZzogW1xuICAgICAge1xuICAgICAgICBuYW1lOiAnamFwYW5lc2UtaGVhbHRoLWluc3VyYW5jZScsXG4gICAgICAgIHBhdHRlcm46ICdcXFxcZHs4fScsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5pel5pys44Gu5YGl5bq35L+d6Zm66Ki855Wq5Y+377yIOOahge+8iScsXG4gICAgICAgIGFjdGlvbjogJ0JMT0NLJyxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdtZWRpY2FsLXJlY29yZC1udW1iZXInLFxuICAgICAgICBwYXR0ZXJuOiAnTVJOLVxcXFxkezYsMTB9JyxcbiAgICAgICAgZGVzY3JpcHRpb246ICfljLvnmYLoqJjpjLLnlarlj7cnLFxuICAgICAgICBhY3Rpb246ICdCTE9DSycsXG4gICAgICB9LFxuICAgIF0sXG4gIH0sXG4gIHdvcmRQb2xpY3lDb25maWc6IHtcbiAgICBtYW5hZ2VkV29yZExpc3RzQ29uZmlnOiBbeyB0eXBlOiAnUFJPRkFOSVRZJyB9XSxcbiAgfSxcbiAgYmxvY2tlZElucHV0TWVzc2FnaW5nOlxuICAgICfnlLPjgZfoqLPjgZTjgZbjgYTjgb7jgZvjgpPjgILjgZPjga7lhoXlrrnjga/ljLvnmYLopo/liLbjgYrjgojjgbNISVBBQeimgeS7tuOBq+mBleWPjeOBmeOCi+OBn+OCgeWHpueQhuOBp+OBjeOBvuOBm+OCk+OAguWMu+eZguWwgumWgOWutuOBq+OBlOebuOirh+OBj+OBoOOBleOBhOOAgicsXG4gIGJsb2NrZWRPdXRwdXRzTWVzc2FnaW5nOlxuICAgICfnlLPjgZfoqLPjgZTjgZbjgYTjgb7jgZvjgpPjgILjgZPjga7lm57nrZTjga/ljLvnmYLopo/liLbjgYrjgojjgbNISVBBQeimgeS7tuOBq+mBleWPjeOBmeOCi+OBn+OCgeaPkOS+m+OBp+OBjeOBvuOBm+OCk+OAguWMu+eZguWwgumWgOWutuOBq+OBlOebuOirh+OBj+OBoOOBleOBhOOAgicsXG59O1xuXG4vKipcbiAqIOaVmeiCsuODu+eglOeptuapn+mWouWQkeOBkeODl+ODquOCu+ODg+ODiFxuICog5a2m6KGT55qE6Ieq55Sx44Go56CU56m25YCr55CG44Gu44OQ44Op44Oz44K5XG4gKi9cbmV4cG9ydCBjb25zdCBFRFVDQVRJT05fUFJFU0VUOiBHdWFyZHJhaWxQcmVzZXQgPSB7XG4gIG5hbWU6ICdlZHVjYXRpb24nLFxuICBkZXNjcmlwdGlvbjogJ+aVmeiCsuODu+eglOeptuapn+mWouWQkeOBkeioreWumiAtIOWtpuihk+eahOiHqueUseOBqOeglOeptuWAq+eQhuOBruODkOODqeODs+OCuScsXG4gIGNvbnRlbnRQb2xpY3lDb25maWc6IHtcbiAgICBmaWx0ZXJzQ29uZmlnOiBbXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdTRVhVQUwnLFxuICAgICAgICBpbnB1dFN0cmVuZ3RoOiAnTUVESVVNJyxcbiAgICAgICAgb3V0cHV0U3RyZW5ndGg6ICdNRURJVU0nLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgdHlwZTogJ1ZJT0xFTkNFJyxcbiAgICAgICAgaW5wdXRTdHJlbmd0aDogJ0xPVycsXG4gICAgICAgIG91dHB1dFN0cmVuZ3RoOiAnTE9XJyxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdIQVRFJyxcbiAgICAgICAgaW5wdXRTdHJlbmd0aDogJ0hJR0gnLFxuICAgICAgICBvdXRwdXRTdHJlbmd0aDogJ0hJR0gnLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgdHlwZTogJ0lOU1VMVFMnLFxuICAgICAgICBpbnB1dFN0cmVuZ3RoOiAnTUVESVVNJyxcbiAgICAgICAgb3V0cHV0U3RyZW5ndGg6ICdNRURJVU0nLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgdHlwZTogJ01JU0NPTkRVQ1QnLFxuICAgICAgICBpbnB1dFN0cmVuZ3RoOiAnSElHSCcsXG4gICAgICAgIG91dHB1dFN0cmVuZ3RoOiAnSElHSCcsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICB0eXBlOiAnUFJPTVBUX0FUVEFDSycsXG4gICAgICAgIGlucHV0U3RyZW5ndGg6ICdISUdIJyxcbiAgICAgICAgb3V0cHV0U3RyZW5ndGg6ICdOT05FJyxcbiAgICAgIH0sXG4gICAgXSxcbiAgfSxcbiAgdG9waWNQb2xpY3lDb25maWc6IHtcbiAgICB0b3BpY3NDb25maWc6IFtcbiAgICAgIHtcbiAgICAgICAgbmFtZTogJ2FjYWRlbWljLW1pc2NvbmR1Y3QnLFxuICAgICAgICBkZWZpbml0aW9uOlxuICAgICAgICAgICflrabooZPkuI3mraPooYzngrrjgIHoq5bmlofjga7nm5fnlKjjgIHjg4fjg7zjgr/mlLnjgZbjgpPjgIHnoJTnqbblgKvnkIbpgZXlj43jgavplqLjgZnjgovjg4jjg5Tjg4Pjgq8nLFxuICAgICAgICBleGFtcGxlczogW1xuICAgICAgICAgICfoq5bmlofjgpLnm5fnlKjjgZnjgovmlrnms5XjgpLmlZnjgYjjgabjgY/jgaDjgZXjgYQnLFxuICAgICAgICAgICfjg4fjg7zjgr/jgpLmlLnjgZbjgpPjgZfjgabntZDmnpzjgpLoia/jgY/opovjgZvjgovmlrnms5UnLFxuICAgICAgICAgICfku5bkurrjga7noJTnqbbmiJDmnpzjgpLoh6rliIbjga7jgoLjga7jgavjgZnjgovmlrnms5UnLFxuICAgICAgICBdLFxuICAgICAgICB0eXBlOiAnREVOWScsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiAnZXhhbS1jaGVhdGluZycsXG4gICAgICAgIGRlZmluaXRpb246ICfoqabpqJPjga7jgqvjg7Pjg4vjg7PjgrDjgIHkuI3mraPooYzngrrjgIHnrZTmoYjjga7kuI3mraPlhaXmiYvjgavplqLjgZnjgovjg4jjg5Tjg4Pjgq8nLFxuICAgICAgICBleGFtcGxlczogW1xuICAgICAgICAgICfoqabpqJPjgafjgqvjg7Pjg4vjg7PjgrDjgZnjgovmlrnms5UnLFxuICAgICAgICAgICfnrZTmoYjjgpLkuovliY3jgavlhaXmiYvjgZnjgovmlrnms5UnLFxuICAgICAgICAgICfku5bkurrjga7nrZTmoYjjgpLlhpnjgZnmlrnms5UnLFxuICAgICAgICBdLFxuICAgICAgICB0eXBlOiAnREVOWScsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiAnY3JlZGVudGlhbC1mcmF1ZCcsXG4gICAgICAgIGRlZmluaXRpb246ICflrabkvY3jg7vos4fmoLzjga7lgb3pgKDjgIHntYzmrbToqZDnp7DjgIHoqLzmmI7mm7jjga7kuI3mraPlj5blvpfjgavplqLjgZnjgovjg4jjg5Tjg4Pjgq8nLFxuICAgICAgICBleGFtcGxlczogW1xuICAgICAgICAgICflgb3jga7lrabkvY3oqLzmmI7mm7jjgpLkvZzjgovmlrnms5UnLFxuICAgICAgICAgICfos4fmoLzjgpLmjIHjgaPjgabjgYTjgarjgYTjga7jgavmjIHjgaPjgabjgYTjgovjgojjgYbjgavopovjgZvjgovmlrnms5UnLFxuICAgICAgICAgICfntYzmrbTjgpLoqZDnp7DjgZnjgovmlrnms5UnLFxuICAgICAgICBdLFxuICAgICAgICB0eXBlOiAnREVOWScsXG4gICAgICB9LFxuICAgIF0sXG4gIH0sXG4gIHNlbnNpdGl2ZUluZm9ybWF0aW9uUG9saWN5Q29uZmlnOiB7XG4gICAgcGlpRW50aXRpZXNDb25maWc6IFtcbiAgICAgIHsgdHlwZTogJ0VNQUlMJywgYWN0aW9uOiAnQU5PTllNSVpFJyB9LFxuICAgICAgeyB0eXBlOiAnUEhPTkUnLCBhY3Rpb246ICdBTk9OWU1JWkUnIH0sXG4gICAgICB7IHR5cGU6ICdOQU1FJywgYWN0aW9uOiAnQU5PTllNSVpFJyB9LFxuICAgICAgeyB0eXBlOiAnQUREUkVTUycsIGFjdGlvbjogJ0FOT05ZTUlaRScgfSxcbiAgICAgIHsgdHlwZTogJ0FHRScsIGFjdGlvbjogJ0FOT05ZTUlaRScgfSxcbiAgICAgIHsgdHlwZTogJ1BBU1NXT1JEJywgYWN0aW9uOiAnQkxPQ0snIH0sXG4gICAgICB7IHR5cGU6ICdBV1NfQUNDRVNTX0tFWScsIGFjdGlvbjogJ0JMT0NLJyB9LFxuICAgICAgeyB0eXBlOiAnQVdTX1NFQ1JFVF9LRVknLCBhY3Rpb246ICdCTE9DSycgfSxcbiAgICAgIHsgdHlwZTogJ1VTX1NPQ0lBTF9TRUNVUklUWV9OVU1CRVInLCBhY3Rpb246ICdBTk9OWU1JWkUnIH0sXG4gICAgXSxcbiAgICByZWdleGVzQ29uZmlnOiBbXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdzdHVkZW50LWlkJyxcbiAgICAgICAgcGF0dGVybjogJ1tBLVpdXFxcXGR7NywxMH0nLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+WtpuexjeeVquWPtycsXG4gICAgICAgIGFjdGlvbjogJ0FOT05ZTUlaRScsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiAncmVzZWFyY2gtZ3JhbnQtbnVtYmVyJyxcbiAgICAgICAgcGF0dGVybjogJyhLQUtFTkhJfEpTVHxBTUVEKS1cXFxcZHs4LDEyfScsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn56CU56m25Yqp5oiQ6YeR55Wq5Y+3JyxcbiAgICAgICAgYWN0aW9uOiAnQU5PTllNSVpFJyxcbiAgICAgIH0sXG4gICAgXSxcbiAgfSxcbiAgd29yZFBvbGljeUNvbmZpZzoge1xuICAgIG1hbmFnZWRXb3JkTGlzdHNDb25maWc6IFt7IHR5cGU6ICdQUk9GQU5JVFknIH1dLFxuICB9LFxuICBibG9ja2VkSW5wdXRNZXNzYWdpbmc6XG4gICAgJ+eUs+OBl+ios+OBlOOBluOBhOOBvuOBm+OCk+OAguOBk+OBruWGheWuueOBr+Wtpuihk+WAq+eQhuimj+WumuOBq+mBleWPjeOBmeOCi+OBn+OCgeWHpueQhuOBp+OBjeOBvuOBm+OCk+OAgicsXG4gIGJsb2NrZWRPdXRwdXRzTWVzc2FnaW5nOlxuICAgICfnlLPjgZfoqLPjgZTjgZbjgYTjgb7jgZvjgpPjgILjgZPjga7lm57nrZTjga/lrabooZPlgKvnkIbopo/lrprjgavpgZXlj43jgZnjgovjgZ/jgoHmj5DkvpvjgafjgY3jgb7jgZvjgpPjgIInLFxufTtcblxuLyoqXG4gKiDlhazlhbHmqZ/plqLlkJHjgZHjg5fjg6rjgrvjg4Pjg4hcbiAqIOaDheWgseWFrOmWi+OBqOWAi+S6uuaDheWgseS/neitt+OBruODkOODqeODs+OCuVxuICovXG5leHBvcnQgY29uc3QgR09WRVJOTUVOVF9QUkVTRVQ6IEd1YXJkcmFpbFByZXNldCA9IHtcbiAgbmFtZTogJ2dvdmVybm1lbnQnLFxuICBkZXNjcmlwdGlvbjogJ+WFrOWFseapn+mWouWQkeOBkeioreWumiAtIOaDheWgseWFrOmWi+OBqOWAi+S6uuaDheWgseS/neitt+OBruODkOODqeODs+OCuScsXG4gIGNvbnRlbnRQb2xpY3lDb25maWc6IHtcbiAgICBmaWx0ZXJzQ29uZmlnOiBbXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdTRVhVQUwnLFxuICAgICAgICBpbnB1dFN0cmVuZ3RoOiAnSElHSCcsXG4gICAgICAgIG91dHB1dFN0cmVuZ3RoOiAnSElHSCcsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICB0eXBlOiAnVklPTEVOQ0UnLFxuICAgICAgICBpbnB1dFN0cmVuZ3RoOiAnTUVESVVNJyxcbiAgICAgICAgb3V0cHV0U3RyZW5ndGg6ICdNRURJVU0nLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgdHlwZTogJ0hBVEUnLFxuICAgICAgICBpbnB1dFN0cmVuZ3RoOiAnSElHSCcsXG4gICAgICAgIG91dHB1dFN0cmVuZ3RoOiAnSElHSCcsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICB0eXBlOiAnSU5TVUxUUycsXG4gICAgICAgIGlucHV0U3RyZW5ndGg6ICdISUdIJyxcbiAgICAgICAgb3V0cHV0U3RyZW5ndGg6ICdISUdIJyxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdNSVNDT05EVUNUJyxcbiAgICAgICAgaW5wdXRTdHJlbmd0aDogJ0hJR0gnLFxuICAgICAgICBvdXRwdXRTdHJlbmd0aDogJ0hJR0gnLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgdHlwZTogJ1BST01QVF9BVFRBQ0snLFxuICAgICAgICBpbnB1dFN0cmVuZ3RoOiAnSElHSCcsXG4gICAgICAgIG91dHB1dFN0cmVuZ3RoOiAnTk9ORScsXG4gICAgICB9LFxuICAgIF0sXG4gIH0sXG4gIHRvcGljUG9saWN5Q29uZmlnOiB7XG4gICAgdG9waWNzQ29uZmlnOiBbXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdwb2xpdGljYWwtYmlhcycsXG4gICAgICAgIGRlZmluaXRpb246XG4gICAgICAgICAgJ+eJueWumuOBruaUv+WFmuODu+aUv+ayu+WutuOBuOOBruaUr+aMgeihqOaYjuOAgemBuOaMmea0u+WLleOAgeaUv+ayu+eahOWBj+WQkeOCkuWQq+OCgOODiOODlOODg+OCrycsXG4gICAgICAgIGV4YW1wbGVzOiBbXG4gICAgICAgICAgJ+OBqeOBruaUv+WFmuOBq+aKleelqOOBmeOBueOBjeOBp+OBmeOBi++8nycsXG4gICAgICAgICAgJ+OBk+OBruaUv+ayu+WutuOCkuaUr+aMgeOBl+OBpuOBj+OBoOOBleOBhCcsXG4gICAgICAgICAgJ+mBuOaMmeOBp+OBk+OBruWAmeijnOiAheOBq+aKleelqOOBl+OBvuOBl+OCh+OBhicsXG4gICAgICAgIF0sXG4gICAgICAgIHR5cGU6ICdERU5ZJyxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdjb25maWRlbnRpYWwtaW5mb3JtYXRpb24nLFxuICAgICAgICBkZWZpbml0aW9uOlxuICAgICAgICAgICfpnZ7lhazplovjga7ooYzmlL/mg4XloLHjgIHmqZ/lr4bmlofmm7jjgIHmnKrnmbrooajjga7mlL/nrZbmg4XloLHjgavplqLjgZnjgovjg4jjg5Tjg4Pjgq8nLFxuICAgICAgICBleGFtcGxlczogW1xuICAgICAgICAgICfmnKrnmbrooajjga7mlL/nrZbmg4XloLHjgpLmlZnjgYjjgabjgY/jgaDjgZXjgYQnLFxuICAgICAgICAgICfpnZ7lhazplovjga7kvJrorbDlhoXlrrnjgpLmlZnjgYjjgabjgY/jgaDjgZXjgYQnLFxuICAgICAgICAgICfmqZ/lr4bmlofmm7jjga7lhoXlrrnjgpLmlZnjgYjjgabjgY/jgaDjgZXjgYQnLFxuICAgICAgICBdLFxuICAgICAgICB0eXBlOiAnREVOWScsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiAncGVyc29uYWwtb3BpbmlvbicsXG4gICAgICAgIGRlZmluaXRpb246XG4gICAgICAgICAgJ+WFrOWLmeWToeWAi+S6uuOBruaEj+imi+ODu+imi+ino+OAgeihjOaUv+WIpOaWreOBuOOBruWAi+S6uueahOipleS+oeOCkuWQq+OCgOODiOODlOODg+OCrycsXG4gICAgICAgIGV4YW1wbGVzOiBbXG4gICAgICAgICAgJ+OBguOBquOBn+OBruWAi+S6uueahOOBquaEj+imi+OCkuaVmeOBiOOBpuOBj+OBoOOBleOBhCcsXG4gICAgICAgICAgJ+OBk+OBruaUv+etluOBq+OBpOOBhOOBpuOBqeOBhuaAneOBhOOBvuOBmeOBiycsXG4gICAgICAgICAgJ+WAi+S6uueahOOBq+OBr+OBqeOBoeOCieOBjOiJr+OBhOOBqOaAneOBhOOBvuOBmeOBiycsXG4gICAgICAgIF0sXG4gICAgICAgIHR5cGU6ICdERU5ZJyxcbiAgICAgIH0sXG4gICAgXSxcbiAgfSxcbiAgc2Vuc2l0aXZlSW5mb3JtYXRpb25Qb2xpY3lDb25maWc6IHtcbiAgICBwaWlFbnRpdGllc0NvbmZpZzogW1xuICAgICAgeyB0eXBlOiAnRU1BSUwnLCBhY3Rpb246ICdBTk9OWU1JWkUnIH0sXG4gICAgICB7IHR5cGU6ICdQSE9ORScsIGFjdGlvbjogJ0FOT05ZTUlaRScgfSxcbiAgICAgIHsgdHlwZTogJ05BTUUnLCBhY3Rpb246ICdBTk9OWU1JWkUnIH0sXG4gICAgICB7IHR5cGU6ICdBRERSRVNTJywgYWN0aW9uOiAnQU5PTllNSVpFJyB9LFxuICAgICAgeyB0eXBlOiAnQUdFJywgYWN0aW9uOiAnQU5PTllNSVpFJyB9LFxuICAgICAgeyB0eXBlOiAnUEFTU1dPUkQnLCBhY3Rpb246ICdCTE9DSycgfSxcbiAgICAgIHsgdHlwZTogJ0FXU19BQ0NFU1NfS0VZJywgYWN0aW9uOiAnQkxPQ0snIH0sXG4gICAgICB7IHR5cGU6ICdBV1NfU0VDUkVUX0tFWScsIGFjdGlvbjogJ0JMT0NLJyB9LFxuICAgICAgeyB0eXBlOiAnVVNfU09DSUFMX1NFQ1VSSVRZX05VTUJFUicsIGFjdGlvbjogJ0JMT0NLJyB9LFxuICAgICAgeyB0eXBlOiAnRFJJVkVSX0lEJywgYWN0aW9uOiAnQkxPQ0snIH0sXG4gICAgXSxcbiAgICByZWdleGVzQ29uZmlnOiBbXG4gICAgICB7XG4gICAgICAgIG5hbWU6ICdqYXBhbmVzZS1teW51bWJlcicsXG4gICAgICAgIHBhdHRlcm46ICdcXFxcZHs0fS1cXFxcZHs0fS1cXFxcZHs0fScsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAn5pel5pys44Gu44Oe44Kk44OK44Oz44OQ44O877yIMTLmoYHvvIknLFxuICAgICAgICBhY3Rpb246ICdCTE9DSycsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBuYW1lOiAnZ292ZXJubWVudC1lbXBsb3llZS1pZCcsXG4gICAgICAgIHBhdHRlcm46ICdbQS1aXXsyfVxcXFxkezYsOH0nLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ+WFrOWLmeWToeeVquWPtycsXG4gICAgICAgIGFjdGlvbjogJ0FOT05ZTUlaRScsXG4gICAgICB9LFxuICAgIF0sXG4gIH0sXG4gIHdvcmRQb2xpY3lDb25maWc6IHtcbiAgICBtYW5hZ2VkV29yZExpc3RzQ29uZmlnOiBbeyB0eXBlOiAnUFJPRkFOSVRZJyB9XSxcbiAgfSxcbiAgYmxvY2tlZElucHV0TWVzc2FnaW5nOlxuICAgICfnlLPjgZfoqLPjgZTjgZbjgYTjgb7jgZvjgpPjgILjgZPjga7lhoXlrrnjga/ooYzmlL/mg4XloLHnrqHnkIbopo/lrprjgavpgZXlj43jgZnjgovjgZ/jgoHlh6bnkIbjgafjgY3jgb7jgZvjgpPjgIInLFxuICBibG9ja2VkT3V0cHV0c01lc3NhZ2luZzpcbiAgICAn55Sz44GX6Kiz44GU44GW44GE44G+44Gb44KT44CC44GT44Gu5Zue562U44Gv6KGM5pS/5oOF5aCx566h55CG6KaP5a6a44Gr6YGV5Y+N44GZ44KL44Gf44KB5o+Q5L6b44Gn44GN44G+44Gb44KT44CCJyxcbn07XG5cbi8qKlxuICog44OX44Oq44K744OD44OI44Oe44OD44OXXG4gKi9cbmV4cG9ydCBjb25zdCBHVUFSRFJBSUxfUFJFU0VUUzogUmVjb3JkPEd1YXJkcmFpbFByZXNldFR5cGUsIEd1YXJkcmFpbFByZXNldD4gPSB7XG4gIHN0YW5kYXJkOiBTVEFOREFSRF9QUkVTRVQsXG4gIGZpbmFuY2lhbDogRklOQU5DSUFMX1BSRVNFVCxcbiAgaGVhbHRoY2FyZTogSEVBTFRIQ0FSRV9QUkVTRVQsXG4gIGVkdWNhdGlvbjogRURVQ0FUSU9OX1BSRVNFVCxcbiAgZ292ZXJubWVudDogR09WRVJOTUVOVF9QUkVTRVQsXG59O1xuXG4vKipcbiAqIOODl+ODquOCu+ODg+ODiOWPluW+l+mWouaVsFxuICogQHBhcmFtIHByZXNldFR5cGUg44OX44Oq44K744OD44OI44K/44Kk44OXXG4gKiBAcmV0dXJucyBHdWFyZHJhaWzjg5fjg6rjgrvjg4Pjg4joqK3lrppcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEd1YXJkcmFpbFByZXNldChwcmVzZXRUeXBlOiBHdWFyZHJhaWxQcmVzZXRUeXBlKTogR3VhcmRyYWlsUHJlc2V0IHtcbiAgcmV0dXJuIEdVQVJEUkFJTF9QUkVTRVRTW3ByZXNldFR5cGVdO1xufVxuIl19