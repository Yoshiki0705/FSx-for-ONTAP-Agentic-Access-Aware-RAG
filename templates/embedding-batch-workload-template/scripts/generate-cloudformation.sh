#!/bin/bash

# CloudFormation Template Generation Script
# CDKからCloudFormationテンプレートを生成し、パラメータ化されたテンプレートを作成

set -euo pipefail

# セキュリティ設定
umask 077  # 作成されるファイルのパーミッションを制限
readonly SCRIPT_NAME="$(basename "$0")"

# エラートラップ設定
cleanup_on_exit() {
    local exit_code=$?
    
    # 機密変数のクリア
    unset SLACK_WEBHOOK_URL PAGER_DUTY_KEY 2>/dev/null || true
    
    # 一時ファイルの安全な削除
    if [[ -n "${TEMP_FILES:-}" ]]; then
        for temp_file in $TEMP_FILES; do
            if [[ -f "$temp_file" ]]; then
                shred -vfz -n 3 "$temp_file" 2>/dev/null || rm -f "$temp_file"
            fi
        done
    fi
    
    if [[ $exit_code -ne 0 ]]; then
        error "スクリプトが異常終了しました (終了コード: $exit_code)"
    fi
    
    exit $exit_code
}

trap cleanup_on_exit EXIT ERR

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CDK_DIR="$PROJECT_ROOT/cdk"
CFN_DIR="$PROJECT_ROOT/cloudformation"

# ログ設定
LOG_FILE="$PROJECT_ROOT/logs/cfn-generation-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$(dirname "$LOG_FILE")"

# ログ関数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" | tee -a "$LOG_FILE" >&2
}

# 使用方法の表示
show_usage() {
    cat << EOF
使用方法: $0 [オプション]

CDKからCloudFormationテンプレートを生成

オプション:
    -e, --environment ENV    環境名 (dev, staging, prod)
    -o, --output DIR         出力ディレクトリ (デフォルト: cloudformation)
    -p, --parameterize       パラメータ化されたテンプレートを生成
    -n, --nested            ネストされたスタックテンプレートを生成
    -v, --validate          生成されたテンプレートを検証
    -c, --clean             既存のテンプレートを削除してから生成
    -h, --help              このヘルプを表示

例:
    $0 --environment prod --parameterize --validate
    $0 --output custom-cfn --nested --clean
    $0 --environment dev --validate

EOF
}

# デフォルト値
ENVIRONMENT="dev"
OUTPUT_DIR="$CFN_DIR"
PARAMETERIZE=false
NESTED=false
VALIDATE=false
CLEAN=false

# 入力値検証関数
validate_input_parameters() {
    # 環境名検証
    if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
        error "無効な環境名: $ENVIRONMENT (許可値: dev, staging, prod)"
        exit 1
    fi
    
    # 出力ディレクトリ検証（パストラバーサル攻撃防止）
    if [[ "$OUTPUT_DIR" =~ \.\./|^/etc|^/usr|^/var ]]; then
        error "不正なディレクトリパス: $OUTPUT_DIR"
        exit 1
    fi
    
    # 書き込み権限確認
    local parent_dir
    parent_dir=$(dirname "$OUTPUT_DIR")
    if [[ ! -w "$parent_dir" ]]; then
        error "ディレクトリへの書き込み権限がありません: $parent_dir"
        exit 1
    fi
}

# コマンドライン引数の解析
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            if [[ -z "${2:-}" ]]; then
                error "環境名が指定されていません"
                exit 1
            fi
            ENVIRONMENT="$2"
            shift 2
            ;;
        -o|--output)
            if [[ -z "${2:-}" ]]; then
                error "出力ディレクトリが指定されていません"
                exit 1
            fi
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -p|--parameterize)
            PARAMETERIZE=true
            shift
            ;;
        -n|--nested)
            NESTED=true
            shift
            ;;
        -v|--validate)
            VALIDATE=true
            shift
            ;;
        -c|--clean)
            CLEAN=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            error "不明なオプション: $1"
            show_usage
            exit 1
            ;;
    esac
done

# 入力値検証実行
validate_input_parameters

# 前提条件の確認
check_prerequisites() {
    log "前提条件を確認中..."
    
    # AWS CLI
    if ! command -v aws &> /dev/null; then
        error "AWS CLIが必要です。インストールしてください。"
        exit 1
    fi
    
    # Node.js
    if ! command -v node &> /dev/null; then
        error "Node.jsが必要です。インストールしてください。"
        exit 1
    fi
    
    # CDK
    if ! command -v cdk &> /dev/null; then
        error "AWS CDKが必要です。インストールしてください。"
        exit 1
    fi
    
    # jq
    if ! command -v jq &> /dev/null; then
        error "jqが必要です。インストールしてください。"
        exit 1
    fi
    
    # CDKプロジェクトの存在確認
    if [[ ! -f "$CDK_DIR/cdk.json" ]]; then
        error "CDKプロジェクトが見つかりません: $CDK_DIR"
        exit 1
    fi
    
    log "前提条件の確認完了"
}

# 出力ディレクトリの準備
prepare_output_directory() {
    log "出力ディレクトリを準備中: $OUTPUT_DIR"
    
    if [[ "$CLEAN" == "true" ]] && [[ -d "$OUTPUT_DIR" ]]; then
        log "既存のテンプレートを削除中..."
        rm -rf "$OUTPUT_DIR"
    fi
    
    mkdir -p "$OUTPUT_DIR"
    mkdir -p "$OUTPUT_DIR/templates"
    mkdir -p "$OUTPUT_DIR/parameters"
    mkdir -p "$OUTPUT_DIR/nested"
    
    log "出力ディレクトリの準備完了"
}

# CDKプロジェクトのビルド
build_cdk_project() {
    log "CDKプロジェクトをビルド中..."
    
    cd "$CDK_DIR"
    
    # 依存関係のインストール
    if [[ ! -d "node_modules" ]]; then
        log "依存関係をインストール中..."
        npm install
    fi
    
    # TypeScriptのコンパイル
    log "TypeScriptをコンパイル中..."
    npm run build
    
    log "CDKプロジェクトのビルド完了"
}

# CloudFormationテンプレートの生成
generate_templates() {
    log "CloudFormationテンプレートを生成中..."
    
    cd "$CDK_DIR"
    
    # 基本テンプレートの生成
    log "基本テンプレートを生成中..."
    cdk synth \
        --context environment="$ENVIRONMENT" \
        --output "$OUTPUT_DIR/templates" \
        --quiet
    
    # 生成されたテンプレートの一覧表示
    log "生成されたテンプレート:"
    find "$OUTPUT_DIR/templates" -name "*.template.json" -exec basename {} \; | sort
    
    log "CloudFormationテンプレートの生成完了"
}

# テンプレートのパラメータ化
parameterize_templates() {
    if [[ "$PARAMETERIZE" != "true" ]]; then
        return
    fi
    
    log "テンプレートをパラメータ化中..."
    
    # 各テンプレートファイルを処理
    find "$OUTPUT_DIR/templates" -name "*.template.json" | while read -r template_file; do
        local template_name
        template_name=$(basename "$template_file" .template.json)
        
        log "パラメータ化中: $template_name"
        
        # パラメータ化されたテンプレートを作成
        create_parameterized_template "$template_file" "$template_name"
        
        # パラメータファイルを作成
        create_parameter_files "$template_file" "$template_name"
    done
    
    log "テンプレートのパラメータ化完了"
}

# パラメータ化されたテンプレートの作成
create_parameterized_template() {
    local template_file="$1"
    local template_name="$2"
    local parameterized_file="$OUTPUT_DIR/templates/${template_name}-parameterized.template.json"
    
    # テンプレートを読み込み
    local template_content
    template_content=$(cat "$template_file")
    
    # パラメータセクションを追加/更新
    local updated_template
    updated_template=$(echo "$template_content" | jq '
        .Parameters = (.Parameters // {}) + {
            "ProjectName": {
                "Type": "String",
                "Description": "プロジェクト名",
                "Default": "embedding-workload",
                "AllowedPattern": "^[a-z][a-z0-9-]*[a-z0-9]$",
                "ConstraintDescription": "小文字、数字、ハイフンのみ使用可能"
            },
            "Environment": {
                "Type": "String",
                "Description": "環境名",
                "Default": "dev",
                "AllowedValues": ["dev", "staging", "prod"]
            },
            "VpcId": {
                "Type": "String",
                "Description": "既存のVPC ID (オプション)",
                "Default": ""
            },
            "PrivateSubnetIds": {
                "Type": "CommaDelimitedList",
                "Description": "プライベートサブネットID (オプション)",
                "Default": ""
            },
            "FsxFileSystemId": {
                "Type": "String",
                "Description": "既存のFSx for NetApp ONTAPファイルシステムID (オプション)",
                "Default": ""
            },
            "BedrockRegion": {
                "Type": "String",
                "Description": "Amazon Bedrockリージョン",
                "Default": "us-east-1",
                "AllowedValues": ["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1", "ap-northeast-1"]
            },
            "BedrockModelId": {
                "Type": "String",
                "Description": "Bedrockモデル ID",
                "Default": "amazon.titan-embed-text-v1"
            },
            "EnableAutoRemediation": {
                "Type": "String",
                "Description": "自動修復機能を有効化",
                "Default": "false",
                "AllowedValues": ["true", "false"]
            },
            "EnableEscalation": {
                "Type": "String",
                "Description": "エスカレーション機能を有効化",
                "Default": "false",
                "AllowedValues": ["true", "false"]
            },
            "AlertContactEmail": {
                "Type": "String",
                "Description": "アラート通知用メールアドレス",
                "Default": "ops@company.com"
            },
            "SlackWebhookUrl": {
                "Type": "String",
                "Description": "Slack Webhook URL (オプション)",
                "Default": "",
                "NoEcho": true
            },
            "PagerDutyIntegrationKey": {
                "Type": "String",
                "Description": "PagerDuty統合キー (オプション)",
                "Default": "",
                "NoEcho": true
            }
        }
    ')
    
    # ハードコードされた値をパラメータ参照に置換
    updated_template=$(echo "$updated_template" | jq '
        # リソース名のプレフィックスをパラメータ化
        walk(
            if type == "object" and has("Ref") and (.Ref | type == "string") then
                if .Ref | test("^embedding-workload-") then
                    .Ref = {"Fn::Sub": "${ProjectName}-${Environment}-" + (.Ref | sub("^embedding-workload-[^-]+-"; ""))}
                else . end
            elif type == "string" and test("^embedding-workload-") then
                {"Fn::Sub": "${ProjectName}-${Environment}-" + (. | sub("^embedding-workload-[^-]+-"; ""))}
            else . end
        )
    ')
    
    # 条件セクションを追加
    updated_template=$(echo "$updated_template" | jq '
        .Conditions = (.Conditions // {}) + {
            "HasVpcId": {"Fn::Not": [{"Fn::Equals": [{"Ref": "VpcId"}, ""]}]},
            "HasPrivateSubnets": {"Fn::Not": [{"Fn::Equals": [{"Fn::Join": ["", {"Ref": "PrivateSubnetIds"}]}, ""]}]},
            "HasFsxFileSystem": {"Fn::Not": [{"Fn::Equals": [{"Ref": "FsxFileSystemId"}, ""]}]},
            "HasSlackWebhook": {"Fn::Not": [{"Fn::Equals": [{"Ref": "SlackWebhookUrl"}, ""]}]},
            "HasPagerDutyKey": {"Fn::Not": [{"Fn::Equals": [{"Ref": "PagerDutyIntegrationKey"}, ""]}]},
            "IsProduction": {"Fn::Equals": [{"Ref": "Environment"}, "prod"]},
            "EnableAutoRemediationCondition": {"Fn::Equals": [{"Ref": "EnableAutoRemediation"}, "true"]},
            "EnableEscalationCondition": {"Fn::Equals": [{"Ref": "EnableEscalation"}, "true"]}
        }
    ')
    
    # 出力セクションを追加
    updated_template=$(echo "$updated_template" | jq '
        .Outputs = (.Outputs // {}) + {
            "StackName": {
                "Description": "CloudFormationスタック名",
                "Value": {"Ref": "AWS::StackName"},
                "Export": {"Name": {"Fn::Sub": "${AWS::StackName}-StackName"}}
            },
            "ProjectName": {
                "Description": "プロジェクト名",
                "Value": {"Ref": "ProjectName"},
                "Export": {"Name": {"Fn::Sub": "${AWS::StackName}-ProjectName"}}
            },
            "Environment": {
                "Description": "環境名",
                "Value": {"Ref": "Environment"},
                "Export": {"Name": {"Fn::Sub": "${AWS::StackName}-Environment"}}
            }
        }
    ')
    
    # パラメータ化されたテンプレートを保存
    echo "$updated_template" | jq '.' > "$parameterized_file"
    
    log "パラメータ化されたテンプレートを作成: $(basename "$parameterized_file")"
}

# パラメータファイルの作成
create_parameter_files() {
    local template_file="$1"
    local template_name="$2"
    
    # 環境別パラメータファイルを作成
    local environments=("dev" "staging" "prod")
    
    for env in "${environments[@]}"; do
        local param_file="$OUTPUT_DIR/parameters/${template_name}-${env}-parameters.json"
        
        create_environment_parameters "$env" "$param_file"
        
        log "パラメータファイルを作成: $(basename "$param_file")"
    done
}

# 環境別パラメータの作成
create_environment_parameters() {
    local env="$1"
    local param_file="$2"
    
    local parameters
    case "$env" in
        "dev")
            parameters=$(cat << 'EOF'
{
    "Parameters": {
        "ProjectName": "embedding-workload",
        "Environment": "dev",
        "VpcId": "",
        "PrivateSubnetIds": "",
        "FsxFileSystemId": "",
        "BedrockRegion": "us-east-1",
        "BedrockModelId": "amazon.titan-embed-text-v1",
        "EnableAutoRemediation": "false",
        "EnableEscalation": "false",
        "AlertContactEmail": "dev-team@company.com",
        "SlackWebhookUrl": "",
        "PagerDutyIntegrationKey": ""
    }
}
EOF
)
            ;;
        "staging")
            parameters=$(cat << 'EOF'
{
    "Parameters": {
        "ProjectName": "embedding-workload",
        "Environment": "staging",
        "VpcId": "",
        "PrivateSubnetIds": "",
        "FsxFileSystemId": "",
        "BedrockRegion": "us-east-1",
        "BedrockModelId": "amazon.titan-embed-text-v1",
        "EnableAutoRemediation": "true",
        "EnableEscalation": "false",
        "AlertContactEmail": "staging-ops@company.com",
        "SlackWebhookUrl": "",
        "PagerDutyIntegrationKey": ""
    }
}
EOF
)
            ;;
        "prod")
            parameters=$(cat << 'EOF'
{
    "Parameters": {
        "ProjectName": "embedding-workload",
        "Environment": "prod",
        "VpcId": "",
        "PrivateSubnetIds": "",
        "FsxFileSystemId": "",
        "BedrockRegion": "us-east-1",
        "BedrockModelId": "amazon.titan-embed-text-v1",
        "EnableAutoRemediation": "true",
        "EnableEscalation": "true",
        "AlertContactEmail": "ops@company.com",
        "SlackWebhookUrl": "",
        "PagerDutyIntegrationKey": ""
    }
}
EOF
)
            ;;
    esac
    
    echo "$parameters" | jq '.' > "$param_file"
}

# ネストされたスタックテンプレートの生成
generate_nested_templates() {
    if [[ "$NESTED" != "true" ]]; then
        return
    fi
    
    log "ネストされたスタックテンプレートを生成中..."
    
    # メインテンプレートを見つける
    local main_template
    main_template=$(find "$OUTPUT_DIR/templates" -name "*EmbeddingWorkloadStack*.template.json" | head -1)
    
    if [[ -z "$main_template" ]]; then
        error "メインテンプレートが見つかりません"
        return
    fi
    
    # ネストされたスタック構造を作成
    create_nested_stack_structure "$main_template"
    
    log "ネストされたスタックテンプレートの生成完了"
}

# ネストされたスタック構造の作成
create_nested_stack_structure() {
    local main_template="$1"
    local nested_dir="$OUTPUT_DIR/nested"
    
    # メインテンプレートを読み込み
    local template_content
    template_content=$(cat "$main_template")
    
    # リソースを機能別に分割
    create_networking_stack "$template_content" "$nested_dir"
    create_security_stack "$template_content" "$nested_dir"
    create_compute_stack "$template_content" "$nested_dir"
    create_monitoring_stack "$template_content" "$nested_dir"
    
    # マスターテンプレートを作成
    create_master_template "$nested_dir"
}

# ネットワーキングスタックの作成
create_networking_stack() {
    local template_content="$1"
    local nested_dir="$2"
    local networking_file="$nested_dir/networking-stack.template.json"
    
    # ネットワーク関連リソースを抽出
    local networking_template
    networking_template=$(echo "$template_content" | jq '
        {
            "AWSTemplateFormatVersion": "2010-09-09",
            "Description": "Embedding Workload - Networking Stack",
            "Parameters": .Parameters,
            "Conditions": .Conditions,
            "Resources": (.Resources | with_entries(
                select(.key | test("VPC|Subnet|RouteTable|InternetGateway|NatGateway|SecurityGroup"))
            )),
            "Outputs": (.Outputs | with_entries(
                select(.key | test("VPC|Subnet|SecurityGroup"))
            ))
        }
    ')
    
    echo "$networking_template" | jq '.' > "$networking_file"
    log "ネットワーキングスタックを作成: $(basename "$networking_file")"
}

# セキュリティスタックの作成
create_security_stack() {
    local template_content="$1"
    local nested_dir="$2"
    local security_file="$nested_dir/security-stack.template.json"
    
    # セキュリティ関連リソースを抽出
    local security_template
    security_template=$(echo "$template_content" | jq '
        {
            "AWSTemplateFormatVersion": "2010-09-09",
            "Description": "Embedding Workload - Security Stack",
            "Parameters": .Parameters,
            "Conditions": .Conditions,
            "Resources": (.Resources | with_entries(
                select(.key | test("Role|Policy|InstanceProfile|Key"))
            )),
            "Outputs": (.Outputs | with_entries(
                select(.key | test("Role|Policy|Key"))
            ))
        }
    ')
    
    echo "$security_template" | jq '.' > "$security_file"
    log "セキュリティスタックを作成: $(basename "$security_file")"
}

# コンピュートスタックの作成
create_compute_stack() {
    local template_content="$1"
    local nested_dir="$2"
    local embedding_file="$nested_dir/embedding-stack.template.json"
    
    # コンピュート関連リソースを抽出
    local compute_template
    compute_template=$(echo "$template_content" | jq '
        {
            "AWSTemplateFormatVersion": "2010-09-09",
            "Description": "Embedding Workload - Compute Stack",
            "Parameters": .Parameters,
            "Conditions": .Conditions,
            "Resources": (.Resources | with_entries(
                select(.key | test("Batch|ComputeEnvironment|JobQueue|JobDefinition|Lambda|Function"))
            )),
            "Outputs": (.Outputs | with_entries(
                select(.key | test("Batch|ComputeEnvironment|JobQueue|JobDefinition|Lambda|Function"))
            ))
        }
    ')
    
    echo "$compute_template" | jq '.' > "$compute_file"
    log "コンピュートスタックを作成: $(basename "$compute_file")"
}

# モニタリングスタックの作成
create_monitoring_stack() {
    local template_content="$1"
    local nested_dir="$2"
    local monitoring_file="$nested_dir/monitoring-stack.template.json"
    
    # モニタリング関連リソースを抽出
    local monitoring_template
    monitoring_template=$(echo "$template_content" | jq '
        {
            "AWSTemplateFormatVersion": "2010-09-09",
            "Description": "Embedding Workload - Monitoring Stack",
            "Parameters": .Parameters,
            "Conditions": .Conditions,
            "Resources": (.Resources | with_entries(
                select(.key | test("Alarm|Topic|Subscription|Dashboard|LogGroup"))
            )),
            "Outputs": (.Outputs | with_entries(
                select(.key | test("Alarm|Topic|Subscription|Dashboard|LogGroup"))
            ))
        }
    ')
    
    echo "$monitoring_template" | jq '.' > "$monitoring_file"
    log "モニタリングスタックを作成: $(basename "$monitoring_file")"
}

# マスターテンプレートの作成
create_master_template() {
    local nested_dir="$1"
    local master_file="$nested_dir/master-stack.template.json"
    
    local master_template
    master_template=$(cat << 'EOF'
{
    "AWSTemplateFormatVersion": "2010-09-09",
    "Description": "Embedding Workload - Master Stack (Nested Stacks)",
    "Parameters": {
        "ProjectName": {
            "Type": "String",
            "Description": "プロジェクト名",
            "Default": "embedding-workload"
        },
        "Environment": {
            "Type": "String",
            "Description": "環境名",
            "Default": "dev",
            "AllowedValues": ["dev", "staging", "prod"]
        },
        "TemplateS3Bucket": {
            "Type": "String",
            "Description": "ネストされたテンプレートを格納するS3バケット名"
        },
        "TemplateS3KeyPrefix": {
            "Type": "String",
            "Description": "S3キープレフィックス",
            "Default": "cloudformation/nested/"
        }
    },
    "Resources": {
        "NetworkingStack": {
            "Type": "AWS::CloudFormation::Stack",
            "Properties": {
                "TemplateURL": {
                    "Fn::Sub": "https://${TemplateS3Bucket}.s3.amazonaws.com/${TemplateS3KeyPrefix}networking-stack.template.json"
                },
                "Parameters": {
                    "ProjectName": {"Ref": "ProjectName"},
                    "Environment": {"Ref": "Environment"}
                },
                "Tags": [
                    {"Key": "Project", "Value": {"Ref": "ProjectName"}},
                    {"Key": "Environment", "Value": {"Ref": "Environment"}},
                    {"Key": "Component", "Value": "Networking"}
                ]
            }
        },
        "SecurityStack": {
            "Type": "AWS::CloudFormation::Stack",
            "Properties": {
                "TemplateURL": {
                    "Fn::Sub": "https://${TemplateS3Bucket}.s3.amazonaws.com/${TemplateS3KeyPrefix}security-stack.template.json"
                },
                "Parameters": {
                    "ProjectName": {"Ref": "ProjectName"},
                    "Environment": {"Ref": "Environment"}
                },
                "Tags": [
                    {"Key": "Project", "Value": {"Ref": "ProjectName"}},
                    {"Key": "Environment", "Value": {"Ref": "Environment"}},
                    {"Key": "Component", "Value": "Security"}
                ]
            }
        },
        "EmbeddingStack": {
            "Type": "AWS::CloudFormation::Stack",
            "DependsOn": ["NetworkingStack", "SecurityStack"],
            "Properties": {
                "TemplateURL": {
                    "Fn::Sub": "https://${TemplateS3Bucket}.s3.amazonaws.com/${TemplateS3KeyPrefix}embedding-stack.template.json"
                },
                "Parameters": {
                    "ProjectName": {"Ref": "ProjectName"},
                    "Environment": {"Ref": "Environment"},
                    "VpcId": {"Fn::GetAtt": ["NetworkingStack", "Outputs.VpcId"]},
                    "SecurityGroupId": {"Fn::GetAtt": ["NetworkingStack", "Outputs.SecurityGroupId"]},
                    "JobRoleArn": {"Fn::GetAtt": ["SecurityStack", "Outputs.JobRoleArn"]}
                },
                "Tags": [
                    {"Key": "Project", "Value": {"Ref": "ProjectName"}},
                    {"Key": "Environment", "Value": {"Ref": "Environment"}},
                    {"Key": "Component", "Value": "Compute"}
                ]
            }
        },
        "MonitoringStack": {
            "Type": "AWS::CloudFormation::Stack",
            "DependsOn": ["EmbeddingStack"],
            "Properties": {
                "TemplateURL": {
                    "Fn::Sub": "https://${TemplateS3Bucket}.s3.amazonaws.com/${TemplateS3KeyPrefix}monitoring-stack.template.json"
                },
                "Parameters": {
                    "ProjectName": {"Ref": "ProjectName"},
                    "Environment": {"Ref": "Environment"},
                    "JobQueueName": {"Fn::GetAtt": ["EmbeddingStack", "Outputs.JobQueueName"]},
                    "ComputeEnvironmentName": {"Fn::GetAtt": ["EmbeddingStack", "Outputs.ComputeEnvironmentName"]}
                },
                "Tags": [
                    {"Key": "Project", "Value": {"Ref": "ProjectName"}},
                    {"Key": "Environment", "Value": {"Ref": "Environment"}},
                    {"Key": "Component", "Value": "Monitoring"}
                ]
            }
        }
    },
    "Outputs": {
        "MasterStackId": {
            "Description": "マスタースタックID",
            "Value": {"Ref": "AWS::StackId"}
        },
        "NetworkingStackId": {
            "Description": "ネットワーキングスタックID",
            "Value": {"Ref": "NetworkingStack"}
        },
        "SecurityStackId": {
            "Description": "セキュリティスタックID",
            "Value": {"Ref": "SecurityStack"}
        },
        "EmbeddingStackId": {
            "Description": "EmbeddingスタックID",
            "Value": {"Ref": "EmbeddingStack"}
        },
        "MonitoringStackId": {
            "Description": "モニタリングスタックID",
            "Value": {"Ref": "MonitoringStack"}
        }
    }
}
EOF
)
    
    echo "$master_template" | jq '.' > "$master_file"
    log "マスターテンプレートを作成: $(basename "$master_file")"
}

# テンプレートの検証
validate_templates() {
    if [[ "$VALIDATE" != "true" ]]; then
        return
    fi
    
    log "CloudFormationテンプレートを検証中..."
    
    local validation_errors=0
    
    # 各テンプレートファイルを検証
    find "$OUTPUT_DIR" -name "*.template.json" | while read -r template_file; do
        local template_name
        template_name=$(basename "$template_file")
        
        log "検証中: $template_name"
        
        # AWS CLIでテンプレートを検証
        if aws cloudformation validate-template --template-body "file://$template_file" >/dev/null 2>&1; then
            log "✅ $template_name: 検証成功"
        else
            error "❌ $template_name: 検証失敗"
            aws cloudformation validate-template --template-body "file://$template_file" 2>&1 | head -5
            ((validation_errors++))
        fi
    done
    
    if [[ $validation_errors -eq 0 ]]; then
        log "すべてのテンプレートの検証が成功しました"
    else
        error "$validation_errors 個のテンプレートで検証エラーが発生しました"
        exit 1
    fi
}

# デプロイメントスクリプトの生成
generate_deployment_scripts() {
    log "デプロイメントスクリプトを生成中..."
    
    local scripts_dir="$OUTPUT_DIR/scripts"
    mkdir -p "$scripts_dir"
    
    # 基本デプロイスクリプト
    create_basic_deploy_script "$scripts_dir"
    
    # ネストされたスタック用デプロイスクリプト
    if [[ "$NESTED" == "true" ]]; then
        create_nested_deploy_script "$scripts_dir"
    fi
    
    # パラメータ化テンプレート用デプロイスクリプト
    if [[ "$PARAMETERIZE" == "true" ]]; then
        create_parameterized_deploy_script "$scripts_dir"
    fi
    
    log "デプロイメントスクリプトの生成完了"
}

# 基本デプロイスクリプトの作成
create_basic_deploy_script() {
    local scripts_dir="$1"
    local deploy_script="$scripts_dir/deploy-cloudformation.sh"
    
    cat > "$deploy_script" << 'EOF'
#!/bin/bash

# CloudFormation Basic Deployment Script

set -euo pipefail

STACK_NAME="${1:-embedding-workload-stack}"
TEMPLATE_FILE="${2:-templates/EmbeddingWorkloadStack.template.json}"
ENVIRONMENT="${3:-dev}"

echo "Deploying CloudFormation stack: $STACK_NAME"
echo "Template: $TEMPLATE_FILE"
echo "Environment: $ENVIRONMENT"

aws cloudformation deploy \
    --template-file "$TEMPLATE_FILE" \
    --stack-name "$STACK_NAME" \
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
    --parameter-overrides \
        Environment="$ENVIRONMENT" \
        ProjectName="embedding-workload" \
    --tags \
        Project=embedding-workload \
        Environment="$ENVIRONMENT" \
        ManagedBy=CloudFormation

echo "Deployment completed successfully!"
EOF
    
    chmod +x "$deploy_script"
    log "基本デプロイスクリプトを作成: $(basename "$deploy_script")"
}

# ネストされたスタック用デプロイスクリプトの作成
create_nested_deploy_script() {
    local scripts_dir="$1"
    local deploy_script="$scripts_dir/deploy-nested-stacks.sh"
    
    cat > "$deploy_script" << 'EOF'
#!/bin/bash

# CloudFormation Nested Stacks Deployment Script

set -euo pipefail

STACK_NAME="${1:-embedding-workload-master}"
S3_BUCKET="${2:-your-cloudformation-templates-bucket}"
ENVIRONMENT="${3:-dev}"

echo "Deploying nested CloudFormation stacks"
echo "Master stack: $STACK_NAME"
echo "S3 bucket: $S3_BUCKET"
echo "Environment: $ENVIRONMENT"

# Upload nested templates to S3
echo "Uploading nested templates to S3..."
aws s3 sync nested/ "s3://$S3_BUCKET/cloudformation/nested/" --delete

# Deploy master stack
echo "Deploying master stack..."
aws cloudformation deploy \
    --template-file "nested/master-stack.template.json" \
    --stack-name "$STACK_NAME" \
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
    --parameter-overrides \
        Environment="$ENVIRONMENT" \
        ProjectName="embedding-workload" \
        TemplateS3Bucket="$S3_BUCKET" \
        TemplateS3KeyPrefix="cloudformation/nested/" \
    --tags \
        Project=embedding-workload \
        Environment="$ENVIRONMENT" \
        ManagedBy=CloudFormation \
        StackType=Master

echo "Nested stacks deployment completed successfully!"
EOF
    
    chmod +x "$deploy_script"
    log "ネストされたスタック用デプロイスクリプトを作成: $(basename "$deploy_script")"
}

# パラメータ化テンプレート用デプロイスクリプトの作成
create_parameterized_deploy_script() {
    local scripts_dir="$1"
    local deploy_script="$scripts_dir/deploy-parameterized.sh"
    
    cat > "$deploy_script" << 'EOF'
#!/bin/bash

# CloudFormation Parameterized Template Deployment Script

set -euo pipefail

STACK_NAME="${1:-embedding-workload-stack}"
ENVIRONMENT="${2:-dev}"
TEMPLATE_FILE="templates/EmbeddingWorkloadStack-parameterized.template.json"
PARAMETERS_FILE="parameters/EmbeddingWorkloadStack-${ENVIRONMENT}-parameters.json"

echo "Deploying parameterized CloudFormation stack"
echo "Stack name: $STACK_NAME"
echo "Environment: $ENVIRONMENT"
echo "Template: $TEMPLATE_FILE"
echo "Parameters: $PARAMETERS_FILE"

# Check if files exist
if [[ ! -f "$TEMPLATE_FILE" ]]; then
    echo "Error: Template file not found: $TEMPLATE_FILE"
    exit 1
fi

if [[ ! -f "$PARAMETERS_FILE" ]]; then
    echo "Error: Parameters file not found: $PARAMETERS_FILE"
    exit 1
fi

# Deploy stack with parameters
aws cloudformation deploy \
    --template-file "$TEMPLATE_FILE" \
    --stack-name "$STACK_NAME" \
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
    --parameter-overrides file://"$PARAMETERS_FILE" \
    --tags \
        Project=embedding-workload \
        Environment="$ENVIRONMENT" \
        ManagedBy=CloudFormation \
        TemplateType=Parameterized

echo "Parameterized stack deployment completed successfully!"
EOF
    
    chmod +x "$deploy_script"
    log "パラメータ化テンプレート用デプロイスクリプトを作成: $(basename "$deploy_script")"
}

# 生成結果のサマリー表示
show_summary() {
    log "CloudFormationテンプレート生成完了"
    
    echo ""
    echo "=== 生成結果サマリー ==="
    echo "出力ディレクトリ: $OUTPUT_DIR"
    echo ""
    
    echo "📁 生成されたファイル:"
    find "$OUTPUT_DIR" -type f -name "*.json" -o -name "*.sh" | sort | while read -r file; do
        echo "  - $(realpath --relative-to="$PROJECT_ROOT" "$file")"
    done
    
    echo ""
    echo "📋 次のステップ:"
    echo "1. パラメータファイルを環境に合わせて編集"
    echo "2. デプロイメントスクリプトを実行"
    echo "3. AWS CLIでテンプレートを検証"
    echo ""
    
    if [[ "$PARAMETERIZE" == "true" ]]; then
        echo "🔧 パラメータ化テンプレートの使用方法:"
        echo "  ./scripts/deploy-parameterized.sh my-stack-name prod"
        echo ""
    fi
    
    if [[ "$NESTED" == "true" ]]; then
        echo "🏗️ ネストされたスタックの使用方法:"
        echo "  1. S3バケットを作成"
        echo "  2. ./scripts/deploy-nested-stacks.sh my-master-stack my-s3-bucket prod"
        echo ""
    fi
    
    echo "📖 詳細なドキュメント:"
    echo "  - docs/CLOUDFORMATION_DEPLOYMENT_GUIDE.md"
    echo "  - docs/CLOUDFORMATION_CONFIGURATION_GUIDE.md"
    echo ""
    
    echo "ログファイル: $LOG_FILE"
}

# メイン実行
main() {
    log "CloudFormationテンプレート生成を開始"
    log "環境: $ENVIRONMENT"
    log "出力ディレクトリ: $OUTPUT_DIR"
    log "パラメータ化: $PARAMETERIZE"
    log "ネストされたスタック: $NESTED"
    log "検証: $VALIDATE"
    
    # 前提条件の確認
    check_prerequisites
    
    # 出力ディレクトリの準備
    prepare_output_directory
    
    # CDKプロジェクトのビルド
    build_cdk_project
    
    # CloudFormationテンプレートの生成
    generate_templates
    
    # テンプレートのパラメータ化
    parameterize_templates
    
    # ネストされたスタックテンプレートの生成
    generate_nested_templates
    
    # テンプレートの検証
    validate_templates
    
    # デプロイメントスクリプトの生成
    generate_deployment_scripts
    
    # 生成結果のサマリー表示
    show_summary
    
    log "CloudFormationテンプレート生成が完了しました"
}

# スクリプト実行
main "$@"