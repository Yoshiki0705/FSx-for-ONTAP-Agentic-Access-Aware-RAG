"use strict";
/**
 * Bedrock Agentコンストラクト
 * 権限認識型RAGシステムのためのBedrock Agent統合
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
exports.BedrockAgentConstruct = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const bedrock = __importStar(require("aws-cdk-lib/aws-bedrock"));
const constructs_1 = require("constructs");
const aws_cdk_lib_1 = require("aws-cdk-lib");
class BedrockAgentConstruct extends constructs_1.Construct {
    /**
     * Bedrock Agent
     */
    agent;
    /**
     * Agent Alias
     */
    agentAlias;
    /**
     * Agent IAMロール
     */
    agentRole;
    /**
     * Agent ARN
     */
    agentArn;
    /**
     * Agent Alias ARN
     */
    agentAliasArn;
    constructor(scope, id, props) {
        super(scope, id);
        // enabledフラグがfalseの場合、何も作成しない
        if (!props.enabled) {
            return;
        }
        // Agent IAMロール作成
        this.agentRole = this.createAgentRole(props);
        // Bedrock Agent作成
        this.agent = this.createAgent(props);
        // Agent Alias作成
        this.agentAlias = this.createAgentAlias(props);
        // ARN設定
        this.agentArn = this.agent.attrAgentArn;
        this.agentAliasArn = this.agentAlias.attrAgentAliasArn;
        // CloudFormation出力
        new cdk.CfnOutput(this, 'AgentArn', {
            value: this.agentArn,
            description: 'Bedrock Agent ARN',
            exportName: `${props.projectName}-${props.environment}-agent-arn`,
        });
        new cdk.CfnOutput(this, 'AgentAliasArn', {
            value: this.agentAliasArn,
            description: 'Bedrock Agent Alias ARN',
            exportName: `${props.projectName}-${props.environment}-agent-alias-arn`,
        });
    }
    /**
     * Agent IAMロール作成
     */
    createAgentRole(props) {
        const role = new iam.Role(this, 'AgentRole', {
            roleName: `${props.projectName}-${props.environment}-bedrock-agent-role`,
            assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
            description: 'IAM role for Bedrock Agent',
        });
        // Bedrock基本権限
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
            ],
            resources: [
                `arn:aws:bedrock:${cdk.Stack.of(this).region}::foundation-model/${props.foundationModel || 'anthropic.claude-3-5-sonnet-20240620-v1:0'}`,
            ],
        }));
        // Bedrock Agent Runtime権限（今回の修正で追加）
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock-agent-runtime:InvokeAgent',
                'bedrock-agent-runtime:Retrieve',
            ],
            resources: ['*'], // Agent ARNは作成後に決まるため、ワイルドカードを使用
        }));
        // Bedrock Agent管理権限（Agent Info API用 - 2025-12-12修正）
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                // Agent情報取得に必要な権限（bedrock名前空間）
                'bedrock:GetAgent',
                'bedrock:ListAgentAliases',
                'bedrock:GetAgentAlias',
                'bedrock:UpdateAgent',
                'bedrock:PrepareAgent',
                // 従来のbedrock-agent権限も維持（互換性のため）
                'bedrock-agent:GetAgent',
                'bedrock-agent:ListAgents',
                'bedrock-agent:UpdateAgent',
                'bedrock-agent:PrepareAgent',
            ],
            resources: ['*'],
        }));
        // IAM PassRole権限（Bedrock Agent更新時に必要）
        role.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'iam:PassRole',
            ],
            resources: [
                `arn:aws:iam::${aws_cdk_lib_1.Stack.of(this).account}:role/*bedrock-agent-role*`,
            ],
        }));
        // Knowledge Base権限（指定されている場合）
        if (props.knowledgeBaseArn) {
            role.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['bedrock:Retrieve', 'bedrock:RetrieveAndGenerate'],
                resources: [props.knowledgeBaseArn],
            }));
        }
        // Action Groups Lambda実行権限（指定されている場合）
        if (props.actionGroups && props.actionGroups.length > 0) {
            const lambdaArns = props.actionGroups.map((ag) => ag.actionGroupExecutor);
            role.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ['lambda:InvokeFunction'],
                resources: lambdaArns,
            }));
        }
        return role;
    }
    /**
     * Bedrock Agent作成
     */
    createAgent(props) {
        const agentConfig = {
            agentName: props.agentName,
            agentResourceRoleArn: this.agentRole.roleArn,
            foundationModel: props.foundationModel || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
            instruction: props.instruction,
            description: props.agentDescription,
            idleSessionTtlInSeconds: props.idleSessionTTLInSeconds || 600,
        };
        // Guardrails設定（Phase 5 - SecurityStackから取得）
        if (props.guardrailArn) {
            agentConfig.guardrailConfiguration = {
                guardrailIdentifier: props.guardrailArn,
                guardrailVersion: props.guardrailVersion || 'DRAFT',
            };
        }
        const agent = new bedrock.CfnAgent(this, 'Agent', agentConfig);
        // Knowledge Base関連付け（指定されている場合）
        if (props.knowledgeBaseArn) {
            agent.knowledgeBases = [
                {
                    knowledgeBaseId: this.extractKnowledgeBaseId(props.knowledgeBaseArn),
                    description: 'Permission-aware RAG Knowledge Base',
                    knowledgeBaseState: 'ENABLED',
                },
            ];
        }
        // Action Groups設定（指定されている場合）
        if (props.actionGroups && props.actionGroups.length > 0) {
            agent.actionGroups = props.actionGroups.map((ag) => ({
                actionGroupName: ag.actionGroupName,
                description: ag.description,
                actionGroupExecutor: {
                    lambda: ag.actionGroupExecutor,
                },
                apiSchema: ag.apiSchema.s3BucketName
                    ? {
                        s3: {
                            s3BucketName: ag.apiSchema.s3BucketName,
                            s3ObjectKey: ag.apiSchema.s3ObjectKey,
                        },
                    }
                    : {
                        payload: ag.apiSchema.payload,
                    },
            }));
        }
        return agent;
    }
    /**
     * Agent Alias作成
     */
    createAgentAlias(props) {
        return new bedrock.CfnAgentAlias(this, 'AgentAlias', {
            agentId: this.agent.attrAgentId,
            agentAliasName: `${props.environment}-alias`,
            description: `${props.environment} environment alias`,
        });
    }
    /**
     * Knowledge Base ARNからIDを抽出
     */
    extractKnowledgeBaseId(arn) {
        // ARN形式: arn:aws:bedrock:{region}:{account}:knowledge-base/{id}
        const parts = arn.split('/');
        return parts[parts.length - 1];
    }
}
exports.BedrockAgentConstruct = BedrockAgentConstruct;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVkcm9jay1hZ2VudC1jb25zdHJ1Y3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJiZWRyb2NrLWFnZW50LWNvbnN0cnVjdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlEQUFtQztBQUNuQyx5REFBMkM7QUFDM0MsaUVBQW1EO0FBQ25ELDJDQUF1QztBQUN2Qyw2Q0FBb0M7QUEwR3BDLE1BQWEscUJBQXNCLFNBQVEsc0JBQVM7SUFDbEQ7O09BRUc7SUFDYSxLQUFLLENBQW9CO0lBRXpDOztPQUVHO0lBQ2EsVUFBVSxDQUF5QjtJQUVuRDs7T0FFRztJQUNhLFNBQVMsQ0FBWTtJQUVyQzs7T0FFRztJQUNhLFFBQVEsQ0FBVTtJQUVsQzs7T0FFRztJQUNhLGFBQWEsQ0FBVTtJQUV2QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQWlDO1FBQ3pFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsOEJBQThCO1FBQzlCLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDbkIsT0FBTztRQUNULENBQUM7UUFFRCxpQkFBaUI7UUFDakIsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRTdDLGtCQUFrQjtRQUNsQixJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFckMsZ0JBQWdCO1FBQ2hCLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRS9DLFFBQVE7UUFDUixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDO1FBQ3hDLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxpQkFBaUIsQ0FBQztR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QUFXO3lCQUN0QztxQkFDRjtvQkFDSCxDQUFDLENBQUM7d0JBQ0UsT0FBTyxFQUFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsT0FBTztxQkFDOUI7YUFDTixDQUFDLENBQUMsQ0FBQztRQUNOLENBQUM7UUFFRCxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7SUFFRDs7T0FFRztJQUNLLGdCQUFnQixDQUFDLEtBQWlDO1FBQ3hELE9BQU8sSUFBSSxPQUFPLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDbkQsT0FBTyxFQUFFLElBQUksQ0FBQyxLQUFNLENBQUMsV0FBVztZQUNoQyxjQUFjLEVBQUUsR0FBRyxLQUFLLENBQUMsV0FBVyxRQUFRO1lBQzVDLFdBQVcsRUFBRSxHQUFHLEtBQUssQ0FBQyxXQUFXLG9CQUFvQjtTQUN0RCxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSyxzQkFBc0IsQ0FBQyxHQUFXO1FBQ3hDLGdFQUFnRTtRQUNoRSxNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzdCLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDakMsQ0FBQztDQUNGO0FBNU9ELHNEQTRPQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQmVkcm9jayBBZ2VudOOCs+ODs+OCueODiOODqeOCr+ODiFxuICog5qip6ZmQ6KqN6K2Y5Z6LUkFH44K344K544OG44Og44Gu44Gf44KB44GuQmVkcm9jayBBZ2VudOe1seWQiFxuICovXG5cbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBiZWRyb2NrIGZyb20gJ2F3cy1jZGstbGliL2F3cy1iZWRyb2NrJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgU3RhY2sgfSBmcm9tICdhd3MtY2RrLWxpYic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQmVkcm9ja0FnZW50Q29uc3RydWN0UHJvcHMge1xuICAvKipcbiAgICogQmVkcm9jayBBZ2VudOOCkuacieWKueWMluOBmeOCi+OBi1xuICAgKiBAZGVmYXVsdCBmYWxzZVxuICAgKi9cbiAgZW5hYmxlZD86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIOODl+ODreOCuOOCp+OCr+ODiOWQjVxuICAgKi9cbiAgcHJvamVjdE5hbWU6IHN0cmluZztcblxuICAvKipcbiAgICog55Kw5aKD5ZCNXG4gICAqL1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBBZ2VudOWQjVxuICAgKi9cbiAgYWdlbnROYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIEFnZW506Kqs5piOXG4gICAqL1xuICBhZ2VudERlc2NyaXB0aW9uPzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiDln7rnm6Tjg6Ljg4fjg6tJRFxuICAgKiBAZGVmYXVsdCBhbnRocm9waWMuY2xhdWRlLTMtNS1zb25uZXQtMjAyNDA2MjAtdjE6MFxuICAgKi9cbiAgZm91bmRhdGlvbk1vZGVsPzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBBZ2VudCBJbnN0cnVjdGlvbu+8iOODl+ODreODs+ODl+ODiO+8iVxuICAgKi9cbiAgaW5zdHJ1Y3Rpb246IHN0cmluZztcblxuICAvKipcbiAgICogS25vd2xlZGdlIEJhc2UgQVJO77yI44Kq44OX44K344On44Oz77yJXG4gICAqL1xuICBrbm93bGVkZ2VCYXNlQXJuPzogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBBY3Rpb24gR3JvdXBz77yI44Kq44OX44K344On44Oz77yJXG4gICAqL1xuICBhY3Rpb25Hcm91cHM/OiBCZWRyb2NrQWdlbnRBY3Rpb25Hcm91cFtdO1xuXG4gIC8qKlxuICAgKiDjgqLjgqTjg4njg6vjgrvjg4Pjgrfjg6fjg7Pjgr/jgqTjg6DjgqLjgqbjg4jvvIjnp5LvvIlcbiAgICogQGRlZmF1bHQgNjAwXG4gICAqL1xuICBpZGxlU2Vzc2lvblRUTEluU2Vjb25kcz86IG51bWJlcjtcblxuICAvKipcbiAgICogR3VhcmRyYWlsIEFSTu+8iOOCquODl+OCt+ODp+ODsyAtIFBoYXNlIDXvvIlcbiAgICogU2VjdXJpdHlTdGFja+OBi+OCieWPluW+l+OBl+OBn0d1YXJkcmFpbCBBUk7jgpLmjIflrppcbiAgICovXG4gIGd1YXJkcmFpbEFybj86IHN0cmluZztcblxuICAvKipcbiAgICogR3VhcmRyYWlsIFZlcnNpb27vvIjjgqrjg5fjgrfjg6fjg7MgLSBQaGFzZSA177yJXG4gICAqIEBkZWZhdWx0IERSQUZUXG4gICAqL1xuICBndWFyZHJhaWxWZXJzaW9uPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEJlZHJvY2tBZ2VudEFjdGlvbkdyb3VwIHtcbiAgLyoqXG4gICAqIEFjdGlvbiBHcm91cOWQjVxuICAgKi9cbiAgYWN0aW9uR3JvdXBOYW1lOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIEFjdGlvbiBHcm91cOiqrOaYjlxuICAgKi9cbiAgZGVzY3JpcHRpb24/OiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIExhbWJkYemWouaVsEFSTlxuICAgKi9cbiAgYWN0aW9uR3JvdXBFeGVjdXRvcjogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBPcGVuQVBJIDMuMOOCueOCreODvOODnu+8iFMz44OR44K544G+44Gf44Gv44Kk44Oz44Op44Kk44Oz44K544Kt44O844Oe77yJXG4gICAqL1xuICBhcGlTY2hlbWE6IHtcbiAgICAvKipcbiAgICAgKiBTM+ODkOOCseODg+ODiOWQjVxuICAgICAqL1xuICAgIHMzQnVja2V0TmFtZT86IHN0cmluZztcblxuICAgIC8qKlxuICAgICAqIFMz44Kq44OW44K444Kn44Kv44OI44Kt44O8XG4gICAgICovXG4gICAgczNPYmplY3RLZXk/OiBzdHJpbmc7XG5cbiAgICAvKipcbiAgICAgKiDjgqTjg7Pjg6njgqTjg7Pjgrnjgq3jg7zjg57vvIhKU09O5paH5a2X5YiX77yJXG4gICAgICovXG4gICAgcGF5bG9hZD86IHN0cmluZztcbiAgfTtcbn1cblxuZXhwb3J0IGNsYXNzIEJlZHJvY2tBZ2VudENvbnN0cnVjdCBleHRlbmRzIENvbnN0cnVjdCB7XG4gIC8qKlxuICAgKiBCZWRyb2NrIEFnZW50XG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgYWdlbnQ/OiBiZWRyb2NrLkNmbkFnZW50O1xuXG4gIC8qKlxuICAgKiBBZ2VudCBBbGlhc1xuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGFnZW50QWxpYXM/OiBiZWRyb2NrLkNmbkFnZW50QWxpYXM7XG5cbiAgLyoqXG4gICAqIEFnZW50IElBTeODreODvOODq1xuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGFnZW50Um9sZT86IGlhbS5Sb2xlO1xuXG4gIC8qKlxuICAgKiBBZ2VudCBBUk5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBhZ2VudEFybj86IHN0cmluZztcblxuICAvKipcbiAgICogQWdlbnQgQWxpYXMgQVJOXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgYWdlbnRBbGlhc0Fybj86IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQmVkcm9ja0FnZW50Q29uc3RydWN0UHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgLy8gZW5hYmxlZOODleODqeOCsOOBjGZhbHNl44Gu5aC05ZCI44CB5L2V44KC5L2c5oiQ44GX44Gq44GEXG4gICAgaWYgKCFwcm9wcy5lbmFibGVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gQWdlbnQgSUFN44Ot44O844Or5L2c5oiQXG4gICAgdGhpcy5hZ2VudFJvbGUgPSB0aGlzLmNyZWF0ZUFnZW50Um9sZShwcm9wcyk7XG5cbiAgICAvLyBCZWRyb2NrIEFnZW505L2c5oiQXG4gICAgdGhpcy5hZ2VudCA9IHRoaXMuY3JlYXRlQWdlbnQocHJvcHMpO1xuXG4gICAgLy8gQWdlbnQgQWxpYXPkvZzmiJBcbiAgICB0aGlzLmFnZW50QWxpYXMgPSB0aGlzLmNyZWF0ZUFnZW50QWxpYXMocHJvcHMpO1xuXG4gICAgLy8gQVJO6Kit5a6aXG4gICAgdGhpcy5hZ2VudEFybiA9IHRoaXMuYWdlbnQuYXR0ckFnZW50QXJuO1xuICAgIHRoaXMuYWdlbnRBbGlhc0FybiA9IHRoaXMuYWdlbnRBbGlhcy5hdHRyQWdlbnRBbGlhc0FybjtcblxuICAgIC8vIENsb3VkRm9ybWF0aW9u5Ye65YqbXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50QXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuYWdlbnRBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0JlZHJvY2sgQWdlbnQgQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3Byb3BzLnByb2plY3ROYW1lfS0ke3Byb3BzLmVudmlyb25tZW50fS1hZ2VudC1hcm5gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FnZW50QWxpYXNBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hZ2VudEFsaWFzQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdCZWRyb2NrIEFnZW50IEFsaWFzIEFSTicsXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9wcy5wcm9qZWN0TmFtZX0tJHtwcm9wcy5lbnZpcm9ubWVudH0tYWdlbnQtYWxpYXMtYXJuYCxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZ2VudCBJQU3jg63jg7zjg6vkvZzmiJBcbiAgICovXG4gIHByaXZhdGUgY3JlYXRlQWdlbnRSb2xlKHByb3BzOiBCZWRyb2NrQWdlbnRDb25zdHJ1Y3RQcm9wcyk6IGlhbS5Sb2xlIHtcbiAgICBjb25zdCByb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdBZ2VudFJvbGUnLCB7XG4gICAgICByb2xlTmFtZTogYCR7cHJvcHMucHJvamVjdE5hbWV9LSR7cHJvcHMuZW52aXJvbm1lbnR9LWJlZHJvY2stYWdlbnQtcm9sZWAsXG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnYmVkcm9jay5hbWF6b25hd3MuY29tJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ0lBTSByb2xlIGZvciBCZWRyb2NrIEFnZW50JyxcbiAgICB9KTtcblxuICAgIC8vIEJlZHJvY2vln7rmnKzmqKnpmZBcbiAgICByb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbCcsXG4gICAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWxXaXRoUmVzcG9uc2VTdHJlYW0nLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICBgYXJuOmF3czpiZWRyb2NrOiR7Y2RrLlN0YWNrLm9mKHRoaXMpLnJlZ2lvbn06OmZvdW5kYXRpb24tbW9kZWwvJHtcbiAgICAgICAgICAgIHByb3BzLmZvdW5kYXRpb25Nb2RlbCB8fCAnYW50aHJvcGljLmNsYXVkZS0zLTUtc29ubmV0LTIwMjQwNjIwLXYxOjAnXG4gICAgICAgICAgfWAsXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBCZWRyb2NrIEFnZW50IFJ1bnRpbWXmqKnpmZDvvIjku4rlm57jga7kv67mraPjgafov73liqDvvIlcbiAgICByb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnYmVkcm9jay1hZ2VudC1ydW50aW1lOkludm9rZUFnZW50JyxcbiAgICAgICAgICAnYmVkcm9jay1hZ2VudC1ydW50aW1lOlJldHJpZXZlJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbJyonXSwgLy8gQWdlbnQgQVJO44Gv5L2c5oiQ5b6M44Gr5rG644G+44KL44Gf44KB44CB44Ov44Kk44Or44OJ44Kr44O844OJ44KS5L2/55SoXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBCZWRyb2NrIEFnZW50566h55CG5qip6ZmQ77yIQWdlbnQgSW5mbyBBUEnnlKggLSAyMDI1LTEyLTEy5L+u5q2j77yJXG4gICAgcm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgLy8gQWdlbnTmg4XloLHlj5blvpfjgavlv4XopoHjgarmqKnpmZDvvIhiZWRyb2Nr5ZCN5YmN56m66ZaT77yJXG4gICAgICAgICAgJ2JlZHJvY2s6R2V0QWdlbnQnLFxuICAgICAgICAgICdiZWRyb2NrOkxpc3RBZ2VudEFsaWFzZXMnLFxuICAgICAgICAgICdiZWRyb2NrOkdldEFnZW50QWxpYXMnLFxuICAgICAgICAgICAgJ2JlZHJvY2s6VXBkYXRlQWdlbnQnLFxuICAgICAgICAgICAgJ2JlZHJvY2s6UHJlcGFyZUFnZW50JyxcbiAgICAgICAgICAvLyDlvpPmnaXjga5iZWRyb2NrLWFnZW505qip6ZmQ44KC57at5oyB77yI5LqS5o+b5oCn44Gu44Gf44KB77yJXG4gICAgICAgICAgJ2JlZHJvY2stYWdlbnQ6R2V0QWdlbnQnLFxuICAgICAgICAgICdiZWRyb2NrLWFnZW50Okxpc3RBZ2VudHMnLFxuICAgICAgICAgICdiZWRyb2NrLWFnZW50OlVwZGF0ZUFnZW50JyxcbiAgICAgICAgICAnYmVkcm9jay1hZ2VudDpQcmVwYXJlQWdlbnQnLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gSUFNIFBhc3NSb2xl5qip6ZmQ77yIQmVkcm9jayBBZ2VudOabtOaWsOaZguOBq+W/heimge+8iVxuICAgIHJvbGUuYWRkVG9Qb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICdpYW06UGFzc1JvbGUnLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICBgYXJuOmF3czppYW06OiR7U3RhY2sub2YodGhpcykuYWNjb3VudH06cm9sZS8qYmVkcm9jay1hZ2VudC1yb2xlKmAsXG4gICAgICAgIF0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBLbm93bGVkZ2UgQmFzZeaoqemZkO+8iOaMh+WumuOBleOCjOOBpuOBhOOCi+WgtOWQiO+8iVxuICAgIGlmIChwcm9wcy5rbm93bGVkZ2VCYXNlQXJuKSB7XG4gICAgICByb2xlLmFkZFRvUG9saWN5KFxuICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgIGFjdGlvbnM6IFsnYmVkcm9jazpSZXRyaWV2ZScsICdiZWRyb2NrOlJldHJpZXZlQW5kR2VuZXJhdGUnXSxcbiAgICAgICAgICByZXNvdXJjZXM6IFtwcm9wcy5rbm93bGVkZ2VCYXNlQXJuXSxcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gQWN0aW9uIEdyb3VwcyBMYW1iZGHlrp/ooYzmqKnpmZDvvIjmjIflrprjgZXjgozjgabjgYTjgovloLTlkIjvvIlcbiAgICBpZiAocHJvcHMuYWN0aW9uR3JvdXBzICYmIHByb3BzLmFjdGlvbkdyb3Vwcy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCBsYW1iZGFBcm5zID0gcHJvcHMuYWN0aW9uR3JvdXBzLm1hcCgoYWcpID0+IGFnLmFjdGlvbkdyb3VwRXhlY3V0b3IpO1xuICAgICAgcm9sZS5hZGRUb1BvbGljeShcbiAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICBhY3Rpb25zOiBbJ2xhbWJkYTpJbnZva2VGdW5jdGlvbiddLFxuICAgICAgICAgIHJlc291cmNlczogbGFtYmRhQXJucyxcbiAgICAgICAgfSlcbiAgICAgICk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJvbGU7XG4gIH1cblxuICAvKipcbiAgICogQmVkcm9jayBBZ2VudOS9nOaIkFxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVBZ2VudChwcm9wczogQmVkcm9ja0FnZW50Q29uc3RydWN0UHJvcHMpOiBiZWRyb2NrLkNmbkFnZW50IHtcbiAgICBjb25zdCBhZ2VudENvbmZpZzogYW55ID0ge1xuICAgICAgYWdlbnROYW1lOiBwcm9wcy5hZ2VudE5hbWUsXG4gICAgICBhZ2VudFJlc291cmNlUm9sZUFybjogdGhpcy5hZ2VudFJvbGUhLnJvbGVBcm4sXG4gICAgICBmb3VuZGF0aW9uTW9kZWw6IHByb3BzLmZvdW5kYXRpb25Nb2RlbCB8fCAnYW50aHJvcGljLmNsYXVkZS0zLTUtc29ubmV0LTIwMjQwNjIwLXYxOjAnLFxuICAgICAgaW5zdHJ1Y3Rpb246IHByb3BzLmluc3RydWN0aW9uLFxuICAgICAgZGVzY3JpcHRpb246IHByb3BzLmFnZW50RGVzY3JpcHRpb24sXG4gICAgICBpZGxlU2Vzc2lvblR0bEluU2Vjb25kczogcHJvcHMuaWRsZVNlc3Npb25UVExJblNlY29uZHMgfHwgNjAwLFxuICAgIH07XG5cbiAgICAvLyBHdWFyZHJhaWxz6Kit5a6a77yIUGhhc2UgNSAtIFNlY3VyaXR5U3RhY2vjgYvjgonlj5blvpfvvIlcbiAgICBpZiAocHJvcHMuZ3VhcmRyYWlsQXJuKSB7XG4gICAgICBhZ2VudENvbmZpZy5ndWFyZHJhaWxDb25maWd1cmF0aW9uID0ge1xuICAgICAgICBndWFyZHJhaWxJZGVudGlmaWVyOiBwcm9wcy5ndWFyZHJhaWxBcm4sXG4gICAgICAgIGd1YXJkcmFpbFZlcnNpb246IHByb3BzLmd1YXJkcmFpbFZlcnNpb24gfHwgJ0RSQUZUJyxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgY29uc3QgYWdlbnQgPSBuZXcgYmVkcm9jay5DZm5BZ2VudCh0aGlzLCAnQWdlbnQnLCBhZ2VudENvbmZpZyk7XG5cbiAgICAvLyBLbm93bGVkZ2UgQmFzZemWoumAo+S7mOOBke+8iOaMh+WumuOBleOCjOOBpuOBhOOCi+WgtOWQiO+8iVxuICAgIGlmIChwcm9wcy5rbm93bGVkZ2VCYXNlQXJuKSB7XG4gICAgICBhZ2VudC5rbm93bGVkZ2VCYXNlcyA9IFtcbiAgICAgICAge1xuICAgICAgICAgIGtub3dsZWRnZUJhc2VJZDogdGhpcy5leHRyYWN0S25vd2xlZGdlQmFzZUlkKHByb3BzLmtub3dsZWRnZUJhc2VBcm4pLFxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUGVybWlzc2lvbi1hd2FyZSBSQUcgS25vd2xlZGdlIEJhc2UnLFxuICAgICAgICAgIGtub3dsZWRnZUJhc2VTdGF0ZTogJ0VOQUJMRUQnLFxuICAgICAgICB9LFxuICAgICAgXTtcbiAgICB9XG5cbiAgICAvLyBBY3Rpb24gR3JvdXBz6Kit5a6a77yI5oyH5a6a44GV44KM44Gm44GE44KL5aC05ZCI77yJXG4gICAgaWYgKHByb3BzLmFjdGlvbkdyb3VwcyAmJiBwcm9wcy5hY3Rpb25Hcm91cHMubGVuZ3RoID4gMCkge1xuICAgICAgYWdlbnQuYWN0aW9uR3JvdXBzID0gcHJvcHMuYWN0aW9uR3JvdXBzLm1hcCgoYWcpID0+ICh7XG4gICAgICAgIGFjdGlvbkdyb3VwTmFtZTogYWcuYWN0aW9uR3JvdXBOYW1lLFxuICAgICAgICBkZXNjcmlwdGlvbjogYWcuZGVzY3JpcHRpb24sXG4gICAgICAgIGFjdGlvbkdyb3VwRXhlY3V0b3I6IHtcbiAgICAgICAgICBsYW1iZGE6IGFnLmFjdGlvbkdyb3VwRXhlY3V0b3IsXG4gICAgICAgIH0sXG4gICAgICAgIGFwaVNjaGVtYTogYWcuYXBpU2NoZW1hLnMzQnVja2V0TmFtZVxuICAgICAgICAgID8ge1xuICAgICAgICAgICAgICBzMzoge1xuICAgICAgICAgICAgICAgIHMzQnVja2V0TmFtZTogYWcuYXBpU2NoZW1hLnMzQnVja2V0TmFtZSxcbiAgICAgICAgICAgICAgICBzM09iamVjdEtleTogYWcuYXBpU2NoZW1hLnMzT2JqZWN0S2V5LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfVxuICAgICAgICAgIDoge1xuICAgICAgICAgICAgICBwYXlsb2FkOiBhZy5hcGlTY2hlbWEucGF5bG9hZCxcbiAgICAgICAgICAgIH0sXG4gICAgICB9KSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGFnZW50O1xuICB9XG5cbiAgLyoqXG4gICAqIEFnZW50IEFsaWFz5L2c5oiQXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUFnZW50QWxpYXMocHJvcHM6IEJlZHJvY2tBZ2VudENvbnN0cnVjdFByb3BzKTogYmVkcm9jay5DZm5BZ2VudEFsaWFzIHtcbiAgICByZXR1cm4gbmV3IGJlZHJvY2suQ2ZuQWdlbnRBbGlhcyh0aGlzLCAnQWdlbnRBbGlhcycsIHtcbiAgICAgIGFnZW50SWQ6IHRoaXMuYWdlbnQhLmF0dHJBZ2VudElkLFxuICAgICAgYWdlbnRBbGlhc05hbWU6IGAke3Byb3BzLmVudmlyb25tZW50fS1hbGlhc2AsXG4gICAgICBkZXNjcmlwdGlvbjogYCR7cHJvcHMuZW52aXJvbm1lbnR9IGVudmlyb25tZW50IGFsaWFzYCxcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBLbm93bGVkZ2UgQmFzZSBBUk7jgYvjgolJROOCkuaKveWHulxuICAgKi9cbiAgcHJpdmF0ZSBleHRyYWN0S25vd2xlZGdlQmFzZUlkKGFybjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAvLyBBUk7lvaLlvI86IGFybjphd3M6YmVkcm9jazp7cmVnaW9ufTp7YWNjb3VudH06a25vd2xlZGdlLWJhc2Uve2lkfVxuICAgIGNvbnN0IHBhcnRzID0gYXJuLnNwbGl0KCcvJyk7XG4gICAgcmV0dXJuIHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdO1xuICB9XG59XG4iXX0=