#!/usr/bin/env python3
"""
Embedding Quality Analysis Script

FSx for ONTAPからOpenSearch Serverlessへのエンベディング品質を分析
"""

import json
import logging
import argparse
import boto3
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import requests
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
import matplotlib.pyplot as plt
import seaborn as sns

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class EmbeddingQualityAnalyzer:
    """エンベディング品質分析クラス"""
    
    def __init__(self, 
                 opensearch_endpoint: str,
                 s3_bucket: str,
                 region: str = 'us-east-1'):
        """
        初期化
        
        Args:
            opensearch_endpoint: OpenSearchエンドポイント
            s3_bucket: S3バケット名
            region: AWSリージョン
        """
        self.opensearch_endpoint = opensearch_endpoint
        self.s3_bucket = s3_bucket
        self.region = region
        
        # AWSクライアント初期化
        self.s3_client = boto3.client('s3', region_name=region)
        self.bedrock_client = boto3.client('bedrock-runtime', region_name=region)
        
        # 結果保存用
        self.analysis_results = {}
        
    def analyze_embedding_distribution(self, embeddings: List[List[float]]) -> Dict:
        """
        エンベディングの分布を分析
        
        Args:
            embeddings: エンベディングベクトルのリスト
            
        Returns:
            分析結果の辞書
        """
        logger.info("エンベディング分布を分析中...")
        
        embeddings_array = np.array(embeddings)
        
        # 基本統計
        stats = {
            'count': len(embeddings),
            'dimensions': embeddings_array.shape[1],
            'mean_norm': np.mean(np.linalg.norm(embeddings_array, axis=1)),
            'std_norm': np.std(np.linalg.norm(embeddings_array, axis=1)),
            'mean_values': np.mean(embeddings_array, axis=0).tolist(),
            'std_values': np.std(embeddings_array, axis=0).tolist()
        }
        
        # 次元ごとの統計
        dimension_stats = []
        for i in range(embeddings_array.shape[1]):
            dim_values = embeddings_array[:, i]
            dimension_stats.append({
                'dimension': i,
                'mean': float(np.mean(dim_values)),
                'std': float(np.std(dim_values)),
                'min': float(np.min(dim_values)),
                'max': float(np.max(dim_values)),
                'zero_ratio': float(np.sum(dim_values == 0) / len(dim_values))
            })
        
        return {
            'basic_stats': stats,
            'dimension_stats': dimension_stats
        }
    
    def analyze_semantic_similarity(self, 
                                   embeddings: List[List[float]], 
                                   documents: List[Dict]) -> Dict:
        """
        意味的類似性を分析
        
        Args:
            embeddings: エンベディングベクトル
            documents: ドキュメント情報
            
        Returns:
            類似性分析結果
        """
        logger.info("意味的類似性を分析中...")
        
        embeddings_array = np.array(embeddings)
        
        # コサイン類似度行列を計算
        similarity_matrix = cosine_similarity(embeddings_array)
        
        # 類似度統計
        # 対角線を除く（自分自身との類似度は1.0）
        mask = ~np.eye(similarity_matrix.shape[0], dtype=bool)
        similarities = similarity_matrix[mask]
        
        similarity_stats = {
            'mean_similarity': float(np.mean(similarities)),
            'std_similarity': float(np.std(similarities)),
            'min_similarity': float(np.min(similarities)),
            'max_similarity': float(np.max(similarities)),
            'median_similarity': float(np.median(similarities))
        }
        
        # 最も類似したドキュメントペアを特定
        max_sim_idx = np.unravel_index(
            np.argmax(similarity_matrix * (1 - np.eye(len(embeddings)))), 
            similarity_matrix.shape
        )
        
        most_similar_pair = {
            'doc1_index': int(max_sim_idx[0]),
            'doc2_index': int(max_sim_idx[1]),
            'similarity': float(similarity_matrix[max_sim_idx]),
            'doc1_title': documents[max_sim_idx[0]].get('title', f'Document {max_sim_idx[0]}'),
            'doc2_title': documents[max_sim_idx[1]].get('title', f'Document {max_sim_idx[1]}')
        }
        
        return {
            'similarity_stats': similarity_stats,
            'most_similar_pair': most_similar_pair,
            'similarity_matrix_shape': similarity_matrix.shape
        }
    
    def analyze_clustering_quality(self, 
                                  embeddings: List[List[float]], 
                                  documents: List[Dict],
                                  n_clusters: int = 5) -> Dict:
        """
        クラスタリング品質を分析
        
        Args:
            embeddings: エンベディングベクトル
            documents: ドキュメント情報
            n_clusters: クラスタ数
            
        Returns:
            クラスタリング分析結果
        """
        logger.info(f"クラスタリング品質を分析中 (k={n_clusters})...")
        
        embeddings_array = np.array(embeddings)
        
        # K-meansクラスタリング
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        cluster_labels = kmeans.fit_predict(embeddings_array)
        
        # クラスタ内距離とクラスタ間距離を計算
        inertia = kmeans.inertia_
        
        # シルエット分析（簡易版）
        cluster_stats = []
        for i in range(n_clusters):
            cluster_mask = cluster_labels == i
            cluster_embeddings = embeddings_array[cluster_mask]
            
            if len(cluster_embeddings) > 1:
                # クラスタ内の平均距離
                cluster_center = kmeans.cluster_centers_[i]
                distances = np.linalg.norm(cluster_embeddings - cluster_center, axis=1)
                avg_distance = np.mean(distances)
            else:
                avg_distance = 0.0
            
            cluster_docs = [documents[j] for j in range(len(documents)) if cluster_labels[j] == i]
            
            cluster_stats.append({
                'cluster_id': i,
                'size': int(np.sum(cluster_mask)),
                'avg_distance_to_center': float(avg_distance),
                'documents': [doc.get('title', f'Document {j}') for j, doc in enumerate(cluster_docs)]
            })
        
        return {
            'n_clusters': n_clusters,
            'inertia': float(inertia),
            'cluster_stats': cluster_stats
        }
    
    def analyze_dimensionality_reduction(self, embeddings: List[List[float]]) -> Dict:
        """
        次元削減による可視化分析
        
        Args:
            embeddings: エンベディングベクトル
            
        Returns:
            次元削減分析結果
        """
        logger.info("次元削減分析を実行中...")
        
        embeddings_array = np.array(embeddings)
        
        # PCA分析
        pca = PCA(n_components=min(50, embeddings_array.shape[1]))
        pca_result = pca.fit_transform(embeddings_array)
        
        # 寄与率
        explained_variance_ratio = pca.explained_variance_ratio_
        cumulative_variance = np.cumsum(explained_variance_ratio)
        
        # 95%の分散を説明するのに必要な次元数
        n_components_95 = np.argmax(cumulative_variance >= 0.95) + 1
        
        return {
            'original_dimensions': embeddings_array.shape[1],
            'pca_components': len(explained_variance_ratio),
            'explained_variance_ratio': explained_variance_ratio.tolist(),
            'cumulative_variance': cumulative_variance.tolist(),
            'n_components_for_95_variance': int(n_components_95),
            'first_pc_variance': float(explained_variance_ratio[0]),
            'first_two_pc_variance': float(np.sum(explained_variance_ratio[:2]))
        }
    
    def test_search_quality(self, 
                           test_queries: List[Dict],
                           embeddings: List[List[float]],
                           documents: List[Dict]) -> Dict:
        """
        検索品質をテスト
        
        Args:
            test_queries: テストクエリリスト
            embeddings: ドキュメントエンベディング
            documents: ドキュメント情報
            
        Returns:
            検索品質分析結果
        """
        logger.info("検索品質をテスト中...")
        
        search_results = []
        
        for query in test_queries:
            query_text = query['text']
            expected_topics = query.get('expected_topics', [])
            
            # クエリのエンベディングを生成
            query_embedding = self._generate_query_embedding(query_text)
            
            if query_embedding is None:
                continue
            
            # 類似度計算
            similarities = cosine_similarity([query_embedding], embeddings)[0]
            
            # 上位結果を取得
            top_k = 5
            top_indices = np.argsort(similarities)[::-1][:top_k]
            
            # 結果の評価
            top_results = []
            for idx in top_indices:
                doc = documents[idx]
                similarity = similarities[idx]
                
                # 期待されるトピックとの一致度を計算（簡易版）
                doc_text = doc.get('content', doc.get('title', ''))
                topic_matches = sum(1 for topic in expected_topics 
                                  if topic.lower() in doc_text.lower())
                
                top_results.append({
                    'document_index': int(idx),
                    'document_title': doc.get('title', f'Document {idx}'),
                    'similarity': float(similarity),
                    'topic_matches': topic_matches,
                    'relevance_score': float(similarity * (1 + topic_matches * 0.1))
                })
            
            search_results.append({
                'query_id': query.get('id', ''),
                'query_text': query_text,
                'expected_topics': expected_topics,
                'top_results': top_results,
                'avg_similarity': float(np.mean([r['similarity'] for r in top_results])),
                'avg_relevance': float(np.mean([r['relevance_score'] for r in top_results]))
            })
        
        # 全体統計
        overall_stats = {
            'total_queries': len(search_results),
            'avg_top1_similarity': float(np.mean([r['top_results'][0]['similarity'] 
                                                for r in search_results if r['top_results']])),
            'avg_top5_similarity': float(np.mean([r['avg_similarity'] for r in search_results])),
            'avg_relevance_score': float(np.mean([r['avg_relevance'] for r in search_results]))
        }
        
        return {
            'search_results': search_results,
            'overall_stats': overall_stats
        }
    
    def _generate_query_embedding(self, query_text: str) -> Optional[List[float]]:
        """
        クエリのエンベディングを生成
        
        Args:
            query_text: クエリテキスト
            
        Returns:
            エンベディングベクトル
        """
        try:
            response = self.bedrock_client.invoke_model(
                modelId='amazon.titan-embed-text-v1',
                body=json.dumps({
                    'inputText': query_text
                })
            )
            
            response_body = json.loads(response['body'].read())
            return response_body['embedding']
            
        except Exception as e:
            logger.error(f"クエリエンベディング生成エラー: {e}")
            return None
    
    def load_embeddings_from_s3(self, prefix: str) -> Tuple[List[List[float]], List[Dict]]:
        """
        S3からエンベディングデータを読み込み
        
        Args:
            prefix: S3プレフィックス
            
        Returns:
            エンベディングとドキュメント情報のタプル
        """
        logger.info(f"S3からエンベディングを読み込み中: {prefix}")
        
        embeddings = []
        documents = []
        
        try:
            # S3オブジェクトリストを取得
            response = self.s3_client.list_objects_v2(
                Bucket=self.s3_bucket,
                Prefix=prefix
            )
            
            for obj in response.get('Contents', []):
                key = obj['Key']
                if key.endswith('.json'):
                    # エンベディングファイルを読み込み
                    obj_response = self.s3_client.get_object(
                        Bucket=self.s3_bucket,
                        Key=key
                    )
                    
                    data = json.loads(obj_response['Body'].read())
                    
                    if 'embedding' in data and 'document' in data:
                        embeddings.append(data['embedding'])
                        documents.append(data['document'])
            
            logger.info(f"読み込み完了: {len(embeddings)} エンベディング")
            return embeddings, documents
            
        except Exception as e:
            logger.error(f"S3読み込みエラー: {e}")
            return [], []
    
    def generate_visualization_report(self, 
                                    embeddings: List[List[float]], 
                                    documents: List[Dict],
                                    output_dir: str) -> str:
        """
        可視化レポートを生成
        
        Args:
            embeddings: エンベディングベクトル
            documents: ドキュメント情報
            output_dir: 出力ディレクトリ
            
        Returns:
            レポートファイルパス
        """
        logger.info("可視化レポートを生成中...")
        
        embeddings_array = np.array(embeddings)
        
        # PCA for visualization
        pca = PCA(n_components=2)
        embeddings_2d = pca.fit_transform(embeddings_array)
        
        # プロット作成
        plt.figure(figsize=(15, 10))
        
        # 1. エンベディング分布の2D可視化
        plt.subplot(2, 3, 1)
        plt.scatter(embeddings_2d[:, 0], embeddings_2d[:, 1], alpha=0.6)
        plt.title('Embedding Distribution (PCA)')
        plt.xlabel(f'PC1 ({pca.explained_variance_ratio_[0]:.2%} variance)')
        plt.ylabel(f'PC2 ({pca.explained_variance_ratio_[1]:.2%} variance)')
        
        # 2. ノルム分布
        plt.subplot(2, 3, 2)
        norms = np.linalg.norm(embeddings_array, axis=1)
        plt.hist(norms, bins=20, alpha=0.7)
        plt.title('Embedding Norm Distribution')
        plt.xlabel('L2 Norm')
        plt.ylabel('Frequency')
        
        # 3. 次元別分散
        plt.subplot(2, 3, 3)
        variances = np.var(embeddings_array, axis=0)
        plt.plot(variances)
        plt.title('Variance per Dimension')
        plt.xlabel('Dimension')
        plt.ylabel('Variance')
        
        # 4. クラスタリング結果
        plt.subplot(2, 3, 4)
        kmeans = KMeans(n_clusters=5, random_state=42, n_init=10)
        cluster_labels = kmeans.fit_predict(embeddings_array)
        scatter = plt.scatter(embeddings_2d[:, 0], embeddings_2d[:, 1], 
                            c=cluster_labels, cmap='viridis', alpha=0.6)
        plt.colorbar(scatter)
        plt.title('K-means Clustering (k=5)')
        plt.xlabel('PC1')
        plt.ylabel('PC2')
        
        # 5. 類似度行列のヒートマップ（サンプル）
        plt.subplot(2, 3, 5)
        if len(embeddings) <= 20:  # 小さなデータセットの場合のみ
            similarity_matrix = cosine_similarity(embeddings_array)
            sns.heatmap(similarity_matrix, cmap='viridis', square=True)
            plt.title('Similarity Matrix')
        else:
            # 大きなデータセットの場合はサンプル
            sample_indices = np.random.choice(len(embeddings), 20, replace=False)
            sample_embeddings = embeddings_array[sample_indices]
            similarity_matrix = cosine_similarity(sample_embeddings)
            sns.heatmap(similarity_matrix, cmap='viridis', square=True)
            plt.title('Similarity Matrix (Sample)')
        
        # 6. PCA寄与率
        plt.subplot(2, 3, 6)
        pca_full = PCA()
        pca_full.fit(embeddings_array)
        cumsum_variance = np.cumsum(pca_full.explained_variance_ratio_)
        plt.plot(range(1, len(cumsum_variance) + 1), cumsum_variance)
        plt.axhline(y=0.95, color='r', linestyle='--', label='95% variance')
        plt.title('Cumulative Explained Variance')
        plt.xlabel('Number of Components')
        plt.ylabel('Cumulative Variance Explained')
        plt.legend()
        
        plt.tight_layout()
        
        # 保存
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        plot_file = f"{output_dir}/embedding_analysis_{timestamp}.png"
        plt.savefig(plot_file, dpi=300, bbox_inches='tight')
        plt.close()
        
        logger.info(f"可視化レポート保存: {plot_file}")
        return plot_file
    
    def run_comprehensive_analysis(self, 
                                  embedding_prefix: str,
                                  test_queries: List[Dict],
                                  output_dir: str) -> Dict:
        """
        包括的な分析を実行
        
        Args:
            embedding_prefix: S3エンベディングプレフィックス
            test_queries: テストクエリ
            output_dir: 出力ディレクトリ
            
        Returns:
            分析結果
        """
        logger.info("包括的な分析を開始...")
        
        # エンベディングデータの読み込み
        embeddings, documents = self.load_embeddings_from_s3(embedding_prefix)
        
        if not embeddings:
            logger.error("エンベディングデータが見つかりません")
            return {}
        
        # 各種分析の実行
        results = {
            'timestamp': datetime.now().isoformat(),
            'data_summary': {
                'embedding_count': len(embeddings),
                'document_count': len(documents),
                'embedding_dimensions': len(embeddings[0]) if embeddings else 0
            }
        }
        
        # 1. 分布分析
        results['distribution_analysis'] = self.analyze_embedding_distribution(embeddings)
        
        # 2. 類似性分析
        results['similarity_analysis'] = self.analyze_semantic_similarity(embeddings, documents)
        
        # 3. クラスタリング分析
        results['clustering_analysis'] = self.analyze_clustering_quality(embeddings, documents)
        
        # 4. 次元削減分析
        results['dimensionality_analysis'] = self.analyze_dimensionality_reduction(embeddings)
        
        # 5. 検索品質テスト
        if test_queries:
            results['search_quality_analysis'] = self.test_search_quality(
                test_queries, embeddings, documents
            )
        
        # 6. 可視化レポート生成
        plot_file = self.generate_visualization_report(embeddings, documents, output_dir)
        results['visualization_report'] = plot_file
        
        # 結果保存
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        results_file = f"{output_dir}/embedding_quality_analysis_{timestamp}.json"
        
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        
        logger.info(f"分析結果保存: {results_file}")
        
        return results

def main():
    """メイン関数"""
    parser = argparse.ArgumentParser(description='Embedding Quality Analysis')
    parser.add_argument('--opensearch-endpoint', required=True,
                       help='OpenSearch endpoint URL')
    parser.add_argument('--s3-bucket', required=True,
                       help='S3 bucket name')
    parser.add_argument('--embedding-prefix', required=True,
                       help='S3 prefix for embedding data')
    parser.add_argument('--queries-file', 
                       help='Test queries JSON file')
    parser.add_argument('--output-dir', default='./analysis_output',
                       help='Output directory for results')
    parser.add_argument('--region', default='us-east-1',
                       help='AWS region')
    parser.add_argument('--verbose', action='store_true',
                       help='Enable verbose logging')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # 出力ディレクトリ作成
    import os
    os.makedirs(args.output_dir, exist_ok=True)
    
    # テストクエリの読み込み
    test_queries = []
    if args.queries_file and os.path.exists(args.queries_file):
        with open(args.queries_file, 'r', encoding='utf-8') as f:
            query_data = json.load(f)
            test_queries = query_data.get('queries', [])
    
    # 分析実行
    analyzer = EmbeddingQualityAnalyzer(
        opensearch_endpoint=args.opensearch_endpoint,
        s3_bucket=args.s3_bucket,
        region=args.region
    )
    
    results = analyzer.run_comprehensive_analysis(
        embedding_prefix=args.embedding_prefix,
        test_queries=test_queries,
        output_dir=args.output_dir
    )
    
    # 結果サマリーの表示
    if results:
        print("\n=== 分析結果サマリー ===")
        print(f"エンベディング数: {results['data_summary']['embedding_count']}")
        print(f"次元数: {results['data_summary']['embedding_dimensions']}")
        
        if 'similarity_analysis' in results:
            sim_stats = results['similarity_analysis']['similarity_stats']
            print(f"平均類似度: {sim_stats['mean_similarity']:.3f}")
            print(f"類似度標準偏差: {sim_stats['std_similarity']:.3f}")
        
        if 'search_quality_analysis' in results:
            search_stats = results['search_quality_analysis']['overall_stats']
            print(f"平均検索類似度: {search_stats['avg_top5_similarity']:.3f}")
            print(f"平均関連性スコア: {search_stats['avg_relevance_score']:.3f}")
        
        print(f"\n詳細結果: {args.output_dir}")

if __name__ == '__main__':
    main()