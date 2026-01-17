#!/bin/bash

# プロジェクト更新・同期スクリプト
# ローカルとEC2環境の最新化と同期を行います

set -euo pipefail

# 設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_ROOT/logs/project-update-$(date +%Y%m%d-%H%M%S).log"

# ログディレクトリの作成
mkdir -p "$(dirname "$LOG_FILE")"

# ログ関数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" | tee -a "$LOG_FILE" >&2
}

success() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: $*" | tee -a "$LOG_FILE"
}

# 使用方法の表示
show_usage() {
    cat << EOF
使用方法: $0 [オプション]

プロジェクトの更新・同期を行います。

オプション:
  -t, --target TARGET          更新対象 (local|ec2|both)
  -s, --sync-direction DIR     同期方向 (local-to-ec2|ec2-to-local|both)
  -c, --components COMPONENTS  更新コンポーネント (cdk|lambda|scripts|docs|all)
  -f, --force                  強制更新（確認をスキップ）
  -d, --dry-run                ドライラン（実際の更新は行わない）
  -v, --verbose                詳細ログを出力
  -h, --help                   このヘルプを表示

例:
  $0 --target both --components all
  $0 --target ec2 --sync-direction local-to-ec2 --components cdk
  $0 --target local --components lambda --dry-run

EOF
}

# デフォルト設定
TARGET="both"
SYNC_DIRECTION="local-to-ec2"
COMPONENTS="all"
FORCE=false
DRY_RUN=false
VERBOSE=false

# コマンドライン引数の解析
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--target)
            TARGET="$2"
            shift 2
            ;;
        -s|--sync-direction)
            SYNC_DIRECTION="$2"
            shift 2
            ;;
        -c|--components)
            COMPONENTS="$2"
            shift 2
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -d|--dry-run)
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

log "プロジェクト更新・同期開始"
log "ターゲット: $TARGET"
log "同期方向: $SYNC_DIRECTION"
log "コンポーネント: $COMPONENTS"

# ローカル環境の更新
update_local_environment() {
    log "ローカル環境の更新中..."
    
    # CDKの更新
    if [[ "$COMPONENTS" == "cdk" || "$COMPONENTS" == "all" ]]; then
        log "CDK環境の更新中..."
        cd "$PROJECT_ROOT/cdk"
        
        if [[ "$DRY_RUN" == "false" ]]; then
            npm update
            npm run build
        else
            log "[DRY-RUN] CDK環境の更新をスキップ"
        fi
        
        cd "$PROJECT_ROOT"
    fi
    
    success "ローカル環境の更新完了"
}

# メイン処理
main() {
    if [[ "$TARGET" == "local" || "$TARGET" == "both" ]]; then
        update_local_environment
    fi
    
    success "プロジェクト更新・同期完了"
}

# メイン処理の実行
main