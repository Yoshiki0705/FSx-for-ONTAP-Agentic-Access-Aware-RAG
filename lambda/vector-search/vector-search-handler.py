alse))re_ascii=F ensu=2,indent, (resultpsjson.dumprint(    None)
 t,st_eventehandler(= lambda_ result }
    
      
     })0.7
    re': in_sco  'm        ': 3,
  op_k 't     
      er','test-us': _id'user            TAPの設定方法',
p ONSx for NetAp 'query': 'F          h',
 earction': 's 'ac          ({
 son.dumps  'body': j',
      thod': 'POST   'httpMe {
     nt =t_eve用
    tes    # テスト:
_"n__mai= "_name__ = }

if __       )
=Falseiisure_asc      }, enat()
      w().isoformime.nomp': datetta      'times        }',
  tr(e)ました: {sーが発生し'内部エラ  'error': f          False,
    success':         '        n.dumps({
'body': jso          ,
         } '*'
     ow-Origin':trol-Alls-Con 'Acces           ,
    8'f-=ut charseton/json;catie': 'applit-Typ 'Conten           
    eaders': {       'h,
     00tusCode': 5  'sta          eturn {
     r)
   : {str(e)}"Lambda実行エラーr(f"r.errogge    lo    
n as e:xceptiopt Ece   ex
              }

   e)_ascii=Falsnsuresult, eps(re: json.dum  'body'              },
 '
       in': '*l-Allow-Origroont  'Access-C           -8',
    charset=utfjson;tion/pplicaype': 'a'Content-T            : {
       'headers'      00,
   ess') else 5('succf result.getde': 200 istatusCo        '   
 urn {
        ret           }
   lse)
      scii=Fansure_a   }, e     }'
        {actionアクション: 不明な 'error': f'                   
 False,ess':      'succ        {
      ps(n.dumjso    'body':                    },
     ': '*'
    low-Originrol-Alontcess-C'Ac               8',
     arset=utf- ch/json;ionplicatap '-Type':   'Content               rs': {
  heade         '     400,
   e':statusCod    '           rn {
 tu       rese:
         el     
         
   user_id)ocument,document(der.index_lt = handl   resu   
                      }
      )
      seii=Falnsure_asc       }, e           
  指定されていません''インデックスする文書が   'error':                
      e,': Falsuccess's                     dumps({
   n.y': jso  'bod                  ,
   }                '*'
  ':ow-Originl-Allccess-Contro          'A          -8',
    utfharset=son; cication/jppl'aent-Type':      'Cont                  rs': {
 heade    '               de': 400,
 atusCo  'st               urn {
           ret
        document: if not                    
 {})
   cument', dy.get('doment = bo       docuクス
       # 文書インデッ
          ':'index== n   elif actio           
    ore)
   _sc_k, miner_id, top(query, usmentssearch_docuandler.ult = h  res
             }
                  e)
       lscii=Fansure_as    }, e               ん'
 リが指定されていませ: '検索クエ 'error'                      
  False,ccess':'su                  ps({
      um.dody': json      'b                },
               ': '*'
   Allow-Origin-Control-ess 'Acc                   8',
    =utf-n; charset/jsoionpplicat 'a-Type':    'Content                 rs': {
        'heade           00,
    atusCode': 4  'st                
   return {             
  ot query:     if n
                  
 ', 0.7))core('min_sdy.get float(bon_score =      mi  
    ))p_k', 5('tody.getnt(bo= i   top_k         
 ')uery', 'body.get('q =       query索
      # ベクトル検         ':
   n == 'search   if actio   
       ler()
   rSearchHandler = Vecto      hand 
         us')
, 'anonymor_id'dy.get('useser_id = bo      uarch')
  'set('action',  = body.ge      action  
        
or {} {}) rs',eteingParamStrqueryvent.get('  body = e      
       else:
     {}'))t('body', 'nt.ge.loads(eveson   body = j:
         POST' 'tp_method == if ht   ータを解析
        # リクエストデ  
    T')
      Method', 'GE('httpet event.gmethod =tp_   htドを確認
      HTTPメソッ     #  :
  try
   ""ト"関数のエントリーポイン"""Lambda
    , context):r(eventda_handledef lamb      }

)
      isoformat(now().: datetime.'timestamp'            
    str(e)}',ーが発生しました: {エラインデックス中に: f'文書のerror'   '         
    alse, Fsuccess':         '
        return {      
     tr(e)}")エラー: {sンデックス(f"文書イlogger.error        :
     as eptioncecept Ex    ex    
       
     }            soformat()
.iime.now() datetp':   'timestam          
   ),e.get('_id'esponsd': rment_idocu        '       ,
 ruecess': Tuc 's         rn {
      tu      re   
        
       user_id}")ーザー: { ユget('_id')},esponse.ID: {rックス完了 - ンデo(f"文書イgger.inf lo             
    
                )id')
  ent.get('  id=docum           doc,
   y=index_    bod          
  ndex_name,self.ix=      inde          t.index(
enf.cli sel response =       ンデックス
    archにイ# OpenSe             
                 }
()
      soformatnow().idatetime.t': ated_a       'upd  ),
       soformat(time.now().id_at': dateeate       'cr       
  r_id]}),: [useusers'alse, 'c': Fliions', {'pubt('permisscument.gens': do'permissio            id,
    ser_ u   'owner':           , {}),
  metadata't.get('ocumen: d 'metadata'               ''),
 urce','sot(t.gece': documensour    '         ,
   t_vectorr': contenectoent_v 'cont             
  t', ''),contenet('t.gt': documen'conten               e', ''),
 'titlocument.get(': d     'title        doc = {
   x_de   in        用文書を構築
  # インデックス            
  
         ))nt', ''t('conteocument.ge_embedding(dgeneratef._ector = selnt_vonte    c  
      を生成 文書の埋め込みベクトル  #         :
  try  """
     に追加"文書をインデックス     ""  , Any]:
 -> Dict[strer_id: str) , Any], us: Dict[strmentdocuelf, (sdex_document  def in
    
  : 0}otal_hits''tts': [], umenn {'doc      retur
      ")e)}整形エラー: {str(検索結果r.error(f"   logge        as e:
 tion xcept Excep
        e        
        }
        hitss': total_l_hit     'tota           ments,
cunts': do 'docume           {
      return             
        )
  (documentappendts.     documen             
          }
                 }
                    le
   itghted_te': highli'titl                  
      _content,ighlightednt': h      'conte             
     s': {highlight          '   ,
       , '')get('owner'': source.      'owner            ''),
   ',atted_pdaet('uurce.g soupdated_at':   '          ),
       at', ''created_ce.get('t': sour_ated  'crea               ', {}),
   datae.get('meta: sourcta'da 'meta               e,
    : scor   'score'             ,
    source', '')urce.get(': so 'source'                 , ''),
  t'.get('contensource 'content':                   e', ''),
 itlt('t source.ge   'title':                 
id', ''),('_.get   'id': hit                 nt = {
ocume          d
                   ', [])
   itle'tt.get(= highlighed_title hlight     hig          ])
 ent', [('contgethighlight.content = ed_ highlight              ライト情報を統合
        # ハイ               
       , {})
   t'igh('highlt = hit.gethighligh            0)
    score', 0.t('_ hit.ge =core      s      )
     {}',sourcet('_ge = hit.ource           sits:
     n h ir hit  fo         []
 ocuments =         d
             ue', 0)
   {}).get('val, t('total'its', {}).get('hs.gesultearch_real_hits = sot       t   ts', [])
  ('hiet{}).gget('hits', sults._researchits =          h  try:
       "
  形"""検索結果を整      ""y]:
  t[str, An str) -> Dicuery:, q, Any]ict[strts: Dresulh_searclf, ults(serch_rest_sea  def _formase
    
   rai         )}")
  ラー: {str(epenSearch検索エ.error(f"O     logger      as e:
 ion  Excepteptxc
        e       onse
     return resp         
                      )
_body
     arch body=se           me,
    x_naex=self.inde        ind      
  .search(ientself.clnse =        respo  
             }
                }
           }
                     ": {}
      "title                 ,
       }                  ": 3
  ntsf_fragmenumber_o       "                     0,
_size": 15ntagme        "fr              
      ntent": {     "co               ": {
       "fields                 t": {
hligh"hig           },
                     
   ]                
 ons"permissi"owner", at", "pdated_", "ud_ateate"cr                  , 
      ta""metadae", ourc "snt",", "conteetitl          "             es": [
 "includ                   {
  ource": "_s               },
           }
                     
    sion_filter] [permis"filter":                       ],
                           }
                                   }
                   }
                                       多くの候補から選択
  * 2  # より"k": top_k                               
         r,uery_vecto: qtor"      "vec                              : {
    nt_vector" "conte                              
     knn": {"                         
             {                    st": [
   "mu                       "bool": {
              {
       "query":                ,
: min_scorescore"min_       "   
      op_k,: tze" "si            {
    = dyearch_bo      s:
       try""
       行"ル検索を実""ベクト    "Any]:
    t[str, oat) -> Dicre: flco: int, min_stop_k                           ], 
   nyr, A: Dict[ston_filtersimiser pt[float],: Lis_vectoreryelf, quor_search(sute_vect def _exec 
             }
 }
       1
      tch":_should_ma"minimum             ],
                   er_id}}
: us {"owner""term":  {               r_id}},
   ers": usermissions.us": {"pe {"term                 
  }},: Trueblic"sions.pumis {"per"term":           {         ld": [
"shou              : {
      "bool"{
        urn        ret権限情報を取得
 、DynamoDBから 実際の実装ではー
        #フィルタ権限基本的な        # 構築"""
限に基づくフィルターを"ユーザー権        ""
r, Any]:ct[stDi -> d: str)lf, user_i(seon_filterissi_perm_build  
    def    raise
          (e)}")
 str埋め込み生成エラー: {error(f"r.   logge          as e:
pt Exception exce 
         )
         ng', []ddimbedy.get('ense_bon respo  retur        
  read())se['body'].loads(respon= json.e_body nsrespo                
       )
             on'
ation/jse='applictentTyp con       ),
        request_bodyon.dumps(ody=js        b      g_model,
  inelf.embeddlId=s    mode            odel(
invoke_m_client.bedrock= self.  response                 
       }
    
       t": textutTex   "inp            ody = {
   request_b          ry:
    t  """
  ベクトルを生成""テキストの埋め込み"
        ]:t[floatListr) -> elf, text: sembedding(s _generate_ def
          }
  
       oformat()e.now().is: datetimstamp'   'time          
   }',(e){strエラーが発生しました: 中にf'検索'error':               se,
  uccess': Fal    's          eturn {
   r          (e)}")
 検索エラー: {strトル"ベクrror(flogger.e           as e:
  eptionpt Exc exce
                  }
     ()
        soformatime.now().iamp': datet  'timest            r_id,
  sed': uuser_i    '   ,
         eryuery': qu'q        ,
        its', 0)et('total_hd_results.gmattel_hits': for'tota         ,
       ts', [])uments.get('docatted_resul': form'documents       ,
         True': cess 'suc               urn {
   ret    
            )
     ]))}"ocuments', [get('dults.tted_res {len(formaid}, 結果数:ser_- ユーザー: {uクトル検索完了 er.info(f"ベ      logg    
        y)
      ults, quer(search_resesultsarch_rrmat_ses = self._foulted_res  formatt         
 結果を整形         # 
             )
             
 n_score mi top_k,ion_filter,ermissector, puery_v           qarch(
     tor_seveclf._execute_sults = search_re     se実行
       ル検索を   # ベクト
                
     user_id)n_filter(ssiomid_peril= self._buon_filter   permissi          権限フィルターを構築
    #  
                 (query)
  ding_embednerate_gef. = selvector     query_       
め込みベクトルを生成    # クエリの埋           try:
"""
     
        果とメタデータ検索結        turns:
    
        Re           小関連度スコア
 : 最ore  min_sc        文書数
  top_k: 取得する            用）
ングタリユーザーID（権限フィルser_id:         uリ
     query: 検索クエ     gs:
           Ar   
        
検索を実行限認識型ベクトル       権""
    ":
     tr, Any]ict[s0.7) -> Dfloat = _score:  5, minop_k: int =d: str, ter_ir, usquery: stelf, documents(sef search_ 
    d1')
   xt-vmbed-te.titan-e', 'amazonING_MODELEMBEDD('etnviron.gmodel = os.eng_beddi     self.em  egion)
 =self.rgion_nameuntime', reock-r'bedrnt(= boto3.clieock_client elf.bedr）
        sイアント（埋め込み生成用 Bedrockクラ    #      
    
       )30
    timeout=          ion,
 tpConnectequestsHtass=Rnection_clcon        
    erts=True,erify_c       vue,
     l=Tr      use_ss  sauth,
    uth=self.awhttp_a            ,
': 443}]'port://', ''), tpshtce('laep_endpoint.rioncollectself.{'host': sts=[   ho      ch(
   penSear.client = O self
       初期化chクライアントarOpenSe        #    
  )
         
  ls.tokenn=credentian_tokessio   se,
         'aoss'            on,
   self.regi         ey,
et_kcrials.sedent cre     
      access_key,credentials.           AWS4Auth(
 f.awsauth =  sel    s()
   t_credential.geion()3.Sessboto= entials  cred証設定
       AWS認    #     
      cuments'
  'rag-do= ex_name self.ind        
ME', '')TION_NA('COLLECgetn.rome = os.enviction_na self.colle      ST', '')
 OR_HOet('VECTenviron.gs.t = oon_endpoinf.collecti        selast-1')
GION', 'us-eREAWS_on.get('s.envir.region = o        self期化"""
"""初        
_(self): __init_def      
""
  "ハンドラークラスクトル検索   """ベ
 ndler:chHaearectorSass Ve__)

clgger(__naming.getLo loggger =)s')
logmessage)s - %(elname- %(lev)s %(asctime format='ging.INFO,ogg(level=licConfiing.bas
logg設定uth

# ログimport AWS4Aws4auth sts_aquere
from iontpConnectstsHtrch, Reque OpenSeay importearchpopens os
from 
importatetimemport datetime i
from donal, Any, Optiistort Dict, L impngtypiom g
frport loggin3
imto
import bomport json
i"""
度検索機能を提供

権限認識型の高精ンドラーrlessベクトル検索ハServeenSearch 
"""
Oputf-8 -*-- coding: -*on3
# th/env py/usr/bin#!