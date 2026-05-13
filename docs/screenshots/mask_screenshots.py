#!/usr/bin/env python3
"""
スクリーンショットからAWSアカウントIDなどの機密情報をマスクするスクリプト。

対象:
  - transfer-family-server-detail.png: ナビバーのアカウント情報 + Tagsセクション
  - transfer-family-ingestion-trigger-lambda.png: Function ARN表示エリア

使用方法:
  python3 docs/screenshots/mask_screenshots.py
"""

from pathlib import Path
from PIL import Image, ImageDraw

SCRIPT_DIR = Path(__file__).parent

# マスク対象のAWSアカウントID（環境変数またはデフォルト値）
import os
ACCOUNT_ID = os.environ.get("AWS_ACCOUNT_ID", "XXXXXXXXXXXX")


def mask_transfer_family_server_detail():
    """
    transfer-family-server-detail.png のマスク処理
    画像サイズ: 3024x5200 (Retina 2x)
    
    マスク対象:
    1. ナビバー右上のアカウント情報（ユーザー名 + アカウントID）
       - 画像中間付近（2画面結合）のナビバー部分
    2. Tags セクションの aws:cloudformation:stack-id 値
       - ARN内にアカウントIDが含まれる
    """
    filepath = SCRIPT_DIR / "transfer-family-server-detail.png"
    if not filepath.exists():
        print(f"  ⏭️  {filepath.name}: ファイルが見つかりません")
        return

    img = Image.open(filepath)
    draw = ImageDraw.Draw(img)
    width, height = img.size
    print(f"  📐 {filepath.name}: {width}x{height}")

    # 1. 上半分のナビバー右上（最初の画面キャプチャ部分）
    #    画像の上部にはナビバーがないので、中間のナビバーを探す
    #    2つの画面が結合されている: 上半分と下半分
    #    中間のナビバーは約 y=1260 付近（画面の約24%位置）
    #    アカウント情報は右端から約500px、高さ約50px
    
    # 中間ナビバーのアカウント情報（2画面結合の境界付近）
    # ナビバーは y≈1260-1310 付近、右端に表示
    nav_mid_box = (width - 600, 1250, width, 1310)
    draw.rectangle(nav_mid_box, fill="black")

    # 2. Tags セクションの CloudFormation stack-id ARN
    #    ARN内にアカウントIDが含まれるため、Value列全体をマスク
    #    画像下部（約 y=4900-4950 付近）の Value 列
    #    Value列は x≈380 から始まる
    tag_arn_box = (380, 4880, width - 50, 4940)
    draw.rectangle(tag_arn_box, fill="black")

    img.save(filepath)
    print(f"  ✅ {filepath.name}: マスク完了")


def mask_transfer_family_ingestion_trigger_lambda():
    """
    transfer-family-ingestion-trigger-lambda.png のマスク処理
    画像サイズ: 3024x1618 (Retina 2x)
    
    マスク対象:
    1. Function ARN表示エリア（右側パネル）
       - Lambda Function ARN にアカウントIDが含まれる
    """
    filepath = SCRIPT_DIR / "transfer-family-ingestion-trigger-lambda.png"
    if not filepath.exists():
        print(f"  ⏭️  {filepath.name}: ファイルが見つかりません")
        return

    img = Image.open(filepath)
    draw = ImageDraw.Draw(img)
    width, height = img.size
    print(f"  📐 {filepath.name}: {width}x{height}")

    # Function ARN表示エリア（右側パネル上部）
    # "Function ARN" ラベルの下にARN値が表示される
    # 右側パネルは x≈2000 から始まり、ARN値は y≈560-700 付近
    arn_box = (2000, 580, width - 40, 710)
    draw.rectangle(arn_box, fill="black")

    img.save(filepath)
    print(f"  ✅ {filepath.name}: マスク完了")


if __name__ == "__main__":
    print("🔒 スクリーンショットマスク処理開始...")
    print(f"   マスク対象アカウントID: {ACCOUNT_ID}")
    mask_transfer_family_server_detail()
    mask_transfer_family_ingestion_trigger_lambda()
    print("✅ 完了")
