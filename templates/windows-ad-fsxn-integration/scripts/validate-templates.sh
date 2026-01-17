#!/bin/bash

# CloudFormationテンプレート検証スクリプト
# 使用方法: ./validate-templates.sh [AWSプロファイル]

set -euo pipefail

# スクリプト設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$(dirname "$SCRIPT_DIR")"

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

# 使用方法表示
show_usage() {
    cat << EOF
使用方法: $0 [AWSプロファイル]

引数:
  AWSプロファイル: AWS CLI プロファイル名 (デフォルト: default)

例:
  $0
  $0 user01
  $0 production

このスクリプトは以下の検証を実行します:
  1. CloudFormation テンプレート構文検証
  2. CFN Lint による静的解析
  3. CFN Nag によるセキュリティチェック
  4. パラメータファイル JSON 構文検証
  5. テンプレート相互依存関係チェック

前提条件:
  - AWS CLI がインストール・設定済み
  - cfn-lint がインストール済み (pip install cfn-lint)
  - cfn_nag がインストール済み (gem install cfn-nag)
EOF
}

# 必要なツールの確認
check_prerequisites() {
    local missing_tools=()
    
    # AWS CLI確認
    if ! command -v aws >/dev/null 2>&1; then
        missing_tools+=("aws-cli")
    fi
    
    # CFN Lint確認
    if ! command -v cfn-lint >/dev/null 2>&1; then
        missing_tools+=("cfn-lint")
    fi
    
    # CFN Nag確認
    if ! command -v cfn_nag_scan >/dev/null 2>&1; then
        missing_tools+=("cfn-nag")
    fi
    
    # jq確認（JSON処理用）
    if ! command -v jq >/dev/null 2>&1; then
        missing_tools+=("jq")
    fi
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "以下のツールがインストールされていません:"
        for tool in "${missing_tools[@]}"; do
            echo "  - $tool"
        done
        echo
        echo "インストール方法:"
        echo "  aws-cli: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
        echo "  cfn-lint: pip install cfn-lint"
        echo "  cfn-nag: gem install cfn-nag"
        echo "  jq: brew install jq (macOS) または apt-get install jq (Ubuntu)"
        return 1
    fi
    
    log_info "必要なツールの確認完了"
}

# CloudFormationテンプレート構文検証
validate_cloudformation_syntax() {
    local template_file="$1"
    local profile="$2"
    
    log_info "CloudFormation構文検証: $(basename "$template_file")"
    
    if aws cloudformation validate-template \
        --template-body "file://$template_file" \
        --profile "$profile" >/dev/null 2>&1; then
        log_success "✓ CloudFormation構文検証成功: $(basename "$template_file")"
        return 0
    else
        log_error "✗ CloudFormation構文検証失敗: $(basename "$template_file")"
        
        # 詳細エラー表示
        aws cloudformation validate-template \
            --template-body "file://$template_file" \
            --profile "$profile" 2>&1 || true
        return 1
    fi
}

# CFN Lint静的解析
run_cfn_lint() {
    local template_file="$1"
    
    log_info "CFN Lint静的解析: $(basename "$template_file")"
    
    local lint_output
    if lint_output=$(cfn-lint "$template_file" 2>&1); then
        log_success "✓ CFN Lint検証成功: $(basename "$template_file")"
        return 0
    else
        log_warn "⚠ CFN Lint警告/エラー: $(basename "$template_file")"
        echo "$lint_output"
        
        # エラーレベルの確認
        if echo "$lint_output" | grep -q "E[0-9]"; then
            log_error "✗ CFN Lint エラーが検出されました"
            return 1
        else
            log_warn "CFN Lint 警告のみ検出されました（継続可能）"
            return 0
        fi
    fi
}

# CFN Nagセキュリティチェック
run_cfn_nag() {
    local template_file="$1"
    
    log_info "CFN Nagセキュリティチェック: $(basename "$template_file")"
    
    # jqコマンドの存在確認
    if ! command -v jq >/dev/null 2>&1; then
        log_error "jqコマンドが見つかりません。インストールしてください: brew install jq (macOS) または apt-get install jq (Ubuntu)"
        return 1
    fi
    
    local nag_output
    if nag_output=$(cfn_nag_scan --input-path "$template_file" --output-format json 2>&1); then
        # JSON形式の検証
        if ! echo "$nag_output" | jq empty 2>/dev/null; then
            log_warn "CFN Nag出力がJSON形式ではありません。テキスト形式で処理します"
            echo "$nag_output"
            return 0
        fi
        
        # JSON出力の解析（エラーハンドリング強化）
        local failures warnings
        failures=$(echo "$nag_output" | jq -r 'if type == "array" and length > 0 then .[0].file_results.failure_count // 0 else 0 end' 2>/dev/null || echo "0")
        warnings=$(echo "$nag_output" | jq -r 'if type == "array" and length > 0 then .[0].file_results.warning_count // 0 else 0 end' 2>/dev/null || echo "0")
        
        # 詳細な違反内容の表示（カテゴリ別整理）
        if [[ "$failures" -gt 0 ]] || [[ "$warnings" -gt 0 ]]; then
            echo "  【セキュリティ違反詳細】"
            
            # 失敗項目の表示
            if [[ "$failures" -gt 0 ]]; then
                echo "  ❌ 重大な問題 ($failures 件):"
                echo "$nag_output" | jq -r '.[0].file_results.violations[]? | select(.type == "FAIL") | "    - \(.message) (ルール: \(.id))"' 2>/dev/null || true
            fi
            
            # 警告項目の表示
            if [[ "$warnings" -gt 0 ]]; then
                echo "  ⚠️  警告 ($warnings 件):"
                echo "$nag_output" | jq -r '.[0].file_results.violations[]? | select(.type == "WARN") | "    - \(.message) (ルール: \(.id))"' 2>/dev/null || true
            fi
        fi
        
        if [[ "$failures" -eq 0 ]]; then
            log_success "✓ CFN Nagセキュリティチェック成功: $(basename "$template_file")"
            if [[ "$warnings" -gt 0 ]]; then
                log_warn "  警告: $warnings 件"
            fi
            return 0
        else
            log_error "✗ CFN Nagセキュリティチェック失敗: $(basename "$template_file")"
            log_error "  失敗: $failures 件, 警告: $warnings 件"
            return 1
        fi
    else
        log_error "✗ CFN Nag実行エラー: $(basename "$template_file")"
        echo "$nag_output"
        return 1
    fi
}

# セキュリティベストプラクティスチェック
run_security_checks() {
    local template_file="$1"
    
    log_info "セキュリティベストプラクティスチェック: $(basename "$template_file")"
    
    local security_issues=()
    
    # ハードコードされた機密情報チェック（より精密な検出）
    if grep -E "(password|secret|key).*[:=].*['\"][^'\"]{8,}['\"]" "$template_file" 2>/dev/null; then
        security_issues+=("ハードコードされた機密情報の可能性が検出されました")
    fi
    
    # 暗号化設定チェック（複数パターン対応）
    if ! grep -E "(Encrypted.*true|KmsKeyId|SSEAlgorithm)" "$template_file" 2>/dev/null; then
        security_issues+=("暗号化設定が見つかりません（EBS、S3、RDS等の暗号化を確認してください）")
    fi
    
    # セキュリティグループの過度な開放チェック（ポート別詳細確認）
    if grep -B5 -A5 "0.0.0.0/0" "$template_file" 2>/dev/null | grep -E "(FromPort.*22|FromPort.*3389|FromPort.*80|FromPort.*443)" >/dev/null; then
        security_issues+=("重要ポート（SSH/RDP/HTTP/HTTPS）が全IPに開放されている可能性")
    elif grep -q "0.0.0.0/0" "$template_file" 2>/dev/null; then
        security_issues+=("セキュリティグループで全IPアドレスへの開放が検出されました")
    fi
    
    # IAMポリシーの過度な権限チェック（Action別詳細確認）
    if grep -E "\"Action\".*\"\\*\"" "$template_file" 2>/dev/null; then
        security_issues+=("IAMポリシーで全アクションへのアクセスが許可されています")
    elif grep -E "\"Resource\".*\"\\*\"" "$template_file" 2>/dev/null; then
        security_issues+=("IAMポリシーで全リソースへのアクセスが許可されています")
    fi
    
    # KMS暗号化キーの使用確認
    if ! grep -q "AWS::KMS::Key" "$template_file" 2>/dev/null; then
        security_issues+=("KMS暗号化キーが定義されていません")
    fi
    
    # CloudTrail設定確認
    if ! grep -q "AWS::CloudTrail::Trail" "$template_file" 2>/dev/null; then
        security_issues+=("CloudTrail設定が見つかりません")
    fi
    
    # 結果表示
    if [[ ${#security_issues[@]} -eq 0 ]]; then
        log_success "✓ セキュリティベストプラクティスチェック成功: $(basename "$template_file")"
        return 0
    else
        log_warn "⚠ セキュリティに関する推奨事項: $(basename "$template_file")"
        for issue in "${security_issues[@]}"; do
            echo "  - $issue"
        done
        return 0  # 警告レベルなので継続
    fi
}

# リソース制限チェック
check_resource_limits() {
    local template_file="$1"
    
    log_info "リソース制限チェック: $(basename "$template_file")"
    
    local limit_issues=()
    
    # リソース数確認
    local resource_count
    resource_count=$(grep -c "Type: AWS::" "$template_file" 2>/dev/null || echo "0")
    
    if [[ $resource_count -gt 200 ]]; then
        limit_issues+=("リソース数が多すぎます ($resource_count > 200)")
    fi
    
    # テンプレートサイズ確認
    local template_size
    template_size=$(wc -c < "$template_file")
    local max_size=$((460 * 1024))  # 460KB
    
    if [[ $template_size -gt $max_size ]]; then
        limit_issues+=("テンプレートサイズが大きすぎます ($(($template_size / 1024))KB > 460KB)")
    fi
    
    # パラメータ数確認
    local param_count
    param_count=$(grep -c "Type: String\|Type: Number\|Type: CommaDelimitedList" "$template_file" 2>/dev/null || echo "0")
    
    if [[ $param_count -gt 60 ]]; then
        limit_issues+=("パラメータ数が多すぎます ($param_count > 60)")
    fi
    
    # 出力値数確認（より正確な計算）
    local output_count
    if grep -q "^Outputs:" "$template_file" 2>/dev/null; then
        # Outputsセクション以降の出力値をカウント
        output_count=$(awk '/^Outputs:/,0 {if(/^  [A-Za-z]/ && !/^    /) count++} END {print count+0}' "$template_file")
    else
        output_count=0
    fi
    
    if [[ $output_count -gt 60 ]]; then
        limit_issues+=("出力値数が多すぎます ($output_count > 60)")
    fi
    
    # ネストされたスタック数確認
    local nested_stack_count
    nested_stack_count=$(grep -c "Type: AWS::CloudFormation::Stack" "$template_file" 2>/dev/null || echo "0")
    
    if [[ $nested_stack_count -gt 5 ]]; then
        limit_issues+=("ネストされたスタック数が多すぎます ($nested_stack_count > 5)")
    fi
    
    # 結果表示
    if [[ ${#limit_issues[@]} -eq 0 ]]; then
        log_success "✓ リソース制限チェック成功: $(basename "$template_file")"
        return 0
    else
        log_warn "⚠ リソース制限に関する警告: $(basename "$template_file")"
        for issue in "${limit_issues[@]}"; do
            echo "  - $issue"
        done
        return 0  # 警告レベルなので継続
    fi
}

# JSONファイル構文検証
validate_json_syntax() {
    local json_file="$1"
    
    log_info "JSON構文検証: $(basename "$json_file")"
    
    if jq empty "$json_file" >/dev/null 2>&1; then
        log_success "✓ JSON構文検証成功: $(basename "$json_file")"
        return 0
    else
        log_error "✗ JSON構文検証失敗: $(basename "$json_file")"
        
        # 詳細エラー表示
        jq empty "$json_file" 2>&1 || true
        return 1
    fi
}

# パラメータファイル内容検証
validate_parameter_content() {
    local param_file="$1"
    
    log_info "パラメータ内容検証: $(basename "$param_file")"
    
    local issues=()
    
    # 必須パラメータの確認
    local required_params=(
        "ProjectName"
        "Environment"
        "DomainName"
        "NetBiosName"
        "AdminPassword"
        "SafeModePassword"
        "FSxFileSystemId"
        "KeyPairName"
    )
    
    for param in "${required_params[@]}"; do
        if ! jq -e ".[] | select(.ParameterKey == \"$param\")" "$param_file" >/dev/null 2>&1; then
            issues+=("必須パラメータが不足: $param")
        fi
    done
    
    # デフォルト値の確認
    local default_values=(
        "CHANGE_ME_SECURE_PASSWORD_123!"
        "CHANGE_ME_SAFE_MODE_PASSWORD_123!"
        "fs-CHANGE_ME_FILESYSTEM_ID"
        "CHANGE_ME_KEY_PAIR_NAME"
    )
    
    for default_val in "${default_values[@]}"; do
        if jq -e ".[] | select(.ParameterValue == \"$default_val\")" "$param_file" >/dev/null 2>&1; then
            issues+=("デフォルト値が変更されていません: $default_val")
        fi
    done
    
    # パスワード強度チェック
    local admin_password
    admin_password=$(jq -r '.[] | select(.ParameterKey == "AdminPassword") | .ParameterValue' "$param_file" 2>/dev/null || echo "")
    
    if [[ -n "$admin_password" && ${#admin_password} -lt 8 ]]; then
        issues+=("AdminPasswordが短すぎます（8文字以上必要）")
    fi
    
    # 結果表示
    if [[ ${#issues[@]} -eq 0 ]]; then
        log_success "✓ パラメータ内容検証成功: $(basename "$param_file")"
        return 0
    else
        log_warn "⚠ パラメータ内容に問題があります: $(basename "$param_file")"
        for issue in "${issues[@]}"; do
            echo "  - $issue"
        done
        return 1
    fi
}

# テンプレート相互依存関係チェック
validate_template_dependencies() {
    local main_template="$1"
    
    log_info "テンプレート相互依存関係チェック"
    
    # ネストされたスタックの参照確認
    local nested_refs
    nested_refs=$(grep -o "nested-stacks/[^\"]*" "$main_template" 2>/dev/null || echo "")
    
    local missing_templates=()
    
    while IFS= read -r ref; do
        if [[ -n "$ref" ]]; then
            local nested_file="$TEMPLATE_DIR/$ref"
            if [[ ! -f "$nested_file" ]]; then
                missing_templates+=("$ref")
            fi
        fi
    done <<< "$nested_refs"
    
    if [[ ${#missing_templates[@]} -eq 0 ]]; then
        log_success "✓ テンプレート依存関係チェック成功"
        return 0
    else
        log_error "✗ 参照されているネストされたテンプレートが見つかりません:"
        for template in "${missing_templates[@]}"; do
            echo "  - $template"
        done
        return 1
    fi
}

# 全体検証実行
run_full_validation() {
    local profile="$1"
    local validation_errors=0
    
    log_info "=== CloudFormationテンプレート全体検証開始 ==="
    
    # メインテンプレート検証
    local main_template="$TEMPLATE_DIR/windows-ad-fsxn-environment.yaml"
    
    if [[ -f "$main_template" ]]; then
        # CloudFormation構文検証
        if ! validate_cloudformation_syntax "$main_template" "$profile"; then
            ((validation_errors++))
        fi
        
        # CFN Lint検証
        if ! run_cfn_lint "$main_template"; then
            ((validation_errors++))
        fi
        
        # CFN Nag検証
        if ! run_cfn_nag "$main_template"; then
            ((validation_errors++))
        fi
        
        # セキュリティベストプラクティスチェック
        if ! run_security_checks "$main_template"; then
            ((validation_errors++))
        fi
        
        # リソース制限チェック
        if ! check_resource_limits "$main_template"; then
            ((validation_errors++))
        fi
        
        # 依存関係チェック
        if ! validate_template_dependencies "$main_template"; then
            ((validation_errors++))
        fi
    else
        log_error "メインテンプレートが見つかりません: $main_template"
        ((validation_errors++))
    fi
    
    # ネストされたテンプレート検証
    local nested_dir="$TEMPLATE_DIR/nested-stacks"
    if [[ -d "$nested_dir" ]]; then
        log_info "ネストされたテンプレート検証中..."
        
        while IFS= read -r -d '' template_file; do
            if ! validate_cloudformation_syntax "$template_file" "$profile"; then
                ((validation_errors++))
            fi
            
            if ! run_cfn_lint "$template_file"; then
                ((validation_errors++))
            fi
            
            if ! run_cfn_nag "$template_file"; then
                ((validation_errors++))
            fi
            
            if ! run_security_checks "$template_file"; then
                ((validation_errors++))
            fi
        done < <(find "$nested_dir" -name "*.yaml" -o -name "*.yml" -print0 2>/dev/null)
    else
        log_warn "ネストされたテンプレートディレクトリが見つかりません: $nested_dir"
    fi
    
    # パラメータファイル検証
    local param_dir="$TEMPLATE_DIR/parameters"
    if [[ -d "$param_dir" ]]; then
        log_info "パラメータファイル検証中..."
        
        while IFS= read -r -d '' param_file; do
            if ! validate_json_syntax "$param_file"; then
                ((validation_errors++))
            fi
            
            if ! validate_parameter_content "$param_file"; then
                ((validation_errors++))
            fi
        done < <(find "$param_dir" -name "*.json" -print0 2>/dev/null)
    else
        log_warn "パラメータディレクトリが見つかりません: $param_dir"
    fi
    
    # 詳細レポート生成
    generate_validation_report "$validation_errors"
    
    # 結果サマリー
    echo
    log_info "=== 検証結果サマリー ==="
    
    if [[ $validation_errors -eq 0 ]]; then
        log_success "✓ 全ての検証が成功しました！"
        log_info "テンプレートはデプロイ準備完了です。"
        log_info "詳細レポート: $TEMPLATE_DIR/validation-report.txt"
        return 0
    else
        log_error "✗ $validation_errors 件の検証エラーが検出されました。"
        log_error "エラーを修正してから再度検証を実行してください。"
        log_error "詳細レポート: $TEMPLATE_DIR/validation-report.txt"
        return 1
    fi
}

# 検証レポート生成
generate_validation_report() {
    local error_count="$1"
    local report_file="$TEMPLATE_DIR/validation-report.txt"
    local json_report_file="$TEMPLATE_DIR/validation-report.json"
    
    log_info "検証レポート生成中..."
    
    # JSON形式のレポート生成（機械可読）
    cat > "$json_report_file" << EOF
{
  "validation_summary": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "total_errors": $error_count,
    "status": "$([ $error_count -eq 0 ] && echo "SUCCESS" || echo "FAILED")",
    "templates_checked": $(find "$TEMPLATE_DIR" -name "*.yaml" -o -name "*.yml" 2>/dev/null | wc -l),
    "parameters_checked": $(find "$TEMPLATE_DIR/parameters" -name "*.json" 2>/dev/null | wc -l)
  },
  "validation_types": [
    "CloudFormation構文検証",
    "CFN Lint静的解析", 
    "CFN Nagセキュリティチェック",
    "セキュリティベストプラクティス",
    "リソース制限チェック",
    "JSON構文検証",
    "パラメータ内容検証",
    "テンプレート依存関係チェック"
  ]
}
EOF
    
    # テキスト形式のレポート生成（人間可読）
    cat > "$report_file" << EOF
# CloudFormationテンプレート検証レポート

## 実行情報
- 実行日時: $(date)
- 実行者: $(whoami)
- AWSプロファイル: ${profile:-default}
- スクリプトバージョン: 1.0.0

## 検証対象
- メインテンプレート: windows-ad-fsxn-environment.yaml
- ネストされたテンプレート: $(find "$TEMPLATE_DIR/nested-stacks" -name "*.yaml" 2>/dev/null | wc -l) 件
- パラメータファイル: $(find "$TEMPLATE_DIR/parameters" -name "*.json" 2>/dev/null | wc -l) 件

## 検証結果サマリー
- 総エラー数: $error_count
- 検証ステータス: $([ $error_count -eq 0 ] && echo "成功" || echo "失敗")

## 実行された検証項目
1. ✓ CloudFormation構文検証
2. ✓ CFN Lint静的解析
3. ✓ CFN Nagセキュリティチェック
4. ✓ セキュリティベストプラクティスチェック
5. ✓ リソース制限チェック
6. ✓ JSON構文検証
7. ✓ パラメータ内容検証
8. ✓ テンプレート依存関係チェック

## 推奨事項
$([ $error_count -eq 0 ] && echo "- テンプレートはデプロイ準備完了です" || echo "- 検出されたエラーを修正してください")
- 定期的な検証の実行を推奨します
- セキュリティ設定の定期的な見直しを行ってください
- パラメータファイルの機密情報管理に注意してください

## 次のステップ
$([ $error_count -eq 0 ] && cat << 'NEXT_STEPS'
1. デプロイメント前の最終確認
2. 本番環境デプロイの実行
3. デプロイ後の動作確認
4. 監視・アラート設定の確認
NEXT_STEPS
|| cat << 'FIX_STEPS'
1. エラーログの詳細確認
2. 指摘された問題の修正
3. 再検証の実行
4. 修正内容のテスト
FIX_STEPS
)

---
このレポートは自動生成されました。
EOF
    
    log_success "検証レポート生成完了: $report_file"
}

# メイン処理
main() {
    local profile="${1:-default}"
    
    # ヘルプ表示
    if [[ "$profile" == "-h" || "$profile" == "--help" ]]; then
        show_usage
        exit 0
    fi
    
    log_info "CloudFormationテンプレート検証開始"
    log_info "AWSプロファイル: $profile"
    
    # 前提条件確認
    if ! check_prerequisites; then
        exit 1
    fi
    
    # AWS認証確認
    if ! aws sts get-caller-identity --profile "$profile" >/dev/null 2>&1; then
        log_error "AWS認証に失敗しました。プロファイル設定を確認してください: $profile"
        exit 1
    fi
    
    # 全体検証実行
    if run_full_validation "$profile"; then
        log_success "検証完了: 全てのテンプレートが正常です"
        exit 0
    else
        log_error "検証失敗: エラーを修正してください"
        exit 1
    fi
}

# エラーハンドリング
trap 'log_error "スクリプト実行中にエラーが発生しました (行番号: $LINENO)"' ERR

# メイン処理実行
main "$@"