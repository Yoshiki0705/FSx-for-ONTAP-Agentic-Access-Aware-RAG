"use strict";
/**
 * Bedrock Guardrailsコンストラクト
 * エンタープライズグレードのコンテンツフィルタリングとPII保護
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BedrockGuardrailsConstruct = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const bedrock = __importStar(require("aws-cdk-lib/aws-bedrock"));
const constructs_1 = require("constructs");
class BedrockGuardrailsConstruct extends constructs_1.Construct {
    /**
     * Bedrock Guardrail
     */
    guardrail;
    /**
     * Guardrail ARN
     */
    guardrailArn;
    /**
     * Guardrail ID
     */
    guardrailId;
    /**
     * Guardrail Version
     */
    guardrailVersion;
    constructor(scope, id, props) {
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
    createGuardrail(props) {
        const guardrail = new bedrock.CfnGuardrail(this, 'Guardrail', {
            name: props.guardrailName,
            description: props.description,
            blockedInputMessaging: props.blockedInputMessaging || '申し訳ございません。この内容は処理できません。',
            blockedOutputsMessaging: props.blockedOutputsMessaging || '申し訳ございません。この回答は提供できません。',
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
            const sensitiveInfoConfig = {};
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
            const wordConfig = {};
            if (props.wordPolicyConfig.managedWordListsConfig) {
                wordConfig.managedWordListsConfig =
                    props.wordPolicyConfig.managedWordListsConfig.map((list) => ({
                        type: list.type,
                    }));
            }
            if (props.wordPolicyConfig.wordsConfig) {
                wordConfig.wordsConfig = props.wordPolicyConfig.wordsConfig.map((word) => ({
                    text: word.text,
                }));
            }
            guardrail.wordPolicyConfig = wordConfig;
        }
        return guardrail;
    }
}
exports.BedrockGuardrailsConstruct = BedrockGuardrailsConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1ndWFyZHJhaWxzLWNvbnN0cnVjdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJlZHJvY2stZ3VhcmRyYWlscy1jb25zdHJ1Y3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7R0FHRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpREFBbUM7QUFDbkMsaUVBQW1EO0FBQ25ELDJDQUF1QztBQXdPdkMsTUFBYSwwQkFBMkIsU0FBUSxzQkFBUztJQUN2RDs7T0FFRztJQUNhLFNBQVMsQ0FBd0I7SUFFakQ7O09BRUc7SUFDYSxZQUFZLENBQVU7SUFFdEM7O09BRUc7SUFDYSxXQUFXLENBQVU7SUFFckM7O09BRUc7SUFDYSxnQkFBZ0IsQ0FBVTtJQUUxQyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXNDO1FBQzlFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsOEJBQThCO1FBQzlCLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDbkIsT0FBTztRQUNULENBQUM7UUFFRCxzQkFBc0I7UUFDdEIsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRTdDLFdBQVc7UUFDWCxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUM7UUFDcEQsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQztRQUNsRCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUM7UUFFbkQsbUJBQW1CO1FBQ25CLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ3RDLEtBQUssRUFBRSxJQUFJLENBQUMsWUFBWTtZQUN4QixXQUFXLEVBQUUsdUJBQXVCO1lBQ3BDLFVBQVUsRUFBRSxH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g4hcbiAqIOOCqOODs+OCv+ODvOODl+ODqeOCpOOCuuOCsOODrOODvOODieOBruOCs+ODs+ODhuODs+ODhOODleOCo+ODq+OCv+ODquODs+OCsOOBqFBJSeS/neitt1xuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBiZWRyb2NrIGZyb20gJ2F3cy1jZGstbGliL2F3cy1iZWRyb2NrJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIEJlZHJvY2tHdWFyZHJhaWxzQ29uc3RydWN0UHJvcHMge1xuICAvKipcbiAgICogQmVkcm9jayBHdWFyZHJhaWxz44KS5pyJ5Yq55YyW44GZ44KL44GLXG4gICAqIEBkZWZhdWx0IGZhbHNlXG4gICAqL1xuICBlbmFibGVkPzogYm9vbGVhbjtcblxuICAvKipcbiAgICog44OX44Ot44K444Kn44Kv44OI5ZCNXG4gICAqL1xuICBwcm9qZWN0TmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiDnkrDlooPlkI1cbiAgICovXG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIEd1YXJkcmFpbOWQjVxuICAgKi9cbiAgZ3VhcmRyYWlsTmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBHdWFyZHJhaWzoqqzmmI5cbiAgICovXG4gIGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiDjgrPjg7Pjg4bjg7Pjg4Tjg5XjgqPjg6vjgr/oqK3lrppcbiAgICovXG4gIGNvbnRlbnRQb2xpY3lDb25maWc/OiBHdWFyZHJhaWxDb250ZW50UG9saWN5Q29uZmlnO1xuXG4gIC8qKlxuICAgKiDjg4jjg5Tjg4Pjgq/jg53jg6rjgrfjg7zoqK3lrppcbiAgICovXG4gIHRvcGljUG9saWN5Q29uZmlnPzogR3VhcmRyYWlsVG9waWNQb2xpY3lDb25maWc7XG5cbiAgLyoqXG4gICAqIOapn+WvhuaDheWgse+8iFBJSe+8ieODneODquOCt+ODvOioreWumlxuICAgKi9cbiAgc2Vuc2l0aXZlSW5mb3JtYXRpb25Qb2xpY3lDb25maWc/OiBHdWFyZHJhaWxTZW5zaXRpdmVJbmZvcm1hdGlvblBvbGljeUNvbmZpZztcblxuICAvKipcbiAgICog44Ov44O844OJ44Od44Oq44K344O86Kit5a6aXG4gICAqL1xuICB3b3JkUG9saWN5Q29uZmlnPzogR3VhcmRyYWlsV29yZFBvbGljeUNvbmZpZztcblxuICAvKipcbiAgICog44OW44Ot44OD44Kv44GV44KM44Gf5YWl5Yqb44Oh44OD44K744O844K4XG4gICAqIEBkZWZhdWx0IFwi55Sz44GX6Kiz44GU44GW44GE44G+44Gb44KT44CC44GT44Gu5YaF5a6544Gv5Yem55CG44Gn44GN44G+44Gb44KT44CCXCJcbiAgICovXG4gIGJsb2NrZWRJbnB1dE1lc3NhZ2luZz86IHN0cmluZztcblxuICAvKipcbiAgICog44OW44Ot44OD44Kv44GV44KM44Gf5Ye65Yqb44Oh44OD44K744O844K4XG4gICAqIEBkZWZhdWx0IFwi55Sz44GX6Kiz44GU44GW44GE44G+44Gb44KT44CC44GT44Gu5Zue562U44Gv5o+Q5L6b44Gn44GN44G+44Gb44KT44CCXCJcbiAgICovXG4gIGJsb2NrZWRPdXRwdXRzTWVzc2FnaW5nPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEd1YXJkcmFpbENvbnRlbnRQb2xpY3lDb25maWcge1xuICAvKipcbiAgICog5pyJ5a6z44Kz44Oz44OG44Oz44OE44OV44Kj44Or44K/XG4gICAqL1xuICBmaWx0ZXJzQ29uZmlnOiBHdWFyZHJhaWxDb250ZW50RmlsdGVyW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgR3VhcmRyYWlsQ29udGVudEZpbHRlciB7XG4gIC8qKlxuICAgKiDjg5XjgqPjg6vjgr/jgr/jgqTjg5dcbiAgICogU0VYVUFMOiDmgKfnmoTjgrPjg7Pjg4bjg7Pjg4RcbiAgICogVklPTEVOQ0U6IOaatOWKm+eahOOCs+ODs+ODhuODs+ODhFxuICAgKiBIQVRFOiDjg5jjgqTjg4jjgrnjg5Tjg7zjg4FcbiAgICogSU5TVUxUUzog5L6u6L6x55qE44Kz44Oz44OG44Oz44OEXG4gICAqIE1JU0NPTkRVQ1Q6IOS4jeato+ihjOeCulxuICAgKiBQUk9NUFRfQVRUQUNLOiDjg5fjg63jg7Pjg5fjg4jjgqTjg7Pjgrjjgqfjgq/jgrfjg6fjg7PmlLvmkoNcbiAgICovXG4gIHR5cGU6ICdTRVhVQUwnIHwgJ1ZJT0xFTkNFJyB8ICdIQVRFJyB8ICdJTlNVTFRTJyB8ICdNSVNDT05EVUNUJyB8ICdQUk9NUFRfQVRUQUNLJztcblxuICAvKipcbiAgICog5YWl5Yqb44OV44Kj44Or44K/5by35bqmXG4gICAqIE5PTkU6IOODleOCo+ODq+OCv+OBquOBl1xuICAgKiBMT1c6IOS9jlxuICAgKiBNRURJVU06IOS4rVxuICAgKiBISUdIOiDpq5hcbiAgICovXG4gIGlucHV0U3RyZW5ndGg6ICdOT05FJyB8ICdMT1cnIHwgJ01FRElVTScgfCAnSElHSCc7XG5cbiAgLyoqXG4gICAqIOWHuuWKm+ODleOCo+ODq+OCv+W8t+W6plxuICAgKi9cbiAgb3V0cHV0U3RyZW5ndGg6ICdOT05FJyB8ICdMT1cnIHwgJ01FRElVTScgfCAnSElHSCc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgR3VhcmRyYWlsVG9waWNQb2xpY3lDb25maWcge1xuICAvKipcbiAgICog44OI44OU44OD44Kv6Kit5a6aXG4gICAqL1xuICB0b3BpY3NDb25maWc6IEd1YXJkcmFpbFRvcGljW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgR3VhcmRyYWlsVG9waWMge1xuICAvKipcbiAgICog44OI44OU44OD44Kv5ZCNXG4gICAqL1xuICBuYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIOODiOODlOODg+OCr+Wumue+qVxuICAgKi9cbiAgZGVmaW5pdGlvbjogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiDjg4jjg5Tjg4Pjgq/kvotcbiAgICovXG4gIGV4YW1wbGVzPzogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIOODiOODlOODg+OCr+OCv+OCpOODl1xuICAgKiBERU5ZOiDmi5LlkKZcbiAgICovXG4gIHR5cGU6ICdERU5ZJztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBHdWFyZHJhaWxTZW5zaXRpdmVJbmZvcm1hdGlvblBvbGljeUNvbmZpZyB7XG4gIC8qKlxuICAgKiBQSUnvvIjlgIvkurrorZjliKXmg4XloLHvvInjgqjjg7Pjg4bjgqPjg4bjgqPoqK3lrppcbiAgICovXG4gIHBpaUVudGl0aWVzQ29uZmlnPzogR3VhcmRyYWlsUGlpRW50aXR5W107XG5cbiAgLyoqXG4gICAqIOato+imj+ihqOePvuODkeOCv+ODvOODs+ioreWumlxuICAgKi9cbiAgcmVnZXhlc0NvbmZpZz86IEd1YXJkcmFpbFJlZ2V4W107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgR3VhcmRyYWlsUGlpRW50aXR5IHtcbiAgLyoqXG4gICAqIFBJSeOCqOODs+ODhuOCo+ODhuOCo+OCv+OCpOODl1xuICAgKiBBRERSRVNTOiDkvY/miYBcbiAgICogQUdFOiDlubTpvaJcbiAgICogQVdTX0FDQ0VTU19LRVk6IEFXU+OCouOCr+OCu+OCueOCreODvFxuICAgKiBBV1NfU0VDUkVUX0tFWTogQVdT44K344O844Kv44Os44OD44OI44Kt44O8XG4gICAqIENBX0hFQUxUSF9OVU1CRVI6IOOCq+ODiuODgOWBpeW6t+eVquWPt1xuICAgKiBDQV9TT0NJQUxfSU5TVVJBTkNFX05VTUJFUjog44Kr44OK44OA56S+5Lya5L+d6Zm655Wq5Y+3XG4gICAqIENSRURJVF9ERUJJVF9DQVJEX0NWVjog44Kv44Os44K444OD44OI44Kr44O844OJQ1ZWXG4gICAqIENSRURJVF9ERUJJVF9DQVJEX0VYUElSWTog44Kv44Os44K444OD44OI44Kr44O844OJ5pyJ5Yq55pyf6ZmQXG4gICAqIENSRURJVF9ERUJJVF9DQVJEX05VTUJFUjog44Kv44Os44K444OD44OI44Kr44O844OJ55Wq5Y+3XG4gICAqIERSSVZFUl9JRDog6YGL6Lui5YWN6Kix6Ki855Wq5Y+3XG4gICAqIEVNQUlMOiDjg6Hjg7zjg6vjgqLjg4njg6zjgrlcbiAgICogSU5URVJOQVRJT05BTF9CQU5LX0FDQ09VTlRfTlVNQkVSOiDlm73pmpvpioDooYzlj6Pluqfnlarlj7dcbiAgICogSVBfQUREUkVTUzogSVDjgqLjg4njg6zjgrlcbiAgICogTElDRU5TRV9QTEFURTog44OK44Oz44OQ44O844OX44Os44O844OIXG4gICAqIE1BQ19BRERSRVNTOiBNQUPjgqLjg4njg6zjgrlcbiAgICogTkFNRTog5rCP5ZCNXG4gICAqIFBBU1NXT1JEOiDjg5Hjgrnjg6/jg7zjg4lcbiAgICogUEhPTkU6IOmbu+ipseeVquWPt1xuICAgKiBQSU46IFBJTueVquWPt1xuICAgKiBTV0lGVF9DT0RFOiBTV0lGVOOCs+ODvOODiVxuICAgKiBVS19OQVRJT05BTF9IRUFMVEhfU0VSVklDRV9OVU1CRVI6IOiLseWbvU5IU+eVquWPt1xuICAgKiBVS19OQVRJT05BTF9JTlNVUkFOQ0VfTlVNQkVSOiDoi7Hlm73lm73msJHkv53pmbrnlarlj7dcbiAgICogVUtfVU5JUVVFX1RBWFBBWUVSX1JFRkVSRU5DRV9OVU1CRVI6IOiLseWbvee0jeeojuiAheeVquWPt1xuICAgKiBVUkw6IFVSTFxuICAgKiBVU0VSTkFNRTog44Om44O844K244O85ZCNXG4gICAqIFVTX0JBTktfQUNDT1VOVF9OVU1CRVI6IOexs+WbvemKgOihjOWPo+W6p+eVquWPt1xuICAgKiBVU19CQU5LX1JPVVRJTkdfTlVNQkVSOiDnsbPlm73pioDooYzjg6vjg7zjg4bjgqPjg7PjgrDnlarlj7dcbiAgICogVVNfSU5ESVZJRFVBTF9UQVhfSURFTlRJRklDQVRJT05fTlVNQkVSOiDnsbPlm73lgIvkurrntI3nqI7ogIXnlarlj7dcbiAgICogVVNfUEFTU1BPUlRfTlVNQkVSOiDnsbPlm73jg5Hjgrnjg53jg7zjg4jnlarlj7dcbiAgICogVVNfU09DSUFMX1NFQ1VSSVRZX05VTUJFUjog57Gz5Zu956S+5Lya5L+d6Zqc55Wq5Y+3XG4gICAqIFZFSElDTEVfSURFTlRJRklDQVRJT05fTlVNQkVSOiDou4rkuKHorZjliKXnlarlj7dcbiAgICovXG4gIHR5cGU6IHN0cmluZztcblxuICAvKipcbiAgICog44Ki44Kv44K344On44OzXG4gICAqIEJMT0NLOiDjg5bjg63jg4Pjgq9cbiAgICogQU5PTllNSVpFOiDljL/lkI3ljJZcbiAgICovXG4gIGFjdGlvbjogJ0JMT0NLJyB8ICdBTk9OWU1JWkUnO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEd1YXJkcmFpbFJlZ2V4IHtcbiAgLyoqXG4gICAqIOato+imj+ihqOePvuWQjVxuICAgKi9cbiAgbmFtZTogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiDmraPopo/ooajnj77jg5Hjgr/jg7zjg7NcbiAgICovXG4gIHBhdHRlcm46IHN0cmluZztcblxuICAvKipcbiAgICog6Kqs5piOXG4gICAqL1xuICBkZXNjcmlwdGlvbj86IHN0cmluZztcblxuICAvKipcbiAgICog44Ki44Kv44K344On44OzXG4gICAqL1xuICBhY3Rpb246ICdCTE9DSycgfCAnQU5PTllNSVpFJztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBHdWFyZHJhaWxXb3JkUG9saWN5Q29uZmlnIHtcbiAgLyoqXG4gICAqIOeuoeeQhuWvvuixoeODr+ODvOODieODquOCueODiOioreWumlxuICAgKi9cbiAgbWFuYWdlZFdvcmRMaXN0c0NvbmZpZz86IEd1YXJkcmFpbE1hbmFnZWRXb3JkTGlzdFtdO1xuXG4gIC8qKlxuICAgKiDjgqvjgrnjgr/jg6Djg6/jg7zjg4noqK3lrppcbiAgICovXG4gIHdvcmRzQ29uZmlnPzogR3VhcmRyYWlsV29yZFtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEd1YXJkcmFpbE1hbmFnZWRXb3JkTGlzdCB7XG4gIC8qKlxuICAgKiDnrqHnkIblr77osaHjg6/jg7zjg4njg6rjgrnjg4jjgr/jgqTjg5dcbiAgICogUFJPRkFOSVRZOiDlhpLmtpznmoTjgaroqIDokYlcbiAgICovXG4gIHR5cGU6ICdQUk9GQU5JVFknO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEd1YXJkcmFpbFdvcmQge1xuICAvKipcbiAgICog44OW44Ot44OD44Kv44GZ44KL44Ov44O844OJXG4gICAqL1xuICB0ZXh0OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBCZWRyb2NrR3VhcmRyYWlsc0NvbnN0cnVjdCBleHRlbmRzIENvbnN0cnVjdCB7XG4gIC8qKlxuICAgKiBCZWRyb2NrIEd1YXJkcmFpbFxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGd1YXJkcmFpbD86IGJlZHJvY2suQ2ZuR3VhcmRyYWlsO1xuXG4gIC8qKlxuICAgKiBHdWFyZHJhaWwgQVJOXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgZ3VhcmRyYWlsQXJuPzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBHdWFyZHJhaWwgSURcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBndWFyZHJhaWxJZD86IHN0cmluZztcblxuICAvKipcbiAgICogR3VhcmRyYWlsIFZlcnNpb25cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBndWFyZHJhaWxWZXJzaW9uPzogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBCZWRyb2NrR3VhcmRyYWlsc0NvbnN0cnVjdFByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIC8vIGVuYWJsZWTjg5Xjg6njgrDjgYxmYWxzZeOBruWgtOWQiOOAgeS9leOCguS9nOaIkOOBl+OBquOBhFxuICAgIGlmICghcHJvcHMuZW5hYmxlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEJlZHJvY2sgR3VhcmRyYWls5L2c5oiQXG4gICAgdGhpcy5ndWFyZHJhaWwgPSB0aGlzLmNyZWF0ZUd1YXJkcmFpbChwcm9wcyk7XG5cbiAgICAvLyBBUk7jg7tJROioreWumlxuICAgIHRoaXMuZ3VhcmRyYWlsQXJuID0gdGhpcy5ndWFyZHJhaWwuYXR0ckd1YXJkcmFpbEFybjtcbiAgICB0aGlzLmd1YXJkcmFpbElkID0gdGhpcy5ndWFyZHJhaWwuYXR0ckd1YXJkcmFpbElkO1xuICAgIHRoaXMuZ3VhcmRyYWlsVmVyc2lvbiA9IHRoaXMuZ3VhcmRyYWlsLmF0dHJWZXJzaW9uO1xuXG4gICAgLy8gQ2xvdWRGb3JtYXRpb27lh7rliptcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnR3VhcmRyYWlsQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuZ3VhcmRyYWlsQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdCZWRyb2NrIEd1YXJkcmFpbCBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWd1YXJkcmFpbC1hcm5gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0d1YXJkcmFpbElkJywge1xuICAgICAgdmFsdWU6IHRoaXMuZ3VhcmRyYWlsSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0JlZHJvY2sgR3VhcmRyYWlsIElEJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1ndWFyZHJhaWwtaWRgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0d1YXJkcmFpbFZlcnNpb24nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5ndWFyZHJhaWxWZXJzaW9uLFxuICAgICAgZGVzY3JpcHRpb246ICdCZWRyb2NrIEd1YXJkcmFpbCBWZXJzaW9uJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1ndWFyZHJhaWwtdmVyc2lvbmAsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQmVkcm9jayBHdWFyZHJhaWzkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlR3VhcmRyYWlsKHByb3BzOiBCZWRyb2NrR3VhcmRyYWlsc0NvbnN0cnVjdFByb3BzKTogYmVkcm9jay5DZm5HdWFyZHJhaWwge1xuICAgIGNvbnN0IGd1YXJkcmFpbCA9IG5ldyBiZWRyb2NrLkNmbkd1YXJkcmFpbCh0aGlzLCAnR3VhcmRyYWlsJywge1xuICAgICAgbmFtZTogcHJvcHMuZ3VhcmRyYWlsTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiBwcm9wcy5kZXNjcmlwdGlvbixcbiAgICAgIGJsb2NrZWRJbnB1dE1lc3NhZ2luZzpcbiAgICAgICAgcHJvcHMuYmxvY2tlZElucHV0TWVzc2FnaW5nIHx8ICfnlLPjgZfoqLPjgZTjgZbjgYTjgb7jgZvjgpPjgILjgZPjga7lhoXlrrnjga/lh6bnkIbjgafjgY3jgb7jgZvjgpPjgIInLFxuICAgICAgYmxvY2tlZE91dHB1dHNNZXNzYWdpbmc6XG4gICAgICAgIHByb3BzLmJsb2NrZWRPdXRwdXRzTWVzc2FnaW5nIHx8ICfnlLPjgZfoqLPjgZTjgZbjgYTjgb7jgZvjgpPjgILjgZPjga7lm57nrZTjga/mj5DkvpvjgafjgY3jgb7jgZvjgpPjgIInLFxuICAgIH0pO1xuXG4gICAgLy8g44Kz44Oz44OG44Oz44OE44Od44Oq44K344O86Kit5a6aXG4gICAgaWYgKHByb3BzLmNvbnRlbnRQb2xpY3lDb25maWcpIHtcbiAgICAgIGd1YXJkcmFpbC5jb250ZW50UG9saWN5Q29uZmlnID0ge1xuICAgICAgICBmaWx0ZXJzQ29uZmlnOiBwcm9wcy5jb250ZW50UG9saWN5Q29uZmlnLmZpbHRlcnNDb25maWcubWFwKChmaWx0ZXIpID0+ICh7XG4gICAgICAgICAgdHlwZTogZmlsdGVyLnR5cGUsXG4gICAgICAgICAgaW5wdXRTdHJlbmd0aDogZmlsdGVyLmlucHV0U3RyZW5ndGgsXG4gICAgICAgICAgb3V0cHV0U3RyZW5ndGg6IGZpbHRlci5vdXRwdXRTdHJlbmd0aCxcbiAgICAgICAgfSkpLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyDjg4jjg5Tjg4Pjgq/jg53jg6rjgrfjg7zoqK3lrppcbiAgICBpZiAocHJvcHMudG9waWNQb2xpY3lDb25maWcpIHtcbiAgICAgIGd1YXJkcmFpbC50b3BpY1BvbGljeUNvbmZpZyA9IHtcbiAgICAgICAgdG9waWNzQ29uZmlnOiBwcm9wcy50b3BpY1BvbGljeUNvbmZpZy50b3BpY3NDb25maWcubWFwKCh0b3BpYykgPT4gKHtcbiAgICAgICAgICBuYW1lOiB0b3BpYy5uYW1lLFxuICAgICAgICAgIGRlZmluaXRpb246IHRvcGljLmRlZmluaXRpb24sXG4gICAgICAgICAgZXhhbXBsZXM6IHRvcGljLmV4YW1wbGVzLFxuICAgICAgICAgIHR5cGU6IHRvcGljLnR5cGUsXG4gICAgICAgIH0pKSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8g5qmf5a+G5oOF5aCx44Od44Oq44K344O86Kit5a6aXG4gICAgaWYgKHByb3BzLnNlbnNpdGl2ZUluZm9ybWF0aW9uUG9saWN5Q29uZmlnKSB7XG4gICAgICBjb25zdCBzZW5zaXRpdmVJbmZvQ29uZmlnOiBhbnkgPSB7fTtcblxuICAgICAgaWYgKHByb3BzLnNlbnNpdGl2ZUluZm9ybWF0aW9uUG9saWN5Q29uZmlnLnBpaUVudGl0aWVzQ29uZmlnKSB7XG4gICAgICAgIHNlbnNpdGl2ZUluZm9Db25maWcucGlpRW50aXRpZXNDb25maWcgPVxuICAgICAgICAgIHByb3BzLnNlbnNpdGl2ZUluZm9ybWF0aW9uUG9saWN5Q29uZmlnLnBpaUVudGl0aWVzQ29uZmlnLm1hcCgoZW50aXR5KSA9PiAoe1xuICAgICAgICAgICAgdHlwZTogZW50aXR5LnR5cGUsXG4gICAgICAgICAgICBhY3Rpb246IGVudGl0eS5hY3Rpb24sXG4gICAgICAgICAgfSkpO1xuICAgICAgfVxuXG4gICAgICBpZiAocHJvcHMuc2Vuc2l0aXZlSW5mb3JtYXRpb25Qb2xpY3lDb25maWcucmVnZXhlc0NvbmZpZykge1xuICAgICAgICBzZW5zaXRpdmVJbmZvQ29uZmlnLnJlZ2V4ZXNDb25maWcgPVxuICAgICAgICAgIHByb3BzLnNlbnNpdGl2ZUluZm9ybWF0aW9uUG9saWN5Q29uZmlnLnJlZ2V4ZXNDb25maWcubWFwKChyZWdleCkgPT4gKHtcbiAgICAgICAgICAgIG5hbWU6IHJlZ2V4Lm5hbWUsXG4gICAgICAgICAgICBwYXR0ZXJuOiByZWdleC5wYXR0ZXJuLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IHJlZ2V4LmRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgYWN0aW9uOiByZWdleC5hY3Rpb24sXG4gICAgICAgICAgfSkpO1xuICAgICAgfVxuXG4gICAgICBndWFyZHJhaWwuc2Vuc2l0aXZlSW5mb3JtYXRpb25Qb2xpY3lDb25maWcgPSBzZW5zaXRpdmVJbmZvQ29uZmlnO1xuICAgIH1cblxuICAgIC8vIOODr+ODvOODieODneODquOCt+ODvOioreWumlxuICAgIGlmIChwcm9wcy53b3JkUG9saWN5Q29uZmlnKSB7XG4gICAgICBjb25zdCB3b3JkQ29uZmlnOiBhbnkgPSB7fTtcblxuICAgICAgaWYgKHByb3BzLndvcmRQb2xpY3lDb25maWcubWFuYWdlZFdvcmRMaXN0c0NvbmZpZykge1xuICAgICAgICB3b3JkQ29uZmlnLm1hbmFnZWRXb3JkTGlzdHNDb25maWcgPVxuICAgICAgICAgIHByb3BzLndvcmRQb2xpY3lDb25maWcubWFuYWdlZFdvcmRMaXN0c0NvbmZpZy5tYXAoKGxpc3QpID0+ICh7XG4gICAgICAgICAgICB0eXBlOiBsaXN0LnR5cGUsXG4gICAgICAgICAgfSkpO1xuICAgICAgfVxuXG4gICAgICBpZiAocHJvcHMud29yZFBvbGljeUNvbmZpZy53b3Jkc0NvbmZpZykge1xuICAgICAgICB3b3JkQ29uZmlnLndvcmRzQ29uZmlnID0gcHJvcHMud29yZFBvbGljeUNvbmZpZy53b3Jkc0NvbmZpZy5tYXAoXG4gICAgICAgICAgKHdvcmQpID0+ICh7XG4gICAgICAgICAgICB0ZXh0OiB3b3JkLnRleHQsXG4gICAgICAgICAgfSlcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgZ3VhcmRyYWlsLndvcmRQb2xpY3lDb25maWcgPSB3b3JkQ29uZmlnO1xuICAgIH1cblxuICAgIHJldHVybiBndWFyZHJhaWw7XG4gIH1cbn1cbiJdfQ==