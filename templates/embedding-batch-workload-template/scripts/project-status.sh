#!/bin/bash

# プロジェクトステータス確認スクリプト
# プロジェクトの現在の状況とIaC化の状況を確認します

set -euo pipefail

# 設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# カラー設定
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ログ関数
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

success() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${GREEN}✅ $*${NC}"
}

warning() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${YELLOW}⚠️  $*${NC}"
}

error() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${RED}❌ $*${NC}"
}

info() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] ${BLUE}ℹ️  $*${NC}"
}

# 前提条件の確認
validate_prerequisites() {
    # 必要なコマンドの確認
    local required_commands=("aws" "jq")
    local missing_commands=()
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_commands+=("$cmd")
        fi
    done
    
    if [[ ${#missing_commands[@]} -gt 0 ]]; then
        error "必要なコマンドがインストールされていません: ${missing_commands[*]}"
        error "インストール方法:"
        for cmd in "${missing_commands[@]}"; do
            case "$cmd" in
                "aws") error "  AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html" ;;
                "jq") error "  jq: sudo apt-get install jq (Ubuntu) または brew install jq (macOS)" ;;
            esac
        done
        return 1
    fi
    
    # プロジェクトルートの検証
    if [[ ! -d "$PROJECT_ROOT" ]]; then
        error "プロジェクトルートディレクトリが見つかりません: $PROJECT_ROOT"
        return 1
    fi
    
    return 0
}

# ヘッダー表示
show_header() {
    echo -e "${BLUE}"
    echo "═══════════════════════════════════════════════════════════════════"
    echo "  Permission-aware RAG with FSx for NetApp ONTAP - Project Status"
    echo "═══════════════════════════════════════════════════════════════════"
    echo -e "${NC}"
}

# プロジェクト構造の確認
check_project_structure() {
    log "📁 プロジェクト構造の確認"
    
    local required_dirs=(
        "cdk"
        "lambda"
        "scripts"
        "docs"
        "examples"
        "config"
    )
    
    local missing_dirs=()
    
    for dir in "${required_dirs[@]}"; do
        if [[ -d "$PROJECT_ROOT/$dir" ]]; then
            success "$dir ディレクトリ存在"
        else
            error "$dir ディレクトリが見つかりません"
            missing_dirs+=("$dir")
        fi
    done
    
    if [[ ${#missing_dirs[@]} -eq 0 ]]; then
        success "プロジェクト構造確認完了"
    else
        warning "不足しているディレクトリ: ${missing_dirs[*]}"
    fi
}

# CDK IaC化状況の確認
check_cdk_status() {
    log "🏗️ CDK IaC化状況の確認"
    
    local cdk_dir="$PROJECT_ROOT/cdk"
    
    if [[ ! -d "$cdk_dir" ]]; then
        error "CDKディレクトリが見つかりません"
        return 1
    fi
    
    cd "$cdk_dir"
    
    # package.jsonの確認
    if [[ -f "package.json" ]]; then
        success "package.json 存在"
    else
        error "package.json が見つかりません"
    fi
    
    # TypeScriptファイルの確認
    local ts_files
    ts_files=$(find . -name "*.ts" -type f | wc -l)
    info "TypeScriptファイル数: $ts_files"
    
    # ビルド状況の確認
    if [[ -d "node_modules" ]]; then
        success "node_modules 存在（依存関係インストール済み）"
    else
        warning "node_modules が見つかりません（npm install が必要）"
    fi
    
    # コンパイル状況の確認
    if npm run build &> /dev/null; then
        success "TypeScriptコンパイル成功"
    else
        error "TypeScriptコンパイル失敗"
    fi
    
    cd "$PROJECT_ROOT"
}

# Lambda関数の確認
check_lambda_functions() {
    log "⚡ Lambda関数の確認"
    
    local lambda_dir="$PROJECT_ROOT/lambda"
    
    if [[ ! -d "$lambda_dir" ]]; then
        error "Lambdaディレクトリが見つかりません"
        return 1
    fi
    
    # Lambda関数ディレクトリの確認
    local lambda_functions=()
    while IFS= read -r -d '' dir; do
        lambda_functions+=("$(basename "$dir")")
    done < <(find "$lambda_dir" -mindepth 1 -maxdepth 1 -type d -print0)
    
    info "Lambda関数数: ${#lambda_functions[@]}"
    
    for func in "${lambda_functions[@]}"; do
        local func_dir="$lambda_dir/$func"
        
        if [[ -f "$func_dir/index.js" ]]; then
            success "$func: index.js 存在"
        else
            warning "$func: index.js が見つかりません"
        fi
    done
}

# スクリプトの確認
check_scripts() {
    log "📜 スクリプトの確認"
    
    local scripts_dir="$PROJECT_ROOT/scripts"
    
    if [[ ! -d "$scripts_dir" ]]; then
        error "Scriptsディレクトリが見つかりません"
        return 1
    fi
    
    # スクリプトファイルの確認
    local script_files
    script_files=$(find "$scripts_dir" -name "*.sh" -type f | wc -l)
    info "スクリプトファイル数: $script_files"
    
    # 実行権限の確認
    local executable_scripts
    executable_scripts=$(find "$scripts_dir" -name "*.sh" -perm +111 -type f | wc -l)
    info "実行可能スクリプト数: $executable_scripts"
    
    if [[ $executable_scripts -eq $script_files ]]; then
        success "すべてのスクリプトに実行権限あり"
    else
        warning "実行権限のないスクリプトがあります"
    fi
}

# AWS環境の確認
check_aws_environment() {
    log "☁️ AWS環境の確認"
    
    # AWS CLI確認
    if command -v aws &> /dev/null; then
        success "AWS CLI インストール済み"
        
        # 認証情報確認（セキュリティ強化版）
        local aws_check_result
        if command -v timeout >/dev/null 2>&1; then
            # timeoutコマンドが利用可能な場合
            if timeout 10 aws sts get-caller-identity &> /dev/null; then
                local account_id
                account_id=$(timeout 5 aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "unknown")
                
                # アカウントIDの検証とマスキング（セキュリティ向上）
                if [[ "$account_id" =~ ^[0-9]{12}$ ]]; then
                    local masked_account_id="${account_id:0:4}****${account_id:8:4}"
                    success "AWS認証情報設定済み（アカウント: $masked_account_id）"
                    
                    # リージョン情報も取得
                    local current_region
                    current_region=$(aws configure get region 2>/dev/null || echo "未設定")
                    info "設定リージョン: $current_region"
                else
                    success "AWS認証情報設定済み（アカウントID取得失敗）"
                fi
            else
                warning "AWS認証情報が設定されていません（タイムアウト: 10秒）"
            fi
        else
            # timeoutコマンドが利用できない場合の代替処理
            if aws sts get-caller-identity &> /dev/null; then
                local account_id
                account_id=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "unknown")
                
                if [[ "$account_id" =~ ^[0-9]{12}$ ]]; then
                    local masked_account_id="${account_id:0:4}****${account_id:8:4}"
                    success "AWS認証情報設定済み（アカウント: $masked_account_id）"
                    
                    local current_region
                    current_region=$(aws configure get region 2>/dev/null || echo "未設定")
                    info "設定リージョン: $current_region"
                else
                    success "AWS認証情報設定済み（アカウントID取得失敗）"
                fi
            else
                warning "AWS認証情報が設定されていません"
            fi
        fi
    else
        error "AWS CLI がインストールされていません"
    fi
    
    # CDK確認
    if command -v cdk &> /dev/null; then
        success "AWS CDK インストール済み"
    else
        error "AWS CDK がインストールされていません"
    fi
}

# 統合状況のサマリー
show_integration_summary() {
    log "📊 統合状況サマリー"
    
    echo -e "${BLUE}┌─────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${BLUE}│                    統合状況サマリー                          │${NC}"
    echo -e "${BLUE}├─────────────────────────────────────────────────────────────┤${NC}"
    
    # CDK IaC化状況
    if [[ -f "$PROJECT_ROOT/cdk/lib/stacks/embedding-workload-stack.ts" ]]; then
        echo -e "${BLUE}│${NC} ${GREEN}✅${NC} CDK IaC化                                           ${BLUE}│${NC}"
    else
        echo -e "${BLUE}│${NC} ${RED}❌${NC} CDK IaC化                                           ${BLUE}│${NC}"
    fi
    
    # Nova Multimodal統合
    if grep -r "nova-embed-multimodal" "$PROJECT_ROOT/lambda" &> /dev/null; then
        echo -e "${BLUE}│${NC} ${GREEN}✅${NC} Nova Multimodal Embeddings統合                      ${BLUE}│${NC}"
    else
        echo -e "${BLUE}│${NC} ${YELLOW}⚠️${NC} Nova Multimodal Embeddings統合                      ${BLUE}│${NC}"
    fi
    
    # Vector Database統合
    if [[ -f "$PROJECT_ROOT/cdk/lib/constructs/vector-database-integration.ts" ]]; then
        echo -e "${BLUE}│${NC} ${GREEN}✅${NC} Vector Database統合                                 ${BLUE}│${NC}"
    else
        echo -e "${BLUE}│${NC} ${RED}❌${NC} Vector Database統合                                 ${BLUE}│${NC}"
    fi
    
    echo -e "${BLUE}└─────────────────────────────────────────────────────────────┘${NC}"
}

# 推奨アクション
show_recommendations() {
    log "💡 推奨アクション"
    
    echo -e "${YELLOW}次のステップ:${NC}"
    
    # CDKビルドが必要な場合
    if [[ ! -d "$PROJECT_ROOT/cdk/node_modules" ]]; then
        echo "  1. CDK依存関係のインストール:"
        echo "     cd $PROJECT_ROOT/cdk && npm install"
    fi
    
    # プロジェクト更新
    echo "  2. プロジェクト全体の更新:"
    echo "     $PROJECT_ROOT/scripts/update-project.sh --target both --components all"
    
    # デプロイ
    echo "  3. マルチコンピュート統合デプロイ:"
    echo "     $PROJECT_ROOT/scripts/deploy-multicompute.sh --compute-type all"
}

# メイン処理
main() {
    show_header
    
    check_project_structure
    echo
    
    check_cdk_status
    echo
    
    check_lambda_functions
    echo
    
    check_scripts
    echo
    
    check_aws_environment
    echo
    
    show_integration_summary
    echo
    show_recommendations
    
    # 実行時間の計算
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # 結果サマリー
    if [[ ${#failed_checks[@]} -eq 0 ]]; then
        success "プロジェクトステータス確認完了 (実行時間: ${duration}秒)"
        return 0
    else
        warning "プロジェクトステータス確認完了（一部失敗） (実行時間: ${duration}秒)"
        warning "失敗した確認項目: ${failed_checks[*]}"
        return 1
    fi
}

# クリーンアップ関数
cleanup() {
    local exit_code=$?
    
    # 機密変数のクリア
    unset account_id masked_account_id 2>/dev/null || true
    
    if [[ $exit_code -ne 0 ]]; then
        error "スクリプトがエラーで終了しました (終了コード: $exit_code)"
    fi
    
    exit $exit_code
}

# シグナルハンドラの設定
trap cleanup EXIT INT TERM

# メイン処理の実行
main