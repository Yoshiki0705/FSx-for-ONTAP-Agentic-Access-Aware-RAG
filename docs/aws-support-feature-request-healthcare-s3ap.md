# AWS サポートケース：機能改善要望

## サービス: Amazon FSx for NetApp ONTAP
## カテゴリ: Feature Request
## 緊急度: Low（一般的なガイダンス）

---

## 件名

FSx for ONTAP S3 Access Points を AWS HealthImaging・HealthOmics・HealthLake のデータソースとして利用したい

---

## 本文

お世話になっております。

FSx for ONTAP の S3 Access Points と AWS ヘルスケアサービスの統合について、機能改善を要望いたします。

### 実現したいこと

FSx for ONTAP ボリュームに保存された医療データ（DICOM画像、ゲノムデータ、FHIRリソース）を、S3 Access Points 経由で以下のサービスに直接取り込みたいと考えています。

- AWS HealthImaging（DICOM P10 ファイルのインポート）
- AWS HealthOmics（FASTQ/BAM/CRAM ファイルのインポート）
- AWS HealthLake（FHIR JSON/NDJSON のインポート）

### 現在の状況

FSx for ONTAP の S3 Access Points は、Athena・Glue・Bedrock Knowledge Bases・EMR Serverless・Lambda・CloudFront・Transfer Family との統合が既にサポートされています。

一方、上記ヘルスケアサービスでは、データインポート時の S3 URI パラメータ（HealthImaging の inputS3Uri、HealthOmics の sourceFiles 等）が標準 S3 バケットパス（s3://bucket-name/prefix/）のみを受け付けており、S3 Access Point ARN やアクセスポイントエイリアスを指定できません。

そのため現状では、FSx for ONTAP 上の医療データを一度標準 S3 バケットにコピーしてからインポートする必要があり、以下の課題が生じています。

- ストレージコストの増大（特に DICOM 画像やゲノムデータは数百 GB〜TB 規模）
- データ同期パイプラインの構築・運用負荷
- 医療データの複製によるデータガバナンス上の懸念

### 要望の背景

NetApp ONTAP は医療・ライフサイエンス業界で広く採用されているストレージ基盤です（国内：大分県立病院等の医療機関、海外：Pfizer 等の製薬企業）。これらの組織が FSx for ONTAP を活用して AWS 上で医療データ分析を行う際に、S3 Access Points を介したヘルスケアサービスとの直接統合が実現すれば、データコピー不要の効率的なアーキテクチャが可能になります。

既に S3 Access Points 統合が実現されている他サービスと同様のパターンで、ヘルスケアサービス群への対応拡張をご検討いただけますと幸いです。

### 対象リソース・リージョン

- リージョン: ap-northeast-1（東京）
- 利用中のサービス: Amazon FSx for NetApp ONTAP、Amazon Bedrock、Amazon S3

以上、ご検討のほどよろしくお願いいたします。
