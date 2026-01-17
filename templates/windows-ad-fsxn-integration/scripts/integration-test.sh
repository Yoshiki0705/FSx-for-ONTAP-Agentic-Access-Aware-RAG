#!/bin/bash

# Windows AD FSxN統合環境 統合テストスクリプト
# 使用方法: ./integration-test.sh [環境名] [リージョン] [プロファイル]

set -euo pipefail

# スクリプト設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_NAME="windows-ad-fsxn"

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

log_test() {
    echo -e "\033[34m[TEST]\033[0m $1"
}

# 使用方法表示
show_usage() {
    cat << EOF
使用方法: $0 [環境名] [リージョン] [AWSプロファイル]

引数:
  環境名        : dev, staging, prod のいずれか (デフォルト: dev)
  リージョン    : AWS リージョン (デフォルト: ap-northeast-1)
  AWSプロファイル: AWS CLI プロファイル名 (デフォルト: default)

例:
  $0 dev ap-northeast-1 user01
  $0 prod ap-northeast-1 production

このスクリプトは以下のテストを実行します:
  1. デプロイメントテスト（ドライラン）
  2. リソース存在確認テスト
  3. ネットワーク接続テスト
  4. Active Directory機能テスト
  5. FSxドメイン参加確認テスト
  6. セキュリティ設定テスト
  7. 監視・ログ機能テスト
  8. パフォーマンステスト

前提条件:
  - AWS CLI がインストール・設定済み
  - 対象環境がデプロイ済み
  - 適切なIAM権限を持つプロファイル
EOF
}

# テスト結果記録
TEST_RESULTS=()
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# テスト結果記録関数
record_test_result() {
    local test_name="$1"
    local result="$2"
    local details="${3:-}"
    
    ((TOTAL_TESTS++))
    
    if [[ "$result" == "PASS" ]]; then
        ((PASSED_TESTS++))
        log_success "✓ $test_name"
    else
        ((FAILED_TESTS++))
        log_error "✗ $test_name"
        if [[ -n "$details" ]]; then
            echo "  詳細: $details"
        fi
    fi
    
    TEST_RESULTS+=("$test_name: $result")
}

# スタック情報取得
get_stack_info() {
    local environment="$1"
    local region="$2"
    local profile="$3"
    
    local stack_name="${PROJECT_NAME}-${environment}"
    
    # スタック存在確認
    if ! aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --region "$region" \
        --profile "$profile" >/dev/null 2>&1; then
        log_error "スタックが見つかりません: $stack_name"
        return 1
    fi
    
    # スタック状況確認
    local stack_status
    stack_status=$(aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --region "$region" \
        --profile "$profile" \
        --query 'Stacks[0].StackStatus' \
        --output text)
    
    if [[ "$stack_status" != "CREATE_COMPLETE" && "$stack_status" != "UPDATE_COMPLETE" ]]; then
        log_error "スタックが正常な状態ではありません: $stack_status"
        return 1
    fi
    
    log_info "スタック確認完了: $stack_name ($stack_status)"
    return 0
}

# 出力値取得関数
get_stack_output() {
    local environment="$1"
    local region="$2"
    local profile="$3"
    local output_key="$4"
    
    local stack_name="${PROJECT_NAME}-${environment}"
    
    aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --region "$region" \
        --profile "$profile" \
        --query "Stacks[0].Outputs[?OutputKey=='$output_key'].OutputValue" \
        --output text 2>/dev/null || echo ""
}

# 1. デプロイメントテスト（ドライラン）
test_deployment_dryrun() {
    local environment="$1"
    local region="$2"
    local profile="$3"
    
    log_test "デプロイメントテスト（ドライラン）実行中..."
    
    local stack_name="${PROJECT_NAME}-${environment}"
    local template_file="$TEMPLATE_DIR/windows-ad-fsxn-environment.yaml"
    local param_file="$TEMPLATE_DIR/parameters/${environment}-environment-parameters.json"
    
    # テンプレート検証
    if aws cloudformation validate-template \
        --template-body "file://$template_file" \
        --region "$region" \
        --profile "$profile" >/dev/null 2>&1; then
        
        # 変更セット作成（ドライラン）
        local changeset_name="integration-test-$(date +%s)"
        
        if aws cloudformation create-change-set \
            --stack-name "$stack_name" \
            --template-body "file://$template_file" \
            --parameters "file://$param_file" \
            --change-set-name "$changeset_name" \
            --capabilities CAPABILITY_IAM \
            --region "$region" \
            --profile "$profile" >/dev/null 2>&1; then
            
            # 変更セット削除
            aws cloudformation delete-change-set \
                --stack-name "$stack_name" \
                --change-set-name "$changeset_name" \
                --region "$region" \
                --profile "$profile" >/dev/null 2>&1 || true
            
            record_test_result "デプロイメントテスト（ドライラン）" "PASS"
        else
            record_test_result "デプロイメントテスト（ドライラン）" "FAIL" "変更セット作成失敗"
        fi
    else
        record_test_result "デプロイメントテスト（ドライラン）" "FAIL" "テンプレート検証失敗"
    fi
}

# 2. リソース存在確認テスト
test_resource_existence() {
    local environment="$1"
    local region="$2"
    local profile="$3"
    
    log_test "リソース存在確認テスト実行中..."
    
    # 重要なリソースの存在確認
    local resources=(
        "WindowsADInstanceId:EC2インスタンス"
        "VpcId:VPC"
        "WindowsADSecurityGroupId:セキュリティグループ"
        "EncryptionKeyId:KMS暗号化キー"
    )
    
    local missing_resources=()
    
    for resource_info in "${resources[@]}"; do
        local output_key="${resource_info%%:*}"
        local resource_name="${resource_info##*:}"
        
        local resource_id
        resource_id=$(get_stack_output "$environment" "$region" "$profile" "$output_key")
        
        if [[ -z "$resource_id" ]]; then
            missing_resources+=("$resource_name ($output_key)")
        fi
    done
    
    if [[ ${#missing_resources[@]} -eq 0 ]]; then
        record_test_result "リソース存在確認テスト" "PASS"
    else
        record_test_result "リソース存在確認テスト" "FAIL" "不足リソース: ${missing_resources[*]}"
    fi
}

# 3. ネットワーク接続テスト
test_network_connectivity() {
    local environment="$1"
    local region="$2"
    local profile="$3"
    
    log_test "ネットワーク接続テスト実行中..."
    
    local instance_id
    instance_id=$(get_stack_output "$environment" "$region" "$profile" "WindowsADInstanceId")
    
    if [[ -z "$instance_id" ]]; then
        record_test_result "ネットワーク接続テスト" "FAIL" "インスタンスIDが取得できません"
        return
    fi
    
    # インスタンス状況確認
    local instance_state
    instance_state=$(aws ec2 describe-instances \
        --instance-ids "$instance_id" \
        --region "$region" \
        --profile "$profile" \
        --query 'Reservations[0].Instances[0].State.Name' \
        --output text 2>/dev/null || echo "")
    
    if [[ "$instance_state" == "running" ]]; then
        # Systems Manager接続確認
        if aws ssm describe-instance-information \
            --filters "Key=InstanceIds,Values=$instance_id" \
            --region "$region" \
            --profile "$profile" \
            --query 'InstanceInformationList[0].PingStatus' \
            --output text 2>/dev/null | grep -q "Online"; then
            record_test_result "ネットワーク接続テスト" "PASS"
        else
            record_test_result "ネットワーク接続テスト" "FAIL" "Systems Manager接続失敗"
        fi
    else
        record_test_result "ネットワーク接続テスト" "FAIL" "インスタンス状態: $instance_state"
    fi
}

# 4. Active Directory機能テスト
test_active_directory() {
    local environment="$1"
    local region="$2"
    local profile="$3"
    
    log_test "Active Directory機能テスト実行中..."
    
    local instance_id
    instance_id=$(get_stack_output "$environment" "$region" "$profile" "WindowsADInstanceId")
    
    if [[ -z "$instance_id" ]]; then
        record_test_result "Active Directory機能テスト" "FAIL" "インスタンスIDが取得できません"
        return
    fi
    
    # ADサービス状況確認
    local command_id
    command_id=$(aws ssm send-command \
        --document-name "AWS-RunPowerShellScript" \
        --targets "Key=InstanceIds,Values=$instance_id" \
        --parameters 'commands=["Get-Service ADWS,DNS,KDC,NETLOGON | ConvertTo-Json"]' \
        --region "$region" \
        --profile "$profile" \
        --query 'Command.CommandId' \
        --output text 2>/dev/null || echo "")
    
    if [[ -n "$command_id" ]]; then
        # コマンド実行結果待機
        sleep 10
        
        local command_output
        command_output=$(aws ssm get-command-invocation \
            --command-id "$command_id" \
            --instance-id "$instance_id" \
            --region "$region" \
            --profile "$profile" \
            --query 'StandardOutputContent' \
            --output text 2>/dev/null || echo "")
        
        if echo "$command_output" | grep -q '"Status": "Running"'; then
            record_test_result "Active Directory機能テスト" "PASS"
        else
            record_test_result "Active Directory機能テスト" "FAIL" "ADサービスが正常に動作していません"
        fi
    else
        record_test_result "Active Directory機能テスト" "FAIL" "コマンド実行失敗"
    fi
}

# 5. FSxドメイン参加確認テスト
test_fsx_domain_join() {
    local environment="$1"
    local region="$2"
    local profile="$3"
    
    log_test "FSxドメイン参加確認テスト実行中..."
    
    local fsx_id
    fsx_id=$(get_stack_output "$environment" "$region" "$profile" "FSxFileSystemId")
    
    if [[ -z "$fsx_id" ]]; then
        record_test_result "FSxドメイン参加確認テスト" "FAIL" "FSxファイルシステムIDが取得できません"
        return
    fi
    
    # FSx SVM状況確認
    local svm_status
    svm_status=$(aws fsx describe-storage-virtual-machines \
        --filters "Name=file-system-id,Values=$fsx_id" \
        --region "$region" \
        --profile "$profile" \
        --query 'StorageVirtualMachines[0].Lifecycle' \
        --output text 2>/dev/null || echo "")
    
    if [[ "$svm_status" == "CREATED" ]]; then
        # Active Directory設定確認
        local ad_config
        ad_config=$(aws fsx describe-storage-virtual-machines \
            --filters "Name=file-system-id,Values=$fsx_id" \
            --region "$region" \
            --profile "$profile" \
            --query 'StorageVirtualMachines[0].ActiveDirectoryConfiguration.NetBiosName' \
            --output text 2>/dev/null || echo "")
        
        if [[ -n "$ad_config" && "$ad_config" != "None" ]]; then
            record_test_result "FSxドメイン参加確認テスト" "PASS"
        else
            record_test_result "FSxドメイン参加確認テスト" "FAIL" "Active Directory設定が見つかりません"
        fi
    else
        record_test_result "FSxドメイン参加確認テスト" "FAIL" "SVM状態: $svm_status"
    fi
}

# 6. セキュリティ設定テスト
test_security_configuration() {
    local environment="$1"
    local region="$2"
    local profile="$3"
    
    log_test "セキュリティ設定テスト実行中..."
    
    local security_issues=()
    
    # CloudTrail確認
    local cloudtrail_arn
    cloudtrail_arn=$(get_stack_output "$environment" "$region" "$profile" "CloudTrailArn")
    
    if [[ -z "$cloudtrail_arn" || "$cloudtrail_arn" == "N/A" ]]; then
        security_issues+=("CloudTrail設定なし")
    fi
    
    # GuardDuty確認
    local guardduty_id
    guardduty_id=$(get_stack_output "$environment" "$region" "$profile" "GuardDutyDetectorId")
    
    if [[ -z "$guardduty_id" || "$guardduty_id" == "N/A" ]]; then
        security_issues+=("GuardDuty設定なし")
    fi
    
    # KMS暗号化キー確認
    local kms_key_id
    kms_key_id=$(get_stack_output "$environment" "$region" "$profile" "EncryptionKeyId")
    
    if [[ -z "$kms_key_id" ]]; then
        security_issues+=("KMS暗号化キーなし")
    fi
    
    if [[ ${#security_issues[@]} -eq 0 ]]; then
        record_test_result "セキュリティ設定テスト" "PASS"
    else
        record_test_result "セキュリティ設定テスト" "FAIL" "問題: ${security_issues[*]}"
    fi
}

# 7. 監視・ログ機能テスト
test_monitoring_logging() {
    local environment="$1"
    local region="$2"
    local profile="$3"
    
    log_test "監視・ログ機能テスト実行中..."
    
    local monitoring_issues=()
    
    # CloudWatchダッシュボード確認
    local dashboard_url
    dashboard_url=$(get_stack_output "$environment" "$region" "$profile" "MonitoringDashboardURL")
    
    if [[ -z "$dashboard_url" || "$dashboard_url" == "N/A" ]]; then
        monitoring_issues+=("CloudWatchダッシュボードなし")
    fi
    
    # ログ グループ確認
    local log_groups
    log_groups=$(aws logs describe-log-groups \
        --log-group-name-prefix "/aws/ec2/windows" \
        --region "$region" \
        --profile "$profile" \
        --query 'length(logGroups)' \
        --output text 2>/dev/null || echo "0")
    
    if [[ "$log_groups" -eq 0 ]]; then
        monitoring_issues+=("CloudWatchログ グループなし")
    fi
    
    # SNSトピック確認
    local sns_topic
    sns_topic=$(get_stack_output "$environment" "$region" "$profile" "AlertNotificationTopicArn")
    
    if [[ -z "$sns_topic" || "$sns_topic" == "N/A" ]]; then
        monitoring_issues+=("SNS通知トピックなし")
    fi
    
    if [[ ${#monitoring_issues[@]} -eq 0 ]]; then
        record_test_result "監視・ログ機能テスト" "PASS"
    else
        record_test_result "監視・ログ機能テスト" "FAIL" "問題: ${monitoring_issues[*]}"
    fi
}

# 8. パフォーマンステスト
test_performance() {
    local environment="$1"
    local region="$2"
    local profile="$3"
    
    log_test "パフォーマンステスト実行中..."
    
    local instance_id
    instance_id=$(get_stack_output "$environment" "$region" "$profile" "WindowsADInstanceId")
    
    if [[ -z "$instance_id" ]]; then
        record_test_result "パフォーマンステスト" "FAIL" "インスタンスIDが取得できません"
        return
    fi
    
    # CPU使用率確認（過去1時間の平均）
    local cpu_utilization
    cpu_utilization=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/EC2 \
        --metric-name CPUUtilization \
        --dimensions Name=InstanceId,Value="$instance_id" \
        --start-time "$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)" \
        --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)" \
        --period 3600 \
        --statistics Average \
        --region "$region" \
        --profile "$profile" \
        --query 'Datapoints[0].Average' \
        --output text 2>/dev/null || echo "")
    
    local performance_issues=()
    
    if [[ -n "$cpu_utilization" && "$cpu_utilization" != "None" ]]; then
        if (( $(echo "$cpu_utilization > 90" | bc -l) )); then
            performance_issues+=("高CPU使用率: ${cpu_utilization}%")
        fi
    else
        performance_issues+=("CPU使用率データなし")
    fi
    
    # FSx IOPS確認
    local fsx_id
    fsx_id=$(get_stack_output "$environment" "$region" "$profile" "FSxFileSystemId")
    
    if [[ -n "$fsx_id" ]]; then
        local fsx_iops
        fsx_iops=$(aws cloudwatch get-metric-statistics \
            --namespace AWS/FSx \
            --metric-name TotalIOPS \
            --dimensions Name=FileSystemId,Value="$fsx_id" \
            --start-time "$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)" \
            --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)" \
            --period 3600 \
            --statistics Average \
            --region "$region" \
            --profile "$profile" \
            --query 'Datapoints[0].Average' \
            --output text 2>/dev/null || echo "")
        
        if [[ -z "$fsx_iops" || "$fsx_iops" == "None" ]]; then
            performance_issues+=("FSx IOPSデータなし")
        fi
    fi
    
    if [[ ${#performance_issues[@]} -eq 0 ]]; then
        record_test_result "パフォーマンステスト" "PASS"
    else
        record_test_result "パフォーマンステスト" "FAIL" "問題: ${performance_issues[*]}"
    fi
}

# テストレポート生成
generate_test_report() {
    local environment="$1"
    local region="$2"
    local profile="$3"
    
    local report_file="$TEMPLATE_DIR/integration-test-report.txt"
    
    log_info "統合テストレポート生成中..."
    
    cat > "$report_file" << EOF
# Windows AD FSxN統合環境 統合テストレポート

## 実行情報
- 実行日時: $(date)
- 実行者: $(whoami)
- 対象環境: $environment
- リージョン: $region
- AWSプロファイル: $profile

## テスト結果サマリー
- 総テスト数: $TOTAL_TESTS
- 成功: $PASSED_TESTS
- 失敗: $FAILED_TESTS
- 成功率: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%

## 詳細結果
EOF
    
    for result in "${TEST_RESULTS[@]}"; do
        echo "- $result" >> "$report_file"
    done
    
    cat >> "$report_file" << EOF

## 推奨事項
$([ $FAILED_TESTS -eq 0 ] && echo "- 全てのテストが成功しました。システムは正常に動作しています。" || echo "- 失敗したテストの詳細を確認し、問題を修正してください。")
- 定期的な統合テストの実行を推奨します
- パフォーマンス監視を継続してください
- セキュリティ設定の定期的な見直しを行ってください

## 次のステップ
$([ $FAILED_TESTS -eq 0 ] && cat << 'NEXT_STEPS'
1. 本番運用の開始
2. 監視・アラート設定の最終確認
3. 運用手順書の確認
4. 災害復旧計画の確認
NEXT_STEPS
|| cat << 'FIX_STEPS'
1. 失敗したテストの詳細調査
2. 問題の根本原因分析
3. 修正作業の実施
4. 再テストの実行
FIX_STEPS
)

---
このレポートは自動生成されました。
EOF
    
    log_success "統合テストレポート生成完了: $report_file"
}

# メイン処理
main() {
    local environment="${1:-dev}"
    local region="${2:-ap-northeast-1}"
    local profile="${3:-default}"
    
    # ヘルプ表示
    if [[ "$environment" == "-h" || "$environment" == "--help" ]]; then
        show_usage
        exit 0
    fi
    
    log_info "Windows AD FSxN統合環境 統合テスト開始"
    log_info "対象環境: $environment"
    log_info "リージョン: $region"
    log_info "プロファイル: $profile"
    
    # AWS認証確認
    if ! aws sts get-caller-identity --profile "$profile" >/dev/null 2>&1; then
        log_error "AWS認証に失敗しました。プロファイル設定を確認してください: $profile"
        exit 1
    fi
    
    # スタック情報取得
    if ! get_stack_info "$environment" "$region" "$profile"; then
        log_error "スタック情報の取得に失敗しました"
        exit 1
    fi
    
    echo
    log_info "=== 統合テスト実行開始 ==="
    
    # 各テスト実行
    test_deployment_dryrun "$environment" "$region" "$profile"
    test_resource_existence "$environment" "$region" "$profile"
    test_network_connectivity "$environment" "$region" "$profile"
    test_active_directory "$environment" "$region" "$profile"
    test_fsx_domain_join "$environment" "$region" "$profile"
    test_security_configuration "$environment" "$region" "$profile"
    test_monitoring_logging "$environment" "$region" "$profile"
    test_performance "$environment" "$region" "$profile"
    
    # レポート生成
    generate_test_report "$environment" "$region" "$profile"
    
    # 結果サマリー
    echo
    log_info "=== 統合テスト結果サマリー ==="
    log_info "総テスト数: $TOTAL_TESTS"
    log_info "成功: $PASSED_TESTS"
    log_info "失敗: $FAILED_TESTS"
    log_info "成功率: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"
    
    if [[ $FAILED_TESTS -eq 0 ]]; then
        log_success "✓ 全ての統合テストが成功しました！"
        log_info "システムは正常に動作しています。"
        exit 0
    else
        log_error "✗ $FAILED_TESTS 件のテストが失敗しました。"
        log_error "詳細レポートを確認して問題を修正してください。"
        exit 1
    fi
}

# エラーハンドリング
trap 'log_error "スクリプト実行中にエラーが発生しました (行番号: $LINENO)"' ERR

# メイン処理実行
main "$@"