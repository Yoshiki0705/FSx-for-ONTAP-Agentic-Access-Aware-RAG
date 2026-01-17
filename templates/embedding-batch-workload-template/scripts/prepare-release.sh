#!/bin/bash
# リリースパッケージ準備スクリプト

set -euo pipefail

# セキュリティ設定
umask 077  # 作成されるファイルのパーミッションを制限
readonly SCRIPT_NAME="$(basename "$0")"

# エラートラップ設定
trap 'cleanup_on_error; echo "❌ エラー: 行 $LINENO でスクリプトが失敗しました" >&2; exit 1' ERR
trap 'cleanup_on_exit' EXIT

# スクリプトディレクトリの取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 設定ファイル読み込み
load_config() {
    local config_file="${PROJECT_ROOT}/scripts/config/release-config.json"
    
    if [[ -f "$config_file" ]]; then
        # JSON設定ファイルから読み込み
        DEFAULT_SKIP_TESTS=$(jq -r '.defaults.skipTests // false' "$config_file" 2>/dev/null || echo "false")
        DEFAULT_SKIP_VALIDATION=$(jq -r '.defaults.skipValidation // false' "$config_file" 2>/dev/null || echo "false")
        DEFAULT_INCLUDE_TEMPLATES=$(jq -r '.defaults.includeGeneratedTemplates // false' "$config_file" 2>/dev/null || echo "false")
        REQUIRED_NODE_VERSION=$(jq -r '.requirements.nodeVersion // "18.0.0"' "$config_file" 2>/dev/null || echo "18.0.0")
    else
        # デフォルト値
        DEFAULT_SKIP_TESTS=false
        DEFAULT_SKIP_VALIDATION=false
        DEFAULT_INCLUDE_TEMPLATES=false
        REQUIRED_NODE_VERSION="18.0.0"
    fi
}

# 設定（環境変数で上書き可能）
readonly RELEASE_DIR="${RELEASE_DIR:-${PROJECT_ROOT}/release}"
VERSION="${VERSION:-}"
INCLUDE_GENERATED_TEMPLATES="${INCLUDE_GENERATED_TEMPLATES:-$DEFAULT_INCLUDE_TEMPLATES}"
SKIP_TESTS="${SKIP_TESTS:-$DEFAULT_SKIP_TESTS}"
SKIP_VALIDATION="${SKIP_VALIDATION:-$DEFAULT_SKIP_VALIDATION}"

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# クリーンアップ関数
cleanup_on_error() {
    local exit_code=$?
    error "リリース準備中にエラーが発生しました (終了コード: $exit_code)"
    # 機密情報のクリア
    unset VERSION AWS_PROFILE AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY 2>/dev/null || true
    # 一時ファイルの削除
    [[ -d "${RELEASE_DIR:-}" ]] && rm -rf "${RELEASE_DIR}" 2>/dev/null || true
}

cleanup_on_exit() {
    # 機密情報のクリア
    unset VERSION AWS_PROFILE AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY 2>/dev/null || true
}

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
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $sanitized_message"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

# 使用方法表示
show_usage() {
    cat << EOF
リリースパッケージ準備スクリプト

使用方法: $0 [OPTIONS]

OPTIONS:
    -v, --version <version>        リリースバージョン (例: 1.0.0)
    -g, --generate-templates       CloudFormationテンプレートを生成
    -s, --skip-tests              テストをスキップ
    -k, --skip-validation         検証をスキップ
    -c, --clean                   既存のリリースディレクトリをクリーン
    -h, --help                    このヘルプを表示

例:
    $0 --version 1.0.0 --generate-templates
    $0 -v 1.0.0 -g -s
EOF
}

# 前提条件チェック
check_prerequisites() {
    log "前提条件をチェック中..."
    
    # 必要なツール
    local tools=("node" "npm" "git" "jq" "tar" "zip")
    
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error "$tool がインストールされていません"
            return 1
        fi
    done
    
    # Node.js バージョンチェック
    local node_version
    node_version=$(node --version | sed 's/v//')
    local required_version="18.0.0"
    
    if ! printf '%s\n%s\n' "$required_version" "$node_version" | sort -V -C; then
        error "Node.js $required_version 以上が必要です (現在: $node_version)"
        return 1
    fi
    
    # Git リポジトリチェック
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        error "Gitリポジトリではありません"
        return 1
    fi
    
    # 未コミットの変更チェック
    if ! git diff-index --quiet HEAD --; then
        warning "未コミットの変更があります"
        read -p "続行しますか？ (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error "リリース準備を中止しました"
            return 1
        fi
    fi
    
    success "前提条件チェック完了"
}

# 入力値検証関数
validate_input() {
    local input="$1"
    local field_name="$2"
    local max_length="${3:-100}"
    
    # 長さ制限チェック
    if [[ ${#input} -gt $max_length ]]; then
        error "$field_name が長すぎます（最大${max_length}文字）: ${#input}文字"
        return 1
    fi
    
    # 危険な文字のチェック
    if [[ "$input" =~ [;&\|`\$\(\)] ]]; then
        error "$field_name に危険な文字が含まれています: $input"
        return 1
    fi
    
    return 0
}

# バージョン検証（セキュリティ強化版）
validate_version() {
    local version="$1"
    
    # 入力値検証
    if ! validate_input "$version" "バージョン" 20; then
        return 1
    fi
    
    # バージョン形式チェック（より厳密）
    if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?$ ]]; then
        error "無効なバージョン形式: $version (例: 1.0.0, 1.0.0-beta.1)"
        return 1
    fi
    
    # セマンティックバージョニング検証
    local major minor patch
    IFS='.' read -r major minor patch <<< "${version%%-*}"
    
    if [[ $major -gt 999 || $minor -gt 999 || $patch -gt 999 ]]; then
        error "バージョン番号が大きすぎます: $version"
        return 1
    fi
    
    # 既存のタグチェック（セキュリティ強化）
    if git tag -l | grep -q "^v$(printf '%s' "$version" | sed 's/[[\.*^$()+?{|]/\\&/g')$"; then
        error "バージョン v$version は既に存在します"
        return 1
    fi
    
    success "バージョン検証完了: $version"
}

# テスト実行
run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        warning "テストをスキップしました"
        return 0
    fi
    
    log "テスト実行中..."
    
    # CDK テスト
    cd "${PROJECT_ROOT}/cdk"
    
    # 依存関係インストール
    npm ci
    
    # ビルド
    npm run build
    
    # テスト実行
    npm test
    
    # リンターチェック
    npm run lint
    
    cd "$PROJECT_ROOT"
    
    success "テスト完了"
}

# 検証実行
run_validation() {
    if [[ "$SKIP_VALIDATION" == "true" ]]; then
        warning "検証をスキップしました"
        return 0
    fi
    
    log "検証実行中..."
    
    # CloudFormationテンプレート検証
    if [[ -f "${SCRIPT_DIR}/validate-cloudformation.sh" ]]; then
        "${SCRIPT_DIR}/validate-cloudformation.sh" --all --lint --security
    fi
    
    # 設定ファイル検証
    find "${PROJECT_ROOT}/examples" -name "*.json" | while read -r config; do
        if ! jq empty "$config" 2>/dev/null; then
            error "設定ファイル構文エラー: $config"
            return 1
        fi
    done
    
    # スクリプト検証
    if command -v shellcheck &> /dev/null; then
        find "${PROJECT_ROOT}/scripts" -name "*.sh" | while read -r script; do
            shellcheck "$script" || warning "ShellCheck警告: $script"
        done
    fi
    
    success "検証完了"
}

# CloudFormationテンプレート生成（並列処理版）
generate_templates() {
    if [[ "$INCLUDE_GENERATED_TEMPLATES" != "true" ]]; then
        info "CloudFormationテンプレート生成をスキップ"
        return 0
    fi
    
    log "CloudFormationテンプレート生成中..."
    
    cd "${PROJECT_ROOT}/cdk"
    
    # 各環境用のテンプレート生成（並列実行）
    local environments=("dev" "staging" "prod")
    local pids=()
    
    # 並列実行関数
    generate_template_for_env() {
        local env="$1"
        local output_dir="${PROJECT_ROOT}/cloudformation-templates/generated/$env"
        
        mkdir -p "$output_dir"
        
        # 環境固有の設定でCDK synth実行
        CDK_ENVIRONMENT="$env" \
        CDK_CONFIG_FILE="../examples/basic-config.json" \
        npx cdk synth --output "$output_dir" --path-metadata false --version-reporting false \
        > "${output_dir}/generation.log" 2>&1
        
        echo "環境 $env のテンプレート生成完了" > "${output_dir}/status.txt"
    }
    
    # 各環境を並列で処理
    for env in "${environments[@]}"; do
        log "環境 $env のテンプレート生成開始..."
        generate_template_for_env "$env" &
        pids+=($!)
    done
    
    # 全ての並列処理の完了を待機
    local failed_envs=()
    for i in "${!pids[@]}"; do
        local pid=${pids[$i]}
        local env=${environments[$i]}
        
        if wait "$pid"; then
            success "環境 $env のテンプレート生成完了"
        else
            error "環境 $env のテンプレート生成失敗"
            failed_envs+=("$env")
        fi
    done
    
    cd "$PROJECT_ROOT"
    
    # 失敗した環境がある場合はエラー
    if [[ ${#failed_envs[@]} -gt 0 ]]; then
        error "以下の環境でテンプレート生成に失敗しました: ${failed_envs[*]}"
        return 1
    fi
    
    success "CloudFormationテンプレート生成完了（並列処理）"
}

# 進捗表示関数
show_progress() {
    local current="$1"
    local total="$2"
    local item="$3"
    local percentage=$((current * 100 / total))
    
    printf "\r${BLUE}[%3d%%]${NC} (%d/%d) %s" "$percentage" "$current" "$total" "$item"
    
    if [[ $current -eq $total ]]; then
        echo ""  # 最後に改行
    fi
}

# リリースディレクトリ準備（進捗表示付き）
prepare_release_directory() {
    log "リリースディレクトリ準備中..."
    
    # 既存のリリースディレクトリをクリーン
    if [[ -d "$RELEASE_DIR" ]]; then
        rm -rf "$RELEASE_DIR"
    fi
    
    # セキュリティ: 適切なパーミッションでディレクトリ作成
    mkdir -p "$RELEASE_DIR"
    chmod 755 "$RELEASE_DIR"
    
    # 必要なファイル・ディレクトリをコピー
    local items_to_copy=(
        "cdk"
        "scripts"
        "docs"
        "examples"
        "cloudformation-templates"
        "lambda"
        "README.md"
        "LICENSE"
        "CONTRIBUTING.md"
        "CHANGELOG.md"
        "CODE_OF_CONDUCT.md"
        ".gitignore"
        ".github"
    )
    
    local total_items=${#items_to_copy[@]}
    local current_item=0
    
    for item in "${items_to_copy[@]}"; do
        ((current_item++))
        show_progress "$current_item" "$total_items" "$item"
        
        if [[ -e "${PROJECT_ROOT}/$item" ]]; then
            # セキュリティ: シンボリックリンクの検証
            if [[ -L "${PROJECT_ROOT}/$item" ]]; then
                warning "シンボリックリンクをスキップ: $item"
                continue
            fi
            
            cp -r "${PROJECT_ROOT}/$item" "$RELEASE_DIR/"
        else
            warning "アイテムが見つかりません: $item"
        fi
    done
    
    success "リリースディレクトリ準備完了"
}

# パッケージ情報更新
update_package_info() {
    log "パッケージ情報更新中..."
    
    # package.json のバージョン更新
    if [[ -f "${RELEASE_DIR}/cdk/package.json" ]]; then
        jq --arg version "$VERSION" '.version = $version' \
            "${RELEASE_DIR}/cdk/package.json" > "${RELEASE_DIR}/cdk/package.json.tmp"
        mv "${RELEASE_DIR}/cdk/package.json.tmp" "${RELEASE_DIR}/cdk/package.json"
        info "CDK package.json バージョン更新: $VERSION"
    fi
    
    # README.md のバージョン情報更新
    if [[ -f "${RELEASE_DIR}/README.md" ]]; then
        sed -i.bak "s/Version: v[0-9]\+\.[0-9]\+\.[0-9]\+/Version: v$VERSION/g" "${RELEASE_DIR}/README.md"
        rm -f "${RELEASE_DIR}/README.md.bak"
        info "README.md バージョン更新: $VERSION"
    fi
    
    # CHANGELOG.md の更新日付設定
    if [[ -f "${RELEASE_DIR}/CHANGELOG.md" ]]; then
        local today
        today=$(date +%Y-%m-%d)
        sed -i.bak "s/## \[Unreleased\]/## [Unreleased]\n\n## [$VERSION] - $today/g" "${RELEASE_DIR}/CHANGELOG.md"
        rm -f "${RELEASE_DIR}/CHANGELOG.md.bak"
        info "CHANGELOG.md 更新: $VERSION ($today)"
    fi
    
    success "パッケージ情報更新完了"
}

# 不要ファイル削除
cleanup_release_directory() {
    log "不要ファイル削除中..."
    
    # node_modules削除
    find "$RELEASE_DIR" -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
    
    # .git関連削除
    find "$RELEASE_DIR" -name ".git*" -not -name ".github" -not -name ".gitignore" -exec rm -rf {} + 2>/dev/null || true
    
    # テスト関連ファイル削除
    find "$RELEASE_DIR" -name "*.test.ts" -delete 2>/dev/null || true
    find "$RELEASE_DIR" -name "*.test.js" -delete 2>/dev/null || true
    find "$RELEASE_DIR" -name "test" -type d -exec rm -rf {} + 2>/dev/null || true
    
    # ビルド成果物削除
    find "$RELEASE_DIR" -name "*.js.map" -delete 2>/dev/null || true
    find "$RELEASE_DIR" -name "*.d.ts" -delete 2>/dev/null || true
    find "$RELEASE_DIR" -name "cdk.out" -type d -exec rm -rf {} + 2>/dev/null || true
    
    # 一時ファイル削除
    find "$RELEASE_DIR" -name "*.tmp" -delete 2>/dev/null || true
    find "$RELEASE_DIR" -name "*.bak" -delete 2>/dev/null || true
    find "$RELEASE_DIR" -name ".DS_Store" -delete 2>/dev/null || true
    
    success "不要ファイル削除完了"
}

# アーカイブ作成
create_archives() {
    log "アーカイブ作成中..."
    
    local archive_name="embedding-batch-workload-v$VERSION"
    
    cd "$(dirname "$RELEASE_DIR")"
    
    # tar.gz アーカイブ
    tar -czf "${archive_name}.tar.gz" -C "$RELEASE_DIR" .
    success "tar.gz アーカイブ作成完了: ${archive_name}.tar.gz"
    
    # zip アーカイブ
    (cd "$RELEASE_DIR" && zip -r "../${archive_name}.zip" .)
    success "zip アーカイブ作成完了: ${archive_name}.zip"
    
    # チェックサム生成
    sha256sum "${archive_name}.tar.gz" > "${archive_name}.tar.gz.sha256"
    sha256sum "${archive_name}.zip" > "${archive_name}.zip.sha256"
    
    info "アーカイブサイズ:"
    ls -lh "${archive_name}".{tar.gz,zip}
    
    cd "$PROJECT_ROOT"
}

# リリースノート生成
generate_release_notes() {
    log "リリースノート生成中..."
    
    local release_notes_file="${PROJECT_ROOT}/RELEASE_NOTES_v${VERSION}.md"
    
    cat > "$release_notes_file" << EOF
# Release Notes - v${VERSION}

## 📋 Overview

This release includes comprehensive dual deployment support for both CDK and CloudFormation, along with extensive documentation and tooling improvements.

## ✨ New Features

### Dual Deployment Support
- Complete CDK and CloudFormation deployment options
- Unified deployment script for both methods
- Migration tools between deployment methods

### Enhanced Documentation
- 15+ comprehensive guides covering all aspects
- Step-by-step deployment instructions
- Troubleshooting guides for both deployment methods

### Advanced Tooling
- CloudFormation template validation
- Real-time stack monitoring
- Drift detection and alerting

### Security Enhancements
- KMS encryption support
- VPC integration
- IAM least privilege implementation

## 🔧 Improvements

- Simplified architecture and deployment process
- Enhanced error handling and logging
- Performance optimizations
- Cost optimization features

## 📚 Documentation

- [Deployment Selection Guide](./docs/DEPLOYMENT_SELECTION_GUIDE.md)
- [CDK Deployment Guide](./docs/CDK_DEPLOYMENT_GUIDE.md)
- [CloudFormation Deployment Guide](./docs/CLOUDFORMATION_DEPLOYMENT_GUIDE.md)
- [Configuration Guide](./docs/CONFIGURATION_GUIDE.md)
- [Migration Guide](./docs/MIGRATION_GUIDE.md)

## 🚀 Quick Start

### CDK Deployment
\`\`\`bash
./scripts/unified-deploy.sh --method cdk --env dev --config config/dev.json
\`\`\`

### CloudFormation Deployment
\`\`\`bash
./scripts/unified-deploy.sh --method cloudformation --env dev
\`\`\`

## 📦 Package Contents

- CDK constructs and stacks
- CloudFormation templates
- Lambda functions
- Deployment scripts
- Comprehensive documentation
- Configuration examples

## 🔒 Security

- End-to-end encryption
- VPC integration
- IAM least privilege
- Security group configurations

## 💰 Cost Optimization

- Spot instance support (up to 90% cost reduction)
- Auto-scaling capabilities
- Resource lifecycle management

## 🌍 Multi-Region Support

- Support for 15+ AWS regions
- Region-specific configurations
- Data residency compliance

## 🆘 Support

- GitHub Issues for bug reports
- GitHub Discussions for questions
- Comprehensive documentation
- Community support

## 📄 License

MIT License - see LICENSE file for details.

---

**Release Date**: $(date +%Y-%m-%d)
**Version**: v${VERSION}
**Compatibility**: AWS CDK v2.x, Node.js 18.x+
EOF
    
    success "リリースノート生成完了: $release_notes_file"
}

# メイン処理
main() {
    # 設定読み込み
    load_config
    
    # パラメータ解析
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--version)
                VERSION="$2"
                shift 2
                ;;
            -g|--generate-templates)
                INCLUDE_GENERATED_TEMPLATES=true
                shift
                ;;
            -s|--skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            -k|--skip-validation)
                SKIP_VALIDATION=true
                shift
                ;;
            -c|--clean)
                if [[ -d "$RELEASE_DIR" ]]; then
                    rm -rf "$RELEASE_DIR"
                    success "リリースディレクトリをクリーンしました"
                fi
                exit 0
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
    
    # バージョン必須チェック
    if [[ -z "$VERSION" ]]; then
        error "バージョンを指定してください"
        show_usage
        exit 1
    fi
    
    log "リリースパッケージ準備開始: v$VERSION"
    
    # 実行手順
    check_prerequisites
    validate_version "$VERSION"
    run_tests
    run_validation
    generate_templates
    prepare_release_directory
    update_package_info
    cleanup_release_directory
    create_archives
    generate_release_notes
    
    success "リリースパッケージ準備完了: v$VERSION"
    
    echo ""
    echo -e "${PURPLE}=== リリース情報 ===${NC}"
    echo -e "バージョン: ${CYAN}v$VERSION${NC}"
    echo -e "リリースディレクトリ: ${CYAN}$RELEASE_DIR${NC}"
    echo -e "アーカイブ: ${CYAN}embedding-batch-workload-v$VERSION.{tar.gz,zip}${NC}"
    echo -e "リリースノート: ${CYAN}RELEASE_NOTES_v$VERSION.md${NC}"
    echo ""
    echo -e "${YELLOW}次のステップ:${NC}"
    echo "1. リリースノートを確認・編集"
    echo "2. Git タグを作成: git tag -a v$VERSION -m 'Release v$VERSION'"
    echo "3. GitHub にプッシュ: git push origin v$VERSION"
    echo "4. GitHub Release を作成してアーカイブをアップロード"
}

# スクリプト実行
main "$@"