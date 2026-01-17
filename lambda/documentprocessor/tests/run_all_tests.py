#!/usr/bin/env python3
"""
Markitdown統合機能の全テスト実行スクリプト
単体テスト、統合テスト、パフォーマンステストを順次実行
"""

import os
import sys
import subprocess
import time
from datetime import datetime
import argparse
import json

def run_command(command, description, timeout=300):
    """
    コマンドを実行し、結果を返す
    
    Args:
        command: 実行するコマンド
        description: コマンドの説明
        timeout: タイムアウト時間（秒）
    
    Returns:
        tuple: (成功フラグ, 実行時間, 出力)
    """
    print(f"\n🚀 {description}")
    print(f"コマンド: {' '.join(command)}")
    print("-" * 60)
    
    start_time = time.time()
    
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=os.path.dirname(os.path.abspath(__file__))
        )
        
        end_time = time.time()
        execution_time = end_time - start_time
        
        if result.returncode == 0:
            print(f"✅ {description} 成功 ({execution_time:.2f}秒)")
            if result.stdout:
                print("出力:")\n                print(result.stdout)
        else:
            print(f"❌ {description} 失敗 ({execution_time:.2f}秒)")
            if result.stderr:
                print("エラー出力:")
                print(result.stderr)
            if result.stdout:
                print("標準出力:")
                print(result.stdout)
        
        return result.returncode == 0, execution_time, result.stdout
        
    except subprocess.TimeoutExpired:
        print(f"⏰ {description} タイムアウト ({timeout}秒)")
        return False, timeout, "タイムアウトが発生しました"
    except Exception as e:
        end_time = time.time()
        execution_time = end_time - start_time
        print(f"💥 {description} 実行エラー: {e}")
        return False, execution_time, str(e)

def check_dependencies():
    """依存関係チェック"""
    print("📋 依存関係チェック開始")
    
    required_modules = [
        'boto3',
        'moto',
        'unittest',
        'json',
        'tempfile'
    ]
    
    missing_modules = []
    
    for module in required_modules:
        try:
            __import__(module)
            print(f"✅ {module}: インストール済み")
        except ImportError:
            print(f"❌ {module}: 未インストール")
            missing_modules.append(module)
    
    if missing_modules:
        print(f"\n⚠️  不足している依存関係: {', '.join(missing_modules)}")
        print("以下のコマンドでインストールしてください:")
        print(f"pip install {' '.join(missing_modules)}")
        return False
    
    print("✅ 全依存関係が満たされています")
    return True

def run_unit_tests():
    """単体テスト実行"""
    return run_command(
        ['python3', 'test_markitdown_integration.py'],
        "単体テスト実行",
        timeout=600
    )

def run_integration_tests():
    """統合テスト実行"""
    return run_command(
        ['python3', 'test_integration.py'],
        "統合テスト実行",
        timeout=900
    )

def run_aws_integration_tests(region='us-east-1', environment='test'):
    """AWS統合テスト実行"""
    return run_command(
        ['python3', 'integration_test_runner.py', '--region', region, '--environment', environment, '--verbose'],
        f"AWS統合テスト実行 (region={region}, env={environment})",
        timeout=1800
    )

def generate_test_data():
    """テストデータ生成"""
    return run_command(
        ['python3', 'test_data/sample_documents.py'],
        "テストデータ生成",
        timeout=60
    )

def generate_comprehensive_report(test_results, output_file='comprehensive_test_report.json'):
    """包括的テストレポート生成"""
    print(f"\n📊 包括的テストレポート生成: {output_file}")
    
    total_tests = len(test_results)
    successful_tests = sum(1 for result in test_results if result['success'])
    failed_tests = total_tests - successful_tests
    
    total_time = sum(result['execution_time'] for result in test_results)
    success_rate = (successful_tests / total_tests * 100) if total_tests > 0 else 0
    
    report_data = {
        'timestamp': datetime.now().isoformat(),
        'summary': {
            'total_test_suites': total_tests,
            'successful_suites': successful_tests,
            'failed_suites': failed_tests,
            'success_rate': success_rate,
            'total_execution_time': total_time
        },
        'test_results': test_results,
        'environment_info': {
            'python_version': sys.version,
            'platform': sys.platform,
            'working_directory': os.getcwd()
        }
    }
    
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False, default=str)
        
        print(f"✅ レポート保存完了: {output_file}")
        return True
    except Exception as e:
        print(f"❌ レポート保存エラー: {e}")
        return False

def print_summary(test_results):
    """テスト結果サマリー出力"""
    print(f"\n{'='*80}")
    print(f"Markitdown統合機能 全テスト結果サマリー")
    print(f"{'='*80}")
    print(f"実行日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    total_tests = len(test_results)
    successful_tests = sum(1 for result in test_results if result['success'])
    failed_tests = total_tests - successful_tests
    total_time = sum(result['execution_time'] for result in test_results)
    success_rate = (successful_tests / total_tests * 100) if total_tests > 0 else 0
    
    print(f"\n📊 全体サマリー")
    print(f"  テストスイート数: {total_tests}")
    print(f"  成功: {successful_tests}")
    print(f"  失敗: {failed_tests}")
    print(f"  成功率: {success_rate:.1f}%")
    print(f"  総実行時間: {total_time:.2f}秒")
    
    print(f"\n📋 詳細結果")
    for i, result in enumerate(test_results, 1):
        status = "✅ 成功" if result['success'] else "❌ 失敗"
        print(f"  {i:2d}. {result['name']}: {status} ({result['execution_time']:.2f}秒)")
        
        if not result['success'] and 'error_info' in result:
            print(f"      エラー: {result['error_info']}")
    
    print(f"\n{'='*80}")
    
    if failed_tests == 0:
        print("🎉 全テストが成功しました！")
        return True
    else:
        print(f"❌ {failed_tests}個のテストスイートが失敗しました")
        return False

def main():
    """メイン関数"""
    parser = argparse.ArgumentParser(description='Markitdown統合機能全テスト実行')
    parser.add_argument('--skip-unit', action='store_true', help='単体テストをスキップ')
    parser.add_argument('--skip-integration', action='store_true', help='統合テストをスキップ')
    parser.add_argument('--skip-aws', action='store_true', help='AWS統合テストをスキップ')
    parser.add_argument('--region', default='us-east-1', help='AWSリージョン')
    parser.add_argument('--environment', default='test', help='環境名')
    parser.add_argument('--output', default='comprehensive_test_report.json', help='レポート出力ファイル')
    parser.add_argument('--verbose', '-v', action='store_true', help='詳細出力')
    
    args = parser.parse_args()
    
    print("🧪 Markitdown統合機能 全テスト実行開始")
    print(f"実行時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 依存関係チェック
    if not check_dependencies():
        print("❌ 依存関係が不足しています。テストを中止します。")
        sys.exit(1)
    
    test_results = []
    
    # 1. テストデータ生成
    print(f"\n{'='*60}")
    print("1. テストデータ生成")
    print(f"{'='*60}")
    
    success, exec_time, output = generate_test_data()
    test_results.append({
        'name': 'テストデータ生成',
        'success': success,
        'execution_time': exec_time,
        'output': output
    })
    
    if not success:
        print("⚠️  テストデータ生成に失敗しましたが、テストを続行します")
    
    # 2. 単体テスト
    if not args.skip_unit:
        print(f"\n{'='*60}")
        print("2. 単体テスト実行")
        print(f"{'='*60}")
        
        success, exec_time, output = run_unit_tests()
        test_results.append({
            'name': '単体テスト',
            'success': success,
            'execution_time': exec_time,
            'output': output
        })
        
        if not success:
            print("⚠️  単体テストに失敗しましたが、テストを続行します")
    else:
        print("⏭️  単体テストをスキップしました")
    
    # 3. 統合テスト
    if not args.skip_integration:
        print(f"\n{'='*60}")
        print("3. 統合テスト実行")
        print(f"{'='*60}")
        
        success, exec_time, output = run_integration_tests()
        test_results.append({
            'name': '統合テスト',
            'success': success,
            'execution_time': exec_time,
            'output': output
        })
        
        if not success:
            print("⚠️  統合テストに失敗しましたが、テストを続行します")
    else:
        print("⏭️  統合テストをスキップしました")
    
    # 4. AWS統合テスト
    if not args.skip_aws:
        print(f"\n{'='*60}")
        print("4. AWS統合テスト実行")
        print(f"{'='*60}")
        
        success, exec_time, output = run_aws_integration_tests(args.region, args.environment)
        test_results.append({
            'name': 'AWS統合テスト',
            'success': success,
            'execution_time': exec_time,
            'output': output
        })
        
        if not success:
            print("⚠️  AWS統合テストに失敗しました")
    else:
        print("⏭️  AWS統合テストをスキップしました")
    
    # 5. レポート生成
    print(f"\n{'='*60}")
    print("5. レポート生成")
    print(f"{'='*60}")
    
    generate_comprehensive_report(test_results, args.output)
    
    # 6. サマリー出力
    overall_success = print_summary(test_results)
    
    # 終了コード設定
    sys.exit(0 if overall_success else 1)

if __name__ == '__main__':
    main()