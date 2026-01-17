#!/bin/bash

# Windows AD FSxN統合環境セキュリティチェックスクリプト
# 使用方法: ./security-check.sh [テンプレートディレクトリ]

set -euo pipefail

# スクリプト設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="${1:-$(dirname "$SCRIPT_DIR")}"

# 色付きログ出力関数
log_info() {
    echo -e "\033[32m[INFO]\033[0m $1"
}

log_warn() {
    echo -e "\033[33m[WARN]\033[0m $1"
}

log_error() {
    echo -e "\033[31m[ERROR]\033[0m $1"
}

log_success() {
    echo -e "\033[32m[SUCCESS]\033[0m $1"
}

# セキュリティチェック実行
security_check() {
    log_info "=== Windows AD FSxN統合環境セキュリティチェック開始 ==="
    
    local issues_found=0
    
    # 1. ファイル権限チェック
    log_info "1. ファイル権限チェック中..."
    
    # スクリプトファイルの権限確認
    find "$TEMPLATE_DIR" -name "*.sh" -type f | while read -r script_file; do
        local perms
        perms=$(stat -c %a "$script_file" 2>/dev/null || stat -f %A "$script_file")
        
        if [[ "$perms" -gt 755 ]]; then
            log_warn "スクリプトファイルの権限が過度に開放されています: $script_file ($perms)"
            ((issues_found++))
        fi
    done
    
    # 設定ファイルの権限確認
    find "$TEMPLATE_DIR" -name "*.env" -o -name "*parameters*.json" -type f | while read -r config_file; do
        local perms
        perms=$(stat -c %a "$config_file" 2>/dev/null || stat -f %A "$config_file")
        
        if [[ "$perms" -gt 600 ]]; then
            log_warn "設定ファイルの権限が過度に開放されています: $config_file ($perms)"
            chmod 600 "$config_file"
            log_info "権限を600に修正しました: $config_file"
        fi
    done
    
    # 2. 機密情報ハードコードチェック
    log_info "2. 機密情報ハードコードチェック中..."
    
    # パスワードパターンの検索
    local password_patterns=(
        "password.*=.*['\"][^'\"]{8,}['\"]"
        "Password.*:.*['\"][^'\"]{8,}['\"]"
        "secret.*=.*['\"][^'\"]+['\"]"
        "key.*=.*['\"][^'\"]{20,}['\"]"
    )
    
    for pattern in "${password_patterns[@]}"; do
        if grep -r -i -E "$pattern" "$TEMPLATE_DIR" --include="*.yaml" --include="*.json" --include="*.sh" 2>/dev/null; then
            log_error "機密情報のハードコードが検出されました: $pattern"
            ((issues_found++))
        fi
    done
    
    # 3. CloudFormationテンプレートセキュリティチェック
    log_info "3. CloudFormationテンプレートセキュリティチェック中..."
    
    find "$TEMPLATE_DIR" -name "*.yaml" -o -name "*.yml" -type f | while read -r template_file; do
        # NoEcho設定の確認
        if grep -q "Type.*String" "$template_file" && grep -q -i "password\|secret\|key" "$template_file"; then
            if ! grep -q "NoEcho.*true" "$template_file"; then
                log_warn "機密パラメータにNoEcho設定がありません: $template_file"
                ((issues_found++))
            fi
        fi
        
        # セキュリティグループの過度な開放チェック
        if grep -q "0.0.0.0/0" "$template_file"; then
            log_warn "セキュリティグループで全IPアドレスからのアクセスが許可されています: $template_file"
            ((issues_found++))
        fi
    done
    
    # 4. スクリプトセキュリティチェック
    log_info "4. スクリプトセキュリティチェック中..."
    
    find "$TEMPLATE_DIR" -name "*.sh" -type f | while read -r script_file; do
        # set -euo pipefail の確認
        if ! grep -q "set -euo pipefail" "$script_file"; then
            log_warn "エラーハンドリング設定がありません: $script_file"
            ((issues_found++))
        fi
        
        # 危険なコマンドパターンの確認
        local dangerous_patterns=(
            "rm -rf /\|rm -rf \$"
            "chmod 777"
            "eval.*\$"
            "curl.*|.*sh"
        )
        
        for pattern in "${dangerous_patterns[@]}"; do
            if grep -q -E "$pattern" "$script_file"; then
                log_error "危険なコマンドパターンが検出されました: $script_file ($pattern)"
                ((issues_found++))
            fi
        done
    done
    
    # 5. 依存関係セキュリティチェック
    log_info "5. 依存関係セキュリティチェック中..."
    
    # AWS CLI バージョンチェック
    if command -v aws >/dev/null 2>&1; then
        local aws_version
        aws_version=$(aws --version 2>&1 | cut -d/ -f2 | cut -d' ' -f1)
        log_info "AWS CLI バージョン: $aws_version"
        
        # 古いバージョンの警告
        if [[ "${aws_version%%.*}" -lt 2 ]]; then
            log_warn "AWS CLI v1は非推奨です。v2にアップグレードしてください"
            ((issues_found++))
        fi
    else
        log_error "AWS CLIがインストールされていません"
        ((issues_found++))
    fi
    
    # 結果サマリー
    log_info "=== セキュリティチェック完了 ==="
    
    if [[ $issues_found -eq 0 ]]; then
        log_success "セキュリティ問題は検出されませんでした"
        return 0
    else
        log_error "セキュリティ問題が $issues_found 件検出されました"
        return 1
    fi
}

# セキュリティ修復提案
security_recommendations() {
    log_info "=== セキュリティ強化推奨事項 ==="
    
    echo ""
    echo "🔒 推奨セキュリティ対策:"
    echo "1. 機密情報の外部化"
    echo "   - AWS Secrets Manager の使用"
    echo "   - 環境変数による設定"
    echo "   - IAM ロールベース認証"
    echo ""
    echo "2. ネットワークセキュリティ"
    echo "   - セキュリティグループの最小権限設定"
    echo "   - VPC エンドポイントの使用"
    echo "   - プライベートサブネット配置"
    echo ""
    echo "3. 監査・ログ設定"
    echo "   - CloudTrail の有効化"
    echo "   - CloudWatch Logs の設定"
    echo "   - AWS Config による設定監視"
    echo ""
    echo "4. 暗号化設定"
    echo "   - EBS ボリューム暗号化"
    echo "   - S3 バケット暗号化"
    echo "   - 転送時暗号化（TLS/SSL）"
    echo ""
}

# メイン処理
main() {
    if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
        echo "使用方法: $0 [テンプレートディレクトリ]"
        echo ""
        echo "Windows AD FSxN統合環境のセキュリティチェックを実行します"
        echo ""
        echo "オプション:"
        echo "  -h, --help    このヘルプを表示"
        echo ""
        exit 0
    fi
    
    # セキュリティチェック実行
    if security_check; then
        security_recommendations
        exit 0
    else
        security_recommendations
        exit 1
    fi
}

# エラーハンドリング
trap 'log_error "セキュリティチェック中にエラーが発生しました (行番号: $LINENO)"' ERR

# メイン処理実行
main "$@"