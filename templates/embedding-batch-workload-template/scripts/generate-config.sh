#!/bin/bash

# Configuration Template Generator Script
# FSx for NetApp ONTAP Embedding Batch Workload用設定テンプレート生成スクリプト

set -euo pipefail

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
EXAMPLES_DIR="${PROJECT_ROOT}/examples"
CONFIG_DIR="${PROJECT_ROOT}/config"

# 色付きログ関数
log_info() {
    echo -e "\033[32m[INFO]\033[0m $1"
}

log_warn() {
    echo -e "\033[33m[WARN]\033[0m $1"
}

log_error() {
    echo -e "\033[31m[ERROR]\033[0m $1"
}

# ヘルプメッセージ
show_help() {
    cat << EOF
Configuration Template Generator for FSx for NetApp ONTAP Embedding Batch Workload

使用方法:
    $0 [オプション]

オプション:
    -t, --template TYPE     テンプレートタイプ (basic|enterprise|multi-region|new-infrastructure)
    -o, --output FILE       出力ファイルパス (デフォルト: config/deployment-config.json)
    -p, --project NAME      プロジェクト名
    -e, --environment ENV   環境名 (dev|test|staging|prod)
    -r, --region REGION     AWSリージョン
    --vpc-id VPC_ID         既存VPC ID
    --fsx-id FSX_ID         既存FSx ファイルシステムID
    --interactive           対話モードで設定を入力
    --validate              生成後に設定を検証
    -h, --help              このヘルプメッセージを表示

テンプレートタイプ:
    basic               基本的な開発環境用設定
    enterprise          本番環境用のエンタープライズ設定
    multi-region        マルチリージョン対応設定
    new-infrastructure  新規VPC・FSx作成用設定

例:
    # 基本テンプレートを生成
    $0 --template basic --project my-project --environment dev

    # 対話モードで設定を作成
    $0 --interactive

    # エンタープライズテンプレートを指定ファイルに出力
    $0 --template enterprise --output /path/to/config.json --validate

EOF
}

# デフォルト値
TEMPLATE_TYPE=""
OUTPUT_FILE="${CONFIG_DIR}/deployment-config.json"
PROJECT_NAME=""
ENVIRONMENT=""
REGION=""
VPC_ID=""
FSX_ID=""
INTERACTIVE=false
VALIDATE=false

# コマンドライン引数の解析
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--template)
            TEMPLATE_TYPE="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        -p|--project)
            PROJECT_NAME="$2"
            shift 2
            ;;
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        --vpc-id)
            VPC_ID="$2"
            shift 2
            ;;
        --fsx-id)
            FSX_ID="$2"
            shift 2
            ;;
        --interactive)
            INTERACTIVE=true
            shift
            ;;
        --validate)
            VALIDATE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "不明なオプション: $1"
            show_help
            exit 1
            ;;
    esac
done

# 対話モード
interactive_mode() {
    log_info "対話モードで設定を作成します"
    echo

    # テンプレートタイプの選択
    echo "テンプレートタイプを選択してください:"
    echo "1) basic - 基本的な開発環境用設定"
    echo "2) enterprise - 本番環境用のエンタープライズ設定"
    echo "3) multi-region - マルチリージョン対応設定"
    echo "4) new-infrastructure - 新規VPC・FSx作成用設定"
    read -p "選択 (1-4): " template_choice

    case $template_choice in
        1) TEMPLATE_TYPE="basic" ;;
        2) TEMPLATE_TYPE="enterprise" ;;
        3) TEMPLATE_TYPE="multi-region" ;;
        4) TEMPLATE_TYPE="new-infrastructure" ;;
        *) log_error "無効な選択です"; exit 1 ;;
    esac

    # プロジェクト名
    read -p "プロジェクト名を入力してください: " PROJECT_NAME
    if [[ -z "$PROJECT_NAME" ]]; then
        log_error "プロジェクト名は必須です"
        exit 1
    fi

    # 環境名
    echo "環境を選択してください:"
    echo "1) dev - 開発環境"
    echo "2) test - テスト環境"
    echo "3) staging - ステージング環境"
    echo "4) prod - 本番環境"
    read -p "選択 (1-4): " env_choice

    case $env_choice in
        1) ENVIRONMENT="dev" ;;
        2) ENVIRONMENT="test" ;;
        3) ENVIRONMENT="staging" ;;
        4) ENVIRONMENT="prod" ;;
        *) log_error "無効な選択です"; exit 1 ;;
    esac

    # リージョン
    read -p "AWSリージョンを入力してください (例: ap-northeast-1): " REGION
    if [[ -z "$REGION" ]]; then
        REGION="ap-northeast-1"
        log_info "デフォルトリージョン ${REGION} を使用します"
    fi

    # インフラ設定
    if [[ "$TEMPLATE_TYPE" != "new-infrastructure" ]]; then
        read -p "既存VPC IDを入力してください: " VPC_ID
        read -p "既存FSx ファイルシステムIDを入力してください: " FSX_ID
    fi

    # 出力ファイル
    read -p "出力ファイルパス (デフォルト: ${OUTPUT_FILE}): " output_input
    if [[ -n "$output_input" ]]; then
        OUTPUT_FILE="$output_input"
    fi

    # 検証オプション
    read -p "生成後に設定を検証しますか? (y/N): " validate_input
    if [[ "$validate_input" =~ ^[Yy]$ ]]; then
        VALIDATE=true
    fi
}

# テンプレートファイルの選択
select_template_file() {
    case "$TEMPLATE_TYPE" in
        basic)
            echo "${EXAMPLES_DIR}/basic-config.json"
            ;;
        enterprise)
            echo "${EXAMPLES_DIR}/enterprise-config.json"
            ;;
        multi-region)
            echo "${EXAMPLES_DIR}/multi-region-config.json"
            ;;
        new-infrastructure)
            echo "${EXAMPLES_DIR}/new-infrastructure-config.json"
            ;;
        *)
            log_error "無効なテンプレートタイプ: $TEMPLATE_TYPE"
            exit 1
            ;;
    esac
}

# 設定ファイルのカスタマイズ
customize_config() {
    local template_file="$1"
    local output_file="$2"

    log_info "テンプレートをカスタマイズしています..."

    # テンプレートファイルをコピー
    cp "$template_file" "$output_file"

    # プロジェクト名の置換
    if [[ -n "$PROJECT_NAME" ]]; then
        if command -v jq >/dev/null 2>&1; then
            jq --arg name "$PROJECT_NAME" '.projectName = $name' "$output_file" > "${output_file}.tmp" && mv "${output_file}.tmp" "$output_file"
        else
            sed -i.bak "s/\"projectName\": \"[^\"]*\"/\"projectName\": \"$PROJECT_NAME\"/" "$output_file"
            rm -f "${output_file}.bak"
        fi
    fi

    # 環境名の置換
    if [[ -n "$ENVIRONMENT" ]]; then
        if command -v jq >/dev/null 2>&1; then
            jq --arg env "$ENVIRONMENT" '.environment = $env' "$output_file" > "${output_file}.tmp" && mv "${output_file}.tmp" "$output_file"
        else
            sed -i.bak "s/\"environment\": \"[^\"]*\"/\"environment\": \"$ENVIRONMENT\"/" "$output_file"
            rm -f "${output_file}.bak"
        fi
    fi

    # リージョンの置換
    if [[ -n "$REGION" ]]; then
        if command -v jq >/dev/null 2>&1; then
            jq --arg region "$REGION" '.region = $region' "$output_file" > "${output_file}.tmp" && mv "${output_file}.tmp" "$output_file"
        else
            sed -i.bak "s/\"region\": \"[^\"]*\"/\"region\": \"$REGION\"/" "$output_file"
            rm -f "${output_file}.bak"
        fi
    fi

    # VPC IDの置換
    if [[ -n "$VPC_ID" ]]; then
        if command -v jq >/dev/null 2>&1; then
            jq --arg vpcId "$VPC_ID" '.vpc.existing.vpcId = $vpcId' "$output_file" > "${output_file}.tmp" && mv "${output_file}.tmp" "$output_file"
        else
            sed -i.bak "s/\"vpcId\": \"vpc-[^\"]*\"/\"vpcId\": \"$VPC_ID\"/" "$output_file"
            rm -f "${output_file}.bak"
        fi
    fi

    # FSx IDの置換
    if [[ -n "$FSX_ID" ]]; then
        if command -v jq >/dev/null 2>&1; then
            jq --arg fsxId "$FSX_ID" '.fsx.existing.fileSystemId = $fsxId' "$output_file" > "${output_file}.tmp" && mv "${output_file}.tmp" "$output_file"
        else
            sed -i.bak "s/\"fileSystemId\": \"fs-[^\"]*\"/\"fileSystemId\": \"$FSX_ID\"/" "$output_file"
            rm -f "${output_file}.bak"
        fi
    fi
}

# 設定の検証
validate_config() {
    local config_file="$1"

    log_info "設定ファイルを検証しています..."

    # JSONの構文チェック
    if command -v jq >/dev/null 2>&1; then
        if ! jq empty "$config_file" 2>/dev/null; then
            log_error "JSONの構文エラーがあります"
            return 1
        fi
    else
        log_warn "jqがインストールされていないため、JSON構文チェックをスキップします"
    fi

    # CDKを使用した検証（オプション）
    if [[ -f "${PROJECT_ROOT}/cdk/package.json" ]]; then
        log_info "CDK設定検証を実行しています..."
        cd "${PROJECT_ROOT}/cdk"
        
        if npm list --depth=0 | grep -q "aws-cdk-lib"; then
            # TypeScriptコンパイルテスト
            if npx tsc --noEmit --skipLibCheck 2>/dev/null; then
                log_info "TypeScript設定検証: 成功"
            else
                log_warn "TypeScript設定検証: 警告あり"
            fi
        else
            log_warn "CDK依存関係がインストールされていません"
        fi
        
        cd - >/dev/null
    fi

    log_info "設定検証完了"
}

# メイン処理
main() {
    log_info "FSx for NetApp ONTAP Embedding Batch Workload 設定テンプレート生成ツール"
    echo

    # 対話モードの実行
    if [[ "$INTERACTIVE" == true ]]; then
        interactive_mode
    fi

    # テンプレートタイプの検証
    if [[ -z "$TEMPLATE_TYPE" ]]; then
        log_error "テンプレートタイプが指定されていません。--template オプションまたは --interactive を使用してください"
        show_help
        exit 1
    fi

    # テンプレートファイルの選択
    template_file=$(select_template_file)
    if [[ ! -f "$template_file" ]]; then
        log_error "テンプレートファイルが見つかりません: $template_file"
        exit 1
    fi

    # 出力ディレクトリの作成
    output_dir=$(dirname "$OUTPUT_FILE")
    if [[ ! -d "$output_dir" ]]; then
        log_info "出力ディレクトリを作成しています: $output_dir"
        mkdir -p "$output_dir"
    fi

    # 設定ファイルのカスタマイズ
    customize_config "$template_file" "$OUTPUT_FILE"

    log_info "設定ファイルを生成しました: $OUTPUT_FILE"

    # 設定の検証
    if [[ "$VALIDATE" == true ]]; then
        validate_config "$OUTPUT_FILE"
    fi

    # 次のステップの案内
    echo
    log_info "次のステップ:"
    echo "1. 生成された設定ファイルを確認・編集してください: $OUTPUT_FILE"
    echo "2. 必要に応じて VPC ID、FSx ID、サブネット ID などを更新してください"
    echo "3. デプロイを実行してください: cd cdk && npm install && npx cdk deploy"
    echo
    log_info "設定テンプレート生成が完了しました"
}

# スクリプト実行
main "$@"
"