構成s` - インフラration.tnteg-ichified-bats/simplconstruct`cdk/lib/限フィルタリング
-  RAG検索と権index.js` -processor/ry-g-quembda/ra保存
- `laァイルパス込み生成とフs` - 埋めor/index.jratdding-genea/embe`lambd照してください：
- 以下のファイルを参装については、細な実能になります。

詳ステムの構築が可実用的なRAGシ境でのライズ環より、エンタープ仕組みにす。この重要な機能で上させるを大幅に向ティ結果の信頼性とセキュリ検索システムにおける跡システムは、RAGルパス追め

FSxファイ直し

## まと- インデックス設計を見ュの設定を確認
   キャッシ 権限る**
   -能が低下す
3. **検索性の抽出ロジックを確認
 部署情報
   -取得方法を確認 - ユーザー情報の*
  正しく動作しない* **権限チェックが確認

2.切り文字の設定をパス区を確認
   - スの設定xマウントパ  - FS出されない**
 パスが正しく抽*ファイル方法

1. *よくある問題と解決ング

### シューティ トラブルた場合

##ッシュのヒット率が低下した場合
- 権限キャ生しス抽出エラーが発
- ファイルパが閾値を超えた場合権限チェック失敗率

- アラート設定

### 3. ````);
eHit}cach}: ${serIdr ${ufor usee hit log(`⚡ Cache.;
consol`)urceUri}m path: ${soent} frortm: ${depaxtractedtment eog(`📊 Deparonsole.llowed}`);
ct=${aleUri}, resulurc}, file=${soer=${userIdck: usmission che Perle.log(`🔒クログの例
conso
// 権限チェッvascript

```ja# 2. ログ出力シュヒット率

##e`: 権限キャッ.CacheHitRatckingTrath
- `FilePaス拒否回数 アクセsDenied`:ng.AccesePathTracki実行回数
- `Filェックks`: 権限チissionChecing.PermPathTrackileされた文書数
- `F 処理`:umentsedDocing.ProcesslePathTrack `Fi
-ス
リクudWatchメト
### 1. Clo
## 監視・運用
```
iltering
ion-fmissle-pernabtracking --e-file-path-nableh --eploy.ss/deript時に有効化
./scック機能も同
# 権限チェacking
-path-trable-fileenh --oy.spts/deplデプロイ
./scriパス追跡機能を有効にしてsh
# ファイル
```ba設定
. デプロイ時の

### 3"
```alseN_MODE="fPERMISSIOport STRICT_
ex"300"UT=EOHE_TIMN_CACrt PERMISSIOe"
expo"truFILTERING=ION_BLE_PERMISSNA Eexportェック設定

# 権限チTADATA"
DROCK_ME_BEZONAMALD="ADATA_FIEort MET-uri"
expsourcekb-edrock-"x-amz-b_URI_FIELD= SOURCExportrue"
eRACKING="tH_TLE_PATrt ENABLE_FI追跡設定
expoイルパス"

# ファ/fsx-data_PATH="/mntX_MOUNTxport FS
eSxマウントパスh
# Fas

```b環境変数

### 2. ;
}
```(秒)
  }// 300         ber; meout: numacheTise
    c // fal     ;    : booleantrictMode true
    s       //;      olean: bonabled
    eg: {Checkinmission;
  per  }n"
 "unknow    //ring;ment: sttDepart
    defaul (部署情報の位置)    // 3        x: number;   pathIndeaction: {
 partmentExtr"
  deK_METADATABEDROC/ "AMAZON_       /ng;   d: strielFiatametad-uri"
  kb-source-bedrock-// "x-amz      : string;   iField
  sourceUr"ant/fsx-dat/m/ "  /        g; tPath: strinMoun  fsxfig {
ngConePathTrackierface Filt ints
expor.tent-configg/deploym/conficdk/lib
// ptpescri```ty 1. 基本設定

##

#減

## 設定方法管理コストの大幅削理の自動化
- まま活用
- 権限管をその
- 既存のファイル構造用効率
### 4. 運限チェック
ルタイム権
- リア限フィルタリングの最適化速ベクトル検索
- 権OpenSearchの高- 性能検索


### 3. 高ルでの権限管理・個人レベ・チーム
- 部署バー権限との完全統合サーファイル- 既存の細かいアクセス制御
ベルでのァイルレィ
- フュリテ2. 権限ベースセキ### 
ス要求への自動対応
 コンプライアンの完全対応
-能性
- 監査要件へ追跡可から元文書への完全な結果ィ
- 検索リテ 1. 完全なトレーサビ

###

## 技術的優位性らのアクセス権限位部署か織階層に基づく上ース権限**: 組
4. **階層ベスユーザーの関係を確認ル作成者とアクセース権限**: ファイ合
3. **個人ベ報とユーザー権限を照ータのプロジェクト情ベース権限**: メタデロジェクト**プ
2. と照合、ユーザーの所属部署スから部署を抽出しファイルパ**: ース権限

1. **部署ベ類ェックの種## 権限チ

#``
}
`;alse
  return f true;
  turnId)) reuserludes(ers.incctMembojemetadata.pr&  &ctMembersadata.projeet
  if (m有の権限. プロジェクト固  
  // 4;
ruern tturId)) rencludes(useUsers.iadmin&& metadata.adminUsers adata. if (met
 権限  // 3. 管理者
  
 true;') return === 'publicLevel.accessf (metadataセス
  i開ファイルへのアク 
  // 2. 公e;
 ) return truepartment === fileDrDepartmentf (use
  iイルへのアクセス署のファ  // 1. 同じ部
 metadata) {ent,fileDepartmrtment, , userDepaerIdusmission(on hasPerncti;
}

furedResultsturn filte
  re}
  }
  ult);
    .push(resResults filtered  ta)) {
   ment, metadapartleDement, fierDepartd, usserIrmission(u(hasPe  if ロジック
  限チェック  // 権
    業部/...
  /部署/営x-data/mnt/fs3]; // rts[t = pathPaleDepartmen const fi'/');
   i.split(urceUrarts = sothP   const paを抽出
 ら部署情報ルパスか
    // ファイ]);
    K_METADATA'OCMAZON_BEDR._source['Aarse(resultON.pta = JSmetadaonst ;
    ce-uri']-sourcrock-kbe['x-amz-bed._sourcUri = resultource
    const sults) {f searchRessult ot rer (cons
  fo
  ];sults = [Renst filtered{
  coment) artDep userlts, userId,searchResuermissions(ByPlterResultsction fisync funェック実装
a時の権限チt
// RAG検索``javascrip### 実装例

`スフィルタリング

`

## 権限ベー表示
``み結果r: フィルタリング済er-->>Useス使用）
    Usチェック（ファイルパ->>User: 権限Userス
    果 + 元ファイルパr: 検索結-->>Use OS実行
   : ベクトル検索OS  User->>TA
    
  ROCK_METADAAMAZON_BEDuri<br/>ource-b-sbedrock-kx-amz-r OS:  oveote    N    
ファイルパス保存
埋め込み + 元->>OS: ル
    Batchベクト56次元: 2tch>Barock-->   Bedエスト
  埋め込み生成リクBedrock:>>   Batch-抽出・チャンク分割
 : テキストch->>Batchf
    Battract.pd営業部/conx-data/部署//mnt/fs 文書読み込み<br/>atch:>B  FSx->期
  : ファイル同->>FSx
    FS
    ser as RAG検索nt Uarticipah
    pas OpenSearcicipant OS 
    partBedrock as Amazon Bedrockarticipant  p Batch
    AWS Batch ascipant    partip ONTAP
x for NetApx as FSticipant FSarー
    pイルサーバS as ファticipant F parDiagram
   cesequen``mermaid
フロー

`## 3. データ}
```

#  }
01"
chunk-0f-t_2024.pd"contrachunkId": "c   "契約書",
 tType":   "documen  部",
ment": "営業epart    "d",
24.pdfcontract_20部署/営業部/契約書/sx-data/": "/mnt/f  "source
  ATA": {EDROCK_METADON_BMAZ"Af",
  t_2024.pdntrac/co部署/営業部/契約書-data/"/mnt/fsx": e-uriurcsokb--bedrock-"x-amz
  される情報
{rchに保存SeaOpen.pdf

# ontract_2024書/c契約署/営業部/fsx-data/部マウント後
/mnt/APetApp ONTx for N FS

#24.pdfntract_20約書\co\契er\部署\営業部rv\sefile
\\スファイルサーバーパ
# 元の``bash造の例

`ルパス構
### 2. ファイ};
```
)

  }ceUri)(sourypectDocumentT: deteocumentTyperi),
    dourceUh(stFromPattmenparextractDeepartment: ex,
    ddIndmbedding.enIndex: e endtIndex,
   ng.starembedditartIndex: nkId,
    sdding.chu embenkId:
    chu複保存を重 元ファイルパスri,  //sourceUrce: 
    soustringify({': JSON.TADROCK_METADAMAZON_BE
  'Aータ（JSON形式）細メタデ
  
  // 詳OString(), Date().toIS': newteTimeDalastModifiedock-kb-drx-amz-bering(),
  '().toISOStDatenew : reatedDate'ock-kb-cedramz-bg(),
  'x-oStrinngth.tding.text.lebedkb-size': emock--amz-bedr  'x: 'File',
ategory'-c-bedrock-kb'x-amzing,
  edding.embtor': embeddeclt-ve-base-defaudgk-knowle  'bedrocng.text,
NK': embeddiXT_CHUCK_TE_BEDROMAZON  'A').pop(),
split('/ourceUri.: stle'-kb-tiedrock 'x-amz-bルパス
 FSx上の元ファイ// urceUri,  ce-uri': soourbedrock-kb-samz-ールド
  'x-フィase互換wledge Bnoock KdrBe/ t = {
  / documenconstgs 関数
eEmbeddin の stor.jsrator/indexedding-geneemblambda// pt
/
```javascriます：
存しパス情報を保ドキュメントに元ファイルSearch時に、Openム

埋め込み生成ァイルパス保存メカニズ. フ装詳細

### 1## 実ます。

らの課題を根本的に解決しにより、これパス追跡システム
FSxファイル解決策システムの## 本

#可能文書への参照が不- 元査要件への対応が複雑
困難
- 監タリングがづいた検索結果フィルーザー権限に基が失われる
- ユ文書の関連性
- 検索結果と元題ステムにおける課
### RAGシ## 技術的重要性
ています。

現しベースのセキュリティを実ィと権限サビリテ全なトレーら元文書への完。これにより、検索結果か**仕組みです文書参照を可能にするチェックと元存し、RAG検索時に権限earchに保penSファイルパスをOの元App ONTAP上for Net術的特徴は、**FSx の最も重要な技本システム

## 概要

なる技術ム - RAGの核とステ跡シパス追FSx ファイル# 