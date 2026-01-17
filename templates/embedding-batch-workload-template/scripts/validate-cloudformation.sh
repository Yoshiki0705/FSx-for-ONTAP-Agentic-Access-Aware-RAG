#!/bin/bash
# CloudFormationテンプレート検証スクリプト

set -euo pipefail

# セキュリティ設定
umask 077  # 作成されるファイルのパーミッションを制限
readonly SCRIPT_NAME="$(basename "$0")"

# エラートラップ設定
trap 'echo "❌ エラー: 行 $LINENO でスクリプトが失敗しました" >&2; exit 1' ERR

# スクリプトディレクトリの取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 設定ファイル読み込み
if [[ -f "$SCRIPT_DIR/lib/validation-config.sh" ]]; then
    source "$SCRIPT_DIR/lib/validation-config.sh"
else
    echo "警告: 設定ファイルが見つかりません: $SCRIPT_DIR/lib/validation-config.sh" >&2
fi

# 設定（環境変数で上書き可能）
readonly TEMPLATE_DIR="${TEMPLATE_DIR:-${PROJECT_ROOT}/cloudformation-templates}"
readonly PARAMETERS_DIR="${PARAMETERS_DIR:-${PROJECT_ROOT}/parameters}"
readonly LOG_FILE="${LOG_FILE:-${PROJECT_ROOT}/validation_$(date +%Y%m%d_%H%M%S).log}"
readonly MAX_CHANGE_SET_WAIT_TIME="${MAX_CHANGE_SET_WAIT_TIME:-60}"
readonly REQUIRED_TOOLS=("aws" "jq")

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ログ関数（機密情報フィルタリング付き）
sanitize_log_message() {
    local message="$1"
    # AWS アカウントID、ARN、機密情報をマスク
    message=$(echo "$message" | sed -E 's/[0-9]{12}/***ACCOUNT***/g')
    message=$(echo "$message" | sed -E 's/arn:aws:[^:]*:[^:]*:[0-9]{12}:[^[:space:]]*/***ARN***/g')
    echo "$message"
}

log() {
    local sanitized_message
    sanitized_message=$(sanitize_log_message "$1")
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $sanitized_message" | tee -a "$LOG_FILE"
}

error() {
    local sanitized_message
    sanitized_message=$(sanitize_log_message "$1")
    echo -e "${RED}[ERROR]${NC} $sanitized_message" | tee -a "$LOG_FILE"
}

success() {
    local sanitized_message
    sanitized_message=$(sanitize_log_message "$1")
    echo -e "${GREEN}[SUCCESS]${NC} $sanitized_message" | tee -a "$LOG_FILE"
}

warning() {
    local sanitized_message
    sanitized_message=$(sanitize_log_message "$1")
    echo -e "${YELLOW}[WARNING]${NC} $sanitized_message" | tee -a "$LOG_FILE"
}

# 使用方法表示
show_usage() {
    cat << EOF
CloudFormationテンプレート検証スクリプト

使用方法: $0 [OPTIONS]

OPTIONS:
    -t, --template <file>      検証するテンプレートファイル
    -p, --parameters <file>    パラメータファイル
    -e, --environment <env>    環境名 (dev/staging/prod)
    -a, --all                  全テンプレートを検証
    -s, --syntax-only          構文チェックのみ実行
    -l, --lint                 リンターチェックを実行
    -c, --security             セキュリティチェックを実行
    -v, --verbose              詳細出力
    -h, --help                 このヘルプを表示

例:
    $0 --template template.yaml --parameters params.json
    $0 --all --lint --security
    $0 --environment dev --syntax-only
EOF
}

# 必要ツールの存在確認
check_required_tools() {
    local missing_tools=()
    
    for tool in "${REQUIRED_TOOLS[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        error "必要なツールがインストールされていません: ${missing_tools[*]}"
        return 1
    fi
    
    return 0
}

# AWS認証確認
check_aws_authentication() {
    log "AWS認証確認中..."
    
    local caller_identity
    if ! caller_identity=$(aws sts get-caller-identity 2>&1); then
        error "AWS認証が設定されていません"
        error "詳細: $caller_identity"
        return 1
    fi
    
    local account_id
    account_id=$(echo "$caller_identity" | jq -r '.Account' 2>/dev/null || echo "不明")
    log "AWS認証確認完了 (アカウント: ***ACCOUNT***)"
    
    return 0
}

# 前提条件チェック（リファクタリング版）
check_prerequisites() {
    log "前提条件をチェック中..."
    
    if ! check_required_tools; then
        return 1
    fi
    
    if ! check_aws_authentication; then
        return 1
    fi
    
    success "前提条件チェック完了"
}

# JSON/YAML構文チェック
validate_syntax() {
    local file="$1"
    local file_type=""
    
    log "構文チェック中: $file"
    
    # ファイル拡張子で判定
    case "${file##*.}" in
        json)
            file_type="json"
            if jq empty "$file" 2>/dev/null; then
                success "JSON構文OK: $file"
                return 0
            else
                error "JSON構文エラー: $file"
                return 1
            fi
            ;;
        yaml|yml)
            file_type="yaml"
            # yamllintがある場合は使用
            if command -v yamllint &> /dev/null; then
                if yamllint "$file" 2>/dev/null; then
                    success "YAML構文OK: $file"
                    return 0
                else
                    error "YAML構文エラー: $file"
                    return 1
                fi
            else
                # pythonでYAMLチェック
                if python3 -c "import yaml; yaml.safe_load(open('$file'))" 2>/dev/null; then
                    success "YAML構文OK: $file"
                    return 0
                else
                    error "YAML構文エラー: $file"
                    return 1
                fi
            fi
            ;;
        *)
            warning "不明なファイル形式: $file"
            return 1
            ;;
    esac
}

# CloudFormation構文チェック
validate_cloudformation_syntax() {
    local template="$1"
    
    log "CloudFormation構文チェック中: $template"
    
    if aws cloudformation validate-template --template-body "file://$template" &> /dev/null; then
        success "CloudFormation構文OK: $template"
        return 0
    else
        error "CloudFormation構文エラー: $template"
        # 詳細エラー表示
        aws cloudformation validate-template --template-body "file://$template" 2>&1 | tee -a "$LOG_FILE"
        return 1
    fi
}

# リンターチェック
run_linter() {
    local template="$1"
    
    log "リンターチェック中: $template"
    
    # cfn-lintがある場合は使用
    if command -v cfn-lint &> /dev/null; then
        if cfn-lint "$template" 2>/dev/null; then
            success "リンターチェックOK: $template"
            return 0
        else
            warning "リンター警告あり: $template"
            cfn-lint "$template" 2>&1 | tee -a "$LOG_FILE"
            return 1
        fi
    else
        warning "cfn-lintがインストールされていません。スキップします。"
        return 0
    fi
}

# セキュリティチェック
run_security_check() {
    local template="$1"
    
    log "セキュリティチェック中: $template"
    
    # cfn_nagがある場合は使用
    if command -v cfn_nag_scan &> /dev/null; then
        if cfn_nag_scan --input-path "$template" 2>/dev/null; then
            success "セキュリティチェックOK: $template"
            return 0
        else
            warning "セキュリティ警告あり: $template"
            cfn_nag_scan --input-path "$template" 2>&1 | tee -a "$LOG_FILE"
            return 1
        fi
    else
        warning "cfn_nagがインストールされていません。スキップします。"
        return 0
    fi
}

# パラメータファイル検証
validate_parameters() {
    local param_file="$1"
    
    log "パラメータファイル検証中: $param_file"
    
    # JSON構文チェック
    if ! validate_syntax "$param_file"; then
        return 1
    fi
    
    # パラメータ構造チェック
    if jq -e '.Parameters' "$param_file" &> /dev/null; then
        success "パラメータ構造OK: $param_file"
    else
        error "パラメータ構造エラー: $param_file (Parametersキーが見つかりません)"
        return 1
    fi
    
    # 必須パラメータチェック
    local required_params=("ProjectName" "Environment" "VpcId" "SubnetIds")
    
    for param in "${required_params[@]}"; do
        if jq -e ".Parameters[] | select(.ParameterKey==\"$param\")" "$param_file" &> /dev/null; then
            success "必須パラメータ確認: $param"
        else
            error "必須パラメータ不足: $param"
            return 1
        fi
    done
    
    return 0
}

# リソース存在チェック
validate_resources() {
    local param_file="$1"
    
    log "リソース存在チェック中..."
    
    # VPC存在チェック
    local vpc_id
    vpc_id=$(jq -r '.Parameters[] | select(.ParameterKey=="VpcId") | .ParameterValue' "$param_file")
    
    if [[ "$vpc_id" != "null" && -n "$vpc_id" ]]; then
        if aws ec2 describe-vpcs --vpc-ids "$vpc_id" &> /dev/null; then
            success "VPC確認OK: $vpc_id"
        else
            error "VPCが見つかりません: $vpc_id"
            return 1
        fi
    fi
    
    # サブネット存在チェック
    local subnet_ids
    subnet_ids=$(jq -r '.Parameters[] | select(.ParameterKey=="SubnetIds") | .ParameterValue' "$param_file")
    
    if [[ "$subnet_ids" != "null" && -n "$subnet_ids" ]]; then
        IFS=',' read -ra SUBNETS <<< "$subnet_ids"
        for subnet in "${SUBNETS[@]}"; do
            if aws ec2 describe-subnets --subnet-ids "$subnet" &> /dev/null; then
                success "サブネット確認OK: $subnet"
            else
                error "サブネットが見つかりません: $subnet"
                return 1
            fi
        done
    fi
    
    # FSx存在チェック（オプション）
    local fsx_id
    fsx_id=$(jq -r '.Parameters[] | select(.ParameterKey=="FsxFileSystemId") | .ParameterValue' "$param_file" 2>/dev/null || echo "")
    
    if [[ -n "$fsx_id" && "$fsx_id" != "null" ]]; then
        if aws fsx describe-file-systems --file-system-ids "$fsx_id" &> /dev/null; then
            success "FSx確認OK: $fsx_id"
        else
            warning "FSxファイルシステムが見つかりません: $fsx_id"
        fi
    fi
    
    return 0
}

# 変更セット検証
validate_change_set() {
    local template="$1"
    local param_file="$2"
    local stack_name="$3"
    
    # 入力値検証（セキュリティ強化）
    if [[ ! -f "$template" ]]; then
        error "テンプレートファイルが存在しません: $template"
        return 1
    fi
    
    if [[ ! -f "$param_file" ]]; then
        error "パラメータファイルが存在しません: $param_file"
        return 1
    fi
    
    # スタック名の検証（英数字とハイフンのみ許可）
    if [[ ! "$stack_name" =~ ^[a-zA-Z0-9-]+$ ]]; then
        error "無効なスタック名: $stack_name"
        return 1
    fi
    
    log "変更セット検証中..."
    
    local change_set_name="validation-$(date +%s)"
    
    # 変更セット作成
    if aws cloudformation create-change-set \
        --stack-name "$stack_name" \
        --template-body "file://$template" \
        --parameters "file://$param_file" \
        --change-set-name "$change_set_name" \
        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
        &> /dev/null; then
        
        # 変更セット状態確認
        local status=""
        local attempts=0
        local max_attempts=$((MAX_CHANGE_SET_WAIT_TIME / 2))
        while [[ $attempts -lt $max_attempts ]]; do
            status=$(aws cloudformation describe-change-set \
                --stack-name "$stack_name" \
                --change-set-name "$change_set_name" \
                --query 'Status' \
                --output text 2>/dev/null || echo "FAILED")
            
            if [[ "$status" == "CREATE_COMPLETE" ]]; then
                success "変更セット作成完了"
                
                # 変更内容表示
                aws cloudformation describe-change-set \
                    --stack-name "$stack_name" \
                    --change-set-name "$change_set_name" \
                    --query 'Changes[].{Action:Action,LogicalResourceId:ResourceChange.LogicalResourceId,ResourceType:ResourceChange.ResourceType}' \
                    --output table | tee -a "$LOG_FILE"
                
                break
            elif [[ "$status" == "FAILED" ]]; then
                error "変更セット作成失敗"
                aws cloudformation describe-change-set \
                    --stack-name "$stack_name" \
                    --change-set-name "$change_set_name" \
                    --query 'StatusReason' \
                    --output text | tee -a "$LOG_FILE"
                break
            fi
            
            sleep 2
            ((attempts++))
        done
        
        # 変更セット削除
        aws cloudformation delete-change-set \
            --stack-name "$stack_name" \
            --change-set-name "$change_set_name" \
            &> /dev/null || true
        
        if [[ "$status" == "CREATE_COMPLETE" ]]; then
            return 0
        else
            return 1
        fi
    else
        error "変更セット作成に失敗しました"
        return 1
    fi
}

# 基本検証実行
run_basic_validation() {
    local template="$1"
    local errors=0
    
    if ! validate_syntax "$template"; then
        ((errors++))
    fi
    
    if ! validate_cloudformation_syntax "$template"; then
        ((errors++))
    fi
    
    return $errors
}

# パラメータ検証実行
run_parameter_validation() {
    local param_file="$1"
    local syntax_only="$2"
    local errors=0
    
    if [[ -n "$param_file" && -f "$param_file" ]]; then
        if ! validate_parameters "$param_file"; then
            ((errors++))
        fi
        
        if [[ "$syntax_only" != "true" ]]; then
            if ! validate_resources "$param_file"; then
                ((errors++))
            fi
        fi
    fi
    
    return $errors
}

# 高度な検証実行
run_advanced_validation() {
    local template="$1"
    local run_lint="$2"
    local run_security="$3"
    local errors=0
    
    if [[ "$run_lint" == "true" ]]; then
        if ! run_linter "$template"; then
            ((errors++))
        fi
    fi
    
    if [[ "$run_security" == "true" ]]; then
        if ! run_security_check "$template"; then
            ((errors++))
        fi
    fi
    
    return $errors
}

# 単一テンプレート検証（リファクタリング版）
validate_single_template() {
    local template="$1"
    local param_file="$2"
    local syntax_only="$3"
    local run_lint="$4"
    local run_security="$5"
    
    log "テンプレート検証開始: $template"
    
    local total_errors=0
    
    # 基本検証
    run_basic_validation "$template"
    total_errors=$((total_errors + $?))
    
    # パラメータ検証
    run_parameter_validation "$param_file" "$syntax_only"
    total_errors=$((total_errors + $?))
    
    # 高度な検証
    run_advanced_validation "$template" "$run_lint" "$run_security"
    total_errors=$((total_errors + $?))
    
    if [[ $total_errors -eq 0 ]]; then
        success "テンプレート検証完了: $template"
        return 0
    else
        error "テンプレート検証でエラーが発生しました: $template (エラー数: $total_errors)"
        return 1
    fi
}

# テンプレートファイル収集
collect_template_files() {
    local templates=()
    
    if [[ -d "$TEMPLATE_DIR" ]]; then
        while IFS= read -r -d '' template; do
            templates+=("$template")
        done < <(find "$TEMPLATE_DIR" -name "*.json" -o -name "*.yaml" -o -name "*.yml" -print0 2>/dev/null)
    fi
    
    printf '%s\n' "${templates[@]}"
}

# パラメータファイル検索
find_parameter_file() {
    local template="$1"
    local template_name
    template_name=$(basename "$template" | sed 's/\.[^.]*$//')
    
    for param in "$PARAMETERS_DIR"/*"$template_name"*.json; do
        if [[ -f "$param" ]]; then
            echo "$param"
            return 0
        fi
    done
    
    return 1
}

# 全テンプレート検証（改善版）
validate_all_templates() {
    local syntax_only="$1"
    local run_lint="$2"
    local run_security="$3"
    
    log "全テンプレート検証開始"
    
    local total_errors=0
    local templates
    
    # テンプレートファイル収集
    readarray -t templates < <(collect_template_files)
    
    if [[ ${#templates[@]} -eq 0 ]]; then
        warning "テンプレートディレクトリが見つからないか、テンプレートファイルが存在しません: $TEMPLATE_DIR"
        return 1
    fi
    
    log "検証対象テンプレート数: ${#templates[@]}"
    
    # 各テンプレートの検証
    for template in "${templates[@]}"; do
        local param_file=""
        
        if find_parameter_file "$template" >/dev/null 2>&1; then
            param_file=$(find_parameter_file "$template")
        fi
        
        if ! validate_single_template "$template" "$param_file" "$syntax_only" "$run_lint" "$run_security"; then
            ((total_errors++))
        fi
    done
    
    if [[ $total_errors -eq 0 ]]; then
        success "全テンプレート検証完了"
        return 0
    else
        error "検証でエラーが発生しました (総エラー数: $total_errors)"
        return 1
    fi
}

# 環境別検証
validate_environment() {
    local environment="$1"
    local syntax_only="$2"
    local run_lint="$3"
    local run_security="$4"
    
    log "環境別検証開始: $environment"
    
    local template_file="$TEMPLATE_DIR/EmbeddingWorkloadStack.template.json"
    local param_file="$PARAMETERS_DIR/parameters-${environment}.json"
    
    if [[ ! -f "$template_file" ]]; then
        error "テンプレートファイルが見つかりません: $template_file"
        return 1
    fi
    
    if [[ ! -f "$param_file" ]]; then
        error "パラメータファイルが見つかりません: $param_file"
        return 1
    fi
    
    validate_single_template "$template_file" "$param_file" "$syntax_only" "$run_lint" "$run_security"
}

# メイン処理
main() {
    local template=""
    local param_file=""
    local environment=""
    local validate_all=false
    local syntax_only=false
    local run_lint=false
    local run_security=false
    local verbose=false
    
    # パラメータ解析
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--template)
                template="$2"
                shift 2
                ;;
            -p|--parameters)
                param_file="$2"
                shift 2
                ;;
            -e|--environment)
                environment="$2"
                shift 2
                ;;
            -a|--all)
                validate_all=true
                shift
                ;;
            -s|--syntax-only)
                syntax_only=true
                shift
                ;;
            -l|--lint)
                run_lint=true
                shift
                ;;
            -c|--security)
                run_security=true
                shift
                ;;
            -v|--verbose)
                verbose=true
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
    
    # ログファイル初期化
    > "$LOG_FILE"
    
    log "CloudFormationテンプレート検証開始"
    
    # 前提条件チェック
    if ! check_prerequisites; then
        exit 1
    fi
    
    # 検証実行
    local exit_code=0
    
    if [[ "$validate_all" == "true" ]]; then
        if ! validate_all_templates "$syntax_only" "$run_lint" "$run_security"; then
            exit_code=1
        fi
    elif [[ -n "$environment" ]]; then
        if ! validate_environment "$environment" "$syntax_only" "$run_lint" "$run_security"; then
            exit_code=1
        fi
    elif [[ -n "$template" ]]; then
        if ! validate_single_template "$template" "$param_file" "$syntax_only" "$run_lint" "$run_security"; then
            exit_code=1
        fi
    else
        error "テンプレート、環境、または--allオプションを指定してください"
        show_usage
        exit 1
    fi
    
    if [[ $exit_code -eq 0 ]]; then
        success "検証が正常に完了しました"
    else
        error "検証でエラーが発生しました"
    fi
    
    log "ログファイル: $LOG_FILE"
    exit $exit_code
}

# スクリプト実行
main "$@"