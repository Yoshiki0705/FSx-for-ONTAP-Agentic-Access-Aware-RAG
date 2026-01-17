#!/bin/bash

# EC2同期スクリプト
# ローカルとEC2環境の同期を行います

set -euo pipefail

# 設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_ROOT/logs/ec2-sync-$(date +%Y%m%d-%H%M%S).log"

# 設定ファイルの読み込み
CONFIG_FILE="${PROJECT_ROOT}/config/sync-config.json"
if [[ -f "$CONFIG_FILE" ]]; then
    log "設定ファイルを読み込み中: $CONFIG_FILE"
    # jqが利用可能な場合は設定ファイルから値を読み込み
    if command -v jq >/dev/null 2>&1; then
        EC2_HOST_FROM_CONFIG=$(jq -r '.ec2.host // empty' "$CONFIG_FILE" 2>/dev/null)
        EC2_USER_FROM_CONFIG=$(jq -r '.ec2.user // empty' "$CONFIG_FILE" 2>/dev/null)
        EC2_KEY_FROM_CONFIG=$(jq -r '.ec2.keyPath // empty' "$CONFIG_FILE" 2>/dev/null)
        EC2_PROJECT_DIR_FROM_CONFIG=$(jq -r '.ec2.projectDir // empty' "$CONFIG_FILE" 2>/dev/null)
        
        # 設定ファイルの値が存在する場合は使用
        [[ -n "$EC2_HOST_FROM_CONFIG" ]] && EC2_HOST="$EC2_HOST_FROM_CONFIG"
        [[ -n "$EC2_USER_FROM_CONFIG" ]] && EC2_USER="$EC2_USER_FROM_CONFIG"
        [[ -n "$EC2_KEY_FROM_CONFIG" ]] && EC2_KEY="$EC2_KEY_FROM_CONFIG"
        [[ -n "$EC2_PROJECT_DIR_FROM_CONFIG" ]] && EC2_PROJECT_DIR="$EC2_PROJECT_DIR_FROM_CONFIG"
    fi
fi

# EC2接続情報（環境変数から取得、デフォルト値設定）
EC2_HOST="${EC2_HOST:-ec2-54-235-34-127.compute-1.amazonaws.com}"
EC2_USER="${EC2_USER:-ubuntu}"
EC2_KEY="${EC2_KEY:-/Users/yoshiki/Downloads/Archive/system-files/fujiwara-useast1.pem}"
EC2_PROJECT_DIR="${EC2_PROJECT_DIR:-/home/ubuntu/rag/Permission-aware-RAG-FSxN-CDK-master}"

# セキュリティ検証
validate_security_settings() {
    # SSH鍵ファイルの存在確認
    if [[ ! -f "$EC2_KEY" ]]; then
        error "SSH鍵ファイルが見つかりません: $EC2_KEY"
        exit 1
    fi
    
    # SSH鍵のパーミッション確認（600または400）
    local key_perms
    key_perms=$(stat -c "%a" "$EC2_KEY" 2>/dev/null || stat -f "%A" "$EC2_KEY" 2>/dev/null)
    if [[ "$key_perms" != "600" && "$key_perms" != "400" ]]; then
        log "SSH鍵のパーミッションを修正中..."
        chmod 600 "$EC2_KEY"
    fi
    
    # ホスト名の検証（DNSインジェクション対策）
    if [[ ! "$EC2_HOST" =~ ^[a-zA-Z0-9.-]+$ ]]; then
        error "無効なホスト名形式: $EC2_HOST"
        exit 1
    fi
    
    # ユーザー名の検証
    if [[ ! "$EC2_USER" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        error "無効なユーザー名形式: $EC2_USER"
        exit 1
    fi
}

# ログディレクトリの作成
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

ローカルとEC2環境の同期を行います。

オプション:
  -d, --direction DIRECTION     同期方向 (local-to-ec2|ec2-to-local|both)
  -t, --target TARGET          同期対象 (templates|cdk|lambda|scripts|docs|all)
  -f, --force                  強制同期（既存ファイルを上書き）
  -n, --dry-run                実際の同期は行わず、変更内容のみ表示
  -v, --verbose                詳細ログを出力
  -h, --help                   このヘルプを表示

例:
  $0 --direction local-to-ec2 --target templates
  $0 --direction both --target all --verbose
  $0 --direction ec2-to-local --target cdk --dry-run

EOF
}

# デフォルト設定
DIRECTION="local-to-ec2"
TARGET="all"
FORCE=false
DRY_RUN=false
VERBOSE=false

# コマンドライン引数の解析
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--direction)
            DIRECTION="$2"
            shift 2
            ;;
        -t|--target)
            TARGET="$2"
            shift 2
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -n|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
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

# 方向の検証
if [[ ! "$DIRECTION" =~ ^(local-to-ec2|ec2-to-local|both)$ ]]; then
    error "無効な同期方向: $DIRECTION"
    error "有効な方向: local-to-ec2, ec2-to-local, both"
    exit 1
fi

# 対象の検証
if [[ ! "$TARGET" =~ ^(templates|cdk|lambda|scripts|docs|all)$ ]]; then
    error "無効な同期対象: $TARGET"
    error "有効な対象: templates, cdk, lambda, scripts, docs, all"
    exit 1
fi

log "EC2同期開始"
log "同期方向: $DIRECTION"
log "同期対象: $TARGET"
log "強制同期: $FORCE"
log "ドライラン: $DRY_RUN"

# SSH接続テスト
test_ssh_connection() {
    log "SSH接続テスト中..."
    if ssh -i "$EC2_KEY" -o ConnectTimeout=10 -o BatchMode=yes "$EC2_USER@$EC2_HOST" "echo 'SSH connection successful'" &> /dev/null; then
        log "✅ SSH接続成功"
        return 0
    else
        error "❌ SSH接続失敗"
        return 1
    fi
}

# EC2プロジェクトディレクトリの確認
check_ec2_project_dir() {
    log "EC2プロジェクトディレクトリの確認中..."
    if ssh -i "$EC2_KEY" "$EC2_USER@$EC2_HOST" "test -d '$EC2_PROJECT_DIR'" &> /dev/null; then
        log "✅ EC2プロジェクトディレクトリ存在確認"
        return 0
    else
        error "❌ EC2プロジェクトディレクトリが存在しません: $EC2_PROJECT_DIR"
        return 1
    fi
}

# rsyncオプションの構築
build_rsync_options() {
    local rsync_options="-avz --delete --compress-level=6 --partial --inplace"
    
    # セキュリティオプション
    rsync_options="$rsync_options --perms --owner --group"
    
    # パフォーマンスオプション
    rsync_options="$rsync_options --whole-file"
    
    if [[ "$VERBOSE" == "true" ]]; then
        rsync_options="$rsync_options --progress --stats"
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        rsync_options="$rsync_options --dry-run"
    fi
    
    echo "$rsync_options"
}

# 安全なrsync実行
safe_rsync() {
    local source="$1"
    local destination="$2"
    local description="$3"
    
    log "$description を同期中..."
    
    local rsync_options
    rsync_options=$(build_rsync_options)
    
    # rsync実行（エラーハンドリング付き）
    if ! rsync $rsync_options -e "ssh -i $EC2_KEY -o StrictHostKeyChecking=yes -o ConnectTimeout=30" "$source" "$destination"; then
        error "$description の同期に失敗しました"
        return 1
    fi
    
    log "✅ $description の同期完了"
    return 0
}

# ローカルからEC2への同期
sync_local_to_ec2() {
    local target="$1"
    log "ローカル → EC2 同期開始: $target"
    
    case "$target" in
        "templates"|"all")
            safe_rsync \
                "$PROJECT_ROOT/templates/" \
                "$EC2_USER@$EC2_HOST:$EC2_PROJECT_DIR/templates/" \
                "templates ディレクトリ"
            ;;
        "cdk"|"all")
            # CDK固有の除外設定でrsyncを実行
            local cdk_rsync_options
            cdk_rsync_options=$(build_rsync_options)
            cdk_rsync_options="$cdk_rsync_options --exclude=node_modules --exclude=cdk.out --exclude=*.d.ts --exclude=*.js"
            
            log "CDK ディレクトリを同期中..."
            if ! rsync $cdk_rsync_options \
                -e "ssh -i $EC2_KEY -o StrictHostKeyChecking=yes -o ConnectTimeout=30" \
                "$PROJECT_ROOT/templates/embedding-batch-workload-template/cdk/" \
                "$EC2_USER@$EC2_HOST:$EC2_PROJECT_DIR/templates/embedding-batch-workload-template/cdk/"; then
                error "CDK ディレクトリの同期に失敗しました"
                return 1
            fi
            log "✅ CDK ディレクトリの同期完了"
            ;;
        "lambda"|"all")
            safe_rsync \
                "$PROJECT_ROOT/templates/embedding-batch-workload-template/lambda/" \
                "$EC2_USER@$EC2_HOST:$EC2_PROJECT_DIR/templates/embedding-batch-workload-template/lambda/" \
                "Lambda ディレクトリ"
            ;;
        "scripts"|"all")
            safe_rsync \
                "$PROJECT_ROOT/templates/embedding-batch-workload-template/scripts/" \
                "$EC2_USER@$EC2_HOST:$EC2_PROJECT_DIR/templates/embedding-batch-workload-template/scripts/" \
                "Scripts ディレクトリ"
            ;;
        "docs"|"all")
            safe_rsync \
                "$PROJECT_ROOT/templates/embedding-batch-workload-template/docs/" \
                "$EC2_USER@$EC2_HOST:$EC2_PROJECT_DIR/templates/embedding-batch-workload-template/docs/" \
                "Docs ディレクトリ"
            ;;
    esac
}

# EC2からローカルへの同期
sync_ec2_to_local() {
    local target="$1"
    log "EC2 → ローカル 同期開始: $target"
    
    case "$target" in
        "templates"|"all")
            safe_rsync \
                "$EC2_USER@$EC2_HOST:$EC2_PROJECT_DIR/templates/" \
                "$PROJECT_ROOT/templates/" \
                "templates ディレクトリ"
            ;;
        "cdk"|"all")
            # CDK固有の除外設定でrsyncを実行
            local cdk_rsync_options
            cdk_rsync_options=$(build_rsync_options)
            cdk_rsync_options="$cdk_rsync_options --exclude=node_modules --exclude=cdk.out"
            
            log "CDK ディレクトリを同期中..."
            if ! rsync $cdk_rsync_options \
                -e "ssh -i $EC2_KEY -o StrictHostKeyChecking=yes -o ConnectTimeout=30" \
                "$EC2_USER@$EC2_HOST:$EC2_PROJECT_DIR/templates/embedding-batch-workload-template/cdk/" \
                "$PROJECT_ROOT/templates/embedding-batch-workload-template/cdk/"; then
                error "CDK ディレクトリの同期に失敗しました"
                return 1
            fi
            log "✅ CDK ディレクトリの同期完了"
            ;;
        "lambda"|"all")
            safe_rsync \
                "$EC2_USER@$EC2_HOST:$EC2_PROJECT_DIR/templates/embedding-batch-workload-template/lambda/" \
                "$PROJECT_ROOT/templates/embedding-batch-workload-template/lambda/" \
                "Lambda ディレクトリ"
            ;;
        "scripts"|"all")
            safe_rsync \
                "$EC2_USER@$EC2_HOST:$EC2_PROJECT_DIR/templates/embedding-batch-workload-template/scripts/" \
                "$PROJECT_ROOT/templates/embedding-batch-workload-template/scripts/" \
                "Scripts ディレクトリ"
            ;;
        "docs"|"all")
            safe_rsync \
                "$EC2_USER@$EC2_HOST:$EC2_PROJECT_DIR/templates/embedding-batch-workload-template/docs/" \
                "$PROJECT_ROOT/templates/embedding-batch-workload-template/docs/" \
                "Docs ディレクトリ"
            ;;
    esac
}

# 同期後の検証
verify_sync() {
    log "同期結果の検証中..."
    
    # ファイル数の比較
    local local_count
    local ec2_count
    
    case "$TARGET" in
        "templates"|"all")
            local_count=$(find "$PROJECT_ROOT/templates" -type f | wc -l)
            ec2_count=$(ssh -i "$EC2_KEY" "$EC2_USER@$EC2_HOST" "find '$EC2_PROJECT_DIR/templates' -type f | wc -l")
            log "Templates ファイル数 - ローカル: $local_count, EC2: $ec2_count"
            ;;
        "cdk"|"all")
            local_count=$(find "$PROJECT_ROOT/templates/embedding-batch-workload-template/cdk" -name "*.ts" -type f | wc -l)
            ec2_count=$(ssh -i "$EC2_KEY" "$EC2_USER@$EC2_HOST" "find '$EC2_PROJECT_DIR/templates/embedding-batch-workload-template/cdk' -name '*.ts' -type f | wc -l")
            log "CDK TypeScript ファイル数 - ローカル: $local_count, EC2: $ec2_count"
            ;;
    esac
}

# 前提条件の確認
check_prerequisites() {
    log "前提条件を確認中..."
    
    # セキュリティ設定の検証
    validate_security_settings
    
    # 必要なコマンドの確認
    local required_commands=("rsync" "ssh" "find")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            error "必要なコマンドが見つかりません: $cmd"
            exit 1
        fi
    done
    
    # SSH接続テスト
    if ! test_ssh_connection; then
        error "SSH接続に失敗しました"
        exit 1
    fi
    
    # EC2プロジェクトディレクトリの確認
    if ! check_ec2_project_dir; then
        error "EC2プロジェクトディレクトリの確認に失敗しました"
        exit 1
    fi
    
    log "✅ 前提条件の確認完了"
}

# 同期処理の実行
execute_sync() {
    log "同期処理を開始します"
    
    case "$DIRECTION" in
        "local-to-ec2")
            sync_local_to_ec2 "$TARGET"
            ;;
        "ec2-to-local")
            sync_ec2_to_local "$TARGET"
            ;;
        "both")
            log "双方向同期を実行します"
            sync_local_to_ec2 "$TARGET"
            log "ローカル → EC2 同期完了"
            sleep 2
            sync_ec2_to_local "$TARGET"
            log "EC2 → ローカル 同期完了"
            ;;
    esac
}

# 同期後の操作提案
suggest_next_steps() {
    if [[ "$DIRECTION" == "local-to-ec2" || "$DIRECTION" == "both" ]]; then
        log "📋 EC2での推奨操作:"
        log "  1. CDK依存関係のインストール:"
        log "     ssh -i $EC2_KEY $EC2_USER@$EC2_HOST 'cd $EC2_PROJECT_DIR/templates/embedding-batch-workload-template/cdk && npm install'"
        log "  2. CDKビルド:"
        log "     ssh -i $EC2_KEY $EC2_USER@$EC2_HOST 'cd $EC2_PROJECT_DIR/templates/embedding-batch-workload-template/cdk && npm run build'"
        log "  3. CDKデプロイ:"
        log "     ssh -i $EC2_KEY $EC2_USER@$EC2_HOST 'cd $EC2_PROJECT_DIR/templates/embedding-batch-workload-template/cdk && npx cdk deploy --all'"
    fi
}

# メイン処理
main() {
    local start_time=$(date +%s)
    
    # 前提条件の確認
    check_prerequisites
    
    # 同期実行
    execute_sync
    
    # 検証実行
    if [[ "$DRY_RUN" == "false" ]]; then
        verify_sync
    fi
    
    # 実行時間の計算
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log "✅ EC2同期完了 (実行時間: ${duration}秒)"
    
    # 次のステップの提案
    suggest_next_steps
}

# クリーンアップ
cleanup() {
    local exit_code=$?
    log "クリーンアップ実行中..."
    
    # 機密変数のクリア
    unset EC2_HOST EC2_USER EC2_KEY EC2_PROJECT_DIR
    unset DIRECTION TARGET FORCE DRY_RUN VERBOSE
    
    # 一時ファイルの削除
    rm -f /tmp/sync-temp-* 2>/dev/null || true
    
    if [[ $exit_code -ne 0 ]]; then
        error "スクリプトがエラーで終了しました (終了コード: $exit_code)"
        log "ログファイル: $LOG_FILE"
    fi
    
    exit $exit_code
}

# シグナルハンドラの設定
trap cleanup EXIT INT TERM

# メイン処理の実行
main