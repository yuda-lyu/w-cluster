# 規則帳本

本檔為套件設計與開發階段之規則帳本,為要求程式碼須長成什麼樣,或由規格產出之測試(項目/說明/流程)有哪些,包含軸、單一擁有者、已知限制、破壞性變更紀錄,以及對應是哪些測試檔案或指令等,由agent自行編列、擴充與維護.

## 索引

| 規則 | 一句話 | 狀態 |
|---|---|---|
| R-EM-01 | 最近中心距離只有一份實作,e-means與Lloyd對照組共用 | 已套 |
| R-EM-02 | e-means之演算法常數、縮放律、復活與收尾忠於論文與參考實作 | 已套 |
| R-EM-03 | `mode: 'e-means'` 回傳形狀與k-means一致,既有mode行為逐位不變 | 已套 |
| R-EM-04 | e-means之輸入檢測依跨套件規格(K3、K4、K6、V19、V20) | 已套(`opt.debug`警告未做,見已知限制) |
| R-EM-05 | e-means與其對照組只用CPU、單執行緒、純JavaScript | 已套 |
| R-EM-06 | 評測須把演算法與實作效率分開,評測腳本不進npm測試 | 已套 |
| R-EM-07 | 移植Faiss(MIT)之程式須保留原版權與授權文字 | 已套 |

## R-EM-01 最近中心距離之單一擁有者

- **規則**: `(點, 中心)` 之距離評估與最近中心指派只在 `src/WClusterNearest.mjs` 之 `assignNearest` 實作; e-means(`src/WEmeans.mjs`)、Lloyd對照組(`src/WClusterLloyd.mjs`)、`src/WClusterMat.mjs` 之 `kEmeans`(補指派)皆呼叫它. 新增之演算法不得另寫距離迴圈. 距離計算次數以 `stats.dist`(累加 `nRows*k`)計,貪婪k-means++之初始化距離一併計入.
- **盤點指令**: `git grep --no-index -n "assignNearest" -- src` 應只在上列檔案出現(`--no-index` 使尚未提交之新檔亦被掃描); `git grep --no-index -nE "for \(let t = 0; t < d; t\+\+\)" -- src/WEmeans.mjs src/WClusterLloyd.mjs` 之命中須為「更新中心、累加、抽樣」而非最近中心搜尋(Lloyd之 `initKMeansPP` 內單一候選對全部點之距離為k-means++抽樣之一部分,屬計入 `stats.dist` 之例外).
- **站點全集**: `WEmeans.mjs`(批次指派)、`WClusterLloyd.mjs`(每次走訪指派)、`WClusterMat.mjs`(`nEpochs<1` 時未被走訪之列補指派).
- **判準**: 已套 3/3. 同分取較小之群編號(測試 `assignNearest 同距離時取群編號較小者`).
- **精度限制**: 最近中心以 `|c|^2 - 2x·c` 比較(與Faiss同法),資料偏移量遠大於分散度時(如座標1e8而群間距1)有效位數被抵銷而選錯. 故 `kEmeans` 於分群前以 `centerColumns` 將各維置中(平移不改變點間距離); 直接呼叫 `emeans`/`assignNearest` 之內部呼叫者(評測、測試)須自行確保資料已置中或偏移不大.
- **測試**: `test/unit-eMeans.test.mjs` 之「e-means: 共用最近中心核心」、「資料偏移量遠大於分散度時結果不變(置中)」.

## R-EM-02 e-means忠於論文與參考實作

- **依據**: Bessa et al., "e-means: outperforming k-means (in one-tenth the epochs)", arXiv:2611.09501(演算法1、式2~7、附錄H); Faiss `contrib/e_means`(`e_means.py`、`base.py`,對照之commit `c8f2838`).
- **規則**: 常數與公式須與下表一致(測試 `常數依論文與參考實作`、`stepLaw`、`resolveRecipe`、`scheduledAlpha`、`epochRows`、`applyEma`、`splitClusters` 以獨立算式或手算值斷言):

| 項目 | 值/式 | 論文 | 參考實作 | 本庫 |
|---|---|---|---|---|
| 餘弦步長 | `alpha(t) = alpha0*(0.1 + 0.9*0.5*(1+cos(pi*t/M)))` | 式5 | `base.py:174-178` | `WEmeans.mjs scheduledAlpha` |
| 初始質量 | `1e-10` | 演算法1第3列 | `2^-16`(`base.py:25`, FP32) | `INIT_USAGE`(Float64故取論文值) |
| 復活週期/門檻 | 每5次更新;`N_j < 0.1*mean(N)` | 3.1節 | `base.py:21,31` | `CHECK_UNUSED_EVERY`、`UNUSED_THRESHOLD` |
| 復活delta | `1e-4`,座標偶數位 `(1-d)`、奇數位 `(1+d)` | 附錄H式8 | `e_means.py:284-300`、`base.py:28` | `WClusterUtil.mjs splitClusters` |
| d<=2預設不復活 | `NO_REVIVAL_MAX_D=2` | 無 | `base.py:38` | `resolveRecipe` |
| 批次律 | `B=round2(c*k^bk*n^bn*T^bT)`,係數 `(0.035134, 0.134749, 0.876473, 0.813344)`,quality為1/8係數,throughput上限 `round2(n/2)`、quality上限 `floor(n/2)` | 式7、表2 | `base.py:54-57,133-153` | `BATCH_LAWS`、`resolveRecipe` |
| 批次律auto | `d<=16` 用quality,否則throughput | 無 | `base.py:46,89-99` | `resolveBatchLaw` |
| 步長律 | `alpha0=clamp(0.8244*k^-0.4617*B^0.9003*n^-0.4498*T^-0.1057, 1e-4, 1)` | 式6、表2 | `base.py:64,76-86` | `stepLaw` |
| 走訪列數 | `[n]*(whole-1) + [round(frac*n)] + [n]`(ties-to-even) | 無 | `base.py:156-166` | `epochRows` |
| 收尾 | 最後一個走訪之指派平均;未被指派之群維持EMA位置 | 演算法1第12列 | `e_means.py:531-564` | `emeans` 收尾段 |

- **與參考實作之差異**(對論文: 初始質量取論文之1e-10,其餘與論文之式一致; 對參考實作: 見下): Float64且初始質量1e-10(參考實作為FP32與2^-16,首批權重因此不同,數值差異小); mulberry32亂數(逐位結果不同,同seed可重現),復活用之亂數流種子為 `epochSeed(seed, 0x5eed)`(參考實作為 `RandomState(seed)`); 距離核心為共用之單執行緒核心(參考實作用faiss.knn); 不含spherical/max_points_per_centroid/量化/IVF/分散式/GPU/論文3.2節之慢速EMA(參考 `e_means.py` 亦未實作慢速EMA); 每批次僅更新被指派之群之中心範數與批次統計(與逐批次重算全部範數在數學上等價,分裂後全量重算); API層(`kEmeans`)另對 `nEpochs<1` 時未走訪之列依最終中心補指派(參考實作回傳-1),且資料先置中.
- **盤點指令**: `node node_modules/mocha/bin/mocha.js test/unit-eMeans.test.mjs --no-parallel`; 變異證明(單點變異45項,須全部被殺): `node test/tools/mutate-eMeans.mjs`(結果見 `test/_tmp/mut-eMeans/result.tsv`; 源碼改動使變異片段不再唯一時顯示SKIP,須同步更新該工具之變異表).
- **尾批與更新次數**: 總更新次數 `M = Σ ceil(各走訪列數/B)`(保留尾批,與參考實作 `tail_policy: keep` 相同),與論文文字 `T*floor(n/B)` 在n不能被B整除時不同.
- **判準**: 已套.

## R-EM-03 API形狀與既有行為

- **規則**: `WCluster.cluster(data, { mode: 'e-means', ... })` 回傳 `{ keys, ginds, gmat, gltdt }`,`ginds` 依群編號由小到大、空群不輸出、群內index遞增(與 `kMeans` 一致); 各群中心為該群成員之平均(最後走訪之標籤與收尾中心一致); `seed` 給定則可重現. `mode: 'k-means'`、`'k-medoids'` 之程式路徑只允許「新增分支」,不得改既有分支(`WClusterMat.mjs` 之 `kMeans`/`kMedoids`、`WClusterCore.mjs` 既有欄位).
- **站點全集**: `WClusterCore.mjs`(轉傳e-means之opt鍵)、`WClusterMat.mjs`(`kEmeans`、mode白名單)、`WCluster.mjs`(JSDoc).
- **盤點指令**: `git diff -- src/WClusterCore.mjs src/WClusterMat.mjs`(只應新增行); `node node_modules/mocha/bin/mocha.js test/kMeans.test.mjs test/kMedoids-simple.test.mjs test/kMedoids-large.test.mjs test/kMedoids-large-suggest.test.mjs test/PCA.test.mjs --no-parallel`(既有測試須維持原樣全綠).
- **測試**: `test/unit-eMeans.test.mjs` 之「WCluster.cluster mode=e-means(API)」.

## R-EM-04 輸入檢測(跨套件規格 `輸入參數之檢測機制`)

- **規則**:
  - 資料為必須參數: e-means路徑之 `flattenMat` 要求非空陣列之等長陣列列(形狀先於配置記憶體檢測),每個元素為有效數字(數字或數字字串,以wsemi `isenum` 判定,轉換後之值才使用,K4)且絕對值不大於1e100(使平方、內積與各群之和不溢位),標記字串、`null`、布林、`NaN`、`Infinity`、BigInt皆拒收; 訊息為 `invalid data[i][j]: must be a valid number` 等,只帶位置與期望種類,不帶輸入值(V19、V20). 既有之 `data is not eff. array` 訊息維持(既有測試).
  - opt本身須為一般物件(原型為 `Object.prototype` 或 `null`),Date、包裝物件、類別實例、繼承自他物件者整份視為未給(V4); `WClusterCore` 僅於 `mode` 為 `'e-means'` 時才讀取e-means專屬之opt鍵,既有mode不讀(行為不變).
  - opt鍵(`nEpochs`、`batchSize`、`alpha0`、`batchLaw`、`unusedThreshold`、`seed`、`kNumber`): 未給或非預期之輸入(含超出範圍、BigInt、3.7、'0x3'、包裝物件)視為未給,改用預設,不報錯(K3); 數字字串轉換後使用(K4). `kNumber` 由 `WClusterCore` 轉傳其原始輸入(`kNumberRaw`)供檢測(Core對所有mode沿用既有之 `isnum`/`cint` 轉換).
  - 範圍: `nEpochs` 於 (0,1000]; `batchSize` 正整數; `alpha0` 於 (0,1]; `unusedThreshold` >= 0; `seed` 安全整數; `kNumber` 為1至n之整數,否則改用 `min(2, n)`.
  - 不屬e-means範疇之既有前處理(`usePCA` 預設為true之PCA、`nCompNIPALS` 轉換、物件列之欄位篩選 `getEffKeys`)沿用既有行為,其輸入檢測不在本規則內(e-means路徑之完整檢測須 `usePCA: false`); 要統一改善須動既有mode之行為,待裁示.
- **盤點指令**: `git grep --no-index -nE "isenum|iseint" -- src` 應只出現在 `WEmeans.mjs`(opt)、`WClusterUtil.mjs`(`flattenMat`)、`WClusterMat.mjs`(seed); 不得自寫等價之數字檢測.
- **測試**: `K3: opt鍵給了非預期之輸入`、`K4`、`V19/V20` 各案.

## R-EM-05 只用CPU、單執行緒、純JavaScript

- **規則**: `src/WEmeans.mjs`、`src/WClusterNearest.mjs`、`src/WClusterLloyd.mjs`、`src/WClusterUtil.mjs` 不得使用GPU、WebGPU、WebGL、WebAssembly、Worker、原生擴充; 評測之主比較一律單執行緒.
- **盤點指令**: `git grep --no-index -nEi "webgpu|webgl|WebAssembly|worker_threads|new Worker|child_process" -- src/WEmeans.mjs src/WClusterNearest.mjs src/WClusterLloyd.mjs src/WClusterUtil.mjs` 應為空(`--no-index` 使尚未提交之新檔亦被掃描).
- **判準**: 已套(盤點為空).

## R-EM-06 評測規範

- **規則**: 評測腳本在 `toolg/evalEmeans/`(`evalData.mjs`資料、`evalRun.mjs`執行器、`evalReport.mjs`彙整、`evalMemory.mjs`記憶體),不進npm測試(`test/` 只放單元測試); 對照組A與e-means共用核心、同一組初始中心、同一個復活函數; 指標: 訓練與另抽測試集之精確MSE、走訪次數、距離計算次數、CPU與牆鐘時間、記憶體; 多組seed(>=5)報平均與標準差; 評估指派不計入預算與耗時; 合成資料各欄各筆之值由亂數產生而相異; 結論須回答「改善來自演算法或硬體」並照實寫不成立之處.
- **重跑指令**: `node --expose-gc toolg/evalEmeans/evalRun.mjs <設定名>`(設定名見 `evalRun.mjs` 之 `CONFIGS`; 長時間執行請以低優先序,執行期間不要同時跑其他測試以免影響計時),全部完成後 `node toolg/evalEmeans/evalReport.mjs` 重產 `REPORT.md`(結論段手寫於 `toolg/evalEmeans/conclusion.md`).
- **判準**: 已套.

## R-EM-07 第三方授權

- **規則**: `src/WEmeans.mjs` 為Faiss `contrib/e_means`(MIT)之JavaScript移植,檔頭須保留原版權聲明與MIT授權全文; README須有同樣聲明.
- **盤點指令**: `rg -n "Meta Platforms, Inc|MIT License" src/WEmeans.mjs README.md` 兩檔皆須命中.
- **判準**: 已套.

## 已知限制(未做之項目,非死碼)

- `opt.debug`(輸入規格K3之警告出口)未實作: 共用之opt解析函數(wsemi內部 `_optVal`)未公開匯出,依「各函數不各自手寫」暫不實作; 待wsemi公開後套用(已記於 `sgud/feedback/feedback.md`).
- e-means不含: spherical模式、`max_points_per_centroid`、量化、IVF近似指派、分散式/GPU、論文3.2節之慢速EMA收尾.
- 論文縮放律以 n/k>=8、高維嵌入資料擬合; 低維、小n、小k、重疊或無結構資料之表現見 `toolg/evalEmeans/REPORT.md`.
