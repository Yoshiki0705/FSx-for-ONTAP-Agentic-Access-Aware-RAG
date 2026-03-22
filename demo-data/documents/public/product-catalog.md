# 製品カタログ

## Permission-aware RAG System

### 概要
FSx for ONTAPのアクセス権限情報を活用し、ユーザーごとに適切な検索結果を返すRAGシステムです。

### 主要機能
- **権限ベース検索**: ユーザーのSID/ACL情報に基づくドキュメントフィルタリング
- **高精度RAG**: Amazon Bedrock Knowledge Baseによるベクトル検索
- **リアルタイムチャット**: ストリーミングレスポンスによる快適な対話体験
- **多言語対応**: 日本語・英語の2言語サポート

### 対応ストレージ
- FSx for NetApp ONTAP (FlexCache)
- Amazon S3
- OpenSearch Serverless (ベクトルストア)

### 動作要件
- AWS アカウント
- Node.js 18+
- AWS CDK v2
- Docker

### 価格体系
オープンソースソフトウェアとして無償提供。AWSリソースの利用料金は別途発生します。
